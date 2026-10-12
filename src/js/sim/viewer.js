import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { buildCar } from '../tour/car.js';
import { loadCarModel } from '../tour/car-model.js';
import { createStage } from '../tour/stage.js';
import { BLD } from '../tour/studio.js';
import { buildWorkshop, workshopEnvironment, ROOM } from './workshop.js';
import vehicles from '../../../content/vehicles.js';
import porsche from '../../../content/car.js';

/**
 * Configurator viewer: the window-film fitting workshop (src/js/sim/workshop.js) where the
 * visitor orbits around the car. Renders on demand to spare batteries.
 */
export async function createViewer(container, { quality = 'high', mode = 'showroom', onProgress } = {}) {
  const canvas = document.createElement('canvas');
  canvas.setAttribute('aria-hidden', 'true');
  container.prepend(canvas);
  if (mode === 'studio') return createStudioViewer(container, canvas, { quality, onProgress });
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x2c2f34);
  scene.environment = workshopEnvironment(renderer, quality);

  // the fitting workshop, mirrored in its epoxy floor (the car gets its own mirror below)
  const ws = buildWorkshop({ quality, signTexture: '/img/brand/enseigne.webp' });
  scene.add(ws.root);
  const mirrorRoom = ws.reflect.clone(true);
  mirrorRoom.scale.y = -1;
  scene.add(mirrorRoom);
  scene.add(new THREE.HemisphereLight(0xffffff, 0x8a8d92, 0.6));
  const key = new THREE.DirectionalLight(0xffffff, 0.9);
  key.position.set(1.5, 8, 2.5);
  scene.add(key);

  const camera = new THREE.PerspectiveCamera(36, 1, 0.02, 200);
  camera.position.set(5.5, 1.7, -4.6);
  const controls = new OrbitControls(camera, canvas);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.enablePan = false;
  controls.target.set(0, 0.7, 0);
  controls.autoRotateSpeed = 0.6;

  const cars = new Map();
  let car = null;
  let shown = null;
  let carBox = new THREE.Box3(new THREE.Vector3(-2.3, 0, -1), new THREE.Vector3(2.3, 1.4, 1));
  let ctl = null;
  let request = 0;
  /** swap the displayed car; resolves to null when a newer choice superseded this one */
  async function setVehicle(type, { onProgress } = {}) {
    const req = ++request;
    const def = vehicles[type] || vehicles.berline;
    let entry = cars.get(type);
    if (!entry) {
      let api = null;
      if (def.config) {
        try {
          api = await loadCarModel(def.config, { quality, onProgress });
        } catch (err) {
          console.warn('[sim] model failed, procedural fallback', err);
        }
      }
      if (!api) api = buildCar({ quality, preset: def.preset, paintColor: 0xc9ccd1 });
      // daylight showroom: no light halos (they read as smudges on the bright backdrop)
      api.group.traverse((o) => {
        if (o.isSprite) o.visible = false;
      });
      entry = { api, real: !!api.anchors };
      cars.set(type, entry);
    }
    if (req !== request) return null;
    if (car) scene.remove(car.group, cars.get(shown).mirror);
    car = entry.api;
    shown = type;
    if (!entry.mirror) {
      entry.mirror = car.group.clone(true);
      entry.mirror.scale.y = -1;
      entry.mirror.traverse((o) => {
        if (NOT_BODY.has(o.name) || o.isSprite || o.isPoints) o.visible = false;
      });
    }
    scene.add(car.group, entry.mirror);
    carBox = bodyBox(car.group);
    ctl.invalidate();
    return entry;
  }
  ctl = makeController({
    container,
    renderer,
    camera,
    controls,
    room: { maxDist: Math.min(ROOM.x1, ROOM.z1) - 1.0, maxY: ROOM.h - 1.0 },
    carBox: () => carBox,
    render: (t) => {
      if (car) car.update(t, renderer.domElement.height, camera.fov);
      renderer.render(scene, camera);
    },
    resize: (w, h) => {
      renderer.setPixelRatio(Math.min(devicePixelRatio || 1, quality === 'high' ? 2 : 1.5));
      renderer.setSize(w, h, false);
    },
    car: () => car,
    setVehicle,
  });
  return ctl;
}

// ------------------------------------------------------------------ dark studio (Porsche)
/** The home page's detailing studio with the supplied Porsche, orbit camera, on-demand render. */
async function createStudioViewer(container, canvas, { quality, onProgress }) {
  const stage = await createStage(canvas, {
    quality,
    carConfig: porsche,
    signTexture: '/img/brand/enseigne.webp',
    exterior: false,
    maxDpr: quality === 'high' ? 2 : 1.5,
    onProgress,
  });
  const { camera, renderer } = stage;
  camera.near = 0.02;
  const controls = new OrbitControls(camera, canvas);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.enablePan = false;
  controls.autoRotateSpeed = 0.5;
  // stay inside the room: under the ceiling, short of the walls
  const room = { maxDist: Math.min(BLD.x1, BLD.z1) - 0.9, maxY: BLD.h - 1.5 };
  const carBox = bodyBox(stage.car.group);
  return makeController({ container, renderer, camera, controls, room, carBox: () => carBox, render: (t) => stage.render(t), resize: (w, h) => stage.resize(w, h, Math.min(devicePixelRatio || 1, quality === 'high' ? 2 : 1.5)), car: () => stage.car, setVehicle: async () => ({ api: stage.car, real: true }) });
}

/** bounds of the car body only: light beams, shadows, stars and glows would stretch the box */
const NOT_BODY = new Set(['beam', 'shadow', 'stars', 'starExtras']);
function bodyBox(group) {
  const box = new THREE.Box3();
  group.updateMatrixWorld(true);
  (function walk(o) {
    if (NOT_BODY.has(o.name) || o.isSprite || o.isPoints || o.isLine) return;
    if (o.isMesh) box.expandByObject(o, true);
    for (const c of o.children) walk(c);
  })(group);
  box.min.y = 0;
  return box;
}

function makeController({ container, renderer, camera, controls, carBox, render, resize, car, setVehicle, room = null }) {
  const maxDist = room ? room.maxDist : 8.5;
  let dirty = true;
  let tween = null;
  let running = false;
  let visible = true;
  let animated = 0;
  // per-frame callbacks from the simulators; each returns true while it still animates
  const tickers = new Set();
  const invalidate = () => {
    dirty = true;
    start();
  };
  controls.addEventListener('change', invalidate);
  controls.addEventListener('start', () => {
    controls.autoRotate = false;
    tween = null;
  });
  const onResize = () => {
    const w = container.clientWidth;
    const h = container.clientHeight;
    if (!w || !h) return;
    resize(w, h);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    invalidate();
  };
  new ResizeObserver(onResize).observe(container);
  new IntersectionObserver(([e]) => {
    visible = e.isIntersecting;
    if (visible) invalidate();
  }).observe(container);
  document.addEventListener('visibilitychange', () => !document.hidden && invalidate());

  let current = null;
  function setView(name, { instant = false } = {}) {
    current = name;
    const to = posePreset(carBox(), name, car()?.anchors);
    // narrow (portrait) frames: step back so the whole car still fits across
    if (!INSIDE.has(name) && name !== 'phare' && camera.aspect < 1.55) {
      const k = Math.pow(1.55 / camera.aspect, 0.85);
      to.pos.sub(to.target).multiplyScalar(k).add(to.target);
    }
    let fov = name === 'plafond' || name === 'habitacle' ? 80 : INSIDE.has(name) ? 72 : name === 'phare' ? 34 : 36;
    if (room) {
      // pull the eye back towards the target until it fits in the room, and widen the lens by
      // as much so the framing stays the same
      const d = to.pos.clone().sub(to.target);
      const k = Math.min(1, maxDist / d.length(), to.pos.y > room.maxY ? (room.maxY - to.target.y) / d.y : 1);
      to.pos.copy(to.target).addScaledVector(d, k);
      if (k < 1) fov = Math.min(64, THREE.MathUtils.radToDeg(2 * Math.atan(Math.tan(THREE.MathUtils.degToRad(fov) / 2) / k)));
    }
    const inside = INSIDE.has(name);
    const dist = to.pos.distanceTo(to.target);
    if (inside) {
      // look around from the seat: orbit a pivot just ahead of the eye, not a far target
      // (OrbitControls clamps the eye-to-target distance, which would pull it out of the car)
      to.target.sub(to.pos).setLength(0.12).add(to.pos);
    }
    controls.minDistance = inside ? 0.05 : Math.min(2.4, dist * 0.8);
    controls.maxDistance = inside ? 0.2 : maxDist;
    controls.minPolarAngle = inside ? 0.02 : 0;
    controls.maxPolarAngle = inside ? Math.PI - 0.02 : Math.PI * 0.49;
    controls.enableZoom = !inside;
    controls.rotateSpeed = inside ? -0.45 : 1;
    camera.fov = fov;
    camera.updateProjectionMatrix();
    if (instant) {
      tween = null;
      camera.position.copy(to.pos);
      controls.target.copy(to.target);
      controls.update();
      invalidate();
      return;
    }
    tween = { from: { pos: camera.position.clone(), target: controls.target.clone() }, to, t: 0 };
    invalidate();
  }
  let last = performance.now();
  function frame(now) {
    if (!visible || document.hidden) {
      running = false;
      return;
    }
    const dt = Math.min(0.1, Math.max(0, (now - last) / 1000));
    last = now;
    if (tween) {
      tween.t = Math.min(1, tween.t + dt / 0.9);
      const e = tween.t < 0.5 ? 4 * tween.t ** 3 : 1 - (-2 * tween.t + 2) ** 3 / 2;
      camera.position.lerpVectors(tween.from.pos, tween.to.pos, e);
      controls.target.lerpVectors(tween.from.target, tween.to.target, e);
      if (tween.t >= 1) tween = null;
      dirty = true;
    }
    let busy = false;
    for (const f of tickers) if (f(dt, now / 1000)) busy = true;
    const moved = controls.update();
    if (moved || dirty || busy || animated > 0 || controls.autoRotate) {
      render(now / 1000);
      dirty = false;
    }
    if (tween || moved || busy || animated > 0 || controls.autoRotate || dirty) requestAnimationFrame(frame);
    else running = false;
  }
  function start() {
    if (running) return;
    running = true;
    last = performance.now();
    requestAnimationFrame(frame);
  }
  onResize();
  return {
    renderer,
    camera,
    controls,
    get car() {
      return car();
    },
    setVehicle,
    setView,
    get view() {
      return current;
    },
    invalidate,
    autoRotate(on) {
      controls.autoRotate = on;
      invalidate();
    },
    hold() {
      animated++;
      start();
    },
    addTicker(fn) {
      tickers.add(fn);
      invalidate();
      return () => tickers.delete(fn);
    },
    release() {
      animated = Math.max(0, animated - 1);
    },
  };
}

/**
 * Camera pose for a named view. Box-based so it fits any silhouette; a real model's anchors
 * (headlight, roof, front windows) give the close-ups and the cabin views their exact spot.
 */
/** views taken from inside the cabin (orbit around the eye, no zoom) */
export const INSIDE = new Set(['interieur', 'plafond', 'habitacle']);

export function posePreset(b, name, anchors = null) {
  const L = b.max.x - b.min.x;
  const Hh = b.max.y;
  const c = b.getCenter(new THREE.Vector3());
  const r = Math.max(L, 3.8) * 1.05;
  const P = (x, y, z) => new THREE.Vector3(x, y, z);
  if (anchors) {
    const { headL, roof, winL } = anchors;
    if (name === 'phare') return { pos: P(headL.x + 0.95, headL.y + 0.18, headL.z - 0.72), target: P(headL.x - 0.12, headL.y + 0.02, headL.z + 0.05) };
    if (name === 'plafond') return { pos: P(roof.x + 0.28, roof.y - 0.17, 0.08), target: P(roof.x - 0.12, roof.y + 0.2, 0) };
    if (name === 'interieur') return { pos: P(winL.x - 0.05, winL.y - 0.03, winL.z * 0.45), target: P(winL.x - 0.9, winL.y + 0.06, winL.z - 0.8) };
    if (name === 'habitacle') return { pos: P(roof.x - 0.38, roof.y - 0.16, 0.0001), target: P(roof.x + 0.7, roof.y - 0.12, 0) };
  }
  switch (name) {
    case 'avant':
      return { pos: P(b.max.x + r * 0.7, Hh * 0.72, -0.0001), target: P(b.max.x - 0.8, Hh * 0.45, 0) };
    case 'phare':
      return { pos: P(b.max.x + 1.25, Hh * 0.62, b.min.z - 0.55), target: P(b.max.x - 0.4, Hh * 0.5, b.min.z * 0.62) };
    case 'profil':
      return { pos: P(c.x, Hh * 0.62, b.min.z - r * 1.15), target: P(c.x, Hh * 0.5, 0) };
    case 'arriere':
      return { pos: P(b.min.x - r * 0.7, Hh * 0.78, 0.0001), target: P(b.min.x + 0.8, Hh * 0.5, 0) };
    case '34arriere':
      return { pos: P(b.min.x - r * 0.62, Hh * 1.05, b.min.z - r * 0.62), target: P(c.x - L * 0.12, Hh * 0.5, 0) };
    case 'dessus':
      return { pos: P(c.x + r * 0.5, r * 1.45, b.min.z - r * 0.7), target: P(c.x, 0.25, 0) };
    case 'interieur':
      return { pos: P(c.x + L * 0.02, Hh * 0.74, b.min.z * 0.3), target: P(c.x - L * 0.1, Hh * 0.76, b.min.z - 2) };
    case 'habitacle':
      return { pos: P(c.x - L * 0.12, Hh * 0.74, 0.0001), target: P(c.x + L * 0.3, Hh * 0.72, 0) };
    case 'plafond':
      return { pos: P(c.x + L * 0.04, Hh * 0.72, 0), target: P(c.x - L * 0.06, Hh * 1.3, 0.0001) };
    case 'flanc':
      return { pos: P(c.x - L * 0.05, Hh * 0.8, b.max.z + r * 0.98), target: P(c.x, Hh * 0.42, 0) };
    case '34avant':
    default:
      return { pos: P(b.max.x + r * 0.55, Hh * 1.1, b.min.z - r * 0.72), target: P(c.x + L * 0.05, Hh * 0.45, 0) };
  }
}
