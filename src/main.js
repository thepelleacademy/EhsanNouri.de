import '@fontsource-variable/archivo/wdth.css';
import '@fontsource-variable/vazirmatn';
import './styles.css';

import { C, asset, isPreview } from './content.js';
import { initI18n, setLang, getLang, onLangChange, t, L, fill, num, applyStaticTexts } from './i18n.js';
import { initTheme, refreshThemeMenu } from './theme.js';
import { initViewer } from './scene.js';
import { createRing } from './ring.js';
import { openSheet, closeSheet, sheetIsOpen } from './sheet.js';
import { mediaFor, coverFor, certFiles } from './media.js';
import { projectArt, rosette } from './art.js';
import { ICONS, icon } from './icons.js';
import { md } from './md.js';
import { MOBILE_BREAKPOINT, DOCK_MAX_ITEMS, TILE_MAX_COLUMNS, NAV_MENU_CLOSE_DELAY_MS } from './config.js';

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
const esc = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

// ---------- built-in sections (panels in index.html) ----------
const SECTIONS = ['overview', 'about', 'career', 'projects', 'certificates', 'contact'];
const STATUS_CLASS = { completed: 's-done', in_progress: 's-active', prototype: 's-proto' };
const FILTER_PARAM = { projects: 'cat', certificates: 'group' };

const state = {
  panel: null,
  page: null, // id of the custom page shown in the "page" panel
  projectFilter: 'all',
  certFilter: 'all',
  career: 'w0',
  trigger: null, // last clicked element: panels and sheets grow out of it
};

// ---------- content accessors ----------
const PROJECTS = () => (C.projects.items || []).filter((p) => p.visible !== false);
const CERTIFICATES = () => (C.certificates.items || []).filter((x) => x.visible !== false);
const PAGES = () => (C.pages.items || []).filter((p) => p.visible !== false);
const navItems = () => (C.nav.items || []).filter((i) => i.visible !== false && targetExists(i));
const navChildren = (item) => (item.children || []).filter((i) => i.visible !== false && targetExists(i));

function targetExists(item) {
  switch (item.type) {
    case 'section':
      return SECTIONS.includes(item.target);
    case 'page':
      return PAGES().some((p) => p.id === item.target);
    case 'project':
      return PROJECTS().some((p) => p.id === item.target);
    case 'certificate':
      return CERTIFICATES().some((x) => x.id === item.target);
    case 'url':
      return !!item.href;
    default:
      return false;
  }
}

// ---------- small helpers ----------
const statusLabel = (s) => t(`ui.statusLabel.${s}`) || s;
const fmtPeriod = ([from, to] = []) => `${from || ''} – ${to === 'now' ? t('ui.now') : to || ''}`;
const ticks = (items) => `<ul class="ticks">${(items || []).map((x) => `<li>${esc(x)}</li>`).join('')}</ul>`;
const issuerName = (x) => L(C.certificates.issuers?.find((i) => i.id === x.issuer)?.name) || x.issuer;
const catLabel = (id) => L(C.projects.categories?.find((x) => x.id === id)?.label) || id;
const groupLabel = (id) => L(C.certificates.groups?.find((x) => x.id === id)?.label) || id;
const statusPill = (s) => `<span class="status ${STATUS_CLASS[s] || ''}">${esc(statusLabel(s))}</span>`;
const visibleProjects = () => PROJECTS().filter((p) => state.projectFilter === 'all' || p.cat === state.projectFilter);
const visibleCerts = () => CERTIFICATES().filter((x) => state.certFilter === 'all' || x.group === state.certFilter);
const cvLink = (cls = 'btn btn-line') =>
  C.site.cv?.enabled && C.site.cv?.file
    ? `<a class="${cls}" href="${esc(asset(C.site.cv.file))}" target="_blank" rel="noopener" download>${ICONS.download}${esc(L(C.site.cv.label) || 'CV')}</a>`
    : '';

// ============================================================
//  Navigation: menu, sub menus, mobile tab bar, full menu sheet
// ============================================================
function navHref(item) {
  switch (item.type) {
    case 'section': {
      const base = `#/${item.target === 'overview' ? '' : item.target}`;
      const p = FILTER_PARAM[item.target];
      return item.filter && p ? `${base}?${p}=${encodeURIComponent(item.filter)}` : base;
    }
    case 'page':
      return `#/page/${encodeURIComponent(item.target)}`;
    case 'project':
      return `#/projects/${encodeURIComponent(item.target)}`;
    case 'certificate':
      return `#/certificates/${encodeURIComponent(item.target)}`;
    case 'url':
      return item.href;
    default:
      return '#/';
  }
}

/** Is this menu item the place we are now? */
function isCurrent(item) {
  if (item.type === 'section') {
    if (item.target !== state.panel) return false;
    if (!item.filter) return true;
    const f = item.target === 'projects' ? state.projectFilter : item.target === 'certificates' ? state.certFilter : null;
    return f === item.filter;
  }
  if (item.type === 'page') return state.panel === 'page' && state.page === item.target;
  return false;
}

const linkAttrs = (item) =>
  item.type === 'url' && item.newTab !== false ? ' target="_blank" rel="noopener noreferrer"' : '';

function navLink(item, cls = '') {
  return `<a class="${cls}" href="${esc(navHref(item))}"${linkAttrs(item)} data-navid="${esc(item.id)}">${esc(L(item.label))}${
    item.type === 'url' ? ICONS.external : ''
  }</a>`;
}

function renderNav() {
  const items = navItems();
  // desktop: tabs with drop-down sub menus
  $('#tabs').innerHTML = items
    .map((item) => {
      const kids = navChildren(item);
      if (!kids.length) return `<div class="tab">${navLink(item)}</div>`;
      return `
        <div class="tab has-menu">
          ${navLink(item)}
          <button type="button" class="tab-caret" aria-expanded="false" aria-label="${esc(L(item.label))}">${ICONS.chevron}</button>
          <div class="tab-menu">${kids.map((k) => navLink(k)).join('')}</div>
        </div>`;
    })
    .join('');
  // mobile: tab bar with the first items marked "dock"
  $('#dock').innerHTML = items
    .filter((i) => i.dock !== false)
    .slice(0, DOCK_MAX_ITEMS)
    .map((i) => `<a href="${esc(navHref(i))}"${linkAttrs(i)} data-navid="${esc(i.id)}">${icon(i.icon)}<span>${esc(L(i.label))}</span></a>`)
    .join('');
  markNav();
  $$('#lang button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.lang === getLang())));
  $('#tabs').setAttribute('aria-label', t('ui.menu'));
  $('#dock').setAttribute('aria-label', t('ui.menu'));
  $('#lang').setAttribute('aria-label', t('ui.language'));
}

function allNavFlat() {
  return navItems().flatMap((i) => [i, ...navChildren(i)]);
}

function markNav() {
  const byId = Object.fromEntries(allNavFlat().map((i) => [i.id, i]));
  const parentOf = {};
  navItems().forEach((p) => navChildren(p).forEach((k) => (parentOf[k.id] = p.id)));
  const current = new Set();
  for (const i of allNavFlat()) {
    if (!isCurrent(i)) continue;
    current.add(i.id);
    if (parentOf[i.id]) current.add(parentOf[i.id]);
  }
  // a parent section is current while one of its children (filters) is current
  $$('[data-navid]').forEach((a) => {
    const item = byId[a.dataset.navid];
    const on = current.has(a.dataset.navid) || (item?.type === 'section' && !item.filter && item.target === state.panel);
    if (on) a.setAttribute('aria-current', 'page');
    else a.removeAttribute('aria-current');
  });
}

/** Full menu as a sheet (phones and tablets). */
function openMenu() {
  const html = `
    <h2 id="sheet-title" class="menu-title">${esc(t('ui.menu'))}</h2>
    <nav class="menu-list">
      ${navItems()
        .map(
          (i) => `
        <div class="menu-group">
          <a class="menu-main" href="${esc(navHref(i))}"${linkAttrs(i)} data-navid="${esc(i.id)}">${icon(i.icon)}<span>${esc(L(i.label))}</span></a>
          ${navChildren(i)
            .map((k) => `<a class="menu-sub" href="${esc(navHref(k))}"${linkAttrs(k)} data-navid="${esc(k.id)}">${esc(L(k.label))}</a>`)
            .join('')}
        </div>`
        )
        .join('')}
    </nav>
    ${cvLink('btn btn-line menu-cv')}`;
  openSheet(html, { from: $('#menu-btn'), kind: 'menu' });
  markNav();
}

function initNavMenus() {
  const tabs = $('#tabs');
  let closeTimer = null;
  const closeAll = (except) =>
    $$('.tab.has-menu.open', tabs).forEach((g) => {
      if (g === except) return;
      g.classList.remove('open');
      $('.tab-caret', g).setAttribute('aria-expanded', 'false');
    });
  const open = (g) => {
    clearTimeout(closeTimer);
    closeAll(g);
    g.classList.add('open');
    $('.tab-caret', g).setAttribute('aria-expanded', 'true');
  };
  tabs.addEventListener('click', (e) => {
    const caret = e.target.closest('.tab-caret');
    if (caret) {
      const g = caret.closest('.tab');
      g.classList.contains('open') ? closeAll() : open(g);
      return;
    }
    if (e.target.closest('a')) closeAll();
  });
  tabs.addEventListener('pointerover', (e) => {
    if (e.pointerType !== 'mouse') return;
    const g = e.target.closest('.tab.has-menu');
    if (g) open(g);
  });
  tabs.addEventListener('pointerout', (e) => {
    if (e.pointerType !== 'mouse') return;
    const g = e.target.closest('.tab.has-menu');
    if (!g || g.contains(e.relatedTarget)) return;
    clearTimeout(closeTimer);
    closeTimer = setTimeout(() => closeAll(), NAV_MENU_CLOSE_DELAY_MS);
  });
  tabs.addEventListener('focusout', (e) => {
    if (!tabs.contains(e.relatedTarget)) closeAll();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeAll();
  });
  document.addEventListener('pointerdown', (e) => {
    if (!e.target.closest('#tabs')) closeAll();
  });
  $('#menu-btn').addEventListener('click', openMenu);
}

// ============================================================
//  Overview
// ============================================================
function tileExtra(item) {
  if (item.type !== 'section') return '';
  const P = PROJECTS();
  const X = CERTIFICATES();
  switch (item.target) {
    case 'projects':
      return `<span class="tile-meter" aria-hidden="true">${P.map((p) => `<i class="${STATUS_CLASS[p.status] || ''}"></i>`).join('')}</span>`;
    case 'certificates':
      return `<span class="tile-orbit" aria-hidden="true">${X.map((_, i) => `<i style="--i:${i};--n:${X.length}"></i>`).join('')}</span>`;
    case 'about':
      return C.site.photo ? `<img class="tile-photo" src="${esc(asset(C.site.photo))}" alt="" loading="lazy" decoding="async" />` : '';
    default:
      return '';
  }
}

function tileText(item) {
  const own = L(item.tileText) || '';
  if (item.type === 'section' && item.target === 'career') {
    const now = (C.career.experience || [])[0];
    return now ? `${own ? `${own}: ` : ''}${L(now.role)}, ${L(now.org)}` : own;
  }
  if (item.type === 'page' && !own) return L(PAGES().find((p) => p.id === item.target)?.summary) || '';
  return fill(own, { n: item.target === 'projects' ? PROJECTS().length : item.target === 'certificates' ? CERTIFICATES().length : 0 });
}

function renderOverview() {
  $('#hero-chips').innerHTML = (L(C.home.chips) || []).map((x) => `<li>${esc(x)}</li>`).join('');
  $('#hero-actions').innerHTML = [
    L(C.home.ctaProjects) ? `<a class="btn btn-solid" href="#/projects">${esc(L(C.home.ctaProjects))}</a>` : '',
    L(C.home.ctaContact) ? `<a class="btn btn-line" href="#/contact">${esc(L(C.home.ctaContact))}</a>` : '',
    cvLink(),
  ].join('');
  const tiles = navItems().filter((i) => i.tile !== false && !(i.type === 'section' && i.target === 'overview'));
  $('#tiles').style.setProperty('--tile-cols', String(Math.max(1, Math.min(tiles.length, TILE_MAX_COLUMNS))));
  $('#tiles').innerHTML = tiles
    .map(
      (x) => `
      <a class="tile tile-${esc(x.type === 'section' ? x.target : x.type)}" href="${esc(navHref(x))}"${linkAttrs(x)}>
        <span class="tile-top">${icon(x.icon)}${tileExtra(x)}</span>
        <strong>${esc(L(x.label))}</strong>
        <span class="tile-text">${esc(tileText(x))}</span>
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
  img.alt = L(C.home.name) || C.site.name;
  const src = asset(C.site.photo);
  if (src && img.getAttribute('src') !== src) img.src = src;
  img.closest('.portrait').hidden = !src;
  $('#about-paragraphs').innerHTML = (L(C.about.paragraphs) || []).map((p) => `<p>${esc(p)}</p>`).join('') + (cvLink() ? `<div class="actions">${cvLink()}</div>` : '');
  $('#about-facts').innerHTML = (C.about.facts || [])
    .filter((f) => L(f.v))
    .map((f) => `<div><dt>${esc(L(f.k))}</dt><dd>${esc(L(f.v))}</dd></div>`)
    .join('');
  $('#about-skills').innerHTML = (C.about.skills || [])
    .map(
      (g) => `
      <div class="skill">
        <h4>${esc(L(g.name))}</h4>
        <ul class="chips chips-sm">${(L(g.items) || []).map((x) => `<li>${esc(x)}</li>`).join('')}</ul>
      </div>`
    )
    .join('');
}

// ============================================================
//  Career: list on one side, details on the other (inline on phones)
// ============================================================
function careerItems() {
  const work = (C.career.experience || []).map((x, i) => ({ key: `w${i}`, title: L(x.role), org: L(x.org), period: x.period, bullets: L(x.bullets) }));
  const edu = (C.career.education || []).map((x, i) => ({
    key: `e${i}`,
    title: L(x.degree),
    org: L(x.school),
    period: x.period,
    bullets: L(x.note),
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
  if (!all.some((x) => x.key === state.career)) state.career = all[0]?.key || 'w0';
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
    ${work.length ? `<h3 class="cl-head">${esc(L(C.career.workTitle))}</h3>${work.map(row).join('')}` : ''}
    ${edu.length ? `<h3 class="cl-head">${esc(L(C.career.eduTitle))}</h3>${edu.map(row).join('')}` : ''}`;
  const sel = all.find((x) => x.key === state.career);
  $('#career-detail').innerHTML = sel ? careerDetail(sel) : '';
}

// ============================================================
//  Projects
// ============================================================
function renderProjectFilters() {
  const used = new Set(PROJECTS().map((p) => p.cat));
  const cats = (C.projects.categories || []).filter((x) => used.has(x.id));
  if (state.projectFilter !== 'all' && !cats.some((x) => x.id === state.projectFilter)) state.projectFilter = 'all';
  $('#project-filters').innerHTML = [{ id: 'all', label: C.projects.allLabel }, ...cats]
    .map(
      (f) =>
        `<button type="button" class="chip-btn" data-pfilter="${esc(f.id)}" aria-pressed="${f.id === state.projectFilter}">${esc(L(f.label) || f.id)}</button>`
    )
    .join('');
}

function renderProjects() {
  renderProjectFilters();
  $('#projects-grid').innerHTML = visibleProjects()
    .map((p) => {
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
          <strong>${esc(L(p.title) || p.id)}</strong>
          <span class="pcard-sum">${esc(L(p.summary))}</span>
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
  const p = PROJECTS().find((x) => x.id === id);
  if (!p) return false;
  const title = L(p.title) || p.id;
  const media = mediaFor(p);
  const from = state.trigger?.closest?.('.pcard') || $(`.pcard[href="#/projects/${CSS.escape(id)}"]`);
  const links = (p.links || [])
    .filter((l) => l.url)
    .map((l) => `<a class="btn btn-line" href="${esc(l.url)}" target="_blank" rel="noopener noreferrer">${esc(L(l.label) || l.url)} ${ICONS.external}</a>`)
    .join('');
  const html = `
    <header class="ps-head">
      <p class="ps-meta">${statusPill(p.status)}<span>${esc(catLabel(p.cat))}</span>${p.year ? `<span>${esc(p.year)}</span>` : ''}</p>
      <h2 id="sheet-title">${esc(title)}</h2>
      <p class="ps-sum">${esc(L(p.summary))}</p>
    </header>
    ${
      media.length
        ? galleryHTML(media, title)
        : `<div class="gallery-empty">${projectArt(p)}<p>${esc(t('ui.noMedia'))}</p></div>`
    }
    <div class="ps-cols">
      <section>
        <h3>${esc(t('ui.workDone'))}</h3>
        ${ticks(L(p.work))}
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

function certFace(x, { large = false } = {}) {
  const title = L(x.title) || x.code;
  const files = certFiles(x.id);
  if (files.image)
    return `<span class="cert-scan"><img src="${esc(files.image)}" alt="${esc(title)}" ${large ? '' : 'loading="lazy"'} decoding="async" draggable="false" /></span>`;
  return `
    <span class="cert-face">
      ${rosette(x.id)}
      <span class="cert-issuer">${esc(issuerName(x))}</span>
      <span class="cert-code">${esc(x.code)}</span>
      <span class="cert-title">${esc(title)}</span>
      <span class="cert-year">${esc(x.year)}</span>
    </span>`;
}

const certCard = (x) => `${certFace(x)}<span class="card-back" aria-hidden="true">${rosette(`${x.id}-b`, { r: 40, loops: 4 })}</span>`;

function renderCertInfo(x) {
  if (!x) {
    $('#ring-info').innerHTML = '';
    return;
  }
  $('#ring-info').innerHTML = `
    <strong>${esc(L(x.title) || x.code)}</strong>
    <span>${esc(issuerName(x))}, ${esc(x.year)}</span>
    <a class="btn btn-solid btn-sm" href="#/certificates/${esc(x.id)}">${esc(t('ui.viewCertificate'))}</a>`;
}

function renderCertFilters() {
  const used = new Set(CERTIFICATES().map((x) => x.group));
  const groups = (C.certificates.groups || []).filter((g) => used.has(g.id));
  if (state.certFilter !== 'all' && !groups.some((g) => g.id === state.certFilter)) state.certFilter = 'all';
  $('#cert-filters').innerHTML = [{ id: 'all', label: C.certificates.allLabel }, ...groups]
    .map(
      (f) =>
        `<button type="button" class="chip-btn" data-cfilter="${esc(f.id)}" aria-pressed="${f.id === state.certFilter}">${esc(L(f.label) || f.id)}</button>`
    )
    .join('');
}

function renderCertificates() {
  renderCertFilters();
  ring.setItems(visibleCerts(), certCard);
  $('#ring').setAttribute('aria-label', L(C.certificates.title) || '');
}

function openCert(id) {
  let x = visibleCerts().find((y) => y.id === id);
  if (!x) {
    x = CERTIFICATES().find((y) => y.id === id);
    if (!x) return false;
    state.certFilter = 'all';
    renderCertificates();
  }
  ring.focusId(id);
  const title = L(x.title) || x.code;
  const detail = L(x.detail);
  const files = certFiles(x.id);
  const from = state.trigger?.closest?.('.card, .btn') || $(`#ring-card-${CSS.escape(id)}`);
  const buttons = [
    files.pdf ? `<a class="btn btn-solid" href="${esc(files.pdf)}" target="_blank" rel="noopener">${ICONS.file}${esc(t('ui.openPdf'))}</a>` : '',
    x.verify ? `<a class="btn btn-line" href="${esc(x.verify)}" target="_blank" rel="noopener noreferrer">${esc(t('ui.verify'))} ${ICONS.external}</a>` : '',
  ].join('');
  const all = visibleCerts();
  const pos = all.findIndex((y) => y.id === id);
  const html = `
    <div class="cv">
      <div class="cv-doc">${certFace(x, { large: true })}</div>
      <div class="cv-info">
        <p class="cv-pos">${num(pos + 1)} ${esc(t('ui.of'))} ${num(all.length)}</p>
        <h2 id="sheet-title">${esc(title)}</h2>
        <dl class="facts">
          <div><dt>${esc(t('ui.issued'))}</dt><dd>${esc(issuerName(x))}, ${esc(x.year)}</dd></div>
          ${detail ? `<div><dt>${esc(x.code)}</dt><dd>${esc(detail)}</dd></div>` : ''}
          <div><dt>${esc(L(C.certificates.title))}</dt><dd>${esc(groupLabel(x.group))}</dd></div>
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
//  Custom pages (content/pages.json)
// ============================================================
function renderPage() {
  const p = PAGES().find((x) => x.id === state.page);
  $('#page-body').innerHTML = p
    ? `<header class="panel-head"><div><h2 id="page-title">${icon(p.icon)}${esc(L(p.title))}</h2>${
        L(p.summary) ? `<p class="panel-sub">${esc(L(p.summary))}</p>` : ''
      }</div></header>
       <div class="prose">${md(L(p.body))}</div>`
    : `<h2 id="page-title">404</h2><p class="panel-sub">${esc(t('ui.page404'))}</p>`;
}

// ============================================================
//  Contact and imprint
// ============================================================
function renderContact() {
  const S = C.site;
  const mail = $('#contact-mail');
  mail.href = `mailto:${S.email}`;
  mail.textContent = S.email;
  mail.hidden = !S.email;
  const links = [];
  if (S.phone) links.push(`<a class="btn btn-line" href="tel:${esc(S.phone.replace(/\s/g, ''))}">${esc(S.phone)}</a>`);
  if (S.linkedin)
    links.push(`<a class="btn btn-solid" href="${esc(S.linkedin)}" target="_blank" rel="noopener noreferrer">${esc(L(C.contact.linkedin) || 'LinkedIn')}</a>`);
  if (S.github)
    links.push(`<a class="btn btn-line" href="${esc(S.github)}" target="_blank" rel="noopener noreferrer">${esc(L(C.contact.github) || 'GitHub')}</a>`);
  links.push(cvLink());
  $('#contact-links').innerHTML = links.join('');
  $('#foot-name').textContent = L(C.home.name) || S.name;
}

function openLegal() {
  const I = C.site.imprint || {};
  const G = C.contact.legal || {};
  const lines = [I.name, I.street, I.city, I.country].filter(Boolean).map(esc).join('<br />');
  const html = `
    <h2 id="sheet-title">${esc(L(G.title))}</h2>
    <section class="legal">
      <h3>${esc(L(G.imprintTitle))}</h3>
      <p class="muted">${esc(L(G.imprintLaw))}</p>
      <p>${lines}${I.email ? `<br /><a href="mailto:${esc(I.email)}">${esc(I.email)}</a>` : ''}</p>
    </section>
    <section class="legal">
      <h3>${esc(L(G.privacyTitle))}</h3>
      ${(L(G.privacy) || []).map((p) => `<p>${esc(p)}</p>`).join('')}
    </section>`;
  openSheet(html, { from: state.trigger?.closest?.('a') || $('#legal-link'), kind: 'legal', onClose: () => leaveSub(state.panel) });
}

// ============================================================
//  Router: #/projects, #/projects?cat=x, #/projects/<id>,
//          #/certificates?group=x, #/certificates/<id>, #/page/<id>, #/legal
// ============================================================
let lastRoute = '';

function parseHash() {
  const raw = location.hash.replace(/^#\/?/, '');
  const [path, query = ''] = raw.split('?');
  const [a = '', b = ''] = path.split('/').map((x) => {
    try {
      return decodeURIComponent(x);
    } catch {
      return x;
    }
  });
  return { a, b, q: new URLSearchParams(query) };
}

/** Called when a sheet closes: go back to the panel's own address. */
function leaveSub(panel) {
  const base = panel === 'page' ? `#/page/${state.page}` : `#/${panel === 'overview' ? '' : panel}`;
  const { b, a } = parseHash();
  if ((!b || a === 'page') && a !== 'legal') return;
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
  ring?.setActive(name === 'certificates');
  if (prev && window.innerWidth < MOBILE_BREAKPOINT) window.scrollTo({ top: 0, behavior: 'instant' });
  $('#stage').scrollTop = 0;
}

function route() {
  let { a, b, q } = parseHash();
  // Closing a sheet should return to where the visitor came from with "back",
  // unless they landed directly on the sheet's address (then we just rewrite it).
  const prev = lastRoute;
  const isSheet = (b && a !== 'page') || a === 'legal';
  if (isSheet) {
    const fromSameSheet = prev && prev.startsWith(`${a}/`);
    if (!fromSameSheet) leaveSub.canGoBack = route.ready && (a === 'legal' || prev === a);
  }
  lastRoute = b ? `${a}/${b}` : a;
  route.ready = true;

  if (a === 'legal') {
    showPanel(state.panel || 'overview');
    markNav();
    openLegal();
    return;
  }

  // filters from the address (#/projects?cat=mechanical)
  if (a === 'projects' && q.has('cat') && q.get('cat') !== state.projectFilter) {
    state.projectFilter = q.get('cat');
    renderProjects();
  }
  if (a === 'certificates' && q.has('group') && q.get('group') !== state.certFilter) {
    state.certFilter = q.get('group');
    renderCertificates();
  }

  if (a === 'page') {
    state.page = b;
    renderPage();
    if (state.panel === 'page') $('#stage').scrollTop = 0;
    showPanel('page');
  } else {
    if (!SECTIONS.includes(a)) a = 'overview';
    showPanel(a);
  }
  markNav();

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
  document.addEventListener(
    'keydown',
    (e) => {
      if (e.key === 'Enter' || e.key === ' ') state.trigger = document.activeElement;
    },
    true
  );

  $$('#lang button').forEach((b) => b.addEventListener('click', () => setLang(b.dataset.lang, { persist: true })));

  $('#project-filters').addEventListener('click', (e) => {
    const b = e.target.closest('[data-pfilter]');
    if (!b) return;
    state.projectFilter = b.dataset.pfilter;
    renderProjects();
    history.replaceState(null, '', state.projectFilter === 'all' ? '#/projects' : `#/projects?cat=${encodeURIComponent(state.projectFilter)}`);
    lastRoute = 'projects';
    markNav();
  });
  $('#cert-filters').addEventListener('click', (e) => {
    const b = e.target.closest('[data-cfilter]');
    if (!b) return;
    state.certFilter = b.dataset.cfilter;
    renderCertificates();
    history.replaceState(null, '', state.certFilter === 'all' ? '#/certificates' : `#/certificates?group=${encodeURIComponent(state.certFilter)}`);
    lastRoute = 'certificates';
    markNav();
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
    if (a) {
      e.preventDefault();
      location.replace(a.getAttribute('href'));
      return;
    }
    // a link in the menu sheet to the place we already are: just close
    const m = e.target.closest('.sheet-menu a[href^="#"]');
    if (m && m.getAttribute('href') === location.hash) closeSheet();
  });
  $('#ring-prev').addEventListener('click', () => ring.prev());
  $('#ring-next').addEventListener('click', () => ring.next());

  window.addEventListener('hashchange', route);
}

// ============================================================
//  Boot
// ============================================================
function renderAll() {
  applyStaticTexts();
  renderNav();
  renderOverview();
  renderAbout();
  renderCareer();
  renderProjects();
  renderCertificates();
  renderPage();
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
if (isPreview) $('#preview-flag').hidden = false;
initTheme();
ring = createRing({
  stage: $('#ring-stage'),
  ring: $('#ring'),
  onFrontChange: (x) => renderCertInfo(x),
  onOpen: (x) => {
    location.hash = `#/certificates/${x.id}`;
  },
});
initEvents();
initNavMenus();
onLangChange(renderAll);
initI18n();
route();
initViewer($('#scene'), $('#viewer'));
