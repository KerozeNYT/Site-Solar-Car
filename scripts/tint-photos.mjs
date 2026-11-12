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
const masks = {};
const MASK_W = 768;

/** where the gold windows are: their warm, saturated colour stands out on the dark car and
 * background; holes (seats, wiper) closed, specks dropped, edges softened */
async function goldMask(input) {
  const { data, info } = await sharp(input).rotate().resize({ width: MASK_W }).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const n = info.width * info.height;
  const m = Buffer.alloc(n);
  for (let i = 0; i < n; i++) {
    const r = data[i * 3] / 255;
    const g = data[i * 3 + 1] / 255;
    const b = data[i * 3 + 2] / 255;
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const s = max ? (max - min) / max : 0;
    let h = 0;
    if (max !== min) h = max === r ? 60 * (((g - b) / (max - min)) % 6) : max === g ? 60 * ((b - r) / (max - min) + 2) : 60 * ((r - g) / (max - min) + 4);
    if (h < 0) h += 360;
    m[i] = h > 25 && h < 58 && s > 0.28 && max > 0.2 ? 255 : 0;
  }
  const raw = { raw: { width: info.width, height: info.height, channels: 1 } };
  // close (dilate then erode), then open, then soften
  // (one channel out: the morphology returns three otherwise)
  let out = await sharp(m, raw).dilate(3).erode(3).toColourspace('b-w').raw().toBuffer();
  out = await sharp(out, raw).erode(1).dilate(1).blur(0.8).toColourspace('b-w').raw().toBuffer();
  return { w: info.width, h: info.height, data: out };
}
/** a mask as a WebP whose alpha is the mask (CSS mask-image) */
async function writeMask(name, { w, h, data }) {
  const rgba = Buffer.alloc(w * h * 4, 255);
  for (let i = 0; i < w * h; i++) rgba[i * 4 + 3] = data[i];
  await sharp(rgba, { raw: { width: w, height: h, channels: 4 } }).webp({ lossless: true, effort: 6 }).toFile(path.join(out, `${name}.webp`));
}
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
      masks[name] = await goldMask(input);
    }
  if (!complete) continue;
  manifest.cars[v.id] = size;
  // the shade goes on the gold windows; at the front only a clear film is legal, so the front
  // windows of « complet » (complet minus arriere) get their own mask, shown lightly tinted
  for (const angle of ANGLES) {
    const base = `${v.id}-${angle}`;
    const all = masks[`${base}-complet`];
    const rear = masks[`${base}-arriere`];
    await writeMask(`${base}-arriere-fill`, rear);
    await writeMask(`${base}-avant-fill`, masks[`${base}-avant`]);
    if (all.w === rear.w && all.h === rear.h) {
      const front = Buffer.alloc(all.data.length);
      // the windows of « complet » near the rear windows of « arriere » take the shade, the others
      // are the front ones: shapes taken from « complet » itself, with a margin so a slight offset
      // between the two pictures leaves no sliver behind
      const grown = await sharp(rear.data, { raw: { width: rear.w, height: rear.h, channels: 1 } }).dilate(6).toColourspace('b-w').raw().toBuffer();
      const back = Buffer.alloc(all.data.length);
      for (let i = 0; i < front.length; i++) {
        back[i] = grown[i] > 128 ? all.data[i] : 0;
        front[i] = grown[i] > 128 ? 0 : all.data[i];
      }
      await writeMask(`${base}-complet-fill`, { ...all, data: back });
      await writeMask(`${base}-complet-front`, { ...all, data: front });
    } else await writeMask(`${base}-complet-fill`, all);
  }
}
fs.writeFileSync(path.join(out, 'manifest.json'), JSON.stringify(manifest));
console.log(`${Object.keys(manifest.cars).length}/${tintVehicles.length} véhicules complets.`, missing.length ? `Manque ${missing.length} image(s) : ${missing.slice(0, 12).join(', ')}${missing.length > 12 ? '…' : ''}` : 'Tout est là : le mode simple s’affiche.');
