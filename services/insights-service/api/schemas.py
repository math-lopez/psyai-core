from enum import Enum
from typing import List, Optional
from pydantic import BaseModel, Field, field_validator, model_validator


# ---------------------------------------------------------------------------
# Input schemas
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
# Output schemas — rule-based single-session analysis
# ---------------------------------------------------------------------------

class AnalysisResponse(BaseModel):
    summary: str
    key_patterns: List[str]
    risk_flags: List[str]
    recommendations: List[str]


# ---------------------------------------------------------------------------
# Output schemas — LLM longitudinal synthesis
# ---------------------------------------------------------------------------

class SynthesisResponse(BaseModel):
    summary: str
    evolution_analysis: str
    key_themes: List[str]
    improvements: List[str]
    concerns: List[str]
    risk_flags: List[str]
    milestones: List[str]
    recommendations: List[str]
    sessions_analyzed: int


class SynthesisLLMOutput(BaseModel):
    """Validates the raw JSON returned by the LLM before accepting it."""

    summary: str = ""
    evolution_analysis: str = ""
    key_themes: List[str] = Field(default_factory=list)
    improvements: List[str] = Field(default_factory=list)
    concerns: List[str] = Field(default_factory=list)
    risk_flags: List[str] = Field(default_factory=list)
    milestones: List[str] = Field(default_factory=list)
    recommendations: List[str] = Field(default_factory=list)

    @field_validator("key_themes", "improvements", "concerns", "risk_flags", "milestones", "recommendations", mode="before")
    @classmethod
    def coerce_list(cls, v):
        """Accept empty string or None where a list is expected."""
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
    """Strict set of clinical alerts. Emotional suffering alone does NOT qualify."""
    IDEACAO_SUICIDA = "ideacao_suicida"
    AUTOLESAO = "autolesao"
    RISCO_VIOLENCIA = "risco_violencia"
    ABUSO_SUBSTANCIAS = "abuso_substancias"
    CRISE_AGUDA = "crise_aguda"
    DEPENDENCIA_GRAVE = "dependencia_grave"
    PREJUIZO_FUNCIONAL_SEVERO = "prejuizo_funcional_severo"


class ThemeCategory(str, Enum):
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
    OUTRO = "outro"


class EvolutionDirection(str, Enum):
    MELHORA = "melhora"
    PIORA = "piora"
    ESTAVEL = "estavel"
    AMBIVALENTE = "ambivalente"
    INDETERMINADO = "indeterminado"


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


class SessionExtraction(BaseModel):
    """Structured factual extraction of a single session. Internal pipeline use only."""
    session_id: str
    session_number: int
    session_date: str
    themes: List[ClinicalTheme] = Field(default_factory=list)
    attention_points: List[ClinicalAttentionPoint] = Field(default_factory=list)
    alerts: List[ClinicalAlert] = Field(default_factory=list)
    evolution_markers: List[EvolutionMarker] = Field(default_factory=list)
    professional_recommendations: List[str] = Field(default_factory=list)
    raw_text_length: int = 0

    @model_validator(mode="before")
    @classmethod
    def filter_invalid_alerts(cls, data):
        """Drop alerts whose alert_type is not in the enum before Pydantic validates them."""
        if not isinstance(data, dict):
            return data
        valid_types = {a.value for a in AlertType}
        raw_alerts = data.get("alerts") or []
        data["alerts"] = [
            a for a in raw_alerts
            if isinstance(a, dict) and a.get("alert_type") in valid_types
        ]
        return data

    @field_validator("themes", "attention_points", "alerts", "evolution_markers", mode="before")
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
