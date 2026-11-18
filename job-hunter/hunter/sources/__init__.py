from __future__ import annotations

from .adzuna import AdzunaSource
from .arbeitnow import ArbeitnowSource
from .arbeitsagentur import ArbeitsagenturSource
from .ats import AtsSource
from .base import Source
from .remotive import RemotiveSource


def build_sources(profile: dict, companies: list[dict], env) -> list[Source]:
    sources: list[Source] = [ArbeitsagenturSource(), ArbeitnowSource(), RemotiveSource()]
    if env.adzuna_app_id and env.adzuna_app_key:
        sources.append(AdzunaSource(env.adzuna_app_id, env.adzuna_app_key))
    if companies:
        sources.append(AtsSource(companies))
    return sources
