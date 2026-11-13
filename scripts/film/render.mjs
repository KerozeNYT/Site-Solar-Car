// Renders the home page film to numbered JPEG frames, resuming where it stopped. Frame i is the
// moment i / FPS (FILM_FPS, default the film's `fps` in content/film.js).
//
//   node scripts/film/render.mjs <out dir> <width> <height> [first frame] [end frame] [port]
//   node scripts/film/render.mjs <out dir> <width> <height> --at 3.8,8.6,12.5   (test stills)
//
// Then: node scripts/film-assets.mjs '<out dir>/f%04d.jpg'. Several processes can share one
// folder (different ranges or ports): existing frames are skipped. Extra URL knobs for
// scripts/film/scene.js go in FILM_QUERY (e.g. FILM_QUERY='msaa=0&exp=1.25').
import fs from 'node:fs';
import path from 'node:path';
import * as esbuild from 'esbuild';
import { serve } from '../serve.mjs';
import { duration } from './shots.js';
import { film } from '../../content/film.js';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../..');
const [dir, w, h, ...rest] = process.argv.slice(2);
if (!dir || !w || !h) {
  console.error('usage: node scripts/film/render.mjs <out dir> <width> <height> [from] [to] [port] | --at t1,t2');
  process.exit(1);
}
const FPS = Number(process.env.FILM_FPS || film.fps || 24);
const at = rest[0] === '--at' ? rest[1].split(',').map(Number) : null;
// --keys <file.mjs>: the key frames it exports as `keyframes` ([{ id, cam, fx }]), one still each
const keysFile = rest[0] === '--keys' ? path.resolve(rest[1]) : null;
const from = at || keysFile ? 0 : Number(rest[0] ?? 0);
const to = at || keysFile ? 0 : Number(rest[1] ?? Math.round(duration * FPS));
const port = Number(rest[2] || 4790 + Math.floor(Math.random() * 200));

// bundle the scene (three.js + the site's tour modules) next to its page
const cache = path.join(root, '.cache/film');
fs.mkdirSync(cache, { recursive: true });
const bundle = `scene-${port}.js`;
await esbuild.build({
  entryPoints: [path.join(root, 'scripts/film/scene.js')],
  bundle: true,
  format: 'esm',
  target: 'es2022',
  outfile: path.join(cache, bundle),
  logLevel: 'error',
});
fs.writeFileSync(
  path.join(cache, `index-${port}.html`),
  `<!doctype html><meta charset="utf-8"><style>html,body{margin:0;background:#000}canvas{display:block}</style><script type="module" src="./${bundle}"></script>`
);

const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const server = await serve(root, port);
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: +w, height: +h } });
page.on('pageerror', (e) => console.log('PAGEERROR', e.message));
page.on('console', (m) => (m.type() === 'error' || m.text().startsWith('[scene]')) && console.log('console:', m.text()));
const extra = process.env.FILM_QUERY ? '&' + process.env.FILM_QUERY : '';
await page.goto(`http://localhost:${port}/.cache/film/index-${port}.html?w=${w}&h=${h}${extra}`);
await page.waitForFunction(() => window.ready, null, { timeout: 900000 });
fs.mkdirSync(dir, { recursive: true });

const grab = async (t, file) => {
  const url = await page.evaluate((t) => (window.renderFrame(t), window.frameData('image/jpeg', 0.96)), t);
  const tmp = file + '.part';
  fs.writeFileSync(tmp, Buffer.from(url.split(',')[1], 'base64'));
  fs.renameSync(tmp, file); // never leave a half-written frame behind
};
const t0 = Date.now();
if (keysFile) {
  // KEYS_SET=vertical: the phone versions (keyframesVertical)
  const mod = await import(keysFile);
  const keyframes = process.env.KEYS_SET === 'vertical' ? mod.keyframesVertical : mod.keyframes;
  for (const k of keyframes) {
    const url = await page.evaluate((k) => (window.renderShot(k), window.frameData('image/jpeg', 0.96)), k);
    fs.writeFileSync(path.join(dir, `${k.id}.jpg`), Buffer.from(url.split(',')[1], 'base64'));
    console.log('key frame', k.id);
  }
} else if (at) {
  for (const t of at) await grab(t, path.join(dir, `t${t.toFixed(2)}.jpg`));
} else {
  let done = 0;
  for (let i = from; i < to; i++) {
    const file = path.join(dir, `f${String(i).padStart(4, '0')}.jpg`);
    if (fs.existsSync(file)) continue;
    await grab(i / FPS, file);
    done++;
    if (done % 12 === 0) console.log(`frame ${i} (${((Date.now() - t0) / 1000 / done).toFixed(1)} s/frame)`);
  }
}
console.log('done', ((Date.now() - t0) / 1000).toFixed(0) + ' s');
await browser.close();
server.close();
