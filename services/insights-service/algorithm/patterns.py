import numpy as np
from sklearn.feature_extraction.text import TfidfVectorizer
from typing import List

# Mapeamento de padrões clínicos para termos em português
_DOMAIN_PATTERNS: dict[str, list[str]] = {
    "Ansiedade": [
        "ansiedade", "ansioso", "ansiosa", "preocupação", "preocupado", "nervoso",
        "nervosismo", "tensão", "estresse", "pânico", "medo", "fobia",
    ],
    "Depressão": [
        "depressão", "deprimido", "tristeza", "triste", "vazio", "desmotivação",
        "desmotivado", "melancolia", "desânimo", "choro", "chorar", "apatia",
    ],
    "Trauma": [
        "trauma", "traumático", "abuso", "violência", "flashback", "pesadelo",
        "revivência", "ptsd", "estresse pós-traumático", "memória traumática",
    ],
    "Conflito familiar": [
        "família", "familiar", "pais", "mãe", "pai", "cônjuge", "relacionamento",
        "conflito", "briga", "separação", "divórcio", "filho", "filha",
    ],
    "Autoestima": [
        "autoestima", "autoconfiança", "insegurança", "inseguro", "vergonha",
        "culpa", "crítica", "auto-crítica", "inferioridade", "inadequado",
    ],
    "Luto": [
        "luto", "perda", "morte", "falecimento", "saudade", "ausência", "enlutado",
    ],
    "Trabalho e estresse": [
        "trabalho", "emprego", "profissional", "chefe", "sobrecarga", "burnout",
        "esgotamento", "demissão", "desemprego", "carreira",
    ],
    "Isolamento social": [
        "isolamento", "solidão", "sozinho", "retraimento", "evitação", "social",
        "amigos", "relações sociais",
    ],
    "Autocuidado": [
        "autocuidado", "sono", "alimentação", "exercício", "rotina", "hábito",
        "higiene", "descanso",
    ],
    "Evolução positiva": [
        "progresso", "melhora", "evolução", "conquista", "avanço", "crescimento",
        "insight", "mudança positiva", "superou",
    ],
}

_STOPWORDS = [
    "de", "a", "o", "que", "e", "do", "da", "em", "um", "para", "é", "com", "uma",
    "os", "no", "se", "na", "por", "mais", "as", "dos", "como", "mas", "foi", "ao",
    "ele", "das", "tem", "à", "seu", "sua", "ou", "ser", "quando", "muito", "há",
    "nos", "já", "está", "eu", "também", "só", "pelo", "pela", "até", "isso",
    "ela", "entre", "era", "depois", "sem", "mesmo", "aos", "ter", "seus", "quem",
    "nas", "me", "esse", "eles", "estão", "você", "tinha", "foram", "essa", "num",
    "nem", "suas", "meu", "às", "minha", "têm", "numa", "pelos", "elas", "havia",
    "seja", "qual", "será", "nós", "tenho", "lhe", "deles", "essas", "esses",
    "não", "sim", "então", "assim", "aqui", "ali", "lá", "tudo", "todos", "todo",
    "toda", "todas", "outro", "outra", "outros", "nada", "cada", "tanto",
    "sessão", "paciente", "psicólogo", "terapeuta", "terapia", "relato", "durante",
    "disse", "relatou", "referiu", "apresentou", "demonstrou", "trouxe",
]


def extract_patterns(text: str) -> List[str]:
    text_lower = text.lower()
    found: List[str] = []

    for pattern_name, keywords in _DOMAIN_PATTERNS.items():
        if any(kw in text_lower for kw in keywords):
            found.append(pattern_name)

    # Complementa com termos TF-IDF não cobertos pelo vocabulário clínico
    extra = _tfidf_extras(text, found)
    if extra:
        found.append(f"Temas adicionais: {', '.join(extra)}")

    return found[:8]


def _tfidf_extras(text: str, already_found: List[str]) -> List[str]:
    try:
        covered_words = {
            kw for kws in _DOMAIN_PATTERNS.values() for kw in kws
        }
        vectorizer = TfidfVectorizer(
            max_features=30,
            ngram_range=(1, 2),
            stop_words=_STOPWORDS,
            min_df=1,
        )
        matrix = vectorizer.fit_transform([text])
        feature_names = vectorizer.get_feature_names_out()
        scores = matrix.toarray()[0]
        top_idx = np.argsort(scores)[::-1][:8]
        top_terms = [feature_names[i] for i in top_idx if scores[i] > 0]

        novel = [
            t for t in top_terms
            if t not in covered_words and len(t) > 4
        ]
        return novel[:3]
    except Exception:
        return []
