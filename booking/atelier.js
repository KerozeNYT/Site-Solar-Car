/**
 * The workshop's space (docs/ATELIER.md): /atelier, on the booking server.
 *
 *   /atelier                 Accueil: the month in figures, the next appointments, the promotion
 *   /atelier/rdv             the appointments booked online: to come, past
 *   /atelier/clients         the client file: search, card of each client, add, edit, delete,
 *                            export for Excel (/atelier/clients.csv)
 *   /atelier/codes           the band of the site, the promotion codes, the referral codes
 *   /atelier/stats           → the statistics page; /atelier/fiche → the Google profile robot
 *
 * Sign-in: a 6-digit code e-mailed to the workshop (ATELIER_EMAILS, else NOTIFY_TO), valid
 * 10 minutes; then a session cookie signed with ATELIER_SECRET, for 30 days on that device. No
 * password to remember. The pages carry no script; every change is a form sent to this server
 * (same origin only).
 */
import { bookingRules as R, codeServices, formatEuros, quote, withDiscount } from '../content/booking.js';
import { business as B } from '../content/site.js';
import { report, totalsOf } from './stats.js';
import { db, referralFor, redeemReferral, checkCode, dayStart } from './store.js';
import { bookedEvents } from './google.js';
import { getSession } from './stripe.js';
import { send, shell as mailShell } from './mail.js';
import { utcToZoned, addDays } from './schedule.js';

const COOKIE = 'sc37_atelier';
const SESSION_DAYS = 30;
const DAY = 86400000;
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const eur = (n) => formatEuros(Math.round((Number(n) || 0) * 100) / 100);
const paris = (ms) => utcToZoned(ms, R.timeZone);
const dayLabel = (date, opts = { weekday: 'short', day: 'numeric', month: 'short' }) => new Intl.DateTimeFormat('fr-FR', { ...opts, timeZone: 'UTC' }).format(new Date(`${date}T12:00:00Z`));
const dateOf = (ms) => (ms ? new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short', year: 'numeric', timeZone: R.timeZone }).format(new Date(ms)) : '—');
const hour = (t) => String(t || '').replace(/^0/, '').replace(':', ' h ');
const name = (c) => [c.first, c.last].filter(Boolean).join(' ') || c.email || 'Client';
const tel = (p) => String(p || '').replace(/[^\d+]/g, '');
const HEADERS = {
  'content-type': 'text/html; charset=utf-8',
  'cache-control': 'no-store',
  'x-robots-tag': 'noindex, nofollow',
  // same-origin, not no-referrer: with no-referrer the browser sends « Origin: null » with the
  // forms, which the origin check below would refuse
  'referrer-policy': 'same-origin',
  'x-content-type-options': 'nosniff',
  'content-security-policy': "default-src 'none'; style-src 'unsafe-inline'; img-src 'self' data:; manifest-src 'self'; form-action 'self'; frame-ancestors 'none'; base-uri 'none'",
};

// ---------------------------------------------------------------- signing
const enc = new TextEncoder();
async function hmac(secret, text) {
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = new Uint8Array(await crypto.subtle.sign('HMAC', key, enc.encode(text)));
  return [...sig].map((b) => b.toString(16).padStart(2, '0')).join('');
}
function same(a, b) {
  if (a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}
async function sessionOk(req, env, now) {
  const m = (req.headers.get('cookie') || '').match(new RegExp(`(?:^|;\\s*)${COOKIE}=(\\d+)\\.([0-9a-f]{64})`));
  if (!m || Number(m[1]) < now) return false;
  return same(m[2], await hmac(env.ATELIER_SECRET, `session:${m[1]}`));
}
async function sessionCookie(env, now) {
  const exp = now + SESSION_DAYS * DAY;
  return `${COOKIE}=${exp}.${await hmac(env.ATELIER_SECRET, `session:${exp}`)}; Path=/; Max-Age=${SESSION_DAYS * 86400}; HttpOnly; Secure; SameSite=Strict`;
}
const redirect = (to, extra = {}) => new Response(null, { status: 303, headers: { location: to, 'cache-control': 'no-store', ...extra } });
const back = (path, q) => redirect(`${path}${q ? `?${new URLSearchParams(q)}` : ''}`);

// ---------------------------------------------------------------- the page around
function page(title, active, body, url) {
  const tabs = [
    ['/atelier', 'Accueil'],
    ['/atelier/rdv', 'Rendez-vous'],
    ['/atelier/clients', 'Clients'],
    ['/atelier/codes', 'Codes et promos'],
    ['/atelier/stats', 'Statistiques'],
    ['/atelier/fiche', 'Fiche Google'],
  ];
  const ok = url?.searchParams.get('ok');
  const err = url?.searchParams.get('err');
  return new Response(
    `<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><meta name="robots" content="noindex">
<title>${esc(title)} — Atelier ${esc(B.name)}</title><link rel="manifest" href="/atelier/manifest.webmanifest"><link rel="icon" href="/atelier/icone.svg"><meta name="theme-color" content="#0b0c0f"><meta name="apple-mobile-web-app-capable" content="yes"><meta name="apple-mobile-web-app-title" content="Atelier">
<style>${CSS}</style></head><body>
<header class="top"><a class="brand" href="/atelier"><span>SOLAR CAR 37</span> Atelier</a><a class="out" href="/atelier/deconnexion">Se déconnecter</a></header>
${active ? `<nav class="tabs" aria-label="Espace atelier">${tabs.map(([href, label]) => `<a href="${href}"${href === active ? ' aria-current="page"' : ''}>${label}</a>`).join('')}</nav>` : ''}
<main>${ok ? `<p class="msg msg--ok">${esc(ok)}</p>` : ''}${err ? `<p class="msg msg--err">${esc(err)}</p>` : ''}${body}</main></body></html>`,
    { headers: HEADERS }
  );
}

const CSS = `:root{color-scheme:dark;--bg:#0b0c0f;--card:#15171c;--card2:#1b1e24;--line:#2a2d35;--gold:#e9cd82;--text:#f2efe8;--dim:#9a968c;--ok:#7fd49b;--err:#ff8a7a}
*{box-sizing:border-box}html{-webkit-text-size-adjust:100%}body{margin:0;background:var(--bg);color:var(--text);font:15px/1.5 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;padding-bottom:env(safe-area-inset-bottom)}
a{color:var(--gold)}main{max-width:1000px;margin:0 auto;padding:18px 16px 56px}
.top{display:flex;justify-content:space-between;align-items:center;gap:12px;padding:14px 16px;max-width:1000px;margin:0 auto}.brand{color:var(--text);text-decoration:none;font-weight:700}.brand span{color:var(--gold);letter-spacing:.08em;margin-right:4px}.out{color:var(--dim);font-size:13px}
.tabs{display:flex;gap:6px;overflow-x:auto;padding:0 16px 10px;max-width:1000px;margin:0 auto;scrollbar-width:none}.tabs a{flex:none;color:var(--dim);text-decoration:none;padding:8px 14px;border-radius:999px;border:1px solid var(--line);font-size:14px;font-weight:600}.tabs a[aria-current]{background:var(--gold);color:#0b0c0f;border-color:var(--gold)}
h1{font-size:22px;margin:4px 0 14px}h2{font-size:16px;margin:0 0 12px}h3{font-size:14px;margin:16px 0 8px;color:var(--dim);font-weight:600}
.lead{color:var(--dim);margin:-6px 0 18px}.grid{display:grid;gap:12px;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));margin:0 0 14px}
.card{background:var(--card);border:1px solid var(--line);border-radius:16px;padding:16px;margin:0 0 14px}.figs{display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:10px;margin:0 0 14px}
.fig{background:var(--card);border:1px solid var(--line);border-radius:14px;padding:12px 14px}.fig b{display:block;font-size:24px;color:var(--gold);line-height:1.2}.fig span{color:var(--dim);font-size:13px}
label{display:block;font-size:13px;color:var(--dim);margin:0 0 4px}input,select,textarea{width:100%;padding:10px 12px;border-radius:10px;border:1px solid var(--line);background:#0f1115;color:var(--text);font:inherit;margin:0 0 10px}textarea{min-height:90px;resize:vertical}
.row{display:grid;gap:0 10px;grid-template-columns:1fr 1fr}.row3{display:grid;gap:0 10px;grid-template-columns:1fr 1fr 1fr}.checks{display:flex;gap:14px;flex-wrap:wrap;margin:0 0 12px}.checks label{display:flex;gap:6px;align-items:center;color:var(--text);margin:0}.checks input{width:auto;margin:0}
.btns{display:flex;gap:8px;flex-wrap:wrap;align-items:center}button,.btn{display:inline-block;border:0;border-radius:999px;padding:10px 16px;font:inherit;font-weight:700;cursor:pointer;background:var(--gold);color:#0b0c0f;text-decoration:none}button.ghost,.btn.ghost{background:transparent;color:var(--gold);border:1px solid var(--gold)}button.danger{background:transparent;color:var(--err);border:1px solid var(--err)}button.small,.btn.small{padding:6px 12px;font-size:13px}
.msg{padding:12px 14px;border-radius:12px;margin:0 0 14px;font-weight:600}.msg--ok{background:#13261a;color:var(--ok)}.msg--err{background:#2a1513;color:var(--err)}
table{width:100%;border-collapse:collapse}th,td{text-align:left;padding:10px 8px;border-bottom:1px solid var(--line);vertical-align:top}th{color:var(--dim);font-size:12px;font-weight:600}td small,.dim{color:var(--dim);font-size:12px}td small{display:block}.acts td{border-top:0;padding-top:0}tr:has(+ .acts) td{border-bottom:0}.n{text-align:right;white-space:nowrap}
.code{font-family:ui-monospace,Menlo,Consolas,monospace;letter-spacing:.06em;color:var(--gold);white-space:nowrap}.tag{display:inline-block;font-size:12px;font-weight:700;border-radius:999px;padding:2px 8px;white-space:nowrap}.tag--ok{background:#13261a;color:var(--ok)}.tag--gold{background:#2a2414;color:var(--gold)}.tag--off{background:#222;color:var(--dim)}.tag--err{background:#2a1513;color:var(--err)}
.list{list-style:none;margin:0;padding:0}.list li{display:flex;justify-content:space-between;gap:12px;padding:10px 0;border-bottom:1px solid var(--line)}.list li:last-child{border:0}
.band{border:1px solid var(--gold);border-radius:14px;padding:12px 14px;background:#0f1115;margin:0 0 12px}.empty{color:var(--dim)}.search{display:flex;gap:8px}.search input{margin:0}
.big{font:800 26px/1.2 ui-monospace,Menlo,Consolas,monospace;letter-spacing:.12em;color:var(--gold)}.right{float:right}
@media (max-width:640px){.row,.row3{grid-template-columns:1fr}.hide-s{display:none}th,td{padding:9px 6px}}`;

// ---------------------------------------------------------------- sign-in
function loginPage(url, sent) {
  const err = url.searchParams.get('err');
  return new Response(
    `<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>Connexion — Atelier ${esc(B.name)}</title><link rel="manifest" href="/atelier/manifest.webmanifest"><link rel="icon" href="/atelier/icone.svg"><meta name="theme-color" content="#0b0c0f"><style>${CSS}
.login{max-width:380px;margin:12vh auto 0}</style></head><body><main class="login">
<p class="brand"><span style="color:var(--gold);letter-spacing:.08em">SOLAR CAR 37</span> Atelier</p><h1>Connexion</h1>
${err ? `<p class="msg msg--err">${esc(err)}</p>` : ''}
${
  sent
    ? `<p class="lead">Un code à 6 chiffres vient de partir par e-mail à l’atelier. Il est valable 10 minutes.</p>
<form method="post" action="/atelier/connexion"><label for="code">Code reçu</label><input id="code" name="code" inputmode="numeric" autocomplete="one-time-code" pattern="\\d{6}" maxlength="6" required autofocus><button>Se connecter</button></form>
<form method="post" action="/atelier/connexion/code" style="margin-top:14px"><button class="ghost small">Renvoyer un code</button></form>`
    : `<p class="lead">Pas de mot de passe : un code de connexion est envoyé par e-mail à l’atelier. Vous restez ensuite connecté ${SESSION_DAYS} jours sur cet appareil.</p>
<form method="post" action="/atelier/connexion/code"><button>Recevoir mon code par e-mail</button></form>`
}</main></body></html>`,
    { headers: HEADERS }
  );
}

async function sendLoginCode(env, now) {
  const to = (env.ATELIER_EMAILS || env.NOTIFY_TO || '').split(',').map((x) => x.trim()).filter(Boolean);
  if (!to.length || !env.RESEND_API_KEY) return { ok: false, error: 'Envoi d’e-mail non configuré.' };
  const code = String(crypto.getRandomValues(new Uint32Array(1))[0] % 1000000).padStart(6, '0');
  const r = await db(env, 'login/new', { now, hash: await hmac(env.ATELIER_SECRET, `login:${code}`) });
  if (!r.ok) return r;
  await send(env, {
    to,
    subject: `Code de connexion à l’espace atelier : ${code}`,
    html: mailShell('Connexion à l’espace atelier', `<p style="margin:0 0 12px;font-size:15px;color:#111">Votre code, valable 10 minutes :</p><p style="margin:0 0 16px;font:800 32px/1.2 'Courier New',monospace;letter-spacing:.2em;color:#111">${code}</p><p style="margin:0;font-size:13px;color:#6b6b6b">Vous n’avez pas demandé ce code ? Ignorez cet e-mail : personne ne peut se connecter sans lui.</p>`),
  });
  return { ok: true };
}

// ---------------------------------------------------------------- the routes
export async function atelier(req, env, url, now) {
  const path = url.pathname.replace(/\/+$/, '') || '/atelier';
  if (path === '/atelier/manifest.webmanifest')
    return new Response(JSON.stringify({ name: `Atelier ${B.name}`, short_name: 'Atelier', start_url: '/atelier', scope: '/atelier', display: 'standalone', background_color: '#0b0c0f', theme_color: '#0b0c0f', icons: [{ src: '/atelier/icone.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' }] }), { headers: { 'content-type': 'application/manifest+json', 'cache-control': 'public, max-age=86400' } });
  if (path === '/atelier/icone.svg')
    return new Response('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><rect width="512" height="512" rx="112" fill="#0b0c0f"/><rect x="24" y="24" width="464" height="464" rx="92" fill="none" stroke="#e9cd82" stroke-width="10"/><text x="256" y="300" text-anchor="middle" font-family="Arial,Helvetica,sans-serif" font-size="170" font-weight="800" fill="#e9cd82" letter-spacing="8">SC</text><text x="256" y="390" text-anchor="middle" font-family="Arial,Helvetica,sans-serif" font-size="64" font-weight="700" fill="#f2efe8" letter-spacing="10">37</text></svg>', { headers: { 'content-type': 'image/svg+xml', 'cache-control': 'public, max-age=86400' } });
  if (!env.ATELIER || !env.ATELIER_SECRET) return new Response('Espace atelier pas encore activé (ATELIER, ATELIER_SECRET).', { status: 503, headers: { 'content-type': 'text/plain; charset=utf-8' } });
  // forms: from these pages only
  if (req.method === 'POST') {
    const origin = req.headers.get('origin');
    if (origin && origin !== url.origin) return new Response('Origine refusée', { status: 403 });
  }

  if (path === '/atelier/connexion' && req.method === 'GET') return loginPage(url, url.searchParams.has('envoye'));
  if (path === '/atelier/connexion/code' && req.method === 'POST') {
    const r = await sendLoginCode(env, now).catch((err) => ({ ok: false, error: `Envoi impossible : ${err.message}` }));
    return r.ok ? back('/atelier/connexion', { envoye: '1' }) : back('/atelier/connexion', { err: r.error });
  }
  if (path === '/atelier/connexion' && req.method === 'POST') {
    const f = await req.formData();
    const code = String(f.get('code') || '').replace(/\D/g, '');
    const r = code.length === 6 ? await db(env, 'login/check', { now, hash: await hmac(env.ATELIER_SECRET, `login:${code}`) }) : { ok: false, error: 'Le code fait 6 chiffres.' };
    if (!r.ok) return back('/atelier/connexion', { envoye: '1', err: r.error });
    return redirect('/atelier', { 'set-cookie': await sessionCookie(env, now) });
  }
  if (path === '/atelier/deconnexion') return redirect('/atelier/connexion', { 'set-cookie': `${COOKIE}=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Strict` });

  if (!(await sessionOk(req, env, now))) return req.method === 'GET' ? redirect('/atelier/connexion') : new Response('Session expirée : reconnectez-vous.', { status: 401 });

  if (path === '/atelier' && req.method === 'GET') return home(env, url, now);
  if (path === '/atelier/rdv' && req.method === 'GET') return appointments(env, url, now);
  if (path === '/atelier/clients' && req.method === 'GET') return clients(env, url);
  if (path === '/atelier/clients.csv' && req.method === 'GET') return clientsCsv(env, now);
  if (path === '/atelier/clients/nouveau' && req.method === 'GET') return clientCard(env, url, null);
  if (path === '/atelier/clients' && req.method === 'POST') return clientSave(req, env, now);
  const m = path.match(/^\/atelier\/clients\/(\d+)(?:\/(supprimer|code))?$/);
  if (m && req.method === 'GET' && !m[2]) return clientCard(env, url, Number(m[1]));
  if (m && req.method === 'POST' && m[2] === 'supprimer') {
    const f = await req.formData();
    if (!f.get('confirme')) return back(`/atelier/clients/${m[1]}`, { err: 'Cochez la case de confirmation pour supprimer.' });
    await db(env, 'client/delete', { id: Number(m[1]) });
    return back('/atelier/clients', { ok: 'Client supprimé du fichier.' });
  }
  if (m && req.method === 'POST' && m[2] === 'code') {
    const c = (await db(env, 'client/get', { id: Number(m[1]) })).client;
    if (!c) return back('/atelier/clients', { err: 'Client introuvable.' });
    const r = await referralFor(env, { owner: c.first || c.last, email: c.email, origin: `client-${c.id}`, clientId: c.id }, now);
    return back(`/atelier/clients/${c.id}`, { ok: `Code de parrainage de ${name(c)} : ${r.code}` });
  }
  if (path === '/atelier/codes' && req.method === 'GET') return codes(env, url, now);
  if (path === '/atelier/codes' && req.method === 'POST') return codesPost(req, env, now);
  if (path === '/atelier/stats') return redirect(`/stats?cle=${encodeURIComponent(env.STATS_KEY || '')}`);
  if (path === '/atelier/fiche') return redirect(`/fiche-google?cle=${encodeURIComponent(env.STATS_KEY || '')}`);
  return page('Introuvable', '/atelier', '<h1>Page introuvable</h1><p><a href="/atelier">Retour à l’accueil</a></p>', url);
}

// ---------------------------------------------------------------- appointments from the calendar
/** the online appointments in the calendar between two days, with their booking when known */
async function calendarBookings(env, from, to) {
  const events = await bookedEvents(env, env.CALENDAR_WRITE, dayStart(from), dayStart(addDays(to, 1))).catch(() => null);
  if (!events) return null;
  const known = Object.fromEntries((await db(env, 'bookings/list', { from: addDays(from, -62), to: addDays(to, 62), limit: 500 })).bookings.map((b) => [b.session, b]));
  return events
    .filter((e) => e.status !== 'cancelled' && e.start?.dateTime)
    .map((e) => {
      const at = paris(Date.parse(e.start.dateTime));
      const end = paris(Date.parse(e.end.dateTime));
      const b = known[e.extendedProperties?.private?.session] || null;
      return { at, end, event: e, b };
    })
    .sort((x, y) => (x.at.date + x.at.time < y.at.date + y.at.time ? -1 : 1));
}

/** once: the bookings made before the client file existed, read back from the calendar and Stripe */
async function backfill(env, now) {
  if ((await db(env, 'setting/get', { key: 'backfilled' })).value) return;
  const today = paris(now).date;
  const events = await bookedEvents(env, env.CALENDAR_WRITE, dayStart(addDays(today, -365)), dayStart(addDays(today, 63))).catch(() => null);
  if (!events) return;
  for (const e of events) {
    const id = e.extendedProperties?.private?.session;
    if (!id || e.status === 'cancelled') continue;
    const s = await getSession(env, id).catch(() => null);
    if (!s || s.payment_status !== 'paid') continue;
    const m = s.metadata || {};
    let c = {};
    try {
      c = JSON.parse(m.customer || '{}');
    } catch {}
    const items = (() => {
      try {
        return JSON.parse(m.config || '{}');
      } catch {
        return {};
      }
    })();
    const q = withDiscount(quote(items), Number(m.discount) || 0);
    if (q.error) continue;
    await db(env, 'booking/add', { now: (s.created || 0) * 1000 || now, session: id, event: e.id, date: m.date, time: m.time, minutes: q.minutes, items: q.items.map((i) => ({ label: i.label, detail: i.detail, price: i.price })), total: q.total, discount: q.discount || 0, code: m.code || '', codeKind: m.code ? m.codeKind || 'parrainage' : '', mode: m.mode, paid: (s.amount_total || 0) / 100, customer: c, live: s.livemode !== false, created: (s.created || 0) * 1000 || now });
  }
  await db(env, 'setting/set', { key: 'backfilled', value: now });
}

const itemsOf = (b) => {
  try {
    return JSON.parse(b.items || '[]');
  } catch {
    return [];
  }
};
const what = (x) => (x.b ? itemsOf(x.b).map((i) => i.label).join(' + ') : (x.event.summary || '').replace(/^RDV\s+/, '').replace(/\s+—\s+[^—]+$/, ''));

function apptRow(x, { withDate = true } = {}) {
  const b = x.b;
  const who = b ? `<a href="/atelier/clients/${b.client_id}">${esc(name(b))}</a>${b.phone ? `<small><a href="tel:${esc(tel(b.phone))}">${esc(b.phone)}</a></small>` : ''}` : esc((x.event.summary || '').split(' — ').pop());
  const money = b ? `${eur(b.total)}<small>payé ${eur(b.paid)}${b.total - b.paid > 0 ? ` · reste ${eur(b.total - b.paid)}` : ''}</small>` : '<span class="dim">voir l’agenda</span>';
  return `<tr>${withDate ? `<td><b>${esc(dayLabel(x.at.date))}</b><small>${esc(hour(x.at.time))} – ${esc(hour(x.end.time))}</small></td>` : ''}<td>${who}</td><td class="hide-s">${esc(what(x))}${b?.code ? `<small>code <span class="code">${esc(b.code)}</span> −${eur(b.discount)}</small>` : ''}</td><td class="n">${money}</td></tr>`;
}

// ---------------------------------------------------------------- Accueil
async function home(env, url, now) {
  const today = paris(now).date;
  const from = `${today.slice(0, 8)}01`;
  const [sum, next, band, visits] = await Promise.all([
    db(env, 'summary', { from, to: today }),
    calendarBookings(env, today, addDays(today, 14)),
    db(env, 'banner/get'),
    env.STATS
      ? report(env, { site: 'site', from, to: today, pfrom: from, pto: today })
          .then((r) => totalsOf(r.totals))
          .catch(() => null)
      : null,
  ]);
  const month = new Intl.DateTimeFormat('fr-FR', { month: 'long', timeZone: 'UTC' }).format(new Date(`${from}T12:00:00Z`));
  const figs = [
    [sum.bookings.n, 'RDV réservés en ligne'],
    [eur(sum.bookings.paid), 'encaissés en ligne'],
    [eur(sum.bookings.due), 'reste à encaisser à l’atelier'],
    [sum.requests, 'demandes de devis'],
    [sum.clients, 'nouveaux clients'],
    ...(visits ? [[visits.visits, 'visites du site']] : []),
  ];
  const nextHtml = next === null ? '<p class="empty">Agenda indisponible pour le moment.</p>' : next.length ? `<table><tbody>${next.map((x) => apptRow(x)).join('')}</tbody></table>` : '<p class="empty">Aucun RDV en ligne dans les 14 prochains jours.</p>';
  const b = band.banner;
  const bandState = !b ? 'aucun' : !b.active ? 'en pause' : now < b.starts ? `programmé à partir du ${dateOf(b.starts)}` : now > b.expires ? 'terminé' : `affiché jusqu’au ${dateOf(b.expires)}`;
  const body = `<h1>Bonjour ${esc((B.owner || '').split(' ')[0] || '')}</h1>
<p class="lead">${esc(dayLabel(today, { weekday: 'long', day: 'numeric', month: 'long' }))} · ${sum.totalClients} client${sum.totalClients > 1 ? 's' : ''} dans le fichier</p>
<h3>En ${esc(month)}</h3><div class="figs">${figs.map(([v, l]) => `<div class="fig"><b>${esc(v)}</b><span>${esc(l)}</span></div>`).join('')}</div>
<section class="card"><h2>Prochains rendez-vous en ligne <a class="right small" href="/atelier/rdv">Tout voir</a></h2>${nextHtml}</section>
<div class="grid">
<section class="card"><h2>Bandeau du site</h2>${b ? `<div class="band">${esc(b.text)}</div>` : ''}<p class="dim">État : ${esc(bandState)}${sum.promoUses.length ? ` · ce mois-ci : ${sum.promoUses.map((p) => `${esc(p.code)} utilisé ${p.n} fois`).join(', ')}` : ''}</p><a class="btn ghost small" href="/atelier/codes">Régler le bandeau et les codes</a></section>
<section class="card"><h2>Raccourcis</h2><div class="btns"><a class="btn small" href="/atelier/clients/nouveau">Ajouter un client</a><a class="btn ghost small" href="/atelier/codes#parrainage">Donner un code de parrainage</a><a class="btn ghost small" href="/atelier/clients.csv">Exporter les clients</a><a class="btn ghost small" href="/atelier/stats">Statistiques détaillées</a></div></section>
</div>`;
  return page('Accueil', '/atelier', body, url);
}

// ---------------------------------------------------------------- Rendez-vous
async function appointments(env, url, now) {
  await backfill(env, now).catch((err) => console.error('[atelier] backfill', err.message));
  const today = paris(now).date;
  const [next, past] = await Promise.all([calendarBookings(env, today, addDays(today, R.horizonDays + 1)), db(env, 'bookings/list', { from: addDays(today, -730), to: addDays(today, -1), desc: true, limit: 150 })]);
  // online bookings to come that are no longer in the calendar: cancelled by the workshop
  const shown = new Set((next || []).map((x) => x.b?.session).filter(Boolean));
  const gone = next ? (await db(env, 'bookings/list', { from: today, to: addDays(today, 90), limit: 200 })).bookings.filter((b) => !shown.has(b.session)) : [];
  const nextHtml = next === null ? '<p class="empty">Agenda indisponible pour le moment.</p>' : next.length ? `<table><thead><tr><th>Quand</th><th>Client</th><th class="hide-s">Prestations</th><th class="n">Montant</th></tr></thead><tbody>${next.map((x) => apptRow(x)).join('')}</tbody></table>` : '<p class="empty">Aucun RDV en ligne à venir.</p>';
  const pastRow = (b) => `<tr><td><b>${esc(dayLabel(b.date, { day: 'numeric', month: 'short', year: '2-digit' }))}</b><small>${esc(hour(b.time))}</small></td><td><a href="/atelier/clients/${b.client_id}">${esc(name(b))}</a>${b.live ? '' : ' <span class="tag tag--off">test</span>'}</td><td class="hide-s">${esc(itemsOf(b).map((i) => i.label).join(' + '))}${b.code ? `<small>code <span class="code">${esc(b.code)}</span></small>` : ''}</td><td class="n">${eur(b.total)}<small>payé ${eur(b.paid)}</small></td></tr>`;
  const body = `<h1>Rendez-vous réservés en ligne</h1><p class="lead">Les RDV que vous notez vous-même restent dans votre agenda Google. Déplacer ou supprimer un RDV : directement dans l’agenda SOLAR CAR 37 ; rembourser : dans Stripe.</p>
<section class="card"><h2>À venir</h2>${nextHtml}</section>
${gone.length ? `<section class="card"><h2>Retirés de l’agenda</h2><p class="dim">Réservés et payés en ligne, mais supprimés de l’agenda : pensez au remboursement dans Stripe si le client a annulé.</p><table><tbody>${gone.map(pastRow).join('')}</tbody></table></section>` : ''}
<section class="card"><h2>Passés</h2>${past.bookings.length ? `<table><tbody>${past.bookings.map(pastRow).join('')}</tbody></table>` : '<p class="empty">Aucun RDV en ligne passé pour l’instant.</p>'}</section>`;
  return page('Rendez-vous', '/atelier/rdv', body, url);
}

// ---------------------------------------------------------------- Clients
async function clients(env, url) {
  const q = url.searchParams.get('q') || '';
  const r = await db(env, 'clients/list', { q });
  const row = (c) => `<tr><td><a href="/atelier/clients/${c.id}"><b>${esc(name(c))}</b></a><small>${esc(c.vehicles || '')}</small></td><td>${c.phone ? `<a href="tel:${esc(tel(c.phone))}">${esc(c.phone)}</a>` : ''}<small class="hide-s">${esc(c.email)}</small></td><td class="n hide-s">${c.n_bookings ? `${c.n_bookings} RDV<small>${eur(c.paid)}</small>` : c.n_requests ? `<span class="tag tag--gold">devis</span>` : ''}</td><td class="n hide-s">${esc(dateOf(c.last_seen))}</td></tr>`;
  const body = `<h1>Fichier clients <span class="dim">${r.total}</span></h1>
<p class="lead">Chaque réservation en ligne et chaque demande de devis s’y ajoutent toutes seules ; un même client est reconnu à son e-mail ou à son téléphone.</p>
<div class="btns" style="margin:0 0 12px"><a class="btn small" href="/atelier/clients/nouveau">Ajouter un client</a><a class="btn ghost small" href="/atelier/clients.csv">Télécharger pour Excel</a></div>
<form class="search card" method="get" action="/atelier/clients"><input name="q" value="${esc(q)}" placeholder="Nom, téléphone, e-mail, véhicule, immatriculation…" aria-label="Rechercher"><button>Rechercher</button></form>
<section class="card">${r.clients.length ? `<table><thead><tr><th>Client</th><th>Contact</th><th class="n hide-s">Historique</th><th class="n hide-s">Dernier contact</th></tr></thead><tbody>${r.clients.map(row).join('')}</tbody></table>` : `<p class="empty">${q ? 'Aucun client ne correspond.' : 'Le fichier se remplit avec les prochaines réservations et demandes de devis.'}</p>`}</section>`;
  return page('Clients', '/atelier/clients', body, url);
}

async function clientCard(env, url, id) {
  const c = id ? (await db(env, 'client/get', { id })).client : null;
  if (id && !c) return page('Client', '/atelier/clients', '<h1>Client introuvable</h1><p><a href="/atelier/clients">Retour au fichier</a></p>', url);
  const v = c || {};
  const field = (n, label, value, attrs = '') => `<div><label for="f-${n}">${label}</label><input id="f-${n}" name="${n}" value="${esc(value)}" ${attrs}></div>`;
  const form = `<form class="card" method="post" action="/atelier/clients">${c ? `<input type="hidden" name="id" value="${c.id}">` : ''}
<div class="row">${field('firstName', 'Prénom', v.first, 'autocomplete="off"')}${field('lastName', 'Nom', v.last, 'autocomplete="off"')}</div>
<div class="row">${field('phone', 'Téléphone', v.phone, 'type="tel" autocomplete="off"')}${field('email', 'E-mail', v.email, 'type="email" autocomplete="off"')}</div>
<div class="row">${field('vehicles', 'Véhicule(s)', v.vehicles, 'placeholder="ex. Peugeot 308 SW · BMW E36"')}${field('plate', 'Immatriculation', v.plate)}</div>
${field('source', 'Nous a connus', v.source, 'placeholder="Instagram, bouche-à-oreille…"')}
<div><label for="f-notes">Notes</label><textarea id="f-notes" name="notes" placeholder="Teinte posée, remarques, préférences…">${esc(v.notes)}</textarea></div>
<div class="btns"><button>Enregistrer</button><a class="btn ghost" href="/atelier/clients">Annuler</a></div></form>`;
  if (!c) return page('Nouveau client', '/atelier/clients', `<h1>Ajouter un client</h1>${form}`, url);
  const bookings = c.bookings.length ? `<table><tbody>${c.bookings.map((b) => `<tr><td><b>${esc(dayLabel(b.date, { day: 'numeric', month: 'short', year: '2-digit' }))}</b><small>${esc(hour(b.time))}</small></td><td>${esc(itemsOf(b).map((i) => i.label).join(' + '))}${b.code ? `<small>code <span class="code">${esc(b.code)}</span> −${eur(b.discount)}</small>` : ''}</td><td class="n">${eur(b.total)}<small>payé ${eur(b.paid)}</small></td></tr>`).join('')}</tbody></table>` : '<p class="empty">Aucun RDV réservé en ligne.</p>';
  const requests = c.requests.length ? `<ul class="list">${c.requests.map((r) => `<li><span><b>${esc(dateOf(r.at))}</b> · ${esc(r.services || 'devis')}${r.vehicle ? ` · ${esc(r.vehicle)}` : ''}${r.message ? `<br><span class="dim">${esc(r.message)}</span>` : ''}</span></li>`).join('')}</ul>` : '<p class="empty">Aucune demande de devis.</p>';
  const codes = c.codes.length
    ? `<ul class="list">${c.codes.map((k) => `<li><span class="code">${esc(k.code)}</span><span>${k.used ? `<span class="tag tag--gold">utilisé le ${esc(dateOf(k.used))}</span>` : k.expires < Date.now() ? '<span class="tag tag--off">expiré</span>' : `<span class="tag tag--ok">valable jusqu’au ${esc(dateOf(k.expires))}</span>`}</span></li>`).join('')}</ul>`
    : `<form method="post" action="/atelier/clients/${c.id}/code"><p class="dim">Pas encore de code de parrainage.</p><button class="small">Créer son code (${R.referral.amount} € à offrir)</button></form>`;
  const body = `<h1>${esc(name(c))}</h1><p class="lead">Client depuis le ${esc(dateOf(c.created))} · ${esc(c.origin || '')}</p>
<div class="btns" style="margin:0 0 14px">${c.phone ? `<a class="btn small" href="tel:${esc(tel(c.phone))}">Appeler</a>` : ''}${c.email ? `<a class="btn ghost small" href="mailto:${esc(c.email)}">Écrire</a>` : ''}</div>
${form}
<div class="grid"><section class="card"><h2>Rendez-vous en ligne</h2>${bookings}</section><section class="card"><h2>Demandes de devis</h2>${requests}</section></div>
<section class="card" id="parrainage"><h2>Parrainage</h2>${codes}</section>
<form class="card" method="post" action="/atelier/clients/${c.id}/supprimer"><h2>Supprimer ce client</h2><p class="dim">Sa fiche et ses demandes sont effacées (droit à l’effacement). Les RDV payés restent, sans son nom, pour la comptabilité.</p><div class="checks"><label><input type="checkbox" name="confirme" value="1" required> Je confirme</label></div><button class="danger small">Supprimer définitivement</button></form>`;
  return page(name(c), '/atelier/clients', body, url);
}

async function clientSave(req, env) {
  const f = await req.formData();
  const g = (k) => String(f.get(k) || '');
  const id = Number(g('id')) || 0;
  const r = await db(env, 'client/save', { id, client: { firstName: g('firstName'), lastName: g('lastName'), email: g('email'), phone: g('phone'), vehicles: g('vehicles'), plate: g('plate'), source: g('source'), notes: g('notes') } });
  if (!r.ok) return back(id ? `/atelier/clients/${id}` : '/atelier/clients/nouveau', { err: r.error });
  return back(`/atelier/clients/${r.id}`, { ok: 'Fiche enregistrée.' });
}

/** the client file for Excel: semicolons, UTF-8 with its mark, no cell read as a formula */
async function clientsCsv(env, now) {
  const r = await db(env, 'clients/list', { all: true });
  const cell = (v) => {
    let s = String(v ?? '').replace(/\r?\n/g, ' ');
    if (/^[=+\-@\t]/.test(s)) s = `'${s}`;
    return /[;"]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const head = ['Prénom', 'Nom', 'E-mail', 'Téléphone', 'Véhicule(s)', 'Immatriculation', 'Nous a connus', 'RDV en ligne', 'Payé en ligne (€)', 'Demandes de devis', 'Code de parrainage', 'Origine', 'Premier contact', 'Dernier contact', 'Notes'];
  const day = (ms) => (ms ? paris(ms).date.split('-').reverse().join('/') : '');
  const lines = r.clients.map((c) => [c.first, c.last, c.email, c.phone, c.vehicles, c.plate, c.source, c.n_bookings, String(c.paid || 0).replace('.', ','), c.n_requests, c.referral || '', c.origin, day(c.created), day(c.last_seen), c.notes].map(cell).join(';'));
  return new Response('﻿' + [head.join(';'), ...lines].join('\r\n') + '\r\n', { headers: { 'content-type': 'text/csv; charset=utf-8', 'content-disposition': `attachment; filename="clients-solar-car-37-${paris(now).date}.csv"`, 'cache-control': 'no-store' } });
}

// ---------------------------------------------------------------- Codes et promos
async function codes(env, url, now) {
  const [list, band] = await Promise.all([db(env, 'codes/list'), db(env, 'banner/get')]);
  const b = band.banner;
  const day = (ms) => (ms ? paris(ms).date : '');
  const editing = url.searchParams.get('modifier') ? list.promos.find((p) => p.code === url.searchParams.get('modifier')) : null;
  const p = editing || {};
  const services = p.services ? p.services.split(',') : codeServices.map((s) => s.id);
  const promoState = (x) => (!x.active ? '<span class="tag tag--off">en pause</span>' : now < x.starts ? '<span class="tag tag--gold">programmé</span>' : now > x.expires ? '<span class="tag tag--off">terminé</span>' : x.max_uses && x.uses >= x.max_uses ? '<span class="tag tag--off">épuisé</span>' : '<span class="tag tag--ok">actif</span>');
  const promoRows = list.promos.length
    ? `<table><thead><tr><th>Code</th><th>Remise</th><th class="hide-s">Période</th><th class="n">Utilisé</th></tr></thead><tbody>${list.promos
        .map(
          (x) => `<tr><td><span class="code">${esc(x.code)}</span><small>${esc(x.label)}</small></td><td>${x.percent ? `−${esc(x.percent)} %` : `−${eur(x.amount)}`}<small>${esc(x.services ? x.services.split(',').map((s) => codeServices.find((c) => c.id === s)?.label.split(' (')[0] || s).join(', ') : 'toutes les prestations')}</small></td><td class="hide-s">${esc(dateOf(x.starts))} → ${esc(dateOf(x.expires))}</td><td class="n">${x.uses}${x.max_uses ? ` / ${x.max_uses}` : ''}<small>${promoState(x)}</small></td></tr><tr class="acts"><td colspan="4"><form method="post" action="/atelier/codes" class="btns"><input type="hidden" name="code" value="${esc(x.code)}"><input type="hidden" name="active" value="${x.active ? '' : '1'}"><button class="ghost small" name="action" value="promo-active">${x.active ? 'Mettre en pause' : 'Activer'}</button><a class="btn ghost small" href="/atelier/codes?modifier=${encodeURIComponent(x.code)}#promo">Modifier</a></form></td></tr>`
        )
        .join('')}</tbody></table>`
    : '<p class="empty">Aucun code promo.</p>';
  const refRows = list.codes.length
    ? `<table><thead><tr><th>Code</th><th class="hide-s">Client</th><th>État</th></tr></thead><tbody>${list.codes
        .slice(0, 100)
        .map((c) => `<tr><td class="code">${esc(c.code)}</td><td class="hide-s">${c.client_id ? `<a href="/atelier/clients/${c.client_id}">${esc(c.owner)}</a>` : esc(c.owner)}<small>${esc(dateOf(c.created))}</small></td><td>${c.used ? `<span class="tag tag--gold">utilisé le ${esc(dateOf(c.used))}</span><small>${esc(c.used_by)} · ${esc(c.used_where)}</small>` : c.expires < now ? '<span class="tag tag--off">expiré</span>' : `<span class="tag tag--ok">disponible</span><small>jusqu’au ${esc(dateOf(c.expires))}</small>`}</td></tr>`)
        .join('')}</tbody></table>`
    : '<p class="empty">Aucun code de parrainage pour l’instant : ils partent avec l’e-mail envoyé une semaine après chaque RDV, ou se créent ici ou depuis la fiche d’un client.</p>';
  const body = `<h1>Codes et promos</h1>
<section class="card" id="bandeau"><h2>Bandeau du site</h2><p class="dim">Affiché en bas de toutes les pages du site entre ces deux dates, tout seul ; « en pause » le cache tout de suite. Le bouton mène à la réservation, avec le code déjà rempli.</p>
${b ? `<div class="band">${esc(b.text)} <b>${esc(b.cta)} →</b></div>` : ''}
<form method="post" action="/atelier/codes"><label for="b-text">Texte</label><textarea id="b-text" name="text" maxlength="220" required>${esc(b?.text || '')}</textarea>
<div class="row3"><div><label for="b-cta">Bouton</label><input id="b-cta" name="cta" maxlength="30" value="${esc(b?.cta || 'Réserver')}"></div><div><label for="b-from">Du</label><input id="b-from" name="starts" type="date" value="${esc(day(b?.starts))}" required></div><div><label for="b-to">Au (inclus)</label><input id="b-to" name="ends" type="date" value="${esc(day(b?.expires))}" required></div></div>
<div class="row"><div><label for="b-code">Code rempli à la réservation</label><input id="b-code" name="code" value="${esc(b?.code || '')}" placeholder="NOEL"></div><div class="checks" style="align-items:end;padding-bottom:12px"><label><input type="checkbox" name="active" value="1"${!b || b.active ? ' checked' : ''}> Bandeau actif</label></div></div>
<button name="action" value="banner-save">Enregistrer le bandeau</button></form></section>

<section class="card" id="promo"><h2>Codes promo</h2>${promoRows}
<h3>${editing ? `Modifier ${esc(editing.code)}` : 'Créer un code promo'}</h3>
<form method="post" action="/atelier/codes">${editing ? '<input type="hidden" name="update" value="1">' : ''}
<div class="row"><div><label for="p-code">Code</label><input id="p-code" name="code" value="${esc(p.code || '')}" required maxlength="20" placeholder="NOEL, PRINTEMPS27…"${editing ? ' readonly' : ''} style="text-transform:uppercase"></div><div><label for="p-label">Nom (pour vous)</label><input id="p-label" name="label" value="${esc(p.label || '')}" placeholder="Noël 2026"></div></div>
<div class="row3"><div><label for="p-type">Remise</label><select id="p-type" name="type"><option value="percent"${!p.amount ? ' selected' : ''}>en %</option><option value="amount"${p.amount ? ' selected' : ''}>en €</option></select></div><div><label for="p-value">Valeur</label><input id="p-value" name="value" type="number" min="1" max="1000" step="0.5" value="${esc(p.percent || p.amount || '')}" required></div><div><label for="p-max">Utilisations (vide = illimité)</label><input id="p-max" name="maxUses" type="number" min="1" step="1" value="${esc(p.max_uses || '')}"></div></div>
<div class="row"><div><label for="p-from">Du</label><input id="p-from" name="starts" type="date" value="${esc(day(p.starts))}" required></div><div><label for="p-to">Au (inclus)</label><input id="p-to" name="ends" type="date" value="${esc(day(p.expires))}" required></div></div>
<label>Prestations concernées</label><div class="checks">${codeServices.map((s) => `<label><input type="checkbox" name="services" value="${s.id}"${services.includes(s.id) ? ' checked' : ''}> ${esc(s.label)}</label>`).join('')}</div>
<div class="btns"><button name="action" value="promo-save">${editing ? 'Enregistrer' : 'Créer le code'}</button>${editing ? '<a class="btn ghost" href="/atelier/codes#promo">Annuler</a>' : ''}</div></form>
<p class="dim">Un code promo se tape dans le même champ que le parrainage, à l’étape du paiement ; un seul code par réservation. Pour une prestation faite sur devis, appliquez la remise vous-même.</p></section>

<section class="card" id="parrainage"><h2>Parrainage</h2><div class="figs"><div class="fig"><b>${list.given}</b><span>codes donnés</span></div><div class="fig"><b>${list.used}</b><span>codes utilisés</span></div><div class="fig"><b>${eur(list.offered)}</b><span>de remises offertes</span></div></div>
<div class="grid"><form method="post" action="/atelier/codes"><h3>Un client utilise un code à l’atelier</h3><label for="u-code">Code</label><input id="u-code" name="code" required autocomplete="off" placeholder="JEAN-7K2QX" style="text-transform:uppercase"><label for="u-client">Client qui en profite</label><input id="u-client" name="client" autocomplete="off" placeholder="Prénom et nom"><div class="btns"><button name="action" value="referral-use">Utiliser</button><button class="ghost" name="action" value="referral-check" formnovalidate>Vérifier seulement</button></div></form>
<form method="post" action="/atelier/codes"><h3>Donner un code à un client</h3><label for="c-first">Prénom du client</label><input id="c-first" name="first" required autocomplete="off"><label for="c-email">E-mail (facultatif)</label><input id="c-email" name="email" type="email" autocomplete="off"><button name="action" value="referral-create">Créer son code</button><p class="dim">Pour un client déjà dans le fichier, créez-le plutôt depuis sa fiche.</p></form></div>
${url.searchParams.get('nouveau') ? `<div class="band"><p class="dim" style="margin:0">Code à donner (SMS, carte…) :</p><p class="big" style="margin:4px 0 0">${esc(url.searchParams.get('nouveau'))}</p></div>` : ''}
${refRows}</section>`;
  return page('Codes et promos', '/atelier/codes', body, url);
}

async function codesPost(req, env, now) {
  const f = await req.formData();
  const g = (k) => String(f.get(k) || '').trim();
  const action = g('action');
  if (action === 'banner-save') {
    const r = await db(env, 'banner/save', { now, text: g('text'), cta: g('cta'), code: g('code'), starts: g('starts'), ends: g('ends'), active: !!f.get('active') });
    return back('/atelier/codes', r.ok ? { ok: 'Bandeau enregistré.' } : { err: r.error });
  }
  if (action === 'promo-save') {
    const value = Number(g('value'));
    const r = await db(env, 'promo/save', { now, code: g('code'), label: g('label'), percent: g('type') === 'percent' ? value : 0, amount: g('type') === 'amount' ? value : 0, maxUses: g('maxUses'), starts: g('starts'), ends: g('ends'), services: f.getAll('services').map(String), update: !!f.get('update') });
    return r.ok ? back('/atelier/codes', { ok: `Code ${r.code} enregistré.` }) : back('/atelier/codes', { err: r.error });
  }
  if (action === 'promo-active') {
    await db(env, 'promo/active', { code: g('code'), active: !!f.get('active') });
    return back('/atelier/codes', { ok: `Code ${g('code')} ${f.get('active') ? 'activé' : 'mis en pause'}.` });
  }
  if (action === 'referral-use') {
    const who = g('client') || 'client de l’atelier';
    const code = g('code');
    const r = await redeemReferral(env, code, { by: who, ref: `atelier-${now}`, where: 'à l’atelier' }, now);
    return back('/atelier/codes', r.ok ? { ok: `Code ${code.toUpperCase()} utilisé : ${R.referral.amount} € de remise pour ${who}.` } : { err: r.error });
  }
  if (action === 'referral-check') {
    const r = await checkCode(env, g('code'), now);
    if (!r.ok) return back('/atelier/codes', { err: r.error });
    return back('/atelier/codes', { ok: r.kind === 'promo' ? `${r.code} est un code promo actif (${r.percent ? `−${r.percent} %` : `−${r.amount} €`}).` : `Code ${r.code} valable (${r.amount} €, client ${r.owner}) jusqu’au ${dateOf(r.expires)} : pas encore utilisé.` });
  }
  if (action === 'referral-create') {
    if (!g('first')) return back('/atelier/codes', { err: 'Indiquez le prénom du client.' });
    const r = await referralFor(env, { owner: g('first'), email: g('email'), origin: `atelier-${now}` }, now);
    return back('/atelier/codes', { nouveau: r.code, ok: `Code créé pour ${g('first')}.` });
  }
  return back('/atelier/codes', { err: 'Action inconnue.' });
}

