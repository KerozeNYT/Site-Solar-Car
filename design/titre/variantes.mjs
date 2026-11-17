// Maquettes du grand titre de l'accueil (« SOLAR CAR 37 ») : chaque piste de variantes.css est
// injectée dans la page construite (dist/), sans rien changer au site, puis photographiée sur
// ordinateur (1440 × 900, ×2) et sur iPhone 13 ; enfin deux planches comparatives.
//
//   node scripts/serve.mjs dist 4180        (dans un autre terminal ; dist/ construit par npm run build)
//   node design/titre/variantes.mjs                  tout : Actuel + chaque piste, saisons, planches
//   node design/titre/variantes.mjs actuel a c       seulement ces images (sans planches ni saisons)
//   node design/titre/variantes.mjs --planches       seulement les planches, depuis les PNG existants
//   node design/titre/variantes.mjs --saisons=c      la piste c en looks néon et Noël
//
// Le look normal : ?apercu-theme=aucun revient aux dates, et le look néon commence le 17 novembre ;
// pour photographier le noir et or habituel quel que soit le jour, la page est ouverte avec un nom
// de look qui n'existe pas (?apercu-theme=normal), ce qui n'applique aucun look saisonnier.
import { createRequire } from 'node:module';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

// playwright est installé globalement (hors du projet) : require le trouve, import non
const { chromium, devices } = createRequire(import.meta.url)('playwright');

const DIR = path.dirname(fileURLToPath(import.meta.url));
const BASE = process.env.BASE_URL || 'http://localhost:4180/';
const FAVORITE = 'a'; // la piste montrée aussi en néon et en Noël par défaut

// Les pistes : leurs CSS sont lus dans variantes.css, entre « @variante X » et « @fin X ».
const css = fs.readFileSync(path.join(DIR, 'variantes.css'), 'utf8');
const VARIANTS = {};
for (const m of css.matchAll(/\/\* @variante ([A-Z]) — « ([^»]+) »[\s\S]*?\/\* @fin \1 \*\//g)) {
  VARIANTS[m[1].toLowerCase()] = { id: m[1], name: m[2].trim(), css: m[0] };
}
// Le contenu du <span class="chapter__brand"> quand une piste a besoin de séparer « 37 » :
// même texte (« SOLAR CAR 37 »), donc même titre pour les lecteurs d'écran et les moteurs.
const SPLIT = '<span class="titre-nom">SOLAR CAR</span> <span class="titre-37">37</span>';
const MARKUP = { b: SPLIT, c: SPLIT, e: SPLIT, f: SPLIT };

const SIZES = {
  ordi: { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 },
  tel: { ...devices['iPhone 13'] }, // 390 × 664, ×3 (rendu Chromium : seul navigateur installé)
};

const args = process.argv.slice(2);
const onlyPlanches = args.includes('--planches');
const seasonArg = args.find((a) => a.startsWith('--saisons'));
const picked = args.filter((a) => !a.startsWith('--')).map((a) => a.toLowerCase());
const ids = picked.length ? picked : ['actuel', ...Object.keys(VARIANTS)];
const seasonsFor = seasonArg ? seasonArg.split('=')[1] || FAVORITE : picked.length ? null : FAVORITE;

const file = (id, size, theme) => path.join(DIR, id === 'actuel' ? `actuel${theme ? `-${theme}` : ''}-${size}.png` : `variante-${id}${theme ? `-${theme}` : ''}-${size}.png`);

async function shoot(browser, id, size, theme = null) {
  const ctx = await browser.newContext({ ...SIZES[size], reducedMotion: 'no-preference' });
  const page = await ctx.newPage();
  await page.goto(`${BASE}?apercu-theme=${theme || 'normal'}`, { waitUntil: 'load' });
  await page.evaluate(() => document.fonts.ready);
  const v = VARIANTS[id];
  if (v) {
    if (MARKUP[id]) {
      await page.evaluate((html) => {
        const el = document.querySelector('.chapter__title--brand .chapter__brand');
        const before = el.textContent;
        el.innerHTML = html;
        if (el.textContent !== before) throw new Error(`texte changé : ${el.textContent}`);
      }, MARKUP[id]);
    }
    await page.addStyleTag({ content: v.css });
  }
  await page.waitForTimeout(400);
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(3000); // les polices, la vidéo du héros et l'allumage (piste C) se posent
  const info = await page.evaluate(() => {
    const h = document.querySelector('.chapter__title--brand');
    const b = h.querySelector('.chapter__brand').getBoundingClientRect();
    const copy = h.closest('.chapter__copy').getBoundingClientRect();
    return { saison: document.documentElement.dataset.saison || '-', brand: [b.x, b.y, b.width, b.height].map(Math.round), copyTop: Math.round(copy.top), vw: innerWidth };
  });
  const aria = await page.getByRole('heading', { level: 1 }).ariaSnapshot();
  await page.screenshot({ path: file(id, size, theme) });
  // le reflet de la piste A, photographié en plein passage
  if (id === 'a' && !theme && size === 'ordi') {
    await page.evaluate(() => {
      for (const a of document.getAnimations()) if (a.animationName === 'titre-or-reflet') { a.pause(); a.currentTime = 1000 + 9000 * 0.87; }
    });
    await page.waitForTimeout(200);
    await page.screenshot({ path: path.join(DIR, 'variante-a-reflet-ordi.png') });
  }
  console.log(`${id.padEnd(6)} ${size.padEnd(4)} ${(theme || 'normal').padEnd(6)} saison=${info.saison} titre=${JSON.stringify(info.brand)} haut-du-texte=${info.copyTop} | ${aria.split('\n')[0]}`);
  await ctx.close();
}

async function planche(browser, size) {
  const list = ['actuel', ...Object.keys(VARIANTS)].filter((id) => fs.existsSync(file(id, size)));
  const label = (id) => (id === 'actuel' ? '<b>Actuel</b>' : `<b>${VARIANTS[id].id}</b> ${VARIANTS[id].name}`);
  const src = (id) => pathToFileURL(file(id, size)).href;
  // ordinateur : la moitié gauche du héros (là où vit le titre), deux par ligne ; téléphone : l'écran entier, tous sur une ligne
  const cell =
    size === 'ordi'
      ? (id) => `<figure><figcaption>${label(id)}</figcaption><div class="crop"><img src="${src(id)}"></div></figure>`
      : (id) => `<figure><figcaption>${label(id)}</figcaption><img class="tel" src="${src(id)}"></figure>`;
  const html = `<!doctype html><meta charset="utf-8"><style>
    body{margin:0;padding:36px 40px 44px;background:#111216;color:#f3f0ea;font:16px/1.4 Geist,system-ui,sans-serif}
    h1{margin:0 0 6px;font-size:26px;font-weight:700;letter-spacing:-.01em} p{margin:0 0 26px;color:#9b978e}
    .grid{display:grid;gap:30px 28px;grid-template-columns:${size === 'ordi' ? 'repeat(2, 1000px)' : `repeat(${list.length}, 330px)`}}
    figure{margin:0} figcaption{margin:0 0 10px;font-size:20px;color:#c7c3ba} figcaption b{display:inline-block;min-width:1.4em;margin-right:.35em;color:#e3c27a;font-size:22px}
    .crop{width:1000px;height:625px;overflow:hidden;border-radius:10px;border:1px solid rgba(255,255,255,.12)}
    .crop img{display:block;width:1600px;margin:-75px 0 0 0}
    .tel{display:block;width:330px;border-radius:22px;border:1px solid rgba(255,255,255,.14)}
  </style><h1>SOLAR CAR 37 — pistes pour le titre de l’accueil</h1>
  <p>${size === 'ordi' ? 'Ordinateur 1440 × 900 · partie gauche du héros · look habituel (noir et or)' : 'iPhone 13 (390 × 664) · écran entier · look habituel (noir et or)'}</p>
  <div class="grid">${list.map(cell).join('')}</div>`;
  const tmp = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'planche-')), 'planche.html');
  fs.writeFileSync(tmp, html);
  const ctx = await browser.newContext({ viewport: { width: 800, height: 600 }, deviceScaleFactor: size === 'ordi' ? 1.25 : 2 });
  const page = await ctx.newPage();
  await page.goto(pathToFileURL(tmp).href);
  await page.evaluate(() => Promise.all([...document.images].map((i) => i.decode())));
  const out = path.join(DIR, size === 'ordi' ? 'planche.png' : 'planche-tel.png');
  await page.screenshot({ path: out, fullPage: true });
  console.log(`planche → ${path.relative(process.cwd(), out)} (${list.length} images)`);
  await ctx.close();
}

const browser = await chromium.launch();
try {
  if (!onlyPlanches) {
    for (const id of ids) {
      if (id !== 'actuel' && !VARIANTS[id]) throw new Error(`piste inconnue : ${id} (connues : ${Object.keys(VARIANTS).join(', ')})`);
      for (const size of Object.keys(SIZES)) await shoot(browser, id, size);
    }
    if (seasonsFor) for (const theme of ['neon', 'noel']) for (const size of Object.keys(SIZES)) await shoot(browser, seasonsFor, size, theme);
  }
  if (onlyPlanches || !picked.length) for (const size of Object.keys(SIZES)) await planche(browser, size);
} finally {
  await browser.close();
}
