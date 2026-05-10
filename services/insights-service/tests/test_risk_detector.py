"""Testes para algorithm/risk_detector.py — detecção de riscos clínicos.

Casos críticos: falsos positivos em contexto de negação, psicoeducação,
linguagem especulativa e ausência de contexto de fala do paciente.
"""

import pytest
from algorithm.risk_detector import detect_risks


class TestSuicideRisk:
    def test_explicit_patient_report_detected(self):
        text = (
            'Paciente relata "não quero mais viver assim". '
            "Refere pensamentos de morte nos últimos dias."
        )
        risks = detect_risks(text)
        assert "Ideação suicida" in risks

    def test_negated_ideation_not_flagged(self):
        text = "Paciente nega ideação suicida. Sem plano ou intenção."
        risks = detect_risks(text)
        assert "Ideação suicida" not in risks

    def test_psychoeducation_context_not_flagged(self):
        """Menção ao tema para fins educativos não deve gerar alerta."""
        text = (
            "Foi realizada psicoeducação sobre fatores de proteção ao suicídio "
            "dentro do protocolo de prevenção. Paciente engajado positivamente."
        )
        risks = detect_risks(text)
        assert "Ideação suicida" not in risks

    def test_historical_negative_not_flagged(self):
        text = "Histórico negativo para tentativas de suicídio anteriores."
        risks = detect_risks(text)
        assert "Ideação suicida" not in risks

    def test_clinical_negation_patterns(self):
        for text in [
            "Sem pensamentos suicidas relatados.",
            "Nega qualquer ideação suicida no momento.",
            "Não apresenta ideação suicida.",
            "Descarta risco de suicídio.",
        ]:
            risks = detect_risks(text)
            assert "Ideação suicida" not in risks, f"Falso positivo em: {text!r}"


class TestSelfHarm:
    def test_patient_report_detected(self):
        text = "Paciente relata que se cortou no braço na última semana."
        risks = detect_risks(text)
        assert "Automutilação" in risks

    def test_negated_self_harm_not_flagged(self):
        text = "Nega automutilação. Sem lesões autoinfligidas observadas."
        risks = detect_risks(text)
        assert "Automutilação" not in risks


class TestSubstanceAbuse:
    def test_patient_report_detected(self):
        text = "Paciente refere que bebe em excesso nos fins de semana. Relata uso de drogas."
        risks = detect_risks(text)
        assert "Abuso de substâncias" in risks

    def test_sobriety_not_flagged(self):
        text = "Paciente em sobriedade há seis meses. Não faz uso de álcool."
        risks = detect_risks(text)
        assert "Abuso de substâncias" not in risks

    def test_remission_not_flagged(self):
        text = "Dependência química em remissão. Controlado com acompanhamento do CAPS AD."
        risks = detect_risks(text)
        assert "Abuso de substâncias" not in risks


class TestViolenceRisk:
    def test_domestic_violence_detected(self):
        text = "Paciente relata violência doméstica por parte do companheiro."
        risks = detect_risks(text)
        assert "Risco de violência" in risks

    def test_absence_note_not_flagged(self):
        """Falta justificada não deve gerar nenhum alerta de risco."""
        text = "Paciente faltou. Justificou por compromisso de trabalho imprevisto."
        risks = detect_risks(text)
        assert risks == []


class TestAcuteCrisis:
    def test_psychotic_break_detected(self):
        text = "Paciente apresentou surto psicótico com alucinações auditivas."
        risks = detect_risks(text)
        assert "Crise aguda" in risks

    def test_stable_not_flagged(self):
        text = "Paciente estável. Sem sinais de descompensação grave."
        risks = detect_risks(text)
        assert "Crise aguda" not in risks


class TestEmptyText:
    def test_empty_returns_no_risks(self):
        assert detect_risks("") == []
        assert detect_risks("   ") == []
