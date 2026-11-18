"""Remotive — free remote-jobs API (English). Few mechanical roles, but cheap to check."""
from __future__ import annotations

import httpx

from ..models import Job
from ..textutils import strip_html
from .base import Source, get_json

URL = "https://remotive.com/api/remote-jobs"
SEARCHES = ["mechanical engineer", "mechatronics", "hardware engineer", "product design engineer", "cad"]


def parse(data: dict) -> list[Job]:
    jobs: list[Job] = []
    for item in data.get("jobs", []):
        ref = str(item.get("id", ""))
        title = (item.get("title") or "").strip()
        if not (ref and title):
            continue
        jobs.append(Job(
            source="remotive", ref=ref, title=title, company=item.get("company_name", ""),
            location=item.get("candidate_required_location", "") or "Remote", url=item.get("url", ""),
            description=strip_html(item.get("description", ""))[:6000],
            posted_at=(item.get("publication_date") or "")[:10], remote=True,
            employment_type=item.get("job_type", ""),
        ))
    return jobs


class RemotiveSource(Source):
    name = "remotive"

    def fetch(self, client: httpx.Client, profile: dict, lookback_days: int, log=print) -> list[Job]:
        seen: dict[str, Job] = {}
        failures = 0
        for term in SEARCHES:
            data = get_json(client, URL, params={"search": term, "limit": 40}, log=log)
            if data:
                failures = 0
                for job in parse(data):
                    seen.setdefault(job.ref, job)
            else:
                failures += 1
                if failures >= 2:
                    break
        # Remote roles open to Europe/Germany/worldwide only
        keep = [j for j in seen.values()
                if any(k in j.location.lower() for k in ("europe", "germany", "worldwide", "anywhere", "emea", "eu"))]
        log(f"[remotive] {len(keep)} jobs (of {len(seen)}) open to Europe")
        return keep
