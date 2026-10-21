import '@fontsource/orbitron/500.css';
import '@fontsource/orbitron/700.css';
import '@fontsource/inter/400.css';
import '@fontsource/inter/600.css';
import '@fontsource/vazirmatn/arabic-400.css';
import '@fontsource/vazirmatn/arabic-700.css';
import '@fontsource/vazirmatn/400.css';
import '@fontsource/vazirmatn/700.css';
import './styles.css';

import { initI18n, setLang, getLang, onLangChange, t } from './i18n.js';
import { initScene } from './scene.js';
import { SITE } from './config.js';

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

const esc = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// ---------- dynamic content (re-rendered on every language change) ----------
function renderStats() {
  $('#stats').innerHTML = (t('about.stats') || [])
    .map(
      (s) => `<div class="stat panel reveal tilt"><b>${esc(s.value)}</b><span>${esc(s.label)}</span></div>`
    )
    .join('');
}

function renderTimeline(targetId, items) {
  $(targetId).innerHTML = (items || [])
    .map(
      (it) => `
      <article class="tl-item panel reveal tilt">
        <div class="tl-head">
          <h3>${esc(it.role)}</h3>
          <span class="period">${esc(it.period)}</span>
        </div>
        <p class="org">${esc(it.org)}</p>
        ${it.desc ? `<p>${esc(it.desc)}</p>` : ''}
        ${it.bullets && it.bullets.length ? `<ul class="bullets">${it.bullets.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>` : ''}
        ${it.tags && it.tags.length ? `<ul class="tags">${it.tags.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>` : ''}
      </article>`
    )
    .join('');
}

function renderProjects() {
  const label = t('projects.viewCode');
  $('#projects-list').innerHTML = (t('projects.items') || [])
    .map(
      (p, i) => `
      <article class="card panel reveal tilt" style="--i:${i}">
        <span class="card-index">${String(i + 1).padStart(2, '0')}</span>
        <h3>${esc(p.title)}</h3>
        <p>${esc(p.desc)}</p>
        <ul class="tags">${(p.tags || []).map((x) => `<li>${esc(x)}</li>`).join('')}</ul>
        ${p.link ? `<a class="link" href="${esc(p.link)}" target="_blank" rel="noopener noreferrer">${esc(label)} →</a>` : ''}
      </article>`
    )
    .join('');
}

function renderCertificates() {
  const label = t('certificates.view');
  $('#certificates-list').innerHTML = (t('certificates.items') || [])
    .map(
      (c, i) => `
      <article class="card panel reveal tilt" style="--i:${i}">
        <span class="card-index">${esc(c.year)}</span>
        <h3>${esc(c.title)}</h3>
        <p class="org">${esc(c.issuer)}</p>
        ${c.detail ? `<p class="detail">${esc(c.detail)}</p>` : ''}
        ${c.link ? `<a class="link" href="${esc(c.link)}" target="_blank" rel="noopener noreferrer">${esc(label)} →</a>` : ''}
      </article>`
    )
    .join('');
}

function renderSkills() {
  $('#skills-list').innerHTML = (t('skills.groups') || [])
    .map(
      (g, i) => `
      <article class="card panel reveal tilt" style="--i:${i}">
        <h3>${esc(g.name)}</h3>
        <ul class="tags">${g.items.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>
      </article>`
    )
    .join('');
}

function renderContact() {
  const links = [];
  if (SITE.email) links.push(`<a class="btn btn-primary" href="mailto:${esc(SITE.email)}">${esc(t('contact.email'))}</a>`);
  if (SITE.linkedin)
    links.push(`<a class="btn btn-ghost" href="${esc(SITE.linkedin)}" target="_blank" rel="noopener noreferrer">${esc(t('contact.linkedin'))}</a>`);
  if (SITE.phone)
    links.push(`<a class="btn btn-ghost" href="tel:${esc(SITE.phone.replace(/\s+/g, ''))}">${esc(SITE.phone)}</a>`);
  if (SITE.github)
    links.push(`<a class="btn btn-ghost" href="${esc(SITE.github)}" target="_blank" rel="noopener noreferrer">${esc(t('contact.github'))}</a>`);
  $('#contact-links').innerHTML = links.join('');
}

function renderAll() {
  renderStats();
  renderTimeline('#experience-list', t('experience.items'));
  renderTimeline('#education-list', t('education.items'));
  renderProjects();
  renderCertificates();
  renderSkills();
  renderContact();
  $$('.lang button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.lang === getLang())));
  observeReveals();
  bindTilt();
}

// ---------- scroll reveal ----------
const io = new IntersectionObserver(
  (entries) => {
    entries.forEach((e) => {
      if (e.isIntersecting) {
        e.target.classList.add('in');
        io.unobserve(e.target);
      }
    });
  },
  { threshold: 0.12, rootMargin: '0px 0px -6% 0px' }
);
function observeReveals() {
  $$('.reveal:not(.in)').forEach((el) => io.observe(el));
}

// ---------- 3D card tilt (pointer devices only) ----------
const canTilt = window.matchMedia('(hover: hover) and (pointer: fine)').matches &&
  !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const TILT_MAX_DEG = 7; // maximum tilt angle
function bindTilt() {
  if (!canTilt) return;
  $$('.tilt:not([data-tilt])').forEach((el) => {
    el.dataset.tilt = '1';
    el.addEventListener('pointermove', (e) => {
      const r = el.getBoundingClientRect();
      const px = (e.clientX - r.left) / r.width - 0.5;
      const py = (e.clientY - r.top) / r.height - 0.5;
      el.style.setProperty('--ry', `${px * TILT_MAX_DEG * 2}deg`);
      el.style.setProperty('--rx', `${-py * TILT_MAX_DEG * 2}deg`);
      el.style.setProperty('--mx', `${(px + 0.5) * 100}%`);
      el.style.setProperty('--my', `${(py + 0.5) * 100}%`);
    });
    el.addEventListener('pointerleave', () => {
      el.style.setProperty('--ry', '0deg');
      el.style.setProperty('--rx', '0deg');
    });
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

  burger.addEventListener('click', () => {
    const open = nav.classList.toggle('open');
    burger.setAttribute('aria-expanded', String(open));
  });
  $$('a', links).forEach((a) =>
    a.addEventListener('click', () => {
      nav.classList.remove('open');
      burger.setAttribute('aria-expanded', 'false');
    })
  );

  $$('.lang button').forEach((b) => b.addEventListener('click', () => setLang(b.dataset.lang, { persist: true })));

  // highlight current section
  const sections = $$('main section[id]');
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
  sections.forEach((s) => spy.observe(s));
}

// ---------- boot ----------
$('#year').textContent = new Date().getFullYear();
const portrait = $('#portrait');
if (portrait && SITE.photo) portrait.src = SITE.photo;
const locEl = $('#contact-location');
if (locEl) locEl.textContent = SITE.location || '';
onLangChange(renderAll);
initNav();
initScene($('#bg'));
initI18n();
