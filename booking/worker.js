/**
 * SOLAR CAR 37 booking server (Cloudflare Worker): free slots read from Google Calendar, payment
 * of a 30 % deposit or of the total through Stripe Checkout, the appointment written into the
 * SOLAR CAR 37 calendar once paid. Setup: docs/RESERVATION.md.
 *
 *   GET  /api/slots?config=…&from=YYYY-MM-DD&days=N   free start times for a configuration
 *   POST /api/checkout                               holds the slot, opens a Stripe payment page
 *   POST /api/stripe-webhook                         paid: appointment confirmed; expired: slot freed
 *   GET  /api/booking?session=cs_…                   what was booked (confirmation page)
 *   POST /api/stats                                  a page view or an action (booking/stats.js)
 *   GET  /stats?cle=…                                the site's statistics (booking/stats-page.js)
 *   GET  /stats/bilan?cle=…&mois=YYYY-MM             the monthly e-mail in the browser (POST: sends it)
 *   GET  /stats/f/<font>.woff2                       the fonts of the statistics page
 *   cron, the 1st of each month                      the monthly e-mail (booking/stats-report.js)
 *   cron, every day at 16:00 UTC                     reminders (tomorrow) and news (a week ago) to clients
 *   GET  /fiche-google?cle=…, /fiche-google/connexion, /fiche-google/retour, POST /fiche-google/envoyer
 *        and a cron every Tuesday                    one photo a week on the Google Business Profile
 *                                                    (booking/fiche-google.js, docs/FICHE-GOOGLE-AUTO.md)
 *
 * Environment (booking/wrangler.toml, secrets with `wrangler secret put`):
 *   ALLOWED_ORIGINS        sites allowed to call the API, comma separated
 *   CALENDAR_WRITE         calendar the appointments go into (SOLAR CAR 37)
 *   CALENDARS_BUSY         calendars whose events make a slot unavailable, comma separated
 *   GOOGLE_SERVICE_ACCOUNT (secret) JSON key of the service account the calendars are shared with
 *   STRIPE_SECRET_KEY      (secret)
 *   STRIPE_WEBHOOK_SECRET  (secret)
 *   RESEND_API_KEY         (secret) e-mails of a confirmed booking (booking/mail.js); none without it
 *   NOTIFY_TO, MAIL_FROM, MAIL_CLIENTS   who is told, from which address, and whether clients are
 *   STATS                  Durable Object (class Stats) holding the visit statistics
 *   STATS_KEY              (secret) the key of the statistics page
 *   STATS_PREVIEW_ORIGINS  sites whose visits are counted apart (the preview), comma separated
 *   STATS_PAGE             address of the statistics page (link of the monthly e-mail)
 *   FICHE                  Durable Object (class Fiche): the Google Business Profile robot's state
 *   GOOGLE_OAUTH_CLIENT_ID, GOOGLE_OAUTH_CLIENT_SECRET (secrets) its Google sign-in (OAuth client)
 */
import { bookingRules as R, quote, amountDue, formatDuration, howHeardText, howHeardParse } from '../content/booking.js';
import { freeStarts, jobSpan, zonedToUtc, utcToZoned, addDays } from './schedule.js';
import { busyIntervals, insertEvent, patchEvent, deleteEvent, getEvent, heldEvents, bookedEvents } from './google.js';
import { createSession, getSession, verifyWebhook } from './stripe.js';
import { sendBookingMails, sendReminderMail, sendFollowUpMail } from './mail.js';
import { record, hitFromPage, heardRows } from './stats.js';
import { statsPage } from './stats-page.js';
import { sendMonthly, monthRoute } from './stats-report.js';
import { ficheRoute, runFiche, FICHE_CRON } from './fiche-google.js';

// the Durable Object class of the statistics database (booking/wrangler.toml)
export { Stats } from './stats.js';
// the Durable Object class of the Google Business Profile robot
export { Fiche } from './fiche-google.js';

const DAY = 86400000;
const list = (s) => (s || '').split(',').map((x) => x.trim()).filter(Boolean);
const euros = (n) => `${n.toFixed(2).replace('.', ',').replace(',00', '')} €`;
const longDate = (date, time) =>
  new Intl.DateTimeFormat('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' }).format(new Date(`${date}T12:00:00Z`)) + ` à ${time.replace(/^0/, '').replace(':', ' h ')}`;

function cors(req, env) {
  const origin = req.headers.get('origin') || '';
  const ok = list(env.ALLOWED_ORIGINS).includes(origin);
  return ok ? { 'access-control-allow-origin': origin, vary: 'origin', 'access-control-allow-methods': 'GET, POST, OPTIONS', 'access-control-allow-headers': 'content-type', 'access-control-max-age': '600' } : { vary: 'origin' };
}
const json = (data, status, headers) => new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...headers } });

/** today in Paris */
const today = (now) => utcToZoned(now, R.timeZone).date;

/** free start times of one or more days, for a job of `minutes` */
async function slotsFor(env, from, days, minutes, now) {
  const fromMs = zonedToUtc(from, '00:00', R.timeZone);
  const toMs = zonedToUtc(addDays(from, days), '00:00', R.timeZone);
  await releaseStaleHolds(env, fromMs, toMs, now);
  const busy = await busyIntervals(env, list(env.CALENDARS_BUSY), fromMs, toMs);
  return freeStarts({ from, days, minutes, busy, now, rules: R });
}

/** slots held by a payment that never came (missed webhook): freed, or confirmed if paid */
async function releaseStaleHolds(env, fromMs, toMs, now) {
  const held = await heldEvents(env, env.CALENDAR_WRITE, fromMs, toMs).catch(() => []);
  for (const ev of held) {
    const p = ev.extendedProperties?.private || {};
    if (Number(p.holdUntil) > now) continue;
    const session = p.session ? await getSession(env, p.session).catch(() => null) : null;
    if (session?.payment_status === 'paid') await confirm(env, session);
    else await deleteEvent(env, env.CALENDAR_WRITE, ev.id).catch(() => {});
  }
}

/** customer details: trimmed, bounded, checked */
function customerOf(c = {}) {
  const s = (v, max) => String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, max);
  const out = {
    firstName: s(c.firstName, 60),
    lastName: s(c.lastName, 60),
    email: s(c.email, 120).toLowerCase(),
    phone: s(c.phone, 30),
    vehicle: s(c.vehicle, 80),
    plate: s(c.plate, 15).toUpperCase(),
    message: String(c.message ?? '').trim().slice(0, 800),
    // « Comment nous avez-vous connus ? »: only the answers of the list, and a short text
    source: howHeardText(c.source?.channels, c.source?.other).slice(0, 180),
  };
  if (!out.firstName || !out.lastName) return { error: 'Nom et prénom à indiquer' };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(out.email)) return { error: 'Adresse e-mail à vérifier' };
  if (out.phone.replace(/\D/g, '').length < 9) return { error: 'Numéro de téléphone à vérifier' };
  if (!out.vehicle) return { error: 'Marque et modèle du véhicule à indiquer' };
  return out;
}

/** the customer for Stripe's metadata (500 characters at most): the message is shortened first,
 *  then the other fields, so that the JSON is always whole */
function customerJson(c) {
  const o = { firstName: c.firstName, lastName: c.lastName, email: c.email, phone: c.phone, vehicle: c.vehicle, plate: c.plate, source: c.source, message: c.message.slice(0, 200) };
  let j = JSON.stringify(o);
  while (j.length > 500 && o.message) {
    o.message = o.message.slice(0, Math.max(0, o.message.length - (j.length - 500) - 1));
    j = JSON.stringify(o);
  }
  for (const k of ['source', 'vehicle', 'lastName']) {
    if (j.length <= 500) break;
    o[k] = String(o[k] || '').slice(0, Math.max(0, String(o[k] || '').length - (j.length - 500) - 1));
    j = JSON.stringify(o);
  }
  return j;
}

/** the text of the appointment in the calendar */
function eventText(q, c, { date, time, mode, paid, sessionId }) {
  const lines = [
    `Client : ${c.firstName} ${c.lastName}`,
    `Téléphone : ${c.phone}`,
    `E-mail : ${c.email}`,
    `Véhicule : ${c.vehicle}${c.plate ? ` (${c.plate})` : ''}`,
    c.source ? `Nous a connus : ${c.source}` : null,
    '',
    ...q.items.map((i) => `• ${i.label}${i.detail ? ` — ${i.detail}` : ''} : ${euros(i.price)} (${formatDuration(i.minutes)})`),
    '',
    `Total : ${euros(q.total)} — durée ${formatDuration(q.minutes)}`,
    paid != null ? `Payé en ligne : ${euros(paid)} (${mode === 'full' ? 'totalité' : 'acompte 30 %'}) — reste à régler : ${euros(Math.max(0, q.total - paid))}` : `Paiement en cours (${mode === 'full' ? 'totalité' : 'acompte 30 %'} : ${euros(amountDue(q, mode))})`,
    c.message ? `\nMessage : ${c.message}` : '',
    '',
    `Réservé en ligne le ${new Date().toLocaleDateString('fr-FR', { timeZone: R.timeZone })} pour le ${longDate(date, time)}.`,
    sessionId ? `Paiement Stripe : ${sessionId}` : '',
  ];
  return lines.filter((l) => l !== null).join('\n').replace(/\n{3,}/g, '\n\n');
}
const titleOf = (q, c) => `${q.items.map((i) => i.label.replace(' — ', ' ')).join(' + ')} — ${c.firstName} ${c.lastName}`;

/** a paid session: its held slot becomes the appointment (blue: client appointment) */
async function confirm(env, session) {
  const m = session.metadata || {};
  const q = quote(JSON.parse(m.config || '{}'));
  const c = JSON.parse(m.customer || '{}');
  if (q.error) throw new Error('confirm: ' + q.error);
  const paid = (session.amount_total || 0) / 100;
  const body = {
    summary: `RDV ${titleOf(q, c)}`,
    description: eventText(q, c, { date: m.date, time: m.time, mode: m.mode, paid, sessionId: session.id }),
    colorId: '9',
    extendedProperties: { private: { solarcarHold: '0', session: session.id, paid: String(paid) } },
  };
  const span = jobSpan(m.date, m.time, q.minutes, R);
  const ev = m.event ? await getEvent(env, env.CALENDAR_WRITE, m.event).catch(() => null) : null;
  let out;
  if (ev && ev.status !== 'cancelled') {
    if (ev.extendedProperties?.private?.solarcarHold === '0') return ev; // already confirmed (and e-mailed)
    out = await patchEvent(env, env.CALENDAR_WRITE, ev.id, body);
  } else {
    // the held slot is gone (should not happen): the appointment is written all the same, flagged
    out = await insertEvent(env, env.CALENDAR_WRITE, {
      ...body,
      summary: `⚠ À vérifier — ${body.summary}`,
      start: { dateTime: new Date(span.start).toISOString(), timeZone: R.timeZone },
      end: { dateTime: new Date(span.end).toISOString(), timeZone: R.timeZone },
    });
  }
  // counted once, when the appointment is confirmed (Stripe test mode: with the preview's figures)
  // with the answers to « Comment nous avez-vous connus ? »
  const site = session.livemode ? 'site' : 'apercu';
  const heard = howHeardParse(c.source);
  await record(env, [{ site, kind: 'rdv', page: '/reservation/', detail: q.items.map((i) => i.label).join(' + ').slice(0, 120), value: paid }, ...heardRows({ site, page: '/reservation/' }, heard.channels, heard.other)]).catch((err) => console.error('[stats]', err));
  // « Nouveau RDV » to the workshop, the confirmation to the client (never fails the booking)
  await sendBookingMails(env, { q, c, date: m.date, time: m.time, start: span.start, end: span.end, mode: m.mode, paid, sessionId: session.id }).catch((err) => console.error('[mail]', err));
  return out;
}

async function slots(req, env, url, now) {
  let config;
  try {
    config = JSON.parse(url.searchParams.get('config') || '{}');
  } catch {
    return json({ error: 'Configuration illisible' }, 400, cors(req, env));
  }
  const q = quote(config);
  if (q.error) return json({ error: q.error }, 400, cors(req, env));
  const first = today(now);
  let from = /^\d{4}-\d{2}-\d{2}$/.test(url.searchParams.get('from') || '') ? url.searchParams.get('from') : first;
  if (from < first) from = first;
  const days = Math.min(42, Math.max(1, Number(url.searchParams.get('days')) || 31));
  const out = await slotsFor(env, from, days, q.minutes, now);
  return json({ from, days, minutes: q.minutes, total: q.total, deposit: q.deposit, slots: out }, 200, cors(req, env));
}

async function checkout(req, env, now) {
  const h = cors(req, env);
  if (!h['access-control-allow-origin']) return json({ error: 'Origine refusée' }, 403, h);
  const b = await req.json().catch(() => null);
  if (!b) return json({ error: 'Demande illisible' }, 400, h);
  const q = quote(b.config);
  if (q.error) return json({ error: q.error }, 400, h);
  const c = customerOf(b.customer);
  if (c.error) return json({ error: c.error }, 400, h);
  const mode = b.mode === 'full' ? 'full' : 'deposit';
  const { date, time } = b;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date || '') || !/^\d{2}:\d{2}$/.test(time || '')) return json({ error: 'Créneau à choisir' }, 400, h);
  if (!b.consent?.terms) return json({ error: 'Conditions de réservation à accepter' }, 400, h);
  const span = jobSpan(date, time, q.minutes, R);
  // within the 14 days of the right of withdrawal, the client asks for the work to be done before
  // it ends (Code de la consommation, L221-25)
  if (span && span.start - now < 14 * DAY && !b.consent?.early) return json({ error: 'Demande d’exécution avant la fin du délai de rétractation à cocher' }, 400, h);
  const back = (() => {
    try {
      const u = new URL(b.back);
      return list(env.ALLOWED_ORIGINS).includes(u.origin) ? u.origin + u.pathname.replace(/\/reservation\/?$/, '') : null;
    } catch {
      return null;
    }
  })();
  if (!back) return json({ error: 'Adresse de retour refusée' }, 400, h);
  // still free? (another visitor may have taken it meanwhile)
  const free = await slotsFor(env, date, 1, q.minutes, now);
  if (!span || !free[0]?.times.includes(time)) return json({ error: 'Ce créneau vient d’être pris : choisissez-en un autre.', taken: true }, 409, h);

  const holdUntil = now + R.holdMinutes * 60000 + 120000;
  const hold = await insertEvent(env, env.CALENDAR_WRITE, {
    summary: `⏳ Paiement en cours — ${titleOf(q, c)}`,
    description: eventText(q, c, { date, time, mode }),
    colorId: '8',
    start: { dateTime: new Date(span.start).toISOString(), timeZone: R.timeZone },
    end: { dateTime: new Date(span.end).toISOString(), timeZone: R.timeZone },
    extendedProperties: { private: { solarcarHold: '1', holdUntil: String(holdUntil) } },
  });
  const due = amountDue(q, mode);
  const what = q.items.map((i) => i.label).join(' + ');
  const when = longDate(date, time);
  let session;
  try {
    session = await createSession(env, {
      mode: 'payment',
      locale: 'fr',
      customer_email: c.email,
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: 'eur',
            unit_amount: Math.round(due * 100),
            product_data: {
              name: `${mode === 'full' ? 'Règlement' : 'Acompte 30 %'} — ${what}`,
              description: `RDV le ${when} à l’atelier SOLAR CAR 37, Vouvray. Total ${euros(q.total)}${mode === 'full' ? '' : `, reste ${euros(q.total - due)} à régler à l’atelier`}.`,
            },
          },
        },
      ],
      payment_intent_data: { description: `SOLAR CAR 37 — ${what} — ${when}`, receipt_email: c.email },
      expires_at: Math.floor(now / 1000) + R.holdMinutes * 60,
      success_url: `${back}/reservation/confirmee/?session={CHECKOUT_SESSION_ID}`,
      cancel_url: `${back}/reservation/?annule=1`,
      metadata: {
        event: hold.id,
        date,
        time,
        mode,
        config: JSON.stringify(b.config).slice(0, 500),
        customer: customerJson(c),
      },
    });
  } catch (err) {
    await deleteEvent(env, env.CALENDAR_WRITE, hold.id).catch(() => {});
    throw err;
  }
  await patchEvent(env, env.CALENDAR_WRITE, hold.id, { extendedProperties: { private: { solarcarHold: '1', holdUntil: String(holdUntil), session: session.id } } });
  return json({ url: session.url }, 200, h);
}

async function webhook(req, env) {
  const payload = await req.text();
  const event = await verifyWebhook(payload, req.headers.get('stripe-signature'), env.STRIPE_WEBHOOK_SECRET);
  if (!event) return json({ error: 'signature' }, 400);
  const s = event.data?.object;
  if ((event.type === 'checkout.session.completed' || event.type === 'checkout.session.async_payment_succeeded') && s?.payment_status === 'paid') {
    await confirm(env, s);
  } else if (event.type === 'checkout.session.expired' || event.type === 'checkout.session.async_payment_failed') {
    const id = s?.metadata?.event;
    const ev = id ? await getEvent(env, env.CALENDAR_WRITE, id).catch(() => null) : null;
    if (ev && ev.extendedProperties?.private?.solarcarHold === '1') await deleteEvent(env, env.CALENDAR_WRITE, id).catch(() => {});
  }
  return json({ received: true }, 200);
}

async function booking(req, env, url) {
  const id = url.searchParams.get('session') || '';
  if (!/^cs_[A-Za-z0-9_]+$/.test(id)) return json({ error: 'Réservation inconnue' }, 400, cors(req, env));
  const s = await getSession(env, id).catch(() => null);
  if (!s) return json({ error: 'Réservation inconnue' }, 404, cors(req, env));
  const m = s.metadata || {};
  const q = quote(JSON.parse(m.config || '{}'));
  const paid = s.payment_status === 'paid' ? (s.amount_total || 0) / 100 : 0;
  return json(
    {
      status: s.status,
      paid: s.payment_status === 'paid',
      amount: paid,
      mode: m.mode,
      date: m.date,
      time: m.time,
      minutes: q.minutes,
      total: q.total,
      remaining: Math.max(0, q.total - paid),
      items: (q.items || []).map((i) => ({ label: i.label, detail: i.detail, price: i.price })),
    },
    200,
    cors(req, env)
  );
}

/** a page view or an action sent by a page of the site (navigator.sendBeacon, text/plain): kept
 *  only from the site's own pages; always a silent 204 */
async function collect(req, env, ctx, now) {
  const origin = req.headers.get('origin') || '';
  const robot = /bot|crawl|spider|slurp|headless|lighthouse/i.test(req.headers.get('user-agent') || '');
  if (env.STATS && !robot && list(env.ALLOWED_ORIGINS).includes(origin)) {
    const text = await req.text();
    const rows = [].concat((text.length <= 2048 && hitFromPage(text, list(env.STATS_PREVIEW_ORIGINS).includes(origin) ? 'apercu' : 'site')) || []);
    if (rows.length) {
      const done = record(env, rows, now).catch((err) => console.error('[stats]', err));
      if (ctx?.waitUntil) ctx.waitUntil(done);
      else await done;
    }
  }
  return new Response(null, { status: 204, headers: cors(req, env) });
}

/** the routes behind the statistics key (same check as the page) */
async function statsKeyed(req, env, url, run) {
  const a = url.searchParams.get('cle') || '';
  const b = env.STATS_KEY || '';
  let d = a.length === b.length && b ? 0 : 1;
  for (let i = 0; i < a.length && i < b.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  if (!env.STATS || d) return new Response('Clé incorrecte', { status: 403, headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store' } });
  return run();
}

/** the site's fonts for the statistics page (loaded only here: Node cannot import a .woff2) */
async function font(name) {
  let fonts = {};
  try {
    ({ FONTS: fonts } = await import('./stats-fonts.js'));
  } catch {}
  const data = Object.hasOwn(fonts, name) ? fonts[name] : null;
  if (!data) return new Response('not found', { status: 404 });
  return new Response(data, { headers: { 'content-type': 'font/woff2', 'cache-control': 'public, max-age=31536000, immutable', 'x-content-type-options': 'nosniff' } });
}

/**
 * Every day (cron of booking/wrangler.toml): the clients of tomorrow get a reminder, those of a
 * week ago are asked for news (with the Google review link). Only appointments booked online and
 * still in the calendar (a cancelled one is deleted from it), at their current time there (the
 * workshop may have moved them); each e-mail once, noted on the event. Nothing is sent until the
 * client e-mails are switched on (MAIL_CLIENTS "1", once the sending domain is verified).
 */
export async function dailyMails(env, now = Date.now()) {
  const out = { reminders: 0, followUps: 0 };
  if (env.MAIL_CLIENTS !== '1' || !env.RESEND_API_KEY) return { ...out, off: true };
  const t = today(now);
  const jobs = [
    { day: addDays(t, 1), flag: 'reminded', send: sendReminderMail, count: 'reminders' },
    { day: addDays(t, -7), flag: 'followedUp', send: sendFollowUpMail, count: 'followUps' },
  ];
  for (const job of jobs) {
    const from = zonedToUtc(job.day, '00:00', R.timeZone);
    const to = zonedToUtc(addDays(job.day, 1), '00:00', R.timeZone);
    for (const ev of await bookedEvents(env, env.CALENDAR_WRITE, from, to)) {
      const p = ev.extendedProperties?.private || {};
      const start = Date.parse(ev.start?.dateTime || '');
      if (ev.status === 'cancelled' || p[job.flag] || !p.session || !(start >= from && start < to)) continue;
      try {
        const session = await getSession(env, p.session);
        if (session.payment_status !== 'paid') continue;
        const m = session.metadata || {};
        const q = quote(JSON.parse(m.config || '{}'));
        const c = JSON.parse(m.customer || '{}');
        if (q.error || !c.email) continue;
        const at = utcToZoned(start, R.timeZone);
        await job.send(env, { q, c, date: at.date, time: at.time, end: Date.parse(ev.end.dateTime), paid: (session.amount_total || 0) / 100 });
        await patchEvent(env, env.CALENDAR_WRITE, ev.id, { extendedProperties: { private: { ...p, [job.flag]: String(now) } } });
        out[job.count]++;
      } catch (err) {
        console.error(`[mail] ${job.flag}`, ev.id, err.message);
      }
    }
  }
  return out;
}

export default {
  /** Tuesdays: the photo of the week on the Google Business Profile; every day: the reminders and
   *  news of the clients; the 1st of each month: the statistics e-mail of the month that just ended */
  async scheduled(controller, env, ctx) {
    if (controller.cron === FICHE_CRON) {
      ctx.waitUntil(runFiche(env, controller.scheduledTime).then((r) => console.log('[fiche] weekly', JSON.stringify(r))).catch((err) => console.error('[fiche] weekly', err)));
      return;
    }
    if (controller.cron === '0 16 * * *') {
      ctx.waitUntil(dailyMails(env, controller.scheduledTime).then((r) => console.log('[mail] daily', JSON.stringify(r))).catch((err) => console.error('[mail] daily', err)));
      return;
    }
    ctx.waitUntil(sendMonthly(env, controller.scheduledTime).then((r) => console.log('[stats] monthly', JSON.stringify(r))).catch((err) => console.error('[stats] monthly', err)));
  },

  async fetch(req, env, ctx) {
    const url = new URL(req.url);
    const now = Date.now();
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors(req, env) });
    try {
      if (req.method === 'GET' && url.pathname === '/api/slots') return await slots(req, env, url, now);
      if (req.method === 'POST' && url.pathname === '/api/checkout') return await checkout(req, env, now);
      if (req.method === 'POST' && url.pathname === '/api/stripe-webhook') return await webhook(req, env);
      if (req.method === 'GET' && url.pathname === '/api/booking') return await booking(req, env, url);
      if (req.method === 'POST' && url.pathname === '/api/stats') return await collect(req, env, ctx, now);
      if (req.method === 'GET' && url.pathname === '/stats') return await statsPage(req, env, url, now);
      if (url.pathname === '/stats/bilan' && (req.method === 'GET' || req.method === 'POST')) return await statsKeyed(req, env, url, () => monthRoute(req, env, url, now));
      if (req.method === 'GET' && url.pathname.startsWith('/stats/f/')) return await font(url.pathname.slice(9));
      if (url.pathname.startsWith('/fiche-google')) {
        const r = await ficheRoute(req, env, url, now);
        if (r) return r;
      }
      return json({ error: 'not found' }, 404, cors(req, env));
    } catch (err) {
      console.error(err);
      return json({ error: 'Le service de réservation ne répond pas pour le moment. Réessayez dans un instant ou appelez l’atelier.' }, 502, cors(req, env));
    }
  },
};
