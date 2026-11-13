/**
 * Home page film, rendered frame by frame in a headless browser (scripts/film/render.mjs).
 * Same car, materials and service effects as the site's 3D scene (src/js/tour/), in a dark
 * detailing garage (scripts/film/garage.js): black PVC tiles framed in yellow around the car,
 * LED strips on the walls reflected in the paint, a starry ceiling. Exposes window.renderFrame(t)
 * and window.frameData(type, quality); window.ready once the car is loaded.
 *
 * URL knobs: w, h (pixels), msaa (samples), fxaa (0/1), exp (exposure), fog (depth haze), led
 * (tube brightness), grain, vig.
 */
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { FXAAShader } from 'three/addons/shaders/FXAAShader.js';
import { loadCarModel } from '../../src/js/tour/car-model.js';
import { createPath, createEffects } from '../../src/js/tour/flight.js';
import carConfig from '../../content/car.js';
import { keys, effects } from './shots.js';
import { buildGarage } from './garage.js';
import { addLivery } from './livery.js';

const q = new URLSearchParams(location.search);
const W = Number(q.get('w') || 1920);
const H = Number(q.get('h') || 1080);
// 4K: edge smoothing in post (FXAA) instead of multisampling, which doubles the time of a frame
// in software rendering; the smaller versions are scaled down from 4K anyway
const MSAA = q.get('msaa') != null ? Number(q.get('msaa')) : W >= 3000 ? 0 : 4;
const FXAA = q.get('fxaa') != null ? q.get('fxaa') === '1' : MSAA === 0;
const EXPOSURE = Number(q.get('exp') || 1.18);
const FOG = Number(q.get('fog') ?? 0.012);
const LED = Number(q.get('led') || 4.2);
const GRAIN = Number(q.get('grain') || 0.006);
const VIGNETTE = Number(q.get('vig') || 0.38);

const canvas = document.createElement('canvas');
document.body.append(canvas);
const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, preserveDrawingBuffer: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(1);
renderer.setSize(W, H, false);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = EXPOSURE;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0b0c0e);
// a faint depth haze only: the far walls settle back, no smoke
if (FOG > 0) scene.fog = new THREE.FogExp2(0x0b0c0e, FOG);
// ---------------------------------------------------------------- the garage (scripts/film/garage.js)
// fibre ends of the starry ceiling: about 3 px at most in 4K
const garage = buildGarage(scene, renderer, { ledLevel: LED, px: Math.max(1.2, (3 * W) / 3840) });
scene.environment = garage.envMap;
const glassReflections = garage.glassEnvMap;

const camera = new THREE.PerspectiveCamera(30, W / H, 0.02, 200);
scene.add(camera);

// ---------------------------------------------------------------- car
const car = await loadCarModel({ ...carConfig, model: '/public' + carConfig.model, paint: { ...carConfig.paint, color: '#383e42' } }, { quality: 'high' });
scene.add(car.group);
car.setFrontVLT(0.75);
// test knob: paint=rrggbb repaints the body (to see the carbon bonnet's outline)
if (q.get('paint')) car.setPaint('#' + q.get('paint'));
car.setStarlight({ count: 1100, twinkle: true });
for (const m of Object.values(car.materials.glass)) m.envMap = glassReflections;
// the red halo sprites beside the tail lights float off the body at this resolution
const halos = [];
car.group.traverse((o) => {
  if (!o.isSprite || !o.material?.color) return;
  if (o.material.color.r > 0.9 && o.material.color.g < 0.4) o.visible = false;
  else if (o.material.color.b > 0.95 && o.material.color.r < 0.9) halos.push(o.material); // headlight halos
});

// the roll cage behind the seats would bar the view of the starlit headliner from the back
// of the cabin; the headlight beam cones glare when the camera looks along them (from the
// cabin, past the mirror). Test knob: hide=name,... hides more objects by name.
const hideNames = ['Object_53', 'beam', ...(q.get('hide') || '').split(',').filter(Boolean)];
car.group.traverse((o) => {
  if (hideNames.includes(o.name)) o.visible = false;
});

// anthracite grey metallic (RAL 7016) under the mirror clearcoat: it stands out against the
// dark garage. Knobs metal / rough: another finish (a solid white: metal=0.02&rough=0.22)
const METAL = q.get('metal') != null ? Number(q.get('metal')) : 0.45;
const ROUGH = q.get('rough') != null ? Number(q.get('rough')) : 0.34;
car.group.traverse((o) => {
  if (!o.isMesh) return;
  for (const m of Array.isArray(o.material) ? o.material : [o.material]) {
    if (m?.userData?.uniforms?.uCarbonX) {
      m.metalness = METAL;
      m.roughness = ROUGH;
    }
  }
});
// knob livery=1: the SOLAR CAR side script on the doors (scripts/film/livery.js)
if (q.get('livery') === '1') {
  const body = [];
  car.group.traverse((o) => o.isMesh && carConfig.paint.materials.includes(o.name) && body.push(o));
  const lv = await addLivery(scene, car.group, body, {
    fontUrl: '/node_modules/@fontsource-variable/archivo/files/archivo-latin-wdth-normal.woff2',
    anisotropy: renderer.capabilities.getMaxAnisotropy(),
  });
  console.log('[scene] livery', JSON.stringify(lv.made));
}

// the cabin under its roof: the area light of the ceiling casts no shadow and would light the
// seats through the roof; what sits inside the cabin keeps 25 % of its colour (a material also
// used outside the cabin is copied for the inside)
{
  const cabin = new THREE.Box3(new THREE.Vector3(-1.3, 0.45, -0.78), new THREE.Vector3(0.95, 1.3, 0.78));
  const keep = new Set([...carConfig.paint.materials, ...(carConfig.cabinDim || [])]);
  const b = new THREE.Box3();
  const c = new THREE.Vector3();
  const inside = [];
  const outsideMats = new Set();
  car.group.traverse((o) => {
    if (!o.isMesh) return;
    const mats = Array.isArray(o.material) ? o.material : [o.material];
    if (!keep.has(o.name) && cabin.containsPoint(b.setFromObject(o).getCenter(c))) inside.push(o);
    else for (const m of mats) outsideMats.add(m);
  });
  const dimmed = new Map();
  const dim = (m) => {
    // glass and the materials with their own shader (lights, windows) stay as they are
    if (!m || m.transparent || !m.color || Object.prototype.hasOwnProperty.call(m, 'onBeforeCompile')) return m;
    if (!dimmed.has(m)) {
      const d = outsideMats.has(m) ? m.clone() : m;
      d.color.multiplyScalar(0.25);
      dimmed.set(m, d);
    }
    return dimmed.get(m);
  };
  for (const o of inside) o.material = Array.isArray(o.material) ? o.material.map(dim) : dim(o.material);
}

// window tint chapter: a soft light panel on the far side of the car, at window height, hidden by
// the body: it shows only through the glass, so the rear windows read clear, then black, while
// the front side window stays clear
const backlight = new THREE.Group();
const lightPanel = (w, h, x, y, z) => {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: 0xffffff, fog: false }));
  m.position.set(x, y, z);
  backlight.add(m);
  return m.material;
};
// behind the far side (seen through both front side windows, the seats against it) and inside
// the cabin behind the right-hand rear quarter window (the cabin trim hides the far one there)
const backlightMats = [lightPanel(0.9, 0.26, -0.18, 1.04, -1.2), lightPanel(0.4, 0.17, -0.9, 1.035, 0.47)];
backlight.visible = false;
scene.add(backlight);
const backlightColor = new THREE.Color(1.0, 0.97, 0.92);
// the model's right-hand rear quarter window (glass since content/car.js lists it): from the
// window tint chapter on, so the shots before it keep their look
const quarterR = car.group.getObjectByName('Object_186');

// ---------------------------------------------------------------- post: bloom, then grade
const target = new THREE.WebGLRenderTarget(W, H, { type: THREE.HalfFloatType, samples: MSAA });
const composer = new EffectComposer(renderer, target);
composer.setPixelRatio(1);
composer.setSize(W, H);
composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(new THREE.Vector2(W, H), 0.2, 0.4, 0.95);
composer.addPass(bloom);
composer.addPass(new OutputPass());
if (FXAA) {
  const fxaa = new ShaderPass(FXAAShader);
  fxaa.uniforms.resolution.value.set(1 / W, 1 / H);
  composer.addPass(fxaa);
}
const finish = new ShaderPass({
  uniforms: { tDiffuse: { value: null }, uFade: { value: 1 }, uSeed: { value: 0 }, uAspect: { value: W / H } },
  vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  fragmentShader: `
    uniform sampler2D tDiffuse; uniform float uFade; uniform float uSeed; uniform float uAspect;
    varying vec2 vUv;
    float hash(vec2 p){ p = fract(p * vec2(443.897, 441.423)); p += dot(p, p.yx + 19.19); return fract((p.x + p.y) * p.x); }
    void main(){
      vec2 d = vUv - 0.5;
      // faint lateral colour fringing towards the edges, as through a real lens
      vec2 ca = d * 0.0016;
      vec3 c = vec3(texture2D(tDiffuse, vUv + ca).r, texture2D(tDiffuse, vUv).g, texture2D(tDiffuse, vUv - ca).b);
      float r = length(d * vec2(uAspect, 1.0)) / length(vec2(uAspect, 1.0) * 0.5);
      c *= mix(1.0, 1.0 - ${VIGNETTE.toFixed(4)}, smoothstep(0.35, 1.05, r));
      c += (hash(vUv * 1000.0 + uSeed) - 0.5) * ${GRAIN.toFixed(4)};
      gl_FragColor = vec4(c * uFade, 1.0);
    }`,
});
composer.addPass(finish);

// ---------------------------------------------------------------- timeline
const path = createPath(keys);
const fx = createEffects(effects);
const view = {};
// test knobs: cam=px,py,pz,lx,ly,lz,fov replaces the camera; fx=name:value,... sets effects
const camKnob = q.get('cam') ? q.get('cam').split(',').map(Number) : null;
const fxKnob = Object.fromEntries((q.get('fx') || '').split(',').filter(Boolean).map((kv) => [kv.split(':')[0], Number(kv.split(':')[1])]));
window.renderFrame = (t) => {
  path.sample(t, view);
  if (camKnob) {
    view.pos.set(camKnob[0], camKnob[1], camKnob[2]);
    view.look.set(camKnob[3], camKnob[4], camKnob[5]);
    view.fov = camKnob[6];
    view.roll = 0;
  }
  camera.position.copy(view.pos);
  camera.up.set(0, 1, 0);
  camera.lookAt(view.look);
  if (view.roll) camera.rotateZ(view.roll * 0.5);
  camera.fov = view.fov;
  camera.updateProjectionMatrix();

  const e = { ...fx(t), ...fxKnob };
  car.setHeadlights(e.headlights);
  for (const m of halos) m.opacity = 0; // no sprite halo: the bloom alone, as through a lens
  car.setHeadlightClear(e.headClear);
  car.setPolish(e.polishX, 1);
  car.setRearVLT(e.rearVLT);
  car.setFrontVLT(e.frontVLT);
  car.setTailSmoke(e.tailSmoke);
  car.setTailOn(e.tailOn);
  car.setWindowDrop('R', e.windowR);
  car.setWindowSheen('R', e.sheen, 0.09);
  car.setStars(e.stars);
  car.setCarbon(e.carbonX ?? -10);
  const bl = e.backlight ?? 0;
  backlight.visible = bl > 0.001;
  for (const m of backlightMats) m.color.copy(backlightColor).multiplyScalar(bl * (Number(q.get('bl')) || 0.8));
  if (quarterR) quarterR.visible = t >= 14.6;
  bloom.strength = e.bloom;
  finish.uniforms.uFade.value = e.fade;
  finish.uniforms.uSeed.value = (t * 24.0) % 97.0;
  garage.update(t);
  car.update(t, H, camera.fov);
  composer.render();
};
window.frameData = (type = 'image/jpeg', quality = 0.96) => canvas.toDataURL(type, quality);
window.renderFrame(0);
window.ready = true;
