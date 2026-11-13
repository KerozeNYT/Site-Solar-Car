// The booking server against an in-memory Google Calendar and Stripe (fetch is replaced).
import test from 'node:test';
import assert from 'node:assert/strict';
import { generateKeyPairSync, createHmac } from 'node:crypto';
import worker from '../worker.js';
import { resetToken } from '../google.js';
import { zonedToUtc, addDays, utcToZoned } from '../schedule.js';
import { installFakes } from './fakes.mjs';
import { fakeStats } from './fake-stats.mjs';

const TZ = 'Europe/Paris';
const ORIGIN = 'https://www.solarcar37.fr';
const CAR = 'contact.solarcar37@gmail.com';
const HOME = 'contact.solarhome37@gmail.com';
const PERSO = 'perso@group.calendar.google.com';
const WHSEC = 'whsec_test';

const { privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
const env = {
  ALLOWED_ORIGINS: `${ORIGIN}, https://kerozenyt.github.io`,
  CALENDAR_WRITE: CAR,
  CALENDARS_BUSY: `${CAR},${HOME},${PERSO}`,
  GOOGLE_SERVICE_ACCOUNT: JSON.stringify({ client_email: 'booking@x.iam.gserviceaccount.com', private_key: privateKey.export({ type: 'pkcs8', format: 'pem' }), token_uri: 'https://oauth2.googleapis.com/token' }),
  STRIPE_SECRET_KEY: 'sk_test_x',
  STRIPE_WEBHOOK_SECRET: WHSEC,
  RESEND_API_KEY: 're_test',
  NOTIFY_TO: 'contact.solarcar37@gmail.com',
  MAIL_FROM: 'SOLAR CAR 37 <reservation@solarcar37.fr>',
  MAIL_CLIENTS: '1',
  STATS: fakeStats(),
};

// ------------------------------------------------------------------ fake Google + Stripe
const { cal, sessions, mails } = installFakes({ CAR, HOME, PERSO });
// ------------------------------------------------------------------ helpers
const call = (path, { method = 'GET', body, headers = {} } = {}) =>
  worker.fetch(new Request(`https://reservation.solarcar37.fr${path}`, { method, body: body && JSON.stringify(body), headers: { origin: ORIGIN, 'content-type': 'application/json', ...headers } }), env);
const signed = (event) => {
  const payload = JSON.stringify(event);
  const t = Math.floor(Date.now() / 1000);
  const v1 = createHmac('sha256', WHSEC).update(`${t}.${payload}`).digest('hex');
  return { payload, header: `t=${t},v1=${v1}` };
};
const hook = (event, header) => {
  const s = signed(event);
  return worker.fetch(new Request('https://reservation.solarcar37.fr/api/stripe-webhook', { method: 'POST', body: s.payload, headers: { 'stripe-signature': header || s.header } }), env);
};
// a Wednesday three weeks ahead (outside the 14 days of withdrawal)
let day = utcToZoned(Date.now() + 21 * 86400000, TZ).date;
while (new Date(day + 'T12:00:00Z').getUTCDay() !== 3) day = addDays(day, 1);
const config = { tint: { vehicle: 'berline', formula: 'rear' } }; // 270 €, 2 h
const customer = { firstName: 'Jean', lastName: 'Martin', email: 'jean@example.com', phone: '06 12 34 56 78', vehicle: 'Peugeot 508' };
const slotsOf = async (cfg = config) => {
  const r = await call(`/api/slots?config=${encodeURIComponent(JSON.stringify(cfg))}&from=${day}&days=1`);
  assert.equal(r.status, 200);
  return (await r.json()).slots[0]?.times || [];
};

test('slots: busy in SOLAR HOME 37 or PERSO blocks the workshop', async () => {
  resetToken();
  const all = await slotsOf();
  assert.equal(all[0], '08:00');
  assert.equal(all.at(-1), '15:00');
  cal[HOME].push({ id: 'h1', status: 'confirmed', start: { dateTime: new Date(zonedToUtc(day, '09:00', TZ)).toISOString() }, end: { dateTime: new Date(zonedToUtc(day, '09:30', TZ)).toISOString() } });
  cal[PERSO].push({ id: 'p1', status: 'confirmed', start: { dateTime: new Date(zonedToUtc(day, '16:00', TZ)).toISOString() }, end: { dateTime: new Date(zonedToUtc(day, '16:30', TZ)).toISOString() } });
  const t = await slotsOf();
  assert.ok(!t.includes('08:00') && !t.includes('09:00'));
  assert.ok(t.includes('09:30'));
  assert.ok(!t.includes('14:30')); // 14:30-16:30 would overlap 16:00
  assert.ok(t.includes('14:00'));
});

let sessionId;
test('checkout: deposit of 30 %, slot held, Stripe page', async () => {
  const r = await call('/api/checkout', { method: 'POST', body: { config, date: day, time: '10:00', mode: 'deposit', customer, consent: { terms: true }, back: `${ORIGIN}/reservation/` } });
  assert.equal(r.status, 200, await r.clone().text());
  assert.equal((await r.json()).url, 'https://checkout.stripe.com/c/pay/x');
  const s = [...sessions.values()].at(-1);
  sessionId = s.id;
  assert.equal(s.amount_total, 8100); // 30 % of 270 €
  assert.match(s.name, /^Acompte 30 % — Vitres teintées — 3\/4 arrière/);
  assert.equal(s.success_url, `${ORIGIN}/reservation/confirmee/?session={CHECKOUT_SESSION_ID}`);
  const hold = cal[CAR].find((e) => e.id === s.metadata.event);
  assert.equal(hold.extendedProperties.private.solarcarHold, '1');
  assert.equal(hold.extendedProperties.private.session, s.id);
  assert.match(hold.summary, /^⏳ Paiement en cours/);
  // the held slot is no longer offered
  const t = await slotsOf();
  assert.ok(!t.includes('10:00') && !t.includes('11:00'));
  // nor can it be booked twice
  const again = await call('/api/checkout', { method: 'POST', body: { config, date: day, time: '10:00', mode: 'full', customer, consent: { terms: true }, back: `${ORIGIN}/reservation/` } });
  assert.equal(again.status, 409);
});

test('webhook: bad signature refused, paid session confirms the appointment', async () => {
  const s = sessions.get(sessionId);
  s.status = 'complete';
  s.payment_status = 'paid';
  const bad = await hook({ type: 'checkout.session.completed', data: { object: s } }, 't=1,v1=00');
  assert.equal(bad.status, 400);
  const r = await hook({ type: 'checkout.session.completed', data: { object: s } });
  assert.equal(r.status, 200);
  const ev = cal[CAR].find((e) => e.id === s.metadata.event);
  assert.equal(ev.colorId, '9');
  assert.match(ev.summary, /^RDV Vitres teintées 3\/4 arrière — Jean Martin/);
  assert.match(ev.description, /Payé en ligne : 81 € \(acompte 30 %\) — reste à régler : 189 €/);
  assert.match(ev.description, /Téléphone : 06 12 34 56 78/);
  // the e-mails: « Nouveau RDV » to the workshop, the confirmation (with the .ics) to the client
  assert.equal(mails.length, 2);
  const [shop, client] = mails;
  assert.deepEqual(shop.to, ['contact.solarcar37@gmail.com']);
  assert.match(shop.subject, /^Nouveau RDV — Jean Martin — \S+ \d+ \S+ à 10 h 00$/);
  assert.match(shop.html, /06 12 34 56 78/);
  assert.match(shop.html, /Reste à régler.*189 €/s);
  assert.equal(shop.reply_to, 'jean@example.com');
  assert.deepEqual(client.to, ['jean@example.com']);
  assert.match(client.subject, /^Votre rendez-vous du .* à 10 h 00 est confirmé$/);
  assert.match(Buffer.from(client.attachments[0].content, 'base64').toString(), /BEGIN:VEVENT[\s\S]*DTSTART:\d{8}T\d{6}Z/);
  // a second notice of the same payment: no new appointment, no new e-mail, counted once
  await hook({ type: 'checkout.session.completed', data: { object: s } });
  assert.equal(mails.length, 2);
  const counted = env.STATS.db.prepare("SELECT site, page, detail, value FROM hits WHERE kind = 'rdv'").all();
  assert.equal(counted.length, 1);
  assert.equal(counted[0].site, 'apercu'); // Stripe test mode
  assert.equal(counted[0].value, 81);
  assert.match(counted[0].detail, /^Vitres teintées/);
  // the confirmation page
  const b = await (await call(`/api/booking?session=${sessionId}`)).json();
  assert.deepEqual([b.paid, b.amount, b.remaining, b.time], [true, 81, 189, '10:00']);
});

test('expired payment: the held slot is freed', async () => {
  const r = await call('/api/checkout', { method: 'POST', body: { config, date: day, time: '14:00', mode: 'full', customer, consent: { terms: true }, back: `https://kerozenyt.github.io/Site-Solar-Car/reservation/` } });
  assert.equal(r.status, 200);
  const s = [...sessions.values()].at(-1);
  assert.equal(s.amount_total, 27000);
  assert.equal(s.success_url, 'https://kerozenyt.github.io/Site-Solar-Car/reservation/confirmee/?session={CHECKOUT_SESSION_ID}');
  assert.ok(!(await slotsOf()).includes('14:00'));
  s.status = 'expired';
  await hook({ type: 'checkout.session.expired', data: { object: s } });
  assert.ok((await slotsOf()).includes('14:00'));
});

test('a hold whose webhook never came is cleaned up', async () => {
  await call('/api/checkout', { method: 'POST', body: { config, date: day, time: '14:00', mode: 'deposit', customer, consent: { terms: true }, back: `${ORIGIN}/reservation/` } });
  const s = [...sessions.values()].at(-1);
  const hold = cal[CAR].find((e) => e.id === s.metadata.event);
  hold.extendedProperties.private.holdUntil = String(Date.now() - 1000);
  assert.ok((await slotsOf()).includes('14:00'));
  assert.ok(!cal[CAR].includes(hold));
});

test('refusals: other site, missing consent, bad details, unbookable', async () => {
  const near = utcToZoned(Date.now() + 5 * 86400000, TZ).date;
  const base = { config, date: day, time: '13:00', mode: 'deposit', customer, consent: { terms: true }, back: `${ORIGIN}/reservation/` };
  assert.equal((await call('/api/checkout', { method: 'POST', body: base, headers: { origin: 'https://evil.example' } })).status, 403);
  assert.equal((await call('/api/checkout', { method: 'POST', body: { ...base, consent: {} } })).status, 400);
  assert.equal((await call('/api/checkout', { method: 'POST', body: { ...base, customer: { ...customer, email: 'x' } } })).status, 400);
  assert.equal((await call('/api/checkout', { method: 'POST', body: { ...base, config: { tint: { vehicle: 'tesla', formula: 'rear' } } } })).status, 400);
  assert.equal((await call('/api/checkout', { method: 'POST', body: { ...base, back: 'https://evil.example/reservation/' } })).status, 400);
  // within 14 days: the early start must be asked for
  const r = await call('/api/checkout', { method: 'POST', body: { ...base, date: near, time: '08:00' } });
  assert.equal(r.status, 400);
  assert.match((await r.json()).error, /rétractation/);
});
