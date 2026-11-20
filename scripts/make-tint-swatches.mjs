// The six window shades (5 to 70 % of light) for the partnership file (booking/pro-sheet.js): the
// site's 3D garage (public/img/film/hero-1600.jpg) seen through the side window of a white door,
// the glass darkened as much as the shade. booking/assets/teinte-<n>.jpg + booking/pdf-shades.js.
// When the 3D simulator can be rendered here, scripts/render-tint-shades.mjs takes its place.
import sharp from 'sharp';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const W = 720;
const H = 450;
const bg = await sharp(path.join(root, 'public/img/film/hero-1600.jpg')).resize(W, H, { fit: 'cover', position: 'centre' }).toBuffer();
// the window: a side glass with its slanted pillar, in a white door
const glass = 'M70 360 L120 120 Q140 70 210 62 L560 58 Q610 60 640 110 L690 250 L690 360 Z';
for (const n of [5, 15, 25, 35, 50, 70]) {
  const dark = ((100 - n) / 100) * 0.94;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
<defs><linearGradient id="door" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f7f8f9"/><stop offset="1" stop-color="#d9dde1"/></linearGradient>
<linearGradient id="sheen" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".16"/><stop offset=".45" stop-color="#fff" stop-opacity="0"/><stop offset="1" stop-color="#fff" stop-opacity=".05"/></linearGradient></defs>
<path fill="url(#door)" fill-rule="evenodd" d="M0 0H${W}V${H}H0Z ${glass}"/>
<path d="${glass}" fill="#05070a" fill-opacity="${dark.toFixed(3)}"/>
<path d="${glass}" fill="url(#sheen)"/>
<path d="${glass}" fill="none" stroke="#0b0c0f" stroke-width="10" stroke-linejoin="round"/>
<path d="M0 392H${W}" stroke="#c4c9ce" stroke-width="2"/>
</svg>`;
  await sharp(bg).composite([{ input: Buffer.from(svg) }]).jpeg({ quality: 80, mozjpeg: true }).toFile(path.join(root, `booking/assets/teinte-${n}.jpg`));
}
fs.writeFileSync(
  path.join(root, 'booking/pdf-shades.js'),
  `// The six window shades for the partnership file (booking/pro-sheet.js), made by
// scripts/make-tint-swatches.mjs: { 5: JPEG bytes, … } (booking/wrangler.toml imports *.jpg as data).
${[5, 15, 25, 35, 50, 70].map((n) => `import t${n} from './assets/teinte-${n}.jpg';`).join('\n')}

export const SHADES = { ${[5, 15, 25, 35, 50, 70].map((n) => `${n}: t${n}`).join(', ')} };
`
);
console.log('ok');
