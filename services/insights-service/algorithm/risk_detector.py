import re
from typing import List

# ---------------------------------------------------------------------------
# Padrões de negação clínica — avaliados na SENTENÇA que contém o termo de risco
# ---------------------------------------------------------------------------
_SENTENCE_NEGATIONS = [
    r"\bnega\b",
    r"\bnegou\b",
    r"\bnega(?:ndo)?\s+(?:qualquer\s+)?(?:ideação|pensamentos?|risco|intenção|plano|uso|abuso|violência|automutilação|autolesão)",
    r"\bsem\s+(?:ideação|risco|pensamentos?|plano|intenção|uso abusivo|histórico\s+de|queixas?\s+de|sinais?\s+de)",
    r"\boutro\s+episódio",
    r"\bausência\s+de",
    r"\bnão\s+(?:apresenta|há|existe|refere|relata|demonstra|evidencia)\b",
    r"\bdescarta\b",
    r"\bdescartou\b",
    r"\bafasta\b",
    r"\bafastou\b",
    r"\binadequado\b.*\brisco\b",  # "risco inadequado" = sem risco
    r"\babstêm(?:io)?\b",
    r"\bsobriedade\b",
    r"\bem\s+remissão\b",
    r"\bcontrolad[ao]\b",
    r"\bestável\b",
    r"\bnão\s+faz\s+uso\b",
    r"\bnunca\s+(?:tentou|usou|fez)\b",
    r"\bhistórico\s+negativo\b",
    r"\bsem\s+histórico\b",
]

# Linguagem que indica relato clínico de observação (psicólogo descrevendo ausência)
_CLINICAL_REPORT_PREFIXES = [
    r"^(?:paciente\s+)?nega\b",
    r"^sem\s+",
    r"^ausência\s+de\b",
    r"^não\s+(?:apresenta|há|refere|relata)\b",
    r"^descarta\b",
    r"^afasta\b",
]

# Linguagem especulativa — reduz certeza mas não elimina o alerta
_SPECULATIVE = [
    r"\bposs[íi]vel\b",
    r"\bpossibilidade\b",
    r"\bpode\s+ser\b",
    r"\bsuspeita(?:-se)?\b",
    r"\bhipótese\b",
    r"\ba\s+investigar\b",
    r"\ba\s+avaliar\b",
]

# ---------------------------------------------------------------------------
# Categorias de risco com palavras-chave e contexto obrigatório
# ---------------------------------------------------------------------------
_RISK_CATEGORIES: dict[str, dict] = {
    "Ideação suicida": {
        "keywords": [
            "suicídio", "suicida", "me matar", "quero morrer",
            "não quero mais viver", "acabar com tudo",
            "tirar minha vida", "pensamentos de morte",
            "ideação suicida", "plano suicida",
            "tentativa de suicídio", "tentou se matar",
        ],
        "require_patient_context": True,  # Exige que seja fala do paciente
    },
    "Automutilação": {
        "keywords": [
            "automutilação", "autolesão", "se machucar", "me machucar",
            "se cortar", "cortar o próprio", "lesões autoinfligidas",
            "se ferir", "se arranhar", "queimar a pele",
        ],
        "require_patient_context": True,
    },
    "Risco de violência": {
        "keywords": [
            "violência doméstica", "agressão física", "ameaça de morte",
            "intenção de agredir", "risco de violência",
            "ameaças graves", "comportamento agressivo grave",
        ],
        "require_patient_context": False,
    },
    "Abuso de substâncias": {
        "keywords": [
            "abuso de álcool", "dependência química", "uso de drogas",
            "alcoolismo", "vício em substâncias", "uso abusivo",
            "bebe em excesso", "usa drogas", "dependência de",
        ],
        "require_patient_context": True,
    },
    "Crise aguda": {
        "keywords": [
            "crise aguda", "surto psicótico", "alucinação", "delírio",
            "dissociação intensa", "descompensação grave",
            "emergência psiquiátrica", "internação psiquiátrica",
        ],
        "require_patient_context": False,
    },
}


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _split_sentences(text: str) -> List[str]:
    # Divide por pontuação preservando frases clínicas comuns
    sentences = re.split(r'(?<=[.!?;])\s+|\n+', text)
    return [s.strip() for s in sentences if s.strip()]


def _is_negated_sentence(sentence: str) -> bool:
    sl = sentence.lower()

    # Verifica prefixos clínicos de negação no início da sentença
    for prefix in _CLINICAL_REPORT_PREFIXES:
        if re.match(prefix, sl):
            return True

    # Verifica padrões de negação em qualquer parte da sentença
    for pattern in _SENTENCE_NEGATIONS:
        if re.search(pattern, sl):
            return True

    return False


def _is_speculative(sentence: str) -> bool:
    sl = sentence.lower()
    return any(re.search(p, sl) for p in _SPECULATIVE)


def _find_sentences_with_keyword(sentences: List[str], keyword: str) -> List[str]:
    return [s for s in sentences if keyword in s.lower()]


def _has_patient_speech_context(sentence: str) -> bool:
    """Verifica se a sentença parece ser relato do paciente e não nota clínica negativa."""
    sl = sentence.lower()
    # Indicadores de que o paciente está falando / sendo citado
    patient_indicators = [
        r"\bpaciente\s+(?:relata|refere|diz|conta|descreve|menciona|afirma)\b",
        r"\bpaciente\s+(?:sente|apresenta|demonstra|mostra)\b",
        r"\brelata\b",
        r"\brefere\b",
        r"\bdiz\s+que\b",
        r"\bqueixa(?:-se)?\b",
        r'"',      # aspas sugerem fala direta
        r"'",
    ]
    return any(re.search(p, sl) for p in patient_indicators)


# ---------------------------------------------------------------------------
# Detector principal
# ---------------------------------------------------------------------------

def detect_risks(text: str) -> List[str]:
    sentences = _split_sentences(text)
    text_lower = text.lower()
    found: List[str] = []

    for category, config in _RISK_CATEGORIES.items():
        hit_sentences: List[str] = []

        for keyword in config["keywords"]:
            if keyword not in text_lower:
                continue
            hit_sentences.extend(_find_sentences_with_keyword(sentences, keyword))

        if not hit_sentences:
            continue

        # Filtra sentenças negadas
        positive_hits = [s for s in hit_sentences if not _is_negated_sentence(s)]
        if not positive_hits:
            continue

        # Se exige contexto de paciente, pelo menos uma sentença deve tê-lo
        if config.get("require_patient_context"):
            has_context = any(
                _has_patient_speech_context(s) or not _is_speculative(s)
                for s in positive_hits
            )
            # Só descarta se NENHUMA sentença tem contexto e todas são especulativas
            all_speculative = all(_is_speculative(s) for s in positive_hits)
            no_patient_context = not any(_has_patient_speech_context(s) for s in positive_hits)
            if all_speculative and no_patient_context:
                continue

        found.append(category)

    return found
