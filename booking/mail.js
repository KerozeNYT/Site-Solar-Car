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
import { bookingRules as R, formatDuration, discountLines, CANALS } from '../content/booking.js';
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

/** the discount lines of an e-mail: for the workshop « Parrainage −20 € (code MARIE-7K2QX) », for
 *  the client « Code NOEL −40 € » or « Parrainage −20 € »; the workshop's own « Remise » apart */
const discountRows = (q, b, forWorkshop) =>
  discountLines(q.discount, b).map(([label, off]) => {
    if (label === 'Remise') return ['Remise', `−${euros(off)}`];
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
const itemsOf = (q) => q.items.map((i) => `${esc(i.label)}<br><span style="font-weight:400;color:#6b6b6b">${[i.detail ? esc(i.detail) : '', euros(i.price)].filter(Boolean).join(' · ')}</span>`).join('<br>');
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
          // « réservé en ligne » (the site), « pris par téléphone · acompte payé en ligne » (the space)
          CANALS[b.canal] ? `Nouveau rendez-vous pris ${CANALS[b.canal]}${b.mode === 'none' ? '' : ` · ${b.mode === 'full' ? 'payé' : 'acompte payé'} en ligne`}` : 'Nouveau rendez-vous réservé en ligne',
          `<table role="presentation" cellpadding="0" cellspacing="0" style="font-size:14px">${rows([
            ['Quand', esc(when)],
            ['Client', esc(`${c.firstName} ${c.lastName}`)],
            ['Téléphone', `<a href="tel:${esc(c.phone.replace(/[^\d+]/g, ''))}" style="color:#111">${esc(c.phone)}</a>`],
            ['E-mail', `<a href="mailto:${esc(c.email)}" style="color:#111">${esc(c.email)}</a>`],
            ['Véhicule', esc(`${c.vehicle}${c.plate ? ` (${c.plate})` : ''}`)],
            ['Prestations', items],
            ...discountRows(q, b, true),
            ['Total', euros(q.total)],
            ['Payé en ligne', b.mode === 'none' ? '' : `${euros(paid)} (${b.mode === 'full' ? 'totalité' : 'acompte 30 %'})`],
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
        html: shell(
          'Votre rendez-vous est confirmé',
          `${b.note ? `<p style="margin:0 0 18px;font-size:15px;line-height:1.55;color:#111;white-space:pre-wrap">${esc(b.note)}</p>` : `<p style="margin:0 0 16px;font-size:15px;color:#111">Bonjour ${esc(c.firstName)},<br>merci pour votre réservation : votre créneau vous est réservé à l’atelier.</p>`}
<table role="presentation" cellpadding="0" cellspacing="0" style="font-size:14px">${rows([
            ['Quand', esc(when)],
            ['Où', `${esc(address)}<br><a href="${route}" style="color:#9a7a2c">Itinéraire</a>`],
            ['Prestations', items],
            ...discountRows(q, b, false),
            ['Total', `${euros(q.total)}<br><span style="font-weight:400;color:#6b6b6b;font-size:12px">${esc(vatNote)}</span>`],
            ['Payé en ligne', b.mode === 'none' ? '' : euros(paid)],
            ['À régler à l’atelier', due ? euros(due) : 'rien'],
          ])}</table>
<p style="margin:18px 0 0;font-size:14px;color:#111">La teinte se choisit avec vous à l’atelier, le jour du rendez-vous. Prévoyez de déposer le véhicule à l’heure indiquée.</p>
<p style="margin:12px 0 0;font-size:13px;color:#6b6b6b">${b.mode === 'none' ? `Un empêchement ? Prévenez-nous au plus vite au ${esc(B.phone)}.` : `Un empêchement ? Prévenez-nous au moins ${R.cancelHours} h avant au ${esc(B.phone)} : l’acompte vous est remboursé ou reporté. En dessous de ${R.cancelHours} h, il reste acquis à l’atelier (<a href="${esc(env.SITE_URL || B.siteUrl)}/conditions-reservation/" style="color:#9a7a2c">conditions de réservation</a>).`}</p>
<p style="margin:12px 0 0;font-size:13px;color:#6b6b6b">Le rendez-vous est joint à cet e-mail : ouvrez le fichier pour l’ajouter à votre agenda.</p>`
        ),
        attachments: [
          {
            filename: 'rendez-vous-solar-car-37.ics',
            content: btoa(unescape(encodeURIComponent(ics({ id: b.sessionId, start, end, title, text: `${b.mode === 'none' ? '' : `Payé en ligne : ${euros(paid)}. `}Reste à régler : ${euros(due)}. ${B.phone}` })))),
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
    html: shell(
      'Votre rendez-vous vous attend',
      `${note ? `<p style="margin:0 0 18px;font-size:15px;line-height:1.55;color:#111;white-space:pre-wrap">${esc(note)}</p>` : `<p style="margin:0 0 16px;font-size:15px;color:#111">Bonjour ${esc(c.firstName)},<br>comme convenu${b.canal === 'atelier' ? ' lors de votre passage' : b.canal === 'telephone' ? ' au téléphone' : ''}, voici votre rendez-vous à l’atelier. Il est confirmé dès que ${what} est réglé en ligne.</p>`}<table role="presentation" cellpadding="0" cellspacing="0" style="font-size:14px">${rows([
        ['Quand', esc(`${dayLabel(date)}, ${hour(time)} – ${endOf(end)}`)],
        ['Où', `${esc(address)}<br><a href="${route}" style="color:#9a7a2c">Itinéraire</a>`],
        ['Véhicule', esc(`${c.vehicle || ''}${c.plate ? ` (${c.plate})` : ''}`)],
        ['Prestations', itemsOf(q)],
        ...discountRows(q, b, false),
        ['Total', `${euros(q.total)}<br><span style="font-weight:400;color:#6b6b6b;font-size:12px">${esc(vatNote)}</span>`],
        [mode === 'full' ? 'À régler en ligne' : 'Acompte en ligne', euros(due)],
        ['À régler à l’atelier', q.total - due > 0 ? euros(q.total - due) : 'rien'],
      ])}</table>
<p style="margin:22px 0 8px">${button(url, `Régler ${euros(due)} et confirmer`)}</p>
<p style="margin:0;font-size:13px;color:#6b6b6b">Paiement sécurisé par Stripe. Le créneau vous est gardé jusqu’au ${esc(until)} ; passé ce délai, il est libéré : rappelez-nous au ${esc(B.phone)}.</p>
<p style="margin:12px 0 0;font-size:13px;color:#6b6b6b">L’acompte est remboursé ou reporté si vous prévenez au moins ${R.cancelHours} h avant le rendez-vous (<a href="${esc(env.SITE_URL || B.siteUrl)}/conditions-reservation/" style="color:#9a7a2c">conditions de réservation</a>).</p>`
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
      subject,
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
<p style="margin:0 0 4px;color:#e9cd82;font-size:12px;font-weight:700;letter-spacing:.14em">DEVIS N°${r.id}${amount ? ` · ${esc(amount)}` : ''}</p>
<p style="margin:0 0 14px;color:#ffffff;font-size:16px;line-height:1.45">Ce devis vous convient ? Un clic suffit : nous vous appelons ensuite pour fixer la date.</p>
<a href="${esc(x.acceptUrl)}" style="display:inline-block;background:#e9cd82;color:#0b0c0f;text-decoration:none;font-weight:800;padding:12px 22px;border-radius:999px">J’accepte ce devis</a></td></tr></table>`
    : '';
  const recap = `${dateFr(r.at)} : ${[r.vehicle, r.services].filter(Boolean).join(' · ')}`;
  return send(env, {
    from: `${B.name} <${B.email}>`,
    to: [r.email],
    ...(x.bcc?.length ? { bcc: x.bcc } : {}),
    reply_to: relayAddress(env) ? named(B.name, relayAddress(env)) : B.email,
    subject: `Re: ${r.subject || quoteSubject(r)}`,
    ...(threadHeaders(x.refs) ? { headers: threadHeaders(x.refs) } : {}),
    html: shell(
      `Votre demande de devis n°${r.id}`,
      `${paragraphs(x.text)}${files.length ? `<p style="margin:0 0 14px;font-size:13px;color:#6b6b6b">${esc(filesLine(files))}</p>` : ''}${accept}
<p style="margin:0 0 6px;font-size:13px;line-height:1.5;color:#6b6b6b">Une question ? Répondez simplement à cet e-mail, ou appelez le <a href="tel:${esc(B.phone.replace(/[^\d+]/g, ''))}" style="color:#9a7a2c">${esc(B.phone)}</a>.</p>
<p style="margin:14px 0 0;padding-top:12px;border-top:1px solid #eee;font-size:12px;line-height:1.5;color:#8a8a8a">Votre demande n°${r.id} du ${esc(recap)}</p>`
    ),
    text: `${x.text}\n\n${files.length ? `${filesLine(files)}\n\n` : ''}${x.acceptUrl ? `Ce devis vous convient ? Acceptez-le en un clic : ${x.acceptUrl}\n\n` : ''}Une question ? Répondez simplement à cet e-mail, ou appelez le ${B.phone}.\n\n—\nVotre demande n°${r.id} du ${recap}\n`,
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
