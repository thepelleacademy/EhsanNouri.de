/* Browser-side decryption for data/jobs.enc.json. Format must match hunter/secure.py exactly.
   Key = PBKDF2-HMAC-SHA256("<username lowercase>:<password>", salt, iterations) → AES-256-GCM.
   Works in the browser (window.JobCrypto) and in Node (module.exports) for tests. */
(function (root) {
  "use strict";

  const DEFAULT_ITERATIONS = 600000;
  const enc = new TextEncoder();
  const dec = new TextDecoder();

  function b64(text) {
    return Uint8Array.from(atob(text), (c) => c.charCodeAt(0));
  }

  async function deriveKey(username, password, salt, iterations) {
    const secret = enc.encode(username.trim().toLowerCase() + ":" + password);
    const base = await crypto.subtle.importKey("raw", secret, "PBKDF2", false, ["deriveKey"]);
    return crypto.subtle.deriveKey(
      { name: "PBKDF2", salt: salt, iterations: iterations, hash: "SHA-256" },
      base,
      { name: "AES-GCM", length: 256 },
      false,
      ["decrypt"]
    );
  }

  /* Rejects with an OperationError when the username/password pair is wrong (AES-GCM tag mismatch). */
  async function decryptBlob(blob, username, password) {
    const key = await deriveKey(username, password, b64(blob.salt), blob.iter || DEFAULT_ITERATIONS);
    const plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv: b64(blob.iv) }, key, b64(blob.data));
    return JSON.parse(dec.decode(plain));
  }

  const api = { decryptBlob: decryptBlob };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  root.JobCrypto = api;
})(typeof window !== "undefined" ? window : globalThis);
