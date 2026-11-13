// The booking server on this machine, with an in-memory Google Calendar and a pretend Stripe
// payment page: try the whole booking (or test it in a browser) without any account.
//
//   node booking/dev-server.mjs                      → http://localhost:8787
//   BOOKING_API=http://localhost:8787 npm run build  → the site calls it (serve dist on :4190)
//
// A few busy hours are put in the calendars so that the slots look real.
import http from 'node:http';
import { generateKeyPairSync, createHmac } from 'node:crypto';
import worker from './worker.js';
import { installFakes } from './test/fakes.mjs';
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
};
const { cal, sessions } = installFakes({ CAR, HOME, PERSO }, { checkoutUrl: (id) => `${SELF}/fake-checkout/${id}` });

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
    if (url.pathname === '/dev/calendar') return res.writeHead(200, { 'content-type': 'application/json' }).end(JSON.stringify(cal[CAR].filter((e) => e.extendedProperties), null, 1));
    const body = ['GET', 'HEAD', 'OPTIONS'].includes(req.method) ? undefined : await new Promise((r) => {
      const parts = [];
      req.on('data', (c) => parts.push(c));
      req.on('end', () => r(Buffer.concat(parts)));
    });
    const r = await worker.fetch(new Request(url, { method: req.method, headers: req.headers, body }), env);
    res.writeHead(r.status, Object.fromEntries(r.headers));
    res.end(Buffer.from(await r.arrayBuffer()));
  })
  .listen(PORT, () => console.log(`booking dev server on ${SELF}`));
