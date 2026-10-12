// Production build: bundles JS/CSS with content hashes, copies static files, renders pages.
import fs from 'node:fs';
import path from 'node:path';
import * as esbuild from 'esbuild';
import { renderSite } from './render.mjs';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const out = path.join(root, 'dist');
const dev = process.argv.includes('--dev');

export async function bundle({ outdir = out, minify = true, hash = true, watch = false } = {}) {
  const opts = {
    entryPoints: { main: 'src/js/main.js', styles: 'src/styles/main.css' },
    absWorkingDir: root,
    bundle: true,
    splitting: true,
    format: 'esm',
    target: ['es2020', 'safari15'],
    outdir: path.join(outdir, 'assets'),
    entryNames: hash ? '[name]-[hash]' : '[name]',
    chunkNames: hash ? 'chunks/[name]-[hash]' : 'chunks/[name]',
    assetNames: hash ? 'files/[name]-[hash]' : 'files/[name]',
    loader: { '.woff2': 'file' },
    publicPath: '/assets',
    minify,
    metafile: true,
    legalComments: 'linked',
    logLevel: 'warning',
  };
  if (watch) return esbuild.context(opts);
  return esbuild.build(opts);
}

export function assetsFrom(meta, outdir = out) {
  const rel = (p) => '/' + path.relative(outdir, path.join(root, p)).split(path.sep).join('/');
  let js;
  let css;
  let font;
  for (const [file, info] of Object.entries(meta.outputs)) {
    if (info.entryPoint === 'src/js/main.js') js = rel(file);
    if (file.endsWith('.css') && info.entryPoint === 'src/styles/main.css') css = rel(file);
    if (file.includes('archivo-latin-wdth-normal') && file.endsWith('.woff2')) font = rel(file);
  }
  return { js, css, font };
}

export function copyDir(src, dst) {
  if (!fs.existsSync(src)) return;
  for (const e of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, e.name);
    const d = path.join(dst, e.name);
    if (e.isDirectory()) {
      fs.mkdirSync(d, { recursive: true });
      copyDir(s, d);
    } else fs.copyFileSync(s, d);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  fs.rmSync(out, { recursive: true, force: true });
  fs.mkdirSync(out, { recursive: true });
  const res = await bundle({ minify: !dev });
  copyDir(path.join(root, 'public'), out);
  const assets = assetsFrom(res.metafile);
  const pages = await renderSite(out, assets);
  const size = (f) => (fs.statSync(path.join(out, f)).size / 1024).toFixed(1) + ' KB';
  console.log('assets', Object.fromEntries(Object.entries(assets).map(([k, v]) => [k, `${v} (${size(v)})`])));
  console.log('pages', pages.length, pages.join(', '));
}
