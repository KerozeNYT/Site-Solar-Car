/**
 * Notifications of the workshop's space on its phone and its computers (Web Push): « Nouvelle
 * demande de devis », « Message de Léa », « Devis n°12 accepté », « RDV réservé et payé ». No
 * outside service: the server signs and encrypts each notification itself (Web Crypto) and hands
 * it to the push service of the device (Apple, Google, Mozilla…), as the standards say:
 *   - VAPID (RFC 8292): the server's key pair, made once and kept in the workshop's database
 *     (setting « vapid »); the public key is given to the device when it subscribes
 *   - message encryption (RFC 8291, « aes128gcm », RFC 8188): only the device can read it
 * An iPhone receives them once the space is on its home screen (iOS 16.4+), « Activer » tapped in
 * Réglages; a computer from its browser. Subscriptions: table push_subs (booking/store.js).
 */
import { db } from './store.js';

const enc = new TextEncoder();
const b64u = (bytes) => {
  let s = '';
  for (const b of new Uint8Array(bytes)) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};
const unb64u = (s) => Uint8Array.from(atob(String(s).replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((String(s).length + 3) % 4)), (c) => c.charCodeAt(0));
const concat = (...parts) => {
  const out = new Uint8Array(parts.reduce((a, p) => a + p.length, 0));
  let i = 0;
  for (const p of parts) {
    out.set(p, i);
    i += p.length;
  }
  return out;
};

async function hmac(key, data) {
  const k = await crypto.subtle.importKey('raw', key, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return new Uint8Array(await crypto.subtle.sign('HMAC', k, data));
}
/** HKDF (RFC 5869) with SHA-256: extract then expand to `length` bytes (32 at most) */
const hkdf = async (salt, ikm, info, length) => (await hmac(await hmac(salt, ikm), concat(info, new Uint8Array([1])))).slice(0, length);

/** the server's VAPID key pair, made once: { publicKey (base64url, raw), privateJwk } */
export async function vapidKeys(env) {
  const kept = (await db(env, 'setting/get', { key: 'vapid' })).value;
  if (kept?.publicKey && kept?.privateJwk) return kept;
  const pair = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
  const keys = { publicKey: b64u(await crypto.subtle.exportKey('raw', pair.publicKey)), privateJwk: await crypto.subtle.exportKey('jwk', pair.privateKey) };
  await db(env, 'setting/set', { key: 'vapid', value: keys });
  return keys;
}

/** the « Authorization » header for one push service (VAPID, ES256 JWT valid 1 h, made for each sending) */
async function vapidHeader(keys, endpoint, now) {
  const head = b64u(enc.encode(JSON.stringify({ typ: 'JWT', alg: 'ES256' })));
  const body = b64u(enc.encode(JSON.stringify({ aud: new URL(endpoint).origin, exp: Math.floor(now / 1000) + 3600, sub: 'mailto:contact@solarcar37.fr' })));
  const key = await crypto.subtle.importKey('jwk', keys.privateJwk, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, key, enc.encode(`${head}.${body}`));
  return `vapid t=${head}.${body}.${b64u(sig)}, k=${keys.publicKey}`;
}

/** the message encrypted for one device (RFC 8291): salt, record size, our public key, cipher */
export async function encrypt(sub, payload) {
  const uaPublic = unb64u(sub.p256dh);
  const auth = unb64u(sub.auth);
  const local = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']);
  const asPublic = new Uint8Array(await crypto.subtle.exportKey('raw', local.publicKey));
  const peer = await crypto.subtle.importKey('raw', uaPublic, { name: 'ECDH', namedCurve: 'P-256' }, false, []);
  const shared = new Uint8Array(await crypto.subtle.deriveBits({ name: 'ECDH', public: peer }, local.privateKey, 256));
  const ikm = await hkdf(auth, shared, concat(enc.encode('WebPush: info\0'), uaPublic, asPublic), 32);
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const cek = await hkdf(salt, ikm, enc.encode('Content-Encoding: aes128gcm\0'), 16);
  const nonce = await hkdf(salt, ikm, enc.encode('Content-Encoding: nonce\0'), 12);
  const key = await crypto.subtle.importKey('raw', cek, 'AES-GCM', false, ['encrypt']);
  // one record: the message, then the delimiter of the last record (2)
  const cipher = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv: nonce }, key, concat(enc.encode(payload), new Uint8Array([2]))));
  const rs = new Uint8Array([0, 0, 16, 0]); // 4096
  return concat(salt, rs, new Uint8Array([asPublic.length]), asPublic, cipher);
}

/** one notification to one device: 'ok', 'gone' (the device unsubscribed) or 'error' */
export async function sendPush(env, keys, sub, message, now = Date.now()) {
  const res = await fetch(sub.endpoint, {
    method: 'POST',
    headers: { authorization: await vapidHeader(keys, sub.endpoint, now), 'content-encoding': 'aes128gcm', 'content-type': 'application/octet-stream', ttl: '86400', urgency: 'high' },
    body: await encrypt(sub, JSON.stringify(message)),
  }).catch((err) => ({ ok: false, status: 0, err }));
  if (res.ok) return 'ok';
  if (res.status === 404 || res.status === 410) return 'gone';
  console.error('[push]', new URL(sub.endpoint).host, res.status, res.err?.message || '');
  return 'error';
}

/**
 * A notification to every device of the workshop: { title, body, url (in the space), tag (one
 * notification replaces the previous one of the same tag) }. Never throws, never waits more than
 * 4 s; returns how many devices got it.
 */
export async function notify(env, message, now = Date.now()) {
  if (!env.ATELIER) return 0;
  const run = async () => {
    const { subs } = await db(env, 'push/list');
    if (!subs.length) return 0;
    const keys = await vapidKeys(env);
    let sent = 0;
    await Promise.all(
      subs.map(async (s) => {
        const r = await sendPush(env, keys, s, { title: message.title, body: message.body || '', url: message.url || '/atelier', tag: message.tag || '' }, now);
        if (r === 'ok') sent++;
        if (r === 'gone') await db(env, 'push/remove', { endpoint: s.endpoint });
      })
    );
    return sent;
  };
  return Promise.race([run().catch((err) => (console.error('[push]', err.message), 0)), new Promise((ok) => setTimeout(() => ok(0), 4000))]);
}

/** the service worker of the space (/atelier/sw.js): shows a notification, opens the space on a tap */
export const SW = `self.addEventListener('push', function (e) {
  var m = {};
  try { m = e.data ? e.data.json() : {}; } catch (err) { m = { title: e.data ? e.data.text() : 'Atelier SOLAR CAR' }; }
  e.waitUntil(self.registration.showNotification(m.title || 'Atelier SOLAR CAR', { body: m.body || '', tag: m.tag || undefined, renotify: !!m.tag, icon: '/atelier/icone-180.png?v=2', badge: '/atelier/icone-180.png?v=2', data: { url: m.url || '/atelier' } }));
});
self.addEventListener('notificationclick', function (e) {
  e.notification.close();
  var url = (e.notification.data && e.notification.data.url) || '/atelier';
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (list) {
    for (var i = 0; i < list.length; i++) if (list[i].url.indexOf('/atelier') !== -1 && 'focus' in list[i]) { list[i].navigate(url); return list[i].focus(); }
    return self.clients.openWindow(url);
  }));
});
self.addEventListener('install', function () { self.skipWaiting(); });
self.addEventListener('activate', function (e) { e.waitUntil(self.clients.claim()); });
`;
