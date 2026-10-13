// Renders the still image of the 3D access map (public/map/poster-*.webp): shown before the
// 3D starts and kept when WebGL is unavailable. Requires a build in dist/ (npm run build).
// Usage: node scripts/render-map-poster.mjs
import path from 'node:path';
import sharp from 'sharp';
import { serve } from './serve.mjs';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const out = path.join(root, 'public/map');
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const server = await serve(path.join(root, 'dist'), 4612);
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1200, height: 900 }, deviceScaleFactor: 2, reducedMotion: 'reduce' });
page.on('pageerror', (e) => console.error('page error:', e.message));
// full-quality scene whatever this machine is
await page.addInitScript(() => Object.defineProperty(navigator, 'hardwareConcurrency', { get: () => 8 }));
await page.goto('http://localhost:4612/atelier-vouvray/');
await page.addStyleTag({ content: '.visit__map{width:800px!important;height:550px!important;min-height:0!important;aspect-ratio:auto!important} .map3d__bar,.map3d__credit,.map3d__hint{display:none!important}' });
await page.evaluate(() => document.querySelector('[data-map]').scrollIntoView({ block: 'center' }));
await page.waitForSelector('[data-map].is-live', { timeout: 300000 });
await page.waitForTimeout(1500);
await page.evaluate(() => {
  window.__map3d.flyTo('overview', 0);
  window.__map3d.controls.update();
  window.__map3d.render();
});
await page.waitForTimeout(2500);
const box = await page.locator('[data-map]').boundingBox();
const png = await page.screenshot({ type: 'png', clip: box, timeout: 180000 });
await sharp(png).resize(1600, 1100, { fit: 'cover' }).webp({ quality: 80 }).toFile(path.join(out, 'poster-1600.webp'));
await sharp(png).resize(960, 660, { fit: 'cover' }).webp({ quality: 78 }).toFile(path.join(out, 'poster-960.webp'));
console.log('map poster');
await browser.close();
server.close();
