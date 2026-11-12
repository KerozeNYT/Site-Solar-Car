// Web files of the window tint simulator photos (content/tint-photos.js):
//   assets-src/vitres/<file>  ->  public/img/vitres/<vehicle>-<view>-960.webp, -1600.webp
// and public/img/vitres/manifest.json (picture sizes and window outlines) read by the page.
//   node scripts/tint-photos.mjs
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import { tintPhotos } from '../content/tint-photos.js';
import { tintVehicles } from '../content/pricing.js';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const src = path.join(root, 'assets-src/vitres');
const out = path.join(root, 'public/img/vitres');
fs.mkdirSync(out, { recursive: true });

const manifest = {};
const missing = [];
for (const v of tintVehicles) {
  const e = tintPhotos[v.id];
  for (const view of ['34', 'side']) {
    const p = e?.views?.[view];
    if (!p?.file || !fs.existsSync(path.join(src, p.file))) {
      missing.push(`${v.id} (${view})`);
      continue;
    }
    const img = sharp(path.join(src, p.file)).rotate();
    const { width, height } = await img.metadata();
    for (const w of [960, 1600]) await sharp(path.join(src, p.file)).rotate().resize({ width: Math.min(w, width) }).webp({ quality: 84, effort: 6 }).toFile(path.join(out, `${v.id}-${view}-${w}.webp`));
    const polys = (g) => (p[g] ? (typeof p[g][0][0] === 'number' ? [p[g]] : p[g]) : []);
    manifest[v.id] ??= { credit: e.credit || '', views: {} };
    manifest[v.id].views[view] = { w: width, h: height, front: polys('front'), rear: polys('rear') };
  }
}
fs.writeFileSync(path.join(out, 'manifest.json'), JSON.stringify(manifest));
console.log(`${Object.keys(manifest).length} véhicules prêts.`, missing.length ? `Manque : ${missing.join(', ')}` : 'Tout est là : le mode simple s’affiche.');
