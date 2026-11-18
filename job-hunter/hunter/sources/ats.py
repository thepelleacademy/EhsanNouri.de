"""Direct company career pages via public ATS endpoints — the best way to reach small companies
that never pay for LinkedIn. Configure the watch-list in companies.yaml."""
from __future__ import annotations

import xml.etree.ElementTree as ET
from datetime import datetime, timezone

import httpx

from ..models import Job
from ..textutils import strip_html
from .base import Source, get_json


def parse_greenhouse(company: str, data: dict) -> list[Job]:
    jobs = []
    for it in data.get("jobs", []):
        jobs.append(Job(source="ats:greenhouse", ref=f"{company}:{it.get('id')}", title=it.get("title", ""),
                        company=company, location=(it.get("location") or {}).get("name", ""),
                        url=it.get("absolute_url", ""), description=strip_html(it.get("content", ""))[:6000],
                        posted_at=(it.get("updated_at") or "")[:10]))
    return jobs


def parse_lever(company: str, data: list) -> list[Job]:
    jobs = []
    for it in data if isinstance(data, list) else []:
        ts = it.get("createdAt")
        posted = datetime.fromtimestamp(ts / 1000, tz=timezone.utc).date().isoformat() if isinstance(ts, (int, float)) else ""
        cats = it.get("categories") or {}
        jobs.append(Job(source="ats:lever", ref=f"{company}:{it.get('id')}", title=it.get("text", ""),
                        company=company, location=cats.get("location", "") or "", url=it.get("hostedUrl", ""),
                        description=(it.get("descriptionPlain") or strip_html(it.get("description", "")))[:6000],
                        posted_at=posted, employment_type=cats.get("commitment", "") or ""))
    return jobs


def parse_ashby(company: str, data: dict) -> list[Job]:
    jobs = []
    for it in data.get("jobs", []):
        jobs.append(Job(source="ats:ashby", ref=f"{company}:{it.get('id')}", title=it.get("title", ""),
                        company=company, location=it.get("location", "") or "", url=it.get("jobUrl", ""),
                        description=(it.get("descriptionPlain") or strip_html(it.get("descriptionHtml", "")))[:6000],
                        posted_at=(it.get("publishedAt") or "")[:10], remote=bool(it.get("isRemote"))))
    return jobs


def parse_personio(company: str, xml_text: str, token: str) -> list[Job]:
    jobs = []
    try:
        root = ET.fromstring(xml_text)
    except ET.ParseError:
        return jobs
    for pos in root.findall("position"):
        pid = (pos.findtext("id") or "").strip()
        title = (pos.findtext("name") or "").strip()
        if not (pid and title):
            continue
        parts = []
        for jd in pos.findall("./jobDescriptions/jobDescription"):
            parts.append(f"{jd.findtext('name') or ''}\n{strip_html(jd.findtext('value') or '')}")
        jobs.append(Job(source="ats:personio", ref=f"{company}:{pid}", title=title, company=company,
                        location=(pos.findtext("office") or "").strip(),
                        url=f"https://{token}.jobs.personio.de/job/{pid}",
                        description="\n".join(parts)[:6000], posted_at=(pos.findtext("createdAt") or "")[:10],
                        employment_type=(pos.findtext("employmentType") or "").strip()))
    return jobs


class AtsSource(Source):
    name = "ats"

    def __init__(self, companies: list[dict]):
        self.companies = companies

    def fetch(self, client: httpx.Client, profile: dict, lookback_days: int, log=print) -> list[Job]:
        out: list[Job] = []
        for c in self.companies:
            name, ats, token = c.get("name", ""), c.get("ats", ""), c.get("token", "")
            if not (name and ats and token):
                continue
            try:
                if ats == "greenhouse":
                    data = get_json(client, f"https://boards-api.greenhouse.io/v1/boards/{token}/jobs",
                                    params={"content": "true"}, log=log)
                    out += parse_greenhouse(name, data) if data else []
                elif ats == "lever":
                    data = get_json(client, f"https://api.lever.co/v0/postings/{token}", params={"mode": "json"}, log=log)
                    out += parse_lever(name, data) if data else []
                elif ats == "ashby":
                    data = get_json(client, f"https://api.ashbyhq.com/posting-api/job-board/{token}", log=log)
                    out += parse_ashby(name, data) if data else []
                elif ats == "personio":
                    r = client.get(f"https://{token}.jobs.personio.de/xml", timeout=25)
                    if r.status_code == 200:
                        out += parse_personio(name, r.text, token)
                    else:
                        log(f"[ats] personio {token}: HTTP {r.status_code}")
                else:
                    log(f"[ats] unknown ats '{ats}' for {name}")
            except Exception as error:  # noqa: BLE001 — one company must never break the run
                log(f"[ats] {name}: {error}")
        log(f"[ats] {len(out)} jobs from {len(self.companies)} watched companies")
        return out
