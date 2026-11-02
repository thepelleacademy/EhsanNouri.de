// ============================================================
//  All editable content of the site lives in /content/*.json.
//  These files are edited in the admin panel (/admin) or by hand.
//
//  Multilingual values look like  { "fa": "…", "en": "…", "de": "…" }.
//  Use L(value) to get the text in the current language.
//
//  Preview: /admin stores unsaved changes in localStorage; opening the
//  site with ?preview shows them (only in that browser).
// ============================================================
import site from '../content/site.json';
import nav from '../content/nav.json';
import home from '../content/home.json';
import about from '../content/about.json';
import career from '../content/career.json';
import projects from '../content/projects.json';
import certificates from '../content/certificates.json';
import contact from '../content/contact.json';
import pages from '../content/pages.json';
import uiFa from '../content/ui/fa.json';
import uiEn from '../content/ui/en.json';
import uiDe from '../content/ui/de.json';

export const PREVIEW_STORAGE_KEY = 'admin:preview';
export const PREVIEW_PARAM = 'preview';

// file path in the repository -> key in C
export const CONTENT_FILES = {
  'content/site.json': 'site',
  'content/nav.json': 'nav',
  'content/home.json': 'home',
  'content/about.json': 'about',
  'content/career.json': 'career',
  'content/projects.json': 'projects',
  'content/certificates.json': 'certificates',
  'content/contact.json': 'contact',
  'content/pages.json': 'pages',
  'content/ui/fa.json': 'ui.fa',
  'content/ui/en.json': 'ui.en',
  'content/ui/de.json': 'ui.de',
};

export const C = {
  site,
  nav,
  home,
  about,
  career,
  projects,
  certificates,
  contact,
  pages,
  ui: { fa: uiFa, en: uiEn, de: uiDe },
};

export let isPreview = false;

function applyPreview() {
  if (!new URLSearchParams(location.search).has(PREVIEW_PARAM)) return;
  let draft = null;
  try {
    draft = JSON.parse(localStorage.getItem(PREVIEW_STORAGE_KEY) || 'null');
  } catch {
    draft = null;
  }
  if (!draft?.files) return;
  for (const [file, data] of Object.entries(draft.files)) {
    const key = CONTENT_FILES[file];
    if (!key || !data) continue;
    if (key.startsWith('ui.')) C.ui[key.slice(3)] = data;
    else C[key] = data;
  }
  isPreview = true;
  // live preview: reload when /admin stores new changes (same browser)
  window.addEventListener('storage', (e) => {
    if (e.key === PREVIEW_STORAGE_KEY) location.reload();
  });
}
applyPreview();

/** Path of a file in /public as used on the page ('img/x.jpg' -> './img/x.jpg'). */
export const asset = (p) => (!p ? '' : /^(https?:)?\/\//.test(p) || p.startsWith('/') || p.startsWith('./') ? p : `./${p}`);
