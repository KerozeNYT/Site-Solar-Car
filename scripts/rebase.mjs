// Serves the built site from a sub-folder (e.g. GitHub Pages: /Site-Solar-Car/) by prefixing
// every root-relative URL, and optionally marks it as a preview that search engines must skip.
import fs from 'node:fs';
import path from 'node:path';

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else out.push(p);
  }
  return out;
}

/** `base` must start and end with a slash, e.g. "/Site-Solar-Car/". */
export function rebase(dir, base) {
  if (!/^\/.*\/$/.test(base)) throw new Error(`SITE_BASE must look like /name/ (got ${base})`);
  const b = base.slice(1); // "Site-Solar-Car/"
  // URLs the scripts build or import at runtime (chunks, 3D models, textures, quote link)
  const jsPrefix = /(["'`])\/(assets|models|img|stills|contact|mentions-legales)\//g;
  let count = 0;
  for (const file of walk(dir)) {
    const ext = path.extname(file);
    let s;
    if (ext === '.html') {
      s = fs.readFileSync(file, 'utf8');
      s = s.replace(/\b(href|src|action)="\/(?!\/)/g, `$1="${base}`);
      s = s.replace(/\b((?:image)?srcset)="([^"]*)"/g, (m, a, v) => `${a}="${v.replace(/(^|,\s*)\/(?!\/)/g, `$1${base}`)}"`);
    } else if (ext === '.js') {
      s = fs.readFileSync(file, 'utf8').replace(jsPrefix, `$1${base}$2/`);
    } else if (ext === '.css') {
      s = fs.readFileSync(file, 'utf8').replace(/url\((["']?)\/(?!\/)/g, `url($1${base}`);
    } else if (ext === '.webmanifest') {
      s = fs.readFileSync(file, 'utf8').replace(/"(start_url|src)": "\//g, `"$1": "${base}`);
    } else continue;
    fs.writeFileSync(file, s);
    count++;
  }
  return { files: count, base: b };
}

/** Preview builds: no indexing, so the test address never competes with the real domain. */
export function markPreview(dir) {
  for (const file of walk(dir)) {
    if (path.extname(file) !== '.html') continue;
    const s = fs.readFileSync(file, 'utf8');
    if (s.includes('name="robots"')) fs.writeFileSync(file, s.replace(/<meta name="robots" content="[^"]*">/, '<meta name="robots" content="noindex, nofollow">'));
    else fs.writeFileSync(file, s.replace('<head>', '<head>\n<meta name="robots" content="noindex, nofollow">'));
  }
  fs.writeFileSync(path.join(dir, 'robots.txt'), 'User-agent: *\nDisallow: /\n');
}
