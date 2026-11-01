import en from './locales/en.json';
import de from './locales/de.json';
import fa from './locales/fa.json';
import { LANGS, DEFAULT_LANG, COUNTRY_TO_LANG, GEO_DETECTION_ENABLED, GEO_TIMEOUT_MS, GEO_TRACE_URL } from './config.js';

const DICTS = { en, de, fa };
const RTL = new Set(['fa']);
const NUMBER_LOCALE = { fa: 'fa-IR', en: 'en-US', de: 'de-DE' };
const STORAGE_KEY = 'lang';
const COUNTRY_KEY = 'geoCountry';

let current = DEFAULT_LANG;
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

/** Look up a value by dotted path, e.g. t('ui.close'). */
export function t(path) {
  let node = DICTS[current];
  for (const p of path.split('.')) node = node == null ? undefined : node[p];
  return node;
}

/** Same as t(), with {name} placeholders filled in. Numbers use the language's digits. */
export function tf(path, vars = {}) {
  const s = t(path);
  if (typeof s !== 'string') return '';
  return s.replace(/\{(\w+)\}/g, (_, k) => (typeof vars[k] === 'number' ? num(vars[k]) : vars[k] ?? ''));
}

export const num = (n) => new Intl.NumberFormat(NUMBER_LOCALE[current] || 'en-US').format(n);
export const getLang = () => current;
export const isRTL = () => RTL.has(current);
export const onLangChange = (fn) => listeners.add(fn);

export function setLang(lang, { persist = false } = {}) {
  if (!LANGS.includes(lang)) lang = DEFAULT_LANG;
  current = lang;
  if (persist) safeSet(localStorage, STORAGE_KEY, lang);

  const root = document.documentElement;
  root.lang = lang;
  root.dir = RTL.has(lang) ? 'rtl' : 'ltr';
  document.title = t('meta.title');
  document.querySelector('meta[name="description"]')?.setAttribute('content', t('meta.description'));

  document.querySelectorAll('[data-i18n]').forEach((el) => {
    const v = t(el.dataset.i18n);
    if (typeof v === 'string') el.textContent = v;
  });
  listeners.forEach((fn) => fn(lang));
}

function fromBrowser() {
  const prefs = navigator.languages?.length ? navigator.languages : [navigator.language];
  for (const p of prefs) {
    const base = String(p || '').toLowerCase().split('-')[0];
    if (LANGS.includes(base)) return base;
  }
  return DEFAULT_LANG;
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
  if (!GEO_DETECTION_ENABLED) return;
  const country = await detectCountry();
  if (!country) return;
  const geoLang = COUNTRY_TO_LANG[country] || DEFAULT_LANG;
  if (!safeGet(localStorage, STORAGE_KEY) && geoLang !== current) setLang(geoLang);
}
