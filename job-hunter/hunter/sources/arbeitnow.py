"""Arbeitnow — free, key-less job board API, Germany-focused and rich in English-speaking startups.
https://www.arbeitnow.com/api/job-board-api   (returns all jobs; we filter locally)"""
from __future__ import annotations

from datetime import datetime, timezone

import httpx

from ..models import Job
from ..textutils import strip_html
from .base import Source, get_json

URL = "https://www.arbeitnow.com/api/job-board-api"
MAX_PAGES = 6


def parse(data: dict) -> list[Job]:
    jobs: list[Job] = []
    for item in data.get("data", []):
        slug = item.get("slug")
        title = (item.get("title") or "").strip()
        if not (slug and title):
            continue
        posted = ""
        ts = item.get("created_at")
        if isinstance(ts, (int, float)):
            posted = datetime.fromtimestamp(ts, tz=timezone.utc).date().isoformat()
        jobs.append(Job(
            source="arbeitnow", ref=slug, title=title, company=item.get("company_name", ""),
            location=item.get("location", ""), url=item.get("url", ""),
            description=strip_html(item.get("description", ""))[:6000], posted_at=posted,
            remote=bool(item.get("remote")), employment_type=", ".join(item.get("job_types") or []),
        ))
    return jobs


class ArbeitnowSource(Source):
    name = "arbeitnow"

    def fetch(self, client: httpx.Client, profile: dict, lookback_days: int, log=print) -> list[Job]:
        out: list[Job] = []
        for page in range(1, MAX_PAGES + 1):
            data = get_json(client, URL, params={"page": page}, log=log)
            if not data or not data.get("data"):
                break
            out += parse(data)
        log(f"[arbeitnow] {len(out)} jobs fetched (filtered later)")
        return out
