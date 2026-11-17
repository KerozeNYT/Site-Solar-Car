// Promo codes of a campaign (content/booking.js `promos`): a percentage off, for bookings and quote
// requests made between two days, one code per booking (never added to a referral code).
import test from 'node:test';
import assert from 'node:assert/strict';
import { generateKeyPairSync, createHmac } from 'node:crypto';
import worker from '../worker.js';
import { Parrainage, referralFor } from '../referral.js';
import { promoState, checkPromo, listPromos } from '../promo.js';
import { promos, promoOf, percentOff, discountLabel } from '../../content/booking.js';
import { utcToZoned, addDays, zonedToUtc } from '../schedule.js';
import { leftText as leftNb, promoEnd, deadlineText as deadlineNb } from '../../src/js/countdown.js';

// the countdown's words, with plain spaces (it keeps "23 h 59" or "7 jours" on one line)
const leftText = (ms) => leftNb(ms).replace(/\u00a0/g, ' ');
const deadlineText = (p) => deadlineNb(p).replace(/\u00a0/g, ' ');
import { installFakes } from './fakes.mjs';
import { fakeDO } from './fake-do.mjs';
import { fakeStats } from './fake-stats.mjs';

const TZ = 'Europe/Paris';
const ORIGIN = 'https://www.solarcar37.fr';
const CAR = 'contact.solarcar37@gmail.com';
const HOME = 'contact.solarhome37@gmail.com';
const PERSO = 'perso@group.calendar.google.com';
const WHSEC = 'whsec_test';
const KEY = 'cle-de-test-0123456789abcdefghij';
const DAY = 86400000;
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
  SITE_URL: 'https://www.solarcar37.fr',
  STATS_KEY: KEY,
  STATS: fakeStats(),
  PARRAINAGE: fakeDO(Parrainage),
};
const { cal, sessions, mails } = installFakes({ CAR, HOME, PERSO });
const call = (path, { method = 'GET', body, headers = {} } = {}) =>
  worker.fetch(new Request(`https://reservation.solarcar37.fr${path}`, { method, body: body && JSON.stringify(body), headers: { origin: ORIGIN, 'content-type': 'application/json', ...headers } }), env);
const hook = (event) => {
  const payload = JSON.stringify(event);
  const t = Math.floor(Date.now() / 1000);
  const v1 = createHmac('sha256', WHSEC).update(`${t}.${payload}`).digest('hex');
  return worker.fetch(new Request('https://reservation.solarcar37.fr/api/stripe-webhook', { method: 'POST', body: payload, headers: { 'stripe-signature': `t=${t},v1=${v1}` } }), env);
};
const paid = (s) => {
  s.status = 'complete';
  s.payment_status = 'paid';
  return hook({ type: 'checkout.session.completed', data: { object: s } });
};
const paris = (date, time) => zonedToUtc(date, time, TZ);

// a campaign open today (whatever the day the tests run), limited to 2 uses
const today = utcToZoned(Date.now(), TZ).date;
promos.push({ code: 'TEST10', percent: 10, from: addDays(today, -1), to: addDays(today, 1), uses: 2, label: 'Essai' });

let day = utcToZoned(Date.now() + 21 * DAY, TZ).date;
while (new Date(day + 'T12:00:00Z').getUTCDay() !== 3) day = addDays(day, 1);
const config = { tint: { vehicle: 'berline', formula: 'rear' } }; // 270 €
const customer = { firstName: 'Paul', lastName: 'Durand', email: 'paul@example.com', phone: '06 11 22 33 44', vehicle: 'Renault Clio' };
const checkout = (body) => call('/api/checkout', { method: 'POST', body: { config, date: day, mode: 'deposit', customer, consent: { terms: true }, back: `${ORIGIN}/reservation/`, ...body } });

test('NOEL15: 15 % off, for bookings made from 1 to 24 December 2026 (Paris), unlimited', () => {
  const p = promoOf(' noel15 ');
  assert.deepEqual([p.code, p.percent, p.from, p.to, p.uses], ['NOEL15', 15, '2026-12-01', '2026-12-24', null]);
  assert.match(promoState(p, paris('2026-11-30', '23:50')).error, /valable à partir du 1er décembre 2026/);
  assert.equal(promoState(p, paris('2026-12-01', '00:05')).ok, true);
  assert.equal(promoState(p, paris('2026-12-24', '23:55'), 5000).ok, true);
  assert.match(promoState(p, paris('2026-12-25', '00:05')).error, /n’est plus valable : l’offre s’est terminée le 24 décembre 2026 à 23 h 59/);
  assert.match(promoState(null, Date.now()).error, /n’existe pas/);
  // the discount, to the cent, and its name
  assert.equal(percentOff({ total: 270 }, 15), 40.5);
  assert.equal(percentOff({ total: 72.5 }, 15), 10.88);
  assert.equal(discountLabel({ kind: 'promo', code: 'NOEL15', percent: 15 }), 'Code promo NOEL15 (−15 %)');
  assert.equal(discountLabel({ kind: 'parrainage' }), 'Parrainage');
});

test('the countdown: days left until the last day, then hours, minutes and seconds until 23:59:59', () => {
  const p = promoOf('NOEL15');
  const end = promoEnd(p);
  assert.equal(end, paris('2026-12-25', '00:00'));
  assert.equal(deadlineText(p), '24 décembre à 23 h 59');
  assert.equal(leftText(end - paris('2026-12-01', '09:00')), 'Plus que 24 jours');
  assert.equal(leftText(end - paris('2026-12-18', '00:00')), 'Plus que 7 jours');
  assert.equal(leftText(end - paris('2026-12-18', '23:59')), 'Plus que 7 jours');
  assert.equal(leftText(end - paris('2026-12-23', '10:00')), 'Plus que 2 jours');
  assert.equal(leftText(end - paris('2026-12-24', '00:00')), 'Dernier jour : plus que 24 h 00 min 00 s');
  assert.equal(leftText(end - paris('2026-12-24', '21:11') - 48000), 'Dernier jour : plus que 2 h 48 min 12 s');
  assert.equal(leftText(end - paris('2026-12-24', '23:12')), 'Dernier jour : plus que 48 min 00 s');
  assert.equal(leftText(9000), 'Dernier jour : plus que 9 s');
  assert.equal(leftText(0), '');
});

test('the online agenda reaches about six months ahead (a client on holiday in the summer books in the winter)', async () => {
  const slots = async (from) => (await (await call(`/api/slots?config=${encodeURIComponent(JSON.stringify(config))}&from=${from}&days=14`)).json()).slots;
  assert.ok((await slots(addDays(today, 170))).length > 0);
  assert.equal((await slots(addDays(today, 190))).length, 0);
});

test('/api/code: a promo code or a referral code, from the site only', async () => {
  const promo = await (await call('/api/code?code=test10')).json();
  assert.deepEqual([promo.ok, promo.kind, promo.code, promo.percent], [true, 'promo', 'TEST10', 10]);
  const ref = (await referralFor(env, { owner: 'Marie', origin: 'cs_test_marie' })).code;
  const r = await (await call(`/api/code?code=${ref}`)).json();
  assert.deepEqual([r.ok, r.kind, r.owner, r.amount], [true, 'parrainage', 'Marie', 20]);
  assert.match((await (await call('/api/code?code=NOEL16')).json()).error, /n’existe pas/);
  assert.equal((await call('/api/code?code=TEST10', { headers: { origin: 'https://ailleurs.example' } })).status, 403);
});

let first;
test('booking with a promo code: the percentage off the total, deposit on what is left, counted once paid', async () => {
  const r = await checkout({ time: '10:00', code: 'test10' });
  assert.equal(r.status, 200, await r.clone().text());
  first = [...sessions.values()].at(-1);
  assert.equal(first.amount_total, 7290); // 30 % of 243 € (270 € − 10 %)
  assert.deepEqual([first.metadata.code, first.metadata.discount, first.metadata.kind, first.metadata.percent], ['TEST10', '27', 'promo', '10']);
  assert.match(first.name, /^Acompte 30 %/);
  assert.equal((await paid(first)).status, 200);
  const ev = cal[CAR].find((e) => e.extendedProperties?.private?.session === first.id);
  assert.match(ev.description, /Code promo TEST10 \(−10 %\) : −27 €\nTotal : 243 €/);
  assert.match(mails.find((m) => /^Nouveau RDV/.test(m.subject)).html, /Code promo TEST10 \(−10 %\).*−27 €/s);
  assert.match(mails.find((m) => /est confirmé$/.test(m.subject)).html, /Code promo TEST10 \(−10 %\).*−27 €/s);
  const b = await (await call(`/api/booking?session=${first.id}`)).json();
  assert.deepEqual([b.total, b.discount, b.discountLabel, b.remaining], [243, 27, 'Code promo TEST10 (−10 %)', 170.1]);
  // the same payment notified twice: counted once
  await paid(first);
  const t = (await listPromos(env)).promos.find((p) => p.code === 'TEST10');
  assert.deepEqual([t.used, t.online, t.total, t.discount], [1, 1, 243, 27]);
  assert.equal(t.last[0].who, 'Paul Durand');
});

test('a code limited to N uses: an open payment page holds one, the next visitor is refused until it expires', async () => {
  const r = await checkout({ time: '14:00', code: 'TEST10', customer: { ...customer, email: 'b@example.com' } });
  assert.equal(r.status, 200, await r.clone().text());
  const held = [...sessions.values()].at(-1);
  // 2 uses: one paid, one held by the open payment page
  const refused = await checkout({ date: addDays(day, 1), time: '10:00', code: 'TEST10', customer: { ...customer, email: 'c@example.com' } });
  assert.equal(refused.status, 400);
  const j = await refused.json();
  assert.equal(j.code, true);
  assert.match(j.error, /a déjà servi 2 fois : l’offre est épuisée/);
  // the payment page expires (Stripe's 30 minutes): the use is free again
  const later = Number(held.expires_at) * 1000 + 3 * 60000;
  assert.equal((await checkPromo(env, 'TEST10', later)).ok, true);
  assert.equal((await checkPromo(env, 'TEST10', later)).left, 1);
});

test('one code per booking: a referral code and a promo code never add up', async () => {
  const ref = (await referralFor(env, { owner: 'Léa', origin: 'cs_test_lea' })).code;
  // the booking takes one code: two sent together are not a code
  const both = await checkout({ date: addDays(day, 2), time: '10:00', code: [ref, 'NOEL15'] });
  assert.equal(both.status, 400);
  assert.match((await both.json()).error, /n’existe pas/);
  const one = await checkout({ date: addDays(day, 2), time: '10:00', code: ref, customer: { ...customer, email: 'lea@example.com' } });
  assert.equal(one.status, 200, await one.clone().text());
  const s = [...sessions.values()].at(-1);
  assert.equal(s.amount_total, 7500); // 30 % of 250 €: the referral's 20 € only
  assert.equal(s.metadata.kind, undefined);
});

test('the workshop’s page: the campaigns, a promo code noted for a quoted service', async () => {
  const page = (q = '', init) => worker.fetch(new Request(`https://reservation.solarcar37.fr/parrainage?${q}`, init), env);
  const form = (fields) => ({ method: 'POST', body: new URLSearchParams(fields) });
  const msg = (r) => Object.fromEntries(new URL(r.headers.get('location'), 'https://x').searchParams);
  assert.match(msg(await page(`cle=${KEY}`, form({ action: 'utiliser', code: 'test10', client: 'Jean Martin' }))).err, /prix de la prestation avant remise/);
  const noted = msg(await page(`cle=${KEY}`, form({ action: 'utiliser', code: 'TEST10', client: 'Jean Martin', prestation: 'Ciel étoilé', montant: '450' })));
  assert.match(noted.ok, /Code TEST10 noté pour Jean Martin : 450\s€ − 10 % \(−45\s€\) = 405\s€\./);
  assert.doesNotMatch(noted.ok, /Attention/);
  // NOEL15 noted outside its dates: noted, with a warning
  const noel = msg(await page(`cle=${KEY}`, form({ action: 'utiliser', code: 'NOEL15', client: 'Ana', montant: '200,50' })));
  if (today < '2026-12-01' || today > '2026-12-24') assert.match(noel.ok, /Attention : l’offre court du 1er décembre 2026 au 24 décembre 2026/);
  assert.match(noel.ok, /200,50\s€ − 15 % \(−30,08\s€\) = 170,42\s€/);
  const check = msg(await page(`cle=${KEY}`, form({ action: 'verifier', code: 'TEST10' })));
  assert.match(check.err || check.ok, /TEST10/);
  const html = await (await page(`cle=${KEY}`)).text();
  assert.match(html, /Codes promo/);
  assert.match(html, /NOEL15[\s\S]*−15 % sur toutes les prestations[\s\S]*du 1er décembre 2026 au 24 décembre 2026 · utilisations illimitées/);
  assert.match(html, /TEST10[\s\S]*Jean Martin<small>Ciel étoilé<\/small>[\s\S]*405/);
  assert.match(html, /Un seul code par réservation ou par devis/);
  const t = (await listPromos(env)).promos.find((p) => p.code === 'TEST10');
  assert.deepEqual([t.used, t.online], [2, 1]);
});
