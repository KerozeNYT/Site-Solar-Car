// Seasonal versions of the logo (content/themes.js), derived from the logo for dark backgrounds
// (public/img/brand/*-clair-*): nothing of another brand is used, the SOLAR CAR 37 artwork is only
// recoloured or dressed.
//   - neon: the shield's gold turned into a sunset (yellow, orange, pink, violet) keeping its
//     shading, the wordmark from white to pink; the glow is added by the CSS
//   - noel: the logo as it is, with a Santa hat on the shield
// Usage: node scripts/logo-saisons.mjs
import path from 'node:path';
import sharp from 'sharp';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const brand = path.join(root, 'public/img/brand');

const SOURCES = [
  // name, source, output widths, the shield's box in the source (fractions of width / height)
  { name: 'logo-horizontal', src: 'logo-horizontal-clair-800.webp', widths: [200, 400], shield: { x: 0, y: 0, w: 0.36, h: 1 } },
  { name: 'logo-officiel', src: 'logo-officiel-clair-480.webp', widths: [240, 480], shield: { x: 0.24, y: 0, w: 0.52, h: 0.59 } },
];

const mix = (a, b, k) => a + (b - a) * k;
const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
function ramp(stops, t) {
  t = Math.min(1, Math.max(0, t));
  for (let i = 1; i < stops.length; i++) {
    const [t1, c1] = stops[i];
    const [t0, c0] = stops[i - 1];
    if (t <= t1) {
      const k = (t - t0) / (t1 - t0 || 1);
      return [0, 1, 2].map((j) => mix(c0[j], c1[j], k));
    }
  }
  return stops[stops.length - 1][1];
}
const SUNSET = [
  [0, hex('#fff1a8')],
  [0.28, hex('#ffc04d')],
  [0.52, hex('#ff7a45')],
  [0.74, hex('#ff3d8b')],
  [1, hex('#a634ff')],
];
const WORD = [
  [0, hex('#ffffff')],
  [0.55, hex('#ffe3f2')],
  [1, hex('#ff8fcf')],
];

async function neon({ src, shield }) {
  const { data, info } = await sharp(path.join(brand, src)).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width: W, height: H } = info;
  const sx0 = shield.x * W;
  const sx1 = (shield.x + shield.w) * W;
  const sy0 = shield.y * H;
  const sy1 = (shield.y + shield.h) * H;
  // the wordmark's box (outside the shield): its own top and bottom, for its gradient
  let wTop = H;
  let wBot = 0;
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const i = (y * W + x) * 4;
      if (data[i + 3] > 40 && !(x >= sx0 && x < sx1 && y >= sy0 && y < sy1)) {
        wTop = Math.min(wTop, y);
        wBot = Math.max(wBot, y);
      }
    }
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const i = (y * W + x) * 4;
      if (data[i + 3] === 0) continue;
      const [r, g, b] = [data[i], data[i + 1], data[i + 2]];
      const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
      const inShield = x >= sx0 && x < sx1 && y >= sy0 && y < sy1;
      let c;
      if (inShield) {
        if (lum < 55) c = [27, 6, 48]; // the black lines of the monogram: deep violet
        else {
          const base = ramp(SUNSET, (y - sy0) / (sy1 - sy0));
          const s = 0.38 + 0.85 * (lum / 255); // keeps the metal's shading
          c = base.map((v) => Math.min(255, v * s));
          if (lum > 215) c = c.map((v) => mix(v, 255, (lum - 215) / 80)); // highlights
        }
      } else {
        const base = ramp(WORD, (y - wTop) / Math.max(1, wBot - wTop));
        const s = Math.min(1, lum / 235);
        c = base.map((v) => v * s);
      }
      data[i] = c[0];
      data[i + 1] = c[1];
      data[i + 2] = c[2];
    }
  return sharp(data, { raw: info }).png().toBuffer();
}

/** a Santa hat sitting on the shield's top left corner, slightly tilted */
function hatSVG(size) {
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 200 200">
  <defs>
    <linearGradient id="red" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ff4d5e"/><stop offset=".55" stop-color="#d4152f"/><stop offset="1" stop-color="#8f0a20"/></linearGradient>
    <radialGradient id="fur" cx=".4" cy=".35" r=".8"><stop offset="0" stop-color="#ffffff"/><stop offset=".7" stop-color="#f1ede6"/><stop offset="1" stop-color="#cfc8bd"/></radialGradient>
  </defs>
  <g transform="rotate(-24 100 120)">
    <path d="M38 138 C 52 92, 82 46, 132 30 C 158 22, 182 38, 176 64 C 170 84, 150 78, 146 64 C 136 90, 150 118, 162 138 Z" fill="url(#red)"/>
    <path d="M60 120 C 74 86, 98 56, 130 44" fill="none" stroke="#ff8a95" stroke-width="5" stroke-linecap="round" opacity=".55"/>
    <circle cx="160" cy="70" r="20" fill="url(#fur)"/>
    <rect x="22" y="126" width="156" height="38" rx="19" fill="url(#fur)"/>
    <path d="M34 140 q 12 -8 24 0 t 24 0 t 24 0 t 24 0 t 24 0" fill="none" stroke="#d9d2c6" stroke-width="3" opacity=".7"/>
  </g>
</svg>`);
}

// room added above the artwork for the hat, as a fraction of the logo's height (NOEL_PAD): the
// CSS enlarges the picture by as much and pulls it up, so the logo itself keeps its size and place
export const NOEL_PAD = { 'logo-horizontal': 0.2, 'logo-officiel': 0.1 };
async function noel({ name, src, shield }) {
  const img = sharp(path.join(brand, src));
  const { width: W, height: H } = await img.metadata();
  const pad = Math.round(H * NOEL_PAD[name]);
  const sw = shield.w * W;
  const size = Math.round(sw * 0.62);
  const left = Math.max(0, Math.round(shield.x * W - sw * 0.1));
  const top = Math.max(0, Math.round(pad + shield.y * H - size * 0.36));
  const hat = await sharp(hatSVG(size)).png().toBuffer();
  const base = await img.extend({ top: pad, bottom: 0, left: 0, right: 0, background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer();
  return sharp(base).composite([{ input: hat, left, top }]).png().toBuffer();
}

for (const s of SOURCES) {
  for (const [theme, make] of [
    ['neon', neon],
    ['noel', noel],
  ]) {
    const buf = await make(s);
    for (const w of s.widths) {
      const file = path.join(brand, `${s.name}-${theme}-${w}.webp`);
      await sharp(buf).resize({ width: w }).webp({ quality: 90, alphaQuality: 100 }).toFile(file);
      console.log('wrote', path.relative(root, file));
    }
  }
}
