from __future__ import annotations

import time
from datetime import date

import httpx

from . import ai, notify
from .config import SITE_DATA_PATH, Env
from .models import Job
from .prefilter import Rules
from .sources import build_sources
from .sources.base import user_agent
from .store import State, export_site


def run(profile: dict, companies: list[dict], env: Env, state: State, *, dry: bool = False,
        no_ai: bool = False, no_notify: bool = False, sources=None, client: httpx.Client | None = None,
        today: date | None = None, site_url: str = "https://job.ehsannouri.de", log=print) -> dict:
    today = today or date.today()
    day = today.isoformat()
    cfg = profile["settings"]
    rules = Rules(profile)
    own_client = client is None
    client = client or httpx.Client(headers={"User-Agent": user_agent()}, follow_redirects=True)
    sources = sources if sources is not None else build_sources(profile, companies, env)
    lookback = cfg["backfill_days_first_run"] if state.is_empty else cfg["lookback_days_daily"]
    log(f"[run] {day} · lookback {lookback} days · {len(sources)} sources")

    # 1) fetch -------------------------------------------------------------------------------
    fetched: list[Job] = []
    errors: list[str] = []
    for src in sources:
        try:
            batch = src.fetch(client, profile, lookback, log)
        except Exception as error:  # noqa: BLE001
            log(f"[run] source {src.name} crashed: {error}")
            errors.append(f"{src.name} crashed")
            continue
        if not batch:
            errors.append(f"{src.name}: 0 jobs")
        fetched += batch
    log(f"[run] fetched {len(fetched)} raw jobs")

    # 2) dedupe (within batch, and against everything already seen) ------------------------------
    known_keys = state.known_keys()
    fresh: list[Job] = []
    batch_ids: set[str] = set()
    for job in fetched:
        if not job.title or not job.url.startswith("http"):
            continue
        if job.id in state.jobs:
            state.jobs[job.id].last_seen = day
            continue
        if job.id in state.rejected:
            state.rejected[job.id] = day
            continue
        if job.id in batch_ids or job.dedupe_key in known_keys:
            continue
        batch_ids.add(job.id)
        known_keys.add(job.dedupe_key)
        fresh.append(job)
    log(f"[run] {len(fresh)} new after dedupe")

    # 3) cheap title gate, then details only for the survivors --------------------------------
    candidates: list[Job] = []
    for job in fresh:
        if job.description or rules.title_relevant(job.title):
            candidates.append(job)
        else:
            state.rejected[job.id] = day
    by_source = {s.name: s for s in sources}
    need_detail = sorted((j for j in candidates if not j.description), key=lambda j: j.posted_at, reverse=True)
    for job in need_detail[: int(cfg["max_details_fetch"])]:
        src = by_source.get(job.source)
        if src:
            try:
                src.fetch_detail(client, job)
            except Exception as error:  # noqa: BLE001
                log(f"[run] detail failed for {job.ref}: {error}")
            time.sleep(float(cfg["request_delay_seconds"]))

    # 4) rule scoring ---------------------------------------------------------------------------
    kept: list[Job] = []
    for job in candidates:
        result = rules.evaluate(job, today)
        if result.reject:
            state.rejected[job.id] = day
            continue
        job.rule_score, job.flags, job.lang = result.score, result.flags, result.lang
        job.first_seen = job.last_seen = day
        kept.append(job)
    log(f"[run] {len(kept)} jobs passed the rule filter")

    # 5) AI scoring (top N only, hard budget) ---------------------------------------------------
    budget = ai.Budget(float(profile["ai"]["daily_budget_usd"]), float(profile["ai"]["price_in_per_mtok"]),
                       float(profile["ai"]["price_out_per_mtok"]), state.spent_on(day))
    spent_before = budget.spent
    scored = 0
    if not no_ai and env.gemini_api_key and kept:
        top = sorted((j for j in kept if j.rule_score >= int(cfg["min_rule_score_for_ai"])),
                     key=lambda j: -j.rule_score)[: int(cfg["ai_max_jobs_per_run"])]
        scored = ai.score_jobs(client, profile, top, env.gemini_api_key, env.gemini_model, budget, log)
    elif not no_ai and not env.gemini_api_key:
        errors.append("GEMINI_API_KEY missing — rule scores only")
    for job in kept:
        job.final_score = ai.combine(job)
    log(f"[run] AI scored {scored} jobs, cost ${budget.spent - spent_before:.4f} (today ${budget.spent:.4f})")

    # 6) persist + export + notify ----------------------------------------------------------------
    summary = {"date": day, "fetched": len(fetched), "new": len(fresh), "kept": len(kept), "ai_scored": scored,
               "ai_cost_usd": round(budget.spent - spent_before, 5), "errors": errors}
    if not dry:
        for job in kept:
            state.jobs[job.id] = job
        state.spend[day] = round(budget.spent, 5)
        state.runs.append(summary)
        state.prune(int(cfg["keep_days"]), today)
        state.save()
        published = export_site(state, SITE_DATA_PATH, int(cfg["min_publish_score"]))
        summary["published_total"] = published
        if not no_notify and env.telegram_token and env.telegram_chat_id:
            msgs = notify.build_messages(kept, len(kept), int(cfg["notify_min_score"]), int(cfg["notify_max_items"]),
                                         site_url, budget.spent, errors, bool(cfg["notify_even_if_empty"]))
            summary["telegram_sent"] = notify.send_telegram(client, env.telegram_token, env.telegram_chat_id, msgs, log)
    if own_client:
        client.close()
    return summary
