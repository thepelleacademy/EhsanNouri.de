// ============================================================
//  Schema-driven forms. A section is a list of field specs; the
//  renderer turns them into HTML bound to a path inside a JSON file.
//
//  Field spec:
//    key        property name (or index) inside the parent object
//    label      shown above the input            help   small hint below
//    type       text | textarea | lines | paras | tags | number | bool | select
//               | period | kv | md | object | array | custom | note
//    ml         true = one input per language ({ fa, en, de })
//    options    [{ value, label }] or (ctx, parent) => [...]  (select)
//    when       (parent, ctx) => boolean     show the field only if true
//    readonly   (parent, ctx) => boolean
//    rerender   true = redraw the form after a change (for dependent fields)
//    onChange   (ctx, { parent, oldValue, newValue }) => void
//    fields     sub fields (object)
//    item       { fields, title(item, i), create(ctx) }   (array)
//    render     (value, path, ctx, parent) => html          (custom)
//    wide       true = full row
// ============================================================
import { md } from '../src/md.js';

export const LANGS = ['fa', 'en', 'de'];
export const LANG_NAME = { fa: 'فارسی', en: 'English', de: 'Deutsch' };
export const LANG_DIR = { fa: 'rtl', en: 'ltr', de: 'ltr' };

export const esc = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

/** Text of a multilingual value for titles in the editor (Persian first). */
export const pick = (v, prefer = ['fa', 'en', 'de']) => {
  if (v == null) return '';
  if (typeof v !== 'object' || Array.isArray(v)) return Array.isArray(v) ? v.join(', ') : String(v);
  for (const l of prefer) if (v[l]) return Array.isArray(v[l]) ? v[l].join(', ') : v[l];
  return '';
};

export function getAt(root, path) {
  return path.reduce((n, k) => (n == null ? undefined : n[k]), root);
}
export function setAt(root, path, value) {
  let n = root;
  for (let i = 0; i < path.length - 1; i++) {
    const k = path[i];
    if (n[k] == null || typeof n[k] !== 'object') n[k] = typeof path[i + 1] === 'number' ? [] : {};
    n = n[k];
  }
  n[path[path.length - 1]] = value;
}

// ---------- value <-> input conversions ----------
const toLines = (v) => (Array.isArray(v) ? v.join('\n') : v ?? '');
const fromLines = (s) => s.split('\n').map((x) => x.trim()).filter(Boolean);
const toParas = (v) => (Array.isArray(v) ? v.join('\n\n') : v ?? '');
const fromParas = (s) => s.split(/\n\s*\n/).map((x) => x.replace(/\s*\n\s*/g, ' ').trim()).filter(Boolean);
const toTags = (v) => (Array.isArray(v) ? v.join(', ') : v ?? '');
const fromTags = (s) => s.split(/[,،]/).map((x) => x.trim()).filter(Boolean);
const toKv = (v) => Object.entries(v || {}).map(([k, x]) => `${k} = ${x}`).join('\n');
const fromKv = (s) =>
  Object.fromEntries(
    s
      .split('\n')
      .map((l) => l.split('=').map((x) => x.trim()))
      .filter((p) => p.length === 2 && p[0] && p[1])
  );

export const PARSE = {
  text: (s) => s,
  textarea: (s) => s,
  md: (s) => s,
  select: (s) => s,
  number: (s) => (s === '' ? null : Number(s)),
  bool: (s, el) => el.checked,
  lines: fromLines,
  paras: fromParas,
  tags: fromTags,
  kv: fromKv,
  period: (s) => s.trim(),
};

// ---------- form ----------
/**
 * Creates a form context. `binds` and `arrays` map data-b / data-arr numbers
 * to { file, path, spec } so events can find what an input edits.
 */
export function createForm(ctx) {
  const binds = [];
  const arrays = [];
  const bind = (entry) => binds.push(entry) - 1;
  const arr = (entry) => arrays.push(entry) - 1;

  function input(spec, value, path, parent, lang) {
    const b = bind({ file: ctx.file, path, spec, parent });
    const ro = spec.readonly?.(parent, ctx) ? ' readonly' : '';
    const dir = lang ? ` dir="${LANG_DIR[lang]}" lang="${lang}"` : spec.dir ? ` dir="${spec.dir}"` : '';
    const ph = spec.placeholder ? ` placeholder="${esc(typeof spec.placeholder === 'object' ? spec.placeholder[lang] ?? '' : spec.placeholder)}"` : '';
    const rows = spec.rows ? ` rows="${spec.rows}"` : '';
    switch (spec.type) {
      case 'textarea':
        return `<textarea data-b="${b}"${dir}${ph}${rows || ' rows="3"'}${ro}>${esc(value ?? '')}</textarea>`;
      case 'md':
        return `<textarea class="mono-ish" data-b="${b}" data-md="1"${dir}${ph}${rows || ' rows="12"'}${ro}>${esc(value ?? '')}</textarea>
          <details class="md-preview"><summary>پیش‌نمایش</summary><div class="prose"${dir}>${md(value ?? '')}</div></details>`;
      case 'lines':
        return `<textarea data-b="${b}"${dir}${ph}${rows || ' rows="4"'}${ro}>${esc(toLines(value))}</textarea>`;
      case 'paras':
        return `<textarea data-b="${b}"${dir}${ph}${rows || ' rows="7"'}${ro}>${esc(toParas(value))}</textarea>`;
      case 'tags':
        return `<input type="text" data-b="${b}"${dir}${ph} value="${esc(toTags(value))}"${ro} />`;
      case 'kv':
        return `<textarea class="mono" data-b="${b}" dir="ltr"${ph}${rows || ' rows="6"'}${ro}>${esc(toKv(value))}</textarea>`;
      case 'number':
        return `<input type="number" data-b="${b}" dir="ltr" value="${esc(value ?? '')}"${ro} />`;
      case 'bool':
        return `<label class="switch"><input type="checkbox" data-b="${b}"${value !== false && value != null ? ' checked' : ''}${ro ? ' disabled' : ''} /><span></span><em>${esc(spec.label)}</em></label>`;
      case 'select': {
        const opts = typeof spec.options === 'function' ? spec.options(ctx, parent) : spec.options || [];
        const list = opts.map((o) => (typeof o === 'object' ? o : { value: o, label: o }));
        const known = list.some((o) => String(o.value) === String(value ?? ''));
        return `<select data-b="${b}"${ro ? ' disabled' : ''}>
          ${!known && value ? `<option value="${esc(value)}" selected>${esc(value)} (?)</option>` : ''}
          ${list.map((o) => `<option value="${esc(o.value)}"${String(o.value) === String(value ?? '') ? ' selected' : ''}>${esc(o.label)}</option>`).join('')}
        </select>`;
      }
      default:
        return `<input type="${spec.inputType || 'text'}" data-b="${b}"${dir}${ph} value="${esc(value ?? '')}"${ro} />`;
    }
  }

  function field(spec, parent, basePath) {
    if (spec.when && !spec.when(parent, ctx)) return '';
    const path = [...basePath, spec.key];
    const value = parent?.[spec.key];
    const help = spec.help ? `<p class="help">${spec.help}</p>` : '';
    const wide = spec.wide || ['textarea', 'md', 'paras', 'lines', 'object', 'array', 'custom', 'note', 'kv'].includes(spec.type) || spec.ml;

    if (spec.type === 'note') return `<div class="note wide">${spec.html}</div>`;
    if (spec.type === 'custom') return `<div class="field wide">${spec.label ? `<label class="lbl">${esc(spec.label)}</label>` : ''}${spec.render(value, path, ctx, parent)}${help}</div>`;
    if (spec.type === 'object') return `<fieldset class="group wide"><legend>${esc(spec.label)}</legend><div class="grid">${(spec.fields || []).map((f) => field(f, value || {}, path)).join('')}</div>${help}</fieldset>`;
    if (spec.type === 'array') return array(spec, value || [], path);
    if (spec.type === 'period') {
      const v = Array.isArray(value) ? value : ['', ''];
      const b0 = bind({ file: ctx.file, path: [...path, 0], spec, parent });
      const b1 = bind({ file: ctx.file, path: [...path, 1], spec, parent });
      return `<div class="field"><label class="lbl">${esc(spec.label)}</label>
        <div class="period"><input type="text" dir="ltr" data-b="${b0}" value="${esc(v[0])}" placeholder="MM/YYYY" />
        <span>–</span><input type="text" dir="ltr" data-b="${b1}" value="${esc(v[1])}" placeholder="MM/YYYY / now" /></div>
        <p class="help">پایان «now» یعنی «تا اکنون».</p></div>`;
    }
    if (spec.type === 'bool') return `<div class="field">${input(spec, value, path, parent)}${help}</div>`;

    if (spec.ml) {
      const v = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
      return `<div class="field ml wide">
        <label class="lbl">${esc(spec.label)}</label>
        <div class="ml-row">${LANGS.map(
          (l) => `<div class="ml-cell" data-lang="${l}"><span class="lang-tag">${l.toUpperCase()}</span>${input(spec, v[l], [...path, l], parent, l)}</div>`
        ).join('')}</div>${help}</div>`;
    }
    return `<div class="field${wide ? ' wide' : ''}"><label class="lbl">${esc(spec.label)}</label>${input(spec, value, path, parent)}${help}</div>`;
  }

  function array(spec, list, path) {
    const a = arr({ file: ctx.file, path, spec });
    const it = spec.item;
    const items = list
      .map((item, i) => {
        const key = `${ctx.file}:${path.join('.')}.${i}`;
        const open = ctx.open?.has(key) ? ' open' : '';
        const title = it.title ? it.title(item, i, ctx) : `#${i + 1}`;
        const hidden = item && item.visible === false ? '<span class="pill pill-off">مخفی</span>' : '';
        const isNew = it.isNew?.(item, ctx) ? '<span class="pill pill-new">جدید</span>' : '';
        return `
        <details class="item" data-open-key="${esc(key)}"${open}>
          <summary>
            <span class="item-no">${i + 1}</span>
            <span class="item-title">${esc(title || '—')}</span>${hidden}${isNew}
            <span class="item-tools">
              <button type="button" class="tool" data-act="up" data-arr="${a}" data-i="${i}" title="بالا" aria-label="بالا"${i === 0 ? ' disabled' : ''}>▲</button>
              <button type="button" class="tool" data-act="down" data-arr="${a}" data-i="${i}" title="پایین" aria-label="پایین"${i === list.length - 1 ? ' disabled' : ''}>▼</button>
              ${spec.noDuplicate ? '' : `<button type="button" class="tool" data-act="dup" data-arr="${a}" data-i="${i}" title="کپی" aria-label="کپی">⧉</button>`}
              <button type="button" class="tool tool-del" data-act="del" data-arr="${a}" data-i="${i}" title="حذف" aria-label="حذف">✕</button>
            </span>
          </summary>
          <div class="item-body grid">${it.fields.map((f) => field(f, item, [...path, i])).join('')}</div>
        </details>`;
      })
      .join('');
    return `
      <section class="arr wide">
        <header class="arr-head"><h3>${esc(spec.label)}</h3><span class="count">${list.length}</span></header>
        ${spec.help ? `<p class="help">${spec.help}</p>` : ''}
        <div class="arr-items">${items || '<p class="empty">هنوز موردی نیست.</p>'}</div>
        <button type="button" class="btn btn-ghost add" data-act="add" data-arr="${a}">＋ ${esc(spec.addLabel || 'افزودن')}</button>
      </section>`;
  }

  return {
    binds,
    arrays,
    bind,
    input,
    render: (fields, data, basePath = []) => fields.map((f) => field(f, data, basePath)).join(''),
  };
}
