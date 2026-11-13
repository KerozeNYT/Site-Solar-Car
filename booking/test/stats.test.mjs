// Visit statistics: what the pages send, what is kept, what the statistics page shows.
import test from 'node:test';
import assert from 'node:assert/strict';
import worker from '../worker.js';
import { hitFromPage, sourceOf, hostOf, record } from '../stats.js';
import { fakeStats } from './fake-stats.mjs';

const DAY = 86400000;
const SITE = 'https://www.solarcar37.fr';
const PREVIEW = 'https://kerozenyt.github.io';
const KEY = 'cle-de-test-0123456789abcdefghij';
const fresh = () => ({
  ALLOWED_ORIGINS: `${SITE},https://solarcar37.fr,${PREVIEW}`,
  STATS_PREVIEW_ORIGINS: PREVIEW,
  STATS_KEY: KEY,
  SITE_URL: 'https://www.solarcar37.fr',
  STATS: fakeStats(),
});
const send = (env, hit, { origin = SITE, ua = 'Mozilla/5.0 (iPhone)' } = {}) =>
  worker.fetch(new Request('https://reservation.solarcar37.fr/api/stats', { method: 'POST', body: typeof hit === 'string' ? hit : JSON.stringify(hit), headers: { origin, 'content-type': 'text/plain;charset=UTF-8', 'user-agent': ua } }), env);
const rows = (env) => env.STATS.db.prepare('SELECT * FROM hits ORDER BY at').all();
const page = (env, q = '') => worker.fetch(new Request(`https://reservation.solarcar37.fr/stats?${q}`), env);

test('sources: search engines, Google profile, social networks, other sites, direct', () => {
  assert.equal(hostOf('WWW.Google.fr'), 'google.fr');
  assert.equal(hostOf('l.instagram.com'), 'instagram.com');
  assert.equal(hostOf('evil"><script>'), '');
  assert.equal(sourceOf('google.fr'), 'moteurs');
  assert.equal(sourceOf('bing.com'), 'moteurs');
  assert.equal(sourceOf('qwant.com'), 'moteurs');
  assert.equal(sourceOf('google.com', 'fiche-google'), 'fiche');
  assert.equal(sourceOf('com.google.android.apps.maps'), 'fiche');
  assert.equal(sourceOf('instagram.com'), 'reseaux');
  assert.equal(sourceOf('facebook.com'), 'reseaux');
  assert.equal(sourceOf('pagesjaunes.fr'), 'sites');
  assert.equal(sourceOf(''), 'direct');
});

test('a hit from a page is checked and bounded', () => {
  assert.equal(hitFromPage('not json', 'site'), null);
  assert.equal(hitFromPage(JSON.stringify({ t: 'rdv' }), 'site'), null); // only the server counts bookings
  assert.equal(hitFromPage(JSON.stringify({ t: 'drop table' }), 'site'), null);
  const p = hitFromPage(JSON.stringify({ t: 'page', p: '/Vitres-Teintees/', e: 1, r: 'www.google.fr', d: 'telephone' }), 'site');
  assert.deepEqual(p, { site: 'site', kind: 'page', page: '/vitres-teintees/', device: 'telephone', entry: 1, source: 'moteurs', ref: 'google.fr' });
  const odd = hitFromPage(JSON.stringify({ t: 'page', p: '/<script>', e: 0, r: 'google.fr', d: 'tv' }), 'apercu');
  assert.deepEqual(odd, { site: 'apercu', kind: 'page', page: '/', device: '', entry: 0 });
  const a = hitFromPage(JSON.stringify({ t: 'simulateur_3d', p: '/vitres-teintees/', x: 'vitres <b>' }), 'site');
  assert.equal(a.detail, 'vitres b');
});

test('collect: kept from the site and the preview (apart), refused from elsewhere, always 204', async () => {
  const env = fresh();
  for (const [hit, opts] of [
    [{ t: 'page', p: '/', e: 1, r: 'google.fr', d: 'telephone' }, {}],
    [{ t: 'appel', p: '/contact/' }, {}],
    [{ t: 'page', p: '/', e: 1 }, { origin: PREVIEW }],
    [{ t: 'page', p: '/', e: 1 }, { origin: 'https://example.com' }],
    [{ t: 'page', p: '/', e: 1 }, { ua: 'Mozilla/5.0 (compatible; Googlebot/2.1)' }],
    ['x'.repeat(3000), {}],
  ]) {
    const r = await send(env, hit, opts);
    assert.equal(r.status, 204);
  }
  const kept = rows(env);
  assert.deepEqual(kept.map((r) => [r.site, r.kind, r.source]), [['site', 'page', 'moteurs'], ['site', 'appel', ''], ['apercu', 'page', 'direct']]);
  assert.match(kept[0].day, /^\d{4}-\d{2}-\d{2}$/);
});

test('statistics page: key required, figures of the period, preview apart', async () => {
  const env = fresh();
  assert.equal((await page(env)).status, 403);
  assert.equal((await page(env, 'cle=mauvaise')).status, 403);
  const now = Date.now();
  // 3 visits (2 from Google, 1 direct), 5 page views, a call, a form sent, on the site; 1 preview visit
  await record(env, [{ site: 'site', kind: 'page', page: '/', entry: 1, source: 'moteurs', ref: 'google.fr', device: 'telephone' }], now - 2 * DAY);
  await record(env, [{ site: 'site', kind: 'page', page: '/vitres-teintees/', entry: 0, device: 'telephone' }], now - 2 * DAY);
  await record(env, [{ site: 'site', kind: 'page', page: '/vitres-teintees/', entry: 1, source: 'moteurs', ref: 'google.fr', device: 'ordinateur' }], now - DAY);
  await record(env, [{ site: 'site', kind: 'page', page: '/contact/', entry: 0, device: 'ordinateur' }], now - DAY);
  await record(env, [{ site: 'site', kind: 'page', page: '/', entry: 1, source: 'direct', device: 'telephone' }], now);
  await record(env, [{ site: 'site', kind: 'appel', page: '/contact/' }, { site: 'site', kind: 'demande_envoyee', page: '/contact/' }], now);
  await record(env, [{ site: 'apercu', kind: 'page', page: '/', entry: 1, source: 'direct' }], now);
  const r = await page(env, `cle=${KEY}&periode=7`);
  assert.equal(r.status, 200);
  assert.match(r.headers.get('content-security-policy'), /default-src 'none'/);
  assert.equal(r.headers.get('x-robots-tag'), 'noindex, nofollow');
  assert.equal(r.headers.get('cache-control'), 'no-store');
  const html = await r.text();
  assert.match(html, /<p class="hero__value">3<\/p>/);
  assert.match(html, /Pages vues<\/p><p class="tile__value">5</);
  assert.match(html, /Pages par visite<\/p><p class="tile__value">1,67</);
  assert.match(html, /Demandes envoyées<\/p><p class="tile__value">1</);
  assert.match(html, /Appels<\/p><p class="tile__value">1</);
  assert.match(html, /Moteurs de recherche<\/span>.*?67 % <small>\(2\)/s);
  assert.match(html, /<td>google\.fr<\/td><td>Moteurs de recherche<\/td><td class="n">2<\/td>/);
  assert.match(html, /Téléphone <strong>67 %<\/strong>/);
  assert.match(html, /aria-current="page">7 jours</);
  assert.equal((html.match(/class="col[ "]/g) || []).length, 7); // one column a day
  assert.doesNotMatch(html, /<script/);
  // the preview's figures are apart
  const p = await (await page(env, `cle=${KEY}&periode=7&site=apercu`)).text();
  assert.match(p, /<p class="hero__value">1<\/p>/);
  // weeks over 3 months, months over 12 months
  assert.equal(((await (await page(env, `cle=${KEY}&periode=90`)).text()).match(/class="col[ "]/g) || []).length, 13);
  const year = (await (await page(env, `cle=${KEY}&periode=365`)).text()).match(/class="col[ "]/g).length;
  assert.ok(year === 12 || year === 13, `months: ${year}`);
});

test('comparison with the previous period once it is covered; rows older than 25 months go', async () => {
  const env = fresh();
  const now = Date.now();
  await record(env, [{ site: 'site', kind: 'page', page: '/', entry: 1, source: 'direct' }], now - 800 * DAY);
  await record(env, [{ site: 'site', kind: 'page', page: '/', entry: 1, source: 'direct' }], now - 13 * DAY);
  await record(env, [{ site: 'site', kind: 'page', page: '/', entry: 1, source: 'direct' }], now - 9 * DAY);
  // the first row is gone (purged on the next day's first write)
  assert.equal(rows(env).length, 2);
  await record(env, [{ site: 'site', kind: 'page', page: '/', entry: 1, source: 'direct' }], now);
  const html = await (await page(env, `cle=${KEY}&periode=7`)).text();
  assert.match(html, /<p class="hero__value">1<\/p>/);
  assert.match(html, /class="delta down"><span aria-hidden="true">▼<\/span> −50 %/);
  assert.match(html, /Comparé aux 7 jours précédents/);
});
