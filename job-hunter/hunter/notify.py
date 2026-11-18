from __future__ import annotations

import html

import httpx

from .models import Job

TELEGRAM_LIMIT = 3800  # API limit is 4096; keep a margin


def build_messages(new_jobs: list[Job], total_new: int, min_score: int, max_items: int, site_url: str,
                   spent_usd: float, errors: list[str], even_if_empty: bool) -> list[str]:
    strong = sorted((j for j in new_jobs if j.final_score >= min_score), key=lambda j: -j.final_score)[:max_items]
    if not strong and not even_if_empty:
        return []
    head = f"🛰 <b>Job Hunter — {len(strong)} strong match(es)</b>\n{total_new} new job(s) found today."
    if not strong:
        head = f"🛰 <b>Job Hunter</b>\nNo strong new matches today ({total_new} new, none ≥ {min_score})."
    footer = f"\n\n🔗 {html.escape(site_url)}\n💰 AI cost today: ${spent_usd:.3f}"
    if errors:
        footer += "\n⚠️ " + html.escape("; ".join(errors)[:300])

    messages: list[str] = []
    current = head
    for j in strong:
        flags = " ".join(f"#{f}" for f in j.flags[:4])
        block = (f"\n\n<b>{j.final_score}</b> · <a href=\"{html.escape(j.url, quote=True)}\">{html.escape(j.title)}</a>\n"
                 f"{html.escape(j.company or '?')} — {html.escape(j.location or '?')}\n"
                 f"{html.escape(j.ai_reason_fa or j.ai_reason)}\n{html.escape(flags)}")
        if len(current) + len(block) > TELEGRAM_LIMIT:
            messages.append(current)
            current = ""
        current += block
    messages.append(current + footer)
    return messages


def send_telegram(client: httpx.Client, token: str, chat_id: str, messages: list[str], log=print) -> bool:
    ok = True
    for text in messages:
        try:
            r = client.post(f"https://api.telegram.org/bot{token}/sendMessage", timeout=30, json={
                "chat_id": chat_id, "text": text, "parse_mode": "HTML", "disable_web_page_preview": True})
            if r.status_code != 200:
                log(f"[telegram] HTTP {r.status_code}: {r.text[:200]}")
                ok = False
        except httpx.HTTPError as error:
            log(f"[telegram] {error}")
            ok = False
    return ok
