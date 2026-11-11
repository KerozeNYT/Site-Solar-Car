/**
 * Home page film, rendered frame by frame in a headless browser (scripts/film/render.mjs).
 * Same car, materials and service effects as the site's 3D scene (src/js/tour/), in a dark
 * studio: black floor, fog, soft light from above. Exposes window.renderFrame(t) and
 * window.frameData(type, quality); window.ready once the car is loaded.
 *
 * URL knobs: w, h (pixels), msaa (samples), exp (exposure), fog (density), grain, vig.
 */
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { loadCarModel } from '../../src/js/tour/car-model.js';
import { createPath, createEffects } from '../../src/js/tour/flight.js';
import carConfig from '../../content/car.js';
import { keys, effects } from './shots.js';

const q = new URLSearchParams(location.search);
const W = Number(q.get('w') || 1920);
const H = Number(q.get('h') || 1080);
const MSAA = q.get('msaa') != null ? Number(q.get('msaa')) : W >= 3000 ? 2 : 4;
const EXPOSURE = Number(q.get('exp') || 1.18);
const FOG = Number(q.get('fog') || 0.022);
const GRAIN = Number(q.get('grain') || 0.006);
const VIGNETTE = Number(q.get('vig') || 0.55);

const canvas = document.createElement('canvas');
document.body.append(canvas);
const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, preserveDrawingBuffer: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(1);
renderer.setSize(W, H, false);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = EXPOSURE;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x030405);
scene.fog = new THREE.FogExp2(0x040506, FOG);
scene.environment = studioReflections(renderer);
// the windows reflect the same room without the warm lamp: flat glass shows it at its true size,
// a ragged beige disc, where the curved paint turns it into a fine amber glint
const glassReflections = studioReflections(renderer, { warm: false });

// ---------------------------------------------------------------- studio: floor, lights
// the floor is lit in a soft pool around the car and fades to black with distance
const pool = document.createElement('canvas');
pool.width = pool.height = 512;
const pg = pool.getContext('2d');
const grad = pg.createRadialGradient(256, 256, 0, 256, 256, 256);
grad.addColorStop(0, '#2a2c31');
grad.addColorStop(0.1, '#1d1f23');
grad.addColorStop(0.24, '#0d0e10');
grad.addColorStop(0.42, '#030304');
grad.addColorStop(1, '#000000');
pg.fillStyle = grad;
pg.fillRect(0, 0, 512, 512);
const poolTex = new THREE.CanvasTexture(pool);
poolTex.colorSpace = THREE.SRGBColorSpace;
const floor = new THREE.Mesh(
  new THREE.PlaneGeometry(44, 44),
  new THREE.MeshStandardMaterial({ map: poolTex, roughness: 0.42, metalness: 0.0, envMapIntensity: 0.35 })
);
floor.rotation.x = -Math.PI / 2;
scene.add(floor);
scene.add(new THREE.HemisphereLight(0xbfd0ff, 0x0b0b0d, 0.08));
// soft pool of light from above
const top = new THREE.SpotLight(0xfff6ec, 18, 0, 0.55, 1, 2);
top.position.set(0, 7.5, 0);
top.target.position.set(0, 0, 0);
scene.add(top, top.target);

/** reflections: a black room with long strip lights (crisp lines on the clearcoat), a dim
 * overhead diffuser and one small warm lamp (the amber glints) */
function studioReflections(renderer, { warm = true } = {}) {
  const env = new THREE.Scene();
  env.add(new THREE.Mesh(new THREE.BoxGeometry(24, 9, 18), new THREE.MeshBasicMaterial({ color: 0x050506, side: THREE.BackSide })));
  const floorEnv = new THREE.Mesh(new THREE.PlaneGeometry(24, 18), new THREE.MeshBasicMaterial({ color: 0x0e0f11 }));
  floorEnv.rotation.x = -Math.PI / 2;
  floorEnv.position.y = -0.2;
  env.add(floorEnv);
  const strip = (w, h, d, k, x, y, z, color = 0xffffff) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(k) }));
    m.position.set(x, y, z);
    env.add(m);
  };
  // overhead strips along the car
  for (const z of [-1.5, 0, 1.5]) strip(7, 0.06, 0.16, 5, 0, 4.2, z);
  // side strips at waist height: the long lines along the flanks
  for (const z of [-6, 6]) strip(9, 0.12, 0.06, 3.2, 0, 1.6, z);
  // behind the car: lines across the rear (tail lights chapter)
  strip(0.06, 0.1, 6, 2.6, -8, 1.5, 0);
  strip(0.06, 0.08, 4, 1.6, -8, 3.0, 0);
  // dim overhead diffuser
  strip(5, 0.05, 2.6, 0.35, 0, 4.4, 0);
  // small warm lamp
  const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.12, 16, 12), new THREE.MeshBasicMaterial({ color: new THREE.Color(1, 0.55, 0.2).multiplyScalar(14) }));
  lamp.position.set(3.5, 3.6, 2.5);
  if (warm) env.add(lamp);
  const pmrem = new THREE.PMREMGenerator(renderer);
  const rt = pmrem.fromScene(env, 0.0, 0.1, 60, { size: 512, position: new THREE.Vector3(0, 0.9, 0) });
  pmrem.dispose();
  return rt.texture;
}

const camera = new THREE.PerspectiveCamera(30, W / H, 0.02, 200);
scene.add(camera);

// ---------------------------------------------------------------- car
const car = await loadCarModel({ ...carConfig, model: '/public' + carConfig.model, paint: { ...carConfig.paint, color: '#050506' } }, { quality: 'high' });
scene.add(car.group);
car.setFrontVLT(0.75);
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

// ---------------------------------------------------------------- post: bloom, then grade
const target = new THREE.WebGLRenderTarget(W, H, { type: THREE.HalfFloatType, samples: MSAA });
const composer = new EffectComposer(renderer, target);
composer.setPixelRatio(1);
composer.setSize(W, H);
composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(new THREE.Vector2(W, H), 0.2, 0.4, 0.95);
composer.addPass(bloom);
composer.addPass(new OutputPass());
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
window.renderFrame = (t) => {
  path.sample(t, view);
  camera.position.copy(view.pos);
  camera.up.set(0, 1, 0);
  camera.lookAt(view.look);
  if (view.roll) camera.rotateZ(view.roll * 0.5);
  camera.fov = view.fov;
  camera.updateProjectionMatrix();

  const e = fx(t);
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
  bloom.strength = e.bloom;
  finish.uniforms.uFade.value = e.fade;
  finish.uniforms.uSeed.value = (t * 24.0) % 97.0;
  car.update(t, H, camera.fov);
  composer.render();
};
window.frameData = (type = 'image/jpeg', quality = 0.96) => canvas.toDataURL(type, quality);
window.renderFrame(0);
window.ready = true;
