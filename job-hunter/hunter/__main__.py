from __future__ import annotations

import argparse
import json
import os
import sys

from .config import STATE_PATH, Env, load_companies, load_profile
from .pipeline import run
from .secure import check_password_strength
from .store import State


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(prog="hunter", description="Personal job hunter")
    sub = parser.add_subparsers(dest="cmd", required=True)
    r = sub.add_parser("run", help="fetch → filter → score → export → notify")
    r.add_argument("--dry", action="store_true", help="do everything except saving and notifying")
    r.add_argument("--no-ai", action="store_true", help="skip Gemini (rule scores only)")
    r.add_argument("--no-notify", action="store_true", help="do not send Telegram")
    r.add_argument("--site-url", default="https://job.ehsannouri.de")
    args = parser.parse_args(argv)

    profile = load_profile()
    env = Env.from_environ(profile["ai"]["model"])
    if env.creds:
        check_password_strength(env.job_password)
    elif os.environ.get("JOB_REQUIRE_ENCRYPTION") == "1":
        print("JOB_USERNAME / JOB_PASSWORD secrets are missing — refusing to write plaintext data to a public repo.")
        return 3
    state = State(STATE_PATH, env.creds)
    summary = run(profile, load_companies(), env, state, dry=args.dry, no_ai=args.no_ai,
                  no_notify=args.no_notify, site_url=args.site_url)
    print(json.dumps(summary, ensure_ascii=False, indent=2))
    # Every source empty = something is broken (network/API change): make the workflow go red.
    return 2 if summary["fetched"] == 0 else 0


if __name__ == "__main__":
    sys.exit(main())
