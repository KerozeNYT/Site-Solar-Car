// The booking server on this machine, with an in-memory Google Calendar and a pretend Stripe
// payment page: try the whole booking (or test it in a browser) without any account.
//
//   node booking/dev-server.mjs                      → http://localhost:8787
//   BOOKING_API=http://localhost:8787 npm run build  → the site calls it (serve dist on :4190)
//
// A few busy hours are put in the calendars so that the slots look real. Visit statistics are kept
// in memory: http://localhost:8787/stats?cle=dev ; the workshop's space: http://localhost:8787/atelier
import fs from 'node:fs';
import http from 'node:http';
import { generateKeyPairSync, createHmac } from 'node:crypto';
import worker from './worker.js';
import { installFakes } from './test/fakes.mjs';
import { fakeStats } from './test/fake-stats.mjs';
import { fakeDO } from './test/fake-do.mjs';
import { Atelier, referralFor, db } from './store.js';
import { zonedToUtc, addDays, utcToZoned } from './schedule.js';

const PORT = Number(process.env.PORT || 8787);
const SELF = `http://localhost:${PORT}`;
const CAR = 'contact.solarcar37@gmail.com';
const HOME = 'contact.solarhome37@gmail.com';
const PERSO = 'perso@group.calendar.google.com';
const WHSEC = 'whsec_dev';
const { privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
const env = {
  ALLOWED_ORIGINS: process.env.ALLOWED_ORIGINS || 'http://localhost:4190,http://localhost:4173,http://127.0.0.1:4190',
  CALENDAR_WRITE: CAR,
  CALENDARS_BUSY: `${CAR},${HOME},${PERSO}`,
  GOOGLE_SERVICE_ACCOUNT: JSON.stringify({ client_email: 'dev@local', private_key: privateKey.export({ type: 'pkcs8', format: 'pem' }) }),
  STRIPE_SECRET_KEY: 'sk_test_dev',
  STRIPE_WEBHOOK_SECRET: WHSEC,
  STATS: fakeStats(),
  STATS_KEY: 'dev',
  ATELIER: fakeDO(Atelier, () => env),
  ATELIER_SECRET: 'dev',
  // e-mails are caught (test/fakes.mjs) and their subject printed here: the sign-in code too
  RESEND_API_KEY: 're_dev',
  // the client's e-mails too (acknowledgment of a quote request, confirmation of a booking)
  MAIL_CLIENTS: '1',
  // the quote discussions' address (here: the e-mails « received » are posted to /dev/mail-in)
  QUOTE_REPLY: 'devis@reponse.solarcar37.fr',
  NOTIFY_TO: 'atelier@local',
  SITE_URL: 'http://localhost:4190',
};
const { cal, sessions, mails } = installFakes({ CAR, HOME, PERSO }, { checkoutUrl: (id) => `${SELF}/fake-checkout/${id}` });

// some busy hours over the next weeks
const TZ = 'Europe/Paris';
const at = (date, t) => new Date(zonedToUtc(date, t, TZ)).toISOString();
let d = utcToZoned(Date.now(), TZ).date;
for (let i = 0; i < 40; i++, d = addDays(d, 1)) {
  if (i % 3 === 0) cal[CAR].push({ id: `b${i}`, status: 'confirmed', summary: 'RDV client', start: { dateTime: at(d, '09:00') }, end: { dateTime: at(d, '11:30') } });
  if (i % 4 === 1) cal[HOME].push({ id: `h${i}`, status: 'confirmed', start: { dateTime: at(d, '13:00') }, end: { dateTime: at(d, '15:00') } });
  if (i % 7 === 2) cal[PERSO].push({ id: `p${i}`, status: 'confirmed', start: { dateTime: at(d, '00:00') }, end: { dateTime: at(addDays(d, 1), '00:00') } });
}

const page = (s) => `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Paiement (simulation)</title>
<style>body{font:16px system-ui;background:#f6f8fa;display:grid;place-items:center;min-height:100vh;margin:0}main{background:#fff;padding:28px;border-radius:12px;box-shadow:0 4px 24px #0002;max-width:420px}button{font:inherit;padding:12px 18px;border-radius:8px;border:0;margin-right:8px;cursor:pointer}.pay{background:#635bff;color:#fff}</style>
<main><p><b>Simulation du paiement Stripe</b> (aucun argent n’est débité)</p><p>${s.name}</p><p style="font-size:28px;margin:8px 0"><b>${(s.amount_total / 100).toFixed(2).replace('.', ',')} €</b></p>
<form method="post" action="/fake-checkout/${s.id}/pay" style="display:inline"><button class="pay" data-pay>Payer</button></form><form method="post" action="/fake-checkout/${s.id}/cancel" style="display:inline"><button>Retour</button></form></main>`;

async function webhook(type, s) {
  const payload = JSON.stringify({ type, data: { object: s } });
  const t = Math.floor(Date.now() / 1000);
  const sig = createHmac('sha256', WHSEC).update(`${t}.${payload}`).digest('hex');
  await worker.fetch(new Request(`${SELF}/api/stripe-webhook`, { method: 'POST', body: payload, headers: { 'stripe-signature': `t=${t},v1=${sig}` } }), env);
}

http
  .createServer(async (req, res) => {
    const url = new URL(req.url, SELF);
    const m = /^\/fake-checkout\/([^/]+)(?:\/(pay|cancel))?$/.exec(url.pathname);
    if (m) {
      const s = sessions.get(m[1]);
      if (!s) return res.writeHead(404).end('session inconnue');
      if (!m[2]) return res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }).end(page(s));
      if (m[2] === 'pay') {
        Object.assign(s, { status: 'complete', payment_status: 'paid' });
        await webhook('checkout.session.completed', s);
        return res.writeHead(303, { location: s.success_url.replace('{CHECKOUT_SESSION_ID}', s.id) }).end();
      }
      Object.assign(s, { status: 'expired' });
      await webhook('checkout.session.expired', s);
      return res.writeHead(303, { location: s.cancel_url || '/' }).end();
    }
    // the binary files the worker bundles (fonts, logo, icons): read from the disk here (Node cannot import them)
    const files = { '/stats/f/geist.woff2': ['node_modules/@fontsource-variable/geist/files/geist-latin-wght-normal.woff2', 'font/woff2'], '/stats/f/geist-mono.woff2': ['node_modules/@fontsource-variable/geist-mono/files/geist-mono-latin-wght-normal.woff2', 'font/woff2'], '/stats/f/serif.woff2': ['node_modules/@fontsource/instrument-serif/files/instrument-serif-latin-400-italic.woff2', 'font/woff2'], '/atelier/logo.webp': ['booking/assets/logo-clair-400.webp', 'image/webp'], '/atelier/logo.png': ['booking/assets/logo-clair-280.png', 'image/png'], '/atelier/icone-512.png': ['booking/assets/icone-512.png', 'image/png'], '/atelier/icone-180.png': ['booking/assets/icone-180.png', 'image/png'] };
    if (files[url.pathname]) return res.writeHead(200, { 'content-type': files[url.pathname][1] }).end(fs.readFileSync(new URL(`../${files[url.pathname][0]}`, import.meta.url)));
    // an e-mail « received » by the quote discussions' address: POST the raw message here
    if (url.pathname === '/dev/mail-in' && req.method === 'POST') {
      const raw = await new Promise((r) => {
        const parts = [];
        req.on('data', (c) => parts.push(c));
        req.on('end', () => r(Buffer.concat(parts)));
      });
      const rejected = [];
      await worker.email({ from: url.searchParams.get('from') || 'dev@local', to: env.QUOTE_REPLY, rawSize: raw.length, raw: new Response(raw).body, headers: new Headers(), setReject: (x) => rejected.push(x) }, env);
      return res.writeHead(200, { 'content-type': 'application/json' }).end(JSON.stringify({ rejected }));
    }
    if (url.pathname === '/dev/calendar') return res.writeHead(200, { 'content-type': 'application/json' }).end(JSON.stringify(cal[CAR].filter((e) => e.extendedProperties), null, 1));
    // the e-mails caught: the list (attachments as name and size), and each one as it would show
    if (url.pathname === '/dev/mails') return res.writeHead(200, { 'content-type': 'application/json' }).end(JSON.stringify(mails.map(({ html, text, attachments, ...m }, i) => ({ n: i, ...m, attachments: (attachments || []).map((a) => ({ filename: a.filename, bytes: Math.floor((String(a.content).length * 3) / 4) })), page: `/dev/mail/${i}` })), null, 1));
    const shown = /^\/dev\/mail\/(\d+)$/.exec(url.pathname);
    if (shown && mails[shown[1]]) return res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }).end(mails[shown[1]].html);
    const body = ['GET', 'HEAD', 'OPTIONS'].includes(req.method) ? undefined : await new Promise((r) => {
      const parts = [];
      req.on('data', (c) => parts.push(c));
      req.on('end', () => r(Buffer.concat(parts)));
    });
    const r = await worker.fetch(new Request(url, { method: req.method, headers: req.headers, body }), env);
    res.writeHead(r.status, Object.fromEntries(r.headers));
    res.end(Buffer.from(await r.arrayBuffer()));
  })
  .listen(PORT, async () => {
    console.log(`booking dev server on ${SELF}`);
    // a referral code to try on the booking page (…/reservation/?code=…)
    const demo = await referralFor(env, { owner: 'Demo', origin: 'dev' });
    console.log(`referral code to try: ${demo.code}`);
    // the planned bands (content/promos.js) are there; to see one on the site whatever its dates:
    // …/?apercu-bandeau=noel-2026 (or gta6-2026)
    const today = utcToZoned(Date.now(), TZ).date;
    await db(env, 'promo/save', { code: 'NOELTEST', label: 'Essai', percent: 15, services: ['tint', 'lights'], starts: today, ends: addDays(today, 30) });
    console.log('workshop space: http://localhost:' + PORT + '/atelier (the sign-in code is printed below)');
    let seen = 0;
    setInterval(() => {
      for (; seen < mails.length; seen++) console.log(`[mail] ${mails[seen].subject}`);
    }, 300);
  });
