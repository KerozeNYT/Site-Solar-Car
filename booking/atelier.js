/**
 * The workshop's space (docs/ATELIER.md): /atelier, on the booking server.
 *
 *   /atelier                 Accueil: the month in figures, the next appointments, the promotion
 *   /atelier/rdv             the appointments booked online: to come, past
 *   /atelier/clients         the client file: search, card of each client, add, edit, delete,
 *                            export for Excel (/atelier/clients.csv)
 *   /atelier/codes           the band of the site, the promotion codes, the referral codes
 *   /atelier/plus            the other places, and the settings (delays of the quotes)
 *   /atelier/live            JSON for the page open on a screen (badges, what just happened)
 *   /atelier/stats           → the statistics page; /atelier/fiche → the Google profile robot
 *
 * Sign-in: a 6-digit code e-mailed to the workshop (ATELIER_EMAILS, else NOTIFY_TO), valid
 * 10 minutes; then a session cookie signed with ATELIER_SECRET, for 30 days on that device. No
 * password to remember. Every change is a form sent to this server (same origin only); one script
 * of this server (booking/atelier-look.js) draws the garage and keeps the pages live, and the
 * pages work without it.
 */
import { bookingRules as R, codeServices, formatEuros, quote, withDiscount } from '../content/booking.js';
import { business as B } from '../content/site.js';
import { report, totalsOf } from './stats.js';
import { db, referralFor, redeemReferral, checkCode, dayStart, atelierFetch, QUOTE_STATUS } from './store.js';
import { gmailReady, gmailState, gmailSync, consentUrl, callback as gmailCallback, disconnect as gmailDisconnect } from './gmail.js';
import { bookedEvents, listEvents } from './google.js';
import { getSession } from './stripe.js';
import { send, shell as mailShell } from './mail.js';
import { utcToZoned, addDays } from './schedule.js';
import { siteThemes } from '../content/themes.js';
import { CSS, JS, CSS_V, JS_V } from './atelier-look.js';

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
const cap = (s) => String(s).charAt(0).toUpperCase() + String(s).slice(1);
const HEADERS = {
  'content-type': 'text/html; charset=utf-8',
  'cache-control': 'no-store',
  'x-robots-tag': 'noindex, nofollow',
  // same-origin, not no-referrer: with no-referrer the browser sends « Origin: null » with the
  // forms, which the origin check below would refuse
  'referrer-policy': 'same-origin',
  'x-content-type-options': 'nosniff',
  // one script, from this server (booking/atelier-look.js): the garage, the live updates
  'content-security-policy': "default-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self'; manifest-src 'self'; form-action 'self'; frame-ancestors 'none'; base-uri 'none'",
};

/** the looks of a band (src/styles/main.css, .promo-band--…) */
const THEMES = { classique: 'Classique (noir et or)', noel: 'Noël (rouge, neige)', neon: 'Néon (coucher de soleil)' };
const bandState = (x, now) => (!x.active ? '<span class="tag tag--off">en pause</span>' : now < x.starts ? '<span class="tag tag--gold">programmé</span>' : now > x.expires ? '<span class="tag tag--off">terminé</span>' : '<span class="tag tag--ok">affiché</span>');
/** the public site (the preview until the site is on solarcar37.fr) */
const siteUrl = (env) => String(env.SITE_URL || B.siteUrl).replace(/\/$/, '');

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
/** stroke icons (24 × 24), drawn like the site's */
const ICONS = {
  home: '<path d="M3 10.5 12 3l9 7.5V21h-6v-6H9v6H3z"/>',
  chat: '<path d="M4 5h16v11H9l-5 4z"/><path d="M8 9.5h8M8 12.5h5"/>',
  cal: '<rect x="3" y="5" width="18" height="16" rx="2.5"/><path d="M3 10h18M8 3v4M16 3v4"/>',
  users: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c.8-3.6 3.4-5.5 6.5-5.5s5.7 1.9 6.5 5.5"/><path d="M16 4.6a3.3 3.3 0 0 1 0 6.6M18 14.6c2 .7 3.2 2.5 3.5 5.4"/>',
  tag: '<path d="M3 12V4h8l10 10-8 8z"/><circle cx="7.5" cy="8.5" r="1.5"/>',
  chart: '<path d="M4 20V11M10 20V5M16 20v-7M2 20h20"/>',
  pin: '<path d="M12 21s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/>',
  out: '<path d="M15 4h4v16h-4M10 8l-4 4 4 4M6 12h10"/>',
  phone: '<path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2"/>',
  mail: '<rect x="3" y="5" width="18" height="14" rx="2.5"/><path d="m4 7 8 6 8-6"/>',
  send: '<path d="M4 12 20 4l-6 16-3-7z"/><path d="m11 13 3-3"/>',
  clip: '<path d="M20 11.5 12 19.5a5 5 0 0 1-7-7l8-8a3.5 3.5 0 0 1 5 5l-8 8a2 2 0 0 1-3-3l7.5-7.5"/>',
  back: '<path d="M15 5l-7 7 7 7"/>',
  file: '<path d="M14 3H6v18h12V7z"/><path d="M14 3v4h4"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21c1-4.4 4.2-6.5 8-6.5s7 2.1 8 6.5"/>',
  trash: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  inbox: '<path d="M3 13l3-8h12l3 8v6H3z"/><path d="M3 13h5l1.5 2.5h5L16 13h5"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  check: '<circle cx="12" cy="12" r="9"/><path d="m8 12.5 2.7 2.7L16.5 9"/>',
  bolt: '<path d="M13 2 4 14h7l-1 8 9-12h-7z"/>',
  gear: '<circle cx="12" cy="12" r="3.2"/><path d="M12 2.5v2.6M12 18.9v2.6M4.6 4.6l1.9 1.9M17.5 17.5l1.9 1.9M2.5 12h2.6M18.9 12h2.6M4.6 19.4l1.9-1.9M17.5 6.5l1.9-1.9"/>',
  grid: '<rect x="3.5" y="3.5" width="7" height="7" rx="2"/><rect x="13.5" y="3.5" width="7" height="7" rx="2"/><rect x="3.5" y="13.5" width="7" height="7" rx="2"/><rect x="13.5" y="13.5" width="7" height="7" rx="2"/>',
  card: '<rect x="2.5" y="5" width="19" height="14" rx="2.5"/><path d="M2.5 10h19M6.5 15h4"/>',
  download: '<path d="M12 4v11M7 10.5l5 5 5-5M4 20h16"/>',
  gift: '<rect x="3.5" y="8.5" width="17" height="4" rx="1"/><path d="M5 12.5V21h14v-8.5M12 8.5V21M12 8.5C10 4 6 4.5 6.8 7.2 7.3 8.6 12 8.5 12 8.5zM12 8.5c2-4.5 6-4 5.2-1.3-.5 1.4-5.2 1.3-5.2 1.3z"/>',
};
const ico = (k) => `<svg class="ico" viewBox="0 0 24 24" aria-hidden="true">${ICONS[k] || ''}</svg>`;
/** the rail of a wide screen: [address, label, icon, short label (dock)]; '' = a line between */
const TABS = [
  ['/atelier', 'Accueil', 'home', 'Accueil'],
  ['/atelier/devis', 'Devis', 'chat', 'Devis'],
  ['/atelier/rdv', 'Rendez-vous', 'cal', 'RDV'],
  ['/atelier/clients', 'Clients', 'users', 'Clients'],
  '',
  ['/atelier/codes', 'Codes et promos', 'tag', 'Promos'],
  ['/atelier/stats', 'Statistiques', 'chart', 'Stats'],
  ['/atelier/fiche', 'Fiche Google', 'pin', 'Fiche'],
  ['/atelier/plus', 'Réglages', 'gear', 'Plus'],
];
/** the dock of a phone: the four places of every day, and « Plus » for the rest */
const DOCK = [...TABS.slice(0, 4), ['/atelier/plus', 'Plus', 'grid', 'Plus']];
const UNDER_PLUS = new Set(['/atelier/codes', '/atelier/stats', '/atelier/fiche', '/atelier/plus']);
/** « + Nouveau »: what is made most often */
const NEW = [
  ['/atelier/clients/nouveau', 'user', 'Nouveau client', 'Venu par téléphone ou à l’atelier'],
  ['/atelier/codes#promo', 'tag', 'Code promo', 'Remise en % ou en €, dates, prestations'],
  ['/atelier/codes#parrainage', 'gift', 'Code de parrainage', `${R.referral.amount} € à offrir à un client`],
  ['/atelier/clients.csv', 'download', 'Exporter les clients', 'Fichier pour Excel'],
];
/** the site's seasonal look of the day (content/themes.js): the garage's tubes take its colours */
const season = (now) => {
  const day = paris(now).date;
  return siteThemes.find((t) => day >= t.starts && day <= t.ends)?.id || '';
};
const BACKDROP = '<div class="amb" aria-hidden="true"><div class="amb__haze"></div><div class="amb__sweep"></div><div class="amb__veil"></div></div>';
const HEAD = (title, now = Date.now()) => `<!doctype html><html lang="fr"${season(now) ? ` data-saison="${season(now)}"` : ''}><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><meta name="robots" content="noindex">
<title>${esc(title)} — Atelier ${esc(B.name)}</title><link rel="manifest" href="/atelier/manifest.webmanifest"><link rel="icon" type="image/png" href="/atelier/icone-180.png"><link rel="apple-touch-icon" href="/atelier/icone-180.png"><meta name="theme-color" content="#050608"><meta name="apple-mobile-web-app-capable" content="yes"><meta name="mobile-web-app-capable" content="yes"><meta name="apple-mobile-web-app-status-bar-style" content="black-translucent"><meta name="apple-mobile-web-app-title" content="Atelier">
<link rel="preload" href="/stats/f/geist.woff2" as="font" type="font/woff2" crossorigin><link rel="stylesheet" href="/atelier/app.css?v=${CSS_V}"><script src="/atelier/app.js?v=${JS_V}" defer></script></head>`;

/**
 * A page of the space. opts.refresh: redrawn by itself when something changes (the home, the
 * list of the quotes); every page signed in keeps its badges live.
 */
function page(title, active, body, url, opts = {}) {
  const badge = Number(url?.badge) || 0;
  const now = opts.now || Date.now();
  const badgeHtml = `<span class="badge" data-badge${badge ? ` aria-label="${badge} à traiter"` : ' hidden'}>${badge}</span>`;
  const current = (href) => href === active || (href === '/atelier/plus' && UNDER_PLUS.has(active) && !TABS.some((t) => t && t[0] === active && t[0] !== '/atelier/plus'));
  const link = ([href, label, icon, short], dock) => `<a href="${href}"${(dock ? href === active || (href === '/atelier/plus' && UNDER_PLUS.has(active)) : current(href)) ? ' aria-current="page"' : ''}>${ico(icon)}<span>${dock ? short : label}</span>${href === '/atelier/devis' ? badgeHtml : ''}</a>`;
  const ok = url?.searchParams.get('ok');
  const err = url?.searchParams.get('err');
  const liveLabel = '<span class="live" data-live-label><i></i><span>En direct</span></span>';
  const newMenu = (where) => `<details class="pop"><summary class="newbtn" aria-label="Nouveau">${ico('plus')}<span>Nouveau</span></summary><div class="pop__menu" role="menu">${NEW.map(([href, icon, label, hint]) => `<a href="${href}" role="menuitem">${ico(icon)}<span>${esc(label)}<small>${esc(hint)}</small></span></a>`).join('')}<a class="soon" aria-disabled="true">${ico('cal')}<span>Rendez-vous par téléphone<small>Bientôt : créneau et lien de paiement</small></span></a></div></details>`;
  const signed = !!active;
  return new Response(
    `${HEAD(title, now)}<body${signed ? ' data-live' : ''}${opts.refresh ? ' data-refresh' : ''}>${BACKDROP}
<div class="shell">${
      signed
        ? `<aside class="rail"><a class="brand" href="/atelier" aria-label="Accueil de l’espace atelier"><img src="/atelier/logo.webp" alt="SOLAR CAR" width="400" height="154"><span class="brand__tag">Atelier</span></a>
<nav class="nav" aria-label="Espace atelier">${TABS.map((t) => (t ? link(t) : '<div class="nav__sep"></div>')).join('')}</nav>
<div class="rail__foot">${newMenu('rail')}${liveLabel}<a class="out" href="/atelier/deconnexion">${ico('out')} Se déconnecter</a></div></aside>`
        : ''
    }
<div>${
      signed
        ? `<header class="top"><a class="brand" href="/atelier" aria-label="Accueil de l’espace atelier"><img src="/atelier/logo.webp" alt="SOLAR CAR" width="400" height="154"><span class="brand__tag">Atelier</span></a>${liveLabel}${newMenu('top')}</header>`
        : ''
    }
<main>${ok ? `<p class="msg msg--ok" role="status">${ico('check')}${esc(ok)}</p>` : ''}${err ? `<p class="msg msg--err" role="alert">${esc(err)}</p>` : ''}${body}</main></div></div>
${signed ? `<nav class="dock" aria-label="Espace atelier">${DOCK.map((t) => link(t, true)).join('')}</nav>` : ''}</body></html>`,
    { headers: HEADERS }
  );
}

// ---------------------------------------------------------------- sign-in
function loginPage(url, sent) {
  const err = url.searchParams.get('err');
  return new Response(
    `${HEAD('Connexion')}<body>${BACKDROP}<main class="login"><div class="card login__card">
<img class="login__logo" src="/atelier/logo.webp" alt="SOLAR CAR" width="400" height="154"><h1>Espace <em>atelier</em></h1>
${err ? `<p class="msg msg--err" role="alert">${esc(err)}</p>` : ''}
${
  sent
    ? `<p class="lead">Un code à 6 chiffres vient de partir par e-mail à l’atelier. Il est valable 10 minutes.</p>
<form method="post" action="/atelier/connexion"><label for="code">Code reçu</label><input id="code" name="code" inputmode="numeric" autocomplete="one-time-code" pattern="\\d{6}" maxlength="6" required autofocus style="font:600 24px/1.2 'Geist Mono',monospace;letter-spacing:.35em;text-align:center"><button style="width:100%">Se connecter</button></form>
<form method="post" action="/atelier/connexion/code" style="margin-top:12px;text-align:center"><button class="ghost small">Renvoyer un code</button></form>`
    : `<p class="lead">Pas de mot de passe : un code de connexion part par e-mail à l’atelier. Vous restez ensuite connecté ${SESSION_DAYS} jours sur cet appareil.</p>
<form method="post" action="/atelier/connexion/code"><button style="width:100%">${ico('mail')} Recevoir mon code par e-mail</button></form>`
}</div></main></body></html>`,
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
    return new Response(JSON.stringify({ name: `Atelier ${B.name}`, short_name: 'Atelier', start_url: '/atelier', scope: '/atelier', display: 'standalone', background_color: '#07080a', theme_color: '#07080a', icons: [{ src: '/atelier/icone-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' }, { src: '/atelier/icone-180.png', sizes: '180x180', type: 'image/png', purpose: 'any' }] }), { headers: { 'content-type': 'application/manifest+json', 'cache-control': 'public, max-age=86400' } });
  // the logo and the app icon (booking/brand.js)
  const asset = path.match(/^\/atelier\/(logo\.webp|logo\.png|icone-512\.png|icone-180\.png)$/);
  if (asset) {
    const { BRAND } = await import('./brand.js');
    const [data, type] = BRAND[asset[1]];
    return new Response(data, { headers: { 'content-type': type, 'cache-control': 'public, max-age=604800' } });
  }
  // the look: one style sheet, one script (their address carries their fingerprint)
  if (path === '/atelier/app.css') return new Response(CSS, { headers: { 'content-type': 'text/css; charset=utf-8', 'cache-control': 'public, max-age=31536000, immutable' } });
  if (path === '/atelier/app.js') return new Response(JS, { headers: { 'content-type': 'text/javascript; charset=utf-8', 'cache-control': 'public, max-age=31536000, immutable', 'x-content-type-options': 'nosniff' } });
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

  // Google's answer to « Connecter Gmail »: checked by its signed state (the browser comes back from
  // Google without the session cookie, kept « Strict »), then a page that goes on to the space
  if (path === '/atelier/gmail/retour' && req.method === 'GET') {
    const r = gmailReady(env) ? await gmailCallback(env, url, now) : { ok: false, error: 'Connexion Gmail pas encore configurée.' };
    const to = `/atelier/devis?${new URLSearchParams(r.ok ? { ok: `Gmail connecté${r.email ? ` (${r.email})` : ''} : vos échanges avec les clients arrivent dans les devis.` } : { err: r.error })}`;
    return new Response(`<!doctype html><meta charset="utf-8"><meta http-equiv="refresh" content="0; url=${esc(to)}"><title>Gmail</title><p style="font-family:system-ui;padding:24px"><a href="${esc(to)}">Continuer vers l’espace atelier</a></p>`, { headers: HEADERS });
  }

  if (!(await sessionOk(req, env, now))) return req.method === 'GET' ? redirect('/atelier/connexion') : new Response('Session expirée : reconnectez-vous.', { status: 401 });

  // Gmail: connect (a link: a form could not lead to Google, the pages only post to themselves),
  // read now, forget
  if (path === '/atelier/gmail/connexion' && req.method === 'GET') return gmailReady(env) ? redirect(await consentUrl(env, url, now)) : back('/atelier/devis', { err: 'Connexion Gmail pas encore configurée (identifiants Google à ajouter au serveur).' });
  if (path === '/atelier/gmail/sync' && req.method === 'POST') {
    const r = await gmailSync(env, now, { force: true });
    return back('/atelier/devis', r.error ? { err: `Gmail : ${r.error}` } : r.off ? { err: 'Gmail n’est pas connecté.' } : { ok: r.imported ? `${r.imported} message${r.imported > 1 ? 's' : ''} de Gmail ajouté${r.imported > 1 ? 's' : ''} aux devis.` : 'Gmail est à jour : aucun nouveau message.' });
  }
  if (path === '/atelier/gmail/deconnexion' && req.method === 'POST') {
    await gmailDisconnect(env);
    return back('/atelier/devis', { ok: 'Gmail déconnecté. (Pour retirer aussi l’accès chez Google : myaccount.google.com → Sécurité → Applications tierces.)' });
  }
  // the pages of the quotes, the home and the live updates: Gmail read first (once a minute at
  // most, 4 s at most)
  if (req.method === 'GET' && (path === '/atelier' || path === '/atelier/live' || path.startsWith('/atelier/devis'))) await Promise.race([gmailSync(env, now).catch(() => null), new Promise((ok) => setTimeout(ok, 4000))]);
  if (path === '/atelier/live' && req.method === 'GET') {
    const r = await db(env, 'live', { now, limit: 12 });
    return new Response(JSON.stringify({ ...r, at: now }), { headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', 'x-robots-tag': 'noindex' } });
  }
  if (path === '/atelier/reglages' && req.method === 'POST') {
    const f = await req.formData();
    const r = await db(env, 'quotes/delays', { now, set: { remind: String(f.get('relance') ?? ''), close: String(f.get('sans_suite') ?? '') } });
    return back('/atelier/plus', { ok: `Réglages enregistrés : à relancer après ${r.delays.remind} jours, sans suite après ${r.delays.close ? `${r.delays.close} jours` : 'jamais'}.` });
  }

  // the quote discussions; reading one marks it read, before the count of the « Devis » tab
  const dm = path.match(/^\/atelier\/devis\/(\d+)(?:\/(repondre|statut|supprimer))?$/);
  if (dm && req.method === 'GET' && !dm[2]) await db(env, 'quote/seen', { id: Number(dm[1]) });
  if (req.method === 'GET') url.badge = (await db(env, 'quotes/badge')).n;
  if (path === '/atelier/devis' && req.method === 'GET') return quotesPage(env, url, now);
  if (dm && req.method === 'GET' && !dm[2]) return quotePage(env, url, Number(dm[1]), now);
  if (dm && req.method === 'POST' && dm[2] === 'repondre') return quoteReplyPost(req, env, Number(dm[1]), now);
  if (dm && req.method === 'POST' && dm[2] === 'supprimer') {
    const f = await req.formData();
    if (!f.get('confirme')) return back(`/atelier/devis/${dm[1]}`, { err: 'Cochez la case pour confirmer la suppression.' });
    const r = await db(env, 'quote/delete', { id: Number(dm[1]) });
    return back('/atelier/devis', r.ok ? { ok: `Demande n°${dm[1]} supprimée.` } : { err: r.error });
  }
  if (dm && req.method === 'POST' && dm[2] === 'statut') {
    const f = await req.formData();
    const r = await db(env, 'quote/status', { now, id: Number(dm[1]), status: String(f.get('statut') || ''), amount: String(f.get('montant') ?? '') });
    return back(`/atelier/devis/${dm[1]}`, r.ok ? { ok: 'Suivi enregistré.' } : { err: r.error });
  }
  const fm = path.match(/^\/atelier\/fichier\/(\d+)$/);
  if (fm && req.method === 'GET') return fileGet(env, Number(fm[1]));
  if (path === '/atelier' && req.method === 'GET') return home(env, url, now);
  if (path === '/atelier/plus' && req.method === 'GET') return morePage(env, url, now);
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
  // the Google profile robot signs in to Google from the server's own address (the return address
  // registered at Google), not from atelier.solarcar37.fr
  if (path === '/atelier/fiche') return redirect(`${env.WORKER_URL || ''}/fiche-google?cle=${encodeURIComponent(env.STATS_KEY || '')}`);
  return page('Introuvable', '/atelier', '<h1>Page introuvable</h1><p><a href="/atelier">Retour à l’accueil</a></p>', url);
}

// ---------------------------------------------------------------- Devis (the quote discussions)
const STATUS_TAG = { nouveau: 'tag--new', envoye: 'tag--gold', reponse: 'tag--reply', valide: 'tag--ok', sans_suite: 'tag--off' };
/** the colour of each status (booking/atelier-look.js) */
const STATUS_C = { nouveau: 'var(--blue)', envoye: 'var(--gold)', reponse: 'var(--violet)', valide: 'var(--ok)', sans_suite: 'var(--dim)', relancer: 'var(--amber)' };
const statusTag = (s) => `<span class="tag ${STATUS_TAG[s] || 'tag--off'}">${esc(QUOTE_STATUS[s] || s)}</span>`;
const remindTag = '<span class="tag tag--warn">à relancer</span>';
/** « il y a 5 min » (kept up to date by the page's script) */
function ago(ms, now) {
  const s = Math.round((now - ms) / 1000);
  if (s < 50) return 'à l’instant';
  const m = Math.round(s / 60);
  if (m < 60) return `il y a ${m} min`;
  const h = Math.round(m / 60);
  if (h < 24) return `il y a ${h} h`;
  const j = Math.round(h / 24);
  if (j < 2) return 'hier';
  if (j < 7) return `il y a ${j} j`;
  return dayLabel(paris(ms).date, { day: 'numeric', month: 'short' });
}
const agoHtml = (ms, now) => `<time data-ago="${ms}">${esc(ago(ms, now))}</time>`;
const initials = (r) => (`${(r.first || '')[0] || ''}${(r.last || '')[0] || ''}`.toUpperCase() || '?');
/** « aujourd’hui 13 h 47 », « hier 18 h 02 », « 12 nov. » */
function when(ms, now) {
  if (!ms) return '';
  const d = paris(ms);
  const today = paris(now).date;
  const t = hour(d.time);
  if (d.date === today) return `aujourd’hui ${t}`;
  if (d.date === addDays(today, -1)) return `hier ${t}`;
  return `${dayLabel(d.date, { day: 'numeric', month: 'short', ...(d.date.slice(0, 4) === today.slice(0, 4) ? {} : { year: 'numeric' }) })} ${t}`;
}
const snippet = (s, n = 140) => {
  const t = String(s || '')
    .replace(/\s+/g, ' ')
    .trim();
  return t.length > n ? `${t.slice(0, n - 1)}…` : t;
};

async function quotesPage(env, url, now) {
  const want = url.searchParams.get('statut');
  // « à relancer »: the quotes sent, without news from the client for a while
  const relancer = want === 'relancer';
  const st = relancer ? 'envoye' : Object.hasOwn(QUOTE_STATUS, want) ? want : '';
  const [r, gm] = await Promise.all([db(env, 'quotes/list', { status: st, now }), gmailReady(env) ? gmailState(env) : { connected: false, unset: true }]);
  if (relancer) r.quotes = r.quotes.filter((q) => q.remind);
  // Gmail: connected (read at each visit, « Actualiser » to read now) or to connect
  const gmailBox = gm.connected
    ? `<section class="card gmail"><p><b>${ico('mail')} Gmail connecté</b>${gm.email ? ` · ${esc(gm.email)}` : ''} · lu ${esc(when(gm.lastSync || now, now))}${gm.error ? ` · <span class="err">${esc(gm.error)}</span>` : ''}</p><p class="hint">Vos réponses écrites depuis Gmail et les réponses des clients arrivent dans leur devis, et le statut suit.</p><div class="btns"><form method="post" action="/atelier/gmail/sync"><button class="small">Actualiser</button></form><form method="post" action="/atelier/gmail/deconnexion"><button class="ghost small">Déconnecter</button></form></div></section>`
    : `<section class="card gmail"><p><b>${ico('mail')} Connecter votre Gmail</b></p><p class="hint">Pour que vos réponses envoyées depuis Gmail (et celles des clients) arrivent ici, et que le statut passe tout seul à « Devis envoyé ». Seuls les e-mails échangés avec vos clients en attente de devis sont lus.</p>${gm.unset ? '<p class="hint">À activer : identifiants Google à ajouter au serveur (docs/ATELIER.md).</p>' : '<a class="btn small" href="/atelier/gmail/connexion">Connecter Gmail</a>'}</section>`;
  const total = Object.values(r.counts).reduce((a, b) => a + b, 0);
  const remindN = relancer ? r.quotes.length : (await db(env, 'live', { now, limit: 0 })).remind;
  const chip = (k, label, n) => `<a href="/atelier/devis${k ? `?statut=${k}` : ''}"${k === (relancer ? 'relancer' : st) ? ' aria-current="page"' : ''} style="--c:${STATUS_C[k] || 'var(--dim)'}">${k ? '<i></i>' : ''}${esc(label)} <b>${n}</b></a>`;
  const card = (q) => `<a class="q q--${q.remind ? 'remind' : esc(q.status)}${q.unread ? ' q--unread' : ''}" href="/atelier/devis/${q.id}"><span class="q__n">n°${q.id}</span>
<span><span class="q__who">${q.unread ? '<span class="dot" aria-label="Nouveau message"></span>' : ''}${esc(name(q))}</span><span class="q__what">${esc([q.vehicle, q.services].filter(Boolean).join(' · ') || 'Demande de devis')}</span></span>
<span class="q__side">${statusTag(q.status)}${q.remind ? remindTag : ''}<small>${esc(when(Math.max(q.at, q.last_at || 0), now))}${q.amount ? ` · ${eur(q.amount)}` : ''}</small></span>
${q.last_text ? `<span class="q__last">${q.last_dir === 'out' ? 'Vous : ' : ''}${esc(snippet(q.last_text))}</span>` : ''}</a>`;
  const d = r.delays || { remind: 7, close: 14 };
  const body = `<h1>Demandes de <em>devis</em></h1>
<p class="lead">Chaque demande du site ouvre une discussion. Répondez ici ou depuis Gmail : le statut suit tout seul. Devis envoyé à votre réponse, réponse reçue quand le client écrit, validé quand il accepte ou réserve en ligne${d.remind ? `, à relancer après ${d.remind} jours sans nouvelles` : ''}${d.close ? `, sans suite après ${d.close} jours (il revient si le client répond)` : ''}.</p>
<nav class="chips" aria-label="Filtrer par statut">${chip('', 'Toutes', total)}${Object.entries(QUOTE_STATUS)
    .map(([k, v]) => chip(k, v, r.counts[k] || 0))
    .join('')}${remindN || relancer ? chip('relancer', 'À relancer', remindN) : ''}</nav>
${gmailBox}
${r.quotes.length ? `<div class="qlist">${r.quotes.map(card).join('')}</div>` : `<section class="card"><p class="empty">${st ? 'Aucune demande ici pour le moment.' : 'Les demandes de devis envoyées depuis le site arriveront ici.'}</p></section>`}`;
  return page('Devis', '/atelier/devis', body, url, { refresh: true, now });
}

const VIA = { site: 'formulaire du site', mail: 'e-mail', gmail: 'depuis Gmail', atelier: 'depuis l’atelier' };
function filesHtml(files) {
  if (!files?.length) return '';
  return `<span class="files">${files
    .map((f) =>
      f.id && /^image\/(jpeg|png|webp|gif|avif)$/.test(f.type)
        ? `<a href="/atelier/fichier/${f.id}" target="_blank" rel="noopener"><img src="/atelier/fichier/${f.id}" alt="${esc(f.name)}" loading="lazy"></a>`
        : f.id
          ? `<a class="file" href="/atelier/fichier/${f.id}" target="_blank" rel="noopener">${ico('file')}${esc(f.name)}</a>`
          : `<span class="file" title="Trop lourd pour être gardé ici : il est dans l’e-mail">${ico('clip')}${esc(f.name)}</span>`
    )
    .join('')}</span>`;
}

async function quotePage(env, url, id, now) {
  const { quote: r, messages } = await db(env, 'quote/get', { id });
  if (!r) return page('Devis', '/atelier/devis', '<h1>Demande introuvable</h1><p><a href="/atelier/devis">Retour aux devis</a></p>', url);
  const who = name(r);
  const bubble = (m) => {
    if (m.dir === 'note') return `<p class="note">${esc(m.text)} · ${esc(when(m.at, now))}</p>`;
    const out = m.dir === 'out';
    const by = out ? 'Vous' : m.sender || who;
    return `<div class="b b--${out ? 'out' : 'in'}">${esc(m.text)}${filesHtml(m.files)}<span class="b__meta">${esc(by)} · ${esc(when(m.at, now))}${VIA[m.via] ? ` · ${esc(VIA[m.via])}` : ''}</span></div>`;
  };
  const relay = !!String(env.QUOTE_REPLY || '').trim();
  // waiting for the client for a while: a reminder ready to send
  const { delays: dl } = await db(env, 'quotes/delays', { now });
  const talk = messages.filter((m) => m.dir === 'in' || m.dir === 'out');
  const quiet = Math.max(r.status_at || 0, talk.length ? talk.at(-1).at : 0);
  const days = Math.floor((now - quiet) / DAY);
  const remind = r.status === 'envoye' && dl.remind && now - quiet > dl.remind * DAY;
  const draft = remind
    ? `Bonjour ${r.first || ''},\n\nJe reviens vers vous au sujet de votre demande de devis n°${r.id}${r.services ? ` (${String(r.services).toLowerCase()})` : ''}. Avez-vous pu y réfléchir ? Je reste à votre disposition pour toute question, ou pour fixer la date du rendez-vous.\n\n`
    : `Bonjour ${r.first || ''},\n\n`;
  const remindBox = remind ? `<p class="msg msg--warn">${ico('clock')} Sans nouvelles de ${esc(r.first || 'ce client')} depuis ${days} jours : un message de relance est prêt ci-dessous.${dl.close ? ` Sans réponse, la demande passera en « Sans suite » dans ${Math.max(1, dl.close - days)} jour${dl.close - days > 1 ? 's' : ''}.` : ''}</p>` : '';
  const composer = r.email
    ? `<form class="card composer" method="post" action="/atelier/devis/${r.id}/repondre" enctype="multipart/form-data">
<h2>${ico('send')} Répondre à ${esc(r.first || who)}</h2>
<label for="q-msg">Message</label><textarea id="q-msg" name="message" placeholder="Votre devis, une question…">${esc(draft)}</textarea>
<div class="row"><div><label for="q-amount">Montant du devis (€)</label><input id="q-amount" name="montant" inputmode="decimal" value="${r.amount ? esc(String(r.amount).replace('.', ',')) : ''}" placeholder="ex. 1 190"></div><div><label for="q-files">Pièces jointes (devis PDF, photos)</label><input id="q-files" name="fichiers" type="file" multiple></div></div>
<div class="checks"><label><input type="checkbox" name="accepter" value="1"${r.status === 'valide' ? '' : ' checked'}> Ajouter le bouton « J’accepte ce devis »</label></div>
<button>${ico('send')} Envoyer à ${esc(r.first || 'le client')}</button>
<p class="hint">Part de ${esc(B.email)}${relay ? ' ; sa réponse revient ici et dans votre Gmail' : ''}. Une copie arrive dans votre Gmail.</p></form>`
    : '<section class="card"><p class="empty">Ce client n’a pas d’adresse e-mail : appelez-le.</p></section>';
  const status = `<form class="card" method="post" action="/atelier/devis/${r.id}/statut"><h2>Suivi</h2>
<label for="q-status">Statut</label><select id="q-status" name="statut">${Object.entries(QUOTE_STATUS)
    .map(([k, v]) => `<option value="${k}"${k === r.status ? ' selected' : ''}>${esc(v)}</option>`)
    .join('')}</select>
<label for="q-amount2">Montant (€)</label><input id="q-amount2" name="montant" inputmode="decimal" value="${r.amount ? esc(String(r.amount).replace('.', ',')) : ''}">
<button class="small">Enregistrer</button></form>
<form class="card" method="post" action="/atelier/devis/${r.id}/supprimer"><details><summary class="danger-link">${ico('trash')} Supprimer cette demande</summary>
<p class="hint">La demande, ses messages et ses photos sont effacés ; la fiche du client reste.</p>
<div class="checks"><label><input type="checkbox" name="confirme" value="1" required> Je confirme</label></div><button class="danger small">Supprimer définitivement</button></details></form>`;
  const facts = [
    ['Demandée', when(r.at, now)],
    ['Véhicule', r.vehicle],
    ['Prestation(s)', r.services],
    ['Rendez-vous souhaité', r.wish || 'indifférent'],
    ['Nous a connus', r.source],
    ['Montant', r.amount ? eur(r.amount) : ''],
  ].filter(([, v]) => v);
  const body = `<a class="crumb" href="/atelier/devis">${ico('back')} Tous les devis</a>
<div class="qhead"><span class="avatar" aria-hidden="true">${esc(initials(r))}</span><div><h1>Devis <em>n°${r.id}</em></h1><span class="dim">${esc(who)} · ${esc([r.vehicle, r.services].filter(Boolean).join(' · '))}</span></div><span class="right">${statusTag(r.status)}</span></div>
${remindBox}<div class="dgrid"><div><section class="thread" aria-label="Discussion">${messages.map(bubble).join('')}</section>${composer}</div>
<aside><section class="card"><h2>${ico('user')} ${esc(who)}</h2><div class="btns" style="margin:0 0 14px">${r.phone ? `<a class="btn small" href="tel:${esc(tel(r.phone))}">${ico('phone')} ${esc(r.phone)}</a>` : ''}${r.email ? `<a class="btn ghost small" href="mailto:${esc(r.email)}">${ico('mail')} E-mail</a>` : ''}</div>
<dl class="facts">${facts.map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join('')}</dl>
<p style="margin:14px 0 0"><a href="/atelier/clients/${r.client_id}">Fiche client</a></p></section>${status}</aside></div>`;
  return page(`Devis n°${r.id}`, '/atelier/devis', body, url, { now });
}

/** the workshop's answer, written here: passed as it is (multipart, files) to the database, which sends it */
async function quoteReplyPost(req, env, id, now) {
  const res = await atelierFetch(env, 'quote/reply', { method: 'POST', headers: { 'content-type': req.headers.get('content-type') || '', 'x-request': String(id), 'x-now': String(now) }, body: await req.arrayBuffer() });
  const out = res.ok ? await res.json() : { ok: false, error: 'Erreur du serveur : réessayez.' };
  return back(`/atelier/devis/${id}`, out.ok ? { ok: 'Message envoyé au client.' } : { err: out.error });
}

/** a photo or a document of a discussion; never run as a page (sandbox, no sniffing) */
async function fileGet(env, id) {
  const res = await atelierFetch(env, `file/raw?id=${id}`, { method: 'GET' });
  if (!res.ok) return new Response('Fichier introuvable', { status: 404, headers: { 'content-type': 'text/plain; charset=utf-8' } });
  const type = res.headers.get('content-type') || 'application/octet-stream';
  const name = decodeURIComponent(res.headers.get('x-name') || 'fichier');
  const inline = /^image\/(jpeg|png|webp|gif|avif)$|^application\/pdf$/.test(type);
  const image = type.startsWith('image/') && inline;
  // anything else than a photo or a PDF is only downloaded, never shown
  return new Response(res.body, { headers: { 'content-type': inline ? type : 'application/octet-stream', 'content-disposition': `${inline ? 'inline' : 'attachment'}; filename*=UTF-8''${encodeURIComponent(name)}`, 'cache-control': 'private, max-age=3600', 'x-content-type-options': 'nosniff', 'x-robots-tag': 'noindex', ...(image ? { 'content-security-policy': "default-src 'none'; img-src 'self'; style-src 'unsafe-inline'; sandbox" } : {}) } });
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

// ---------------------------------------------------------------- the agenda (Google Calendar of SOLAR CAR 37)
/**
 * Every event of the workshop's calendar between two days (Paris), the online bookings joined:
 * { start, end, date, time, endTime, allDay, title, who, hold, online, b }, in time order; null
 * when the calendar cannot be read.
 */
async function agenda(env, from, to) {
  const events = await listEvents(env, env.CALENDAR_WRITE, dayStart(from), dayStart(addDays(to, 1))).catch(() => null);
  if (!events) return null;
  const sessions = events.map((e) => e.extendedProperties?.private?.session).filter(Boolean);
  const known = sessions.length ? Object.fromEntries((await db(env, 'bookings/list', { from: addDays(from, -62), to: addDays(to, 62), limit: 500 })).bookings.map((b) => [b.session, b])) : {};
  return events
    .filter((e) => e.status !== 'cancelled' && (e.start?.dateTime || e.start?.date))
    .map((e) => {
      const p = e.extendedProperties?.private || {};
      const allDay = !e.start.dateTime;
      const start = allDay ? dayStart(e.start.date) : Date.parse(e.start.dateTime);
      const end = allDay ? dayStart(e.end?.date || addDays(e.start.date, 1)) : Date.parse(e.end?.dateTime || e.start.dateTime);
      const b = p.session ? known[p.session] || null : null;
      const hold = p.solarcarHold === '1';
      const online = p.solarcarHold === '0';
      // « RDV Vitres teintées 3/4 arrière — Léa Petit », « ⏳ Paiement en cours — … — Léa Petit »
      const parts = String(e.summary || 'Occupé')
        .replace(/^⚠ À vérifier — /, '')
        .replace(/^⏳\s*Paiement en cours\s*—\s*/, '')
        .replace(/^RDV\s+/, '')
        .split(' — ');
      const named = (online || hold || b) && parts.length > 1 ? parts.pop() : '';
      const who = b ? name(b) : named;
      const at = paris(start);
      return { start, end, date: at.date, time: at.time, endTime: paris(end).time, allDay, title: parts.join(' — '), who, hold, online, b, id: e.id };
    });
}

// ---------------------------------------------------------------- Accueil
const FEED = {
  demande: ['inbox', (e) => `Nouvelle demande · n°${e.request}`, (e) => [name(e), e.text].filter(Boolean).join(' — ')],
  in: ['chat', (e) => `${e.first || 'Le client'} a écrit · n°${e.request}`, (e) => e.text],
  out: ['send', (e) => `Vous avez répondu à ${e.first || 'un client'}`, (e) => e.text],
  note: ['bolt', (e) => `Devis n°${e.request} · ${name(e)}`, (e) => e.text],
  rdv: ['card', (e) => `RDV réservé et payé · ${name(e)}`, (e) => {
    const items = (() => {
      try {
        return JSON.parse(e.text || '[]').map((i) => i.label).join(' + ');
      } catch {
        return '';
      }
    })();
    const [date, time] = String(e.vehicle || '').split(' ');
    return [items, /^\d{4}-\d{2}-\d{2}$/.test(date) ? `le ${dayLabel(date, { weekday: 'short', day: 'numeric', month: 'short' })} à ${hour(time)}` : ''].filter(Boolean).join(' · ');
  }],
};

async function home(env, url, now) {
  const today = paris(now).date;
  const from = `${today.slice(0, 8)}01`;
  const [sum, events, band, visits, list, act] = await Promise.all([
    db(env, 'summary', { from, to: today, now }),
    agenda(env, today, addDays(today, 6)),
    db(env, 'banner/get'),
    env.STATS
      ? report(env, { site: 'site', from, to: today, pfrom: from, pto: today })
          .then((r) => totalsOf(r.totals))
          .catch(() => null)
      : null,
    db(env, 'quotes/list', { now }),
    db(env, 'activity', { limit: 9, now }),
  ]);
  const month = new Intl.DateTimeFormat('fr-FR', { month: 'long', timeZone: 'UTC' }).format(new Date(`${from}T12:00:00Z`));
  const qf = sum.quotes;
  const remind = list.quotes.filter((q) => q.remind);
  const dl = list.delays || { remind: 7, close: 14 };
  const timed = (events || []).filter((x) => !x.allDay && !x.hold);
  const todayN = timed.filter((x) => x.date === today).length;

  // the greeting, and what waits, in a few words
  const pills = [
    qf.open && ['var(--blue)', `${qf.open} devis à répondre`, '/atelier/devis?statut=nouveau'],
    qf.reply && ['var(--violet)', `${qf.reply} réponse${qf.reply > 1 ? 's' : ''} reçue${qf.reply > 1 ? 's' : ''}`, '/atelier/devis?statut=reponse'],
    remind.length && ['var(--amber)', `${remind.length} à relancer`, '/atelier/devis?statut=relancer'],
    todayN && ['var(--ok)', `${todayN} RDV aujourd’hui`, '/atelier/rdv'],
  ].filter(Boolean);
  const hello = `<div class="hello"><h1>Bonjour <em>${esc((B.owner || '').split(' ')[0] || '')}</em></h1>
<p class="hello__date">${esc(cap(dayLabel(today, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })))} · ${sum.totalClients} client${sum.totalClients > 1 ? 's' : ''} dans le fichier</p>
<p class="hello__sum">${pills.length ? pills.map(([c, t, href]) => `<a class="pill" href="${href}" style="--c:${c}"><i></i>${esc(t)}</a>`).join('') : '<span class="pill pill--calm"><i></i>Tout est à jour</span>'}</p></div>`;

  // the appointment of the moment, else the next one
  const cur = timed.find((x) => x.start <= now && now < x.end);
  const next = timed.find((x) => x.start > now);
  const what = (x) => `${esc(x.title)}${x.who ? `<small>${x.b ? `<a href="/atelier/clients/${x.b.client_id}">${esc(x.who)}</a>` : esc(x.who)}${x.b?.vehicle ? ` · ${esc(x.b.vehicle)}` : ''}</small>` : ''}`;
  const nowCard = cur
    ? `<section class="card now"><span class="now__k"><i></i>En ce moment</span><p class="now__t">${what(cur)}</p><div><div class="now__when"><span>${esc(hour(cur.time))} – ${esc(hour(cur.endTime))}</span><span>fin <time data-until="${cur.end}">${esc(hour(cur.endTime))}</time></span></div><div class="bar" style="margin-top:10px"><i data-span="${cur.start}-${cur.end}" style="width:${Math.round(((now - cur.start) / (cur.end - cur.start)) * 100)}%"></i></div>${cur.b && cur.b.total - cur.b.paid > 0 ? `<p class="dim" style="margin:10px 0 0">Reste à encaisser : <b style="color:var(--gold-2)">${eur(cur.b.total - cur.b.paid)}</b></p>` : ''}</div></section>`
    : next
      ? `<section class="card now"><span class="now__k"><i></i>Prochain rendez-vous</span><p class="now__t">${what(next)}</p><div class="now__when"><span>${esc(dayLabel(next.date, { weekday: 'long', day: 'numeric', month: 'long' }))} · ${esc(hour(next.time))}</span><b data-until="${next.start}">${esc(next.date === today ? 'aujourd’hui' : 'bientôt')}</b></div></section>`
      : `<section class="card now"><span class="now__k"><i></i>Agenda</span><p class="now__t">${events === null ? 'Agenda indisponible pour le moment.' : 'Aucun rendez-vous dans les 7 prochains jours.'}<small>Les RDV de l’agenda SOLAR CAR 37 s’affichent ici.</small></p><a class="btn ghost small" href="/atelier/rdv" style="align-self:flex-start">${ico('cal')} Rendez-vous</a></section>`;

  // the quotes, step by step
  const st = (cls, icon, label, n, href, small, hot) => `<a class="st st--${cls}${hot && n ? ' st--hot' : ''}" href="${href}"><span class="st__k">${ico(icon)}${esc(label)}</span><b data-n="${n}">${n}</b><small>${small}</small></a>`;
  const pipe = `<div class="pipe">${[
    st('new', 'inbox', 'À répondre', qf.open, '/atelier/devis?statut=nouveau', 'nouvelles demandes', true),
    st('reply', 'chat', 'Réponse reçue', qf.reply, '/atelier/devis?statut=reponse', 'le client a écrit', true),
    st('sent', 'send', 'En attente', qf.sent, '/atelier/devis?statut=envoye', 'devis envoyés, au client de jouer', false),
    st('remind', 'clock', 'À relancer', remind.length, '/atelier/devis?statut=relancer', dl.remind ? `sans nouvelles depuis ${dl.remind} jours` : 'relance désactivée', true),
    st('won', 'check', 'Validés', qf.won.n, '/atelier/devis?statut=valide', `en ${esc(month)}${qf.won.amount ? ` · ${eur(qf.won.amount)}` : ''}`, false),
  ].join('')}</div>`;

  // what to do now: the client wrote, new requests, then the reminders
  const rank = (q) => (q.status === 'reponse' || q.unread ? 0 : q.status === 'nouveau' ? 1 : 2);
  const todo = list.quotes.filter((q) => q.unread || q.status === 'nouveau' || q.status === 'reponse' || q.remind).sort((a, b) => rank(a) - rank(b) || Math.max(b.at, b.last_at || 0) - Math.max(a.at, a.last_at || 0));
  const todoHtml = `<section class="card"><h2>${ico('bolt')} À traiter <a class="right" href="/atelier/devis">Tous les devis</a></h2>${
    todo.length
      ? `<ul class="todo">${todo
          .slice(0, 7)
          .map(
            (q) => `<li><a href="/atelier/devis/${q.id}"><span class="avatar avatar--s" aria-hidden="true">${esc(initials(q))}</span><span><b>${q.unread ? '<span class="dot"></span>' : ''}${esc(name(q))} <span class="dim">n°${q.id}</span></b><span class="dim">${esc(q.last_text && q.last_dir === 'in' && q.status !== 'nouveau' ? `« ${snippet(q.last_text, 90)} »` : [q.vehicle, q.services].filter(Boolean).join(' · ') || 'Demande de devis')}</span></span><span class="todo__side">${q.remind ? remindTag : statusTag(q.status)}${agoHtml(Math.max(q.at, q.last_at || 0), now)}</span></a></li>`
          )
          .join('')}</ul>${todo.length > 7 ? `<p class="dim" style="margin:12px 0 0">Et ${todo.length - 7} autre${todo.length - 7 > 1 ? 's' : ''} dans les devis.</p>` : ''}`
      : `<p class="empty">Rien à traiter. Les nouvelles demandes et les réponses des clients arriveront ici d’elles-mêmes.</p>`
  }</section>`;

  // what just happened
  const feed = act.events
    .map((e) => {
      const kind = e.kind === 'note' && /accept|réservé et payé/i.test(e.text || '') ? 'won' : e.kind;
      const [icon, title, text] = FEED[e.kind] || FEED.note;
      const href = e.request ? `/atelier/devis/${e.request}` : e.client ? `/atelier/clients/${e.client}` : '/atelier/rdv';
      return `<li class="feed--${kind}"><span class="feed__i">${ico(kind === 'won' ? 'check' : icon)}</span><a href="${href}"><b>${esc(title(e))}</b> · ${agoHtml(e.at, now)}<p>${esc(snippet(text(e), 120))}</p></a></li>`;
    })
    .join('');
  const feedHtml = `<section class="card"><h2>${ico('bolt')} En direct <span class="live" data-live-label style="margin-left:auto"><i></i><span>En direct</span></span></h2>${feed ? `<ul class="feed">${feed}</ul>` : '<p class="empty">Les demandes, les messages et les paiements s’afficheront ici au fil de l’eau.</p>'}</section>`;

  // the next seven days
  const week = Array.from({ length: 7 }, (_, i) => addDays(today, i))
    .map((date) => {
      const evs = (events || []).filter((x) => x.date === date || (x.allDay && x.start <= dayStart(date) && x.end > dayStart(date)));
      const wd = new Date(`${date}T12:00:00Z`).getUTCDay();
      const off = !R.days.includes(wd) && !evs.length;
      return `<div class="day${date === today ? ' day--today' : ''}${off ? ' day--off' : ''}"><span class="day__h">${esc(dayLabel(date, { weekday: 'short' }).replace('.', ''))} <b>${Number(date.slice(8))}</b></span>${
        evs.length
          ? evs
              .map(
                (x) => `<${x.b ? `a href="/atelier/clients/${x.b.client_id}"` : 'span'} class="ev${x.hold ? ' ev--hold' : x.online ? ' ev--online' : ''}"><b>${x.allDay ? 'Journée' : `${esc(hour(x.time))}${x.hold ? ' · paiement en cours' : ''}`}</b><span>${esc(x.who || x.title)}</span>${x.who ? `<span class="dim">${esc(x.title)}</span>` : ''}</${x.b ? 'a' : 'span'}>`
              )
              .join('')
          : `<span class="day__none">${off ? 'fermé' : 'libre'}</span>`
      }</div>`;
    })
    .join('');
  const weekHtml = `<section class="card"><h2>${ico('cal')} Les 7 prochains jours <a class="right" href="/atelier/rdv">Rendez-vous</a></h2>${events === null ? '<p class="empty">Agenda indisponible pour le moment.</p>' : `<div class="week">${week}</div>`}</section>`;

  // the month in figures
  const fig = (n, label, eurs) => `<div class="fig"><b data-n="${n}"${eurs ? ' data-eur' : ''}>${esc(eurs ? eur(n) : n)}</b><span>${esc(label)}</span></div>`;
  const monthHtml = `<h3>${esc(cap(month))} en chiffres</h3><div class="month">${[
    fig(sum.bookings.paid, 'encaissés en ligne', true),
    fig(sum.bookings.due, 'reste à encaisser à l’atelier', true),
    fig(sum.bookings.n, 'RDV réservés en ligne'),
    fig(sum.requests, 'demandes de devis'),
    fig(sum.clients, 'nouveaux clients'),
    ...(visits ? [fig(visits.visits, 'visites du site')] : []),
  ].join('')}</div>`;

  const b = band.banner;
  const bandNow = !b ? 'Aucun bandeau prévu.' : now < b.starts ? `Prochain bandeau : du ${dateOf(b.starts)} au ${dateOf(b.expires)}.` : `Affiché jusqu’au ${dateOf(b.expires)}.`;
  const body = `<div class="hero">${hello}${nowCard}</div>
${pipe}
<div class="two">${todoHtml}${feedHtml}</div>
${weekHtml}
${monthHtml}
<div class="grid"><section class="card"><h2>${ico('tag')} Bandeau du site</h2>${b ? `<div class="band"><span class="theme theme--${esc(b.theme)}">${esc(THEMES[b.theme] || '')}</span> <b>${esc(b.title)}</b><br>${esc(b.text)}</div>` : ''}<p class="dim">${esc(bandNow)}${sum.promoUses.length ? ` Ce mois-ci : ${sum.promoUses.map((p) => `${esc(p.code)} utilisé ${p.n} fois`).join(', ')}.` : ''}</p><a class="btn ghost small" href="/atelier/codes">Bandeaux et codes</a></section>
<section class="card"><h2>${ico('grid')} Raccourcis</h2><div class="btns"><a class="btn small" href="/atelier/clients/nouveau">${ico('plus')} Ajouter un client</a><a class="btn ghost small" href="/atelier/codes#parrainage">Code de parrainage</a><a class="btn ghost small" href="/atelier/clients.csv">Exporter les clients</a><a class="btn ghost small" href="/atelier/stats">Statistiques</a></div></section></div>`;
  return page('Accueil', '/atelier', body, url, { refresh: true, now });
}

// ---------------------------------------------------------------- Plus (the other places, the settings)
async function morePage(env, url, now) {
  const { delays: d } = await db(env, 'quotes/delays', { now });
  const tile = (href, icon, title, text) => `<a class="tile" href="${href}">${ico(icon)}<span><b>${esc(title)}</b><span>${esc(text)}</span></span></a>`;
  const body = `<h1>Plus <em>d’outils</em></h1><p class="lead">Les autres espaces de l’atelier, et les réglages.</p>
<div class="tiles">${[
    tile('/atelier/codes', 'tag', 'Codes et promos', 'Bandeaux du site, codes promo, parrainage'),
    tile('/atelier/stats', 'chart', 'Statistiques', 'Visites, demandes, réservations'),
    tile('/atelier/fiche', 'pin', 'Fiche Google', 'La photo de la semaine, publiée le mardi'),
    tile('/atelier/clients.csv', 'download', 'Exporter les clients', 'Un fichier pour Excel'),
    tile('/atelier/deconnexion', 'out', 'Se déconnecter', 'Sur cet appareil'),
  ].join('')}</div>
<form class="card" method="post" action="/atelier/reglages" id="reglages"><h2>${ico('gear')} Suivi des devis</h2>
<p class="dim" style="margin:-6px 0 16px">Comptés depuis votre dernier message, quand le client n’a pas répondu. Un devis passé en « Sans suite » revient tout seul en « Réponse reçue » si le client écrit.</p>
<div class="row"><div><label for="r-relance">« À relancer » après (jours)</label><input id="r-relance" name="relance" type="number" min="0" max="120" step="1" value="${d.remind}"></div><div><label for="r-close">« Sans suite » après (jours, 0 = jamais)</label><input id="r-close" name="sans_suite" type="number" min="0" max="120" step="1" value="${d.close}"></div></div>
<button>Enregistrer</button></form>`;
  return page('Plus', '/atelier/plus', body, url, { now });
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
  const requests = c.requests.length ? `<ul class="list">${c.requests.map((r) => `<li><a href="/atelier/devis/${r.id}"><b>n°${r.id} · ${esc(dateOf(r.at))}</b> · ${esc(r.services || 'devis')}${r.vehicle ? ` · ${esc(r.vehicle)}` : ''}${r.message ? `<br><span class="dim">${esc(snippet(r.message, 160))}</span>` : ''}</a>${statusTag(r.status || 'nouveau')}</li>`).join('')}</ul>` : '<p class="empty">Aucune demande de devis.</p>';
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
  const [list, bands] = await Promise.all([db(env, 'codes/list'), db(env, 'banners/list')]);
  const be = url.searchParams.get('bandeau') ? bands.banners.find((x) => x.id === url.searchParams.get('bandeau')) : null;
  const b = be || {};
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
<section class="card" id="bandeau"><h2>Bandeaux du site</h2><p class="dim">Une banderole animée en haut de toutes les pages du site, affichée toute seule entre ses deux dates (si deux se chevauchent, la plus récente passe devant) ; « en pause » la cache tout de suite. Le bouton mène à la réservation, avec le code déjà rempli.</p>
${bands.banners.length ? `<table><thead><tr><th>Bandeau</th><th class="hide-s">Période</th><th class="n">État</th></tr></thead><tbody>${bands.banners
  .map(
    (x) => `<tr><td><span class="theme theme--${esc(x.theme)}">${esc(THEMES[x.theme] || x.theme)}</span> <b>${esc(x.title || x.text.slice(0, 40))}</b><small>${esc(x.text)}${x.code ? ` · code <span class="code">${esc(x.code)}</span>` : ''}</small></td><td class="hide-s">${esc(dateOf(x.starts))} → ${esc(dateOf(x.expires))}</td><td class="n">${bandState(x, now)}</td></tr><tr class="acts"><td colspan="3"><form method="post" action="/atelier/codes" class="btns"><input type="hidden" name="id" value="${esc(x.id)}"><input type="hidden" name="active" value="${x.active ? '' : '1'}"><button class="ghost small" name="action" value="banner-active">${x.active ? 'Mettre en pause' : 'Activer'}</button><a class="btn ghost small" href="/atelier/codes?bandeau=${encodeURIComponent(x.id)}#bandeau-form">Modifier</a><a class="btn ghost small" href="${esc(siteUrl(env))}/?apercu-bandeau=${encodeURIComponent(x.id)}" target="_blank" rel="noopener">Voir sur le site</a><button class="danger small" name="action" value="banner-delete">Supprimer</button></form></td></tr>`
  )
  .join('')}</tbody></table>` : '<p class="empty">Aucun bandeau.</p>'}
<h3 id="bandeau-form">${be ? 'Modifier le bandeau' : 'Créer un bandeau'}</h3>
<form method="post" action="/atelier/codes">${be ? `<input type="hidden" name="id" value="${esc(be.id)}">` : ''}
<div class="row"><div><label for="b-theme">Style</label><select id="b-theme" name="theme">${Object.entries(THEMES).map(([k, v]) => `<option value="${k}"${(b.theme || 'classique') === k ? ' selected' : ''}>${esc(v)}</option>`).join('')}</select></div><div><label for="b-title">Titre court</label><input id="b-title" name="title" maxlength="60" value="${esc(b.title || '')}" placeholder="Offre de Noël · −15 %"></div></div>
<label for="b-text">Texte</label><textarea id="b-text" name="text" maxlength="260" required>${esc(b.text || '')}</textarea>
<div class="row3"><div><label for="b-cta">Bouton</label><input id="b-cta" name="cta" maxlength="30" value="${esc(b.cta || 'Réserver')}"></div><div><label for="b-from">Du</label><input id="b-from" name="starts" type="date" value="${esc(day(b.starts))}" required></div><div><label for="b-to">Au (inclus)</label><input id="b-to" name="ends" type="date" value="${esc(day(b.expires))}" required></div></div>
<div class="row"><div><label for="b-code">Code rempli à la réservation</label><input id="b-code" name="code" value="${esc(b.code || '')}" placeholder="NOEL" style="text-transform:uppercase"></div><div class="checks" style="align-items:end;padding-bottom:12px"><label><input type="checkbox" name="active" value="1"${!be || be.active ? ' checked' : ''}> Bandeau actif</label></div></div>
<div class="btns"><button name="action" value="banner-save">${be ? 'Enregistrer' : 'Créer le bandeau'}</button>${be ? '<a class="btn ghost" href="/atelier/codes#bandeau">Annuler</a>' : ''}</div></form></section>

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
    const r = await db(env, 'banner/save', { now, id: g('id'), theme: g('theme'), title: g('title'), text: g('text'), cta: g('cta'), code: g('code'), starts: g('starts'), ends: g('ends'), active: !!f.get('active') });
    return back('/atelier/codes', r.ok ? { ok: 'Bandeau enregistré.' } : { err: r.error });
  }
  if (action === 'banner-active') {
    await db(env, 'banner/active', { id: g('id'), active: !!f.get('active') });
    return back('/atelier/codes', { ok: f.get('active') ? 'Bandeau activé.' : 'Bandeau mis en pause.' });
  }
  if (action === 'banner-delete') {
    await db(env, 'banner/delete', { id: g('id') });
    return back('/atelier/codes', { ok: 'Bandeau supprimé.' });
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

