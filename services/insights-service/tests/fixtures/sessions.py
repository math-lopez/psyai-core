"""Sessões simuladas para testes — sem dados reais de pacientes."""

# ---------------------------------------------------------------------------
# Sessões base
# ---------------------------------------------------------------------------

SESSION_EMPTY = {
    "id": "s-empty",
    "sessionDate": "2024-01-10",
    "transcript": "",
    "manualNotes": "",
    "clinicalNotes": "",
    "highlights": [],
    "nextSteps": None,
    "interventions": None,
    "sessionSummaryManual": None,
}

SESSION_ANXIETY_AFFIRMED = {
    "id": "s-anxiety-1",
    "sessionDate": "2024-01-15",
    "clinicalNotes": (
        "Paciente relata ansiedade intensa ao sair de casa. "
        "Menciona ataques de pânico recentes. "
        "Refere preocupação constante com o trabalho."
    ),
}

SESSION_ANXIETY_NEGATED = {
    "id": "s-anxiety-negated",
    "sessionDate": "2024-01-22",
    "clinicalNotes": (
        "Paciente nega ansiedade no momento. "
        "Sem queixas de pânico ou tensão na semana."
    ),
}

# Mesmo texto contém negação E afirmação — deve detectar o padrão
SESSION_ANXIETY_MIXED = {
    "id": "s-anxiety-mixed",
    "sessionDate": "2024-01-29",
    "clinicalNotes": (
        "Em sessões anteriores a psicóloga descartou ansiedade generalizada. "
        "Nesta sessão o paciente relatou ansiedade ao se aproximar do local de trabalho "
        "e referiu episódio de pânico na segunda-feira."
    ),
}

SESSION_SUICIDE_RISK_AFFIRMED = {
    "id": "s-risk-1",
    "sessionDate": "2024-02-05",
    "clinicalNotes": (
        'Paciente relata "não quero mais viver assim" e descreve pensamentos de morte '
        "recorrentes nos últimos dias. Avaliação de risco realizada."
    ),
}

SESSION_SUICIDE_RISK_NEGATED = {
    "id": "s-risk-negated",
    "sessionDate": "2024-02-12",
    "clinicalNotes": (
        "Paciente nega ideação suicida. Sem plano ou intenção. "
        "Histórico negativo para tentativas anteriores."
    ),
}

# A psicóloga discutiu suicídio de forma psicoeducativa — NÃO deve gerar alerta
SESSION_SUICIDE_PSYCHOEDUCATION = {
    "id": "s-psychoedu",
    "sessionDate": "2024-02-19",
    "clinicalNotes": (
        "Foi realizada psicoeducação sobre fatores de proteção ao suicídio "
        "dentro do protocolo de prevenção. Paciente apresentou engajamento positivo."
    ),
}

SESSION_DEPRESSION_WEAK_TERMS = {
    "id": "s-dep-weak",
    "sessionDate": "2024-03-01",
    "clinicalNotes": (
        "Paciente relata tristeza persistente e desmotivação para atividades que antes "
        "apreciava. Choro frequente ao longo da semana. Relata vazio emocional."
    ),
}

SESSION_POSITIVE_EVOLUTION = {
    "id": "s-positive",
    "sessionDate": "2024-03-15",
    "clinicalNotes": (
        "Paciente demonstra evolução significativa. Relatou melhora no sono e maior "
        "motivação. Apresentou insight sobre padrões relacionais. Progresso evidente."
    ),
}

SESSION_ABSENCE_NOTE = {
    "id": "s-absence",
    "sessionDate": "2024-03-22",
    "clinicalNotes": "Paciente faltou. Justificou por compromisso de trabalho imprevisto.",
}

# ---------------------------------------------------------------------------
# Conjuntos de sessões para testes longitudinais
# ---------------------------------------------------------------------------

PATIENT_BASIC = {"id": "p-001", "name": "Paciente Teste"}

SESSIONS_CHRONOLOGICAL = [
    {**SESSION_ANXIETY_AFFIRMED, "sessionDate": "2024-03-10"},
    {**SESSION_DEPRESSION_WEAK_TERMS, "sessionDate": "2024-01-05"},
    {**SESSION_POSITIVE_EVOLUTION, "sessionDate": "2024-05-20"},
]
