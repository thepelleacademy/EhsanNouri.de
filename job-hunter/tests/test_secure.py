from __future__ import annotations

import json
import shutil
import subprocess
from datetime import date
from pathlib import Path

import pytest

from hunter import secure
from hunter.models import Job
from hunter.store import State, export_site

ROOT = Path(__file__).resolve().parent.parent
USER, PASSWORD = "ehsan", "correct horse battery staple"


def test_roundtrip_and_wrong_password():
    blob = secure.encrypt_json({"jobs": [{"title": "Engineer"}]}, USER, PASSWORD)
    assert secure.decrypt_json(blob, USER, PASSWORD) == {"jobs": [{"title": "Engineer"}]}
    assert secure.decrypt_json(blob, "EHSAN", PASSWORD)  # username is case-insensitive
    with pytest.raises(secure.DecryptError):
        secure.decrypt_json(blob, USER, "wrong password!!")
    with pytest.raises(secure.DecryptError):
        secure.decrypt_json(blob, "someone", PASSWORD)


def test_ciphertext_hides_content():
    blob = secure.encrypt_json({"secret": "Mechanical Design Engineer"}, USER, PASSWORD)
    assert "Mechanical" not in json.dumps(blob)


def test_weak_password_refused():
    with pytest.raises(ValueError):
        secure.encrypt_json({}, USER, "short")


def test_state_roundtrip_is_encrypted_on_disk(tmp_path):
    st = State(tmp_path / "state.json", creds=(USER, PASSWORD))
    assert st.path.name == "state.enc.json"
    job = Job(source="t", ref="1", title="Secret Title", company="Co", location="Passau", url="https://x/1")
    job.first_seen = job.last_seen = "2026-11-18"
    st.jobs[job.id] = job
    st.save()
    raw = st.path.read_text()
    assert "Secret Title" not in raw
    again = State(tmp_path / "state.json", creds=(USER, PASSWORD))
    assert again.jobs[job.id].title == "Secret Title"


def test_site_export_is_encrypted(tmp_path):
    st = State(tmp_path / "state.json")
    job = Job(source="t", ref="1", title="Visible Only After Login", company="Co", location="Hof", url="https://x/1")
    job.first_seen = job.last_seen = "2026-11-18"
    job.final_score = 80
    st.jobs[job.id] = job
    out = tmp_path / "site" / "jobs.json"
    export_site(st, out, 40, creds=(USER, PASSWORD))
    assert not out.exists() and (out.parent / "jobs.enc.json").exists()
    assert "Visible Only" not in (out.parent / "jobs.enc.json").read_text()


@pytest.mark.skipif(shutil.which("node") is None, reason="node not installed")
def test_browser_decrypt_matches_python(tmp_path):
    """The JS decryptor used by the login page must read what Python writes."""
    payload = {"generated_at": "2026-11-18T17:00:00Z", "count": 1, "jobs": [{"title": "Ünïcode ✓ Engineer"}]}
    blob_path = tmp_path / "blob.json"
    blob_path.write_text(json.dumps(secure.encrypt_json(payload, USER, PASSWORD)), encoding="utf-8")
    script = (
        "require(process.argv[1]);const c=globalThis.JobCrypto;const fs=require('fs');"
        "const b=JSON.parse(fs.readFileSync(process.argv[2],'utf8'));"
        "c.decryptBlob(b,process.argv[3],process.argv[4])"
        ".then(d=>console.log(JSON.stringify(d)))"
        ".catch(e=>{console.log('ERR:'+e.name);process.exit(0)});"
    )
    crypto_js = str(ROOT / "site" / "crypto.js")

    def run(user, pw):
        res = subprocess.run(["node", "-e", script, crypto_js, str(blob_path), user, pw],
                             capture_output=True, text=True, timeout=60)
        return res.stdout.strip()

    assert json.loads(run(USER, PASSWORD)) == payload
    assert run(USER, "wrong password!!") == "ERR:OperationError"
