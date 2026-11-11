// Prepares real job photos for the site: SOLAR CAR plate cover laid over the car's plate (in
// perspective), other cars' plates pixelated, other businesses' signs blanked, a light common
// grade, metadata stripped (iPhone photos carry the GPS position), web sizes written to
// public/img/realisations/.
//
// Usage: node scripts/photos.mjs [id …] [--debug]
//   assets-src/photos/originals/   the untouched photos (kept out of the repository)
//   assets-src/photos/photos.json  one entry per photo:
//     { "id": "audi-a5-coupe-34-arriere", "src": "IMG_1234.jpg",
//       "plate": [[x, y], [x, y], [x, y], [x, y]],   corners top-left, top-right, bottom-right,
//                                                    bottom-left, as fractions of width / height
//       "tone": -0.1,                                 darken (< 0) or lighten (> 0) the cover
//       "hide": [[x, y, w, h]],                       areas to pixelate (fractions): other plates
//       "blur": [[x, y, w, h]],                       areas to blur: background lettering
//       "fill": [[[x, y], …]],                        polygons filled with their own dark colour:
//                                                    another business's sign panel
//       "wide": [x, y, w],                            16:9 crop for wide screens (page headers):
//                                                    left, top and width as fractions
//       "wide": { "y": 0.2, "h": 0.6 },               or the band y…y+h placed on the right of a
//                                                    16:9 frame, the left fading into dark
//       "grade": false,                               keep the colours as they are (edited photos)
//       "denoise": false }                            keep the fine detail (starlight: tiny points)
//   Writes <id>-320|960|1280.webp and, with "wide", the page header versions: <id>-wide-960|1600.webp
//   (wide screens), <id>-phone.webp (phones, 10:16 around "phoneX" / "phoneY", default the centre)
//   and <id>-wide-1600.jpg (social cards).
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
window.compose = async ({ src, plate, tone = 0, hide = [], blur = [], fill = [], debug = false }) => {
  await document.fonts.load('800 96px Archivo');
  const img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = src; });
  const W = img.naturalWidth, H = img.naturalHeight;
  const cv = document.createElement('canvas');
  cv.width = W; cv.height = H;
  const g = cv.getContext('2d');
  g.drawImage(img, 0, 0);
  // background lettering: blurred in place
  for (const [x, y, w, h] of blur) {
    const px = Math.round(x * W), py = Math.round(y * H), pw = Math.round(w * W), ph = Math.round(h * H);
    const m = 40;
    const t = document.createElement('canvas');
    t.width = pw + 2 * m; t.height = ph + 2 * m;
    const tg = t.getContext('2d');
    tg.filter = 'blur(' + Math.max(6, Math.round(Math.min(pw, ph) / 6)) + 'px)';
    tg.drawImage(cv, px - m, py - m, t.width, t.height, 0, 0, t.width, t.height);
    g.drawImage(t, m, m, pw, ph, px, py, pw, ph);
  }
  // another business's sign: the panel filled with its own dark colour, sampled slice by slice
  // across it (the light falls off along the wall), with a fine grain like the rest of the photo
  for (const poly of fill) {
    const P = poly.map(([x, y]) => [x * W, y * H]);
    const path = new Path2D();
    P.forEach(([x, y], i) => (i ? path.lineTo(x, y) : path.moveTo(x, y)));
    path.closePath();
    const xs = P.map((p) => p[0]), ys = P.map((p) => p[1]);
    const bx = Math.max(0, Math.floor(Math.min(...xs))), by = Math.max(0, Math.floor(Math.min(...ys)));
    const bw = Math.min(W, Math.ceil(Math.max(...xs))) - bx, bh = Math.min(H, Math.ceil(Math.max(...ys))) - by;
    const src = g.getImageData(bx, by, bw, bh).data;
    const N = 10;
    const grad = g.createLinearGradient(bx, 0, bx + bw, 0);
    for (let k = 0; k < N; k++) {
      const px = [];
      for (let yy = 0; yy < bh; yy += 2) for (let xx = Math.floor((k * bw) / N); xx < Math.floor(((k + 1) * bw) / N); xx += 2) {
        if (!g.isPointInPath(path, bx + xx, by + yy)) continue;
        const i = (yy * bw + xx) * 4;
        px.push([src[i], src[i + 1], src[i + 2], src[i] * 0.3 + src[i + 1] * 0.59 + src[i + 2] * 0.11]);
      }
      if (!px.length) continue;
      px.sort((a, b) => a[3] - b[3]);
      const a0 = Math.floor(px.length * 0.2);
      const sel = px.slice(a0, Math.max(a0 + 1, Math.floor(px.length * 0.55)));
      const avg = [0, 1, 2].map((c) => Math.round(sel.reduce((s, p) => s + p[c], 0) / sel.length));
      grad.addColorStop((k + 0.5) / N, 'rgb(' + avg.join(',') + ')');
    }
    g.fillStyle = grad;
    g.fill(path);
    const out = g.getImageData(bx, by, bw, bh);
    const d = out.data;
    for (let yy = 0; yy < bh; yy++) for (let xx = 0; xx < bw; xx++) {
      if (!g.isPointInPath(path, bx + xx, by + yy)) continue;
      const i = (yy * bw + xx) * 4, n = (Math.random() - 0.5) * 7;
      d[i] += n; d[i + 1] += n; d[i + 2] += n;
    }
    g.putImageData(out, bx, by);
  }
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

/** the common grade: a touch of contrast and colour, the corners slightly darker (dark site) */
async function grade(buf) {
  const { width: w, height: h } = await sharp(buf).metadata();
  const vignette = Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"><defs><radialGradient id="v" cx="50%" cy="48%" r="72%"><stop offset="55%" stop-color="#fff"/><stop offset="100%" stop-color="#b4b4b4"/></radialGradient></defs><rect width="100%" height="100%" fill="url(#v)"/></svg>`
  );
  return sharp(buf).linear(1.06, -6).modulate({ saturation: 1.05 }).composite([{ input: vignette, blend: 'multiply' }]).png().toBuffer();
}

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
  const raw = Buffer.from(b64, 'base64');
  const composed = job.grade === false ? raw : await grade(raw);
  // once resized, a light median removes the phone's fine noise (gravel, grass): files about half
  // as heavy for no visible loss; never on starlight photos (it would erase the small points of light)
  const clean = (img) => (job.denoise === false ? img : img.median(3));
  fs.writeFileSync(path.join(work, `${job.id}-final.png`), composed);
  // 320: thumbnails, 960: cards, 1280: full width on phones (enough for a 3x screen)
  for (const [w, q] of [[320, 68], [960, 70], [1280, 72]]) {
    await clean(sharp(composed).resize({ width: w, withoutEnlargement: true })).webp({ quality: q, effort: 6, smartSubsample: true }).toFile(path.join(outDir, `${job.id}-${w}.webp`));
  }
  if (job.wide) {
    const { width: W, height: H } = await sharp(composed).metadata();
    let wide;
    if (Array.isArray(job.wide)) {
      // a plain 16:9 crop
      const [x, y, w] = job.wide;
      const cw = Math.round(w * W);
      const box = { left: Math.round(x * W), top: Math.round(y * H), width: cw, height: Math.min(Math.round((cw * 9) / 16), H - Math.round(y * H)) };
      wide = await sharp(composed).extract(box).toBuffer();
    } else {
      // the car on the right of a 16:9 frame: a full-width band of the photo, its left edge
      // fading into a blurred, darkened extension of itself (room for the page title)
      const band = await sharp(composed).extract({ left: 0, top: Math.round(job.wide.y * H), width: W, height: Math.round(job.wide.h * H) }).toBuffer();
      const fg = await sharp(band).resize({ height: 900 }).toBuffer();
      const fw = (await sharp(fg).metadata()).width;
      const fade = Math.round(fw * 0.32);
      const mask = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${fw}" height="900"><defs><linearGradient id="m" x1="0" x2="1"><stop offset="0" stop-color="#fff" stop-opacity="0"/><stop offset="${(fade / fw).toFixed(3)}" stop-color="#fff" stop-opacity="1"/></linearGradient></defs><rect width="100%" height="100%" fill="url(#m)"/></svg>`);
      const fgFaded = await sharp(fg).ensureAlpha().composite([{ input: mask, blend: 'dest-in' }]).png().toBuffer();
      const bg = await sharp(band).resize(1600, 900, { fit: 'cover' }).blur(90).modulate({ brightness: 0.2, saturation: 0.35 }).toBuffer();
      wide = await sharp(bg).composite([{ input: fgFaded, left: 1600 - fw, top: 0 }]).png().toBuffer();
    }
    for (const [w2, q] of [[960, 76], [1600, 78]]) {
      await sharp(wide).resize({ width: w2, height: Math.round((w2 * 9) / 16), fit: 'cover' }).webp({ quality: q, effort: 6, smartSubsample: true }).toFile(path.join(outDir, `${job.id}-wide-${w2}.webp`));
    }
    // page header on phones: the photo cut to the screen's proportions (10:16), centred on the car
    const ph = Math.min(H, Math.round((W * 16) / 10));
    const pw = Math.round((ph * 10) / 16);
    const fx = job.phoneX ?? 0.5;
    const fy = job.phoneY ?? 0.5;
    await clean(sharp(composed).extract({ left: Math.round(Math.min(W - pw, Math.max(0, fx * W - pw / 2))), top: Math.round(Math.min(H - ph, Math.max(0, fy * H - ph / 2))), width: pw, height: ph }).resize({ width: 750 }))
      .webp({ quality: 66, effort: 6, smartSubsample: true })
      .toFile(path.join(outDir, `${job.id}-phone.webp`));
    // JPEG for social cards and the structured data
    await sharp(wide).resize({ width: 1600, height: 900, fit: 'cover' }).jpeg({ quality: 82, mozjpeg: true }).toFile(path.join(outDir, `${job.id}-wide-1600.jpg`));
  }
  if (debug) {
    const dbg = Buffer.from(await page.evaluate((j) => window.compose(j), { ...job, src: `/.cache/photos/${job.id}-upright.png`, debug: true }), 'base64');
    await sharp(dbg).resize({ width: 1200 }).jpeg({ quality: 85 }).toFile(path.join(work, `${job.id}-debug.jpg`));
  }
  const meta = await sharp(path.join(outDir, `${job.id}-1280.webp`)).metadata();
  console.log(`${job.id}: ${meta.width}×${meta.height}, EXIF ${meta.exif ? 'PRESENT' : 'none'}`);
}
await browser.close();
server.close();
