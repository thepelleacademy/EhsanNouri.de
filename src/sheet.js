// ============================================================
//  Sheet: one modal surface for project details, certificate viewer
//  and the imprint. It grows out of the element that opened it and
//  returns to it when closed (same path both ways).
// ============================================================

const dialog = document.getElementById('sheet');
const body = document.getElementById('sheet-body');
const closeBtn = document.getElementById('sheet-close');
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

let onClosed = null;
let origin = null;
let closing = false;

function setOrigin(el) {
  origin = el || null;
  const r = el?.getBoundingClientRect?.();
  const ox = r ? r.left + r.width / 2 - window.innerWidth / 2 : 0;
  const oy = r ? r.top + r.height / 2 - window.innerHeight / 2 : 40;
  dialog.style.setProperty('--ox', `${Math.round(ox)}px`);
  dialog.style.setProperty('--oy', `${Math.round(oy)}px`);
}

/**
 * Open the sheet with `html`. `from` is the element it grows out of.
 * `kind` sets a modifier class (project | cert | legal). `onClose` runs after it closed.
 */
export function openSheet(html, { from, kind = '', onClose } = {}) {
  body.innerHTML = html;
  dialog.className = `sheet ${kind ? `sheet-${kind}` : ''}`;
  onClosed = onClose || null;
  closing = false;
  if (!dialog.open) {
    setOrigin(from);
    dialog.showModal();
    document.documentElement.classList.add('sheet-open');
    requestAnimationFrame(() => dialog.classList.add('is-in'));
  } else {
    dialog.classList.add('is-in');
  }
  body.scrollTop = 0;
  closeBtn.focus({ preventScroll: true });
  return body;
}

export function closeSheet({ silent = false } = {}) {
  if (!dialog.open || closing) return;
  closing = true;
  if (origin?.isConnected) setOrigin(origin);
  dialog.classList.remove('is-in');
  const done = () => {
    dialog.removeEventListener('transitionend', onEnd);
    clearTimeout(timer);
    body.querySelectorAll('video').forEach((v) => v.pause());
    dialog.close();
    body.innerHTML = '';
    document.documentElement.classList.remove('sheet-open');
    closing = false;
    const cb = onClosed;
    onClosed = null;
    if (origin?.isConnected) origin.focus?.({ preventScroll: true });
    if (!silent) cb?.();
  };
  const onEnd = (e) => e.target === dialog && done();
  dialog.addEventListener('transitionend', onEnd);
  const timer = setTimeout(done, reduceMotion.matches ? 0 : 420);
}

export const sheetIsOpen = () => dialog.open;

closeBtn.addEventListener('click', () => closeSheet());
dialog.addEventListener('cancel', (e) => {
  e.preventDefault(); // run our own close animation on Escape
  closeSheet();
});
dialog.addEventListener('click', (e) => {
  if (e.target === dialog) closeSheet(); // click on the dimmed backdrop
});
