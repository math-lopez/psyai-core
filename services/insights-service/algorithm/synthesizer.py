"""
Clinical pipeline for synthesize-patient.

Architecture (internal only — external SynthesisResponse shape defined in api/schemas.py):

  Stage 1 — Per-session factual extraction
             One LLM call per session, temperature=0.1.
             Extracts themes, attention_points, alerts, evolution_markers,
             administrative_events and professional_recommendations as
             structured JSON with mandatory evidence_excerpt on every item.

  Stage 2 — Programmatic validation
             Rule-based filters, no LLM:
             - Alerts: drop negated, confidence < 0.5, or evidence < 10 chars.
             - Attention points: rescue admin events that leaked into clinical fields.
             - Session identity (session_id, session_number) always overwritten
               with ground-truth values — the LLM never controls session attribution.

  Stage 3 — Longitudinal synthesis
             LLM receives ONLY the validated structured JSON from Stage 2.
             It never sees the raw session text again.
             temperature=0.2, json_mode, retry x3.

  Post-validate — Programmatic quality pass on Stage 3 output:
             - Remove generic milestones.
             - Remove clinical_alerts without evidence_excerpt.
             - Remove synthesized_recommendations that are too generic.
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
    AdministrativeEvent,
    AdminEventType,
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
    section boundaries so content from one field cannot bleed into another.
    """
    parts = []
    field_labels = [
        ("transcript",           "TRANSCRIÇÃO"),
        ("clinicalNotes",        "NOTAS CLÍNICAS"),
        ("manualNotes",          "NOTAS MANUAIS"),
        ("interventions",        "INTERVENÇÕES"),
        ("sessionSummaryManual", "RESUMO MANUAL"),
        ("nextSteps",            "PRÓXIMOS PASSOS"),
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
    """Single LLM call returning a parsed JSON dict.
    Retries up to 3× with exponential back-off (2 s → 4 s → 8 s)."""
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
# Stage 2 helpers — admin event detection
# ---------------------------------------------------------------------------

_ADMIN_KEYWORDS = frozenset({
    "falta", "ausência", "ausentou", "não compareceu", "não pode comparecer",
    "reagendamento", "remarcou", "remarcar", "atraso", "chegou atrasad",
    "troca de horário", "cancelou", "cancelamento", "sessão cancelada",
    "não houve sessão", "sessão não realizada", "desmarcou",
})


def _looks_like_admin_event(text: str) -> bool:
    """Returns True if the text describes a logistical/administrative event."""
    text_lower = text.lower()
    return any(kw in text_lower for kw in _ADMIN_KEYWORDS)


# ---------------------------------------------------------------------------
# Stage 3 / post-validate helpers
# ---------------------------------------------------------------------------

_GENERIC_MILESTONE_PHRASES = frozenset({
    "continuidade do acompanhamento",
    "manutenção do acompanhamento",
    "continuação da terapia",
    "acompanhamento terapêutico",
    "seguimento terapêutico",
    "manter o acompanhamento",
    "continuar o processo",
    "continuar as sessões",
    "seguir com as sessões",
    "prosseguir com o tratamento",
})

_GENERIC_RECOMMENDATION_PHRASES = frozenset({
    "continuar o acompanhamento",
    "manter o processo terapêutico",
    "seguir com a terapia",
    "continuar as sessões",
    "manter as sessões",
    "dar continuidade",
})


def _is_generic_milestone(text: str) -> bool:
    t = text.lower()
    return any(phrase in t for phrase in _GENERIC_MILESTONE_PHRASES)


def _is_generic_recommendation(text: str) -> bool:
    if len(text.strip()) < 20:
        return True
    t = text.lower()
    return any(phrase in t for phrase in _GENERIC_RECOMMENDATION_PHRASES)


# ---------------------------------------------------------------------------
# Stage 1 — Per-session extraction
# ---------------------------------------------------------------------------

_EXTRACTION_SYSTEM = """Você é um assistente especializado em extração de informações clínicas de anotações de sessões psicológicas.

## FUNÇÃO EXCLUSIVA
Extrair SOMENTE o que está EXPLICITAMENTE no texto desta sessão.
Você analisa UMA sessão por vez. Não há outras sessões disponíveis.

## QUATRO CATEGORIAS — use cada uma corretamente:

### 1. themes (temas clínicos)
Assuntos recorrentes ou contextos terapêuticos relevantes.
Exemplos: autonomia, dificuldades no trabalho, relação familiar, manejo emocional.
NÃO representam risco. NÃO são alertas.

### 2. attention_points (pontos de atenção)
Pontos clínicos importantes para acompanhamento terapêutico.
Exemplos: autossabotagem, dificuldade de assertividade, instabilidade emocional.
São clinicamente relevantes, mas NÃO são alertas clínicos formais.
IMPORTANTE: eventos administrativos (falta, atraso, reagendamento) NÃO vão aqui.

### 3. alerts (alertas clínicos)
SOMENTE com evidência EXPLÍCITA de:
- ideacao_suicida: paciente relata pensamentos de morte/suicídio
- autolesao: autolesão relatada ou observada
- risco_violencia: ameaça explícita de violência
- abuso_substancias: uso problemático explicitamente relatado
- crise_aguda: surto, alucinação, dissociação no texto
- dependencia_grave: dependência severa documentada
- prejuizo_funcional_severo: incapacidade funcional explícita
- dissociacao_grave: dissociação severa documentada

NÃO são alertas: sofrimento emocional, conflito familiar, autossabotagem,
assédio no trabalho, dificuldade de comunicação, baixa autoestima.

### 4. administrative_events (eventos administrativos)
Eventos logísticos ou administrativos APENAS.
Exemplos: falta justificada, reagendamento, atraso, troca de horário, cancelamento.
NÃO devem aparecer em themes, attention_points ou alerts.

## evidence_excerpt — OBRIGATÓRIO em cada item:
Trecho LITERAL do texto original (mínimo 10 caracteres).
Sem trecho = item inválido, não inclua.

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
        "experiencia_traumatica|burnout|evolucao_positiva|questoes_existenciais|"
        "dinamicas_relacionais|questoes_profissionais|autonomia|manejo_emocional|outro"
    )
    enum_alerts = (
        "ideacao_suicida|autolesao|risco_violencia|abuso_substancias|"
        "crise_aguda|dependencia_grave|prejuizo_funcional_severo|dissociacao_grave"
    )
    enum_evolution = "melhora|piora|estavel|ambivalente|indeterminado"
    enum_admin = "falta_justificada|falta_nao_justificada|reagendamento|atraso|troca_horario|cancelamento|outro"

    return f"""Extraia os dados clínicos desta sessão psicológica.

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
      "description": "<contexto terapêutico sem linguagem diagnóstica, máx 120 chars>",
      "source_session": {session_number},
      "session_id": "{session_id}",
      "evidence_excerpt": "<trecho literal do texto, mín 10 chars>",
      "confidence_score": 0.0
    }}
  ],
  "attention_points": [
    {{
      "description": "<ponto de atenção clínico, SEM eventos administrativos>",
      "source_session": {session_number},
      "session_id": "{session_id}",
      "evidence_excerpt": "<trecho literal do texto>",
      "confidence_score": 0.0
    }}
  ],
  "alerts": [
    {{
      "alert_type": "<{enum_alerts}>",
      "description": "<descrição cautelosa do alerta>",
      "source_session": {session_number},
      "session_id": "{session_id}",
      "evidence_excerpt": "<trecho literal do texto>",
      "confidence_score": 0.0,
      "negated": false
    }}
  ],
  "evolution_markers": [
    {{
      "direction": "<{enum_evolution}>",
      "description": "<evolução observada no texto>",
      "source_session": {session_number},
      "session_id": "{session_id}",
      "evidence_excerpt": "<trecho literal do texto>",
      "confidence_score": 0.0
    }}
  ],
  "administrative_events": [
    {{
      "event_type": "<{enum_admin}>",
      "description": "<descrição do evento administrativo>",
      "source_session": {session_number},
      "session_id": "{session_id}",
      "evidence_excerpt": "<trecho literal do texto>"
    }}
  ],
  "professional_recommendations": [
    "<recomendação EXPLICITAMENTE feita pelo profissional no texto>"
  ]
}}

VERIFICAÇÃO FINAL antes de retornar:
- Faltas/atrasos/reagendamentos → administrative_events, NUNCA em attention_points
- Sofrimento emocional → themes, NUNCA em alerts
- Alerts somente com confidence >= 0.50 e evidence_excerpt explícita
- evidence_excerpt obrigatório em todo item — sem ele não inclua o item"""


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
                "request_id":     request_id,
                "session_id":     session_id,
                "session_number": session_number,
                "reason":         "text_too_short",
                "text_length":    text_length,
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

        # Ground-truth override — the LLM must not control session attribution.
        raw["session_id"]      = session_id
        raw["session_number"]  = session_number
        raw["session_date"]    = session_date
        raw["raw_text_length"] = text_length

        extraction = SessionExtraction.model_validate(raw)

        logger.info(
            "stage1_session_extracted",
            extra={
                "request_id":          request_id,
                "session_id":          session_id,
                "session_number":      session_number,
                "themes":              len(extraction.themes),
                "attention_points":    len(extraction.attention_points),
                "alerts":              len(extraction.alerts),
                "evolution_markers":   len(extraction.evolution_markers),
                "administrative_events": len(extraction.administrative_events),
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

_MIN_EVIDENCE_LEN = 10
_MIN_ALERT_CONF   = 0.5


def _validate_extractions(
    extractions: list[SessionExtraction],
    request_id: str,
) -> list[SessionExtraction]:
    """Stage 2: remove items that lack grounding or fail clinical safety rules,
    and rescue administrative events that leaked into clinical fields."""
    result: list[SessionExtraction] = []

    for ext in extractions:
        # ---- Alerts: drop negated, low-confidence, or evidence-free ----
        valid_alerts = [
            a for a in ext.alerts
            if not a.negated
            and a.confidence_score >= _MIN_ALERT_CONF
            and len(a.evidence_excerpt.strip()) >= _MIN_EVIDENCE_LEN
        ]
        removed_alerts = len(ext.alerts) - len(valid_alerts)

        # ---- Attention points: rescue admin events that leaked in ----
        rescued_admin: list[AdministrativeEvent] = []
        clean_attention = []
        for point in ext.attention_points:
            if (
                _looks_like_admin_event(point.description)
                or _looks_like_admin_event(point.evidence_excerpt)
            ):
                rescued_admin.append(AdministrativeEvent(
                    event_type=AdminEventType.OUTRO,
                    description=point.description,
                    source_session=point.source_session,
                    session_id=point.session_id,
                    evidence_excerpt=point.evidence_excerpt,
                ))
            elif len(point.evidence_excerpt.strip()) >= _MIN_EVIDENCE_LEN:
                clean_attention.append(point)

        # ---- Themes and evolution markers: only require evidence ----
        valid_themes = [
            t for t in ext.themes
            if len(t.evidence_excerpt.strip()) >= _MIN_EVIDENCE_LEN
        ]
        valid_evolution = [
            e for e in ext.evolution_markers
            if len(e.evidence_excerpt.strip()) >= _MIN_EVIDENCE_LEN
        ]

        # ---- Admin events: merge extracted + rescued, keep evidence ----
        merged_admin = [
            a for a in ext.administrative_events
            if len(a.evidence_excerpt.strip()) >= 5
        ] + rescued_admin

        # ---- Logging ----
        removed_themes  = len(ext.themes) - len(valid_themes)
        rescued_count   = len(rescued_admin)
        removed_attn    = len(ext.attention_points) - len(clean_attention) - rescued_count

        if removed_alerts:
            logger.warning(
                "stage2_alerts_removed",
                extra={"request_id": request_id, "session_id": ext.session_id,
                       "removed": removed_alerts},
            )
        if rescued_count:
            logger.info(
                "stage2_admin_rescued_from_attention",
                extra={"request_id": request_id, "session_id": ext.session_id,
                       "rescued": rescued_count},
            )
        if removed_themes:
            logger.warning(
                "stage2_themes_removed",
                extra={"request_id": request_id, "session_id": ext.session_id,
                       "removed": removed_themes},
            )
        if removed_attn > 0:
            logger.warning(
                "stage2_attention_points_removed",
                extra={"request_id": request_id, "session_id": ext.session_id,
                       "removed": removed_attn},
            )

        result.append(
            ext.model_copy(update={
                "alerts":               valid_alerts,
                "themes":               valid_themes,
                "attention_points":     clean_attention,
                "evolution_markers":    valid_evolution,
                "administrative_events": merged_admin,
            })
        )

    return result


# ---------------------------------------------------------------------------
# Stage 3 — Longitudinal synthesis from structured data
# ---------------------------------------------------------------------------

_SYNTHESIS_SYSTEM = """Você é um assistente clínico de documentação psicológica.
Seu objetivo é produzir um registro clínico longitudinal estruturado.

## ENTRADA
Você receberá dados estruturados já extraídos e validados de sessões psicológicas.
Você NÃO tem acesso ao texto original — trabalhe SOMENTE com estes dados.

## FUNÇÃO
Sintetizar os dados em um registro clínico longitudinal coerente e conservador.
Comporte-se como sistema de documentação clínica, não como chatbot ou resumidor criativo.

## REGRAS ABSOLUTAS

### USE SOMENTE OS DADOS FORNECIDOS
- Não crie fatos, temas ou alertas que não estejam nos dados estruturados
- Se dados são insuficientes para um campo → retorne [] ou ""
- Nunca invente contexto ou exemplos

### CITAÇÃO OBRIGATÓRIA
- Cada afirmação deve citar a sessão de origem: "(Sessão N)"
- Afirmações sem referência de sessão são inválidas

### LINGUAGEM CLÍNICA SEGURA
- Não use terminologia diagnóstica ausente nos dados
- Use: "o paciente relatou", "foi observado", "o profissional registrou"
- Não use: "sofre de", "tem diagnóstico de", "apresenta transtorno"

### SEPARAÇÃO RÍGIDA DAS CATEGORIAS

clinical_themes → temas recorrentes ou contextos terapêuticos dos dados
  Exemplos: autonomia, dificuldades no trabalho, manejo emocional

attention_points → pontos clínicos de acompanhamento dos dados
  Exemplos: autossabotagem, instabilidade emocional, dificuldade de assertividade
  NÃO inclua eventos administrativos aqui

clinical_alerts → SOMENTE de alerts.negated=false dos dados
  Não crie alertas por inferência
  Sofrimento emocional, conflito familiar, autossabotagem NÃO são alertas

administrative_events → de administrative_events dos dados
  Faltas, atrasos, reagendamentos, cancelamentos

improvements → de evolution_markers com direction=melhora dos dados
  Frases descritivas com citação de sessão

milestones → marcos terapêuticos CONCRETOS observados nos dados
  "Maior consciência emocional (Sessão 2)"
  "Início de comportamento assertivo (Sessão 3)"
  PROIBIDO: "continuidade do acompanhamento", "manutenção do processo"
  PROIBIDO: qualquer item que seja recomendação e não marco observado

source_recommendations → recomendações EXPLICITAMENTE feitas pelo profissional
  Copie de professional_recommendations dos dados, cite sessão

synthesized_recommendations → recomendações conservadoras geradas pela IA
  Baseadas nos dados
  Devem ser específicas, não genéricas
  PROIBIDO: "continuar o acompanhamento", "manter as sessões"

### CLINICAL_ALERTS COM GROUNDING OBRIGATÓRIO
- Cada alert em clinical_alerts deve ter evidence_excerpt não vazio
- Copie o evidence_excerpt do alert correspondente nos dados

### CAMPOS VAZIOS SÃO CORRETOS
- evolution_analysis="" se apenas 1 sessão ou dados insuficientes
- clinical_alerts=[] se nenhum alert validado nos dados

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

Com base EXCLUSIVAMENTE nestes dados, gere o registro clínico longitudinal.
Cada item deve citar "(Sessão N)" como origem.

Retorne JSON com esta estrutura — CADA ITEM DAS LISTAS CLÍNICAS DEVE SER UM OBJETO:
{{
  "summary": "3-5 frases sobre trajetória geral com citações de sessão.",
  "evolution_analysis": "3-6 frases comparando evolução. String vazia se 1 sessão ou dados insuficientes.",
  "clinical_themes": [
    {{"description": "tema terapêutico observado (Sessão N)", "source_session": N, "evidence_excerpt": "trecho dos dados", "confidence_score": 0.0}}
  ],
  "attention_points": [
    {{"description": "ponto de atenção clínico (Sessão N)", "source_session": N, "evidence_excerpt": "trecho dos dados", "confidence_score": 0.0}}
  ],
  "clinical_alerts": [
    {{"description": "alerta clínico dos alerts.negated=false (Sessão N)", "source_session": N, "evidence_excerpt": "trecho dos dados", "confidence_score": 0.0}}
  ],
  "administrative_events": [
    {{"description": "evento administrativo (Sessão N)", "source_session": N, "evidence_excerpt": "trecho dos dados", "confidence_score": 1.0}}
  ],
  "improvements": ["melhora dos evolution_markers direction=melhora (Sessão N)"],
  "milestones": ["marco CONCRETO observado (Sessão N) — NÃO use 'continuidade do acompanhamento'"],
  "source_recommendations": ["recomendação do profissional copiada dos dados (Sessão N)"],
  "synthesized_recommendations": ["recomendação específica e não-genérica baseada nos dados"]
}}

VERIFICAÇÃO FINAL:
- clinical_alerts → somente de alerts.negated=false, com evidence_excerpt preenchido
- administrative_events → somente de administrative_events dos dados
- milestones → marcos observados, não recomendações, não continuidade"""


def _synthesize_from_extractions(
    client: Groq,
    patient_name: str,
    extractions: list[SessionExtraction],
    request_id: str,
) -> SynthesisLLMOutput:
    """Stage 3: LLM synthesis over structured data only. Raw text never seen here."""
    user_prompt = _build_synthesis_prompt(patient_name, extractions)

    try:
        raw = _call_llm_json(
            client=client,
            system=_SYNTHESIS_SYSTEM,
            user=user_prompt,
            temperature=0.2,
            max_tokens=2500,
        )
        result = SynthesisLLMOutput.model_validate(raw)
        logger.info(
            "stage3_synthesis_complete",
            extra={
                "request_id":          request_id,
                "clinical_themes":     len(result.clinical_themes),
                "attention_points":    len(result.attention_points),
                "clinical_alerts":     len(result.clinical_alerts),
                "administrative_events": len(result.administrative_events),
                "improvements":        len(result.improvements),
                "milestones":          len(result.milestones),
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
# Post-validate — quality pass on Stage 3 output (no LLM)
# ---------------------------------------------------------------------------

def _post_validate_synthesis(
    synthesis: SynthesisLLMOutput,
    request_id: str,
) -> SynthesisLLMOutput:
    """Programmatic quality pass after Stage 3.
    Removes generic milestones, alerts without evidence, and generic recommendations."""

    # Remove generic milestones
    valid_milestones = [m for m in synthesis.milestones if not _is_generic_milestone(m)]
    removed_milestones = len(synthesis.milestones) - len(valid_milestones)

    # Remove clinical_alerts without evidence_excerpt
    valid_alerts = [
        a for a in synthesis.clinical_alerts
        if a.evidence_excerpt.strip()
    ]
    removed_alerts = len(synthesis.clinical_alerts) - len(valid_alerts)

    # Remove generic synthesized_recommendations
    valid_synth_recs = [
        r for r in synthesis.synthesized_recommendations
        if not _is_generic_recommendation(r)
    ]
    removed_recs = len(synthesis.synthesized_recommendations) - len(valid_synth_recs)

    if removed_milestones:
        logger.warning(
            "post_validate_generic_milestones_removed",
            extra={"request_id": request_id, "removed": removed_milestones},
        )
    if removed_alerts:
        logger.warning(
            "post_validate_alerts_without_evidence_removed",
            extra={"request_id": request_id, "removed": removed_alerts},
        )
    if removed_recs:
        logger.warning(
            "post_validate_generic_recommendations_removed",
            extra={"request_id": request_id, "removed": removed_recs},
        )

    return synthesis.model_copy(update={
        "milestones":                valid_milestones,
        "clinical_alerts":           valid_alerts,
        "synthesized_recommendations": valid_synth_recs,
    })


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
    Returns a dict that maps directly to SynthesisResponse.
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
            "total_admin":   sum(len(e.administrative_events) for e in extractions),
            "elapsed_ms":    round((time.perf_counter() - t0) * 1000),
        },
    )

    # ---- Stage 2: programmatic validation (no LLM) ------------------------
    t1 = time.perf_counter()
    validated = _validate_extractions(extractions, request_id)
    logger.info(
        "stage2_complete",
        extra={
            "request_id":    request_id,
            "valid_alerts":  sum(len(e.alerts) for e in validated),
            "valid_themes":  sum(len(e.themes) for e in validated),
            "valid_admin":   sum(len(e.administrative_events) for e in validated),
            "elapsed_ms":    round((time.perf_counter() - t1) * 1000),
        },
    )

    # ---- Stage 3: synthesis over structured data only --------------------
    t2 = time.perf_counter()
    raw_synthesis = _synthesize_from_extractions(client, patient_name, validated, request_id)

    # ---- Post-validate: quality pass (no LLM) ----------------------------
    synthesis = _post_validate_synthesis(raw_synthesis, request_id)

    logger.info(
        "pipeline_complete",
        extra={
            "request_id":   request_id,
            "total_ms":     round((time.perf_counter() - t0) * 1000),
            "stage3_ms":    round((time.perf_counter() - t2) * 1000),
        },
    )

    return {
        "summary":                   synthesis.summary,
        "evolution_analysis":        synthesis.evolution_analysis,
        "clinical_themes":           [i.model_dump() for i in synthesis.clinical_themes],
        "attention_points":          [i.model_dump() for i in synthesis.attention_points],
        "clinical_alerts":           [i.model_dump() for i in synthesis.clinical_alerts],
        "administrative_events":     [i.model_dump() for i in synthesis.administrative_events],
        "improvements":              synthesis.improvements,
        "milestones":                synthesis.milestones,
        "source_recommendations":    synthesis.source_recommendations,
        "synthesized_recommendations": synthesis.synthesized_recommendations,
        "sessions_analyzed":         session_count,
    }
