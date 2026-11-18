/**
 * The gift card and the SOLAR CAR Premium membership: ONE module, read by the site's pages
 * (src/templates/pages.js, src/js/gift.js, src/js/premium.js), the booking server
 * (booking/worker.js, booking/store.js) and its e-mails (booking/mail.js). The server recomputes
 * every amount from here: it never trusts an amount sent by the browser.
 *
 * Decided with SOLAR CAR 37 on 18 November 2026: gift cards of 50, 100, 150, 250 € or a free
 * amount, valid one year, spent online or at the workshop in one or several times; Premium at
 * 19,99 € a year, −10 % on every service, offers kept for the members, a gift at each tier.
 * The tiers' gifts are a proposal, to confirm with the workshop (docs/CARTES.md).
 */

export const giftCard = {
  // the amounts offered (EUR); a free amount between min and max
  amounts: [50, 100, 150, 250],
  min: 20,
  max: 1000,
  // valid 12 months from the purchase, spent in one or several times
  months: 12,
  // the finishes of the card: the 3D card of the page, the e-mail, the printed card
  // (public/img/cartes/cadeau-<id>.jpg, the face without its text)
  looks: [
    { id: 'or', label: 'Or', text: 'Noir profond et dorure à chaud' },
    { id: 'carbone', label: 'Carbone', text: 'Tissage carbone et chrome' },
    { id: 'noel', label: 'Noël', text: 'Rouge velours et or, pour les fêtes' },
  ],
  // sent to the recipient on the chosen day at about 8:00 (Paris), up to `sendDays` days ahead
  sendDays: 366,
  // a gift message: at most this many characters
  messageMax: 220,
};

export const premium = {
  name: 'SOLAR CAR Premium',
  // EUR a year, paid once: no automatic renewal (a reminder e-mail comes before the end)
  price: 19.99,
  // off every service, all year (online booking, appointments taken at the workshop, quotes)
  percent: 10,
  months: 12,
  // the reminder e-mail, this many days before the end
  remindDays: 15,
  /**
   * The levels: one level a service (« un palier = une prestation », SOLAR CAR 37, 18 November
   * 2026). Each appointment made as a member (counted from the first day of membership, renewals
   * included) opens the next level; its `gift` is handed over at that appointment, and the
   * workshop ticks « Cadeau remis » in its space. `color`: the level's neon on the card and the
   * pages. The gifts are a proposal, to confirm with the workshop.
   */
  tiers: [
    { id: 'membre', label: 'Membre', visits: 0, color: '#d9dde4', gift: null, perks: ['−10 % sur toutes les prestations, toute l’année', 'Offres et avant-premières réservées aux membres', 'Votre espace Premium : carte, rendez-vous, cadeaux'] },
    { id: 'ignition', label: 'Ignition', visits: 1, color: '#ff8a3d', gift: 'Une microfibre premium et un parfum d’habitacle SOLAR CAR', perks: ['Débloqué à votre 1re prestation'] },
    { id: 'turbo', label: 'Turbo', visits: 2, color: '#3dd6ff', gift: 'Un kit d’entretien : nettoyant spécial vitres teintées et microfibre vitres', perks: ['Débloqué à votre 2e prestation'] },
    { id: 'nitro', label: 'Nitro', visits: 3, color: '#8a6bff', gift: 'Un traitement déperlant du pare-brise, posé pendant votre rendez-vous', perks: ['Débloqué à votre 3e prestation'] },
    { id: 'hyper', label: 'Hyper', visits: 4, color: '#ff3d8b', gift: 'Une rénovation de phares offerte (valeur 79 €)', perks: ['Débloqué à votre 4e prestation'] },
    { id: 'legende', label: 'Légende', visits: 5, color: '#e9cd82', gift: 'Une paire de feux teintés offerte (valeur 120 €) et l’année Premium suivante offerte', perks: ['Débloqué à votre 5e prestation'] },
  ],
};

/** the tier of a member after `visits` appointments as a member */
export const tierOf = (visits) => [...premium.tiers].reverse().find((t) => (Number(visits) || 0) >= t.visits) || premium.tiers[0];
/** the next tier, or null at the top */
export const nextTier = (visits) => premium.tiers.find((t) => t.visits > (Number(visits) || 0)) || null;

/** « 19,99 € », « 50 € » */
export const offerEuros = (n) => `${(Math.round(Number(n) * 100) / 100).toFixed(2).replace('.', ',').replace(',00', '')} €`;

/** a gift card's amount from the form: one of the amounts, or a free amount in bounds; null otherwise */
export function giftAmount(v) {
  const n = Math.round(Number(String(v ?? '').replace(/\s/g, '').replace(',', '.')) * 100) / 100;
  return Number.isFinite(n) && n >= giftCard.min && n <= giftCard.max ? n : null;
}

/** the codes: CADEAU-7K2Q-X9M4 (a gift card), PREMIUM-7K2Q-X9M4 (a member's number); both fit
 *  the booking page's code field (content/booking.js, referralCode: 20 characters at most) */
export const GIFT_PREFIX = 'CADEAU';
export const PREMIUM_PREFIX = 'PREMIUM';
export const isGiftCode = (code) => /^CADEAU-[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(String(code || ''));
export const isPremiumCode = (code) => /^PREMIUM-[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(String(code || ''));
