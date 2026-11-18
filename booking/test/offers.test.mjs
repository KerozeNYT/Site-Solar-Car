// The gift card and SOLAR CAR Premium (content/offers.js, docs/CARTES.md): bought on the site
// (Stripe), e-mailed, spent online (alone or with a payment) or at the workshop; the members'
// card, its −10 %, its levels (one a service) and gifts, the offers kept for them, the workshop's
// page « Cartes & Premium ».
import test from 'node:test';
import assert from 'node:assert/strict';
import { generateKeyPairSync, createHmac } from 'node:crypto';
import worker, { morningMails, giftDue, countLevels } from '../worker.js';
import { Atelier, monthsAfter } from '../store.js';
import { utcToZoned, addDays } from '../schedule.js';
import { quote } from '../../content/booking.js';
import { premium as P, tierOf, nextTier, giftAmount, isGiftCode, isPremiumCode } from '../../content/offers.js';
import { installFakes } from './fakes.mjs';
import { fakeDO } from './fake-do.mjs';
import { fakeStats } from './fake-stats.mjs';

const TZ = 'Europe/Paris';
const ORIGIN = 'https://www.solarcar37.fr';
const SELF = 'https://atelier.solarcar37.fr';
const CAR = 'contact.solarcar37@gmail.com';
const HOME = 'contact.solarhome37@gmail.com';
const PERSO = 'perso@group.calendar.google.com';
const WHSEC = 'whsec_test';
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
  NOTIFY_TO: CAR,
  MAIL_FROM: 'SOLAR CAR 37 <reservation@solarcar37.fr>',
  MAIL_CLIENTS: '1',
  SITE_URL: ORIGIN,
  ATELIER_SECRET: 'secret-de-test',
  STATS: fakeStats(),
  ATELIER: fakeDO(Atelier, () => env),
};
const { cal, sessions, mails } = installFakes({ CAR, HOME, PERSO });
const sql = (q, ...b) => env.ATELIER.db.prepare(q).all(...b);
const call = (path, { method = 'GET', body } = {}) => worker.fetch(new Request(`https://reservation.solarcar37.fr${path}`, { method, body: body && JSON.stringify(body), headers: { origin: ORIGIN, 'content-type': 'application/json' } }), env);
const hook = (event) => {
  const payload = JSON.stringify(event);
  const t = Math.floor(Date.now() / 1000);
  const v1 = createHmac('sha256', WHSEC).update(`${t}.${payload}`).digest('hex');
  return worker.fetch(new Request('https://reservation.solarcar37.fr/api/stripe-webhook', { method: 'POST', body: payload, headers: { 'stripe-signature': `t=${t},v1=${v1}` } }), env);
};
/** the last payment page opened, paid (Stripe's notice) */
const pay = async (s = [...sessions.values()].at(-1)) => {
  s.payment_status = 'paid';
  s.status = 'complete';
  const r = await hook({ type: 'checkout.session.completed', data: { object: s } });
  assert.equal(r.status, 200);
  return s;
};
const today = utcToZoned(Date.now(), TZ).date;
let day = utcToZoned(Date.now() + 21 * DAY, TZ).date;
while (new Date(day + 'T12:00:00Z').getUTCDay() !== 3) day = addDays(day, 1);
const rear = { tint: { vehicle: 'berline', formula: 'rear' } }; // 270 €
const buyer = { firstName: 'Marc', lastName: 'Lefèvre', email: 'marc@example.com', phone: '06 12 34 56 78' };
const order = (extra = {}) => ({ amount: 100, look: 'noel', to: { name: 'Léa', email: '' }, from: buyer, sender: 'Marc et Julie', message: 'Joyeux Noël ma Léa !', delivery: 'moi', consent: { terms: true }, back: `${ORIGIN}/carte-cadeau/`, ...extra });

test('the offers module: amounts, levels one a service, codes', () => {
  assert.equal(giftAmount('75,50'), 75.5);
  assert.equal(giftAmount(10), null);
  assert.equal(giftAmount(2000), null);
  assert.deepEqual(P.tiers.map((t) => t.visits), [0, 1, 2, 3, 4, 5, 6, 7]);
  assert.equal(tierOf(0).id, 'membre');
  assert.equal(tierOf(3).id, 'nitro');
  assert.equal(tierOf(9).id, 'infini');
  assert.equal(nextTier(1).id, 'turbo');
  assert.equal(nextTier(5).id, 'mythique');
  assert.equal(nextTier(7), null);
  assert.equal(P.countFrom, 80);
  assert.ok(isGiftCode('CADEAU-7K2Q-X9M4') && !isGiftCode('NOEL'));
  assert.ok(isPremiumCode('PREMIUM-7K2Q-X9M4'));
  // a year later, the same day (29 February → 28 February)
  const end = utcToZoned(monthsAfter(Date.parse('2028-02-29T10:00:00Z'), 12), TZ);
  assert.equal(end.date, '2029-02-28');
  assert.equal(giftDue(quote(rear), 'deposit', { amount: 100 }), 0);
  assert.equal(giftDue(quote(rear), 'full', { amount: 100 }), 170);
  assert.equal(giftDue(quote(rear), 'deposit', { amount: 80.7 }), 0); // 0,30 € left: settled at the workshop
});

let card;
test('a gift card bought: checked, paid on Stripe, written once, e-mailed, shown', async () => {
  const bad = await call('/api/cadeau/checkout', { method: 'POST', body: order({ amount: 5 }) });
  assert.equal(bad.status, 400);
  assert.equal((await bad.json()).field, 'amount');
  const noMail = await call('/api/cadeau/checkout', { method: 'POST', body: order({ delivery: 'destinataire' }) });
  assert.equal((await noMail.json()).field, 'toEmail');
  const r = await call('/api/cadeau/checkout', { method: 'POST', body: order() });
  assert.equal(r.status, 200, await r.clone().text());
  const s = [...sessions.values()].at(-1);
  assert.equal(s.amount_total, 10000);
  assert.equal(s.success_url, `${ORIGIN}/carte-cadeau/merci/?session={CHECKOUT_SESSION_ID}`);
  assert.equal(s.metadata.kind, 'cadeau');
  // not paid yet: no card
  assert.equal((await (await call(`/api/cadeau?session=${s.id}`)).json()).paid, false);
  mails.length = 0;
  await pay(s);
  await pay(s); // Stripe may notify twice
  assert.equal(sql('SELECT COUNT(*) AS n FROM gifts')[0].n, 1);
  const got = await (await call(`/api/cadeau?session=${s.id}`)).json();
  assert.equal(got.ok && got.paid, true);
  card = got.card;
  assert.match(card.code, /^CADEAU-[A-Z0-9]{4}-[A-Z0-9]{4}$/);
  assert.deepEqual([card.amount, card.balance, card.look, card.toName, card.sender, card.status], [100, 100, 'noel', 'Léa', 'Marc et Julie', 'active']);
  assert.match(card.viewUrl, new RegExp(`/carte-cadeau/voir/\\?c=${card.code}&t=[0-9a-f]{24}$`));
  // valid a year
  assert.ok(Math.abs(card.expires - Date.now() - 365 * DAY) < 2 * DAY);
  // the buyer's e-mail: the card, its code, the message, the link to see it in 3D
  const m = mails.find((x) => x.to[0] === 'marc@example.com');
  assert.match(m.subject, /carte cadeau SOLAR CAR 37 de 100 €/);
  assert.match(m.html, new RegExp(card.code));
  assert.match(m.html, /Joyeux Noël ma Léa/);
  assert.match(m.html, /cadeau-noel\.jpg/);
  assert.equal(mails.filter((x) => x.to[0] === 'marc@example.com').length, 1);
  // its own page, with its key only
  const view = await (await call(`/api/cadeau?c=${card.code}&t=${card.token}`)).json();
  assert.equal(view.card.balance, 100);
  assert.equal((await call(`/api/cadeau?c=${card.code}&t=0000`)).status, 404);
  // the booking page's code field knows it
  const check = await (await call(`/api/code?code=${card.code.toLowerCase()}`)).json();
  assert.deepEqual([check.ok, check.kind, check.balance], [true, 'cadeau', 100]);
});

test('a gift card sent on a chosen day: the morning job e-mails its recipient, then tells the buyer', async () => {
  const later = addDays(today, 3);
  await call('/api/cadeau/checkout', { method: 'POST', body: order({ amount: 50, look: 'or', delivery: 'destinataire', to: { name: 'Paul', email: 'paul@example.com' }, sendOn: later }) });
  mails.length = 0;
  const s = await pay();
  assert.ok(!mails.some((x) => x.to[0] === 'paul@example.com'));
  assert.match(mails.find((x) => x.to[0] === 'marc@example.com').html, /partira par e-mail à <b>Paul<\/b>/);
  // not yet
  assert.equal((await morningMails(env, Date.now())).gifts, 0);
  const then = Date.parse(`${later}T06:00:00Z`);
  const r = await morningMails(env, then);
  assert.equal(r.gifts, 1);
  const sent = mails.find((x) => x.to[0] === 'paul@example.com');
  assert.match(sent.subject, /Marc et Julie vous offre une carte cadeau/);
  assert.match(sent.html, /reservation\/\?cadeau=CADEAU-/);
  assert.match(mails.at(-1).subject, /bien arrivée chez Paul/);
  // once
  assert.equal((await morningMails(env, then + 3600000)).gifts, 0);
  const g = (await (await call(`/api/cadeau?session=${s.id}`)).json()).card;
  assert.equal(g.sent, true);
  assert.equal(g.toEmail, 'p***@example.com');
});

test('booking with a gift card that covers the deposit: confirmed at once, no payment page', async () => {
  mails.length = 0;
  const n = sessions.size;
  const customer = { firstName: 'Léa', lastName: 'Martin', email: 'lea@example.com', phone: '06 99 88 77 66', vehicle: 'Peugeot 508' };
  const r = await call('/api/checkout', { method: 'POST', body: { config: rear, date: day, time: '10:00', mode: 'deposit', customer, gift: card.code, consent: { terms: true }, back: `${ORIGIN}/reservation/` } });
  assert.equal(r.status, 200, await r.clone().text());
  const j = await r.json();
  assert.equal(sessions.size, n); // no Stripe page
  assert.match(j.url, new RegExp(`^${ORIGIN}/reservation/confirmee/\\?session=cadeau-[0-9a-f]{24}$`));
  const id = new URL(j.url).searchParams.get('session');
  // the card spent on the total (100 € of 270 €), not only on the deposit
  assert.equal((await (await call(`/api/code?code=${card.code}`)).json()).ok, false);
  const ev = cal[CAR].find((e) => e.extendedProperties?.private?.session === id);
  assert.equal(ev.extendedProperties.private.solarcarHold, '0');
  assert.match(ev.description, new RegExp(`Carte cadeau ${card.code} : 100 €`));
  assert.match(ev.description, /reste à régler : 170 €/);
  const done = await (await call(`/api/booking?session=${id}`)).json();
  assert.deepEqual([done.paid, done.amount, done.total, done.remaining, done.gift.amount], [true, 0, 270, 170, 100]);
  const client = mails.find((x) => x.to[0] === 'lea@example.com');
  assert.match(client.html, /Carte cadeau<\/td><td[^>]*>100 €/);
  assert.doesNotMatch(client.html, /Payé en ligne/);
  assert.match(mails.find((x) => /Nouveau RDV/.test(x.subject)).html, /carte cadeau/);
  assert.equal(sql('SELECT gift, gift_amount, paid FROM bookings WHERE session = ?', id)[0].gift_amount, 100);
});

test('booking with a gift card and the rest on Stripe: the card set aside while paying, spent once paid, back if the payment fails', async () => {
  // a new 60 € card
  await call('/api/cadeau/checkout', { method: 'POST', body: order({ amount: 60 }) });
  const bought = await pay();
  const c60 = (await (await call(`/api/cadeau?session=${bought.id}`)).json()).card;
  const customer = { firstName: 'Hugo', lastName: 'Petit', email: 'hugo@example.com', phone: '06 11 11 11 11', vehicle: 'Audi A4' };
  const body = { config: rear, date: day, time: '13:00', mode: 'full', customer, gift: c60.code, consent: { terms: true }, back: `${ORIGIN}/reservation/` };
  const r = await call('/api/checkout', { method: 'POST', body });
  assert.equal(r.status, 200, await r.clone().text());
  const s = [...sessions.values()].at(-1);
  assert.equal(s.amount_total, 21000); // 270 − 60
  assert.deepEqual([s.metadata.gift, s.metadata.giftAmount], [c60.code, '60']);
  // set aside: nothing left for another payment meanwhile
  const check = await (await call(`/api/code?code=${c60.code}`)).json();
  assert.match(check.error, /paiement en cours/);
  // the payment fails: the card is whole again
  await hook({ type: 'checkout.session.expired', data: { object: s } });
  assert.equal((await (await call(`/api/code?code=${c60.code}`)).json()).balance, 60);
  // again, and paid
  await call('/api/checkout', { method: 'POST', body });
  mails.length = 0;
  const s2 = await pay();
  await pay(s2);
  const g = sql('SELECT balance, uses FROM gifts WHERE code = ?', c60.code)[0];
  assert.equal(g.balance, 0);
  assert.equal(JSON.parse(g.uses).length, 1);
  const done = await (await call(`/api/booking?session=${s2.id}`)).json();
  assert.deepEqual([done.amount, done.gift.amount, done.remaining], [210, 60, 0]);
  const client = mails.find((x) => x.to[0] === 'hugo@example.com');
  assert.match(client.html, /Payé en ligne<\/td><td[^>]*>210 €/);
  assert.match(client.html, /À régler à l’atelier<\/td><td[^>]*>rien/);
});

let member;
test('SOLAR CAR Premium: joined on the site, welcomed, the card shown; its number gives −10 % to its holder only', async () => {
  const bad = await call('/api/premium/checkout', { method: 'POST', body: { customer: { firstName: 'Zoé' }, consent: { terms: true }, back: `${ORIGIN}/premium/` } });
  assert.equal(bad.status, 400);
  const r = await call('/api/premium/checkout', { method: 'POST', body: { customer: { firstName: 'Zoé', lastName: 'Bernard', email: 'Zoe@Example.com', phone: '06 55 44 33 22' }, news: true, consent: { terms: true }, back: `${ORIGIN}/premium/` } });
  assert.equal(r.status, 200, await r.clone().text());
  const s = [...sessions.values()].at(-1);
  assert.equal(s.amount_total, 1999);
  assert.equal(s.success_url, `${ORIGIN}/premium/bienvenue/?session={CHECKOUT_SESSION_ID}`);
  mails.length = 0;
  await pay(s);
  await pay(s);
  assert.equal(sql('SELECT COUNT(*) AS n FROM members')[0].n, 1);
  const got = await (await call(`/api/premium?session=${s.id}`)).json();
  member = got.member;
  assert.match(member.number, /^PREMIUM-[A-Z0-9]{4}-[A-Z0-9]{4}$/);
  assert.deepEqual([member.firstName, member.active, member.percent, member.visits, member.tier.id, member.next.id], ['Zoé', true, 10, 0, 'membre', 'ignition']);
  assert.match(member.referral.code, /^ZOE-/);
  assert.match(member.cardUrl, /\/premium\/carte\/\?n=PREMIUM-/);
  const welcome = mails.find((x) => x.to[0] === 'zoe@example.com');
  assert.match(welcome.subject, /Bienvenue dans SOLAR CAR Premium, Zoé/);
  assert.match(welcome.html, new RegExp(member.number));
  assert.match(welcome.html, new RegExp(member.referral.code));
  assert.match(welcome.html, /ne plus les recevoir/);
  // the code field
  const check = await (await call(`/api/code?code=${member.number}`)).json();
  assert.deepEqual([check.kind, check.percent, check.owner, check.members], ['premium', 10, 'Zoé', true]);
  // someone else's e-mail: refused
  const other = { firstName: 'Max', lastName: 'Roy', email: 'max@example.com', phone: '06 00 00 00 01', vehicle: 'Clio' };
  const no = await call('/api/checkout', { method: 'POST', body: { config: rear, date: day, time: '15:00', mode: 'deposit', customer: other, code: member.number, consent: { terms: true }, back: `${ORIGIN}/reservation/` } });
  assert.equal(no.status, 400);
  assert.match((await no.json()).error, /à votre nom/);
  // hers: 270 − 10 % = 243, deposit 72,90 €
  const zoe = { firstName: 'Zoé', lastName: 'Bernard', email: 'zoe@example.com', phone: '06 55 44 33 22', vehicle: 'BMW Série 3' };
  const yes = await call('/api/checkout', { method: 'POST', body: { config: rear, date: day, time: '15:00', mode: 'deposit', customer: zoe, code: member.number, consent: { terms: true }, back: `${ORIGIN}/reservation/` } });
  assert.equal(yes.status, 200, await yes.clone().text());
  const sb = [...sessions.values()].at(-1);
  assert.equal(sb.amount_total, 7290);
  mails.length = 0;
  await pay(sb);
  // booked, not counted yet: a service counts on the day of its appointment
  const booked = (await (await call(`/api/premium?n=${member.number}&t=${member.token}`)).json()).member;
  assert.deepEqual([booked.visits, booked.next.id, booked.gifts.length], [0, 'ignition', 0]);
  // its day: still in the calendar, 243 € ≥ 80 €: her first service as a member, level Ignition,
  // its gift waiting at the workshop
  const counted = await morningMails(env, Date.parse(`${day}T06:00:00Z`));
  assert.deepEqual([counted.levels.counted, counted.levels.levels], [1, 1]);
  const after = (await (await call(`/api/premium?n=${member.number}&t=${member.token}`)).json()).member;
  assert.deepEqual([after.visits, after.tier.id, after.next.id], [1, 'ignition', 'turbo']);
  assert.equal(after.gifts[0].tier, 'ignition');
  assert.equal(after.gifts[0].given, 0);
  assert.equal(after.bookings.length, 1);
  assert.deepEqual([after.bookings[0].upcoming, after.bookings[0].total], [true, 243]);
  assert.ok(mails.some((x) => x.to[0] === 'zoe@example.com' && /Niveau Ignition débloqué/.test(x.subject)));
  const ev = cal[CAR].find((e) => e.extendedProperties?.private?.session === sb.id);
  assert.match(ev.description, new RegExp(`Carte Premium ${member.number} : −27 €`));
  assert.match(mails.find((x) => /Nouveau RDV/.test(x.subject)).html, /membre Premium/);
  // the Premium card is never « used up »
  assert.equal((await (await call(`/api/code?code=${member.number}`)).json()).ok, true);
});

test('Premium renewed with the same e-mail: the same card, a year more, the level kept', async () => {
  const before = sql('SELECT expires FROM members WHERE number = ?', member.number)[0].expires;
  await call('/api/premium/checkout', { method: 'POST', body: { customer: { firstName: 'Zoé', lastName: 'Bernard', email: 'zoe@example.com' }, consent: { terms: true }, back: `${ORIGIN}/premium/` } });
  mails.length = 0;
  const s = await pay();
  const m = sql('SELECT * FROM members')[0];
  assert.equal(sql('SELECT COUNT(*) AS n FROM members')[0].n, 1);
  assert.equal(m.number, member.number);
  assert.ok(m.expires - before > 360 * DAY);
  assert.match(mails.find((x) => x.to[0] === 'zoe@example.com').subject, /renouvelée/);
  assert.equal((await (await call(`/api/premium?session=${s.id}`)).json()).member.tier.id, 'ignition');
});

test('a promotion kept for the members; « Retrouver ma carte »; the offers turned off from the e-mail', async () => {
  await env.ATELIER.get().fetch(new Request('https://atelier/promo/save', { method: 'POST', body: JSON.stringify({ code: 'VIP20', label: 'Membres', percent: 20, starts: today, ends: addDays(today, 10), members: true }) }));
  const check = await (await call('/api/code?code=VIP20')).json();
  assert.equal(check.members, true);
  const other = { firstName: 'Max', lastName: 'Roy', email: 'max@example.com', phone: '06 00 00 00 01', vehicle: 'Clio' };
  const no = await call('/api/checkout', { method: 'POST', body: { config: rear, date: day, time: '08:00', mode: 'deposit', customer: other, code: 'VIP20', consent: { terms: true }, back: `${ORIGIN}/reservation/` } });
  assert.match((await no.json()).error, /réservé aux membres/);
  // shown in the member's space
  const m = (await (await call(`/api/premium?n=${member.number}&t=${member.token}`)).json()).member;
  assert.deepEqual(m.offers.map((o) => o.code), ['VIP20']);
  // the link e-mailed to a member only, the same answer for anyone; once every 10 minutes
  mails.length = 0;
  assert.equal((await (await call('/api/premium/lien', { method: 'POST', body: { email: 'nobody@example.com' } })).json()).ok, true);
  assert.equal((await (await call('/api/premium/lien', { method: 'POST', body: { email: 'ZOE@example.com' } })).json()).ok, true);
  await call('/api/premium/lien', { method: 'POST', body: { email: 'zoe@example.com' } });
  assert.equal(mails.length, 1);
  assert.match(mails[0].html, /premium\/carte\/\?n=PREMIUM-/);
  // the offers off, from the e-mail's link
  const off = await call(`/api/premium/offres?n=${member.number}&t=${member.token}&off=1`);
  assert.match(await off.text(), /Désinscription faite/);
  assert.equal(sql('SELECT news FROM members')[0].news, 0);
  const wrong = await call(`/api/premium/offres?n=${member.number}&t=nope&off=1`);
  assert.equal(wrong.status, 400);
  await call(`/api/premium/offres?n=${member.number}&t=${member.token}&on=1`);
  assert.equal(sql('SELECT news FROM members')[0].news, 1);
});

test('the reminder a fortnight before the end, once', async () => {
  const m = sql('SELECT * FROM members')[0];
  mails.length = 0;
  const near = m.expires - 10 * DAY;
  assert.equal((await morningMails(env, near)).reminders, 1);
  assert.match(mails.find((x) => x.to[0] === 'zoe@example.com').subject, /se termine le/);
  assert.equal((await morningMails(env, near + DAY)).reminders, 0);
});

// ---------------------------------------------------------------- the workshop's space
let cookie = '';
const go = (path, { method = 'GET', form } = {}) => worker.fetch(new Request(`${SELF}${path}`, { method, body: form ? new URLSearchParams(form) : undefined, redirect: 'manual', headers: { origin: method === 'GET' ? undefined : SELF, cookie } }), env);
const where = (res) => new URL(res.headers.get('location'), SELF);

test('the workshop: « Cartes & Premium », a gift handed over, a member added at the counter, a card made, debited, an offer to the members', async () => {
  await go('/atelier/connexion/code', { method: 'POST' });
  const code = mails.at(-1).subject.match(/(\d{6})$/)[1];
  cookie = (await go('/atelier/connexion', { method: 'POST', form: { code } })).headers.get('set-cookie').split(';')[0];
  let html = await (await go('/atelier/premium')).text();
  assert.match(html, /Cartes &amp; <em>Premium<\/em>/);
  assert.match(html, /Cadeaux à remettre/);
  assert.match(html, /Zoé Bernard<\/a> · <span class="lvl"/);
  assert.match(html, /class="lvl" style="--c:#ff8a3d">Ignition/);
  // the gift handed over
  let r = await go('/atelier/premium', { method: 'POST', form: { action: 'gift-given', number: member.number, tier: 'ignition' } });
  assert.match(where(r).searchParams.get('ok'), /remis/);
  assert.ok(JSON.parse(sql('SELECT gifts FROM members')[0].gifts)[0].given > 0);
  // the client's card: the badge, the level
  const clientId = sql('SELECT client_id FROM members')[0].client_id;
  html = await (await go(`/atelier/clients/${clientId}`)).text();
  assert.match(html, /tag--premium/);
  assert.match(html, /SOLAR CAR Premium/);
  // a member at the counter
  mails.length = 0;
  r = await go('/atelier/premium', { method: 'POST', form: { action: 'member-add', firstName: 'Kevin', lastName: 'Morel', email: 'kevin@example.com', phone: '06 10 20 30 40', amount: '19,99', welcome: '1' } });
  assert.match(where(r).searchParams.get('ok'), /Carte Premium créée : PREMIUM-.* e-mail de bienvenue envoyé/);
  assert.ok(mails.some((x) => x.to[0] === 'kevin@example.com'));
  // the clients list shows the badge
  assert.match(await (await go('/atelier/clients?q=kevin')).text(), /tag--premium/);
  // a gift card sold at the counter, e-mailed to the recipient
  mails.length = 0;
  r = await go('/atelier/premium', { method: 'POST', form: { action: 'gift-create', amount: '80', paid: '80', look: 'carbone', toName: 'Nina', sender: 'Tonton', buyerFirst: 'Luc', buyerEmail: 'luc@example.com', toEmail: 'nina@example.com', note: 'espèces' } });
  const made = where(r).searchParams.get('ok');
  assert.match(made, /Carte CADEAU-.* créée \(80\s€\), envoyée à nina@example.com et luc@example.com/);
  const c80 = made.match(/CADEAU-[A-Z0-9-]{9}/)[0];
  // debited for a service on quote
  r = await go('/atelier/premium', { method: 'POST', form: { action: 'gift-debit', code: c80, amount: '30', note: 'Rénovation de phares' } });
  assert.match(where(r).searchParams.get('ok'), /30\s€ débités .* il reste 50\s€/);
  // an offer to the members: a preview first, then sent (one e-mail each, their own link)
  mails.length = 0;
  r = await go('/atelier/premium', { method: 'POST', form: { action: 'offer-send', subject: 'Avant-première membres', title: 'Rien que pour vous', text: 'Le ciel étoilé à −20 %.', code: 'VIP20', envoi: 'apercu' } });
  assert.match(where(r).searchParams.get('ok'), /Aperçu envoyé/);
  assert.equal(mails.length, 1);
  assert.match(mails[0].subject, /^\[Aperçu\]/);
  r = await go('/atelier/premium', { method: 'POST', form: { action: 'offer-send', subject: 'Avant-première membres', text: 'Le ciel étoilé à −20 %.', code: 'VIP20', envoi: 'membres' } });
  assert.match(where(r).searchParams.get('err'), /Cochez/);
  mails.length = 0;
  r = await go('/atelier/premium', { method: 'POST', form: { action: 'offer-send', subject: 'Avant-première membres', text: 'Le ciel étoilé à −20 %.', code: 'VIP20', envoi: 'membres', confirme: '1' } });
  assert.match(where(r).searchParams.get('ok'), /Offre envoyée à 2 membres/);
  assert.deepEqual(mails.map((m) => m.to[0]).sort(), ['kevin@example.com', 'zoe@example.com']);
  assert.match(mails[0].html, /VIP20/);
  assert.match(mails[0].headers['List-Unsubscribe'], /api\/premium\/offres\?n=PREMIUM-/);
  // the promotion form offers « réservé aux membres »
  assert.match(await (await go('/atelier/codes')).text(), /Réservé aux membres SOLAR CAR Premium/);
});

test('the workshop: a member booked at the counter gets −10 % by itself; an appointment settled with a gift card', async () => {
  const form = { prenom: 'Kevin', nom: 'Morel', tel: '06 10 20 30 40', email: 'kevin@example.com', vehicule: 'Golf', vt_vehicule: 'berline', vt_formule: 'rear', date: day, heure: '15:00', mode: 'none', canal: 'atelier', force: '1' };
  const price = await (await go('/atelier/rdv/prix', { method: 'POST', form })).json();
  assert.match(price.html, /Membre Premium \(PREMIUM-/);
  assert.match(price.html, /243\s€/);
  const r = await go('/atelier/rdv/nouveau', { method: 'POST', form });
  assert.equal(r.status, 303, await r.clone().text());
  const bk = sql("SELECT * FROM bookings WHERE session LIKE 'atelier-%' ORDER BY created DESC LIMIT 1")[0];
  assert.deepEqual([bk.total, bk.code_kind, bk.member !== ''], [243, 'premium', true]);
  // the appointment's page: the badge, his first level's gift, a gift card to settle with
  let html = await (await go(`/atelier/rdv/r/${bk.session}`)).text();
  assert.match(html, /tag--premium/);
  // his first service as a member, on its day: the gift to have ready
  assert.match(html, /Cadeau à prévoir pour ce RDV · <span class="lvl" style="--c:#ff8a3d">Ignition/);
  assert.match(html, /Régler avec une carte cadeau/);
  const g = sql("SELECT code FROM gifts WHERE balance > 0 AND to_name = 'Nina'")[0];
  const pay = await go(`/atelier/rdv/r/${bk.session}/cadeau`, { method: 'POST', form: { code: g.code } });
  assert.match(where(pay).searchParams.get('ok'), /50\s€ réglés avec la carte .* il reste 0\s€/);
  assert.equal(sql('SELECT paid FROM bookings WHERE session = ?', bk.session)[0].paid, 50);
  html = await (await go(`/atelier/rdv/r/${bk.session}`)).text();
  assert.match(html, /Reste à régler à l’atelier<\/span><b>193\s€/);
});

test('levels: a cancelled appointment, or one under 80 €, never counts; Infini adds a free year', async () => {
  const dbr = (path, body) => env.ATELIER.get().fetch(new Request(`https://atelier/${path}`, { method: 'POST', body: JSON.stringify(body) })).then((r) => r.json());
  const t0 = Date.now() - 200 * DAY;
  const joined = await dbr('member/join', { now: t0, ref: 'cs_test_lvl', amount: 19.99, firstName: 'Lou', lastName: 'Vidal', email: 'lou@example.com', source: 'atelier' });
  const number = joined.member.number;
  const before = joined.member.expires;
  const customer = { firstName: 'Lou', lastName: 'Vidal', email: 'lou@example.com' };
  const add = async (n, total, inCalendar) => {
    const date = utcToZoned(t0 + (n + 1) * 15 * DAY, TZ).date;
    await dbr('booking/add', { now: t0 + n * DAY, session: `lvl-${n}`, event: `lvl-ev-${n}`, date, time: '10:00', minutes: 120, items: [{ label: 'Prestation', price: total }], total, paid: total, mode: 'none', customer });
    if (inCalendar) cal[CAR].push({ id: `lvl-ev-${n}`, status: 'confirmed', summary: 'RDV', start: { dateTime: new Date(Date.parse(`${date}T09:00:00Z`)).toISOString() }, end: { dateTime: new Date(Date.parse(`${date}T11:00:00Z`)).toISOString() }, extendedProperties: { private: { solarcarHold: '0', session: `lvl-${n}` } } });
  };
  // 7 services, a cancelled one (gone from the calendar), a small one (50 €)
  for (let n = 0; n < 9; n++) await add(n, n === 2 ? 50 : 243, n !== 5);
  mails.length = 0;
  const r = await countLevels(env, Date.now());
  assert.deepEqual([r.counted, r.cancelled, r.levels], [7, 2, 7]);
  // once
  assert.deepEqual(await countLevels(env, Date.now()), { counted: 0, cancelled: 0, levels: 0 });
  const m = (await dbr('member/of', { email: 'lou@example.com' })).member;
  assert.deepEqual([m.visits, m.tier.id, m.next, m.pending.length], [7, 'infini', null, 7]);
  // the free year of Infini: a year after the end it had
  assert.ok(m.expires - before > 360 * DAY);
  assert.equal(sql('SELECT amount FROM member_payments WHERE ref = ?', `offert-${number}-infini`)[0].amount, 0);
  const last = mails.filter((x) => x.to[0] === 'lou@example.com').at(-1);
  assert.match(last.subject, /Niveau Infini débloqué/);
  assert.match(last.html, /année SOLAR CAR Premium suivante est offerte/);
  assert.deepEqual(sql("SELECT counted FROM bookings WHERE session IN ('lvl-2', 'lvl-5') ORDER BY session").map((x) => x.counted), [-1, -1]);
});
