// The pictures of the gift card and of SOLAR CAR Premium, drawn by the site's own CSS (the 3D
// cards of src/templates/pages.js, styles « 3D cards » of src/styles/main.css):
//   public/img/cartes/cadeau-or.jpg, cadeau-carbone.jpg, cadeau-noel.jpg, premium.jpg
//       1200 × 756, the face WITHOUT any text, logo or chip: the e-mails (booking/mail.js) put
//       their own text over it (HTML), so the left and the centre stay calm; square corners (the
//       e-mail rounds them)
//   public/img/cartes/og-cadeau.jpg, og-premium.jpg
//       1200 × 630, the share images of /carte-cadeau/ and /premium/
//   public/img/cartes/premium-icon-512.png, -192.png, -180.png
//       the icons of « Mon espace Premium » on a phone's home screen (/premium/manifest.webmanifest)
//
// Run after a build (it reads dist/): npm run build && node scripts/cartes.mjs && npm run build
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { serve } from './serve.mjs';
import { giftCard, premium } from '../content/offers.js';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const dist = path.join(root, 'dist');
const out = path.join(root, 'public', 'img', 'cartes');
const PORT = 4621;
if (!fs.existsSync(path.join(dist, 'carte-cadeau', 'index.html'))) throw new Error('Run « npm run build » first: this script reads dist/.');
fs.mkdirSync(out, { recursive: true });

// the cards' markup and the style sheet, from the built gift card page
const html = fs.readFileSync(path.join(dist, 'carte-cadeau', 'index.html'), 'utf8');
const css = html.match(/<link rel="stylesheet" href="([^"]+)">/)[1];
const giftMarkup = html.match(/<div class="card3d card3d--gift[\s\S]*?<\/div><\/div>\s*<\/div>/)[0];
const premiumHtml = fs.readFileSync(path.join(dist, 'premium', 'index.html'), 'utf8');
const premiumMarkup = premiumHtml.match(/<div class="card3d card3d--premium[\s\S]*?<\/div><\/div>\s*<\/div>/)[0];
const fontLinks = [...html.matchAll(/<link rel="preload" href="([^"]+\.woff2)"[^>]*>/g)].map((m) => m[0]).join('');

const page = (body, extra = '') => `<!doctype html><html lang="fr"><head><meta charset="utf-8">${fontLinks}<link rel="stylesheet" href="${css}"><style>
html,body{margin:0;background:#07080a}
body{font-family:var(--font)}
.blank .card3d__face>*:not(.card3d__pattern):not(.card3d__ribbon):not(.card3d__seal){display:none!important}
.blank .card3d__face{border-radius:0;box-shadow:inset 0 0 0 0.24cqw var(--card-rim)}
.blank .card3d::before{display:none}
.blank .card3d__face--back{display:none}
${extra}</style></head><body>${body}</body></html>`;

const face = (markup, cls = '') => `<div class="blank" style="width:1200px">${markup.replace(/^<div class="card3d /, `<div style="width:1200px" class="card3d ${cls} `)}</div>`;
const files = {
  'cadeau-or': face(giftMarkup.replace(/card3d--look-\w+/, 'card3d--look-or')),
  'cadeau-carbone': face(giftMarkup.replace(/card3d--look-\w+/, 'card3d--look-carbone')),
  'cadeau-noel': face(giftMarkup.replace(/card3d--look-\w+/, 'card3d--look-noel')),
  premium: face(premiumMarkup).replace(/<span class="card3d__neon"[^>]*><\/span>/, ''),
};

// the share images: the card leaning over a dark stage, a title in the site's type
const og = (markup, kicker, title, text, glow) =>
  page(
    `<div class="og"><div class="og__text"><p class="kicker">${kicker}</p><h1>${title}</h1><p class="og__lead">${text}</p><img class="og__logo" src="/img/brand/logo-horizontal-clair-400.webp" alt=""></div><div class="og__card">${markup}</div></div>`,
    `.og{position:relative;width:1200px;height:630px;display:grid;grid-template-columns:1fr 600px;align-items:center;gap:20px;padding:0 0 0 72px;box-sizing:border-box;overflow:hidden;background:radial-gradient(60% 80% at 75% 50%,${glow},rgba(0,0,0,0) 70%),linear-gradient(160deg,#0c0d10,#050506)}
.og h1{margin:0 0 18px;font-size:76px;line-height:.98;letter-spacing:-.04em;color:#f3f0ea}
.og h1 em{font-family:var(--font-serif);font-style:italic;font-weight:400;color:#e3c27a}
.og .kicker{color:#e3c27a}
.og__lead{margin:0;max-width:430px;color:#c7c3ba;font-size:24px;line-height:1.4}
.og__logo{position:absolute;left:72px;bottom:44px;width:170px}
.og__card{perspective:1600px}
.og__card .card3d{width:540px;--rx:9deg;--ry:-20deg;--lx:30%;--ly:20%;--tx:-.8}
.og__card .card3d-flip{display:none}`
  );
const tierTurbo = premium.tiers.find((t) => t.id === 'turbo') || premium.tiers[1];
const ogGift = og(
  giftMarkup.replace('data-c="to" data-empty="Vous ?">Vous ?', 'data-c="to" data-empty="Vous ?">Julie').replace(/(data-c="amount" data-len=")\d+(">)[^<]+/, '$13$2150'),
  'Carte cadeau',
  'Offrez une voiture <em>sublimée</em>',
  `Sur toutes nos prestations, valable ${giftCard.months} mois, imprimable ou envoyée le jour J.`,
  'rgba(227,194,122,.22)'
);
const ogPremium = og(
  premiumMarkup.replace(/data-tier="\w+" style="--lvl:[^"]+"/, `data-tier="${tierTurbo.id}" style="--lvl:${tierTurbo.color}"`).replace(/(data-c="tier">)[^<]+/, `$1${tierTurbo.label}`).replace(/(data-c="name" data-empty="Votre nom">)[^<]+/, '$1Alex Martin').replace(/(data-c="number">)[^<]+/, '$1PREMIUM-4F7K-2QXM').replace(/(data-c="since" data-empty="··\/··">)[^<]+/, '$111/26').replace(/(data-c="until" data-empty="··\/··">)[^<]+/, '$111/27'),
  premium.name,
  'Le club de ceux qui <em>reviennent</em>',
  `−${premium.percent} % toute l’année, les offres des membres et un cadeau à chaque prestation.`,
  `${tierTurbo.color}33`
);

// the app icon: the crest on black metal, ringed by the levels' neons
const ring = premium.tiers.map((t) => t.color).join(',');
const icon = (size) =>
  page(
    `<div class="ic"><img src="/img/brand/embleme-512.webp" alt=""></div>`,
    `.ic{width:${size}px;height:${size}px;display:grid;place-items:center;background:radial-gradient(60% 60% at 50% 40%,#1d1e21,#050506 75%);position:relative;overflow:hidden}
.ic::before{content:'';position:absolute;inset:${Math.round(size * 0.13)}px;border-radius:50%;background:conic-gradient(from 200deg,${ring},${premium.tiers[0].color});-webkit-mask:radial-gradient(closest-side,transparent calc(100% - ${Math.max(2, Math.round(size * 0.012))}px),#000 calc(100% - ${Math.max(2, Math.round(size * 0.012))}px));mask:radial-gradient(closest-side,transparent calc(100% - ${Math.max(2, Math.round(size * 0.012))}px),#000 calc(100% - ${Math.max(2, Math.round(size * 0.012))}px));filter:drop-shadow(0 0 ${Math.round(size * 0.03)}px rgba(255,255,255,.35))}
.ic img{width:${Math.round(size * 0.4)}px;height:auto;position:relative;filter:drop-shadow(0 ${Math.round(size * 0.02)}px ${Math.round(size * 0.03)}px rgba(0,0,0,.8))}`
  );

const tmp = path.join(dist, '__cartes');
fs.mkdirSync(tmp, { recursive: true });
const server = await serve(dist, PORT);
const { chromium } = createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE || 'playwright');
const browser = await chromium.launch();
try {
  const shot = async (name, doc, { width, height, selector, type = 'jpeg', quality = 82 }) => {
    fs.writeFileSync(path.join(tmp, `${name}.html`), doc);
    const p = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 1 });
    await p.goto(`http://localhost:${PORT}/__cartes/${name}.html`, { waitUntil: 'networkidle' });
    await p.evaluate(() => document.fonts.ready);
    const target = selector ? p.locator(selector).first() : p;
    const file = path.join(out, `${name}.${type === 'png' ? 'png' : 'jpg'}`);
    await target.screenshot({ path: file, type, ...(type === 'jpeg' ? { quality } : {}) });
    await p.close();
    console.log(path.relative(root, file), `${(fs.statSync(file).size / 1024).toFixed(0)} KB`);
  };
  for (const [name, body] of Object.entries(files)) await shot(name, page(body), { width: 1200, height: 800, selector: '.card3d__face--front' });
  await shot('og-cadeau', ogGift, { width: 1200, height: 630 });
  await shot('og-premium', ogPremium, { width: 1200, height: 630 });
  for (const size of [512, 192, 180]) await shot(`premium-icon-${size}`, icon(size), { width: size, height: size, type: 'png' });
} finally {
  await browser.close();
  server.close();
  fs.rmSync(tmp, { recursive: true, force: true });
}
