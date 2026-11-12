// Partner logos for the « Nos marques partenaires » band (content/site.js `partners`):
//   assets-src/partners/<slug>.<svg|png|jpg|webp>  ->  public/img/partners/<slug>.png
// The page paints each logo in gold through a CSS mask, which only reads the alpha channel:
// this script turns any official logo (colours, white or coloured background) into a white
// silhouette on a transparent background, trimmed, at 3× the size shown on the page.
//   node scripts/partner-logos.mjs
//
// How the ink is found, per logo (MODES below, `auto` by default):
//   auto   transparent logo: its own alpha; opaque logo: distance to the colour of the corners
//   dark   the dark parts are the logo (black on white)
//   light  the light parts are the logo (white version, for dark backgrounds)
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const src = path.join(root, 'assets-src/partners');
const out = path.join(root, 'public/img/partners');
const MODES = {};
// box of the logo on the page (.brands__logo, 120 × 58 px), ×3 for sharp screens
const BOX = { w: 360, h: 174 };

const files = fs.existsSync(src) ? fs.readdirSync(src).filter((f) => /\.(svg|png|jpe?g|webp)$/i.test(f)) : [];
fs.mkdirSync(out, { recursive: true });

async function silhouette(file, mode) {
  const input = path.join(src, file);
  const svg = /\.svg$/i.test(file);
  // vector logos drawn large enough for a clean edge, whatever their own size
  let density = 72;
  if (svg) {
    const m = await sharp(input).metadata();
    density = Math.min(2400, Math.ceil(72 * 2 * Math.max(BOX.w / m.width, BOX.h / m.height, 1)));
  }
  const img = sharp(input, svg ? { density } : {}).rotate().ensureAlpha();
  const { data, info } = await img.raw().toBuffer({ resolveWithObject: true });
  const { width: w, height: h } = info;
  const px = (i) => [data[i], data[i + 1], data[i + 2], data[i + 3]];
  const lum = (r, g, b) => 0.2126 * r + 0.7152 * g + 0.0722 * b;
  // the colour of the background: the median of the border pixels
  const border = [];
  for (let x = 0; x < w; x += Math.max(1, (w / 64) | 0)) border.push(px((0 * w + x) * 4), px(((h - 1) * w + x) * 4));
  for (let y = 0; y < h; y += Math.max(1, (h / 64) | 0)) border.push(px((y * w) * 4), px((y * w + w - 1) * 4));
  const transparent = border.filter((p) => p[3] < 16).length > border.length / 2;
  const med = (k) => border.map((p) => p[k]).sort((a, b) => a - b)[border.length >> 1];
  const bg = [med(0), med(1), med(2)];
  const alpha = Buffer.alloc(w * h);
  for (let i = 0, j = 0; j < w * h; i += 4, j++) {
    const [r, g, b, a] = px(i);
    let v;
    if (mode === 'dark') v = 255 - lum(r, g, b);
    else if (mode === 'light') v = lum(r, g, b);
    else if (transparent) v = a;
    else v = Math.min(255, Math.hypot(r - bg[0], g - bg[1], b - bg[2]) * 1.6);
    if (mode !== 'auto' || !transparent) v = (v * a) / 255;
    // soft threshold: no grey veil from anti-aliasing noise or a slightly uneven background
    alpha[j] = v < 40 ? 0 : v > 200 ? 255 : Math.round(((v - 40) / 160) * 255);
  }
  const white = Buffer.alloc(w * h * 3, 255);
  return sharp(white, { raw: { width: w, height: h, channels: 3 } })
    .joinChannel(alpha, { raw: { width: w, height: h, channels: 1 } })
    .png()
    .toBuffer();
}

let done = 0;
for (const file of files) {
  const slug = file.replace(/\.[^.]+$/, '');
  const mask = await silhouette(file, MODES[slug] || 'auto');
  await sharp(await sharp(mask).trim({ threshold: 1 }).toBuffer())
    .resize({ width: BOX.w, height: BOX.h, fit: 'inside', withoutEnlargement: true })
    .png({ compressionLevel: 9, palette: true, colours: 64 })
    .toFile(path.join(out, `${slug}.png`));
  done++;
  console.log(`  ${slug}.png`);
}
console.log(done ? `${done} logo(s) prêts dans public/img/partners/.` : 'Aucun logo dans assets-src/partners/.');
