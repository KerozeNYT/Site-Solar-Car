// The quote discussions: a request opens one; the workshop answers from its Gmail (passed on by
// the relay) or from its space; the client's replies come back; the status follows by itself
// (« Devis envoyé », « Réponse reçue » when the client writes back, « Validé » when the client
// accepts or books online, « Sans suite » after two weeks without news).
import test from 'node:test';
import assert from 'node:assert/strict';
import worker from '../worker.js';
import { Atelier, db } from '../store.js';
import { installFakes } from './fakes.mjs';
import { fakeDO } from './fake-do.mjs';
import { fakeStats } from './fake-stats.mjs';

const SITE = 'https://www.solarcar37.fr';
const SELF = 'https://reservation.solarcar37.fr';
const OWNER = 'contact.solarcar37@gmail.com';
const RELAY = 'devis@reponse.solarcar37.fr';
const env = {
  ALLOWED_ORIGINS: SITE,
  RESEND_API_KEY: 're_test',
  NOTIFY_TO: OWNER,
  MAIL_FROM: 'SOLAR CAR 37 <reservation@solarcar37.fr>',
  MAIL_CLIENTS: '1',
  SITE_URL: SITE,
  QUOTE_REPLY: RELAY,
  ATELIER_SECRET: 'secret-de-test',
  STATS: fakeStats(),
  ATELIER: fakeDO(Atelier, () => env),
};
const { mails, resend } = installFakes({ CAR: OWNER });
const sql = (q, ...b) => env.ATELIER.db.prepare(q).all(...b);
const PHOTO = Buffer.from('photo du ciel de toit').toString('base64');

const submit = (extra = {}) =>
  worker.fetch(
    new Request(`${SELF}/api/demande`, {
      method: 'POST',
      headers: { origin: SITE, 'content-type': 'text/plain;charset=UTF-8' },
      body: JSON.stringify({ v: 2, firstName: 'Léa', lastName: 'Petit', email: 'lea@example.com', phone: '06 11 11 11 11', make: 'Mini', model: 'F56', year: '2015', services: 'Ciel étoilé', message: 'Bonjour, un ciel étoilé svp.', consent: true, files: [{ name: 'toit.jpg', type: 'image/jpeg', data: PHOTO }], ...extra }),
    }),
    env
  );

// an e-mail as Cloudflare Email Routing hands it to the worker
const crlf = (s) => s.replace(/\r?\n/g, '\r\n');
function rawMail({ from, subject, text, id, replyTo = '', dkim = '', attach = null, extra = '' }) {
  const head = `From: ${from}\nTo: "SOLAR CAR 37" <${RELAY}>\nSubject: ${subject}\nMessage-ID: ${id}\n${replyTo ? `In-Reply-To: ${replyTo}\nReferences: ${replyTo}\n` : ''}${dkim ? `Authentication-Results: mx.cloudflare.net; dkim=pass header.d=${dkim} header.s=20230601; dmarc=pass header.from=${dkim} policy.dmarc=none; spf=pass smtp.mailfrom=${dkim}\n` : ''}${extra}MIME-Version: 1.0\n`;
  if (!attach) return crlf(`${head}Content-Type: text/plain; charset="UTF-8"\nContent-Transfer-Encoding: 8bit\n\n${text}\n`);
  return crlf(`${head}Content-Type: multipart/mixed; boundary="b1"\n\n--b1\nContent-Type: text/plain; charset="UTF-8"\n\n${text}\n--b1\nContent-Type: ${attach.type}; name="${attach.name}"\nContent-Disposition: attachment; filename="${attach.name}"\nContent-Transfer-Encoding: base64\n\n${Buffer.from(attach.body).toString('base64')}\n--b1--\n`);
}
async function inbound(raw, envelopeFrom = 'bounce@mail.example') {
  const rejected = [];
  const bytes = new TextEncoder().encode(raw);
  await worker.email({ from: envelopeFrom, to: RELAY, rawSize: bytes.length, raw: new Response(bytes).body, headers: new Headers(), setReject: (r) => rejected.push(r) }, env);
  return rejected;
}

// the workshop's space, signed in
let cookie = '';
const go = (path, { method = 'GET', form, body, headers = {} } = {}) => worker.fetch(new Request(`${SELF}${path}`, { method, body: form ? new URLSearchParams(form) : body, redirect: 'manual', headers: { origin: method === 'GET' ? undefined : SELF, cookie, ...headers } }), env);
async function signIn() {
  await go('/atelier/connexion/code', { method: 'POST' });
  const code = mails.at(-1).subject.match(/(\d{6})$/)[1];
  cookie = (await go('/atelier/connexion', { method: 'POST', form: { code } })).headers.get('set-cookie').split(';')[0];
}

let n = 0;
let token = '';
let ownerMsgId = '';

test('a request opens a discussion: its number in the subject, replies to the relay, the photo kept', async () => {
  mails.length = 0;
  assert.deepEqual(await (await submit()).json(), { ok: true, ack: true });
  const [shop, ack] = mails;
  n = Number(shop.subject.match(/n°(\d+)/)[1]);
  assert.equal(shop.subject, `Demande de devis n°${n} — Mini F56 2015 · Ciel étoilé`);
  assert.equal(shop.reply_to, `"Léa Petit (devis n°${n})" <${RELAY}>`);
  assert.equal(ack.reply_to, `"SOLAR CAR 37" <${RELAY}>`);
  token = sql('SELECT token FROM requests WHERE id = ?', n)[0].token;
  assert.match(token, /^[0-9a-f]{32}$/);
  await signIn();
  const list = await (await go('/atelier/devis')).text();
  assert.match(list, new RegExp(`n°${n}`));
  assert.match(list, /Léa Petit/);
  assert.match(list, /tag--new">Nouveau/);
  assert.match(list, /class="badge"[^>]*>1</);
  const page = await (await go(`/atelier/devis/${n}`)).text();
  assert.match(page, /Bonjour, un ciel étoilé svp\./);
  const fileId = page.match(/\/atelier\/fichier\/(\d+)/)[1];
  const file = await go(`/atelier/fichier/${fileId}`);
  assert.equal(file.headers.get('content-type'), 'image/jpeg');
  assert.equal(Buffer.from(await file.arrayBuffer()).toString('base64'), PHOTO);
  // without the session: nothing
  const saved = cookie;
  cookie = '';
  assert.equal((await go(`/atelier/fichier/${fileId}`)).status, 303);
  cookie = saved;
});

test('the workshop answers from Gmail: the client gets a clean e-mail with the accept button, « Devis envoyé »', async () => {
  mails.length = 0;
  ownerMsgId = '<CAF-owner-1@mail.gmail.com>';
  const rejected = await inbound(
    rawMail({
      from: `Solar Car <${OWNER}>`,
      subject: `Re: Demande de devis n°${n} — Mini F56 2015 · Ciel étoilé`,
      id: ownerMsgId,
      replyTo: '<ses-1@eu-west-1.amazonses.com>',
      dkim: 'gmail.com',
      text: `Bonjour Léa,\n\nVoici le devis : 1 190 €.\n\nBien cordialement,\nNicolas\n\nLe mar. 17 nov. 2026 à 13:03, Léa Petit via SOLAR CAR 37 <\nreservation@solarcar37.fr> a écrit :\n> Demande de devis`,
      attach: { name: 'devis.pdf', type: 'application/pdf', body: '%PDF-1.4' },
    }),
    OWNER
  );
  assert.deepEqual(rejected, []);
  assert.equal(mails.length, 1);
  const [m] = mails;
  assert.equal(m.from, 'SOLAR CAR 37 <contact@solarcar37.fr>');
  assert.deepEqual(m.to, ['lea@example.com']);
  assert.equal(m.reply_to, `"SOLAR CAR 37" <${RELAY}>`);
  assert.equal(m.subject, `Re: Demande de devis n°${n} — Mini F56 2015 · Ciel étoilé`);
  assert.match(m.html, /Voici le devis : 1 190 €\./);
  assert.doesNotMatch(m.html + m.text, /a écrit|reservation@solarcar37\.fr/);
  assert.match(m.html, new RegExp(`href="${SITE}/devis/\\?n=${n}&amp;t=${token}"`));
  assert.match(m.html, /J’accepte ce devis/);
  assert.deepEqual(m.attachments, [{ filename: 'devis.pdf', content: Buffer.from('%PDF-1.4').toString('base64') }]);
  const r = sql('SELECT status, owner_refs FROM requests WHERE id = ?', n)[0];
  assert.equal(r.status, 'envoye');
  assert.equal(r.owner_refs, ownerMsgId);
  const page = await (await go(`/atelier/devis/${n}`)).text();
  assert.match(page, /b--out[^]*Voici le devis[^]*depuis Gmail/);
  assert.match(page, /tag--gold">Devis envoyé/);
});

test('the client answers: kept in the discussion, unread, told to the workshop in its own Gmail thread', async () => {
  mails.length = 0;
  const rejected = await inbound(rawMail({ from: 'Léa Petit <Lea@Example.com>', subject: `Re: Re: Demande de devis n°${n} — Mini F56 2015 · Ciel étoilé`, id: '<lea-1@example.com>', text: 'Parfait ! Le 24 novembre, ça vous va ?\n\nOn Tue, 17 Nov 2026 at 14:02, SOLAR CAR 37 <contact@solarcar37.fr> wrote:\n> Voici le devis', attach: { name: 'toit-2.jpg', type: 'image/jpeg', body: 'jpeg' } }));
  assert.deepEqual(rejected, []);
  const [m] = mails;
  assert.deepEqual(m.to, [OWNER]);
  assert.equal(m.from, 'Léa Petit via SOLAR CAR 37 <reservation@solarcar37.fr>');
  assert.equal(m.reply_to, `"Léa Petit (devis n°${n})" <${RELAY}>`);
  assert.equal(m.headers['In-Reply-To'], ownerMsgId);
  assert.match(m.html, /Le 24 novembre, ça vous va \?/);
  assert.doesNotMatch(m.html, /wrote/);
  assert.equal(m.attachments[0].filename, 'toit-2.jpg');
  assert.equal(sql('SELECT unread, refs FROM requests WHERE id = ?', n)[0].unread, 1);
  // the client wrote after the quote: « Réponse reçue », to answer
  assert.equal(sql('SELECT status FROM requests WHERE id = ?', n)[0].status, 'reponse');
  const list = await (await go('/atelier/devis')).text();
  assert.match(list, /q--unread/);
  assert.match(list, /tag--reply">Réponse reçue/);
  assert.match(list, /Le 24 novembre, ça vous va/);
  // opened: read
  await go(`/atelier/devis/${n}`);
  assert.equal(sql('SELECT unread FROM requests WHERE id = ?', n)[0].unread, 0);
});

test('a forged workshop address is not passed on to the client', async () => {
  mails.length = 0;
  const rejected = await inbound(rawMail({ from: `Solar Car <${OWNER}>`, subject: `Re: Demande de devis n°${n}`, id: '<forged@evil.example>', text: 'Payez sur ce lien' }), OWNER);
  assert.equal(rejected.length, 1);
  assert.match(rejected[0], /non vérifié/);
  assert.equal(mails.length, 0);
  assert.match((await (await go(`/atelier/devis/${n}`)).text()), /n’a pas été transmis au client/);
});

test('the workshop answers from its space: amount, accept button, its PDF; a copy to its Gmail; the client’s thread', async () => {
  mails.length = 0;
  const f = new FormData();
  f.append('message', 'Bonjour Léa,\n\nLe 24 novembre est réservé pour vous.');
  f.append('montant', '1 190');
  f.append('accepter', '1');
  f.append('fichiers', new File([Buffer.from('%PDF devis signé')], 'devis-signé.pdf', { type: 'application/pdf' }));
  const res = await go(`/atelier/devis/${n}/repondre`, { method: 'POST', body: f });
  assert.equal(new URL(res.headers.get('location'), SELF).searchParams.get('ok'), 'Message envoyé au client.');
  const [m] = mails;
  assert.deepEqual(m.to, ['lea@example.com']);
  assert.deepEqual(m.bcc, [OWNER]);
  assert.equal(m.headers['In-Reply-To'], '<lea-1@example.com>');
  assert.match(m.html, /DEVIS N°\d+ · 1\s190\s€/);
  assert.equal(m.attachments[0].filename, 'devis-signé.pdf');
  assert.equal(sql('SELECT amount FROM requests WHERE id = ?', n)[0].amount, 1190);
  // nothing to send: said
  const empty = await go(`/atelier/devis/${n}/repondre`, { method: 'POST', body: new FormData() });
  assert.match(new URL(empty.headers.get('location'), SELF).searchParams.get('err'), /Écrivez un message/);
});

test('the client accepts with the button: « Validé », the workshop told at once; twice is fine', async () => {
  mails.length = 0;
  const api = (path, init = {}) => worker.fetch(new Request(`${SELF}${path}`, { ...init, headers: { origin: SITE, ...(init.headers || {}) } }), env);
  assert.equal((await api(`/api/devis?n=${n}&t=faux`)).status, 404);
  const info = await (await api(`/api/devis?n=${n}&t=${token}`)).json();
  assert.deepEqual([info.ok, info.n, info.firstName, info.amount, info.status], [true, n, 'Léa', 1190, 'envoye']);
  const yes = await api('/api/devis/accepter', { method: 'POST', headers: { 'content-type': 'text/plain' }, body: JSON.stringify({ n, t: token }) });
  assert.deepEqual(await yes.json(), { ok: true, firstName: 'Léa' });
  const [m] = mails;
  assert.equal(m.subject, `Devis n°${n} accepté — Léa Petit`);
  assert.match(m.html, /06 11 11 11 11/);
  assert.equal(sql('SELECT status FROM requests WHERE id = ?', n)[0].status, 'valide');
  const again = await (await api('/api/devis/accepter', { method: 'POST', body: JSON.stringify({ n, t: token }) })).json();
  assert.equal(again.already, true);
  assert.equal(mails.length, 1);
  assert.equal((await api('/api/devis/accepter', { method: 'POST', headers: { origin: 'https://evil.example' }, body: JSON.stringify({ n, t: token }) })).status, 403);
  assert.match(await (await go(`/atelier/devis/${n}`)).text(), /Devis accepté par le client/);
});

test('a booking paid online validates the quote it answers, not the others', async () => {
  const zoe = { firstName: 'Zoé', lastName: 'Martin', email: 'zoe@example.com', phone: '06 22 22 22 22' };
  await submit({ ...zoe, services: 'Vitres teintées', message: 'Teinte arrière', files: [] });
  await submit({ ...zoe, services: 'Ciel étoilé', message: 'Et un ciel étoilé', files: [] });
  await db(env, 'booking/add', { session: 'cs_zoe', date: '2026-12-02', time: '09:00', items: [{ label: 'Vitres teintées — 3/4 arrière', price: 270 }], total: 270, paid: 81, mode: 'deposit', customer: { ...zoe, vehicle: 'Mini F56' } });
  const rows = sql("SELECT r.services, r.status, r.booking FROM requests r JOIN clients c ON c.id = r.client_id WHERE c.email = 'zoe@example.com' ORDER BY r.id");
  assert.deepEqual(rows.map((r) => [r.services, r.status, r.booking]), [
    ['Vitres teintées', 'valide', 'cs_zoe'],
    ['Ciel étoilé', 'nouveau', ''],
  ]);
  const id = sql("SELECT r.id FROM requests r JOIN clients c ON c.id = r.client_id WHERE c.email = 'zoe@example.com' ORDER BY r.id")[0].id;
  assert.match(await (await go(`/atelier/devis/${id}`)).text(), /Rendez-vous réservé et payé en ligne pour le 02\/12\/2026 à 09 h 00/);
});

test('an e-mail without a request: to the workshop; machines and loops: nothing', async () => {
  mails.length = 0;
  await inbound(rawMail({ from: 'Paul <paul@example.com>', subject: 'Question', id: '<paul@example.com>', text: 'Vous faites les jantes ?' }));
  assert.equal(mails.length, 1);
  assert.equal(mails[0].subject, 'Message reçu sans numéro de devis — Question');
  assert.equal(mails[0].reply_to, 'paul@example.com');
  mails.length = 0;
  await inbound(rawMail({ from: 'lea@example.com', subject: `Absent : Demande de devis n°${n}`, id: '<auto@example.com>', text: 'Je suis absente', extra: 'Auto-Submitted: auto-replied\n' }));
  await inbound(rawMail({ from: 'SOLAR CAR 37 <contact@solarcar37.fr>', subject: `Re: Demande de devis n°${n}`, id: '<loop@solarcar37.fr>', text: 'boucle' }));
  assert.equal(mails.length, 0);
});

test('no news from the client: « à relancer » after 7 days, « Sans suite » after 14, back when the client writes; the home and the live updates show it', async () => {
  const DAY = 86400000;
  const later = (d) => Date.now() + d * DAY;
  await submit({ firstName: 'Paul', lastName: 'Martin', email: 'paul@example.com', phone: '06 33 33 33 33', services: 'Feux teintés', message: 'Feux arrière svp', files: [] });
  const id = sql("SELECT r.id FROM requests r JOIN clients c ON c.id = r.client_id WHERE c.email = 'paul@example.com'")[0].id;
  const f = new FormData();
  f.append('message', 'Bonjour Paul, 120 € la paire.');
  await go(`/atelier/devis/${id}/repondre`, { method: 'POST', body: f });
  const status = () => sql('SELECT status FROM requests WHERE id = ?', id)[0].status;
  assert.equal(status(), 'envoye');
  // 8 days later: to remind (a reminder ready in the discussion)
  assert.equal((await db(env, 'quotes/list', { now: later(8) })).quotes.find((q) => q.id === id).remind, true);
  assert.ok((await db(env, 'live', { now: later(8) })).remind >= 1);
  assert.equal(status(), 'envoye');
  // 15 days: « Sans suite », said in the discussion
  await db(env, 'quotes/list', { now: later(15) });
  assert.equal(status(), 'sans_suite');
  assert.match(sql("SELECT text FROM messages WHERE request_id = ? AND dir = 'note' ORDER BY id DESC LIMIT 1", id)[0].text, /Pas de nouvelles du client depuis 14 jours/);
  // the client writes back: « Réponse reçue » again
  await inbound(rawMail({ from: 'Paul Martin <paul@example.com>', subject: `Re: Demande de devis n°${id} — Feux teintés`, id: '<paul-1@example.com>', text: 'Finalement oui, quand êtes-vous libre ?' }));
  assert.equal(status(), 'reponse');
  assert.match(sql("SELECT text FROM messages WHERE request_id = ? AND dir = 'note' ORDER BY id DESC LIMIT 1", id)[0].text, /quitte « Sans suite »/);
  // the home: the quote to answer, the client's message in the live feed
  const home = await (await go('/atelier')).text();
  assert.match(home, /Paul Martin/);
  assert.match(home, /Paul a écrit · n°/);
  assert.match(home, /data-refresh/);
  // signed out: said plainly, not redirected to the sign-in page
  assert.equal((await worker.fetch(new Request(`${SELF}/atelier/live`), env)).status, 401);
  const live = await (await go('/atelier/live')).json();
  assert.ok(live.badge >= 1);
  assert.equal(live.counts.reponse >= 1, true);
  assert.ok(live.events.some((e) => e.kind === 'in' && e.request === id));
  // the delays, changed in « Plus »
  const set = await go('/atelier/reglages', { method: 'POST', form: { relance: '3', sans_suite: '0' } });
  assert.match(new URL(set.headers.get('location'), SELF).searchParams.get('ok'), /3 jours, sans suite après jamais/);
  assert.deepEqual((await db(env, 'quotes/delays', {})).delays, { remind: 3, close: 0 });
  await go('/atelier/reglages', { method: 'POST', form: { relance: '7', sans_suite: '14' } });
  assert.match(await (await go('/atelier/plus')).text(), /value="14"/);
  // the style sheet and the script of the space
  const js = await go('/atelier/app.js');
  assert.equal(js.headers.get('content-type'), 'text/javascript; charset=utf-8');
  assert.match(await js.text(), /\/atelier\/live/);
  assert.match((await go('/atelier')).headers.get('content-security-policy'), /script-src 'self'/);
});

test('status by hand, then the client erased with their discussions and files', async () => {
  const res = await go(`/atelier/devis/${n}/statut`, { method: 'POST', form: { statut: 'sans_suite', montant: '1190' } });
  assert.equal(new URL(res.headers.get('location'), SELF).searchParams.get('ok'), 'Suivi enregistré.');
  assert.equal(sql('SELECT status FROM requests WHERE id = ?', n)[0].status, 'sans_suite');
  const client = sql('SELECT client_id FROM requests WHERE id = ?', n)[0].client_id;
  assert.ok(sql('SELECT COUNT(*) AS c FROM files WHERE request_id = ?', n)[0].c > 0);
  await go(`/atelier/clients/${client}/supprimer`, { method: 'POST', form: { confirme: '1' } });
  assert.equal(sql('SELECT COUNT(*) AS c FROM messages WHERE request_id = ?', n)[0].c, 0);
  assert.equal(sql('SELECT COUNT(*) AS c FROM files WHERE request_id = ?', n)[0].c, 0);
  assert.equal(sql('SELECT COUNT(*) AS c FROM requests WHERE id = ?', n)[0].c, 0);
  assert.equal(resend.fail, 0);
});
