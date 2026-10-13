/**
 * Real jobs done at the workshop, shown on /realisations/, on the home page and on each
 * service page. ONLY genuine photos of customers' cars (with their agreement): never a 3D render
 * or a stock picture presented as a job. While this list is empty, the gallery, its menu link
 * and its sections are simply not built.
 *
 * Photos: put them in public/img/realisations/ (JPG or WebP, about 1600 px wide, under ~300 KB).
 * For a before / after comparison, take both photos from the same angle and in the same light.
 *
 * Example:
 * {
 *   id: '2026-11-golf-r',                  // unique, used in the page anchor
 *   service: 'vitres-teintees',            // slug of the service (content/site.js)
 *   vehicle: 'Volkswagen Golf R',
 *   finish: 'Film 15 % à l’arrière, 70 % athermique à l’avant',
 *   text: 'Intimité à l’arrière, confort thermique à l’avant.',
 *   date: '2026-11',
 *   photos: [{ src: '/img/realisations/golf-r-1.jpg', alt: 'Golf R noire, vitres arrière teintées, vue 3/4 arrière' }],
 *   // optional: same angle, same light
 *   beforeAfter: { before: '/img/realisations/golf-r-avant.jpg', after: '/img/realisations/golf-r-apres.jpg', alt: 'Vitres arrière de la Golf R' },
 * },
 */
export const realisations = [
  {
    id: 'audi-a5-coupe',
    service: 'vitres-teintees',
    vehicle: 'Audi A5 Coupé S line',
    finish: 'Lunette et vitres arrière teintées',
    text: 'Une lunette et des vitres arrière bien foncées, en contraste net avec la carrosserie blanche.',
    // photos prepared by scripts/photos.mjs (plate cover, other plates pixelated, no metadata);
    // a photo only shows once its web version exists in public/img/realisations/
    photos: [
      { id: 'audi-a5-coupe-34-arriere', alt: 'Audi A5 Coupé blanche, lunette et vitres arrière teintées, vue de trois quarts arrière devant l’atelier', focus: '62% 62%' },
      { id: 'audi-a5-coupe-atelier', alt: 'Audi A5 Coupé blanche devant l’atelier SOLAR CAR à Vouvray', focus: '45% 62%' },
      { id: 'audi-a5-coupe-profil', alt: 'Audi A5 Coupé blanche de profil, vitres teintées', focus: '50% 58%' },
    ],
  },
  {
    id: 'volvo-v60',
    service: 'vitres-teintees',
    vehicle: 'Volvo V60',
    finish: 'Vitres arrière et lunette teintées',
    text: 'Vitres arrière et lunette teintées sur ce break, pour l’intimité des passagers et le confort à bord.',
    photos: [{ id: 'volvo-v60-34-arriere', alt: 'Volvo V60 bronze, vitres arrière et lunette teintées, vue de trois quarts arrière', focus: '45% 62%' }],
  },
];

export const realisationsPage = {
  seo: {
    title: 'Nos réalisations : vitres teintées, detailing, phares | SOLAR CAR 37',
    description: 'Photos de véhicules traités à l’atelier SOLAR CAR 37 de Vouvray, près de Tours : vitres teintées, feux, detailing, ciel étoilé, rénovation de phares.',
  },
  h1: 'Nos réalisations',
  intro: 'Des voitures passées par l’atelier, photographiées avant leur retour à leurs propriétaires.',
};
