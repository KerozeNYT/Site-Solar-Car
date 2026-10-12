// Derives web assets from the official logo (design/logo/official/solar-car-logo-officiel.png).
// Nothing is redrawn: the shield, the wordmark and their colours are cropped and arranged only.
import path from 'node:path';
import fs from 'node:fs';
import sharp from 'sharp';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const src = path.join(root, 'design/logo/official/solar-car-logo-officiel.png');
const pub = path.join(root, 'public');
const out = path.join(root, 'design/logo');
fs.mkdirSync(path.join(pub, 'img/brand'), { recursive: true });

// regions measured on the official file (1233 x 1328, transparent background)
const SHIELD = { left: 296, top: 0, width: 642, height: 772 };
const WORD = { left: 0, top: 861, width: 1233, height: 467 };
const NAVY = '#07111f';

const shield = await sharp(src).extract(SHIELD).png().toBuffer();
const word = await sharp(src).extract(WORD).png().toBuffer();

async function save(buf, name, widths, { webp = true, png = true } = {}) {
  for (const w of widths) {
    const img = sharp(buf).resize({ width: w });
    if (png) await img.clone().png({ compressionLevel: 9 }).toFile(path.join(pub, 'img/brand', `${name}-${w}.png`));
    if (webp) await img.clone().webp({ quality: 90, alphaQuality: 100 }).toFile(path.join(pub, 'img/brand', `${name}-${w}.webp`));
  }
}

// 1. official stacked logo, trimmed
const stacked = await sharp(src).trim().png().toBuffer();
await save(stacked, 'logo-officiel', [240, 480, 960]);
// 2. emblem (shield)
await save(shield, 'embleme', [64, 128, 256, 512]);
// 3. horizontal lockup: shield + two-line wordmark, side by side
const H = 400;
const sh = await sharp(shield).resize({ height: H }).toBuffer();
const shMeta = await sharp(sh).metadata();
const wh = Math.round(H * 0.62);
const wd = await sharp(word).resize({ height: wh }).toBuffer();
const wdMeta = await sharp(wd).metadata();
const gap = Math.round(H * 0.12);
const lockW = shMeta.width + gap + wdMeta.width;
const lockup = await sharp({ create: { width: lockW, height: H, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
  .composite([
    { input: sh, left: 0, top: 0 },
    { input: wd, left: shMeta.width + gap, top: Math.round((H - wh) / 2) },
  ])
  .png()
  .toBuffer();
fs.writeFileSync(path.join(out, 'solar-car-lockup-horizontal.png'), lockup);
await save(lockup, 'logo-horizontal', [200, 400, 800]);
console.log('lockup ratio', (lockW / H).toFixed(3));

// 4. icons: emblem on transparent (tab) and on navy (touch / manifest)
const pad = (buf, size, bg) =>
  sharp(buf)
    .resize({ height: Math.round(size * 0.84), width: Math.round(size * 0.84), fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .extend({
      top: Math.round(size * 0.08),
      bottom: size - Math.round(size * 0.84) - Math.round(size * 0.08),
      left: Math.round(size * 0.08),
      right: size - Math.round(size * 0.84) - Math.round(size * 0.08),
      background: bg || { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .png();
await (await pad(shield, 32)).toFile(path.join(pub, 'favicon-32.png'));
await (await pad(shield, 48)).toFile(path.join(pub, 'favicon-48.png'));
for (const [name, size] of [
  ['apple-touch-icon.png', 180],
  ['icon-192.png', 192],
  ['icon-512.png', 512],
]) {
  await (await pad(shield, size, NAVY)).toFile(path.join(pub, name));
}
// classic favicon.ico (PNG-in-ICO, 32px) for crawlers that request /favicon.ico
const ico32 = await (await pad(shield, 32)).toBuffer();
const header = Buffer.alloc(22);
header.writeUInt16LE(0, 0);
header.writeUInt16LE(1, 2);
header.writeUInt16LE(1, 4);
header.writeUInt8(32, 6);
header.writeUInt8(32, 7);
header.writeUInt8(0, 8);
header.writeUInt8(0, 9);
header.writeUInt16LE(1, 10);
header.writeUInt16LE(32, 12);
header.writeUInt32LE(ico32.length, 14);
header.writeUInt32LE(22, 18);
fs.writeFileSync(path.join(pub, 'favicon.ico'), Buffer.concat([header, ico32]));

// 5. studio sign texture: official logo on a white backlit panel
const signW = 2048;
const signH = 640;
const signLogo = await sharp(lockup).resize({ height: Math.round(signH * 0.72) }).toBuffer();
const sl = await sharp(signLogo).metadata();
await sharp({ create: { width: signW, height: signH, channels: 4, background: '#ffffff' } })
  .composite([{ input: signLogo, left: Math.round((signW - sl.width) / 2), top: Math.round((signH - sl.height) / 2) }])
  .webp({ quality: 88 })
  .toFile(path.join(pub, 'img/brand/enseigne.webp'));
console.log('brand assets written');
