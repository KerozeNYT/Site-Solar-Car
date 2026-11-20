/**
 * Online booking (window tint, tinted lights): what can be booked, how long it takes, what it
 * costs, and the rules of the agenda. ONE module, read by the booking page (src/js/booking.js)
 * and by the booking server (booking/worker.js): the server recomputes every price and every
 * duration from the configuration it receives, it never trusts an amount sent by the browser.
 *
 * Prices come from content/pricing.js (tax included); durations and rules were set by SOLAR CAR
 * 37 on 13 November 2026 (docs/RESERVATION.md).
 */
import { tint, lights, tintVehicles, headlights, detailing } from './pricing.js';

export const bookingRules = {
  // the booking server (Cloudflare Worker, booking/, deployed with `npx wrangler deploy`); ''
  // would close online booking (the page then offers a quote request instead)
  api: 'https://solarcar37-reservation.contact-solarcar37.workers.dev',
  timeZone: 'Europe/Paris',
  // opening hours, Monday (1) to Friday (5); a job may run over the lunch break, which does not
  // count as working time
  days: [1, 2, 3, 4, 5],
  periods: [
    ['08:00', '12:00'],
    ['13:00', '17:00'],
  ],
  // the start times offered, on the site and in the workshop's space: four a day, one car each,
  // 8-10 h, 10-12 h, 13-15 h, 15-17 h (set by SOLAR CAR 37 on 17 November 2026: a start at 9:45
  // would leave the morning unusable). The calendars are read with the job's real time: a job
  // longer than 2 h takes the next slot too (complete tint at 8:00 → next start 13:00).
  starts: ['08:00', '10:00', '13:00', '15:00'],
  // window tint (any package, with or without the windshield) takes one slot of 2 h; tinted lights
  // add 1 h a pair (lightsBooking.minutesPerPair): complete tint + rear lights = 3 h, 8:00-11:00
  // (SOLAR CAR 37, 17-18 November 2026). A car that needs more is lengthened by hand in the
  // calendar, which the free slots then follow.
  jobMinutes: 120,
  // a shorter job (tinted lights, 1 h) also fills what is left of a slot already partly taken, at
  // the slot's start + `fill` minutes: 11:00-12:00 after a car lengthened to 8:00-11:00. A whole
  // slot is kept for its fixed start (a pair of lights at 8:00, never at 9:00 on an empty morning).
  fill: 60,
  // start times every `step` minutes, when `starts` is empty
  step: 15,
  // bookable from 48 h ahead, up to about six months ahead (a client on holiday near Tours in
  // the summer books in the winter)
  noticeHours: 48,
  horizonDays: 186,
  // deposit: 30 % of the total, or the total; refunded if cancelled at least 72 h (3 days) before
  depositRate: 0.3,
  cancelHours: 72,
  // a slot is held this long while the visitor pays (Stripe's minimum session life)
  holdMinutes: 30,
  // referral: each client gets a personal code (in the e-mail a week after, or from the workshop's
  // page) worth `amount` EUR off one service, booked online or at the workshop, once, within
  // `months` months (booking/referral.js)
  referral: { amount: 20, months: 6 },
};

/** window tint packages: price (EUR, net) for a vehicle category (time: bookingRules.jobMinutes) */
export const tintFormulas = [
  {
    id: 'rear',
    label: '3/4 arrière',
    text: 'Vitres latérales arrière, custodes et lunette arrière',
    price: (cat) => tint.rearPackage[cat],
  },
  {
    id: 'full',
    label: 'Complet',
    text: '3/4 arrière et les deux vitres avant',
    price: (cat) => tint.rearPackage[cat] + tint.frontWithRear,
  },
  {
    id: 'front',
    label: '2 vitres avant',
    text: 'Vitres du conducteur et du passager',
    price: () => tint.frontOnly,
  },
  {
    id: 'front-quarters',
    label: '2 vitres avant + 2 custodes',
    text: 'Vitres avant et petites vitres de custode',
    price: () => tint.frontQuarters,
  },
];
// the windshield film on its own (booked by the workshop, booking/atelier.js): one slot too
export const windshieldMinutes = 120;
// tinted lights: smoked vinyl only online (the tinted PPF is priced on quote)
export const lightsBooking = {
  material: lights.materials.find((m) => m.id === 'covering'),
  // 1 h a pair, alone or added to window tint
  minutesPerPair: 60,
  pairs: [
    { id: 'rear', label: 'Feux arrière', count: 1 },
    { id: 'front', label: 'Feux avant', count: 1 },
    { id: 'both', label: 'Avant et arrière', count: 2 },
  ],
};
// vehicles that can be booked online (a specific package, such as the Tesla Model 3 glass roof,
// stays on quote)
export const bookableVehicles = tintVehicles.filter((v) => !v.quote && tint.rearPackage[v.cat]);

/**
 * Price and duration of a configuration:
 *   { tint?: { vehicle, formula, windshield?, color? }, lights?: { pairs } }
 * The shade (of the windows or of the lights) is chosen with the workshop on the day.
 * Returns { items: [{ label, detail, price }], total, minutes (window tint: bookingRules.jobMinutes;
 * tinted lights: 1 h a pair, added), deposit } (EUR, minutes) or { error } when the configuration
 * is not bookable.
 */
export function quote(config = {}) {
  const items = [];
  if (config.tint) {
    const c = config.tint;
    const vehicle = bookableVehicles.find((v) => v.id === c.vehicle);
    const formula = tintFormulas.find((f) => f.id === c.formula);
    if (!vehicle) return { error: 'Véhicule à choisir' };
    if (!formula) return { error: 'Formule à choisir' };
    items.push({
      kind: 'tint',
      label: `Vitres teintées — ${formula.label}`,
      detail: `${vehicle.label}, teinte choisie à l’atelier`,
      price: formula.price(vehicle.cat),
    });
    if (c.windshield) {
      const film = tint.windshield.films.find((f) => f.id === c.windshield);
      if (!film) return { error: 'Film de pare-brise inconnu' };
      const color = film.iridescent ? tint.windshield.colors.find((x) => x.id === c.color) : null;
      if (film.iridescent && !color) return { error: 'Couleur du film irisé à choisir' };
      items.push({ kind: 'tint', label: `Pare-brise — ${film.label}`, detail: color ? color.label : '', price: film.price });
    }
  }
  if (config.lights) {
    const c = config.lights;
    const pairs = lightsBooking.pairs.find((p) => p.id === c.pairs);
    if (!pairs) return { error: 'Feux à choisir' };
    items.push({
      kind: 'lights',
      label: `Feux teintés — ${pairs.label}`,
      detail: `${lightsBooking.material.label}, teinte choisie à l’atelier`,
      price: lightsBooking.material.perPair.max * pairs.count,
    });
  }
  if (!items.length) return { error: 'Prestation à choisir' };
  const total = items.reduce((a, i) => a + i.price, 0);
  const pairs = config.lights ? lightsBooking.pairs.find((p) => p.id === config.lights.pairs).count : 0;
  const minutes = (config.tint ? bookingRules.jobMinutes : 0) + lightsBooking.minutesPerPair * pairs;
  return { items, total, minutes, deposit: Math.round(total * bookingRules.depositRate * 100) / 100 };
}

/**
 * The services booked by the workshop itself (an appointment taken on the phone, booking/atelier.js)
 * beyond the online catalogue: a line with its own label, price and time, added to quote()'s
 * result. Never read from a visitor: only the workshop's space sets them (Stripe's metadata
 * `extra`). Returns the quote with these lines, or the quote as it was when there are none.
 */
export function withExtra(q, extra = []) {
  const lines = (Array.isArray(extra) ? extra : [])
    .map((x) => ({
      kind: ['lights', 'tint'].includes(x?.kind) ? x.kind : 'other',
      label: String(x?.label ?? '').replace(/\s+/g, ' ').trim().slice(0, 80),
      detail: String(x?.detail ?? '').replace(/\s+/g, ' ').trim().slice(0, 80),
      price: Math.max(0, Math.round((Number(String(x?.price ?? '').replace(',', '.')) || 0) * 100) / 100),
      minutes: Math.max(15, Math.min(600, Math.round(Number(x?.minutes) || 60))),
    }))
    .filter((x) => x.label)
    .slice(0, 6);
  if (!lines.length) return q;
  // the online catalogue may hold nothing (only these lines): that is fine here
  const base = q.error === 'Prestation à choisir' ? [] : q.error ? null : q.items;
  if (!base) return q;
  const items = [...base, ...lines];
  const total = Math.round(items.reduce((a, i) => a + i.price, 0) * 100) / 100;
  // the catalogue's slot (2 h), then each line's own time
  const minutes = (base.length ? q.minutes : 0) + lines.reduce((a, i) => a + i.minutes, 0);
  return { items, total, minutes, deposit: Math.round(total * bookingRules.depositRate * 100) / 100 };
}

/**
 * The services the workshop books by hand besides the windows and the lights (« Nouveau RDV »):
 * a label, a price (null: to type, priced on quote) and a time, all changed in the form. The times
 * are a first estimate, to adjust with the workshop.
 */
export const atelierExtras = [
  { id: 'phares', label: 'Rénovation de phares', price: headlights.renovation, minutes: 90 },
  { id: 'phares-ceramique', label: 'Rénovation de phares + céramique', price: headlights.renovation + headlights.options[0].price, minutes: 105 },
  { id: 'feux-ppf', label: 'Feux teintés — PPF teinté (la paire)', price: lights.materials.find((m) => m.id === 'ppf')?.perPair.max ?? null, minutes: 60, kind: 'lights' },
  { id: 'ciel', label: 'Ciel étoilé', price: null, minutes: 480 },
  ...detailing.packages.map((p) => ({ id: `detailing-${p.id}`, label: `Detailing — ${p.label}`, price: null, minutes: { essentiel: 180, eclat: 360, signature: 480 }[p.id] || 240 })),
  { id: 'covering', label: 'Covering', price: null, minutes: 480 },
  { id: 'dechromage', label: 'Déchromage', price: null, minutes: 240 },
  { id: 'autre', label: '', price: null, minutes: 60 },
];

/** « Comment nous avez-vous connus ? »: the answers offered on the quote form and the booking
 * page (several can be ticked; « Autre » opens a short text) */
export const howHeard = ['Recherche Internet (Google…)', 'Réseaux sociaux (Instagram, Facebook…)', 'Bouche-à-oreille', 'Déjà client', 'Autre'];

/** their short names, for the statistics (booking/stats.js) */
export const howHeardKeys = { 'Recherche Internet (Google…)': 'internet', 'Réseaux sociaux (Instagram, Facebook…)': 'reseaux', 'Bouche-à-oreille': 'bouche', 'Déjà client': 'client', Autre: 'autre' };

/** the answers as one line, from the ticked boxes and the « Autre » text (checked against the
 *  list, in its order: « Autre » comes last) */
export function howHeardText(channels = [], other = '') {
  const ok = howHeard.filter((c) => Array.isArray(channels) && channels.includes(c));
  const extra = String(other || '').replace(/\s+/g, ' ').trim().slice(0, 120);
  return ok.map((c) => (c === 'Autre' && extra ? `Autre : ${extra}` : c)).join(', ');
}

/** back from that line to the answers */
export function howHeardParse(text = '') {
  const s = String(text || '');
  const channels = howHeard.filter((c) => c !== 'Autre' && s.includes(c));
  const m = /(?:^|, )Autre(?: : (.*))?$/.exec(s);
  if (m) channels.push('Autre');
  return { channels, other: m?.[1] || '' };
}

/** a discount code as typed (referral JEAN-7K2QX, promotion NOEL, Premium card
 *  PREMIUM-7K2Q-X9M4, gift card CADEAU-7K2Q-X9M4): capitals without accents, digits and the dash only */
export const referralCode = (s) =>
  String(s || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/\s+/g, '')
    .replace(/[^A-Z0-9-]/g, '')
    .slice(0, 20);

/** the bookable services a promotion can cover (quote items carry the same `kind`) */
export const codeServices = [
  { id: 'tint', label: 'Vitres teintées (et pare-brise)' },
  { id: 'lights', label: 'Feux teintés' },
];

/**
 * The discount (EUR) a checked code gives on a quote: a fixed amount (referral, or a promotion in
 * euros) or a percentage, on the items of the services it covers (all when it names none); 0 when
 * it covers none of them. info: { amount } or { percent, services: ['tint', …] }.
 */
export function discountFor(q, info) {
  if (q.error || !info) return 0;
  const covered = info.services?.length ? q.items.filter((i) => info.services.includes(i.kind)) : q.items;
  const base = covered.reduce((a, i) => a + i.price, 0);
  if (!base) return 0;
  const d = info.percent > 0 ? Math.round(base * info.percent) / 100 : Math.min(base, Number(info.amount) || 0);
  return Math.round(d * 100) / 100;
}

/** the price with a referral discount: the total is lowered, the deposit taken on what is left */
export function withDiscount(q, amount) {
  if (q.error || !(amount > 0)) return q;
  const total = Math.max(0, Math.round((q.total - amount) * 100) / 100);
  return { ...q, discount: amount, total, deposit: Math.round(total * bookingRules.depositRate * 100) / 100 };
}

/** a discount given by hand by the workshop (« Nouveau rendez-vous », an exceptional case):
 *  `value` % of the total, or `value` euros, never more than the total; 0 when none */
export function manualDiscount(total, type, value) {
  const v = Number(String(value ?? '').replace(/\s/g, '').replace(',', '.'));
  if (!(v > 0) || !(total > 0)) return 0;
  const d = type === 'percent' ? (total * Math.min(100, v)) / 100 : Math.min(total, v);
  return Math.round(d * 100) / 100;
}

/** the discounts of a booking, one line each, for the e-mails and the calendar: the code's
 *  (promotion, referral or a SOLAR CAR Premium card) and the workshop's own (« Remise »);
 *  [[label, euros]] */
export function discountLines(discount, { code = '', codeKind = '', remise = 0 } = {}) {
  const hand = Math.min(Number(remise) || 0, Number(discount) || 0);
  const byCode = Math.round(((Number(discount) || 0) - hand) * 100) / 100;
  const out = [];
  if (code && byCode > 0) out.push([codeKind === 'promo' ? `Code promo ${code}` : codeKind === 'premium' ? 'Carte Premium' : `Parrainage (code ${code})`, byCode]);
  else if (byCode > 0) out.push(['Remise', byCode]);
  if (hand > 0) out.push(['Remise', hand]);
  return out;
}

/** how an appointment was taken: on the site, or by the workshop after a call, an e-mail or a
 *  visit to the counter (« Nouveau rendez-vous » of its space) — said in the e-mails and the calendar */
export const CANALS = { telephone: 'par téléphone', mail: 'par e-mail', atelier: 'à l’atelier' };
/** « Réservé en ligne », « Pris par téléphone », « Pris par e-mail », « Pris à l’atelier » */
export const takenText = (canal) => (CANALS[canal] ? `Pris ${CANALS[canal]}` : 'Réservé en ligne');
/** the first words of the e-mail to the client, after the way the appointment was taken */
export const canalLead = { telephone: 'Suite à notre appel téléphonique', mail: 'Suite à notre échange par e-mail', atelier: 'Suite à votre venue à l’atelier' };
/** a deposit paid by card at the workshop (its card terminal): the amount typed, else the 30 % */
export const tpeAmount = (typed, q) => {
  const n = Number(String(typed ?? '').replace(/\s/g, '').replace(',', '.'));
  return Math.round(Math.min(q.total, n > 0 ? n : q.deposit) * 100) / 100;
};

/** the amount to pay now (EUR): the deposit or the total */
export const amountDue = (q, mode) => (mode === 'full' ? q.total : q.deposit);

/** "2 h 30", "45 min" */
export const formatDuration = (m) => (m < 60 ? `${m} min` : `${Math.floor(m / 60)} h${m % 60 ? ` ${String(m % 60).padStart(2, '0')}` : ''}`);

/** "81 €", "72,50 €" */
export const formatEuros = (n) =>
  new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', minimumFractionDigits: Number.isInteger(n) ? 0 : 2, maximumFractionDigits: 2 }).format(n);
