from sumy.parsers.plaintext import PlaintextParser
from sumy.nlp.tokenizers import Tokenizer
from sumy.summarizers.lex_rank import LexRankSummarizer
from sumy.nlp.stemmers import Stemmer
from sumy.utils import get_stop_words

_LANGUAGE = "portuguese"
_SENTENCES_COUNT = 4


def extract_summary(text: str) -> str:
    if len(text.strip()) < 80:
        return text.strip()

    try:
        parser = PlaintextParser.from_string(text, Tokenizer(_LANGUAGE))
        stemmer = Stemmer(_LANGUAGE)
        summarizer = LexRankSummarizer(stemmer)
        summarizer.stop_words = get_stop_words(_LANGUAGE)

        sentences = summarizer(parser.document, _SENTENCES_COUNT)
        result = " ".join(str(s) for s in sentences)
        return result if result.strip() else _fallback_summary(text)
    except Exception:
        return _fallback_summary(text)


def _fallback_summary(text: str) -> str:
    sentences = [s.strip() for s in text.split(".") if len(s.strip()) > 25]
    return ". ".join(sentences[:3]) + "." if sentences else text[:400]
