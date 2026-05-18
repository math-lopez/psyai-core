"""Testes para algorithm/patterns.py — detecção de padrões clínicos."""

import pytest
from algorithm.patterns import extract_patterns


class TestNegationHandling:
    def test_negated_keyword_not_detected(self):
        text = "Paciente nega ansiedade. Sem relatos de pânico ou tensão."
        patterns = extract_patterns(text)
        assert "Ansiedade" not in patterns

    def test_affirmed_keyword_detected(self):
        text = "Paciente relata ansiedade intensa ao sair de casa."
        patterns = extract_patterns(text)
        assert "Ansiedade" in patterns

    def test_mixed_negation_and_affirmation_detects_pattern(self):
        """Bug crítico corrigido: negação em uma ocorrência não deve suprimir outra afirmada."""
        text = (
            "Em sessões anteriores a psicóloga descartou ansiedade generalizada. "
            "Nesta sessão o paciente relatou ansiedade intensa ao trabalho."
        )
        patterns = extract_patterns(text)
        assert "Ansiedade" in patterns

    def test_full_negation_suppresses_weak_terms(self):
        text = "Paciente sem tristeza, sem desmotivação, nega qualquer vazio emocional."
        patterns = extract_patterns(text)
        assert "Depressão" not in patterns


class TestStrongKeywords:
    def test_single_strong_keyword_triggers_pattern(self):
        text = "Paciente foi diagnosticado com burnout pelo médico do trabalho."
        patterns = extract_patterns(text)
        assert "Sobrecarga e burnout" in patterns

    def test_strong_keyword_depression(self):
        text = "Relato de depressão maior desde o ano passado."
        patterns = extract_patterns(text)
        assert "Depressão" in patterns

    def test_strong_keyword_trauma(self):
        text = "Apresenta flashback recorrente de evento traumático."
        patterns = extract_patterns(text)
        assert "Trauma e TEPT" in patterns


class TestWeakKeywords:
    def test_single_weak_keyword_not_enough(self):
        text = "Paciente menciona tristeza eventual."
        patterns = extract_patterns(text)
        assert "Depressão" not in patterns

    def test_two_distinct_weak_keywords_trigger_pattern(self):
        text = "Paciente relata tristeza e desmotivação para as atividades."
        patterns = extract_patterns(text)
        assert "Depressão" in patterns

    def test_three_occurrences_of_same_weak_keyword_trigger_pattern(self):
        text = "Relata tristeza ao acordar. Sente tristeza no trabalho. Tristeza persistente."
        patterns = extract_patterns(text)
        assert "Depressão" in patterns


class TestPositiveEvolution:
    def test_progress_detected(self):
        text = "Paciente demonstra melhora e evolução no processo. Relata progresso."
        patterns = extract_patterns(text)
        assert "Evolução positiva" in patterns

    def test_therapeutic_insight_detected(self):
        text = "Sessão marcada por insight terapêutico relevante sobre padrões familiares."
        patterns = extract_patterns(text)
        assert "Evolução positiva" in patterns


class TestMaxPatterns:
    def test_returns_at_most_8_patterns(self):
        text = (
            "ansiedade burnout depressão trauma luto isolamento social "
            "dependência emocional baixa autoestima conflito familiar "
            "insight terapêutico remissão dos sintomas"
        )
        patterns = extract_patterns(text)
        assert len(patterns) <= 8

    def test_empty_text_returns_no_patterns(self):
        assert extract_patterns("") == []
        assert extract_patterns("   ") == []
