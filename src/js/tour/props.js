import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

/*
 * Workshop equipment shared by the studio of the tour and the fitting workshop of the
 * simulators: the polydalle floor (GLSL), film rolls on wall brackets, the tint tool board
 * (squeegees, cutters, heat gun), polishers on their wall shelf with the pad rack, Koch-Chemie
 * product shelving and microfibre cubbies. Static parts are merged per material, so a whole
 * wall costs a handful of draw calls.
 */

// ---------------------------------------------------------------- polydalle floor
/**
 * Interlocking PVC floor tiles (0.5 m) for a floor shader. `polydalle(p)` takes world xz and
 * returns the tile index (.xy), the seam coverage (.z, anti-aliased, dovetail teeth) and a
 * 1 cm band along the seams (.w, the bevelled tile edges catching the light).
 * `pdGrain(p)` is the raised diamond-point texture, faded out before it can shimmer.
 * `pdRing(id, r)` is 1 on the border of the tile rectangle r = (x0, x1, z0, z1), inclusive.
 */
export const POLYDALLE_GLSL = /* glsl */ `
  float pdHash(vec2 p){ return fract(sin(dot(p, vec2(41.3, 289.1))) * 43758.5453); }
  float pdTeeth(float u){ return clamp(abs(fract(u) - 0.5) * 8.0 - 2.0, -1.0, 1.0); }
  vec2 pdLine(vec2 e, vec2 fw, float w){
    return (1.0 - smoothstep(vec2(0.0), fw + w * 0.5, abs(e))) * min(vec2(1.0), w / fw);
  }
  vec4 polydalle(vec2 p){
    vec2 u = p / 0.5;
    vec2 k = floor(u + 0.5);
    vec2 d = u - k;
    vec2 e = vec2(d.x - 0.032 * pdTeeth(u.y * 6.0), d.y - 0.032 * pdTeeth(u.x * 6.0 + 0.5));
    vec2 id = k - step(e, vec2(0.0));
    vec2 fw = max(fwidth(e), vec2(1e-5));
    vec2 seam = pdLine(e, fw, 0.007);
    vec2 edge = pdLine(e, fw, 0.04);
    return vec4(id, max(seam.x, seam.y), max(edge.x, edge.y));
  }
  float pdGrain(vec2 p){
    vec2 g = p * 64.0;
    vec2 f = abs(fract(g) - 0.5);
    return (f.x + f.y - 0.5) * clamp(1.6 - fwidth(g.x) * 2.5, 0.0, 1.0);
  }
  float pdRing(vec2 id, vec4 r){
    float inside = step(r.x, id.x) * step(id.x, r.y) * step(r.z, id.y) * step(id.y, r.w);
    float inner = step(r.x + 1.0, id.x) * step(id.x, r.y - 1.0) * step(r.z + 1.0, id.y) * step(id.y, r.w - 1.0);
    return inside * (1.0 - inner);
  }
`;

// ---------------------------------------------------------------- batching
const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _e = new THREE.Euler();
const _p = new THREE.Vector3();
const _s = new THREE.Vector3();
export const M = (x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, s = 1) =>
  new THREE.Matrix4().compose(_p.set(x, y, z), _q.setFromEuler(_e.set(rx, ry, rz)), _s.setScalar(s));

/** Collects transformed primitives and merges them into one mesh per material. */
export class Batch {
  constructor() {
    this.parts = new Map();
    this.base = new THREE.Matrix4();
  }
  add(geo, mat, m = null) {
    geo.applyMatrix4(m ? _m.multiplyMatrices(this.base, m) : this.base);
    if (!this.parts.has(mat)) this.parts.set(mat, []);
    this.parts.get(mat).push(geo);
    return this;
  }
  box(w, h, d, mat, x, y, z, rx = 0, ry = 0, rz = 0) {
    return this.add(new THREE.BoxGeometry(w, h, d), mat, M(x, y, z, rx, ry, rz));
  }
  /** cylinder along y; rz = PI/2 lays it along x, rx = PI/2 along z */
  cyl(r0, r1, h, mat, x, y, z, rx = 0, ry = 0, rz = 0, seg = 16) {
    return this.add(new THREE.CylinderGeometry(r0, r1, h, seg), mat, M(x, y, z, rx, ry, rz));
  }
  /** plane facing +z, with its uvs mapped onto a cell of a texture atlas */
  plane(w, h, mat, x, y, z, cell = null, ry = 0) {
    const g = new THREE.PlaneGeometry(w, h);
    if (cell) {
      const uv = g.attributes.uv;
      for (let i = 0; i < uv.count; i++) uv.setXY(i, cell[0] + uv.getX(i) * (cell[2] - cell[0]), cell[1] + uv.getY(i) * (cell[3] - cell[1]));
    }
    return this.add(g, mat, M(x, y, z, 0, ry, 0));
  }
  /** run `fn` with the transform `m` appended (local coordinates) */
  at(m, fn) {
    const prev = this.base.clone();
    this.base.multiply(m);
    fn(this);
    this.base.copy(prev);
    return this;
  }
  build(name = 'props') {
    const g = new THREE.Group();
    g.name = name;
    for (const [mat, list] of this.parts) {
      const geo = mergeGeometries(list, false);
      for (const x of list) x.dispose();
      g.add(new THREE.Mesh(geo, mat));
    }
    this.parts.clear();
    return g;
  }
}

// ---------------------------------------------------------------- textures
function canvasTexture(w, h, draw, { repeat = null } = {}) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  if (repeat) {
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(...repeat);
  }
  return t;
}

// Koch-Chemie range on the shelves (plain text labels, colour-coded like the bottles)
const KOCH = [
  { code: 'H9.01', name: 'Heavy Cut', bg: '#b3161b' },
  { code: 'M3.02', name: 'Micro Cut', bg: '#0f4fa8' },
  { code: 'F6.01', name: 'Fine Cut', bg: '#1d6b2f' },
  { code: 'P6.01', name: 'One Cut & Finish', bg: '#5a1f8f' },
  { code: 'Gsf', name: 'Gentle Snow Foam', bg: '#cf2a6b' },
  { code: 'GS', name: 'Green Star', bg: '#2f8a3a' },
  { code: 'RWC', name: 'Reactive Wheel Cleaner', bg: '#e0610e' },
  { code: 'Pol', name: 'Pol Star', bg: '#3b4650' },
];
let labelAtlas = null;
function kochLabels() {
  if (labelAtlas) return labelAtlas;
  const cw = 256;
  const ch = 384;
  const tex = canvasTexture(cw * 4, ch * 2, (g) => {
    KOCH.forEach((p, i) => {
      const x = (i % 4) * cw;
      const y = Math.floor(i / 4) * ch;
      g.fillStyle = p.bg;
      g.fillRect(x, y, cw, ch);
      g.fillStyle = '#ffffff';
      g.fillRect(x, y, cw, 74);
      g.fillStyle = '#16181b';
      g.font = 'bold 30px Arial, sans-serif';
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.fillText('KOCH-CHEMIE', x + cw / 2, y + 38);
      g.fillStyle = '#ffffff';
      g.font = 'bold 84px Arial, sans-serif';
      g.fillText(p.code, x + cw / 2, y + 180);
      g.font = 'bold 26px Arial, sans-serif';
      g.fillText(p.name.length > 16 ? p.name.slice(0, 16) + '…' : p.name, x + cw / 2, y + 262);
      g.fillStyle = 'rgba(255,255,255,0.35)';
      g.fillRect(x + 30, y + 312, cw - 60, 4);
    });
  });
  const cells = KOCH.map((_, i) => {
    const u0 = (i % 4) / 4;
    const v1 = 1 - Math.floor(i / 4) / 2;
    return [u0, v1 - 0.5, u0 + 0.25, v1];
  });
  labelAtlas = { tex, cells, colors: KOCH.map((p) => new THREE.Color(p.bg)) };
  return labelAtlas;
}

function kochHeader() {
  return canvasTexture(1024, 192, (g, w, h) => {
    g.fillStyle = '#0d0e10';
    g.fillRect(0, 0, w, h);
    g.fillStyle = '#ffffff';
    g.font = 'bold 112px Arial, sans-serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText('KOCH-CHEMIE', w / 2, h / 2 - 6);
    g.fillStyle = '#c8161d';
    g.fillRect(w * 0.2, h - 30, w * 0.6, 8);
  });
}

function pegboard(color, hole) {
  return canvasTexture(
    256,
    256,
    (g, w, h) => {
      g.fillStyle = color;
      g.fillRect(0, 0, w, h);
      g.fillStyle = hole;
      for (let x = 8; x < w; x += 16) for (let y = 8; y < h; y += 16) g.fillRect(x - 2, y - 2, 4, 4);
    },
    { repeat: [4, 2] }
  );
}

// ---------------------------------------------------------------- materials
const std = (color, roughness = 0.6, metalness = 0, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness, metalness, ...extra });
/** one material set per scene; `dark` = the night studio (darker steel, brighter labels) */
export function propMaterials({ dark = false } = {}) {
  return {
    steel: std(dark ? 0x23262b : 0x3a3e45, 0.45, 0.65),
    shelf: std(dark ? 0x17191d : 0x2a2e34, 0.55, 0.45),
    chrome: std(0xd4d8dc, 0.16, 1),
    rubber: std(0x111214, 0.85),
    hdpe: std(0xe9ebed, 0.42),
    core: std(0xcfc3a6, 0.8),
    blue: std(0x1d5fc4, 0.38, 0.1),
    blueDark: std(0x173f86, 0.5),
    grey: std(0x2e3238, 0.5, 0.3),
    orange: std(0xe8590c, 0.45),
    yellow: std(0xf2b705, 0.5),
    red: std(0xc8161d, 0.45),
    white: std(0xeef0f2, 0.5),
    green: std(0x2b8a3e, 0.5),
    pads: [0xf2c200, 0x1f63c6, 0xf3f3f0, 0xe36a12, 0x16171a, 0xc8161d].map((c) => std(c, 0.9)),
    films: [0x07080a, 0x0d0f12, 0x15181c, 0x1f2328, 0x2c3138, 0x3d434b].map((c) => std(c, 0.22, 0.4)),
    ppf: std(0xc9ced4, 0.35, 0.05),
    towels: [0x3d4249, 0x1f5fbf, 0xf2b705, 0x2b8a3e, 0xd9dde2, 0x7a1fa2].map((c) => std(c, 0.95)),
    label: new THREE.MeshStandardMaterial({ map: kochLabels().tex, roughness: 0.5, emissive: 0xffffff, emissiveMap: kochLabels().tex, emissiveIntensity: dark ? 0.22 : 0.05 }),
    header: new THREE.MeshBasicMaterial({ map: kochHeader(), color: new THREE.Color(1, 1, 1).multiplyScalar(dark ? 1.1 : 1), toneMapped: false }),
    board: std(0xffffff, 0.8, 0, { map: dark ? pegboard('#2b2e33', '#0c0d0f') : pegboard('#d7d9dc', 'rgba(40,44,50,0.75)') }),
  };
}

// ---------------------------------------------------------------- polisher
/**
 * Dual-action polisher in the blue of the usual workshop machines. Origin = centre of the pad
 * face, pad facing -y, motor body along -x, rear D-handle on top.
 */
export function polisher(b, mt, { body = mt.blue, pad = mt.pads[0] } = {}) {
  b.cyl(0.075, 0.075, 0.028, pad, 0, 0.014, 0, 0, 0, 0, 28);
  b.cyl(0.066, 0.066, 0.012, mt.rubber, 0, 0.034, 0, 0, 0, 0, 24);
  b.cyl(0.05, 0.056, 0.07, mt.grey, 0, 0.075, 0, 0, 0, 0, 20);
  b.cyl(0.047, 0.05, 0.036, mt.rubber, 0, 0.128, 0, 0, 0, 0, 20);
  b.cyl(0.042, 0.04, 0.27, body, -0.165, 0.09, 0, 0, 0, Math.PI / 2, 20);
  b.cyl(0.044, 0.044, 0.05, mt.rubber, -0.06, 0.09, 0, 0, 0, Math.PI / 2, 20);
  b.cyl(0.033, 0.042, 0.06, mt.grey, -0.33, 0.09, 0, 0, 0, Math.PI / 2, 16);
  b.box(0.13, 0.022, 0.03, mt.rubber, -0.25, 0.162, 0);
  b.box(0.022, 0.05, 0.028, mt.rubber, -0.305, 0.135, 0);
  b.box(0.022, 0.05, 0.028, mt.rubber, -0.195, 0.135, 0);
  b.cyl(0.011, 0.011, 0.014, mt.grey, -0.36, 0.09, 0, 0, 0, Math.PI / 2, 10);
  b.cyl(0.008, 0.008, 0.08, mt.rubber, -0.4, 0.09, 0, 0, 0, Math.PI / 2, 8);
}

// ---------------------------------------------------------------- wall units (local frame)
// Every unit is built against a wall: x along the wall, y up, z out of the wall (wall at z = 0).

/** Polishers resting on a wall shelf, with a pad rack above. Centred on x = 0. */
export function polisherWall(b, mt, { width = 2.6, n = 5, y = 1.25 } = {}) {
  b.box(width, 0.03, 0.3, mt.shelf, 0, y, 0.15);
  for (const x of [-width / 2 + 0.1, 0, width / 2 - 0.1]) b.box(0.03, 0.2, 0.28, mt.steel, x, y - 0.11, 0.14);
  b.box(width, 0.04, 0.012, mt.chrome, 0, y + 0.03, 0.296);
  const bodies = [mt.blue, mt.blue, mt.grey, mt.blue, mt.blueDark, mt.blue];
  for (let i = 0; i < n; i++) {
    const x = -width / 2 + (i + 0.5) * (width / n) + 0.12;
    b.at(M(x, y + 0.015, 0.16, 0, 0.12 * ((i % 3) - 1), 0), (bb) => polisher(bb, mt, { body: bodies[i % bodies.length], pad: mt.pads[i % mt.pads.length] }));
  }
  // pad rack: two rows of pins, a stack of foam pads on each
  for (let row = 0; row < 2; row++) {
    const yy = y + 0.5 + row * 0.27;
    b.box(width * 0.9, 0.05, 0.02, mt.steel, 0, yy, 0.01);
    const cols = Math.round(width / 0.22);
    for (let j = 0; j < cols; j++) {
      const x = -width * 0.45 + (j + 0.5) * ((width * 0.9) / cols);
      const k = 2 + ((j * 7 + row * 3) % 4);
      b.cyl(0.006, 0.006, 0.18, mt.chrome, x, yy, 0.09, Math.PI / 2, 0, 0, 6);
      b.cyl(0.072, 0.072, k * 0.026, mt.pads[(j + row * 2) % mt.pads.length], x, yy, 0.03 + (k * 0.026) / 2, Math.PI / 2, 0, 0, 24);
    }
  }
}

/** Koch-Chemie shelving: canisters at the bottom, 1 L bottles, 250 ml polishes, towels. */
export function kochShelf(b, mt, { width = 3.2, depth = 0.45 } = {}) {
  const { cells } = kochLabels();
  const levels = [0.1, 0.62, 1.1, 1.55, 2.0];
  for (const x of [-width / 2, width / 2]) for (const z of [0.03, depth - 0.03]) b.box(0.04, 2.3, 0.04, mt.steel, x, 1.15, z);
  for (const y of levels) {
    b.box(width, 0.03, depth, mt.shelf, 0, y, depth / 2);
    b.box(width, 0.05, 0.01, mt.red, 0, y - 0.01, depth + 0.002);
  }
  b.plane(width * 0.62, width * 0.62 * (192 / 1024), mt.header, 0, 2.42, 0.02);
  let n = 0;
  const label = () => cells[n++ % cells.length];
  // 10 L canisters
  for (let x = -width / 2 + 0.2; x < width / 2 - 0.15; x += 0.3) {
    const cell = label();
    b.box(0.24, 0.34, 0.2, mt.hdpe, x, levels[0] + 0.185, depth / 2);
    b.cyl(0.03, 0.03, 0.04, mt.pads[(n + 3) % 6], x + 0.06, levels[0] + 0.375, depth / 2 - 0.03);
    b.box(0.08, 0.04, 0.03, mt.hdpe, x - 0.05, levels[0] + 0.37, depth / 2);
    b.plane(0.17, 0.25, mt.label, x, levels[0] + 0.17, depth / 2 + 0.101, cell);
  }
  // 5 L canisters
  for (let x = -width / 2 + 0.16; x < width / 2 - 0.12; x += 0.23) {
    const cell = label();
    b.box(0.19, 0.28, 0.14, mt.hdpe, x, levels[1] + 0.155, depth / 2 + 0.05);
    b.cyl(0.025, 0.025, 0.035, mt.rubber, x + 0.05, levels[1] + 0.31, depth / 2 + 0.03);
    b.plane(0.14, 0.21, mt.label, x, levels[1] + 0.14, depth / 2 + 0.121, cell);
  }
  // 1 L bottles, two deep
  for (let x = -width / 2 + 0.09; x < width / 2 - 0.06; x += 0.115) {
    const cell = label();
    for (const dz of [-0.09, 0.07]) {
      b.box(0.085, 0.22, 0.062, mt.hdpe, x, levels[2] + 0.125, depth / 2 + dz);
      b.cyl(0.018, 0.02, 0.05, mt.rubber, x, levels[2] + 0.26, depth / 2 + dz, 0, 0, 0, 10);
    }
    b.plane(0.072, 0.108, mt.label, x, levels[2] + 0.11, depth / 2 + 0.07 + 0.0315, cell);
  }
  // 250 ml polishes, coloured caps, and a few pad boxes
  for (let x = -width / 2 + 0.07; x < width / 2 - 0.5; x += 0.085) {
    const cell = label();
    b.box(0.062, 0.15, 0.045, mt.hdpe, x, levels[3] + 0.09, depth / 2 + 0.08);
    b.cyl(0.016, 0.016, 0.03, mt.pads[n % 6], x, levels[3] + 0.18, depth / 2 + 0.08, 0, 0, 0, 10);
    b.plane(0.052, 0.078, mt.label, x, levels[3] + 0.085, depth / 2 + 0.08 + 0.0226, cell);
  }
  for (let i = 0; i < 3; i++) b.box(0.15, 0.12, 0.15, mt.pads[(i * 2 + 1) % 6], width / 2 - 0.4 + i * 0.16 - 0.08, levels[3] + 0.075, depth / 2);
  // top shelf: folded microfibre towels
  for (let x = -width / 2 + 0.25; x < width / 2 - 0.2; x += 0.38) {
    const k = 4 + Math.round(Math.abs(Math.sin(x * 13)) * 4);
    const t = mt.towels[Math.round(Math.abs(Math.cos(x * 7)) * 5) % mt.towels.length];
    for (let i = 0; i < k; i++) b.box(0.32, 0.024, 0.26, t, x + Math.sin(i * 2.1) * 0.01, levels[4] + 0.03 + i * 0.026, depth / 2 + Math.cos(i * 1.7) * 0.01);
  }
}

/** Film rolls on wall brackets: `bays` bays of 1.52 m rolls, tint shades and a few PPF rolls. */
export function filmRack(b, mt, { bays = 2, rows = 5, y0 = 0.5, dy = 0.42, reach = 0.3 } = {}) {
  const bw = 1.72;
  for (let i = 0; i < bays; i++) {
    const cx = (i - (bays - 1) / 2) * (bw + 0.08);
    for (const s of [-1, 1]) {
      b.box(0.05, y0 + (rows - 1) * dy + 0.3, 0.04, mt.steel, cx + s * (bw / 2), (y0 + (rows - 1) * dy + 0.3) / 2, 0.02);
      for (let r = 0; r < rows; r++) b.box(0.03, 0.04, reach, mt.steel, cx + s * (bw / 2), y0 + r * dy - 0.04, reach / 2);
    }
    for (let r = 0; r < rows; r++) {
      const y = y0 + r * dy;
      const z = reach - 0.09;
      b.cyl(0.012, 0.012, bw, mt.chrome, cx, y, z, 0, 0, Math.PI / 2, 8);
      const k = (i * 5 + r * 3) % 7;
      const rad = 0.055 + (k % 4) * 0.013;
      const mat = k === 6 || (i + r) % 5 === 4 ? mt.ppf : mt.films[k % mt.films.length];
      b.cyl(rad, rad, 1.52, mat, cx, y, z, 0, 0, Math.PI / 2, 28);
      b.cyl(0.04, 0.04, 1.54, mt.core, cx, y, z, 0, 0, Math.PI / 2, 14);
    }
  }
}

/** Tint tool board: pegboard with squeegees, hard cards, cutters, a heat gun and sprayers. */
export function tintBoard(b, mt, { w = 2.4, h = 1.3, y = 1.55 } = {}) {
  b.plane(w, h, mt.board, 0, y, 0.012);
  b.box(w + 0.06, 0.04, 0.03, mt.steel, 0, y + h / 2 + 0.01, 0.015);
  b.box(w + 0.06, 0.04, 0.03, mt.steel, 0, y - h / 2 - 0.01, 0.015);
  const cols = [mt.yellow, mt.blue, mt.red, mt.rubber, mt.white, mt.orange, mt.green];
  // top row: hanging squeegee blades of several sizes
  for (let i = 0; i < 9; i++) {
    const x = -w / 2 + 0.2 + i * ((w - 0.4) / 8);
    const bw = 0.08 + ((i * 5) % 4) * 0.022;
    b.cyl(0.004, 0.004, 0.05, mt.chrome, x, y + 0.42, 0.04, Math.PI / 2, 0, 0, 6);
    b.box(bw, 0.075, 0.009, cols[i % cols.length], x, y + 0.37, 0.05);
  }
  // middle row: handled squeegees and hard cards
  for (let i = 0; i < 6; i++) {
    const x = -w / 2 + 0.25 + i * 0.2;
    b.cyl(0.004, 0.004, 0.05, mt.chrome, x, y + 0.14, 0.04, Math.PI / 2, 0, 0, 6);
    if (i % 2) {
      b.box(0.1, 0.07, 0.01, cols[(i + 2) % cols.length], x, y + 0.06, 0.05);
    } else {
      b.box(0.028, 0.13, 0.022, mt.rubber, x, y + 0.08, 0.05);
      b.box(0.14, 0.05, 0.01, cols[(i + 3) % cols.length], x, y - 0.01, 0.05);
    }
  }
  // cutters on a magnetic strip
  b.box(0.42, 0.04, 0.015, mt.rubber, w / 2 - 0.4, y + 0.14, 0.02);
  for (let i = 0; i < 4; i++) {
    const x = w / 2 - 0.55 + i * 0.1;
    b.box(0.02, 0.13, 0.014, mt.yellow, x, y + 0.08, 0.035);
    b.box(0.012, 0.035, 0.004, mt.chrome, x, y + 0.165, 0.035);
  }
  // heat gun on its hook
  b.at(M(-w / 2 + 0.45, y - 0.32, 0.07, 0, 0, -0.25), (bb) => {
    bb.box(0.24, 0.08, 0.075, mt.orange, 0, 0, 0);
    bb.cyl(0.026, 0.03, 0.09, mt.grey, 0.16, 0, 0, 0, 0, Math.PI / 2, 12);
    bb.box(0.055, 0.15, 0.06, mt.rubber, -0.04, -0.1, 0);
  });
  // spray bottles (slip solution, alcohol)
  for (let i = 0; i < 3; i++) {
    const x = -0.15 + i * 0.13;
    b.cyl(0.04, 0.04, 0.2, i === 2 ? mt.blue : mt.white, x, y - 0.42, 0.06, 0, 0, 0, 14);
    b.box(0.05, 0.06, 0.04, mt.rubber, x, y - 0.29, 0.06);
    b.box(0.015, 0.05, 0.015, mt.rubber, x + 0.01, y - 0.33, 0.085);
  }
  b.box(0.5, 0.025, 0.14, mt.shelf, 0, y - 0.535, 0.07);
  // rolls of tape
  for (let i = 0; i < 2; i++) b.cyl(0.05, 0.05, 0.03, i ? mt.yellow : mt.blue, w / 2 - 0.5 + i * 0.16, y - 0.35, 0.04, Math.PI / 2, 0, 0, 18);
}

/** Microfibre cubbies: a small open shelving unit stacked with folded towels. */
export function towelCubbies(b, mt, { width = 1.8, depth = 0.4 } = {}) {
  const levels = [0.4, 0.9, 1.4, 1.9];
  for (const x of [-width / 2, 0, width / 2]) b.box(0.03, 2.0, depth, mt.shelf, x, 1.0, depth / 2);
  for (const y of levels) b.box(width, 0.03, depth, mt.shelf, 0, y, depth / 2);
  levels.forEach((y, li) => {
    for (const side of [-1, 1]) {
      const x = (side * width) / 4;
      const k = 5 + ((li * 3 + (side > 0 ? 2 : 0)) % 6);
      const t = mt.towels[(li * 2 + (side > 0 ? 1 : 0)) % mt.towels.length];
      for (let i = 0; i < k && i * 0.03 < 0.42; i++) b.box(0.34, 0.028, 0.3, t, x + Math.sin(i * 2.3 + li) * 0.012, y + 0.03 + i * 0.03, depth / 2 + Math.cos(i * 1.3) * 0.01);
    }
  });
}
