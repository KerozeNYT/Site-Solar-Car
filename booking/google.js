/**
 * Google Calendar for the booking server, through a service account (no user sign-in): the
 * calendars are shared with its address (docs/RESERVATION.md). Plain fetch and Web Crypto: runs
 * on Cloudflare Workers and Node 20+.
 *   env.GOOGLE_SERVICE_ACCOUNT: the JSON key of the service account (secret)
 */
const API = 'https://www.googleapis.com/calendar/v3';
const SCOPE = 'https://www.googleapis.com/auth/calendar';

const b64url = (buf) => {
  const bytes = buf instanceof ArrayBuffer ? new Uint8Array(buf) : new TextEncoder().encode(buf);
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};

async function signingKey(pem) {
  const der = Uint8Array.from(atob(pem.replace(/-----[^-]+-----/g, '').replace(/\s+/g, '')), (c) => c.charCodeAt(0));
  return crypto.subtle.importKey('pkcs8', der, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['sign']);
}

let cached = null; // { token, exp }

/** an access token for the service account (kept until a minute before it expires) */
export async function accessToken(env) {
  if (cached && cached.exp > Date.now() + 60000) return cached.token;
  const sa = JSON.parse(env.GOOGLE_SERVICE_ACCOUNT);
  const now = Math.floor(Date.now() / 1000);
  const head = b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const claim = b64url(JSON.stringify({ iss: sa.client_email, scope: SCOPE, aud: sa.token_uri || 'https://oauth2.googleapis.com/token', iat: now, exp: now + 3600 }));
  const sig = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', await signingKey(sa.private_key), new TextEncoder().encode(`${head}.${claim}`));
  const res = await fetch(sa.token_uri || 'https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: `${head}.${claim}.${b64url(sig)}` }),
  });
  if (!res.ok) throw new Error(`google token ${res.status}`);
  const j = await res.json();
  cached = { token: j.access_token, exp: Date.now() + (j.expires_in || 3600) * 1000 };
  return cached.token;
}

async function call(env, method, path, body) {
  const res = await fetch(API + path, {
    method,
    headers: { authorization: `Bearer ${await accessToken(env)}`, ...(body ? { 'content-type': 'application/json' } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (res.status === 204) return null;
  const j = await res.json().catch(() => null);
  if (!res.ok) throw new Error(`google ${method} ${path.split('?')[0]} ${res.status} ${j?.error?.message || ''}`);
  return j;
}

/** busy intervals [[startMs, endMs]] of several calendars between two instants */
export async function busyIntervals(env, calendars, fromMs, toMs) {
  const j = await call(env, 'POST', '/freeBusy', {
    timeMin: new Date(fromMs).toISOString(),
    timeMax: new Date(toMs).toISOString(),
    items: calendars.map((id) => ({ id })),
  });
  const out = [];
  for (const id of calendars) {
    const c = j.calendars?.[id];
    // a calendar the service account cannot see: never offer a slot that might be taken
    if (!c || c.errors?.length) throw new Error(`calendar not readable: ${id.slice(0, 12)}…`);
    for (const b of c.busy || []) out.push([Date.parse(b.start), Date.parse(b.end)]);
  }
  return out;
}

const enc = encodeURIComponent;
export const insertEvent = (env, calendar, event) => call(env, 'POST', `/calendars/${enc(calendar)}/events`, event);
export const patchEvent = (env, calendar, id, event) => call(env, 'PATCH', `/calendars/${enc(calendar)}/events/${enc(id)}`, event);
export const deleteEvent = (env, calendar, id) => call(env, 'DELETE', `/calendars/${enc(calendar)}/events/${enc(id)}`);
export const getEvent = (env, calendar, id) => call(env, 'GET', `/calendars/${enc(calendar)}/events/${enc(id)}`);

/** the slots held while a visitor pays (tagged with a private property) */
export async function heldEvents(env, calendar, fromMs, toMs) {
  const q = new URLSearchParams({ privateExtendedProperty: 'solarcarHold=1', timeMin: new Date(fromMs).toISOString(), timeMax: new Date(toMs).toISOString(), singleEvents: 'true', maxResults: '100' });
  const j = await call(env, 'GET', `/calendars/${enc(calendar)}/events?${q}`);
  return j.items || [];
}

/** for tests: forget the cached token */
export const resetToken = () => (cached = null);
