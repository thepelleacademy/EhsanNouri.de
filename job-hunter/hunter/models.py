from __future__ import annotations

import hashlib
import re
from dataclasses import asdict, dataclass, field


def norm(value: str) -> str:
    """lowercase + collapse non-alphanumerics (unicode-safe) for dedupe keys."""
    return re.sub(r"[^\w]+", " ", (value or "").lower()).strip()


@dataclass
class Job:
    source: str
    ref: str
    title: str
    company: str
    location: str
    url: str
    description: str = ""
    posted_at: str = ""          # ISO date YYYY-MM-DD (best effort)
    remote: bool = False
    employment_type: str = ""

    # computed by the pipeline
    first_seen: str = ""
    last_seen: str = ""
    lang: str = ""
    flags: list[str] = field(default_factory=list)
    rule_score: int = 0
    ai_score: int | None = None
    ai_reason: str = ""
    ai_reason_fa: str = ""
    ai_german: str = ""          # none | basic | good | fluent | unknown
    ai_company_size: str = ""    # micro | small | medium | large | unknown  (estimate)
    ai_company_age: str = ""     # startup | young | established | old | unknown (estimate)
    ai_red_flags: list[str] = field(default_factory=list)
    final_score: int = 0

    @property
    def id(self) -> str:
        return hashlib.sha1(f"{self.source}:{self.ref}".encode()).hexdigest()[:16]

    @property
    def dedupe_key(self) -> str:
        return f"{norm(self.company)}|{norm(self.title)}|{norm(self.location)}"

    def to_dict(self) -> dict:
        data = asdict(self)
        data["id"] = self.id
        return data

    @classmethod
    def from_dict(cls, data: dict) -> "Job":
        allowed = cls.__dataclass_fields__.keys()
        return cls(**{k: v for k, v in data.items() if k in allowed})
