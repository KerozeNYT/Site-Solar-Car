// The Google Business Profile robot: the photo queue, the Google sign-in, the weekly photo, the
// fallbacks and the e-mails, against an in-memory Google, site and Resend.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import worker from '../worker.js';
import { Fiche, runFiche, nextRun, FICHE_CRON } from '../fiche-google.js';
import { queue, sentByHand, categoryOf, extra } from '../../content/fiche-google.js';
import { realisations } from '../../content/realisations.js';
import { business as B } from '../../content/site.js';

const DAY = 86400000;
const KEY = 'cle-de-test-0123456789abcdefghij';
const SERVER = 'https://solarcar37-reservation.example.workers.dev';
const SITE = 'https://kerozenyt.github.io/Site-Solar-Car';
const T0 = Date.parse('2026-11-24T08:17:00Z'); // a Tuesday, at the cron's time

function fakeFiche() {
  const map = new Map();
  const object = new Fiche({ storage: { get: async (k) => structuredClone(map.get(k)), put: async (k, v) => void map.set(k, structuredClone(v)) } });
  return { state: () => map.get('state') || {}, idFromName: (n) => n, get: () => ({ fetch: (input, init) => object.fetch(new Request(input, init)) }) };
}

/** Google, the site and Resend, in memory; `g` steers the answers */
function installGoogle(g = {}) {
  const calls = [];
  const mails = [];
  const media = [];
  const uploads = [];
  const manifest = { photos: queue().map((p) => ({ ...p, file: `${p.id}.jpg` })) };
  const real = globalThis.fetch;
  globalThis.fetch = async (input, init = {}) => {
    const url = new URL(typeof input === 'string' ? input : input.url);
    const method = init.method || 'GET';
    const auth = init.headers?.authorization || '';
    calls.push(`${method} ${url.host}${url.pathname}`);
    const ok = (j, status = 200) => new Response(JSON.stringify(j), { status, headers: { 'content-type': 'application/json' } });
    if (url.host === 'oauth2.googleapis.com') {
      const f = new URLSearchParams(init.body);
      assert.equal(f.get('client_id'), 'client.apps.googleusercontent.com');
      assert.equal(f.get('client_secret'), 'GOCSPX-secret');
      if (f.get('grant_type') === 'authorization_code') {
        assert.equal(f.get('redirect_uri'), `${SERVER}/fiche-google/retour`);
        return f.get('code') === 'good' ? ok({ access_token: 'ya29.first', refresh_token: '1//refresh', scope: 'https://www.googleapis.com/auth/business.manage', expires_in: 3599 }) : ok({ error: 'invalid_grant' }, 400);
      }
      return f.get('refresh_token') === '1//refresh' ? ok({ access_token: 'ya29.again', expires_in: 3599 }) : ok({ error: 'invalid_grant', error_description: 'Token has been expired or revoked.' }, 400);
    }
    if (url.host.startsWith('mybusiness')) assert.match(auth, /^Bearer ya29\./);
    if (url.host === 'mybusinessaccountmanagement.googleapis.com') {
      if (g.pending) return ok({ error: { code: 429, message: "Quota exceeded for quota metric 'Requests' and limit 'Requests per minute' of service 'mybusinessaccountmanagement.googleapis.com'", status: 'RESOURCE_EXHAUSTED' } }, 429);
      return ok({ accounts: [{ name: 'accounts/111', type: 'PERSONAL' }] });
    }
    if (url.host === 'mybusinessbusinessinformation.googleapis.com') {
      assert.equal(url.pathname, '/v1/accounts/111/locations');
      assert.match(url.searchParams.get('readMask'), /metadata/);
      return ok({
        locations: [
          { name: 'locations/999', title: 'Autre atelier', metadata: { placeId: 'ChIJother' } },
          { name: 'locations/222', title: 'SOLAR CAR 37', storefrontAddress: { addressLines: ['395 rue des Entrepreneurs'], postalCode: '37210', locality: 'Vouvray' }, metadata: { placeId: B.google.placeId, mapsUri: 'https://maps.google.com/?cid=1' } },
        ],
      });
    }
    if (url.host === 'mybusiness.googleapis.com') {
      if (url.pathname === '/v4/accounts/111/locations/222/media:startUpload') return ok({ resourceName: 'AF1Qip-ref' });
      if (url.pathname === '/upload/v1/media/AF1Qip-ref') {
        assert.equal(url.searchParams.get('upload_type'), 'media');
        assert.equal(init.headers['content-type'], 'image/jpeg');
        uploads.push(init.body.byteLength);
        return ok({});
      }
      assert.equal(url.pathname, '/v4/accounts/111/locations/222/media');
      const b = JSON.parse(init.body);
      if (b.sourceUrl && g.refuseUrl) return ok({ error: { code: 400, message: 'Request contains an invalid argument.', status: 'INVALID_ARGUMENT' } }, 400);
      media.push(b);
      return ok({ name: `accounts/111/locations/222/media/m${media.length}`, googleUrl: `https://lh3.googleusercontent.com/p/m${media.length}` });
    }
    if (url.href === `${SITE}/fiche-google/photos.json`) return g.noSite ? new Response('not found', { status: 404 }) : ok(manifest);
    if (url.href.startsWith(`${SITE}/fiche-google/`) && url.pathname.endsWith('.jpg')) return new Response(new Uint8Array(40000), { headers: { 'content-type': 'image/jpeg' } });
    if (url.host === 'api.resend.com') {
      mails.push(JSON.parse(init.body));
      return ok({ id: `mail${mails.length}` });
    }
    return real(input, init);
  };
  return { calls, mails, media, uploads, manifest, restore: () => (globalThis.fetch = real) };
}

const fresh = (extraEnv = {}) => ({
  STATS_KEY: KEY,
  STATS_PAGE: `${SERVER}/stats`,
  SITE_URL: SITE,
  GOOGLE_OAUTH_CLIENT_ID: 'client.apps.googleusercontent.com',
  GOOGLE_OAUTH_CLIENT_SECRET: 'GOCSPX-secret',
  RESEND_API_KEY: 're_test',
  NOTIFY_TO: 'contact.solarcar37@gmail.com',
  FICHE: fakeFiche(),
  ...extraEnv,
});
const get = (env, path, init) => worker.fetch(new Request(`${SERVER}${path}`, init), env);

/** signs in through the two routes, as the owner would */
async function connectAccount(env) {
  const r = await get(env, `/fiche-google/connexion?cle=${KEY}`);
  assert.equal(r.status, 302);
  const state = new URL(r.headers.get('location')).searchParams.get('state');
  return get(env, `/fiche-google/retour?code=good&state=${encodeURIComponent(state)}`);
}

test('queue: every photo of the gallery once, the ones sent by hand left out, one job after another', () => {
  const q = queue();
  const ids = q.map((p) => p.id);
  const all = [...realisations.flatMap((r) => r.photos.map((p) => p.id)), ...extra.map((p) => p.id)];
  assert.equal(new Set(ids).size, ids.length);
  assert.equal(ids.filter((id) => sentByHand.includes(id)).length, 0);
  assert.deepEqual([...ids].sort(), all.filter((id) => !sentByHand.includes(id)).sort());
  // round robin: the first photos come from different jobs, in the gallery's order
  const jobOf = (id) => realisations.findIndex((r) => r.photos.some((p) => p.id === id));
  const firsts = ids.slice(0, 5).map(jobOf);
  assert.equal(new Set(firsts).size, 5);
  assert.deepEqual(firsts, [...firsts].sort((a, b) => a - b));
  // a photo whose web version does not exist yet waits
  assert.ok(!queue((id) => id !== ids[0]).some((p) => p.id === ids[0]));
  assert.equal(categoryOf('BMW en covering or chromé dans l’atelier'), 'INTERIOR');
  assert.equal(categoryOf('McLaren 720S pendant la pose : portes ouvertes'), 'AT_WORK');
  assert.equal(categoryOf('Porsche 911 orange devant l’atelier SOLAR CAR'), 'EXTERIOR');
  assert.equal(categoryOf('Audi A7 Sportback grise de profil'), 'ADDITIONAL');
  // every photo has its 1280 px web version, which the build turns into the JPG
  for (const id of ids) assert.ok(fs.existsSync(new URL(`../../public/img/realisations/${id}-1280.webp`, import.meta.url)), id);
});

test('the cron of wrangler.toml is the one the server answers to, every Tuesday', () => {
  const toml = fs.readFileSync(new URL('../wrangler.toml', import.meta.url), 'utf8');
  assert.ok(toml.includes(`"${FICHE_CRON}"`));
  assert.match(toml, /class_name = "Fiche"/);
  assert.equal(nextRun(Date.parse('2026-11-23T10:00:00Z')), T0);
  assert.equal(nextRun(T0), T0 + 7 * DAY);
});

test('pages: the key is required, the consent link asks for offline access to the profile', async () => {
  const env = fresh();
  assert.equal((await get(env, '/fiche-google')).status, 403);
  assert.equal((await get(env, '/fiche-google?cle=mauvaise')).status, 403);
  assert.equal((await get(env, `/fiche-google/connexion?cle=${KEY}`, { method: 'POST' })).status, 404);
  const unset = await worker.fetch(new Request(`${SERVER}/fiche-google/connexion?cle=${KEY}`), fresh({ GOOGLE_OAUTH_CLIENT_SECRET: '' }));
  assert.equal(unset.status, 503);
  const r = await get(env, `/fiche-google/connexion?cle=${KEY}`);
  const u = new URL(r.headers.get('location'));
  assert.equal(u.origin + u.pathname, 'https://accounts.google.com/o/oauth2/v2/auth');
  assert.equal(u.searchParams.get('client_id'), 'client.apps.googleusercontent.com');
  assert.equal(u.searchParams.get('redirect_uri'), `${SERVER}/fiche-google/retour`);
  assert.equal(u.searchParams.get('scope'), 'https://www.googleapis.com/auth/business.manage');
  assert.equal(u.searchParams.get('access_type'), 'offline');
  assert.equal(u.searchParams.get('prompt'), 'consent');
  // Google's answer is refused without a fresh, signed state
  assert.equal((await get(env, '/fiche-google/retour?code=good&state=1700000000000.forged')).status, 400);
  assert.equal((await get(env, '/fiche-google/retour?code=good')).status, 400);
  const page = await get(env, `/fiche-google?cle=${KEY}`);
  assert.equal(page.status, 200);
  assert.equal(page.headers.get('x-robots-tag'), 'noindex, nofollow');
  assert.match(page.headers.get('content-security-policy'), /default-src 'none'/);
});

test('sign-in: the refresh token is kept and the profile found by its Place ID', async () => {
  const g = installGoogle();
  try {
    const env = fresh();
    const r = await connectAccount(env);
    assert.equal(r.status, 200);
    const html = await r.text();
    assert.match(html, /Fiche trouvée/);
    assert.match(html, /395 rue des Entrepreneurs, 37210 Vouvray/);
    const st = env.FICHE.state();
    assert.equal(st.refreshToken, '1//refresh');
    assert.deepEqual([st.account, st.location, st.title], ['accounts/111', 'locations/222', 'SOLAR CAR 37']);
    // the status page shows the account, the profile and the next photo
    const page = await (await get(env, `/fiche-google?cle=${KEY}`)).text();
    assert.match(page, /Compte Google connecté/);
    assert.ok(page.includes(g.manifest.photos[0].file));
    assert.match(page, /Publier cette photo maintenant/);
    assert.ok(!page.includes('1//refresh'));
  } finally {
    g.restore();
  }
});

test('weekly photo: sent by its address, once a week, in the queue order, with an e-mail', async () => {
  const g = installGoogle();
  try {
    const env = fresh();
    await connectAccount(env);
    // the Tuesday cron
    await worker.scheduled({ cron: FICHE_CRON, scheduledTime: T0 }, env, { waitUntil: (p) => p });
    await new Promise((r) => setTimeout(r, 20));
    const [first, second, third] = g.manifest.photos;
    assert.equal(g.media.length, 1);
    assert.deepEqual(g.media[0], { mediaFormat: 'PHOTO', locationAssociation: { category: first.category }, description: first.description, sourceUrl: `${SITE}/fiche-google/${first.file}` });
    assert.deepEqual(env.FICHE.state().sent.map((s) => s.id), [first.id]);
    assert.equal(g.mails.length, 1);
    assert.match(g.mails[0].subject, /nouvelle photo publiée/);
    assert.ok(g.mails[0].html.includes(`${SITE}/fiche-google/${first.file}`));
    // not twice in the same week, even if the cron fires again
    assert.equal((await runFiche(env, T0 + DAY)).why, 'sent recently');
    // the button of the status page sends the next one at once
    const r = await get(env, `/fiche-google/envoyer?cle=${KEY}`, { method: 'POST' });
    assert.equal(r.status, 303);
    assert.equal(r.headers.get('location'), `/fiche-google?cle=${KEY}`);
    assert.deepEqual(env.FICHE.state().sent.map((s) => s.id), [first.id, second.id]);
    // the next Tuesday
    const done = await runFiche(env, T0 + 7 * DAY);
    assert.equal(done.id, third.id);
    assert.equal(done.left, g.manifest.photos.length - 3);
    assert.equal(g.uploads.length, 0);
  } finally {
    g.restore();
  }
});

test('weekly photo: if Google cannot fetch the address, the server uploads the bytes', async () => {
  const g = installGoogle({ refuseUrl: true });
  try {
    const env = fresh({ FICHE_MAILS: 'erreurs' });
    await connectAccount(env);
    const done = await runFiche(env, T0);
    assert.equal(done.done, true);
    assert.deepEqual(g.uploads, [40000]);
    assert.deepEqual(g.media[0].dataRef, { resourceName: 'AF1Qip-ref' });
    assert.equal(g.media[0].sourceUrl, undefined);
    assert.equal(g.mails.length, 0); // FICHE_MAILS = "erreurs"
  } finally {
    g.restore();
  }
});

test('waiting for Google: the API is not open yet; one e-mail, then quiet, then it starts by itself', async () => {
  const google = { pending: true };
  const g = installGoogle(google);
  try {
    const env = fresh();
    const r = await connectAccount(env);
    assert.match(await r.text(), /quota à 0/);
    assert.equal(env.FICHE.state().refreshToken, '1//refresh');
    assert.equal(env.FICHE.state().location, null);
    const a = await runFiche(env, T0);
    assert.equal(a.why, 'error');
    assert.match(a.message, /en attente de la réponse/);
    assert.equal(g.mails.length, 1);
    assert.match(g.mails[0].subject, /attend Google/);
    assert.ok(g.mails[0].html.includes(`${SERVER}/fiche-google?cle=${KEY}`));
    await runFiche(env, T0 + 7 * DAY);
    assert.equal(g.mails.length, 1); // the same message is not repeated every week
    // Google opens the access: the next Tuesday finds the profile and sends the first photo
    google.pending = false;
    const ok = await runFiche(env, T0 + 14 * DAY);
    assert.equal(ok.done, true);
    assert.equal(env.FICHE.state().location, 'locations/222');
    assert.equal(g.media.length, 1);
  } finally {
    g.restore();
  }
});

test('access withdrawn: the robot stops, forgets the token and says so', async () => {
  const g = installGoogle();
  try {
    const env = fresh();
    await connectAccount(env);
    await env.FICHE.get().fetch('https://fiche/state', { method: 'POST', body: JSON.stringify({ set: { refreshToken: '1//revoked' } }) });
    const r = await runFiche(env, T0);
    assert.equal(r.why, 'error');
    assert.match(r.message, /reconnectez/);
    assert.equal(env.FICHE.state().refreshToken, null);
    assert.match(g.mails.at(-1).subject, /n’est pas partie/);
    assert.equal((await runFiche(env, T0 + 7 * DAY)).why, 'not connected');
    const page = await (await get(env, `/fiche-google?cle=${KEY}`)).text();
    assert.match(page, /Connecter le compte Google de la fiche/);
  } finally {
    g.restore();
  }
});

test('queue empty: one e-mail asking for a new job, not every week', async () => {
  const g = installGoogle();
  try {
    const env = fresh();
    await connectAccount(env);
    const sent = g.manifest.photos.map((p, i) => ({ id: p.id, at: T0 - (i + 1) * 7 * DAY }));
    await env.FICHE.get().fetch('https://fiche/state', { method: 'POST', body: JSON.stringify({ set: { sent } }) });
    assert.equal((await runFiche(env, T0)).why, 'empty');
    assert.equal((await runFiche(env, T0 + 7 * DAY)).why, 'empty');
    assert.equal(g.mails.filter((m) => /plus de photo en attente/.test(m.subject)).length, 1);
    assert.equal(g.media.length, 0);
    const page = await (await get(env, `/fiche-google?cle=${KEY}`)).text();
    assert.match(page, /Plus aucune photo en attente/);
  } finally {
    g.restore();
  }
});

test('not connected, or no queue on the site: nothing is sent, the status page says why', async () => {
  const g = installGoogle({ noSite: true });
  try {
    const env = fresh();
    assert.equal((await runFiche(env, T0)).why, 'not connected');
    assert.equal(g.calls.filter((c) => c.includes('mybusiness')).length, 0);
    await connectAccount(env);
    const r = await runFiche(env, T0);
    assert.match(r.message, /liste des photos illisible/);
    const page = await (await get(env, `/fiche-google?cle=${KEY}`)).text();
    assert.match(page, /liste des photos illisible/);
  } finally {
    g.restore();
  }
});

test('the monthly cron still sends the statistics e-mail, not a photo', async () => {
  const g = installGoogle();
  try {
    const env = fresh();
    await connectAccount(env);
    await worker.scheduled({ cron: '0 7 1 * *', scheduledTime: T0 }, env, { waitUntil: (p) => p });
    await new Promise((r) => setTimeout(r, 20));
    assert.equal(g.media.length, 0);
  } finally {
    g.restore();
  }
});
