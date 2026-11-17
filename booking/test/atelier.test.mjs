// The workshop's space (/atelier): sign-in by e-mailed code, client file, bookings, promotion
// codes, the band of the site.
import test from 'node:test';
import assert from 'node:assert/strict';
import { generateKeyPairSync, createHmac } from 'node:crypto';
import worker from '../worker.js';
import { Atelier, db, checkCode } from '../store.js';
import { utcToZoned, addDays, zonedToUtc } from '../schedule.js';
import { bookingRules as R } from '../../content/booking.js';
import { leftText as leftNb, deadlineText as deadlineNb } from '../../src/js/countdown.js';
import { installFakes } from './fakes.mjs';
import { fakeDO } from './fake-do.mjs';
import { fakeStats } from './fake-stats.mjs';

const TZ = 'Europe/Paris';
const SITE = 'https://www.solarcar37.fr';
const SELF = 'https://reservation.solarcar37.fr';
const CAR = 'contact.solarcar37@gmail.com';
const HOME = 'contact.solarhome37@gmail.com';
const PERSO = 'perso@group.calendar.google.com';
const WHSEC = 'whsec_test';
const DAY = 86400000;
const { privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
const env = {
  ALLOWED_ORIGINS: `${SITE},https://kerozenyt.github.io`,
  CALENDAR_WRITE: CAR,
  CALENDARS_BUSY: `${CAR},${HOME},${PERSO}`,
  GOOGLE_SERVICE_ACCOUNT: JSON.stringify({ client_email: 'booking@x.iam.gserviceaccount.com', private_key: privateKey.export({ type: 'pkcs8', format: 'pem' }), token_uri: 'https://oauth2.googleapis.com/token' }),
  STRIPE_SECRET_KEY: 'sk_test_x',
  STRIPE_WEBHOOK_SECRET: WHSEC,
  RESEND_API_KEY: 're_test',
  NOTIFY_TO: 'contact.solarcar37@gmail.com',
  MAIL_CLIENTS: '0',
  STATS_KEY: 'cle-stats',
  STATS: fakeStats(),
  ATELIER: fakeDO(Atelier),
  ATELIER_SECRET: 'secret-de-test',
};
const { cal, sessions, mails } = installFakes({ CAR, HOME, PERSO });
let cookie = '';
const go = (path, { method = 'GET', form, body, headers = {} } = {}) =>
  worker.fetch(new Request(`${SELF}${path}`, { method, body: form ? new URLSearchParams(form) : body, redirect: 'manual', headers: { origin: method === 'GET' ? undefined : SELF, cookie, ...headers } }), env);
const site = (path, init = {}) => worker.fetch(new Request(`${SELF}${path}`, { ...init, headers: { origin: SITE, 'content-type': 'application/json', ...(init.headers || {}) } }), env);
const where = (res) => new URL(res.headers.get('location'), SELF);
const today = utcToZoned(Date.now(), TZ).date;
let day = utcToZoned(Date.now() + 21 * DAY, TZ).date;
while (new Date(day + 'T12:00:00Z').getUTCDay() !== 3) day = addDays(day, 1);

test('sign-in: a code e-mailed to the workshop, then 30 days on the device; nothing without it', async () => {
  assert.equal(where(await go('/atelier')).pathname, '/atelier/connexion');
  assert.equal(where(await go('/atelier/clients.csv')).pathname, '/atelier/connexion');
  // a form from another site is refused
  assert.equal((await go('/atelier/connexion/code', { method: 'POST', headers: { origin: 'https://evil.example' } })).status, 403);
  const asked = await go('/atelier/connexion/code', { method: 'POST' });
  assert.equal(where(asked).searchParams.get('envoye'), '1');
  const mail = mails.at(-1);
  assert.deepEqual(mail.to, ['contact.solarcar37@gmail.com']);
  const code = mail.subject.match(/(\d{6})$/)[1];
  const wrong = await go('/atelier/connexion', { method: 'POST', form: { code: code === '000000' ? '111111' : '000000' } });
  assert.equal(where(wrong).searchParams.get('err'), 'Code incorrect.');
  const ok = await go('/atelier/connexion', { method: 'POST', form: { code } });
  assert.equal(where(ok).pathname, '/atelier');
  const set = ok.headers.get('set-cookie');
  assert.match(set, /HttpOnly; Secure; SameSite=Strict/);
  cookie = set.split(';')[0];
  // the same code twice: no
  assert.ok(where(await go('/atelier/connexion', { method: 'POST', form: { code } })).searchParams.get('err'));
  const home = await go('/atelier');
  assert.equal(home.status, 200);
  assert.match(await home.text(), /Bonjour Nicolas/);
  // a forged cookie
  assert.equal(where(await go('/atelier', { headers: { cookie: `sc37_atelier=${Date.now() + DAY}.${'0'.repeat(64)}` } })).pathname, '/atelier/connexion');
});

test('GTA 6 and Noël: codes and bands planned, each on its dates', async () => {
  const at = (iso) => Date.parse(iso);
  // GTA6: bookings made on 19 November only (Paris time)
  const before = await checkCode(env, 'gta6', at('2026-11-18T12:00:00Z'));
  assert.equal(before.ok, false);
  assert.match(before.error, /valable le jeudi 19 novembre seulement/);
  assert.equal((await checkCode(env, 'GTA6', at('2026-11-18T23:30:00Z'))).ok, true); // 0:30 in Paris
  assert.equal((await checkCode(env, 'GTA6', at('2026-11-19T22:30:00Z'))).ok, true); // 23:30 in Paris, still the 19th
  assert.equal((await checkCode(env, 'GTA6', at('2026-11-19T23:30:00Z'))).ok, false); // 0:30 on the 20th
  // NOEL: every service, bookings and quote requests from 1 December to 24 December 23:59 (Paris)
  assert.match((await checkCode(env, 'Noël', at('2026-11-30T12:00:00Z'))).error, /sera valable à partir du mardi 1er décembre/);
  const r = await checkCode(env, 'noel', at('2026-12-05T10:00:00Z'));
  assert.deepEqual([r.ok, r.kind, r.percent, r.services], [true, 'promo', 15, []]);
  assert.equal((await checkCode(env, 'NOEL', at('2026-12-24T22:58:00Z'))).ok, true); // 23:58 in Paris
  assert.equal((await checkCode(env, 'NOEL', at('2026-12-24T23:00:00Z'))).ok, false); // midnight, the 25th
  assert.equal(r.expires + 1, at('2026-12-24T23:00:00Z'));
  // the bands: the GTA 6 one from 17 to 19 November (neon look), then Noël (red) in December
  assert.equal((await db(env, 'banner/public', { now: at('2026-11-10T12:00:00Z') })).banner, null);
  const gta = (await db(env, 'banner/public', { now: at('2026-11-18T12:00:00Z') })).banner;
  assert.deepEqual([gta.theme, gta.code], ['neon', 'GTA6']);
  assert.match(gta.text, /19 novembre.*−15 %/);
  assert.equal((await db(env, 'banner/public', { now: at('2026-11-25T12:00:00Z') })).banner, null);
  const noel = (await db(env, 'banner/public', { now: at('2026-12-05T10:00:00Z') })).banner;
  assert.deepEqual([noel.theme, noel.code, noel.title], ['noel', 'NOEL', 'Offre de Noël · −15 %']);
  assert.match(noel.text, /Jusqu’au 24 décembre à 23 h 59 seulement : −15 % sur toutes les prestations/);
  // the countdown of the band: the code's dates, up to 24 December 23:59
  assert.deepEqual([noel.starts, noel.ends], [at('2026-11-30T23:00:00Z'), at('2026-12-24T23:00:00Z')]);
  assert.equal((await db(env, 'banner/public', { now: at('2026-12-26T10:00:00Z') })).banner, null);
});

test('a campaign changed in content/promos.js (rev raised) is written once over the database', async () => {
  const at = (iso) => Date.parse(iso);
  // the database as the first version left it: NOEL in December on window tint and lights only
  const sql = env.ATELIER.db;
  sql.prepare("UPDATE promos SET services = 'tint,lights', expires = ? WHERE code = 'NOEL'").run(at('2026-12-31T22:59:59.999Z'));
  sql.prepare("UPDATE banners SET expires = ?, text = 'Tout le mois de décembre' WHERE id = 'noel-2026'").run(at('2026-12-31T22:59:59.999Z'));
  sql.prepare("DELETE FROM settings WHERE key IN ('seeded:promo:NOEL:rev', 'seeded:banner:noel-2026:rev')").run();
  const r = await checkCode(env, 'NOEL', at('2026-12-05T10:00:00Z'));
  assert.deepEqual([r.services, r.expires + 1], [[], at('2026-12-24T23:00:00Z')]);
  assert.match((await db(env, 'banner/public', { now: at('2026-12-05T10:00:00Z') })).banner.text, /^Jusqu’au 24 décembre/);
  // then the workshop's own changes are kept
  sql.prepare("UPDATE promos SET percent = 20 WHERE code = 'NOEL'").run();
  assert.equal((await checkCode(env, 'NOEL', at('2026-12-05T10:00:00Z'))).percent, 20);
  sql.prepare("UPDATE promos SET percent = 15 WHERE code = 'NOEL'").run();
});

let sessionId;
test('a promotion made in the space: on the services it names only, counted, in the booking and the client file', async () => {
  const made = await go('/atelier/codes', { method: 'POST', form: [['action', 'promo-save'], ['code', 'test15'], ['label', 'Essai'], ['type', 'percent'], ['value', '15'], ['maxUses', '2'], ['starts', today], ['ends', addDays(today, 60)], ['services', 'tint']] });
  assert.equal(where(made).searchParams.get('ok'), 'Code TEST15 enregistré.');
  const info = await (await site('/api/code?code=test15')).json();
  assert.deepEqual([info.ok, info.percent, info.services], [true, 15, ['tint']]);
  // vitres 270 € + feux 120 €: 15 % of the window tint only, 40,50 €
  const config = { tint: { vehicle: 'berline', formula: 'rear' }, lights: { pairs: 'rear' } };
  const customer = { firstName: 'Camille', lastName: 'Roux', email: 'camille@example.com', phone: '06 22 33 44 55', vehicle: 'Audi A3' };
  const r = await site('/api/checkout', { method: 'POST', body: JSON.stringify({ config, date: day, time: '09:00', mode: 'deposit', customer, code: 'TEST15', consent: { terms: true }, back: `${SITE}/reservation/` }) });
  assert.equal(r.status, 200, await r.clone().text());
  const s = [...sessions.values()].at(-1);
  sessionId = s.id;
  assert.equal(s.amount_total, 10485); // 30 % of 349,50 €
  assert.deepEqual([s.metadata.code, s.metadata.codeKind, s.metadata.discount], ['TEST15', 'promo', '40.5']);
  s.status = 'complete';
  s.payment_status = 'paid';
  const payload = JSON.stringify({ type: 'checkout.session.completed', data: { object: s } });
  const t = Math.floor(Date.now() / 1000);
  await worker.fetch(new Request(`${SELF}/api/stripe-webhook`, { method: 'POST', body: payload, headers: { 'stripe-signature': `t=${t},v1=${createHmac('sha256', WHSEC).update(`${t}.${payload}`).digest('hex')}` } }), env);
  const ev = cal[CAR].find((e) => e.extendedProperties?.private?.session === s.id);
  assert.match(ev.description, /Code promo TEST15 : −40,50 €\nTotal : 349,50 €/);
  const codes = await db(env, 'codes/list');
  assert.equal(codes.promos.find((p) => p.code === 'TEST15').uses, 1);
  const b = await (await site(`/api/booking?session=${s.id}`)).json();
  assert.deepEqual([b.codeKind, b.discount, b.total], ['promo', 40.5, 349.5]);
  // a code on services it does not cover: refused
  const lights = await site('/api/checkout', { method: 'POST', body: JSON.stringify({ config: { lights: { pairs: 'rear' } }, date: day, time: '14:00', mode: 'deposit', customer, code: 'TEST15', consent: { terms: true }, back: `${SITE}/reservation/` }) });
  assert.equal(lights.status, 400);
  assert.match((await lights.json()).error, /ne s’applique pas/);
  // pause: refused at once
  await go('/atelier/codes', { method: 'POST', form: { action: 'promo-active', code: 'TEST15', active: '' } });
  assert.equal((await (await site('/api/code?code=TEST15')).json()).ok, false);
});

test('the client file: bookings and quote requests come in by themselves, one card per client, export for Excel', async () => {
  // a quote request sent from the site (copy of the form)
  const req = (extra = {}) => site('/api/demande', { method: 'POST', headers: { 'content-type': 'text/plain;charset=UTF-8' }, body: JSON.stringify({ firstName: 'Léa', lastName: 'Petit', email: 'LEA@example.com', phone: '0611111111', make: 'Peugeot', model: '208', year: '2021', services: 'Vitres teintées', message: 'Bonjour, devis pour mes vitres', source: { channels: ['Bouche-à-oreille'] }, ...extra }) });
  assert.equal((await req()).status, 204);
  await req({ email: 'lea@example.com', model: '3008', message: 'Et pour ma deuxième voiture' });
  // from another site: ignored
  await site('/api/demande', { method: 'POST', headers: { origin: 'https://evil.example' }, body: JSON.stringify({ firstName: 'X', lastName: 'Y', email: 'x@example.com' }) });
  const list = await (await go('/atelier/clients')).text();
  assert.match(list, /Camille Roux/);
  assert.equal((list.match(/Léa Petit/g) || []).length, 1);
  assert.doesNotMatch(list, /x@example\.com/);
  const lea = (await db(env, 'clients/list', { q: 'petit' })).clients[0];
  assert.equal(lea.vehicles, 'Peugeot 208 2021 · Peugeot 3008 2021');
  assert.equal(lea.n_requests, 2);
  assert.equal(lea.source, 'Bouche-à-oreille');
  // a quote request with a code: checked by the server the day it arrives, written with the request
  await db(env, 'promo/save', { code: 'DEVIS10', label: 'Essai devis', percent: 10, starts: today, ends: addDays(today, 3), services: [] });
  await req({ firstName: 'Zoé', lastName: 'Martin', email: 'zoe@example.com', phone: '0622222222', code: 'devis10', message: 'Ciel étoilé avec le code' });
  await req({ firstName: 'Zoé', lastName: 'Martin', email: 'zoe@example.com', phone: '0622222222', code: 'NOPE9', message: 'Un code inventé' });
  const zoe = (await db(env, 'clients/list', { q: 'zoe@' })).clients[0];
  const asked = db(env, 'client/get', { id: zoe.id });
  const msgs = (await asked).client.requests.map((x) => x.message).join('\n---\n');
  assert.match(msgs, /Code promo DEVIS10 valable le jour de la demande : −10 %\n\nCiel étoilé avec le code/);
  assert.match(msgs, /Code NOPE9 non valable le jour de la demande : Ce code n’existe pas/);
  // the card: edit, a referral code, then delete
  const card = await (await go(`/atelier/clients/${lea.id}`)).text();
  assert.match(card, /Et pour ma deuxième voiture/);
  await go('/atelier/clients', { method: 'POST', form: { id: String(lea.id), firstName: 'Léa', lastName: 'Petit', email: 'lea@example.com', phone: '06 11 11 11 11', vehicles: 'Peugeot 208', plate: 'ab-123-cd', source: 'Bouche-à-oreille', notes: 'Teinte 20 % à l’arrière' } });
  const coded = await go(`/atelier/clients/${lea.id}/code`, { method: 'POST' });
  assert.match(where(coded).searchParams.get('ok'), /LEA-[A-HJ-NP-Z2-9]{5}/);
  const res = await go('/atelier/clients.csv');
  // the UTF-8 mark first, so that Excel reads the accents
  assert.deepEqual([...new Uint8Array(await res.clone().arrayBuffer()).slice(0, 3)], [0xef, 0xbb, 0xbf]);
  const csv = await res.text();
  assert.ok(csv.startsWith('Prénom;Nom;E-mail;Téléphone'));
  assert.match(csv, /Léa;Petit;lea@example\.com;06 11 11 11 11;Peugeot 208;AB-123-CD;Bouche-à-oreille;0;0;2;LEA-[A-Z0-9]{5};demande de devis/);
  assert.match(csv, /Camille;Roux;camille@example\.com;06 22 33 44 55;Audi A3;;;1;104,85;0;/);
  // a cell that would be read as a formula is neutralised
  await go('/atelier/clients', { method: 'POST', form: { firstName: '=HYPERLINK("x")', lastName: 'Test' } });
  assert.match(await (await go('/atelier/clients.csv')).text(), /"'=HYPERLINK\(""x""\)";Test/);
  const notConfirmed = await go(`/atelier/clients/${lea.id}/supprimer`, { method: 'POST', form: {} });
  assert.ok(where(notConfirmed).searchParams.get('err'));
  await go(`/atelier/clients/${lea.id}/supprimer`, { method: 'POST', form: { confirme: '1' } });
  assert.equal((await db(env, 'clients/list', { q: 'petit' })).clients.length, 0);
});

test('appointments, the band, the purge after 3 years', async () => {
  const rdv = await (await go('/atelier/rdv')).text();
  assert.match(rdv, /Camille Roux/);
  assert.match(rdv, /TEST15/);
  // a band made from the space: on from today (it passes in front of a planned one), then paused
  await go('/atelier/codes', { method: 'POST', form: { action: 'banner-save', theme: 'neon', title: 'Essai', text: 'Offre essai −10 %', cta: 'J’en profite', code: 'TEST15', starts: today, ends: addDays(today, 3), active: '1' } });
  const band = (await (await site('/api/promo')).json()).banner;
  assert.deepEqual([band.theme, band.title, band.text, band.cta, band.code], ['neon', 'Essai', 'Offre essai −10 %', 'J’en profite', 'TEST15']);
  const mine = (await db(env, 'banners/list')).banners.find((x) => x.text === 'Offre essai −10 %');
  await go('/atelier/codes', { method: 'POST', form: { action: 'banner-active', id: mine.id, active: '' } });
  assert.notEqual((await (await site('/api/promo')).json()).banner?.text, 'Offre essai −10 %');
  // previewed from the space whatever its state
  assert.equal((await (await site(`/api/promo?apercu=${mine.id}`)).json()).banner.text, 'Offre essai −10 %');
  await go('/atelier/codes', { method: 'POST', form: { action: 'banner-delete', id: mine.id } });
  assert.equal((await db(env, 'banners/list')).banners.some((x) => x.id === mine.id), false);
  const page = await (await go('/atelier/codes')).text();
  assert.match(page, /Codes promo/);
  assert.match(page, /NOEL/);
  // statistics: behind the same sign-in
  assert.equal(where(await go('/atelier/stats')).href, `${SELF}/stats?cle=cle-stats`);
  // clients without contact for 3 years go
  const r = await db(env, 'clients/purge', { now: Date.now() + 4 * 365 * DAY });
  assert.ok(r.removed >= 2);
  assert.equal((await db(env, 'clients/list', {})).total, 0);
});

test('the countdown of a code: days left, then hours, minutes and seconds on the last day', () => {
  const nb = (t) => t.replace(/\u00a0/g, ' ');
  const end = Date.parse('2026-12-24T23:00:00Z'); // 25 December 0:00 in Paris
  const paris = (d, t) => zonedToUtc(d, t, TZ);
  assert.equal(nb(deadlineNb(end)), '24 décembre à 23 h 59');
  assert.equal(nb(deadlineNb(Date.parse('2026-11-19T23:00:00Z'))), '19 novembre à 23 h 59');
  assert.equal(nb(leftNb(end - paris('2026-12-01', '09:00'))), 'Plus que 24 jours');
  assert.equal(nb(leftNb(end - paris('2026-12-18', '00:00'))), 'Plus que 7 jours');
  assert.equal(nb(leftNb(end - paris('2026-12-18', '23:59'))), 'Plus que 7 jours');
  assert.equal(nb(leftNb(end - paris('2026-12-23', '10:00'))), 'Plus que 2 jours');
  assert.equal(nb(leftNb(end - paris('2026-12-24', '21:11') - 48000)), 'Dernier jour : plus que 2 h 48 min 12 s');
  assert.equal(nb(leftNb(end - paris('2026-12-24', '23:12'))), 'Dernier jour : plus que 48 min 00 s');
  assert.equal(nb(leftNb(9000)), 'Dernier jour : plus que 9 s');
  assert.equal(leftNb(0), '');
});

test('the online agenda reaches about six months ahead; refund if cancelled 72 h before', async () => {
  const cfg = encodeURIComponent(JSON.stringify({ tint: { vehicle: 'berline', formula: 'rear' } }));
  const slots = async (from) => (await (await site(`/api/slots?config=${cfg}&from=${from}&days=14`)).json()).slots;
  assert.ok((await slots(addDays(today, 170))).length > 0);
  assert.equal((await slots(addDays(today, 190))).length, 0);
  assert.equal(R.cancelHours, 72);
});
