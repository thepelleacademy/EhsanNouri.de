"""Password gate for a PUBLIC repo: everything personal is stored AES-256-GCM encrypted.

The key is PBKDF2-HMAC-SHA256(600k iterations) of "<username lowercase>:<password>". The browser login page
derives the same key with WebCrypto and decrypts data/jobs.enc.json locally — without the password the
published file is just ciphertext. Format must stay in sync with site/app.js.
"""
from __future__ import annotations

import base64
import hashlib
import json
import os

from cryptography.exceptions import InvalidTag
from cryptography.hazmat.primitives.ciphers.aead import AESGCM

ITERATIONS = 600_000
MIN_PASSWORD_LEN = 12


class DecryptError(Exception):
    pass


def derive_key(username: str, password: str, salt: bytes, iterations: int = ITERATIONS) -> bytes:
    secret = f"{username.strip().lower()}:{password}".encode("utf-8")
    return hashlib.pbkdf2_hmac("sha256", secret, salt, iterations, 32)


def check_password_strength(password: str) -> None:
    if len(password) < MIN_PASSWORD_LEN:
        raise ValueError(f"JOB_PASSWORD must be at least {MIN_PASSWORD_LEN} characters "
                         "(the ciphertext is public, so a weak password can be brute-forced offline)")


def encrypt_json(obj, username: str, password: str) -> dict:
    check_password_strength(password)
    salt, iv = os.urandom(16), os.urandom(12)
    key = derive_key(username, password, salt)
    plain = json.dumps(obj, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
    ct = AESGCM(key).encrypt(iv, plain, None)          # ciphertext || 16-byte tag (= WebCrypto layout)
    b64 = lambda b: base64.b64encode(b).decode("ascii")  # noqa: E731
    return {"v": 1, "kdf": "PBKDF2-SHA256", "iter": ITERATIONS, "salt": b64(salt), "iv": b64(iv), "data": b64(ct)}


def decrypt_json(blob: dict, username: str, password: str):
    try:
        salt, iv, ct = (base64.b64decode(blob[k]) for k in ("salt", "iv", "data"))
        key = derive_key(username, password, salt, int(blob.get("iter", ITERATIONS)))
        return json.loads(AESGCM(key).decrypt(iv, ct, None).decode("utf-8"))
    except (InvalidTag, KeyError, ValueError) as error:
        raise DecryptError("wrong username/password or corrupted file") from error
