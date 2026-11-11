/**
 * Covering & déchromage: page copy. The films themselves live in content/films/ (official
 * references only), listed on the page as the workshop's colour chart.
 *
 * No price is shown for this service until the workshop validates one: everything reads
 * « Sur devis ». Nothing here may promise a certification, a warranty length or a lifespan.
 */

/** surface finishes: approximate render settings (the film's real look is checked on samples) */
export const FINISHES = {
  'high-gloss': { label: 'High Gloss', long: 'Brillant miroir', fem: 'High Gloss (brillant miroir)', roughness: 0.07, clearcoat: 1, clearcoatRoughness: 0.025 },
  gloss: { label: 'Brillant', long: 'Brillant', fem: 'brillante', roughness: 0.15, clearcoat: 1, clearcoatRoughness: 0.06 },
  satin: { label: 'Satiné', long: 'Satiné', fem: 'satinée', roughness: 0.42, clearcoat: 0.3, clearcoatRoughness: 0.5 },
  matte: { label: 'Mat', long: 'Mat', fem: 'mate', roughness: 0.7, clearcoat: 0.02, clearcoatRoughness: 0.9 },
};

/** effects, separate from the finish (a satin film can be metallic, a gloss film can flip…) */
export const EFFECTS = {
  metallic: { label: 'Métallisé', metalness: 0.55 },
  pearl: { label: 'Nacré', metalness: 0.18 },
  flip: { label: 'Color flip', long: 'Reflets changeants selon l’angle' },
  carbon: { label: 'Carbone', long: 'Texture carbone' },
};

export const FAMILIES = {
  noir: 'Noir',
  blanc: 'Blanc et ivoire',
  gris: 'Gris et argent',
  bleu: 'Bleu',
  rouge: 'Rouge',
  vert: 'Vert',
  violet: 'Violet',
  or: 'Or',
};

export const coveringPage = {
  heroAlt: 'Rendu 3D : la voiture du studio habillée d’un film argent métallisé mat',
  offers: {
    title: 'Trois façons de transformer votre véhicule',
    items: [
      {
        id: 'complet',
        title: 'Covering complet',
        text: 'Toute la carrosserie change de couleur ou de finition : brillant, satiné, mat, métallisé, nacré ou à reflets changeants. La peinture d’origine reste dessous.',
        points: ['Toutes les surfaces peintes visibles', 'Démontage des pièces nécessaires à une pose propre', 'Étude de l’état de la peinture avant pose'],
      },
      {
        id: 'partiel',
        title: 'Covering partiel',
        text: 'Une touche de contraste sur quelques éléments : toit, capot, coques de rétroviseurs, becquet… chacun dans la référence de votre choix.',
        points: ['Toit noir brillant, capot mat, rétroviseurs carbone…', 'Chaque zone a sa propre référence', 'Idéal pour personnaliser sans tout changer'],
      },
      {
        id: 'dechromage',
        title: 'Déchromage',
        text: 'Les pièces chromées (calandre, entourages, baguettes) passent en noir brillant, satiné ou mat, pour une ligne plus sobre et plus sportive.',
        points: ['Film noir brillant, satiné ou mat', 'Seules les pièces réellement chromées sont concernées', 'Combinable avec un covering complet ou partiel'],
      },
    ],
    price: 'Sur devis',
    priceNote: 'Le prix dépend du véhicule, des surfaces, des démontages et du film choisi : il est établi après étude du véhicule.',
  },
  films: {
    title: 'Films, finitions et préparation',
    blocks: [
      {
        title: 'Les films 3M™ Série 2080',
        text: [
          'Notre nuancier en ligne commence par la gamme 3M™ Série 2080, un film coulé conçu pour l’habillage partiel ou complet des véhicules, qui épouse les courbes et les creux de la carrosserie.',
          'Chaque référence du nuancier renvoie à sa fiche sur le site de 3M France. Les couleurs affichées sont des approximations : le choix se fait toujours sur l’échantillon réel, à l’atelier.',
        ],
      },
      {
        title: 'Finition et effet : deux choix distincts',
        text: [
          'La finition décrit la surface : High Gloss (brillant miroir), brillant, satiné ou mat. L’effet décrit ce que contient le film : métallisé, nacré, reflets changeants (color flip) ou texture carbone.',
          'Un mat se nettoie différemment d’un brillant, un film à reflets changeants se juge sous plusieurs lumières : nous vous montrons les échantillons en extérieur avant de décider.',
        ],
      },
      {
        title: 'La préparation fait la tenue',
        text: [
          'Lavage, décontamination et dégraissage des surfaces, contrôle de l’état de la peinture, puis démontage des éléments qui gênent une pose propre (selon le véhicule : poignées, feux, logos, joints).',
          'Une peinture écaillée, refaite récemment ou fragile peut être abîmée lors d’une future dépose : nous la vérifions avant de vous proposer la pose.',
        ],
      },
      {
        title: 'Covering et film de protection : deux produits différents',
        text: [
          'Le covering décoratif change la couleur ou la finition. Il ne remplace pas un film de protection de peinture (PPF), plus épais et conçu contre les gravillons et les rayures.',
        ],
      },
    ],
  },
  // the job told in full under the header (content/realisations.js), with photos from its list
  feature: {
    job: 'mclaren-720s',
    kicker: 'Réalisation à la une',
    title: 'McLaren 720S : de l’orange au *noir satiné*',
    text: [
      'Cette supercar est arrivée dans sa teinte orange d’origine. Elle est repartie habillée d’un film noir satiné, plus discret, qui souligne chaque arête de sa carrosserie.',
      'Pour une pose propre, le pare-chocs avant a été déposé : le film se replie sur les bords des éléments au lieu de s’arrêter en surface.',
    ],
    facts: [
      ['Teinte d’origine', 'Orange'],
      ['Finition posée', 'Noir satiné'],
      ['Préparation', 'Pare-chocs déposé'],
    ],
    main: 'mclaren-720s-covering-noir-satine-34',
    strip: [
      { id: 'mclaren-720s-covering-pose', caption: 'Pendant la pose : l’orange d’origine encore visible sous le film noir.' },
      { id: 'mclaren-720s-covering-noir-satine-avant', caption: 'Après : la face avant en noir satiné.' },
    ],
    cta: 'Parler de votre projet',
  },
  works: {
    title: 'Nos réalisations covering',
    empty: 'Les photos de nos premiers véhicules habillés seront publiées ici. En attendant, suivez les sorties d’atelier sur Instagram.',
  },
};
