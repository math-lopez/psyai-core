import json
import os
from typing import Optional

from groq import Groq

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
    sorted_sessions = sorted(sessions, key=lambda s: s.get("sessionDate") or "")
    blocks = []
    for i, s in enumerate(sorted_sessions, 1):
        date = s.get("sessionDate") or "Data não informada"
        parts = []
        for field in ("transcript", "clinicalNotes", "manualNotes", "interventions", "sessionSummaryManual", "nextSteps"):
            val = s.get(field)
            if val and str(val).strip():
                parts.append(str(val).strip())
        highlights = s.get("highlights") or []
        if highlights:
            parts.append("Destaques: " + "; ".join(str(h) for h in highlights))

        content = "\n".join(parts) if parts else "Sem conteúdo registrado."
        blocks.append(f"--- SESSÃO {i} ({date}) ---\n{content}")

    return "\n\n".join(blocks)


_SYSTEM_PROMPT = """Você é um assistente clínico especializado em psicologia.
Sua função é analisar o histórico completo de sessões terapêuticas de um paciente e gerar uma síntese longitudinal profissional.

Regras:
- Escreva em português brasileiro, linguagem clínica mas acessível ao psicólogo
- Seja objetivo e baseado somente nas informações fornecidas
- Não invente informações que não estão no texto
- Identifique evoluções reais comparando sessões ao longo do tempo
- Responda SOMENTE com JSON válido, sem markdown, sem texto fora do JSON"""

_USER_PROMPT_TEMPLATE = """Paciente: {patient_name}
Total de sessões: {session_count}

{sessions_block}

Analise todo o histórico acima e retorne um JSON com exatamente esta estrutura:

{{
  "summary": "Parágrafo de 3-5 frases resumindo a trajetória geral do paciente no processo terapêutico.",
  "evolution_analysis": "Parágrafo de 3-6 frases descrevendo como o paciente evoluiu ao longo das sessões — compare estado inicial com estado atual, identifique tendências.",
  "key_themes": ["tema central 1", "tema central 2", "..."],
  "improvements": ["melhora identificada 1", "melhora identificada 2", "..."],
  "concerns": ["ponto de atenção ou piora 1", "ponto de atenção 2", "..."],
  "risk_flags": ["risco identificado 1", "..."],
  "milestones": ["marco importante 1 (ex: primeira vez que relatou X)", "..."],
  "recommendations": ["recomendação clínica 1", "recomendação 2", "..."]
}}

Se não houver dados suficientes para algum campo, retorne lista vazia [] ou string vazia "".
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
    data = json.loads(raw)

    return {
        "summary": data.get("summary", ""),
        "evolution_analysis": data.get("evolution_analysis", ""),
        "key_themes": data.get("key_themes", []),
        "improvements": data.get("improvements", []),
        "concerns": data.get("concerns", []),
        "risk_flags": data.get("risk_flags", []),
        "milestones": data.get("milestones", []),
        "recommendations": data.get("recommendations", []),
        "sessions_analyzed": session_count,
    }
