import '@fontsource-variable/archivo/wdth.css';
import '@fontsource-variable/vazirmatn';
import './styles.css';

import { initI18n, setLang, getLang, onLangChange, t, tf, num } from './i18n.js';
import { initTheme, refreshThemeMenu } from './theme.js';
import { initViewer } from './scene.js';
import { createRing } from './ring.js';
import { openSheet, closeSheet, sheetIsOpen } from './sheet.js';
import { mediaFor, coverFor, certFiles } from './media.js';
import { projectArt, rosette } from './art.js';
import { ICONS } from './icons.js';
import { SITE, IMPRINT, MOBILE_BREAKPOINT } from './config.js';
import { PROJECTS } from './data/projects.js';
import { CERTIFICATES } from './data/certificates.js';

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
const esc = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

// ---------- sections ----------
const PANELS = ['overview', 'about', 'career', 'projects', 'certificates', 'contact'];
const DOCK = ['overview', 'career', 'projects', 'certificates', 'about'];
const PROJECT_FILTERS = ['all', 'mechanical', 'electronics', 'software', 'research'];
const CERT_FILTERS = ['all', 'solidworks', 'cae', 'software'];
const STATUS_CLASS = { completed: 's-done', in_progress: 's-active', prototype: 's-proto' };

const state = {
  panel: null,
  projectFilter: 'all',
  certFilter: 'all',
  career: 'w0',
  trigger: null, // last clicked element: panels and sheets grow out of it
};

// ---------- small helpers ----------
const statusLabel = (s) => t(`ui.statusLabel.${s}`) || s;
const fmtPeriod = ([from, to]) => `${from} – ${to === 'now' ? t('ui.now') : to}`;
const ticks = (items) => `<ul class="ticks">${(items || []).map((x) => `<li>${esc(x)}</li>`).join('')}</ul>`;
const projectText = (id) => t(`projects.items.${id}`) || { title: id, summary: '', work: [] };
const certText = (c) => t(`certificates.items.${c.id}`) || { title: c.code, detail: '' };
const issuerName = (c) => t(`certificates.issuers.${c.issuer}`) || c.issuer;
const statusPill = (s) => `<span class="status ${STATUS_CLASS[s] || ''}">${esc(statusLabel(s))}</span>`;
const visibleProjects = () => PROJECTS.filter((p) => state.projectFilter === 'all' || p.cat === state.projectFilter);
const visibleCerts = () => CERTIFICATES.filter((c) => state.certFilter === 'all' || c.group === state.certFilter);

// ============================================================
//  Navigation
// ============================================================
function renderNav() {
  $('#tabs').innerHTML = PANELS.map(
    (p) => `<a href="#/${p === 'overview' ? '' : p}" data-nav="${p}">${esc(t(`nav.${p}`))}</a>`
  ).join('');
  $('#dock').innerHTML = DOCK.map(
    (p) => `<a href="#/${p === 'overview' ? '' : p}" data-nav="${p}">${ICONS[p]}<span>${esc(t(`nav.${p}`))}</span></a>`
  ).join('');
  markNav();
  $$('#lang button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.lang === getLang())));
  $('#tabs').setAttribute('aria-label', t('ui.menu'));
  $('#dock').setAttribute('aria-label', t('ui.menu'));
  $('#lang').setAttribute('aria-label', t('ui.language'));
}

function markNav() {
  $$('[data-nav]').forEach((a) => {
    if (a.dataset.nav === state.panel) a.setAttribute('aria-current', 'page');
    else a.removeAttribute('aria-current');
  });
}

// ============================================================
//  Overview
// ============================================================
function renderOverview() {
  $('#hero-chips').innerHTML = (t('hero.chips') || []).map((c) => `<li>${esc(c)}</li>`).join('');
  const work = t('career.experience') || [];
  const current = work[0];
  const tiles = [
    {
      id: 'projects',
      text: tf('tiles.projects', { n: PROJECTS.length }),
      extra: `<span class="tile-meter" aria-hidden="true">${PROJECTS.map((p) => `<i class="${STATUS_CLASS[p.status]}"></i>`).join('')}</span>`,
    },
    {
      id: 'certificates',
      text: tf('tiles.certificates', { n: CERTIFICATES.length }),
      extra: `<span class="tile-orbit" aria-hidden="true">${CERTIFICATES.map((_, i) => `<i style="--i:${i};--n:${CERTIFICATES.length}"></i>`).join('')}</span>`,
    },
    {
      id: 'career',
      text: current ? `${t('tiles.career')}: ${current.role}, ${current.org}` : '',
      extra: '',
    },
    {
      id: 'about',
      text: t('tiles.about'),
      extra: SITE.photo ? `<img class="tile-photo" src="${esc(SITE.photo)}" alt="" loading="lazy" decoding="async" />` : '',
    },
    { id: 'contact', text: t('tiles.contact'), extra: '' },
  ];
  $('#tiles').innerHTML = tiles
    .map(
      (x) => `
      <a class="tile tile-${x.id}" href="#/${x.id}">
        <span class="tile-top">${ICONS[x.id]}${x.extra}</span>
        <strong>${esc(t(`nav.${x.id}`))}</strong>
        <span class="tile-text">${esc(x.text)}</span>
      </a>`
    )
    .join('');
  $('#tiles').setAttribute('aria-label', t('ui.menu'));
}

// ============================================================
//  About
// ============================================================
function renderAbout() {
  const img = $('#portrait');
  img.alt = SITE.name;
  if (SITE.photo && !img.getAttribute('src')) img.src = SITE.photo;
  $('#about-paragraphs').innerHTML = (t('about.paragraphs') || []).map((p) => `<p>${esc(p)}</p>`).join('');
  $('#about-facts').innerHTML = (t('about.facts') || [])
    .map((f) => `<div><dt>${esc(f.k)}</dt><dd>${esc(f.v)}</dd></div>`)
    .join('');
  $('#about-skills').innerHTML = (t('about.skills') || [])
    .map(
      (g) => `
      <div class="skill">
        <h4>${esc(g.name)}</h4>
        <ul class="chips chips-sm">${g.items.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>
      </div>`
    )
    .join('');
}

// ============================================================
//  Career: list on one side, details on the other (inline on phones)
// ============================================================
function careerItems() {
  const work = (t('career.experience') || []).map((x, i) => ({ key: `w${i}`, title: x.role, org: x.org, period: x.period, bullets: x.bullets }));
  const edu = (t('career.education') || []).map((x, i) => ({
    key: `e${i}`,
    title: x.degree,
    org: x.school,
    period: x.period,
    bullets: x.note,
    status: x.status,
  }));
  return { work, edu };
}

const careerDetail = (it) => `
  <p class="cd-period">${esc(fmtPeriod(it.period))}${it.status ? ` ${statusPill(it.status)}` : ''}</p>
  <h3>${esc(it.title)}</h3>
  <p class="cd-org">${esc(it.org)}</p>
  ${ticks(it.bullets)}`;

function renderCareer() {
  const { work, edu } = careerItems();
  const all = [...work, ...edu];
  if (!all.some((x) => x.key === state.career)) state.career = 'w0';
  const row = (it) => {
    const on = it.key === state.career;
    return `
      <div class="cl-item ${on ? 'is-on' : ''}" role="listitem">
        <button type="button" class="cl-row" data-career="${it.key}" aria-expanded="${on}">
          <span class="cl-period">${esc(fmtPeriod(it.period))}</span>
          <span class="cl-title">${esc(it.title)}</span>
          <span class="cl-org">${esc(it.org)}</span>
        </button>
        <div class="cl-inline">${on ? careerDetail(it) : ''}</div>
      </div>`;
  };
  $('#career-list').innerHTML = `
    <h3 class="cl-head">${esc(t('career.workTitle'))}</h3>
    ${work.map(row).join('')}
    <h3 class="cl-head">${esc(t('career.eduTitle'))}</h3>
    ${edu.map(row).join('')}`;
  const sel = all.find((x) => x.key === state.career);
  $('#career-detail').innerHTML = sel ? careerDetail(sel) : '';
}

// ============================================================
//  Projects
// ============================================================
function renderProjectFilters() {
  $('#project-filters').innerHTML = PROJECT_FILTERS.map(
    (f) =>
      `<button type="button" class="chip-btn" data-pfilter="${f}" aria-pressed="${f === state.projectFilter}">${esc(t(`projects.filters.${f}`))}</button>`
  ).join('');
}

function renderProjects() {
  renderProjectFilters();
  $('#projects-grid').innerHTML = visibleProjects()
    .map((p) => {
      const tx = projectText(p.id);
      const cover = coverFor(p);
      const media = mediaFor(p);
      const videos = media.filter((m) => m.type !== 'image').length;
      return `
      <a class="pcard" href="#/projects/${esc(p.id)}" data-cat="${esc(p.cat)}">
        <span class="pcard-media">
          ${cover ? `<img src="${esc(cover)}" alt="" loading="lazy" decoding="async" />` : projectArt(p)}
          ${media.length ? `<span class="pcard-count">${videos ? ICONS.play : ''}${num(media.length)}</span>` : ''}
        </span>
        <span class="pcard-body">
          <span class="pcard-meta">${statusPill(p.status)}${p.year ? `<span>${esc(p.year)}</span>` : ''}</span>
          <strong>${esc(tx.title)}</strong>
          <span class="pcard-sum">${esc(tx.summary)}</span>
        </span>
      </a>`;
    })
    .join('');
}

function galleryHTML(items, title) {
  if (!items.length) return '';
  const slide = (m, i) => {
    if (m.type === 'image')
      return `<img src="${esc(m.src)}" alt="${esc(title)} ${i + 1}" decoding="async" ${i ? 'loading="lazy"' : ''} />`;
    if (m.type === 'video')
      return `<video src="${esc(m.src)}#t=0.1" controls playsinline preload="metadata"></video>`;
    if (m.type === 'youtube')
      return `<iframe src="https://www.youtube-nocookie.com/embed/${esc(m.id)}" title="${esc(title)}" loading="lazy" allow="encrypted-media; picture-in-picture; fullscreen" allowfullscreen></iframe>`;
    return '';
  };
  const multi = items.length > 1;
  return `
    <div class="gallery" data-count="${items.length}">
      <div class="g-main">
        ${items.map((m, i) => `<div class="g-slide" data-slide="${i}" ${i ? 'hidden' : ''}>${slide(m, i)}</div>`).join('')}
        ${
          multi
            ? `<button type="button" class="icon-btn g-nav g-prev" data-gnav="-1">${ICONS.prev}<span class="sr">${esc(t('ui.prev'))}</span></button>
               <button type="button" class="icon-btn g-nav g-next" data-gnav="1">${ICONS.next}<span class="sr">${esc(t('ui.next'))}</span></button>`
            : ''
        }
      </div>
      ${
        multi
          ? `<div class="g-thumbs">${items
              .map(
                (m, i) =>
                  `<button type="button" class="g-thumb" data-gthumb="${i}" aria-pressed="${i === 0}" aria-label="${i + 1} ${esc(t('ui.of'))} ${items.length}">${
                    m.type === 'image' ? `<img src="${esc(m.src)}" alt="" loading="lazy" />` : `<span class="g-thumb-play">${ICONS.play}</span>`
                  }</button>`
              )
              .join('')}</div>`
          : ''
      }
    </div>`;
}

function wireGallery(root) {
  const g = $('.gallery', root);
  if (!g) return;
  const slides = $$('.g-slide', g);
  let i = 0;
  const show = (n) => {
    const next = (n + slides.length) % slides.length;
    if (next === i) return;
    slides[i].querySelector('video')?.pause();
    slides[i].hidden = true;
    slides[next].hidden = false;
    $$('.g-thumb', g).forEach((b, k) => b.setAttribute('aria-pressed', String(k === next)));
    i = next;
  };
  g.addEventListener('click', (e) => {
    const nav = e.target.closest('[data-gnav]');
    const th = e.target.closest('[data-gthumb]');
    if (nav) show(i + Number(nav.dataset.gnav));
    else if (th) show(Number(th.dataset.gthumb));
  });
  // swipe between photos
  const main = $('.g-main', g);
  let sx = null;
  main.addEventListener('pointerdown', (e) => {
    if (e.target.closest('video, iframe, button')) return;
    sx = e.clientX;
  });
  main.addEventListener('pointerup', (e) => {
    if (sx == null) return;
    const dx = e.clientX - sx;
    sx = null;
    if (Math.abs(dx) > 48 && slides.length > 1) show(i + (dx < 0 ? 1 : -1) * (document.documentElement.dir === 'rtl' ? -1 : 1));
  });
  root.addEventListener('keydown', (e) => {
    if (e.target.closest('video, iframe') || slides.length < 2) return;
    if (e.key === 'ArrowRight') show(i + 1);
    if (e.key === 'ArrowLeft') show(i - 1);
  });
}

function openProject(id) {
  const p = PROJECTS.find((x) => x.id === id);
  if (!p) return false;
  const tx = projectText(id);
  const media = mediaFor(p);
  const from = state.trigger?.closest?.('.pcard') || $(`.pcard[href="#/projects/${CSS.escape(id)}"]`);
  const links = (p.links || [])
    .map((l) => `<a class="btn btn-line" href="${esc(l.url)}" target="_blank" rel="noopener noreferrer">${esc(l.label)} ${ICONS.external}</a>`)
    .join('');
  const html = `
    <header class="ps-head">
      <p class="ps-meta">${statusPill(p.status)}<span>${esc(t(`projects.filters.${p.cat}`))}</span>${p.year ? `<span>${esc(p.year)}</span>` : ''}</p>
      <h2 id="sheet-title">${esc(tx.title)}</h2>
      <p class="ps-sum">${esc(tx.summary)}</p>
    </header>
    ${
      media.length
        ? galleryHTML(media, tx.title)
        : `<div class="gallery-empty">${projectArt(p)}<p>${esc(t('ui.noMedia'))}</p></div>`
    }
    <div class="ps-cols">
      <section>
        <h3>${esc(t('ui.workDone'))}</h3>
        ${ticks(tx.work)}
      </section>
      <section>
        <ul class="chips chips-sm">${(p.tags || []).map((x) => `<li>${esc(x)}</li>`).join('')}</ul>
        ${links ? `<div class="actions">${links}</div>` : ''}
      </section>
    </div>`;
  const root = openSheet(html, { from, kind: 'project', onClose: () => leaveSub('projects') });
  wireGallery(root);
  return true;
}

// ============================================================
//  Certificates
// ============================================================
let ring = null;

function certFace(c, { large = false } = {}) {
  const tx = certText(c);
  const files = certFiles(c.id);
  if (files.image)
    return `<span class="cert-scan"><img src="${esc(files.image)}" alt="${esc(tx.title)}" ${large ? '' : 'loading="lazy"'} decoding="async" draggable="false" /></span>`;
  return `
    <span class="cert-face">
      ${rosette(c.id)}
      <span class="cert-issuer">${esc(issuerName(c))}</span>
      <span class="cert-code">${esc(c.code)}</span>
      <span class="cert-title">${esc(tx.title)}</span>
      <span class="cert-year">${esc(c.year)}</span>
    </span>`;
}

const certCard = (c) => `${certFace(c)}<span class="card-back" aria-hidden="true">${rosette(`${c.id}-b`, { r: 40, loops: 4 })}</span>`;

function renderCertInfo(c) {
  if (!c) return;
  const tx = certText(c);
  $('#ring-info').innerHTML = `
    <strong>${esc(tx.title)}</strong>
    <span>${esc(issuerName(c))}, ${esc(c.year)}</span>
    <a class="btn btn-solid btn-sm" href="#/certificates/${esc(c.id)}">${esc(t('ui.viewCertificate'))}</a>`;
}

function renderCertFilters() {
  $('#cert-filters').innerHTML = CERT_FILTERS.map(
    (f) =>
      `<button type="button" class="chip-btn" data-cfilter="${f}" aria-pressed="${f === state.certFilter}">${esc(t(`certificates.filters.${f}`))}</button>`
  ).join('');
}

function renderCertificates() {
  renderCertFilters();
  ring.setItems(visibleCerts(), certCard);
  $('#ring').setAttribute('aria-label', t('certificates.title'));
}

function openCert(id) {
  const list = visibleCerts();
  let c = list.find((x) => x.id === id);
  if (!c) {
    c = CERTIFICATES.find((x) => x.id === id);
    if (!c) return false;
    state.certFilter = 'all';
    renderCertificates();
  }
  ring.focusId(id);
  const tx = certText(c);
  const files = certFiles(c.id);
  const from = state.trigger?.closest?.('.card, .btn') || $(`#ring-card-${CSS.escape(id)}`);
  const buttons = [
    files.pdf ? `<a class="btn btn-solid" href="${esc(files.pdf)}" target="_blank" rel="noopener">${ICONS.file}${esc(t('ui.openPdf'))}</a>` : '',
    c.verify ? `<a class="btn btn-line" href="${esc(c.verify)}" target="_blank" rel="noopener noreferrer">${esc(t('ui.verify'))} ${ICONS.external}</a>` : '',
  ].join('');
  const pos = visibleCerts().findIndex((x) => x.id === id);
  const all = visibleCerts();
  const html = `
    <div class="cv">
      <div class="cv-doc">${certFace(c, { large: true })}</div>
      <div class="cv-info">
        <p class="cv-pos">${num(pos + 1)} ${esc(t('ui.of'))} ${num(all.length)}</p>
        <h2 id="sheet-title">${esc(tx.title)}</h2>
        <dl class="facts">
          <div><dt>${esc(t('ui.issued'))}</dt><dd>${esc(issuerName(c))}, ${esc(c.year)}</dd></div>
          ${tx.detail ? `<div><dt>${esc(c.code)}</dt><dd>${esc(tx.detail)}</dd></div>` : ''}
        </dl>
        ${files.image ? '' : `<p class="muted">${esc(t('ui.noScan'))}</p>`}
        ${buttons ? `<div class="actions">${buttons}</div>` : ''}
        <div class="cv-nav">
          <a class="icon-btn" href="#/certificates/${esc(all[(pos - 1 + all.length) % all.length].id)}">${ICONS.prev}<span class="sr">${esc(t('ui.prev'))}</span></a>
          <a class="icon-btn" href="#/certificates/${esc(all[(pos + 1) % all.length].id)}">${ICONS.next}<span class="sr">${esc(t('ui.next'))}</span></a>
        </div>
      </div>
    </div>`;
  openSheet(html, { from, kind: 'cert', onClose: () => leaveSub('certificates') });
  return true;
}

// ============================================================
//  Contact and imprint
// ============================================================
function renderContact() {
  const mail = $('#contact-mail');
  mail.href = `mailto:${SITE.email}`;
  mail.textContent = SITE.email;
  const links = [];
  if (SITE.phone) links.push(`<a class="btn btn-line" href="tel:${esc(SITE.phone.replace(/\s/g, ''))}">${esc(SITE.phone)}</a>`);
  if (SITE.linkedin)
    links.push(`<a class="btn btn-solid" href="${esc(SITE.linkedin)}" target="_blank" rel="noopener noreferrer">${esc(t('contact.linkedin'))}</a>`);
  if (SITE.github)
    links.push(`<a class="btn btn-line" href="${esc(SITE.github)}" target="_blank" rel="noopener noreferrer">${esc(t('contact.github'))}</a>`);
  $('#contact-links').innerHTML = links.join('');
}

function openLegal() {
  const lines = [IMPRINT.name, IMPRINT.street, IMPRINT.city, IMPRINT.country].filter(Boolean).map(esc).join('<br />');
  const html = `
    <h2 id="sheet-title">${esc(t('legal.title'))}</h2>
    <section class="legal">
      <h3>${esc(t('legal.imprintTitle'))}</h3>
      <p class="muted">${esc(t('legal.imprintLaw'))}</p>
      <p>${lines}<br /><a href="mailto:${esc(IMPRINT.email)}">${esc(IMPRINT.email)}</a></p>
    </section>
    <section class="legal">
      <h3>${esc(t('legal.privacyTitle'))}</h3>
      ${(t('legal.privacy') || []).map((p) => `<p>${esc(p)}</p>`).join('')}
    </section>`;
  openSheet(html, { from: state.trigger?.closest?.('a') || $('#legal-link'), kind: 'legal', onClose: () => leaveSub(state.panel) });
}

// ============================================================
//  Router: #/projects, #/projects/<id>, #/certificates/<id>, #/legal …
// ============================================================
let lastRoute = '';

function parseHash() {
  const [a = '', b = ''] = location.hash.replace(/^#\/?/, '').split('/').map(decodeURIComponent);
  return { a, b };
}

/** Called when a sheet closes: go back to the panel's own address. */
function leaveSub(panel) {
  const base = `#/${panel === 'overview' ? '' : panel}`;
  const { b, a } = parseHash();
  if (!b && a !== 'legal') return;
  if (leaveSub.canGoBack) history.back();
  else history.replaceState(null, '', base);
  leaveSub.canGoBack = false;
}

function showPanel(name) {
  if (state.panel === name) return;
  const prev = state.panel;
  state.panel = name;
  $$('[data-panel]').forEach((p) => {
    const on = p.dataset.panel === name;
    p.hidden = !on;
    if (on && prev && !reduceMotion.matches) {
      // grow out of the tile / tab that was clicked
      const r = state.trigger?.getBoundingClientRect?.();
      const s = $('#stage').getBoundingClientRect();
      p.style.setProperty('--ox', r ? `${Math.round(r.left + r.width / 2 - s.left)}px` : '50%');
      p.style.setProperty('--oy', r ? `${Math.round(r.top + r.height / 2 - s.top)}px` : '0px');
      p.classList.add('enter');
      void p.offsetWidth;
      requestAnimationFrame(() => p.classList.remove('enter'));
    }
  });
  markNav();
  ring?.setActive(name === 'certificates');
  if (prev && window.innerWidth < MOBILE_BREAKPOINT) window.scrollTo({ top: 0, behavior: 'instant' });
  $('#stage').scrollTop = 0;
}

function route() {
  let { a, b } = parseHash();
  // Closing a sheet should return to where the visitor came from with "back",
  // unless they landed directly on the sheet's address (then we just rewrite it).
  const prev = lastRoute;
  if (b || a === 'legal') {
    const fromSameSheet = prev && prev.startsWith(`${a}/`);
    if (!fromSameSheet) leaveSub.canGoBack = route.ready && (a === 'legal' || prev === a);
  }
  lastRoute = b ? `${a}/${b}` : a;
  route.ready = true;

  if (a === 'legal') {
    showPanel(state.panel || 'overview');
    openLegal();
    return;
  }
  if (!PANELS.includes(a)) a = 'overview';
  showPanel(a);

  let opened = false;
  if (a === 'projects' && b) opened = openProject(b);
  if (a === 'certificates' && b) opened = openCert(b);
  if (!opened && sheetIsOpen()) closeSheet({ silent: true });
  state.trigger = null;
}

// ============================================================
//  Events
// ============================================================
function initEvents() {
  // remember what was clicked, so motion can start from there
  document.addEventListener('pointerdown', (e) => (state.trigger = e.target.closest('a, button, .card') || null), true);
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') state.trigger = document.activeElement;
  }, true);

  $$('#lang button').forEach((b) => b.addEventListener('click', () => setLang(b.dataset.lang, { persist: true })));

  $('#project-filters').addEventListener('click', (e) => {
    const b = e.target.closest('[data-pfilter]');
    if (!b) return;
    state.projectFilter = b.dataset.pfilter;
    renderProjects();
  });
  $('#cert-filters').addEventListener('click', (e) => {
    const b = e.target.closest('[data-cfilter]');
    if (!b) return;
    state.certFilter = b.dataset.cfilter;
    renderCertificates();
  });
  $('#career-list').addEventListener('click', (e) => {
    const b = e.target.closest('[data-career]');
    if (!b) return;
    state.career = b.dataset.career;
    renderCareer();
    $(`[data-career="${state.career}"]`)?.focus({ preventScroll: true });
  });
  // browsing certificates inside the viewer replaces the address (one "back" closes it)
  $('#sheet').addEventListener('click', (e) => {
    const a = e.target.closest('.cv-nav a');
    if (!a) return;
    e.preventDefault();
    location.replace(a.getAttribute('href'));
  });
  $('#ring-prev').addEventListener('click', () => ring.prev());
  $('#ring-next').addEventListener('click', () => ring.next());

  window.addEventListener('hashchange', route);
}

// ============================================================
//  Boot
// ============================================================
function renderAll() {
  renderNav();
  renderOverview();
  renderAbout();
  renderCareer();
  renderProjects();
  renderCertificates();
  renderContact();
  refreshThemeMenu();
  // re-open a sheet in the new language
  if (sheetIsOpen()) {
    const { a, b } = parseHash();
    if (a === 'legal') openLegal();
    else if (a === 'projects' && b) openProject(b);
    else if (a === 'certificates' && b) openCert(b);
  }
}

document.documentElement.classList.add('js');
$('#year').textContent = new Date().getFullYear();
initTheme();
ring = createRing({
  stage: $('#ring-stage'),
  ring: $('#ring'),
  onFrontChange: (c) => renderCertInfo(c),
  onOpen: (c) => {
    location.hash = `#/certificates/${c.id}`;
  },
});
initEvents();
onLangChange(renderAll);
initI18n();
route();
initViewer($('#scene'), $('#viewer'));
