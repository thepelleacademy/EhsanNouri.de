from __future__ import annotations

import json
from datetime import date
from pathlib import Path

import httpx
import pytest

from hunter import ai, notify
from hunter.config import Env, load_profile
from hunter.models import Job
from hunter.pipeline import run
from hunter.prefilter import Rules
from hunter.sources import adzuna, arbeitnow, arbeitsagentur, ats, remotive
from hunter.sources.base import Source
from hunter.store import State, export_site
from hunter.textutils import detect_lang, strip_html

TODAY = date(2026, 11, 18)


@pytest.fixture(scope="module")
def profile():
    return load_profile()


@pytest.fixture()
def rules(profile):
    return Rules(profile)


def mk(title="Mechanical Design Engineer", company="Tiny Robotics GmbH", description="", **kw):
    base = dict(source="t", ref=title + company, title=title, company=company, location="München",
                url="https://example.com/job", description=description, posted_at="2026-11-17")
    base.update(kw)
    return Job(**base)


EN_AD = ("We are a young startup building precision instruments. You will join our small team as an all-rounder, "
         "design parts in SolidWorks and CATIA, run FEA in ANSYS and build prototypes with FDM 3D printing. "
         "English is our working language, German is a plus. We offer a flat hierarchy and an international team.")
DE_STRONG = ("Wir suchen für unser Team einen Konstrukteur. Sie konstruieren in CATIA und SolidWorks. "
             "Sehr gute Deutschkenntnisse und verhandlungssicheres Deutsch sind für die Zusammenarbeit mit der "
             "Kundschaft erforderlich. Wir sind ein weltweit führender Konzern mit über 50.000 Mitarbeitern.")


# ---------------------------------------------------------------- text utils
def test_detect_lang():
    assert detect_lang(EN_AD) == "en"
    assert detect_lang(DE_STRONG) == "de"
    assert detect_lang("short") == "unknown"


def test_strip_html():
    assert strip_html("<p>Hello&nbsp;<b>World</b></p><li>x</li>") .split() == ["Hello", "World", "x"]


# ---------------------------------------------------------------- rules
def test_english_startup_scores_high(rules):
    r = rules.evaluate(mk(description=EN_AD), TODAY)
    assert not r.reject
    assert {"english", "startup"} <= set(r.flags)
    assert "german_required" not in r.flags
    assert r.score >= 70


def test_german_corporate_scores_low(rules):
    r = rules.evaluate(mk("Konstrukteur Maschinenbau", "Siemens AG", DE_STRONG), TODAY)
    assert {"german_required", "big_company", "large"} <= set(r.flags)
    assert r.score < 30


def test_excluded_and_irrelevant(rules):
    assert rules.evaluate(mk("Ausbildung zum Mechatroniker"), TODAY).reject
    assert rules.evaluate(mk("Software Engineer Backend"), TODAY).reject
    assert rules.evaluate(mk("Marketing Manager", description="brand campaigns"), TODAY).reject == "not relevant"


def test_staffing_penalised(rules):
    a = rules.evaluate(mk(description=EN_AD, company="Tiny Robotics GmbH"), TODAY).score
    b = rules.evaluate(mk(description=EN_AD, company="Randstad Engineering"), TODAY).score
    assert b < a


def test_title_gate(rules):
    assert rules.title_relevant("Entwicklungsingenieur Mechanik (m/w/d)")
    assert not rules.title_relevant("Pflegefachkraft")
    assert not rules.title_relevant("Werkstudent Konstruktion")


# ---------------------------------------------------------------- source parsers
def test_parse_arbeitsagentur_both_shapes():
    v4 = {"stellenangebote": [{"refnr": "10001-X-S", "titel": "Konstrukteur (m/w/d)", "arbeitgeber": "Foo GmbH",
                               "arbeitsort": {"ort": "Passau"}, "aktuelleVeroeffentlichungsdatum": "2026-11-17"}]}
    v6 = {"ergebnisliste": [{"referenznummer": "20002", "stellenangebotsTitel": "**Mechatroniker**",
                             "firma": "Bar AG", "stellenlokationen": [{"adresse": {"ort": "Hof"}}]}]}
    a, b = arbeitsagentur.parse_results(v4)[0], arbeitsagentur.parse_results(v6)[0]
    assert (a.title, a.company, a.location, a.posted_at) == ("Konstrukteur (m/w/d)", "Foo GmbH", "Passau", "2026-11-17")
    assert (b.title, b.company, b.location) == ("Mechatroniker", "Bar AG", "Hof")
    assert a.url.endswith("10001-X-S")


def test_parse_arbeitnow_remotive_adzuna():
    j = arbeitnow.parse({"data": [{"slug": "s1", "title": "Hardware Engineer", "company_name": "X", "location": "Berlin",
                                   "url": "https://arbeitnow.com/s1", "description": "<p>Hi</p>", "remote": True,
                                   "job_types": ["full-time"], "created_at": 1763424000}]})[0]
    assert j.remote and j.description == "Hi" and j.posted_at == "2025-11-18"
    r = remotive.parse({"jobs": [{"id": 5, "title": "Mechanical Engineer", "company_name": "Y", "url": "https://r/5",
                                  "candidate_required_location": "Europe", "publication_date": "2026-11-01T10:00:00"}]})[0]
    assert r.remote and r.posted_at == "2026-11-01"
    a = adzuna.parse({"results": [{"id": 9, "title": "<b>CAD Engineer</b>", "company": {"display_name": "Z"},
                                   "location": {"display_name": "Köln"}, "redirect_url": "https://a/9",
                                   "created": "2026-11-16T00:00:00Z"}]})[0]
    assert a.title == "CAD Engineer" and a.company == "Z"


def test_parse_ats_shapes():
    assert ats.parse_greenhouse("G", {"jobs": [{"id": 1, "title": "T", "absolute_url": "https://g/1",
                                                "location": {"name": "Berlin"}, "content": "<p>x</p>"}]})[0].location == "Berlin"
    assert ats.parse_lever("L", [{"id": "a", "text": "T", "hostedUrl": "https://l/a", "categories": {"location": "Munich"},
                                  "descriptionPlain": "d", "createdAt": 1763424000000}])[0].title == "T"
    assert ats.parse_ashby("A", {"jobs": [{"id": "z", "title": "T", "jobUrl": "https://a/z", "isRemote": True}]})[0].remote
    xml = ("<workzag-jobs><position><id>7</id><name>Mechanical Engineer</name><office>Regensburg</office>"
           "<jobDescriptions><jobDescription><name>Tasks</name><value>&lt;p&gt;Design&lt;/p&gt;</value></jobDescription>"
           "</jobDescriptions><createdAt>2026-11-10T00:00:00+00:00</createdAt></position></workzag-jobs>")
    p = ats.parse_personio("P", xml, "pco")[0]
    assert p.url == "https://pco.jobs.personio.de/job/7" and "Design" in p.description
    assert ats.parse_personio("P", "<not xml", "x") == []


# ---------------------------------------------------------------- AI
def test_budget_math():
    b = ai.Budget(0.10, 0.30, 2.50)
    assert b.cost(1_000_000, 0) == pytest.approx(0.30)
    assert b.can_afford(10_000, 1_000)
    b.spent = 0.0999
    assert not b.can_afford(100_000, 1_000)


def test_parse_json_array_tolerates_fences():
    assert ai._parse_json_array('```json\n[{"id": "a", "fit": 80}]\n```')[0]["fit"] == 80
    assert ai._parse_json_array("garbage") == []
    assert ai._parse_json_array('Here: [{"id":"b"}] done')[0]["id"] == "b"


def test_combine_scores():
    j = mk(description=EN_AD)
    j.rule_score, j.ai_score = 80, 90
    assert ai.combine(j) == round(0.35 * 80 + 0.65 * 90)
    j.ai_german = "fluent"
    assert ai.combine(j) < round(0.35 * 80 + 0.65 * 90)
    j2 = mk()
    j2.rule_score = 55
    assert ai.combine(j2) == 55  # no AI → rule score


def _fake_gemini(ids_to_fit):
    def handler(request: httpx.Request) -> httpx.Response:
        body = json.loads(request.content)
        prompt = body["contents"][0]["parts"][0]["text"]
        out = [{"id": i, "fit": f, "reason": "r", "reason_fa": "ر", "german_required": "none",
                "company_size": "small", "company_age": "startup", "red_flags": []}
               for i, f in ids_to_fit.items() if i in prompt]
        return httpx.Response(200, json={"candidates": [{"content": {"parts": [{"text": json.dumps(out)}]}}],
                                         "usageMetadata": {"promptTokenCount": 1500, "candidatesTokenCount": 300}})
    return handler


def test_score_jobs_with_budget(profile):
    jobs = [mk(f"Mechanical Engineer {i}", description=EN_AD) for i in range(7)]
    client = httpx.Client(transport=httpx.MockTransport(_fake_gemini({j.id: 77 for j in jobs})))
    budget = ai.Budget(0.10, 0.30, 2.50)
    n = ai.score_jobs(client, profile, jobs, "k", "gemini-x", budget, log=lambda *_: None)
    assert n == 7 and all(j.ai_score == 77 for j in jobs)
    assert 0 < budget.spent < 0.01

    tight = ai.Budget(0.0000001, 0.30, 2.50)
    jobs2 = [mk(f"Other {i}", description=EN_AD) for i in range(3)]
    assert ai.score_jobs(client, profile, jobs2, "k", "gemini-x", tight, log=lambda *_: None) == 0


# ---------------------------------------------------------------- notify
def test_notify_messages():
    good = mk(description=EN_AD)
    good.final_score, good.ai_reason = 88, "great <fit> & small"
    msgs = notify.build_messages([good], 5, 60, 8, "https://job.ehsannouri.de", 0.012, ["x: 0 jobs"], True)
    assert len(msgs) == 1 and "88" in msgs[0] and "&lt;fit&gt;" in msgs[0] and "job.ehsannouri.de" in msgs[0]
    assert notify.build_messages([], 0, 60, 8, "u", 0, [], False) == []
    assert "No strong" in notify.build_messages([], 3, 60, 8, "u", 0, [], True)[0]


def test_notify_chunks_long_messages():
    jobs = []
    for i in range(8):
        j = mk(f"Engineer {i}", description="x")
        j.final_score, j.ai_reason = 90, "y" * 700
        jobs.append(j)
    msgs = notify.build_messages(jobs, 8, 60, 8, "u", 0, [], True)
    assert len(msgs) >= 2 and all(len(m) <= 4096 for m in msgs)


# ---------------------------------------------------------------- end-to-end pipeline (offline)
class FakeSource(Source):
    name = "fake"

    def __init__(self, jobs, details=None):
        self.jobs, self.details = jobs, details or {}

    def fetch(self, client, profile, lookback_days, log=print):
        return list(self.jobs)

    def fetch_detail(self, client, job):
        job.description = self.details.get(job.ref, "")


def test_pipeline_end_to_end(tmp_path, profile, monkeypatch):
    import hunter.pipeline as pl
    monkeypatch.setattr(pl, "SITE_DATA_PATH", tmp_path / "site" / "jobs.json")
    monkeypatch.setattr(pl.time, "sleep", lambda *_: None)
    profile = json.loads(json.dumps(profile))
    profile["settings"]["request_delay_seconds"] = 0

    good = Job(source="fake", ref="1", title="Mechanical Design Engineer (m/w/d)", company="Tiny Robotics",
               location="Passau", url="https://x/1", posted_at="2026-11-17")
    dup = Job(source="other", ref="9", title="Mechanical Design Engineer (m/w/d)", company="Tiny Robotics",
              location="Passau", url="https://x/9", description=EN_AD)
    junk = Job(source="fake", ref="2", title="Pflegefachkraft", company="Klinik", location="Hof", url="https://x/2")
    bad = Job(source="fake", ref="3", title="Konstrukteur", company="Siemens AG", location="München",
              url="https://x/3", description=DE_STRONG)
    src = FakeSource([good, junk, bad], {"1": EN_AD})
    other = FakeSource([dup])
    other.name = "other"

    state = State(tmp_path / "state.json")
    env = Env("key", "gemini-x", "", "", "", "")
    client = httpx.Client(transport=httpx.MockTransport(_fake_gemini({good.id: 92, bad.id: 20})))
    summary = run(profile, [], env, state, sources=[src, other], client=client, today=TODAY, log=lambda *_: None)

    assert summary["fetched"] == 4 and summary["new"] == 3          # cross-source duplicate removed
    assert good.id in state.jobs and junk.id not in state.jobs
    assert state.jobs[good.id].ai_score == 92 and state.jobs[good.id].final_score >= 80
    assert state.jobs[bad.id].final_score < 40
    assert junk.id in state.rejected
    assert summary["ai_cost_usd"] > 0 and state.spent_on("2026-11-18") > 0

    exported = json.loads((tmp_path / "site" / "jobs.json").read_text())
    titles = [j["title"] for j in exported["jobs"]]
    assert "Mechanical Design Engineer (m/w/d)" in titles and "Konstrukteur" not in titles
    assert "description" not in exported["jobs"][0]               # trimmed public export

    # second run: nothing is new, nothing re-scored, no extra spend
    summary2 = run(profile, [], env, State(tmp_path / "state.json"), sources=[src, other], client=client,
                   today=TODAY, log=lambda *_: None)
    assert summary2["new"] == 0 and summary2["ai_scored"] == 0


def test_pipeline_survives_crashing_source_and_missing_key(tmp_path, profile, monkeypatch):
    import hunter.pipeline as pl
    monkeypatch.setattr(pl, "SITE_DATA_PATH", tmp_path / "jobs.json")

    class Boom(Source):
        name = "boom"

        def fetch(self, *a, **k):
            raise RuntimeError("api changed")

    good = Job(source="fake", ref="1", title="Mechatronics Engineer", company="Small Co", location="Hof",
               url="https://x/1", description=EN_AD)
    state = State(tmp_path / "s.json")
    env = Env("", "m", "", "", "", "")
    s = run(profile, [], env, state, sources=[Boom(), FakeSource([good])], client=httpx.Client(),
            today=TODAY, log=lambda *_: None)
    assert s["kept"] == 1
    assert any("boom crashed" in e for e in s["errors"]) and any("GEMINI_API_KEY" in e for e in s["errors"])


def test_state_prune_and_export_threshold(tmp_path):
    st = State(tmp_path / "s.json")
    old = mk("Old Engineer")
    old.first_seen = old.last_seen = "2026-01-01"
    new = mk("New Engineer")
    new.first_seen = new.last_seen = "2026-11-18"
    new.final_score = 55
    low = mk("Low Engineer")
    low.first_seen = low.last_seen = "2026-11-18"
    low.final_score = 10
    for j in (old, new, low):
        st.jobs[j.id] = j
    assert st.prune(45, TODAY) == 1
    assert export_site(st, tmp_path / "out.json", 40) == 1
