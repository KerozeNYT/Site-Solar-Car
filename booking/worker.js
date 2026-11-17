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
 *   GET  /api/code?code=…                            is a code valid: promotion or referral (booking page)
 *   GET  /api/promo                                  the promotion band of the site, when one is on
 *   POST /api/demande                                a quote request from the site's form: e-mailed to the
 *                                                    workshop (photos attached) and to the client, in the client file
 *   GET  /api/devis?n=&t=, POST /api/devis/accepter  the client accepts a quote (www.solarcar37.fr/devis/)
 *   email handler                                    the replies of a quote discussion (QUOTE_REPLY, booking/store.js)
 *   GET  /atelier…                                   the workshop's space (booking/atelier.js, docs/ATELIER.md)
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
 *   QUOTE_REPLY            the quote discussions' address (Cloudflare Email Routing → email handler)
 *   STATS                  Durable Object (class Stats) holding the visit statistics
 *   STATS_KEY              (secret) the key of the statistics page
 *   STATS_PREVIEW_ORIGINS  sites whose visits are counted apart (the preview), comma separated
 *   STATS_PAGE             address of the statistics page (link of the monthly e-mail)
 *   FICHE                  Durable Object (class Fiche): the Google Business Profile robot's state
 *   ATELIER                Durable Object (class Atelier): clients, bookings, codes, promotions, band
 *   ATELIER_SECRET         (secret) signs the sessions of the workshop's space
 *   ATELIER_EMAILS         who may sign in to the workshop's space (the code is e-mailed there);
 *                          NOTIFY_TO when unset
 *   GOOGLE_OAUTH_CLIENT_ID, GOOGLE_OAUTH_CLIENT_SECRET (secrets) its Google sign-in (OAuth client)
 */
import { business as B } from '../content/site.js';
import { bookingRules as R, quote, amountDue, formatDuration, howHeardText, howHeardParse, withDiscount, discountFor, withExtra } from '../content/booking.js';
import { freeStarts, jobSpan, zonedToUtc, utcToZoned, addDays } from './schedule.js';
import { busyIntervals, insertEvent, patchEvent, deleteEvent, getEvent, heldEvents, bookedEvents } from './google.js';
import { createSession, getSession, expireSession, verifyWebhook } from './stripe.js';
import { sendBookingMails, sendReminderMail, sendFollowUpMail, sendPaymentLink } from './mail.js';
import { record, hitFromPage, heardRows } from './stats.js';
import { statsPage } from './stats-page.js';
import { sendMonthly, monthRoute } from './stats-report.js';
import { ficheRoute, runFiche, FICHE_CRON } from './fiche-google.js';
import { db, referralFor, checkCode, redeemReferral } from './store.js';
import { atelier } from './atelier.js';
import { gmailSync } from './gmail.js';

// the Durable Object class of the statistics database (booking/wrangler.toml)
export { Stats } from './stats.js';
// the Durable Object class of the Google Business Profile robot
export { Fiche } from './fiche-google.js';
// the Durable Object class of the workshop's database: clients, bookings, codes, band (booking/store.js)
export { Atelier } from './store.js';

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

/** the price of a booking from its payment session's metadata, with its referral discount (and
 *  the lines added by the workshop for an appointment taken on the phone: `extra`) */
const priced = (m) => withDiscount(withExtra(quote(JSON.parse(m.config || '{}')), JSON.parse(m.extra || '[]')), Number(m.discount) || 0);

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
function eventText(q, c, { date, time, mode, paid, sessionId, code, codeKind }) {
  const lines = [
    `Client : ${c.firstName} ${c.lastName}`,
    `Téléphone : ${c.phone}`,
    `E-mail : ${c.email}`,
    `Véhicule : ${c.vehicle}${c.plate ? ` (${c.plate})` : ''}`,
    c.source ? `Nous a connus : ${c.source}` : null,
    '',
    ...q.items.map((i) => `• ${i.label}${i.detail ? ` — ${i.detail}` : ''} : ${euros(i.price)} (${formatDuration(i.minutes)})`),
    '',
    q.discount ? (codeKind === 'promo' ? `Code promo ${code} : −${euros(q.discount)}` : `Parrainage : −${euros(q.discount)} (code ${code})`) : null,
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
  const q = priced(m);
  const c = JSON.parse(m.customer || '{}');
  if (q.error) throw new Error('confirm: ' + q.error);
  const paid = (session.amount_total || 0) / 100;
  const body = {
    summary: `RDV ${titleOf(q, c)}`,
    description: eventText(q, c, { date: m.date, time: m.time, mode: m.mode, paid, sessionId: session.id, code: m.code, codeKind: m.codeKind }),
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
  // an appointment taken by the workshop on the phone is counted apart from the site's bookings
  const from = m.origin === 'atelier' ? '/atelier/rdv/' : '/reservation/';
  await record(env, [{ site, kind: 'rdv', page: from, detail: q.items.map((i) => i.label).join(' + ').slice(0, 120), value: paid }, ...heardRows({ site, page: from }, heard.channels, heard.other)]).catch((err) => console.error('[stats]', err));
  if (env.ATELIER) {
    // the code is counted now that the booking is paid (checked when the payment opened): a
    // referral code is used up, a promotion counts one more use
    if (m.code) {
      const r = await (m.codeKind === 'promo' ? db(env, 'promo/use', { code: m.code }) : redeemReferral(env, m.code, { by: `${c.firstName} ${c.lastName}`, ref: session.id, where: 'réservation en ligne' })).catch((err) => ({ ok: false, error: err.message }));
      if (!r.ok) console.error('[code]', m.code, r.error);
    }
    // the client file and the list of bookings of the workshop's space
    await db(env, 'booking/add', { session: session.id, event: out?.id || m.event, date: m.date, time: m.time, minutes: q.minutes, items: q.items.map((i) => ({ label: i.label, detail: i.detail, price: i.price })), total: q.total, discount: q.discount || 0, code: m.code || '', codeKind: m.code ? m.codeKind || 'parrainage' : '', mode: m.mode, paid, customer: c, live: session.livemode !== false }).catch((err) => console.error('[atelier] booking', err.message));
  }
  // « Nouveau RDV » to the workshop, the confirmation to the client (never fails the booking)
  await sendBookingMails(env, { q, c, date: m.date, time: m.time, start: span.start, end: span.end, mode: m.mode, paid, sessionId: session.id, code: m.code, codeKind: m.codeKind }).catch((err) => console.error('[mail]', err));
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
  let q = quote(b.config);
  if (q.error) return json({ error: q.error }, 400, h);
  const c = customerOf(b.customer);
  if (c.error) return json({ error: c.error }, 400, h);
  // a code (promotion or referral): checked now, counted once the payment is confirmed
  let code = '';
  let codeKind = '';
  if (b.code) {
    if (!env.ATELIER) return json({ error: 'Les codes ne sont pas encore acceptés en ligne.', code: true }, 400, h);
    const r = await checkCode(env, b.code, now);
    if (!r.ok) return json({ error: r.error, code: true }, 400, h);
    const off = discountFor(q, r);
    if (!off) return json({ error: `Le code ${r.code} ne s’applique pas à ces prestations.`, code: true }, 400, h);
    code = r.code;
    codeKind = r.kind;
    q = withDiscount(q, off);
  }
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
    description: eventText(q, c, { date, time, mode, code, codeKind }),
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
              description: `RDV le ${when} à l’atelier SOLAR CAR 37, Vouvray. Total ${euros(q.total)}${q.discount ? ` (${codeKind === 'promo' ? `code ${code}` : 'parrainage'} −${euros(q.discount)} déduit)` : ''}${mode === 'full' ? '' : `, reste ${euros(q.total - due)} à régler à l’atelier`}.`,
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
        ...(code ? { code, codeKind, discount: String(q.discount) } : {}),
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
    // a link sent by the workshop: no longer waiting
    if (s?.metadata?.origin === 'atelier' && env.ATELIER) await db(env, 'link/status', { session: s.id, status: 'expire' }).catch(() => {});
  }
  return json({ received: true }, 200);
}

// ---------------------------------------------------------------- appointments taken by the workshop
/** the workshop's own opening for an appointment taken on the phone: no 48 h notice */
const atelierRules = { ...R, noticeHours: 0 };

/** free start times for a job of `minutes` (the space's « Nouveau RDV »), from `date` over `days`
 *  days (1 to 31), all the calendars of CALENDARS_BUSY read as on the site's booking page (without
 *  its 48 h notice): { days: [{ date, times }] (days with a free time only), times (of `date`) } or
 *  { error } */
export async function atelierSlots(env, date, minutes, now, days = 1) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date || '')) return { error: 'Date à choisir' };
  const n = Math.max(1, Math.min(31, Math.round(Number(days) || 1)));
  const fromMs = zonedToUtc(date, '00:00', R.timeZone);
  const toMs = zonedToUtc(addDays(date, n), '00:00', R.timeZone);
  await releaseStaleHolds(env, fromMs, toMs, now).catch(() => {});
  const busy = await busyIntervals(env, list(env.CALENDARS_BUSY), fromMs, toMs);
  const out = freeStarts({ from: date, days: n, minutes: Math.max(15, Number(minutes) || 60), busy, now, rules: atelierRules });
  return { from: date, days: out, times: out.find((x) => x.date === date)?.times || [] };
}

/**
 * An appointment taken by the workshop (on the phone, at the counter), from its space:
 *   b: { customer: { firstName, lastName, email, phone, vehicle, plate }, config (as online),
 *        extra: [{ label, price, minutes }], date, time, force, mode: 'deposit' | 'full' | 'none',
 *        code, note, hours (life of the payment link, 1 to 24) }
 * With a payment (deposit or full): the slot held in the calendar, a Stripe payment page valid
 * `hours` hours, e-mailed to the client; once paid, the same path as an online booking (the
 * appointment confirmed in the calendar, the e-mails, the client file). Without (or nothing left to
 * pay, a 100 % code): the appointment written in the calendar at once, the client e-mailed.
 * Returns { ok, id (the link), url, confirmed } or { error, taken }.
 */
export async function atelierBooking(env, b, now) {
  const base = quote(b.config || {});
  let q = withExtra(base, b.extra);
  if (q.error) return { error: q.error === 'Prestation à choisir' ? 'Choisissez au moins une prestation.' : q.error };
  const s = (v, max) => String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, max);
  const c = { firstName: s(b.customer?.firstName, 60), lastName: s(b.customer?.lastName, 60), email: s(b.customer?.email, 120).toLowerCase(), phone: s(b.customer?.phone, 30), vehicle: s(b.customer?.vehicle, 80), plate: s(b.customer?.plate, 15).toUpperCase(), message: '', source: s(b.customer?.source, 180) };
  // the workshop's word for the client (lines kept): at the head of the e-mail
  const note = String(b.note ?? '').replace(/\r\n?/g, '\n').trim().slice(0, 1500);
  if (!c.firstName && !c.lastName) return { error: 'Indiquez le nom du client.' };
  const mode = ['deposit', 'full', 'none'].includes(b.mode) ? b.mode : 'deposit';
  if (c.email && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(c.email)) return { error: 'Adresse e-mail à vérifier.' };
  if (mode !== 'none' && !c.email) return { error: 'Il faut l’e-mail du client pour lui envoyer le lien de paiement.' };
  if (c.phone && c.phone.replace(/\D/g, '').length < 9) return { error: 'Numéro de téléphone à vérifier.' };
  // a code: checked as online, counted once the appointment is confirmed
  let code = '';
  let codeKind = '';
  if (b.code) {
    const r = await checkCode(env, b.code, now);
    if (!r.ok) return { error: r.error };
    const off = discountFor(q, r);
    if (!off) return { error: `Le code ${r.code} ne s’applique pas à ces prestations.` };
    code = r.code;
    codeKind = r.kind;
    q = withDiscount(q, off);
  }
  const { date, time } = b;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date || '') || !/^\d{2}:\d{2}$/.test(time || '')) return { error: 'Choisissez la date et l’heure.' };
  // in the opening hours (the lunch break skipped), else exactly the time typed
  const span = jobSpan(date, time, q.minutes, R) || { start: zonedToUtc(date, time, R.timeZone), end: zonedToUtc(date, time, R.timeZone) + q.minutes * 60000 };
  span.segments ||= [[span.start, span.end]];
  if (span.end < now) return { error: 'Ce créneau est déjà passé.' };
  if (!b.force) {
    await releaseStaleHolds(env, span.start - DAY, span.end + DAY, now).catch(() => {});
    const busy = await busyIntervals(env, list(env.CALENDARS_BUSY), span.start, span.end);
    if (span.segments.some(([a, z]) => busy.some(([x, y]) => a < y && x < z))) return { error: 'Ce créneau chevauche un autre rendez-vous de l’agenda. Choisissez-en un autre, ou cochez « Garder ce créneau quand même ».', taken: true };
  }
  const configText = JSON.stringify(b.config || {}).slice(0, 500);
  // the lines beyond the online catalogue, for the payment's metadata (priced() reads them back)
  const extraText = JSON.stringify(q.items.slice(base.error ? 0 : base.items.length).map((i) => ({ kind: i.kind, label: i.label, price: i.price, minutes: i.minutes })));
  if (extraText.length > 500) return { error: 'Libellés des prestations trop longs : raccourcissez-les.' };
  const due = mode === 'none' ? 0 : amountDue(q, mode);
  const items = q.items.map((i) => ({ label: i.label, detail: i.detail, price: i.price }));

  // no payment online: the appointment is written at once
  if (mode === 'none' || due < 0.5) {
    const id = `atelier-${now.toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
    const ev = await insertEvent(env, env.CALENDAR_WRITE, {
      summary: `RDV ${titleOf(q, c)}`,
      description: eventText(q, c, { date, time, mode: 'none', paid: 0, code, codeKind }).replace(/Payé en ligne : 0 € \([^)]*\)/, 'Pris à l’atelier, à régler sur place'),
      colorId: '9',
      start: { dateTime: new Date(span.start).toISOString(), timeZone: R.timeZone },
      end: { dateTime: new Date(span.end).toISOString(), timeZone: R.timeZone },
      extendedProperties: { private: { solarcarHold: '0', session: id, atelier: '1' } },
    });
    if (code) await (codeKind === 'promo' ? db(env, 'promo/use', { code }) : redeemReferral(env, code, { by: `${c.firstName} ${c.lastName}`, ref: id, where: 'à l’atelier' })).catch(() => {});
    await db(env, 'booking/add', { now, session: id, event: ev.id, date, time, minutes: q.minutes, items, total: q.total, discount: q.discount || 0, code, codeKind, mode: 'none', paid: 0, customer: c });
    const link = await db(env, 'link/add', { now, session: id, event: ev.id, date, time, minutes: q.minutes, items, total: q.total, due: 0, mode: 'none', status: 'confirme', customer: c });
    if (c.email) await sendBookingMails(env, { q, c, date, time, start: span.start, end: span.end, mode: 'none', paid: 0, sessionId: id, code, codeKind, note }).catch((err) => console.error('[mail] atelier booking', err.message));
    return { ok: true, id: link.id, confirmed: true };
  }

  // a payment link: the slot held while the client pays (Stripe: 30 minutes to 24 hours)
  const hours = Math.max(1, Math.min(24, Math.round(Number(b.hours) || 24)));
  const expires = now + hours * 3600000 - 60000;
  const hold = await insertEvent(env, env.CALENDAR_WRITE, {
    summary: `⏳ Paiement en cours — ${titleOf(q, c)}`,
    description: eventText(q, c, { date, time, mode, code, codeKind }),
    colorId: '8',
    start: { dateTime: new Date(span.start).toISOString(), timeZone: R.timeZone },
    end: { dateTime: new Date(span.end).toISOString(), timeZone: R.timeZone },
    extendedProperties: { private: { solarcarHold: '1', holdUntil: String(expires + 120000), atelier: '1' } },
  });
  const what = q.items.map((i) => i.label).join(' + ');
  const when = longDate(date, time);
  const site = String(env.SITE_URL || B.siteUrl).replace(/\/$/, '');
  let session;
  try {
    session = await createSession(env, {
      mode: 'payment',
      locale: 'fr',
      customer_email: c.email,
      line_items: [{ quantity: 1, price_data: { currency: 'eur', unit_amount: Math.round(due * 100), product_data: { name: `${mode === 'full' ? 'Règlement' : 'Acompte 30 %'} — ${what}`.slice(0, 250), description: `RDV le ${when} à l’atelier SOLAR CAR 37, Vouvray. Total ${euros(q.total)}${q.discount ? ` (code ${code} −${euros(q.discount)} déduit)` : ''}${mode === 'full' ? '' : `, reste ${euros(q.total - due)} à régler à l’atelier`}.` } } }],
      payment_intent_data: { description: `SOLAR CAR 37 — ${what} — ${when}`.slice(0, 250), receipt_email: c.email },
      expires_at: Math.floor(expires / 1000),
      success_url: `${site}/reservation/confirmee/?session={CHECKOUT_SESSION_ID}`,
      cancel_url: `${site}/`,
      metadata: { event: hold.id, date, time, mode, origin: 'atelier', config: configText, extra: extraText, customer: customerJson(c), ...(code ? { code, codeKind, discount: String(q.discount) } : {}) },
    });
  } catch (err) {
    await deleteEvent(env, env.CALENDAR_WRITE, hold.id).catch(() => {});
    console.error('[atelier] stripe', err.message);
    return { error: 'Stripe n’a pas pu créer le lien de paiement : réessayez dans un instant.' };
  }
  await patchEvent(env, env.CALENDAR_WRITE, hold.id, { extendedProperties: { private: { solarcarHold: '1', holdUntil: String(expires + 120000), session: session.id, atelier: '1' } } });
  const link = await db(env, 'link/add', { now, session: session.id, event: hold.id, date, time, minutes: q.minutes, items, total: q.total, due, mode, url: session.url, expires, customer: c });
  const mailed = await sendPaymentLink(env, { q, c, date, time, start: span.start, end: span.end, due, mode, url: session.url, expires, note, code, codeKind })
    .then(() => true)
    .catch((err) => (console.error('[mail] payment link', err.message), false));
  return { ok: true, id: link.id, url: session.url, mailed };
}

/** a link the workshop takes back: the payment page closed, the slot freed */
export async function atelierCancel(env, id) {
  const { link } = await db(env, 'link/get', { id });
  if (!link) return { error: 'Lien introuvable.' };
  if (link.status !== 'attente') return { error: 'Ce lien n’est plus en attente.' };
  if (link.session) {
    const sess = await getSession(env, link.session).catch(() => null);
    if (sess?.payment_status === 'paid') return { error: 'Le client vient de payer : le rendez-vous est confirmé.' };
    if (sess?.status === 'open') await expireSession(env, link.session).catch(() => {});
  }
  if (link.event) await deleteEvent(env, env.CALENDAR_WRITE, link.event).catch(() => {});
  await db(env, 'link/status', { id, status: 'annule' });
  return { ok: true };
}

async function booking(req, env, url) {
  const id = url.searchParams.get('session') || '';
  if (!/^cs_[A-Za-z0-9_]+$/.test(id)) return json({ error: 'Réservation inconnue' }, 400, cors(req, env));
  const s = await getSession(env, id).catch(() => null);
  if (!s) return json({ error: 'Réservation inconnue' }, 404, cors(req, env));
  const m = s.metadata || {};
  const q = priced(m);
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
      discount: q.discount || 0,
      code: m.code || '',
      codeKind: m.code ? m.codeKind || 'parrainage' : '',
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
  // the client file: clients without any contact for 3 years are removed (CNIL guidance)
  if (env.ATELIER) out.purged = (await db(env, 'clients/purge', { now }).catch(() => ({ removed: 0 }))).removed;
  // the quotes left without news from the client: « Sans suite » (booking/store.js, age)
  if (env.ATELIER) out.closed = (await db(env, 'quotes/age', { now }).catch(() => ({ closed: 0 }))).closed;
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
        const q = priced(m);
        const c = JSON.parse(m.customer || '{}');
        if (q.error || !c.email) continue;
        const at = utcToZoned(start, R.timeZone);
        // a week after: the client's own referral code (a gift card to give), the same one if the
        // e-mail is sent again
        const referral = job.flag === 'followedUp' && env.ATELIER ? await referralFor(env, { owner: c.firstName, email: c.email, origin: p.session }, now).catch((err) => (console.error('[parrainage]', err.message), null)) : null;
        await job.send(env, { q, c, date: at.date, time: at.time, end: Date.parse(ev.end.dateTime), paid: (session.amount_total || 0) / 100, referral });
        await patchEvent(env, env.CALENDAR_WRITE, ev.id, { extendedProperties: { private: { ...p, [job.flag]: String(now) } } });
        out[job.count]++;
      } catch (err) {
        console.error(`[mail] ${job.flag}`, ev.id, err.message);
      }
    }
  }
  return out;
}

/** GET /api/code?code=…: is this code valid, a promotion or a referral code (the booking page
 *  shows the discount); never the referrer's e-mail */
async function codeCheck(req, env, url, now) {
  const h = cors(req, env);
  if (!h['access-control-allow-origin']) return json({ error: 'Origine refusée' }, 403, h);
  if (!env.ATELIER) return json({ ok: false, error: 'Les codes ne sont pas encore acceptés en ligne.' }, 200, h);
  const r = await checkCode(env, url.searchParams.get('code') || '', now);
  if (!r.ok) return json({ ok: false, error: r.error }, 200, h);
  return json({ ok: true, kind: r.kind, code: r.code, label: r.label, owner: r.owner, amount: r.amount, percent: r.percent, services: r.services, expires: r.expires }, 200, h);
}

/** GET /api/promo: the promotion band of the site (cached a few minutes by the browser);
 *  ?apercu=<id>: that band whatever its dates (preview from the workshop's space) */
async function promoBand(req, env, url, now) {
  const h = cors(req, env);
  const id = (url.searchParams.get('apercu') || '').slice(0, 60);
  const r = env.ATELIER ? await db(env, 'banner/public', { now, id }).catch(() => ({ banner: null })) : { banner: null };
  return json(r, 200, { ...h, 'cache-control': id ? 'no-store' : 'public, max-age=300' });
}

/** POST /api/demande: a quote request sent from the site's form. Read, checked and e-mailed by the
 *  workshop's database (booking/store.js, quote/submit; its photos are too heavy for this worker's
 *  share of computing time). From the site's script: JSON in, { ok, … } out. The form posted
 *  without JavaScript: the thank-you page, or a short page saying it did not go through. */
async function quoteRequest(req, env, now) {
  const h = cors(req, env);
  const type = req.headers.get('content-type') || '';
  const native = /multipart\/form-data|application\/x-www-form-urlencoded/i.test(type);
  const site = (env.SITE_URL || B.siteUrl).replace(/\/$/, '');
  const failed = (status, why = '') =>
    new Response(
      `<!doctype html><html lang="fr"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Demande non envoyée</title><body style="font-family:Arial,Helvetica,sans-serif;max-width:560px;margin:40px auto;padding:0 16px;line-height:1.5"><h1>Votre demande n’est pas partie</h1><p>${why ? why.replace(/[<>&"]/g, '') : 'L’envoi n’a pas abouti.'} Revenez en arrière pour la ${why ? 'compléter' : 'renvoyer dans un instant'}, ou appelez-nous au <a href="tel:${B.phone.replace(/[^\d+]/g, '')}">${B.phone}</a>.</p><p><a href="${site}/contact/">Retour au formulaire</a></p></body></html>`,
      { status, headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' } }
    );
  // from another site, or no database: nothing done
  if (!h['access-control-allow-origin'] || !env.ATELIER) return native ? failed(403) : new Response(null, { status: 204, headers: h });
  if (Number(req.headers.get('content-length')) > 15 * 1024 * 1024) return native ? failed(413) : json({ ok: false, error: 'Pièces jointes trop lourdes : 10 Mo maximum au total.' }, 413, h);
  const res = await env.ATELIER.get(env.ATELIER.idFromName('solarcar37')).fetch('https://atelier/quote/submit', { method: 'POST', headers: { 'content-type': type, 'x-now': String(now) }, body: await req.arrayBuffer() });
  const out = res.ok ? await res.json() : { ok: false, status: 502, error: 'L’envoi n’a pas abouti.' };
  if (native) return out.ok ? Response.redirect(`${site}/contact/merci/`, 303) : failed(out.status || 502, out.status === 400 || out.status === 413 ? out.error : '');
  // a copy sent by an older page of the site: written, silently
  if (out.silent) return new Response(null, { status: 204, headers: h });
  const { status, ...body } = out;
  return json(body, out.ok ? 200 : status || 502, h);
}

/** GET /api/devis?n=&t=: the quote a link of an e-mail is about (number, vehicle, amount, status) */
async function quotePublic(req, env, url) {
  const h = cors(req, env);
  if (!env.ATELIER) return json({ ok: false, error: 'Indisponible.' }, 503, h);
  const r = await db(env, 'quote/public', { n: Number(url.searchParams.get('n')) || 0, t: url.searchParams.get('t') || '' });
  return json(r, r.ok ? 200 : 404, h);
}

/** POST /api/devis/accepter { n, t } (plain text JSON): the quote accepted, the workshop told */
async function quoteAccept(req, env, now) {
  const h = cors(req, env);
  if (!h['access-control-allow-origin']) return json({ ok: false, error: 'Origine refusée.' }, 403, h);
  if (!env.ATELIER) return json({ ok: false, error: 'Indisponible.' }, 503, h);
  let b = {};
  try {
    b = JSON.parse((await req.text()).slice(0, 2000));
  } catch {}
  const r = await db(env, 'quote/accept', { n: Number(b.n) || 0, t: String(b.t || ''), now });
  const { status, ...body } = r;
  return json(body, r.ok ? 200 : status || 400, h);
}

/** an e-mail to the quote discussions' address (Cloudflare Email Routing → this worker): read,
 *  kept and passed on by the workshop's database (booking/store.js, mail/in) */
async function quoteMail(message, env) {
  if (!env.ATELIER) return message.setReject('Adresse indisponible.');
  if (message.rawSize > 25 * 1024 * 1024) return message.setReject('Message trop volumineux : 25 Mo au plus.');
  const raw = await new Response(message.raw).arrayBuffer();
  const auth = ['authentication-results', 'arc-authentication-results']
    .map((k) => message.headers.get(k))
    .filter(Boolean)
    .join('\n');
  const res = await env.ATELIER.get(env.ATELIER.idFromName('solarcar37')).fetch('https://atelier/mail/in', { method: 'POST', headers: { 'x-now': String(Date.now()), 'x-mail-from': message.from || '', 'x-auth': encodeURIComponent(auth) }, body: raw });
  const out = res.ok ? await res.json() : { ok: false, reject: 'Erreur temporaire : réessayez plus tard.' };
  if (!out.ok && out.reject) message.setReject(out.reject);
  return out;
}

export default {
  /** the replies to the quote discussions (docs/RESERVATION.md, « Discussions ») */
  async email(message, env) {
    await quoteMail(message, env).catch((err) => {
      console.error('[mail] in', err.message);
      message.setReject('Erreur temporaire : réessayez plus tard.');
    });
  },

  /** Tuesdays: the photo of the week on the Google Business Profile; every day: the reminders and
   *  news of the clients; the 1st of each month: the statistics e-mail of the month that just ended */
  async scheduled(controller, env, ctx) {
    if (controller.cron === FICHE_CRON) {
      ctx.waitUntil(runFiche(env, controller.scheduledTime).then((r) => console.log('[fiche] weekly', JSON.stringify(r))).catch((err) => console.error('[fiche] weekly', err)));
      return;
    }
    if (controller.cron === '0 16 * * *') {
      // the clients' e-mails, and the quotes' e-mails in Gmail (even on a day the space is not opened)
      ctx.waitUntil(
        Promise.all([
          dailyMails(env, controller.scheduledTime).then((r) => console.log('[mail] daily', JSON.stringify(r))).catch((err) => console.error('[mail] daily', err)),
          gmailSync(env, controller.scheduledTime, { force: true }).catch((err) => console.error('[gmail] daily', err)),
        ])
      );
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
      if (req.method === 'GET' && (url.pathname === '/api/code' || url.pathname === '/api/referral')) return await codeCheck(req, env, url, now);
      if (req.method === 'GET' && url.pathname === '/api/promo') return await promoBand(req, env, url, now);
      if (req.method === 'POST' && url.pathname === '/api/demande') return await quoteRequest(req, env, now);
      // the client accepts a quote (www.solarcar37.fr/devis/): what it is, then « J'accepte »
      if (url.pathname === '/api/devis' && req.method === 'GET') return await quotePublic(req, env, url);
      if (url.pathname === '/api/devis/accepter' && req.method === 'POST') return await quoteAccept(req, env, now);
      if (url.pathname === '/atelier' || url.pathname.startsWith('/atelier/')) return await atelier(req, env, url, now);
      // atelier.solarcar37.fr: the workshop's space only (its address bar shows /atelier…)
      if (url.hostname.startsWith('atelier.') && !/^\/(stats|api|fiche-google)(\/|$)/.test(url.pathname)) return new Response(null, { status: 302, headers: { location: '/atelier' } });
      // the first referral page: now in the workshop's space
      if (url.pathname === '/parrainage') return new Response(null, { status: 302, headers: { location: '/atelier/codes' } });
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
