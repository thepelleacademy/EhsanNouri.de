"""Rule-based (free) scoring. Runs on every job; only the best go to the paid AI stage."""
from __future__ import annotations

import re
from dataclasses import dataclass, field
from datetime import date

from .models import Job
from .textutils import any_match, compile_patterns, detect_lang


@dataclass
class RuleResult:
    score: int
    flags: list[str] = field(default_factory=list)
    reject: str = ""
    lang: str = ""


class Rules:
    """Compiles everything from profile.yaml once."""

    def __init__(self, profile: dict):
        self.title_kw = [k.lower() for k in profile.get("title_keywords", [])]
        self.skill_kw = [k.lower() for k in profile.get("skill_keywords", [])]
        self.exclude_title = compile_patterns(profile.get("exclude_title_patterns", []))
        self.big = [c.lower() for c in profile.get("big_companies", [])]
        self.staffing = [c.lower() for c in profile.get("staffing_markers", [])]
        self.pref_loc = [c.lower() for c in profile.get("preferred_locations", [])]
        p = profile.get("patterns", {})
        self.de_strong = compile_patterns(p.get("german_required_strong", []))
        self.de_moderate = compile_patterns(p.get("german_required_moderate", []))
        self.en_friendly = compile_patterns(p.get("english_friendly", []))
        self.startup = compile_patterns(p.get("startup_signals", []))
        self.large = compile_patterns(p.get("large_signals", []))

    # -- cheap gate used before fetching details (title only) ------------------------------
    def title_relevant(self, title: str) -> bool:
        t = title.lower()
        if any_match(self.exclude_title, t):
            return False
        return any(k in t for k in self.title_kw)

    # -- full evaluation -------------------------------------------------------------------
    def evaluate(self, job: Job, today: date | None = None) -> RuleResult:
        today = today or date.today()
        title = job.title.lower()
        company = job.company.lower()
        text = f"{job.title}\n{job.description}".lower()
        flags: list[str] = []

        if any_match(self.exclude_title, title):
            return RuleResult(0, flags, "excluded title")

        title_hit = any(k in title for k in self.title_kw)
        skill_hits = sum(1 for k in self.skill_kw if k in text)
        if not title_hit and skill_hits < 2:
            return RuleResult(0, flags, "not relevant")

        score = 0
        score += 30 if title_hit else 10
        score += min(skill_hits, 6) * 5

        lang = detect_lang(job.description) if job.description else "unknown"
        if lang == "en":
            score += 15
            flags.append("english")
        elif lang == "de":
            score -= 8

        if any_match(self.en_friendly, text):
            score += 10
            if "english" not in flags:
                flags.append("english")

        if any_match(self.de_strong, text):
            score -= 25
            flags.append("german_required")
        elif any_match(self.de_moderate, text):
            score -= 10
            flags.append("german_moderate")

        if any_match(self.startup, text):
            score += 15
            flags.append("startup")
        if any_match(self.large, text):
            score -= 10
            flags.append("large")
        if any(b in company for b in self.big):
            score -= 30
            flags.append("big_company")
        if any(s in company or s in text[:400] for s in self.staffing):
            score -= 20
            flags.append("staffing")

        if job.remote:
            score += 5
            flags.append("remote")
        loc = job.location.lower()
        if any(p in loc for p in self.pref_loc):
            score += 5
            flags.append("bavaria")

        if job.posted_at:
            try:
                age = (today - date.fromisoformat(job.posted_at[:10])).days
                if age <= 2:
                    score += 5
                elif age > 21:
                    score -= 5
            except ValueError:
                pass

        return RuleResult(max(0, min(100, score)), flags, "", lang)
