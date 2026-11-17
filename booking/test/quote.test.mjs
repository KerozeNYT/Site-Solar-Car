// A quote request from the site's form (POST /api/demande): e-mailed to the workshop with its
// photos and to the client, once, written into the client file; the form without JavaScript too.
import test from 'node:test';
import assert from 'node:assert/strict';
import worker from '../worker.js';
import { Atelier, db } from '../store.js';
import { installFakes } from './fakes.mjs';
import { fakeDO } from './fake-do.mjs';
import { fakeStats } from './fake-stats.mjs';

const SITE = 'https://www.solarcar37.fr';
const SELF = 'https://reservation.solarcar37.fr';
const WORKSHOP = 'contact.solarcar37@gmail.com';
const env = {
  ALLOWED_ORIGINS: `${SITE},https://kerozenyt.github.io`,
  RESEND_API_KEY: 're_test',
  NOTIFY_TO: WORKSHOP,
  MAIL_FROM: 'SOLAR CAR 37 <reservation@solarcar37.fr>',
  MAIL_CLIENTS: '1',
  SITE_URL: SITE,
  STATS: fakeStats(),
  ATELIER: fakeDO(Atelier, () => env),
};
const { mails, resend } = installFakes({ CAR: WORKSHOP });

// a 1×1 JPEG-like payload: what matters is that it goes through untouched
const PHOTO = Buffer.from('photo de la vitre arrière').toString('base64');
const request = (extra = {}) => ({
  v: 2,
  firstName: 'Léa',
  lastName: 'Petit',
  email: 'Lea.Petit@example.com',
  phone: '06 11 11 11 11',
  make: 'Peugeot',
  model: '208',
  year: '2021',
  services: 'Vitres teintées',
  wish: 'à partir du 24/11/2026, Matin (8 h – 12 h)',
  message: 'Bonjour,\nun devis pour les vitres arrière svp.',
  source: { channels: ['Bouche-à-oreille'] },
  consent: true,
  files: [{ name: 'vitre arrière.jpg', type: 'image/jpeg', data: PHOTO }],
  ...extra,
});
const send = (body, { origin = SITE, type = 'text/plain;charset=UTF-8' } = {}) =>
  worker.fetch(new Request(`${SELF}/api/demande`, { method: 'POST', body: typeof body === 'string' || body instanceof FormData ? body : JSON.stringify(body), headers: { origin, ...(type ? { 'content-type': type } : {}) } }), env);
const requests = async (q) => {
  const c = (await db(env, 'clients/list', { q })).clients[0];
  return c ? (await db(env, 'client/get', { id: c.id })).client.requests : [];
};

test('a quote request: one clean e-mail to the workshop (photos, reply to the client), an acknowledgment to the client', async () => {
  mails.length = 0;
  const res = await send(request());
  assert.equal(res.status, 200);
  assert.equal(res.headers.get('access-control-allow-origin'), SITE);
  assert.deepEqual(await res.json(), { ok: true, ack: true });
  assert.equal(mails.length, 2);
  const [shop, ack] = mails;
  // the workshop: from the client's name, answering writes to the client
  assert.equal(shop.from, 'Léa Petit via SOLAR CAR 37 <reservation@solarcar37.fr>');
  assert.deepEqual(shop.to, [WORKSHOP]);
  assert.equal(shop.reply_to, 'Lea.Petit@example.com');
  assert.match(shop.subject, /^Demande de devis n°\d+ — Peugeot 208 2021 · Vitres teintées$/);
  assert.deepEqual(shop.attachments, [{ filename: 'vitre arrière.jpg', content: PHOTO }]);
  for (const part of [shop.html, shop.text]) {
    assert.match(part, /Léa Petit/);
    assert.match(part, /06 11 11 11 11/);
    assert.match(part, /à partir du 24\/11\/2026, Matin/);
    assert.match(part, /Bouche-à-oreille/);
    assert.match(part, /vitre arrière\.jpg/);
    // nothing in English, no advertising: this e-mail is quoted to the client in the answer
    assert.doesNotMatch(part, /FormSubmit|Someone|submitted|Sponsor/i);
  }
  assert.match(shop.html, /un devis pour les vitres arrière svp\./);
  assert.match(shop.html, /<br>un devis/);
  // the client: what they asked, from the workshop, the same subject
  assert.deepEqual(ack.to, ['Lea.Petit@example.com']);
  assert.equal(ack.reply_to, 'contact@solarcar37.fr');
  assert.equal(ack.subject, shop.subject);
  assert.match(ack.html, /Bonjour Léa,<br>merci pour votre demande de devis/);
  assert.match(ack.html, /Vitres teintées/);
  assert.match(ack.html, /1 fichier reçu/);
  assert.equal(ack.attachments, undefined);
  // the client file
  const [r] = await requests('petit');
  assert.equal(r.services, 'Vitres teintées');
  assert.equal(r.vehicle, 'Peugeot 208 2021');
  assert.equal(r.message, 'Bonjour,\nun devis pour les vitres arrière svp.');
});

test('the same request sent again: « received », no second e-mail; a different one goes out', async () => {
  mails.length = 0;
  const again = await send(request());
  assert.deepEqual(await again.json(), { ok: true, ack: false, duplicate: true });
  assert.equal(mails.length, 0);
  assert.equal((await requests('petit')).length, 1);
  await send(request({ message: 'Et le pare-brise aussi ?' }));
  assert.equal(mails.length, 2);
  assert.equal((await requests('petit')).length, 2);
});

test('refused: a missing field, too heavy, another site; robots get « received » and nothing happens', async () => {
  mails.length = 0;
  const missing = await send(request({ message: '  ', consent: false, email: 'pas-une-adresse' }));
  assert.equal(missing.status, 400);
  assert.equal((await missing.json()).error, 'Il manque une adresse e-mail valide, votre message, votre accord pour l’utilisation de vos données.');
  const heavy = await send(request({ email: 'lourd@example.com', files: [{ name: 'gros.pdf', type: 'application/pdf', data: 'A'.repeat(15 * 1024 * 1024) }] }));
  assert.equal(heavy.status, 413);
  assert.match((await heavy.json()).error, /10 Mo maximum/);
  const elsewhere = await send(request({ email: 'autre@example.com', phone: '06 66 66 66 66' }), { origin: 'https://evil.example' });
  assert.equal(elsewhere.status, 204);
  const robot = await send(request({ email: 'robot@example.com', phone: '06 55 55 55 55', trap: 'https://spam.example' }));
  assert.deepEqual(await robot.json(), { ok: true, ack: false });
  assert.equal(mails.length, 0);
  assert.equal((await requests('robot@')).length, 0);
  assert.equal((await requests('autre@')).length, 0);
});

test('the workshop e-mail cannot go out: « not sent », nothing kept, sending again works', async () => {
  mails.length = 0;
  resend.fail = 1;
  const down = await send(request({ email: 'zoe@example.com', firstName: 'Zoé', lastName: 'Martin', phone: '06 22 22 22 22' }));
  assert.equal(down.status, 502);
  assert.equal((await down.json()).ok, false);
  assert.equal((await requests('zoe@')).length, 0);
  const retry = await send(request({ email: 'zoe@example.com', firstName: 'Zoé', lastName: 'Martin', phone: '06 22 22 22 22' }));
  assert.deepEqual(await retry.json(), { ok: true, ack: true });
  assert.equal(mails.length, 2);
  assert.equal((await requests('zoe@')).length, 1);
});

test('attachments the sending service refuses: the request goes out without them, said in it', async () => {
  mails.length = 0;
  resend.refuse = (m) => (m.attachments?.length ? 422 : 0);
  const res = await send(request({ email: 'max@example.com', firstName: 'Max', lastName: 'Roux', phone: '06 33 33 33 33' }));
  resend.refuse = null;
  assert.deepEqual(await res.json(), { ok: true, ack: true });
  const [shop, ack] = mails;
  assert.deepEqual(shop.attachments, []);
  assert.match(shop.text, /1 pièce jointe n’a pas pu être transmise : à redemander\./);
  assert.match(ack.text, /Bonjour Max/);
});

test('the form posted without JavaScript: e-mailed with its photo, then the thank-you page', async () => {
  mails.length = 0;
  const f = new FormData();
  for (const [k, v] of Object.entries({ nom: 'Durand', prenom: 'Paul', email: 'paul@example.com', telephone: '0622334455', marque: 'Audi', modele: 'A3', annee: '2018', message: 'Devis covering noir mat', date_souhaitee: '2026-12-01', moment: '', consentement: 'on', _gotcha: '', connu: 'Google' })) f.append(k, v);
  f.append('prestations', 'covering-dechromage');
  f.append('prestations', 'autre');
  f.append('attachment', new File([Buffer.from('jpeg')], 'capot.jpg', { type: 'image/jpeg' }));
  const res = await send(f, { type: null });
  assert.equal(res.status, 303);
  assert.equal(res.headers.get('location'), `${SITE}/contact/merci/`);
  const [shop] = mails;
  assert.match(shop.subject, /^Demande de devis n°\d+ — Audi A3 2018 · Covering, Autre demande$/);
  assert.deepEqual(shop.attachments, [{ filename: 'capot.jpg', content: Buffer.from('jpeg').toString('base64') }]);
  assert.match(shop.text, /Rendez-vous souhaité : à partir du 01\/12\/2026/);
  // from another site: a page saying it did not go through
  const evil = await send(f, { type: null, origin: 'https://evil.example' });
  assert.equal(evil.status, 403);
  assert.match(await evil.text(), /Votre demande n’est pas partie/);
  // a field left empty (no browser check without JavaScript): said on the page
  f.set('message', '');
  const empty = await send(f, { type: null });
  assert.equal(empty.status, 400);
  assert.match(await empty.text(), /Il manque votre message\. Revenez en arrière pour la compléter/);
});

test('a copy sent by an older page of the site (the form then went through FormSubmit): written, no e-mail', async () => {
  mails.length = 0;
  const { v, files, consent, ...old } = request({ email: 'ancien@example.com', lastName: 'Ancien', phone: '06 44 44 44 44' });
  const res = await send(old);
  assert.equal(res.status, 204);
  assert.equal(mails.length, 0);
  assert.equal((await requests('ancien@')).length, 1);
});
