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
import { bookingRules as R, formatDuration } from '../content/booking.js';

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

const rows = (pairs) =>
  pairs
    .filter(([, v]) => v)
    .map(([k, v]) => `<tr><td style="padding:6px 12px 6px 0;color:#6b6b6b;white-space:nowrap;vertical-align:top">${esc(k)}</td><td style="padding:6px 0;color:#111;font-weight:600">${v}</td></tr>`)
    .join('');
const shell = (title, body) => `<!doctype html><html lang="fr"><body style="margin:0;background:#f4f2ee;font-family:Arial,Helvetica,sans-serif">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f2ee;padding:24px 12px"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:14px;overflow:hidden">
<tr><td style="background:#0b0c0f;padding:20px 24px;color:#e9cd82;font-size:18px;font-weight:800;letter-spacing:.08em">SOLAR CAR 37</td></tr>
<tr><td style="padding:24px"><h1 style="margin:0 0 16px;font-size:20px;color:#111">${esc(title)}</h1>${body}</td></tr>
<tr><td style="padding:16px 24px;background:#faf8f4;color:#6b6b6b;font-size:12px">${esc(B.name)} · ${esc(address)} · ${esc(B.phone)}</td></tr>
</table></td></tr></table></body></html>`;

async function send(env, mail) {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { authorization: `Bearer ${env.RESEND_API_KEY}`, 'content-type': 'application/json' },
    body: JSON.stringify({ from: env.MAIL_FROM || `${B.name} <onboarding@resend.dev>`, ...mail }),
  });
  if (!res.ok) throw new Error(`resend ${res.status} ${(await res.text()).slice(0, 200)}`);
}

/**
 * b: { q (quote), c (customer), date, time, start, end (UTC ms), mode, paid, sessionId }
 * Returns the list of e-mails sent ('workshop', 'client').
 */
export async function sendBookingMails(env, b) {
  if (!env.RESEND_API_KEY) return [];
  const { q, c, date, time, start, end, paid } = b;
  const endTime = new Intl.DateTimeFormat('fr-FR', { hour: 'numeric', minute: '2-digit', timeZone: R.timeZone }).format(new Date(end)).replace(':', ' h ');
  const when = `${dayLabel(date)}, ${hour(time)} – ${endTime}`;
  const due = Math.max(0, q.total - paid);
  const items = q.items.map((i) => `${esc(i.label)}<br><span style="font-weight:400;color:#6b6b6b">${esc(i.detail)} · ${esc(formatDuration(i.minutes))} · ${euros(i.price)}</span>`).join('<br>');
  const sent = [];
  // the workshop
  if (env.NOTIFY_TO) {
    try {
      await send(env, {
        to: env.NOTIFY_TO.split(',').map((x) => x.trim()),
        reply_to: c.email,
        subject: `Nouveau RDV — ${c.firstName} ${c.lastName} — ${dayLabel(date).replace(/ \d{4}$/, '')} à ${hour(time)}`,
        html: shell(
          'Nouveau rendez-vous réservé en ligne',
          `<table role="presentation" cellpadding="0" cellspacing="0" style="font-size:14px">${rows([
            ['Quand', esc(when)],
            ['Client', esc(`${c.firstName} ${c.lastName}`)],
            ['Téléphone', `<a href="tel:${esc(c.phone.replace(/[^\d+]/g, ''))}" style="color:#111">${esc(c.phone)}</a>`],
            ['E-mail', `<a href="mailto:${esc(c.email)}" style="color:#111">${esc(c.email)}</a>`],
            ['Véhicule', esc(`${c.vehicle}${c.plate ? ` (${c.plate})` : ''}`)],
            ['Prestations', items],
            ['Total', euros(q.total)],
            ['Payé en ligne', `${euros(paid)} (${b.mode === 'full' ? 'totalité' : 'acompte 30 %'})`],
            ['Reste à régler', due ? euros(due) : 'rien'],
            ['Message', c.message ? esc(c.message) : ''],
          ])}</table><p style="margin:18px 0 0;font-size:13px;color:#6b6b6b">Le rendez-vous est dans l’agenda SOLAR CAR 37. Répondre à cet e-mail écrit au client.</p>`
        ),
      });
      sent.push('workshop');
    } catch (err) {
      console.error('[mail] workshop', err.message);
    }
  }
  // the client
  if (env.MAIL_CLIENTS === '1') {
    try {
      const title = `${B.name} — ${q.items.map((i) => i.label).join(' + ')}`;
      await send(env, {
        to: [c.email],
        reply_to: B.email,
        subject: `Votre rendez-vous du ${dayLabel(date).replace(/ \d{4}$/, '')} à ${hour(time)} est confirmé`,
        html: shell(
          'Votre rendez-vous est confirmé',
          `<p style="margin:0 0 16px;font-size:15px;color:#111">Bonjour ${esc(c.firstName)},<br>merci pour votre réservation : votre créneau vous est réservé à l’atelier.</p>
<table role="presentation" cellpadding="0" cellspacing="0" style="font-size:14px">${rows([
            ['Quand', esc(when)],
            ['Où', `${esc(address)}<br><a href="${route}" style="color:#9a7a2c">Itinéraire</a>`],
            ['Prestations', items],
            ['Total TTC', euros(q.total)],
            ['Payé en ligne', euros(paid)],
            ['À régler à l’atelier', due ? euros(due) : 'rien'],
          ])}</table>
<p style="margin:18px 0 0;font-size:14px;color:#111">La teinte se choisit avec vous à l’atelier, le jour du rendez-vous. Prévoyez de déposer le véhicule à l’heure indiquée.</p>
<p style="margin:12px 0 0;font-size:13px;color:#6b6b6b">Un empêchement ? Prévenez-nous au moins ${R.cancelHours} h avant au ${esc(B.phone)} : l’acompte vous est remboursé ou reporté. En dessous de ${R.cancelHours} h, il reste acquis à l’atelier (<a href="${esc(env.SITE_URL || B.siteUrl)}/conditions-reservation/" style="color:#9a7a2c">conditions de réservation</a>).</p>
<p style="margin:12px 0 0;font-size:13px;color:#6b6b6b">Le rendez-vous est joint à cet e-mail : ouvrez le fichier pour l’ajouter à votre agenda.</p>`
        ),
        attachments: [
          {
            filename: 'rendez-vous-solar-car-37.ics',
            content: btoa(unescape(encodeURIComponent(ics({ id: b.sessionId, start, end, title, text: `Payé en ligne : ${euros(paid)}. Reste à régler : ${euros(due)}. ${B.phone}` })))),
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
