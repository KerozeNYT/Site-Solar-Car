// Home-screen icon proposals for the « Espace atelier » (the workshop's web app, /atelier). Today
// its icon (booking/assets/icone-512.png) is the shield alone, the same image as the CRM's; each
// proposal keeps the brand (deep black, the shield's gold, ivory) but says « atelier » at a glance.
// Nothing of the official mark is redrawn: the shield (public/img/brand/embleme-512.png) is placed
// as is, only scaled; the tile, the word, the gear and the tool badge are drawn here.
//   A: black tile, the shield above a gold plate reading ATELIER
//   B: inverted tile, gold, the shield on a black gear (the workshop sign)
//   C: black tile, the shield with a gold badge holding a squeegee (the window-film tool)
// Every important shape stays inside the circle of 80 % diameter (Android « maskable » safe zone),
// so the icons survive both the iOS rounded square and an Android circle.
// Outputs (design/logo/atelier/): proposition-{a,b,c}-{512,180}.png, opaque, and apercu.png, the
// comparison sheet (current icon and the proposals at 180, 120 and 60 px on a phone wallpaper).
// Usage: node scripts/logo-atelier.mjs
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import sharp from 'sharp';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const out = path.join(root, 'design/logo/atelier');
fs.mkdirSync(out, { recursive: true });

async function loadPlaywright() {
  if (process.env.PLAYWRIGHT_MODULE) return import(process.env.PLAYWRIGHT_MODULE);
  try {
    return await import('playwright');
  } catch {
    // installed globally (NODE_PATH): only require() looks there
    return createRequire(import.meta.url)('playwright');
  }
}

const dataUri = (rel, mime) => `data:${mime};base64,${fs.readFileSync(path.join(root, rel)).toString('base64')}`;
const SHIELD = dataUri('public/img/brand/embleme-512.png', 'image/png');
const SHIELD_RATIO = 512 / 616; // width / height of the emblem file
const CURRENT = dataUri('booking/assets/icone-512.png', 'image/png');
const FONTS = `
@font-face { font-family: 'Archivo'; font-weight: 100 900; font-stretch: 62% 125%;
  src: url(${dataUri('node_modules/@fontsource-variable/archivo/files/archivo-latin-wdth-normal.woff2', 'font/woff2')}) format('woff2-variations'); }
@font-face { font-family: 'Geist'; font-weight: 100 900;
  src: url(${dataUri('node_modules/@fontsource-variable/geist/files/geist-latin-wght-normal.woff2', 'font/woff2')}) format('woff2-variations'); }`;

// brand colours (src/styles/main.css)
const C = {
  black: '#07080a',
  black2: '#0b0c0f',
  gold: '#e3c27a',
  goldLight: '#f1dca2',
  ivory: '#f3f0ea',
};

/** the shield, unaltered, centred on cx with its top at y and the given height */
function shield(cx, top, h) {
  const w = h * SHIELD_RATIO;
  return `<image href="${SHIELD}" x="${(cx - w / 2).toFixed(2)}" y="${top}" width="${w.toFixed(2)}" height="${h}" preserveAspectRatio="none"/>`;
}

/** a word whose INK box is centred on (cx, cy): placed in the page by fitText() below */
const word = (text, { cx, cy, size, weight = 800, stretch = 'normal', ls = 0, fill }) =>
  `<text class="fit" data-cx="${cx}" data-cy="${cy}" data-size="${size}" data-weight="${weight}" data-stretch="${stretch}" data-ls="${ls}" fill="${fill}">${text}</text>`;

// the dark tile of the current icon: near black, a warm glow behind the shield
const darkTile = (cy = '36%') => `
  <radialGradient id="tile" cx="50%" cy="${cy}" r="72%">
    <stop offset="0" stop-color="#1d1b16"/><stop offset=".5" stop-color="#0e0e0f"/><stop offset="1" stop-color="${C.black}"/>
  </radialGradient>`;

// polished gold, lit in the middle like the shield's bevel; flat enough to stay clean when small
const goldBar = (id) => `
  <linearGradient id="${id}" x1="0" y1="0" x2="1" y2="0">
    <stop offset="0" stop-color="#c9963f"/><stop offset=".28" stop-color="${C.gold}"/><stop offset=".5" stop-color="#f6e6b4"/>
    <stop offset=".72" stop-color="${C.gold}"/><stop offset="1" stop-color="#c9963f"/>
  </linearGradient>`;

/** a gear: `teeth` trapezoid teeth between rIn and rOut, one tooth pointing up */
function gear(cx, cy, rOut, rIn, teeth, { top = 0.42, base = 0.56 } = {}) {
  const per = (Math.PI * 2) / teeth;
  const p = (r, a) => `${(cx + r * Math.cos(a)).toFixed(2)} ${(cy + r * Math.sin(a)).toFixed(2)}`;
  let d = '';
  for (let i = 0; i < teeth; i++) {
    const c = -Math.PI / 2 + i * per;
    const b0 = c - (per * base) / 2;
    const b1 = c + (per * base) / 2;
    const t0 = c - (per * top) / 2;
    const t1 = c + (per * top) / 2;
    d += `${i ? 'L' : 'M'}${p(rIn, b0)} L${p(rOut, t0)} A${rOut} ${rOut} 0 0 1 ${p(rOut, t1)} L${p(rIn, b1)} `;
    d += `A${rIn} ${rIn} 0 0 1 ${p(rIn, c + per - (per * base) / 2)} `;
  }
  return d + 'Z';
}

/** a window squeegee (raclette), drawn in a 110-unit box centred on 0,0, blade down */
const squeegee = (fill) => `
  <rect x="-8" y="-60" width="16" height="72" rx="8" fill="${fill}"/>
  <rect x="-52" y="6" width="104" height="19" rx="5" fill="${fill}"/>
  <rect x="-48" y="30" width="96" height="8" rx="4" fill="${fill}"/>`;

const PROPOSALS = {
  // A — the plate: the shield as on the CRM, smaller, above a gold nameplate that says ATELIER
  a: () => `
    <defs>${darkTile('30%')}${goldBar('plate')}</defs>
    <rect width="512" height="512" fill="url(#tile)"/>
    ${shield(256, 98, 192)}
    <rect x="106" y="312" width="300" height="92" rx="16" fill="url(#plate)"/>
    ${word('ATELIER', { cx: 256, cy: 358, size: 63, weight: 800, stretch: 'semi-condensed', ls: 2, fill: C.black })}`,

  // B — the inverted tile: gold ground, the shield on a black gear
  b: () => `
    <defs>
      <linearGradient id="ground" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="#f5e3ad"/><stop offset=".55" stop-color="${C.gold}"/><stop offset="1" stop-color="#c99a4c"/>
      </linearGradient>
      <filter id="lift" x="-20%" y="-20%" width="140%" height="140%"><feDropShadow dx="0" dy="6" stdDeviation="8" flood-color="#3a2508" flood-opacity=".35"/></filter>
    </defs>
    <rect width="512" height="512" fill="url(#ground)"/>
    <path d="${gear(256, 256, 196, 164, 10)}" fill="${C.black2}" stroke="${C.black2}" stroke-width="8" stroke-linejoin="round" filter="url(#lift)"/>
    ${shield(256, 134, 248)}`,

  // C — the badge: the shield, and a gold badge with the squeegee, like an app variant
  c: () => `
    <defs>${darkTile('34%')}
      <linearGradient id="badge" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="${C.goldLight}"/><stop offset=".55" stop-color="${C.gold}"/><stop offset="1" stop-color="#cfa257"/>
      </linearGradient>
    </defs>
    <rect width="512" height="512" fill="url(#tile)"/>
    ${shield(192, 98, 236)}
    <circle cx="336.6" cy="336.6" r="90" fill="url(#badge)"/>
    <g transform="translate(336.6 336.6) rotate(-40) scale(1.12)">${squeegee(C.black)}</g>`,
};

// places every .fit word: ink box measured on a canvas with the same font, centred on (cx, cy)
async function fitText() {
  const ctx = document.createElement('canvas').getContext('2d');
  for (const t of document.querySelectorAll('text.fit')) {
    const { cx, cy, size, weight, stretch, ls } = t.dataset;
    // nothing uses the font before this: load that very instance, or the canvas measures a fallback
    await document.fonts.load(`${weight} ${stretch} ${size}px Archivo`, t.textContent);
    ctx.font = `${weight} ${size}px Archivo`;
    ctx.fontStretch = stretch;
    ctx.letterSpacing = `${ls}px`;
    const m = ctx.measureText(t.textContent);
    const left = -m.actualBoundingBoxLeft;
    const right = m.actualBoundingBoxRight;
    Object.assign(t.style, { fontFamily: 'Archivo', fontWeight: weight, fontSize: `${size}px`, fontStretch: stretch, letterSpacing: `${ls}px` });
    t.setAttribute('x', (+cx - (left + right) / 2).toFixed(2));
    t.setAttribute('y', (+cy + (m.actualBoundingBoxAscent - m.actualBoundingBoxDescent) / 2).toFixed(2));
  }
}

const iconPage = (svg, size) => `<!doctype html><html><head><meta charset="utf-8"><style>${FONTS}
  html, body { margin: 0; background: ${C.black}; }
  svg { display: block; }
</style></head><body><svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 512 512">${svg}</svg></body></html>`;

async function renderIcon(page, svg, size) {
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(iconPage(svg, size));
  await page.evaluate(`(${fitText})()`);
  await page.evaluate(() => document.fonts.ready);
  const png = await page.screenshot({ type: 'png', clip: { x: 0, y: 0, width: size, height: size } });
  // opaque RGB file: the tile is full-bleed, the alpha channel only adds weight
  return sharp(png).flatten({ background: C.black }).removeAlpha().png({ compressionLevel: 9 }).toBuffer();
}

// the comparison sheet: a dark phone wallpaper, each icon at 180, 120 and 60 px, iOS corners
function sheetPage(icons) {
  const SIZES = [180, 120, 60];
  const col = (label, src) => `
    <div class="col">${SIZES.map((s) => `
      <figure style="--s:${s}px"><img src="${src}" width="${s}" height="${s}" alt=""><figcaption>${label}</figcaption></figure>`).join('')}
    </div>`;
  return `<!doctype html><html><head><meta charset="utf-8"><style>${FONTS}
    html, body { margin: 0; }
    body {
      width: 1120px; padding: 44px 48px 52px; box-sizing: border-box;
      font-family: 'Geist', system-ui, sans-serif; color: ${C.ivory};
      background:
        radial-gradient(60% 50% at 18% 12%, rgba(84, 70, 140, .38), transparent 70%),
        radial-gradient(55% 45% at 88% 78%, rgba(30, 86, 120, .32), transparent 70%),
        linear-gradient(160deg, #161a26, #0c0e15 60%, #08090d);
    }
    h1 { margin: 0 0 4px 148px; font-size: 20px; font-weight: 600; letter-spacing: .01em; }
    p { margin: 0 0 30px 148px; font-size: 14px; color: rgba(243, 240, 234, .62); }
    .grid { display: grid; grid-template-columns: 100px repeat(4, 1fr); column-gap: 12px; }
    .rows { display: grid; grid-template-rows: 236px 176px 116px; }
    .rows span { align-self: start; padding-top: calc(var(--s) / 2 - 8px); font-size: 13px; color: rgba(243, 240, 234, .5); text-align: right; padding-right: 8px; }
    .col { display: grid; grid-template-rows: 236px 176px 116px; justify-items: center; }
    .col.current { border-right: 1px solid rgba(243, 240, 234, .14); }
    figure { margin: 0; display: flex; flex-direction: column; align-items: center; }
    img { display: block; border-radius: 22.37%; box-shadow: 0 6px 18px rgba(0, 0, 0, .35); }
    figcaption { margin-top: 9px; font-size: 13px; font-weight: 500; letter-spacing: .01em; }
  </style></head><body>
    <h1>Espace atelier — icône d'écran d'accueil</h1>
    <p>L'icône actuelle (la même que le CRM) et les trois propositions, à 180, 120 et 60 px.</p>
    <div class="grid">
      <div class="rows"><span style="--s:180px">180 px</span><span style="--s:120px">120 px</span><span style="--s:60px">60 px</span></div>
      ${icons.map(([label, src], i) => col(label, src).replace('class="col"', `class="col${i === 0 ? ' current' : ''}"`)).join('')}
    </div>
  </body></html>`;
}

const { chromium } = await loadPlaywright();
const browser = await chromium.launch();
const page = await browser.newPage({ deviceScaleFactor: 1 });
const icons = [['Actuelle', CURRENT]];
for (const [id, build] of Object.entries(PROPOSALS)) {
  for (const size of [512, 180]) {
    const png = await renderIcon(page, build(), size);
    fs.writeFileSync(path.join(out, `proposition-${id}-${size}.png`), png);
    if (size === 512) icons.push([id.toUpperCase(), `data:image/png;base64,${png.toString('base64')}`]);
  }
  console.log('proposition', id);
}
const sheet = await browser.newPage({ viewport: { width: 1120, height: 800 }, deviceScaleFactor: 2 });
await sheet.setContent(sheetPage(icons));
await sheet.evaluate(() => document.fonts.ready);
await sheet.evaluate(() => Promise.all([...document.images].map((i) => i.decode())));
await sheet.setViewportSize({ width: 1120, height: await sheet.evaluate(() => document.body.scrollHeight) });
await sheet.screenshot({ path: path.join(out, 'apercu.png') });
console.log('apercu.png');
await browser.close();
