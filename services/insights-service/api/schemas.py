from typing import List, Optional
from pydantic import BaseModel, Field, field_validator


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
