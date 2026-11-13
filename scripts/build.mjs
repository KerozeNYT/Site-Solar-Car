// Production build: bundles JS/CSS with content hashes, copies static files, renders pages.
import fs from 'node:fs';
import path from 'node:path';
import * as esbuild from 'esbuild';
import { renderSite } from './render.mjs';
import { rebase, markPreview } from './rebase.mjs';
import { redirects } from '../content/redirects.js';
import { business } from '../content/site.js';
import { addBeacon, applyCsp, htaccessBlock, writeHeadersFile, writeSecurityTxt } from './security.mjs';

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
  // fonts used by the first screen, preloaded (text, italic serif of the titles, mono of the labels)
  const FIRST = ['geist-latin-wght-normal', 'instrument-serif-latin-400-italic', 'geist-mono-latin-wght-normal'];
  const fonts = [];
  for (const [file, info] of Object.entries(meta.outputs)) {
    if (info.entryPoint === 'src/js/main.js') js = rel(file);
    if (file.endsWith('.css') && info.entryPoint === 'src/styles/main.css') css = rel(file);
    const i = FIRST.findIndex((f) => file.includes(`/${f}-`) && file.endsWith('.woff2'));
    if (i >= 0) fonts[i] = rel(file);
  }
  return { js, css, fonts: fonts.filter(Boolean), font: fonts[0] };
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

/** 301s from the previous site's pages (content/redirects.js), for the usual hosts */
function writeRedirects(dir, csp) {
  const site = 'https://www.solarcar37.fr';
  fs.writeFileSync(
    path.join(dir, '_redirects'),
    // (the same page with its trailing slash is left to the host, which adds it itself: a rule
    // for it could loop)
    ['# Netlify / Cloudflare Pages: pages of the previous site (content/redirects.js)', ...redirects.filter((r) => r.to !== r.from + '/').map((r) => `${r.from} ${r.to} 301!`), ''].join('\n')
  );
  fs.writeFileSync(
    path.join(dir, '.htaccess'),
    [
      '# Apache / OVH: https and www, then the pages of the previous site (content/redirects.js)',
      'RewriteEngine On',
      'RewriteCond %{HTTPS} off [OR]',
      'RewriteCond %{HTTP_HOST} !^www\\. [NC]',
      'RewriteRule ^ https://www.solarcar37.fr%{REQUEST_URI} [L,R=301]',
      ...redirects.map((r) => `RewriteRule ^${r.from.slice(1).replace(/[.+-]/g, (c) => '\\' + c)}$ ${r.to} [L,R=301]`),
      'ErrorDocument 404 /404.html',
      '',
      ...htaccessBlock(csp),
      '',
    ].join('\n')
  );
  // hosts without redirect rules (GitHub Pages): a page at each old address that moves on
  for (const r of redirects) {
    const file = path.join(dir, r.from.slice(1) + '.html');
    if (fs.existsSync(file) || fs.existsSync(path.join(dir, r.from.slice(1), 'index.html')) && r.to === r.from + '/') continue;
    fs.writeFileSync(
      file,
      `<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>Page déplacée</title><link rel="canonical" href="${site}${r.to}"><meta name="robots" content="noindex"><meta http-equiv="refresh" content="0; url=${r.to}"></head><body><p>Cette page a déménagé : <a href="${r.to}">continuer</a>.</p></body></html>\n`
    );
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  fs.rmSync(out, { recursive: true, force: true });
  fs.mkdirSync(out, { recursive: true });
  const res = await bundle({ minify: !dev });
  copyDir(path.join(root, 'public'), out);
  const assets = assetsFrom(res.metafile);
  const pages = await renderSite(out, assets);
  // sub-folder hosting (GitHub Pages preview): SITE_BASE=/Site-Solar-Car/ ; PREVIEW=1 = noindex
  const base = process.env.SITE_BASE || '/';
  if (base !== '/') console.log('base', base, rebase(out, base).files, 'files');
  if (process.env.PREVIEW) markPreview(out);
  // Cloudflare Web Analytics (production, when configured), then the Content-Security-Policy in
  // every page, then the host files that carry the full headers
  addBeacon(out, business);
  const csp = applyCsp(out, business);
  if (!process.env.PREVIEW) {
    writeRedirects(out, csp);
    writeHeadersFile(out, csp);
    writeSecurityTxt(out, business);
  }
  const size = (f) => (fs.statSync(path.join(out, f)).size / 1024).toFixed(1) + ' KB';
  const list = (v) => [].concat(v).map((f) => `${f} (${size(f)})`).join(', ');
  console.log('assets', Object.fromEntries(Object.entries(assets).map(([k, v]) => [k, list(v)])));
  console.log('pages', pages.length, pages.join(', '));
}
