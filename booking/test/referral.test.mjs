// Referral codes: one per client, 20 € off once, on the booking page or at the workshop.
import test from 'node:test';
import assert from 'node:assert/strict';
import { generateKeyPairSync, createHmac } from 'node:crypto';
import worker, { dailyMails } from '../worker.js';
import { Parrainage, newCode, referralFor, checkReferral, redeemReferral } from '../referral.js';
import { utcToZoned, addDays, zonedToUtc } from '../schedule.js';
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
let day = utcToZoned(Date.now() + 21 * DAY, TZ).date;
while (new Date(day + 'T12:00:00Z').getUTCDay() !== 3) day = addDays(day, 1);
const config = { tint: { vehicle: 'berline', formula: 'rear' } }; // 270 €
const customer = { firstName: 'Paul', lastName: 'Durand', email: 'paul@example.com', phone: '06 11 22 33 44', vehicle: 'Renault Clio' };

test('a code: the first name and 5 characters, the same for the same booking, used once', async () => {
  assert.match(newCode('Hélène'), /^HELENE-[A-HJ-NP-Z2-9]{5}$/);
  assert.match(newCode(''), /^SOLAR-[A-HJ-NP-Z2-9]{5}$/);
  const now = Date.now();
  const a = await referralFor(env, { owner: 'Zoé', email: 'zoe@example.com', origin: 'cs_test_zoe' }, now);
  const again = await referralFor(env, { owner: 'Zoé', origin: 'cs_test_zoe' }, now);
  assert.equal(again.code, a.code);
  assert.ok(Math.abs(a.expires - now - 6 * 30.44 * DAY) < DAY);
  assert.equal((await checkReferral(env, a.code.toLowerCase(), now)).ok, true);
  assert.equal((await redeemReferral(env, a.code, { by: 'X', ref: 'r1', where: 'test' }, now)).ok, true);
  assert.equal((await redeemReferral(env, a.code, { by: 'X', ref: 'r1', where: 'test' }, now)).ok, true); // the same booking again
  assert.match((await redeemReferral(env, a.code, { by: 'Y', ref: 'r2', where: 'test' }, now)).error, /déjà été utilisé/);
  const old = await referralFor(env, { owner: 'Léa', origin: 'cs_test_lea' }, now - 200 * DAY);
  assert.match((await checkReferral(env, old.code, now)).error, /expiré/);
  assert.match((await checkReferral(env, 'NOPE-AAAAA', now)).error, /n’existe pas/);
});

let code;
test('booking with a code: 20 € off the total, deposit on what is left, the code used once paid', async () => {
  code = (await referralFor(env, { owner: 'Marie', email: 'marie@example.com', origin: 'cs_test_marie' })).code;
  const check = await (await call(`/api/referral?code=${code.toLowerCase()}`)).json();
  assert.deepEqual([check.ok, check.owner, check.amount], [true, 'Marie', 20]);
  const r = await call('/api/checkout', { method: 'POST', body: { config, date: day, time: '10:00', mode: 'deposit', customer, code, consent: { terms: true }, back: `${ORIGIN}/reservation/` } });
  assert.equal(r.status, 200, await r.clone().text());
  const s = [...sessions.values()].at(-1);
  assert.equal(s.amount_total, 7500); // 30 % of 250 €
  assert.deepEqual([s.metadata.code, s.metadata.discount], [code, '20']);
  // not used yet: the payment may not come
  assert.equal((await checkReferral(env, code)).ok, true);
  s.status = 'complete';
  s.payment_status = 'paid';
  assert.equal((await hook({ type: 'checkout.session.completed', data: { object: s } })).status, 200);
  const ev = cal[CAR].find((e) => e.extendedProperties?.private?.session === s.id);
  assert.match(ev.description, new RegExp(`Parrainage : −20 € \\(code ${code}\\)\\nTotal : 250 €`));
  assert.match(ev.description, /Payé en ligne : 75 € \(acompte 30 %\) — reste à régler : 175 €/);
  assert.match(mails.find((m) => /^Nouveau RDV/.test(m.subject)).html, new RegExp(`Parrainage.*−20 € \\(code ${code}\\)`, 's'));
  const b = await (await call(`/api/booking?session=${s.id}`)).json();
  assert.deepEqual([b.total, b.discount, b.remaining], [250, 20, 175]);
  assert.match((await checkReferral(env, code)).error, /déjà été utilisé/);
  // a second booking with the same code: refused, the visitor keeps the full price
  const again = await call('/api/checkout', { method: 'POST', body: { config, date: day, time: '14:00', mode: 'deposit', customer: { ...customer, email: 'autre@example.com' }, code, consent: { terms: true }, back: `${ORIGIN}/reservation/` } });
  assert.equal(again.status, 400);
  const j = await again.json();
  assert.equal(j.code, true);
  assert.match(j.error, /déjà été utilisé/);
});

test('a week after: the e-mail carries the client’s own code as a gift card', async () => {
  const before = mails.length;
  const r = await dailyMails(env, zonedToUtc(addDays(day, 7), '17:00', TZ));
  assert.equal(r.followUps, 1);
  const f = mails.slice(before).find((m) => /^Des nouvelles de votre Renault Clio/.test(m.subject));
  const own = f.html.match(/>(PAUL-[A-HJ-NP-Z2-9]{5})</)[1];
  assert.match(f.html, /20 € offerts/);
  assert.match(f.html, new RegExp(`href="https://www\\.solarcar37\\.fr/reservation/\\?code=${own}"`));
  assert.equal((await checkReferral(env, own)).owner, 'Paul');
});

test('the workshop’s page: key required, a code made for a client, a code used at the workshop', async () => {
  const page = (q = '', init) => worker.fetch(new Request(`https://reservation.solarcar37.fr/parrainage?${q}`, init), env);
  assert.equal((await page('cle=mauvaise')).status, 403);
  const form = (fields) => ({ method: 'POST', body: new URLSearchParams(fields) });
  const made = await page(`cle=${KEY}`, form({ action: 'creer', prenom: 'Luc' }));
  assert.equal(made.status, 303);
  const fresh = new URL(made.headers.get('location'), 'https://x').searchParams.get('nouveau');
  assert.match(fresh, /^LUC-/);
  const used = await page(`cle=${KEY}`, form({ action: 'utiliser', code: fresh.toLowerCase(), client: 'Ami de Luc' }));
  assert.match(decodeURIComponent(used.headers.get('location')), /utilisé/);
  const twice = await page(`cle=${KEY}`, form({ action: 'utiliser', code: fresh, client: 'Encore' }));
  assert.match(new URL(twice.headers.get('location'), 'https://x').searchParams.get('err'), /déjà été utilisé/);
  const html = await (await page(`cle=${KEY}`)).text();
  assert.match(html, new RegExp(`${fresh}[\\s\\S]*Utilisé le[\\s\\S]*Ami de Luc · à l’atelier`));
  assert.match(html, new RegExp(`${code}[\\s\\S]*Paul Durand · réservation en ligne`));
  const res = await page(`cle=${KEY}`);
  assert.equal(res.headers.get('referrer-policy'), 'no-referrer');
});
