import hmac
import logging
import os
from contextlib import asynccontextmanager

import nltk
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, Security
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from algorithm.pipeline import analyze_session
from algorithm.synthesizer import synthesize_patient
from api.middleware import RequestIdMiddleware, configure_logging
from api.schemas import (
    AnalysisRequest,
    AnalysisResponse,
    SynthesisResponse,
)

load_dotenv()
configure_logging()

SERVICE_TOKEN = os.getenv("SERVICE_TOKEN", "")
security = HTTPBearer()
logger = logging.getLogger("insights")


@asynccontextmanager
async def lifespan(app: FastAPI):
    for resource in ["punkt", "punkt_tab", "stopwords"]:
        try:
            nltk.download(resource, quiet=True)
        except Exception:
            pass
    logger.info("Insights service started", extra={"request_id": "-"})
    yield


app = FastAPI(title="PsiAI Insights Service", version="1.1.0", lifespan=lifespan)
app.add_middleware(RequestIdMiddleware)


def _verify_token(credentials: HTTPAuthorizationCredentials = Security(security)) -> str:
    if not SERVICE_TOKEN:
        raise HTTPException(status_code=500, detail="SERVICE_TOKEN não configurado")
    # hmac.compare_digest evita timing attacks por comparação de strings
    if not hmac.compare_digest(credentials.credentials, SERVICE_TOKEN):
        raise HTTPException(status_code=401, detail="Token inválido")
    return credentials.credentials


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

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


@app.post("/synthesize-patient", response_model=SynthesisResponse)
def synthesize_patient_endpoint(
    request: AnalysisRequest,
    _token: str = Security(_verify_token),
):
    if not request.sessions:
        raise HTTPException(status_code=400, detail="Nenhuma sessão fornecida")

    try:
        result = synthesize_patient(
            patient=request.patient.model_dump(),
            sessions=[s.model_dump() for s in request.sessions],
        )
    except RuntimeError as e:
        raise HTTPException(status_code=503, detail=str(e))

    return SynthesisResponse(**result)
