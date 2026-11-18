from __future__ import annotations

import os
import time

import httpx

from ..models import Job


def user_agent() -> str:
    """Generic UA. Optionally append a contact via the JOB_HUNTER_CONTACT env var (set it yourself)."""
    contact = os.environ.get("JOB_HUNTER_CONTACT", "").strip()
    return "job-hunter/1.0 (personal job search)" + (f" contact: {contact}" if contact else "")


class Source:
    name = "base"

    def fetch(self, client: httpx.Client, profile: dict, lookback_days: int, log=print) -> list[Job]:
        raise NotImplementedError

    def fetch_detail(self, client: httpx.Client, job: Job) -> None:
        """Optional: fill job.description (sources whose list endpoint has no text)."""
        return None


def get_json(client: httpx.Client, url: str, *, params: dict | None = None, headers: dict | None = None,
             retries: int = 2, delay: float = 0.4, log=print):
    """GET → parsed JSON or None. Never raises: one broken source must not stop the daily run."""
    last = None
    for attempt in range(retries + 1):
        try:
            r = client.get(url, params=params, headers=headers, timeout=25)
            if r.status_code in (429, 502, 503):
                time.sleep(2 * (attempt + 1))
                continue
            if r.status_code != 200:
                last = f"HTTP {r.status_code}"
                break
            time.sleep(delay)
            return r.json()
        except (httpx.HTTPError, ValueError) as error:
            last = str(error)
            time.sleep(1 + attempt)
    log(f"[source] {url} failed: {last}")
    return None
