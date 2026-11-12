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
const MASK_W = 768;
const WINDOWS = ['arriere', 'avant', 'complet'];

const manifest = { credit: tintPhotos.credit || '', cars: {} };
const missing = [];
const masks = {};

/** pixels of the gold highlight colour (warm, saturated) */
async function goldPixels(input) {
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
  return { w: info.width, h: info.height, data: m };
}
/** the gold windows of a picture: its gold pixels, holes (seats, wiper) closed, specks dropped,
 * edges softened, without the crest drawn in the background (top centre, above the car) */
async function goldMask(input) {
  const px = await goldPixels(input);
  const info = { width: px.w, height: px.h };
  const m = px.data;
  const raw = { raw: { width: info.width, height: info.height, channels: 1 } };
  // close (dilate then erode), then open, then soften
  // (one channel out: the morphology returns three otherwise)
  let out = await sharp(m, raw).dilate(3).erode(3).toColourspace('b-w').raw().toBuffer();
  out = await sharp(out, raw).erode(1).dilate(1).blur(0.8).toColourspace('b-w').raw().toBuffer();
  const { label, stats } = components(out, info.width, info.height);
  for (let i = 0; i < out.length; i++) {
    const c = label[i] && stats.get(label[i]);
    if (!c) continue;
    const cx = c.x / c.n / info.width;
    const cy = c.y / c.n / info.height;
    // the crest, and specks too small to be a window
    if ((cy < 0.3 && cx > 0.33 && cx < 0.67) || c.n < 150) out[i] = 0;
  }
  return { w: info.width, h: info.height, data: out };
}
/** connected patches of a mask (4-neighbours, soft edges included): a label per pixel, and per
 * patch its size, the sum of its coordinates and its horizontal extent */
function components(data, w, h) {
  const label = new Int32Array(w * h);
  const stats = new Map();
  let next = 0;
  const stack = [];
  for (let start = 0; start < label.length; start++) {
    if (label[start] || data[start] < 40) continue;
    label[start] = ++next;
    const st = { n: 0, x: 0, y: 0, x0: w, x1: 0 };
    stats.set(next, st);
    stack.push(start);
    while (stack.length) {
      const i = stack.pop();
      const x = i % w;
      st.n++;
      st.x += x;
      st.y += (i - x) / w;
      st.x0 = Math.min(st.x0, x);
      st.x1 = Math.max(st.x1, x);
      for (const j of [i - 1, i + 1, i - w, i + w]) {
        if (j < 0 || j >= label.length || label[j] || data[j] < 40) continue;
        if ((j === i - 1 && x === 0) || (j === i + 1 && x === w - 1)) continue;
        label[j] = next;
        stack.push(j);
      }
    }
  }
  return { label, stats };
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
      // each window of « complet » (a connected patch) is a front one when it lies where the front
      // windows of « avant » are (the pictures are framed alike, not to the pixel), else a rear one
      const av = masks[`${base}-avant`];
      const fr = components(av.data, av.w, av.h).stats;
      // per front window: its x range with a margin (framing differs a little), and as drawn
      const boxes = [...fr.values()].filter((c) => c.n > 400).map((c) => [c.x0 - 0.03 * av.w, c.x1 + 0.03 * av.w, c.x0, c.x1]);
      const { label, stats } = components(all.data, all.w, all.h);
      const back = Buffer.alloc(all.data.length);
      for (let i = 0; i < front.length; i++) {
        const c = label[i] && stats.get(label[i]);
        const cx = c ? c.x / c.n : i % all.w;
        let isFront = boxes.some(([a, b]) => cx >= a && cx <= b);
        // a front and a rear window touching (no pillar between them, as on a cabriolet): cut
        // the patch where the front window ends
        if (isFront && c) {
          const box = boxes.find(([a, b]) => cx >= a && cx <= b);
          if (c.x1 - c.x0 > (box[3] - box[2]) * 1.1) isFront = (i % all.w) <= box[3];
        }
        back[i] = isFront ? 0 : all.data[i];
        front[i] = isFront ? all.data[i] : 0;
      }
      await writeMask(`${base}-complet-fill`, { ...all, data: back });
      await writeMask(`${base}-complet-front`, { ...all, data: front });
    } else await writeMask(`${base}-complet-fill`, all);
  }
}
fs.writeFileSync(path.join(out, 'manifest.json'), JSON.stringify(manifest));
console.log(`${Object.keys(manifest.cars).length}/${tintVehicles.length} véhicules complets.`, missing.length ? `Manque ${missing.length} image(s) : ${missing.slice(0, 12).join(', ')}${missing.length > 12 ? '…' : ''}` : 'Tout est là : le mode simple s’affiche.');
