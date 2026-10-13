// Renders every HTML page, the sitemap, robots.txt and the web manifest into `out`.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
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
  const { realisations: allJobs, realisationsPage } = await load('content/realisations.js');
  // a job photo is published only once scripts/photos.mjs has written its web versions; a job
  // without any published photo (or before / after) is left out
  const published = (p) => p.src || fs.existsSync(path.join(root, 'public', 'img', 'realisations', `${p.id}-1600.webp`));
  const realisations = allJobs.map((r) => ({ ...r, photos: (r.photos || []).filter(published) })).filter((r) => r.photos.length || r.beforeAfter);
  // every distinct 3D model credit (tour car + simulator cars)
  const credits = [...new Set([car, ...Object.values(vehicles).map((v) => v.config)].filter((c) => c?.credit).map((c) => c.credit.text))];
  const flightTotal = flight.beats.reduce((a, b) => a + b.vh, 0);
  // scroll position (vh from the top of the tour) where each chapter starts
  const flightAt = {};
  flight.beats.reduce((acc, b) => {
    if (b.chapter && !(b.chapter in flightAt)) flightAt[b.chapter] = acc;
    return acc + b.vh;
  }, 0);
  // the gallery exists only with real jobs: then it gets its page, menu link and sitemap entry
  const nav = realisations.length ? [...site.nav.slice(0, 1), { label: 'Réalisations', href: '/realisations/' }, ...site.nav.slice(1)] : site.nav;
  const ctx = { ...site, nav, car, assets, flightTotal, flightAt, pricing, credits, guides, guidesPage, zones, zonesPage, realisations, realisationsPage };

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
    ...(realisations.length ? [['realisations/index.html', T.realisationsPage(ctx)]] : []),
    ['zones-intervention/index.html', T.zonesIndexPage(ctx)],
    ...zones.map((z) => [`${z.slug}/index.html`, T.zonePage(ctx, z)]),
  ];
  const today = new Date().toISOString().slice(0, 10);
  // sitemap <lastmod> = the day a page's main content last changed, not the build date:
  // content/lastmod.json keeps a fingerprint of each page's <main> (commit it with the content)
  const manifestFile = path.join(root, 'content', 'lastmod.json');
  let manifest = {};
  try {
    manifest = JSON.parse(fs.readFileSync(manifestFile, 'utf8'));
  } catch {
    /* first build */
  }
  const before = JSON.stringify(manifest);
  for (const [rel, html] of pages) {
    const file = path.join(out, rel);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, html);
    const url = '/' + rel.replace(/index\.html$/, '');
    const main = html.match(/<main[\s\S]*<\/main>/)?.[0] || html;
    const hash = crypto.createHash('sha1').update(main).digest('hex').slice(0, 16);
    if (manifest[url]?.hash !== hash) manifest[url] = { hash, date: today };
  }
  const sorted = Object.fromEntries(Object.entries(manifest).sort(([a], [b]) => a.localeCompare(b)));
  if (JSON.stringify(sorted) !== before) fs.writeFileSync(manifestFile, JSON.stringify(sorted, null, 1) + '\n');
  const changedOn = (u) => manifest[u]?.date || today;

  const base = site.business.siteUrl.replace(/\/$/, '');
  // [path, priority, image id] — images help the pages surface in Google Images
  const urls = [
    ['/', '1.0', 'hero'],
    ...site.services.map((s) => [`/${s.slug}/`, '0.9', s.still]),
    ['/atelier-vouvray/', '0.8', 'final'],
    ['/contact/', '0.8', null],
    ...(realisations.length ? [['/realisations/', '0.7', null]] : []),
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
          `  <url><loc>${base}${u}</loc><lastmod>${[mod, changedOn(u)].filter(Boolean).sort().pop()}</lastmod><priority>${pr}</priority>${img ? `<image:image><image:loc>${base}/stills/${img}-1600.jpg</image:loc></image:image>` : ''}</url>`
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
