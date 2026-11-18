"""Gemini scoring with a hard daily USD budget. One batched call scores several jobs at once."""
from __future__ import annotations

import json
import re
import time

import httpx

from .models import Job
from .textutils import excerpt

GEMINI_URL = "https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent"

SYSTEM_PROMPT = """You are a career scout for ONE candidate (profile below). For each job decide how well it fits.
The candidate wants a small / young / international, English-speaking company (not a large corporation,
not a staffing agency), where a versatile mechanical/mechatronic R&D all-rounder is valuable.
German level is only A2 (learning) — penalise jobs that need fluent German, but do not reject jobs
where German is optional or only basic.

Return ONLY a JSON array, one object per job, in this exact shape:
{"id": "<job id>", "fit": <0-100 integer>, "reason": "<one sentence, English, concrete: why it fits or not>",
 "reason_fa": "<same idea, one short Persian sentence>",
 "german_required": "none|basic|good|fluent|unknown",
 "company_size": "micro|small|medium|large|unknown",
 "company_age": "startup|young|established|old|unknown",
 "red_flags": ["short strings, e.g. 'staffing agency', 'needs C1 German', 'junior role'"]}
Company size/age are ESTIMATES from the text and the name; use "unknown" when you cannot tell. Never invent facts."""


class Budget:
    def __init__(self, limit_usd: float, price_in: float, price_out: float, spent_today: float = 0.0):
        self.limit = limit_usd
        self.price_in = price_in
        self.price_out = price_out
        self.spent = spent_today

    def cost(self, tokens_in: int, tokens_out: int) -> float:
        return tokens_in / 1e6 * self.price_in + tokens_out / 1e6 * self.price_out

    def can_afford(self, est_in: int, est_out: int) -> bool:
        return self.spent + self.cost(est_in, est_out) <= self.limit

    def add(self, tokens_in: int, tokens_out: int) -> None:
        self.spent += self.cost(tokens_in, tokens_out)


def estimate_tokens(text: str) -> int:
    return int(len(text) / 3.2) + 1


def _build_prompt(profile: dict, jobs: list[Job], chars: int) -> str:
    cand = profile["candidate"]
    lines = [SYSTEM_PROMPT, "", "CANDIDATE PROFILE:", cand["summary"].strip(),
             f"German level: {cand['german_level']}; English: {cand['english_level']}; "
             f"based in {cand['location']}.", "", "JOBS:"]
    for j in jobs:
        lines.append(json.dumps({"id": j.id, "title": j.title, "company": j.company, "location": j.location,
                                 "source": j.source, "text": excerpt(j.description, chars)},
                                ensure_ascii=False))
    return "\n".join(lines)


def _parse_json_array(text: str) -> list[dict]:
    text = text.strip()
    text = re.sub(r"^```(?:json)?|```$", "", text, flags=re.MULTILINE).strip()
    try:
        data = json.loads(text)
    except json.JSONDecodeError:
        match = re.search(r"\[.*\]", text, re.DOTALL)
        if not match:
            return []
        try:
            data = json.loads(match.group(0))
        except json.JSONDecodeError:
            return []
    return [d for d in data if isinstance(d, dict)] if isinstance(data, list) else []


def call_gemini(client: httpx.Client, api_key: str, model: str, prompt: str, max_out: int) -> tuple[str, int, int]:
    body = {
        "contents": [{"role": "user", "parts": [{"text": prompt}]}],
        "generationConfig": {"temperature": 0.2, "maxOutputTokens": max_out,
                             "responseMimeType": "application/json"},
    }
    last_error: Exception | None = None
    for attempt in range(3):
        try:
            r = client.post(GEMINI_URL.format(model=model), json=body,
                            headers={"x-goog-api-key": api_key}, timeout=90)
            if r.status_code in (429, 500, 502, 503):
                time.sleep(2 * (attempt + 1))
                continue
            r.raise_for_status()
            data = r.json()
            parts = data["candidates"][0]["content"]["parts"]
            text = "".join(p.get("text", "") for p in parts)
            usage = data.get("usageMetadata", {})
            return text, int(usage.get("promptTokenCount", 0)), int(usage.get("candidatesTokenCount", 0))
        except (httpx.HTTPError, KeyError, IndexError, ValueError) as error:
            last_error = error
            time.sleep(1.5 * (attempt + 1))
    raise RuntimeError(f"Gemini call failed: {last_error}")


def score_jobs(client: httpx.Client, profile: dict, jobs: list[Job], api_key: str, model: str,
               budget: Budget, log=print) -> int:
    """Mutates jobs in place. Returns number of jobs scored. Stops when the budget would be exceeded."""
    ai_cfg = profile["ai"]
    batch_size = int(profile["settings"]["ai_batch_size"])
    chars = int(ai_cfg["desc_chars_per_job"])
    max_out = int(ai_cfg["max_output_tokens"])
    scored = 0
    for i in range(0, len(jobs), batch_size):
        batch = jobs[i:i + batch_size]
        prompt = _build_prompt(profile, batch, chars)
        if not budget.can_afford(estimate_tokens(prompt), max_out // 2):
            log(f"[ai] budget limit reached (${budget.spent:.4f} / ${budget.limit:.2f}) — stopping")
            break
        try:
            text, tin, tout = call_gemini(client, api_key, model, prompt, max_out)
        except RuntimeError as error:
            log(f"[ai] {error}")
            continue
        budget.add(tin, tout)
        by_id = {j.id: j for j in batch}
        for item in _parse_json_array(text):
            job = by_id.get(str(item.get("id")))
            if not job:
                continue
            try:
                job.ai_score = max(0, min(100, int(item.get("fit", 0))))
            except (TypeError, ValueError):
                continue
            job.ai_reason = str(item.get("reason", ""))[:300]
            job.ai_reason_fa = str(item.get("reason_fa", ""))[:300]
            job.ai_german = str(item.get("german_required", "unknown"))
            job.ai_company_size = str(item.get("company_size", "unknown"))
            job.ai_company_age = str(item.get("company_age", "unknown"))
            flags = item.get("red_flags") or []
            job.ai_red_flags = [str(f)[:60] for f in flags][:5] if isinstance(flags, list) else []
            scored += 1
    return scored


def combine(job: Job) -> int:
    """Final score: AI judgement weighted over the rule score, with fixed penalties for known blockers."""
    if job.ai_score is None:
        return job.rule_score
    score = 0.35 * job.rule_score + 0.65 * job.ai_score
    if job.ai_german == "fluent":
        score -= 15
    elif job.ai_german == "good":
        score -= 6
    if job.ai_company_size == "large":
        score -= 8
    if job.ai_company_size in ("micro", "small") or job.ai_company_age in ("startup", "young"):
        score += 4
    return int(max(0, min(100, round(score))))
