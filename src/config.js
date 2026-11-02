// ============================================================
//  Central settings: everything you may want to tweak by hand
//  (colours of the six themes live at the top of src/styles.css)
// ============================================================

// Contact data, imprint, languages and texts are content: they live in
// /content/site.json and are edited in the admin panel (/admin).

// ---------- Languages ----------
export const LANGS = ['fa', 'en', 'de'];
export const RTL_LANGS = ['fa'];

// Country lookup runs on our own domain through Cloudflare (no third-party service).
// On/off and the country -> language table: content/site.json -> languages
export const GEO_TIMEOUT_MS = 1500;
export const GEO_TRACE_URL = '/cdn-cgi/trace'; // Cloudflare answers with "loc=DE"

// ---------- Themes ----------
// Order of the swatches in the theme menu. Colours: see the top of src/styles.css.
export const THEMES = [
  { id: 'cyan', mode: 'dark' },
  { id: 'amber', mode: 'dark' },
  { id: 'red', mode: 'dark' },
  { id: 'drafting', mode: 'light' },
  { id: 'anodized', mode: 'light' },
  { id: 'scope', mode: 'light' },
];
// Default dark/light theme: content/site.json -> themes

// ---------- Hero viewer (3D wireframe part) ----------
export const VIEWER = {
  fov: 34,
  cameraZ: 10.5,
  cameraY: 0.35,
  maxPixelRatio: 2,
  // Flanged housing: outline, lugs, bolt pattern, bore
  flange: {
    radius: 1.7, // base radius
    lugHeight: 0.36, // how far the lugs stick out
    lugSharpness: 5, // higher = narrower lugs
    bolts: 6, // number of bolt lugs
    boltRadius: 1.22, // distance of bolt holes from the centre
    boltHoleRadius: 0.12,
    boreRadius: 0.52,
    segments: 360,
  },
  thickness: 0.34,
  tiltX: 0.25, // static tilt of the part
  // Orbiting ring around the part
  ringRadius: 2.55,
  ringTube: 0.009,
  ringTilt: 0.42,
  // Motion
  spinSpeed: 0.16, // rad/s of the part
  orbitSpeed: 0.11, // rad/s of the ring
  dragSensitivity: 0.006,
  // Background particles
  particles: 220,
  particleSpread: 9,
  // Floor grid (CAD-style ground plane)
  gridSize: 12,
  gridDivisions: 24,
  gridY: -2.7,
  // Opacities (dark themes / light themes)
  fillOpacity: { dark: 0.07, light: 0.05 },
  gridOpacity: { dark: 0.14, light: 0.18 },
  dustOpacity: { dark: 0.55, light: 0.35 },
};

// ---------- Certificate ring (3D carousel) ----------
export const RING = {
  cardWidth: 300, // px on desktop (height follows the A4 ratio below)
  cardWidthMobile: 210, // px below RING.mobileBreakpoint
  mobileBreakpoint: 720,
  cardRatio: 1 / 1.414, // height / width, landscape A4
  gap: 26, // extra radius so cards don't touch (px)
  perspective: 1700, // px, smaller = stronger 3D
  tiltX: -6, // deg, look slightly down onto the ring
  // Springs (Apple style: damping ratio + response in seconds)
  snap: { damping: 0.82, response: 0.45 }, // after a flick (a little bounce)
  settle: { damping: 1.0, response: 0.4 }, // buttons, keys, clicks (no bounce)
  decelerationRate: 0.998, // momentum projection, 0.99 = shorter throws
  // Idle auto-rotation
  autoRotate: true,
  autoRotateSpeed: 7, // deg/s
  autoRotateDelay: 4500, // ms of no interaction before it starts again
  // Cards turned away from the viewer fade to this opacity
  backOpacity: 0.28,
};

// ---------- Panels and menu ----------
export const MOBILE_BREAKPOINT = 760; // px: below this the page scrolls to the top on panel change
export const DOCK_MAX_ITEMS = 5; // mobile tab bar: slots (the last one becomes "More" when needed)
export const TILE_MAX_COLUMNS = 6; // overview tiles per row on desktop
export const NAV_MENU_CLOSE_DELAY_MS = 180; // desktop sub menu: delay before it closes
