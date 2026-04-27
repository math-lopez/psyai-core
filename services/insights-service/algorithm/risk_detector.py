import re
from typing import List

_RISK_CATEGORIES: dict[str, dict] = {
    "Ideação suicida": {
        "keywords": [
            "suicídio", "suicida", "me matar", "quero morrer", "não quero mais viver",
            "acabar com tudo", "tirar minha vida", "pensamentos de morte",
            "ideação suicida", "plano suicida", "tentativa de suicídio",
        ],
        "negations": [
            r"nega\w*\s+(ideação|suicídio|pensamentos de morte)",
            r"sem\s+(ideação|risco|pensamentos de morte)",
            r"não\s+(apresenta|tem|há)\s+(ideação|pensamentos de morte|risco suicida)",
            r"descarta\w*\s+(ideação|risco)",
        ],
    },
    "Automutilação": {
        "keywords": [
            "automutilação", "se machucar", "me machucar", "se cortar", "cortar o próprio",
            "lesões autoinfligidas", "se ferir", "autolesão",
        ],
        "negations": [
            r"nega\w*\s+(automutilação|autolesão)",
            r"sem\s+(automutilação|autolesão|histórico de)",
            r"não\s+(se machuca|apresenta automutilação)",
        ],
    },
    "Risco de violência": {
        "keywords": [
            "violência doméstica", "agressão física", "ameaça de morte", "ameaças graves",
            "intenção de agredir", "risco de violência", "comportamento agressivo grave",
        ],
        "negations": [
            r"sem\s+(violência|agressividade|risco de violência)",
            r"nega\w*\s+(violência|agressão|ameaças)",
        ],
    },
    "Abuso de substâncias": {
        "keywords": [
            "abuso de álcool", "dependência química", "uso de drogas", "alcoolismo",
            "vício em substâncias", "uso abusivo", "dependência de",
        ],
        "negations": [
            r"sem\s+(uso abusivo|dependência|histórico de uso)",
            r"nega\w*\s+(uso|abuso|dependência)",
            r"abstêmio",
        ],
    },
    "Crise aguda": {
        "keywords": [
            "crise aguda", "surto psicótico", "alucinação", "delírio", "dissociação intensa",
            "descompensação", "emergência psiquiátrica", "internação psiquiátrica",
        ],
        "negations": [
            r"sem\s+(crise|surto|alucinação|delírio)",
            r"nega\w*\s+(crise|alucinação|delírio)",
            r"não\s+(apresenta|há)\s+(crise|surto)",
        ],
    },
}


def detect_risks(text: str) -> List[str]:
    text_lower = text.lower()
    found: List[str] = []

    for category, config in _RISK_CATEGORIES.items():
        keyword_hit = any(kw in text_lower for kw in config["keywords"])
        if not keyword_hit:
            continue

        negated = any(
            re.search(pattern, text_lower)
            for pattern in config["negations"]
        )
        if not negated:
            found.append(category)

    return found
