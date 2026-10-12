import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { monotone, sgnpow, clamp, lerp, smoothstep, rng } from './math.js';
import {
  makePaint,
  makeGlass,
  makeLens,
  makeTailLens,
  makeStarMaterial,
  makeCommon,
  makeGlow,
  vltToOpacity,
} from './materials.js';

/*
 * Procedural, unbadged four-door GT built from analytic profiles.
 * Axes: +x = front of the car, +y = up, +z = right-hand side. Units: metres.
 *
 * The body is one closed parametric surface: every station x has a super-ellipse
 * cross-section (half-width W, top YT, widest point YM, bottom YB). Wheel arches
 * clamp the section bottom. The greenhouse rises from the body's own top curve so
 * the two surfaces meet exactly on the belt line.
 */

export const CAR = {
  L2: 2.31,
  axleF: 1.4,
  axleR: -1.38,
  axleY: 0.35,
  tireR: 0.345,
  archR: 0.395,
  track: 0.8,
};

const W = monotone([
  [-2.31, 0.8],
  [-2.15, 0.87],
  [-1.85, 0.925],
  [-1.4, 0.958],
  [-1.0, 0.95],
  [-0.4, 0.935],
  [0.3, 0.932],
  [0.9, 0.94],
  [1.4, 0.948],
  [1.85, 0.93],
  [2.15, 0.895],
  [2.31, 0.85],
]);
const YT = monotone([
  [-2.31, 0.835],
  [-2.295, 0.89],
  [-2.27, 0.918],
  [-2.22, 0.935],
  [-2.0, 0.942],
  [-1.75, 0.935],
  [-1.4, 0.925],
  [0, 0.92],
  [0.92, 0.915],
  [1.3, 0.87],
  [1.7, 0.8],
  [1.95, 0.76],
  [2.12, 0.725],
  [2.22, 0.69],
  [2.28, 0.64],
  [2.31, 0.575],
]);
const YM = monotone([
  [-2.31, 0.66],
  [-1.8, 0.63],
  [0, 0.6],
  [1.8, 0.58],
  [2.31, 0.53],
]);
const YB = monotone([
  [-2.31, 0.36],
  [-2.22, 0.3],
  [-2.0, 0.22],
  [-1.7, 0.19],
  [1.75, 0.19],
  [2.05, 0.22],
  [2.25, 0.27],
  [2.31, 0.31],
]);
// Greenhouse lift above the body top (0 at cowl and rear deck).
const H = monotone([
  [-1.7, 0],
  [-1.5, 0.075],
  [-1.2, 0.19],
  [-0.9, 0.295],
  [-0.6, 0.37],
  [-0.3, 0.398],
  [0.0, 0.4],
  [0.2, 0.386],
  [0.4, 0.33],
  [0.6, 0.235],
  [0.78, 0.12],
  [0.92, 0],
]);

const N_TOP = 3.0;
const N_BOT = 5.5;
const XR = -1.7; // greenhouse rear base
const XF = 0.92; // greenhouse front base (cowl)
// Belt line: angle from the top centre of the body section to the cabin edge.
const DELTA = Math.PI / 2 - 0.79;
const PHI_B1 = Math.PI / 2 - DELTA;
const PHI_B2 = Math.PI / 2 + DELTA;
const GH_M = 3.2; // greenhouse section super-ellipse exponent
const TUMBLE = 0.13;

// Plan-view rounding of the nose and tail (super-ellipse quadrants).
const END_F = { r: 0.42, p: 3.2 };
const END_R = { r: 0.28, p: 4.4 };
function endFactor(x) {
  const L2 = CAR.L2;
  if (x > L2 - END_F.r) {
    const t = Math.min(1, (x - (L2 - END_F.r)) / END_F.r);
    return Math.pow(Math.max(0, 1 - Math.pow(t, END_F.p)), 1 / END_F.p);
  }
  if (x < -L2 + END_R.r) {
    const t = Math.min(1, (-L2 + END_R.r - x) / END_R.r);
    return Math.pow(Math.max(0, 1 - Math.pow(t, END_R.p)), 1 / END_R.p);
  }
  return 1;
}
// Sample positions that follow the rounded ends evenly (uniform angle on the super-ellipse).
const tipWarpF = (k) => Math.pow(Math.cos((1 - k) * Math.PI * 0.5), 2 / END_F.p);
const tipWarpR = (k) => 1 - Math.pow(Math.cos(k * Math.PI * 0.5), 2 / END_R.p);

function archClamp(x) {
  let y = -1;
  for (const xa of [CAR.axleF, CAR.axleR]) {
    const dx = x - xa;
    const R = CAR.archR;
    if (Math.abs(dx) <= R) y = Math.max(y, CAR.axleY + Math.sqrt(R * R - dx * dx));
  }
  return y;
}

export function bodyPoint(x, phi, out = new THREE.Vector3()) {
  const a = W(x) * endFactor(x);
  const yt = YT(x);
  const ym = YM(x);
  const yb = YB(x);
  const c = Math.cos(phi);
  const s = Math.sin(phi);
  let z;
  let y;
  if (s >= 0) {
    z = a * sgnpow(c, 2 / N_TOP);
    y = ym + (yt - ym) * Math.pow(s, 2 / N_TOP);
  } else {
    z = a * sgnpow(c, 2 / N_BOT);
    y = ym - (ym - yb) * Math.pow(-s, 2 / N_BOT);
  }
  const yc = archClamp(x);
  if (y < yc) y = yc;
  return out.set(x, y, z);
}

const _p1 = new THREE.Vector3();
const _p2 = new THREE.Vector3();
const _p3 = new THREE.Vector3();
const _p4 = new THREE.Vector3();
function surfNormal(fn, u, v, out, eu = 1e-3, ev = 1e-3) {
  fn(u + eu, v, _p1);
  fn(u - eu, v, _p2);
  fn(u, v + ev, _p3);
  fn(u, v - ev, _p4);
  _p1.sub(_p2);
  _p3.sub(_p4);
  out.crossVectors(_p1, _p3);
  if (out.lengthSq() < 1e-14) return out.set(0, 1, 0);
  return out.normalize();
}

/** Angle on the section where the surface reaches height y (upper or lower half). */
function phiForY(x, y, right = true) {
  const yt = YT(x);
  const ym = YM(x);
  const yb = YB(x);
  let phi;
  if (y >= ym) {
    const f = clamp((y - ym) / (yt - ym), 0, 0.9999);
    phi = Math.asin(Math.pow(f, N_TOP / 2));
  } else {
    const f = clamp((ym - y) / (ym - yb), 0, 0.9999);
    phi = -Math.asin(Math.pow(f, N_BOT / 2));
  }
  return right ? phi : Math.PI - phi;
}

// ------------------------------------------------------------------ greenhouse section
// Arc-length table of the normalised greenhouse cross-section so rows are evenly spread.
const SECTION = (() => {
  const N = 2400;
  const pts = [];
  let len = 0;
  let prev = null;
  for (let i = 0; i <= N; i++) {
    const psi = (i / N) * Math.PI;
    const t = sgnpow(Math.cos(psi), 2 / GH_M);
    const lam = Math.pow(Math.max(0, Math.sin(psi)), 2 / GH_M);
    if (prev) len += Math.hypot((t - prev.t) * 0.74, (lam - prev.lam) * 0.4);
    prev = { t, lam, len };
    pts.push(prev);
  }
  for (const p of pts) p.s = p.len / len;
  return pts;
})();

function sectionAt(s) {
  let lo = 0;
  let hi = SECTION.length - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (SECTION[mid].s > s) hi = mid;
    else lo = mid;
  }
  const a = SECTION[lo];
  const b = SECTION[hi];
  const f = b.s === a.s ? 0 : (s - a.s) / (b.s - a.s);
  return { t: lerp(a.t, b.t, f), lam: lerp(a.lam, b.lam, f) };
}

/** s where the right half of the section reaches normalised lift lam. */
function sForLam(lam) {
  for (let i = 1; i < SECTION.length; i++) {
    if (SECTION[i].lam >= lam) return SECTION[i].s;
  }
  return 0.5;
}

const _gb = new THREE.Vector3();
export function greenhousePoint(x, s, out = new THREE.Vector3()) {
  const { t, lam } = sectionAt(s);
  bodyPoint(x, Math.PI / 2 - DELTA * t, _gb);
  const h = H(x);
  const lift = lam * h;
  const rearPinch = 0.06 * smoothstep(-0.7, -1.7, x);
  const shrink = 1 - (TUMBLE + rearPinch) * (lift / 0.4);
  return out.set(x, _gb.y + lift, _gb.z * shrink);
}

// ------------------------------------------------------------------ sampling helpers
function segments(breaks, counts, warps = []) {
  const out = [];
  for (let i = 0; i < breaks.length - 1; i++) {
    const n = counts[i];
    const w = warps[i] || ((t) => t);
    for (let k = 0; k < n; k++) out.push(lerp(breaks[i], breaks[i + 1], w(k / n)));
  }
  out.push(breaks[breaks.length - 1]);
  return out;
}

function gridGeometry(cols, rows, pointFn, { wrapRows = false } = {}) {
  // cols: number of columns per row; pointFn(i, j, out) fills position
  const nr = rows;
  const pos = new Float32Array(cols * nr * 3);
  const uv = new Float32Array(cols * nr * 2);
  const v = new THREE.Vector3();
  for (let j = 0; j < nr; j++) {
    for (let i = 0; i < cols; i++) {
      pointFn(i, j, v);
      const k = j * cols + i;
      pos[k * 3] = v.x;
      pos[k * 3 + 1] = v.y;
      pos[k * 3 + 2] = v.z;
      uv[k * 2] = i / (cols - 1);
      uv[k * 2 + 1] = j / (wrapRows ? nr : nr - 1);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  return g;
}

function indexFor(g, cols, rows, keep, { wrapRows = false } = {}) {
  const idx = [];
  const rr = wrapRows ? rows : rows - 1;
  for (let j = 0; j < rr; j++) {
    const j1 = (j + 1) % rows;
    for (let i = 0; i < cols - 1; i++) {
      if (!keep(i, j)) continue;
      const a = j * cols + i;
      const b = j * cols + i + 1;
      const c = j1 * cols + i + 1;
      const d = j1 * cols + i;
      idx.push(a, b, c, a, c, d);
    }
  }
  return idx;
}

function shareGeometry(src, index) {
  const g = new THREE.BufferGeometry();
  for (const name of Object.keys(src.attributes)) g.setAttribute(name, src.attributes[name]);
  g.setIndex(index);
  g.computeBoundingSphere();
  g.computeBoundingBox();
  return g;
}

/** On the nose/tail centre line the true normal has no z component (symmetry). */
function fixTipNormals(g) {
  const p = g.attributes.position;
  const n = g.attributes.normal;
  for (let i = 0; i < p.count; i++) {
    if (Math.abs(Math.abs(p.getX(i)) - CAR.L2) < 1e-5) {
      const x = n.getX(i);
      const y = n.getY(i);
      const l = Math.hypot(x, y) || 1;
      n.setXYZ(i, x / l, y / l, 0);
    }
  }
  n.needsUpdate = true;
}

// ------------------------------------------------------------------ patches on the body
/**
 * Surface-hugging patch. at(a, b) returns {x, y, right}; offset(a, b) the lift along the
 * surface normal. Used for lights, grilles, trims and shut lines.
 */
function bodyPatch({ na, nb, at, offset = () => 0.001, wa = (t) => t }) {
  const pos = new Float32Array((na + 1) * (nb + 1) * 3);
  const uv = new Float32Array((na + 1) * (nb + 1) * 2);
  const p = new THREE.Vector3();
  const n = new THREE.Vector3();
  for (let j = 0; j <= nb; j++) {
    for (let i = 0; i <= na; i++) {
      const a = wa(i / na);
      const b = j / nb;
      const q = at(a, b);
      const phi = phiForY(q.x, q.y, q.right !== false);
      bodyPoint(q.x, phi, p);
      surfNormal(bodyPoint, q.x, phi, n);
      if (q.right === false) n.negate();
      p.addScaledVector(n, offset(a, b));
      const k = j * (na + 1) + i;
      pos.set([p.x, p.y, p.z], k * 3);
      uv.set([i / na, b], k * 2);
    }
  }
  const idx = [];
  for (let j = 0; j < nb; j++) {
    for (let i = 0; i < na; i++) {
      const a = j * (na + 1) + i;
      const b = a + 1;
      const c = a + na + 2;
      const d = a + na + 1;
      idx.push(a, b, c, a, c, d);
    }
  }
  // make the winding face outwards whatever direction the patch parameters run
  {
    const q = at(0.5, 0.5);
    const phi = phiForY(q.x, q.y, q.right !== false);
    surfNormal(bodyPoint, q.x, phi, n);
    if (q.right === false) n.negate();
    const ci = Math.floor(nb / 2) * (na + 1) + Math.floor(na / 2);
    const A = new THREE.Vector3().fromArray(pos, ci * 3);
    const Bv = new THREE.Vector3().fromArray(pos, (ci + 1) * 3).sub(A);
    const Cv = new THREE.Vector3().fromArray(pos, (ci + na + 1) * 3).sub(A);
    if (Bv.cross(Cv).dot(n) < 0) {
      for (let i = 0; i < idx.length; i += 3) {
        const t = idx[i + 1];
        idx[i + 1] = idx[i + 2];
        idx[i + 2] = t;
      }
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  const sweep = new Float32Array(uv.length / 2);
  for (let i = 0; i < sweep.length; i++) sweep[i] = uv[i * 2];
  g.setAttribute('aSweep', new THREE.BufferAttribute(sweep, 1));
  g.setIndex(idx);
  g.computeVertexNormals();
  fixTipNormals(g);
  return g;
}

/** Flip a right-hand patch to the left side (z -> -z) and fix winding. */
function mirrorZ(g) {
  const m = g.clone();
  m.scale(1, 1, -1);
  const ix = m.index.array;
  for (let i = 0; i < ix.length; i += 3) {
    const t = ix[i + 1];
    ix[i + 1] = ix[i + 2];
    ix[i + 2] = t;
  }
  m.index.needsUpdate = true;
  m.computeVertexNormals();
  fixTipNormals(m);
  return m;
}

// ------------------------------------------------------------------ build
export function buildCar({ quality = 'high', paintColor = 0x163d70 } = {}) {
  const hi = quality === 'high';
  const k = hi ? 1 : 0.55;
  const C = makeCommon();
  const paint = makePaint(paintColor);
  const group = new THREE.Group();
  group.name = 'car';
  const animated = {}; // name -> object, mirrored copies are kept in sync by name

  // ---------------- body shell
  const L2 = CAR.L2;
  const ra = CAR.archR;
  const xs = segments(
    [-L2, -L2 + END_R.r, CAR.axleR - ra, XR, CAR.axleR + ra, XF, CAR.axleF - ra, CAR.axleF + ra, L2 - END_F.r, L2],
    [30, 14, 6, 50, 120, 6, 50, 14, 34].map((n) => Math.max(4, Math.round(n * k))),
    [tipWarpR, null, null, null, null, null, null, null, tipWarpF]
  );
  const phis = segments(
    [0, PHI_B1, PHI_B2, Math.PI, Math.PI * 2],
    [26, 40, 26, 54].map((n) => Math.max(6, Math.round(n * k)))
  );
  phis.pop(); // wrap: 2π == 0
  const cols = xs.length;
  const rows = phis.length;
  const bodyGeo = gridGeometry(cols, rows, (i, j, out) => bodyPoint(xs[i], phis[j], out), {
    wrapRows: true,
  });
  const bodyIdx = indexFor(
    bodyGeo,
    cols,
    rows,
    (i, j) => {
      const xc = (xs[i] + xs[i + 1]) / 2;
      const pc = (phis[j] + phis[(j + 1) % rows]) / 2;
      const inCabin = xc > XR && xc < XF && pc > PHI_B1 && pc < PHI_B2 && j + 1 < rows;
      return !inCabin;
    },
    { wrapRows: true }
  );
  bodyGeo.setIndex(bodyIdx);
  bodyGeo.computeVertexNormals();
  fixTipNormals(bodyGeo);
  bodyGeo.computeBoundingSphere();
  const body = new THREE.Mesh(bodyGeo, paint);
  body.name = 'body';
  group.add(body);
  const bodyInside = new THREE.Mesh(bodyGeo, C.interior);
  bodyInside.name = 'bodyInside';
  group.add(bodyInside);

  // ---------------- greenhouse
  const sBelt = sForLam(0.03);
  const sSide = sForLam(0.8);
  const sRail = sForLam(0.93);
  const sRows = segments(
    [0, sBelt, sSide, sRail, 1 - sRail, 1 - sSide, 1 - sBelt, 1],
    [2, 22, 5, 64, 5, 22, 2].map((n) => Math.max(2, Math.round(n * k)))
  );
  // band of each row segment: 0 belt, 1 side, 2 rail, 3 top
  const bandOf = (s) => {
    const d = Math.min(s, 1 - s);
    if (d < sBelt) return 0;
    if (d < sSide) return 1;
    if (d < sRail) return 2;
    return 3;
  };
  // x breakpoints per row (rear -> front). Side rows get a raked C-pillar edge.
  const xBreaks = (s) => {
    const d = Math.min(s, 1 - s);
    const side = clamp(1 - d / sSide); // 1 at belt, 0 at window top
    const xC = d < sSide ? lerp(-0.86, -1.17, side) : -0.86;
    return [XR, xC, -0.64, -0.28, -0.2, 0.2, 0.72, XF];
  };
  const xCounts = [30, 22, 34, 6, 38, 50, 16].map((n) => Math.max(3, Math.round(n * k)));
  const gCols = xCounts.reduce((a, b) => a + b, 0) + 1;
  const colX = (s) => segments(xBreaks(s), xCounts);
  const rowXs = sRows.map(colX);
  const segOfCol = [];
  {
    let c = 0;
    xCounts.forEach((n, seg) => {
      for (let q = 0; q < n; q++) segOfCol[c++] = seg;
    });
  }
  const ghGeo = gridGeometry(gCols, sRows.length, (i, j, out) => greenhousePoint(rowXs[j][i], sRows[j], out));
  ghGeo.computeVertexNormals = THREE.BufferGeometry.prototype.computeVertexNormals;
  // belt height per vertex for the roll-down windows
  {
    const n = gCols * sRows.length;
    const belt = new Float32Array(n);
    const p = new THREE.Vector3();
    for (let j = 0; j < sRows.length; j++) {
      for (let i = 0; i < gCols; i++) {
        bodyPoint(rowXs[j][i], PHI_B1, p);
        belt[j * gCols + i] = p.y;
      }
    }
    ghGeo.setAttribute('aBelt', new THREE.BufferAttribute(belt, 1));
  }
  const classOf = (i, j) => {
    const seg = segOfCol[i];
    const sc = (sRows[j] + sRows[j + 1]) / 2;
    const band = bandOf(sc);
    const right = sc < 0.5;
    if (band === 3) return seg <= 1 ? 'glassRear' : seg >= 5 ? 'glassWind' : 'trim';
    if (band === 2) return 'trim';
    if (band === 1) {
      if (seg === 0) return 'paint';
      if (seg === 1 || seg === 2) return 'glassRearSide';
      if (seg === 3 || seg === 6) return 'trim';
      return right ? 'glassFrontR' : 'glassFrontL';
    }
    if (seg === 0) return 'paint';
    if (seg === 3 || seg === 6) return 'trim';
    return 'chrome';
  };
  const ghIdx = {};
  for (let j = 0; j < sRows.length - 1; j++) {
    for (let i = 0; i < gCols - 1; i++) {
      const cls = classOf(i, j);
      (ghIdx[cls] ||= []).push(
        j * gCols + i,
        j * gCols + i + 1,
        (j + 1) * gCols + i + 1,
        j * gCols + i,
        (j + 1) * gCols + i + 1,
        (j + 1) * gCols + i
      );
    }
  }
  {
    // normals over the whole greenhouse so glass sits flush with the pillars
    const all = Object.values(ghIdx).flat();
    ghGeo.setIndex(all);
    ghGeo.computeVertexNormals();
    ghGeo.setIndex(null);
  }
  const ghMats = {
    trim: C.trim,
    paint,
    chrome: C.chrome,
  };
  const glass = {
    wind: makeGlass({ opacity: vltToOpacity(0.78) }),
    rear: makeGlass({ opacity: vltToOpacity(0.7) }),
    frontL: makeGlass({ opacity: vltToOpacity(0.72) }),
    frontR: makeGlass({ opacity: vltToOpacity(0.72) }),
  };
  // Roll-down front windows: shift down in the vertex shader, discard below the belt line.
  for (const key of ['frontL', 'frontR']) {
    const m = glass[key];
    const u = { uDrop: { value: 0 } };
    m.userData.uniforms = u;
    const prev = m.onBeforeCompile;
    m.onBeforeCompile = (sh, r) => {
      prev(sh, r);
      Object.assign(sh.uniforms, u);
      sh.vertexShader = sh.vertexShader
        .replace(
          '#include <common>',
          '#include <common>\nattribute float aBelt;\nuniform float uDrop;\nvarying float vAboveBelt;'
        )
        .replace(
          '#include <begin_vertex>',
          '#include <begin_vertex>\ntransformed.y -= uDrop;\nvAboveBelt = transformed.y - aBelt;'
        );
      sh.fragmentShader = sh.fragmentShader
        .replace('#include <common>', '#include <common>\nvarying float vAboveBelt;')
        .replace('#include <clipping_planes_fragment>', '#include <clipping_planes_fragment>\nif (vAboveBelt < 0.0) discard;');
    };
    m.customProgramCacheKey = () => 'glass-drop';
  }
  const ghGroup = new THREE.Group();
  ghGroup.name = 'greenhouse';
  group.add(ghGroup);
  const opaqueIdx = [];
  for (const [cls, idx] of Object.entries(ghIdx)) {
    const g = shareGeometry(ghGeo, idx);
    let mat = ghMats[cls];
    if (cls === 'glassRear' || cls === 'glassRearSide') mat = glass.rear;
    if (cls === 'glassWind') mat = glass.wind;
    if (cls === 'glassFrontL') mat = glass.frontL;
    if (cls === 'glassFrontR') mat = glass.frontR;
    const mesh = new THREE.Mesh(g, mat);
    mesh.name = 'gh-' + cls;
    if (cls.startsWith('glass')) mesh.renderOrder = 2;
    else opaqueIdx.push(...idx);
    ghGroup.add(mesh);
  }
  const headliner = new THREE.Mesh(shareGeometry(ghGeo, opaqueIdx), C.headliner);
  headliner.name = 'headliner';
  ghGroup.add(headliner);

  // ---------------- underbody + wheel wells
  {
    const under = new THREE.Mesh(new THREE.BoxGeometry(4.1, 0.02, 1.3), new THREE.MeshBasicMaterial({ color: 0x000000 }));
    under.position.set(0, 0.2, 0);
    group.add(under);
    const segs = hi ? 28 : 16;
    for (const xa of [CAR.axleF, CAR.axleR]) {
      for (const side of [1, -1]) {
        const R = CAR.archR - 0.004;
        const z0 = 0.55 * side;
        const z1 = 0.97 * side;
        const pos = [];
        const idx = [];
        for (let q = 0; q <= segs; q++) {
          const th = (q / segs) * Math.PI;
          const x = xa + R * Math.cos(th);
          const y = CAR.axleY + R * Math.sin(th);
          pos.push(x, y, z0, x, y, z1);
          if (q < segs) {
            const b = q * 2;
            idx.push(b, b + 1, b + 3, b, b + 3, b + 2);
          }
        }
        // inner half-disc
        const c0 = pos.length / 3;
        pos.push(xa, CAR.axleY, z0);
        for (let q = 0; q < segs; q++) idx.push(c0, q * 2, (q + 1) * 2);
        const g = new THREE.BufferGeometry();
        g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
        g.setIndex(idx);
        g.computeVertexNormals();
        group.add(new THREE.Mesh(g, C.liner));
      }
    }
  }

  // ---------------- wheels
  const wheel = buildWheel(C, hi);
  for (const [xa, side] of [
    [CAR.axleF, 1],
    [CAR.axleF, -1],
    [CAR.axleR, 1],
    [CAR.axleR, -1],
  ]) {
    const w = wheel.clone();
    w.position.set(xa, CAR.axleY, CAR.track * side);
    if (side < 0) w.scale.z = -1;
    // slight steer on the front wheels for a staged look
    if (xa > 0) w.rotation.y = -0.12;
    group.add(w);
  }

  // ---------------- trims, grilles, shut lines
  const addPatch = (geo, mat, both = true, name) => {
    const m = new THREE.Mesh(geo, mat);
    if (name) m.name = name;
    group.add(m);
    if (both) {
      const l = new THREE.Mesh(mirrorZ(geo), mat);
      if (name) l.name = name + 'L';
      group.add(l);
      return [m, l];
    }
    return [m];
  };
  // patches that run round the nose/tail to the centre line (both halves meet at z = 0)
  const noseX = (x0, a) => lerp(x0, L2, a);
  const tailX = (x0, a) => lerp(x0, -L2, a);
  // lower front intake
  addPatch(
    bodyPatch({
      na: 34,
      nb: 6,
      wa: (t) => Math.pow(Math.sin(t * Math.PI * 0.5), 0.6),
      at: (a, b) => ({ x: noseX(2.08, a), y: lerp(0.3, 0.44, b) }),
      offset: () => 0.0015,
    }),
    C.grille
  );
  // front light bar linking the headlights
  addPatch(
    bodyPatch({
      na: 30,
      nb: 3,
      wa: (t) => Math.pow(Math.sin(t * Math.PI * 0.5), 0.6),
      at: (a, b) => ({ x: noseX(2.24, a), y: lerp(0.585, 0.594, b) }),
      offset: () => 0.0018,
    }),
    C.led,
    true,
    'frontBar'
  );
  // rear diffuser
  addPatch(
    bodyPatch({
      na: 30,
      nb: 5,
      wa: (t) => Math.pow(Math.sin(t * Math.PI * 0.5), 0.6),
      at: (a, b) => ({ x: tailX(-2.04, a), y: lerp(0.34, 0.5, b) }),
      offset: () => 0.0015,
    }),
    C.grille
  );
  // thin satin band across the tail, under the light bar
  addPatch(
    bodyPatch({
      na: 30,
      nb: 2,
      wa: (t) => Math.pow(Math.sin(t * Math.PI * 0.5), 0.6),
      at: (a, b) => ({ x: tailX(-2.1, a), y: lerp(0.605, 0.62, b) }),
      offset: () => 0.0015,
    }),
    C.trim
  );
  // rocker trims
  addPatch(
    bodyPatch({
      na: 40,
      nb: 3,
      at: (a, b) => ({ x: lerp(CAR.axleR + ra + 0.02, CAR.axleF - ra - 0.02, a), y: lerp(0.215, 0.27, b) }),
      offset: () => 0.0015,
    }),
    C.trim
  );
  // door shut lines
  const shut = new THREE.MeshStandardMaterial({ color: 0x010102, roughness: 0.9 });
  const beltAt = (x) => bodyPoint(x, PHI_B1).y - 0.004;
  for (const [x0, yLow] of [
    [0.88, 0.3],
    [-0.24, 0.24],
    [-0.99, 0.48],
  ]) {
    addPatch(
      bodyPatch({
        na: 1,
        nb: 24,
        at: (a, b) => ({ x: x0 + (a - 0.5) * 0.004, y: lerp(yLow, beltAt(x0), b) }),
        offset: () => 0.0006,
      }),
      shut
    );
  }
  // flush door handles
  for (const x0 of [-0.06, -0.82]) {
    addPatch(
      bodyPatch({
        na: 8,
        nb: 2,
        at: (a, b) => ({ x: x0 + (a - 0.5) * 0.15, y: 0.785 + b * 0.022 }),
        offset: (a) => 0.0012 + 0.002 * Math.sin(a * Math.PI),
      }),
      C.satin
    );
  }

  // ---------------- mirrors
  for (const side of [1, -1]) {
    const m = new THREE.Group();
    const housing = new THREE.Mesh(new THREE.SphereGeometry(1, hi ? 32 : 16, hi ? 16 : 10), C.trim);
    housing.scale.set(0.075, 0.058, 0.115);
    housing.position.set(0, 0, 0.1 * side);
    const face = new THREE.Mesh(new THREE.CircleGeometry(1, hi ? 32 : 16), C.chrome);
    face.scale.set(0.05, 0.045, 1);
    face.rotation.y = -Math.PI / 2;
    face.position.set(-0.035, 0, 0.1 * side);
    const stalk = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.025, 0.1), C.trim);
    stalk.position.set(0.01, -0.03, 0.03 * side);
    m.add(housing, face, stalk);
    m.position.set(0.66, 0.9, 0.8 * side);
    group.add(m);
  }

  // ---------------- headlights (housing, LEDs, lens with renovation shader)
  const lens = makeLens();
  const lights = { glows: [], beams: [] };
  const hlAt = (a, b) => {
    const x = lerp(1.96, 2.285, Math.pow(a, 0.85));
    const yc = lerp(0.676, 0.598, Math.pow(a, 1.2));
    const ht = 0.007 + 0.024 * Math.sin(clamp(a * 1.6) * Math.PI * 0.5) * (1 - 0.45 * smoothstep(0.7, 1, a));
    return { x, y: yc + ht * (2 * b - 1) };
  };
  const hlHousing = bodyPatch({ na: 40, nb: 8, at: hlAt, offset: () => 0.0008 });
  const hlLens = bodyPatch({
    na: 40,
    nb: 8,
    at: hlAt,
    offset: (a, b) => 0.003 + 0.004 * Math.sin(a * Math.PI) * Math.sin(b * Math.PI),
  });
  const hlDrl = bodyPatch({
    na: 40,
    nb: 1,
    at: (a, b) => {
      const p = hlAt(a, 0.8 + b * 0.12);
      return p;
    },
    offset: () => 0.0018,
  });
  addPatch(hlHousing, C.housing);
  const ledMat = C.led;
  addPatch(hlDrl, ledMat);
  const lensMeshes = addPatch(hlLens, lens, true, 'hlLens');
  lensMeshes.forEach((m) => (m.renderOrder = 3));
  // projector modules
  const projGeo = new THREE.CylinderGeometry(0.017, 0.017, 0.006, hi ? 24 : 12);
  const projMat = new THREE.MeshStandardMaterial({
    color: 0x111418,
    emissive: 0xcfe9ff,
    emissiveIntensity: 0.25,
    metalness: 0.8,
    roughness: 0.2,
  });
  lights.projMat = projMat;
  for (const side of [1, -1]) {
    for (const a of [0.42, 0.62, 0.8]) {
      const q = hlAt(a, 0.42);
      const phi = phiForY(q.x, q.y, side > 0);
      const p = bodyPoint(q.x, phi, new THREE.Vector3());
      const n = surfNormal(bodyPoint, q.x, phi, new THREE.Vector3());
      if (side < 0) n.negate();
      const m = new THREE.Mesh(projGeo, projMat);
      m.position.copy(p).addScaledVector(n, 0.0016);
      m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), n);
      group.add(m);
      const g = makeGlow(0xd8eeff, 0.22);
      g.position.copy(p).addScaledVector(n, 0.02);
      group.add(g);
      lights.glows.push(g);
    }
  }

  // ---------------- tail lights (smoked film shader)
  const tail = makeTailLens();
  const tlAt = (a, b) => {
    const x = lerp(-1.98, -L2, a);
    const yc = lerp(0.852, 0.84, a);
    const ht = lerp(0.011, 0.02, smoothstep(0, 0.3, a));
    return { x, y: yc + ht * (2 * b - 1) };
  };
  addPatch(
    bodyPatch({
      na: 56,
      nb: 6,
      wa: (t) => Math.pow(Math.sin(t * Math.PI * 0.5), 0.6),
      at: tlAt,
      offset: (a, b) => 0.0018 + 0.0015 * Math.sin(b * Math.PI),
    }),
    tail,
    true,
    'tail'
  );

  // ---------------- interior
  const interior = buildInterior(C, hi);
  group.add(interior);
  // door caps along the belt (visible when the windows are down)
  for (const side of [1, -1]) {
    const pos = [];
    const idx = [];
    const n = 40;
    for (let q = 0; q <= n; q++) {
      const x = lerp(-0.98, 0.86, q / n);
      const p = bodyPoint(x, side > 0 ? PHI_B1 : PHI_B2);
      pos.push(x, p.y - 0.002, p.z, x, p.y - 0.006, p.z - 0.06 * side);
      if (q < n) {
        const b = q * 2;
        if (side > 0) idx.push(b, b + 2, b + 3, b, b + 3, b + 1);
        else idx.push(b, b + 3, b + 2, b, b + 1, b + 3);
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setIndex(idx);
    g.computeVertexNormals();
    group.add(new THREE.Mesh(g, new THREE.MeshStandardMaterial({ color: 0x0c0d10, roughness: 0.5, side: THREE.DoubleSide })));
  }

  // ---------------- starlight headliner
  const stars = buildStars(hi ? 900 : 480, sRail);
  stars.name = 'stars';
  group.add(stars);

  // ---------------- headlight beams (soft additive cones, only visible when lights are on)
  const beamMat = new THREE.ShaderMaterial({
    uniforms: { uOn: { value: 0 } },
    vertexShader: /* glsl */ `
      varying float vAlong; varying vec3 vN; varying vec3 vV;
      void main(){
        vAlong = uv.y;
        vec4 mv = modelViewMatrix * vec4(position,1.0);
        vN = normalize(normalMatrix * normal);
        vV = normalize(-mv.xyz);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */ `
      uniform float uOn; varying float vAlong; varying vec3 vN; varying vec3 vV;
      void main(){
        float edge = pow(abs(dot(vN, vV)), 1.6);
        float fall = pow(vAlong, 1.4);
        float a = edge * fall * uOn * 0.16;
        gl_FragColor = vec4(vec3(0.82, 0.92, 1.0) * a, a);
      }`,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
  });
  for (const side of [1, -1]) {
    const len = 7;
    const cone = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 1.5, len, hi ? 32 : 16, 1, true), beamMat);
    cone.geometry.translate(0, -len / 2, 0);
    cone.rotation.z = Math.PI / 2 + 0.06; // point along +x, slightly down
    cone.position.set(2.2, 0.66, 0.66 * side);
    cone.rotation.y = 0.05 * side;
    cone.name = 'beam';
    cone.renderOrder = 4;
    group.add(cone);
  }
  lights.beamMat = beamMat;

  // ---------------- contact shadow
  {
    const c = document.createElement('canvas');
    c.width = 256;
    c.height = 128;
    const g = c.getContext('2d');
    const grd = g.createRadialGradient(128, 64, 10, 128, 64, 128);
    grd.addColorStop(0, 'rgba(0,0,0,0.92)');
    grd.addColorStop(0.45, 'rgba(0,0,0,0.6)');
    grd.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = grd;
    g.fillRect(0, 0, 256, 128);
    const tex = new THREE.CanvasTexture(c);
    const sh = new THREE.Mesh(
      new THREE.PlaneGeometry(5.6, 2.6),
      new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, opacity: 0.85 })
    );
    sh.rotation.x = -Math.PI / 2;
    sh.position.y = 0.004;
    sh.renderOrder = 1;
    sh.name = 'shadow';
    group.add(sh);
    // tighter blobs under the tyres
    for (const [xa, side] of [
      [CAR.axleF, 1],
      [CAR.axleF, -1],
      [CAR.axleR, 1],
      [CAR.axleR, -1],
    ]) {
      const b = new THREE.Mesh(
        new THREE.PlaneGeometry(0.75, 0.45),
        new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, opacity: 0.9 })
      );
      b.rotation.x = -Math.PI / 2;
      b.position.set(xa, 0.005, CAR.track * side);
      b.renderOrder = 1;
      b.name = 'shadow';
      group.add(b);
    }
  }

  // ---------------- public API
  animated.frontL = glass.frontL;
  const api = {
    group,
    materials: { paint, glass, lens, tail, stars: stars.material, beam: beamMat, led: ledMat, proj: projMat },
    setRearVLT(v) {
      glass.rear.opacity = vltToOpacity(v);
    },
    setFrontVLT(v) {
      glass.frontL.opacity = glass.frontR.opacity = vltToOpacity(v);
    },
    setWindowDrop(side, t) {
      glass[side === 'L' ? 'frontL' : 'frontR'].userData.uniforms.uDrop.value = t * 0.4;
    },
    setTailSmoke(v) {
      tail.userData.uniforms.uSmoke.value = v;
    },
    setBrake(v) {
      tail.userData.uniforms.uBrake.value = v;
    },
    setPolish(x, dir = 1) {
      paint.userData.uniforms.uPolishX.value = x;
      paint.userData.uniforms.uPolishDir.value = dir;
    },
    setStars(v) {
      stars.material.uniforms.uOn.value = v;
    },
    setHeadlightClear(v) {
      lens.userData.uniforms.uClear.value = v;
    },
    setHeadlights(on) {
      projMat.emissiveIntensity = 0.25 + on * 6;
      ledMat.color.setRGB(0.87 + on * 2.5, 0.95 + on * 2.6, 1 + on * 2.8);
      beamMat.uniforms.uOn.value = on;
      for (const g of lights.glows) g.material.opacity = on * 0.9;
    },
    update(time, viewportHeight, fovDeg) {
      stars.material.uniforms.uTime.value = time;
      stars.material.uniforms.uScale.value = viewportHeight / (2 * Math.tan(THREE.MathUtils.degToRad(fovDeg) / 2));
    },
  };
  api.setHeadlights(0);
  return api;
}

// ------------------------------------------------------------------ wheel
function buildWheel(C, hi) {
  const g = new THREE.Group();
  const seg = hi ? 72 : 36;
  const tireProfile = [
    [0.252, -0.112],
    [0.3, -0.124],
    [0.334, -0.12],
    [0.344, -0.1],
    [0.347, -0.04],
    [0.347, 0.04],
    [0.344, 0.1],
    [0.334, 0.12],
    [0.3, 0.124],
    [0.252, 0.112],
  ].map(([r, a]) => new THREE.Vector2(r, a));
  const tire = new THREE.LatheGeometry(tireProfile, seg);
  tire.rotateX(Math.PI / 2);
  g.add(new THREE.Mesh(tire, C.tire));
  // rim lip + barrel
  const lip = new THREE.LatheGeometry(
    [
      [0.232, -0.11],
      [0.232, 0.08],
      [0.238, 0.1],
      [0.252, 0.108],
      [0.256, 0.1],
    ].map(([r, a]) => new THREE.Vector2(r, a)),
    seg
  );
  lip.rotateX(Math.PI / 2);
  g.add(new THREE.Mesh(lip, C.rim));
  // spokes: five split spokes, concave dish
  const shape = new THREE.Shape();
  shape.moveTo(0.06, -0.02);
  shape.lineTo(0.236, -0.011);
  shape.lineTo(0.236, 0.011);
  shape.lineTo(0.06, 0.02);
  shape.closePath();
  const spokeGeo = new THREE.ExtrudeGeometry(shape, {
    depth: 0.026,
    bevelEnabled: true,
    bevelThickness: 0.006,
    bevelSize: 0.005,
    bevelSegments: 2,
  });
  spokeGeo.rotateY(-0.28);
  spokeGeo.translate(0, 0, 0.045);
  for (let i = 0; i < 10; i++) {
    const s = new THREE.Mesh(spokeGeo, C.rimFace);
    s.rotation.z = (i / 5) * Math.PI + (i % 2 ? 0.17 : -0.17) - (i % 2 ? Math.PI / 5 : 0);
    s.rotation.z = Math.floor(i / 2) * ((Math.PI * 2) / 5) + (i % 2 ? 0.2 : -0.2);
    g.add(s);
  }
  const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.078, 0.04, seg / 2), C.rimFace);
  hub.rotation.x = Math.PI / 2;
  hub.position.z = 0.06;
  g.add(hub);
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.032, 0.01, seg / 2), C.trim);
  cap.rotation.x = Math.PI / 2;
  cap.position.z = 0.082;
  g.add(cap);
  // brake disc and caliper
  const disc = new THREE.Mesh(new THREE.CylinderGeometry(0.19, 0.19, 0.028, seg / 2), C.disc);
  disc.rotation.x = Math.PI / 2;
  disc.position.z = -0.03;
  g.add(disc);
  const cal = new THREE.Mesh(new RoundedBoxGeometry(0.075, 0.15, 0.06, 2, 0.012), C.caliper);
  cal.position.set(-0.13, 0.12, 0.0);
  cal.rotation.z = 0.8;
  g.add(cal);
  return g;
}

// ------------------------------------------------------------------ interior
function buildInterior(C, hi) {
  const g = new THREE.Group();
  g.name = 'interior';
  const rb = (w, h, d, r = 0.03) => new RoundedBoxGeometry(w, h, d, hi ? 3 : 2, r);

  const floor = new THREE.Mesh(new THREE.BoxGeometry(2.45, 0.02, 1.6), C.carpet);
  floor.position.set(-0.35, 0.3, 0);
  g.add(floor);

  // dashboard: extruded side profile across the cabin
  const prof = new THREE.Shape();
  prof.moveTo(0.92, 0.87);
  prof.bezierCurveTo(0.8, 0.905, 0.62, 0.905, 0.5, 0.885);
  prof.bezierCurveTo(0.43, 0.87, 0.41, 0.8, 0.43, 0.74);
  prof.bezierCurveTo(0.47, 0.62, 0.58, 0.5, 0.7, 0.42);
  prof.lineTo(0.98, 0.42);
  prof.lineTo(0.98, 0.86);
  prof.closePath();
  const dashGeo = new THREE.ExtrudeGeometry(prof, {
    depth: 1.46,
    bevelEnabled: true,
    bevelThickness: 0.02,
    bevelSize: 0.015,
    bevelSegments: 3,
    curveSegments: hi ? 24 : 10,
  });
  dashGeo.translate(0, 0, -0.73);
  g.add(new THREE.Mesh(dashGeo, C.dash));

  // ambient light line (amber, brand accent)
  const amb = new THREE.Mesh(new THREE.BoxGeometry(0.006, 0.006, 1.42), C.ambient);
  amb.position.set(0.442, 0.79, 0);
  g.add(amb);

  // screens
  const cluster = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.085, 0.3), C.screen);
  cluster.position.set(0.5, 0.925, -0.37);
  cluster.rotation.z = 0.25;
  g.add(cluster);
  const centre = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.19, 0.32), C.screen);
  centre.position.set(0.46, 0.86, 0.0);
  centre.rotation.z = 0.32;
  g.add(centre);

  // steering wheel (left-hand drive)
  const sw = new THREE.Group();
  const rim = new THREE.Mesh(new THREE.TorusGeometry(0.18, 0.017, hi ? 12 : 8, hi ? 48 : 24), C.leather);
  sw.add(rim);
  for (const a of [0, Math.PI * 0.5 + 0.2, Math.PI * 0.5 - 0.2 + Math.PI]) {
    const sp = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.026, 0.02), C.dash);
    sp.position.set(Math.cos(a - Math.PI / 2) * 0.09, Math.sin(a - Math.PI / 2) * 0.09, 0);
    sp.rotation.z = a - Math.PI / 2;
    sw.add(sp);
  }
  const boss = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.06, 0.04, 20), C.dash);
  boss.rotation.x = Math.PI / 2;
  sw.add(boss);
  sw.rotation.y = Math.PI / 2;
  sw.rotation.x = 0;
  sw.position.set(0.3, 0.8, -0.37);
  const swTilt = new THREE.Group();
  swTilt.add(sw);
  sw.rotation.order = 'YXZ';
  sw.rotation.set(0, Math.PI / 2, 0);
  sw.rotateX(-0.42);
  g.add(sw);
  const column = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.04, 0.25, 12), C.dash);
  column.rotation.z = Math.PI / 2 - 0.42;
  column.position.set(0.41, 0.84, -0.37);
  g.add(column);

  // front seats
  for (const z of [-0.37, 0.37]) {
    const cushion = new THREE.Mesh(rb(0.52, 0.12, 0.5, 0.045), C.leather);
    cushion.position.set(0.02, 0.43, z);
    cushion.rotation.z = 0.06;
    g.add(cushion);
    const back = new THREE.Mesh(rb(0.12, 0.64, 0.5, 0.045), C.leather);
    back.position.set(-0.29, 0.77, z);
    back.rotation.z = 0.24;
    g.add(back);
    const st = new THREE.Mesh(new THREE.BoxGeometry(0.004, 0.5, 0.004), C.stitch);
    st.position.set(-0.225, 0.78, z);
    st.rotation.z = 0.24;
    g.add(st);
    const head = new THREE.Mesh(rb(0.1, 0.19, 0.28, 0.04), C.leather);
    head.position.set(-0.385, 1.15, z);
    head.rotation.z = 0.2;
    g.add(head);
  }
  const console_ = new THREE.Mesh(rb(0.8, 0.2, 0.22, 0.04), C.dash);
  console_.position.set(0.05, 0.44, 0);
  g.add(console_);

  // rear bench
  const rc = new THREE.Mesh(rb(0.46, 0.13, 1.32, 0.05), C.leather);
  rc.position.set(-0.86, 0.43, 0);
  g.add(rc);
  const rback = new THREE.Mesh(rb(0.12, 0.56, 1.32, 0.05), C.leather);
  rback.position.set(-1.14, 0.72, 0);
  rback.rotation.z = 0.36;
  g.add(rback);
  const shelf = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.012, 1.3), C.dash);
  shelf.position.set(-1.46, 0.93, 0);
  g.add(shelf);
  return g;
}

// ------------------------------------------------------------------ starlight
function buildStars(count, sRail) {
  const r = rng(37);
  const pos = new Float32Array(count * 3);
  const size = new Float32Array(count);
  const phase = new Float32Array(count);
  const seq = new Float32Array(count);
  const col = new Float32Array(count * 3);
  const p = new THREE.Vector3();
  const n = new THREE.Vector3();
  const colors = [
    [1, 1, 1],
    [0.85, 0.93, 1],
    [1, 0.88, 0.7],
    [0.78, 0.86, 1],
  ];
  for (let i = 0; i < count; i++) {
    const x = lerp(-0.66, 0.2, r());
    const s = lerp(sRail + 0.012, 1 - sRail - 0.012, r());
    greenhousePoint(x, s, p);
    surfNormal(greenhousePoint, x, s, n, 1e-3, 1e-4);
    p.addScaledVector(n, -0.006);
    pos.set([p.x, p.y, p.z], i * 3);
    const big = r() < 0.08;
    size[i] = big ? lerp(0.006, 0.009, r()) : lerp(0.0022, 0.0045, r());
    phase[i] = r();
    // light-up wave: from the front of the roof towards the rear, with jitter
    seq[i] = clamp((0.2 - x) / 0.86) * 0.8 + r() * 0.2;
    const c = colors[Math.floor(r() * colors.length)];
    col.set(c, i * 3);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('aSize', new THREE.BufferAttribute(size, 1));
  g.setAttribute('aPhase', new THREE.BufferAttribute(phase, 1));
  g.setAttribute('aSeq', new THREE.BufferAttribute(seq, 1));
  g.setAttribute('aColor', new THREE.BufferAttribute(col, 3));
  const pts = new THREE.Points(g, makeStarMaterial());
  pts.frustumCulled = false;
  pts.renderOrder = 5;
  return pts;
}
