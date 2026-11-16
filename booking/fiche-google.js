/**
 * The Google Business Profile robot: one photo a week, taken from the site's queue
 * (content/fiche-google.js → /fiche-google/photos.json, written by the build) and sent to the
 * profile through the Business Profile APIs, under the owner's Google account (OAuth, offline
 * access). Setup and day-to-day use: docs/FICHE-GOOGLE-AUTO.md.
 *
 *   GET  /fiche-google?cle=…            status page: account, profile, next photos, sent photos
 *   GET  /fiche-google/connexion?cle=…  opens Google's consent page (business.manage, offline)
 *   GET  /fiche-google/retour           Google's answer: the refresh token is kept, the profile found
 *   POST /fiche-google/envoyer?cle=…    sends the next photo now (button of the status page)
 *   cron FICHE_CRON (Tuesdays)          the next photo, unless one went out less than 5 days ago
 *
 * Environment:
 *   GOOGLE_OAUTH_CLIENT_ID, GOOGLE_OAUTH_CLIENT_SECRET  (secrets) OAuth client of the Google Cloud
 *       project, type "Web application", redirect URI <this server>/fiche-google/retour
 *   FICHE        Durable Object (class Fiche): refresh token, profile, photos sent, last run
 *   SITE_URL     the site whose /fiche-google/photos.json is the queue
 *   STATS_KEY    the key of the statistics page, also the key of these pages
 *   RESEND_API_KEY, NOTIFY_TO, MAIL_FROM   e-mails (booking/mail.js); FICHE_MAILS = "erreurs":
 *                only problems are e-mailed (default: each photo sent too)
 */
import { business as B } from '../content/site.js';
import { send, shell } from './mail.js';

/** every Tuesday at 8:17 UTC (9:17 in Paris in winter, 10:17 in summer): booking/wrangler.toml */
export const FICHE_CRON = '17 8 * * 2';

const DAY = 86400000;
const SCOPE = 'https://www.googleapis.com/auth/business.manage';
const AUTH = 'https://accounts.google.com/o/oauth2/v2/auth';
const TOKEN = 'https://oauth2.googleapis.com/token';
const ACCOUNTS = 'https://mybusinessaccountmanagement.googleapis.com/v1/accounts';
const INFO = 'https://mybusinessbusinessinformation.googleapis.com/v1/';
const V4 = 'https://mybusiness.googleapis.com/v4/';
const UPLOAD = 'https://mybusiness.googleapis.com/upload/v1/media/';
const TZ = 'Europe/Paris';
const list = (s) => (s || '').split(',').map((x) => x.trim()).filter(Boolean);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const enc = new TextEncoder();

/* ------------------------------------------------------------------ storage (Durable Object) */

/** One object holds the robot's state: { refreshToken, connectedAt, account, location, title,
 *  address, mapsUri, sent: [{ id, at, media, url }], lastSentAt, last: { at, ok, message },
 *  errorMail: { at, message }, emptyMailAt }. POST { set, push } merges `set` and appends each
 *  `push` value to its list. */
export class Fiche {
  constructor(state) {
    this.storage = state.storage;
  }
  async fetch(req) {
    const cur = (await this.storage.get('state')) || {};
    if (req.method !== 'POST') return Response.json(cur);
    const { set = {}, push = {} } = await req.json();
    const next = { ...cur, ...set };
    for (const [k, v] of Object.entries(push)) next[k] = [...(cur[k] || []), v];
    await this.storage.put('state', next);
    return Response.json(next);
  }
}
const stub = (env) => env.FICHE.get(env.FICHE.idFromName('fiche'));
const load = async (env) => (await stub(env).fetch('https://fiche/state')).json();
const save = async (env, set = {}, push = {}) => (await stub(env).fetch('https://fiche/state', { method: 'POST', body: JSON.stringify({ set, push }) })).json();

/* ------------------------------------------------------------------ keys and signatures */

function same(a, b) {
  let d = a.length === b.length && b ? 0 : 1;
  for (let i = 0; i < a.length && i < b.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return !d;
}
export const keyOk = (env, given) => Boolean(env.STATS_KEY) && same(String(given || ''), env.STATS_KEY);

const b64url = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
async function sign(env, text) {
  const k = await crypto.subtle.importKey('raw', enc.encode(env.STATS_KEY), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return b64url(await crypto.subtle.sign('HMAC', k, enc.encode(text)));
}
/** the `state` of the consent request: when it was made, signed with the key (valid 20 minutes) */
const makeState = async (env, now) => `${now}.${await sign(env, `fiche:${now}`)}`;
async function stateOk(env, state, now) {
  const [t, s] = String(state || '').split('.');
  if (!/^\d{13}$/.test(t || '') || now - Number(t) > 20 * 60000 || Number(t) > now + 60000) return false;
  return same(s || '', await sign(env, `fiche:${t}`));
}

/* ------------------------------------------------------------------ Google */

class GoogleError extends Error {
  constructor(message, { status = 0, reason = '', revoked = false } = {}) {
    super(message);
    this.status = status;
    this.reason = reason;
    this.revoked = revoked;
  }
}

async function token(env, form) {
  const res = await fetch(TOKEN, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: env.GOOGLE_OAUTH_CLIENT_ID, client_secret: env.GOOGLE_OAUTH_CLIENT_SECRET, ...form }),
  });
  const j = await res.json().catch(() => ({}));
  if (!res.ok) throw new GoogleError(`connexion Google refusée (${j.error || res.status}${j.error_description ? ` : ${j.error_description}` : ''})`, { status: res.status, revoked: j.error === 'invalid_grant' });
  return j;
}
const accessToken = async (env, refreshToken) => (await token(env, { grant_type: 'refresh_token', refresh_token: refreshToken })).access_token;

/** a call to a Business Profile API; body: an object (sent as JSON) or raw bytes */
async function gapi(access, method, url, body, type) {
  const raw = body instanceof ArrayBuffer || ArrayBuffer.isView(body);
  const res = await fetch(url, {
    method,
    headers: { authorization: `Bearer ${access}`, ...(body !== undefined ? { 'content-type': raw ? type || 'application/octet-stream' : 'application/json' } : {}) },
    body: body === undefined ? undefined : raw ? body : JSON.stringify(body),
  });
  const text = await res.text();
  let j = null;
  try {
    j = text ? JSON.parse(text) : {};
  } catch {}
  if (!res.ok) {
    const e = j?.error || {};
    const reason = e.details?.find((d) => d.reason)?.reason || e.status || '';
    throw new GoogleError(`${res.status} ${e.message || text.slice(0, 200) || res.statusText}`.trim(), { status: res.status, reason });
  }
  return j ?? {};
}

/** the profile managed by this account: the one whose Place ID is the site's (content/site.js),
 *  or the only one there is */
export async function findProfile(access, placeId = B.google.placeId) {
  const found = [];
  const accounts = (await gapi(access, 'GET', `${ACCOUNTS}?pageSize=20`)).accounts || [];
  for (const a of accounts) {
    let pageToken = '';
    do {
      const q = new URLSearchParams({ readMask: 'name,title,storefrontAddress,metadata', pageSize: '100' });
      if (pageToken) q.set('pageToken', pageToken);
      const j = await gapi(access, 'GET', `${INFO}${a.name}/locations?${q}`);
      for (const l of j.locations || []) found.push({ account: a.name, ...l });
      pageToken = j.nextPageToken || '';
    } while (pageToken);
  }
  const hit = found.find((l) => l.metadata?.placeId === placeId) || (found.length === 1 ? found[0] : null);
  if (!hit) return null;
  const a = hit.storefrontAddress || {};
  return {
    account: hit.account,
    location: hit.name,
    title: hit.title || '',
    address: [...(a.addressLines || []), [a.postalCode, a.locality].filter(Boolean).join(' ')].filter(Boolean).join(', '),
    mapsUri: hit.metadata?.mapsUri || '',
  };
}

/** sends one photo: Google fetches it from the site; if it cannot (the preview's robots.txt, a
 *  refusal of the address), the server uploads the bytes itself */
export async function uploadPhoto(access, where, photo, src) {
  const media = `${V4}${where.account}/${where.location}/media`;
  const item = { mediaFormat: 'PHOTO', locationAssociation: { category: photo.category || 'ADDITIONAL' } };
  if (photo.description) item.description = String(photo.description).slice(0, 300);
  try {
    return await gapi(access, 'POST', media, { ...item, sourceUrl: src });
  } catch (first) {
    // an access problem is the same for both ways
    if ([401, 403, 429].includes(first.status)) throw first;
    try {
      const img = await fetch(src);
      if (!img.ok) throw new GoogleError(`photo introuvable sur le site (${img.status})`);
      const bytes = await img.arrayBuffer();
      if (bytes.byteLength < 10240 || bytes.byteLength > 5 * 1024 * 1024) throw new GoogleError(`photo de ${Math.round(bytes.byteLength / 1024)} Ko (Google veut de 10 Ko à 5 Mo)`);
      const ref = await gapi(access, 'POST', `${media}:startUpload`, {});
      await gapi(access, 'POST', `${UPLOAD}${ref.resourceName}?upload_type=media`, bytes, 'image/jpeg');
      return await gapi(access, 'POST', media, { ...item, dataRef: { resourceName: ref.resourceName } });
    } catch (second) {
      throw new GoogleError(`par adresse : ${first.message} ; par fichier : ${second.message}`, { status: second.status, reason: second.reason });
    }
  }
}

/** what to tell the workshop about a failure, and whether it is only « waiting for Google » */
function explain(err) {
  const m = String(err?.message || err);
  if (err?.revoked) return { message: 'Google a retiré l’autorisation du robot (mot de passe changé ou accès révoqué) : reconnectez le compte Google depuis la page de suivi.', waiting: false };
  if (err?.status === 429 || /quota/i.test(m)) return { message: 'Google n’a pas encore ouvert l’accès à l’API pour ce projet (quota à 0) : en attente de la réponse à la demande d’accès.', waiting: true };
  if (err?.reason === 'SERVICE_DISABLED' || /has not been used in project|is disabled/i.test(m)) return { message: `Une API Google n’est pas activée dans le projet Google Cloud. Google indique : ${m}`, waiting: true };
  return { message: `Google a refusé l’envoi : ${m}`, waiting: false };
}

/* ------------------------------------------------------------------ the weekly run */

const siteRoot = (env) => String(env.SITE_URL || B.siteUrl).replace(/\/$/, '');
const queueUrl = (env) => `${siteRoot(env)}/fiche-google/photos.json`;
const statusUrl = (env) => (env.STATS_PAGE && env.STATS_KEY ? `${env.STATS_PAGE.replace(/\/stats\/?$/, '')}/fiche-google?${new URLSearchParams({ cle: env.STATS_KEY })}` : '');

/** the queue published by the site (every photo, with its address) */
async function published(env) {
  const url = queueUrl(env);
  const res = await fetch(url, { headers: { accept: 'application/json' } });
  if (!res.ok) throw new GoogleError(`liste des photos illisible sur le site (${res.status} ${url})`);
  const { photos = [] } = await res.json();
  return photos.filter((p) => p && /^[a-z0-9-]+\.jpg$/.test(p.file || '')).map((p) => ({ ...p, src: new URL(p.file, url).href }));
}
/** the photos of the queue not sent yet */
const notSent = (photos, st) => {
  const sent = new Set((st.sent || []).map((s) => s.id));
  return photos.filter((p) => !sent.has(p.id));
};
const waiting = async (env, st) => notSent(await published(env), st);

async function mail(env, subject, body) {
  if (!env.RESEND_API_KEY || !list(env.NOTIFY_TO).length) return;
  await send(env, { to: list(env.NOTIFY_TO), subject, html: shell(subject.replace(/^Fiche Google : /, ''), body) }).catch((err) => console.error('[fiche] mail', err));
}
const p = (t) => `<p style="margin:0 0 12px;font-size:15px;line-height:1.5;color:#111">${t}</p>`;
const button = (href, label) => (href ? `<p style="margin:20px 0 0"><a href="${esc(href)}" style="display:inline-block;background:#0b0c0f;color:#e9cd82;text-decoration:none;font-weight:700;padding:12px 18px;border-radius:10px">${esc(label)}</a></p>` : '');

/**
 * Sends the next photo of the queue. `manual`: asked from the status page (no 5-day pause).
 * Returns { done, why?, id?, left?, message? }. Never throws.
 */
export async function runFiche(env, now = Date.now(), { manual = false } = {}) {
  if (!env.FICHE) return { done: false, why: 'not configured' };
  const st = await load(env);
  if (!st.refreshToken) return { done: false, why: 'not connected' };
  if (!manual && st.lastSentAt && now - st.lastSentAt < 5 * DAY) return { done: false, why: 'sent recently' };
  try {
    const access = await accessToken(env, st.refreshToken);
    let where = st.location ? st : null;
    if (!where) {
      where = await findProfile(access);
      if (!where) throw new GoogleError(`aucune fiche « ${B.name} » sur ce compte Google : connectez le compte propriétaire de la fiche.`);
      await save(env, where);
    }
    const queue = await waiting(env, st);
    if (!queue.length) {
      const set = { last: { at: now, ok: true, message: 'Plus aucune photo en attente : ajoutez une réalisation au site.' } };
      if (!st.emptyMailAt || now - st.emptyMailAt > 28 * DAY) {
        set.emptyMailAt = now;
        await mail(env, 'Fiche Google : plus de photo en attente', p('Toutes les photos du site sont déjà sur votre fiche Google.') + p('Ajoutez une nouvelle réalisation au site (quelques photos et une phrase) : ses photos partiront automatiquement, une par semaine.') + button(statusUrl(env), 'Voir la page de suivi'));
      }
      await save(env, set);
      return { done: false, why: 'empty' };
    }
    const next = queue[0];
    const media = await uploadPhoto(access, where, next, next.src);
    const left = queue.length - 1;
    await save(env, { lastSentAt: now, last: { at: now, ok: true, message: `Photo publiée : ${next.description || next.id}` }, errorMail: null, emptyMailAt: null }, { sent: { id: next.id, at: now, media: media.name || '', url: media.googleUrl || '' } });
    if (env.FICHE_MAILS !== 'erreurs') {
      await mail(
        env,
        'Fiche Google : nouvelle photo publiée',
        `<p style="margin:0 0 14px"><img src="${esc(next.src)}" alt="" width="512" style="display:block;width:100%;max-width:512px;height:auto;border-radius:10px"></p>` +
          p(esc(next.description || next.id)) +
          p(left ? `Encore ${left} photo${left > 1 ? 's' : ''} en attente, une par semaine.` : 'C’était la dernière photo en attente : pensez à ajouter une réalisation au site.') +
          button(B.google.mapsUrl, 'Voir la fiche Google')
      );
    }
    return { done: true, id: next.id, left };
  } catch (err) {
    const { message, waiting: pending } = explain(err);
    const set = { last: { at: now, ok: false, waiting: pending, message } };
    if (err?.revoked) Object.assign(set, { refreshToken: null });
    if (!st.errorMail || st.errorMail.message !== message || now - st.errorMail.at > 28 * DAY) {
      set.errorMail = { at: now, message };
      await mail(env, pending ? 'Fiche Google : le robot attend Google' : 'Fiche Google : la photo de la semaine n’est pas partie', p(esc(message)) + button(statusUrl(env), 'Ouvrir la page de suivi'));
    }
    await save(env, set);
    console.error('[fiche]', err);
    return { done: false, why: 'error', message };
  }
}

/* ------------------------------------------------------------------ pages */

const headers = (env) => {
  let img = '';
  try {
    img = new URL(siteRoot(env)).origin;
  } catch {}
  return {
    'content-type': 'text/html; charset=utf-8',
    'cache-control': 'no-store',
    'x-robots-tag': 'noindex, nofollow',
    'referrer-policy': 'no-referrer',
    'x-content-type-options': 'nosniff',
    'content-security-policy': `default-src 'none'; style-src 'unsafe-inline'; img-src ${img} https://lh3.googleusercontent.com; base-uri 'none'; form-action 'self'; frame-ancestors 'none'`,
  };
};
const page = (env, title, body, status = 200) =>
  new Response(
    `<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)}</title><style>
:root{color-scheme:dark}body{margin:0;background:#07080a;color:#ece8df;font:16px/1.5 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif}
main{max-width:760px;margin:0 auto;padding:28px 16px 48px}h1{font-size:24px;margin:0 0 4px}h2{font-size:17px;margin:0 0 10px;color:#e9cd82}
.k{color:#e9cd82;font-weight:800;letter-spacing:.12em;font-size:13px}.card{background:#0f1114;border:1px solid #23262c;border-radius:14px;padding:18px;margin:16px 0}
.muted{color:#a29d92}.ok{color:#7fd17f}.bad{color:#ff8f7f}.wait{color:#e9cd82}a{color:#e9cd82}
.btn{display:inline-block;background:#e9cd82;color:#0b0c0f;border:0;border-radius:10px;padding:12px 18px;font:inherit;font-weight:700;text-decoration:none;cursor:pointer}
.next{display:flex;gap:14px;align-items:center}.next img{width:120px;height:120px;object-fit:cover;border-radius:10px;flex:none}
ul{margin:0;padding-left:18px}li{margin:4px 0}.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(96px,1fr));gap:8px;margin-top:12px}.grid img{width:100%;aspect-ratio:1;object-fit:cover;border-radius:8px}
</style></head><body><main><div class="k">SOLAR CAR 37</div>${body}</main></body></html>`,
    { status, headers: headers(env) }
  );
const when = (ms) =>
  new Intl.DateTimeFormat('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', hour: 'numeric', minute: '2-digit', timeZone: TZ })
    .format(new Date(ms))
    .replace(/(\d{1,2}):(\d{2})/, (m, h, mm) => `${Number(h)} h ${mm}`);
const day = (ms) => new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long', year: 'numeric', timeZone: TZ }).format(new Date(ms));

/** the next time the cron fires (Tuesday 8:17 UTC) */
export function nextRun(now) {
  const [min, hour] = FICHE_CRON.split(' ').map(Number);
  const d = new Date(now);
  d.setUTCHours(hour, min, 0, 0);
  while (d.getUTCDay() !== 2 || d.getTime() <= now) d.setUTCDate(d.getUTCDate() + 1);
  return d.getTime();
}

async function status(req, env, url, now) {
  const st = env.FICHE ? await load(env) : {};
  const key = url.searchParams.get('cle');
  const q = `?${new URLSearchParams({ cle: key })}`;
  const configured = Boolean(env.GOOGLE_OAUTH_CLIENT_ID && env.GOOGLE_OAUTH_CLIENT_SECRET && env.FICHE);
  let all = [];
  let queueError = '';
  try {
    all = await published(env);
  } catch (err) {
    queueError = err.message;
  }
  const queue = notSent(all, st);
  const label = Object.fromEntries(all.map((p) => [p.id, p.description || p.id]));
  const account = !configured
    ? `<p class="bad">Paramétrage à finir : les identifiants Google (GOOGLE_OAUTH_CLIENT_ID et GOOGLE_OAUTH_CLIENT_SECRET) ne sont pas encore dans les secrets du serveur Cloudflare.</p>`
    : st.refreshToken
      ? `<p class="ok">✓ Compte Google connecté le ${esc(day(st.connectedAt))}.</p>${st.location ? `<p>Fiche : <strong>${esc(st.title)}</strong>${st.address ? `, ${esc(st.address)}` : ''}${st.mapsUri ? ` — <a href="${esc(st.mapsUri)}">voir sur Google Maps</a>` : ''}</p>` : '<p class="wait">La fiche sera retrouvée au prochain passage (dès que Google aura ouvert l’accès).</p>'}<p><a href="/fiche-google/connexion${q}">Reconnecter un autre compte</a></p>`
      : `<p class="wait">Aucun compte Google connecté : le robot ne publie rien.</p><p><a class="btn" href="/fiche-google/connexion${q}">Connecter le compte Google de la fiche</a></p>`;
  const last = st.last ? `<p class="${st.last.ok ? 'ok' : st.last.waiting ? 'wait' : 'bad'}">${st.last.ok ? '✓' : st.last.waiting ? '…' : '✗'} ${esc(st.last.message)}</p><p class="muted">${esc(when(st.last.at))}</p>` : '<p class="muted">Pas encore de passage.</p>';
  const next = queue[0];
  const nextCard = queueError
    ? `<p class="bad">${esc(queueError)}</p>`
    : next
      ? `<div class="next"><img src="${esc(next.src)}" alt=""><div><p>${esc(next.description || next.id)}</p><p class="muted">${st.refreshToken ? `Publication prévue ${esc(when(nextRun(Math.max(now, (st.lastSentAt || 0) + 5 * DAY))))}` : 'En attente de la connexion du compte Google'} · ${queue.length} photo${queue.length > 1 ? 's' : ''} en attente${queue.length > 1 ? ` (environ ${queue.length} semaines)` : ''}</p></div></div>${
          st.refreshToken ? `<form method="post" action="/fiche-google/envoyer${q}" style="margin-top:14px"><button class="btn" type="submit">Publier cette photo maintenant</button></form>` : ''
        }`
      : '<p class="wait">Plus aucune photo en attente : ajoutez une réalisation au site, ses photos partiront automatiquement.</p>';
  const sent = [...(st.sent || [])].reverse();
  const sentCard = sent.length
    ? `<ul>${sent.map((s) => `<li>${esc(day(s.at))} — ${s.url ? `<a href="${esc(s.url)}">${esc(label[s.id] || s.id)}</a>` : esc(label[s.id] || s.id)}</li>`).join('')}</ul>`
    : '<p class="muted">Aucune photo publiée par le robot pour l’instant.</p>';
  const rest = queue.slice(1, 13);
  return page(
    env,
    'Fiche Google — photos automatiques',
    `<h1>Fiche Google : une photo par semaine</h1><p class="muted">Chaque mardi matin, le robot publie sur votre fiche Google la prochaine photo des réalisations du site. Ajoutez une réalisation au site : ses photos rejoignent la file.</p>
<section class="card"><h2>Compte Google</h2>${account}</section>
<section class="card"><h2>Dernier passage</h2>${last}</section>
<section class="card"><h2>Prochaine photo</h2>${nextCard}${rest.length ? `<div class="grid">${rest.map((r) => `<img src="${esc(r.src)}" alt="${esc(r.description)}" title="${esc(r.description)}">`).join('')}</div>` : ''}</section>
<section class="card"><h2>Déjà publiées par le robot (${sent.length})</h2>${sentCard}</section>`
  );
}

function connect(req, env, url, now) {
  if (!env.GOOGLE_OAUTH_CLIENT_ID || !env.GOOGLE_OAUTH_CLIENT_SECRET || !env.FICHE) return page(env, 'Fiche Google', '<h1>Paramétrage à finir</h1><p>Les identifiants Google (GOOGLE_OAUTH_CLIENT_ID et GOOGLE_OAUTH_CLIENT_SECRET) ne sont pas encore dans les secrets du serveur Cloudflare : voir docs/FICHE-GOOGLE-AUTO.md.</p>', 503);
  return makeState(env, now).then((state) => {
    const q = new URLSearchParams({
      client_id: env.GOOGLE_OAUTH_CLIENT_ID,
      redirect_uri: `${url.origin}/fiche-google/retour`,
      response_type: 'code',
      scope: SCOPE,
      access_type: 'offline',
      prompt: 'consent',
      include_granted_scopes: 'true',
      state,
    });
    return new Response(null, { status: 302, headers: { location: `${AUTH}?${q}`, 'cache-control': 'no-store', 'referrer-policy': 'no-referrer' } });
  });
}

async function callback(req, env, url, now) {
  if (!env.FICHE || !(await stateOk(env, url.searchParams.get('state'), now))) return page(env, 'Fiche Google', '<h1>Lien expiré</h1><p>Recommencez depuis la page de suivi de la fiche Google (bouton « Connecter le compte Google »).</p>', 400);
  if (url.searchParams.get('error')) return page(env, 'Fiche Google', `<h1>Connexion annulée</h1><p>Google indique : ${esc(url.searchParams.get('error'))}. Rien n’a été modifié.</p>`, 400);
  let j;
  try {
    j = await token(env, { grant_type: 'authorization_code', code: url.searchParams.get('code') || '', redirect_uri: `${url.origin}/fiche-google/retour` });
  } catch (err) {
    return page(env, 'Fiche Google', `<h1>Connexion refusée par Google</h1><p>${esc(err.message)}</p>`, 502);
  }
  if (!j.refresh_token) return page(env, 'Fiche Google', '<h1>Accès hors ligne non accordé</h1><p>Google n’a pas donné d’accès durable. Retirez l’accès de l’application dans votre compte Google (Sécurité → Applications tierces), puis reconnectez-vous.</p>', 502);
  if (!String(j.scope || SCOPE).includes(SCOPE)) return page(env, 'Fiche Google', '<h1>Autorisation incomplète</h1><p>Cochez l’accès à la gestion de la fiche d’établissement sur la page de Google, puis recommencez.</p>', 400);
  await save(env, { refreshToken: j.refresh_token, connectedAt: now, account: null, location: null, title: '', address: '', mapsUri: '', errorMail: null, last: { at: now, ok: true, message: 'Compte Google connecté.' } });
  let found = '';
  try {
    const where = await findProfile(j.access_token);
    if (where) {
      await save(env, where);
      found = `<p class="ok">✓ Fiche trouvée : <strong>${esc(where.title)}</strong>${where.address ? `, ${esc(where.address)}` : ''}.</p>`;
    } else found = `<p class="bad">Aucune fiche « ${esc(B.name)} » sur ce compte : connectez le compte Google propriétaire de la fiche.</p>`;
  } catch (err) {
    const { message } = explain(err);
    await save(env, { last: { at: now, ok: false, waiting: true, message } });
    found = `<p class="wait">${esc(message)} La fiche sera retrouvée automatiquement dès que possible.</p>`;
  }
  return page(env, 'Fiche Google', `<h1>Compte Google connecté</h1>${found}<p>Le robot publiera une photo chaque mardi matin. Vous pouvez fermer cette page.</p>`);
}

/** the routes under /fiche-google (null: not one of them) */
export async function ficheRoute(req, env, url, now) {
  const p = url.pathname.replace(/\/$/, '');
  if (p === '/fiche-google/retour' && req.method === 'GET') return callback(req, env, url, now);
  if (!['/fiche-google', '/fiche-google/connexion', '/fiche-google/envoyer'].includes(p)) return null;
  if (!keyOk(env, url.searchParams.get('cle'))) return page(env, 'Fiche Google', '<h1>Clé incorrecte</h1><p>Ouvrez le lien complet de la page de suivi (le même que celui des statistiques, avec /fiche-google à la place de /stats).</p>', 403);
  if (p === '/fiche-google' && req.method === 'GET') return status(req, env, url, now);
  if (p === '/fiche-google/connexion' && req.method === 'GET') return connect(req, env, url, now);
  if (p === '/fiche-google/envoyer' && req.method === 'POST') {
    await runFiche(env, now, { manual: true });
    return new Response(null, { status: 303, headers: { location: `/fiche-google?${new URLSearchParams({ cle: url.searchParams.get('cle') })}`, 'cache-control': 'no-store' } });
  }
  return null;
}
