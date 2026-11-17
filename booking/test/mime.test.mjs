// The e-mail reader of the quote discussions (booking/mime.js) on mail as apps send it.
import test from 'node:test';
import assert from 'node:assert/strict';
import { parseMail, freshText, htmlToText, headerParams, decodeWords, addressOf, nameOf } from '../mime.js';

const crlf = (s) => s.replace(/\r?\n/g, '\r\n');
const b64 = (s) => Buffer.from(s).toString('base64');

// a reply from Gmail: text and HTML, quoted-printable, the quoted message below, a PDF attached
const GMAIL = crlf(`Delivered-To: devis@reponse.solarcar37.fr
Authentication-Results: mx.cloudflare.net; dkim=pass header.d=gmail.com header.s=20230601 header.b=abc; dmarc=pass header.from=gmail.com policy.dmarc=none; spf=pass smtp.mailfrom=gmail.com
MIME-Version: 1.0
From: Solar Car <contact.solarcar37@gmail.com>
Date: Tue, 17 Nov 2026 14:02:11 +0100
Message-ID: <CAF+gmail-1@mail.gmail.com>
In-Reply-To: <0102019a-ses-1@eu-west-1.amazonses.com>
References: <0102019a-ses-0@eu-west-1.amazonses.com>
 <0102019a-ses-1@eu-west-1.amazonses.com>
Subject: =?UTF-8?Q?Re=3A_Demande_de_devis_n=C2=B012_=E2=80=94_Mini_F56_JCW?=
To: "Matthieu Gousselot (devis n°12)" <devis@reponse.solarcar37.fr>
Content-Type: multipart/mixed; boundary="000000000000mixed"

--000000000000mixed
Content-Type: multipart/alternative; boundary="000000000000alt"

--000000000000alt
Content-Type: text/plain; charset="UTF-8"
Content-Transfer-Encoding: quoted-printable

Bonjour Matthieu,

Voici le devis : 1 190 =E2=82=AC, remise de 15 % le 19 novembre.

Bien cordialement,
Nicolas

Le mar. 17 nov. 2026 =C3=A0 13:03, Matthieu Gousselot via SOLAR CAR 37 <
reservation@solarcar37.fr> a =C3=A9crit :

> Demande de devis
> Client : Matthieu Gousselot
>

--000000000000alt
Content-Type: text/html; charset="UTF-8"
Content-Transfer-Encoding: quoted-printable

<div dir=3D"ltr"><p>Bonjour Matthieu,</p><p>Voici le devis : 1 190 =E2=82=AC</p></div><br><div class=3D"gmail_quote"><div>Le mar. 17 nov. =C3=A0 13:03 a =C3=A9crit :</div><blockquote>Demande</blockquote></div>

--000000000000alt--

--000000000000mixed
Content-Type: application/pdf; name="=?UTF-8?Q?devis_n=C2=B012.pdf?="
Content-Disposition: attachment; filename="=?UTF-8?Q?devis_n=C2=B012.pdf?="
Content-Transfer-Encoding: base64
X-Attachment-Id: f_1

${b64('%PDF-1.4 devis')}
--000000000000mixed
Content-Type: image/png; name="logo.png"
Content-Disposition: inline; filename="logo.png"
Content-ID: <ii_logo>
Content-Transfer-Encoding: base64

${b64('png')}
--000000000000mixed--
`);

test('a Gmail reply: headers, the new text only, the PDF, the signature logo marked inline', () => {
  const m = parseMail(new TextEncoder().encode(GMAIL));
  assert.equal(m.from, 'contact.solarcar37@gmail.com');
  assert.equal(m.fromName, 'Solar Car');
  assert.equal(m.subject, 'Re: Demande de devis n°12 — Mini F56 JCW');
  assert.equal(m.messageId, '<CAF+gmail-1@mail.gmail.com>');
  assert.deepEqual(m.inReplyTo, ['<0102019a-ses-1@eu-west-1.amazonses.com>']);
  assert.deepEqual(m.references, ['<0102019a-ses-0@eu-west-1.amazonses.com>', '<0102019a-ses-1@eu-west-1.amazonses.com>']);
  assert.match(m.auth[0], /dkim=pass header\.d=gmail\.com/);
  assert.match(m.text, /1 190 €/);
  assert.equal(freshText(m.text), 'Bonjour Matthieu,\n\nVoici le devis : 1 190 €, remise de 15 % le 19 novembre.\n\nBien cordialement,\nNicolas');
  assert.equal(freshText(htmlToText(m.html)), 'Bonjour Matthieu,\nVoici le devis : 1 190 €');
  assert.equal(m.attachments.length, 2);
  const [pdf, logo] = m.attachments;
  assert.deepEqual([pdf.filename, pdf.type, pdf.inline, new TextDecoder().decode(pdf.bytes)], ['devis n°12.pdf', 'application/pdf', false, '%PDF-1.4 devis']);
  assert.deepEqual([logo.filename, logo.inline], ['logo.png', true]);
  assert.equal(m.autoReply, false);
});

test('Outlook and Apple Mail quoting, RFC 2231 names, Latin-1, addresses', () => {
  assert.equal(freshText('Parfait, merci !\n\n________________________________\nDe : SOLAR CAR 37 <contact@solarcar37.fr>\nEnvoyé : mardi'), 'Parfait, merci !');
  assert.equal(freshText('Ok pour moi\n\nDe : SOLAR CAR 37 <contact@solarcar37.fr>\nEnvoyé : mardi 17 novembre'), 'Ok pour moi');
  assert.equal(freshText('Yes\n\nOn Tue, 17 Nov 2026 at 13:03, SOLAR CAR 37 <x@y.fr> wrote:\n> hello'), 'Yes');
  assert.equal(freshText('Merci\n-- \nEnvoyé de mon iPhone'), 'Merci');
  assert.equal(headerParams("attachment; filename*=UTF-8''capot%20ray%C3%A9.jpg").params.filename, 'capot rayé.jpg');
  assert.equal(headerParams('attachment; filename*0*=UTF-8\'\'tr%C3%A8s; filename*1*=%20long.pdf').params.filename, 'très long.pdf');
  assert.equal(decodeWords('=?ISO-8859-1?Q?R=E9ponse?= =?UTF-8?B?w6AgdG91cw==?='), 'Réponseà tous');
  assert.equal(addressOf('"Gousselot, Matthieu" <Matthieu.G@Example.com>'), 'matthieu.g@example.com');
  assert.equal(nameOf('=?UTF-8?Q?L=C3=A9a_Petit?= <lea@example.com>'), 'Léa Petit');
  const latin = parseMail(Buffer.from(crlf('From: lea@example.com\nSubject: test\nContent-Type: text/plain; charset=iso-8859-1\nContent-Transfer-Encoding: 8bit\nAuto-Submitted: auto-replied\n\nJ\xe9r\xf4me'), 'latin1'));
  assert.equal(latin.text, 'Jérôme');
  assert.equal(latin.autoReply, true);
});
