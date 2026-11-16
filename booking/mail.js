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
import { vatNote } from '../content/pricing.js';

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
export const shell = (title, body) => `<!doctype html><html lang="fr"><body style="margin:0;background:#f4f2ee;font-family:Arial,Helvetica,sans-serif">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f2ee;padding:24px 12px"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:14px;overflow:hidden">
<tr><td style="background:#0b0c0f;padding:20px 24px;color:#e9cd82;font-size:18px;font-weight:800;letter-spacing:.08em">SOLAR CAR 37</td></tr>
<tr><td style="padding:24px"><h1 style="margin:0 0 16px;font-size:20px;color:#111">${esc(title)}</h1>${body}</td></tr>
<tr><td style="padding:16px 24px;background:#faf8f4;color:#6b6b6b;font-size:12px">${esc(B.name)} · ${esc(address)} · ${esc(B.phone)}</td></tr>
</table></td></tr></table></body></html>`;

export async function send(env, mail) {
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
const endOf = (end) => new Intl.DateTimeFormat('fr-FR', { hour: 'numeric', minute: '2-digit', timeZone: R.timeZone }).format(new Date(end)).replace(':', ' h ');
const itemsOf = (q) => q.items.map((i) => `${esc(i.label)}<br><span style="font-weight:400;color:#6b6b6b">${esc(i.detail)} · ${esc(formatDuration(i.minutes))} · ${euros(i.price)}</span>`).join('<br>');
const button = (href, label) => `<a href="${esc(href)}" style="display:inline-block;background:#0b0c0f;color:#e9cd82;text-decoration:none;font-weight:700;padding:12px 20px;border-radius:999px">${esc(label)}</a>`;

export async function sendBookingMails(env, b) {
  if (!env.RESEND_API_KEY) return [];
  const { q, c, date, time, start, end, paid } = b;
  const when = `${dayLabel(date)}, ${hour(time)} – ${endOf(end)}`;
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
          'Nouveau rendez-vous réservé en ligne',
          `<table role="presentation" cellpadding="0" cellspacing="0" style="font-size:14px">${rows([
            ['Quand', esc(when)],
            ['Client', esc(`${c.firstName} ${c.lastName}`)],
            ['Téléphone', `<a href="tel:${esc(c.phone.replace(/[^\d+]/g, ''))}" style="color:#111">${esc(c.phone)}</a>`],
            ['E-mail', `<a href="mailto:${esc(c.email)}" style="color:#111">${esc(c.email)}</a>`],
            ['Véhicule', esc(`${c.vehicle}${c.plate ? ` (${c.plate})` : ''}`)],
            ['Prestations', items],
            ['Parrainage', q.discount ? `−${euros(q.discount)} (code ${esc(b.code || '')})` : ''],
            ['Total', euros(q.total)],
            ['Payé en ligne', `${euros(paid)} (${b.mode === 'full' ? 'totalité' : 'acompte 30 %'})`],
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
            ['Parrainage', q.discount ? `−${euros(q.discount)}` : ''],
            ['Total', `${euros(q.total)}<br><span style="font-weight:400;color:#6b6b6b;font-size:12px">${esc(vatNote)}</span>`],
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
    html: shell(
      'À demain à l’atelier',
      `<p style="margin:0 0 16px;font-size:15px;color:#111">Bonjour ${esc(c.firstName)},<br>petit rappel : nous vous attendons demain à l’atelier${c.vehicle ? ` avec votre ${esc(c.vehicle)}` : ''}.</p>
<table role="presentation" cellpadding="0" cellspacing="0" style="font-size:14px">${rows([
        ['Quand', esc(`${dayLabel(date)}, ${hour(time)} – ${endOf(end)}`)],
        ['Où', `${esc(address)}<br><a href="${route}" style="color:#9a7a2c">Itinéraire</a>`],
        ['Prestations', itemsOf(q)],
        ['À régler à l’atelier', due ? euros(due) : 'rien, tout est réglé'],
      ])}</table>
<p style="margin:18px 0 0;font-size:14px;color:#111">Prévoyez de déposer le véhicule à l’heure indiquée. La teinte se choisit avec vous sur place.</p>
<p style="margin:12px 0 0;font-size:13px;color:#6b6b6b">Un empêchement ou un retard ? Prévenez-nous au plus vite au <a href="tel:${esc(B.phone.replace(/[^\d+]/g, ''))}" style="color:#9a7a2c">${esc(B.phone)}</a> ou en répondant à cet e-mail.</p>`
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
  const review = B.google?.reviewUrl;
  await send(env, {
    to: [c.email],
    reply_to: B.email,
    subject: c.vehicle ? `Des nouvelles de votre ${c.vehicle} ?` : `Tout va bien depuis votre passage chez ${B.name} ?`,
    html: shell(
      'Tout se passe bien ?',
      `${p(`Bonjour ${esc(c.firstName)},`)}
${p(`Cela fait une semaine que nous nous sommes occupés de votre ${esc(c.vehicle || 'véhicule')} : ${esc(what)}. Je voulais simplement prendre de vos nouvelles, et j’espère que le résultat vous plaît autant qu’à nous !`)}
${p(`Si quelque chose vous chiffonne, ou si vous avez la moindre question, <strong>répondez simplement à cet e-mail</strong> ou appelez-moi au <a href="tel:${esc(B.phone.replace(/[^\d+]/g, ''))}" style="color:#9a7a2c">${esc(B.phone)}</a> : ce sera avec grand plaisir, et nous trouverons une solution ensemble.`)}
${review ? `${p('Et si vous avez un petit moment, votre avis sur Google nous aiderait vraiment : pour un atelier comme le nôtre, c’est ce qui compte le plus pour se faire connaître en Touraine.', true)}
<p style="margin:0 0 6px">${button(review, 'Donner mon avis sur Google')}</p>` : ''}
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
