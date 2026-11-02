// ============================================================
//  The GitHub token is stored on this device only, encrypted with
//  the admin password (PBKDF2-SHA-256 -> AES-GCM-256, Web Crypto).
// ============================================================
import { PBKDF2_ITERATIONS, STORE } from './config.js';

const enc = new TextEncoder();
const dec = new TextDecoder();
const b64 = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf)));
const unb64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

async function deriveKey(password, salt, iterations) {
  const base = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations, hash: 'SHA-256' },
    base,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

export async function sealToken(token, password, meta = {}) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(password, salt, PBKDF2_ITERATIONS);
  const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, enc.encode(token));
  const vault = { v: 1, iter: PBKDF2_ITERATIONS, salt: b64(salt), iv: b64(iv), ct: b64(ct), created: new Date().toISOString(), ...meta };
  localStorage.setItem(STORE.vault, JSON.stringify(vault));
  return vault;
}

/** Returns the token, or throws if the password is wrong. */
export async function openVault(password) {
  const vault = readVault();
  if (!vault) throw new Error('no-vault');
  const key = await deriveKey(password, unb64(vault.salt), vault.iter || PBKDF2_ITERATIONS);
  const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64(vault.iv) }, key, unb64(vault.ct));
  return dec.decode(pt);
}

export function readVault() {
  try {
    return JSON.parse(localStorage.getItem(STORE.vault) || 'null');
  } catch {
    return null;
  }
}

export function forgetVault() {
  localStorage.removeItem(STORE.vault);
  sessionStorage.removeItem(STORE.session);
}
