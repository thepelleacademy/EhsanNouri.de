// Line icons, 24×24, drawn with currentColor.
// Keys that are not built-in sections can be picked for menu items and pages in /admin.
const svg = (d) => `<svg class="ico" viewBox="0 0 24 24" aria-hidden="true">${d}</svg>`;

export const ICONS = {
  overview: svg('<rect x="3.5" y="3.5" width="7" height="7" rx="1.5"/><rect x="13.5" y="3.5" width="7" height="7" rx="1.5"/><rect x="3.5" y="13.5" width="7" height="7" rx="1.5"/><rect x="13.5" y="13.5" width="7" height="7" rx="1.5"/>'),
  about: svg('<circle cx="12" cy="8.5" r="3.8"/><path d="M4.5 20.5c1.2-3.8 4-5.6 7.5-5.6s6.3 1.8 7.5 5.6"/>'),
  career: svg('<path d="M4 6h16M4 12h10M4 18h13"/><circle cx="20" cy="12" r="1.6"/>'),
  projects: svg('<path d="M12 3l8 4.5v9L12 21l-8-4.5v-9z"/><path d="M4 7.5l8 4.5 8-4.5M12 12v9"/>'),
  certificates: svg('<circle cx="12" cy="9.5" r="5.5"/><circle cx="12" cy="9.5" r="2.2"/><path d="M8.6 14l-1.6 7 5-2.4 5 2.4-1.6-7"/>'),
  contact: svg('<rect x="3" y="5.5" width="18" height="13" rx="2"/><path d="M3.8 6.5l8.2 6.2 8.2-6.2"/>'),
  book: svg('<path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v15H6.5A2.5 2.5 0 0 0 4 20.5z"/><path d="M4 20.5A2.5 2.5 0 0 0 6.5 23H20v-5"/><path d="M8 7.5h8M8 11h6"/>'),
  doc: svg('<path d="M6 3h8l4 4v14H6z"/><path d="M14 3v4h4M9 12h6M9 16h6"/>'),
  star: svg('<path d="M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.9l-5.2 2.7 1-5.8L3.5 9.7l5.9-.9z"/>'),
  gear: svg('<circle cx="12" cy="12" r="3"/><path d="M12 2.8v2.6M12 18.6v2.6M2.8 12h2.6M18.6 12h2.6M5.5 5.5l1.8 1.8M16.7 16.7l1.8 1.8M5.5 18.5l1.8-1.8M16.7 7.3l1.8-1.8"/>'),
  chip: svg('<rect x="6" y="6" width="12" height="12" rx="2"/><rect x="9.5" y="9.5" width="5" height="5"/><path d="M9 2.5V6M15 2.5V6M9 18v3.5M15 18v3.5M2.5 9H6M2.5 15H6M18 9h3.5M18 15h3.5"/>'),
  flask: svg('<path d="M9.5 3h5M10 3v6l-5.5 9.5A1.7 1.7 0 0 0 6 21h12a1.7 1.7 0 0 0 1.5-2.5L14 9V3"/><path d="M7.2 15h9.6"/>'),
  tool: svg('<path d="M14.5 6.5a4 4 0 0 1 5.2-3.8l-2.9 2.9.4 2.2 2.2.4 2.9-2.9a4 4 0 0 1-5.4 5L8 19.2a2 2 0 0 1-2.8-2.8l8.9-8.9a4 4 0 0 1 .4-1z"/>'),
  globe: svg('<circle cx="12" cy="12" r="8.5"/><path d="M3.5 12h17M12 3.5c2.5 2.5 3.6 5.4 3.6 8.5s-1.1 6-3.6 8.5c-2.5-2.5-3.6-5.4-3.6-8.5s1.1-6 3.6-8.5z"/>'),
  link: svg('<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>'),
  camera: svg('<path d="M4 7.5h3.5L9 5h6l1.5 2.5H20v11.5H4z"/><circle cx="12" cy="13" r="3.5"/>'),
  download: svg('<path d="M12 4v11M7 10.5l5 5 5-5M5 19.5h14"/>'),
  menu: svg('<path d="M4 7h16M4 12h16M4 17h16"/>'),
  chevron: svg('<path d="M7 10l5 5 5-5"/>'),
  play: svg('<path d="M8 5.5v13l10.5-6.5z"/>'),
  external: svg('<path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/>'),
  file: svg('<path d="M6 3h8l4 4v14H6z"/><path d="M14 3v4h4"/>'),
  prev: svg('<path d="M15 5l-7 7 7 7"/>'),
  next: svg('<path d="M9 5l7 7-7 7"/>'),
};

/** Icons offered in the admin panel for menu items and pages. */
export const PICKABLE_ICONS = ['overview', 'about', 'career', 'projects', 'certificates', 'contact', 'book', 'doc', 'star', 'gear', 'chip', 'flask', 'tool', 'globe', 'link', 'camera', 'download'];

export const icon = (name) => ICONS[name] || ICONS.doc;
