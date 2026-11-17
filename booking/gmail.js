/**
 * The workshop's Gmail, read by the workshop's space (docs/ATELIER.md, « Devis » tab): the replies
 * written to a client straight from Gmail, and the client's answers, are brought into the quote's
 * discussion, and the status follows (« Devis envoyé » at the first reply sent from Gmail).
 *
 *   POST /atelier/gmail/connexion   opens Google's consent page (gmail.readonly, offline)
 *   GET  /atelier/gmail/retour      Google's answer: the refresh token is kept (state signed)
 *   POST /atelier/gmail/sync        reads Gmail now (button « Actualiser »)
 *   POST /atelier/gmail/deconnexion forgets the token
 *   and on each page of the space (at most once a minute), and with the daily e-mails' cron.
 *
 * Only the e-mails exchanged with the e-mail address of a client whose quote is open are read:
 * « in:sent to:<client> » (written from Gmail) and « from:<client> » (the client's answers), after
 * the date of the request. Each one comes into the discussion once (its Message-ID).
 *
 * Environment: GOOGLE_OAUTH_CLIENT_ID, GOOGLE_OAUTH_CLIENT_SECRET (secrets, the OAuth client of the
 * Google Cloud project, also used by the Google profile robot), redirect URI
 * https://atelier.solarcar37.fr/atelier/gmail/retour; ATELIER_SECRET signs the consent's state.
 */
import { db } from './store.js';

const SCOPE = 'https://www.googleapis.com/auth/gmail.readonly';
const AUTH = 'https://accounts.google.com/o/oauth2/v2/auth';
const TOKEN = 'https://oauth2.googleapis.com/token';
const API = 'https://gmail.googleapis.com/gmail/v1/users/me';
const enc = new TextEncoder();

export const gmailReady = (env) => !!(env.GOOGLE_OAUTH_CLIENT_ID && env.GOOGLE_OAUTH_CLIENT_SECRET && env.ATELIER_SECRET && env.ATELIER);
const redirectUri = (url) => `${url.origin}/atelier/gmail/retour`;

async function sign(env, text) {
  const k = await crypto.subtle.importKey('raw', enc.encode(env.ATELIER_SECRET), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return [...new Uint8Array(await crypto.subtle.sign('HMAC', k, enc.encode(text)))].map((b) => b.toString(16).padStart(2, '0')).join('');
}
function same(a, b) {
  if (a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}

/** the consent page of Google; the state is signed and valid 20 minutes */
export async function consentUrl(env, url, now) {
  const state = `${now}.${await sign(env, `gmail:${now}`)}`;
  return `${AUTH}?${new URLSearchParams({ client_id: env.GOOGLE_OAUTH_CLIENT_ID, redirect_uri: redirectUri(url), response_type: 'code', scope: SCOPE, access_type: 'offline', prompt: 'consent', include_granted_scopes: 'true', state })}`;
}

async function token(env, form) {
  const res = await fetch(TOKEN, { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ client_id: env.GOOGLE_OAUTH_CLIENT_ID, client_secret: env.GOOGLE_OAUTH_CLIENT_SECRET, ...form }) });
  const j = await res.json().catch(() => ({}));
  if (!res.ok) {
    const e = new Error(`Google a refusé la connexion (${j.error || res.status})`);
    e.revoked = j.error === 'invalid_grant';
    throw e;
  }
  return j;
}
async function gget(access, path) {
  const res = await fetch(`${API}${path}`, { headers: { authorization: `Bearer ${access}` } });
  const j = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`Gmail ${res.status} ${j.error?.message || ''}`.trim());
  return j;
}

/** GET /atelier/gmail/retour: the code exchanged for a refresh token, kept in the workshop's
 *  database; returns { ok, email } or { ok: false, error } */
export async function callback(env, url, now) {
  const [t, s] = String(url.searchParams.get('state') || '').split('.');
  if (!/^\d{13}$/.test(t || '') || now - Number(t) > 20 * 60000 || !same(s || '', await sign(env, `gmail:${t}`))) return { ok: false, error: 'Lien expiré : recommencez depuis l’onglet Devis.' };
  if (url.searchParams.get('error')) return { ok: false, error: 'Connexion annulée sur la page de Google.' };
  const j = await token(env, { grant_type: 'authorization_code', code: url.searchParams.get('code') || '', redirect_uri: redirectUri(url) }).catch((err) => ({ error: err.message }));
  if (j.error) return { ok: false, error: j.error };
  if (!j.refresh_token) return { ok: false, error: 'Google n’a pas donné d’accès durable : recommencez (il faut accepter toutes les autorisations).' };
  if (!String(j.scope || SCOPE).includes(SCOPE)) return { ok: false, error: 'Autorisation incomplète : cochez l’accès à Gmail sur la page de Google, puis recommencez.' };
  const profile = await gget(j.access_token, '/profile').catch(() => ({}));
  await db(env, 'setting/set', { key: 'gmail', value: { refresh: j.refresh_token, email: profile.emailAddress || '', at: now, lastSync: 0, error: '' } });
  return { ok: true, email: profile.emailAddress || '' };
}

/** the state shown in the space: { connected, email, lastSync, error } (never the token) */
export async function gmailState(env) {
  const g = (await db(env, 'setting/get', { key: 'gmail' })).value;
  return g?.refresh ? { connected: true, email: g.email, lastSync: g.lastSync || 0, error: g.error || '' } : { connected: false };
}
export const disconnect = (env) => db(env, 'setting/set', { key: 'gmail', value: null });

const b64 = (s) => {
  const bin = atob(String(s || '').replace(/-/g, '+').replace(/_/g, '/'));
  return new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0)));
};
const header = (m, name) => (m.payload?.headers || []).find((h) => h.name.toLowerCase() === name)?.value || '';
/** the text of an e-mail: its text part (else its HTML without tags), without the quoted earlier
 *  messages */
export function textOf(m) {
  let plain = '';
  let html = '';
  (function walk(p) {
    if (!p) return;
    if (p.mimeType === 'text/plain' && p.body?.data && !plain) plain = b64(p.body.data);
    else if (p.mimeType === 'text/html' && p.body?.data && !html) html = b64(p.body.data);
    for (const c of p.parts || []) walk(c);
  })(m.payload);
  let t = plain || html.replace(/<(br|\/p|\/div)[^>]*>/gi, '\n').replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&#39;/g, "'").replace(/&quot;/g, '"');
  if (!t) t = m.snippet || '';
  t = t.replace(/\r\n?/g, '\n');
  // the earlier messages quoted under the reply
  const cut = t.search(/\n[^\n]*(Le .{3,120}a écrit\s*:|On .{3,120}wrote:|-----\s*Original Message|De\s*:.{3,200}\nEnvoyé\s*:)/i);
  if (cut > 0) t = t.slice(0, cut);
  return t
    .split('\n')
    .filter((l) => !/^\s*>/.test(l))
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
    .slice(0, 10000);
}

/**
 * Reads Gmail for the open quotes (at most once a minute unless `force`): the new e-mails go into
 * their discussion. Returns { imported, checked } or { off } / { skipped } / { error }.
 */
export async function gmailSync(env, now = Date.now(), { force = false } = {}) {
  if (!gmailReady(env)) return { off: true };
  const g = (await db(env, 'setting/get', { key: 'gmail' })).value;
  if (!g?.refresh) return { off: true };
  if (!force && g.lastSync && now - g.lastSync < 60000) return { skipped: true };
  await db(env, 'setting/set', { key: 'gmail', value: { ...g, lastSync: now } });
  try {
    const access = (await token(env, { grant_type: 'refresh_token', refresh_token: g.refresh })).access_token;
    const { requests } = await db(env, 'gmail/open', { now });
    const items = [];
    for (const r of requests) {
      const after = Math.floor((r.at - 60000) / 1000);
      for (const [dir, q] of [
        ['out', `in:sent to:${r.email} after:${after}`],
        ['in', `from:${r.email} after:${after}`],
      ]) {
        const list = await gget(access, `/messages?${new URLSearchParams({ q, maxResults: '15' })}`);
        for (const { id } of list.messages || []) {
          if (r.known.includes(`gmail:${id}`)) continue;
          const m = await gget(access, `/messages/${encodeURIComponent(id)}?format=full`);
          const msgid = header(m, 'message-id');
          if (msgid && r.known.includes(msgid)) continue;
          items.push({ requestId: r.id, dir, gid: id, msgid, at: Number(m.internalDate) || now, text: textOf(m) });
        }
      }
    }
    const res = items.length ? await db(env, 'gmail/import', { now, items }) : { imported: 0 };
    await db(env, 'setting/set', { key: 'gmail', value: { ...g, lastSync: now, error: '' } });
    return { imported: res.imported, checked: requests.length };
  } catch (err) {
    console.error('[gmail]', err.message);
    // a revoked access: shown in the space, to connect again
    await db(env, 'setting/set', { key: 'gmail', value: err.revoked ? null : { ...g, lastSync: now, error: err.message.slice(0, 200) } });
    return { error: err.message };
  }
}
