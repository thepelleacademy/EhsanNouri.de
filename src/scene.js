import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { COLORS, SCENE } from './config.js';

// ---------- helpers ----------
function webglAvailable() {
  try {
    const c = document.createElement('canvas');
    return !!(window.WebGLRenderingContext && (c.getContext('webgl2') || c.getContext('webgl')));
  } catch {
    return false;
  }
}

/** Build a gear outline as an extruded shape. */
function gearGeometry({ teeth, outerR, innerR, holeR, thickness }) {
  const shape = new THREE.Shape();
  const step = (Math.PI * 2) / teeth;
  // each tooth = 4 points (root-start, tip-start, tip-end, root-end)
  const rootFrac = 0.22; // angular share of the root gap
  const tipFrac = 0.16; // angular share of the flat tooth tip
  for (let i = 0; i < teeth; i++) {
    const a0 = i * step - step / 2;
    const pts = [
      [a0 + step * rootFrac, innerR],
      [a0 + step * (0.5 - tipFrac), outerR],
      [a0 + step * (0.5 + tipFrac), outerR],
      [a0 + step * (1 - rootFrac), innerR],
    ];
    pts.forEach(([a, r], k) => {
      const x = Math.cos(a) * r;
      const y = Math.sin(a) * r;
      if (i === 0 && k === 0) shape.moveTo(x, y);
      else shape.lineTo(x, y);
    });
  }
  shape.closePath();

  const hole = new THREE.Path();
  hole.absarc(0, 0, holeR, 0, Math.PI * 2, true);
  shape.holes.push(hole);

  const geo = new THREE.ExtrudeGeometry(shape, { depth: thickness, bevelEnabled: false, steps: 1 });
  geo.translate(0, 0, -thickness / 2);
  return geo;
}

/** Neon wireframe gear: glowing edges + dark fill so back lines are hidden. */
function neonGear(opts, color) {
  const geo = gearGeometry(opts);
  const group = new THREE.Group();

  const fill = new THREE.Mesh(
    geo,
    new THREE.MeshBasicMaterial({
      color: 0x03050d,
      polygonOffset: true,
      polygonOffsetFactor: 1,
      polygonOffsetUnits: 1,
    })
  );
  const edges = new THREE.LineSegments(
    new THREE.EdgesGeometry(geo, 25),
    new THREE.LineBasicMaterial({ color })
  );
  group.add(fill, edges);
  return group;
}

function roundSprite() {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.35, 'rgba(255,255,255,0.55)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
}

function makeParticles(count, colors) {
  const pos = new Float32Array(count * 3);
  const col = new Float32Array(count * 3);
  const tmp = new THREE.Color();
  for (let i = 0; i < count; i++) {
    const r = SCENE.particleRadiusMin + Math.random() * (SCENE.particleRadiusMax - SCENE.particleRadiusMin);
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(2 * Math.random() - 1);
    pos[i * 3] = r * Math.sin(phi) * Math.cos(theta);
    pos[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta) * 0.7;
    pos[i * 3 + 2] = r * Math.cos(phi);
    tmp.setHex(colors[Math.floor(Math.random() * colors.length)]);
    col[i * 3] = tmp.r;
    col[i * 3 + 1] = tmp.g;
    col[i * 3 + 2] = tmp.b;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const mat = new THREE.PointsMaterial({
    size: SCENE.particleSize,
    map: roundSprite(),
    alphaTest: 0.01,
    vertexColors: true,
    transparent: true,
    opacity: 0.8,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    sizeAttenuation: true,
  });
  return new THREE.Points(geo, mat);
}

// ---------- main entry ----------
export function initScene(canvas) {
  if (!webglAvailable()) {
    document.documentElement.classList.add('no-webgl');
    return null;
  }

  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const isMobile = () => window.innerWidth < 800;

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  renderer.setClearColor(COLORS.background, 1);

  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(COLORS.background, 0.022);

  const camera = new THREE.PerspectiveCamera(SCENE.cameraFov, 1, 0.1, 200);
  camera.position.set(0, SCENE.cameraStartY, SCENE.cameraStartZ);

  // ----- hero: two meshing gears -----
  const hero = new THREE.Group();
  scene.add(hero);

  const gearBase = {
    thickness: SCENE.gearThickness,
  };
  const pitchA = (SCENE.gearAOuterRadius + SCENE.gearAInnerRadius) / 2;
  const toothDepth = SCENE.gearAOuterRadius - SCENE.gearAInnerRadius;
  const pitchB = (pitchA * SCENE.gearBTeeth) / SCENE.gearATeeth;

  const gearA = neonGear(
    {
      ...gearBase,
      teeth: SCENE.gearATeeth,
      outerR: SCENE.gearAOuterRadius,
      innerR: SCENE.gearAInnerRadius,
      holeR: SCENE.gearAHoleRadius,
    },
    COLORS.cyan
  );
  const gearB = neonGear(
    {
      ...gearBase,
      teeth: SCENE.gearBTeeth,
      outerR: pitchB + toothDepth / 2,
      innerR: pitchB - toothDepth / 2,
      holeR: SCENE.gearAHoleRadius * 0.7,
    },
    COLORS.red
  );
  const centerDist = pitchA + pitchB;
  gearA.position.set(SCENE.gearAPosition.x, SCENE.gearAPosition.y, SCENE.gearAPosition.z);
  gearB.position.set(SCENE.gearAPosition.x + centerDist, SCENE.gearAPosition.y, SCENE.gearAPosition.z);
  hero.add(gearA, gearB);

  // third small decorative gear (blue), meshes with B from above-right
  const gearC = neonGear(
    {
      ...gearBase,
      teeth: 8,
      outerR: (pitchA * 8) / SCENE.gearATeeth + toothDepth / 2,
      innerR: (pitchA * 8) / SCENE.gearATeeth - toothDepth / 2,
      holeR: 0.18,
    },
    COLORS.blue
  );
  const pitchC = (pitchA * 8) / SCENE.gearATeeth;
  const angleBC = Math.PI / 3; // direction from B to C
  gearC.position.set(
    gearB.position.x + Math.cos(angleBC) * (pitchB + pitchC),
    gearB.position.y + Math.sin(angleBC) * (pitchB + pitchC),
    0
  );
  hero.add(gearC);

  // orbit rings
  const ringMat = (c) => new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: 0.85 });
  const ring1 = new THREE.Mesh(new THREE.TorusGeometry(SCENE.ringRadius, SCENE.ringTubeRadius, 8, 160), ringMat(COLORS.blue));
  ring1.position.copy(gearA.position).add(new THREE.Vector3(centerDist / 2, 0, 0));
  ring1.rotation.x = Math.PI / 2.4;
  const ring2 = new THREE.Mesh(
    new THREE.TorusGeometry(SCENE.ringRadius * 1.28, SCENE.ringTubeRadius, 8, 160),
    ringMat(COLORS.violet)
  );
  ring2.position.copy(ring1.position);
  ring2.rotation.set(Math.PI / 3, 0.5, 0);
  hero.add(ring1, ring2);

  // tiny satellites on the rings
  const sat = new THREE.Mesh(new THREE.SphereGeometry(0.07, 12, 12), new THREE.MeshBasicMaterial({ color: COLORS.cyan }));
  const sat2 = new THREE.Mesh(new THREE.SphereGeometry(0.07, 12, 12), new THREE.MeshBasicMaterial({ color: COLORS.red }));
  ring1.add(sat);
  ring2.add(sat2);

  // ----- particles -----
  const particles = makeParticles(
    isMobile() ? SCENE.particleCountMobile : SCENE.particleCountDesktop,
    [COLORS.cyan, COLORS.blue, COLORS.red, COLORS.violet]
  );
  scene.add(particles);

  // ----- floor grid -----
  const grid = new THREE.GridHelper(SCENE.gridSize, SCENE.gridDivisions, COLORS.cyan, COLORS.blue);
  grid.material.transparent = true;
  grid.material.opacity = SCENE.gridOpacity;
  grid.position.y = SCENE.gridY;
  scene.add(grid);
  const cell = SCENE.gridSize / SCENE.gridDivisions;

  // ----- post-processing -----
  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), SCENE.bloomStrength, SCENE.bloomRadius, SCENE.bloomThreshold);
  composer.addPass(bloom);
  composer.addPass(new OutputPass());

  // ----- state -----
  const mouse = { x: 0, y: 0, tx: 0, ty: 0 };
  let scrollP = 0;
  let scrollTarget = 0;

  function onResize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    const dpr = Math.min(window.devicePixelRatio || 1, isMobile() ? SCENE.maxPixelRatioMobile : SCENE.maxPixelRatioDesktop);
    renderer.setPixelRatio(dpr);
    renderer.setSize(w, h, false);
    composer.setPixelRatio(dpr);
    composer.setSize(w, h);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    const m = isMobile();
    const off = m ? SCENE.groupOffsetMobile : SCENE.groupOffsetDesktop;
    hero.userData.baseX = off.x - centerDist / 2; // center the gear pair around the offset
    hero.userData.baseY = off.y;
    hero.scale.setScalar(m ? SCENE.groupScaleMobile : SCENE.groupScaleDesktop);
  }
  onResize();
  window.addEventListener('resize', onResize);

  window.addEventListener('pointermove', (e) => {
    mouse.tx = (e.clientX / window.innerWidth) * 2 - 1;
    mouse.ty = (e.clientY / window.innerHeight) * 2 - 1;
  });

  function onScroll() {
    const max = document.documentElement.scrollHeight - window.innerHeight;
    scrollTarget = max > 0 ? window.scrollY / max : 0;
  }
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  // ----- loop -----
  const clock = new THREE.Clock();
  const ratioAB = SCENE.gearATeeth / SCENE.gearBTeeth;
  const ratioBC = SCENE.gearBTeeth / 8; // gear C (8 teeth) is driven by gear B
  const phaseC = 0.2; // purely decorative start angle
  const phaseB = Math.PI / SCENE.gearBTeeth; // half a tooth, so teeth fall into gaps at start
  let angleA = 0;
  let running = true;

  document.addEventListener('visibilitychange', () => {
    running = !document.hidden;
    if (running) {
      clock.getDelta();
      requestAnimationFrame(frame);
    }
  });

  function frame() {
    if (!running) return;
    const dt = Math.min(clock.getDelta(), 0.05);
    const t = clock.elapsedTime;
    const speed = reducedMotion ? SCENE.gearSpeed * 0.15 : SCENE.gearSpeed;

    // smooth inputs
    mouse.x += (mouse.tx - mouse.x) * 0.05;
    mouse.y += (mouse.ty - mouse.y) * 0.05;
    scrollP += (scrollTarget - scrollP) * 0.06;

    // gears
    angleA += speed * dt;
    gearA.rotation.z = angleA;
    gearB.rotation.z = phaseB - angleA * ratioAB;
    gearC.rotation.z = phaseC - gearB.rotation.z * ratioBC;

    // rings + satellites
    ring1.rotation.z += dt * 0.25;
    ring2.rotation.z -= dt * 0.18;
    sat.position.set(SCENE.ringRadius, 0, 0);
    sat2.position.set(SCENE.ringRadius * 1.28, 0, 0);

    // hero follows scroll + mouse
    hero.position.x = hero.userData.baseX + mouse.x * 0.35;
    hero.position.y = hero.userData.baseY - mouse.y * 0.25 + Math.sin(t * 0.8) * 0.08;
    hero.rotation.y = mouse.x * 0.35 + scrollP * SCENE.scrollSpinFactor;
    hero.rotation.x = mouse.y * 0.2 + scrollP * 0.6;

    // camera travels with scroll, parallax with mouse
    camera.position.x = mouse.x * SCENE.parallaxStrength;
    camera.position.y = SCENE.cameraStartY + scrollP * SCENE.cameraScrollTravelY - mouse.y * SCENE.parallaxStrength * 0.5;
    camera.position.z = SCENE.cameraStartZ + scrollP * SCENE.cameraScrollTravelZ;
    camera.lookAt(0, camera.position.y * 0.4, 0);

    // particles + grid
    particles.rotation.y += dt * SCENE.particleSpin * (reducedMotion ? 0.3 : 1);
    particles.rotation.x = scrollP * 0.4;
    grid.position.z = reducedMotion ? 0 : (t * SCENE.gridSpeed) % cell;

    composer.render();
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  return { renderer, scene, camera };
}
