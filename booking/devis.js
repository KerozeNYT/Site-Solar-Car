// The workshop's quotes as PDF (A4), made by the worker (pdf-lib, the standard fonts) from a quote
// request of the space (/atelier/devis/<n>): the mentions the law asks for an artisan's quote
// (who, the client, the detail and the prices, « TVA non applicable, art. 293 B du CGI », the
// validity, the payment terms, the professional insurance and its area, the consumer mediator,
// « Bon pour accord »), in the look of the e-mails: the logo, a gold rule, a black table head.
// The invoices stay in the invoicing software (MEG): one numbering, continuous, there.
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { business as B } from '../content/site.js';
import { bookingRules as R } from '../content/booking.js';

const hex = (h) => rgb(parseInt(h.slice(1, 3), 16) / 255, parseInt(h.slice(3, 5), 16) / 255, parseInt(h.slice(5, 7), 16) / 255);
const INK = hex('#111111');
const DIM = hex('#6f6b63');
const GOLD = hex('#b8913a');
const GOLD_SOFT = hex('#fbf6ea');
const GOLD_LINE = hex('#ecdcb5');
const NIGHT = hex('#0b0c0f');
const PAPER = hex('#f7f4ee');
const RULE = hex('#e6e1d8');

// the standard fonts write WinAnsi only: the other characters made plain (« 1 234 € », « − 20 € »)
const WIN = new Set('€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ');
const plain = (t) =>
  String(t ?? '')
    .replace(/[   ]/g, ' ')
    .replace(/−/g, '-')
    .replace(/[←-⇿]/g, '>')
    .replace(/[^\n -~ -ÿ]/g, (c) => (WIN.has(c) ? c : '?'));
const money = (n) => plain(new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(n) || 0));
const day = (ms) => new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: R.timeZone }).format(new Date(ms));
/** the same day, `months` later (a quote valid one month) */
export const plusMonths = (ms, months) => {
  const d = new Date(ms);
  const out = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + months, d.getUTCDate(), 12));
  if (out.getUTCDate() !== d.getUTCDate()) out.setUTCDate(0); // 31 January + 1 month: 28/29 February
  return out.getTime();
};
const duration = (min) => (min >= 60 ? `${Math.floor(min / 60)} h${min % 60 ? ` ${String(min % 60).padStart(2, '0')}` : ''}` : `${min} min`);

/**
 * d: { number, date (ms), client: { name, address, phone, email }, vehicle, plate,
 *      items: [{ label, detail, qty, unit }], discount: { label, amount }, minutes, note, request }
 * opts.logo: the logo's PNG bytes (booking/assets/logo-sombre-800.png)
 * Returns { bytes (Uint8Array), total, deposit, validUntil }.
 */
export async function devisPdf(d, opts = {}) {
  const doc = await PDFDocument.create();
  doc.setTitle(plain(`Devis ${d.number} — ${B.name}`));
  doc.setAuthor(plain(B.name));
  doc.setCreator(plain(`${B.name} — espace atelier`));
  doc.setLanguage('fr-FR');
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const logo = opts.logo ? await doc.embedPng(opts.logo).catch(() => null) : null;

  const W = 595.28;
  const H = 841.89;
  const M = 42;
  let page = doc.addPage([W, H]);
  const pages = [page];
  let y = H - M;

  const width = (t, size, f = font) => f.widthOfTextAtSize(plain(t), size);
  const text = (t, x, yy, { size = 9.5, f = font, color = INK, right = false, spacing = 0 } = {}) => {
    const s = plain(t);
    if (!s) return;
    const w = f.widthOfTextAtSize(s, size) + spacing * Math.max(0, s.length - 1);
    if (spacing) {
      // letter-spaced capitals (the small titles)
      let cx = right ? x - w : x;
      for (const ch of s) {
        page.drawText(ch, { x: cx, y: yy, size, font: f, color });
        cx += f.widthOfTextAtSize(ch, size) + spacing;
      }
      return;
    }
    page.drawText(s, { x: right ? x - w : x, y: yy, size, font: f, color });
  };
  const wrap = (t, size, max, f = font) => {
    const out = [];
    for (const para of plain(t).split('\n')) {
      let line = '';
      for (const word of para.split(/ +/)) {
        const next = line ? `${line} ${word}` : word;
        if (line && f.widthOfTextAtSize(next, size) > max) {
          out.push(line);
          line = word;
        } else line = next;
      }
      out.push(line);
    }
    return out;
  };
  const box = (x, yy, w, h, { fill, line, r = 8 } = {}) => {
    const p = `M ${r} 0 H ${w - r} Q ${w} 0 ${w} ${r} V ${h - r} Q ${w} ${h} ${w - r} ${h} H ${r} Q 0 ${h} 0 ${h - r} V ${r} Q 0 0 ${r} 0 Z`;
    page.drawSvgPath(p, { x, y: yy + h, color: fill, borderColor: line, borderWidth: line ? 0.8 : 0 });
  };
  const rule = (yy, color = RULE, x1 = M, x2 = W - M, t = 0.7) => page.drawLine({ start: { x: x1, y: yy }, end: { x: x2, y: yy }, thickness: t, color });

  // ---------------------------------------------------------------- head: the logo, « DEVIS », its number
  if (logo) {
    const h = 46;
    const w = (logo.width / logo.height) * h;
    page.drawImage(logo, { x: M, y: y - h + 4, width: w, height: h });
  } else text(B.name, M, y - 22, { size: 20, f: bold });
  text('DEVIS', W - M, y - 18, { size: 26, f: bold, right: true, spacing: 2 });
  text(`N° ${d.number}`, W - M, y - 34, { size: 10.5, f: bold, color: GOLD, right: true });
  const validUntil = plusMonths(d.date, B.quoteValidMonths || 1);
  text(`Établi le ${day(d.date)} · valable jusqu’au ${day(validUntil)}`, W - M, y - 48, { size: 8.5, color: DIM, right: true });
  y -= 64;
  page.drawRectangle({ x: M, y, width: W - 2 * M, height: 2, color: GOLD });
  y -= 18;

  // ---------------------------------------------------------------- who: the workshop, the client
  const colW = (W - 2 * M - 14) / 2;
  const me = [
    [B.name, bold, 10.5, INK],
    [B.legalName, font, 9, INK],
    [`${B.address.street}, ${B.address.postalCode} ${B.address.city}`, font, 9, INK],
    [`${B.phone} · ${B.email}`, font, 9, INK],
    [`SIRET ${B.siret}`, font, 8.5, DIM],
    B.rm ? [`Répertoire des métiers : ${B.rm}`, font, 8.5, DIM] : null,
    [String(B.legalForm || '').replace(/ — /g, ', '), font, 8.5, DIM],
  ].filter(Boolean);
  const c = d.client || {};
  const them = [
    [c.name || 'Client', bold, 10.5, INK],
    ...wrap(c.address || '', 9, colW - 28).filter(Boolean).map((l) => [l, font, 9, INK]),
    c.phone ? [c.phone, font, 9, INK] : null,
    c.email ? [c.email, font, 9, INK] : null,
    d.vehicle ? [`Véhicule : ${d.vehicle}${d.plate ? ` · ${d.plate}` : ''}`, bold, 9, INK] : null,
  ].filter(Boolean);
  const rows = Math.max(me.length, them.length);
  const bh = 30 + rows * 12.8;
  box(M, y - bh, colW, bh, { fill: PAPER });
  box(M + colW + 14, y - bh, colW, bh, { fill: PAPER });
  text('ÉMETTEUR', M + 14, y - 18, { size: 7.5, f: bold, color: GOLD, spacing: 1.2 });
  text('CLIENT', M + colW + 28, y - 18, { size: 7.5, f: bold, color: GOLD, spacing: 1.2 });
  me.forEach(([t, f, s, col], i) => text(t, M + 14, y - 34 - i * 12.8, { size: s, f, color: col }));
  them.forEach(([t, f, s, col], i) => text(t, M + colW + 28, y - 34 - i * 12.8, { size: s, f, color: col }));
  y -= bh + 20;
  if (d.request) {
    text(`Suite à votre demande de devis n°${d.request}`, M, y, { size: 9, color: DIM });
    y -= 16;
  }

  // ---------------------------------------------------------------- the detail
  const X = { label: M + 12, qty: W - M - 190, unit: W - M - 92, total: W - M - 12 };
  const head = () => {
    box(M, y - 24, W - 2 * M, 24, { fill: NIGHT, r: 6 });
    text('DÉSIGNATION', X.label, y - 15.5, { size: 7.5, f: bold, color: hex('#e9cd82'), spacing: 1 });
    text('QTÉ', X.qty, y - 15.5, { size: 7.5, f: bold, color: hex('#e9cd82'), spacing: 1, right: true });
    text('PRIX UNITAIRE', X.unit, y - 15.5, { size: 7.5, f: bold, color: hex('#e9cd82'), spacing: 1, right: true });
    text('TOTAL', X.total, y - 15.5, { size: 7.5, f: bold, color: hex('#e9cd82'), spacing: 1, right: true });
    y -= 24;
  };
  const newPage = () => {
    page = doc.addPage([W, H]);
    pages.push(page);
    y = H - M;
    text(`Devis ${d.number} (suite)`, M, y - 10, { size: 9, f: bold, color: DIM });
    y -= 28;
  };
  head();
  let sum = 0;
  for (const it of d.items || []) {
    const qty = Number(it.qty) || 1;
    const unit = Math.round((Number(it.unit) || 0) * 100) / 100;
    const line = Math.round(qty * unit * 100) / 100;
    sum += line;
    const labels = wrap(it.label, 10, X.qty - X.label - 40, bold);
    const details = it.detail ? wrap(it.detail, 8.5, X.qty - X.label - 40) : [];
    const h = 14 + labels.length * 13 + details.length * 11.5;
    if (y - h < 250) {
      newPage();
      head();
    }
    labels.forEach((l, i) => text(l, X.label, y - 18 - i * 13, { size: 10, f: bold }));
    details.forEach((l, i) => text(l, X.label, y - 18 - labels.length * 13 - i * 11.5 + 1, { size: 8.5, color: DIM }));
    text(String(qty).replace('.', ','), X.qty, y - 18, { size: 10, right: true });
    text(money(unit), X.unit, y - 18, { size: 10, right: true });
    text(money(line), X.total, y - 18, { size: 10, f: bold, right: true });
    y -= h;
    rule(y);
  }
  sum = Math.round(sum * 100) / 100;
  const off = Math.min(sum, Math.max(0, Number(d.discount?.amount) || 0));
  const total = Math.round((sum - off) * 100) / 100;
  const deposit = Math.round(total * R.depositRate * 100) / 100;

  // ---------------------------------------------------------------- the totals
  y -= 14;
  const tw = 232;
  const tx = W - M - tw;
  const lines = [off ? ['Sous-total', money(sum)] : null, off ? [d.discount.label || 'Remise', `- ${money(off)}`] : null].filter(Boolean);
  const th = 22 + lines.length * 16 + 34;
  box(tx, y - th, tw, th, { fill: GOLD_SOFT, line: GOLD_LINE, r: 10 });
  let ty = y - 20;
  for (const [k, v] of lines) {
    text(k, tx + 14, ty, { size: 9.5, color: DIM });
    text(v, tx + tw - 14, ty, { size: 9.5, right: true });
    ty -= 16;
  }
  text('TOTAL NET', tx + 14, ty - 8, { size: 9, f: bold, spacing: 1 });
  text(money(total), tx + tw - 14, ty - 10, { size: 17, f: bold, color: GOLD, right: true });
  text('TVA non applicable, art. 293 B du CGI', tx + tw - 14, ty - 26, { size: 7.5, color: DIM, right: true });
  // to the left of the totals: the duration, the deposit
  const leftW = tx - M - 20;
  let ly = y - 6;
  const side = [
    d.minutes ? `Durée estimée de la prestation : ${duration(d.minutes)}.` : '',
    `Acompte à la réservation : ${Math.round(R.depositRate * 100)} %, soit ${money(deposit)}. Le solde, ${money(total - deposit)}, se règle à l’atelier à la fin de la prestation.`,
  ].filter(Boolean);
  for (const p of side) {
    for (const l of wrap(p, 8.8, leftW)) {
      text(l, M, ly, { size: 8.8, color: INK });
      ly -= 12;
    }
    ly -= 5;
  }
  y = Math.min(y - th, ly) - 18;

  // ---------------------------------------------------------------- the conditions
  if (y < 230) newPage();
  text('CONDITIONS', M, y, { size: 7.5, f: bold, color: GOLD, spacing: 1.2 });
  y -= 14;
  const ins = B.insurance;
  const conditions = [
    `Devis gratuit, valable ${B.quoteValidMonths || 1} mois (jusqu’au ${day(validUntil)}). Prix nets en euros.`,
    'Date d’exécution : le jour du rendez-vous, fixé ensemble à l’acceptation du devis. Réservation et acompte en ligne, par téléphone ou à l’atelier.',
    d.items?.some((i) => /teint|pare-brise|film/i.test(`${i.label} ${i.detail || ''}`)) ? 'Films homologués ; la teinte se choisit avec vous à l’atelier, dans le respect de la réglementation (pare-brise et vitres avant : 70 % de transmission lumineuse au minimum).' : '',
    d.note || '',
    `Acompte : remboursé ou reporté en cas d’annulation au moins ${R.cancelHours} h avant le rendez-vous, acquis à l’atelier en deçà (conditions de réservation sur ${String(B.siteUrl).replace(/^https?:\/\//, '')}).`,
    ins ? `Assurance responsabilité civile professionnelle : ${ins.name}, ${ins.where} — couverture : ${ins.area}.` : '',
    B.mediator ? `Médiateur de la consommation : ${B.mediator}.` : 'Médiateur de la consommation : à compléter.',
  ].filter(Boolean);
  for (const p of conditions) {
    const ls = wrap(p, 8.3, W - 2 * M - 12);
    page.drawCircle({ x: M + 2, y: y + 2.6, size: 1.4, color: GOLD });
    ls.forEach((l, i) => text(l, M + 10, y - i * 10.5, { size: 8.2, color: hex('#3b3833') }));
    y -= ls.length * 10.5 + 3.5;
  }

  // ---------------------------------------------------------------- « Bon pour accord »
  y -= 8;
  const sh = 80;
  if (y - sh < M + 12) newPage();
  const sw = 250;
  box(W - M - sw, y - sh, sw, sh, { line: hex('#cfc8bb'), r: 10 });
  text('BON POUR ACCORD', W - M - sw + 14, y - 18, { size: 7.5, f: bold, color: GOLD, spacing: 1.2 });
  text('Date, signature du client, précédées de', W - M - sw + 14, y - 32, { size: 8, color: DIM });
  text('la mention « Bon pour accord »', W - M - sw + 14, y - 42, { size: 8, color: DIM });
  const lw = W - 2 * M - sw - 24;
  wrap(`Pour accepter : signez ce devis et renvoyez-le par e-mail à ${B.email}, ou cliquez sur « J’accepte ce devis » dans notre e-mail. Nous vous rappelons pour fixer la date du rendez-vous.`, 8.8, lw).forEach((l, i) => text(l, M, y - 14 - i * 12, { size: 8.8, color: INK }));

  // ---------------------------------------------------------------- the foot of each page
  pages.forEach((p, i) => {
    page = p;
    rule(M + 2, RULE);
    text(`${B.name} · ${B.legalName} · SIRET ${B.siret} · ${B.address.street}, ${B.address.postalCode} ${B.address.city} · ${B.phone} · ${String(B.siteUrl).replace(/^https?:\/\//, '')}`, M, M - 10, { size: 7, color: DIM });
    text(`${i + 1}/${pages.length}`, W - M, M - 10, { size: 7, color: DIM, right: true });
  });

  return { bytes: await doc.save(), total, deposit, validUntil };
}
