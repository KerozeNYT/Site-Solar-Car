// Renders the generic cars of the window tint simulator (scripts/cars/scene.js): for each type
// and view, the picture and two masks (front side windows, rear windows), then the web files:
//   public/img/vitres/<type>-<view>-960.webp, -1600.webp  (picture)
//   public/img/vitres/<type>-<view>-front.webp, -rear.webp (masks: white windows, transparent
//   elsewhere, used by the simulator to tint and outline the chosen windows in gold)
//
//   node scripts/cars/render.mjs [type,…] [--test <dir>]   (--test: PNGs only, in <dir>)
import fs from 'node:fs';
import path from 'node:path';
import * as esbuild from 'esbuild';
import sharp from 'sharp';
import { serve } from '../serve.mjs';
import { carTypes } from './types.js';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../..');
const args = process.argv.slice(2);
const testDir = args.includes('--test') ? args[args.indexOf('--test') + 1] : null;
const only = args.find((a) => !a.startsWith('--') && a !== testDir);
const ids = only ? only.split(',') : carTypes.map((t) => t.id);
const W = Number(process.env.CAR_W || 1600);
const H = Number(process.env.CAR_H || 1000);

const cache = path.join(root, '.cache/cars');
fs.mkdirSync(cache, { recursive: true });
await esbuild.build({ entryPoints: [path.join(root, 'scripts/cars/scene.js')], bundle: true, format: 'esm', target: 'es2022', outfile: path.join(cache, 'scene.js'), logLevel: 'error' });
fs.writeFileSync(path.join(cache, 'index.html'), '<!doctype html><meta charset="utf-8"><style>html,body{margin:0;background:#000}canvas{display:block}</style><script type="module" src="./scene.js"></script>');

const port = 4950 + Math.floor(Math.random() * 40);
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const server = await serve(root, port);
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: W, height: H } });
page.on('pageerror', (e) => console.log('PAGEERROR', e.message));
page.on('console', (m) => m.type() === 'error' && console.log('console:', m.text()));
await page.goto(`http://localhost:${port}/.cache/cars/index.html?w=${W}&h=${H}`);
await page.waitForFunction(() => window.ready, null, { timeout: 120000 });

const outDir = testDir || path.join(root, 'public/img/vitres');
fs.mkdirSync(outDir, { recursive: true });
const grab = async (id, view, mode) => {
  const url = await page.evaluate(([id, view, mode]) => (window.show(id, view, mode), window.frameData()), [id, view, mode]);
  return Buffer.from(url.split(',')[1], 'base64');
};
for (const id of ids) {
  for (const view of ['34', 'side']) {
    const t0 = Date.now();
    const beauty = await grab(id, view, 'beauty');
    const front = await grab(id, view, 'front');
    const rear = await grab(id, view, 'rear');
    if (testDir) {
      fs.writeFileSync(path.join(outDir, `${id}-${view}.png`), beauty);
      fs.writeFileSync(path.join(outDir, `${id}-${view}-front.png`), front);
      fs.writeFileSync(path.join(outDir, `${id}-${view}-rear.png`), rear);
    } else {
      const base = path.join(outDir, `${id}-${view}`);
      await sharp(beauty).resize(1600).webp({ quality: 84, effort: 6 }).toFile(`${base}-1600.webp`);
      await sharp(beauty).resize(960).webp({ quality: 80, effort: 6 }).toFile(`${base}-960.webp`);
      // masks: the white windows become opaque, the rest transparent (CSS mask-image)
      for (const [name, png] of [['front', front], ['rear', rear]]) {
        const grey = await sharp(png).resize(800).greyscale().raw().toBuffer({ resolveWithObject: true });
        const { width, height } = grey.info;
        const rgba = Buffer.alloc(width * height * 4);
        for (let i = 0; i < width * height; i++) {
          rgba[i * 4] = rgba[i * 4 + 1] = rgba[i * 4 + 2] = 255;
          rgba[i * 4 + 3] = grey.data[i];
        }
        await sharp(rgba, { raw: { width, height, channels: 4 } }).webp({ lossless: true, effort: 6 }).toFile(`${base}-${name}.webp`);
      }
    }
    console.log(id, view, `${((Date.now() - t0) / 1000).toFixed(1)} s`);
  }
}
await browser.close();
server.close();
