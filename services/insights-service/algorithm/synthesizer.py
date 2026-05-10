"""
Clinical pipeline for synthesize-patient.

Architecture (internal only — external SynthesisResponse shape is unchanged):

  Stage 1 — Per-session factual extraction
             One LLM call per session, temperature=0.1.
             Extracts themes, attention_points, alerts, evolution_markers and
             professional_recommendations as structured JSON with mandatory
             evidence_excerpt on every item.

  Stage 2 — Programmatic validation
             Rule-based filters run without LLM:
             - Alerts with negated=True or confidence < 0.5 are dropped.
             - Any item whose evidence_excerpt is shorter than 10 chars is dropped.
             - Session identity fields (session_id, session_number) are always
               overwritten with ground-truth values so the LLM cannot mix sessions.

  Stage 3 — Longitudinal synthesis
             LLM receives ONLY the validated structured JSON from Stage 2.
             It never sees the raw session text again.
             temperature=0.2, json_mode, retry x3.
"""

import json
import logging
import os
import time
import uuid
from typing import Optional

from groq import Groq
from pydantic import ValidationError
from tenacity import (
    retry,
    retry_if_exception_type,
    stop_after_attempt,
    wait_exponential,
)

from api.schemas import (
    AlertType,
    SessionExtraction,
    SynthesisLLMOutput,
)

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


# ---------------------------------------------------------------------------
# Session text builder
# ---------------------------------------------------------------------------

def _build_session_text(session: dict) -> str:
    """Builds a labeled text block from session fields.
    Field labels ([TRANSCRIÇÃO], [NOTAS CLÍNICAS], …) give the LLM explicit
    section boundaries so it cannot attribute content from one field to another.
    """
    parts = []
    field_labels = [
        ("transcript",            "TRANSCRIÇÃO"),
        ("clinicalNotes",         "NOTAS CLÍNICAS"),
        ("manualNotes",           "NOTAS MANUAIS"),
        ("interventions",         "INTERVENÇÕES"),
        ("sessionSummaryManual",  "RESUMO MANUAL"),
        ("nextSteps",             "PRÓXIMOS PASSOS"),
    ]
    for field, label in field_labels:
        val = (session.get(field) or "").strip()
        if val:
            parts.append(f"[{label}]\n{val}")

    highlights = session.get("highlights") or []
    lines = "\n".join(f"- {h}" for h in highlights if str(h).strip())
    if lines:
        parts.append(f"[DESTAQUES]\n{lines}")

    return "\n\n".join(parts)


def _sort_sessions(sessions: list[dict]) -> list[dict]:
    return sorted(sessions, key=lambda s: s.get("sessionDate") or "")


# ---------------------------------------------------------------------------
# LLM client — retry wrapper
# ---------------------------------------------------------------------------

@retry(
    stop=stop_after_attempt(3),
    wait=wait_exponential(multiplier=1, min=2, max=8),
    retry=retry_if_exception_type(Exception),
    reraise=True,
)
def _call_llm_json(
    client: Groq,
    system: str,
    user: str,
    temperature: float,
    max_tokens: int,
) -> dict:
    """Single LLM call returning a parsed JSON dict. Retries up to 3× with
    exponential back-off (2 s → 4 s → 8 s) on any exception."""
    response = client.chat.completions.create(
        model="llama-3.3-70b-versatile",
        messages=[
            {"role": "system", "content": system},
            {"role": "user", "content": user},
        ],
        temperature=temperature,
        max_tokens=max_tokens,
        response_format={"type": "json_object"},
    )
    raw = response.choices[0].message.content or "{}"
    return json.loads(raw)


# ---------------------------------------------------------------------------
# Stage 1 — Per-session factual extraction
# ---------------------------------------------------------------------------

_EXTRACTION_SYSTEM = """Você é um assistente especializado em extração de informações clínicas de anotações de sessões psicológicas.

## FUNÇÃO EXCLUSIVA
Extrair SOMENTE o que está EXPLICITAMENTE no texto desta sessão.
Você analisa UMA sessão por vez. Não há outras sessões disponíveis.

## PODE:
- Reproduzir fatos descritos literalmente no texto
- Identificar emoções NOMEADAS explicitamente
- Listar eventos relatados pelo paciente ou observados pelo profissional
- Registrar recomendações que o profissional explicitamente fez
- Registrar quando algo foi NEGADO (negated: true)

## NÃO PODE:
- Inferir diagnóstico de qualquer tipo
- Transformar evento isolado em padrão comportamental ("sempre", "nunca")
- Transformar sofrimento emocional em risco clínico sem evidência explícita
- Adicionar contexto não mencionado no texto
- Transformar hipótese do profissional em fato do paciente
- Criar alertas para: conflito familiar, autossabotagem, sofrimento emocional,
  dificuldades relacionais, faltas justificadas

## ALERTAS CLÍNICOS — SOMENTE se o texto contiver evidência explícita de:
- ideacao_suicida: paciente relata pensamentos de morte/suicídio explicitamente
- autolesao: paciente relata ou apresenta autolesão
- risco_violencia: ameaça explícita de violência relatada no texto
- abuso_substancias: uso problemático de substâncias explicitamente relatado
- crise_aguda: surto, dissociação ou alucinação descritos no texto
- dependencia_grave: dependência severa com prejuízo funcional documentado
- prejuizo_funcional_severo: incapacidade funcional explicitamente relatada

## evidence_excerpt — OBRIGATÓRIO em cada item:
Inclua o trecho LITERAL do texto original (mínimo 10 caracteres).
Se não encontrar o trecho exato, NÃO inclua o item.

## confidence_score:
- 0.90–1.0 → paciente afirmou explicitamente
- 0.70–0.89 → profissional descreve relato do paciente
- 0.50–0.69 → profissional observou comportamento
- 0.30–0.49 → linguagem especulativa (possível, parece, hipótese)
- ABAIXO de 0.50 → NÃO inclua em alerts

Retorne APENAS JSON válido. Zero texto fora do JSON."""


def _build_extraction_prompt(
    session_text: str,
    session_number: int,
    session_date: str,
    session_id: str,
) -> str:
    enum_themes = (
        "ansiedade|tristeza_persistente|sobrecarga|conflito_relacional|"
        "isolamento|dificuldade_assertividade|autoestima|luto|"
        "experiencia_traumatica|burnout|evolucao_positiva|questoes_existenciais|outro"
    )
    enum_alerts = (
        "ideacao_suicida|autolesao|risco_violencia|"
        "abuso_substancias|crise_aguda|dependencia_grave|prejuizo_funcional_severo"
    )
    enum_evolution = "melhora|piora|estavel|ambivalente|indeterminado"

    return f"""Extraia os dados clínicos desta sessão.

SESSÃO {session_number} | Data: {session_date} | ID: {session_id}
{"=" * 60}
{session_text}
{"=" * 60}

Retorne JSON com esta estrutura exata:
{{
  "session_id": "{session_id}",
  "session_number": {session_number},
  "session_date": "{session_date}",
  "themes": [
    {{
      "category": "<{enum_themes}>",
      "description": "<descrição sem linguagem diagnóstica, máximo 120 caracteres>",
      "source_session": {session_number},
      "session_id": "{session_id}",
      "evidence_excerpt": "<trecho literal do texto acima, mínimo 10 caracteres>",
      "confidence_score": 0.0
    }}
  ],
  "attention_points": [
    {{
      "description": "<ponto de atenção observacional, sem diagnóstico>",
      "source_session": {session_number},
      "session_id": "{session_id}",
      "evidence_excerpt": "<trecho literal do texto acima>",
      "confidence_score": 0.0
    }}
  ],
  "alerts": [
    {{
      "alert_type": "<{enum_alerts}>",
      "description": "<descrição do alerta com linguagem cautelosa>",
      "source_session": {session_number},
      "session_id": "{session_id}",
      "evidence_excerpt": "<trecho literal do texto acima>",
      "confidence_score": 0.0,
      "negated": false
    }}
  ],
  "evolution_markers": [
    {{
      "direction": "<{enum_evolution}>",
      "description": "<descrição da evolução observada>",
      "source_session": {session_number},
      "session_id": "{session_id}",
      "evidence_excerpt": "<trecho literal do texto acima>",
      "confidence_score": 0.0
    }}
  ],
  "professional_recommendations": [
    "<recomendação EXPLICITAMENTE feita pelo profissional no texto>"
  ]
}}

REGRAS FINAIS:
- Se não há temas evidentes → "themes": []
- Se não há alertas com evidência forte (>= 0.50) → "alerts": []
- evidence_excerpt é OBRIGATÓRIO — sem ele não inclua o item
- NÃO crie alertas para sofrimento emocional, conflito familiar ou autossabotagem"""


def _extract_session(
    client: Groq,
    session: dict,
    session_number: int,
    request_id: str,
) -> SessionExtraction:
    """Stage 1: extract structured facts from a single session."""
    session_id   = (session.get("id") or f"session_{session_number}").strip()
    session_date = (session.get("sessionDate") or "data-nao-informada").strip()
    session_text = _build_session_text(session)
    text_length  = len(session_text)

    empty = SessionExtraction(
        session_id=session_id,
        session_number=session_number,
        session_date=session_date,
        raw_text_length=text_length,
    )

    if text_length < 30:
        logger.info(
            "stage1_session_skipped",
            extra={
                "request_id": request_id,
                "session_id": session_id,
                "session_number": session_number,
                "reason": "text_too_short",
                "text_length": text_length,
            },
        )
        return empty

    user_prompt = _build_extraction_prompt(
        session_text=session_text,
        session_number=session_number,
        session_date=session_date,
        session_id=session_id,
    )

    try:
        raw = _call_llm_json(
            client=client,
            system=_EXTRACTION_SYSTEM,
            user=user_prompt,
            temperature=0.1,
            max_tokens=2000,
        )

        # Ground-truth override — the LLM must not decide which session this is.
        raw["session_id"]      = session_id
        raw["session_number"]  = session_number
        raw["session_date"]    = session_date
        raw["raw_text_length"] = text_length

        extraction = SessionExtraction.model_validate(raw)

        logger.info(
            "stage1_session_extracted",
            extra={
                "request_id":      request_id,
                "session_id":      session_id,
                "session_number":  session_number,
                "themes":          len(extraction.themes),
                "attention_points": len(extraction.attention_points),
                "alerts":          len(extraction.alerts),
                "evolution_markers": len(extraction.evolution_markers),
            },
        )
        return extraction

    except Exception as exc:
        logger.error(
            "stage1_extraction_failed",
            extra={
                "request_id":     request_id,
                "session_id":     session_id,
                "session_number": session_number,
                "error":          str(exc),
            },
        )
        return empty


# ---------------------------------------------------------------------------
# Stage 2 — Programmatic validation
# ---------------------------------------------------------------------------

_MIN_EVIDENCE_LEN   = 10   # characters
_MIN_ALERT_CONF     = 0.5  # below this → alert dropped regardless of content


def _validate_extractions(
    extractions: list[SessionExtraction],
    request_id: str,
) -> list[SessionExtraction]:
    """Stage 2: remove items that lack grounding or fail clinical safety rules.
    No LLM call. Pure rule-based filtering."""
    result: list[SessionExtraction] = []

    for ext in extractions:
        # Alerts: drop negated, low-confidence, or evidence-free items
        valid_alerts = [
            a for a in ext.alerts
            if not a.negated
            and a.confidence_score >= _MIN_ALERT_CONF
            and len(a.evidence_excerpt.strip()) >= _MIN_EVIDENCE_LEN
        ]

        # Themes, attention points, evolution markers: only require evidence
        valid_themes = [
            t for t in ext.themes
            if len(t.evidence_excerpt.strip()) >= _MIN_EVIDENCE_LEN
        ]
        valid_attention = [
            p for p in ext.attention_points
            if len(p.evidence_excerpt.strip()) >= _MIN_EVIDENCE_LEN
        ]
        valid_evolution = [
            e for e in ext.evolution_markers
            if len(e.evidence_excerpt.strip()) >= _MIN_EVIDENCE_LEN
        ]

        removed_alerts = len(ext.alerts) - len(valid_alerts)
        removed_themes = len(ext.themes) - len(valid_themes)

        if removed_alerts:
            logger.warning(
                "stage2_alerts_removed",
                extra={
                    "request_id": request_id,
                    "session_id": ext.session_id,
                    "removed":    removed_alerts,
                },
            )
        if removed_themes:
            logger.warning(
                "stage2_themes_removed",
                extra={
                    "request_id": request_id,
                    "session_id": ext.session_id,
                    "removed":    removed_themes,
                },
            )

        result.append(
            ext.model_copy(update={
                "alerts":           valid_alerts,
                "themes":           valid_themes,
                "attention_points": valid_attention,
                "evolution_markers": valid_evolution,
            })
        )

    return result


# ---------------------------------------------------------------------------
# Stage 3 — Longitudinal synthesis from structured data
# ---------------------------------------------------------------------------

_SYNTHESIS_SYSTEM = """Você é um assistente clínico de documentação psicológica.

## ENTRADA
Você receberá dados ESTRUTURADOS já extraídos e validados de sessões psicológicas.
Você NÃO tem acesso ao texto original das sessões — trabalhe SOMENTE com estes dados.

## FUNÇÃO
Sintetizar os dados estruturados em análise longitudinal coerente.

## REGRAS ABSOLUTAS

1. USE SOMENTE OS DADOS ESTRUTURADOS FORNECIDOS
   - Não crie fatos, temas ou alertas que não estejam nos dados
   - Se um campo não tem dados suficientes → retorne [] ou ""
   - Nunca invente exemplos ou contexto

2. CITAÇÃO OBRIGATÓRIA
   - Cite a sessão de origem em cada afirmação: "(Sessão N)"
   - Nunca faça afirmações sem referência à sessão específica

3. LINGUAGEM SEGURA
   - Não use terminologia diagnóstica que não esteja nos dados
   - Use: "o paciente relatou", "foi observado", "o profissional registrou"
   - Não use: "sofre de", "tem diagnóstico de", "apresenta transtorno"

4. RISK_FLAGS — regra estrita
   - Inclua em risk_flags SOMENTE os alerts dos dados estruturados com negated=false
   - Não crie novos alertas por inferência
   - Conflito familiar, autossabotagem e sofrimento emocional NÃO são risk_flags

5. CONCERNS vs RISK_FLAGS
   - concerns → vem dos attention_points dos dados (observacional, não clínico)
   - risk_flags → vem dos alerts com negated=false dos dados (clínico formal)

6. CAMPOS VAZIOS SÃO CORRETOS
   - evolution_analysis="" se apenas 1 sessão ou dados insuficientes
   - risk_flags=[] se nenhum alert validado nos dados

Retorne APENAS JSON válido. Zero texto fora do JSON."""


def _build_synthesis_prompt(
    patient_name: str,
    extractions: list[SessionExtraction],
) -> str:
    extr_json = json.dumps(
        [e.model_dump() for e in extractions],
        ensure_ascii=False,
        indent=2,
    )

    dates = [e.session_date for e in extractions if e.session_date != "data-nao-informada"]
    if len(dates) > 1:
        period = f"{dates[0]} a {dates[-1]}"
    elif dates:
        period = dates[0]
    else:
        period = "N/D"

    return f"""Paciente: {patient_name}
Total de sessões: {len(extractions)}
Período: {period}

DADOS ESTRUTURADOS EXTRAÍDOS E VALIDADOS:
{extr_json}

Com base EXCLUSIVAMENTE nestes dados, gere a síntese longitudinal.
Cite "(Sessão N)" em cada afirmação.

Retorne JSON com esta estrutura:
{{
  "summary": "3-5 frases sobre trajetória geral com citações de sessão.",
  "evolution_analysis": "3-6 frases comparando evolução entre sessões. String vazia se 1 sessão ou dados insuficientes.",
  "key_themes": ["tema dos dados (Sessão X)", "..."],
  "improvements": ["melhora dos evolution_markers com direction=melhora (Sessão X)", "..."],
  "concerns": ["ponto de atenção dos attention_points (Sessão X)", "..."],
  "risk_flags": ["alerta dos alerts com negated=false (Sessão X)", "..."],
  "milestones": ["marco clínico documentado nos dados (Sessão X)", "..."],
  "recommendations": ["dos professional_recommendations ou dos dados (Sessão X)", "..."]
}}

LEMBRETE: risk_flags SOMENTE de alerts.negated=false. Nada inventado."""


def _synthesize_from_extractions(
    client: Groq,
    patient_name: str,
    extractions: list[SessionExtraction],
    request_id: str,
) -> SynthesisLLMOutput:
    """Stage 3: LLM synthesis over structured data only. Raw text is never seen here."""
    user_prompt = _build_synthesis_prompt(patient_name, extractions)

    try:
        raw = _call_llm_json(
            client=client,
            system=_SYNTHESIS_SYSTEM,
            user=user_prompt,
            temperature=0.2,
            max_tokens=2048,
        )
        result = SynthesisLLMOutput.model_validate(raw)
        logger.info(
            "stage3_synthesis_complete",
            extra={
                "request_id":  request_id,
                "themes":      len(result.key_themes),
                "risk_flags":  len(result.risk_flags),
                "has_evolution": bool(result.evolution_analysis),
            },
        )
        return result

    except Exception as exc:
        logger.error(
            "stage3_synthesis_failed",
            extra={"request_id": request_id, "error": str(exc)},
        )
        return SynthesisLLMOutput()


# ---------------------------------------------------------------------------
# Public entry point (called by main.py — signature unchanged)
# ---------------------------------------------------------------------------

def synthesize_patient(
    patient: dict,
    sessions: list[dict],
    request_id: str = "",
) -> dict:
    """Three-stage clinical pipeline for longitudinal synthesis.

    Accepts an optional request_id for correlated logging across stages.
    Returns a dict that maps directly to SynthesisResponse — unchanged shape.
    """
    if not request_id:
        request_id = str(uuid.uuid4())

    patient_name    = (patient.get("name") or "Paciente").strip()
    client          = _get_client()
    sorted_sessions = _sort_sessions(sessions)
    session_count   = len(sorted_sessions)

    logger.info(
        "pipeline_start",
        extra={"request_id": request_id, "session_count": session_count},
    )

    # ---- Stage 1: one LLM call per session --------------------------------
    t0 = time.perf_counter()
    extractions: list[SessionExtraction] = [
        _extract_session(client, session, idx, request_id)
        for idx, session in enumerate(sorted_sessions, 1)
    ]
    logger.info(
        "stage1_complete",
        extra={
            "request_id":    request_id,
            "extractions":   len(extractions),
            "total_themes":  sum(len(e.themes) for e in extractions),
            "total_alerts":  sum(len(e.alerts) for e in extractions),
            "elapsed_ms":    round((time.perf_counter() - t0) * 1000),
        },
    )

    # ---- Stage 2: programmatic validation (no LLM) ------------------------
    t1 = time.perf_counter()
    validated = _validate_extractions(extractions, request_id)
    logger.info(
        "stage2_complete",
        extra={
            "request_id":   request_id,
            "valid_alerts": sum(len(e.alerts) for e in validated),
            "valid_themes": sum(len(e.themes) for e in validated),
            "elapsed_ms":   round((time.perf_counter() - t1) * 1000),
        },
    )

    # ---- Stage 3: synthesis over structured data only ---------------------
    t2 = time.perf_counter()
    synthesis = _synthesize_from_extractions(client, patient_name, validated, request_id)
    logger.info(
        "stage3_complete",
        extra={
            "request_id": request_id,
            "elapsed_ms": round((time.perf_counter() - t2) * 1000),
        },
    )

    logger.info(
        "pipeline_complete",
        extra={
            "request_id": request_id,
            "total_ms":   round((time.perf_counter() - t0) * 1000),
        },
    )

    return {
        "summary":           synthesis.summary,
        "evolution_analysis": synthesis.evolution_analysis,
        "key_themes":        synthesis.key_themes,
        "improvements":      synthesis.improvements,
        "concerns":          synthesis.concerns,
        "risk_flags":        synthesis.risk_flags,
        "milestones":        synthesis.milestones,
        "recommendations":   synthesis.recommendations,
        "sessions_analyzed": session_count,
    }
