from enum import Enum
from typing import List, Optional
from pydantic import BaseModel, Field, field_validator, model_validator


# ---------------------------------------------------------------------------
# Input schemas (unchanged)
# ---------------------------------------------------------------------------

class SessionData(BaseModel):
    id: str
    sessionDate: Optional[str] = None
    manualNotes: Optional[str] = None
    transcript: Optional[str] = None
    highlights: Optional[List[str]] = Field(default_factory=list)
    nextSteps: Optional[str] = None
    clinicalNotes: Optional[str] = None
    interventions: Optional[str] = None
    sessionSummaryManual: Optional[str] = None


class PatientData(BaseModel):
    id: Optional[str] = None
    name: Optional[str] = None


class AnalysisRequest(BaseModel):
    patientId: str
    psychologistId: str
    patient: PatientData
    sessions: List[SessionData]


# ---------------------------------------------------------------------------
# Output schemas — rule-based single-session analysis (unchanged)
# ---------------------------------------------------------------------------

class AnalysisResponse(BaseModel):
    summary: str
    key_patterns: List[str]
    risk_flags: List[str]
    recommendations: List[str]


# ---------------------------------------------------------------------------
# Output schemas — LLM longitudinal synthesis
# ---------------------------------------------------------------------------

class GroundedItem(BaseModel):
    """A clinical or administrative item with mandatory source traceability.
    Used in the public SynthesisResponse — every item the API returns is grounded."""
    description: str
    source_session: int
    evidence_excerpt: str
    confidence_score: float


class SynthesisResponse(BaseModel):
    """Clinical longitudinal structured record returned by /synthesize-patient."""
    summary: str
    evolution_analysis: str
    # --- clinical fields (grounded objects) ---
    clinical_themes: List[GroundedItem]
    attention_points: List[GroundedItem]
    clinical_alerts: List[GroundedItem]
    administrative_events: List[GroundedItem]
    # --- narrative / list fields ---
    improvements: List[str]
    milestones: List[str]
    source_recommendations: List[str]
    synthesized_recommendations: List[str]
    sessions_analyzed: int


# ---------------------------------------------------------------------------
# SynthesisLLMOutput — validates the raw JSON returned by Stage 3 LLM
# ---------------------------------------------------------------------------

class LLMGroundedItem(BaseModel):
    """Grounded item as returned by the synthesis LLM.
    Uses lenient validators to absorb malformed LLM output."""
    description: str = ""
    source_session: int = 0
    evidence_excerpt: str = ""
    confidence_score: float = Field(default=0.5, ge=0.0, le=1.0)

    @field_validator("confidence_score", mode="before")
    @classmethod
    def clamp_confidence(cls, v):
        try:
            return max(0.0, min(1.0, float(v)))
        except (TypeError, ValueError):
            return 0.5


class SynthesisLLMOutput(BaseModel):
    """Validates and coerces the raw JSON returned by the Stage 3 LLM."""

    summary: str = ""
    evolution_analysis: str = ""
    clinical_themes: List[LLMGroundedItem] = Field(default_factory=list)
    attention_points: List[LLMGroundedItem] = Field(default_factory=list)
    clinical_alerts: List[LLMGroundedItem] = Field(default_factory=list)
    administrative_events: List[LLMGroundedItem] = Field(default_factory=list)
    improvements: List[str] = Field(default_factory=list)
    milestones: List[str] = Field(default_factory=list)
    source_recommendations: List[str] = Field(default_factory=list)
    synthesized_recommendations: List[str] = Field(default_factory=list)

    @field_validator(
        "clinical_themes", "attention_points", "clinical_alerts", "administrative_events",
        mode="before",
    )
    @classmethod
    def coerce_grounded_list(cls, v):
        """Accept plain strings (wrap them) or list of dicts. Discard invalid items."""
        if not isinstance(v, list):
            return []
        result = []
        for item in v:
            if isinstance(item, dict):
                result.append(item)
            elif isinstance(item, str) and item.strip():
                result.append({
                    "description": item.strip(),
                    "source_session": 0,
                    "evidence_excerpt": "",
                    "confidence_score": 0.5,
                })
        return result

    @field_validator(
        "improvements", "milestones",
        "source_recommendations", "synthesized_recommendations",
        mode="before",
    )
    @classmethod
    def coerce_str_list(cls, v):
        if v is None or v == "":
            return []
        if isinstance(v, str):
            return [v] if v.strip() else []
        if isinstance(v, list):
            return [str(item).strip() for item in v if str(item).strip()]
        return []

    @field_validator("summary", "evolution_analysis", mode="before")
    @classmethod
    def coerce_str(cls, v):
        if v is None:
            return ""
        return str(v).strip()


# ---------------------------------------------------------------------------
# Clinical taxonomy — enums used by the extraction pipeline
# ---------------------------------------------------------------------------

class AlertType(str, Enum):
    """Strict set of clinical alerts.
    Emotional suffering, family conflict, and self-sabotage do NOT qualify."""
    IDEACAO_SUICIDA = "ideacao_suicida"
    AUTOLESAO = "autolesao"
    RISCO_VIOLENCIA = "risco_violencia"
    ABUSO_SUBSTANCIAS = "abuso_substancias"
    CRISE_AGUDA = "crise_aguda"
    DEPENDENCIA_GRAVE = "dependencia_grave"
    PREJUIZO_FUNCIONAL_SEVERO = "prejuizo_funcional_severo"
    DISSOCIACAO_GRAVE = "dissociacao_grave"


class ThemeCategory(str, Enum):
    """Recurrent topics or therapeutic contexts — NOT risks."""
    ANSIEDADE = "ansiedade"
    TRISTEZA_PERSISTENTE = "tristeza_persistente"
    SOBRECARGA = "sobrecarga"
    CONFLITO_RELACIONAL = "conflito_relacional"
    ISOLAMENTO = "isolamento"
    DIFICULDADE_ASSERTIVIDADE = "dificuldade_assertividade"
    AUTOESTIMA = "autoestima"
    LUTO = "luto"
    EXPERIENCIA_TRAUMATICA = "experiencia_traumatica"
    BURNOUT = "burnout"
    EVOLUCAO_POSITIVA = "evolucao_positiva"
    QUESTOES_EXISTENCIAIS = "questoes_existenciais"
    DINAMICAS_RELACIONAIS = "dinamicas_relacionais"
    QUESTOES_PROFISSIONAIS = "questoes_profissionais"
    AUTONOMIA = "autonomia"
    MANEJO_EMOCIONAL = "manejo_emocional"
    OUTRO = "outro"


class EvolutionDirection(str, Enum):
    MELHORA = "melhora"
    PIORA = "piora"
    ESTAVEL = "estavel"
    AMBIVALENTE = "ambivalente"
    INDETERMINADO = "indeterminado"


class AdminEventType(str, Enum):
    """Administrative and logistical session events.
    These never appear in clinical fields."""
    FALTA_JUSTIFICADA = "falta_justificada"
    FALTA_NAO_JUSTIFICADA = "falta_nao_justificada"
    REAGENDAMENTO = "reagendamento"
    ATRASO = "atraso"
    TROCA_HORARIO = "troca_horario"
    CANCELAMENTO = "cancelamento"
    OUTRO = "outro"


# ---------------------------------------------------------------------------
# Extraction schemas — internal pipeline only (not returned by the API)
# ---------------------------------------------------------------------------

class ClinicalTheme(BaseModel):
    category: ThemeCategory = ThemeCategory.OUTRO
    description: str = ""
    source_session: int = 0
    session_id: str = ""
    evidence_excerpt: str = ""
    confidence_score: float = Field(default=0.5, ge=0.0, le=1.0)

    @field_validator("category", mode="before")
    @classmethod
    def coerce_category(cls, v):
        try:
            return ThemeCategory(v)
        except (ValueError, KeyError):
            return ThemeCategory.OUTRO

    @field_validator("confidence_score", mode="before")
    @classmethod
    def clamp_confidence(cls, v):
        try:
            return max(0.0, min(1.0, float(v)))
        except (TypeError, ValueError):
            return 0.5


class ClinicalAttentionPoint(BaseModel):
    description: str = ""
    source_session: int = 0
    session_id: str = ""
    evidence_excerpt: str = ""
    confidence_score: float = Field(default=0.5, ge=0.0, le=1.0)

    @field_validator("confidence_score", mode="before")
    @classmethod
    def clamp_confidence(cls, v):
        try:
            return max(0.0, min(1.0, float(v)))
        except (TypeError, ValueError):
            return 0.5


class ClinicalAlert(BaseModel):
    alert_type: AlertType
    description: str = ""
    source_session: int = 0
    session_id: str = ""
    evidence_excerpt: str = ""
    confidence_score: float = Field(default=0.5, ge=0.0, le=1.0)
    negated: bool = False

    @field_validator("confidence_score", mode="before")
    @classmethod
    def clamp_confidence(cls, v):
        try:
            return max(0.0, min(1.0, float(v)))
        except (TypeError, ValueError):
            return 0.5


class EvolutionMarker(BaseModel):
    direction: EvolutionDirection = EvolutionDirection.INDETERMINADO
    description: str = ""
    source_session: int = 0
    session_id: str = ""
    evidence_excerpt: str = ""
    confidence_score: float = Field(default=0.5, ge=0.0, le=1.0)

    @field_validator("direction", mode="before")
    @classmethod
    def coerce_direction(cls, v):
        try:
            return EvolutionDirection(v)
        except (ValueError, KeyError):
            return EvolutionDirection.INDETERMINADO

    @field_validator("confidence_score", mode="before")
    @classmethod
    def clamp_confidence(cls, v):
        try:
            return max(0.0, min(1.0, float(v)))
        except (TypeError, ValueError):
            return 0.5


class AdministrativeEvent(BaseModel):
    """Logistical/administrative session event. Never mixed with clinical data."""
    event_type: AdminEventType = AdminEventType.OUTRO
    description: str = ""
    source_session: int = 0
    session_id: str = ""
    evidence_excerpt: str = ""

    @field_validator("event_type", mode="before")
    @classmethod
    def coerce_event_type(cls, v):
        try:
            return AdminEventType(v)
        except (ValueError, KeyError):
            return AdminEventType.OUTRO


class SessionExtraction(BaseModel):
    """Structured factual extraction of a single session. Internal pipeline use only."""
    session_id: str
    session_number: int
    session_date: str
    themes: List[ClinicalTheme] = Field(default_factory=list)
    attention_points: List[ClinicalAttentionPoint] = Field(default_factory=list)
    alerts: List[ClinicalAlert] = Field(default_factory=list)
    evolution_markers: List[EvolutionMarker] = Field(default_factory=list)
    administrative_events: List[AdministrativeEvent] = Field(default_factory=list)
    professional_recommendations: List[str] = Field(default_factory=list)
    raw_text_length: int = 0

    @model_validator(mode="before")
    @classmethod
    def filter_invalid_items(cls, data):
        """Drop alerts with invalid alert_type before Pydantic validates nested models."""
        if not isinstance(data, dict):
            return data
        valid_alert_types = {a.value for a in AlertType}
        raw_alerts = data.get("alerts") or []
        data["alerts"] = [
            a for a in raw_alerts
            if isinstance(a, dict) and a.get("alert_type") in valid_alert_types
        ]
        raw_admin = data.get("administrative_events") or []
        data["administrative_events"] = [
            a for a in raw_admin if isinstance(a, dict)
        ]
        return data

    @field_validator(
        "themes", "attention_points", "alerts",
        "evolution_markers", "administrative_events",
        mode="before",
    )
    @classmethod
    def coerce_list(cls, v):
        if not isinstance(v, list):
            return []
        return v

    @field_validator("professional_recommendations", mode="before")
    @classmethod
    def coerce_recommendations(cls, v):
        if not isinstance(v, list):
            return []
        return [str(r).strip() for r in v if str(r).strip()]
