/**
 * Online booking (window tint, tinted lights): what can be booked, how long it takes, what it
 * costs, and the rules of the agenda. ONE module, read by the booking page (src/js/booking.js)
 * and by the booking server (booking/worker.js): the server recomputes every price and every
 * duration from the configuration it receives, it never trusts an amount sent by the browser.
 *
 * Prices come from content/pricing.js (tax included); durations and rules were set by SOLAR CAR
 * 37 on 13 November 2026 (docs/RESERVATION.md).
 */
import { tint, lights, tintVehicles } from './pricing.js';

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
  // start times every `step` minutes
  step: 15,
  // bookable from 48 h ahead, up to about two months ahead
  noticeHours: 48,
  horizonDays: 62,
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

/**
 * Promo codes of a campaign (an ad video, a post…): `percent` off any service of the workshop, for
 * an online booking paid (deposit or total) or a quote requested between `from` and `to` (days in
 * Paris, both included), whatever the date of the appointment. `uses`: how many times in all, the
 * online bookings and the uses noted by the workshop together (null: unlimited). Window tint and
 * tinted lights: the code is typed on the booking page; the other services: in the quote request,
 * the workshop then lowers the quote (booking/promo.js, docs/RESERVATION.md). One code per booking
 * or quote: a promo code and a referral code never add up.
 */
export const promos = [{ code: 'NOEL15', percent: 15, from: '2026-12-01', to: '2026-12-24', uses: null, label: 'Noël 2026' }];

/** window tint packages: price (EUR, net) for a vehicle category, time (minutes) */
export const tintFormulas = [
  {
    id: 'rear',
    label: '3/4 arrière',
    text: 'Vitres latérales arrière, custodes et lunette arrière',
    minutes: 120,
    price: (cat) => tint.rearPackage[cat],
  },
  {
    id: 'full',
    label: 'Complet',
    text: '3/4 arrière et les deux vitres avant',
    minutes: 150,
    price: (cat) => tint.rearPackage[cat] + tint.frontWithRear,
  },
  {
    id: 'front',
    label: '2 vitres avant',
    text: 'Vitres du conducteur et du passager',
    minutes: 45,
    price: () => tint.frontOnly,
  },
  {
    id: 'front-quarters',
    label: '2 vitres avant + 2 custodes',
    text: 'Vitres avant et petites vitres de custode',
    minutes: 75,
    price: () => tint.frontQuarters,
  },
];
// the windshield film, added to any package
export const windshieldMinutes = 90;
// tinted lights: smoked vinyl only online (the tinted PPF is priced on quote)
export const lightsBooking = {
  material: lights.materials.find((m) => m.id === 'covering'),
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
 * Returns { items: [{ label, detail, price, minutes }], total, minutes, deposit } (EUR, minutes)
 * or { error } when the configuration is not bookable.
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
      label: `Vitres teintées — ${formula.label}`,
      detail: `${vehicle.label}, teinte choisie à l’atelier`,
      price: formula.price(vehicle.cat),
      minutes: formula.minutes,
    });
    if (c.windshield) {
      const film = tint.windshield.films.find((f) => f.id === c.windshield);
      if (!film) return { error: 'Film de pare-brise inconnu' };
      const color = film.iridescent ? tint.windshield.colors.find((x) => x.id === c.color) : null;
      if (film.iridescent && !color) return { error: 'Couleur du film irisé à choisir' };
      items.push({ label: `Pare-brise — ${film.label}`, detail: color ? color.label : '', price: film.price, minutes: windshieldMinutes });
    }
  }
  if (config.lights) {
    const c = config.lights;
    const pairs = lightsBooking.pairs.find((p) => p.id === c.pairs);
    if (!pairs) return { error: 'Feux à choisir' };
    items.push({
      label: `Feux teintés — ${pairs.label}`,
      detail: `${lightsBooking.material.label}, teinte choisie à l’atelier`,
      price: lightsBooking.material.perPair.max * pairs.count,
      minutes: lightsBooking.minutesPerPair * pairs.count,
    });
  }
  if (!items.length) return { error: 'Prestation à choisir' };
  const total = items.reduce((a, i) => a + i.price, 0);
  const minutes = items.reduce((a, i) => a + i.minutes, 0);
  return { items, total, minutes, deposit: Math.round(total * bookingRules.depositRate * 100) / 100 };
}

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

/** a code as typed (referral or promo): capitals, digits and the dash only (e.g. JEAN-7K2QX, NOEL15) */
export const referralCode = (s) => String(s || '').toUpperCase().replace(/\s+/g, '').replace(/[^A-Z0-9-]/g, '').slice(0, 20);

/** the promo campaign of a code, or null (then it may be a referral code) */
export const promoOf = (code) => promos.find((p) => p.code === referralCode(code)) || null;

/** the discount (EUR, to the cent) of `percent` % off a price */
export const percentOff = (q, percent) => (q.error ? 0 : Math.round(q.total * percent) / 100);

/** what the discount line is called (summary, calendar, e-mails): « Parrainage » or « Code promo NOEL15 (−15 %) » */
export const discountLabel = ({ kind, code, percent } = {}) => (kind === 'promo' ? `Code promo ${code} (−${percent} %)` : 'Parrainage');

/** "1er décembre 2026", "24 décembre 2026" (a YYYY-MM-DD day) */
export const dayText = (date) => {
  const s = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${date}T12:00:00Z`));
  return s.replace(/^1 /, '1er ');
};

/** the price with a referral discount: the total is lowered, the deposit taken on what is left */
export function withDiscount(q, amount) {
  if (q.error || !(amount > 0)) return q;
  const total = Math.max(0, Math.round((q.total - amount) * 100) / 100);
  return { ...q, discount: amount, total, deposit: Math.round(total * bookingRules.depositRate * 100) / 100 };
}

/** the amount to pay now (EUR): the deposit or the total */
export const amountDue = (q, mode) => (mode === 'full' ? q.total : q.deposit);

/** "2 h 30", "45 min" */
export const formatDuration = (m) => (m < 60 ? `${m} min` : `${Math.floor(m / 60)} h${m % 60 ? ` ${String(m % 60).padStart(2, '0')}` : ''}`);

/** "81 €", "72,50 €" */
export const formatEuros = (n) =>
  new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', minimumFractionDigits: Number.isInteger(n) ? 0 : 2, maximumFractionDigits: 2 }).format(n);
