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
export const realisations = [];

export const realisationsPage = {
  seo: {
    title: 'Nos réalisations : vitres teintées, detailing, phares | SOLAR CAR 37',
    description: 'Photos de véhicules traités à l’atelier SOLAR CAR 37 de Vouvray, près de Tours : vitres teintées, feux, detailing, ciel étoilé, rénovation de phares.',
  },
  h1: 'Nos réalisations',
  intro: 'Des voitures passées par l’atelier, photographiées avant leur retour à leurs propriétaires.',
};
