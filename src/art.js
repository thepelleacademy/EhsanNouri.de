// ============================================================
//  Generated line drawings, used until real photos are uploaded.
//  Each project gets a drawing that matches its category; the shape
//  varies with the project id so cards don't look identical.
// ============================================================

function seeded(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) h = Math.imul(h ^ str.charCodeAt(i), 16777619);
  return () => {
    h = Math.imul(h ^ (h >>> 15), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return ((h ^= h >>> 16) >>> 0) / 4294967296;
  };
}
const f = (n) => Math.round(n * 10) / 10;

function mechanical(rnd) {
  const cx = 200;
  const cy = 125;
  const R = 70 + rnd() * 18;
  const bolts = 4 + Math.floor(rnd() * 5);
  const br = R * (0.68 + rnd() * 0.08);
  let s = `<circle cx="${cx}" cy="${cy}" r="${f(R)}"/><circle cx="${cx}" cy="${cy}" r="${f(R * 0.32)}" class="hot"/>`;
  s += `<circle cx="${cx}" cy="${cy}" r="${f(br)}" class="thin dash"/>`;
  for (let i = 0; i < bolts; i++) {
    const a = (i / bolts) * Math.PI * 2 + rnd() * 0.01;
    s += `<circle cx="${f(cx + br * Math.cos(a))}" cy="${f(cy + br * Math.sin(a))}" r="6"/>`;
  }
  s += `<path class="thin dash" d="M${cx - R - 22} ${cy}H${cx + R + 22}M${cx} ${cy - R - 22}V${cy + R + 22}"/>`;
  s += `<path class="thin" d="M${cx - R} ${cy + R + 34}H${cx + R}M${cx - R} ${cy + R + 28}v12M${cx + R} ${cy + R + 28}v12"/>`;
  return s;
}

function electronics(rnd) {
  let s = '<rect x="40" y="30" width="320" height="190" rx="10" class="thin"/>';
  s += '<rect x="160" y="85" width="80" height="80" rx="4"/>';
  for (let i = 0; i < 6; i++) {
    const y = 95 + i * 12;
    const lx = 60 + rnd() * 40;
    const rx = 300 + rnd() * 40;
    const k = 20 + rnd() * 20;
    s += `<path d="M160 ${y}H${f(lx + k)}L${f(lx)} ${f(y - k * 0.6)}"/><circle cx="${f(lx)}" cy="${f(y - k * 0.6)}" r="3.5"/>`;
    s += `<path d="M240 ${y}H${f(rx - k)}L${f(rx)} ${f(y + k * 0.6)}"/><circle cx="${f(rx)}" cy="${f(y + k * 0.6)}" r="3.5" class="${i === 2 ? 'hot' : ''}"/>`;
  }
  return s;
}

function software(rnd) {
  let s = '<rect x="70" y="35" width="260" height="180" rx="12"/><path class="thin" d="M70 62H330"/>';
  s += '<circle cx="88" cy="49" r="4" class="hot"/><circle cx="102" cy="49" r="4" class="thin"/><circle cx="116" cy="49" r="4" class="thin"/>';
  for (let i = 0; i < 7; i++) {
    const indent = [0, 16, 32, 32, 16, 32, 0][i];
    const w = 50 + rnd() * 120;
    s += `<path d="M${92 + indent} ${84 + i * 18}h${f(w)}" class="${i === 3 ? 'hot' : ''}"/>`;
  }
  return s;
}

function research(rnd) {
  let s = '<path class="thin" d="M60 210H350M60 210V40"/>';
  const k = 0.03 + rnd() * 0.02;
  let d = '';
  for (let x = 0; x <= 280; x += 4) {
    const y = 125 - 80 * Math.exp(-x * 0.009) * Math.cos(x * k * 2.2);
    d += `${x === 0 ? 'M' : 'L'}${f(60 + x)} ${f(y)}`;
  }
  s += `<path d="${d}"/>`;
  for (let i = 0; i < 9; i++) {
    const x = 20 + i * 30;
    const y = 125 - 80 * Math.exp(-x * 0.009) * Math.cos(x * k * 2.2) + (rnd() - 0.5) * 14;
    s += `<circle cx="${f(60 + x)}" cy="${f(y)}" r="3.5" class="${i === 4 ? 'hot' : 'thin'}"/>`;
  }
  return s;
}

const BY_CAT = { mechanical, electronics, software, research };

/** Line drawing for a project card (viewBox 400×250). */
export function projectArt(project) {
  const draw = BY_CAT[project.cat] || mechanical;
  return `<svg class="art" viewBox="0 0 400 250" aria-hidden="true" preserveAspectRatio="xMidYMid meet">${draw(seeded(project.id))}</svg>`;
}

/** Guilloche rosette, the security pattern of printed certificates. */
export function rosette(seed, { r = 46, waves = 12, loops = 6 } = {}) {
  const rnd = seeded(seed);
  const amp = 6 + rnd() * 4;
  let paths = '';
  for (let l = 0; l < loops; l++) {
    const phase = (l / loops) * Math.PI * 2;
    let d = '';
    for (let i = 0; i <= 240; i++) {
      const t = (i / 240) * Math.PI * 2;
      const rr = r - l * 3.2 + amp * Math.sin(waves * t + phase);
      d += `${i ? 'L' : 'M'}${f(60 + rr * Math.cos(t))} ${f(60 + rr * Math.sin(t))}`;
    }
    paths += `<path d="${d}Z"/>`;
  }
  return `<svg class="rosette" viewBox="0 0 120 120" aria-hidden="true">${paths}</svg>`;
}
