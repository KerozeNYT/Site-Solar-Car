// Web files of the window tint simulator visuals (content/tint-photos.js explains the naming):
//   assets-src/vitres/<vehicle>-<angle>-<windows>.*  ->  public/img/vitres/…-960.webp, -1600.webp
// and public/img/vitres/manifest.json, read by the page.
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
const files = fs.existsSync(src) ? fs.readdirSync(src) : [];
const ANGLES = ['34', 'profil'];
const WINDOWS = ['arriere', 'avant', 'complet'];

const manifest = { credit: tintPhotos.credit || '', cars: {} };
const missing = [];
for (const v of tintVehicles) {
  let size = null;
  let complete = true;
  for (const angle of ANGLES)
    for (const win of WINDOWS) {
      const name = `${v.id}-${angle}-${win}`;
      const file = files.find((f) => f.replace(/\.(png|jpe?g|webp)$/i, '') === name);
      if (!file) {
        missing.push(name);
        complete = false;
        continue;
      }
      const input = path.join(src, file);
      const meta = await sharp(input).metadata();
      size ??= { w: meta.width, h: meta.height };
      for (const w of [960, 1600]) await sharp(input).rotate().resize({ width: Math.min(w, meta.width) }).webp({ quality: 84, effort: 6 }).toFile(path.join(out, `${name}-${w}.webp`));
    }
  if (complete) manifest.cars[v.id] = size;
}
fs.writeFileSync(path.join(out, 'manifest.json'), JSON.stringify(manifest));
console.log(`${Object.keys(manifest.cars).length}/${tintVehicles.length} véhicules complets.`, missing.length ? `Manque ${missing.length} image(s) : ${missing.slice(0, 12).join(', ')}${missing.length > 12 ? '…' : ''}` : 'Tout est là : le mode simple s’affiche.');
