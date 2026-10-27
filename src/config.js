// ============================================================
//  Central settings: everything you may want to tweak by hand
// ============================================================

// ---------- Site / contact ----------
export const SITE = {
  name: 'Ehsan Nouri',
  domain: 'ehsannouri.de',
  email: 'e.nouri.e@gmail.com',
  linkedin: 'https://www.linkedin.com/in/ehsannri/',
  github: 'https://github.com/thepelleacademy',
  photo: './img/ehsan.jpg', // profile photo (public/img/ehsan.jpg)
  // Phone is intentionally not shown (spam protection). Set e.g. '+49 ...' to show it as a button.
  phone: '',
};

// ---------- Languages ----------
export const LANGS = ['fa', 'en', 'de'];
export const DEFAULT_LANG = 'en';

// Country code -> language. Everything not listed falls back to DEFAULT_LANG.
export const COUNTRY_TO_LANG = {
  IR: 'fa',
  AF: 'fa',
  TJ: 'fa',
  DE: 'de',
  AT: 'de',
  CH: 'de',
  LI: 'de',
};

// Set to false to disable the IP-based country lookup (privacy / GDPR choice).
export const GEO_DETECTION_ENABLED = true;
export const GEO_TIMEOUT_MS = 2500;
export const GEO_ENDPOINTS = [
  { url: 'https://get.geojs.io/v1/ip/country.json', pick: (j) => j && j.country },
  { url: 'https://ipapi.co/json/', pick: (j) => j && j.country_code },
];

// ---------- Palette (3D + accents) ----------
export const COLORS = {
  background: 0x03050b,
  cyan: 0x00e5ff,
  blue: 0x2979ff,
  red: 0xff2d55,
  sky: 0x9fd8ff,
};

// ---------- Hero viewer (3D wireframe part) ----------
export const VIEWER = {
  fov: 34,
  cameraZ: 10.5,
  maxPixelRatio: 2,
  // Flanged housing: outline, lugs, bolt pattern, bore
  flange: {
    radius: 1.7, // base radius
    lugHeight: 0.42, // how far the lugs stick out
    lugSharpness: 18, // higher = narrower lugs
    bolts: 6, // number of bolt lugs
    boltRadius: 1.22, // distance of bolt holes from the centre
    boltHoleRadius: 0.12,
    boreRadius: 0.52,
    segments: 360,
  },
  thickness: 0.34,
  // Orbiting "satellite" ring around the part
  ringRadius: 2.55,
  ringTube: 0.009,
  tiltX: 0.42, // static tilt of the orbit ring
  // Motion
  spinSpeed: 0.16, // rad/s of the part
  orbitSpeed: 0.09, // rad/s of the ring
  dragSensitivity: 0.006,
  // Background particles
  particles: 260,
  particleSpread: 9,
  // Floor grid (CAD-style ground plane)
  gridSize: 12,
  gridDivisions: 24,
  gridY: -2.7,
};
