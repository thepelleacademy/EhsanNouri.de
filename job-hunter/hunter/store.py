"""State is a JSON file committed to the (private) repo — GitHub Actions has no disk between runs."""
from __future__ import annotations

import json
import os
import tempfile
from datetime import date, datetime, timedelta, timezone
from pathlib import Path

from . import secure
from .models import Job
from .textutils import excerpt


class State:
    def __init__(self, path: Path, creds: tuple[str, str] | None = None):
        self.creds = creds
        # With credentials the state is kept encrypted (state.enc.json) — safe to commit to a public repo.
        self.path = path.with_name("state.enc.json") if creds else path
        self.jobs: dict[str, Job] = {}
        self.spend: dict[str, float] = {}
        self.runs: list[dict] = []
        self.rejected: dict[str, str] = {}   # job id → last seen day (so we never re-evaluate junk)
        self._load()

    def _load(self) -> None:
        if not self.path.exists():
            return
        data = json.loads(self.path.read_text(encoding="utf-8"))
        if self.creds:
            data = secure.decrypt_json(data, *self.creds)
        self.jobs = {k: Job.from_dict(v) for k, v in data.get("jobs", {}).items()}
        self.spend = data.get("spend", {})
        self.runs = data.get("runs", [])
        self.rejected = data.get("rejected", {})

    @property
    def is_empty(self) -> bool:
        return not self.jobs

    def spent_on(self, day: str) -> float:
        return float(self.spend.get(day, 0.0))

    def known_keys(self) -> set[str]:
        return {j.dedupe_key for j in self.jobs.values()}

    def prune(self, keep_days: int, today: date) -> int:
        cutoff = (today - timedelta(days=keep_days)).isoformat()
        stale = [k for k, j in self.jobs.items() if (j.last_seen or j.first_seen) < cutoff]
        for k in stale:
            del self.jobs[k]
        self.rejected = {k: d for k, d in self.rejected.items() if d >= cutoff}
        # keep only a short spend/run history
        self.spend = dict(sorted(self.spend.items())[-60:])
        self.runs = self.runs[-60:]
        return len(stale)

    def save(self) -> None:
        self.path.parent.mkdir(parents=True, exist_ok=True)
        payload = {"jobs": {k: j.to_dict() for k, j in self.jobs.items()}, "spend": self.spend, "runs": self.runs,
                   "rejected": self.rejected}
        if self.creds:
            payload = secure.encrypt_json(payload, *self.creds)
        _atomic_write(self.path, payload)


def export_site(state: State, path: Path, min_score: int, now: datetime | None = None,
                creds: tuple[str, str] | None = None) -> int:
    """Public-facing JSON for job.ehsannouri.de: trimmed fields only (no profile, no full descriptions)."""
    now = now or datetime.now(timezone.utc)
    rows = []
    for job in state.jobs.values():
        if job.final_score < min_score:
            continue
        rows.append({
            "id": job.id, "title": job.title, "company": job.company, "location": job.location,
            "url": job.url, "source": job.source, "posted_at": job.posted_at, "first_seen": job.first_seen,
            "remote": job.remote, "employment_type": job.employment_type, "flags": job.flags,
            "score": job.final_score, "rule_score": job.rule_score, "ai_score": job.ai_score,
            "reason": job.ai_reason, "reason_fa": job.ai_reason_fa, "german": job.ai_german,
            "company_size": job.ai_company_size, "company_age": job.ai_company_age,
            "red_flags": job.ai_red_flags, "excerpt": excerpt(job.description, 500),
        })
    rows.sort(key=lambda r: (r["first_seen"], r["score"]), reverse=True)
    payload = {"generated_at": now.strftime("%Y-%m-%dT%H:%M:%SZ"), "count": len(rows), "jobs": rows}
    if creds:
        payload = secure.encrypt_json(payload, *creds)
        path = path.with_name("jobs.enc.json")
    path.parent.mkdir(parents=True, exist_ok=True)
    _atomic_write(path, payload)
    return len(rows)


def _atomic_write(path: Path, payload: dict) -> None:
    fd, tmp = tempfile.mkstemp(dir=str(path.parent), suffix=".tmp")
    with os.fdopen(fd, "w", encoding="utf-8") as f:
        json.dump(payload, f, ensure_ascii=False, indent=1)
    os.replace(tmp, path)
