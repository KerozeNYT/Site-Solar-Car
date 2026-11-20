// The partnership file for a professional (garage, dealer…), made by the worker from the workshop's
// space (/atelier/pros/<n>): A4 PDF, both logos on the cover, a word from the workshop, the terms
// (−10 %, −15 % from the 11th vehicle of the month, travel), then one page per service chosen
// (window tint with the six shades rendered by the site's 3D simulator, tinted lights, headlight
// renovation): the public price, the professional price and the price from the 11th vehicle; the
// film and the law. Prices come from content/pricing.js (the site's own), never typed twice.
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { business as B } from '../content/site.js';
import { tint, lights, headlights, tintVehicles, vatNote } from '../content/pricing.js';
import { tintFormulas, lightsBooking, bookingRules as R } from '../content/booking.js';
import { glazing } from '../content/regulation.js';
import { plain, money } from './devis.js';

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
const WHITE = hex('#ffffff');

/** the terms by default (the workshop's, 20 November 2026): changed in the space (Pros → Conditions) */
export const PRO_TERMS = { discount: 10, volumeDiscount: 15, volumeFrom: 11, travelFrom: 2, kmRate: '', film: '', filmSpecs: '' };
export const SHEETS = { vitres: 'Vitres teintées', feux: 'Feux teintés', phares: 'Rénovation de phares' };
const SHADES = [
  [5, 'Très sombre', 'effet limousine'],
  [15, 'Sombre', 'intimité forte'],
  [25, 'Foncé', 'le plus demandé'],
  [35, 'Intermédiaire', 'élégant, discret'],
  [50, 'Léger', 'confort, peu visible'],
  [70, 'Très clair', 'quasi invisible'],
];
const pct = (n) => `${String(n).replace('.', ',')} %`;
const off = (price, p) => Math.round(price * (1 - p / 100) * 100) / 100;
const dateFr = (ms) => new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long', year: 'numeric', timeZone: R.timeZone }).format(new Date(ms));

/**
 * pro: { name, address, contact, siret, logo (bytes), logoType }; opts: { sheets: ['vitres', …],
 * terms (PRO_TERMS), now, logo (the workshop's, PNG bytes), shades: { 5: jpeg bytes, … } }
 * Returns the PDF bytes.
 */
export async function proSheetPdf(pro, opts = {}) {
  const T = { ...PRO_TERMS, ...(opts.terms || {}) };
  const D = Number(T.discount) || 0;
  const V = Number(T.volumeDiscount) || 0;
  const sheets = (opts.sheets?.length ? opts.sheets : Object.keys(SHEETS)).filter((s) => SHEETS[s]);
  const now = opts.now || Date.now();
  const doc = await PDFDocument.create();
  doc.setTitle(plain(`Dossier de partenariat — ${B.name} × ${pro.name}`));
  doc.setAuthor(plain(B.name));
  doc.setLanguage('fr-FR');
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const oblique = await doc.embedFont(StandardFonts.HelveticaOblique);
  const ours = opts.logo ? await doc.embedPng(opts.logo).catch(() => null) : null;
  let theirs = null;
  if (pro.logo?.length) theirs = await (pro.logoType === 'image/jpeg' ? doc.embedJpg(pro.logo) : doc.embedPng(pro.logo)).catch(() => null);

  const W = 595.28;
  const H = 841.89;
  const M = 46;
  let page;
  let y;
  const pages = [];
  const text = (t, x, yy, { size = 10, f = font, color = INK, right = false, center = false, spacing = 0 } = {}) => {
    const s = plain(t);
    if (!s) return;
    const w = f.widthOfTextAtSize(s, size) + spacing * Math.max(0, s.length - 1);
    let cx = right ? x - w : center ? x - w / 2 : x;
    if (!spacing) return page.drawText(s, { x: cx, y: yy, size, font: f, color });
    for (const ch of s) {
      page.drawText(ch, { x: cx, y: yy, size, font: f, color });
      cx += f.widthOfTextAtSize(ch, size) + spacing;
    }
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
  const para = (t, x, max, { size = 10, f = font, color = TEXT, lead = 1.45 } = {}) => {
    for (const l of wrap(t, size, max, f)) {
      text(l, x, y, { size, f, color });
      y -= size * lead;
    }
  };
  const box = (x, yy, w, h, { fill, line, r = 10 } = {}) => {
    const p = `M ${r} 0 H ${w - r} Q ${w} 0 ${w} ${r} V ${h - r} Q ${w} ${h} ${w - r} ${h} H ${r} Q 0 ${h} 0 ${h - r} V ${r} Q 0 0 ${r} 0 Z`;
    page.drawSvgPath(p, { x, y: yy + h, color: fill || undefined, borderColor: line || undefined, borderWidth: line ? 0.8 : 0 });
  };
  const fit = (img, maxW, maxH) => {
    const k = Math.min(maxW / img.width, maxH / img.height);
    return { width: img.width * k, height: img.height * k };
  };
  const kicker = (t, x = M) => text(t.toUpperCase(), x, y, { size: 8, f: bold, color: GOLD, spacing: 1.6 });
  /** a new page with its small head: both logos, the title of the page */
  const sheet = (title, sub) => {
    page = doc.addPage([W, H]);
    pages.push(page);
    y = H - M;
    if (ours) {
      const s = fit(ours, 120, 34);
      page.drawImage(ours, { x: M, y: y - s.height, ...s });
    }
    if (theirs) {
      const s = fit(theirs, 110, 34);
      page.drawImage(theirs, { x: W - M - s.width, y: y - s.height, ...s });
    } else text(pro.name, W - M, y - 20, { size: 10, f: bold, color: DIM, right: true });
    y -= 52;
    page.drawRectangle({ x: M, y, width: W - 2 * M, height: 1.6, color: GOLD });
    y -= 34;
    text(title, M, y, { size: 22, f: bold });
    y -= 20;
    if (sub) {
      for (const l of wrap(sub, 10.5, W - 2 * M)) {
        text(l, M, y, { size: 10.5, color: DIM });
        y -= 15;
      }
    }
    y -= 14;
  };
  /** a price table: [label, detail, public price | null (on quote)] */
  const table = (rows, { first = 'Prestation', cont = '' } = {}) => {
    const X = { label: M + 14, pub: W - M - 222, pro: W - M - 124, vol: W - M - 14 };
    const head = () => {
      box(M, y - 30, W - 2 * M, 30, { fill: NIGHT, r: 8 });
      text(first.toUpperCase(), X.label, y - 18.5, { size: 7.5, f: bold, color: GOLD_2, spacing: 1 });
      text('PRIX PUBLIC', X.pub, y - 18.5, { size: 7.5, f: bold, color: GOLD_2, spacing: 1, right: true });
      text(`PRO -${D} %`, X.pro, y - 18.5, { size: 7.5, f: bold, color: GOLD_2, spacing: 1, right: true });
      text(`DÈS LE ${T.volumeFrom}E -${V} %`, X.vol, y - 18.5, { size: 7.5, f: bold, color: GOLD_2, spacing: 1, right: true });
      y -= 30;
    };
    head();
    rows.forEach(([label, detail, price], i) => {
      const details = detail ? wrap(detail, 7.8, X.pub - X.label - 30) : [];
      const h = 20 + details.length * 9.5;
      // no room left above the foot: the table goes on over the page
      if (y - h < 70) {
        sheet(cont || 'Suite');
        head();
      }
      if (i % 2) page.drawRectangle({ x: M, y: y - h, width: W - 2 * M, height: h, color: PAPER });
      text(label, X.label, y - 14, { size: 9.8, f: bold });
      details.forEach((l, k) => text(l, X.label, y - 24.5 - k * 9.5, { size: 7.8, color: DIM }));
      if (price == null) text('Sur devis', X.vol, y - 14, { size: 9.5, f: oblique, color: DIM, right: true });
      else {
        text(money(price), X.pub, y - 14, { size: 9.5, color: DIM, right: true });
        text(money(off(price, D)), X.pro, y - 14, { size: 10.5, f: bold, right: true });
        text(money(off(price, V)), X.vol, y - 14, { size: 10.5, f: bold, color: GOLD, right: true });
      }
      y -= h;
    });
    page.drawLine({ start: { x: M, y }, end: { x: W - M, y }, thickness: 0.8, color: RULE });
    y -= 12;
    text(`Prix nets en euros, par véhicule. ${vatNote}.`, M, y, { size: 7.8, color: DIM });
    y -= 22;
  };
  const note = (title, body, { fill = GOLD_SOFT, line = GOLD_LINE } = {}) => {
    const lines = wrap(body, 9, W - 2 * M - 36);
    const h = 34 + lines.length * 13;
    box(M, y - h, W - 2 * M, h, { fill, line, r: 12 });
    text(title, M + 18, y - 20, { size: 10, f: bold });
    lines.forEach((l, i) => text(l, M + 18, y - 36 - i * 13, { size: 9, color: TEXT }));
    y -= h + 16;
  };

  // ---------------------------------------------------------------- the cover
  page = doc.addPage([W, H]);
  pages.push(page);
  page.drawRectangle({ x: 0, y: H - 300, width: W, height: 300, color: PAPER });
  page.drawRectangle({ x: 0, y: H - 302, width: W, height: 2, color: GOLD });
  // the two logos, side by side, « × » between
  const lh = 64;
  const a = ours ? fit(ours, 180, lh) : null;
  const b = theirs ? fit(theirs, 170, lh) : null;
  const bw = b ? b.width : Math.min(190, bold.widthOfTextAtSize(plain(pro.name), 16));
  const total = (a ? a.width : 120) + 52 + bw;
  let x0 = (W - total) / 2;
  const ly = H - 128;
  if (a) page.drawImage(ours, { x: x0, y: ly, ...a });
  else {
    y = ly + 24;
    text(B.name, x0, y, { size: 18, f: bold });
  }
  x0 += (a ? a.width : 120) + 26;
  text('×', x0, ly + lh / 2 - 9, { size: 26, color: GOLD, center: true });
  x0 += 26;
  if (b) page.drawImage(theirs, { x: x0, y: ly + (lh - b.height) / 2, ...b });
  else {
    const ls = wrap(pro.name, 16, 190, bold);
    ls.forEach((l, i) => text(l, x0, ly + lh / 2 - 6 + ((ls.length - 1) / 2 - i) * 19, { size: 16, f: bold }));
  }
  y = H - 210;
  text('DOSSIER DE PARTENARIAT PROFESSIONNEL', W / 2, y, { size: 9, f: bold, color: GOLD, center: true, spacing: 2.2 });
  y -= 30;
  text(`${B.name} × ${pro.name}`.length > 46 ? pro.name : `${B.name} × ${pro.name}`, W / 2, y, { size: 22, f: bold, center: true });
  y -= 22;
  text(sheets.map((s) => SHEETS[s]).join(' · '), W / 2, y, { size: 10.5, color: DIM, center: true });
  y = H - 350;
  // the word from the workshop
  const hello = pro.contact ? `Bonjour ${String(pro.contact).split(' ')[0]},` : `À toute l’équipe de ${pro.name},`;
  text(hello, M, y, { size: 12, f: bold });
  y -= 24;
  para(
    `Merci pour l’intérêt que vous portez à ${B.name}. Installés à ${B.address.city}, près de Tours, nous posons des films de vitres teintées nanocéramiques, teintons les feux et rénovons les optiques, avec le même soin pour chaque véhicule : préparation minutieuse, découpe précise, finitions contrôlées.`,
    M,
    W - 2 * M,
    { size: 10.5 }
  );
  y -= 8;
  para(
    'Ce dossier réunit nos tarifs professionnels, nos conditions de partenariat et les caractéristiques de nos films : de quoi conseiller vos clients en toute clarté, et nous confier leurs véhicules les yeux fermés. Un seul interlocuteur, des délais tenus, et une vraie relation de confiance.',
    M,
    W - 2 * M,
    { size: 10.5 }
  );
  y -= 10;
  text(String(B.owner || ''), M, y, { size: 10.5, f: bold });
  y -= 14;
  text(`${B.name} · ${B.phone}`, M, y, { size: 9.5, color: DIM });
  y -= 40;
  // three highlights
  const cards = [
    [`-${D} %`, 'sur tous nos tarifs', 'dès le premier véhicule'],
    [`-${V} %`, `dès le ${T.volumeFrom}e véhicule`, 'du mois, compteur remis à zéro le 1er'],
    ['Chez vous', `dès ${T.travelFrom} véhicules`, 'nous intervenons dans vos locaux'],
  ];
  const cw = (W - 2 * M - 24) / 3;
  cards.forEach(([big, l1, l2], i) => {
    const cx = M + i * (cw + 12);
    box(cx, y - 108, cw, 108, { fill: i === 1 ? NIGHT : GOLD_SOFT, line: i === 1 ? null : GOLD_LINE, r: 14 });
    text(big, cx + cw / 2, y - 46, { size: 24, f: bold, color: i === 1 ? GOLD_2 : GOLD, center: true });
    text(l1, cx + cw / 2, y - 70, { size: 10, f: bold, color: i === 1 ? WHITE : INK, center: true });
    wrap(l2, 8.5, cw - 20).forEach((l, k) => text(l, cx + cw / 2, y - 85 - k * 11, { size: 8.5, color: i === 1 ? hex('#cfc9bd') : DIM, center: true }));
  });
  y -= 140;
  text(`Préparé pour ${pro.name}${pro.address ? `, ${pro.address}` : ''}`, M, y, { size: 9, color: DIM });
  y -= 13;
  text(`Le ${dateFr(now)} · tarifs en vigueur à cette date`, M, y, { size: 9, color: DIM });

  // ---------------------------------------------------------------- the terms
  sheet('Nos conditions de partenariat', 'Simples, écrites noir sur blanc, les mêmes pour chaque véhicule que vous nous confiez.');
  const terms = [
    [`Remise professionnelle : -${D} %`, `Sur le prix public de toutes les prestations de ce dossier, dès le premier véhicule. Le prix de chaque véhicule est confirmé à la prise de rendez-vous.`],
    [`Volume : -${V} % dès le ${T.volumeFrom}e véhicule du mois`, `Au-delà de ${T.volumeFrom - 1} véhicules confiés et confirmés dans le même mois (du 1er au dernier jour), chaque véhicule suivant passe à -${V} %. Le compteur repart à zéro le 1er de chaque mois.`],
    [
      'Déplacement dans vos locaux',
      `À partir de ${T.travelFrom} véhicules le même jour, nous intervenons chez vous, sans frais de déplacement. Pour un seul véhicule, le déplacement reste possible, avec des frais kilométriques${String(T.kmRate || '').trim() ? ` (${String(T.kmRate).replace('.', ',')} € par km, aller-retour depuis l’atelier)` : ' indiqués à la prise de rendez-vous'} ; ou déposez le véhicule à l’atelier de ${B.address.city}.`,
    ],
    ['Rendez-vous', `Par téléphone au ${B.phone} ou par e-mail à ${B.email} : nous fixons ensemble le jour et l’heure. Comptez environ 2 h pour des vitres teintées, 1 h par paire de feux, 1 h 30 pour une rénovation de phares.`],
    ['Facturation', `Une facture pour chaque intervention, avec la remise appliquée. ${vatNote}.`],
  ];
  for (const [t, body] of terms) {
    page.drawCircle({ x: M + 5, y: y + 3.5, size: 3.2, color: GOLD });
    text(t, M + 18, y, { size: 11.5, f: bold });
    y -= 17;
    para(body, M + 18, W - 2 * M - 18, { size: 9.8 });
    y -= 14;
  }
  y -= 6;
  note('Votre interlocuteur', `${B.owner} · ${B.phone} · ${B.email}\n${B.name}, ${B.address.street}, ${B.address.postalCode} ${B.address.city} · ${String(B.siteUrl).replace(/^https?:\/\//, '')}`);

  // ---------------------------------------------------------------- window tint
  if (sheets.includes('vitres')) {
    sheet('Vitres teintées', 'Films nanocéramiques posés à l’atelier ou dans vos locaux : vitres latérales, custodes et lunette arrière. Découpe à la forme exacte de chaque vitre.');
    const cats = [
      ['citadine', 'Citadine', 'Clio, 208, Audi A3'],
      ['berline', 'Berline', 'Série 3, 508, A5 Coupé'],
      ['coupe', 'Coupé / cabriolet', 'Série 2 Coupé, Audi TT'],
      ['break', 'Break', 'A6 Avant, 308 SW'],
      ['suv', 'SUV / monospace', 'X5, 3008, Espace'],
      ['utilitaire', 'Utilitaire', 'Transporter, Trafic, Vito'],
    ];
    const rear = tintFormulas.find((f) => f.id === 'rear');
    const full = tintFormulas.find((f) => f.id === 'full');
    const rows = [];
    for (const [cat, label, ex] of cats) {
      rows.push([`${label} — ${rear.label}`, `Vitres arrière, custodes, lunette · ex. ${ex}`, rear.price(cat)]);
      rows.push([`${label} — ${full.label}`, '3/4 arrière + les 2 vitres avant', full.price(cat)]);
    }
    rows.push(['2 vitres avant seules', 'Tout véhicule', tint.frontOnly]);
    rows.push(['2 vitres avant + 2 custodes', 'Tout véhicule', tint.frontQuarters]);
    for (const f of tint.windshield.films.filter((x) => x.vlt >= glazing.frontMin)) rows.push([`Pare-brise — film ${f.label.toLowerCase()}`, f.iridescent ? 'Reflets colorés selon l’angle, transmission conforme à vérifier sur le véhicule' : 'Film clair qui filtre une partie de la chaleur', f.price]);
    rows.push(['Tesla Model 3, Peugeot RCZ, toits vitrés', 'Forfait spécifique', null]);
    table(rows, { first: 'Véhicule et formule', cont: 'Vitres teintées (suite)' });

    // the shades and the film
    sheet('Les teintes et le film nanocéramique', `Six teintes, de ${SHADES[0][0]} % (très sombre) à ${SHADES.at(-1)[0]} % (très clair) : le pourcentage est la part de lumière qui traverse le film.`);
    const gw = (W - 2 * M - 2 * 12) / 3;
    const gh = gw * 0.625;
    for (let i = 0; i < SHADES.length; i++) {
      const [n, name, hint] = SHADES[i];
      const cx = M + (i % 3) * (gw + 12);
      const cy = y - Math.floor(i / 3) * (gh + 46) - gh;
      const jpg = opts.shades?.[n] ? await doc.embedJpg(opts.shades[n]).catch(() => null) : null;
      if (jpg) page.drawImage(jpg, { x: cx, y: cy, width: gw, height: gh });
      else page.drawRectangle({ x: cx, y: cy, width: gw, height: gh, color: hex('#2a2a2e'), opacity: 1 - n / 100 });
      text(`${n} %`, cx, cy - 16, { size: 12, f: bold, color: n >= glazing.frontMin ? INK : INK });
      text(`${name} · ${hint}`, cx + bold.widthOfTextAtSize(`${n} %`, 12) + 8, cy - 15.5, { size: 8.5, color: DIM });
      if (n >= glazing.frontMin) text('autorisé à l’avant*', cx, cy - 28, { size: 7.8, f: bold, color: GOLD });
    }
    y -= 2 * (gh + 46) + 4;
    text('Rendus du simulateur 3D de solarcar37.fr, à titre indicatif : la teinte se choisit sur nuancier, à la lumière du jour.', M, y, { size: 7.8, f: oblique, color: DIM });
    y -= 26;
    kicker('Le film nanocéramique');
    y -= 16;
    const film = [
      'Des particules céramiques filtrent une part du rayonnement infrarouge, la chaleur du soleil, sans assombrir davantage le vitrage.',
      'Sans métal : aucune gêne pour le téléphone, le GPS, le télépéage ou la radio.',
      'Filtre les UV : l’habitacle, les sièges et le tableau de bord sont mieux protégés du soleil.',
      'Couleur stable, aspect neutre vu de l’extérieur, posé sans bulles ni décollement.',
      String(T.film || '').trim() ? `Film posé : ${T.film}.` : '',
      ...String(T.filmSpecs || '')
        .split('\n')
        .map((l) => l.trim())
        .filter(Boolean),
    ].filter(Boolean);
    for (const l of film) {
      page.drawCircle({ x: M + 3, y: y + 3, size: 1.8, color: GOLD });
      para(l, M + 12, W - 2 * M - 12, { size: 9.2, lead: 1.4 });
      y -= 3;
    }
    y -= 8;
    note(
      `* La loi : ${glazing.frontMin} % minimum à l’avant`,
      `Le pare-brise et les vitres latérales avant doivent laisser passer au moins ${glazing.frontMin} % de la lumière, vitre et film ensemble (${glazing.article}, ${glazing.decree}). En dessous : ${glazing.fine} € d’amende, ${glazing.points} points retirés et immobilisation possible. À l’arrière (vitres, custodes, lunette), la teinte est libre. Nous ne posons à l’avant que des films qui respectent ce seuil.`,
      { fill: hex('#fff7e6'), line: hex('#f0d9a6') }
    );
  }

  // ---------------------------------------------------------------- tinted lights
  if (sheets.includes('feux')) {
    const m = lightsBooking.material;
    sheet('Feux teintés', `${m.label} : ${m.text.charAt(0).toLowerCase()}${m.text.slice(1)} Deux intensités : ${lights.shades.map((s) => s.label.toLowerCase()).join(' ou ')}.`);
    const pair = m.perPair.max;
    table(
      [
        ['Feux arrière', `${m.label} · 1 paire · environ 1 h`, pair],
        ['Feux avant', `${m.label} · 1 paire · environ 1 h`, pair],
        ['Feux avant et arrière', `${m.label} · 2 paires · environ 2 h`, pair * 2],
        ['PPF teinté (polyuréthane)', 'Plus épais, protège aussi des petits impacts', null],
      ],
      { first: 'Prestation' }
    );
    kicker('Ce que nous faisons');
    y -= 16;
    for (const l of ['Nettoyage et dégraissage de l’optique, puis découpe du film à sa forme exacte.', 'Pose à chaud, bords repliés et marouflés : rendu net, sans bulles.', 'Film réversible : il se retire sans abîmer l’optique.']) {
      page.drawCircle({ x: M + 3, y: y + 3, size: 1.8, color: GOLD });
      para(l, M + 12, W - 2 * M - 12, { size: 9.4 });
      y -= 3;
    }
    y -= 10;
    note(
      'La loi : des feux qui restent visibles',
      'Les feux sont des dispositifs homologués : un film modifie la lumière émise et peut les rendre non conformes pour circuler sur la voie publique, surtout à l’avant. Nous conseillons une intensité qui garde les feux bien visibles et informons le client avant la pose.',
      { fill: hex('#fff7e6'), line: hex('#f0d9a6') }
    );
  }

  // ---------------------------------------------------------------- headlight renovation
  if (sheets.includes('phares')) {
    const ceramic = headlights.options.find((o) => o.id === 'ceramic');
    sheet('Rénovation de phares', 'Les optiques en polycarbonate jaunissent et s’opacifient avec les UV et les années. La rénovation leur rend leur transparence et l’efficacité de l’éclairage, pour bien moins cher qu’un remplacement.');
    table(
      [
        ['Rénovation des deux phares', 'Ponçage, polissage et protection anti-UV · environ 1 h 30', headlights.renovation],
        [`Rénovation + ${ceramic.label.toLowerCase()}`, 'Protection plus durable contre le jaunissement · environ 1 h 45', headlights.renovation + ceramic.price],
      ],
      { first: 'Prestation' }
    );
    kicker('Les étapes');
    y -= 16;
    for (const l of ['Ponçage progressif : la couche jaunie et oxydée est retirée.', 'Polissage : l’optique retrouve sa transparence et son éclat.', 'Protection anti-UV (ou céramique) : elle ralentit le retour du jaunissement.', 'Avant / après contrôlé ensemble à la livraison du véhicule.']) {
      page.drawCircle({ x: M + 3, y: y + 3, size: 1.8, color: GOLD });
      para(l, M + 12, W - 2 * M - 12, { size: 9.4 });
      y -= 3;
    }
    y -= 10;
    note('Idéal avant une revente ou un contrôle technique', 'Des optiques claires rajeunissent toute la face avant du véhicule et améliorent l’éclairage : un argument simple pour vos clients, à un prix maîtrisé.');
  }

  // ---------------------------------------------------------------- the foot of every page
  pages.forEach((p, i) => {
    page = p;
    page.drawLine({ start: { x: M, y: 38 }, end: { x: W - M, y: 38 }, thickness: 0.6, color: RULE });
    text(`${B.name} · ${B.legalName} · SIRET ${B.siret} · ${B.address.street}, ${B.address.postalCode} ${B.address.city} · ${B.phone} · ${B.email}`, M, 26, { size: 6.8, color: DIM });
    text(`${i + 1}/${pages.length}`, W - M, 26, { size: 6.8, color: DIM, right: true });
  });
  return doc.save();
}
