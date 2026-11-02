// ============================================================
//  Files (photos, videos, scans, PDF): a virtual view of the
//  repository = files in the last commit + staged changes.
//  Nothing is uploaded until "Save"; then everything goes into
//  the same commit as the text changes.
// ============================================================
import { esc } from './forms.js';
import { MAX_UPLOAD_MB, IMAGE_TYPES, VIDEO_TYPES, THUMB_CONCURRENCY, PROJECT_MEDIA_DIR, CERT_MEDIA_DIR, PUBLIC_DIR } from './config.js';

const extOf = (name) => (/\.([a-z0-9]+)$/i.exec(name)?.[1] || '').toLowerCase();
const baseName = (p) => p.split('/').pop();
const stem = (n) => n.replace(/\.[^.]+$/, '');
const pad = (n) => String(n).padStart(2, '0');
const isImage = (p) => IMAGE_TYPES.includes(extOf(p));
const isVideo = (p) => VIDEO_TYPES.includes(extOf(p));
const fmtSize = (b) => (b == null ? '' : b > 1048576 ? `${(b / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1024))} KB`);
const byName = (a, b) => a.name.localeCompare(b.name, undefined, { numeric: true });

export function slugFile(name) {
  const ext = extOf(name).replace('jpeg', 'jpg');
  const s = stem(name)
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);
  return `${s || 'file'}.${ext}`;
}

export function createMedia({ fetchBlob, onChange, toast }) {
  let base = new Map(); // path -> { sha, size }
  const ops = new Map(); // path -> { kind: 'add', file, url } | { kind: 'del' } | { kind: 'copy', sha, size }
  const thumbs = new Map(); // sha -> object URL
  let queue = [];
  let running = 0;

  // ---------- virtual file system ----------
  function entry(path) {
    const op = ops.get(path);
    if (op) {
      if (op.kind === 'del') return null;
      if (op.kind === 'add') return { path, name: baseName(path), file: op.file, url: op.url, size: op.file.size, staged: true };
      return { path, name: baseName(path), sha: op.sha, size: op.size, staged: true };
    }
    const b = base.get(path);
    return b ? { path, name: baseName(path), sha: b.sha, size: b.size, staged: false } : null;
  }
  function list(prefix, { all = false } = {}) {
    const paths = new Set([...base.keys(), ...ops.keys()].filter((p) => p.startsWith(prefix)));
    return [...paths]
      .map(entry)
      .filter((e) => e && (all || e.name !== '.gitkeep'))
      .sort(byName);
  }
  function add(path, file) {
    const old = ops.get(path);
    if (old?.url) URL.revokeObjectURL(old.url);
    ops.set(path, { kind: 'add', file, url: URL.createObjectURL(file) });
  }
  function remove(path) {
    const old = ops.get(path);
    if (old?.url && old.kind === 'add') URL.revokeObjectURL(old.url);
    if (base.has(path)) ops.set(path, { kind: 'del' });
    else ops.delete(path);
  }
  /** Move a set of entries to new paths in one go (no clashes between them). */
  function moveMany(pairs) {
    const snap = pairs.map(([from, to]) => [entry(from), to]).filter(([e, to]) => e && e.path !== to);
    for (const [e] of snap) {
      const op = ops.get(e.path);
      if (op?.kind === 'add') ops.delete(e.path); // keep its object URL for the new path
      else if (base.has(e.path)) ops.set(e.path, { kind: 'del' });
      else ops.delete(e.path);
    }
    for (const [e, to] of snap) {
      if (e.file) ops.set(to, { kind: 'add', file: e.file, url: e.url });
      else if (base.get(to)?.sha === e.sha) ops.delete(to);
      else ops.set(to, { kind: 'copy', sha: e.sha, size: e.size });
    }
  }

  function checkFile(file, allowed) {
    const ext = extOf(file.name);
    if (!allowed.includes(ext)) {
      toast(`نوع فایل «${ext || '؟'}» پشتیبانی نمی‌شود. مجاز: ${allowed.join(', ')}`, 'error');
      return false;
    }
    if (file.size > MAX_UPLOAD_MB * 1048576) {
      toast(`«${file.name}» بزرگ‌تر از ${MAX_UPLOAD_MB} مگابایت است. ویدیو را کوچک کنید یا در یوتیوب بگذارید.`, 'error');
      return false;
    }
    return true;
  }

  // ---------- thumbnails ----------
  function pump() {
    while (running < THUMB_CONCURRENCY && queue.length) {
      const { img, sha, path } = queue.shift();
      running++;
      fetchBlob(sha)
        .then((blob) => {
          const type = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp', avif: 'image/avif', gif: 'image/gif' }[extOf(path)];
          const url = URL.createObjectURL(type ? new Blob([blob], { type }) : blob);
          thumbs.set(sha, url);
          if (img.isConnected) img.src = url;
        })
        .catch(() => img.classList.add('thumb-failed'))
        .finally(() => {
          running--;
          pump();
        });
    }
  }
  /** Fill <img data-thumb> inside root (called after each render). */
  function hydrate(root) {
    root.querySelectorAll('img[data-thumb]').forEach((img) => {
      if (img.getAttribute('src')) return;
      const e = entry(img.dataset.thumb);
      if (!e) return;
      if (e.url) img.src = e.url;
      else if (thumbs.has(e.sha)) img.src = thumbs.get(e.sha);
      else queue.push({ img, sha: e.sha, path: e.path });
    });
    pump();
  }

  // ---------- projects: media/projects/<id>/ ----------
  const projDir = (id) => `${PROJECT_MEDIA_DIR}/${id}/`;
  function projectWidget(p) {
    if (!p?.id) return '';
    const files = list(projDir(p.id));
    const tiles = files
      .map((f, i) => {
        const cover = /^cover\./i.test(f.name);
        const visual = isImage(f.name)
          ? `<img data-thumb="${esc(f.path)}" alt="" />`
          : `<span class="vid">▶ ${esc(extOf(f.name).toUpperCase())}</span>`;
        return `
        <figure class="mtile${cover ? ' is-cover' : ''}${f.staged ? ' is-staged' : ''}">
          <div class="mthumb">${visual}${cover ? '<span class="badge">کاور</span>' : ''}${f.staged ? '<span class="badge badge-new">ذخیره‌نشده</span>' : ''}</div>
          <figcaption dir="ltr">${esc(f.name)} <small>${fmtSize(f.size)}</small></figcaption>
          <div class="mtools">
            ${isImage(f.name) && !cover ? `<button type="button" class="tool" data-mact="cover" data-path="${esc(f.path)}" title="کاور کارت پروژه">★</button>` : ''}
            <button type="button" class="tool" data-mact="left" data-path="${esc(f.path)}" title="جلوتر"${i === 0 ? ' disabled' : ''}>◀</button>
            <button type="button" class="tool" data-mact="right" data-path="${esc(f.path)}" title="عقب‌تر"${i === files.length - 1 ? ' disabled' : ''}>▶</button>
            <button type="button" class="tool tool-del" data-mact="del" data-path="${esc(f.path)}" title="حذف">✕</button>
          </div>
        </figure>`;
      })
      .join('');
    return `
      <div class="media">
        <div class="mgrid">${tiles || '<p class="empty">هنوز عکس یا ویدیویی نیست. تا وقتی عکس نباشد، یک طرح خودکار نمایش داده می‌شود.</p>'}</div>
        <label class="btn btn-ghost upload">＋ آپلود عکس / ویدیو
          <input type="file" multiple accept="image/*,video/mp4,video/webm,video/quicktime" data-mupload="project" data-id="${esc(p.id)}" hidden />
        </label>
        <p class="help">ترتیب نمایش = ترتیب نام فایل‌ها. ★ = عکس کارت پروژه. حداکثر ${MAX_UPLOAD_MB} مگابایت برای هر فایل؛ عکس‌ها را زیر ۲۵۰۰ پیکسل عرض نگه دارید.</p>
      </div>`;
  }
  function renumber(dir, ordered) {
    let n = 0;
    moveMany(
      ordered.map((f) => {
        if (/^cover\./i.test(f.name)) return [f.path, f.path];
        n++;
        return [f.path, `${dir}${pad(n)}-${stem(f.name).replace(/^\d+[-_]/, '')}.${extOf(f.name)}`];
      })
    );
  }
  function uploadProject(id, fileList) {
    const dir = projDir(id);
    let max = Math.max(0, ...list(dir).map((f) => Number(/^(\d+)[-_]/.exec(f.name)?.[1] || 0)));
    let n = 0;
    for (const file of fileList) {
      if (!checkFile(file, [...IMAGE_TYPES, ...VIDEO_TYPES])) continue;
      let name = `${pad(++max)}-${slugFile(file.name)}`;
      while (entry(dir + name)) name = `${pad(++max)}-${slugFile(file.name)}`;
      add(dir + name, file);
      n++;
    }
    return n;
  }
  function projectAction(act, path) {
    const dir = path.slice(0, path.lastIndexOf('/') + 1);
    const files = list(dir);
    const i = files.findIndex((f) => f.path === path);
    if (i < 0) return;
    if (act === 'del') return remove(path);
    if (act === 'left' || act === 'right') {
      const j = act === 'left' ? i - 1 : i + 1;
      if (j < 0 || j >= files.length) return;
      const order = [...files];
      [order[i], order[j]] = [order[j], order[i]];
      return renumber(dir, order);
    }
    if (act === 'cover') {
      const pairs = [];
      const old = files.find((f) => /^cover\./i.test(f.name));
      const others = files.filter((f) => f !== old && f.path !== path);
      const maxN = Math.max(0, ...others.map((f) => Number(/^(\d+)[-_]/.exec(f.name)?.[1] || 0)));
      if (old) pairs.push([old.path, `${dir}${pad(maxN + 1)}-former-cover.${extOf(old.name)}`]);
      pairs.push([path, `${dir}cover.${extOf(path)}`]);
      return moveMany(pairs);
    }
  }
  function renameProject(oldId, newId) {
    if (!oldId || !newId || oldId === newId) return;
    moveMany(list(projDir(oldId), { all: true }).map((f) => [f.path, projDir(newId) + f.name]));
  }

  // ---------- certificates: media/certificates/<id>.<ext> ----------
  const certFiles = (id) => list(`${CERT_MEDIA_DIR}/${id}.`);
  function certWidget(c) {
    if (!c?.id) return '';
    const files = certFiles(c.id);
    const img = files.find((f) => isImage(f.name));
    const pdf = files.find((f) => extOf(f.name) === 'pdf');
    return `
      <div class="media media-cert">
        <div class="slot">
          <div class="mthumb">${img ? `<img data-thumb="${esc(img.path)}" alt="" />${img.staged ? '<span class="badge badge-new">ذخیره‌نشده</span>' : ''}` : '<span class="vid">بدون اسکن</span>'}</div>
          <div class="slot-tools">
            <label class="btn btn-ghost">${img ? 'جایگزینی تصویر' : '＋ آپلود تصویر اسکن'}<input type="file" accept="image/*" data-mupload="cert-image" data-id="${esc(c.id)}" hidden /></label>
            ${img ? `<button type="button" class="btn btn-ghost danger" data-mact="del" data-path="${esc(img.path)}">حذف</button>` : ''}
          </div>
        </div>
        <div class="slot">
          <div class="mthumb pdf">${pdf ? `PDF<small dir="ltr">${fmtSize(pdf.size)}</small>${pdf.staged ? '<span class="badge badge-new">ذخیره‌نشده</span>' : ''}` : '<span class="vid">بدون PDF</span>'}</div>
          <div class="slot-tools">
            <label class="btn btn-ghost">${pdf ? 'جایگزینی PDF' : '＋ آپلود PDF'}<input type="file" accept="application/pdf" data-mupload="cert-pdf" data-id="${esc(c.id)}" hidden /></label>
            ${pdf ? `<button type="button" class="btn btn-ghost danger" data-mact="del" data-path="${esc(pdf.path)}">حذف</button>` : ''}
          </div>
        </div>
      </div>
      <p class="help">تصویر روی حلقه سه‌بعدی نمایش داده می‌شود؛ PDF با دکمه «باز کردن PDF».</p>`;
  }
  function uploadCert(id, file, kind) {
    const allowed = kind === 'pdf' ? ['pdf'] : IMAGE_TYPES;
    if (!checkFile(file, allowed)) return 0;
    const ext = extOf(file.name).replace('jpeg', 'jpg');
    for (const f of certFiles(id)) if (kind === 'pdf' ? extOf(f.name) === 'pdf' : isImage(f.name)) remove(f.path);
    add(`${CERT_MEDIA_DIR}/${id}.${ext}`, file);
    return 1;
  }
  function renameCert(oldId, newId) {
    if (!oldId || !newId || oldId === newId) return;
    moveMany(certFiles(oldId).map((f) => [f.path, `${CERT_MEDIA_DIR}/${newId}.${extOf(f.name)}`]));
  }

  // ---------- single files in /public (photo, CV) ----------
  function publicFileWidget(value, path, kind) {
    const repoPath = value ? `${PUBLIC_DIR}/${value}` : '';
    const e = repoPath ? entry(repoPath) : null;
    const accept = kind === 'pdf' ? 'application/pdf' : 'image/*';
    const visual = !e
      ? '<span class="vid">فایلی نیست</span>'
      : kind === 'image'
        ? `<img data-thumb="${esc(e.path)}" alt="" />`
        : `PDF<small dir="ltr">${fmtSize(e.size)}</small>`;
    return `
      <div class="media media-public">
        <div class="slot">
          <div class="mthumb${kind === 'pdf' ? ' pdf' : ''}">${visual}${e?.staged ? '<span class="badge badge-new">ذخیره‌نشده</span>' : ''}</div>
          <div class="slot-tools">
            <code dir="ltr">${esc(value || '—')}</code>
            <label class="btn btn-ghost">${e ? 'جایگزینی فایل' : '＋ آپلود'}<input type="file" accept="${accept}" data-mupload="public" data-kind="${kind}" data-path='${esc(JSON.stringify(path))}' data-current="${esc(value || '')}" hidden /></label>
          </div>
        </div>
      </div>`;
  }
  /** Returns the new value (path inside /public) or null. */
  function uploadPublic(current, file, kind) {
    const allowed = kind === 'pdf' ? ['pdf'] : IMAGE_TYPES;
    if (!checkFile(file, allowed)) return null;
    const ext = extOf(file.name).replace('jpeg', 'jpg');
    const dir = current && current.includes('/') ? current.slice(0, current.lastIndexOf('/') + 1) : kind === 'pdf' ? 'files/' : 'img/';
    const name = current ? `${stem(baseName(current))}.${ext}` : slugFile(file.name);
    const next = dir + name;
    if (current && current !== next) remove(`${PUBLIC_DIR}/${current}`);
    add(`${PUBLIC_DIR}/${next}`, file);
    return next;
  }

  return {
    setBase(files) {
      base = files;
      for (const op of ops.values()) if (op.url) URL.revokeObjectURL(op.url);
      ops.clear();
    },
    list,
    entry,
    remove,
    hydrate,
    projectWidget,
    certWidget,
    publicFileWidget,
    uploadProject,
    uploadCert,
    uploadPublic,
    projectAction,
    renameProject,
    renameCert,
    count: () => ops.size,
    /** Staged operations as commit changes. */
    changes() {
      const out = [];
      for (const [path, op] of ops) {
        if (op.kind === 'del') {
          if (base.has(path)) out.push({ path, remove: true });
        } else if (op.kind === 'add') out.push({ path, file: op.file });
        else if (base.get(path)?.sha !== op.sha) out.push({ path, sha: op.sha });
      }
      return out;
    },
    /** Remove files of projects / certificates that no longer exist. Returns the removed paths. */
    orphans(projectIds, certIds) {
      const gone = [];
      const pIds = new Set(projectIds);
      const cIds = new Set(certIds);
      for (const f of list(`${PROJECT_MEDIA_DIR}/`, { all: true })) {
        const id = f.path.slice(PROJECT_MEDIA_DIR.length + 1).split('/')[0];
        if (!pIds.has(id)) gone.push(f.path);
      }
      for (const f of list(`${CERT_MEDIA_DIR}/`, { all: true })) {
        if (f.name === '.gitkeep') continue;
        if (!cIds.has(stem(f.name))) gone.push(f.path);
      }
      return gone;
    },
    summary() {
      return [...ops].map(([path, op]) => ({ path, kind: op.kind }));
    },
    notify: () => onChange?.(),
  };
}
