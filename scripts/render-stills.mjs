// Renders one still per tour chapter from the live 3D scene (posters, reduced-motion fallback,
// service cards, social images). Requires a build in dist/. Usage: npm run stills
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import { serve } from './serve.mjs';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const { stills } = await import(path.join(root, 'content/flight.js'));
const out = path.join(root, 'public/stills');
fs.mkdirSync(out, { recursive: true });
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const server = await serve(path.join(root, 'dist'), 4610);
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const only = process.argv.slice(2);
for (const id of Object.keys(stills)) {
  if (only.length && !only.includes(id)) continue;
  const page = await browser.newPage({ viewport: { width: 1600, height: 900 }, deviceScaleFactor: 1 });
  page.on('pageerror', (e) => console.error(id, 'page error:', e.message));
  await page.goto(`http://localhost:4610/?still=${id}&dpr=1`);
  await page.waitForFunction(() => window.__stillReady, null, { timeout: 300000 });
  await page.waitForTimeout(400);
  const png = await page.screenshot({ type: 'png' });
  await sharp(png).webp({ quality: 80 }).toFile(path.join(out, `${id}-1600.webp`));
  await sharp(png).resize(960).webp({ quality: 78 }).toFile(path.join(out, `${id}-960.webp`));
  await sharp(png).jpeg({ quality: 82, mozjpeg: true }).toFile(path.join(out, `${id}-1600.jpg`));
  if (id === 'hero') {
    // social card: hero still + official logo on a light plate
    const logo = await sharp(path.join(root, 'public/img/brand/logo-horizontal-400.png')).resize({ height: 92 }).toBuffer();
    const lm = await sharp(logo).metadata();
    const plate = await sharp({ create: { width: lm.width + 56, height: 132, channels: 4, background: { r: 255, g: 255, b: 255, alpha: 0.94 } } })
      .composite([{ input: logo, left: 28, top: 20 }])
      .png()
      .toBuffer();
    await sharp(png)
      .resize(1200, 630, { fit: 'cover', position: 'right' })
      .composite([{ input: plate, left: 48, top: 48 }])
      .jpeg({ quality: 84, mozjpeg: true })
      .toFile(path.join(out, 'og.jpg'));
  }
  console.log('still', id);
  await page.close();
}
await browser.close();
server.close();
