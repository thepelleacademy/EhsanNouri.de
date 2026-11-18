from __future__ import annotations

import html
import re

_TAG_RE = re.compile(r"<[^>]+>")
_WS_RE = re.compile(r"[ \t\r\f\v]+")
_WORD_RE = re.compile(r"[a-zäöüß]+")

EN_WORDS = {"the", "and", "with", "for", "you", "our", "will", "team", "experience", "are", "we",
            "of", "to", "in", "a", "your", "have", "as", "be", "that", "is", "on", "or"}
DE_WORDS = {"und", "die", "der", "das", "mit", "für", "wir", "sie", "ein", "eine", "von", "zu",
            "im", "ist", "den", "auf", "bei", "als", "ihre", "unser", "unsere", "dich", "du", "werden"}


def strip_html(text: str) -> str:
    if not text:
        return ""
    text = re.sub(r"(?i)<br\s*/?>|</p>|</li>|</div>|</h\d>", "\n", text)
    text = _TAG_RE.sub(" ", text)
    text = html.unescape(text)
    text = _WS_RE.sub(" ", text)
    text = re.sub(r"\n\s*\n+", "\n", text)
    return text.strip()


def detect_lang(text: str) -> str:
    """Tiny stop-word heuristic: 'en' | 'de' | 'unknown'. Good enough for job ads."""
    words = _WORD_RE.findall((text or "").lower())
    if len(words) < 12:
        return "unknown"
    en = sum(1 for w in words if w in EN_WORDS)
    de = sum(1 for w in words if w in DE_WORDS)
    if en + de < 4:
        return "unknown"
    if en > de * 1.3:
        return "en"
    if de > en * 1.3:
        return "de"
    return "unknown"


def compile_patterns(patterns: list[str]) -> list[re.Pattern]:
    return [re.compile(p, re.IGNORECASE) for p in patterns]


def any_match(patterns: list[re.Pattern], text: str) -> bool:
    return any(p.search(text) for p in patterns)


def excerpt(text: str, limit: int) -> str:
    text = (text or "").strip()
    return text if len(text) <= limit else text[: limit - 1].rstrip() + "…"
