// ============================================================
//  3D certificate ring
//  - drag / swipe: the ring follows the pointer 1:1
//  - release: speed is handed to a spring, the throw is projected forward
//    and the ring snaps to the certificate nearest to where it would stop
//  - click the front card to open it, click another card to bring it forward
//  - arrow keys, buttons and horizontal trackpad scroll also turn it
// ============================================================
import { RING } from './config.js';
import { createSpring, project } from './spring.js';

const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
const mod = (a, n) => ((a % n) + n) % n;
const TAP_SLOP = 6; // px of movement before a press becomes a drag

export function createRing({ stage, ring, onFrontChange, onOpen }) {
  let cards = [];
  let step = 0;
  let radius = 0;
  let front = -1;
  let active = false;
  let lastInput = 0;

  const spring = createSpring({ value: 0, onUpdate: render });

  // ---------- layout ----------
  function layout() {
    const n = cards.length;
    const mobile = window.innerWidth < RING.mobileBreakpoint;
    const w = mobile ? RING.cardWidthMobile : RING.cardWidth;
    const h = Math.round(w * RING.cardRatio);
    step = n ? 360 / n : 0;
    radius = n > 1 ? Math.max(w * 0.75, w / 2 / Math.tan(Math.PI / n) + RING.gap) : 0;
    stage.style.setProperty('--card-w', `${w}px`);
    stage.style.setProperty('--card-h', `${h}px`);
    stage.style.setProperty('--perspective', `${RING.perspective}px`);
    cards.forEach((c, i) => {
      c.base = i * step;
      c.el.style.transform = `rotateY(${c.base}deg) translateZ(${radius}px)`;
    });
    render(spring.value);
  }

  // ---------- per-frame render ----------
  function render(a) {
    ring.style.transform = `translateZ(${-radius}px) rotateX(${RING.tiltX}deg) rotateY(${a}deg)`;
    for (const c of cards) {
      const rel = ((mod(c.base + a + 180, 360) - 180) * Math.PI) / 180;
      const facing = Math.cos(rel); // 1 = front, -1 = back
      c.el.style.setProperty('--o', String(RING.backOpacity + (1 - RING.backOpacity) * Math.max(0, facing)));
      c.el.style.pointerEvents = facing > 0.15 ? 'auto' : 'none';
    }
    const f = cards.length ? mod(Math.round(-a / step), cards.length) : -1;
    if (f !== front) {
      front = f;
      cards.forEach((c, i) => {
        c.el.classList.toggle('is-front', i === f);
        c.el.setAttribute('aria-selected', String(i === f));
      });
      if (f >= 0) {
        ring.setAttribute('aria-activedescendant', cards[f].el.id);
        onFrontChange?.(cards[f].data, f);
      }
    }
  }

  // nearest angle (closest to the current one) at which card `i` faces the viewer
  const angleFor = (i) => {
    const base = -i * step;
    return base + Math.round((spring.value - base) / 360) * 360;
  };

  function goTo(i, opts = RING.settle) {
    if (!cards.length) return;
    touch();
    const target = angleFor(mod(i, cards.length));
    if (reduceMotion.matches) spring.set(target);
    else spring.animateTo(target, opts);
  }

  // ---------- pointer: 1:1 drag, velocity hand-off, momentum projection ----------
  const pxToDeg = (px) => (radius ? (px / radius) * (180 / Math.PI) : 0);
  let press = null;

  ring.addEventListener('pointerdown', (e) => {
    if (e.button !== 0 || !cards.length) return;
    spring.stop(); // grab it mid-flight, from where it is now
    press = { id: e.pointerId, x0: e.clientX, a0: spring.value, dragging: false, hist: [{ x: e.clientX, t: e.timeStamp }] };
    touch();
  });

  ring.addEventListener('pointermove', (e) => {
    if (!press || e.pointerId !== press.id) return;
    const dx = e.clientX - press.x0;
    if (!press.dragging && Math.abs(dx) > TAP_SLOP) {
      press.dragging = true;
      ring.setPointerCapture(e.pointerId);
      ring.classList.add('is-dragging');
    }
    if (!press.dragging) return;
    press.hist.push({ x: e.clientX, t: e.timeStamp });
    if (press.hist.length > 6) press.hist.shift();
    spring.set(press.a0 + pxToDeg(dx));
  });

  const release = (e) => {
    if (!press || e.pointerId !== press.id) return;
    const p = press;
    press = null;
    ring.classList.remove('is-dragging');
    touch();

    if (!p.dragging) {
      // a tap: open the front card, or bring the tapped card to the front
      const el = e.target.closest('.card');
      if (!el) return goTo(front);
      const i = cards.findIndex((c) => c.el === el);
      if (i === front) onOpen?.(cards[i].data, el);
      else goTo(i);
      return;
    }

    // release velocity (deg/s) from the last few samples
    const first = p.hist[0];
    const last = p.hist[p.hist.length - 1];
    const dt = Math.max(1, last.t - first.t) / 1000;
    const vel = e.type === 'pointercancel' ? 0 : pxToDeg((last.x - first.x) / dt);
    const projected = spring.value + project(vel, RING.decelerationRate);
    const target = Math.round(projected / step) * step;
    if (reduceMotion.matches) spring.set(target);
    else spring.animateTo(target, { ...RING.snap, velocity: vel });
  };
  ring.addEventListener('pointerup', release);
  ring.addEventListener('pointercancel', release);

  // ---------- trackpad: horizontal scroll turns the ring ----------
  let wheelTimer = 0;
  stage.addEventListener(
    'wheel',
    (e) => {
      if (Math.abs(e.deltaX) <= Math.abs(e.deltaY) || !cards.length) return;
      e.preventDefault();
      touch();
      spring.set(spring.value - pxToDeg(e.deltaX));
      clearTimeout(wheelTimer);
      wheelTimer = setTimeout(() => goTo(front), 140);
    },
    { passive: false }
  );

  // ---------- keyboard ----------
  ring.addEventListener('keydown', (e) => {
    const rtl = document.documentElement.dir === 'rtl';
    if (e.key === 'ArrowRight') goTo(front + (rtl ? -1 : 1));
    else if (e.key === 'ArrowLeft') goTo(front + (rtl ? 1 : -1));
    else if (e.key === 'Home') goTo(0);
    else if (e.key === 'End') goTo(cards.length - 1);
    else if (e.key === 'Enter' || e.key === ' ') {
      if (front >= 0) onOpen?.(cards[front].data, cards[front].el);
    } else return;
    e.preventDefault();
  });

  // ---------- idle auto-rotation (paused while hidden, touched or reduced motion) ----------
  let autoRaf = 0;
  let autoLast = 0;
  const touch = () => (lastInput = performance.now());
  const autoTick = (now) => {
    autoRaf = requestAnimationFrame(autoTick);
    const dt = Math.min(0.05, (now - autoLast) / 1000);
    autoLast = now;
    if (press || spring.running || stage.matches(':hover') || ring.matches(':focus-visible')) return;
    if (now - lastInput < RING.autoRotateDelay) return;
    spring.set(spring.value - RING.autoRotateSpeed * dt);
  };
  const updateAuto = () => {
    const want = active && RING.autoRotate && !reduceMotion.matches && cards.length > 1;
    if (want && !autoRaf) {
      autoLast = performance.now();
      autoRaf = requestAnimationFrame(autoTick);
    } else if (!want && autoRaf) {
      cancelAnimationFrame(autoRaf);
      autoRaf = 0;
    }
  };

  window.addEventListener('resize', layout);

  return {
    /** Replace the cards. `renderCard(data)` returns the inner HTML of a card. */
    setItems(list, renderCard) {
      const keep = front >= 0 && cards[front] ? cards[front].data.id : null;
      ring.innerHTML = '';
      cards = list.map((data, i) => {
        const el = document.createElement('div');
        el.className = 'card';
        el.id = `ring-card-${data.id}`;
        el.setAttribute('role', 'option');
        el.innerHTML = renderCard(data);
        ring.append(el);
        return { el, data, base: 0 };
      });
      front = -1;
      layout();
      const i = Math.max(0, cards.findIndex((c) => c.data.id === keep));
      spring.set(angleFor(i));
      render(spring.value);
      updateAuto();
    },
    goTo,
    next: () => goTo(front + 1),
    prev: () => goTo(front - 1),
    focusId(id) {
      const i = cards.findIndex((c) => c.data.id === id);
      if (i >= 0) goTo(i);
    },
    setActive(on) {
      active = on;
      if (on) {
        touch();
        layout();
      }
      updateAuto();
    },
  };
}
