/**
 * Promotions planned in advance: written once into the workshop's database (booking/store.js) when
 * the booking server starts after a deploy, then managed from the workshop's space (/atelier,
 * « Codes et promos »): changing or stopping them there is kept (they are never written again).
 * New promotions are made there directly; this file only seeds the first one.
 *
 * Dates are days in Paris, inclusive: from `starts` 00:00 to `ends` 23:59.
 */
export const promoSeeds = [
  {
    code: 'NOEL',
    label: 'Noël 2026',
    percent: 15,
    services: ['tint', 'lights'],
    maxUses: 0, // 0: as many times as wanted
    starts: '2026-12-01',
    ends: '2026-12-31',
  },
];

/** the band shown at the bottom of every page of the site between those dates */
export const bannerSeed = {
  id: 'noel-2026',
  text: 'Noël chez SOLAR CAR 37 : −15 % sur vos vitres teintées et feux teintés réservés en ligne avec le code NOEL, jusqu’au 31 décembre.',
  cta: 'Réserver',
  code: 'NOEL',
  starts: '2026-12-01',
  ends: '2026-12-31',
};
