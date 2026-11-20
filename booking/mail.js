/**
 * E-mails of a confirmed booking, sent through Resend (resend.com, plain fetch):
 *   - to the workshop (env.NOTIFY_TO): « Nouveau RDV », who, when, what, paid and still due;
 *   - to the client (when env.MAIL_CLIENTS is "1", once the sending domain is verified): the
 *     confirmation, with the address, what is left to pay, the cancellation terms and the
 *     appointment as an .ics file for their calendar.
 * env.RESEND_API_KEY (secret), env.MAIL_FROM ("SOLAR CAR 37 <reservation@solarcar37.fr>").
 * A failed e-mail never fails the booking: the appointment is in the calendar all the same.
 */
import { business as B } from '../content/site.js';
import { bookingRules as R, formatDuration, discountLines, CANALS, canalLead } from '../content/booking.js';
import { vatNote } from '../content/pricing.js';
import { premium as P } from '../content/offers.js';

const euros = (n) => `${n.toFixed(2).replace('.', ',').replace(',00', '')} €`;
const esc = (s = '') => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const hour = (t) => t.replace(/^0/, '').replace(':', ' h ');
const dayLabel = (date) => new Intl.DateTimeFormat('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${date}T12:00:00Z`));
const address = `${B.address.street}, ${B.address.postalCode} ${B.address.city}`;
const route = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(`${B.name}, ${address}`)}`;

/** the appointment as an iCalendar file (UTC times) */
function ics({ id, start, end, title, text }) {
  const stamp = (ms) => new Date(ms).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  const t = (s) => s.replace(/[\\,;]/g, (c) => '\\' + c).replace(/\n/g, '\\n');
  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//SOLAR CAR 37//Reservation//FR',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${id}@solarcar37.fr`,
    `DTSTAMP:${stamp(Date.now())}`,
    `DTSTART:${stamp(start)}`,
    `DTEND:${stamp(end)}`,
    `SUMMARY:${t(title)}`,
    `LOCATION:${t(`${B.name}, ${address}`)}`,
    `DESCRIPTION:${t(text)}`,
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n');
}

/** the discount lines of an e-mail: for the workshop « Parrainage −20 € (code MARIE-7K2QX) », for
 *  the client « Code NOEL −40 € » or « Parrainage −20 € »; the workshop's own « Remise » apart */
const discountRows = (q, b, forWorkshop) =>
  discountLines(q.discount, b).map(([label, off]) => {
    if (label === 'Remise') return ['Remise', `−${euros(off)}`];
    if (label === 'Carte Premium') return ['Carte Premium', forWorkshop ? `−${euros(off)} (n° ${esc(b.code || '')})` : `−${euros(off)} (−${P.percent} %)`];
    const promo = label.startsWith('Code promo');
    if (forWorkshop) return [promo ? 'Code promo' : 'Parrainage', `−${euros(off)} (code ${esc(b.code || '')})`];
    return [promo ? `Code ${esc(b.code || '')}` : 'Parrainage', `−${euros(off)}`];
  });
const rows = (pairs) =>
  pairs
    .filter(([, v]) => v)
    .map(([k, v]) => `<tr><td style="padding:6px 12px 6px 0;color:#6b6b6b;white-space:nowrap;vertical-align:top">${esc(k)}</td><td style="padding:6px 0;color:#111;font-weight:600">${v}</td></tr>`)
    .join('');
export const shell = (title, body) => `<!doctype html><html lang="fr"><body style="margin:0;background:#f4f2ee;font-family:Arial,Helvetica,sans-serif">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f2ee;padding:24px 12px"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:14px;overflow:hidden">
<tr><td style="background:#0b0c0f;padding:18px 24px"><img src="${String(R.api || '').replace(/\/$/, '')}/atelier/logo.png" width="140" height="54" alt="SOLAR CAR 37" style="display:block;border:0;width:140px;height:auto;color:#e9cd82;font-size:18px;font-weight:800;letter-spacing:.08em"></td></tr>
<tr><td style="padding:24px"><h1 style="margin:0 0 16px;font-size:20px;color:#111">${esc(title)}</h1>${body}</td></tr>
<tr><td style="padding:16px 24px;background:#faf8f4;color:#6b6b6b;font-size:12px">${esc(B.name)} · ${esc(address)} · ${esc(B.phone)}</td></tr>
</table></td></tr></table></body></html>`;

// ---------------------------------------------------------------- the clients' appointment e-mails (18 November 2026)
// One centred card, 600 px wide at most (a computer's large screen keeps it the size of a letter,
// a phone gives it its whole width): a black band with the logo, a badge of the state, the date in
// large type; then the services with their prices, a gold box with what is paid and what is left,
// the button, the practical details. Tables and inline styles only (what every mail app reads).
const TONES = { wait: ['#3a2e12', '#f1dca2'], ok: ['#163625', '#8fdcaa'], info: ['#1c2a40', '#a8c8ff'] };
const LOGO = () => `${String(R.api || '').replace(/\/$/, '')}/atelier/logo.png`;
const capFr = (t) => String(t).charAt(0).toUpperCase() + String(t).slice(1);
/** the frame: { badge: [text, tone], kicker, big, sub } over the dark band, then the body */
export const card = ({ badge, kicker = '', big = '', sub = '' }, body) => `<!doctype html><html lang="fr"><head><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"><meta name="supported-color-schemes" content="light"></head><body style="margin:0;padding:0;background:#ece8e1;font-family:Arial,Helvetica,sans-serif;-webkit-text-size-adjust:100%">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#ece8e1"><tr><td align="center" style="padding:28px 12px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%">
<tr><td style="background:#0b0c0f;border-radius:22px 22px 0 0;padding:26px 30px 0"><img src="${LOGO()}" width="150" height="58" alt="SOLAR CAR 37" style="display:block;border:0;width:150px;height:auto;color:#e9cd82;font-size:18px;font-weight:800;letter-spacing:.08em"></td></tr>
<tr><td style="background:#0b0c0f;padding:22px 30px 30px;border-bottom:3px solid #c9a24f">${badge ? `<span style="display:inline-block;padding:6px 13px;border-radius:999px;background:${TONES[badge[1]][0]};color:${TONES[badge[1]][1]};font-size:12px;font-weight:700;letter-spacing:.04em">${esc(badge[0])}</span>` : ''}
${kicker ? `<p style="margin:18px 0 0;font-size:12px;font-weight:700;letter-spacing:.16em;text-transform:uppercase;color:#c9a24f">${esc(kicker)}</p>` : ''}${big ? `<p style="margin:6px 0 0;font-size:28px;line-height:1.2;font-weight:700;color:#f6f2ea">${big}</p>` : ''}${sub ? `<p style="margin:6px 0 0;font-size:19px;line-height:1.35;color:#e9cd82">${sub}</p>` : ''}</td></tr>
<tr><td style="background:#ffffff;padding:28px 30px 30px;color:#111;font-size:15px;line-height:1.55">${body}</td></tr>
<tr><td style="background:#f7f4ee;border-radius:0 0 22px 22px;padding:20px 30px;color:#77736b;font-size:12px;line-height:1.6"><b style="color:#3b3833">${esc(B.name)}</b> · ${esc(address)}<br><a href="tel:${esc(B.phone.replace(/[^\d+]/g, ''))}" style="color:#77736b;text-decoration:none">${keep(B.phone)}</a> · <a href="${esc(B.siteUrl)}" style="color:#9a7a2c;text-decoration:none">${esc(String(B.siteUrl).replace(/^https?:\/\//, ''))}</a></td></tr>
</table></td></tr></table></body></html>`;
/** the day and the time of the appointment, for the band */
const bandWhen = (date, time, end) => ({ big: esc(capFr(dayLabel(date))), sub: `${keep(hour(time))}${end ? ` – ${keep(endOf(end))}` : ''}` });
/** a section title in the body */
const h2 = (t) => `<p style="margin:26px 0 8px;font-size:12px;font-weight:700;letter-spacing:.14em;text-transform:uppercase;color:#9a7a2c">${esc(t)}</p>`;
/** the services, each with its price on the right */
const services = (items) => `${h2('Vos prestations')}<table role="presentation" width="100%" cellpadding="0" cellspacing="0">${items
  .map((i) => `<tr><td style="padding:12px 12px 12px 0;border-bottom:1px solid #ece8e1;vertical-align:top"><b style="font-size:15px;color:#111">${esc(i.label)}</b>${i.added ? ` <span style="display:inline-block;margin-left:4px;padding:2px 8px;border-radius:999px;background:#fbf6ea;border:1px solid #ecdcb5;color:#9a7a2c;font-size:11px;font-weight:700;vertical-align:2px">Ajouté</span>` : ''}${i.detail ? `<br><span style="font-size:13px;color:#77736b">${esc(i.detail)}</span>` : ''}</td><td align="right" style="padding:12px 0;border-bottom:1px solid #ece8e1;vertical-align:top;white-space:nowrap;font-weight:700;color:#111">${euros(Number(i.price) || 0)}</td></tr>`)
  .join('')}</table>`;
/** the gold box: [label, value, strong] rows; the strong one bigger */
const moneyBox = (lines, foot = '') => `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:18px 0 0;background:#fbf6ea;border:1px solid #ecdcb5;border-radius:16px"><tr><td style="padding:14px 18px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0">${lines
  .filter(([, v]) => v)
  .map(([k, v, strong]) => `<tr><td style="padding:6px 12px 6px 0;color:${strong ? '#111' : '#6b675f'};font-size:${strong ? 16 : 14}px;${strong ? 'font-weight:700;' : ''}white-space:nowrap;vertical-align:middle">${esc(k)}</td><td align="right" style="padding:6px 0;color:#111;font-size:14px;font-weight:600;vertical-align:middle">${v}</td></tr>`)
  .join('')}</table>${foot ? `<p style="margin:8px 0 0;font-size:11px;color:#8a857c">${esc(foot)}</p>` : ''}</td></tr></table>`;
/** the call to act, large enough for a thumb */
const action = (href, label) => `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:24px 0 6px"><tr><td style="border-radius:999px;background:#0b0c0f"><a href="${esc(href)}" style="display:inline-block;padding:16px 28px;border-radius:999px;font-size:16px;font-weight:700;color:#e9cd82;text-decoration:none">${esc(label)}</a></td></tr></table>`;
/** where, and the car */
const practical = (c, withPlace = true) => `${h2('Infos pratiques')}<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="font-size:14px">${[
  withPlace && ['Adresse', `${esc(address)}<br><a href="${route}" style="color:#9a7a2c;font-weight:700;text-decoration:none">Itinéraire →</a>`],
  c?.vehicle && ['Véhicule', esc(`${c.vehicle}${c.plate ? ` (${c.plate})` : ''}`)],
]
  .filter(Boolean)
  .map(([k, v]) => `<tr><td style="padding:6px 14px 6px 0;color:#77736b;white-space:nowrap;vertical-align:top">${k}</td><td style="padding:6px 0;color:#111;font-weight:600">${v}</td></tr>`)
  .join('')}</table>`;
const tel = () => keep(B.phone);
/** « suite à notre appel téléphonique », « suite à notre échange par e-mail », « suite à votre venue à l’atelier » */
const leadOf = (canal) => (canalLead[canal] ? canalLead[canal].charAt(0).toLowerCase() + canalLead[canal].slice(1) : '');
/** how what is already paid was paid: online (Stripe) or by card at the workshop */
const paidLabel = (mode) => (mode === 'tpe' ? 'Acompte réglé à l’atelier' : 'Payé en ligne');
const small = (t) => `<p style="margin:14px 0 0;font-size:13px;line-height:1.55;color:#77736b">${t}</p>`;
const intro = (t) => `<p style="margin:0 0 4px;font-size:15px;line-height:1.6;color:#111;white-space:pre-wrap">${t}</p>`;

export async function send(env, mail) {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { authorization: `Bearer ${env.RESEND_API_KEY}`, 'content-type': 'application/json' },
    body: JSON.stringify({ from: env.MAIL_FROM || `${B.name} <onboarding@resend.dev>`, ...mail }),
  });
  if (!res.ok) throw new Error(`resend ${res.status} ${(await res.text()).slice(0, 200)}`);
  return (await res.json().catch(() => ({}))).id || '';
}

/**
 * b: { q (quote), c (customer), date, time, start, end (UTC ms), mode, paid, sessionId }
 * Returns the list of e-mails sent ('workshop', 'client').
 */
const endOf = (end) => new Intl.DateTimeFormat('fr-FR', { hour: 'numeric', minute: '2-digit', timeZone: R.timeZone }).format(new Date(end)).replace(':', ' h ');
/** « Quand » of the e-mails: the day on a line, the time on the next one, never cut (« 8 h 00 ») */
const keep = (t) => esc(t).replace(/ /g, '\u00a0');
const whenHtml = (date, time, end) => `${esc(dayLabel(date))}<br>${keep(hour(time))}${end ? ` – ${keep(endOf(end))}` : ''}`;
/** what is paid in gold; what is left to pay in gold, bold and a little bigger (18 November 2026) */
const gold = (v) => `<span style="color:#a87b1f">${v}</span>`;
const goldStrong = (v) => `<span style="color:#a87b1f;font-weight:800;font-size:16px">${v}</span>`;
const itemsOf = (q) => q.items.map((i) => `${esc(i.label)}<br><span style="font-weight:400;color:#6b6b6b">${[i.detail ? esc(i.detail) : '', euros(i.price)].filter(Boolean).join(' · ')}</span>`).join('<br>');
const button = (href, label) => `<a href="${esc(href)}" style="display:inline-block;background:#0b0c0f;color:#e9cd82;text-decoration:none;font-weight:700;padding:12px 20px;border-radius:999px">${esc(label)}</a>`;

/** the first words of the confirmation: the site's booking; or one taken by the workshop, after
 *  the way it was taken (« suite à notre échange par e-mail, votre acompte de 117 € est bien reçu ») */
function confirmWords(b, paid) {
  const lead = leadOf(b.canal);
  if (!lead) return 'merci pour votre réservation : votre créneau vous est réservé à l’atelier.';
  if (b.mode === 'deposit' || b.mode === 'full') return `${lead}, votre ${b.mode === 'full' ? 'règlement' : 'acompte'} de ${euros(paid)} est bien reçu : votre rendez-vous est confirmé, le créneau vous est réservé à l’atelier.`;
  return `${lead}, votre rendez-vous est confirmé : le créneau vous est réservé à l’atelier.`;
}

export async function sendBookingMails(env, b) {
  if (!env.RESEND_API_KEY) return [];
  const { q, c, date, time, start, end, paid } = b;
  const due = Math.max(0, q.total - paid);
  const items = itemsOf(q);
  const sent = [];
  // the workshop
  if (env.NOTIFY_TO) {
    try {
      await send(env, {
        to: env.NOTIFY_TO.split(',').map((x) => x.trim()),
        reply_to: c.email,
        subject: `Nouveau RDV — ${c.firstName} ${c.lastName} — ${dayLabel(date).replace(/ \d{4}$/, '')} à ${hour(time)}`,
        html: shell(
          // « réservé en ligne » (the site, a gift card, a Premium member), « pris par e-mail · acompte
          // payé en ligne », « pris à l’atelier · acompte réglé au TPE » (the space)
          CANALS[b.canal] ? `Nouveau rendez-vous pris ${CANALS[b.canal]}${b.mode === 'none' ? '' : b.mode === 'tpe' ? ' · acompte réglé au TPE' : ` · ${b.mode === 'full' ? 'payé' : 'acompte payé'} en ligne`}` : `Nouveau rendez-vous réservé en ligne${b.gift?.amount ? ' · carte cadeau' : ''}${b.member ? ' · membre Premium' : ''}`,
          `<table role="presentation" cellpadding="0" cellspacing="0" style="font-size:14px">${rows([
            ['Quand', whenHtml(date, time, end)],
            ['Client', esc(`${c.firstName} ${c.lastName}`)],
            ['Téléphone', `<a href="tel:${esc(c.phone.replace(/[^\d+]/g, ''))}" style="color:#111">${esc(c.phone)}</a>`],
            ['E-mail', `<a href="mailto:${esc(c.email)}" style="color:#111">${esc(c.email)}</a>`],
            ['Véhicule', esc(`${c.vehicle}${c.plate ? ` (${c.plate})` : ''}`)],
            ['Prestations', items],
            ...discountRows(q, b, true),
            ['Total', euros(q.total)],
            ['Carte cadeau', b.gift?.amount ? `${euros(b.gift.amount)} (carte ${esc(b.gift.code)})` : ''],
            [b.mode === 'tpe' ? 'Réglé au TPE' : 'Payé en ligne', b.mode === 'none' || !(paid - (b.gift?.amount || 0) > 0) ? '' : gold(`${euros(paid - (b.gift?.amount || 0))} (${b.mode === 'tpe' ? 'acompte en CB à l’atelier' : b.mode === 'full' ? 'totalité' : 'acompte 30 %'})`)],
            ['Reste à régler', due ? euros(due) : 'rien'],
            ['Nous a connus', c.source ? esc(c.source) : ''],
            ['Message', c.message ? esc(c.message) : ''],
          ])}</table><p style="margin:18px 0 0;font-size:13px;color:#6b6b6b">Le rendez-vous est dans l’agenda SOLAR CAR 37. Répondre à cet e-mail écrit au client.</p>`
        ),
      });
      sent.push('workshop');
    } catch (err) {
      console.error('[mail] workshop', err.message);
    }
  }
  // the client (an appointment taken by the workshop may have no e-mail address)
  if (env.MAIL_CLIENTS === '1' && b.clientMail !== false && c.email) {
    try {
      const title = `${B.name} — ${q.items.map((i) => i.label).join(' + ')}`;
      await send(env, {
        to: [c.email],
        reply_to: B.email,
        subject: `Votre rendez-vous du ${dayLabel(date).replace(/ \d{4}$/, '')} à ${hour(time)} est confirmé`,
        html: card(
          { badge: ['Rendez-vous confirmé', 'ok'], kicker: 'Votre rendez-vous', ...bandWhen(date, time, end) },
          `${intro(b.note ? esc(b.note) : `Bonjour ${esc(c.firstName)},\n${confirmWords(b, paid)}`)}
${services(q.items)}
${moneyBox([...discountRows(q, b, false), ['Total', euros(q.total)], ['Carte cadeau', b.gift?.amount ? gold(euros(b.gift.amount)) : ''], [paidLabel(b.mode), b.mode === 'none' || !(paid - (b.gift?.amount || 0) > 0) ? '' : gold(euros(paid - (b.gift?.amount || 0)))], ['À régler à l’atelier', goldStrong(due ? euros(due) : 'rien'), true]], vatNote)}
${practical(c)}
${small('La teinte se choisit avec vous à l’atelier, le jour du rendez-vous. Prévoyez de déposer le véhicule à l’heure indiquée.')}
${small(b.mode === 'none' ? `Un empêchement ? Prévenez-nous au plus vite au ${tel()}.` : `Un empêchement ? Prévenez-nous au moins ${R.cancelHours} h avant au ${tel()} : l’acompte vous est remboursé ou reporté. En dessous de ${R.cancelHours} h, il reste acquis à l’atelier (<a href="${esc(env.SITE_URL || B.siteUrl)}/conditions-reservation/" style="color:#9a7a2c">conditions de réservation</a>).`)}
${small('Le rendez-vous est joint à cet e-mail : ouvrez le fichier pour l’ajouter à votre agenda.')}`
        ),
        attachments: [
          {
            filename: 'rendez-vous-solar-car-37.ics',
            content: btoa(unescape(encodeURIComponent(ics({ id: b.sessionId, start, end, title, text: `${b.gift?.amount ? `Carte cadeau : ${euros(b.gift.amount)}. ` : ''}${b.mode === 'none' || !(paid - (b.gift?.amount || 0) > 0) ? '' : `${paidLabel(b.mode)} : ${euros(paid - (b.gift?.amount || 0))}. `}Reste à régler : ${euros(due)}. ${B.phone}` })))),
          },
        ],
      });
      sent.push('client');
    } catch (err) {
      console.error('[mail] client', err.message);
    }
  }
  return sent;
}

/**
 * An appointment taken by the workshop (on the phone): the client gets the recap and the button to
 * pay the deposit (or the whole) online, which confirms the slot, held until `expires`.
 * b: { q, c, date, time, end, due, mode, url, expires, note, code, codeKind, remise }
 */
export async function sendPaymentLink(env, b) {
  if (!env.RESEND_API_KEY) throw new Error('mail not set');
  const { q, c, date, time, end, due, mode, url, expires, note } = b;
  const until = new Intl.DateTimeFormat('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', hour: 'numeric', minute: '2-digit', timeZone: R.timeZone }).format(new Date(expires)).replace(':', ' h ');
  const what = mode === 'full' ? 'le règlement' : 'l’acompte de 30 %';
  await send(env, {
    to: [c.email],
    reply_to: B.email,
    subject: `Votre rendez-vous du ${dayLabel(date).replace(/ \d{4}$/, '')} à ${hour(time)} : confirmez-le en ligne`,
    html: card(
      { badge: [mode === 'full' ? 'En attente de votre règlement' : 'En attente de votre acompte', 'wait'], kicker: 'Votre rendez-vous', ...bandWhen(date, time, end) },
      `${intro(note ? esc(note) : `Bonjour ${esc(c.firstName)},\n${leadOf(b.canal) || 'comme convenu'}, voici votre rendez-vous à l’atelier. Il est confirmé dès que ${what} est réglé en ligne.`)}
${action(url, `Régler ${euros(due)} et confirmer`)}
${small(`Paiement sécurisé par Stripe. Le créneau vous est gardé jusqu’au ${esc(until)} ; passé ce délai, il est libéré : rappelez-nous au ${tel()}.`)}
${services(q.items)}
${moneyBox([...discountRows(q, b, false), ['Total', euros(q.total)], [mode === 'full' ? 'À régler en ligne' : 'Acompte en ligne', euros(due)], ['À régler à l’atelier', goldStrong(q.total - due > 0 ? euros(q.total - due) : 'rien'), true]], vatNote)}
${practical(c)}
${small(`L’acompte est remboursé ou reporté si vous prévenez au moins ${R.cancelHours} h avant le rendez-vous (<a href="${esc(env.SITE_URL || B.siteUrl)}/conditions-reservation/" style="color:#9a7a2c">conditions de réservation</a>).`)}`
    ),
  });
}

/**
 * An appointment changed at the workshop (services added): the client gets the new recap and what
 * is left to pay at the workshop. b: { c: { firstName, email, vehicle }, date, time, items, total, paid,
 * preview: the workshop's addresses to send it to instead of the client (« M'envoyer un aperçu »),
 * note: the workshop's word, pay: { url, amount, expires } a deposit asked for the services added }
 */
export async function sendBookingUpdate(env, b) {
  const { c, date, time, items, total, paid, preview, note, pay } = b;
  const due = Math.max(0, Math.round((total - paid) * 100) / 100);
  await send(env, {
    to: preview?.length ? preview : [c.email],
    reply_to: B.email,
    subject: `${preview?.length ? '[Aperçu] ' : ''}Votre rendez-vous du ${dayLabel(date).replace(/ \d{4}$/, '')} : récapitulatif mis à jour`,
    html: card(
      { badge: ['Rendez-vous mis à jour', 'info'], kicker: 'Votre rendez-vous', ...bandWhen(date, time) },
      `${preview?.length ? `<p style="margin:0 0 18px;padding:12px 14px;border-radius:12px;background:#fff4d6;color:#7a5a00;font-size:13px">Aperçu pour l’atelier : rien n’a été enregistré ni envoyé à ${esc(c.email || 'au client')}. Voici l’e-mail qu’il recevra.</p>` : ''}${intro(note ? esc(note) : `Bonjour ${esc(c.firstName || '')},\ncomme convenu, voici le récapitulatif de votre rendez-vous avec les prestations ajoutées.`)}
${pay ? `${action(pay.url, `Régler l’acompte de ${euros(pay.amount)}`)}${small(`Paiement sécurisé par Stripe, possible jusqu’au ${esc(new Intl.DateTimeFormat('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', hour: 'numeric', minute: '2-digit', timeZone: R.timeZone }).format(new Date(pay.expires)).replace(':', ' h '))}.`)}` : ''}
${services(items)}
${moneyBox([['Total', euros(total)], ['Déjà réglé', paid ? gold(euros(paid)) : ''], ['Acompte demandé', pay ? euros(pay.amount) : ''], ['À régler à l’atelier', pay ? `${goldStrong(euros(Math.max(0, due - pay.amount)))} après l’acompte` : goldStrong(due ? euros(due) : 'rien, tout est réglé'), true]], vatNote)}
${practical(c)}
${small(`Une question ? Répondez à cet e-mail ou appelez-nous au ${tel()}.`)}`
    ),
  });
}

/**
 * The day before: a reminder to the client (sent by the daily job of booking/worker.js, only when
 * env.MAIL_CLIENTS is "1"). b: { q, c, date, time, end, paid } with the appointment's current
 * time in the calendar (it may have been moved by the workshop).
 */
export async function sendReminderMail(env, b) {
  const { q, c, date, time, end, paid } = b;
  const due = Math.max(0, q.total - paid);
  await send(env, {
    to: [c.email],
    reply_to: B.email,
    subject: `Rappel : votre rendez-vous demain à ${hour(time)} chez ${B.name}`,
    html: card(
      { badge: ['C’est demain', 'wait'], kicker: 'À demain à l’atelier', ...bandWhen(date, time, end) },
      `${intro(`Bonjour ${esc(c.firstName)},\npetit rappel : nous vous attendons demain à l’atelier${c.vehicle ? ` avec votre ${esc(c.vehicle)}` : ''}.`)}
${services(q.items)}
${moneyBox([['À régler à l’atelier', goldStrong(due ? euros(due) : 'rien, tout est réglé'), true]])}
${practical(c, true)}
${small('Prévoyez de déposer le véhicule à l’heure indiquée. La teinte se choisit avec vous sur place.')}
${small(`Un empêchement ou un retard ? Prévenez-nous au plus vite au <a href="tel:${esc(B.phone.replace(/[^\d+]/g, ''))}" style="color:#9a7a2c">${tel()}</a> ou en répondant à cet e-mail.`)}`
    ),
  });
}

/**
 * A week after: news of the client, and the Google review link (sent by the daily job, only when
 * env.MAIL_CLIENTS is "1"). A problem is to be told first, by replying: the workshop handles it.
 * The review link is given to every client alike (Google forbids asking only satisfied ones).
 */
export async function sendFollowUpMail(env, b) {
  const { q, c } = b;
  // « vitres teintées (3/4 arrière) et feux teintés (feux arrière) »
  const what = q.items
    .map((i) => {
      const [name, part] = i.label.split(' — ');
      return part ? `${name.toLowerCase()} (${part.toLowerCase()})` : name.toLowerCase();
    })
    .join(' et ');
  const me = (B.owner || '').split(' ')[0] || B.name;
  const p = (html, last = false) => `<p style="margin:0 0 ${last ? 18 : 14}px;font-size:15px;line-height:1.5;color:#111">${html}</p>`;
  // no Google review link here (21 November 2026): the workshop reads the answer, then asks for
  // the review by hand when it went well (sendReviewRequest)
  await send(env, {
    to: [c.email],
    reply_to: B.email,
    subject: c.vehicle ? `Des nouvelles de votre ${c.vehicle} ?` : `Tout va bien depuis votre passage chez ${B.name} ?`,
    html: shell(
      'Tout se passe bien ?',
      `${p(`Bonjour ${esc(c.firstName)},`)}
${p(`Cela fait une semaine que nous nous sommes occupés de votre ${esc(c.vehicle || 'véhicule')} : ${esc(what)}. Je voulais simplement prendre de vos nouvelles, et j’espère que le résultat vous plaît autant qu’à nous !`)}
${p(`Si quelque chose vous chiffonne, ou si vous avez la moindre question, <strong>répondez simplement à cet e-mail</strong> ou appelez-moi au <a href="tel:${esc(B.phone.replace(/[^\d+]/g, ''))}" style="color:#9a7a2c">${esc(B.phone)}</a> : ce sera avec grand plaisir, et nous trouverons une solution ensemble.`)}
<p style="margin:20px 0 0;font-size:15px;line-height:1.5;color:#111">Merci encore pour votre confiance, et à très bientôt à l’atelier,<br><strong>${esc(me)}</strong> — ${esc(B.name)}</p>
${b.referral?.code ? giftCard(env, b.referral) : ''}`
    ),
  });
}

/** the client's referral code as a gift card to give (or to use for another car), in the e-mail */
function giftCard(env, r) {
  const until = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long', year: 'numeric', timeZone: R.timeZone }).format(new Date(r.expires));
  const link = `${env.SITE_URL || B.siteUrl}/reservation/?code=${encodeURIComponent(r.code)}`;
  return `<p style="margin:28px 0 10px;font-size:15px;line-height:1.5;color:#111"><strong>P.-S.</strong> Le bouche-à-oreille, c’est ce qui nous fait le plus plaisir : voici une carte cadeau à offrir à un proche, ou à garder pour une autre voiture.</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#0b0c0f;border:1px solid #e9cd82;border-radius:16px">
<tr><td style="padding:22px 22px 0;color:#e9cd82;font-size:12px;font-weight:700;letter-spacing:.18em">CARTE CADEAU · PARRAINAGE</td></tr>
<tr><td style="padding:6px 22px 0;color:#ffffff;font-size:36px;font-weight:800;line-height:1.1">${euros(r.amount)} offerts</td></tr>
<tr><td style="padding:10px 22px 0;color:#d9d4c7;font-size:14px;line-height:1.5">sur une prestation chez ${esc(B.name)} : vitres teintées, feux teintés, detailing, covering…</td></tr>
<tr><td style="padding:18px 22px 0"><span style="display:inline-block;border:1px dashed #e9cd82;border-radius:10px;padding:10px 16px;font-family:'Courier New',Courier,monospace;font-size:22px;font-weight:700;letter-spacing:.14em;color:#e9cd82">${esc(r.code)}</span></td></tr>
<tr><td style="padding:18px 22px 0"><a href="${esc(link)}" style="display:inline-block;background:#e9cd82;color:#0b0c0f;text-decoration:none;font-weight:800;padding:12px 20px;border-radius:999px">Réserver avec ce code</a></td></tr>
<tr><td style="padding:16px 22px 22px;color:#8f8a7d;font-size:12px;line-height:1.5">À utiliser une seule fois, jusqu’au ${esc(until)} : en réservant en ligne avec ce code, ou en le donnant à l’atelier. Non cumulable, non remboursable.</td></tr>
</table>`;
}

// ---------------------------------------------------------------- quote requests
/** a display name for a From header: no quote, angle bracket or line break */
const displayName = (s) => String(s || '').replace(/["<>\\\r\n,;]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 70);
/** the address part of env.MAIL_FROM ("SOLAR CAR 37 <reservation@solarcar37.fr>") */
const fromAddress = (env) => (String(env.MAIL_FROM || '').match(/<([^>]+)>/) || [])[1] || String(env.MAIL_FROM || '').trim() || 'onboarding@resend.dev';
const whenFr = (ms) => new Intl.DateTimeFormat('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: R.timeZone }).format(new Date(ms)).replace(':', ' h ');
const para = (s) => esc(s).replace(/\n/g, '<br>');
const plain = (pairs) =>
  pairs
    .filter(([, v]) => v)
    .map(([k, v]) => `${k} : ${String(v).replace(/\n/g, '\n  ')}`)
    .join('\n');

/** « Demande de devis n°12 — Mini F56 JCW 2015 · Ciel étoilé »: the same subject for the workshop
 *  and the client; its number tells the replies apart (booking/store.js, mail/in) */
export const quoteSubject = (q) => `Demande de devis n°${q.id} — ${[q.vehicle, q.services].filter(Boolean).join(' · ')}`.slice(0, 140);
/** the client's side: no number (20 November 2026: the workshop keeps its numbers to itself) */
export const clientSubject = (q) => `Votre demande de devis — ${[q.vehicle, q.services].filter(Boolean).join(' · ')}`.slice(0, 140);
/** the address the replies of a quote discussion go to (Cloudflare Email Routing → this worker's
 *  email handler); empty: no discussion relay, the workshop answers the client directly */
export const relayAddress = (env) => String(env.QUOTE_REPLY || '').trim();
/** « "Léa Petit (devis n°12)" <devis@…> » */
const named = (name, address) => `"${displayName(name).replace(/"/g, '')}" <${address}>`;
const whoOf = (r) => [r.first ?? r.c?.firstName, r.last ?? r.c?.lastName].filter(Boolean).join(' ') || 'Client';
/** the booking server's own address (the workshop's space) */
const serverUrl = () => String(R.api || '').replace(/\/$/, '');
const dateFr = (ms) => new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long', year: 'numeric', timeZone: R.timeZone }).format(new Date(ms));
/** « 1 190 € », « 1 190,50 € » (French spacing) */
const money = (n) => new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', minimumFractionDigits: n % 1 ? 2 : 0, maximumFractionDigits: 2 }).format(n);
const threadHeaders = (ids = []) => (ids.length ? { 'In-Reply-To': ids.at(-1), References: ids.slice(-10).join(' ') } : undefined);
const paragraphs = (text) =>
  String(text || '')
    .split(/\n{2,}/)
    .map((p) => `<p style="margin:0 0 14px;font-size:15px;line-height:1.55;color:#111">${para(p)}</p>`)
    .join('');
const filesLine = (files) => (files.length ? `Pièce${files.length > 1 ? 's' : ''} jointe${files.length > 1 ? 's' : ''} : ${files.map((f) => f.filename).join(', ')}` : '');

/**
 * A quote request sent from the site's form (booking/store.js, quote/submit):
 *   - to the workshop (env.NOTIFY_TO), from « Prénom Nom via SOLAR CAR 37 », Reply-To the client:
 *     answering it writes to the client, with their request quoted below, in French; the photos
 *     are attached;
 *   - to the client (when env.MAIL_CLIENTS is "1"): the acknowledgment, with what they asked.
 * q: { id, at, c: { firstName, lastName, email, phone }, vehicle, services, wish, code, source,
 *      message, files: [{ filename, content (base64), size }] }
 * The workshop's e-mail must go out (it throws otherwise); the client's is a courtesy: { client }.
 */
export async function sendQuoteMails(env, q) {
  const { c } = q;
  const who = `${c.firstName} ${c.lastName}`.trim();
  const subject = quoteSubject(q);
  const photos = q.files.map((f) => f.filename).join(', ');
  const received = q.files.length ? `${q.files.length} fichier${q.files.length > 1 ? 's' : ''} reçu${q.files.length > 1 ? 's' : ''}` : '';
  const tel = c.phone.replace(/[^\d+]/g, '');
  const request = [
    ['Véhicule', q.vehicle],
    ['Prestation(s)', q.services],
    ['Rendez-vous souhaité', q.wish || 'indifférent'],
    ['Code', q.code],
  ];
  await send(env, {
    from: `${displayName(`${who} via ${B.name}`)} <${fromAddress(env)}>`,
    to: env.NOTIFY_TO.split(',').map((x) => x.trim()),
    // through the discussion relay when there is one: the answer is kept in the workshop's space
    reply_to: relayAddress(env) ? named(`${who} (devis n°${q.id})`, relayAddress(env)) : c.email,
    subject,
    // no word meant for the workshop alone: answering quotes this e-mail to the client
    html: shell(
      'Demande de devis',
      `<p style="margin:0 0 16px;font-size:14px;color:#6b6b6b">Envoyée depuis ${esc((env.SITE_URL || B.siteUrl).replace(/^https?:\/\//, ''))} le ${esc(whenFr(q.at))}.</p>
<table role="presentation" cellpadding="0" cellspacing="0" style="font-size:14px">${rows([
        ['Client', esc(who)],
        ['Téléphone', `<a href="tel:${esc(tel)}" style="color:#111">${esc(c.phone)}</a>`],
        ['E-mail', `<a href="mailto:${esc(c.email)}" style="color:#111">${esc(c.email)}</a>`],
        ...request.map(([k, v]) => [k, v ? para(v) : '']),
        ['Nous a connus', q.source ? esc(q.source) : ''],
        ['Pièces jointes', photos ? esc(photos) : ''],
      ])}</table>
<p style="margin:18px 0 6px;font-size:13px;color:#6b6b6b">Message</p>
<p style="margin:0;padding:12px 14px;background:#faf8f4;border-radius:10px;font-size:15px;line-height:1.5;color:#111">${para(q.message)}</p>`
    ),
    text: `Demande de devis, envoyée depuis ${(env.SITE_URL || B.siteUrl).replace(/^https?:\/\//, '')} le ${whenFr(q.at)}.\n\n${plain([
      ['Client', who],
      ['Téléphone', c.phone],
      ['E-mail', c.email],
      ...request,
      ['Nous a connus', q.source],
      ['Pièces jointes', photos],
    ])}\n\nMessage :\n${q.message}\n`,
    attachments: q.files.map((f) => ({ filename: f.filename, content: f.content })),
  });
  const sent = { client: false };
  if (env.MAIL_CLIENTS !== '1') return sent;
  try {
    await send(env, {
      to: [c.email],
      reply_to: relayAddress(env) ? named(B.name, relayAddress(env)) : B.email,
      subject: clientSubject(q),
      html: shell(
        'Nous avons bien reçu votre demande',
        `<p style="margin:0 0 16px;font-size:15px;line-height:1.5;color:#111">Bonjour ${esc(c.firstName)},<br>merci pour votre demande de devis. Nous l’étudions et revenons vers vous rapidement avec un devis détaillé, par e-mail ou par téléphone.</p>
<table role="presentation" cellpadding="0" cellspacing="0" style="font-size:14px">${rows([...request.map(([k, v]) => [k, v ? para(v) : '']), ['Pièces jointes', esc(received)]])}</table>
<p style="margin:18px 0 6px;font-size:13px;color:#6b6b6b">Votre message</p>
<p style="margin:0;padding:12px 14px;background:#faf8f4;border-radius:10px;font-size:15px;line-height:1.5;color:#111">${para(q.message)}</p>
<p style="margin:18px 0 0;font-size:14px;line-height:1.5;color:#111">Une précision, une photo à ajouter ? Répondez simplement à cet e-mail. Pour une question urgente : <a href="tel:${esc(B.phone.replace(/[^\d+]/g, ''))}" style="color:#9a7a2c">${esc(B.phone)}</a>.</p>
<p style="margin:18px 0 0;font-size:15px;line-height:1.5;color:#111">À très bientôt,<br><strong>${esc(B.name)}</strong></p>`
      ),
      text: `Bonjour ${c.firstName},\n\nmerci pour votre demande de devis. Nous l’étudions et revenons vers vous rapidement avec un devis détaillé, par e-mail ou par téléphone.\n\n${plain([...request, ['Pièces jointes', received]])}\n\nVotre message :\n${q.message}\n\nUne précision, une photo à ajouter ? Répondez simplement à cet e-mail. Pour une question urgente : ${B.phone}.\n\nÀ très bientôt,\n${B.name}\n`,
    });
    sent.client = true;
  } catch (err) {
    console.error('[mail] quote client', err.message);
  }
  return sent;
}

/**
 * The workshop's message to a client about their request (written in the workshop's space, or a
 * reply from the workshop's Gmail passed on by the relay): from contact@, answers back into the
 * discussion, the accept button while the quote is open, a reminder of the request below.
 * r: the request with its client (first, last, email); x: { text, files [{ filename, content }],
 * acceptUrl, bcc, refs (the client's own Message-IDs: the answer joins their conversation) }
 */
export async function sendToClient(env, r, x) {
  const files = x.files || [];
  const amount = Number(r.amount) > 0 ? money(Number(r.amount)) : '';
  const accept = x.acceptUrl
    ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:8px 0 18px;background:#0b0c0f;border:1px solid #e9cd82;border-radius:14px"><tr><td style="padding:18px 20px">
<p style="margin:0 0 4px;color:#e9cd82;font-size:12px;font-weight:700;letter-spacing:.14em">VOTRE DEVIS${amount ? ` · ${esc(amount)}` : ''}</p>
<p style="margin:0 0 14px;color:#ffffff;font-size:16px;line-height:1.45">Ce devis vous convient ? Un clic suffit : nous vous appelons ensuite pour fixer la date.</p>
<a href="${esc(x.acceptUrl)}" style="display:inline-block;background:#e9cd82;color:#0b0c0f;text-decoration:none;font-weight:800;padding:12px 22px;border-radius:999px">J’accepte ce devis</a></td></tr></table>`
    : '';
  const recap = `${dateFr(r.at)} : ${[r.vehicle, r.services].filter(Boolean).join(' · ')}`;
  return send(env, {
    from: `${B.name} <${B.email}>`,
    to: [r.email],
    ...(x.bcc?.length ? { bcc: x.bcc } : {}),
    reply_to: relayAddress(env) ? named(B.name, relayAddress(env)) : B.email,
    subject: `Re: ${clientSubject(r)}`,
    ...(threadHeaders(x.refs) ? { headers: threadHeaders(x.refs) } : {}),
    html: shell(
      'Votre demande de devis',
      `${paragraphs(x.text)}${files.length ? `<p style="margin:0 0 14px;font-size:13px;color:#6b6b6b">${esc(filesLine(files))}</p>` : ''}${accept}
<p style="margin:0 0 6px;font-size:13px;line-height:1.5;color:#6b6b6b">Une question ? Répondez simplement à cet e-mail, ou appelez le <a href="tel:${esc(B.phone.replace(/[^\d+]/g, ''))}" style="color:#9a7a2c">${esc(B.phone)}</a>.</p>
<p style="margin:14px 0 0;padding-top:12px;border-top:1px solid #eee;font-size:12px;line-height:1.5;color:#8a8a8a">Votre demande du ${esc(recap)}</p>`
    ),
    text: `${x.text}\n\n${files.length ? `${filesLine(files)}\n\n` : ''}${x.acceptUrl ? `Ce devis vous convient ? Acceptez-le en un clic : ${x.acceptUrl}\n\n` : ''}Une question ? Répondez simplement à cet e-mail, ou appelez le ${B.phone}.\n\n—\nVotre demande du ${recap}\n`,
    attachments: files.map((f) => ({ filename: f.filename, content: f.content })),
  });
}

/**
 * To the workshop's Gmail, about a quote discussion: kind 'message' (the client wrote: answering
 * this e-mail answers the client, through the relay), 'accepted' (the client accepted the quote),
 * 'unknown' (an e-mail to the relay that belongs to no request: answering writes to its sender).
 * x: { text, files, refs (the workshop's own Message-IDs: the e-mail joins its conversation),
 *      sender (unknown: { name, email, subject }) }
 */
export async function notifyWorkshop(env, r, kind, x = {}) {
  const to = String(env.NOTIFY_TO || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  if (!to.length) return null;
  const files = x.files || [];
  const open = `${serverUrl()}/atelier/devis/${r?.id}`;
  const button = (label) => `<p style="margin:18px 0 0"><a href="${esc(open)}" style="display:inline-block;background:#0b0c0f;color:#e9cd82;text-decoration:none;font-weight:700;padding:12px 20px;border-radius:999px">${esc(label)}</a></p>`;
  if (kind === 'unknown') {
    const s = x.sender || {};
    return send(env, {
      from: `${displayName(`${s.name || s.email} via ${B.name}`)} <${fromAddress(env)}>`,
      to,
      reply_to: s.email,
      subject: `Message reçu sans numéro de devis — ${s.subject || 'sans objet'}`.slice(0, 160),
      html: shell('Message reçu sur l’adresse des devis', `<p style="margin:0 0 14px;font-size:13px;color:#6b6b6b">De ${esc(s.name ? `${s.name} <${s.email}>` : s.email)} · aucune demande de devis ne correspond. Répondre à cet e-mail écrit à l’expéditeur.</p>${paragraphs(x.text)}${files.length ? `<p style="font-size:13px;color:#6b6b6b">${esc(filesLine(files))}</p>` : ''}`),
      text: `De ${s.email}, aucune demande de devis ne correspond.\n\n${x.text}\n`,
      attachments: files.map((f) => ({ filename: f.filename, content: f.content })),
    });
  }
  const who = whoOf(r);
  const tel = String(r.phone || '').replace(/[^\d+]/g, '');
  const contact = r.phone ? `<p style="margin:0;font-size:14px;color:#111">${esc(who)} · <a href="tel:${esc(tel)}" style="color:#111;font-weight:700">${esc(r.phone)}</a></p>` : '';
  if (kind === 'accepted') {
    return send(env, {
      from: `${B.name} <${fromAddress(env)}>`,
      to,
      ...(relayAddress(env) ? { reply_to: named(`${who} (devis n°${r.id})`, relayAddress(env)) } : { reply_to: r.email }),
      subject: `Devis n°${r.id} accepté — ${who}`,
      ...(threadHeaders(x.refs) ? { headers: threadHeaders(x.refs) } : {}),
      html: shell(
        'Devis accepté',
        `<p style="margin:0 0 14px;font-size:15px;line-height:1.55;color:#111"><strong>${esc(who)}</strong> vient d’accepter le devis n°${r.id}${Number(r.amount) > 0 ? ` (${esc(money(Number(r.amount)))})` : ''} : ${esc([r.vehicle, r.services].filter(Boolean).join(' · '))}.</p><p style="margin:0 0 14px;font-size:15px;color:#111">Appelez-le pour fixer la date du rendez-vous :</p>${contact}${button('Ouvrir le devis')}`
      ),
      text: `${who} vient d’accepter le devis n°${r.id}. Appelez-le pour fixer la date : ${r.phone || r.email}.\n${open}\n`,
    });
  }
  return send(env, {
    from: `${displayName(`${who} via ${B.name}`)} <${fromAddress(env)}>`,
    to,
    reply_to: relayAddress(env) ? named(`${who} (devis n°${r.id})`, relayAddress(env)) : r.email,
    subject: `Re: ${r.subject || quoteSubject(r)}`,
    ...(threadHeaders(x.refs) ? { headers: threadHeaders(x.refs) } : {}),
    html: shell(
      `Message de ${who}`,
      `<p style="margin:0 0 14px;font-size:13px;color:#6b6b6b">Devis n°${r.id} · ${esc([r.vehicle, r.services].filter(Boolean).join(' · '))}</p>${paragraphs(x.text)}${files.length ? `<p style="margin:0 0 14px;font-size:13px;color:#6b6b6b">${esc(filesLine(files))}</p>` : ''}${contact}${button('Ouvrir la discussion')}`
    ),
    text: `${who}, devis n°${r.id} :\n\n${x.text}\n\n${files.length ? `${filesLine(files)}\n\n` : ''}Répondre à cet e-mail répond au client. Discussion : ${open}\n`,
    attachments: files.map((f) => ({ filename: f.filename, content: f.content })),
  });
}

// ---------------------------------------------------------------- gift cards and SOLAR CAR Premium
// (content/offers.js, docs/CARTES.md): dark, gold, warm. The card is drawn in HTML over its face
// (public/img/cartes/<face>.jpg on the site), so that its text stays sharp and readable without images.
const site = (env) => String(env.SITE_URL || B.siteUrl).replace(/\/$/, '');
const GOLD = '#e9cd82';
const INK = '#f1ede4';
const MUTED = '#a9a396';
const longDay = (date) => new Intl.DateTimeFormat('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' }).format(new Date(`${date}T12:00:00Z`));
const fullDate = (ms) => new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long', year: 'numeric', timeZone: R.timeZone }).format(new Date(ms));
const lp = (html, extra = '') => `<p style="margin:0 0 14px;font-size:15px;line-height:1.6;color:${INK};${extra}">${html}</p>`;
const goldButton = (href, label) => `<a href="${esc(href)}" style="display:inline-block;background:${GOLD};color:#0b0c0f;text-decoration:none;font-weight:800;font-size:15px;padding:14px 24px;border-radius:999px">${esc(label)}</a>`;
const ghostButton = (href, label) => `<a href="${esc(href)}" style="display:inline-block;border:1px solid #4a4130;color:${GOLD};text-decoration:none;font-weight:700;font-size:14px;padding:12px 20px;border-radius:999px">${esc(label)}</a>`;

/** the dark envelope of the cards' e-mails: a hidden preview line, the logo, a gold title */
export const luxShell = (title, body, { preheader = '', kicker = '', foot = '' } = {}) => `<!doctype html><html lang="fr"><head><meta name="color-scheme" content="dark light"><meta name="supported-color-schemes" content="dark light"></head><body style="margin:0;background:#050608;font-family:Arial,Helvetica,sans-serif">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:#050608">${esc(preheader)}&#8203;&#847;&#8203;&#847;&#8203;&#847;&#8203;&#847;</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="#050608" style="background:#050608;padding:28px 12px"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="#0d0e11" style="max-width:580px;background:#0d0e11;border:1px solid #2a2519;border-radius:20px;overflow:hidden">
<tr><td align="center" style="padding:26px 24px 6px"><img src="${String(R.api || '').replace(/\/$/, '')}/atelier/logo.png" width="150" height="58" alt="SOLAR CAR 37" style="display:block;border:0;width:150px;height:auto;color:${GOLD};font-size:18px;font-weight:800;letter-spacing:.08em"></td></tr>
<tr><td align="center" style="padding:0 24px"><div style="height:1px;width:64px;background:${GOLD};opacity:.6;margin:12px auto 0;line-height:1px;font-size:1px">&nbsp;</div></td></tr>
${kicker ? `<tr><td align="center" style="padding:18px 24px 0;color:${GOLD};font-size:11px;font-weight:700;letter-spacing:.28em;text-transform:uppercase">${esc(kicker)}</td></tr>` : ''}
<tr><td align="center" style="padding:${kicker ? 8 : 18}px 28px 0"><h1 style="margin:0;font-family:Georgia,'Times New Roman',serif;font-style:italic;font-weight:400;font-size:30px;line-height:1.2;color:${INK}">${esc(title)}</h1></td></tr>
<tr><td style="padding:24px 28px 8px">${body}</td></tr>
<tr><td style="padding:18px 28px 26px;border-top:1px solid #1f1c15;color:#7d786c;font-size:12px;line-height:1.6">${foot ? `${foot}<br>` : ''}${esc(B.name)} · ${esc(address)} · <a href="tel:${esc(B.phone.replace(/[^\d+]/g, ''))}" style="color:#9c927c">${esc(B.phone)}</a></td></tr>
</table></td></tr></table></body></html>`;

/** a gift card drawn in an e-mail: its face as the background, the amount, the names, the code */
function giftCardHtml(env, g) {
  const face = `${site(env)}/img/cartes/cadeau-${esc(g.look || 'or')}.jpg`;
  const who = [g.to_name ? `Pour ${esc(g.to_name)}` : '', g.sender ? `de la part de ${esc(g.sender)}` : ''].filter(Boolean).join(' · ');
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" background="${face}" bgcolor="#101114" style="background-color:#101114;background-image:url('${face}');background-size:cover;background-position:center;border:1px solid #4a4130;border-radius:18px">
<tr><td style="padding:22px 24px 0;color:${GOLD};font-size:11px;font-weight:700;letter-spacing:.26em">CARTE CADEAU <span style="color:${MUTED};font-weight:400">· SOLAR CAR 37</span></td></tr>
<tr><td style="padding:30px 24px 0;color:#ffffff;font-size:48px;font-weight:800;line-height:1">${euros(g.amount)}</td></tr>
<tr><td style="padding:10px 22% 0 24px;color:#e6e1d6;font-size:15px;line-height:1.4">${who || '&nbsp;'}</td></tr>
<tr><td style="padding:24px 24px 22px"><span style="display:inline-block;background:rgba(5,6,8,.72);border:1px solid #6b5a33;border-radius:10px;padding:10px 14px;font-family:'Courier New',Courier,monospace;font-size:19px;font-weight:700;letter-spacing:.14em;color:${GOLD}">${esc(g.code)}</span></td></tr>
</table>`;
}

/** what a gift card is for, its validity, how to use it */
const giftHow = (env, g) => `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:22px 0 6px;font-size:14px;line-height:1.55;color:${INK}">
<tr><td style="padding:0 0 10px;color:${GOLD};font-weight:700">Comment en profiter</td></tr>
<tr><td style="padding:0 0 8px">• <b>En ligne</b> : vitres teintées et feux teintés se réservent sur le site, la carte se saisit à l’étape du paiement.</td></tr>
<tr><td style="padding:0 0 8px">• <b>À l’atelier</b> : detailing, ciel étoilé, covering, rénovation de phares… donnez simplement le code au moment de régler.</td></tr>
<tr><td style="padding:0 0 8px">• En une ou plusieurs fois, jusqu’au <b>${esc(fullDate(g.expires))}</b>.</td></tr>
</table>`;

/**
 * A gift card just paid: the buyer gets it at once (to print or forward), and learns when it goes
 * to its recipient when they chose that. g: the gifts row; card: its public form (viewUrl).
 */
export async function sendGiftBuyer(env, g, card) {
  const later = g.delivery === 'destinataire' && !g.sent;
  const to = g.to_name || 'votre destinataire';
  await send(env, {
    to: [g.buyer_email],
    reply_to: B.email,
    subject: later ? `Votre carte cadeau pour ${to} est prête` : g.delivery === 'destinataire' ? `Votre carte cadeau est partie chez ${to}` : `Votre carte cadeau SOLAR CAR 37 de ${euros(g.amount)}`,
    html: luxShell(
      later ? 'Votre cadeau est prêt' : 'Merci pour ce beau cadeau',
      `${lp(`Bonjour ${esc(g.buyer_first)},`)}
${lp(later ? `merci d’avoir choisi ${esc(B.name)} pour faire plaisir. Votre carte cadeau partira par e-mail à <b>${esc(to)}</b> (${esc(maskAddress(g.to_email))}) le <b>${esc(longDay(g.send_on))}</b>, vers 8 h. Vous recevrez un petit mot dès qu’elle sera arrivée.` : g.delivery === 'destinataire' ? `merci d’avoir choisi ${esc(B.name)} pour faire plaisir. Votre carte cadeau vient de partir par e-mail à <b>${esc(to)}</b> (${esc(maskAddress(g.to_email))}). La voici aussi pour vous, si vous voulez l’imprimer.` : `merci d’avoir choisi ${esc(B.name)} pour faire plaisir. Voici votre carte : imprimez-la, glissez-la dans une enveloppe ou transférez cet e-mail, elle est prête à offrir.`)}
${giftCardHtml(env, g)}
${g.message ? `<p style="margin:18px 0 0;padding:14px 16px;border-left:2px solid ${GOLD};background:#141519;font-family:Georgia,'Times New Roman',serif;font-style:italic;font-size:16px;line-height:1.55;color:${INK};white-space:pre-wrap">« ${esc(g.message)} »</p>` : ''}
<p style="margin:22px 0 0">${goldButton(card.viewUrl, 'Voir la carte en 3D et l’imprimer')}</p>
${giftHow(env, g)}
${lp(`Une question, une envie particulière pour ${esc(to)} ? Répondez simplement à cet e-mail, ou appelez-nous au <a href="tel:${esc(B.phone.replace(/[^\d+]/g, ''))}" style="color:${GOLD}">${esc(B.phone)}</a>.`, 'margin-top:8px;font-size:14px;color:#cfc9bc')}
${lp(`À très bientôt,<br><b>${esc((B.owner || '').split(' ')[0] || B.name)}</b> — ${esc(B.name)}`)}`,
      { preheader: later ? `Elle partira le ${longDay(g.send_on)} : vous pouvez déjà la voir.` : `${euros(g.amount)} à offrir, valable jusqu’au ${fullDate(g.expires)}.`, kicker: 'Carte cadeau', foot: `Carte n° ${esc(g.code)} · ${euros(g.amount)} · valable jusqu’au ${esc(fullDate(g.expires))} · non remboursable, ni échangeable contre de l’argent.` }
    ),
  });
}
const maskAddress = (e) => String(e || '').replace(/^(.)[^@]*(@.*)$/, '$1***$2');

/** the card in its recipient's inbox, on the day chosen by the buyer */
export async function sendGiftRecipient(env, g, card) {
  const from = g.sender || [g.buyer_first, g.buyer_last].filter(Boolean).join(' ') || 'Un proche';
  await send(env, {
    to: [g.to_email],
    reply_to: B.email,
    subject: `${from} vous offre une carte cadeau ${B.name}`,
    html: luxShell(
      'Un cadeau pour vous',
      `${lp(`Bonjour${g.to_name ? ` ${esc(g.to_name)}` : ''},`)}
${lp(`<b>${esc(from)}</b> a pensé à vous et vous offre <b>${euros(g.amount)}</b> chez ${esc(B.name)}, l’atelier de personnalisation automobile de Vouvray, près de Tours : vitres teintées, feux teintés, detailing, ciel étoilé, covering… de quoi faire de votre voiture la vôtre.`)}
${g.message ? `<p style="margin:4px 0 20px;padding:14px 16px;border-left:2px solid ${GOLD};background:#141519;font-family:Georgia,'Times New Roman',serif;font-style:italic;font-size:16px;line-height:1.55;color:${INK};white-space:pre-wrap">« ${esc(g.message)} »<br><span style="font-family:Arial,Helvetica,sans-serif;font-style:normal;font-size:13px;color:${MUTED}">— ${esc(from)}</span></p>` : ''}
${giftCardHtml(env, g)}
<p style="margin:22px 0 0">${goldButton(`${site(env)}/reservation/?cadeau=${encodeURIComponent(g.code)}`, 'Réserver avec ma carte')}&nbsp; ${ghostButton(card.viewUrl, 'Voir ma carte')}</p>
${giftHow(env, g)}
${lp(`Vous hésitez entre plusieurs envies ? Écrivez-nous ou appelez le <a href="tel:${esc(B.phone.replace(/[^\d+]/g, ''))}" style="color:${GOLD}">${esc(B.phone)}</a> : nous vous conseillons avec plaisir, et la carte se dépense en plusieurs fois.`, 'font-size:14px;color:#cfc9bc')}
${lp(`Au plaisir de vous accueillir à l’atelier,<br><b>${esc((B.owner || '').split(' ')[0] || B.name)}</b> — ${esc(B.name)}`)}`,
      { preheader: `${from} vous offre ${euros(g.amount)} chez ${B.name}.`, kicker: 'Vous avez reçu un cadeau', foot: `Carte n° ${esc(g.code)} · valable jusqu’au ${esc(fullDate(g.expires))} · ${esc(address)}.` }
    ),
  });
}

/** to the buyer: the card has reached its recipient */
export async function sendGiftDelivered(env, g) {
  await send(env, {
    to: [g.buyer_email],
    reply_to: B.email,
    subject: `Votre carte cadeau est bien arrivée chez ${g.to_name || 'son destinataire'}`,
    html: luxShell(
      'C’est livré',
      `${lp(`Bonjour ${esc(g.buyer_first)},`)}${lp(`votre carte cadeau de <b>${euros(g.amount)}</b> vient d’être envoyée à <b>${esc(g.to_name || 'son destinataire')}</b> (${esc(maskAddress(g.to_email))}). Il ne reste plus qu’à attendre son appel !`)}${lp(`Merci encore pour votre confiance,<br><b>${esc(B.name)}</b>`)}`,
      { preheader: `Envoyée ce matin à ${g.to_name || 'son destinataire'}.`, kicker: 'Carte cadeau' }
    ),
  });
}

/** the member's card drawn in an e-mail: black metal, name, number, validity, level */
function premiumCardHtml(env, m, tier) {
  const face = `${site(env)}/img/cartes/premium.jpg`;
  const color = tier?.color || GOLD;
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" background="${face}" bgcolor="#0a0a0c" style="background-color:#0a0a0c;background-image:url('${face}');background-size:cover;background-position:center;border:1px solid #3a3a40;border-radius:18px">
<tr><td style="padding:22px 24px 0;color:${INK};font-size:12px;font-weight:700;letter-spacing:.3em">SOLAR CAR <span style="color:${GOLD}">PREMIUM</span></td><td align="right" style="padding:22px 24px 0"><span style="display:inline-block;border:1px solid ${color};color:${color};border-radius:999px;padding:4px 10px;font-size:11px;font-weight:700;letter-spacing:.16em;text-transform:uppercase">${esc(tier?.label || 'Membre')}</span></td></tr>
<tr><td colspan="2" style="padding:44px 24px 0;color:#ffffff;font-size:22px;font-weight:700;letter-spacing:.06em;text-transform:uppercase">${esc([m.firstName ?? m.first, m.lastName ?? m.last].filter(Boolean).join(' '))}</td></tr>
<tr><td style="padding:10px 24px 22px;font-family:'Courier New',Courier,monospace;font-size:16px;font-weight:700;letter-spacing:.14em;color:${GOLD}">${esc(m.number)}</td><td align="right" style="padding:10px 24px 22px;color:${MUTED};font-size:12px;line-height:1.4">valable jusqu’au<br><b style="color:${INK}">${esc(fullDate(m.expires))}</b></td></tr>
</table>`;
}

/** the levels, one a service: the member's lit, the next shown with its gift */
function levelsHtml(m) {
  const visits = Number(m.visits) || 0;
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:6px 0 0;font-size:13px;line-height:1.45">${P.tiers
    .map((t) => {
      const on = visits >= t.visits;
      return `<tr><td width="18" valign="top" style="padding:7px 0"><span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${on ? t.color : '#2a2b30'};border:1px solid ${t.color}"></span></td><td valign="top" style="padding:5px 0 5px 8px;color:${on ? INK : MUTED}"><b style="color:${on ? t.color : MUTED};letter-spacing:.08em;text-transform:uppercase;font-size:12px">${esc(t.label)}</b>${t.visits ? ` · ${t.visits === 1 ? '1re' : `${t.visits}e`} prestation` : ' · dès aujourd’hui'}<br><span style="color:${on ? '#cfc9bc' : '#8a8578'}">${esc(t.gift || `−${P.percent} % sur tout, toute l’année`)}</span></td></tr>`;
    })
    .join('')}</table>`;
}

/**
 * Welcome to SOLAR CAR Premium (or the renewal): the card, how to use it, the levels, the
 * referral code for the relatives, the link to « Mon espace Premium ». m: the public member
 * (booking/store.js publicMember) with `email` the real address in `to`.
 */
export async function sendPremiumWelcome(env, m, { to, renewed = false } = {}) {
  const tier = P.tiers.find((t) => t.id === m.tier?.id) || P.tiers[0];
  const optOut = `${String(R.api || '').replace(/\/$/, '')}/api/premium/offres?n=${encodeURIComponent(m.number)}&t=${m.token}&off=1`;
  await send(env, {
    to: [to],
    reply_to: B.email,
    subject: renewed ? `Votre carte SOLAR CAR Premium est renouvelée jusqu’au ${fullDate(m.expires)}` : `Bienvenue dans SOLAR CAR Premium, ${m.firstName}`,
    html: luxShell(
      renewed ? 'Une année de plus ensemble' : `Bienvenue, ${m.firstName}`,
      `${lp(renewed ? `Merci de rester des nôtres ! Votre carte est prolongée jusqu’au <b>${esc(fullDate(m.expires))}</b>, et vous gardez votre niveau <b style="color:${tier.color}">${esc(tier.label)}</b> : vos prestations continuent de compter.` : `Merci de nous rejoindre. À partir d’aujourd’hui, vous profitez de <b>−${P.percent} % sur toutes les prestations de l’atelier</b>, toute l’année, et chaque rendez-vous vous fait monter d’un niveau, avec un cadeau à la clé.`)}
${premiumCardHtml(env, m, tier)}
<p style="margin:22px 0 0">${goldButton(m.cardUrl, 'Ouvrir mon espace Premium')}</p>
${lp('Votre carte, vos rendez-vous et vos cadeaux, au même endroit. Sur votre téléphone, ajoutez-le à l’écran d’accueil : il s’ouvre comme une application.', 'margin-top:10px;font-size:13px;color:#a9a396')}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:18px 0 0;font-size:14px;line-height:1.55;color:${INK}">
<tr><td style="padding:0 0 10px;color:${GOLD};font-weight:700">Comment l’utiliser</td></tr>
<tr><td style="padding:0 0 8px">• <b>En ligne</b> : saisissez votre numéro <span style="font-family:'Courier New',monospace;color:${GOLD}">${esc(m.number)}</span> dans le champ « Code » de la réservation, avec cette adresse e-mail.</td></tr>
<tr><td style="padding:0 0 8px">• <b>À l’atelier et sur devis</b> : donnez simplement votre nom, la remise est appliquée.</td></tr>
</table>
<p style="margin:20px 0 6px;color:${GOLD};font-weight:700;font-size:14px">Vos niveaux : un par prestation${P.countFrom ? ` (dès ${P.countFrom} €)` : ''}</p>
${levelsHtml(m)}
${m.referral ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:24px 0 0;background:#141519;border:1px dashed #6b5a33;border-radius:14px"><tr><td style="padding:16px 18px;font-size:14px;line-height:1.55;color:${INK}"><b style="color:${GOLD}">Pour vos proches</b><br>Offrez-leur ${euros(m.referral.amount)} sur leur première prestation avec votre code personnel <span style="font-family:'Courier New',monospace;font-weight:700;color:${GOLD};letter-spacing:.1em">${esc(m.referral.code)}</span>.</td></tr></table>` : ''}
${lp(`À très vite à l’atelier,<br><b>${esc((B.owner || '').split(' ')[0] || B.name)}</b> — ${esc(B.name)}`, 'margin-top:22px')}`,
      { preheader: renewed ? `Prolongée jusqu’au ${fullDate(m.expires)}.` : `−${P.percent} % toute l’année, et un cadeau à chaque prestation.`, kicker: 'SOLAR CAR Premium', foot: `Carte nominative · valable jusqu’au ${esc(fullDate(m.expires))} · sans renouvellement automatique. Vous recevrez de temps en temps nos offres réservées aux membres : <a href="${esc(optOut)}" style="color:#9c927c">ne plus les recevoir</a>.` }
    ),
  });
}

/** « Espace membre »: the sign-in code (to type on the site, on any device) and the link that opens
 *  the space at once on this one */
export async function sendPremiumLink(env, m) {
  await send(env, {
    to: [m.email],
    reply_to: B.email,
    subject: m.code ? `Votre code de connexion SOLAR CAR Premium : ${m.code}` : 'Votre accès SOLAR CAR Premium',
    html: luxShell(
      'Votre espace membre',
      `${lp(`Bonjour ${esc(m.first)},`)}${m.code ? `${lp('voici votre code de connexion, valable 10 minutes :')}<p style="margin:6px 0 18px;text-align:center"><span style="display:inline-block;background:#141519;border:1px solid #6b5a33;border-radius:12px;padding:12px 22px;font-family:'Courier New',Courier,monospace;font-size:32px;font-weight:700;letter-spacing:.3em;color:${GOLD}">${esc(m.code)}</span></p>${lp('Ou, sur cet appareil, ouvrez directement votre espace :', 'font-size:14px;color:#cfc9bc')}` : lp('voici le lien de votre espace : votre carte, vos rendez-vous, vos cadeaux et vos offres.')}<p style="margin:12px 0 6px">${goldButton(m.cardUrl, 'Ouvrir mon espace Premium')}</p>${lp('Ce lien et ce code vous sont réservés : gardez-les pour vous. Vous n’avez rien demandé ? Ignorez simplement cet e-mail.', 'margin-top:16px;font-size:13px;color:#a9a396')}`,
      { preheader: m.code ? `Code : ${m.code} (valable 10 minutes).` : 'Votre carte, vos rendez-vous, vos cadeaux.', kicker: 'SOLAR CAR Premium' }
    ),
  });
}

/** a level reached with an appointment: its gift waits at the workshop */
export async function sendLevelUp(env, m, reached) {
  const t = P.tiers.find((x) => x.id === reached.id) || reached;
  const next = P.tiers.find((x) => x.visits === t.visits + 1);
  await send(env, {
    to: [m.email],
    reply_to: B.email,
    subject: reached.card ? `Niveau ${t.label} débloqué : votre carte cadeau de ${euros(reached.card.row.amount)}` : `Niveau ${t.label} débloqué : un cadeau vous attend`,
    html: luxShell(
      `Niveau ${t.label}`,
      `<p style="margin:0 0 18px;text-align:center"><span style="display:inline-block;border:1px solid ${t.color};color:${t.color};border-radius:999px;padding:8px 18px;font-size:13px;font-weight:800;letter-spacing:.24em;text-transform:uppercase">${esc(t.label)} · niveau ${P.tiers.indexOf(t)}</span></p>
${lp(`Bonjour ${esc(m.first)},`)}
${lp(`avec votre ${t.visits === 1 ? 'première' : `${t.visits}e`} prestation en tant que membre, vous passez au niveau <b style="color:${t.color}">${esc(t.label)}</b>. Votre cadeau :`)}
${reached.card ? `${giftCardHtml(env, reached.card.row)}<p style="margin:14px 0 18px;font-size:14px;line-height:1.55;color:#cfc9bc">Votre carte cadeau de <b>${euros(reached.card.row.amount)}</b> est là, valable jusqu’au ${esc(fullDate(reached.card.row.expires))} : gardez-la pour vous, ou transférez cet e-mail à un proche. Elle se dépense en ligne ou à l’atelier, en une ou plusieurs fois.</p><p style="margin:0 0 18px">${ghostButton(reached.card.card.viewUrl, 'Voir la carte et l’imprimer')}</p>` : `<p style="margin:0 0 18px;padding:16px 18px;border:1px solid ${t.color};border-radius:14px;background:#141519;font-size:16px;line-height:1.5;color:${INK}"><b>${esc(t.gift)}</b><br><span style="font-size:13px;color:${MUTED}">remis à l’atelier, aujourd’hui ou lors de votre prochain passage.</span></p>`}
${m.extended ? lp(`Et votre année SOLAR CAR Premium suivante est offerte : votre carte est prolongée jusqu’au <b>${esc(fullDate(m.extended))}</b>.`, 'font-size:15px') : ''}
${next ? lp(`Prochain niveau : <b style="color:${next.color}">${esc(next.label)}</b>, à votre prochaine prestation — ${esc(next.gift.charAt(0).toLowerCase() + next.gift.slice(1))}.`, 'font-size:14px;color:#cfc9bc') : lp('Vous avez atteint le plus haut niveau. Merci, sincèrement, pour votre fidélité.', 'font-size:14px;color:#cfc9bc')}
<p style="margin:18px 0 6px">${goldButton(m.cardUrl, 'Voir mon espace Premium')}</p>`,
      { preheader: reached.card ? `${t.gift} : la voici.` : `${t.gift} : remis à l’atelier.`, kicker: 'SOLAR CAR Premium' }
    ),
  });
}

/** a fortnight before the end: what the year brought, and how to go on (no automatic renewal) */
export async function sendPremiumReminder(env, m) {
  const tier = P.tiers.find((t) => t.id === m.tier?.id) || P.tiers[0];
  await send(env, {
    to: [m.email],
    reply_to: B.email,
    subject: `Votre carte SOLAR CAR Premium se termine le ${fullDate(m.expires)}`,
    html: luxShell(
      'On continue ensemble ?',
      `${lp(`Bonjour ${esc(m.first)},`)}
${lp(`votre carte Premium arrive à échéance le <b>${esc(fullDate(m.expires))}</b>. Elle ne se renouvelle pas toute seule : rien ne sera prélevé sans vous.`)}
${lp(`Cette année : ${m.visits ? `<b>${m.visits} prestation${m.visits > 1 ? 's' : ''}</b> avec −${P.percent} %, ` : ''}niveau <b style="color:${tier.color}">${esc(tier.label)}</b>. En renouvelant, vous gardez votre niveau et vos prestations continuent de compter pour les suivants.`)}
<p style="margin:18px 0 6px">${goldButton(`${site(env)}/premium/?renouveler=1`, `Renouveler pour ${String(P.price).replace('.', ',')} €`)}</p>
${lp('Même adresse e-mail, même carte, une année de plus.', 'margin-top:10px;font-size:13px;color:#a9a396')}`,
      { preheader: `Gardez votre niveau ${tier.label} et vos −${P.percent} %.`, kicker: 'SOLAR CAR Premium' }
    ),
  });
}

/**
 * An offer for the members, written in the workshop's space: one e-mail each (Resend's batch, 100 a
 * request), « Bonjour Prénom », the code in a gold box, the link to stop these e-mails.
 * o: { subject, title, text, code (a promotion, optional), until (ms) }; members: [{ number, token,
 * first, email }]; preview: the workshop's addresses (one e-mail, nothing to the members).
 */
export async function sendMembersOffer(env, o, members, preview = null) {
  const api = String(R.api || '').replace(/\/$/, '');
  const mailFor = (m) => ({
    from: env.MAIL_FROM || `${B.name} <onboarding@resend.dev>`,
    to: [m.email],
    reply_to: B.email,
    subject: `${preview ? '[Aperçu] ' : ''}${o.subject}`,
    headers: m.token ? { 'List-Unsubscribe': `<${api}/api/premium/offres?n=${encodeURIComponent(m.number)}&t=${m.token}&off=1>` } : undefined,
    html: luxShell(
      o.title || o.subject,
      `${lp(`Bonjour ${esc(m.first || '')},`)}${paragraphs(o.text).replace(/color:#111/g, `color:${INK}`)}
${o.code ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:8px 0 18px;background:#141519;border:1px solid #6b5a33;border-radius:14px"><tr><td align="center" style="padding:18px"><span style="color:${MUTED};font-size:11px;letter-spacing:.24em">VOTRE CODE MEMBRE</span><br><span style="display:inline-block;margin-top:8px;font-family:'Courier New',monospace;font-size:24px;font-weight:700;letter-spacing:.16em;color:${GOLD}">${esc(o.code)}</span>${o.until ? `<br><span style="color:${MUTED};font-size:12px">jusqu’au ${esc(fullDate(o.until))}</span>` : ''}</td></tr></table>
<p style="margin:0 0 8px;text-align:center">${goldButton(`${site(env)}/reservation/?code=${encodeURIComponent(o.code)}`, 'J’en profite')}</p>` : `<p style="margin:8px 0 8px;text-align:center">${goldButton(`${site(env)}/reservation/`, 'Réserver')}</p>`}`,
      { preheader: o.subject, kicker: 'Réservé aux membres Premium', foot: m.token ? `Vous recevez cet e-mail en tant que membre SOLAR CAR Premium. <a href="${esc(`${api}/api/premium/offres?n=${encodeURIComponent(m.number)}&t=${m.token}&off=1`)}" style="color:#9c927c">Ne plus recevoir les offres</a>.` : 'Aperçu pour l’atelier : les membres reçoivent leur lien de désinscription ici.' }
    ),
  });
  if (preview?.length) return send(env, { ...mailFor({ first: 'Prénom', email: preview[0], number: '', token: '' }), to: preview });
  let sent = 0;
  for (let i = 0; i < members.length; i += 100) {
    const batch = members.slice(i, i + 100).map(mailFor);
    const res = await fetch('https://api.resend.com/emails/batch', { method: 'POST', headers: { authorization: `Bearer ${env.RESEND_API_KEY}`, 'content-type': 'application/json' }, body: JSON.stringify(batch) });
    if (!res.ok) throw new Error(`resend batch ${res.status} ${(await res.text()).slice(0, 200)}${sent ? ` (${sent} déjà envoyés)` : ''}`);
    sent += batch.length;
  }
  return sent;
}


// ---------------------------------------------------------------- the day of an appointment (21 November 2026)
const longFr = (date) => new Intl.DateTimeFormat('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' }).format(new Date(`${date}T12:00:00Z`));
const firstOf = (c) => esc(c.firstName || c.first || '');

/** an appointment moved by the workshop: the new day and time. b: { c, date, time, end, oldDate,
 *  oldTime, items, total, paid, note } */
export async function sendBookingMoved(env, b) {
  const { c } = b;
  const due = Math.max(0, Math.round(((Number(b.total) || 0) - (Number(b.paid) || 0)) * 100) / 100);
  return send(env, {
    to: [c.email],
    reply_to: B.email,
    subject: `Votre rendez-vous est déplacé au ${longFr(b.date)} à ${hour(b.time)}`,
    html: card(
      { badge: ['Rendez-vous déplacé', 'info'], kicker: 'Votre nouveau rendez-vous', ...bandWhen(b.date, b.time, b.end) },
      `${intro(b.note ? esc(b.note) : `Bonjour ${firstOf(c)},\ncomme convenu, votre rendez-vous du ${esc(longFr(b.oldDate))} à ${keep(hour(b.oldTime))} est déplacé au <b>${esc(longFr(b.date))} à ${keep(hour(b.time))}</b>.`)}
${b.items?.length ? services(b.items) : ''}
${moneyBox([['Total', euros(Number(b.total) || 0)], ['Déjà réglé', b.paid ? gold(euros(b.paid)) : ''], ['À régler à l’atelier', goldStrong(due ? euros(due) : 'rien'), true]], vatNote)}
${practical(c)}
${small(`Un empêchement ? Prévenez-nous au plus vite au ${tel()} ou en répondant à cet e-mail.`)}`
    ),
  });
}

/** an appointment cancelled: what becomes of the deposit. b: { c, date, time, paid, deposit:
 *  'refund' (refunded online), 'refundHand' (refunded at the workshop), 'report' (kept for the next
 *  appointment), 'keep' (kept: cancelled late), '' (nothing paid), note } */
export async function sendBookingCancelled(env, b) {
  const { c } = b;
  const paid = Number(b.paid) || 0;
  const what = {
    refund: `Votre acompte de ${euros(paid)} vous est remboursé sur votre carte : comptez quelques jours selon votre banque.`,
    refundHand: `Votre acompte de ${euros(paid)} vous est remboursé directement par l’atelier.`,
    report: `Votre acompte de ${euros(paid)} est conservé : il sera déduit de votre prochain rendez-vous.`,
    keep: `Comme l’annulation intervient moins de ${R.cancelHours} h avant le rendez-vous, l’acompte de ${euros(paid)} reste acquis à l’atelier, selon nos conditions de réservation.`,
  }[b.deposit] || '';
  return send(env, {
    to: [c.email],
    reply_to: B.email,
    subject: `Votre rendez-vous du ${longFr(b.date)} est annulé`,
    html: card(
      { badge: ['Rendez-vous annulé', 'wait'], kicker: 'Rendez-vous annulé', ...bandWhen(b.date, b.time) },
      `${intro(b.note ? esc(b.note) : `Bonjour ${firstOf(c)},\nvotre rendez-vous du ${esc(longFr(b.date))} à ${keep(hour(b.time))} est bien annulé.`)}
${paid && what ? moneyBox([['Acompte', gold(euros(paid))]], '') + small(esc(what)) : ''}
${small(`Pour reprendre un rendez-vous, répondez à cet e-mail ou appelez-nous au ${tel()} : ce sera avec plaisir.`)}`
    ),
  });
}

/** the car is ready: come and fetch it. b: { c, vehicle, due, tint (window tint done: the advice) } */
export async function sendVehicleReady(env, b) {
  const { c } = b;
  const due = Math.max(0, Number(b.due) || 0);
  return send(env, {
    to: [c.email],
    reply_to: B.email,
    subject: `${b.vehicle ? `Votre ${b.vehicle}` : 'Votre véhicule'} est prêt`,
    html: card(
      { badge: ['Votre véhicule est prêt', 'ok'], kicker: 'Vous pouvez venir le chercher', big: esc(b.vehicle || 'Votre véhicule'), sub: due ? `Reste à régler : ${keep(euros(due))}` : 'Tout est réglé' },
      `${intro(`Bonjour ${firstOf(c)},\nbonne nouvelle : ${b.vehicle ? `votre ${esc(b.vehicle)} est prêt` : 'votre véhicule est prêt'}. Vous pouvez passer le récupérer à l’atelier.`)}
${due ? moneyBox([['À régler à l’atelier', goldStrong(euros(due)), true]], 'Carte bancaire, espèces ou virement.') : ''}
${practical(c, true)}
${b.tint ? small('Pour vos vitres teintées : ne les descendez pas pendant 3 à 4 jours, le temps que le film sèche. Un léger voile ou de petites gouttelettes peuvent apparaître quelques jours : c’est normal, ils disparaissent seuls.') : ''}
${small(`Une question ? Appelez-nous au ${tel()}.`)}`
    ),
  });
}

/** the Google review, asked by the workshop when the client said all went well */
export async function sendReviewRequest(env, b) {
  const { c } = b;
  const review = B.google?.reviewUrl;
  if (!review) throw new Error('lien d’avis Google manquant');
  const me = (B.owner || '').split(' ')[0] || B.name;
  return send(env, {
    to: [c.email],
    reply_to: B.email,
    subject: `Un petit mot sur Google pour ${B.name} ?`,
    html: card(
      { badge: ['Merci pour votre confiance', 'ok'], kicker: 'Votre avis compte', big: 'Un petit mot sur Google ?' },
      `${intro(`Bonjour ${firstOf(c)},\nmerci pour votre retour, ça me fait vraiment plaisir que le résultat vous plaise${b.vehicle ? ` sur votre ${esc(b.vehicle)}` : ''} !`)}
${intro('Si vous avez une minute, votre avis sur Google nous aiderait beaucoup : pour un atelier indépendant comme le nôtre, c’est ce qui compte le plus pour se faire connaître en Touraine.')}
${action(review, 'Donner mon avis sur Google')}
${small(`Merci d’avance, et à bientôt à l’atelier,<br><b>${esc(me)}</b> — ${esc(B.name)}`)}`
    ),
  });
}

/** documents of the appointment (certificate, check-in) to the client, as PDF attachments.
 *  b: { c, vehicle, files: [{ filename, content (base64) }], title, text } */
export async function sendRdvDocuments(env, b) {
  const { c } = b;
  return send(env, {
    to: [c.email],
    reply_to: B.email,
    subject: b.title,
    html: card({ badge: [b.title, 'ok'], kicker: B.name, big: esc(b.vehicle || 'Votre véhicule') }, `${intro(`Bonjour ${firstOf(c)},\n${esc(b.text)}`)}
${small(`Le document est joint à cet e-mail (PDF) : gardez-le précieusement. Une question ? ${tel()}.`)}`),
    attachments: b.files,
  });
}
