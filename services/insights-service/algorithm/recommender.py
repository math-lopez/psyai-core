from typing import List

_PATTERN_RECS: dict[str, list[str]] = {
    "Ansiedade": [
        "Explorar técnicas de regulação emocional (respiração diafragmática, grounding 5-4-3-2-1)",
        "Identificar e questionar pensamentos catastróficos via reestruturação cognitiva",
    ],
    "Depressão": [
        "Monitorar humor e energia ao longo da semana com registro de humor diário",
        "Trabalhar ativação comportamental gradual e fortalecimento da rede de suporte",
    ],
    "Trauma e TEPT": [
        "Priorizar estabilização emocional e psicoeducação sobre trauma antes de qualquer processamento direto",
        "Avaliar indicação de abordagem específica para trauma (EMDR, TCC-T, CPT)",
    ],
    "Conflito familiar": [
        "Mapear padrões e dinâmicas relacionais recorrentes no sistema familiar",
        "Trabalhar comunicação assertiva e estabelecimento saudável de limites",
    ],
    "Autoestima e autoconceito": [
        "Identificar e questionar crenças centrais negativas sobre si mesmo",
        "Registrar conquistas e qualidades positivas ao longo da semana (diário de gratidão/conquistas)",
    ],
    "Luto": [
        "Acompanhar as fases do luto sem pressão de resolução temporal",
        "Explorar rituais simbólicos de despedida e possibilidade de ressignificação da perda",
    ],
    "Sobrecarga e burnout": [
        "Avaliar sintomas de burnout (Maslach) e estratégias concretas de gestão de demandas",
        "Trabalhar equilíbrio vida-trabalho e identificação de limites profissionais saudáveis",
    ],
    "Isolamento social": [
        "Estimular exposição gradual e hierárquica a situações sociais",
        "Investigar crenças disfuncionais que sustentam o isolamento e comportamentos de evitação",
    ],
    "Relacionamento e vínculos": [
        "Explorar padrões de apego e como impactam os relacionamentos atuais",
        "Trabalhar regulação emocional em contexto relacional e comunicação não-violenta",
    ],
    "Evolução positiva": [
        "Reforçar os avanços conquistados e consolidar estratégias que estão funcionando",
        "Discutir como manter os ganhos terapêuticos em situações de estresse futuro",
    ],
}

_RISK_RECS: dict[str, list[str]] = {
    "Ideação suicida": [
        "⚠️ URGENTE: Realizar avaliação de risco completa (plano, intenção, meios disponíveis, histórico)",
        "Elaborar Plano de Segurança com o paciente e acionar rede de suporte imediata",
        "Considerar encaminhamento urgente para avaliação psiquiátrica",
    ],
    "Automutilação": [
        "Avaliar extensão, frequência e função da automutilação (regulação emocional, comunicação, punição)",
        "Trabalhar tolerância ao mal-estar (DBT) e identificação de gatilhos específicos",
        "Considerar supervisão clínica ou interconsulta com psiquiatria",
    ],
    "Risco de violência": [
        "⚠️ Avaliar segurança imediata do paciente e de terceiros envolvidos",
        "Acionar recursos de proteção conforme necessidade (CRAS, CRAM, Delegacia, CVV: 188)",
    ],
    "Abuso de substâncias": [
        "Avaliar estágio de motivação para mudança (modelo transteórico de Prochaska)",
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

    # Riscos primeiro (prioridade máxima)
    for risk in risks:
        for rec in _RISK_RECS.get(risk, []):
            add(rec)

    # Padrões clínicos
    for pattern in patterns:
        for rec in _PATTERN_RECS.get(pattern, []):
            add(rec)

    if not recs:
        return list(_DEFAULTS)

    add(_DEFAULTS[0])
    return recs[:8]
