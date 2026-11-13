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
  // the booking server (Cloudflare Worker, booking/): '' until it is deployed, the page then
  // offers a quote request instead
  api: '',
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
  // deposit: 30 % of the total, or the total; refunded if cancelled at least 48 h before
  depositRate: 0.3,
  cancelHours: 48,
  // a slot is held this long while the visitor pays (Stripe's minimum session life)
  holdMinutes: 30,
};

/** window tint packages: price (EUR, tax included) for a vehicle category, time (minutes) */
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
 *   { tint?: { vehicle, formula, shade, windshield?, color? }, lights?: { pairs, shade } }
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
    const shade = Number(c.shade);
    const rearShade = formula.id === 'rear' || formula.id === 'full';
    if (rearShade && !tint.shades.includes(shade)) return { error: 'Teinte à choisir' };
    items.push({
      label: `Vitres teintées — ${formula.label}`,
      detail: `${vehicle.label}${rearShade ? `, teinte ${shade} %` : ''}`,
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
    const shade = lights.shades.find((s) => s.id === Number(c.shade));
    if (!pairs) return { error: 'Feux à choisir' };
    if (!shade) return { error: 'Teinte des feux à choisir' };
    items.push({
      label: `Feux teintés — ${pairs.label}`,
      detail: `${lightsBooking.material.label}, ${shade.label}`,
      price: lightsBooking.material.perPair.max * pairs.count,
      minutes: lightsBooking.minutesPerPair * pairs.count,
    });
  }
  if (!items.length) return { error: 'Prestation à choisir' };
  const total = items.reduce((a, i) => a + i.price, 0);
  const minutes = items.reduce((a, i) => a + i.minutes, 0);
  return { items, total, minutes, deposit: Math.round(total * bookingRules.depositRate * 100) / 100 };
}

/** the amount to pay now (EUR): the deposit or the total */
export const amountDue = (q, mode) => (mode === 'full' ? q.total : q.deposit);

/** "2 h 30", "45 min" */
export const formatDuration = (m) => (m < 60 ? `${m} min` : `${Math.floor(m / 60)} h${m % 60 ? ` ${String(m % 60).padStart(2, '0')}` : ''}`);

/** "81 €", "72,50 €" */
export const formatEuros = (n) =>
  new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', minimumFractionDigits: Number.isInteger(n) ? 0 : 2, maximumFractionDigits: 2 }).format(n);
