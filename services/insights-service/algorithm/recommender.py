from typing import List

_PATTERN_RECS: dict[str, list[str]] = {
    "Ansiedade": [
        "Explorar técnicas de regulação emocional (respiração diafragmática, grounding 5-4-3-2-1)",
        "Identificar padrões de pensamento catastrófico e trabalhar reestruturação cognitiva",
    ],
    "Depressão": [
        "Monitorar humor e energia ao longo da semana com registro de humor diário",
        "Fortalecer rede de suporte e trabalhar ativação comportamental gradual",
    ],
    "Trauma": [
        "Priorizar estabilização emocional antes de qualquer trabalho de processamento direto",
        "Avaliar necessidade de abordagem específica para trauma (EMDR, TCC-T, CPT)",
    ],
    "Conflito familiar": [
        "Mapear dinâmicas e padrões relacionais recorrentes",
        "Trabalhar comunicação assertiva e estabelecimento saudável de limites",
    ],
    "Autoestima": [
        "Identificar e questionar crenças centrais negativas sobre si mesmo",
        "Registrar conquistas e qualidades positivas ao longo da semana",
    ],
    "Luto": [
        "Acompanhar as fases do luto sem pressão de resolução temporal",
        "Explorar rituais simbólicos de despedida e possibilidade de ressignificação da perda",
    ],
    "Trabalho e estresse": [
        "Avaliar sintomas de burnout (Maslach) e estratégias de gestão de demandas",
        "Trabalhar equilíbrio vida-trabalho e identificação de limites profissionais",
    ],
    "Isolamento social": [
        "Estimular exposição gradual a situações sociais com hierarquia de dificuldade",
        "Investigar crenças disfuncionais que sustentam o isolamento",
    ],
    "Autocuidado": [
        "Estabelecer metas comportamentais concretas e mensuráveis de autocuidado",
        "Monitorar qualidade do sono, alimentação e prática de atividade física",
    ],
    "Evolução positiva": [
        "Reforçar os avanços conquistados e consolidar estratégias eficazes",
        "Discutir como manter os ganhos terapêuticos em situações de estresse futuro",
    ],
}

_RISK_RECS: dict[str, list[str]] = {
    "Ideação suicida": [
        "⚠️ URGENTE: Realizar avaliação de risco completa (plano, intenção, meios, histórico)",
        "Elaborar Plano de Segurança com o paciente e acionar rede de suporte imediata",
        "Considerar encaminhamento urgente para avaliação psiquiátrica",
    ],
    "Automutilação": [
        "Avaliar extensão, frequência e função da automutilação (regulação emocional, comunicação)",
        "Trabalhar tolerância ao mal-estar e identificação de gatilhos específicos",
        "Considerar supervisão clínica ou interconsulta com psiquiatria",
    ],
    "Risco de violência": [
        "⚠️ Avaliar segurança imediata do paciente e de terceiros envolvidos",
        "Acionar recursos de proteção conforme necessidade (CRAS, CRAM, Delegacia, CVV)",
    ],
    "Abuso de substâncias": [
        "Avaliar estágio de motivação para mudança (modelo transteórico)",
        "Considerar encaminhamento para CAPS AD ou grupo de apoio (AA, NA)",
    ],
    "Crise aguda": [
        "⚠️ Avaliar necessidade de suporte psiquiátrico urgente ou internação",
        "Acionar responsáveis legais ou rede de apoio imediatamente",
    ],
}

_DEFAULTS = [
    "Revisitar os temas centrais abordados nesta sessão no próximo encontro",
    "Solicitar feedback do paciente sobre a evolução percebida no processo terapêutico",
]


def generate_recommendations(patterns: List[str], risks: List[str]) -> List[str]:
    recs: List[str] = []
    seen: set[str] = set()

    def add(rec: str) -> None:
        if rec not in seen:
            recs.append(rec)
            seen.add(rec)

    for risk in risks:
        for rec in _RISK_RECS.get(risk, []):
            add(rec)

    for pattern in patterns:
        for rec in _PATTERN_RECS.get(pattern, []):
            add(rec)

    if not recs:
        return list(_DEFAULTS)

    add(_DEFAULTS[0])
    return recs[:8]
