import * as THREE from 'three';
import { COLORS, VIEWER } from './config.js';

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
    const x = r * Math.cos(a);
    const y = r * Math.sin(a);
    if (i === 0) shape.moveTo(x, y);
    else shape.lineTo(x, y);
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

/**
 * Mount the viewer into `host` (a container) using `canvas`.
 * Returns a small controller; falls back to the static grid when WebGL is missing.
 */
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
  camera.position.set(0, 0.35, VIEWER.cameraZ);
  camera.lookAt(0, 0, 0);

  // ----- the part -----
  const part = new THREE.Group();
  const geo = new THREE.ExtrudeGeometry(flangeShape(VIEWER.flange), {
    depth: VIEWER.thickness,
    bevelEnabled: false,
    curveSegments: 24,
  });
  geo.center();
  const edges = new THREE.EdgesGeometry(geo, 18);
  part.add(new THREE.LineSegments(edges, new THREE.LineBasicMaterial({ color: COLORS.cyan, transparent: true, opacity: 0.95 })));
  part.add(
    new THREE.Mesh(
      geo,
      new THREE.MeshBasicMaterial({ color: COLORS.blue, transparent: true, opacity: 0.06, depthWrite: false })
    )
  );
  // Red highlight on the bore: the one "critical" tolerance feature
  const boreRing = new THREE.Mesh(
    new THREE.TorusGeometry(VIEWER.flange.boreRadius, 0.012, 8, 120),
    new THREE.MeshBasicMaterial({ color: COLORS.red })
  );
  boreRing.position.z = VIEWER.thickness / 2 + 0.01;
  part.add(boreRing);
  part.rotation.set(0.25, 0, 0);
  scene.add(part);

  // ----- orbiting ring with a node -----
  const orbit = new THREE.Group();
  orbit.rotation.x = Math.PI / 2 - VIEWER.tiltX;
  orbit.rotation.z = 0.2;
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(VIEWER.ringRadius, VIEWER.ringTube, 6, 220),
    new THREE.MeshBasicMaterial({ color: COLORS.blue, transparent: true, opacity: 0.85 })
  );
  orbit.add(ring);
  const node = new THREE.Mesh(
    new THREE.SphereGeometry(0.05, 16, 12),
    new THREE.MeshBasicMaterial({ color: COLORS.red })
  );
  orbit.add(node);
  scene.add(orbit);

  // ----- floor grid -----
  const grid = new THREE.GridHelper(VIEWER.gridSize, VIEWER.gridDivisions, COLORS.cyan, COLORS.blue);
  grid.position.y = VIEWER.gridY;
  grid.material.transparent = true;
  grid.material.opacity = 0.12;
  scene.add(grid);

  // ----- particles -----
  const pos = new Float32Array(VIEWER.particles * 3);
  for (let i = 0; i < VIEWER.particles; i++) {
    pos[i * 3] = (Math.random() - 0.5) * VIEWER.particleSpread;
    pos[i * 3 + 1] = (Math.random() - 0.5) * VIEWER.particleSpread;
    pos[i * 3 + 2] = (Math.random() - 0.5) * VIEWER.particleSpread;
  }
  const pGeo = new THREE.BufferGeometry();
  pGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const dust = new THREE.Points(
    pGeo,
    new THREE.PointsMaterial({ color: COLORS.sky, size: 0.03, transparent: true, opacity: 0.55, depthWrite: false })
  );
  scene.add(dust);

  // ----- sizing -----
  const resize = () => {
    const { clientWidth: w, clientHeight: h } = host;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  };
  const ro = new ResizeObserver(resize);
  ro.observe(host);
  resize();

  // ----- pointer drag (horizontal rotates the part) -----
  let dragging = false;
  let lastX = 0;
  let spinOffset = 0;
  const onDown = (e) => {
    dragging = true;
    lastX = e.clientX;
    canvas.setPointerCapture?.(e.pointerId);
  };
  const onMove = (e) => {
    if (!dragging) return;
    spinOffset += (e.clientX - lastX) * VIEWER.dragSensitivity;
    lastX = e.clientX;
  };
  const onUp = () => (dragging = false);
  canvas.addEventListener('pointerdown', onDown);
  canvas.addEventListener('pointermove', onMove);
  canvas.addEventListener('pointerup', onUp);
  canvas.addEventListener('pointercancel', onUp);

  // ----- loop (runs only while the viewer is on screen) -----
  const still = reduceMotion();
  let visible = true;
  let raf = 0;
  let t0 = performance.now();

  const frame = (now) => {
    raf = 0;
    const dt = Math.min(0.05, (now - t0) / 1000);
    t0 = now;
    if (!still && !dragging) spinOffset += dt * VIEWER.spinSpeed;
    part.rotation.y = spinOffset;
    if (!still) {
      orbit.rotation.y += dt * VIEWER.orbitSpeed * 2 * Math.PI * 0.2;
      dust.rotation.y += dt * 0.02;
    }
    renderer.render(scene, camera);
    if (visible && !still) raf = requestAnimationFrame(frame);
  };

  const io = new IntersectionObserver(([e]) => {
    visible = e.isIntersecting;
    if (visible && !raf && !still) {
      t0 = performance.now();
      raf = requestAnimationFrame(frame);
    }
  });
  io.observe(host);

  frame(performance.now());

  return {
    destroy() {
      cancelAnimationFrame(raf);
      io.disconnect();
      ro.disconnect();
      renderer.dispose();
    },
  };
}
