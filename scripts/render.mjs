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
  const { guides, guidesPage } = await load('content/guides.js');
  const { zones, zonesPage } = await load('content/zones.js');
  // every distinct 3D model credit (tour car + simulator cars)
  const credits = [...new Set([car, ...Object.values(vehicles).map((v) => v.config)].filter((c) => c?.credit).map((c) => c.credit.text))];
  const flightTotal = flight.beats.reduce((a, b) => a + b.vh, 0);
  // scroll position (vh from the top of the tour) where each chapter starts
  const flightAt = {};
  flight.beats.reduce((acc, b) => {
    if (b.chapter && !(b.chapter in flightAt)) flightAt[b.chapter] = acc;
    return acc + b.vh;
  }, 0);
  const ctx = { ...site, car, assets, flightTotal, flightAt, pricing, credits, guides, guidesPage, zones, zonesPage };

  const pages = [
    ['index.html', T.homePage(ctx)],
    ['contact/index.html', T.contactPage(ctx)],
    ['contact/merci/index.html', T.thanksPage(ctx)],
    ['mentions-legales/index.html', T.legalPage(ctx)],
    ['404.html', T.notFoundPage(ctx)],
    ['design/style-tile/index.html', styleTile.styleTilePage(ctx)],
    ...site.services.map((s) => [`${s.slug}/index.html`, T.servicePage(ctx, s)]),
    ['atelier-vouvray/index.html', T.atelierPage(ctx)],
    ['guides/index.html', T.guidesIndexPage(ctx)],
    ...guides.map((g) => [`guides/${g.slug}/index.html`, T.guidePage(ctx, g)]),
    ['zones-intervention/index.html', T.zonesIndexPage(ctx)],
    ...zones.map((z) => [`${z.slug}/index.html`, T.zonePage(ctx, z)]),
  ];
  for (const [rel, html] of pages) {
    const file = path.join(out, rel);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, html);
  }

  const base = site.business.siteUrl.replace(/\/$/, '');
  const today = new Date().toISOString().slice(0, 10);
  // [path, priority, image id] — images help the pages surface in Google Images
  const urls = [
    ['/', '1.0', 'hero'],
    ...site.services.map((s) => [`/${s.slug}/`, '0.9', s.still]),
    ['/atelier-vouvray/', '0.8', 'final'],
    ['/contact/', '0.8', null],
    ['/guides/', '0.6', null],
    ...guides.map((g) => [`/guides/${g.slug}/`, '0.6', g.still, g.updated]),
    ['/zones-intervention/', '0.6', null],
    ...zones.map((z) => [`/${z.slug}/`, '0.6', null]),
    ['/mentions-legales/', '0.2', null],
  ];
  fs.writeFileSync(
    path.join(out, 'sitemap.xml'),
    `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">\n${urls
      .map(
        ([u, pr, img, mod]) =>
          `  <url><loc>${base}${u}</loc><lastmod>${mod || today}</lastmod><priority>${pr}</priority>${img ? `<image:image><image:loc>${base}/stills/${img}-1600.jpg</image:loc></image:image>` : ''}</url>`
      )
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
