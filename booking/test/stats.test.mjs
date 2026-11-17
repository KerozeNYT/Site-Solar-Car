// Visit statistics: what the pages send, what is kept, what the statistics page shows.
import test from 'node:test';
import assert from 'node:assert/strict';
import worker from '../worker.js';
import { hitFromPage, sourceOf, hostOf, record } from '../stats.js';
import { monthFigures, monthMail, sendMonthly, shiftMonth } from '../stats-report.js';
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
  // an ad click (Google Ads adds gclid; other campaigns say utm_medium=cpc)
  assert.equal(sourceOf('google.com', '', '', true), 'pub');
  assert.equal(sourceOf('', 'facebook', 'cpc'), 'pub');
  const ad = hitFromPage(JSON.stringify({ t: 'page', p: '/', e: 1, r: 'google.com', g: 1 }), 'site');
  assert.deepEqual([ad.source, ad.ref], ['pub', '']);
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

const pointsOf = (html) => JSON.parse(html.match(/data-points="([^"]*)"/)[1].replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&'));

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
  const csp = r.headers.get('content-security-policy');
  assert.match(csp, /default-src 'none'/);
  assert.match(csp, /font-src 'self'/);
  assert.equal(r.headers.get('x-robots-tag'), 'noindex, nofollow');
  assert.equal(r.headers.get('cache-control'), 'no-store');
  const html = await r.text();
  // the one script carries the nonce of the policy
  const nonce = csp.match(/'nonce-([a-f0-9]+)'/)[1];
  assert.deepEqual([...html.matchAll(/<script([^>]*)>/g)].map((m) => m[1]), [` nonce="${nonce}"`]);
  assert.match(html, /class="hero__value" data-count="3">3</);
  assert.match(html, /Pages vues<\/p>\s*<p class="tile__value" data-count="5">5</);
  assert.match(html, /Pages par visite<\/p>\s*<p class="tile__value">1,67</);
  assert.match(html, /Demandes envoyées<\/p>\s*<p class="tile__value" data-count="1">1</);
  assert.match(html, /Appels<\/p>\s*<p class="tile__value" data-count="1">1</);
  assert.match(html, /Moteurs de recherche<\/span><span class="rank__val">67 % <small>2<\/small>/);
  assert.doesNotMatch(html, /Publicité<\/span>/); // shown only once there is one
  assert.match(html, /google\.fr <b>2<\/b>/);
  assert.match(html, /<p class="device__pct">67 %<\/p><p class="device__name"><span class="swatch swatch--telephone"/);
  assert.match(html, /Contacts \(demandes, RDV, appels, e-mails\)<\/span><span class="meters__val">66,7<small> \/ 100/);
  assert.match(html, /aria-current="page">7 jours</);
  assert.match(html, /verdict--new/); // nothing to compare with yet
  assert.equal(pointsOf(html).length, 7); // one point a day
  assert.deepEqual(pointsOf(html).slice(-3).map((p) => p.v), [1, 1, 1]);
  // the preview's figures are apart
  const p = await (await page(env, `cle=${KEY}&periode=7&site=apercu`)).text();
  assert.match(p, /class="hero__value" data-count="1">1</);
  // weeks over 3 months, months over 12 months
  assert.equal(pointsOf(await (await page(env, `cle=${KEY}&periode=90`)).text()).length, 13);
  const year = pointsOf(await (await page(env, `cle=${KEY}&periode=365`)).text()).length;
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
  assert.match(html, /class="hero__value" data-count="1">1</);
  assert.match(html, /class="pill pill--down"><span aria-hidden="true">▼<\/span> −50 %/);
  assert.match(html, /verdict--down/);
  assert.match(html, /<strong>En baisse<\/strong> : 1 visite \(−50 %\)/);
  assert.match(html, /Cette période<\/li><li><span class="key key--ghost"><\/span>Période précédente/);
});

test('monthly e-mail: the month against the one before, sent on the 1st, nothing before the first visit', async () => {
  const env = { ...fresh(), RESEND_API_KEY: 're_test', NOTIFY_TO: 'atelier@example.com', STATS_PAGE: 'https://reservation.solarcar37.fr/stats' };
  const sent = [];
  const realFetch = globalThis.fetch;
  globalThis.fetch = async (url, init) => {
    if (String(url).startsWith('https://api.resend.com/')) {
      sent.push(JSON.parse(init.body));
      return new Response(JSON.stringify({ id: 'm1' }), { status: 200 });
    }
    return realFetch(url, init);
  };
  try {
    const at = (ymd) => Date.parse(`${ymd}T10:00:00Z`);
    // nothing counted yet: no e-mail
    assert.deepEqual(await sendMonthly(env, at('2026-12-01')), { sent: false, why: 'no visit yet' });
    // October: 2 visits; November: 3 visits, a request, a booking
    for (const d of ['2026-10-05', '2026-10-20']) await record(env, [{ site: 'site', kind: 'page', page: '/', entry: 1, source: 'moteurs', ref: 'google.fr' }], at(d));
    for (const d of ['2026-11-02', '2026-11-10', '2026-11-28']) await record(env, [{ site: 'site', kind: 'page', page: '/vitres-teintees/', entry: 1, source: 'direct' }], at(d));
    await record(env, [{ site: 'site', kind: 'demande_envoyee', page: '/contact/' }, { site: 'site', kind: 'rdv', page: '/reservation/', detail: 'Feux teintés', value: 120 }], at('2026-11-12'));
    const f = await monthFigures(env, '2026-11');
    assert.deepEqual([f.cur.visits, f.prev.visits, f.cur.requests, f.cur.paid], [3, 2, 2, 120]);
    const mail = monthMail(f, { dashboard: 'https://x/stats?cle=k' });
    assert.equal(mail.subject, 'Bilan de novembre 2026 : 3 visites (+50 %), 2 demandes et RDV');
    assert.match(mail.html, /Mois en hausse : 3 visites, \+50 % par rapport à octobre/);
    assert.match(mail.html, /Ouvrir le tableau de bord/);
    const r = await sendMonthly(env, at('2026-12-01'));
    assert.equal(r.sent, true);
    assert.equal(sent.length, 1);
    assert.deepEqual(sent[0].to, ['atelier@example.com']);
    assert.match(sent[0].html, /\/stats\?cle=cle-de-test/);
    // the cron of the worker does the same
    let pending;
    await worker.scheduled({ scheduledTime: at('2026-12-01') }, env, { waitUntil: (p) => (pending = p) });
    await pending;
    assert.equal(sent.length, 2);
    // in the browser (key required), and sent now as a test
    assert.equal((await worker.fetch(new Request('https://reservation.solarcar37.fr/stats/bilan?mois=2026-11'), env)).status, 403);
    const view = await worker.fetch(new Request(`https://reservation.solarcar37.fr/stats/bilan?cle=${KEY}&mois=2026-11`), env);
    assert.match(await view.text(), /Bilan de novembre 2026/);
    const test = await (await worker.fetch(new Request(`https://reservation.solarcar37.fr/stats/bilan?cle=${KEY}&mois=2026-11`, { method: 'POST' }), env)).json();
    assert.match(test.subject, /^\[Essai\] Bilan de novembre 2026/);
    assert.equal(sent.length, 3);
  } finally {
    globalThis.fetch = realFetch;
  }
  assert.equal(shiftMonth('2026-01', -1), '2025-12');
});

test('« Comment nous avez-vous connus ? »: one row per ticked box, sorted on the page, in the monthly e-mail', async () => {
  const env = fresh();
  // the quote form: social networks and « Autre » with its text; another with nothing ticked
  await send(env, { t: 'connu', p: '/contact/', d: 'telephone', c: ['Réseaux sociaux (Instagram, Facebook…)', 'Autre', 'Pirate'], o: 'Salon auto de Tours "<>' });
  await send(env, { t: 'connu', p: '/contact/', d: 'ordinateur', c: [] });
  await send(env, { t: 'connu', p: '/contact/', c: ['Réseaux sociaux (Instagram, Facebook…)'] });
  const r = rows(env).filter((x) => x.kind === 'connu');
  assert.deepEqual(r.map((x) => [x.source, x.detail]), [['reseaux', ''], ['autre', 'Salon auto de Tours'], ['sans', ''], ['reseaux', '']]);
  const html = await (await page(env, `cle=${KEY}`)).text();
  assert.match(html, /Comment ils vous ont connus/);
  // most frequent first, « Sans réponse » last, the « Autre » texts listed
  const block = html.slice(html.indexOf('Comment ils vous ont connus'));
  assert.ok(block.indexOf('Réseaux sociaux') < block.indexOf('>Autre<') && block.indexOf('>Autre<') < block.indexOf('Sans réponse'));
  assert.match(block, /Salon auto de Tours <b>1<\/b>/);
  // nor are they counted as contacts
  assert.doesNotMatch(html.slice(html.indexOf('Contacts : depuis quelles pages'), html.indexOf('Comment ils vous ont connus')), /connu/);
  const month = new Date().toISOString().slice(0, 7);
  const mail = monthMail(await monthFigures(env, month), {});
  assert.match(mail.html || mail, /Comment ils vous ont connus[\s\S]*Réseaux sociaux[\s\S]*>2</);
});
