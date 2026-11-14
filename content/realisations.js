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
  // photos prepared by scripts/photos.mjs (plate cover, other plates pixelated, other businesses'
  // signs blanked, no metadata); a photo only shows once its web version exists in
  // public/img/realisations/. The first three jobs appear on the home page. `focus`: the part of
  // the photo kept when it is cropped (cards in 4:3, page headers on phones).
  {
    id: 'mclaren-720s',
    service: 'covering-dechromage',
    vehicle: 'McLaren 720S',
    finish: 'Covering noir satiné',
    text: 'Carrosserie orange d’origine, entièrement habillée d’un film noir satiné : pare-chocs déposé pendant la pose pour replier le film sur les bords.',
    photos: [
      { id: 'mclaren-720s-covering-noir-satine', alt: 'McLaren 720S en covering noir satiné, vue de trois quarts arrière sur un plateau tournant', focus: '50% 59%' },
      { id: 'mclaren-720s-covering-noir-satine-avant', alt: 'Face avant de la McLaren 720S noir satiné, phares effilés et jantes noires', focus: '50% 52%' },
      { id: 'mclaren-720s-covering-noir-satine-34', alt: 'McLaren 720S noir satiné de trois quarts avant, reflets doux du film sous l’éclairage', focus: '50% 50%' },
      { id: 'mclaren-720s-covering-pose', alt: 'McLaren 720S pendant la pose : portes en élytre ouvertes, pare-chocs déposé, film noir posé sur la carrosserie orange', focus: '50% 39%' },
    ],
  },
  {
    id: 'porsche-panamera',
    service: 'vitres-teintees',
    vehicle: 'Porsche Panamera 4',
    finish: 'Vitres arrière et lunette teintées',
    text: 'Une berline noire aux vitres arrière fumées : la ligne paraît plus basse, l’habitacle reste à l’abri des regards.',
    photos: [
      { id: 'porsche-panamera-vitres-teintees', alt: 'Porsche Panamera 4 noire, vitres arrière et lunette teintées, vue de trois quarts arrière devant un champ', focus: '50% 66%' },
      { id: 'porsche-panamera-vitres-teintees-arriere', alt: 'Arrière de la Porsche Panamera 4 noire, lunette teintée et bandeau de feux', focus: '50% 73%' },
    ],
  },
  {
    id: 'volvo-xc90-renovation-phares',
    service: 'renovation-phares',
    vehicle: 'Volvo XC90',
    finish: 'Rénovation de phares',
    text: 'Une optique jaunie et voilée par les années : après ponçage et polissage, le phare retrouve sa transparence et l’éclairage sa portée.',
    // the before / after cut in two (page header, home card), made from the two photos below
    // (aligned on the headlight): assets-src/photos/originals/volvo-xc90-phare-avant|apres.jpg
    photos: [{ id: 'volvo-xc90-phares-avant-apres', alt: 'Phare avant de Volvo XC90 coupé en deux : à gauche jauni et voilé avant rénovation, à droite clair et transparent après', focus: '50% 50%' }],
    // the slider of the job's card: the same frame before and after
    beforeAfter: { before: '/img/realisations/volvo-xc90-phares-avant.webp', after: '/img/realisations/volvo-xc90-phares-apres.webp', alt: 'phare avant de la Volvo XC90' },
  },
  {
    id: 'bmw-serie-2-ciel-etoile',
    service: 'ciel-etoile',
    vehicle: 'BMW Série 2',
    finish: 'Ciel étoilé en fibre optique',
    text: 'Des centaines de points lumineux semés dans le pavillon, accordés à l’éclairage d’ambiance bleu de l’habitacle.',
    photos: [
      { id: 'bmw-serie-2-ciel-etoile', alt: 'Pavillon de BMW Série 2 constellé d’étoiles en fibre optique, éclairage d’ambiance bleu', focus: '50% 15%' },
      { id: 'bmw-serie-2-ciel-etoile-habitacle', alt: 'Habitacle de la BMW Série 2 de nuit : ciel étoilé au-dessus des sièges avant', focus: '50% 20%' },
    ],
  },
  {
    id: 'bmw-m2-noire',
    service: 'detailing-carrosserie',
    vehicle: 'BMW M2',
    finish: 'Detailing extérieur',
    text: 'Un noir profond et sans voile : le capot reflète les nuages comme un miroir.',
    photos: [
      { id: 'bmw-m2-detailing-lustrage', alt: 'BMW M2 noire après detailing, carrosserie brillante sous un ciel nuageux', focus: '50% 66%' },
      { id: 'bmw-m2-detailing-lustrage-avant', alt: 'BMW M2 noire devant l’atelier, reflets nets sur le capot et les ailes', focus: '50% 77%' },
      { id: 'bmw-m2-detailing-lustrage-arriere', alt: 'Arrière de la BMW M2 noire, peinture lustrée et feux arrière', focus: '50% 80%' },
    ],
  },
  {
    id: 'audi-s1-ciel-etoile',
    service: 'ciel-etoile',
    vehicle: 'Audi S1',
    finish: 'Ciel étoilé en fibre optique, étoiles multicolores',
    text: 'Une petite sportive transformée la nuit : un pavillon couvert d’étoiles blanches, violettes et rouges.',
    photos: [
      { id: 'audi-s1-ciel-etoile', alt: 'Audi S1 : pavillon couvert d’étoiles blanches, violettes et rouges au-dessus des sièges baquets', focus: '50% 20%' },
      { id: 'audi-s1-ciel-etoile-violet', alt: 'Ciel étoilé de l’Audi S1 en lumière violette, sièges S1 au premier plan', focus: '50% 20%' },
    ],
  },
  {
    id: 'porsche-cayenne-coupe',
    service: 'vitres-teintees',
    vehicle: 'Porsche Cayenne Coupé',
    finish: 'Vitres arrière et lunette teintées',
    text: 'Le profil fuyant du Cayenne Coupé souligné par des vitres arrière sombres, assorties à la carrosserie.',
    photos: [
      { id: 'porsche-cayenne-coupe-vitres-teintees', alt: 'Porsche Cayenne Coupé gris foncé, vitres arrière et lunette teintées, vue de trois quarts arrière', focus: '50% 77%' },
      { id: 'porsche-cayenne-coupe-vitres-teintees-34', alt: 'Porsche Cayenne Coupé de trois quarts arrière devant la campagne, vitres arrière foncées', focus: '50% 68%' },
    ],
  },
  {
    id: 'bmw-m2-violet',
    service: 'covering-dechromage',
    vehicle: 'BMW M2',
    finish: 'Covering violet brillant',
    text: 'Une teinte violette profonde, associée à des jantes bronze.',
    photos: [
      { id: 'bmw-m2-covering-violet', alt: 'BMW M2 en covering violet brillant devant l’atelier SOLAR CAR', focus: '100% 50%' },
      { id: 'bmw-m2-covering-violet-34', alt: 'BMW M2 violette de trois quarts avant, jantes bronze', focus: '60% 50%' },
      { id: 'bmw-m2-covering-violet-profil', alt: 'BMW M2 violette vue de près, reflets du film sur l’aile et le capot', focus: '50% 50%' },
    ],
  },
  {
    id: 'audi-a7-sportback',
    service: 'vitres-teintees',
    vehicle: 'Audi A7 Sportback',
    finish: 'Vitres arrière et lunette teintées',
    text: 'Sur une carrosserie grise, des vitres arrière foncées pour un contraste net et un habillage plus sportif.',
    photos: [
      { id: 'audi-a7-sportback-vitres-teintees', alt: 'Audi A7 Sportback grise, lunette et vitres arrière teintées, vue de trois quarts arrière', focus: '50% 62%' },
      { id: 'audi-a7-sportback-vitres-teintees-profil', alt: 'Audi A7 Sportback grise de profil, vitres arrière sombres', focus: '50% 71%' },
    ],
  },
  {
    id: 'porsche-911',
    service: 'detailing-carrosserie',
    vehicle: 'Porsche 911',
    finish: 'Detailing extérieur',
    text: 'Un orange éclatant et uniforme, du capot aux ailes arrière.',
    photos: [
      { id: 'porsche-911-detailing', alt: 'Porsche 911 orange après detailing devant l’atelier SOLAR CAR de Vouvray', focus: '50% 84%' },
      { id: 'porsche-911-detailing-arriere', alt: 'Arrière de la Porsche 911 orange, peinture brillante sous le ciel bleu', focus: '50% 76%' },
    ],
  },
  {
    id: 'bmw-or-chrome',
    service: 'covering-dechromage',
    vehicle: 'BMW',
    finish: 'Covering or chromé',
    text: 'Un habillage or miroir qui capte chaque néon de l’atelier.',
    photos: [{ id: 'bmw-covering-or-chrome', alt: 'BMW en covering or chromé dans l’atelier, néons reflétés sur le capot', focus: '50% 74%' }],
  },
  {
    id: 'mercedes-c63-break',
    service: 'vitres-teintees',
    vehicle: 'Mercedes-AMG C 63 Break',
    finish: 'Vitres arrière et lunette teintées',
    text: 'Sur un break blanc, des vitres arrière noires : l’effet le plus contrasté qui soit.',
    photos: [{ id: 'mercedes-c63-break-vitres-teintees', alt: 'Mercedes-AMG C 63 Break blanche, vitres arrière et lunette teintées noires', focus: '50% 68%' }],
  },
  {
    id: 'audi-a6-allroad',
    service: 'covering-dechromage',
    vehicle: 'Audi A6 Allroad',
    finish: 'Covering vert kaki mat',
    text: 'Un vert kaki mat associé à des jantes bronze, pour un break au caractère baroudeur.',
    photos: [
      { id: 'audi-a6-allroad-covering-kaki', alt: 'Audi A6 Allroad en covering vert kaki mat, jantes bronze, vue de trois quarts avant', focus: '50% 63%' },
      { id: 'audi-a6-allroad-covering-kaki-arriere', alt: 'Audi A6 Allroad vert kaki mat de trois quarts arrière', focus: '50% 78%' },
    ],
  },
  {
    id: 'mercedes-a45',
    service: 'vitres-teintees',
    vehicle: 'Mercedes-AMG A 45',
    finish: 'Vitres arrière et lunette teintées',
    text: 'Blanc et noir : les vitres arrière teintées répondent aux jantes et au becquet.',
    photos: [{ id: 'mercedes-a45-vitres-teintees', alt: 'Mercedes-AMG A 45 blanche de profil, vitres arrière teintées', focus: '50% 60%' }],
  },
  {
    id: 'mercedes-classe-a',
    service: 'covering-dechromage',
    vehicle: 'Mercedes Classe A',
    finish: 'Covering : gris et accents orange',
    text: 'Une carrosserie grise relevée de filets orange sur les bas de caisse et le bouclier.',
    photos: [
      { id: 'mercedes-classe-a-covering', alt: 'Mercedes Classe A grise aux accents orange devant l’atelier ouvert', focus: '50% 87%' },
      { id: 'mercedes-classe-a-covering-34', alt: 'Mercedes Classe A grise de trois quarts avant, filets orange sur le bouclier', focus: '50% 82%' },
    ],
  },
  {
    id: 'mazda-3',
    service: 'detailing-carrosserie',
    vehicle: 'Mazda 3',
    finish: 'Detailing extérieur',
    text: 'Un gris clair éclatant, net sur le bardage sombre de l’atelier.',
    photos: [
      { id: 'mazda-3-detailing', alt: 'Mazda 3 gris clair après detailing devant le bardage sombre de l’atelier', focus: '50% 82%' },
      { id: 'mazda-3-detailing-profil', alt: 'Mazda 3 gris clair de profil devant la porte de l’atelier', focus: '50% 95%' },
    ],
  },
];

export const realisationsPage = {
  seo: {
    title: 'Réalisations : covering, vitres teintées | SOLAR CAR 37',
    description: 'McLaren 720S en noir satiné, Panamera aux vitres teintées, ciels étoilés, detailing : des voitures passées par l’atelier de Vouvray, près de Tours.',
  },
  h1: 'Nos réalisations',
  intro: 'Des voitures passées par l’atelier, photographiées avant leur retour à leurs propriétaires.',
};
