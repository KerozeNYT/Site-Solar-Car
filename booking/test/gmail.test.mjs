// Gmail in the workshop's space: the replies written from Gmail and the client's answers come into
// the quote's discussion, the status follows; a quote can be deleted.
import test from 'node:test';
import assert from 'node:assert/strict';
import { generateKeyPairSync, createHmac } from 'node:crypto';
import worker from '../worker.js';
import { Atelier, db } from '../store.js';
import { gmailSync, textOf } from '../gmail.js';
import { installFakes } from './fakes.mjs';
import { fakeDO } from './fake-do.mjs';
import { fakeStats } from './fake-stats.mjs';

const SITE = 'https://www.solarcar37.fr';
const SELF = 'https://atelier.solarcar37.fr';
const CAR = 'contact.solarcar37@gmail.com';
const HOME = 'contact.solarhome37@gmail.com';
const PERSO = 'perso@group.calendar.google.com';
const { privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
const env = {
  ALLOWED_ORIGINS: SITE,
  CALENDAR_WRITE: CAR,
  CALENDARS_BUSY: `${CAR},${HOME},${PERSO}`,
  GOOGLE_SERVICE_ACCOUNT: JSON.stringify({ client_email: 'b@x.iam.gserviceaccount.com', private_key: privateKey.export({ type: 'pkcs8', format: 'pem' }), token_uri: 'https://oauth2.googleapis.com/token' }),
  STRIPE_SECRET_KEY: 'sk_test_x',
  STRIPE_WEBHOOK_SECRET: 'whsec_test',
  RESEND_API_KEY: 're_test',
  NOTIFY_TO: CAR,
  MAIL_CLIENTS: '0',
  STATS: fakeStats(),
  ATELIER: fakeDO(Atelier),
  ATELIER_SECRET: 'secret-de-test',
  GOOGLE_OAUTH_CLIENT_ID: 'client-id',
  GOOGLE_OAUTH_CLIENT_SECRET: 'client-secret',
};
const { mails } = installFakes({ CAR, HOME, PERSO });

// ------------------------------------------------------------------ a pretend Gmail
const b64 = (s) => Buffer.from(s, 'utf8').toString('base64url');
const box = new Map(); // id → message
const put = (id, { from, to, labels, text, at, msgid }) =>
  box.set(id, { id, internalDate: String(at), labelIds: labels, snippet: text.slice(0, 40), payload: { mimeType: 'multipart/alternative', headers: [{ name: 'From', value: from }, { name: 'To', value: to }, { name: 'Message-ID', value: msgid }, { name: 'Subject', value: 'Re: devis' }], parts: [{ mimeType: 'text/plain', body: { data: b64(text) } }, { mimeType: 'text/html', body: { data: b64(`<p>${text}</p>`) } }] } });
const tokens = [];
const prev = globalThis.fetch;
globalThis.fetch = async (input, init = {}) => {
  const url = new URL(typeof input === 'string' ? input : input.url);
  const ok = (j, status = 200) => new Response(JSON.stringify(j), { status, headers: { 'content-type': 'application/json' } });
  if (url.host === 'oauth2.googleapis.com' && /grant_type=(refresh_token|authorization_code)/.test(String(init.body))) {
    const f = new URLSearchParams(init.body);
    tokens.push(f.get('grant_type'));
    if (f.get('client_secret') !== 'client-secret') return ok({ error: 'invalid_client' }, 401);
    if (f.get('grant_type') === 'authorization_code') return f.get('code') === 'bon-code' ? ok({ access_token: 'ya29.g', refresh_token: 'refresh-1', scope: 'https://www.googleapis.com/auth/gmail.readonly' }) : ok({ error: 'invalid_grant' }, 400);
    return f.get('refresh_token') === 'refresh-1' ? ok({ access_token: 'ya29.g' }) : ok({ error: 'invalid_grant' }, 400);
  }
  if (url.host === 'gmail.googleapis.com') {
    if (init.headers?.authorization !== 'Bearer ya29.g') return ok({ error: { message: 'unauthorized' } }, 401);
    const p = url.pathname.replace('/gmail/v1/users/me', '');
    if (p === '/profile') return ok({ emailAddress: CAR });
    if (p === '/messages') {
      const q = url.searchParams.get('q');
      const after = Number(/after:(\d+)/.exec(q)[1]) * 1000;
      const who = /(?:to|from):(\S+)/.exec(q)[1];
      const sent = q.startsWith('in:sent');
      const found = [...box.values()].filter((m) => Number(m.internalDate) >= after && (sent ? m.labelIds.includes('SENT') && m.payload.headers.find((h) => h.name === 'To').value.includes(who) : m.payload.headers.find((h) => h.name === 'From').value.includes(who)));
      return ok(found.length ? { messages: found.map((m) => ({ id: m.id })) } : {});
    }
    const m = /^\/messages\/([^/]+)$/.exec(p);
    if (m && box.has(m[1])) return ok(box.get(m[1]));
    return ok({ error: { message: 'not found' } }, 404);
  }
  return prev(input, init);
};

// ------------------------------------------------------------------ the space
let cookie = '';
const go = (path, { method = 'GET', form } = {}) => worker.fetch(new Request(`${SELF}${path}`, { method, body: form ? new URLSearchParams(form) : undefined, redirect: 'manual', headers: { ...(method === 'GET' ? {} : { origin: SELF }), cookie } }), env);
const where = (res) => new URL(res.headers.get('location'), SELF);
let id;

test('a quote request, the space signed in', async () => {
  const r = await worker.fetch(new Request(`${SELF}/api/demande`, { method: 'POST', body: JSON.stringify({ firstName: 'Léa', lastName: 'Petit', email: 'lea@example.com', phone: '0611111111', make: 'Peugeot', model: '208', services: 'Vitres teintées', message: 'Bonjour, un devis svp' }), headers: { origin: SITE, 'content-type': 'text/plain;charset=UTF-8' } }), env);
  assert.equal(r.status, 204);
  id = (await db(env, 'quotes/list', {})).quotes[0].id;
  await go('/atelier/connexion/code', { method: 'POST' });
  const code = mails.find((m) => /Code de connexion/.test(m.subject)).subject.match(/(\d{6})$/)[1];
  cookie = (await go('/atelier/connexion', { method: 'POST', form: { code } })).headers.get('set-cookie').split(';')[0];
  assert.match(cookie, /^sc37_atelier=/);
});

test('connect Gmail: Google’s answer checked by its signed state, the access kept', async () => {
  const start = await go('/atelier/gmail/connexion');
  const consent = new URL(start.headers.get('location'));
  assert.equal(consent.host, 'accounts.google.com');
  assert.equal(consent.searchParams.get('scope'), 'https://www.googleapis.com/auth/gmail.readonly');
  assert.equal(consent.searchParams.get('redirect_uri'), `${SELF}/atelier/gmail/retour`);
  // a forged state: refused
  const bad = await worker.fetch(new Request(`${SELF}/atelier/gmail/retour?state=123.abc&code=bon-code`), env);
  assert.match(await bad.text(), /Lien\+expir/);
  // the browser comes back from Google without the session cookie
  const back = await worker.fetch(new Request(`${SELF}/atelier/gmail/retour?state=${encodeURIComponent(consent.searchParams.get('state'))}&code=bon-code`), env);
  assert.match(await back.text(), /Gmail\+connect/);
  assert.equal((await db(env, 'setting/get', { key: 'gmail' })).value.refresh, 'refresh-1');
  const list = await (await go('/atelier/devis')).text();
  assert.match(list, /Gmail connecté/);
});

test('a reply written from Gmail and the client’s answer come into the discussion; the status follows', async () => {
  const now = Date.now();
  put('g1', { from: CAR, to: 'Léa Petit <lea@example.com>', labels: ['SENT'], at: now + 1000, msgid: '<g1@mail.gmail.com>', text: 'Bonjour Léa, pour vos vitres : 270 €.\n\nLe lun. 17 nov. 2026 à 10:00, Léa a écrit :\n> Bonjour, un devis svp' });
  put('g2', { from: 'Léa Petit <lea@example.com>', to: CAR, labels: ['INBOX', 'UNREAD'], at: now + 2000, msgid: '<g2@icloud.com>', text: 'Parfait, je réserve !\n> Bonjour Léa' });
  // an e-mail of another client, and one before the request: not read
  put('g3', { from: CAR, to: 'autre@example.com', labels: ['SENT'], at: now + 3000, msgid: '<g3@x>', text: 'Autre' });
  const r = await gmailSync(env, now + 5000, { force: true });
  assert.deepEqual([r.imported, r.checked], [2, 1]);
  const { quote, messages } = await db(env, 'quote/get', { id });
  // the workshop answered, then the client wrote back: « Réponse reçue »
  assert.equal(quote.status, 'reponse');
  const out = messages.find((m) => m.via === 'gmail' && m.dir === 'out');
  assert.equal(out.text, 'Bonjour Léa, pour vos vitres : 270 €.');
  assert.equal(messages.find((m) => m.via === 'gmail' && m.dir === 'in').text, 'Parfait, je réserve !');
  assert.ok(messages.some((m) => m.dir === 'note' && /Réponse envoyée depuis Gmail/.test(m.text)));
  assert.ok(messages.some((m) => m.dir === 'note' && /Réponse du client lue dans Gmail/.test(m.text)));
  assert.ok(quote.unread > 0);
  // read again: nothing twice
  assert.equal((await gmailSync(env, now + 70000, { force: true })).imported, 0);
  // at most once a minute on its own
  assert.equal((await gmailSync(env, now + 80000)).skipped, true);
  const page = await (await go(`/atelier/devis/${id}`)).text();
  assert.match(page, /Parfait, je réserve/);
  assert.match(page, /depuis Gmail/);
});

test('the text of an e-mail: the HTML when there is no text part, the quoted lines left out', () => {
  assert.equal(textOf({ payload: { mimeType: 'text/html', body: { data: b64('<p>Bonjour<br>À jeudi &amp; merci</p><blockquote>x</blockquote>') } } }), 'Bonjour\nÀ jeudi & merci\nx');
  assert.equal(textOf({ snippet: 'Juste un extrait', payload: { mimeType: 'multipart/mixed', parts: [] } }), 'Juste un extrait');
});

test('delete a quote: confirmation asked, the request gone, the client kept', async () => {
  const no = await go(`/atelier/devis/${id}/supprimer`, { method: 'POST', form: {} });
  assert.ok(where(no).searchParams.get('err'));
  assert.ok((await db(env, 'quote/get', { id })).quote);
  const yes = await go(`/atelier/devis/${id}/supprimer`, { method: 'POST', form: { confirme: '1' } });
  assert.equal(where(yes).searchParams.get('ok'), `Demande n°${id} supprimée.`);
  assert.equal((await db(env, 'quote/get', { id })).quote, null);
  assert.equal((await db(env, 'clients/list', { q: 'petit' })).clients.length, 1);
});

test('a refused access: Gmail shown as not connected, nothing breaks', async () => {
  await db(env, 'setting/set', { key: 'gmail', value: { refresh: 'revoque', email: CAR, lastSync: 0 } });
  const r = await gmailSync(env, Date.now(), { force: true });
  assert.ok(r.error);
  assert.equal((await db(env, 'setting/get', { key: 'gmail' })).value, null);
  assert.match(await (await go('/atelier/devis')).text(), /Connecter Gmail/);
});
