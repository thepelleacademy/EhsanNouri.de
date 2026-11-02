// ============================================================
//  ehsannouri.de/admin — content editor that saves straight to GitHub.
//  Flow: unlock token -> load content from the repository -> edit ->
//  "Save" = one commit -> GitHub Actions builds and deploys the site.
// ============================================================
import '@fontsource-variable/vazirmatn';
import './admin.css';

import * as GH from './github.js';
import { sealToken, openVault, readVault, forgetVault } from './vault.js';
import { createForm, esc, pick, getAt, setAt, PARSE, LANGS, LANG_DIR } from './forms.js';
import { SECTIONS, FILES, uid } from './schemas.js';
import { createMedia } from './media.js';
import { md } from '../src/md.js';
import { ICONS } from '../src/icons.js';
import * as CFG from './config.js';

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const ser = (o) => `${JSON.stringify(o, null, 2)}\n`;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const clone = (o) => (o == null ? o : JSON.parse(JSON.stringify(o)));
const app = $('#app');

const DEFAULTS = {
  [FILES.pages]: { items: [] },
  [FILES.nav]: { items: [] },
};
const SLUG = /^[a-z0-9][a-z0-9-]*$/;
const SECTION_IDS = ['overview', 'about', 'career', 'projects', 'certificates', 'contact'];

const S = {
  token: '',
  user: null,
  head: null, // { sha, tree, date, message }
  orig: {}, // path -> text in the repository
  data: {}, // path -> working copy
  section: 'dashboard',
  open: new Set(), // open <details> in arrays
  newItems: new WeakSet(), // items created since the last save (their id may still change)
  saved: { projects: new Set(), certificates: new Set(), pages: new Set() },
  form: null,
  deploy: null,
  saving: false,
};

// ============================================================
//  Small UI helpers: toast and dialog
// ============================================================
function toast(msg, kind = 'info') {
  let box = $('#toasts');
  if (!box) {
    box = document.createElement('div');
    box.id = 'toasts';
    document.body.append(box);
  }
  const el = document.createElement('div');
  el.className = `toast toast-${kind}`;
  el.textContent = msg;
  box.append(el);
  setTimeout(() => el.classList.add('out'), kind === 'error' ? 6500 : 3500);
  setTimeout(() => el.remove(), kind === 'error' ? 7000 : 4000);
}

function dialog({ title, html = '', buttons = [{ label: 'باشه', value: true, kind: 'primary' }], wide = false }) {
  return new Promise((resolve) => {
    const d = document.createElement('dialog');
    d.className = `dlg${wide ? ' dlg-wide' : ''}`;
    d.innerHTML = `
      <form method="dialog">
        <h2>${esc(title)}</h2>
        <div class="dlg-body">${html}</div>
        <div class="dlg-actions">${buttons
          .map((b, i) => `<button type="submit" class="btn ${b.kind === 'primary' ? 'btn-primary' : b.kind === 'danger' ? 'btn-danger' : 'btn-ghost'}" value="${i}">${esc(b.label)}</button>`)
          .join('')}</div>
      </form>`;
    document.body.append(d);
    d.addEventListener('close', () => {
      const i = d.returnValue === '' ? -1 : Number(d.returnValue);
      const form = $('form', d);
      const out = i < 0 ? null : buttons[i].value;
      resolve(typeof out === 'function' ? out(form) : out);
      d.remove();
    });
    d.showModal();
    ($('input, textarea', d) || $('.btn-primary', d))?.focus();
  });
}
const confirmDlg = (title, html, yes = 'بله', kind = 'primary') =>
  dialog({ title, html, buttons: [{ label: yes, value: true, kind }, { label: 'انصراف', value: false }] });

// ============================================================
//  Login: the GitHub token is stored encrypted on this device
// ============================================================
const TOKEN_HELP = `
  <ol class="steps">
    <li>صفحه <a href="https://github.com/settings/personal-access-tokens/new" target="_blank" rel="noopener">ساخت Fine-grained token در گیت‌هاب</a> را باز کنید.</li>
    <li><b>Resource owner:</b> <code>${esc(CFG.REPO_OWNER)}</code></li>
    <li><b>Repository access:</b> Only select repositories → <code>${esc(CFG.REPO_NAME)}</code></li>
    <li><b>Permissions → Repository:</b> <code>Contents: Read and write</code> و <code>Actions: Read-only</code></li>
    <li><b>Expiration:</b> مثلاً یک سال. توکن (<code>github_pat_…</code>) را کپی کنید و اینجا بگذارید.</li>
  </ol>
  <p class="help">توکن فقط در همین مرورگر و رمزنگاری‌شده با رمز شما ذخیره می‌شود و هیچ‌جای دیگری فرستاده نمی‌شود جز api.github.com.</p>`;

function failedDelay() {
  const n = Number(sessionStorage.getItem(CFG.STORE.failed) || 0);
  return n ? Math.min(CFG.FAILED_LOGIN_BASE_DELAY_MS * 2 ** (n - 1), CFG.FAILED_LOGIN_MAX_DELAY_MS) : 0;
}

function renderLogin(message = '') {
  const vault = readVault();
  app.className = 'login';
  app.innerHTML = `
    <div class="login-card">
      <div class="brand"><span class="brand-mark">${ICONS.gear}</span><div><strong>EhsanNouri.de</strong><small>پنل مدیریت</small></div></div>
      ${message ? `<p class="login-msg">${esc(message)}</p>` : ''}
      ${
        vault
          ? `<form id="unlock" class="stack" autocomplete="off">
              <label class="lbl" for="pw">رمز عبور پنل</label>
              <input id="pw" type="password" autocomplete="current-password" required />
              <button class="btn btn-primary" type="submit">ورود</button>
              <p class="help">این دستگاه به گیت‌هاب <code>${esc(vault.login || '')}</code> وصل است.
                <button type="button" class="linkish" id="forget">قطع اتصال این دستگاه</button></p>
            </form>`
          : `<form id="connect" class="stack" autocomplete="off">
              <p class="help">اولین ورود در این دستگاه: یک توکن گیت‌هاب بدهید و یک رمز برای پنل انتخاب کنید. دفعه‌های بعد فقط رمز لازم است.</p>
              <label class="lbl" for="tok">توکن گیت‌هاب (Fine-grained)</label>
              <input id="tok" type="password" dir="ltr" autocomplete="off" spellcheck="false" placeholder="github_pat_…" required />
              <label class="lbl" for="pw1">رمز پنل (حداقل ${CFG.PASSWORD_MIN_LENGTH} کاراکتر)</label>
              <input id="pw1" type="password" autocomplete="new-password" minlength="${CFG.PASSWORD_MIN_LENGTH}" required />
              <label class="lbl" for="pw2">تکرار رمز</label>
              <input id="pw2" type="password" autocomplete="new-password" required />
              <button class="btn btn-primary" type="submit">اتصال</button>
              <details class="token-help"><summary>توکن را چطور بسازم؟</summary>${TOKEN_HELP}</details>
            </form>`
      }
    </div>`;

  $('#unlock')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = $('button[type=submit]', e.target);
    btn.disabled = true;
    await sleep(failedDelay());
    try {
      const token = await openVault($('#pw').value);
      sessionStorage.removeItem(CFG.STORE.failed);
      await startSession(token);
    } catch (err) {
      if (err?.name === 'OperationError') {
        sessionStorage.setItem(CFG.STORE.failed, String(Number(sessionStorage.getItem(CFG.STORE.failed) || 0) + 1));
        renderLogin('رمز اشتباه است.');
      } else renderLogin(explain(err));
    }
  });
  $('#forget')?.addEventListener('click', async () => {
    if (await confirmDlg('قطع اتصال این دستگاه', '<p>توکن ذخیره‌شده از این مرورگر پاک می‌شود. برای ورود دوباره باید توکن را وارد کنید.</p>', 'پاک کن', 'danger')) {
      forgetVault();
      renderLogin();
    }
  });
  $('#connect')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const token = $('#tok').value.trim();
    const p1 = $('#pw1').value;
    const p2 = $('#pw2').value;
    if (p1.length < CFG.PASSWORD_MIN_LENGTH) return toast(`رمز باید حداقل ${CFG.PASSWORD_MIN_LENGTH} کاراکتر باشد.`, 'error');
    if (p1 !== p2) return toast('رمزها یکی نیستند.', 'error');
    const btn = $('button[type=submit]', e.target);
    btn.disabled = true;
    btn.textContent = 'در حال بررسی توکن…';
    try {
      GH.setToken(token);
      const info = await checkAccess();
      await sealToken(token, p1, { login: info.login });
      await startSession(token);
    } catch (err) {
      GH.setToken('');
      btn.disabled = false;
      btn.textContent = 'اتصال';
      toast(explain(err), 'error');
    }
  });
  ($('#pw') || $('#tok'))?.focus();
}

function explain(err) {
  if (err?.status === 401) return 'توکن نامعتبر یا منقضی شده است. یک توکن جدید بسازید (قطع اتصال این دستگاه → اتصال دوباره).';
  if (err?.status === 403) return `گیت‌هاب اجازه نداد: ${err.message}`;
  if (err?.status === 404) return `توکن به مخزن ${CFG.REPO_OWNER}/${CFG.REPO_NAME} دسترسی ندارد.`;
  if (err?.message === 'no-push') return 'توکن اجازه نوشتن ندارد. در تنظیمات توکن: Contents → Read and write.';
  if (err instanceof TypeError) return 'اتصال به اینترنت یا api.github.com برقرار نشد.';
  return err?.message || String(err);
}

/** Token can read the repository and push to it. */
async function checkAccess() {
  const repo = await GH.getRepo();
  if (repo.permissions && repo.permissions.push === false) throw new Error('no-push');
  let login = '';
  try {
    login = (await GH.getUser()).login;
  } catch {
    /* fine-grained tokens without account access */
  }
  return { login, repo };
}

async function startSession(token) {
  S.token = token;
  GH.setToken(token);
  if (CFG.KEEP_SESSION_ON_RELOAD) sessionStorage.setItem(CFG.STORE.session, token);
  app.className = 'loading';
  app.innerHTML = '<div class="spinner"></div><p>در حال خواندن محتوا از گیت‌هاب…</p>';
  try {
    const info = await checkAccess();
    S.user = info.login;
    await loadRepo();
    await offerDraft();
    renderApp();
    startIdleLock();
  } catch (err) {
    sessionStorage.removeItem(CFG.STORE.session);
    renderLogin(explain(err));
  }
}

function lock(reason = '') {
  S.token = '';
  GH.setToken('');
  sessionStorage.removeItem(CFG.STORE.session);
  S.data = {};
  S.orig = {};
  media.setBase(new Map());
  clearInterval(lock.timer);
  renderLogin(reason);
}

function startIdleLock() {
  let last = Date.now();
  const bump = () => (last = Date.now());
  ['pointerdown', 'keydown', 'scroll'].forEach((ev) => window.addEventListener(ev, bump, { passive: true }));
  clearInterval(lock.timer);
  lock.timer = setInterval(() => {
    if (Date.now() - last > CFG.AUTO_LOCK_MINUTES * 60000 && !S.saving) lock('به‌دلیل عدم فعالیت قفل شد. تغییرات متنی در این مرورگر نگه داشته شده‌اند.');
  }, 30000);
}

// ============================================================
//  Repository content
// ============================================================
const media = createMedia({ fetchBlob: GH.getBlobRaw, toast });

function computeSaved() {
  const ids = (file) => new Set((safeParse(S.orig[file])?.items || []).map((x) => x.id));
  S.saved = { projects: ids(FILES.projects), certificates: ids(FILES.certificates), pages: ids(FILES.pages) };
}
function markNewItems() {
  S.newItems = new WeakSet();
  const mark = (file, set) => (S.data[file]?.items || []).forEach((x) => !set.has(x.id) && S.newItems.add(x));
  mark(FILES.projects, S.saved.projects);
  mark(FILES.certificates, S.saved.certificates);
  mark(FILES.pages, S.saved.pages);
}
function safeParse(text) {
  try {
    return text ? JSON.parse(text) : null;
  } catch {
    return null;
  }
}

async function loadRepo() {
  S.head = await GH.getHead();
  const { files, truncated } = await GH.getTree(S.head.tree);
  if (truncated) toast('فهرست فایل‌های مخزن ناقص خوانده شد (مخزن خیلی بزرگ است).', 'error');
  media.setBase(files);
  const texts = await Promise.all(CFG.CONTENT_FILES.map((p) => (files.has(p) ? GH.getBlobText(files.get(p).sha) : null)));
  CFG.CONTENT_FILES.forEach((p, i) => {
    S.orig[p] = texts[i];
    const parsed = safeParse(texts[i]);
    if (texts[i] && !parsed) toast(`فایل ${p} JSON معتبر نیست؛ در «ویرایش مستقیم JSON» درستش کنید.`, 'error');
    S.data[p] = parsed ?? clone(DEFAULTS[p] || {});
  });
  computeSaved();
  markNewItems();
}

const dirtyFiles = () => CFG.CONTENT_FILES.filter((p) => S.data[p] !== undefined && ser(S.data[p]) !== S.orig[p]);
const sectionOfFile = (p) => SECTIONS.find((s) => s.file === p)?.title || (p.startsWith('content/ui/') ? 'متن‌های رابط کاربری' : p);

// ---------- unsaved changes kept in this browser ----------
let draftTimer = null;
function scheduleDraft() {
  clearTimeout(draftTimer);
  draftTimer = setTimeout(saveDraft, CFG.DRAFT_SAVE_DELAY_MS);
}
function saveDraft() {
  try {
    const dirty = dirtyFiles();
    if (!dirty.length) localStorage.removeItem(CFG.STORE.draft);
    else localStorage.setItem(CFG.STORE.draft, JSON.stringify({ base: S.head?.sha, savedAt: Date.now(), files: Object.fromEntries(dirty.map((p) => [p, S.data[p]])) }));
    localStorage.setItem(CFG.STORE.preview, JSON.stringify({ savedAt: Date.now(), files: S.data }));
  } catch {
    toast('ذخیره موقت در مرورگر ممکن نشد (حافظه مرورگر پر است؟).', 'error');
  }
}
async function offerDraft() {
  const draft = safeParse(localStorage.getItem(CFG.STORE.draft));
  if (!draft?.files || !Object.keys(draft.files).length) return;
  const when = new Date(draft.savedAt).toLocaleString('fa-IR');
  const moved = draft.base && draft.base !== S.head.sha;
  const ok = await dialog({
    title: 'تغییرات ذخیره‌نشده',
    html: `<p>از ${esc(when)} تغییرات ذخیره‌نشده در این بخش‌ها پیدا شد:</p>
      <ul>${Object.keys(draft.files).map((p) => `<li>${esc(sectionOfFile(p))}</li>`).join('')}</ul>
      ${moved ? '<p class="warn">از آن زمان سایت در گیت‌هاب تغییر کرده است. بازیابی، نسخه این بخش‌ها را با نسخه پیش‌نویس جایگزین می‌کند.</p>' : ''}`,
    buttons: [
      { label: 'بازیابی', value: true, kind: 'primary' },
      { label: 'دور بریز', value: false, kind: 'danger' },
    ],
  });
  if (ok) {
    for (const [p, data] of Object.entries(draft.files)) if (CFG.CONTENT_FILES.includes(p)) S.data[p] = data;
    markNewItems();
  } else localStorage.removeItem(CFG.STORE.draft);
}

// ============================================================
//  App shell
// ============================================================
function renderApp() {
  app.className = 'app';
  app.innerHTML = `
    <aside class="side">
      <div class="brand"><span class="brand-mark">${ICONS.gear}</span><div><strong>EhsanNouri.de</strong><small>پنل مدیریت</small></div></div>
      <nav class="side-nav" id="side-nav"></nav>
      <div class="side-foot">
        <span class="who" dir="ltr">${esc(S.user ? `@${S.user}` : '')}</span>
        <button type="button" class="btn btn-ghost btn-sm" id="lock">قفل</button>
      </div>
    </aside>
    <div class="main-wrap">
      <header class="top">
        <h1 id="top-title"></h1>
        <span class="deploy" id="deploy" hidden></span>
        <a class="btn btn-ghost" id="preview" href="${CFG.SITE_URL}?preview" target="_blank" rel="noopener">پیش‌نمایش</a>
        <a class="btn btn-ghost hide-sm" href="${CFG.SITE_URL}" target="_blank" rel="noopener">سایت</a>
        <button type="button" class="btn btn-primary" id="save">ذخیره و انتشار</button>
      </header>
      <main id="main" tabindex="-1"></main>
    </div>`;
  $('#lock').addEventListener('click', async () => {
    if (media.count() && !(await confirmDlg('قفل پنل', '<p>فایل‌های آپلودشده هنوز ذخیره نشده‌اند و با قفل کردن از بین می‌روند.</p>', 'قفل کن', 'danger'))) return;
    lock();
  });
  $('#save').addEventListener('click', save);
  $('#preview').addEventListener('click', saveDraft);
  $('#side-nav').addEventListener('click', (e) => {
    const b = e.target.closest('[data-section]');
    if (!b) return;
    S.section = b.dataset.section;
    location.hash = S.section;
    renderSection({ scrollTop: true });
  });
  const fromHash = location.hash.slice(1);
  if (SECTIONS.some((s) => s.id === fromHash)) S.section = fromHash;
  wireMain();
  renderSection();
  renderDeploy();
}

function renderSide() {
  const dirty = new Set(dirtyFiles());
  $('#side-nav').innerHTML = SECTIONS.map((s) => {
    const isDirty = s.file ? dirty.has(s.file) : s.id === 'ui' ? [...dirty].some((p) => p.startsWith('content/ui/')) : false;
    return `<button type="button" data-section="${s.id}"${s.id === S.section ? ' aria-current="page"' : ''}>${ICONS[s.icon] || ICONS.doc}<span>${esc(s.title)}</span>${isDirty ? '<i class="dot" title="تغییر ذخیره‌نشده"></i>' : ''}</button>`;
  }).join('');
}

function updateCounts() {
  const n = dirtyFiles().length + media.count();
  const btn = $('#save');
  if (!btn) return;
  btn.disabled = S.saving || n === 0;
  btn.textContent = S.saving ? 'در حال ذخیره…' : n ? `ذخیره و انتشار (${n.toLocaleString('fa-IR')})` : 'ذخیره‌شده ✓';
  renderSide();
}

function changed() {
  updateCounts();
  scheduleDraft();
}

// ============================================================
//  Sections
// ============================================================
function makeCtx(file) {
  return {
    file,
    data: S.data,
    open: S.open,
    isNew: (it) => S.newItems.has(it),
    media,
    pageNavButton,
  };
}

function renderSection({ scrollTop = false } = {}) {
  const main = $('#main');
  const y = scrollTop ? 0 : window.scrollY;
  const sec = SECTIONS.find((s) => s.id === S.section) || SECTIONS[0];
  $('#top-title').textContent = sec.title;
  document.title = `${sec.title} · پنل مدیریت`;
  let body = '';
  if (sec.fields) {
    const form = createForm(makeCtx(sec.file));
    S.form = form;
    body = `<div class="grid">${form.render(sec.fields, S.data[sec.file] || (S.data[sec.file] = {}))}</div>`;
  } else if (sec.id === 'dashboard') body = dashboardHTML();
  else if (sec.id === 'ui') body = uiTextsHTML();
  else if (sec.id === 'raw') body = rawHTML();
  main.innerHTML = `
    <section class="sec">
      <header class="sec-head"><p class="sec-desc">${sec.desc || ''}</p></header>
      ${body}
    </section>`;
  media.hydrate(main);
  if (sec.id === 'dashboard') loadDashboardDeploy();
  updateCounts();
  window.scrollTo({ top: y, behavior: 'instant' });
}

// ---------- dashboard ----------
function dashboardHTML() {
  const dirty = dirtyFiles();
  const ops = media.summary();
  const fmt = (d) => (d ? new Date(d).toLocaleString('fa-IR') : '');
  const OPS = { add: 'آپلود', del: 'حذف', copy: 'جابه‌جایی' };
  return `
    <div class="cards">
      <article class="card">
        <h3>تغییرات ذخیره‌نشده</h3>
        ${
          dirty.length || ops.length
            ? `<ul class="changes">
                ${dirty.map((p) => `<li><b>${esc(sectionOfFile(p))}</b> <code dir="ltr">${esc(p)}</code></li>`).join('')}
                ${ops.map((o) => `<li>${OPS[o.kind]} <code dir="ltr">${esc(o.path)}</code></li>`).join('')}
              </ul>
              ${ops.length ? '<p class="warn">فایل‌های آپلودی تا وقتی ذخیره نشوند فقط در همین صفحه‌اند (با بستن صفحه از بین می‌روند).</p>' : ''}
              <div class="row"><button type="button" class="btn btn-primary" data-dash="save">ذخیره و انتشار</button>
              <button type="button" class="btn btn-ghost danger" data-dash="discard">دور ریختن همه تغییرات</button></div>`
            : '<p class="ok">همه چیز ذخیره و منتشر شده است.</p>'
        }
      </article>
      <article class="card">
        <h3>آخرین نسخه در گیت‌هاب</h3>
        <p class="mono-ish" dir="auto">${esc((S.head?.message || '').split('\n')[0])}</p>
        <p class="help">${esc(fmt(S.head?.date))} · <code dir="ltr">${esc(S.head?.sha?.slice(0, 7) || '')}</code></p>
        <div class="row">
          <a class="btn btn-ghost" href="${GH.repoWebUrl}" target="_blank" rel="noopener">مخزن</a>
          <a class="btn btn-ghost" href="${GH.repoWebUrl}/commits/${CFG.BRANCH}" target="_blank" rel="noopener">تاریخچه</a>
          <button type="button" class="btn btn-ghost" data-dash="reload">خواندن دوباره از گیت‌هاب</button>
        </div>
      </article>
      <article class="card">
        <h3>انتشار روی سرور</h3>
        <div id="dash-deploy"><p class="help">در حال بررسی…</p></div>
        <div class="row"><a class="btn btn-ghost" href="${GH.repoWebUrl}/actions" target="_blank" rel="noopener">GitHub Actions</a></div>
      </article>
      <article class="card card-wide">
        <h3>راهنمای سریع</h3>
        <ol class="steps">
          <li>از منوی کناری بخش موردنظر را باز کنید و متن‌ها را در هر سه زبان (FA / EN / DE) ویرایش کنید. خالی گذاشتن یک زبان = نمایش متن انگلیسی.</li>
          <li><b>منو و زیرمنو:</b> ترتیب، نام، مخفی‌کردن و زیرمنوها. صفحه‌های جدید را در «صفحه‌ها» بسازید و با دکمه «افزودن به منو» به منو اضافه کنید.</li>
          <li><b>پروژه‌ها و گواهینامه‌ها:</b> عکس، ویدیو، اسکن و PDF را همان‌جا آپلود کنید.</li>
          <li>«پیش‌نمایش» سایت را با تغییرات ذخیره‌نشده (فقط متن) در همین مرورگر نشان می‌دهد.</li>
          <li>«ذخیره و انتشار» همه تغییرات را در یک commit به گیت‌هاب می‌فرستد؛ حدود ۱ تا ۲ دقیقه بعد سایت به‌روز است.</li>
        </ol>
      </article>
    </div>`;
}

async function loadDashboardDeploy() {
  const box = $('#dash-deploy');
  if (!box) return;
  try {
    const run = await GH.latestRun();
    if (!box.isConnected) return;
    box.innerHTML = run
      ? `<p>${deployBadge(run.status, run.conclusion)}</p><p class="help" dir="auto">${esc(run.display_title || '')} · ${esc(new Date(run.created_at).toLocaleString('fa-IR'))}</p>
         <p><a href="${esc(run.html_url)}" target="_blank" rel="noopener">جزئیات اجرا</a></p>`
      : '<p class="help">هنوز اجرایی ثبت نشده است.</p>';
  } catch (err) {
    if (box.isConnected) box.innerHTML = `<p class="help">وضعیت قابل خواندن نیست (${err.status === 403 ? 'توکن دسترسی Actions: Read-only ندارد' : esc(err.message)}).</p>`;
  }
}

function deployBadge(status, conclusion) {
  if (status !== 'completed') return '<span class="pill pill-run">⏳ در حال ساخت و انتشار…</span>';
  if (conclusion === 'success') return '<span class="pill pill-ok">✓ منتشر شد</span>';
  return `<span class="pill pill-err">✗ ناموفق (${esc(conclusion || '')})</span>`;
}

// ---------- interface strings: content/ui/<lang>.json, all three side by side ----------
function uiTextsHTML() {
  const form = createForm(makeCtx(null));
  S.form = form;
  const leaves = [];
  const walk = (node, path) => {
    for (const [k, v] of Object.entries(node || {})) {
      if (v && typeof v === 'object' && !Array.isArray(v)) walk(v, [...path, k]);
      else leaves.push([...path, k]);
    }
  };
  walk(S.data['content/ui/en.json'], []);
  return `<div class="ui-table">${leaves
    .map((path) => {
      const cells = LANGS.map((l) => {
        const file = `content/ui/${l}.json`;
        const b = form.binds.push({ file, path, spec: { type: 'text' } }) - 1;
        return `<div class="ml-cell"><span class="lang-tag">${l.toUpperCase()}</span><input type="text" data-b="${b}" dir="${LANG_DIR[l]}" lang="${l}" value="${esc(getAt(S.data[file], path) ?? '')}" /></div>`;
      }).join('');
      return `<div class="field ml wide"><label class="lbl" dir="ltr">${esc(path.join('.'))}</label><div class="ml-row">${cells}</div></div>`;
    })
    .join('')}</div>`;
}

// ---------- raw JSON ----------
let rawFile = CFG.CONTENT_FILES[0];
function rawHTML() {
  S.form = null;
  return `
    <div class="raw">
      <div class="row">
        <select id="raw-file">${CFG.CONTENT_FILES.map((p) => `<option${p === rawFile ? ' selected' : ''}>${esc(p)}</option>`).join('')}</select>
        <button type="button" class="btn btn-primary" data-raw="apply">اعمال تغییرات</button>
        <button type="button" class="btn btn-ghost" data-raw="revert">بازگشت به نسخه گیت‌هاب</button>
      </div>
      <textarea id="raw-text" class="mono" dir="ltr" spellcheck="false" rows="30">${esc(ser(S.data[rawFile]))}</textarea>
      <p class="help">بعد از «اعمال»، تغییرات مثل بقیه بخش‌ها با «ذخیره و انتشار» فرستاده می‌شوند.</p>
    </div>`;
}

// ---------- page -> menu ----------
function navHasPage(id) {
  const items = S.data[FILES.nav]?.items || [];
  return items.some((i) => (i.type === 'page' && i.target === id) || (i.children || []).some((k) => k.type === 'page' && k.target === id));
}
function pageNavButton(page) {
  if (!page?.id) return '';
  return navHasPage(page.id)
    ? '<p class="ok small">✓ این صفحه در منو هست (بخش «منو و زیرمنو»).</p>'
    : `<button type="button" class="btn btn-ghost" data-act="page-to-nav" data-id="${esc(page.id)}">＋ افزودن این صفحه به منوی بالا</button>`;
}

// ============================================================
//  Events of the editor
// ============================================================
function wireMain() {
  const main = $('#main');

  const applyBind = (el, evType) => {
    const b = S.form?.binds[Number(el.dataset.b)];
    if (!b) return;
    const spec = b.spec;
    const parse = PARSE[spec.type] || PARSE.text;
    const v = parse(el.value, el);
    const data = S.data[b.file];
    const old = getAt(data, b.path);
    setAt(data, b.path, v);
    if (spec.onChange && (evType === 'change' || spec.type !== 'select')) spec.onChange(makeCtx(b.file), { parent: b.parent, oldValue: old, newValue: v });
    if (el.dataset.md) {
      const box = el.parentElement.querySelector('.md-preview .prose');
      if (box) box.innerHTML = md(el.value);
    }
    changed();
    if (evType === 'change' && (spec.rerender || spec.onChange)) renderSection();
  };

  main.addEventListener('input', (e) => {
    const el = e.target;
    if (el.matches('[data-b]') && !el.matches('select, input[type=checkbox]')) applyBind(el, 'input');
  });
  main.addEventListener('change', async (e) => {
    const el = e.target;
    if (el.matches('[data-b]')) return applyBind(el, 'change');
    if (el.matches('[data-mupload]')) return handleUpload(el);
    if (el.id === 'raw-file') {
      rawFile = el.value;
      renderSection();
    }
  });
  main.addEventListener(
    'toggle',
    (e) => {
      const d = e.target;
      if (!d.dataset?.openKey) return;
      if (d.open) S.open.add(d.dataset.openKey);
      else S.open.delete(d.dataset.openKey);
    },
    true
  );
  main.addEventListener('click', async (e) => {
    const act = e.target.closest('[data-act]');
    if (act) {
      e.preventDefault();
      return arrayAction(act);
    }
    const m = e.target.closest('[data-mact]');
    if (m) {
      e.preventDefault();
      const path = m.dataset.path;
      if (m.dataset.mact === 'del' && !(await confirmDlg('حذف فایل', `<p dir="ltr"><code>${esc(path)}</code></p><p>با «ذخیره و انتشار» از سایت هم حذف می‌شود.</p>`, 'حذف', 'danger'))) return;
      if (path.startsWith(`${CFG.PROJECT_MEDIA_DIR}/`)) media.projectAction(m.dataset.mact, path);
      else media.remove(path);
      changed();
      return renderSection();
    }
    const dash = e.target.closest('[data-dash]');
    if (dash) return dashAction(dash.dataset.dash);
    const raw = e.target.closest('[data-raw]');
    if (raw) return rawAction(raw.dataset.raw);
  });
}

async function arrayAction(btn) {
  const actName = btn.dataset.act;
  if (actName === 'page-to-nav') {
    const page = (S.data[FILES.pages].items || []).find((p) => p.id === btn.dataset.id);
    if (!page) return;
    (S.data[FILES.nav].items ||= []).push({
      id: uid('nav'),
      type: 'page',
      target: page.id,
      label: clone(page.title),
      icon: page.icon || 'doc',
      visible: true,
      dock: false,
      tile: true,
      tileText: clone(page.summary) || { fa: '', en: '', de: '' },
      children: [],
    });
    toast('به انتهای منو اضافه شد. ترتیبش را در «منو و زیرمنو» تنظیم کنید.');
    changed();
    return renderSection();
  }
  const a = S.form?.arrays[Number(btn.dataset.arr)];
  if (!a) return;
  const data = S.data[a.file];
  let list = getAt(data, a.path);
  if (!Array.isArray(list)) {
    list = [];
    setAt(data, a.path, list);
  }
  const i = Number(btn.dataset.i);
  const keyOf = (n) => `${a.file}:${a.path.join('.')}.${n}`;
  const swapOpen = (x, y) => {
    const ox = S.open.has(keyOf(x));
    const oy = S.open.has(keyOf(y));
    S.open[oy ? 'add' : 'delete'](keyOf(x));
    S.open[ox ? 'add' : 'delete'](keyOf(y));
  };
  const ctx = makeCtx(a.file);
  switch (actName) {
    case 'add': {
      const item = a.spec.item.create(ctx);
      list.push(item);
      if (item && typeof item === 'object') S.newItems.add(item);
      S.open.add(keyOf(list.length - 1));
      break;
    }
    case 'del': {
      const title = a.spec.item.title ? a.spec.item.title(list[i], i, ctx) : `#${i + 1}`;
      const extra = a.file === FILES.projects && a.path.join('.') === 'items' ? '<p class="warn">عکس‌ها و ویدیوهای این پروژه هم با ذخیره حذف می‌شوند.</p>' : a.file === FILES.certificates && a.path.join('.') === 'items' ? '<p class="warn">اسکن و PDF این گواهینامه هم با ذخیره حذف می‌شوند.</p>' : '';
      if (!(await confirmDlg('حذف', `<p>«${esc(title)}» حذف شود؟</p>${extra}`, 'حذف', 'danger'))) return;
      list.splice(i, 1);
      [...S.open].filter((k) => k.startsWith(`${a.file}:${a.path.join('.')}.`)).forEach((k) => S.open.delete(k));
      break;
    }
    case 'up':
    case 'down': {
      const j = actName === 'up' ? i - 1 : i + 1;
      if (j < 0 || j >= list.length) return;
      [list[i], list[j]] = [list[j], list[i]];
      swapOpen(i, j);
      break;
    }
    case 'dup': {
      const copy = clone(list[i]);
      if (copy && typeof copy === 'object' && 'id' in copy) {
        let n = 2;
        const ids = new Set(list.map((x) => x.id));
        const base = String(copy.id).replace(/-\d+$/, '');
        while (ids.has(`${base}-${n}`)) n++;
        copy.id = `${base}-${n}`;
      }
      list.splice(i + 1, 0, copy);
      if (copy && typeof copy === 'object') S.newItems.add(copy);
      S.open.add(keyOf(i + 1));
      break;
    }
    default:
      return;
  }
  changed();
  renderSection();
}

function handleUpload(input) {
  const files = [...(input.files || [])];
  if (!files.length) return;
  const kind = input.dataset.mupload;
  let n = 0;
  if (kind === 'project') n = media.uploadProject(input.dataset.id, files);
  else if (kind === 'cert-image') n = media.uploadCert(input.dataset.id, files[0], 'image');
  else if (kind === 'cert-pdf') n = media.uploadCert(input.dataset.id, files[0], 'pdf');
  else if (kind === 'public') {
    const sec = SECTIONS.find((s) => s.id === S.section);
    const path = JSON.parse(input.dataset.path);
    const next = media.uploadPublic(input.dataset.current, files[0], input.dataset.kind);
    if (next) {
      setAt(S.data[sec.file], path, next);
      n = 1;
    }
  }
  if (n) toast(`${n.toLocaleString('fa-IR')} فایل اضافه شد. برای انتشار «ذخیره» را بزنید.`);
  changed();
  renderSection();
}

async function dashAction(what) {
  if (what === 'save') return save();
  if (what === 'reload' || what === 'discard') {
    const has = dirtyFiles().length || media.count();
    if (has && !(await confirmDlg(what === 'discard' ? 'دور ریختن تغییرات' : 'خواندن دوباره', '<p>همه تغییرات ذخیره‌نشده از بین می‌روند.</p>', 'ادامه', 'danger'))) return;
    localStorage.removeItem(CFG.STORE.draft);
    app.classList.add('busy');
    try {
      await loadRepo();
      localStorage.removeItem(CFG.STORE.preview);
      toast('محتوا از گیت‌هاب خوانده شد.');
    } catch (err) {
      toast(explain(err), 'error');
    }
    app.classList.remove('busy');
    renderSection();
  }
}

function rawAction(what) {
  if (what === 'revert') {
    const orig = safeParse(S.orig[rawFile]);
    S.data[rawFile] = orig ?? clone(DEFAULTS[rawFile] || {});
    markNewItems();
    changed();
    return renderSection();
  }
  try {
    S.data[rawFile] = JSON.parse($('#raw-text').value);
    markNewItems();
    changed();
    toast('اعمال شد.');
    renderSection();
  } catch (err) {
    toast(`JSON نامعتبر: ${err.message}`, 'error');
  }
}

// ============================================================
//  Validation, save, deploy
// ============================================================
function validate() {
  const errs = [];
  const P = S.data[FILES.projects] || {};
  const X = S.data[FILES.certificates] || {};
  const G = S.data[FILES.pages] || {};
  const N = S.data[FILES.nav] || {};
  const ids = (list, what) => {
    const seen = new Set();
    for (const it of list || []) {
      if (!it?.id || !SLUG.test(it.id)) errs.push(`${what}: شناسه «${it?.id ?? ''}» نامعتبر است (فقط a-z، 0-9 و -).`);
      else if (seen.has(it.id)) errs.push(`${what}: شناسه «${it.id}» تکراری است.`);
      seen.add(it.id);
    }
    return seen;
  };
  ids(P.items, 'پروژه‌ها');
  const cats = ids(P.categories, 'دسته‌های پروژه');
  ids(X.items, 'گواهینامه‌ها');
  const groups = ids(X.groups, 'گروه‌های گواهینامه');
  const issuers = ids(X.issuers, 'صادرکننده‌ها');
  const pages = ids(G.items, 'صفحه‌ها');
  for (const p of P.items || []) if (!cats.has(p.cat)) errs.push(`پروژه «${pick(p.title) || p.id}»: دسته «${p.cat}» وجود ندارد.`);
  for (const c of X.items || []) {
    if (!groups.has(c.group)) errs.push(`گواهینامه «${pick(c.title) || c.id}»: گروه «${c.group}» وجود ندارد.`);
    if (!issuers.has(c.issuer)) errs.push(`گواهینامه «${pick(c.title) || c.id}»: صادرکننده «${c.issuer}» وجود ندارد.`);
  }
  const pIds = new Set((P.items || []).map((x) => x.id));
  const xIds = new Set((X.items || []).map((x) => x.id));
  const checkNav = (it, where) => {
    const name = `${where} «${pick(it.label) || '—'}»`;
    if (!pick(it.label)) errs.push(`${name}: عنوان ندارد.`);
    if (it.type === 'section' && !SECTION_IDS.includes(it.target)) errs.push(`${name}: بخش نامعتبر.`);
    if (it.type === 'page' && !pages.has(it.target)) errs.push(`${name}: صفحه «${it.target}» وجود ندارد.`);
    if (it.type === 'project' && !pIds.has(it.target)) errs.push(`${name}: پروژه انتخاب نشده.`);
    if (it.type === 'certificate' && !xIds.has(it.target)) errs.push(`${name}: گواهینامه انتخاب نشده.`);
    if (it.type === 'url' && !/^(https?:\/\/|mailto:|tel:)/.test(it.href || '')) errs.push(`${name}: آدرس باید با https:// شروع شود.`);
  };
  for (const it of N.items || []) {
    checkNav(it, 'منو');
    for (const k of it.children || []) checkNav(k, 'زیرمنو');
  }
  const site = S.data[FILES.site] || {};
  if (site.cv?.enabled && site.cv?.file && !media.entry(`${CFG.PUBLIC_DIR}/${site.cv.file}`)) errs.push('تنظیمات: دکمه رزومه روشن است ولی فایل رزومه وجود ندارد.');
  return errs;
}

async function save() {
  if (S.saving) return;
  const errs = validate();
  if (errs.length) {
    await dialog({ title: 'اول این موارد را درست کنید', html: `<ul class="errs">${errs.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>` });
    return;
  }
  const dirty = dirtyFiles();
  const projectIds = (S.data[FILES.projects]?.items || []).map((x) => x.id);
  const certIds = (S.data[FILES.certificates]?.items || []).map((x) => x.id);
  // files of deleted projects / certificates are removed in the same commit
  media.orphans(projectIds, certIds).forEach((p) => media.remove(p));
  const changes = [...dirty.map((p) => ({ path: p, text: ser(S.data[p]) })), ...media.changes()];
  if (!changes.length) return toast('تغییری برای ذخیره نیست.');

  const sectionsTouched = [...new Set(dirty.map(sectionOfFile))];
  const defaultMsg = `admin: ${[...new Set(dirty.map((p) => p.replace(/^content\//, '').replace(/\.json$/, '')))].join(', ') || 'media'}${media.count() ? ' + media' : ''}`;
  const uploads = changes.filter((c) => c.file);
  const message = await dialog({
    title: 'ذخیره و انتشار',
    html: `
      <ul class="changes">
        ${sectionsTouched.map((s) => `<li>✎ ${esc(s)}</li>`).join('')}
        ${changes.filter((c) => !c.text).map((c) => `<li>${c.remove ? '✕ حذف' : c.file ? '⬆ آپلود' : '↔ جابه‌جایی'} <code dir="ltr">${esc(c.path)}</code></li>`).join('')}
      </ul>
      ${uploads.length ? `<p class="help">حجم آپلود: ${(uploads.reduce((s, c) => s + c.file.size, 0) / 1048576).toFixed(1)} MB</p>` : ''}
      <label class="lbl" for="msg">توضیح این تغییر (commit message)</label>
      <input id="msg" name="msg" dir="ltr" value="${esc(defaultMsg)}" />`,
    buttons: [
      { label: 'ذخیره و انتشار', kind: 'primary', value: (form) => form.elements.msg.value.trim() || defaultMsg },
      { label: 'انصراف', value: null },
    ],
  });
  if (!message) return;

  S.saving = true;
  updateCounts();
  const btn = $('#save');
  try {
    const head = await GH.getHead();
    if (head.sha !== S.head.sha) {
      const remote = await GH.changedSince(S.head.sha, head.sha);
      const clash = changes.map((c) => c.path).filter((p) => remote.has(p));
      if (
        clash.length &&
        !(await confirmDlg(
          'در این فاصله در گیت‌هاب تغییر کرده',
          `<p>این فایل‌ها بعد از باز کردن پنل در گیت‌هاب هم تغییر کرده‌اند:</p><ul>${clash.map((p) => `<li><code dir="ltr">${esc(p)}</code></li>`).join('')}</ul><p>ادامه = نسخه شما جایگزین می‌شود.</p>`,
          'جایگزین کن',
          'danger'
        ))
      )
        throw new Error('cancel');
    }
    const result = await GH.commitChanges({
      parentSha: head.sha,
      parentTree: head.tree,
      message,
      changes,
      onProgress: (d, t) => btn && (btn.textContent = `در حال ارسال… ${d.toLocaleString('fa-IR')}/${t.toLocaleString('fa-IR')}`),
    });
    localStorage.removeItem(CFG.STORE.draft);
    localStorage.removeItem(CFG.STORE.preview);
    toast('ذخیره شد. سایت تا چند دقیقه به‌روز می‌شود.', 'ok');
    await loadRepo();
    pollDeploy(result.sha);
  } catch (err) {
    if (err.message !== 'cancel') {
      if (err.status === 422 || err.status === 409) toast('گیت‌هاب در همین لحظه تغییر کرد. دوباره «ذخیره» را بزنید.', 'error');
      else toast(`ذخیره نشد: ${explain(err)}`, 'error');
    }
  } finally {
    S.saving = false;
    renderSection();
  }
}

async function pollDeploy(sha) {
  S.deploy = { sha, status: 'queued' };
  renderDeploy();
  const until = Date.now() + CFG.DEPLOY_POLL_MAX_MINUTES * 60000;
  while (Date.now() < until && S.deploy?.sha === sha && S.token) {
    await sleep(CFG.DEPLOY_POLL_MS);
    try {
      const run = await GH.runForCommit(sha);
      if (run) S.deploy = { sha, status: run.status, conclusion: run.conclusion, url: run.html_url };
      renderDeploy();
      if (run?.status === 'completed') {
        toast(run.conclusion === 'success' ? 'سایت منتشر شد ✓' : 'انتشار ناموفق بود؛ جزئیات در GitHub Actions.', run.conclusion === 'success' ? 'ok' : 'error');
        return;
      }
    } catch {
      S.deploy = { sha, status: 'unknown' };
      renderDeploy();
      return;
    }
  }
}

function renderDeploy() {
  const el = $('#deploy');
  if (!el) return;
  const d = S.deploy;
  el.hidden = !d;
  if (!d) return;
  const badge = d.status === 'unknown' ? '<span class="pill">ذخیره شد · وضعیت انتشار نامعلوم</span>' : deployBadge(d.status, d.conclusion);
  el.innerHTML = d.url ? `<a href="${esc(d.url)}" target="_blank" rel="noopener">${badge}</a>` : badge;
}

// ============================================================
//  Boot
// ============================================================
window.addEventListener('beforeunload', (e) => {
  if (media.count() || S.saving) {
    e.preventDefault();
    e.returnValue = '';
  }
});

(async () => {
  const token = CFG.KEEP_SESSION_ON_RELOAD ? sessionStorage.getItem(CFG.STORE.session) : null;
  if (token && readVault()) await startSession(token);
  else renderLogin();
})();
