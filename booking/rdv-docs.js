// The papers of an appointment, as PDF (A4, pdf-lib, the standard fonts), in the look of the quote
// and the partnership file: the check-in when the car is dropped off (« Bon de dépôt » : its
// condition, the photos, the client's signature) and the tint certificate at the end (« Certificat
// de pose » : the shade of each window on a drawing of the car, the film, the lifetime guarantees,
// the care, the law). Made by the worker (booking/atelier.js), sent to the client on demand.
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { business as B } from '../content/site.js';
import { bookingRules as R } from '../content/booking.js';
import { tintFilm as F } from '../content/pricing.js';
import { glazing } from '../content/regulation.js';
import { plain } from './devis.js';

const hex = (h) => rgb(parseInt(h.slice(1, 3), 16) / 255, parseInt(h.slice(3, 5), 16) / 255, parseInt(h.slice(5, 7), 16) / 255);
const INK = hex('#15130f');
const TEXT = hex('#3b3833');
const DIM = hex('#77736b');
const GOLD = hex('#b8913a');
const GOLD_2 = hex('#e9cd82');
const GOLD_SOFT = hex('#fbf6ea');
const GOLD_LINE = hex('#ecdcb5');
const NIGHT = hex('#0b0c0f');
const PAPER = hex('#f7f4ee');
const RULE = hex('#e6e1d8');
const OK = hex('#2f7d4f');

/** the windows of a car, for the certificate: [key, label, where on the drawing] */
export const WINDOWS = [
  ['pare_brise', 'Pare-brise', 'front'],
  ['avant_g', 'Vitre avant gauche (conducteur)', 'front'],
  ['avant_d', 'Vitre avant droite (passager)', 'front'],
  ['arriere_g', 'Vitre arrière gauche', 'rear'],
  ['arriere_d', 'Vitre arrière droite', 'rear'],
  ['custode_g', 'Custode arrière gauche', 'rear'],
  ['custode_d', 'Custode arrière droite', 'rear'],
  ['lunette', 'Lunette arrière', 'rear'],
];
/** the windscreen films (content/pricing.js tint.windshield) */
export const WINDSHIELD = { athermique: 'Film athermique 70 %', irise: 'Film irisé' };
/** what the check-in looks at: ticked when there is something to note */
export const CHECKS = [
  ['vitres_impacts', 'Vitres : impacts ou éclats'],
  ['vitres_rayures', 'Vitres : rayures'],
  ['joints', 'Joints de vitres abîmés'],
  ['leve_vitres', 'Lève-vitre lent ou défaillant'],
  ['pare_brise', 'Pare-brise : impact ou fissure'],
  ['optiques_rayures', 'Optiques : rayures ou fissures'],
  ['optiques_jaunes', 'Optiques : jaunies ou opaques'],
  ['carrosserie', 'Carrosserie : rayures ou bosses visibles'],
  ['interieur', 'Intérieur : garnitures fragiles ou abîmées'],
];

const dayFr = (ms) => new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long', year: 'numeric', timeZone: R.timeZone }).format(new Date(ms));
const timeFr = (ms) => new Intl.DateTimeFormat('fr-FR', { hour: '2-digit', minute: '2-digit', timeZone: R.timeZone }).format(new Date(ms)).replace(':', ' h ');
const dataUrlBytes = (u) => {
  const m = String(u || '').match(/^data:image\/png;base64,([A-Za-z0-9+/=]+)$/);
  return m ? Uint8Array.from(atob(m[1]), (c) => c.charCodeAt(0)) : null;
};

/** a page maker: the helpers of both papers */
async function sheet(title) {
  const doc = await PDFDocument.create();
  doc.setTitle(plain(title));
  doc.setAuthor(plain(B.name));
  doc.setLanguage('fr-FR');
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const oblique = await doc.embedFont(StandardFonts.HelveticaOblique);
  const W = 595.28;
  const H = 841.89;
  const M = 44;
  const k = { doc, font, bold, oblique, W, H, M, pages: [], page: null, y: 0 };
  k.text = (t, x, yy, { size = 10, f = font, color = INK, right = false, center = false, spacing = 0 } = {}) => {
    const s = plain(t);
    if (!s) return;
    const w = f.widthOfTextAtSize(s, size) + spacing * Math.max(0, s.length - 1);
    let cx = right ? x - w : center ? x - w / 2 : x;
    if (!spacing) return k.page.drawText(s, { x: cx, y: yy, size, font: f, color });
    for (const ch of s) {
      k.page.drawText(ch, { x: cx, y: yy, size, font: f, color });
      cx += f.widthOfTextAtSize(ch, size) + spacing;
    }
  };
  k.wrap = (t, size, max, f = font) => {
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
  k.para = (t, x, max, { size = 9.5, f = font, color = TEXT, lead = 1.42 } = {}) => {
    for (const l of k.wrap(t, size, max, f)) {
      k.text(l, x, k.y, { size, f, color });
      k.y -= size * lead;
    }
  };
  k.box = (x, yy, w, h, { fill, line, r = 10 } = {}) => {
    const p = `M ${r} 0 H ${w - r} Q ${w} 0 ${w} ${r} V ${h - r} Q ${w} ${h} ${w - r} ${h} H ${r} Q 0 ${h} 0 ${h - r} V ${r} Q 0 0 ${r} 0 Z`;
    k.page.drawSvgPath(p, { x, y: yy + h, color: fill || undefined, borderColor: line || undefined, borderWidth: line ? 0.8 : 0 });
  };
  k.kicker = (t, x = M) => k.text(String(t).toUpperCase(), x, k.y, { size: 7.8, f: bold, color: GOLD, spacing: 1.4 });
  k.bullet = (t, { size = 9.2, x = M, max = W - 2 * M, color = GOLD } = {}) => {
    k.page.drawCircle({ x: x + 3, y: k.y + 3, size: 1.7, color });
    k.para(t, x + 12, max - 12, { size });
    k.y -= 2.5;
  };
  /** a new page: the logo, the title on the right, a gold rule */
  k.newPage = (head, sub) => {
    k.page = doc.addPage([W, H]);
    k.pages.push(k.page);
    k.y = H - M;
    if (k.logo) {
      const s = Math.min(130 / k.logo.width, 40 / k.logo.height);
      k.page.drawImage(k.logo, { x: M, y: k.y - k.logo.height * s, width: k.logo.width * s, height: k.logo.height * s });
    } else k.text(B.name, M, k.y - 24, { size: 18, f: bold });
    k.text(head, W - M, k.y - 16, { size: 18, f: bold, right: true, spacing: 1.2 });
    if (sub) k.text(sub, W - M, k.y - 32, { size: 9.5, color: DIM, right: true });
    k.y -= 56;
    k.page.drawRectangle({ x: M, y: k.y, width: W - 2 * M, height: 1.6, color: GOLD });
    k.y -= 22;
  };
  /** two boxes side by side: [[title, [[text, bold?]…]], …] */
  k.cards = (cols) => {
    const gap = 12;
    const w = (W - 2 * M - gap * (cols.length - 1)) / cols.length;
    const rows = Math.max(...cols.map(([, l]) => l.length));
    const h = 32 + rows * 13;
    cols.forEach(([t, lines], i) => {
      const x = M + i * (w + gap);
      k.box(x, k.y - h, w, h, { fill: PAPER });
      k.text(String(t).toUpperCase(), x + 14, k.y - 17, { size: 7.5, f: bold, color: GOLD, spacing: 1.2 });
      lines.forEach(([l, b], j) => k.text(l, x + 14, k.y - 33 - j * 13, { size: b ? 10.5 : 9, f: b ? bold : font, color: b ? INK : TEXT }));
    });
    k.y -= h + 18;
  };
  k.foot = () =>
    k.pages.forEach((p, i) => {
      k.page = p;
      p.drawLine({ start: { x: M, y: 36 }, end: { x: W - M, y: 36 }, thickness: 0.6, color: RULE });
      k.text(`${B.name} · ${B.legalName} · SIRET ${B.siret} · ${B.address.street}, ${B.address.postalCode} ${B.address.city} · ${B.phone} · ${B.email}`, M, 24, { size: 6.8, color: DIM });
      k.text(`${i + 1}/${k.pages.length}`, W - M, 24, { size: 6.8, color: DIM, right: true });
    });
  return k;
}

const who = (bk) => [bk.first, bk.last].filter(Boolean).join(' ') || 'Client';
const car = (bk, extra = {}) => [[bk.vehicle || extra.vehicle || 'Véhicule', true], extra.plate || bk.plate ? [`Immatriculation : ${extra.plate || bk.plate}`] : null, extra.km ? [`Kilométrage : ${String(extra.km).replace(/\B(?=(\d{3})+(?!\d))/g, ' ')} km`] : null].filter(Boolean);
const client = (bk) => [[who(bk), true], bk.phone ? [bk.phone] : null, bk.email ? [bk.email] : null].filter(Boolean);
const services = (bk) => {
  try {
    return JSON.parse(bk.items || '[]').map((i) => i.label);
  } catch {
    return [];
  }
};

/**
 * The check-in (« Bon de dépôt »): bk the booking (with its client), ci { at, km, plate, checks
 * [keys], notes, sign (PNG data URL), signName }, photos [{ bytes, type }], opts.logo (PNG bytes).
 */
export async function depositPdf(bk, ci, photos = [], opts = {}) {
  const k = await sheet(`Bon de dépôt — ${who(bk)}`);
  k.logo = opts.logo ? await k.doc.embedPng(opts.logo).catch(() => null) : null;
  const at = Number(ci.at) || Date.now();
  k.newPage('BON DE DÉPÔT', `État des lieux du véhicule · ${dayFr(at)} à ${timeFr(at)}`);
  k.cards([
    ['Client', client(bk)],
    ['Véhicule', car(bk, ci)],
  ]);
  const work = services(bk);
  if (work.length) {
    k.kicker('Prestations prévues');
    k.y -= 15;
    for (const w of work) k.bullet(w);
    k.y -= 8;
  }
  k.kicker('État constaté au dépôt');
  k.y -= 16;
  const seen = new Set(ci.checks || []);
  const colW = (k.W - 2 * k.M - 16) / 2;
  CHECKS.forEach(([key, label], i) => {
    const x = k.M + (i % 2) * (colW + 16);
    const yy = k.y - Math.floor(i / 2) * 17;
    const on = seen.has(key);
    k.box(x, yy - 3, 11, 11, { line: on ? GOLD : hex('#bdb6a8'), fill: on ? GOLD_SOFT : undefined, r: 2.5 });
    if (on) k.text('x', x + 3, yy - 0.5, { size: 9, f: k.bold, color: GOLD });
    k.text(label, x + 18, yy, { size: 9.2, color: on ? INK : DIM, f: on ? k.bold : k.font });
  });
  k.y -= Math.ceil(CHECKS.length / 2) * 17 + 6;
  if (!seen.size) {
    k.text('Rien à signaler sur les points ci-dessus.', k.M, k.y, { size: 9.2, color: OK, f: k.bold });
    k.y -= 16;
  }
  if (String(ci.notes || '').trim()) {
    k.y -= 4;
    k.kicker('Remarques');
    k.y -= 15;
    k.para(ci.notes, k.M, k.W - 2 * k.M, { size: 9.5 });
    k.y -= 6;
  }
  // the signature
  const sh = 104;
  if (k.y - sh - 8 < 52) k.newPage('BON DE DÉPÔT', who(bk));
  k.y -= 8;
  k.box(k.M, k.y - sh, k.W - 2 * k.M, sh, { line: hex('#cfc8bb'), r: 12 });
  k.text('SIGNATURE DU CLIENT', k.M + 16, k.y - 18, { size: 7.5, f: k.bold, color: GOLD, spacing: 1.2 });
  const lines = k.wrap('Le client reconnaît l’état du véhicule décrit ci-dessus au moment du dépôt. Les objets personnels laissés dans le véhicule restent sous sa responsabilité.', 8.4, 250);
  lines.forEach((l, i) => k.text(l, k.M + 16, k.y - 34 - i * 11, { size: 8.4, color: TEXT }));
  k.text(`${ci.signName || who(bk)} · ${dayFr(at)}`, k.M + 16, k.y - sh + 14, { size: 8.6, f: k.bold });
  const sig = dataUrlBytes(ci.sign);
  if (sig) {
    const img = await k.doc.embedPng(sig).catch(() => null);
    if (img) {
      const s = Math.min(200 / img.width, 80 / img.height);
      k.page.drawImage(img, { x: k.W - k.M - 16 - img.width * s, y: k.y - sh + 10, width: img.width * s, height: img.height * s });
    }
  }
  k.y -= sh + 14;
  // the photos: three a row, as many pages as needed
  const imgs = [];
  for (const p of photos.slice(0, 18)) {
    const img = await (p.type === 'image/png' ? k.doc.embedPng(p.bytes) : k.doc.embedJpg(p.bytes)).catch(() => null);
    if (img) imgs.push(img);
  }
  if (imgs.length) {
    k.y -= 6;
    k.kicker(`Photos au dépôt (${imgs.length})`);
    k.y -= 12;
    const gw = (k.W - 2 * k.M - 2 * 10) / 3;
    const gh = gw * 0.72;
    for (let i = 0; i < imgs.length; i++) {
      if (i % 3 === 0 && k.y - gh < 52) k.newPage('BON DE DÉPÔT', `Photos · ${who(bk)}`);
      const x = k.M + (i % 3) * (gw + 10);
      const img = imgs[i];
      const s = Math.min(gw / img.width, gh / img.height);
      k.box(x, k.y - gh, gw, gh, { fill: hex('#efece6'), r: 6 });
      k.page.drawImage(img, { x: x + (gw - img.width * s) / 2, y: k.y - gh + (gh - img.height * s) / 2, width: img.width * s, height: img.height * s });
      if (i % 3 === 2 || i === imgs.length - 1) k.y -= gh + 10;
    }
  }
  k.foot();
  return k.doc.save();
}

/** the shade of a window, as said on the certificate */
export const shadeText = (key, v) => (!v ? 'Non teintée' : key === 'pare_brise' ? WINDSHIELD[v] || 'Film' : `${v} %`);

/**
 * The tint certificate (« Certificat de pose »): bk the booking, cert { at, plate, year, shades
 * { window: '5'…'70' | 'athermique' | 'irise' | '' }, notes }, opts { logo, sign (the workshop's
 * signature, PNG data URL) }.
 */
export async function certificatePdf(bk, cert, opts = {}) {
  const k = await sheet(`Certificat de pose — ${who(bk)}`);
  k.logo = opts.logo ? await k.doc.embedPng(opts.logo).catch(() => null) : null;
  const at = Number(cert.at) || Date.now();
  const plate = String(cert.plate || bk.plate || '').toUpperCase();
  const ref = `CP-${new Date(at).toISOString().slice(0, 10).replace(/-/g, '')}${plate ? `-${plate.replace(/[^A-Z0-9]/g, '')}` : ''}`;
  k.newPage('CERTIFICAT DE POSE', `Vitres teintées · posées le ${dayFr(at)} · Réf. ${ref}`);
  k.cards([
    ['Client', client(bk)],
    ['Véhicule', [[bk.vehicle || 'Véhicule', true], plate ? [`Immatriculation : ${plate}`] : null, cert.year ? [`Année : ${cert.year}`] : null].filter(Boolean)],
  ]);

  // the film: its lines measured first, then the black box around them
  const feat = F.features.map((f) => k.wrap(f, 8.6, k.W - 2 * k.M - 56));
  const fh = 50 + feat.reduce((a, ls) => a + ls.length * 11 + 3, 0) + 8;
  k.box(k.M, k.y - fh, k.W - 2 * k.M, fh, { fill: NIGHT, r: 12 });
  k.text('FILM POSÉ', k.M + 18, k.y - 18, { size: 7.5, f: k.bold, color: GOLD_2, spacing: 1.4 });
  k.text(`${F.name} — ${F.range}`, k.M + 18, k.y - 34, { size: 13, f: k.bold, color: hex('#f6f2ea') });
  let fy = k.y - 52;
  for (const ls of feat) {
    k.page.drawCircle({ x: k.M + 22, y: fy + 3, size: 1.6, color: GOLD_2 });
    for (const l of ls) {
      k.text(l, k.M + 30, fy, { size: 8.6, color: hex('#d9d3c5') });
      fy -= 11;
    }
    fy -= 3;
  }
  k.y -= fh + 20;

  // the shades: the drawing of the car on the left, the list on the right
  k.kicker('Teintes posées');
  k.y -= 14;
  const shades = cert.shades || {};
  const top = k.y;
  const cx = k.M + 92;
  const carW = 128;
  const carH = 250;
  const x0 = cx - carW / 2;
  const y0 = top - carH;
  const fill = (key) => {
    const v = shades[key];
    if (!v) return hex('#dde6ec');
    if (key === 'pare_brise') return v === 'irise' ? hex('#b9a6e0') : hex('#c9d6de');
    const n = Number(v);
    const g = 0.1 + 0.62 * (n / 100);
    return rgb(g, g, g + 0.02);
  };
  // the body
  k.box(x0, y0, carW, carH, { fill: hex('#f3f1ec'), line: hex('#bdb6a8'), r: 46 });
  k.box(x0 + 22, y0 + 70, carW - 44, 104, { fill: hex('#e7e3da'), r: 14 });
  const poly = (pts, key) => {
    const [first, ...rest] = pts;
    const d = `M ${first[0]} ${-first[1]} ${rest.map(([a, b]) => `L ${a} ${-b}`).join(' ')} Z`;
    k.page.drawSvgPath(d, { x: 0, y: 0, color: fill(key), borderColor: hex('#8d877b'), borderWidth: 0.7 });
  };
  const yT = top;
  // windscreen (top), rear window (bottom), the side windows
  poly([[x0 + 20, yT - 52], [x0 + carW - 20, yT - 52], [x0 + carW - 30, yT - 72], [x0 + 30, yT - 72]], 'pare_brise');
  poly([[x0 + 30, y0 + 52], [x0 + carW - 30, y0 + 52], [x0 + carW - 22, y0 + 36], [x0 + 22, y0 + 36]], 'lunette');
  const side = (x, y, w, h, key) => poly([[x, y], [x + w, y], [x + w, y - h], [x, y - h]], key);
  side(x0 + 6, yT - 78, 12, 46, 'avant_g');
  side(x0 + carW - 18, yT - 78, 12, 46, 'avant_d');
  side(x0 + 6, yT - 130, 12, 42, 'arriere_g');
  side(x0 + carW - 18, yT - 130, 12, 42, 'arriere_d');
  side(x0 + 8, yT - 176, 10, 18, 'custode_g');
  side(x0 + carW - 18, yT - 176, 10, 18, 'custode_d');
  k.text('AVANT', cx, yT - 14, { size: 7, f: k.bold, color: DIM, center: true, spacing: 1 });
  k.text('ARRIÈRE', cx, y0 - 14, { size: 7, f: k.bold, color: DIM, center: true, spacing: 1 });
  // the list
  const lx = k.M + 200;
  const lw = k.W - k.M - lx;
  let ly = top - 4;
  for (const [key, label] of WINDOWS) {
    const v = shades[key];
    k.page.drawRectangle({ x: lx, y: ly - 4, width: 12, height: 12, color: fill(key), borderColor: hex('#8d877b'), borderWidth: 0.6 });
    k.text(label, lx + 20, ly, { size: 9.4, color: v ? INK : DIM, f: v ? k.bold : k.font });
    k.text(shadeText(key, v), lx + lw, ly, { size: 9.4, f: k.bold, color: v ? GOLD : DIM, right: true });
    ly -= 8;
    k.page.drawLine({ start: { x: lx, y: ly }, end: { x: lx + lw, y: ly }, thickness: 0.5, color: RULE });
    ly -= 15;
  }
  // the law, as it applies to this car
  const front = ['pare_brise', 'avant_g', 'avant_d'].filter((x) => shades[x]);
  const ok = front.every((x) => x === 'pare_brise' || Number(shades[x]) >= glazing.frontMin);
  ly -= 4;
  k.y = ly;
  for (const l of k.wrap(`${ok ? 'Conforme' : 'À vérifier'} : à l’avant (pare-brise et vitres latérales), ${glazing.frontMin} % de lumière au minimum, vitre et film ensemble (${glazing.article}). À l’arrière, la teinte est libre.`, 8.4, lw)) {
    k.text(l, lx, k.y, { size: 8.4, color: ok ? OK : hex('#a5541a') });
    k.y -= 11;
  }
  k.y = Math.min(k.y, y0 - 26) - 8;
  if (String(cert.notes || '').trim()) {
    k.kicker('Remarques');
    k.y -= 14;
    k.para(cert.notes, k.M, k.W - 2 * k.M, { size: 9.2 });
  }

  // page 2: the guarantees, the care, the signature
  k.newPage('CERTIFICAT DE POSE', `Garanties · Réf. ${ref}`);
  const gh = 78;
  k.box(k.M, k.y - gh, k.W - 2 * k.M, gh, { fill: GOLD_SOFT, line: GOLD_LINE, r: 14 });
  k.text('GARANTIE À VIE', k.M + 18, k.y - 22, { size: 8, f: k.bold, color: GOLD, spacing: 1.6 });
  k.text('Sur le film et sur la pose', k.M + 18, k.y - 42, { size: 17, f: k.bold });
  const gy = k.y;
  k.y -= 58;
  for (const l of k.wrap(`${F.name} ${F.range}, posé par ${B.name} à ${B.address.city}.`, 9, k.W - 2 * k.M - 36)) {
    k.text(l, k.M + 18, k.y, { size: 9, color: TEXT });
    k.y -= 11;
  }
  k.y = gy - gh - 22;
  const colW = (k.W - 2 * k.M - 18) / 2;
  const col = (title, items, x, color) => {
    let yy = k.y;
    k.text(title.toUpperCase(), x, yy, { size: 7.8, f: k.bold, color, spacing: 1.2 });
    yy -= 16;
    for (const it of items) {
      k.page.drawCircle({ x: x + 3, y: yy + 3, size: 1.7, color });
      for (const l of k.wrap(it, 9, colW - 14)) {
        k.text(l, x + 12, yy, { size: 9, color: TEXT });
        yy -= 11.6;
      }
      yy -= 3;
    }
    return yy;
  };
  const a = col('Le film est garanti contre', F.warranty.film, k.M, GOLD);
  const b = col('La pose est garantie contre', F.warranty.fitting, k.M + colW + 18, GOLD);
  k.y = Math.min(a, b) - 12;
  k.kicker('Ce que la garantie ne couvre pas');
  k.y -= 15;
  for (const it of F.warranty.excluded) k.bullet(it, { size: 9, color: hex('#a39b8d') });
  k.y -= 6;
  k.kicker('Conditions');
  k.y -= 15;
  k.para(F.warranty.terms, k.M, k.W - 2 * k.M, { size: 9.2 });
  k.y -= 12;
  k.kicker('Entretien de vos vitres teintées');
  k.y -= 15;
  for (const it of F.care) k.bullet(it, { size: 9 });
  // the signature of the workshop
  k.y -= 14;
  const sh = 96;
  if (k.y - sh < 60) k.newPage('CERTIFICAT DE POSE', `Réf. ${ref}`);
  k.box(k.M, k.y - sh, k.W - 2 * k.M, sh, { line: hex('#cfc8bb'), r: 12 });
  k.text('POSÉ ET CERTIFIÉ PAR', k.M + 16, k.y - 18, { size: 7.5, f: k.bold, color: GOLD, spacing: 1.2 });
  k.text(`${B.owner}, ${B.name}`, k.M + 16, k.y - 36, { size: 11, f: k.bold });
  k.text(`${B.address.street}, ${B.address.postalCode} ${B.address.city} · ${B.phone}`, k.M + 16, k.y - 51, { size: 8.6, color: DIM });
  k.text(`Le ${dayFr(at)} · Réf. ${ref}`, k.M + 16, k.y - 66, { size: 8.6, color: DIM });
  const sig = dataUrlBytes(opts.sign);
  if (sig) {
    const img = await k.doc.embedPng(sig).catch(() => null);
    if (img) {
      const s = Math.min(190 / img.width, 74 / img.height);
      k.page.drawImage(img, { x: k.W - k.M - 16 - img.width * s, y: k.y - sh + 10, width: img.width * s, height: img.height * s });
    }
  }
  k.foot();
  return k.doc.save();
}
