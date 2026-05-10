import json
import logging
import os
from typing import Optional

from groq import Groq
from pydantic import ValidationError

from api.schemas import SynthesisLLMOutput

logger = logging.getLogger("insights.synthesizer")

_client: Optional[Groq] = None


def _get_client() -> Groq:
    global _client
    if _client is None:
        api_key = os.getenv("GROQ_API_KEY")
        if not api_key:
            raise RuntimeError("GROQ_API_KEY não configurado")
        _client = Groq(api_key=api_key)
    return _client


def _build_sessions_block(sessions: list[dict]) -> str:
    # ISO 8601 (YYYY-MM-DD) ordena corretamente como string; datas em outros
    # formatos serão colocadas no final (string vazia) sem crash.
    sorted_sessions = sorted(sessions, key=lambda s: s.get("sessionDate") or "")

    blocks = []
    for i, s in enumerate(sorted_sessions, 1):
        date = s.get("sessionDate") or "Data não informada"
        session_id = s.get("id") or f"sem-id-{i}"

        parts = []
        for field in ("transcript", "clinicalNotes", "manualNotes", "interventions", "sessionSummaryManual", "nextSteps"):
            val = s.get(field)
            if val and str(val).strip():
                parts.append(str(val).strip())

        highlights = s.get("highlights") or []
        if highlights:
            parts.append("Destaques: " + "; ".join(str(h) for h in highlights))

        content = "\n".join(parts) if parts else "Sem conteúdo registrado."
        blocks.append(f"--- SESSÃO {i} (ID: {session_id}, Data: {date}) ---\n{content}")

    return "\n\n".join(blocks)


# ---------------------------------------------------------------------------
# Prompts — versão com anti-alucinação reforçada
# ---------------------------------------------------------------------------

_SYSTEM_PROMPT = """Você é um assistente clínico de apoio ao psicólogo, NÃO um substituto.

PAPEL:
- Sintetizar, organizar e estruturar exclusivamente o que está documentado nas notas.
- Nunca diagnosticar, prescrever, prognosticar ou substituir o julgamento clínico.

REGRAS ABSOLUTAS (violá-las é um erro grave):
1. Baseie-se SOMENTE no texto fornecido. Proibido inferir, supor ou extrapolar.
2. Se não houver evidência textual para um campo, retorne [] ou "". Nunca invente exemplos.
3. Para cada afirmação em "improvements", "concerns", "milestones" e "risk_flags",
   cite entre parênteses de qual sessão veio (ex: "(Sessão 3)").
4. Diferencie claramente: fatos relatados pelo paciente vs. hipóteses da psicóloga.
5. NÃO use terminologia diagnóstica que o psicólogo não usou nas notas.
6. Ausência de sessão ou falta NÃO é evidência de deterioração ou resistência.
7. Linguagem especulativa nas notas ("possível", "a investigar") deve ser reproduzida,
   não transformada em afirmação.
8. Retorne APENAS JSON válido. Zero texto fora do JSON."""

_USER_PROMPT_TEMPLATE = """Paciente: {patient_name}
Total de sessões: {session_count}

{sessions_block}

Analise o histórico acima e retorne um JSON com exatamente esta estrutura.
Para cada item em listas, cite entre parênteses o número da sessão de origem.

{{
  "summary": "Parágrafo de 3-5 frases resumindo a trajetória geral baseada nas notas.",
  "evolution_analysis": "Parágrafo de 3-6 frases sobre evolução entre sessões. Se não houver dados comparativos, retorne string vazia.",
  "key_themes": ["tema 1 (Sessão X)", "tema 2 (Sessão Y)"],
  "improvements": ["melhora com evidência textual (Sessão X)", "..."],
  "concerns": ["ponto de atenção com evidência textual (Sessão X)", "..."],
  "risk_flags": ["risco identificado nas notas (Sessão X)", "..."],
  "milestones": ["marco com evidência textual (Sessão X)", "..."],
  "recommendations": ["recomendação baseada no conteúdo das notas", "..."]
}}

IMPORTANTE: se não houver evidência suficiente para preencher um campo, retorne [] ou "".
Retorne SOMENTE o JSON, sem nenhum texto adicional."""


def synthesize_patient(patient: dict, sessions: list[dict]) -> dict:
    patient_name = patient.get("name") or "Paciente"
    session_count = len(sessions)
    sessions_block = _build_sessions_block(sessions)

    user_prompt = _USER_PROMPT_TEMPLATE.format(
        patient_name=patient_name,
        session_count=session_count,
        sessions_block=sessions_block,
    )

    client = _get_client()
    response = client.chat.completions.create(
        model="llama-3.3-70b-versatile",
        messages=[
            {"role": "system", "content": _SYSTEM_PROMPT},
            {"role": "user", "content": user_prompt},
        ],
        temperature=0.3,
        max_tokens=2048,
        response_format={"type": "json_object"},
    )

    raw = response.choices[0].message.content or "{}"

    try:
        data = json.loads(raw)
    except json.JSONDecodeError as exc:
        logger.error("LLM retornou JSON inválido: %s", exc)
        raise RuntimeError("Falha ao processar resposta do modelo de linguagem") from exc

    try:
        validated = SynthesisLLMOutput.model_validate(data)
    except ValidationError as exc:
        # Loga sem incluir dados do paciente
        logger.warning(
            "Resposta LLM fora do schema esperado (%d erros); usando defaults.",
            len(exc.errors()),
        )
        validated = SynthesisLLMOutput()

    return {
        "summary": validated.summary,
        "evolution_analysis": validated.evolution_analysis,
        "key_themes": validated.key_themes,
        "improvements": validated.improvements,
        "concerns": validated.concerns,
        "risk_flags": validated.risk_flags,
        "milestones": validated.milestones,
        "recommendations": validated.recommendations,
        "sessions_analyzed": session_count,
    }
