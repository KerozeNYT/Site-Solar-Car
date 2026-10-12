// Optimises a car model for the web and strips third-party logos.
// Usage: node scripts/prepare-model.mjs assets-src/models/<name>.prep.json
import fs from 'node:fs';
import path from 'node:path';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { prune, dedup, textureCompress, meshopt, weld, simplify } from '@gltf-transform/functions';
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

await doc.transform(
  prune(),
  dedup(),
  // exporters often write unindexed triangles; welding restores shared vertices
  weld(),
  ...(cfg.simplifyAll ? [simplify({ simplifier: MeshoptSimplifier, ratio: cfg.simplifyAll.ratio, error: cfg.simplifyAll.error })] : []),
  textureCompress({ encoder: sharp, targetFormat: 'webp', resize: [cfg.maxTexture || 1024, cfg.maxTexture || 1024], quality: 82 }),
  meshopt({ encoder: MeshoptEncoder, level: 'medium' })
);

const out = path.resolve(cfg.output);
fs.mkdirSync(path.dirname(out), { recursive: true });
await io.write(out, doc);
console.log('wrote', out, (fs.statSync(out).size / 1024 / 1024).toFixed(2) + ' MB');
