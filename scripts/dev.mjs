// Dev server: rebuilds JS/CSS on change, re-renders pages when content or templates change.
import fs from 'node:fs';
import path from 'node:path';
import { bundle, assetsFrom, copyDir } from './build.mjs';
import { renderSite } from './render.mjs';
import { serve } from './serve.mjs';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const out = path.join(root, '.cache/dev');
fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(out, { recursive: true });
copyDir(path.join(root, 'public'), out);
let assets = { js: '/assets/main.js', css: '/assets/styles.css', font: '' };
const ctx = await bundle({ outdir: out, minify: false, hash: false, watch: true });
const first = await ctx.rebuild();
assets = assetsFrom(first.metafile, out);
await renderSite(out, assets);
await ctx.watch();
let timer = null;
for (const dir of ['content', 'src/templates', 'public']) {
  fs.watch(path.join(root, dir), { recursive: true }, () => {
    clearTimeout(timer);
    timer = setTimeout(async () => {
      try {
        copyDir(path.join(root, 'public'), out);
        await renderSite(out, assets);
        console.log('pages re-rendered');
      } catch (e) {
        console.error(e.message);
      }
    }, 120);
  });
}
const port = Number(process.env.PORT || 5173);
await serve(out, port);
console.log(`dev server: http://localhost:${port}`);
