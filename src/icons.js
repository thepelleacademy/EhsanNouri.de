// Line icons, 24×24, drawn with currentColor
const svg = (d) => `<svg class="ico" viewBox="0 0 24 24" aria-hidden="true">${d}</svg>`;

export const ICONS = {
  overview: svg('<rect x="3.5" y="3.5" width="7" height="7" rx="1.5"/><rect x="13.5" y="3.5" width="7" height="7" rx="1.5"/><rect x="3.5" y="13.5" width="7" height="7" rx="1.5"/><rect x="13.5" y="13.5" width="7" height="7" rx="1.5"/>'),
  about: svg('<circle cx="12" cy="8.5" r="3.8"/><path d="M4.5 20.5c1.2-3.8 4-5.6 7.5-5.6s6.3 1.8 7.5 5.6"/>'),
  career: svg('<path d="M4 6h16M4 12h10M4 18h13"/><circle cx="20" cy="12" r="1.6"/>'),
  projects: svg('<path d="M12 3l8 4.5v9L12 21l-8-4.5v-9z"/><path d="M4 7.5l8 4.5 8-4.5M12 12v9"/>'),
  certificates: svg('<circle cx="12" cy="9.5" r="5.5"/><circle cx="12" cy="9.5" r="2.2"/><path d="M8.6 14l-1.6 7 5-2.4 5 2.4-1.6-7"/>'),
  contact: svg('<rect x="3" y="5.5" width="18" height="13" rx="2"/><path d="M3.8 6.5l8.2 6.2 8.2-6.2"/>'),
  play: svg('<path d="M8 5.5v13l10.5-6.5z"/>'),
  external: svg('<path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/>'),
  file: svg('<path d="M6 3h8l4 4v14H6z"/><path d="M14 3v4h4"/>'),
  prev: svg('<path d="M15 5l-7 7 7 7"/>'),
  next: svg('<path d="M9 5l7 7-7 7"/>'),
};
