// ============================================================
//  Tiny interruptible spring (Apple-style parameters)
//  damping:  1.0 = no overshoot, < 1 = bounce
//  response: seconds to (roughly) reach the target, not a fixed duration
//  The spring always continues from the current on-screen value and
//  velocity, so it can be grabbed and redirected at any moment.
// ============================================================

const STEP = 1 / 240; // physics sub-step (s)
const REST_DELTA = 0.01;
const REST_SPEED = 0.05;

export function createSpring({ value = 0, onUpdate = () => {}, onRest = () => {} } = {}) {
  let x = value;
  let v = 0;
  let target = value;
  let k = 0;
  let c = 0;
  let raf = 0;
  let last = 0;

  const tick = (now) => {
    const dt = Math.min(0.064, (now - last) / 1000);
    last = now;
    for (let t = 0; t < dt; t += STEP) {
      const h = Math.min(STEP, dt - t);
      const a = -k * (x - target) - c * v;
      v += a * h;
      x += v * h;
    }
    if (Math.abs(x - target) < REST_DELTA && Math.abs(v) < REST_SPEED) {
      x = target;
      v = 0;
      raf = 0;
      onUpdate(x);
      onRest(x);
      return;
    }
    onUpdate(x);
    raf = requestAnimationFrame(tick);
  };

  return {
    get value() {
      return x;
    },
    get velocity() {
      return v;
    },
    get running() {
      return raf !== 0;
    },
    /** Animate to `to`. `velocity` (units/s) hands over the gesture's speed. */
    animateTo(to, { damping = 1, response = 0.4, velocity } = {}) {
      target = to;
      k = Math.pow((2 * Math.PI) / response, 2);
      c = (4 * Math.PI * damping) / response;
      if (typeof velocity === 'number') v = velocity;
      if (!raf) {
        last = performance.now();
        raf = requestAnimationFrame(tick);
      }
    },
    /** Jump to a value (used while dragging: 1:1 tracking). Stops any animation. */
    set(to) {
      this.stop();
      x = target = to;
      v = 0;
      onUpdate(x);
    },
    stop() {
      if (raf) cancelAnimationFrame(raf);
      raf = 0;
    },
  };
}

/** Where a flick would come to rest (Apple's projection from "Designing Fluid Interfaces"). */
export function project(velocity, decelerationRate = 0.998) {
  return ((velocity / 1000) * decelerationRate) / (1 - decelerationRate);
}
