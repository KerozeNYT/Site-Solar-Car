// Prepares real job photos for the site: SOLAR CAR plate cover laid over the car's plate (in
// perspective), other cars' plates pixelated, metadata stripped (iPhone photos carry the GPS
// position), web sizes written to public/img/realisations/.
//
// Usage: node scripts/photos.mjs [id …] [--debug]
//   assets-src/photos/originals/   the untouched photos (kept out of the repository)
//   assets-src/photos/photos.json  one entry per photo:
//     { "id": "audi-a5-coupe-34-arriere", "src": "IMG_1234.jpg",
//       "plate": [[x, y], [x, y], [x, y], [x, y]],   corners top-left, top-right, bottom-right,
//                                                    bottom-left, as fractions of width / height
//       "tone": -0.1,                                 darken (< 0) or lighten (> 0) the cover
//       "hide": [[x, y, w, h]] }                      areas to pixelate (fractions)
//   --debug  also writes .cache/photos/<id>-debug.jpg with the plate corners marked
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import { serve } from './serve.mjs';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const dir = path.join(root, 'assets-src', 'photos');
const outDir = path.join(root, 'public', 'img', 'realisations');
const work = path.join(root, '.cache', 'photos');
const args = process.argv.slice(2);
const debug = args.includes('--debug');
const only = args.filter((a) => !a.startsWith('--'));
const jobs = JSON.parse(fs.readFileSync(process.env.PHOTOS_JSON || path.join(dir, 'photos.json'), 'utf8')).filter((j) => !only.length || only.includes(j.id));
fs.mkdirSync(outDir, { recursive: true });
fs.mkdirSync(work, { recursive: true });

// the page that does the drawing: same plate art as the 3D cars, same font
fs.writeFileSync(
  path.join(work, 'index.html'),
  `<!doctype html><meta charset="utf-8"><style>@font-face{font-family:Archivo;src:url(/node_modules/@fontsource-variable/archivo/files/archivo-latin-wght-normal.woff2) format('woff2');font-weight:100 900}</style>
<script type="module">
import { drawPlate, loadEmblem } from '/src/js/plate-art.js';
// one triangle of the source image mapped onto a destination triangle (affine, clipped)
function tri(g, img, s, d) {
  const [[x0, y0], [x1, y1], [x2, y2]] = s;
  const [[u0, v0], [u1, v1], [u2, v2]] = d;
  const det = (x1 - x0) * (y2 - y0) - (x2 - x0) * (y1 - y0);
  const a = ((u1 - u0) * (y2 - y0) - (u2 - u0) * (y1 - y0)) / det;
  const b = ((v1 - v0) * (y2 - y0) - (v2 - v0) * (y1 - y0)) / det;
  const c = ((u2 - u0) * (x1 - x0) - (u1 - u0) * (x2 - x0)) / det;
  const e = ((v2 - v0) * (x1 - x0) - (v1 - v0) * (x2 - x0)) / det;
  g.save();
  g.beginPath();
  // a hair larger than the triangle: no seams between neighbours
  const cx = (u0 + u1 + u2) / 3, cy = (v0 + v1 + v2) / 3, k = 1.02;
  g.moveTo(cx + (u0 - cx) * k, cy + (v0 - cy) * k);
  g.lineTo(cx + (u1 - cx) * k, cy + (v1 - cy) * k);
  g.lineTo(cx + (u2 - cx) * k, cy + (v2 - cy) * k);
  g.closePath();
  g.clip();
  g.setTransform(a, b, c, e, u0 - a * x0 - c * y0, v0 - b * x0 - e * y0);
  g.drawImage(img, 0, 0);
  g.restore();
}
window.compose = async ({ src, plate, tone = 0, hide = [], debug = false }) => {
  await document.fonts.load('800 96px Archivo');
  const img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = src; });
  const W = img.naturalWidth, H = img.naturalHeight;
  const cv = document.createElement('canvas');
  cv.width = W; cv.height = H;
  const g = cv.getContext('2d');
  g.drawImage(img, 0, 0);
  // other plates: pixelated
  for (const [x, y, w, h] of hide) {
    const px = Math.round(x * W), py = Math.round(y * H), pw = Math.max(1, Math.round(w * W)), ph = Math.max(1, Math.round(h * H));
    const t = document.createElement('canvas');
    t.width = Math.max(1, Math.round(pw / 14)); t.height = Math.max(1, Math.round(ph / 14));
    t.getContext('2d').drawImage(cv, px, py, pw, ph, 0, 0, t.width, t.height);
    g.imageSmoothingEnabled = false;
    g.drawImage(t, 0, 0, t.width, t.height, px, py, pw, ph);
    g.imageSmoothingEnabled = true;
  }
  if (plate) {
    const art = drawPlate({ emblem: await loadEmblem('/public/img/brand/embleme-256.webp') });
    const P = plate.map(([x, y]) => [x * W, y * H]);
    const at = (u, v) => [0, 1].map((k) => (1 - v) * ((1 - u) * P[0][k] + u * P[1][k]) + v * ((1 - u) * P[3][k] + u * P[2][k]));
    const N = 12, M = 4;
    for (let i = 0; i < N; i++) for (let j = 0; j < M; j++) {
      const u0 = i / N, u1 = (i + 1) / N, v0 = j / M, v1 = (j + 1) / M;
      const s = [[u0 * art.width, v0 * art.height], [u1 * art.width, v0 * art.height], [u1 * art.width, v1 * art.height], [u0 * art.width, v1 * art.height]];
      const d = [at(u0, v0), at(u1, v0), at(u1, v1), at(u0, v1)];
      tri(g, art, [s[0], s[1], s[2]], [d[0], d[1], d[2]]);
      tri(g, art, [s[0], s[2], s[3]], [d[0], d[2], d[3]]);
    }
    // match the light of the scene
    if (tone) {
      g.save();
      g.beginPath(); P.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y))); g.closePath(); g.clip();
      g.fillStyle = tone < 0 ? 'rgba(0,0,0,' + -tone + ')' : 'rgba(255,255,255,' + tone + ')';
      g.fillRect(0, 0, W, H);
      g.restore();
    }
    if (debug) { g.fillStyle = '#ff0040'; P.forEach(([x, y]) => g.fillRect(x - 4, y - 4, 8, 8)); }
  }
  const blob = await new Promise((r) => cv.toBlob(r, 'image/png'));
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  return btoa(bin);
};
window.ready = true;
</script>`
);

const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const server = await serve(root, 4612);
const browser = await chromium.launch();
const page = await browser.newPage();
page.on('pageerror', (e) => console.error('page error:', e.message));
await page.goto('http://localhost:4612/.cache/photos/index.html');
await page.waitForFunction(() => window.ready);
for (const job of jobs) {
  // upright pixels (EXIF orientation applied), no metadata
  const upright = path.join(work, `${job.id}-upright.png`);
  await sharp(path.isAbsolute(job.src) ? job.src : path.join(dir, 'originals', job.src)).rotate().png().toFile(upright);
  const b64 = await page.evaluate((j) => window.compose(j), { ...job, src: `/.cache/photos/${job.id}-upright.png`, debug: false });
  const composed = Buffer.from(b64, 'base64');
  for (const w of [960, 1600]) {
    await sharp(composed).resize({ width: w, withoutEnlargement: true }).webp({ quality: 80 }).toFile(path.join(outDir, `${job.id}-${w}.webp`));
  }
  // JPEG for social cards and the image sitemap
  await sharp(composed).resize({ width: 1600, withoutEnlargement: true }).jpeg({ quality: 82, mozjpeg: true }).toFile(path.join(outDir, `${job.id}-1600.jpg`));
  if (debug) {
    const dbg = Buffer.from(await page.evaluate((j) => window.compose(j), { ...job, src: `/.cache/photos/${job.id}-upright.png`, debug: true }), 'base64');
    await sharp(dbg).resize({ width: 1200 }).jpeg({ quality: 85 }).toFile(path.join(work, `${job.id}-debug.jpg`));
  }
  const meta = await sharp(path.join(outDir, `${job.id}-1600.webp`)).metadata();
  console.log(`${job.id}: ${meta.width}×${meta.height}, EXIF ${meta.exif ? 'PRESENT' : 'none'}`);
}
await browser.close();
server.close();
