// An appointment taken by the workshop on the phone (« Nouveau RDV » of the space): the price of
// what is ticked, the free slots, the payment link e-mailed with the slot held, then paid (the
// same path as an online booking) or cancelled; an appointment paid on the spot, written at once.
import test from 'node:test';
import assert from 'node:assert/strict';
import { generateKeyPairSync, createHmac } from 'node:crypto';
import worker from '../worker.js';
import { Atelier } from '../store.js';
import { zonedToUtc, addDays, utcToZoned } from '../schedule.js';
import { installFakes } from './fakes.mjs';
import { fakeDO } from './fake-do.mjs';
import { fakeStats } from './fake-stats.mjs';

const TZ = 'Europe/Paris';
const SELF = 'https://atelier.solarcar37.fr';
const CAR = 'contact.solarcar37@gmail.com';
const HOME = 'contact.solarhome37@gmail.com';
const PERSO = 'perso@group.calendar.google.com';
const WHSEC = 'whsec_test';
const { privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
const env = {
  ALLOWED_ORIGINS: 'https://www.solarcar37.fr',
  CALENDAR_WRITE: CAR,
  CALENDARS_BUSY: `${CAR},${HOME},${PERSO}`,
  GOOGLE_SERVICE_ACCOUNT: JSON.stringify({ client_email: 'booking@x.iam.gserviceaccount.com', private_key: privateKey.export({ type: 'pkcs8', format: 'pem' }), token_uri: 'https://oauth2.googleapis.com/token' }),
  STRIPE_SECRET_KEY: 'sk_test_x',
  STRIPE_WEBHOOK_SECRET: WHSEC,
  RESEND_API_KEY: 're_test',
  NOTIFY_TO: CAR,
  MAIL_FROM: 'SOLAR CAR 37 <reservation@solarcar37.fr>',
  MAIL_CLIENTS: '1',
  SITE_URL: 'https://www.solarcar37.fr',
  ATELIER_SECRET: 'secret-de-test',
  STATS: fakeStats(),
  ATELIER: fakeDO(Atelier, () => env),
};
const { cal, sessions, mails } = installFakes({ CAR, HOME, PERSO });
const sql = (q, ...b) => env.ATELIER.db.prepare(q).all(...b);

let cookie = '';
const go = (path, { method = 'GET', form } = {}) => worker.fetch(new Request(`${SELF}${path}`, { method, body: form ? new URLSearchParams(form) : undefined, redirect: 'manual', headers: { origin: method === 'GET' ? undefined : SELF, cookie } }), env);
const where = (res) => new URL(res.headers.get('location'), SELF);
const hook = (event) => {
  const payload = JSON.stringify(event);
  const t = Math.floor(Date.now() / 1000);
  const v1 = createHmac('sha256', WHSEC).update(`${t}.${payload}`).digest('hex');
  return worker.fetch(new Request(`${SELF}/api/stripe-webhook`, { method: 'POST', body: payload, headers: { 'stripe-signature': `t=${t},v1=${v1}` } }), env);
};
// a Thursday two weeks ahead; HOME busy 13:00-15:00 that day
let day = utcToZoned(Date.now() + 14 * 86400000, TZ).date;
while (new Date(`${day}T12:00:00Z`).getUTCDay() !== 4) day = addDays(day, 1);
cal[HOME].push({ id: 'h1', status: 'confirmed', start: { dateTime: new Date(zonedToUtc(day, '13:00', TZ)).toISOString() }, end: { dateTime: new Date(zonedToUtc(day, '15:00', TZ)).toISOString() } });

const form = (extra = {}) => ({
  prenom: 'Kevin',
  nom: 'Durand',
  tel: '06 77 88 99 00',
  email: 'kevin@example.com',
  vehicule: 'Audi A3 Sportback',
  annee: '2021',
  plaque: 'gh-123-jk',
  vt_vehicule: 'citadine',
  vt_formule: 'full',
  pb_film: '',
  feux: '',
  x_preset: 'phares',
  x_label: '',
  x_prix: '',
  x_min: '',
  date: day,
  heure: '08:00',
  mode: 'deposit',
  duree: '24',
  note: 'Merci pour votre appel !',
  ...extra,
});

test('signed in; the form, its price and the free slots of the day', async () => {
  await go('/atelier/connexion/code', { method: 'POST' });
  const code = mails.at(-1).subject.match(/(\d{6})$/)[1];
  cookie = (await go('/atelier/connexion', { method: 'POST', form: { code } })).headers.get('set-cookie').split(';')[0];
  const page = await (await go('/atelier/rdv/nouveau')).text();
  assert.match(page, /Nouveau <em>rendez-vous<\/em>/);
  assert.match(page, /Rénovation de phares/);
  // complete tint on a city car (270 €, one slot of 2 h) + headlights (79 €, 1 h 30): 349 €,
  // 3 h 30, deposit 104,70 €
  const price = await (await go('/atelier/rdv/prix', { method: 'POST', form: form() })).json();
  assert.equal(price.minutes, 210);
  assert.match(price.html, /349\s€/);
  assert.match(price.html, /104,70\s€/);
  // the word for the client, drafted from the form
  assert.match(price.draft, /^Bonjour Kevin,\n\nMerci pour votre appel ! Comme convenu, je vous réserve le jeudi \d+ \S+ à 8 h 00 pour votre Audi A3 Sportback \(2021\) : vitres teintées \(complet\) et rénovation de phares, soit 349\s€ au total\./);
  assert.match(price.draft, /régler l’acompte de 104,70\s€ avec le bouton ci-dessous ; le reste, 244,30\s€, se règle à l’atelier/);
  assert.match(price.draft, /La teinte se choisit ensemble à l’atelier[^]*À très vite,\nNicolas$/);
  // a month of free slots at once, as on the site
  const month = await (await go(`/atelier/creneaux?from=${utcToZoned(Date.now(), TZ).date}&days=30&minutes=210`)).json();
  assert.ok(month.days.length >= 15);
  assert.ok(month.days.find((x) => x.date === day).times.includes('08:00'));
  // 3 h 30: from 8:00, or 10:00 (over the lunch break); HOME busy 13-15 h shuts the afternoon
  const slots = await (await go(`/atelier/creneaux?date=${day}&minutes=210`)).json();
  assert.ok(slots.times.includes('08:00'));
  assert.ok(!slots.times.includes('13:00'));
  // a line on quote without its price: asked
  const unpriced = await (await go('/atelier/rdv/nouveau', { method: 'POST', form: form({ x_preset: 'ciel' }) })).text();
  assert.match(unpriced, /Tapez le prix convenu pour « Ciel étoilé »/);
  assert.match(unpriced, /value="Kevin"/);
});

test('a payment link: the slot held, the client e-mailed; paid: confirmed in the calendar, like an online booking', async () => {
  mails.length = 0;
  const res = await go('/atelier/rdv/nouveau', { method: 'POST', form: form() });
  assert.equal(res.status, 303);
  const to = where(res);
  assert.match(to.pathname, /^\/atelier\/rdv\/lien\/\d+$/);
  assert.match(to.searchParams.get('ok'), /Lien de paiement envoyé à kevin@example\.com/);
  const [link] = sql('SELECT * FROM links');
  assert.deepEqual([link.status, link.total, link.due, link.mode, link.date, link.time], ['attente', 349, 104.7, 'deposit', day, '08:00']);
  // Stripe: the deposit, the extra line in the metadata, a page open 24 h at most
  const s = sessions.get(link.session);
  assert.equal(s.amount_total, 10470);
  assert.equal(s.metadata.origin, 'atelier');
  assert.deepEqual(JSON.parse(s.metadata.extra), [{ kind: 'other', label: 'Rénovation de phares', price: 79, minutes: 90 }]);
  assert.ok(s.expires_at * 1000 - Date.now() <= 24 * 3600000);
  // the slot held in the calendar
  const hold = cal[CAR].find((e) => e.id === link.event);
  assert.match(hold.summary, /^⏳ Paiement en cours — Vitres teintées Complet \+ Rénovation de phares — Kevin Durand/);
  // the client's e-mail, with the button
  const m = mails.find((x) => x.to[0] === 'kevin@example.com');
  assert.match(m.subject, /confirmez-le en ligne/);
  assert.match(m.html, /Régler 104,70 € et confirmer/);
  assert.match(m.html, /Merci pour votre appel !/);
  assert.ok(m.html.includes(link.url));
  // the client is in the file already; the slot is no longer offered
  assert.equal(sql("SELECT plate FROM clients WHERE email = 'kevin@example.com'")[0].plate, 'GH-123-JK');
  assert.ok(!(await (await go(`/atelier/creneaux?date=${day}&minutes=60`)).json()).times.includes('08:00'));
  // the page of the link: copy, SMS, WhatsApp
  const page = await (await go(to.pathname)).text();
  assert.match(page, /En attente du paiement/);
  assert.match(page, /wa\.me\/33677889900/);
  assert.match(page, /sms:0677889900/);
  // paid
  mails.length = 0;
  Object.assign(s, { status: 'complete', payment_status: 'paid' });
  assert.equal((await hook({ type: 'checkout.session.completed', data: { object: s } })).status, 200);
  assert.equal(sql('SELECT status FROM links')[0].status, 'paye');
  assert.equal(hold.extendedProperties.private.solarcarHold, '0');
  assert.match(hold.summary, /^RDV Vitres teintées Complet \+ Rénovation de phares — Kevin Durand/);
  // taken on the phone (the default), said in the calendar and in the workshop's e-mail
  assert.match(hold.description, /Pris par téléphone le /);
  assert.match(mails.find((x) => /^Nouveau RDV/.test(x.subject)).html, /Nouveau rendez-vous pris par téléphone · acompte payé en ligne/);
  const [b] = sql('SELECT * FROM bookings');
  assert.deepEqual([b.total, b.paid], [349, 104.7]);
  assert.deepEqual(mails.map((x) => x.subject.split(' — ')[0]).sort(), ['Nouveau RDV', `Votre rendez-vous du ${new Intl.DateTimeFormat('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' }).format(new Date(`${day}T12:00:00Z`))} à 8 h 00 est confirmé`].sort());
  assert.match(await (await go(to.pathname)).text(), /Payé · confirmé/);
  assert.match(await (await go('/atelier/rdv')).text(), /Pris à l’atelier/);
});

test('an appointment changed at the workshop: services added, then the client told (an optional deposit for them, paid online), a preview for the workshop first; one taken off again', async () => {
  const [b] = sql("SELECT * FROM bookings WHERE session LIKE 'cs_%'");
  const href = `/atelier/rdv/r/${b.session}`;
  // reached from the list of the appointments
  assert.ok((await (await go('/atelier/rdv')).text()).includes(href));
  assert.match(await (await go(href)).text(), /Reste à régler à l’atelier<\/span><b>244,30\s€/);
  // the front blade in gloss black, 37,50 € − 20 % = 30 €, half an hour more in the calendar; nothing sent
  mails.length = 0;
  const end0 = Date.parse(cal[CAR].find((e) => e.id === b.event).end.dateTime);
  let res = await go(`${href}/ajout`, { method: 'POST', form: { label: 'Lame avant noir brillant', prix: '37,50', remise: '20', minutes: '30', allonger: '1' } });
  assert.match(where(res).searchParams.get('ok'), /^Prestation ajoutée : reste à régler à l’atelier 274,30\s€\.$/);
  // the reflectors and the brake light, 30 € net, no time
  res = await go(`${href}/ajout`, { method: 'POST', form: { label: 'Catadioptres + feu stop arrière', prix: '30' } });
  assert.match(where(res).searchParams.get('ok'), /reste à régler à l’atelier 304,30\s€/);
  assert.equal(mails.length, 0);
  const row = sql('SELECT total, paid, minutes FROM bookings WHERE session = ?', b.session)[0];
  assert.deepEqual([row.total, row.paid, row.minutes], [409, 104.7, 240]);
  const ev = cal[CAR].find((e) => e.id === b.event);
  assert.equal(Date.parse(ev.end.dateTime) - end0, 30 * 60000);
  assert.match(ev.description, /— Ajouts à l’atelier —\n• Lame avant noir brillant — 37,50\s€ − 20 % : 30 €\n• Catadioptres \+ feu stop arrière : 30 €\nNouveau total : 409 € — déjà réglé : 104,70 € — reste à régler : 304,30 €/);
  // « Prévenir le client »: 30 % of the services added offered as a deposit
  assert.match(await (await go(href)).text(), /name="montant" inputmode="decimal" value="18"/);
  // a preview first: to the workshop only, no payment page made
  const before = sessions.size;
  res = await go(`${href}/maj`, { method: 'POST', form: { acompte: '1', montant: '18', duree: '24', note: 'Bonjour Kevin, comme vu ensemble : la lame et les catadioptres.', envoi: 'apercu' } });
  assert.match(where(res).searchParams.get('ok'), /Aperçu envoyé à contact\.solarcar37@gmail\.com : rien n’est parti au client/);
  assert.deepEqual(mails.map((x) => x.to), [[CAR]]);
  assert.match(mails[0].subject, /^\[Aperçu\] Votre rendez-vous du/);
  assert.match(mails[0].html, /Bonjour Kevin, comme vu ensemble/);
  assert.match(mails[0].html, /Acompte demandé<\/td><td[^>]*>18 €[^]*286,30 € après l’acompte/);
  assert.equal(sessions.size, before);
  // then to the client, with the deposit to pay online
  mails.length = 0;
  res = await go(`${href}/maj`, { method: 'POST', form: { acompte: '1', montant: '18', duree: '24', note: 'Bonjour Kevin, comme vu ensemble : la lame et les catadioptres.', envoi: 'client' } });
  assert.match(where(res).searchParams.get('ok'), /Mise à jour envoyée au client, avec l’acompte de 18\s€ à régler en ligne/);
  const sup = [...sessions.values()].at(-1);
  assert.deepEqual([sup.amount_total, sup.metadata.kind, sup.metadata.booking], [1800, 'supplement', b.session]);
  assert.match(sup.success_url, /\/api\/paiement\/merci$/);
  const m = mails.find((x) => x.to[0] === 'kevin@example.com');
  assert.match(m.subject, /récapitulatif mis à jour/);
  assert.match(m.html, /Régler l’acompte de 18 €/);
  assert.ok(m.html.includes(sup.url));
  // without the deposit: the recap only
  mails.length = 0;
  await go(`${href}/maj`, { method: 'POST', form: { envoi: 'client' } });
  assert.doesNotMatch(mails[0].html, /Acompte demandé/);
  assert.match(mails[0].html, /À régler à l’atelier<\/td><td[^>]*>304,30 €/);
  // the deposit paid: added once to what is paid, the calendar follows; nothing booked twice
  Object.assign(sup, { status: 'complete', payment_status: 'paid' });
  await hook({ type: 'checkout.session.completed', data: { object: sup } });
  await hook({ type: 'checkout.session.completed', data: { object: sup } });
  assert.equal(sql('SELECT paid FROM bookings WHERE session = ?', b.session)[0].paid, 122.7);
  assert.match(cal[CAR].find((e) => e.id === b.event).description, /déjà réglé : 122,70 € — reste à régler : 286,30 €/);
  assert.match(await (await go(href)).text(), /Acomptes reçus depuis : 18\s€/);
  // the blade taken off again: the total and the calendar follow
  const items = JSON.parse(sql('SELECT items FROM bookings WHERE session = ?', b.session)[0].items);
  const blade = items.findIndex((i) => i.label === 'Lame avant noir brillant');
  res = await go(`${href}/retirer`, { method: 'POST', form: { ligne: String(blade) } });
  assert.match(where(res).searchParams.get('ok'), /Prestation retirée : reste à régler à l’atelier 256,30\s€/);
  assert.equal(Date.parse(cal[CAR].find((e) => e.id === b.event).end.dateTime), end0);
  assert.doesNotMatch(cal[CAR].find((e) => e.id === b.event).description, /Lame avant/);
  // a service booked online is never taken off from here
  assert.match(where(await go(`${href}/retirer`, { method: 'POST', form: { ligne: '0' } })).searchParams.get('err'), /Seules les prestations ajoutées/);
  // the thank-you page of the deposit
  assert.match(await (await worker.fetch(new Request(`${SELF}/api/paiement/merci`), env)).text(), /votre acompte est bien reçu/);
});

test('a discount given by hand (an exceptional case), in % or in €: on the price, the payment, the e-mail, the calendar', async () => {
  const f = form({ heure: '10:00', date: addDays(day, 7), email: 'nina@example.com', prenom: 'Nina', tel: '06 12 34 56 02', remise: '10', remise_type: 'percent' });
  // 349 € − 10 % = 314,10 €, deposit 94,23 €
  const price = await (await go('/atelier/rdv/prix', { method: 'POST', form: f })).json();
  assert.match(price.html, /Remise<\/span><b>−34,90\s€/);
  assert.match(price.html, /314,10\s€/);
  assert.match(price.draft, /soit 314,10\s€ au total \(remise de 34,90\s€ comprise\)/);
  mails.length = 0;
  const res = await go('/atelier/rdv/nouveau', { method: 'POST', form: f });
  const id = Number(where(res).pathname.split('/').pop());
  const link = sql('SELECT * FROM links WHERE id = ?', id)[0];
  assert.deepEqual([link.total, link.due], [314.1, 94.23]);
  const s = sessions.get(link.session);
  assert.equal(s.amount_total, 9423);
  assert.deepEqual([s.metadata.discount, s.metadata.remise, s.metadata.code], ['34.9', '34.9', undefined]);
  const m = mails.find((x) => x.to[0] === 'nina@example.com');
  assert.match(m.html, /Remise<\/td><td[^>]*>−34,90 €/);
  assert.doesNotMatch(m.html, /Parrainage/);
  assert.match(cal[CAR].find((e) => e.id === link.event).description, /Remise : −34,90 €\nTotal : 314,10 €/);
  // paid: the confirmation says « Remise » too
  mails.length = 0;
  Object.assign(s, { status: 'complete', payment_status: 'paid' });
  await hook({ type: 'checkout.session.completed', data: { object: s } });
  assert.match(mails.find((x) => x.to[0] === 'nina@example.com').html, /Remise<\/td><td[^>]*>−34,90 €/);
  // in €: never more than the total
  const all = await (await go('/atelier/rdv/prix', { method: 'POST', form: form({ remise: '1000', remise_type: 'amount' }) })).json();
  assert.match(all.html, /Remise<\/span><b>−349\s€/);
});

test('a slot taken in the calendar is refused unless kept on purpose; a link cancelled frees its slot', async () => {
  const busy = await (await go('/atelier/rdv/nouveau', { method: 'POST', form: form({ heure: '13:30', email: 'lea@example.com', prenom: 'Léa', tel: '06 11 11 11 11' }) })).text();
  assert.match(busy, /chevauche un autre rendez-vous/);
  const res = await go('/atelier/rdv/nouveau', { method: 'POST', form: form({ heure: '13:30', force: '1', email: 'lea@example.com', prenom: 'Léa', tel: '06 11 11 11 11', mode: 'full', duree: '2' }) });
  const id = where(res).pathname.split('/').pop();
  const link = sql('SELECT * FROM links WHERE id = ?', Number(id))[0];
  assert.deepEqual([link.mode, link.due], ['full', 349]);
  assert.ok(sessions.get(link.session).expires_at * 1000 - Date.now() <= 2 * 3600000);
  // cancelled: confirmation asked, then the Stripe page closed and the slot freed
  assert.match(where(await go(`/atelier/rdv/lien/${id}/annuler`, { method: 'POST', form: {} })).searchParams.get('err'), /Cochez/);
  assert.equal(where(await go(`/atelier/rdv/lien/${id}/annuler`, { method: 'POST', form: { confirme: '1' } })).searchParams.get('ok'), 'Lien annulé, créneau libéré.');
  assert.equal(sql('SELECT status FROM links WHERE id = ?', Number(id))[0].status, 'annule');
  assert.equal(sessions.get(link.session).status, 'expired');
  assert.ok(!cal[CAR].some((e) => e.id === link.event));
});

test('paid on the spot: written in the calendar at once; a code that covers everything needs no payment either', async () => {
  mails.length = 0;
  const res = await go('/atelier/rdv/nouveau', { method: 'POST', form: form({ mode: 'none', canal: 'atelier', heure: '15:00', email: '', prenom: 'Marc', tel: '06 22 22 22 22', x_preset: '', vt_formule: '', feux: 'rear' }) });
  assert.match(where(res).searchParams.get('ok'), /^Rendez-vous inscrit dans l’agenda\.$/);
  const link = sql("SELECT * FROM links WHERE status = 'confirme'")[0];
  assert.deepEqual([link.total, link.due], [120, 0]);
  const ev = cal[CAR].find((e) => e.id === link.event);
  assert.equal(ev.extendedProperties.private.solarcarHold, '0');
  assert.match(ev.description, /Pris à l’atelier, à régler sur place/);
  // taken at the counter: said so, and the workshop gets its « Nouveau RDV »
  assert.match(ev.description, /Pris à l’atelier le /);
  assert.equal(link.canal, 'atelier');
  assert.match(mails.find((x) => /^Nouveau RDV/.test(x.subject)).html, /Nouveau rendez-vous pris à l’atelier</);
  assert.match(await (await go('/atelier/rdv')).text(), /Marc Durand<\/b><\/a><small>Audi A3 Sportback \(2021\) · pris à l’atelier/);
  // the word for the client follows
  assert.match((await (await go('/atelier/rdv/prix', { method: 'POST', form: form({ canal: 'atelier' }) })).json()).draft, /Merci pour votre visite à l’atelier !/);
  assert.equal(sql('SELECT paid, mode FROM bookings WHERE session = ?', link.session)[0].mode, 'none');
  // no e-mail address: nothing sent to the client, the workshop only told by the space
  assert.equal(mails.filter((m) => m.to[0] !== CAR).length, 0);
  // the next morning, a gift worth more than the services: nothing to pay, confirmed without Stripe
  await (await import('../store.js')).db(env, 'promo/save', { code: 'CADEAU', label: 'Offert', amount: 500, starts: utcToZoned(Date.now(), TZ).date, ends: addDays(day, 10), services: [] });
  const gift = await go('/atelier/rdv/nouveau', { method: 'POST', form: form({ heure: '08:00', date: addDays(day, 1), code: 'cadeau', email: 'zoe@example.com', prenom: 'Zoé', tel: '06 33 33 33 33' }) });
  assert.match(where(gift).searchParams.get('ok'), /Rendez-vous inscrit dans l’agenda, confirmation envoyée au client/);
  assert.equal(sql("SELECT uses FROM promos WHERE code = 'CADEAU'")[0].uses, 1);
});

// ------------------------------------------------------------------ a payment link answers a quote
const { db } = await import('../store.js');
const ask = async (who) => {
  const r = await worker.fetch(new Request(`${SELF}/api/demande`, { method: 'POST', body: JSON.stringify({ make: 'Tesla', model: 'Model 3', services: 'Vitres teintées', message: 'Bonjour, un devis svp', ...who }), headers: { origin: 'https://www.solarcar37.fr', 'content-type': 'text/plain;charset=UTF-8' } }), env);
  assert.equal(r.status, 204);
  return (await db(env, 'quotes/list', {})).quotes.find((q) => q.email === who.email);
};
const later = addDays(day, 14);

test('a payment link sent for a quote: « Lien de paiement envoyé », the client’s message answered; paid: « Validé », the client confirmed', async () => {
  const q = await ask({ firstName: 'Matthieu', lastName: 'Deroi', email: 'matthieu@example.com', phone: '0698700001' });
  const t0 = Date.now();
  // answered from Gmail, then the client agrees: « Réponse reçue », to read
  await db(env, 'gmail/import', { items: [{ requestId: q.id, dir: 'out', gid: 'a1', msgid: '<a1@x>', at: t0 - 9000, text: 'Bonjour, 420 € pour le complet.' }, { requestId: q.id, dir: 'in', gid: 'a2', msgid: '<a2@x>', at: t0 - 8000, text: 'Ok pour 420 €, je prends rendez-vous.' }] });
  let r = await db(env, 'quote/get', { id: q.id });
  assert.deepEqual([r.quote.status, r.quote.unread], ['reponse', 1]);
  // a client still a prospect; the quote offers the payment link, the client filled in
  const cid = r.quote.client_id;
  assert.match(await (await go(`/atelier/clients/${cid}`)).text(), /Prospect/);
  const page = await (await go(`/atelier/devis/${q.id}`)).text();
  assert.ok(page.includes(`href="/atelier/rdv/nouveau?client=${cid}&amp;devis=${q.id}"`));
  const formPage = await (await go(`/atelier/rdv/nouveau?client=${cid}&devis=${q.id}`)).text();
  assert.ok(formPage.includes(`<input type="hidden" name="devis" value="${q.id}">`));
  assert.match(formPage, /Pour le <a href="\/atelier\/devis\/\d+">devis n°\d+<\/a>/);
  assert.match(formPage, /value="matthieu@example\.com"/);
  // the link sent from « Nouveau RDV »
  const res = await go('/atelier/rdv/nouveau', { method: 'POST', form: form({ devis: String(q.id), prenom: 'Matthieu', nom: 'Deroi', email: 'matthieu@example.com', tel: '06 98 70 00 01', vehicule: 'Tesla Model 3', x_preset: '', date: later, heure: '08:00' }) });
  const linkId = Number(where(res).pathname.split('/').pop());
  r = await db(env, 'quote/get', { id: q.id });
  assert.deepEqual([r.quote.status, r.quote.unread, r.quote.link, r.quote.amount], ['lien', 0, linkId, 270]);
  const said = r.messages.at(-1);
  assert.deepEqual([said.dir, said.via], ['out', 'lien']);
  assert.match(said.text, /^Lien de paiement envoyé : acompte de 81 € pour confirmer le rendez-vous du jeudi \d+ \S+ à 8 h 00 \(Vitres teintées Complet, 270 € au total\)\. Valable jusqu’au /);
  // the list says it, not the client’s message; nothing left to do on it
  const list = await (await go('/atelier/devis')).text();
  assert.match(list, /Lien de paiement envoyé<\/span>/);
  assert.match(list, /Vous : Lien de paiement envoyé : acompte de 81 €/);
  assert.equal((await db(env, 'quotes/badge', {})).n, (await db(env, 'quotes/list', {})).quotes.filter((x) => x.unread || ['nouveau', 'reponse'].includes(x.status)).length);
  assert.ok(!(await db(env, 'quotes/list', {})).quotes.find((x) => x.id === q.id).unread);
  // the quote shows the link; the link its quote
  assert.match(await (await go(`/atelier/devis/${q.id}`)).text(), /En attente du paiement/);
  assert.match(await (await go(`/atelier/rdv/lien/${linkId}`)).text(), new RegExp(`href="/atelier/devis/${q.id}">Devis n°${q.id}`));
  // a client's e-mail read late from Gmail, written before the link: answered already
  await db(env, 'gmail/import', { items: [{ requestId: q.id, dir: 'in', gid: 'a3', msgid: '<a3@x>', at: t0 - 7000, text: 'Je suis dispo le jeudi.' }] });
  r = await db(env, 'quote/get', { id: q.id });
  assert.deepEqual([r.quote.status, r.quote.unread], ['lien', 0]);
  // paid: « Validé », said in the discussion; the client is confirmed
  const link = sql('SELECT * FROM links WHERE id = ?', linkId)[0];
  const s = sessions.get(link.session);
  Object.assign(s, { status: 'complete', payment_status: 'paid' });
  assert.equal((await hook({ type: 'checkout.session.completed', data: { object: s } })).status, 200);
  r = await db(env, 'quote/get', { id: q.id });
  assert.deepEqual([r.quote.status, r.quote.unread, r.quote.booking], ['valide', 0, link.session]);
  assert.match(r.messages.at(-1).text, /^Acompte de 81 € payé en ligne : rendez-vous confirmé pour le jeudi .+ à 8 h 00\. Devis validé\.$/);
  assert.equal(r.messages.filter((m) => m.dir === 'note' && /payé/.test(m.text)).length, 1);
  const card = await (await go(`/atelier/clients/${cid}`)).text();
  assert.match(card, /<span class="tag tag--ok">Client confirmé<\/span>/);
  assert.match(card, /Client confirmé depuis le /);
  // the client writes afterwards: to read, the quote stays validated
  await db(env, 'gmail/import', { items: [{ requestId: q.id, dir: 'in', gid: 'a4', msgid: '<a4@x>', at: Date.now() + 5000, text: 'Merci, à jeudi !' }] });
  r = await db(env, 'quote/get', { id: q.id });
  assert.deepEqual([r.quote.status, r.quote.unread], ['valide', 1]);
});

test('a link sent without going through the quote: found by the client; expired, the quote back to « Devis envoyé »; paid on the spot: « Validé » at once', async () => {
  const q = await ask({ firstName: 'Inès', lastName: 'Blanc', email: 'ines@example.com', phone: '0698700002' });
  await go('/atelier/rdv/nouveau', { method: 'POST', form: form({ prenom: 'Inès', nom: 'Blanc', email: 'ines@example.com', tel: '06 98 70 00 02', x_preset: '', date: later, heure: '14:00', mode: 'full' }) });
  let r = await db(env, 'quote/get', { id: q.id });
  assert.equal(r.quote.status, 'lien');
  assert.match(r.messages.at(-1).text, /^Lien de paiement envoyé : règlement de 270 €/);
  // Stripe closes the page unpaid: the quote is to follow up again
  const link = sql('SELECT * FROM links WHERE id = ?', r.quote.link)[0];
  assert.equal((await hook({ type: 'checkout.session.expired', data: { object: { ...sessions.get(link.session), status: 'expired' } } })).status, 200);
  r = await db(env, 'quote/get', { id: q.id });
  assert.equal(r.quote.status, 'envoye');
  assert.match(r.messages.at(-1).text, /^Lien de paiement expiré sans paiement : devis repassé en « Devis envoyé »/);
  assert.match(await (await go(`/atelier/devis/${q.id}`)).text(), /Nouveau lien/);
  // the same quote, the appointment paid on the spot: validated at once
  await go('/atelier/rdv/nouveau', { method: 'POST', form: form({ devis: String(q.id), prenom: 'Inès', nom: 'Blanc', email: 'ines@example.com', tel: '06 98 70 00 02', x_preset: '', date: addDays(later, 1), heure: '08:00', mode: 'none' }) });
  r = await db(env, 'quote/get', { id: q.id });
  assert.equal(r.quote.status, 'valide');
  assert.match(r.messages.at(-1).text, /^Rendez-vous confirmé dans l’agenda pour le vendredi .+ à 8 h 00, réglé sur place : devis validé\.$/);
  assert.equal(r.messages.filter((m) => m.dir === 'note' && /validé/.test(m.text)).length, 1);
});

test('the links sent before: said once in their quote, the paid one validated, the client’s message answered', async () => {
  const q = await ask({ firstName: 'Paul', lastName: 'Henry', email: 'paul@example.com', phone: '0698700003' });
  const now = Date.now();
  await db(env, 'gmail/import', { items: [{ requestId: q.id, dir: 'in', gid: 'p1', msgid: '<p1@x>', at: now + 1000, text: 'Ok je réserve' }] });
  // a link written as it was before (no quote tied), then paid
  env.ATELIER.db.prepare("INSERT INTO links (session, client_id, date, time, minutes, items, total, due, mode, url, expires, status, created) VALUES ('cs_old', ?, ?, '09:00', 240, ?, 357, 107.1, 'deposit', 'https://x', ?, 'paye', ?)").run(q.client_id, later, JSON.stringify([{ label: 'Vitres teintées Complet - TESLA', price: 420 }]), now + 86400000, now + 2000);
  env.ATELIER.db.prepare("DELETE FROM settings WHERE key = 'linkQuotes'").run();
  await db(env, 'quotes/list', {});
  const r = await db(env, 'quote/get', { id: q.id });
  assert.deepEqual([r.quote.status, r.quote.unread, r.quote.amount], ['valide', 0, 357]);
  assert.match(r.messages.find((m) => m.via === 'lien').text, /^Lien de paiement envoyé : acompte de 107,10 €/);
  // once
  env.ATELIER.db.prepare("DELETE FROM settings WHERE key = 'linkQuotes'").run();
  await db(env, 'quotes/list', {});
  assert.equal((await db(env, 'quote/get', { id: q.id })).messages.filter((m) => m.via === 'lien').length, 1);
});
