import en from './locales/en.json';
import de from './locales/de.json';
import fa from './locales/fa.json';
import {
  LANGS,
  DEFAULT_LANG,
  COUNTRY_TO_LANG,
  GEO_DETECTION_ENABLED,
  GEO_TIMEOUT_MS,
  GEO_ENDPOINTS,
} from './config.js';

const DICTS = { en, de, fa };
const RTL = new Set(['fa']);
const STORAGE_KEY = 'lang';
const COUNTRY_KEY = 'geoCountry';

let current = DEFAULT_LANG;
const listeners = new Set();

function safeGet(store, key) {
  try {
    return store.getItem(key);
  } catch {
    return null;
  }
}
function safeSet(store, key, value) {
  try {
    store.setItem(key, value);
  } catch {
    /* storage blocked – ignore */
  }
}

export function t(path) {
  const parts = path.split('.');
  let node = DICTS[current];
  for (const p of parts) node = node == null ? undefined : node[p];
  return node;
}

export const getLang = () => current;
export const onLangChange = (fn) => listeners.add(fn);

export function setLang(lang, { persist = false } = {}) {
  if (!LANGS.includes(lang)) lang = DEFAULT_LANG;
  current = lang;
  if (persist) safeSet(localStorage, STORAGE_KEY, lang);

  const root = document.documentElement;
  root.lang = lang;
  root.dir = RTL.has(lang) ? 'rtl' : 'ltr';
  document.title = t('meta.title');
  const meta = document.querySelector('meta[name="description"]');
  if (meta) meta.setAttribute('content', t('meta.description'));

  document.querySelectorAll('[data-i18n]').forEach((el) => {
    const v = t(el.dataset.i18n);
    if (typeof v === 'string') el.textContent = v;
  });
  listeners.forEach((fn) => fn(lang));
}

function fromBrowser() {
  const prefs = navigator.languages && navigator.languages.length ? navigator.languages : [navigator.language];
  for (const p of prefs) {
    const base = String(p || '').toLowerCase().split('-')[0];
    if (LANGS.includes(base)) return base;
  }
  return DEFAULT_LANG;
}

async function fetchWithTimeout(url, ms) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  try {
    const res = await fetch(url, { signal: ctrl.signal, cache: 'no-store' });
    if (!res.ok) throw new Error(String(res.status));
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

/** Resolve the visitor's country code (cached for the session). */
async function detectCountry() {
  const cached = safeGet(sessionStorage, COUNTRY_KEY);
  if (cached) return cached;
  for (const ep of GEO_ENDPOINTS) {
    try {
      const code = ep.pick(await fetchWithTimeout(ep.url, GEO_TIMEOUT_MS));
      if (code && /^[A-Za-z]{2}$/.test(code)) {
        const up = code.toUpperCase();
        safeSet(sessionStorage, COUNTRY_KEY, up);
        return up;
      }
    } catch {
      /* try next endpoint */
    }
  }
  return null;
}

/**
 * Priority: 1) ?lang=xx in URL  2) language the visitor picked before
 *           3) visitor's country (IP)  4) browser language  5) default
 * The page renders immediately with the browser language; the country lookup
 * may switch it a moment later, only if the visitor never picked one.
 */
export async function initI18n() {
  const urlLang = new URLSearchParams(location.search).get('lang');
  if (urlLang && LANGS.includes(urlLang)) {
    setLang(urlLang, { persist: true });
    return;
  }
  const saved = safeGet(localStorage, STORAGE_KEY);
  if (saved && LANGS.includes(saved)) {
    setLang(saved);
    return;
  }

  setLang(fromBrowser());

  if (!GEO_DETECTION_ENABLED) return;
  const country = await detectCountry();
  if (!country) return;
  const geoLang = COUNTRY_TO_LANG[country] || DEFAULT_LANG;
  // do not override a choice the visitor made while the lookup was running
  if (!safeGet(localStorage, STORAGE_KEY) && geoLang !== current) setLang(geoLang);
}
