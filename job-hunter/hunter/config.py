from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path

import yaml

ROOT = Path(__file__).resolve().parent.parent
PROFILE_PATH = ROOT / "profile.yaml"
COMPANIES_PATH = ROOT / "companies.yaml"
STATE_PATH = ROOT / "data" / "state.json"
SITE_DATA_PATH = ROOT / "site" / "data" / "jobs.json"


@dataclass
class Env:
    gemini_api_key: str
    gemini_model: str
    telegram_token: str
    telegram_chat_id: str
    adzuna_app_id: str
    adzuna_app_key: str
    job_username: str = ""
    job_password: str = ""

    @property
    def creds(self) -> tuple[str, str] | None:
        return (self.job_username, self.job_password) if self.job_username and self.job_password else None

    @classmethod
    def from_environ(cls, default_model: str) -> "Env":
        g = lambda k: os.environ.get(k, "").strip()  # noqa: E731
        return cls(
            gemini_api_key=g("GEMINI_API_KEY"),
            gemini_model=g("GEMINI_MODEL") or default_model,
            telegram_token=g("TELEGRAM_BOT_TOKEN"),
            telegram_chat_id=g("TELEGRAM_CHAT_ID"),
            adzuna_app_id=g("ADZUNA_APP_ID"),
            adzuna_app_key=g("ADZUNA_APP_KEY"),
            job_username=g("JOB_USERNAME"),
            job_password=os.environ.get("JOB_PASSWORD", ""),
        )


def load_yaml(path: Path) -> dict:
    with open(path, encoding="utf-8") as f:
        return yaml.safe_load(f) or {}


def load_profile(path: Path = PROFILE_PATH) -> dict:
    return load_yaml(path)


def load_companies(path: Path = COMPANIES_PATH) -> list[dict]:
    if not path.exists():
        return []
    return load_yaml(path).get("companies") or []
