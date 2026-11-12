/**
 * Real cars of the window tint simulator (simple mode): glTF models (Sketchfab, CC BY, listed
 * in scripts/cars/real.json with their credits) rendered in the studio of the site's dark
 * background, always from the same two viewpoints. Exposes:
 *   window.load(entry)             loads a model (entry of real.json) and frames it
 *   window.show(view, mode)        view: '34' | 'side'; mode: 'beauty', 'front', 'rear', 'glass'
 *   window.frameData()             PNG of the canvas
 * Masks: the model's glass, sorted per fragment in car space (nose towards +x, right-hand side
 * towards +z, ground at 0): front side windows are ahead of the B-pillar (entry.bPillar, in
 * metres from the middle of the car), rear side windows behind it, the rear windscreen faces
 * backwards. The windscreen and a glass roof are never part of a mask.
 */
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const q = new URLSearchParams(location.search);
const W = Number(q.get('w') || 1600);
const H = Number(q.get('h') || 1000);
const canvas = document.createElement('canvas');
document.body.append(canvas);
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(1);
renderer.setSize(W, H, false);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(24, W / H, 0.05, 200);

// ------------------------------------------------------------------ studio
function studio() {
  const env = new THREE.Scene();
  env.add(new THREE.Mesh(new THREE.BoxGeometry(30, 12, 30), new THREE.MeshBasicMaterial({ color: 0x0d0e10, side: THREE.BackSide })));
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(30, 30), new THREE.MeshBasicMaterial({ color: 0x1c1d20 }));
  floor.rotation.x = -Math.PI / 2;
  env.add(floor);
  const strip = (w, h, d, k, x, y, z) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshBasicMaterial({ color: new THREE.Color(1, 1, 1).multiplyScalar(k) }));
    m.position.set(x, y, z);
    env.add(m);
  };
  // soft box above, long strips on the sides and behind: the lines on the paint
  strip(8, 0.05, 3.4, 2.4, 0, 5, 0);
  for (const z of [-7, 7]) strip(12, 0.6, 0.1, 2.8, 0, 2.2, z);
  for (const x of [-8, 8]) strip(0.1, 0.5, 10, 2.0, x, 2.0, 0);
  strip(5, 3, 0.1, 0.7, 3, 2.5, 9);
  strip(5, 3, 0.1, 0.5, -3, 2.5, -9);
  const pmrem = new THREE.PMREMGenerator(renderer);
  const rt = pmrem.fromScene(env, 0.0, 0.1, 80, { size: 512, position: new THREE.Vector3(0, 1, 0) });
  pmrem.dispose();
  return rt.texture;
}
scene.environment = studio();
scene.add(new THREE.HemisphereLight(0xdfe6ff, 0x16171a, 0.35));
const key = new THREE.DirectionalLight(0xffffff, 1.4);
key.position.set(-3, 6, 4);
scene.add(key);

const bgCanvas = document.createElement('canvas');
bgCanvas.width = bgCanvas.height = 1024;
{
  const g = bgCanvas.getContext('2d');
  const r = g.createRadialGradient(512, 512, 0, 512, 512, 512);
  r.addColorStop(0, '#26282e');
  r.addColorStop(0.35, '#18191d');
  r.addColorStop(0.75, '#0c0d10');
  r.addColorStop(1, '#08090b');
  g.fillStyle = r;
  g.fillRect(0, 0, 1024, 1024);
}
const bgTex = new THREE.CanvasTexture(bgCanvas);
bgTex.colorSpace = THREE.SRGBColorSpace;
const ground = new THREE.Mesh(new THREE.PlaneGeometry(26, 26), new THREE.MeshBasicMaterial({ map: bgTex, toneMapped: false }));
ground.rotation.x = -Math.PI / 2;
scene.add(ground);
const shCanvas = document.createElement('canvas');
shCanvas.width = shCanvas.height = 256;
{
  const g = shCanvas.getContext('2d');
  const r = g.createRadialGradient(128, 128, 8, 128, 128, 128);
  r.addColorStop(0, 'rgba(0,0,0,0.9)');
  r.addColorStop(0.5, 'rgba(0,0,0,0.6)');
  r.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = r;
  g.fillRect(0, 0, 256, 256);
}
const shadow = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(shCanvas), transparent: true, depthWrite: false, toneMapped: false }));
shadow.rotation.x = -Math.PI / 2;
shadow.position.y = 0.003;
scene.add(shadow);

// ------------------------------------------------------------------ the car
const YAW = { '+x': 0, '-x': Math.PI, '+z': -Math.PI / 2, '-z': Math.PI / 2 };
let car = null;
let entry = null;
let glassMeshes = [];

const isGlass = (o, e) => {
  const m = o.material;
  const names = `${o.name} ${m?.name || ''}`.toLowerCase();
  if (e.glass) return e.glass.some((g) => names.includes(g.toLowerCase()));
  if (/light|lamp|lens|head|tail|indicator|signal|led/.test(names)) return false;
  return /glass|window|vitre|verre|glas/.test(names) || (m && m.transparent && m.opacity < 0.85 && !m.map);
};

window.load = async (e) => {
  entry = e;
  if (car) scene.remove(car);
  const gltf = await new GLTFLoader().loadAsync(e.url);
  const model = gltf.scene;
  // hide what the entry lists (stands, extra parts), apply paint
  model.traverse((o) => {
    if (!o.isMesh) return;
    const names = `${o.name} ${o.material?.name || ''}`;
    if ((e.hide || []).some((h) => names.includes(h))) o.visible = false;
    if (e.paint && e.paint.materials.some((p) => (o.material?.name || '') === p)) {
      o.material = o.material.clone();
      o.material.color?.set(e.paint.color);
      if (o.material.map && e.paint.dropMap) o.material.map = null;
      o.material.metalness = e.paint.metalness ?? 0.3;
      o.material.roughness = e.paint.roughness ?? 0.25;
      if ('clearcoat' in o.material) {
        o.material.clearcoat = 1;
        o.material.clearcoatRoughness = 0.03;
      }
    }
  });
  const holder = new THREE.Group();
  holder.add(model);
  holder.rotation.y = YAW[e.forward || '+x'];
  const g = new THREE.Group();
  g.add(holder);
  // scale to the real length, centre, on the ground
  let box = new THREE.Box3().setFromObject(g);
  const len = Math.max(box.max.x - box.min.x, box.max.z - box.min.z);
  holder.scale.setScalar((e.length || 4.5) / len);
  box = new THREE.Box3().setFromObject(g);
  const c = box.getCenter(new THREE.Vector3());
  holder.position.set(-c.x, -box.min.y, -c.z);
  g.updateMatrixWorld(true);
  car = g;
  scene.add(car);
  glassMeshes = [];
  car.traverse((o) => {
    if (o.isMesh && o.visible && isGlass(o, e)) glassMeshes.push(o);
    if (o.isMesh) o.userData.mat = o.material;
  });
  box = new THREE.Box3().setFromObject(car);
  shadow.scale.set((box.max.x - box.min.x) * 1.25, 1, (box.max.z - box.min.z) * 1.6);
  return { glass: glassMeshes.length, meshes: countMeshes(), size: box.getSize(new THREE.Vector3()).toArray().map((v) => +v.toFixed(2)) };
};
const countMeshes = () => {
  let n = 0;
  car.traverse((o) => o.isMesh && n++);
  return n;
};

// mask shader: the glass of a group in white, in car space (world space here: the car sits at
// the origin, nose +x)
function maskMaterial(group) {
  const e = entry;
  return new THREE.ShaderMaterial({
    side: THREE.DoubleSide,
    uniforms: { uB: { value: e.bPillar ?? 0 }, uBelt: { value: e.belt ?? 0.8 }, uRear: { value: e.rearLimit ?? -9 }, uGroup: { value: group === 'front' ? 0 : group === 'rear' ? 1 : 2 } },
    vertexShader: 'varying vec3 vP; varying vec3 vN; void main(){ vec4 w = modelMatrix * vec4(position, 1.0); vP = w.xyz; vN = normalize(mat3(modelMatrix) * normal); gl_Position = projectionMatrix * viewMatrix * w; }',
    fragmentShader: `
      uniform float uB; uniform float uBelt; uniform float uRear; uniform float uGroup;
      varying vec3 vP; varying vec3 vN;
      void main(){
        vec3 n = normalize(vN);
        if (!gl_FrontFacing) n = -n;
        float side = step(0.45, abs(n.z));
        float back = step(n.x, -0.3) * (1.0 - side);
        float front = side * step(uB, vP.x);
        float rear = max(side * step(vP.x, uB) * step(uRear, vP.x), back) * step(uBelt, vP.y);
        float on = uGroup < 0.5 ? front : uGroup < 1.5 ? rear : max(front, rear);
        gl_FragColor = vec4(vec3(on), 1.0);
      }`,
  });
}

const VIEWS = {
  34: { dir: new THREE.Vector3(-0.78, 0.34, 1).normalize(), fov: 24, fill: 0.86 },
  side: { dir: new THREE.Vector3(0, 0.08, 1).normalize(), fov: 20, fill: 0.9 },
};
const black = new THREE.MeshBasicMaterial({ color: 0x000000 });
window.show = (viewId = '34', mode = 'beauty') => {
  const masks = mode !== 'beauty';
  car.traverse((o) => {
    if (!o.isMesh) return;
    if (!masks) o.material = o.userData.mat;
    else if (glassMeshes.includes(o)) o.material = maskMaterial(mode === 'glass' ? 'all' : mode);
    else o.material = black;
    o.renderOrder = masks && glassMeshes.includes(o) ? 2 : 0;
  });
  ground.visible = shadow.visible = !masks;
  scene.background = new THREE.Color(masks ? 0x000000 : 0x08090b);
  renderer.toneMapping = masks ? THREE.NoToneMapping : THREE.ACESFilmicToneMapping;
  const v = VIEWS[viewId];
  camera.fov = v.fov;
  const box = new THREE.Box3().setFromObject(car);
  const center = box.getCenter(new THREE.Vector3());
  center.y *= 0.9;
  const corners = [];
  for (const x of [box.min.x, box.max.x]) for (const y of [box.min.y, box.max.y]) for (const z of [box.min.z, box.max.z]) corners.push(new THREE.Vector3(x, y, z));
  let lo = 2;
  let hi = 60;
  for (let k = 0; k < 32; k++) {
    const d = (lo + hi) / 2;
    camera.position.copy(center).addScaledVector(v.dir, d);
    camera.lookAt(center);
    camera.updateProjectionMatrix();
    camera.updateMatrixWorld();
    let mx = 0;
    let my = 0;
    for (const c of corners) {
      const p = c.clone().project(camera);
      mx = Math.max(mx, Math.abs(p.x));
      my = Math.max(my, Math.abs(p.y));
    }
    if (mx > v.fill || my > v.fill * 0.86) lo = d;
    else hi = d;
  }
  camera.position.copy(center).addScaledVector(v.dir, hi);
  camera.lookAt(center);
  renderer.render(scene, camera);
};
window.frameData = () => canvas.toDataURL('image/png');
/** materials of the model, by name, with how much of the surface they cover (to pick the paint) */
window.materials = () => {
  const m = new Map();
  car.traverse((o) => {
    if (!o.isMesh) return;
    const name = o.material?.name || '(sans nom)';
    const pos = o.geometry.attributes.position;
    const prev = m.get(name) || { tris: 0, color: o.material?.color?.getHexString?.(), transparent: o.material?.transparent, opacity: o.material?.opacity, meshes: [] };
    prev.tris += (o.geometry.index ? o.geometry.index.count : pos.count) / 3;
    if (prev.meshes.length < 4) prev.meshes.push(o.name);
    m.set(name, prev);
  });
  return [...m.entries()].sort((a, b) => b[1].tris - a[1].tris).slice(0, 40);
};
window.ready = true;
