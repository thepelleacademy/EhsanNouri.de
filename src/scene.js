import * as THREE from 'three';
import { VIEWER } from './config.js';
import { cssVar, themeMode } from './theme.js';

const reduceMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

function webglAvailable() {
  try {
    const c = document.createElement('canvas');
    return !!(window.WebGLRenderingContext && (c.getContext('webgl2') || c.getContext('webgl')));
  } catch {
    return false;
  }
}

/** Flanged housing outline: rounded disc with bolt lugs, bolt holes and a central bore. */
function flangeShape(f) {
  const shape = new THREE.Shape();
  for (let i = 0; i <= f.segments; i++) {
    const a = (i / f.segments) * Math.PI * 2;
    const lug = Math.pow(Math.max(0, Math.cos(f.bolts * a)), f.lugSharpness) * f.lugHeight;
    const r = f.radius + lug;
    if (i === 0) shape.moveTo(r * Math.cos(a), r * Math.sin(a));
    else shape.lineTo(r * Math.cos(a), r * Math.sin(a));
  }
  for (let k = 0; k < f.bolts; k++) {
    const a = (k / f.bolts) * Math.PI * 2;
    const hole = new THREE.Path();
    hole.absarc(f.boltRadius * Math.cos(a), f.boltRadius * Math.sin(a), f.boltHoleRadius, 0, Math.PI * 2, true);
    shape.holes.push(hole);
  }
  const bore = new THREE.Path();
  bore.absarc(0, 0, f.boreRadius, 0, Math.PI * 2, true);
  shape.holes.push(bore);
  return shape;
}

/** Mount the wireframe viewer into `host` using `canvas`. Colours follow the active theme. */
export function initViewer(canvas, host) {
  if (!webglAvailable()) {
    host.classList.add('no-webgl');
    return { destroy() {} };
  }

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setClearColor(0x000000, 0);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, VIEWER.maxPixelRatio));

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(VIEWER.fov, 1, 0.1, 100);
  camera.position.set(0, VIEWER.cameraY, VIEWER.cameraZ);
  camera.lookAt(0, 0, 0);

  // ----- materials (recoloured on theme change) -----
  const M = {
    edge: new THREE.LineBasicMaterial({ transparent: true, opacity: 0.95 }),
    fill: new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false }),
    bore: new THREE.MeshBasicMaterial({}),
    ring: new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.85 }),
    node: new THREE.MeshBasicMaterial({}),
    dust: new THREE.PointsMaterial({ size: 0.03, transparent: true, depthWrite: false }),
  };

  // ----- the part -----
  const part = new THREE.Group();
  const geo = new THREE.ExtrudeGeometry(flangeShape(VIEWER.flange), {
    depth: VIEWER.thickness,
    bevelEnabled: false,
    curveSegments: 24,
  });
  geo.center();
  part.add(new THREE.LineSegments(new THREE.EdgesGeometry(geo, 18), M.edge));
  part.add(new THREE.Mesh(geo, M.fill));
  const boreRing = new THREE.Mesh(new THREE.TorusGeometry(VIEWER.flange.boreRadius, 0.012, 8, 120), M.bore);
  boreRing.position.z = VIEWER.thickness / 2 + 0.01;
  part.add(boreRing);
  part.rotation.set(VIEWER.tiltX, 0, 0);
  scene.add(part);

  // ----- orbiting ring with a node -----
  const orbit = new THREE.Group();
  orbit.rotation.x = Math.PI / 2 - VIEWER.ringTilt;
  orbit.rotation.z = 0.2;
  orbit.add(new THREE.Mesh(new THREE.TorusGeometry(VIEWER.ringRadius, VIEWER.ringTube, 6, 220), M.ring));
  const node = new THREE.Mesh(new THREE.SphereGeometry(0.05, 16, 12), M.node);
  node.position.x = VIEWER.ringRadius;
  orbit.add(node);
  scene.add(orbit);

  // ----- floor grid -----
  let grid = null;
  const buildGrid = (c1, c2, opacity) => {
    if (grid) {
      scene.remove(grid);
      grid.geometry.dispose();
      grid.material.dispose();
    }
    grid = new THREE.GridHelper(VIEWER.gridSize, VIEWER.gridDivisions, c1, c2);
    grid.position.y = VIEWER.gridY;
    grid.material.transparent = true;
    grid.material.opacity = opacity;
    scene.add(grid);
  };

  // ----- particles -----
  const pos = new Float32Array(VIEWER.particles * 3);
  for (let i = 0; i < pos.length; i++) pos[i] = (Math.random() - 0.5) * VIEWER.particleSpread;
  const pGeo = new THREE.BufferGeometry();
  pGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const dust = new THREE.Points(pGeo, M.dust);
  scene.add(dust);

  // ----- theme colours -----
  const applyTheme = () => {
    const mode = themeMode();
    const accent = new THREE.Color(cssVar('--accent') || '#29d6ff');
    const accent2 = new THREE.Color(cssVar('--accent-2') || '#3d7bff');
    const hot = new THREE.Color(cssVar('--hot') || '#ff2e4f');
    M.edge.color = accent;
    M.fill.color = accent2;
    M.fill.opacity = VIEWER.fillOpacity[mode];
    M.bore.color = hot;
    M.ring.color = accent2;
    M.node.color = hot;
    M.dust.color = accent;
    M.dust.opacity = VIEWER.dustOpacity[mode];
    buildGrid(accent, accent2, VIEWER.gridOpacity[mode]);
    renderer.render(scene, camera);
  };
  applyTheme();
  window.addEventListener('themechange', applyTheme);

  // ----- sizing -----
  const resize = () => {
    const { clientWidth: w, clientHeight: h } = host;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.render(scene, camera);
  };
  const ro = new ResizeObserver(resize);
  ro.observe(host);
  resize();

  // ----- pointer drag: the part follows the finger, then keeps its momentum -----
  let dragging = false;
  let lastX = 0;
  let spin = 0;
  let spinVel = 0;
  canvas.addEventListener('pointerdown', (e) => {
    dragging = true;
    lastX = e.clientX;
    spinVel = 0;
    canvas.setPointerCapture?.(e.pointerId);
    kick();
  });
  canvas.addEventListener('pointermove', (e) => {
    if (!dragging) return;
    const d = (e.clientX - lastX) * VIEWER.dragSensitivity;
    spin += d;
    spinVel = d * 60;
    lastX = e.clientX;
    kick();
  });
  const end = () => (dragging = false);
  canvas.addEventListener('pointerup', end);
  canvas.addEventListener('pointercancel', end);

  // ----- loop (runs only while the viewer is on screen) -----
  const still = reduceMotion();
  let visible = true;
  let raf = 0;
  let t0 = performance.now();

  const frame = (now) => {
    raf = 0;
    const dt = Math.min(0.05, (now - t0) / 1000);
    t0 = now;
    if (!dragging) {
      spin += spinVel * dt;
      spinVel *= Math.pow(0.04, dt); // momentum decays
      if (!still) spin += dt * VIEWER.spinSpeed;
    }
    part.rotation.y = spin;
    if (!still) {
      orbit.rotation.y += dt * VIEWER.orbitSpeed;
      dust.rotation.y += dt * 0.02;
    }
    renderer.render(scene, camera);
    if (visible && (!still || dragging || Math.abs(spinVel) > 0.01)) raf = requestAnimationFrame(frame);
  };
  const kick = () => {
    if (!raf) {
      t0 = performance.now();
      raf = requestAnimationFrame(frame);
    }
  };

  const io = new IntersectionObserver(([e]) => {
    visible = e.isIntersecting;
    if (visible) kick();
  });
  io.observe(host);
  kick();

  return {
    destroy() {
      cancelAnimationFrame(raf);
      io.disconnect();
      ro.disconnect();
      window.removeEventListener('themechange', applyTheme);
      renderer.dispose();
    },
  };
}
