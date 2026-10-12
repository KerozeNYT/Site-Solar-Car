// Renders every HTML page, the sitemap, robots.txt and the web manifest into `out`.
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');

/** Fresh import (cache-busted) so the dev server picks up content edits. */
async function load(rel) {
  const url = pathToFileURL(path.join(root, rel)).href + `?v=${Date.now()}`;
  return import(url);
}

export async function renderSite(out, assets) {
  const site = await load('content/site.js');
  const car = (await load('content/car.js')).default;
  const T = await load('src/templates/pages.js');
  const styleTile = await load('src/templates/styletile.js');
  const flight = await load('content/flight.js');
  const pricing = await load('content/pricing.js');
  const vehicles = (await load('content/vehicles.js')).default;
  // every distinct 3D model credit (tour car + simulator cars)
  const credits = [...new Set([car, ...Object.values(vehicles).map((v) => v.config)].filter((c) => c?.credit).map((c) => c.credit.text))];
  const flightTotal = flight.beats.reduce((a, b) => a + b.vh, 0);
  const ctx = { ...site, car, assets, flightTotal, pricing, credits };

  const pages = [
    ['index.html', T.homePage(ctx)],
    ['contact/index.html', T.contactPage(ctx)],
    ['mentions-legales/index.html', T.legalPage(ctx)],
    ['404.html', T.notFoundPage(ctx)],
    ['design/style-tile/index.html', styleTile.styleTilePage(ctx)],
    ...site.services.map((s) => [`${s.slug}/index.html`, T.servicePage(ctx, s)]),
  ];
  for (const [rel, html] of pages) {
    const file = path.join(out, rel);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, html);
  }

  const base = site.business.siteUrl.replace(/\/$/, '');
  const today = new Date().toISOString().slice(0, 10);
  const urls = ['/', ...site.services.map((s) => `/${s.slug}/`), '/contact/', '/mentions-legales/'];
  fs.writeFileSync(
    path.join(out, 'sitemap.xml'),
    `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls
      .map((u) => `  <url><loc>${base}${u}</loc><lastmod>${today}</lastmod><priority>${u === '/' ? '1.0' : u.includes('legales') ? '0.2' : '0.8'}</priority></url>`)
      .join('\n')}\n</urlset>\n`
  );
  fs.writeFileSync(path.join(out, 'robots.txt'), `User-agent: *\nAllow: /\nDisallow: /design/\n\nSitemap: ${base}/sitemap.xml\n`);
  fs.writeFileSync(
    path.join(out, 'site.webmanifest'),
    JSON.stringify(
      {
        name: site.business.name,
        short_name: 'SOLAR CAR 37',
        lang: 'fr',
        start_url: '/',
        display: 'standalone',
        background_color: '#07080a',
        theme_color: '#07080a',
        icons: [
          { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: '/favicon.svg', sizes: 'any', type: 'image/svg+xml' },
        ],
      },
      null,
      2
    )
  );
  return pages.map(([rel]) => rel);
}
