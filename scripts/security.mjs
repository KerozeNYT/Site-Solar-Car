// Security and caching rules of the built site, written for every kind of host:
// - a Content-Security-Policy <meta> in each page (works everywhere, GitHub Pages included);
// - `_headers` (Netlify, Cloudflare Pages) and the headers block of `.htaccess` (Apache, OVH):
//   the full policy (frame-ancestors, HSTS, Permissions-Policy… cannot be set from a page),
//   long caching of the hashed files, compression;
// - /.well-known/security.txt (RFC 9116): whom to write to about a security problem.
// The policy lists only what the site really loads: its own files, the form service and, when
// configured, Google (live reviews), the Instagram feed and the booking page. Each inline
// script of the pages is allowed by its hash (there is one: the class set before the first paint).
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { bookingRules } from '../content/booking.js';

const origin = (u) => {
  try {
    return u ? new URL(u).origin : null;
  } catch {
    return null;
  }
};

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else out.push(p);
  }
  return out;
}

/** sha256 of every inline <script> that runs (JSON-LD data blocks are not scripts) */
function inlineHashes(files) {
  const set = new Set();
  for (const f of files) {
    const s = fs.readFileSync(f, 'utf8');
    for (const m of s.matchAll(/<script(\s[^>]*)?>([\s\S]*?)<\/script>/g)) {
      const attrs = m[1] || '';
      if (/\ssrc=/.test(attrs) || /type="application\/(ld\+)?json"/.test(attrs) || !m[2].trim()) continue;
      set.add(`'sha256-${crypto.createHash('sha256').update(m[2], 'utf8').digest('base64')}'`);
    }
  }
  return [...set].sort();
}

/** the directives, from what content/site.js turns on */
export function policy(business, hashes) {
  const form = origin(business.formEndpoint);
  const google = !!(business.google?.placeId && business.google?.mapsApiKey);
  const insta = origin(business.instagramFeed?.feedUrl);
  // the booking server (content/booking.js; BOOKING_API overrides it for local tests)
  const booking = origin(process.env.BOOKING_API ?? bookingRules.api);
  const d = {
    'default-src': ["'self'"],
    // 'wasm-unsafe-eval': the 3D models are compressed (meshopt), decoded by WebAssembly
    'script-src': ["'self'", ...hashes, "'wasm-unsafe-eval'", google && 'https://maps.googleapis.com'],
    // style attributes (photo framing, logo masks) and the styles Google adds to its widgets
    'style-src': ["'self'", "'unsafe-inline'", google && 'https://fonts.googleapis.com'],
    // blob: textures of the 3D models; Google: authors' photos; Instagram: the CDN of the feed
    'img-src': ["'self'", 'data:', 'blob:', google && 'https://*.googleusercontent.com', google && 'https://maps.gstatic.com', google && 'https://maps.googleapis.com', insta && 'https:'],
    'font-src': ["'self'", google && 'https://fonts.gstatic.com'],
    // the film is read into memory (blob:) and the 3D textures decoded from blob: URLs
    'connect-src': ["'self'", 'blob:', form, booking, google && 'https://maps.googleapis.com', google && 'https://places.googleapis.com', insta],
    'media-src': ["'self'", 'blob:'],
    'worker-src': ["'self'", 'blob:'],
    'frame-src': ["'none'"],
    'manifest-src': ["'self'"],
    'form-action': ["'self'", form],
    'base-uri': ["'self'"],
    'object-src': ["'none'"],
  };
  return Object.entries(d)
    .map(([k, v]) => `${k} ${[...new Set(v.filter(Boolean))].join(' ')}`)
    .join('; ');
}

/** injects the <meta> policy in every page; returns the policy for the response headers */
export function applyCsp(dir, business) {
  const html = walk(dir).filter((f) => f.endsWith('.html'));
  const csp = policy(business, inlineHashes(html));
  const tag = `<meta http-equiv="Content-Security-Policy" content="${csp.replace(/"/g, '&quot;')}">`;
  for (const f of html) {
    const s = fs.readFileSync(f, 'utf8');
    if (s.includes('http-equiv="Content-Security-Policy"')) continue;
    // right after the charset, before anything the policy governs
    const out = s.includes('<meta charset="utf-8">') ? s.replace('<meta charset="utf-8">', `<meta charset="utf-8">\n${tag}`) : s.replace(/<head>/i, `<head>\n${tag}`);
    fs.writeFileSync(f, out);
  }
  return csp;
}

// headers that a page cannot set itself; the same set for every host
export function securityHeaders(csp) {
  return {
    // frame-ancestors and upgrade-insecure-requests only work as a header
    'Content-Security-Policy': `${csp}; frame-ancestors 'none'; upgrade-insecure-requests`,
    // one year of HTTPS only (subdomains not included: the domain's other services, e-mail
    // webmail for instance, are not checked here; add includeSubDomains once they all use HTTPS)
    'Strict-Transport-Security': 'max-age=31536000',
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=(), usb=(), accelerometer=(), gyroscope=(), magnetometer=(), display-capture=(), browsing-topics=()',
    'Cross-Origin-Opener-Policy': 'same-origin',
  };
}

// hashed file names never change: cached for a year; pictures, films and 3D models keep their
// name when they are replaced: a week (then checked again); pages: always checked
export const CACHE = {
  hashed: 'public, max-age=31536000, immutable',
  media: 'public, max-age=604800, stale-while-revalidate=86400',
  page: 'public, max-age=0, must-revalidate',
};
const MEDIA_DIRS = ['img', 'stills', 'video', 'models', 'map'];

/** Netlify / Cloudflare Pages */
export function writeHeadersFile(dir, csp) {
  const h = securityHeaders(csp);
  const block = (p, entries) => [p, ...Object.entries(entries).map(([k, v]) => `  ${k}: ${v}`)].join('\n');
  fs.writeFileSync(
    path.join(dir, '_headers'),
    [
      '# Netlify / Cloudflare Pages: security headers and caching (scripts/security.mjs)',
      block('/*', h),
      block('/assets/*', { 'Cache-Control': CACHE.hashed }),
      ...MEDIA_DIRS.map((d) => block(`/${d}/*`, { 'Cache-Control': CACHE.media })),
      '',
    ].join('\n\n')
  );
}

/** Apache / OVH: lines added to .htaccess (headers, caching, compression, types) */
export function htaccessBlock(csp) {
  const h = securityHeaders(csp);
  const q = (v) => `"${v.replace(/"/g, '\\"')}"`;
  return [
    '# security headers and caching (scripts/security.mjs)',
    '<IfModule mod_headers.c>',
    ...Object.entries(h).map(([k, v]) => `  Header always set ${k} ${q(v)}`),
    // by file name rather than by folder: works on every Apache version (2.2 included)
    '  <FilesMatch "\\.(webp|jpe?g|png|ico|svg|mp4|glb|json|webmanifest)$">',
    `    Header set Cache-Control ${q(CACHE.media)}`,
    '  </FilesMatch>',
    // esbuild names: main-ABCD1234.js, chunks/x-ABCD1234.js, files/font-ABCD1234.woff2
    '  <FilesMatch "-[A-Z0-9]{8}\\.(js|css|woff2)$">',
    `    Header set Cache-Control ${q(CACHE.hashed)}`,
    '  </FilesMatch>',
    '  <FilesMatch "\\.html$">',
    `    Header set Cache-Control ${q(CACHE.page)}`,
    '  </FilesMatch>',
    '</IfModule>',
    'AddType application/manifest+json .webmanifest',
    'AddType model/gltf-binary .glb',
    'AddType font/woff2 .woff2',
    'AddType image/webp .webp',
    'AddDefaultCharset utf-8',
    '<IfModule mod_deflate.c>',
    '  AddOutputFilterByType DEFLATE text/html text/css text/javascript application/javascript application/json application/manifest+json application/xml image/svg+xml text/plain',
    '</IfModule>',
  ];
}

/** /.well-known/security.txt (RFC 9116), valid one year from the build */
export function writeSecurityTxt(dir, business) {
  const expires = new Date(Date.now() + 365 * 864e5).toISOString().replace(/\.\d+Z$/, 'Z');
  const site = business.siteUrl.replace(/\/$/, '');
  fs.mkdirSync(path.join(dir, '.well-known'), { recursive: true });
  fs.writeFileSync(
    path.join(dir, '.well-known', 'security.txt'),
    [`Contact: mailto:${business.email}`, `Expires: ${expires}`, 'Preferred-Languages: fr, en', `Canonical: ${site}/.well-known/security.txt`, ''].join('\n')
  );
}
