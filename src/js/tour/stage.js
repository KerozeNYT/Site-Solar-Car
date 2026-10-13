import * as THREE from 'three';
import { buildCar } from './car.js';
import { loadCarModel } from './car-model.js';
import { buildPremises, buildEnvironment } from './studio.js';
import { loadParkedCar } from './parked.js';

/**
 * Owns the WebGL renderer, the scene graph and the camera. Knows nothing about scroll:
 * the tour drives it through setView() and the effect setters on `car`.
 */
export async function createStage(canvas, { quality = 'high', logoSvg = null, signTexture = null, maxDpr = 2, carConfig = null, onProgress, exterior = true, bloom = false } = {}) {
  const renderer = new THREE.WebGLRenderer({
    canvas,
    // with the bloom chain, edges are smoothed by a cheap FXAA pass instead of the costly
    // multisampled canvas
    antialias: quality === 'high' && !bloom,
    alpha: false,
    powerPreference: 'high-performance',
  });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.setClearColor(0x020306, 1);

  const scene = new THREE.Scene();
  scene.environment = buildEnvironment(renderer);

  const premises = buildPremises({ quality, logoSvg, signTexture, exterior });
  scene.add(premises.root);

  // Real model when configured, procedural car as a fallback (offline, failed download).
  let car = null;
  if (carConfig && carConfig.model) {
    try {
      car = await loadCarModel(carConfig, { quality, onProgress });
    } catch (err) {
      console.warn('[tour] car model failed, using the procedural car', err);
    }
  }
  if (!car) car = buildCar({ quality });
  premises.reflect.add(car.group);

  // Mirrored copy for the glossy floors. Shares geometry and materials (so effects stay in
  // sync); only the transform differs.
  const mirror = premises.reflect.clone(true);
  mirror.scale.y = -1;
  mirror.name = 'mirror';
  const hiddenInMirror = new Set(['sky', 'beam', 'shadow', 'stars', 'starLiner', 'floorFx', 'spray', 'spill', 'tailPoint']);
  mirror.traverse((o) => {
    if (hiddenInMirror.has(o.name) || o.isSprite) o.visible = false;
  });
  scene.add(mirror);
  const mirrorTraffic = [];
  mirror.traverse((o) => {
    if (o.userData && o.userData.speed) mirrorTraffic.push(o);
  });
  // animated nodes (doors) are copied onto their mirrored twins each frame
  const sync = (car.animatedNodes || [])
    .map((name) => [car.group.getObjectByName(name), mirror.getObjectByName(name)])
    .filter(([a, b]) => a && b);

  const hemi = new THREE.HemisphereLight(0xbcd2ff, 0x101012, 0.35);
  scene.add(hemi);
  const key = new THREE.DirectionalLight(0xffffff, 0.6);
  key.position.set(1, 6, 2);
  scene.add(key);
  // moonlight so roofs, roads and neighbours read in the final aerial
  const moon = new THREE.DirectionalLight(0x9db4ff, 0.95);
  moon.position.set(-20, 40, 15);
  scene.add(moon);

  const camera = new THREE.PerspectiveCamera(50, 1, 0.02, 600);
  scene.add(camera);

  // optional glow around bright lights (lamps, LEDs, the hex ceiling): loaded only when asked
  let composer = null;
  if (bloom) {
    try {
      const [{ EffectComposer }, { RenderPass }, { UnrealBloomPass }, { OutputPass }, { FXAAPass }] = await Promise.all([
        import('three/addons/postprocessing/EffectComposer.js'),
        import('three/addons/postprocessing/RenderPass.js'),
        import('three/addons/postprocessing/UnrealBloomPass.js'),
        import('three/addons/postprocessing/OutputPass.js'),
        import('three/addons/postprocessing/FXAAPass.js'),
      ]);
      // no multisampling: the bloom softens edges anyway, and it keeps the pass light
      composer = new EffectComposer(renderer, new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType }));
      composer.addPass(new RenderPass(scene, camera));
      // only the brightest sources bloom (lamps, LEDs), not the sign or the paint
      composer.addPass(new UnrealBloomPass(new THREE.Vector2(1, 1), 0.3, 0.4, 1.5));
      composer.addPass(new OutputPass());
      composer.addPass(new FXAAPass());
    } catch (err) {
      console.warn('[stage] bloom unavailable', err);
      composer = null;
    }
  }

  const state = { w: 1, h: 1, dpr: 1, offsetX: 0, offsetY: 0 };
  function resize(w, h, dpr = Math.min(window.devicePixelRatio || 1, maxDpr)) {
    state.w = w;
    state.h = h;
    state.dpr = dpr;
    renderer.setPixelRatio(dpr);
    renderer.setSize(w, h, false);
    if (composer && bloomOn) {
      // the glow does not need the full retina resolution
      const cdpr = Math.min(dpr, 1.25);
      renderer.setPixelRatio(cdpr);
      composer.setPixelRatio(cdpr);
      composer.setSize(w, h);
    }
    camera.aspect = w / h;
    applyOffset();
    camera.updateProjectionMatrix();
  }
  // Shift the optical centre so the subject sits beside (desktop) or above (mobile) the copy.
  function applyOffset() {
    const { w, h, offsetX, offsetY } = state;
    if (offsetX || offsetY) camera.setViewOffset(w, h, -offsetX * w, -offsetY * h, w, h);
    else camera.clearViewOffset();
  }

  const _look = new THREE.Vector3();
  function setView({ pos, look, roll = 0, fov = 50, offsetX = 0, offsetY = 0 }) {
    camera.position.copy(pos);
    _look.copy(look);
    camera.up.set(0, 1, 0);
    camera.lookAt(_look);
    if (roll) camera.rotateZ(roll);
    // keep the horizontal field stable in portrait so the subject still fits
    const aspect = state.w / state.h;
    let vfov = fov;
    if (aspect < 1) {
      const half = Math.tan(THREE.MathUtils.degToRad(fov) / 2);
      vfov = Math.min(THREE.MathUtils.radToDeg(2 * Math.atan(half / Math.max(aspect, 0.45))), 105);
    }
    let dirty = camera.fov !== vfov;
    camera.fov = vfov;
    if (state.offsetX !== offsetX || state.offsetY !== offsetY) {
      state.offsetX = offsetX;
      state.offsetY = offsetY;
      applyOffset();
      dirty = true;
    }
    if (dirty) camera.updateProjectionMatrix();
  }

  /**
   * Park supplied cars around the studio (scenery). Resolves once they are in place. They are
   * not mirrored in the floor: a whole car less to draw each, for a reflection hardly seen.
   */
  let parkedCars = [];
  let unparked = false;
  async function park(spots = []) {
    const cars = await Promise.all(
      spots.map((spot) =>
        loadParkedCar(spot, { quality }).catch((err) => {
          console.warn('[stage] parked car failed', err);
          return null;
        })
      )
    );
    if (unparked) return;
    for (const g of cars) {
      if (!g) continue;
      premises.reflect.add(g);
      parkedCars.push(g);
    }
  }
  /** savings for slow devices (see src/js/perf.js) */
  function unpark() {
    unparked = true;
    for (const g of parkedCars) g.parent?.remove(g);
    parkedCars = [];
  }
  let bloomOn = true;
  function setBloom(on) {
    bloomOn = on;
    resize(state.w, state.h);
  }
  function setMirror(on) {
    mirror.visible = on;
  }
  function setMaxDpr(v) {
    maxDpr = v;
    resize(state.w, state.h);
  }

  function render(time = 0) {
    premises.update(time);
    for (let i = 0; i < mirrorTraffic.length; i++) mirrorTraffic[i].position.copy(premises.traffic[i].position);
    for (const [a, b] of sync) b.quaternion.copy(a.quaternion);
    car.update(time, state.h * state.dpr, camera.fov);
    if (composer && bloomOn) composer.render();
    else renderer.render(scene, camera);
  }

  /** after the browser hands a lost WebGL context back: GPU-only resources are rebuilt (geometry
   * and textures are uploaded again by three.js on their own) */
  function restore() {
    scene.environment = buildEnvironment(renderer);
    resize(state.w, state.h);
  }

  return { renderer, scene, camera, car, premises, resize, setView, render, park, unpark, setBloom, setMirror, setMaxDpr, restore, state };
}
