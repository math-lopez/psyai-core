import os
from contextlib import asynccontextmanager
from typing import List, Optional

import nltk
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, Security
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pydantic import BaseModel

from algorithm.pipeline import analyze_session

load_dotenv()

SERVICE_TOKEN = os.getenv("SERVICE_TOKEN", "")
security = HTTPBearer()


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Garante que os dados NLTK necessários para o sumy estejam disponíveis
    for resource in ["punkt", "punkt_tab", "stopwords"]:
        try:
            nltk.download(resource, quiet=True)
        except Exception:
            pass
    yield


app = FastAPI(title="PsiAI Insights Service", version="1.0.0", lifespan=lifespan)


def _verify_token(credentials: HTTPAuthorizationCredentials = Security(security)) -> str:
    if not SERVICE_TOKEN:
        raise HTTPException(status_code=500, detail="SERVICE_TOKEN não configurado")
    if credentials.credentials != SERVICE_TOKEN:
        raise HTTPException(status_code=401, detail="Token inválido")
    return credentials.credentials


# ---------- Schemas ----------

class SessionData(BaseModel):
    id: str
    sessionDate: Optional[str] = None
    manualNotes: Optional[str] = None
    transcript: Optional[str] = None
    highlights: Optional[List[str]] = []
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


class AnalysisResponse(BaseModel):
    summary: str
    key_patterns: List[str]
    risk_flags: List[str]
    recommendations: List[str]


# ---------- Endpoints ----------

@app.get("/health")
def health():
    return {"status": "ok"}


@app.post("/process-patient-analysis", response_model=AnalysisResponse)
def process_patient_analysis(
    request: AnalysisRequest,
    _token: str = Security(_verify_token),
):
    if not request.sessions:
        raise HTTPException(status_code=400, detail="Nenhuma sessão fornecida")

    session = request.sessions[0]
    result = analyze_session(session.model_dump(), request.patient.model_dump())
    return AnalysisResponse(**result)
