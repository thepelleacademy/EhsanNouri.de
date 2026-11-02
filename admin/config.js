// ============================================================
//  Admin panel settings (ehsannouri.de/admin)
//  Everything here can be changed by hand.
// ============================================================

// ---------- Repository the panel writes to ----------
export const REPO_OWNER = 'thepelleacademy';
export const REPO_NAME = 'EhsanNouri.de';
export const BRANCH = 'main';
export const GITHUB_API = 'https://api.github.com';
export const GITHUB_API_VERSION = '2022-11-28';

// ---------- Login ----------
export const PASSWORD_MIN_LENGTH = 10; // password that protects the GitHub token on this device
export const PBKDF2_ITERATIONS = 600000; // key derivation work factor (higher = slower brute force)
export const AUTO_LOCK_MINUTES = 30; // lock after this many minutes without activity
export const KEEP_SESSION_ON_RELOAD = true; // stay logged in when the tab reloads (until the tab is closed)
export const FAILED_LOGIN_BASE_DELAY_MS = 600; // wait time after a wrong password, doubles each time
export const FAILED_LOGIN_MAX_DELAY_MS = 30000;

// ---------- Uploads ----------
export const MAX_UPLOAD_MB = 50; // per file (GitHub rejects files over 100 MB)
export const IMAGE_TYPES = ['jpg', 'jpeg', 'png', 'webp', 'avif', 'gif'];
export const VIDEO_TYPES = ['mp4', 'webm', 'm4v', 'mov'];
export const THUMB_CONCURRENCY = 4; // parallel downloads of existing photos for thumbnails

// ---------- Deploy status ----------
export const DEPLOY_POLL_MS = 5000; // how often the build status is checked after saving
export const DEPLOY_POLL_MAX_MINUTES = 15;

// ---------- Editor ----------
export const DRAFT_SAVE_DELAY_MS = 600; // unsaved changes are kept in this browser after this pause
export const SITE_URL = '../'; // the public site, relative to /admin/

// Files of the site that the panel edits (all in the repository)
export const CONTENT_FILES = [
  'content/site.json',
  'content/nav.json',
  'content/home.json',
  'content/about.json',
  'content/career.json',
  'content/projects.json',
  'content/certificates.json',
  'content/contact.json',
  'content/pages.json',
  'content/ui/fa.json',
  'content/ui/en.json',
  'content/ui/de.json',
];

// Where uploaded files go
export const PROJECT_MEDIA_DIR = 'media/projects'; // media/projects/<project-id>/<file>
export const CERT_MEDIA_DIR = 'media/certificates'; // media/certificates/<cert-id>.jpg|.pdf
export const PUBLIC_DIR = 'public'; // photo and CV: public/<path in site.json>

// Storage keys in this browser
export const STORE = {
  vault: 'admin:vault', // encrypted GitHub token
  session: 'admin:session', // token for this tab (sessionStorage)
  draft: 'admin:draft', // unsaved changes
  preview: 'admin:preview', // read by the site when opened with ?preview
  failed: 'admin:failed', // wrong password counter (sessionStorage)
};
