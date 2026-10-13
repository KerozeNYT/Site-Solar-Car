/**
 * Covering & déchromage: page copy and simulator settings. The films themselves live in
 * content/films/ (official references only); the car's zones in content/cars/x6.js (`covering`).
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

/** simulator: default films (ids of content/films/) */
export const simDefaults = {
  body: '3m-2080-m21', // complete wrap (clearly different from the demo car's own blue)
  zone: '3m-2080-g12', // partial wrap (roof, bonnet, mirrors…)
  dechrome: '3m-2080-g12', // chrome delete
  // the three blacks offered for chrome delete
  dechromeFilms: ['3m-2080-g12', '3m-2080-s12', '3m-2080-m12'],
};

export const disclaimer =
  'Simulation indicative : les couleurs et les finitions peuvent varier selon votre écran et l’éclairage. Le choix définitif se confirme sur nuancier à l’atelier.';

/** home tour: the colour shown when the visitor opens the covering spot (a verified reference) */
export const homeDemo = { id: '3m-2080-m21', code: '2080-M21', name: 'Matte Silver Metallic', color: '#a6a9ac', roughness: 0.62, metalness: 0.55, coat: 0.06, coatRough: 0.9 };

export const coveringPage = {
  heroAlt: 'Rendu 3D du simulateur : la voiture du studio habillée d’un film argent métallisé mat',
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
          'Nous commençons le nuancier en ligne par la gamme 3M™ Série 2080, un film coulé conçu pour l’habillage partiel ou complet des véhicules, qui épouse les courbes et les creux de la carrosserie.',
          'Chaque référence du simulateur renvoie à sa fiche sur le site de 3M France. Les couleurs affichées sont des approximations : le choix se fait toujours sur l’échantillon réel, à l’atelier.',
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
  works: {
    title: 'Nos réalisations covering',
    empty: 'Les photos de nos premiers véhicules habillés seront publiées ici. En attendant, suivez les sorties d’atelier sur Instagram.',
  },
};
