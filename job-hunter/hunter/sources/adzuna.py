"""Adzuna API (free tier; needs ADZUNA_APP_ID + ADZUNA_APP_KEY — https://developer.adzuna.com/).
Skipped automatically when the keys are not set."""
from __future__ import annotations

import httpx

from ..models import Job
from ..textutils import strip_html
from .base import Source, get_json

URL = "https://api.adzuna.com/v1/api/jobs/de/search/{page}"


def parse(data: dict) -> list[Job]:
    jobs: list[Job] = []
    for item in data.get("results", []):
        ref = str(item.get("id", ""))
        title = strip_html(item.get("title", ""))
        if not (ref and title):
            continue
        jobs.append(Job(
            source="adzuna", ref=ref, title=title,
            company=(item.get("company") or {}).get("display_name", ""),
            location=(item.get("location") or {}).get("display_name", ""),
            url=item.get("redirect_url", ""), description=strip_html(item.get("description", "")),
            posted_at=(item.get("created") or "")[:10], employment_type=item.get("contract_type", "") or "",
        ))
    return jobs


class AdzunaSource(Source):
    name = "adzuna"

    def __init__(self, app_id: str, app_key: str):
        self.app_id, self.app_key = app_id, app_key

    def fetch(self, client: httpx.Client, profile: dict, lookback_days: int, log=print) -> list[Job]:
        queries = profile["queries"]["en"] + profile["queries"]["de"][:8]
        seen: dict[str, Job] = {}
        failures = 0
        for q in queries:
            if failures >= 2:
                break
            data = get_json(client, URL.format(page=1), params={
                "app_id": self.app_id, "app_key": self.app_key, "what": q, "results_per_page": 50,
                "max_days_old": max(1, lookback_days), "content-type": "application/json"}, log=log)
            if data:
                failures = 0
                for job in parse(data):
                    seen.setdefault(job.ref, job)
            else:
                failures += 1
        log(f"[adzuna] {len(seen)} unique jobs")
        return list(seen.values())
