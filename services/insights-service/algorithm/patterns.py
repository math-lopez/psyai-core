import re
from typing import List

# ---------------------------------------------------------------------------
# Vocabulário clínico — cada padrão tem termos fortes e fracos.
# Forte: 1 ocorrência não-negada basta.
# Fraco:  2+ termos distintos OU 3+ ocorrências totais, todos não-negados.
# ---------------------------------------------------------------------------
_DOMAIN_PATTERNS: dict[str, dict] = {
    "Ansiedade": {
        "strong": [
            "ansiedade", "transtorno de ansiedade", "crise de ansiedade",
            "ataque de pânico", "pânico", "fobia", "toc",
            "transtorno obsessivo", "agorafobia",
        ],
        "weak": [
            "ansioso", "ansiosa", "nervoso", "nervosismo", "tensão",
            "preocupação", "preocupado", "estresse", "medo",
        ],
    },
    "Depressão": {
        "strong": [
            "depressão", "transtorno depressivo", "episódio depressivo",
            "depressão maior", "humor deprimido", "anedonia",
        ],
        "weak": [
            "deprimido", "tristeza", "triste", "vazio", "desmotivado",
            "desmotivação", "melancolia", "desânimo", "apatia", "choro",
        ],
    },
    "Trauma e TEPT": {
        "strong": [
            "trauma", "tept", "ptsd", "estresse pós-traumático",
            "flashback", "revivência traumática", "memória traumática",
        ],
        "weak": [
            "traumático", "abuso", "violência", "pesadelo", "hipervigilância",
        ],
    },
    "Conflito familiar": {
        "strong": [
            "conflito familiar", "disfunção familiar", "violência doméstica",
            "abuso familiar", "separação conflituosa",
        ],
        "weak": [
            "briga", "conflito", "desentendimento", "família", "pais",
            "cônjuge", "divórcio", "separação", "filho", "filha",
        ],
    },
    "Autoestima e autoconceito": {
        "strong": [
            "baixa autoestima", "autoconceito negativo", "crença central negativa",
            "esquema disfuncional", "auto-sabotagem",
        ],
        "weak": [
            "insegurança", "inseguro", "vergonha", "culpa", "inferioridade",
            "inadequado", "incapaz", "fracasso", "crítica interna",
        ],
    },
    "Luto": {
        "strong": [
            "luto", "processo de luto", "enlutado", "perda significativa",
        ],
        "weak": [
            "morte", "falecimento", "saudade", "ausência", "perda",
        ],
    },
    "Sobrecarga e burnout": {
        "strong": [
            "burnout", "esgotamento profissional", "síndrome do esgotamento",
            "sobrecarga crônica",
        ],
        "weak": [
            "sobrecarga", "esgotamento", "exaustão", "trabalho excessivo",
            "demissão", "desemprego", "carreira",
        ],
    },
    "Isolamento social": {
        "strong": [
            "isolamento social", "retraimento social", "fobia social",
            "transtorno de ansiedade social",
        ],
        "weak": [
            "isolamento", "solidão", "sozinho", "evitação", "sem amigos",
            "dificuldade de socializar",
        ],
    },
    "Relacionamento e vínculos": {
        "strong": [
            "dependência emocional", "apego ansioso", "apego evitativo",
            "abandono", "vínculo inseguro",
        ],
        "weak": [
            "relacionamento", "parceiro", "namorado", "namorada",
            "ciúme", "traição", "confiança", "intimidade",
        ],
    },
    "Evolução positiva": {
        "strong": [
            "insight terapêutico", "reestruturação cognitiva bem-sucedida",
            "remissão dos sintomas", "alta terapêutica",
        ],
        "weak": [
            "progresso", "melhora", "evolução", "conquista", "avanço",
            "crescimento", "superou", "insight",
        ],
    },
}

# Stopwords para TF-IDF — inclui meta-linguagem clínica para não poluir
_STOPWORDS = [
    "de", "a", "o", "que", "e", "do", "da", "em", "um", "para", "é", "com", "uma",
    "os", "no", "se", "na", "por", "mais", "as", "dos", "como", "mas", "foi", "ao",
    "ele", "das", "tem", "à", "seu", "sua", "ou", "ser", "quando", "muito", "há",
    "nos", "já", "está", "eu", "também", "só", "pelo", "pela", "até", "isso",
    "ela", "entre", "era", "depois", "sem", "mesmo", "aos", "ter", "seus", "quem",
    "nas", "me", "esse", "eles", "estão", "você", "tinha", "foram", "essa", "num",
    "nem", "suas", "meu", "às", "minha", "têm", "numa", "pelos", "elas", "havia",
    "não", "sim", "então", "assim", "aqui", "ali", "lá", "tudo", "todos", "todo",
    "toda", "todas", "outro", "outra", "outros", "nada", "cada", "tanto",
    # Meta-linguagem clínica (descritores, não temas)
    "sessão", "paciente", "psicólogo", "psicoterapeuta", "terapeuta",
    "terapia", "psicoterapia", "atendimento", "consulta", "relato", "durante",
    "disse", "relatou", "referiu", "apresentou", "demonstrou", "trouxe",
    "nega", "negou", "refere", "afirma", "conta", "menciona", "descreve",
    "hoje", "semana", "mês", "ano", "dia", "vez",
]

# Padrões de negação: checados nos `window` caracteres ANTES da palavra-chave
_NEGATION_BEFORE = [
    r"\bnão\b", r"\bsem\b", r"\bnega\b", r"\bnegou\b",
    r"\bausência\s+de\b", r"\bdescarta\b", r"\bafasta\b",
]


def _count_keyword_occurrences(text_lower: str, keywords: List[str]) -> int:
    return sum(text_lower.count(kw) for kw in keywords)


def _has_positive_occurrence(text_lower: str, keyword: str, window: int = 40) -> bool:
    """Retorna True se keyword aparece pelo menos uma vez SEM negação antes dela.

    Correção em relação à versão anterior: a função antiga (_has_negation_before)
    retornava True se QUALQUER ocorrência fosse negada, mascarando ocorrências
    afirmativas do mesmo termo no mesmo texto.  Esta versão percorre todas as
    ocorrências e retorna True assim que encontra uma não-negada.
    """
    idx = text_lower.find(keyword)
    while idx != -1:
        context_before = text_lower[max(0, idx - window): idx]
        if not any(re.search(p, context_before) for p in _NEGATION_BEFORE):
            return True  # pelo menos uma ocorrência afirmativa → suficiente
        idx = text_lower.find(keyword, idx + 1)
    return False


def extract_patterns(text: str) -> List[str]:
    text_lower = text.lower()
    found: List[str] = []

    for pattern_name, config in _DOMAIN_PATTERNS.items():
        detected = False

        # Termo forte: 1 ocorrência não-negada basta
        for kw in config["strong"]:
            if kw in text_lower and _has_positive_occurrence(text_lower, kw):
                detected = True
                break

        # Termo fraco: 2+ termos distintos não-negados OU 3+ ocorrências totais
        if not detected:
            valid_weak = [
                kw for kw in config["weak"]
                if kw in text_lower and _has_positive_occurrence(text_lower, kw)
            ]
            total_occurrences = _count_keyword_occurrences(text_lower, valid_weak)
            if len(valid_weak) >= 2 or total_occurrences >= 3:
                detected = True

        if detected:
            found.append(pattern_name)

    return found[:8]
