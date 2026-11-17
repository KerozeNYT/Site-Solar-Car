/**
 * Promotions and bands planned in advance: written once into the workshop's database
 * (booking/store.js) when the booking server starts after a deploy, then managed from the
 * workshop's space (/atelier, « Codes et promos »): changing, pausing or deleting them there is kept
 * (they are never written again). New ones are made there directly.
 *
 * Dates are days in Paris, inclusive: from `starts` 00:00 to `ends` 23:59. A code is valid for the
 * bookings MADE between those dates (whatever the day of the appointment), and for the quote
 * requests sent between them (the other services: the workshop lowers the quote).
 *
 * `rev`: raise it to write a seed again ONCE over what the database holds (a campaign changed
 * here after it was first written; a change made meanwhile in the workshop's space is replaced).
 */
export const promoSeeds = [
  {
    // the day GTA 6 comes out: 15 % off every booking made that day
    code: 'GTA6',
    label: 'Sortie de GTA 6',
    percent: 15,
    services: ['tint', 'lights'],
    maxUses: 0, // 0: as many times as wanted
    starts: '2026-11-19',
    ends: '2026-11-19',
  },
  {
    // Christmas (decided on 16-17 November 2026): 15 % off every service, as many times as wanted,
    // for the bookings made and the quotes requested from 1 to 24 December 23:59
    code: 'NOEL',
    label: 'Noël 2026',
    percent: 15,
    services: [], // none named: every service (online: tint and lights; the others on quote)
    maxUses: 0,
    starts: '2026-12-01',
    ends: '2026-12-24',
    rev: 2,
  },
];

/**
 * The bands shown at the top of every page of the site between their dates (the most recent start
 * wins when two overlap). theme: 'classique' (black and gold), 'noel' (red, snow), 'neon' (sunset
 * and neon lights: an original look, no game's images, logo or lettering).
 */
export const bannerSeeds = [
  {
    id: 'gta6-2026',
    theme: 'neon',
    title: 'Sortie de GTA 6 · −15 %',
    text: 'Jeudi 19 novembre, jour de sortie de GTA 6 : −15 % sur vos vitres teintées et feux teintés pour tout rendez-vous réservé en ligne ce jour-là, avec le code GTA6.',
    cta: 'Réserver',
    code: 'GTA6',
    starts: '2026-11-17',
    ends: '2026-11-19',
  },
  {
    id: 'noel-2026',
    theme: 'noel',
    title: 'Offre de Noël · −15 %',
    text: 'Jusqu’au 24 décembre à 23 h 59 seulement : −15 % sur toutes les prestations avec le code NOEL. Vitres et feux teintés : réservez en ligne, même pour un rendez-vous dans plusieurs mois ; detailing, ciel étoilé, covering, phares : demandez votre devis avec le code. Offrez-vous (ou offrez) une voiture qui a du style pour les fêtes !',
    cta: 'J’en profite',
    code: 'NOEL',
    starts: '2026-12-01',
    ends: '2026-12-24',
    rev: 2,
  },
];
