import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { buildCar } from '../tour/car.js';
import { loadCarModel } from '../tour/car-model.js';
import { createStage } from '../tour/stage.js';
import { BLD } from '../tour/studio.js';
import { buildWorkshop, workshopEnvironment, ROOM } from './workshop.js';
import vehicles, { parked } from '../../../content/vehicles.js';
import { loadParkedCar } from '../tour/parked.js';
import { createGovernor, BUDGET } from '../perf.js';
import porsche from '../../../content/car.js';

/**
 * Configurator viewer: the window-film fitting workshop (src/js/sim/workshop.js) where the
 * visitor orbits around the car. Renders on demand to spare batteries.
 */
export async function createViewer(container, { quality = 'high', mode = 'showroom', car: studioCar = null, onProgress, parked: withParked = true, maxDpr = null } = {}) {
  const canvas = document.createElement('canvas');
  canvas.setAttribute('aria-hidden', 'true');
  container.prepend(canvas);
  if (mode === 'studio') return createStudioViewer(container, canvas, { quality, car: studioCar, onProgress });
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x2c2f34);
  scene.environment = workshopEnvironment(renderer, quality);

  // the fitting workshop, mirrored in its satin polydalle floor (the car gets its own mirror below)
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
  let dprCap = maxDpr ?? (quality === 'high' ? 1.5 : 1.25);
  let mirrorsOff = false;
  const setDpr = (v) => {
    dprCap = Math.min(dprCap, v);
    ctl.resizeNow();
  };
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
      // showroom cars are pristine: no unpolished (micro-scratched) side
      api.setPolish(10, -1);
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
    entry.mirror.visible = !mirrorsOff;
    scene.add(car.group, entry.mirror);
    carBox = bodyBox(car.group);
    ctl.invalidate();
    fillParking(type);
    return entry;
  }

  // two supplied cars parked behind, never the category on show (desktop only)
  const bays = new Map(); // category -> { group, mirror } (null while loading)
  let wantParked = withParked && quality === 'high' && !navigator.connection?.saveData;
  let parkedNow = [];
  function showParked(t) {
    const b = bays.get(t);
    const i = parkedNow.indexOf(t);
    if (!b?.group || i < 0) return;
    const slot = parked.workshop.slots[i];
    b.group.position.set(slot.x, 0, slot.z);
    b.group.rotation.y = slot.ry;
    b.mirror.position.copy(b.group.position);
    b.mirror.rotation.copy(b.group.rotation);
    scene.add(b.group, b.mirror);
    ctl.invalidate();
  }
  function fillParking(type) {
    if (!wantParked) return;
    const want = parked.workshop.order.filter((t) => t !== type && vehicles[t]?.config).slice(0, parked.workshop.slots.length);
    for (const t of parkedNow) if (!want.includes(t) && bays.get(t)?.group) scene.remove(bays.get(t).group, bays.get(t).mirror);
    parkedNow = want;
    const loads = [];
    for (const t of want) {
      if (bays.has(t)) {
        showParked(t);
        if (bays.get(t).loading) loads.push(bays.get(t).loading);
        continue;
      }
      const entry = { group: null, mirror: null, loading: null };
      bays.set(t, entry);
      entry.loading = loadParkedCar({ config: vehicles[t].config }, { quality })
        .then((g) => {
          entry.group = g;
          entry.mirror = new THREE.Group(); // parked cars are not mirrored (lighter)
          if (wantParked) showParked(t);
        })
        .catch((err) => {
          console.warn('[sim] parked car failed', err);
          bays.delete(t);
        });
      loads.push(entry.loading);
    }
    ctl.scenery = Promise.all(loads); // resolves once the parked cars are in place
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
      renderer.setPixelRatio(Math.min(devicePixelRatio || 1, dprCap));
      renderer.setSize(w, h, false);
    },
    car: () => car,
    setVehicle,
    // savings for slow devices, in order: sharpness first, visible content last
    degrade: [
      { apply: () => setDpr(1.25), budget: BUDGET.sharpness },
      { apply: () => setDpr(1), budget: BUDGET.sharpness },
      {
        apply: () => {
          wantParked = false;
          for (const b of bays.values()) if (b.group) scene.remove(b.group, b.mirror);
        },
        budget: BUDGET.scenery,
      },
      {
        apply: () => {
          mirrorRoom.visible = false;
          mirrorsOff = true;
          for (const e of cars.values()) if (e.mirror) e.mirror.visible = false;
        },
        budget: BUDGET.reflections,
      },
    ],
  });
  ctl.scenery = Promise.resolve();
  // the floor reflection of the car on show (simulators that swap materials update it too)
  Object.defineProperty(ctl, 'mirror', { get: () => cars.get(shown)?.mirror || null });
  return ctl;
}

// ------------------------------------------------------------------ dark studio (Porsche)
/**
 * The home page's detailing studio, orbit camera, on-demand render. The car is the Porsche
 * unless the simulator asks for another category (`car`, a key of content/vehicles.js).
 */
async function createStudioViewer(container, canvas, { quality, car = null, onProgress }) {
  const carConfig = (car && vehicles[car]?.config) || porsche;
  const stage = await createStage(canvas, {
    quality,
    carConfig,
    signTexture: '/img/brand/enseigne.webp',
    exterior: false,
    bloom: quality === 'high' && !/[?&]nobloom\b/.test(location.search),
    maxDpr: quality === 'high' ? 1.5 : 1.25,
    onProgress,
  });
  const { camera, renderer } = stage;
  camera.near = 0.02;
  let ctl = null;
  const scenery =
    quality === 'high' && !navigator.connection?.saveData
      ? stage.park(studioParking(car)).then(() => ctl?.invalidate())
      : Promise.resolve();
  // fully polished by default; the detailing simulator sets its own before / after state
  stage.car.setPolish(10, -1);
  // compile now the shaders of effects that appear later (floor run-off, rinse jet), so they
  // do not freeze the animation the first time they show up
  const later = [];
  stage.car.group.traverse((o) => {
    if ((o.name === 'floorFx' || o.name === 'spray') && !o.visible) {
      o.visible = true;
      later.push(o);
    }
  });
  try {
    await renderer.compileAsync(stage.scene, camera);
  } catch {
    /* older drivers: compiled on first use instead */
  }
  later.forEach((o) => (o.visible = false));
  const controls = new OrbitControls(camera, canvas);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.enablePan = false;
  controls.autoRotateSpeed = 0.5;
  // stay inside the room: under the ceiling, short of the walls
  const room = { maxDist: Math.min(BLD.x1, BLD.z1) - 0.9, maxY: BLD.h - 1.5 };
  const carBox = bodyBox(stage.car.group);
  ctl = makeController({
    container,
    renderer,
    camera,
    controls,
    room,
    carBox: () => carBox,
    render: (t) => stage.render(t),
    resize: (w, h) => stage.resize(w, h),
    car: () => stage.car,
    setVehicle: async () => ({ api: stage.car, real: true }),
    // savings for slow devices, in order
    // (the bloom chain stays: it is light and replaces the costly multisampling)
    degrade: [
      { apply: () => stage.setMaxDpr(1.25), budget: BUDGET.sharpness },
      { apply: () => stage.setMaxDpr(1), budget: BUDGET.sharpness },
      { apply: () => stage.unpark(), budget: BUDGET.scenery },
      { apply: () => stage.setMirror(false), budget: BUDGET.reflections },
    ],
  });
  ctl.scenery = scenery; // resolves once the parked cars are in place
  return ctl;
}

/** the cars parked around the studio, never the one on show (swapped for the next category) */
function studioParking(shown) {
  const used = new Set(parked.studio.map((s) => s.car).concat(shown || []));
  const spare = parked.workshop.order.filter((t) => !used.has(t) && vehicles[t]?.config);
  return parked.studio.map((s) => ({ ...s, car: s.car === shown ? spare.shift() : s.car })).filter((s) => s.car && vehicles[s.car]?.config).map((s) => ({ ...s, config: vehicles[s.car].config }));
}

/** bounds of the car body only: light beams, shadows, stars and glows would stretch the box */
const NOT_BODY = new Set(['beam', 'shadow', 'stars', 'starExtras', 'floorFx', 'spray', 'spill', 'tailPoint']);
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

function makeController({ container, renderer, camera, controls, carBox, render, resize, car, setVehicle, room = null, degrade = [] }) {
  const governor = createGovernor(degrade);
  let lastDrawn = 0;
  let disposed = false;
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
  const ro = new ResizeObserver(onResize);
  ro.observe(container);
  const io = new IntersectionObserver(([e]) => {
    visible = e.isIntersecting;
    if (visible) invalidate();
  });
  io.observe(container);
  const onVisibility = () => !document.hidden && invalidate();
  document.addEventListener('visibilitychange', onVisibility);

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
    if (disposed || !visible || document.hidden) {
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
      // two frames drawn back to back: their spacing is the real frame time
      if (lastDrawn) governor.sample(now - lastDrawn);
      lastDrawn = now;
    } else lastDrawn = 0;
    if (tween || moved || busy || animated > 0 || controls.autoRotate || dirty) requestAnimationFrame(frame);
    else running = false;
  }
  function start() {
    if (running || disposed) return;
    running = true;
    last = performance.now();
    lastDrawn = 0;
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
    resizeNow: onResize,
    /** apply the next saving now (tests; the governor does it on its own when needed) */
    degradeStep() {
      const i = governor.level;
      if (i < degrade.length) governor.sample(1e3, true);
      return i;
    },
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
    /** stops everything and frees the GPU (relaunch after a lost context) */
    dispose() {
      disposed = true;
      ro.disconnect();
      io.disconnect();
      document.removeEventListener('visibilitychange', onVisibility);
      controls.dispose();
      renderer.dispose();
      renderer.domElement.remove();
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
    case 'parebrise':
      // above the bonnet, three-quarter: the windshield catches the light at a grazing angle
      return { pos: P(b.max.x + r * 0.42, Hh * 1.55, b.min.z - r * 0.38), target: P(c.x + L * 0.1, Hh * 0.82, 0) };
    case 'flanc':
      return { pos: P(c.x - L * 0.05, Hh * 0.8, b.max.z + r * 0.98), target: P(c.x, Hh * 0.42, 0) };
    case '34avant':
    default:
      return { pos: P(b.max.x + r * 0.55, Hh * 1.1, b.min.z - r * 0.72), target: P(c.x + L * 0.05, Hh * 0.45, 0) };
  }
}
