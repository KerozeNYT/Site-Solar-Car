// Renders the six window shades (5 to 70 % of light) from the site's 3D tint simulator, for the
// partnership file of the workshop's space (booking/pro-sheet.js): booking/assets/teinte-<n>.jpg.
// Requires a build in dist/. Usage: node scripts/render-tint-shades.mjs
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import { serve } from './serve.mjs';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const out = path.join(root, 'booking/assets');
const pw = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const { chromium } = pw.chromium ? pw : pw.default;
const server = await serve(path.join(root, 'dist'), 4612);
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1360, height: 900 }, deviceScaleFactor: 1.5 });
page.on('pageerror', (e) => console.error('page error:', e.message));
await page.addInitScript(() => {
  Object.defineProperty(navigator, 'hardwareConcurrency', { get: () => 8 });
  Object.defineProperty(navigator, 'deviceMemory', { get: () => 8 });
});
await page.goto('http://localhost:4612/vitres-teintees/#simulateur-3d');
await page.addStyleTag({ content: '.sim__view > :not(canvas){display:none!important} .sim__view{width:800px!important;aspect-ratio:16/10!important}' });
await page.evaluate(() => document.querySelector('#simulateur-3d, #simulateur')?.scrollIntoView({ block: 'start' }));
await page.waitForSelector('.sim.is-ready', { timeout: 600000 });
await page.evaluate(() => window.__sim.viewer.setView('34arriere', { instant: true }));
await page.evaluate(() => window.__sim.viewer.scenery);
for (const n of [5, 15, 25, 35, 50, 70]) {
  await page.locator(`input[name="rearShade"][value="${n}"]`).check({ force: true });
  await page.locator(`input[name="frontShade"][value="${n}"]`).check({ force: true });
  await page.waitForTimeout(3500);
  const clip = await page.locator('[data-sim-view]').boundingBox();
  const png = await page.screenshot({ type: 'png', clip, timeout: 180000 });
  await sharp(png).resize(720, 450, { fit: 'cover' }).jpeg({ quality: 80, mozjpeg: true }).toFile(path.join(out, `teinte-${n}.jpg`));
  console.log('teinte', n);
}
await browser.close();
server.close();
