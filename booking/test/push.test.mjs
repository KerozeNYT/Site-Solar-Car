// Notifications on the workshop's devices (booking/push.js): a device subscribes from the space;
// a quote request, a client's message, an accepted quote send it a notification, signed (VAPID)
// and encrypted (RFC 8291) — read back here with the device's own key; a device gone is forgotten.
import test from 'node:test';
import assert from 'node:assert/strict';
import worker from '../worker.js';
import { Atelier } from '../store.js';
import { installFakes } from './fakes.mjs';
import { fakeDO } from './fake-do.mjs';
import { fakeStats } from './fake-stats.mjs';

const SITE = 'https://www.solarcar37.fr';
const SELF = 'https://atelier.solarcar37.fr';
const OWNER = 'contact.solarcar37@gmail.com';
const env = {
  ALLOWED_ORIGINS: SITE,
  RESEND_API_KEY: 're_test',
  NOTIFY_TO: OWNER,
  MAIL_FROM: 'SOLAR CAR 37 <reservation@solarcar37.fr>',
  MAIL_CLIENTS: '1',
  SITE_URL: SITE,
  QUOTE_REPLY: 'devis@reponse.solarcar37.fr',
  ATELIER_SECRET: 'secret-de-test',
  STATS: fakeStats(),
  ATELIER: fakeDO(Atelier, () => env),
};
const { mails } = installFakes({ CAR: OWNER });
// the push service of the device (Apple's, here): what it receives
const pushed = [];
let pushStatus = 201;
const before = globalThis.fetch;
globalThis.fetch = async (input, init = {}) => {
  const url = new URL(typeof input === 'string' ? input : input.url);
  if (url.host === 'web.push.apple.com') {
    pushed.push({ url: url.href, headers: init.headers, body: new Uint8Array(init.body) });
    return new Response(null, { status: pushStatus });
  }
  return before(input, init);
};

const b64u = (bytes) => Buffer.from(bytes).toString('base64url');
const enc = new TextEncoder();
const concat = (...p) => Uint8Array.from(Buffer.concat(p.map((x) => Buffer.from(x))));
async function hmac(key, data) {
  const k = await crypto.subtle.importKey('raw', key, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return new Uint8Array(await crypto.subtle.sign('HMAC', k, data));
}
const hkdf = async (salt, ikm, info, n) => (await hmac(await hmac(salt, ikm), concat(info, [1]))).slice(0, n);

// the device: its key pair and its secret, as a browser makes them
const device = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']);
const devicePublic = new Uint8Array(await crypto.subtle.exportKey('raw', device.publicKey));
const authSecret = crypto.getRandomValues(new Uint8Array(16));
const ENDPOINT = 'https://web.push.apple.com/QGz5example-device-token';

/** a notification as the device reads it (RFC 8291 / RFC 8188) */
async function read(body) {
  const salt = body.slice(0, 16);
  const idlen = body[20];
  const asPublic = body.slice(21, 21 + idlen);
  const cipher = body.slice(21 + idlen);
  const peer = await crypto.subtle.importKey('raw', asPublic, { name: 'ECDH', namedCurve: 'P-256' }, false, []);
  const shared = new Uint8Array(await crypto.subtle.deriveBits({ name: 'ECDH', public: peer }, device.privateKey, 256));
  const ikm = await hkdf(authSecret, shared, concat(enc.encode('WebPush: info\0'), devicePublic, asPublic), 32);
  const cek = await hkdf(salt, ikm, enc.encode('Content-Encoding: aes128gcm\0'), 16);
  const nonce = await hkdf(salt, ikm, enc.encode('Content-Encoding: nonce\0'), 12);
  const key = await crypto.subtle.importKey('raw', cek, 'AES-GCM', false, ['decrypt']);
  const plain = new Uint8Array(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: nonce }, key, cipher));
  let end = plain.length - 1;
  while (end > 0 && plain[end] === 0) end--;
  assert.equal(plain[end], 2, 'last record delimiter');
  return JSON.parse(new TextDecoder().decode(plain.slice(0, end)));
}
/** the VAPID header is signed by the key the device subscribed with, for that push service */
async function checkVapid(headers, vapidPublic) {
  const m = /^vapid t=([^.]+)\.([^.]+)\.([^,]+), k=(.+)$/.exec(headers.authorization);
  assert.ok(m, headers.authorization);
  assert.equal(m[4], vapidPublic);
  const claims = JSON.parse(Buffer.from(m[2], 'base64url').toString());
  assert.equal(claims.aud, 'https://web.push.apple.com');
  assert.ok(claims.exp * 1000 > Date.now());
  const key = await crypto.subtle.importKey('raw', Buffer.from(m[4], 'base64url'), { name: 'ECDSA', namedCurve: 'P-256' }, false, ['verify']);
  assert.ok(await crypto.subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, key, Buffer.from(m[3], 'base64url'), enc.encode(`${m[1]}.${m[2]}`)));
  assert.equal(headers['content-encoding'], 'aes128gcm');
}

let cookie = '';
const go = (path, { method = 'GET', form, json } = {}) => worker.fetch(new Request(`${SELF}${path}`, { method, body: form ? new URLSearchParams(form) : json ? JSON.stringify(json) : undefined, redirect: 'manual', headers: { origin: method === 'GET' ? undefined : SELF, cookie, ...(json ? { 'content-type': 'application/json' } : {}) } }), env);
let vapidPublic = '';

test('the device subscribes from « Plus »; the try reaches it, encrypted for it alone', async () => {
  await go('/atelier/connexion/code', { method: 'POST' });
  const code = mails.at(-1).subject.match(/(\d{6})$/)[1];
  cookie = (await go('/atelier/connexion', { method: 'POST', form: { code } })).headers.get('set-cookie').split(';')[0];
  const page = await (await go('/atelier/plus')).text();
  vapidPublic = page.match(/data-push="([A-Za-z0-9_-]+)"/)[1];
  assert.equal(Buffer.from(vapidPublic, 'base64url').length, 65);
  // the service worker, served to anyone (it holds nothing)
  const sw = await worker.fetch(new Request(`${SELF}/atelier/sw.js`), env);
  assert.equal(sw.headers.get('content-type'), 'text/javascript; charset=utf-8');
  assert.match(await sw.text(), /showNotification/);
  // signed out: refused
  assert.equal((await worker.fetch(new Request(`${SELF}/atelier/push/abonner`, { method: 'POST', headers: { origin: SELF }, body: '{}' }), env)).status, 401);
  const sub = { endpoint: ENDPOINT, keys: { p256dh: b64u(devicePublic), auth: b64u(authSecret) }, label: 'iPhone' };
  assert.deepEqual(await (await go('/atelier/push/abonner', { method: 'POST', json: sub })).json(), { ok: true, n: 1 });
  assert.match(await (await go('/atelier/plus')).text(), /1 appareil abonné : iPhone/);
  pushed.length = 0;
  assert.deepEqual(await (await go('/atelier/push/test', { method: 'POST', json: {} })).json(), { ok: true, sent: 1 });
  const [p] = pushed;
  assert.equal(p.url, ENDPOINT);
  await checkVapid(p.headers, vapidPublic);
  assert.equal((await read(p.body)).title, 'Notifications activées');
});

test('a quote request, the client’s message, the quote accepted: each one a notification', async () => {
  pushed.length = 0;
  const res = await worker.fetch(
    new Request(`${SELF}/api/demande`, { method: 'POST', headers: { origin: SITE, 'content-type': 'text/plain;charset=UTF-8' }, body: JSON.stringify({ v: 2, firstName: 'Léa', lastName: 'Petit', email: 'lea@example.com', phone: '06 11 11 11 11', make: 'Mini', model: 'F56', year: '2015', services: 'Ciel étoilé', message: 'Un ciel étoilé svp.', consent: true, files: [] }) }),
    env
  );
  // the site's answer: nothing of the workshop's (number, name)
  assert.deepEqual(await res.json(), { ok: true, ack: true });
  const n = env.ATELIER.db.prepare('SELECT id FROM requests').all()[0].id;
  const m1 = await read(pushed[0].body);
  assert.deepEqual(m1, { title: `Nouvelle demande de devis n°${n}`, body: 'Léa Petit — Ciel étoilé', url: `/atelier/devis/${n}`, tag: `devis-${n}` });
  // the client answers by e-mail (relay)
  pushed.length = 0;
  const raw = `From: Léa Petit <lea@example.com>\r\nTo: devis@reponse.solarcar37.fr\r\nSubject: Re: Demande de devis n°${n}\r\nMessage-ID: <lea-2@example.com>\r\nContent-Type: text/plain; charset="UTF-8"\r\n\r\nLe 24 novembre, c'est possible ?\r\n`;
  const bytes = new TextEncoder().encode(raw);
  await worker.email({ from: 'lea@example.com', to: 'devis@reponse.solarcar37.fr', rawSize: bytes.length, raw: new Response(bytes).body, headers: new Headers(), setReject: () => {} }, env);
  const m2 = await read(pushed[0].body);
  assert.equal(m2.title, 'Message de Léa');
  assert.match(m2.body, /24 novembre/);
  // accepted from the e-mail's button
  pushed.length = 0;
  const token = env.ATELIER.db.prepare('SELECT token FROM requests WHERE id = ?').all(n)[0].token;
  await worker.fetch(new Request(`${SELF}/api/devis/accepter`, { method: 'POST', headers: { origin: SITE }, body: JSON.stringify({ n, t: token }) }), env);
  assert.equal((await read(pushed[0].body)).title, `Devis n°${n} accepté`);
});

test('a device that unsubscribed (410 from its push service) is forgotten; « Désactiver ici » too', async () => {
  pushStatus = 410;
  assert.equal((await (await go('/atelier/push/test', { method: 'POST', json: {} })).json()).sent, 0);
  assert.equal(env.ATELIER.db.prepare('SELECT COUNT(*) AS n FROM push_subs').all()[0].n, 0);
  pushStatus = 201;
  const sub = { endpoint: ENDPOINT, keys: { p256dh: b64u(devicePublic), auth: b64u(authSecret) }, label: 'Mac' };
  await go('/atelier/push/abonner', { method: 'POST', json: sub });
  await go('/atelier/push/desabonner', { method: 'POST', json: { endpoint: ENDPOINT } });
  assert.equal(env.ATELIER.db.prepare('SELECT COUNT(*) AS n FROM push_subs').all()[0].n, 0);
  // nothing to read: refused
  assert.equal((await (await go('/atelier/push/abonner', { method: 'POST', json: { endpoint: 'http://x', keys: {} } })).json()).ok, false);
});
