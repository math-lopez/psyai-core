from .summarizer import extract_summary
from .patterns import extract_patterns
from .risk_detector import detect_risks
from .recommender import generate_recommendations


def _build_text(session: dict) -> str:
    # Prioriza transcript (mais completo) depois as notas manuais
    fields_ordered = [
        "transcript",
        "clinicalNotes",
        "manualNotes",
        "interventions",
        "sessionSummaryManual",
        "nextSteps",
    ]
    parts = []
    for field in fields_ordered:
        value = session.get(field)
        if value and str(value).strip():
            parts.append(str(value).strip())

    highlights = session.get("highlights") or []
    if highlights:
        parts.append(" ".join(str(h) for h in highlights))

    return "\n\n".join(parts)


def analyze_session(session: dict, patient: dict) -> dict:
    text = _build_text(session)

    if not text.strip():
        return {
            "summary": "Nenhuma anotação disponível para análise.",
            "key_patterns": [],
            "risk_flags": [],
            "recommendations": [
                "Registre as anotações da sessão para obter insights automáticos."
            ],
        }

    summary = extract_summary(text)
    patterns = extract_patterns(text)
    risks = detect_risks(text)
    recommendations = generate_recommendations(patterns, risks)

    return {
        "summary": summary,
        "key_patterns": patterns,
        "risk_flags": risks,
        "recommendations": recommendations,
    }
