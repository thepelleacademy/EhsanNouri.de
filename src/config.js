// ============================================================
//  Central settings – everything you may want to tweak by hand
// ============================================================

// ---------- Site / contact ----------
export const SITE = {
  name: 'Ehsan Nouri',
  domain: 'ehsannouri.de',
  email: 'e.nouri.e@gmail.com',
  linkedin: 'https://www.linkedin.com/in/ehsannri/',
  github: 'https://github.com/thepelleacademy',
  location: 'Deggendorf, Germany',
  photo: './img/ehsan.jpg', // profile photo (public/img/ehsan.jpg)
  // Phone is NOT shown by default (spam protection). Set a number to show it as a contact button.
  phone: '', // e.g. '+49 ...'
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
// Then only the browser language is used.
export const GEO_DETECTION_ENABLED = true;
export const GEO_TIMEOUT_MS = 2500;
export const GEO_ENDPOINTS = [
  { url: 'https://get.geojs.io/v1/ip/country.json', pick: (j) => j && j.country },
  { url: 'https://ipapi.co/json/', pick: (j) => j && j.country_code },
];

// ---------- Neon palette ----------
export const COLORS = {
  background: 0x010208,
  cyan: 0x00e5ff,
  blue: 0x2979ff,
  red: 0xff2d55,
  violet: 0x7c4dff,
};

// ---------- 3D scene ----------
export const SCENE = {
  // camera
  cameraFov: 55,
  cameraStartZ: 9,
  cameraStartY: 0.6,
  cameraScrollTravelZ: 3.2, // how far camera moves in z while scrolling the page
  cameraScrollTravelY: -2.4,
  parallaxStrength: 0.6, // mouse parallax amount

  // hero gears
  gearAPosition: { x: 0, y: 0, z: 0 },
  gearATeeth: 16,
  gearAOuterRadius: 1.6,
  gearAInnerRadius: 1.35,
  gearAHoleRadius: 0.45,
  gearBTeeth: 10,
  gearThickness: 0.35,
  gearSpeed: 0.35, // rad/s of the big gear
  groupOffsetDesktop: { x: 4.6, y: 0.3 }, // gears sit to the right of the text on wide screens
  groupOffsetMobile: { x: 0, y: 1.6 },
  groupScaleDesktop: 0.8,
  groupScaleMobile: 0.62,
  scrollSpinFactor: 2.4, // extra rotation of the group over the whole page

  // satellites
  ringRadius: 3.6,
  ringTubeRadius: 0.012,

  // particles
  particleCountDesktop: 1800,
  particleCountMobile: 700,
  particleRadiusMin: 6,
  particleRadiusMax: 22,
  particleSize: 0.09,
  particleSpin: 0.012,

  // floor grid
  gridSize: 80,
  gridDivisions: 80,
  gridY: -4.2,
  gridSpeed: 0.6,
  gridOpacity: 0.16,

  // bloom (neon glow)
  bloomStrength: 0.75,
  bloomRadius: 0.45,
  bloomThreshold: 0.22,
  maxPixelRatioDesktop: 2,
  maxPixelRatioMobile: 1.5,
};
