"""Official Bundesagentur für Arbeit Jobsuche API (the same public API the Pelle platform uses).
Docs: https://jobsuche.api.bund.dev/  — public key 'jobboerse-jobsuche' (documented, not a secret).

The list endpoint returns no description, so the pipeline fetches details only for title-relevant hits.
The parser accepts both response shapes seen across API versions (v4 `stellenangebote`, v6 `ergebnisliste`)."""
from __future__ import annotations

import base64
from datetime import date

import httpx

from ..models import Job
from ..textutils import strip_html
from .base import Source, get_json

API_KEY = "jobboerse-jobsuche"
ENDPOINTS = [
    "https://rest.arbeitsagentur.de/jobboerse/jobsuche-service/pc/v4/jobs",
    "https://rest.arbeitsagentur.de/jobboerse/jobsuche-service/pc/v6/jobs",
]
DETAIL_URL = "https://rest.arbeitsagentur.de/jobboerse/jobsuche-service/pc/v4/jobdetails/{b64}"
JOB_PAGE = "https://www.arbeitsagentur.de/jobsuche/jobdetail/{ref}"
PAGE_SIZE = 50
MAX_PAGES = 3
ANGEBOTSART_JOB = 1  # 1 = Arbeit (not Ausbildung/Praktikum)
MAX_CONSECUTIVE_FAILURES = 3


def parse_results(data: dict) -> list[Job]:
    items = data.get("stellenangebote") or data.get("ergebnisliste") or []
    jobs: list[Job] = []
    for item in items:
        ref = item.get("refnr") or item.get("referenznummer") or ""
        title = (item.get("titel") or item.get("stellenangebotsTitel") or item.get("beruf")
                 or item.get("hauptberuf") or "").strip("* ").strip()
        if not (ref and title):
            continue
        company = item.get("arbeitgeber") or item.get("firma") or ""
        city = ""
        ort = item.get("arbeitsort")
        if isinstance(ort, dict):
            city = ort.get("ort", "") or ort.get("region", "")
        if not city:
            locs = item.get("stellenlokationen") or []
            if locs:
                city = ((locs[0] or {}).get("adresse") or {}).get("ort", "")
        posted = (item.get("aktuelleVeroeffentlichungsdatum") or item.get("veroeffentlichungsdatum") or "")[:10]
        jobs.append(Job(
            source="arbeitsagentur", ref=ref, title=title, company=company, location=city,
            url=JOB_PAGE.format(ref=ref), posted_at=posted,
            employment_type=str(item.get("stellenangebotsart", "") or ""),
        ))
    return jobs


class ArbeitsagenturSource(Source):
    name = "arbeitsagentur"

    def __init__(self):
        self._endpoint_ok: str | None = None

    def _search(self, client, params, log):
        endpoints = [self._endpoint_ok] if self._endpoint_ok else ENDPOINTS
        for url in endpoints:
            data = get_json(client, url, params=params, headers={"X-API-Key": API_KEY}, log=log)
            if data and ("stellenangebote" in data or "ergebnisliste" in data):
                self._endpoint_ok = url
                return data
        return None

    def fetch(self, client: httpx.Client, profile: dict, lookback_days: int, log=print) -> list[Job]:
        queries = profile["queries"]["de"] + profile["queries"]["en"]
        seen: dict[str, Job] = {}
        failures = 0
        for query in queries:
            if failures >= MAX_CONSECUTIVE_FAILURES:
                log(f"[arbeitsagentur] {failures} queries failed in a row — source looks down, stopping")
                break
            for page in range(1, MAX_PAGES + 1):
                params = {"was": query, "size": PAGE_SIZE, "page": page, "angebotsart": ANGEBOTSART_JOB,
                          "veroeffentlichtseit": max(1, lookback_days)}
                data = self._search(client, params, log)
                if not data:
                    failures += 1 if page == 1 else 0
                    break
                if page == 1:
                    failures = 0
                batch = parse_results(data)
                for job in batch:
                    seen.setdefault(job.ref, job)
                if len(batch) < PAGE_SIZE:
                    break
        log(f"[arbeitsagentur] {len(seen)} unique jobs from {len(queries)} queries")
        return list(seen.values())

    def fetch_detail(self, client: httpx.Client, job: Job) -> None:
        b64 = base64.b64encode(job.ref.encode()).decode()
        data = get_json(client, DETAIL_URL.format(b64=b64), headers={"X-API-Key": API_KEY})
        if not isinstance(data, dict):
            return
        desc = data.get("stellenangebotsBeschreibung") or data.get("beschreibung") or ""
        job.description = strip_html(desc)[:6000]
        ext = data.get("externeUrl") or data.get("allianzpartnerUrl")
        if isinstance(ext, str) and ext.startswith("http"):
            job.url = ext
        if not job.company:
            job.company = data.get("firma") or data.get("arbeitgeber") or ""
