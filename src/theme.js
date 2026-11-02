import { THEMES } from './config.js';
import { t, safeGet, safeSet } from './i18n.js';
import { C } from './content.js';

const valid = (id, mode) => THEMES.some((x) => x.id === id && x.mode === mode);
const DEFAULT_DARK_THEME = valid(C.site.themes?.defaultDark, 'dark') ? C.site.themes.defaultDark : 'cyan';
const DEFAULT_LIGHT_THEME = valid(C.site.themes?.defaultLight, 'light') ? C.site.themes.defaultLight : 'drafting';

const KEY = 'theme';
const root = document.documentElement;

export const getTheme = () => root.dataset.theme;
export const themeMode = () => (THEMES.find((x) => x.id === getTheme()) || THEMES[0]).mode;

/** Read a CSS custom property of the active theme (used by the 3D scene). */
export const cssVar = (name) => getComputedStyle(root).getPropertyValue(name).trim();

export function setTheme(id, { persist = true } = {}) {
  if (!THEMES.some((x) => x.id === id)) id = DEFAULT_DARK_THEME;
  root.classList.add('theme-switching'); // eases colours instead of a hard jump
  root.dataset.theme = id;
  root.style.colorScheme = themeMode();
  if (persist) safeSet(localStorage, KEY, id);
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', cssVar('--bg'));
  window.dispatchEvent(new CustomEvent('themechange', { detail: id }));
  clearTimeout(setTheme.timer);
  setTheme.timer = setTimeout(() => root.classList.remove('theme-switching'), 450);
  renderMenu();
}

let btn;
let pop;

function renderMenu() {
  if (!pop) return;
  const group = (mode, label) => `
    <div class="pop-group" role="group" aria-label="${label}">
      <p class="pop-label">${label}</p>
      <div class="pop-swatches">
        ${THEMES.filter((x) => x.mode === mode)
          .map(
            (x) => `
          <button type="button" class="theme-opt" data-theme-id="${x.id}" aria-pressed="${x.id === getTheme()}">
            <span class="theme-chip" data-preview="${x.id}" aria-hidden="true"><i></i></span>
            <span>${t(`themes.${x.id}`) || x.id}</span>
          </button>`
          )
          .join('')}
      </div>
    </div>`;
  pop.innerHTML = group('dark', t('ui.themeDark')) + group('light', t('ui.themeLight'));
}

function open(show) {
  pop.hidden = !show;
  btn.setAttribute('aria-expanded', String(show));
  if (show) pop.querySelector('[aria-pressed="true"]')?.focus();
}

export function initTheme() {
  btn = document.getElementById('theme-btn');
  pop = document.getElementById('theme-pop');

  const saved = safeGet(localStorage, KEY);
  const system = window.matchMedia('(prefers-color-scheme: light)');
  if (!THEMES.some((x) => x.id === saved)) {
    setTheme(system.matches ? DEFAULT_LIGHT_THEME : DEFAULT_DARK_THEME, { persist: false });
    // follow the system until the visitor picks a theme
    system.addEventListener('change', (e) => {
      if (!safeGet(localStorage, KEY)) setTheme(e.matches ? DEFAULT_LIGHT_THEME : DEFAULT_DARK_THEME, { persist: false });
    });
  } else {
    setTheme(saved, { persist: false });
  }

  btn.addEventListener('click', () => open(pop.hidden));
  pop.addEventListener('click', (e) => {
    const opt = e.target.closest('[data-theme-id]');
    if (!opt) return;
    setTheme(opt.dataset.themeId);
    pop.querySelector(`[data-theme-id="${opt.dataset.themeId}"]`)?.focus();
  });
  document.addEventListener('pointerdown', (e) => {
    if (!pop.hidden && !e.target.closest('.theme-pick')) open(false);
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !pop.hidden) {
      open(false);
      btn.focus();
    }
  });
}

export const refreshThemeMenu = renderMenu;
