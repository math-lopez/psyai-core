"""Testes para algorithm/pipeline.py — integração entre os módulos."""

import pytest
from algorithm.pipeline import analyze_session
from tests.fixtures.sessions import (
    PATIENT_BASIC,
    SESSION_ABSENCE_NOTE,
    SESSION_ANXIETY_AFFIRMED,
    SESSION_EMPTY,
    SESSION_SUICIDE_RISK_AFFIRMED,
    SESSION_SUICIDE_RISK_NEGATED,
    SESSIONS_CHRONOLOGICAL,
)


class TestAnalyzeSession:
    def test_empty_session_returns_safe_default(self):
        result = analyze_session(SESSION_EMPTY, PATIENT_BASIC)
        assert result["summary"] != ""
        assert result["key_patterns"] == []
        assert result["risk_flags"] == []
        assert len(result["recommendations"]) >= 1

    def test_anxiety_session_detected(self):
        result = analyze_session(SESSION_ANXIETY_AFFIRMED, PATIENT_BASIC)
        assert "Ansiedade" in result["key_patterns"]

    def test_suicide_risk_session_flagged(self):
        result = analyze_session(SESSION_SUICIDE_RISK_AFFIRMED, PATIENT_BASIC)
        assert "Ideação suicida" in result["risk_flags"]
        # Deve ter recomendação urgente
        recs = " ".join(result["recommendations"])
        assert "URGENTE" in recs or "avaliação de risco" in recs.lower()

    def test_negated_suicide_risk_not_flagged(self):
        result = analyze_session(SESSION_SUICIDE_RISK_NEGATED, PATIENT_BASIC)
        assert "Ideação suicida" not in result["risk_flags"]

    def test_absence_note_generates_no_risk_flags(self):
        """Falta justificada não deve gerar alertas clínicos."""
        result = analyze_session(SESSION_ABSENCE_NOTE, PATIENT_BASIC)
        assert result["risk_flags"] == []

    def test_result_has_all_required_keys(self):
        result = analyze_session(SESSION_ANXIETY_AFFIRMED, PATIENT_BASIC)
        assert {"summary", "key_patterns", "risk_flags", "recommendations"} <= result.keys()

    def test_recommendations_not_empty_when_patterns_found(self):
        result = analyze_session(SESSION_ANXIETY_AFFIRMED, PATIENT_BASIC)
        assert len(result["recommendations"]) > 0

    def test_max_recommendations_respected(self):
        result = analyze_session(SESSION_SUICIDE_RISK_AFFIRMED, PATIENT_BASIC)
        assert len(result["recommendations"]) <= 8


class TestChronologicalOrder:
    def test_sessions_sorted_by_date_in_synthesizer_block(self):
        """Verifica que _build_sessions_block preserva ordem cronológica."""
        from algorithm.synthesizer import _build_sessions_block

        block = _build_sessions_block(SESSIONS_CHRONOLOGICAL)
        lines = [l for l in block.split("\n") if l.startswith("--- SESSÃO")]

        dates = []
        for line in lines:
            # extrai a data entre parênteses: "--- SESSÃO 1 (ID: ..., Data: YYYY-MM-DD) ---"
            import re
            m = re.search(r"Data: (\d{4}-\d{2}-\d{2})", line)
            if m:
                dates.append(m.group(1))

        assert dates == sorted(dates), f"Sessões fora de ordem: {dates}"
