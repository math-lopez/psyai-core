"""Testes para api/schemas.py — validação do output do LLM."""

import pytest
from pydantic import ValidationError

from api.schemas import SynthesisLLMOutput


class TestSynthesisLLMOutput:
    def test_valid_full_response(self):
        data = {
            "summary": "Resumo da trajetória.",
            "evolution_analysis": "Evolução positiva.",
            "key_themes": ["tema 1 (Sessão 1)", "tema 2 (Sessão 2)"],
            "improvements": ["melhora no sono (Sessão 3)"],
            "concerns": [],
            "risk_flags": [],
            "milestones": ["primeiro relato de insight (Sessão 2)"],
            "recommendations": ["trabalhar regulação emocional"],
        }
        out = SynthesisLLMOutput.model_validate(data)
        assert out.summary == "Resumo da trajetória."
        assert out.key_themes == ["tema 1 (Sessão 1)", "tema 2 (Sessão 2)"]

    def test_null_fields_become_defaults(self):
        out = SynthesisLLMOutput.model_validate({})
        assert out.summary == ""
        assert out.key_themes == []
        assert out.risk_flags == []

    def test_list_field_as_string_is_coerced(self):
        """LLM às vezes retorna string onde esperamos lista."""
        out = SynthesisLLMOutput.model_validate({"improvements": "melhora geral"})
        assert out.improvements == ["melhora geral"]

    def test_empty_string_list_field_becomes_empty_list(self):
        out = SynthesisLLMOutput.model_validate({"key_themes": ""})
        assert out.key_themes == []

    def test_none_list_field_becomes_empty_list(self):
        out = SynthesisLLMOutput.model_validate({"concerns": None})
        assert out.concerns == []

    def test_list_items_are_stripped(self):
        out = SynthesisLLMOutput.model_validate({"milestones": ["  item com espaços  ", "outro"]})
        assert out.milestones == ["item com espaços", "outro"]

    def test_empty_items_in_list_are_filtered(self):
        out = SynthesisLLMOutput.model_validate({"recommendations": ["válido", "", "  "]})
        assert out.recommendations == ["válido"]
