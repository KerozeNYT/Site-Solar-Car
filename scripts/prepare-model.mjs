// Optimises a car model for the web and strips third-party logos.
// Usage: node scripts/prepare-model.mjs assets-src/models/<name>.prep.json
import fs from 'node:fs';
import path from 'node:path';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { prune, dedup, textureCompress, meshopt, weld, simplify, flatten, join, joinPrimitives, transformPrimitive } from '@gltf-transform/functions';
import { getBounds } from '@gltf-transform/core';
import { MeshoptEncoder, MeshoptSimplifier } from 'meshoptimizer';
import sharp from 'sharp';

const cfgPath = process.argv[2];
if (!cfgPath) throw new Error('usage: prepare-model.mjs <config.json>');
const cfg = JSON.parse(fs.readFileSync(cfgPath, 'utf8'));
const dir = path.dirname(cfgPath);

await MeshoptEncoder.ready;
await MeshoptSimplifier.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.encoder': MeshoptEncoder });
const doc = await io.read(path.join(dir, cfg.input));
const root = doc.getRoot();
const byName = (list, names) => list.filter((x) => names.includes(x.getName()));

// --- logo / branding removal
for (const m of byName(root.listMaterials(), cfg.removeEmissiveMaps || [])) {
  m.setEmissiveTexture(null);
  m.setEmissiveFactor([0, 0, 0]);
}
for (const m of byName(root.listMaterials(), cfg.removeBaseMaps || [])) {
  m.setBaseColorTexture(null);
  if (cfg.baseColorOverride && cfg.baseColorOverride[m.getName()]) m.setBaseColorFactor(cfg.baseColorOverride[m.getName()]);
}
for (const m of byName(root.listMaterials(), cfg.removeNormalMaps || [])) m.setNormalTexture(null);
for (const n of byName(root.listNodes(), cfg.removeNodes || [])) n.dispose();
// remove every node whose name contains one of these strings (e.g. inner glass layers)
for (const n of root.listNodes().filter((n) => (cfg.removeNodesMatching || []).some((x) => n.getName().includes(x)))) n.dispose();

// --- some converters write every face twice (the second with reversed winding) to fake
// double-sided rendering. Keep the authored face of each pair and let the material be
// double-sided instead: half the triangles, and normals that no longer cancel out.
if (cfg.dropTwinFaces) {
  let dropped = 0;
  for (const m of root.listMeshes()) {
    for (const p of m.listPrimitives()) {
      const pos = p.getAttribute('POSITION');
      const n = pos.getCount();
      const idx = p.getIndices()?.getArray() || Uint32Array.from({ length: n }, (_, i) => i);
      const tris = idx.length / 3;
      if (tris % 2) continue;
      const v = [0, 0, 0];
      const key = (t) => [0, 1, 2].map((k) => pos.getElement(idx[t * 3 + k], v).join()).sort().join('|');
      let twins = 0;
      for (let t = 0; t < tris; t += 2) if (key(t) === key(t + 1)) twins++;
      if (twins < (tris / 2) * 0.98) continue;
      const keep = new Uint32Array(tris / 2 * 3);
      for (let t = 0; t < tris; t += 2) keep.set(idx.subarray(t * 3, t * 3 + 3), (t / 2) * 3);
      p.setIndices(doc.createAccessor().setType('SCALAR').setArray(keep).setBuffer(pos.getBuffer()));
      p.getMaterial()?.setDoubleSided(true);
      dropped += tris / 2;
    }
  }
  console.log('twin faces dropped', dropped);
}

// --- mirrored parts (e.g. the right-hand wheels) sometimes come out of a conversion with their
// triangles wound against their normals: the renderer then culls the outside and shows the
// inside. Rewind every primitive whose winding disagrees with its normals (on by default).
if (cfg.fixWinding !== false) {
  let fixed = 0;
  for (const m of root.listMeshes()) {
    for (const p of m.listPrimitives()) {
      const P = p.getAttribute('POSITION');
      const N = p.getAttribute('NORMAL');
      if (!N || p.getMode() !== 4) continue;
      const n = P.getCount();
      const idx = p.getIndices()?.getArray() || Uint32Array.from({ length: n }, (_, i) => i);
      const a = [0, 0, 0], b = [0, 0, 0], c = [0, 0, 0], na = [0, 0, 0], nb = [0, 0, 0], nc = [0, 0, 0];
      let against = 0;
      let total = 0;
      for (let t = 0; t < idx.length; t += 3) {
        P.getElement(idx[t], a);
        P.getElement(idx[t + 1], b);
        P.getElement(idx[t + 2], c);
        N.getElement(idx[t], na);
        N.getElement(idx[t + 1], nb);
        N.getElement(idx[t + 2], nc);
        const u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
        const v = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
        const f = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
        const d = f[0] * (na[0] + nb[0] + nc[0]) + f[1] * (na[1] + nb[1] + nc[1]) + f[2] * (na[2] + nb[2] + nc[2]);
        if (d === 0) continue;
        total++;
        if (d < 0) against++;
      }
      if (!total || against / total <= 0.5) continue;
      const out = idx.slice();
      for (let t = 0; t < out.length; t += 3) [out[t + 1], out[t + 2]] = [out[t + 2], out[t + 1]];
      p.setIndices(doc.createAccessor().setType('SCALAR').setArray(out).setBuffer(P.getBuffer()));
      fixed++;
    }
  }
  if (fixed) console.log('rewound', fixed, 'primitives');
}

// --- models exported without useful names: find parts by their look. A rule matches a
// primitive's material by any of baseColor (rgba), metallic, roughness, emissive, alphaMode
// (within `tol`), optionally only on nodes whose centre lies in `box` (world space).
const near = (a, b, tol) => (Array.isArray(b) ? b.every((x, i) => Math.abs(a[i] - x) <= tol) : Math.abs(a - b) <= tol);
function matching({ match, tol = 0.02, box }) {
  const out = [];
  for (const n of root.listNodes()) {
    if (!n.getMesh()) continue;
    if (box) {
      const b = getBounds(n);
      const c = b.min.map((x, j) => (x + b.max[j]) / 2);
      if (!c.every((x, j) => x >= box.min[j] && x <= box.max[j])) continue;
    }
    for (const prim of n.getMesh().listPrimitives()) {
      const m = prim.getMaterial();
      if (!m) continue;
      const ok =
        (match.baseColor === undefined || near(m.getBaseColorFactor(), match.baseColor, tol)) &&
        (match.metallic === undefined || near(m.getMetallicFactor(), match.metallic, tol)) &&
        (match.roughness === undefined || near(m.getRoughnessFactor(), match.roughness, tol)) &&
        (match.emissive === undefined || near(m.getEmissiveFactor(), match.emissive, tol)) &&
        (match.alphaMode === undefined || m.getAlphaMode() === match.alphaMode);
      if (ok) out.push({ node: n, prim });
    }
  }
  return out;
}
// name the matching materials (e.g. every body panel -> "paint")
for (const rule of cfg.materialNames || []) {
  const hits = matching(rule);
  hits.forEach(({ prim }) => prim.getMaterial().setName(rule.name));
  console.log('material', rule.name, '×', hits.length);
}
// merge the matching primitives into one node with that name (e.g. all headlight LEDs)
for (const rule of cfg.groups || []) {
  const hits = matching(rule);
  if (!hits.length) throw new Error(`group ${rule.name}: nothing matches`);
  const material = hits[0].prim.getMaterial();
  const prims = hits.map(({ node, prim }) => {
    const p = prim.clone().setMaterial(material);
    transformPrimitive(p, node.getWorldMatrix());
    return p;
  });
  const merged = joinPrimitives(prims);
  prims.forEach((p) => p.dispose());
  for (const { node, prim } of hits) {
    prim.dispose();
    if (!node.getMesh().listPrimitives().length) node.dispose();
  }
  root.listScenes()[0].addChild(doc.createNode(rule.name).setMesh(doc.createMesh(rule.name).addPrimitive(merged)));
  console.log('group', rule.name, '×', hits.length);
}

// --- short, loader-safe names for the parts content/cars/*.js refers to. Each key is a unique
// fragment of the original node name (three.js strips characters such as ':' from names).
for (const [frag, name] of Object.entries(cfg.rename || {})) {
  const exact = root.listNodes().filter((n) => n.getMesh() && n.getName() === frag);
  const hits = exact.length ? exact : root.listNodes().filter((n) => n.getName().includes(frag));
  if (hits.length !== 1) throw new Error(`rename: ${hits.length} nodes match "${frag}"`);
  hits[0].setName(name);
}

// --- uniform scale (models authored in odd units); split boxes below are given after it
if (cfg.scale) {
  for (const scene of root.listScenes()) {
    for (const n of scene.listChildren()) {
      n.setScale(n.getScale().map((x) => x * cfg.scale));
      n.setTranslation(n.getTranslation().map((x) => x * cfg.scale));
    }
  }
}

// --- drop material extensions the site does not need (e.g. transmission, costly to render)
for (const ext of root.listExtensionsUsed()) if ((cfg.dropExtensions || []).includes(ext.extensionName)) ext.dispose();

// --- split meshes that merge several parts (e.g. every window in one mesh) into named nodes.
// Each connected piece goes to the first part whose box (world space, as printed by
// inspect-model) contains its centre and that has at least `minTris` triangles.
for (const { node: name, parts, mode = 'pieces' } of cfg.split || []) {
  // exact name, or the single mesh node whose name ends with it
  const hits = root.listNodes().filter((n) => n.getMesh() && (n.getName() === name || n.getName().endsWith(name)));
  const node = hits.find((n) => n.getName() === name) || (hits.length === 1 ? hits[0] : null);
  if (!node) throw new Error(`split: ${hits.length} mesh nodes match ${name}`);
  const M = node.getWorldMatrix();
  const world = (p) => [0, 1, 2].map((j) => M[j] * p[0] + M[4 + j] * p[1] + M[8 + j] * p[2] + M[12 + j]);
  const buckets = Object.fromEntries(Object.keys(parts).map((k) => [k, []]));
  for (const prim of node.getMesh().listPrimitives()) {
    const pos = prim.getAttribute('POSITION');
    const n = pos.getCount();
    const idx = prim.getIndices();
    const tris = (idx ? idx.getCount() : n) / 3;
    const I = (t, k) => (idx ? idx.getScalar(t * 3 + k) : t * 3 + k);
    // connected pieces: vertices at the same position are joined, then triangles are unioned
    const v = [0, 0, 0];
    const same = new Map();
    const rep = new Int32Array(n);
    for (let i = 0; i < n; i++) {
      const k = pos.getElement(i, v).map((x) => x.toFixed(5)).join();
      if (!same.has(k)) same.set(k, i);
      rep[i] = same.get(k);
    }
    const parent = Int32Array.from({ length: n }, (_, i) => i);
    const findRoot = (a) => {
      while (parent[a] !== a) a = parent[a] = parent[parent[a]];
      return a;
    };
    for (let t = 0; t < tris; t++) {
      const a = findRoot(rep[I(t, 0)]);
      parent[findRoot(rep[I(t, 1)])] = a;
      parent[findRoot(rep[I(t, 2)])] = a;
    }
    const pieces = new Map();
    for (let t = 0; t < tris; t++) {
      const r = findRoot(rep[I(t, 0)]);
      if (!pieces.has(r)) pieces.set(r, { tris: [], min: [Infinity, Infinity, Infinity], max: [-Infinity, -Infinity, -Infinity] });
      const pc = pieces.get(r);
      pc.tris.push(t);
      for (let k = 0; k < 3; k++) {
        const w = world(pos.getElement(I(t, k), v));
        for (let j = 0; j < 3; j++) {
          pc.min[j] = Math.min(pc.min[j], w[j]);
          pc.max[j] = Math.max(pc.max[j], w[j]);
        }
      }
    }
    const rest = [];
    const inBox = (c, b) => c.every((x, j) => x >= b.min[j] && x <= b.max[j]);
    if (mode === 'triangles') {
      // one continuous sheet (e.g. front and rear door glass): classify each triangle
      for (let t = 0; t < tris; t++) {
        const c = [0, 0, 0];
        for (let k = 0; k < 3; k++) world(pos.getElement(I(t, k), v)).forEach((x, j) => (c[j] += x / 3));
        const hit = Object.entries(parts).find(([, b]) => inBox(c, b));
        (hit ? buckets[hit[0]] : rest).push([I(t, 0), I(t, 1), I(t, 2)]);
      }
    } else {
      for (const pc of pieces.values()) {
        const c = pc.min.map((x, j) => (x + pc.max[j]) / 2);
        const hit = Object.entries(parts).find(([, b]) => pc.tris.length >= (b.minTris || 0) && inBox(c, b));
        (hit ? buckets[hit[0]] : rest).push(...pc.tris.map((t) => [I(t, 0), I(t, 1), I(t, 2)]));
      }
    }
    const indices = (list) => doc.createAccessor().setType('SCALAR').setArray(n > 65535 ? new Uint32Array(list.flat()) : new Uint16Array(list.flat()));
    for (const [part, list] of Object.entries(buckets)) {
      if (!list.length) continue;
      const p2 = prim.clone().setIndices(indices(list));
      const child = doc.createNode(part).setMesh(doc.createMesh(part).addPrimitive(p2)).setMatrix(node.getMatrix());
      const up = node.getParentNode();
      if (up) up.addChild(child);
      else root.listScenes().forEach((s) => s.listChildren().includes(node) && s.addChild(child));
      buckets[part] = [];
    }
    if (rest.length) prim.setIndices(indices(rest));
    else prim.dispose();
  }
  if (!node.getMesh().listPrimitives().length) node.dispose();
  console.log('split', name, '->', Object.keys(parts).join(', '));
}

// --- drop unused material variants (the site sets its own paint)
if (cfg.dropVariants) {
  for (const ext of doc.getRoot().listExtensionsUsed()) {
    if (ext.extensionName === 'KHR_materials_variants') ext.dispose();
  }
}

// --- optional decimation of very dense parts
for (const [name, ratio] of Object.entries(cfg.simplify || {})) {
  for (const n of byName(root.listNodes(), [name])) {
    const mesh = n.getMesh();
    if (!mesh) continue;
    const sub = doc.createScene('tmp').addChild(n);
    await doc.transform(weld(), simplify({ simplifier: MeshoptSimplifier, ratio, error: 0.001 }));
    sub.dispose();
  }
}

// --- fewer draw calls: merge every part the site does not address by name. Nodes whose name
// starts with one of `join.keep` stay separate (windows, lights…); materials keep their names.
if (cfg.join) {
  await doc.transform(dedup(), flatten());
  for (const n of root.listNodes()) {
    if (!(cfg.join.keep || []).some((k) => n.getName().startsWith(k))) {
      n.setName('');
      n.getMesh()?.setName('');
    }
  }
  await doc.transform(join({ keepNamed: true }));
}

/** area-weighted smooth vertex normals on indexed primitives (gltf-transform's are flat) */
function smoothNormals({ overwrite = false } = {}) {
  return (d) => {
    for (const m of d.getRoot().listMeshes()) {
      for (const p of m.listPrimitives()) {
        if (p.getAttribute('NORMAL') && !overwrite) continue;
        const pos = p.getAttribute('POSITION').getArray();
        const idx = p.getIndices()?.getArray();
        if (!idx) continue;
        const n = new Float32Array(pos.length);
        for (let t = 0; t < idx.length; t += 3) {
          const [a, b, c] = [idx[t] * 3, idx[t + 1] * 3, idx[t + 2] * 3];
          const ux = pos[b] - pos[a], uy = pos[b + 1] - pos[a + 1], uz = pos[b + 2] - pos[a + 2];
          const vx = pos[c] - pos[a], vy = pos[c + 1] - pos[a + 1], vz = pos[c + 2] - pos[a + 2];
          const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
          for (const k of [a, b, c]) {
            n[k] += nx;
            n[k + 1] += ny;
            n[k + 2] += nz;
          }
        }
        for (let i = 0; i < n.length; i += 3) {
          const l = Math.hypot(n[i], n[i + 1], n[i + 2]) || 1;
          n[i] /= l;
          n[i + 1] /= l;
          n[i + 2] /= l;
        }
        p.setAttribute('NORMAL', d.createAccessor().setType('VEC3').setArray(n).setBuffer(p.getAttribute('POSITION').getBuffer()));
      }
    }
  };
}

// --- converted models can carry per-corner normals that block welding and decimation: drop
// them, weld by position, decimate, then rebuild smooth normals
if (cfg.rebuildNormals) {
  for (const m of root.listMeshes()) for (const p of m.listPrimitives()) p.setAttribute('NORMAL', null);
}

await doc.transform(
  prune(),
  dedup(),
  // exporters often write unindexed triangles; welding restores shared vertices
  weld(),
  ...(cfg.simplifyAll ? [simplify({ simplifier: MeshoptSimplifier, ratio: cfg.simplifyAll.ratio, error: cfg.simplifyAll.error })] : []),
  ...(cfg.rebuildNormals ? [smoothNormals({ overwrite: true })] : []),
  textureCompress({ encoder: sharp, targetFormat: 'webp', resize: [cfg.maxTexture || 1024, cfg.maxTexture || 1024], quality: 82 }),
  meshopt({ encoder: MeshoptEncoder, level: 'medium' })
);

const out = path.resolve(cfg.output);
fs.mkdirSync(path.dirname(out), { recursive: true });
await io.write(out, doc);
console.log('wrote', out, (fs.statSync(out).size / 1024 / 1024).toFixed(2) + ' MB');
