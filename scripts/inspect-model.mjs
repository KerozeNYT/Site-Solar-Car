// Lists meshes (name, triangle count, material, bounds) of a .glb to fill content/car.js.
// Usage: node scripts/inspect-model.mjs public/models/<file>.glb
import { NodeIO, getBounds } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { MeshoptDecoder } from 'meshoptimizer';
await MeshoptDecoder.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.decoder': MeshoptDecoder });
const doc = await io.read(process.argv[2]);
for (const n of doc.getRoot().listNodes()) {
  const m = n.getMesh();
  if (!m) continue;
  const b = getBounds(n);
  const prims = m.listPrimitives();
  const tris = prims.reduce((a, p) => a + (p.getIndices() ? p.getIndices().getCount() : p.getAttribute('POSITION').getCount()) / 3, 0);
  const mats = prims.map((p) => p.getMaterial()?.getName() || '-').join('|');
  const f = (v) => v.map((x) => x.toFixed(2)).join(',');
  console.log(`${n.getName().padEnd(14)} tris=${String(tris).padStart(6)} mat=${mats} min=(${f(b.min)}) max=(${f(b.max)})`);
}
