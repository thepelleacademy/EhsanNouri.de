import { C } from './content.js';
import { LANGS, RTL_LANGS, GEO_TIMEOUT_MS, GEO_TRACE_URL } from './config.js';

const RTL = new Set(RTL_LANGS);
const NUMBER_LOCALE = { fa: 'fa-IR', en: 'en-US', de: 'de-DE' };
const STORAGE_KEY = 'lang';
const COUNTRY_KEY = 'geoCountry';

const langCfg = () => C.site.languages || {};
const defaultLang = () => (LANGS.includes(langCfg().default) ? langCfg().default : 'en');

let current = defaultLang();
const listeners = new Set();

export function safeGet(store, key) {
  try {
    return store.getItem(key);
  } catch {
    return null;
  }
}
export function safeSet(store, key, value) {
  try {
    store.setItem(key, value);
  } catch {
    /* storage blocked – ignore */
  }
}

const dig = (root, path) => path.split('.').reduce((n, k) => (n == null ? undefined : n[k]), root);
const isML = (v) => v && typeof v === 'object' && !Array.isArray(v) && LANGS.some((l) => l in v);

/** A multilingual content value { fa, en, de } in the current language (falls back to English, then any). */
export function L(v) {
  if (!isML(v)) return v;
  const own = v[current];
  const empty = own == null || own === '' || (Array.isArray(own) && !own.length);
  if (!empty) return own;
  for (const l of [defaultLang(), 'en', ...LANGS]) {
    const x = v[l];
    if (x != null && x !== '' && !(Array.isArray(x) && !x.length)) return x;
  }
  return own;
}

/** Fill {name} placeholders. Numbers use the language's digits. */
export function fill(s, vars = {}) {
  if (typeof s !== 'string') return '';
  return s.replace(/\{(\w+)\}/g, (_, k) => (typeof vars[k] === 'number' ? num(vars[k]) : vars[k] ?? ''));
}

/** Interface string by dotted path, e.g. t('ui.close') (content/ui/<lang>.json). */
export function t(path) {
  const v = dig(C.ui[current], path);
  return v === undefined ? dig(C.ui.en, path) : v;
}
/** Content value by dotted path, e.g. c('home.role'), resolved to the current language. */
export const c = (path) => L(dig(C, path));

export const num = (n) => new Intl.NumberFormat(NUMBER_LOCALE[current] || 'en-US').format(n);
export const getLang = () => current;
export const isRTL = () => RTL.has(current);
export const onLangChange = (fn) => listeners.add(fn);

/** Fill elements marked data-i18n (interface strings) and data-c (content) in the current language. */
export function applyStaticTexts(root = document) {
  root.querySelectorAll('[data-i18n]').forEach((el) => {
    const v = t(el.dataset.i18n);
    if (typeof v === 'string') el.textContent = v;
  });
  root.querySelectorAll('[data-c]').forEach((el) => {
    const v = c(el.dataset.c);
    el.textContent = typeof v === 'string' ? v : '';
    el.hidden = !v;
  });
}

export function setLang(lang, { persist = false } = {}) {
  if (!LANGS.includes(lang)) lang = defaultLang();
  current = lang;
  if (persist) safeSet(localStorage, STORAGE_KEY, lang);

  const root = document.documentElement;
  root.lang = lang;
  root.dir = RTL.has(lang) ? 'rtl' : 'ltr';
  document.title = L(C.site.meta?.title) || C.site.name;
  document.querySelector('meta[name="description"]')?.setAttribute('content', L(C.site.meta?.description) || '');
  applyStaticTexts();
  listeners.forEach((fn) => fn(lang));
}

function fromBrowser() {
  const prefs = navigator.languages?.length ? navigator.languages : [navigator.language];
  for (const p of prefs) {
    const base = String(p || '').toLowerCase().split('-')[0];
    if (LANGS.includes(base)) return base;
  }
  return defaultLang();
}

/** Country code from Cloudflare's trace endpoint on our own domain (cached per session). */
async function detectCountry() {
  const cached = safeGet(sessionStorage, COUNTRY_KEY);
  if (cached) return cached;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), GEO_TIMEOUT_MS);
  try {
    const res = await fetch(GEO_TRACE_URL, { signal: ctrl.signal, cache: 'no-store' });
    if (!res.ok) return null;
    const m = /^loc=([A-Z]{2})$/m.exec(await res.text());
    if (!m) return null;
    safeSet(sessionStorage, COUNTRY_KEY, m[1]);
    return m[1];
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Priority: 1) ?lang=xx in URL  2) language the visitor picked before
 *           3) visitor's country  4) browser language  5) default
 * The page renders immediately with the browser language; the country lookup
 * may switch it a moment later, only if the visitor never picked one.
 */
export async function initI18n() {
  const urlLang = new URLSearchParams(location.search).get('lang');
  if (urlLang && LANGS.includes(urlLang)) return setLang(urlLang, { persist: true });

  const saved = safeGet(localStorage, STORAGE_KEY);
  if (saved && LANGS.includes(saved)) return setLang(saved);

  setLang(fromBrowser());
  if (langCfg().geoDetection === false) return;
  const country = await detectCountry();
  if (!country) return;
  const geoLang = (langCfg().countryToLang || {})[country] || defaultLang();
  if (!safeGet(localStorage, STORAGE_KEY) && geoLang !== current) setLang(geoLang);
}
