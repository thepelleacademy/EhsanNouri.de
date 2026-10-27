import '@fontsource/barlow-condensed/600.css';
import '@fontsource/barlow-condensed/700.css';
import '@fontsource/ibm-plex-sans/400.css';
import '@fontsource/ibm-plex-sans/500.css';
import '@fontsource/ibm-plex-sans/600.css';
import '@fontsource/ibm-plex-mono/400.css';
import '@fontsource/ibm-plex-mono/500.css';
import '@fontsource/vazirmatn/arabic-400.css';
import '@fontsource/vazirmatn/arabic-700.css';
import '@fontsource/vazirmatn/400.css';
import '@fontsource/vazirmatn/700.css';
import './styles.css';

import { initI18n, setLang, getLang, onLangChange, t } from './i18n.js';
import { initViewer } from './scene.js';
import { SITE } from './config.js';

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
const esc = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const STATUS_CLASS = { completed: 's-done', in_progress: 's-active', prototype: 's-proto' };
const CAT_CODE = { mechanical: 'M', electronics: 'E', software: 'S', research: 'R' };
const FILTERS = ['all', 'mechanical', 'electronics', 'software', 'research'];
let activeFilter = 'all';

// ---------- helpers ----------
const statusLabel = (s) => t(`ui.statusLabel.${s}`) || s;
const fmtPeriod = ([from, to]) => `${from} – ${to === 'now' ? t('ui.now') : to}`;
const ticks = (items) => `<ul class="ticks">${items.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>`;

// ---------- renderers (re-run on every language change) ----------
function renderHero() {
  $('#hero-chips').innerHTML = (t('hero.chips') || []).map((c) => `<li>${esc(c)}</li>`).join('');
  const labels = t('ui.tb') || {};
  const values = t('ui.tbValues') || {};
  $('#titleblock').innerHTML = Object.keys(labels)
    .map((k) => `<div class="tb-cell"><span>${esc(labels[k])}</span><b>${esc(values[k])}</b></div>`)
    .join('');
  $('#viewer-caption').textContent = t('ui.viewCaption') || '';
}

function renderProfile() {
  $('#profile-text').innerHTML = (t('profile.paragraphs') || []).map((p) => `<p>${esc(p)}</p>`).join('');
  $('#profile-facts').innerHTML = (t('profile.facts') || [])
    .map((f) => `<div><dt class="mono">${esc(f.k)}</dt><dd>${esc(f.v)}</dd></div>`)
    .join('');
  const img = $('#portrait');
  if (img) {
    img.alt = SITE.name;
    if (SITE.photo) img.src = SITE.photo;
  }
}

function renderEducation() {
  $('#education-list').innerHTML = (t('education.items') || [])
    .map(
      (e) => `
      <article class="edu reveal ${e.status === 'in_progress' ? 'is-active' : ''}">
        <header class="edu-head">
          <span class="status ${STATUS_CLASS[e.status]}">${esc(statusLabel(e.status))}</span>
          <span class="mono muted-txt">${esc(fmtPeriod(e.period))}</span>
        </header>
        <h3>${esc(e.degree)}</h3>
        <p class="org">${esc(e.school)}</p>
        ${e.note && e.note.length ? ticks(e.note) : ''}
      </article>`
    )
    .join('');
}

function renderExperience() {
  $('#experience-list').innerHTML = (t('experience.items') || [])
    .map(
      (x, i) => `
      <article class="job reveal">
        <div class="job-period mono muted-txt">${esc(fmtPeriod(x.period))}</div>
        <div class="job-body">
          <h3>${esc(x.role)}</h3>
          <p class="org">${esc(x.org)}</p>
          <details ${i === 0 ? 'open' : ''}>
            <summary>${esc(t('ui.openDetails'))}</summary>
            ${ticks(x.bullets || [])}
          </details>
        </div>
      </article>`
    )
    .join('');
}

function renderFilters() {
  $('#filters').innerHTML = FILTERS.map(
    (f) =>
      `<button type="button" class="chip ${f === activeFilter ? 'is-on' : ''}" data-filter="${f}" aria-pressed="${f === activeFilter}">${esc(
        t(`projects.filters.${f}`)
      )}</button>`
  ).join('');
}

function renderProjects() {
  const all = t('projects.items') || [];
  const items = all.map((p, idx) => ({ p, idx })).filter(({ p }) => activeFilter === 'all' || p.cat === activeFilter);
  $('#projects-list').innerHTML = items
    .map(
      ({ p, idx }) => `
      <article class="project reveal" data-cat="${esc(p.cat)}">
        <header class="project-head">
          <span class="mono code">${CAT_CODE[p.cat] || 'P'}-${String(idx + 1).padStart(2, '0')}</span>
          <span class="status ${STATUS_CLASS[p.status]}">${esc(statusLabel(p.status))}</span>
        </header>
        ${
          p.images && p.images.length
            ? `<figure class="project-media"><img src="${esc(p.images[0])}" alt="${esc(p.title)}" loading="lazy" decoding="async" /></figure>`
            : ''
        }
        <h3>${esc(p.title)}</h3>
        <p class="summary">${esc(p.summary)}</p>
        <div class="meta-row mono">
          ${p.year ? `<span>${esc(p.year)}</span>` : ''}
          <span>${esc(t(`projects.filters.${p.cat}`))}</span>
        </div>
        <ul class="tags">${(p.tags || []).map((x) => `<li>${esc(x)}</li>`).join('')}</ul>
        <details class="work">
          <summary>${esc(t('ui.workDone'))}</summary>
          ${ticks(p.work || [])}
        </details>
      </article>`
    )
    .join('');
  $('#projects-count').textContent = `${items.length} / ${all.length} ${t('ui.projectsCount')}`;
}

function renderCertificates() {
  $('#certificates-list').innerHTML = (t('certificates.items') || [])
    .map(
      (c) => `
      <li class="cert reveal">
        <span class="mono year">${esc(c.year)}</span>
        <div>
          <h3>${esc(c.title)}</h3>
          <p class="org">${esc(c.issuer)}</p>
          ${c.detail ? `<p class="mono small muted-txt">${esc(c.detail)}</p>` : ''}
        </div>
      </li>`
    )
    .join('');
}

function renderSkills() {
  $('#skills-list').innerHTML = (t('skills.groups') || [])
    .map(
      (g) => `
      <article class="skill reveal">
        <h3 class="mono">${esc(g.name)}</h3>
        <ul>${g.items.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>
      </article>`
    )
    .join('');
}

function renderContact() {
  const links = [];
  if (SITE.email)
    links.push(`<a class="btn btn-primary" href="mailto:${esc(SITE.email)}">${esc(t('contact.email'))}</a>`);
  if (SITE.linkedin)
    links.push(
      `<a class="btn btn-ghost" href="${esc(SITE.linkedin)}" target="_blank" rel="noopener noreferrer">${esc(t('contact.linkedin'))}</a>`
    );
  if (SITE.github)
    links.push(
      `<a class="btn btn-ghost" href="${esc(SITE.github)}" target="_blank" rel="noopener noreferrer">${esc(t('contact.github'))}</a>`
    );
  $('#contact-links').innerHTML = links.join('');
  $('#contact-location').textContent = t('contact.location') || '';
}

function renderAll() {
  renderHero();
  renderProfile();
  renderEducation();
  renderExperience();
  renderFilters();
  renderProjects();
  renderCertificates();
  renderSkills();
  renderContact();
  $$('.lang button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.lang === getLang())));
  observeReveals();
}

// ---------- scroll reveal (content is visible unless JS runs and the element is still off-screen) ----------
const io = new IntersectionObserver(
  (entries) => {
    entries.forEach((e) => {
      if (e.isIntersecting) {
        e.target.classList.add('in');
        io.unobserve(e.target);
      }
    });
  },
  { threshold: 0.08, rootMargin: '0px 0px -4% 0px' }
);
function observeReveals() {
  $$('.reveal:not(.in)').forEach((el) => {
    if (reduceMotion) el.classList.add('in');
    else io.observe(el);
  });
}

// ---------- navigation ----------
function initNav() {
  const nav = $('#nav');
  const burger = $('#burger');
  const links = $('#nav-links');

  const onScroll = () => nav.classList.toggle('scrolled', window.scrollY > 24);
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  const closeMenu = () => {
    nav.classList.remove('open');
    burger.setAttribute('aria-expanded', 'false');
  };
  burger.addEventListener('click', () => {
    const open = nav.classList.toggle('open');
    burger.setAttribute('aria-expanded', String(open));
  });
  $$('a', links).forEach((a) => a.addEventListener('click', closeMenu));

  $$('.lang button').forEach((b) => b.addEventListener('click', () => setLang(b.dataset.lang, { persist: true })));

  const spy = new IntersectionObserver(
    (entries) => {
      entries.forEach((e) => {
        if (e.isIntersecting) {
          $$('.nav-links a').forEach((a) => a.classList.toggle('active', a.getAttribute('href') === `#${e.target.id}`));
        }
      });
    },
    { rootMargin: '-45% 0px -50% 0px' }
  );
  $$('main section[id]').forEach((s) => spy.observe(s));
}

function initFilters() {
  $('#filters').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-filter]');
    if (!btn) return;
    activeFilter = btn.dataset.filter;
    renderFilters();
    renderProjects();
    observeReveals();
  });
}

// ---------- boot ----------
document.documentElement.classList.add('js');
$('#year').textContent = new Date().getFullYear();
onLangChange(renderAll);
initNav();
initFilters();
initViewer($('#scene'), $('#viewport'));
initI18n();
