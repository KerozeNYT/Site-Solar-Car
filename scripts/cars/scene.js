/**
 * Generic cars of the window tint simulator (simplified mode), built from scripts/cars/types.js
 * and rendered in a studio on the site's dark background. Exposes:
 *   window.show(typeId, view, mode)  view: '34' (three-quarter rear) | 'side'; mode: 'beauty'
 *                                     or a mask: 'front' | 'rear' (white where those windows are)
 *   window.frameData()               PNG data URL of the canvas
 * The body is lofted from profiles; glass, trims and lights are regions computed per pixel in
 * the shaders (car-space position and normal), so the masks match the picture exactly.
 */
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { carTypes } from './types.js';

const q = new URLSearchParams(location.search);
const W = Number(q.get('w') || 1600);
const H = Number(q.get('h') || 1000);

const canvas = document.createElement('canvas');
document.body.append(canvas);
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true, alpha: false });
renderer.setPixelRatio(1);
renderer.setSize(W, H, false);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(26, W / H, 0.1, 100);

// ------------------------------------------------------------------ studio
function studio() {
  const env = new THREE.Scene();
  env.add(new THREE.Mesh(new THREE.BoxGeometry(30, 12, 30), new THREE.MeshBasicMaterial({ color: 0x0b0c0e, side: THREE.BackSide })));
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(30, 30), new THREE.MeshBasicMaterial({ color: 0x1a1b1e }));
  floor.rotation.x = -Math.PI / 2;
  env.add(floor);
  const strip = (w, h, d, k, x, y, z) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshBasicMaterial({ color: new THREE.Color(1, 1, 1).multiplyScalar(k) }));
    m.position.set(x, y, z);
    env.add(m);
  };
  // a large soft box above, long strips on both sides and behind: the lines on the paint
  strip(8, 0.05, 3.2, 2.2, 0, 5, 0);
  for (const z of [-7, 7]) strip(12, 0.5, 0.1, 2.6, 0, 2.2, z);
  for (const x of [-8, 8]) strip(0.1, 0.4, 10, 1.8, x, 2.0, 0);
  strip(4, 3, 0.1, 0.6, 3, 2.5, 9);
  const pmrem = new THREE.PMREMGenerator(renderer);
  const rt = pmrem.fromScene(env, 0.0, 0.1, 80, { size: 512, position: new THREE.Vector3(0, 1, 0) });
  pmrem.dispose();
  return rt.texture;
}
scene.environment = studio();
scene.add(new THREE.HemisphereLight(0xdfe6ff, 0x16171a, 0.5));
const key = new THREE.DirectionalLight(0xffffff, 1.6);
key.position.set(-3, 6, 4);
scene.add(key);

// background: the site's near-black, a soft pool of light under the car
const bgCanvas = document.createElement('canvas');
bgCanvas.width = bgCanvas.height = 1024;
{
  const g = bgCanvas.getContext('2d');
  const r = g.createRadialGradient(512, 512, 0, 512, 512, 512);
  r.addColorStop(0, '#24262c');
  r.addColorStop(0.35, '#17181c');
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
scene.background = new THREE.Color(0x08090b);
// contact shadow
const shCanvas = document.createElement('canvas');
shCanvas.width = shCanvas.height = 256;
{
  const g = shCanvas.getContext('2d');
  const r = g.createRadialGradient(128, 128, 10, 128, 128, 128);
  r.addColorStop(0, 'rgba(0,0,0,0.85)');
  r.addColorStop(0.55, 'rgba(0,0,0,0.55)');
  r.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = r;
  g.fillRect(0, 0, 256, 256);
}
const shadow = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(shCanvas), transparent: true, depthWrite: false, toneMapped: false }));
shadow.rotation.x = -Math.PI / 2;
shadow.position.y = 0.002;
scene.add(shadow);

// ------------------------------------------------------------------ profiles
/** y of a polyline [[x, y], …] at x, smoothed over ±s metres */
function profile(points, s = 0.06) {
  const lin = (x) => {
    if (x <= points[0][0]) return points[0][1];
    for (let i = 1; i < points.length; i++) {
      const [x0, y0] = points[i - 1];
      const [x1, y1] = points[i];
      if (x <= x1) return y0 + ((y1 - y0) * (x - x0)) / Math.max(1e-6, x1 - x0);
    }
    return points[points.length - 1][1];
  };
  return (x) => {
    let a = 0;
    for (let k = -4; k <= 4; k++) a += lin(x + (k * s) / 4);
    return a / 9;
  };
}

// ------------------------------------------------------------------ shading regions (GLSL)
const REGIONS = /* glsl */ `
  uniform sampler2D uProf;   // r: top of the lower body (belt), g: roof line, along x
  uniform vec2 uX;           // x range of uProf
  uniform vec2 uFront[6];
  uniform int uFrontN;
  uniform vec2 uRear[6];
  uniform int uRearN;
  uniform vec3 uSplit;       // x of the bars inside the rear side glass (99 = none)
  uniform float uHalfW;
  uniform float uVan;
  uniform float uGlassRoof;
  uniform float uSoftTop;
  varying vec3 vP;
  varying vec3 vN;
  vec2 prof(float x) { return texture2D(uProf, vec2(clamp((x - uX.x) / (uX.y - uX.x), 0.0, 1.0), 0.5)).rg; }
  float smin(float a, float b, float k) { float h = clamp(0.5 + 0.5 * (b - a) / k, 0.0, 1.0); return mix(b, a, h) - k * h * (1.0 - h); }
  // signed distance inside a convex polygon (positive inside)
  float poly(vec2 p, vec2 v[6], int n) {
    float d = 1e3;
    for (int i = 0; i < 6; i++) {
      if (i >= n) break;
      vec2 a = v[i];
      vec2 b = v[(i + 1 == n) ? 0 : i + 1];
      vec2 e = normalize(b - a);
      d = smin(d, e.x * (p.y - a.y) - e.y * (p.x - a.x), 0.025);
    }
    return d;
  }
  // side glass: inside the outline, below the roof line, above the belt
  float sideGlass(vec2 p, vec2 v[6], int n) {
    vec2 pr = prof(p.x);
    float d = poly(p, v, n);
    d = smin(d, p.y - pr.x - 0.02, 0.03);
    d = smin(d, pr.y - 0.045 - p.y, 0.03);
    return d;
  }
  // region of the greenhouse at this point: 0 paint, 1 black trim, 2 front side glass,
  // 3 rear side glass, 4 rear windscreen, 5 windscreen, 6 roof
  float region(out float trimDist) {
    vec3 n = normalize(vN);
    vec2 p = vec2(vP.x, vP.y);
    vec2 pr = prof(vP.x);
    trimDist = 1.0;
    if (abs(n.z) > 0.5) {
      float f = sideGlass(p, uFront, uFrontN);
      float r = sideGlass(p, uRear, uRearN);
      float bar = min(min(abs(p.x - uSplit.x), abs(p.x - uSplit.y)), abs(p.x - uSplit.z)) - 0.035;
      if (f > 0.0) return 2.0;
      if (r > 0.0 && bar > 0.0) return 3.0;
      float g = max(f, r);
      trimDist = -g;
      if (g > -0.045 || (r > 0.0 && bar <= 0.0)) return 1.0;
      return (uSoftTop > 0.5 && p.y > pr.x + 0.06) ? 1.0 : 0.0;
    }
    if (n.x < -0.25 && abs(n.z) < 0.55) {
      bool inner = abs(n.z) < 0.42 && p.y > pr.x + 0.035 && p.y < pr.y - 0.035;
      if (uVan > 0.5) inner = abs(vP.z) < uHalfW - 0.16 && p.y > pr.x + 0.08 && p.y < pr.y - 0.12 && abs(vP.z) > 0.035;
      return inner ? 4.0 : (uSoftTop > 0.5 ? 1.0 : 1.0);
    }
    if (n.x > 0.25 && abs(n.z) < 0.55) {
      return (abs(n.z) < 0.42 && p.y > pr.x + 0.03) ? 5.0 : 1.0;
    }
    if (uSoftTop > 0.5) return 1.0;
    if (uGlassRoof > 0.5 && abs(vP.z) < uHalfW * 0.6) return 5.0;
    return 6.0;
  }
`;

function bodyMaterial(type, kind) {
  const m = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(type.paint),
    metalness: 0.15,
    roughness: 0.32,
    clearcoat: 1,
    clearcoatRoughness: 0.03,
    envMapIntensity: 1.1,
  });
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, uniformsFor(type));
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vP;\nvarying vec3 vN;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvP = position;\nvN = normal;');
    const lower = /* glsl */ `
      float trimDist;
      vec3 nn = normalize(vN);
      float rough = roughnessFactor;
      float metal = metalnessFactor;
      vec3 emit = vec3(0.0);
      float coat = 1.0;
      ${
        kind === 'cabin'
          ? `
      float reg = region(trimDist);
      if (reg > 1.5 && reg < 5.5 || (reg > 4.5 && reg < 5.5)) { diffuseColor.rgb = vec3(0.05, 0.055, 0.065); rough = 0.04; metal = 0.0; }
      else if (reg > 0.5 && reg < 1.5) { diffuseColor.rgb = uSoftTop > 0.5 ? vec3(0.022) : vec3(0.012); rough = uSoftTop > 0.5 ? 0.85 : 0.3; metal = 0.0; coat = uSoftTop > 0.5 ? 0.0 : 0.6; }
      `
          : `
      vec2 pr = prof(vP.x);
      float yb = vP.y;
      // lower black trim: bumpers' lower part and sills (SUV: wide cladding)
      float clad = uClad > 0.5 ? 0.24 : 0.11;
      if (vP.y < uClear + clad && abs(nn.y) < 0.9) { diffuseColor.rgb = vec3(0.025); rough = 0.55; metal = 0.0; coat = 0.0; }
      // tail lights: a band under the top of the tail, wrapping a little onto the sides
      if (nn.x < -0.3 && vP.y > pr.x - 0.17 && vP.y < pr.x - 0.05 && abs(vP.z) > uHalfW * 0.42) { diffuseColor.rgb = vec3(0.32, 0.01, 0.02); rough = 0.12; emit = vec3(0.55, 0.02, 0.03); }
      // number plate
      if (nn.x < -0.6 && abs(vP.z) < 0.26 && vP.y > uPlateY - 0.058 && vP.y < uPlateY + 0.058) { diffuseColor.rgb = vec3(0.9); rough = 0.4; coat = 0.2; }
      // headlights and grille
      if (nn.x > 0.35 && vP.y > pr.x - 0.16 && vP.y < pr.x - 0.04 && abs(vP.z) > uHalfW * 0.48) { diffuseColor.rgb = vec3(0.08, 0.09, 0.1); rough = 0.05; emit = vec3(0.35, 0.38, 0.42) * smoothstep(0.05, 0.0, abs(vP.y - (pr.x - 0.1)) - 0.015); }
      if (nn.x > 0.55 && abs(vP.z) < uHalfW * 0.45 && vP.y > uClear + 0.12 && vP.y < pr.x - 0.2) { diffuseColor.rgb = vec3(0.018); rough = 0.35; metal = 0.0; coat = 0.3; }
      // door shut lines
      if (abs(nn.z) > 0.6 && vP.y > uClear + clad && vP.y < pr.x - 0.015) {
        float sl = min(abs(vP.x - uSeams.x), min(abs(vP.x - uSeams.y), abs(vP.x - uSeams.z)));
        float line = 1.0 - smoothstep(0.0025, 0.005, sl);
        diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.05), line * 0.85);
        // handles
        float hd = max(abs(vP.x - uHandles.x) - 0.075, abs(vP.y - (pr.x - 0.075)) - 0.012);
        float hd2 = uHandles.y < 90.0 ? max(abs(vP.x - uHandles.y) - 0.075, abs(vP.y - (pr.x - 0.075)) - 0.012) : 1.0;
        if (min(hd, hd2) < 0.0) { diffuseColor.rgb *= 0.55; }
      }
      `
      }
    `;
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>\n${REGIONS}\nuniform float uClear;\nuniform float uClad;\nuniform float uPlateY;\nuniform vec3 uSeams;\nuniform vec2 uHandles;`)
      .replace('#include <color_fragment>', `#include <color_fragment>\n${lower}`)
      .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor = rough;')
      .replace('#include <metalnessmap_fragment>', '#include <metalnessmap_fragment>\nmetalnessFactor = metal;')
      .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance += emit;')
      .replace('#include <lights_physical_fragment>', '#include <lights_physical_fragment>\n#ifdef USE_CLEARCOAT\nmaterial.clearcoat *= coat;\n#endif');
  };
  m.customProgramCacheKey = () => `car-${kind}`;
  return m;
}

/** mask: white where the windows of `group` are ('front' | 'rear'), black elsewhere */
function maskMaterial(type, group) {
  return new THREE.ShaderMaterial({
    uniforms: uniformsFor(type),
    vertexShader: 'varying vec3 vP; varying vec3 vN; void main(){ vP = position; vN = normal; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `${REGIONS}
      uniform float uGroup;
      void main(){
        float t; float r = region(t);
        float on = uGroup < 0.5 ? step(1.5, r) * step(r, 2.5) : (step(2.5, r) * step(r, 4.5));
        gl_FragColor = vec4(vec3(on), 1.0);
      }`,
    defines: {},
  });
}

let uniformCache = null;
function uniformsFor(type) {
  if (uniformCache && uniformCache.type === type) return uniformCache.u;
  const x0 = -type.L / 2 - 0.05;
  const x1 = type.L / 2 + 0.05;
  const belt = profile(type.body);
  const roof = profile(type.roof, 0.05);
  const N = 512;
  const data = new Float32Array(N * 4);
  for (let i = 0; i < N; i++) {
    const x = x0 + ((x1 - x0) * i) / (N - 1);
    data[i * 4] = belt(x);
    data[i * 4 + 1] = Math.max(belt(x), roof(x));
  }
  const tex = new THREE.DataTexture(data, N, 1, THREE.RGBAFormat, THREE.FloatType);
  tex.minFilter = tex.magFilter = THREE.LinearFilter;
  tex.needsUpdate = true;
  const pad = (pts) => [...pts.map(([x, y]) => new THREE.Vector2(x, y)), ...Array.from({ length: 6 - pts.length }, () => new THREE.Vector2())];
  const split = [...(type.split || []), 99, 99, 99].slice(0, 3);
  const fw = type.windows.front;
  const rw = type.windows.rear;
  const fx = fw.map((p) => p[0]);
  const rx = rw.map((p) => p[0]);
  // shut lines: front door (behind the front glass, ahead of it), rear door
  const seams = [Math.min(...fx) - 0.03, Math.max(...fx) + 0.24, type.split ? Math.min(...rx) + (type.van ? 0 : 0.05) : 99];
  const u = {
    uProf: { value: tex },
    uX: { value: new THREE.Vector2(x0, x1) },
    uFront: { value: pad(fw) },
    uFrontN: { value: fw.length },
    uRear: { value: pad(rw) },
    uRearN: { value: rw.length },
    uSplit: { value: new THREE.Vector3(...split) },
    uHalfW: { value: type.W / 2 },
    uVan: { value: type.van ? 1 : 0 },
    uGlassRoof: { value: type.glassRoof ? 1 : 0 },
    uSoftTop: { value: type.softTop ? 1 : 0 },
    uClear: { value: type.clearance },
    uClad: { value: type.cladding ? 1 : 0 },
    uPlateY: { value: belt(-type.L / 2) * 0.7 },
    uSeams: { value: new THREE.Vector3(...seams) },
    uHandles: { value: new THREE.Vector2(Math.min(...fx) + 0.12, type.split ? Math.min(...rx) + 0.17 : 99) },
    uGroup: { value: 0 },
  };
  uniformCache = { type, u };
  return u;
}

// ------------------------------------------------------------------ geometry
/** a loft: for each x, a closed section from section(x) -> [[z, y], …] (same count) */
function loft(xs, section) {
  const rings = xs.map((x) => section(x));
  const M = rings[0].length;
  const pos = [];
  const idx = [];
  rings.forEach((ring, i) => ring.forEach(([z, y]) => pos.push(xs[i], y, z)));
  for (let i = 0; i < xs.length - 1; i++)
    for (let j = 0; j < M; j++) {
      const a = i * M + j;
      const b = i * M + ((j + 1) % M);
      const c = (i + 1) * M + j;
      const d = (i + 1) * M + ((j + 1) % M);
      idx.push(a, c, b, b, c, d);
    }
  // end caps
  const cap = (i, flip) => {
    const center = pos.length / 3;
    const ring = rings[i];
    const cy = ring.reduce((s, p) => s + p[1], 0) / M;
    pos.push(xs[i], cy, 0);
    for (let j = 0; j < M; j++) {
      const a = i * M + j;
      const b = i * M + ((j + 1) % M);
      flip ? idx.push(center, b, a) : idx.push(center, a, b);
    }
  };
  cap(0, false);
  cap(xs.length - 1, true);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

const se = (t, n) => Math.sign(t) * Math.pow(Math.abs(t), 2 / n);

function buildCar(type) {
  const group = new THREE.Group();
  const belt = profile(type.body);
  const roof = profile(type.roof, 0.05);
  const bx0 = type.body[0][0];
  const bx1 = type.body[type.body.length - 1][0];
  const xm = (bx0 + bx1) / 2;
  const half = (bx1 - bx0) / 2;
  const hw = (x) => (type.W / 2) * Math.pow(Math.max(0, 1 - Math.pow(Math.min(1, Math.abs((x - xm) / half)), 7)), 1 / 7);
  const wheels = [type.axle + type.wheelbase / 2, type.axle - type.wheelbase / 2];
  const Ra = type.R + 0.045;
  const bottom = (x) => {
    let y = type.clearance;
    for (const xw of wheels) if (Math.abs(x - xw) < Ra) y = Math.max(y, type.R + Math.sqrt(Ra * Ra - (x - xw) * (x - xw)));
    // bumpers lift a little at both ends
    const e = Math.min(x - bx0, bx1 - x);
    if (e < 0.25) y += (0.25 - e) * 0.35;
    return y;
  };
  const M = 120;
  const N = 420;
  const xs = Array.from({ length: N }, (_, i) => bx0 + 0.0005 + ((bx1 - bx0 - 0.001) * i) / (N - 1));
  const lowerGeo = loft(xs, (x) => {
    const top = belt(x);
    const bot = Math.min(bottom(x), top - 0.04);
    const yc = (top + bot) / 2;
    const hh = (top - bot) / 2;
    const w = Math.max(0.01, hw(x));
    return Array.from({ length: M }, (_, j) => {
      const t = (j / M) * Math.PI * 2;
      const c = Math.cos(t);
      const s = Math.sin(t);
      // fuller at the shoulder, tucked under at the sill
      const k = s > 0 ? 1 - 0.06 * s * s : 1 - 0.1 * s * s;
      return [w * k * se(c, 5), yc + hh * se(s, 4)];
    });
  });
  const lower = new THREE.Mesh(lowerGeo, bodyMaterial(type, 'lower'));
  lower.userData.kind = 'lower';
  group.add(lower);

  // greenhouse
  const rx0 = type.roof[0][0];
  const rx1 = type.roof[type.roof.length - 1][0];
  const RN = 360;
  const rxs = Array.from({ length: RN }, (_, i) => rx0 + 0.0005 + ((rx1 - rx0 - 0.001) * i) / (RN - 1));
  const tumble = type.van ? 0.94 : 0.76;
  const cabinGeo = loft(rxs, (x) => {
    const y0 = belt(x) - 0.03;
    const y1 = Math.max(y0 + 0.004, roof(x));
    const wb = Math.max(0.01, hw(x) - (type.van ? 0.015 : 0.05));
    const wt = wb * tumble;
    return Array.from({ length: M }, (_, j) => {
      const t = (j / M) * Math.PI * 2;
      const c = Math.cos(t);
      const s = Math.sin(t);
      const v = 0.5 + 0.5 * se(s, type.van ? 8 : 5);
      const w = wb + (wt - wb) * v;
      return [w * se(c, type.van ? 10 : 6), y0 + (y1 - y0) * v];
    });
  });
  const cabin = new THREE.Mesh(cabinGeo, bodyMaterial(type, 'cabin'));
  cabin.userData.kind = 'cabin';
  group.add(cabin);

  // wheels
  const tireProfile = [];
  const tw = 0.235;
  for (let i = 0; i <= 24; i++) {
    const a = -Math.PI / 2 + (Math.PI * i) / 24;
    tireProfile.push(new THREE.Vector2(type.R - 0.02 + Math.cos(a) * 0.025 + (type.R * 0.27) * (1 - Math.cos(a)) * 0, (Math.sin(a) * tw) / 2));
  }
  const tireMat = new THREE.MeshStandardMaterial({ color: 0x0c0c0d, roughness: 0.85 });
  const rimMat = new THREE.MeshPhysicalMaterial({ color: 0x5d6168, metalness: 0.85, roughness: 0.28, clearcoat: 0.6 });
  const darkMat = new THREE.MeshStandardMaterial({ color: 0x050506, roughness: 0.9 });
  for (const xw of wheels)
    for (const side of [-1, 1]) {
      const wg = new THREE.Group();
      const tire = new THREE.Mesh(new THREE.TorusGeometry(type.R - 0.07, 0.07, 18, 64), tireMat);
      tire.scale.set(1, 1, 1.55);
      wg.add(tire);
      const tread = new THREE.Mesh(new THREE.CylinderGeometry(type.R - 0.005, type.R - 0.005, tw * 0.82, 64, 1, true), tireMat);
      tread.rotation.x = Math.PI / 2;
      wg.add(tread);
      const rimR = type.R * 0.7;
      const disc = new THREE.Mesh(new THREE.CylinderGeometry(rimR, rimR, 0.02, 48), darkMat);
      disc.rotation.x = Math.PI / 2;
      disc.position.z = side * 0.06;
      wg.add(disc);
      const lip = new THREE.Mesh(new THREE.TorusGeometry(rimR, 0.012, 8, 64), rimMat);
      lip.position.z = side * 0.085;
      wg.add(lip);
      for (let k = 0; k < 10; k++) {
        const sp = new THREE.Mesh(new THREE.BoxGeometry(rimR * 0.92, 0.028, 0.02), rimMat);
        const a = (k / 10) * Math.PI * 2;
        sp.position.set(Math.cos(a) * rimR * 0.48, Math.sin(a) * rimR * 0.48, side * 0.08);
        sp.rotation.z = a + (k % 2 ? 0.12 : -0.12);
        wg.add(sp);
      }
      const hub = new THREE.Mesh(new THREE.CylinderGeometry(rimR * 0.18, rimR * 0.18, 0.03, 24), rimMat);
      hub.rotation.x = Math.PI / 2;
      hub.position.z = side * 0.085;
      wg.add(hub);
      wg.position.set(xw, type.R, side * (type.W / 2 - tw / 2 - 0.035));
      group.add(wg);
      // dark wheel well behind the wheel
      const well = new THREE.Mesh(new THREE.CylinderGeometry(Ra - 0.01, Ra - 0.01, type.W - 0.5, 40, 1, false, 0, Math.PI), darkMat);
      well.rotation.x = Math.PI / 2;
      well.rotation.y = 0;
      well.position.set(xw, type.R, 0);
      well.scale.set(1, 1, 1);
      group.add(well);
    }

  // door mirrors
  const fw = type.windows.front;
  const mx = Math.max(...fw.map((p) => p[0])) - 0.08;
  const my = belt(mx) + 0.06;
  for (const side of [-1, 1]) {
    const mirror = new THREE.Mesh(new RoundedBoxGeometry(0.2, 0.12, 0.13, 4, 0.04), new THREE.MeshPhysicalMaterial({ color: new THREE.Color(type.paint), clearcoat: 1, roughness: 0.3 }));
    mirror.position.set(mx, my, side * (hw(mx) + 0.06));
    group.add(mirror);
    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.03, 0.08), darkMat);
    arm.position.set(mx + 0.02, my - 0.04, side * (hw(mx) + 0.0));
    group.add(arm);
  }
  return group;
}

// ------------------------------------------------------------------ show
let current = null;
const VIEWS = {
  // three-quarter rear (the car's right-hand side and its tail), and the right-hand profile
  34: { dir: new THREE.Vector3(-0.78, 0.36, 1).normalize(), fov: 24, fill: 0.84, lift: 0.0 },
  side: { dir: new THREE.Vector3(0, 0.1, 1).normalize(), fov: 20, fill: 0.88, lift: 0.0 },
};

window.show = (typeId, viewId = '34', mode = 'beauty') => {
  const type = carTypes.find((t) => t.id === typeId);
  if (!current || current.type !== type) {
    if (current) scene.remove(current.group);
    uniformCache = null;
    const group = buildCar(type);
    scene.add(group);
    current = { type, group };
    shadow.scale.set(type.L * 1.25, 1, type.W * 1.5);
  }
  const { group } = current;
  // materials for the mode
  group.traverse((o) => {
    if (!o.isMesh) return;
    o.userData.mat ??= o.material;
    if (mode === 'beauty') o.material = o.userData.mat;
    else if (o.userData.kind === 'cabin') {
      const m = maskMaterial(type, mode);
      m.uniforms.uGroup.value = mode === 'front' ? 0 : 1;
      o.material = m;
    } else o.material = (o.userData.black ??= new THREE.MeshBasicMaterial({ color: 0x000000 }));
  });
  ground.visible = shadow.visible = mode === 'beauty';
  scene.background = new THREE.Color(mode === 'beauty' ? 0x08090b : 0x000000);
  renderer.toneMapping = mode === 'beauty' ? THREE.ACESFilmicToneMapping : THREE.NoToneMapping;

  // frame the car: same direction for every type, distance fitted to its size
  const v = VIEWS[viewId];
  camera.fov = v.fov;
  const box = new THREE.Box3().setFromObject(group);
  const center = box.getCenter(new THREE.Vector3());
  center.y *= 0.92;
  const corners = [];
  for (const x of [box.min.x, box.max.x]) for (const y of [box.min.y, box.max.y]) for (const z of [box.min.z, box.max.z]) corners.push(new THREE.Vector3(x, y, z));
  let lo = 2;
  let hi = 40;
  for (let k = 0; k < 30; k++) {
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
window.types = carTypes.map((t) => t.id);
window.ready = true;
