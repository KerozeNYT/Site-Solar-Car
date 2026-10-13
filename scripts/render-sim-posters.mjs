// Renders the poster image of each service-page simulator from the live 3D viewer (shown
// before the 3D loads, and to visitors without WebGL). Requires a build in dist/.
// Usage: node scripts/render-sim-posters.mjs [kind ...]
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import { serve } from './serve.mjs';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const out = path.join(root, 'public/stills');
fs.mkdirSync(out, { recursive: true });
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');

// page, then what to set before the shot
const POSTERS = {
  tint: { slug: 'vitres-teintees', setup: async (p) => p.locator('input[name="rearShade"][value="5"]').check({ force: true }) },
  lights: {
    slug: 'feux-arriere-teintes',
    setup: async (p) => {
      await p.locator('input[name="rearShade"][value="80"]').check({ force: true });
      await p.locator('input[name="lightsOn"][value="brake"]').check({ force: true });
      await p.evaluate(() => window.__sim.viewer.setView('34arriere', { instant: true }));
    },
  },
  headlights: { slug: 'renovation-phares' },
  starlight: {
    slug: 'ciel-etoile',
    setup: async (p) => {
      await p.locator('input[name="opt"][value="shooting"]').check({ force: true });
    },
  },
  detailing: {
    slug: 'detailing-carrosserie',
    setup: async (p) => p.evaluate(() => window.__sim.sim.preview('polish', 0.55)),
  },
  // default complete wrap plus a chrome delete: both sides of the service in one picture
  covering: {
    slug: 'covering-dechromage',
    setup: async (p) => {
      await p.locator('input[name="dc-calandre"]').check({ force: true });
      await p.locator('input[name="dc-ouies"]').check({ force: true });
      await p.evaluate(() => window.__sim.viewer.setView('34avant', { instant: true }));
    },
  },
};

const server = await serve(path.join(root, 'dist'), 4611);
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const only = process.argv.slice(2);
for (const [kind, def] of Object.entries(POSTERS)) {
  if (only.length && !only.includes(kind)) continue;
  // 800 x 500 CSS px view at 2x = a 1600 x 1000 poster
  const page = await browser.newPage({ viewport: { width: 1360, height: 900 }, deviceScaleFactor: 2 });
  page.on('pageerror', (e) => console.error(kind, 'page error:', e.message));
  // posters show the desktop (high quality) scene, parked cars included, whatever this machine is
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'hardwareConcurrency', { get: () => 8 });
    Object.defineProperty(navigator, 'deviceMemory', { get: () => 8 });
  });
  await page.goto(`http://localhost:4611/${def.slug}/`);
  await page.addStyleTag({ content: '.sim__view > :not(canvas){display:none!important} .sim__view{width:800px!important;aspect-ratio:16/10!important}' });
  await page.evaluate(() => document.querySelector('#simulateur').scrollIntoView({ block: 'start' }));
  await page.waitForSelector('.sim.is-ready', { timeout: 300000 });
  if (def.setup) await def.setup(page);
  await page.evaluate(() => window.__sim.viewer.scenery);
  await page.waitForTimeout(4000);
  // clip instead of an element shot: no wait for "stable" frames (slow in software rendering)
  const clip = await page.locator('[data-sim-view]').boundingBox();
  const png = await page.screenshot({ type: 'png', clip, timeout: 180000 });
  await sharp(png).resize(1600, 1000, { fit: 'cover' }).webp({ quality: 80 }).toFile(path.join(out, `sim-${kind}-1600.webp`));
  await sharp(png).resize(960, 600, { fit: 'cover' }).webp({ quality: 78 }).toFile(path.join(out, `sim-${kind}-960.webp`));
  console.log('poster', kind);
  await page.close();
}
await browser.close();
server.close();
