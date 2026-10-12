/**
 * SOLAR CAR 37 — all business copy, contact details and SEO settings.
 *
 * Fields set to null are unknown and are simply not rendered (and kept out of the
 * structured data) until you fill them in. Never invent them: search engines and customers
 * rely on them. Run `npm run check` to list what is still missing.
 */

export const business = {
  name: 'SOLAR CAR 37',
  // Used for canonical URLs, sitemap and social cards. Replace with the real domain.
  siteUrl: 'https://votre-domaine.fr',
  tagline: 'Vitres teintées, detailing & lumière automobile',
  department: 'Indre-et-Loire',
  departmentCode: '37',
  region: 'Centre-Val de Loire',
  // --- to complete -------------------------------------------------------------------
  legalName: null, // e.g. 'SOLAR CAR 37 SAS'
  phone: null, // e.g. '02 47 00 00 00'
  email: null, // e.g. 'contact@votre-domaine.fr'
  address: {
    street: null, // e.g. '12 rue de l'Exemple'
    postalCode: null, // e.g. '37000'
    city: null, // e.g. 'Tours' — also added to page titles once filled in
  },
  geo: null, // e.g. { lat: 47.39, lng: 0.68 }
  // Opening hours in schema.org form, e.g. [{ days: ['Mo','Tu','We','Th','Fr'], opens: '09:00', closes: '18:00' }]
  openingHours: null,
  social: {
    instagram: null,
    facebook: null,
    tiktok: null,
    googleBusiness: null,
  },
  siret: null,
  // Where the contact form posts (Formspree, Getform, your own endpoint...). When null the
  // form is a clearly labelled demo and nothing is sent.
  formEndpoint: null,
};

export const nav = [
  { label: 'Vitres teintées', href: '/vitres-teintees/' },
  { label: 'Feux teintés', href: '/feux-arriere-teintes/' },
  { label: 'Detailing', href: '/detailing-carrosserie/' },
  { label: 'Ciel étoilé', href: '/ciel-etoile/' },
  { label: 'Phares', href: '/renovation-phares/' },
];

/** Home page. The tour chapters are matched to content/flight.js by id. */
export const home = {
  seo: {
    title: 'Vitres teintées, detailing & rénovation de phares en Indre-et-Loire | SOLAR CAR 37',
    description:
      "SOLAR CAR 37, atelier en Indre-et-Loire (37) : pose de films solaires homologués, feux arrière teintés, detailing et correction de peinture, ciel étoilé et rénovation de phares. Devis sur demande.",
  },
  tour: {
    label: 'Visite de l’atelier en vol continu',
    skip: 'Passer la visite',
    loading: 'Préparation du studio 3D',
    chapters: {
      hero: {
        kicker: 'Atelier automobile · Indre-et-Loire (37)',
        title: 'Vitres teintées, detailing et rénovation de phares en Indre-et-Loire',
        text: 'Films solaires, feux fumés, correction de peinture, ciel étoilé, optiques remises à neuf : entrez dans l’atelier SOLAR CAR 37 et suivez votre voiture, prestation par prestation.',
        ctas: [
          { label: 'Demander un devis', href: '/contact/', primary: true },
          { label: 'Voir les prestations', href: '#prestations' },
        ],
        side: 'left',
      },
      tint: {
        kicker: '01 — Vitres teintées',
        title: 'Des films solaires posés dans les règles',
        text: 'Intimité, confort thermique et protection UV, de 70 % à 5 % de lumière transmise. À l’avant, la loi impose au moins 70 % : nous vous en informons avant toute pose plus foncée.',
        readout: 'vlt',
        link: { label: 'Les vitres teintées', href: '/vitres-teintees/' },
        side: 'left',
      },
      tail: {
        kicker: '02 — Feux arrière teintés',
        title: 'Un regard plus sombre, des feux toujours lisibles',
        text: 'Film fumé découpé sur mesure, du voile léger au noir profond. Nous vous conseillons l’intensité adaptée et le cadre réglementaire avant toute pose.',
        link: { label: 'Les feux teintés', href: '/feux-arriere-teintes/' },
        side: 'right',
      },
      detailing: {
        kicker: '03 — Detailing carrosserie',
        title: 'Le brillant d’origine, panneau par panneau',
        text: 'Décontamination, polissage et correction des micro-rayures, puis protection : la ligne qui avance sépare la peinture terne de la peinture corrigée.',
        link: { label: 'Le detailing', href: '/detailing-carrosserie/' },
        side: 'left',
      },
      stars: {
        kicker: '04 — Ciel étoilé',
        title: 'Une nuit étoilée au-dessus de vos têtes',
        text: 'Des centaines de points de fibre optique intégrés au pavillon, une lumière douce et réglable : l’habitacle devient une nuit d’été.',
        link: { label: 'Le ciel étoilé', href: '/ciel-etoile/' },
        side: 'left',
      },
      headlights: {
        kicker: '05 — Rénovation de phares',
        title: 'Des optiques claires comme au premier jour',
        text: 'Ponçage, polissage et protection anti-UV : les phares jaunis retrouvent leur transparence et votre éclairage son efficacité.',
        readout: 'beforeAfter',
        link: { label: 'La rénovation de phares', href: '/renovation-phares/' },
        side: 'right',
      },
      final: {
        kicker: 'SOLAR CAR 37',
        title: 'Prenez rendez-vous à l’atelier',
        text: 'Décrivez votre véhicule et la prestation souhaitée : nous revenons vers vous avec un devis détaillé.',
        ctas: [{ label: 'Demander un devis', href: '/contact/', primary: true }],
        contact: true,
        side: 'left',
      },
    },
  },
  intro: {
    title: 'Un atelier, cinq savoir-faire',
    text: 'SOLAR CAR 37 réunit sous un même toit la pose de films solaires, la teinte des feux, le detailing de carrosserie, l’installation de ciels étoilés et la rénovation d’optiques. Chaque véhicule est traité au cas par cas, avec un devis clair avant toute intervention.',
  },
  process: {
    title: 'Comment se déroule une prestation',
    steps: [
      { title: 'Votre demande', text: 'Formulaire, téléphone ou message : décrivez le véhicule et la prestation souhaitée.' },
      { title: 'Devis détaillé', text: 'Nous vous conseillons (teinte, finition, réglementation) et chiffrons précisément.' },
      { title: 'Intervention à l’atelier', text: 'Le véhicule est pris en charge dans un espace propre et éclairé, dédié à ces travaux.' },
      { title: 'Restitution', text: 'Contrôle final avec vous et conseils d’entretien pour faire durer le résultat.' },
    ],
  },
  law: {
    title: 'Vitres teintées : ce que dit la loi',
    points: [
      'Depuis le 1er janvier 2017, le pare-brise et les vitres latérales avant doivent laisser passer au moins 70 % de la lumière (décret n° 2016-448 du 13 avril 2016).',
      'La lunette arrière et les vitres latérales arrière peuvent être teintées plus fortement.',
      'En cas d’infraction : amende forfaitaire de 135 € et retrait de 3 points sur le permis.',
      'Une dérogation existe pour raisons médicales, sur justificatif.',
    ],
    note: 'Toutes les teintes sont disponibles. Pour les vitres avant, une teinte inférieure à 70 % n’est posée qu’à la demande expresse du client, informé de la réglementation : elle relève de sa seule responsabilité.',
  },
  faq: [
    {
      q: 'Peut-on teinter les vitres avant de sa voiture ?',
      a: 'La réglementation impose depuis 2017 au moins 70 % de lumière transmise sur le pare-brise et les vitres avant, sauf dérogation médicale. Nous proposons toutes les teintes, y compris pour l’avant, mais une teinte plus foncée que 70 % y est posée à votre demande expresse et sous votre seule responsabilité : elle reste verbalisable sur la voie publique. Les vitres arrière et la lunette peuvent être teintées librement.',
    },
    {
      q: 'Combien de temps dure la pose de vitres teintées ?',
      a: 'Cela dépend du véhicule et du nombre de vitres. Nous vous indiquons la durée d’immobilisation au moment du devis.',
    },
    {
      q: 'Les feux arrière teintés sont-ils autorisés ?',
      a: 'Les feux doivent rester visibles et conformes à leur homologation. Nous vous expliquons les implications avant la pose et vous conseillons l’intensité de teinte adaptée à votre usage.',
    },
    {
      q: 'Qu’est-ce qu’une correction de peinture ?',
      a: 'C’est un polissage en une ou plusieurs étapes qui retire une fine couche de vernis pour effacer micro-rayures, hologrammes et ternissement. La peinture retrouve sa profondeur, puis on la protège.',
    },
    {
      q: 'Comment est installé un ciel étoilé ?',
      a: 'Le ciel de toit est déposé, des fibres optiques y sont insérées une à une puis reliées à un boîtier lumineux. L’intensité, voire la couleur et les effets, se règlent selon le kit choisi.',
    },
    {
      q: 'Pourquoi rénover des phares jaunis ?',
      a: 'Un phare opacifié diffuse moins de lumière : vous voyez moins bien et vous êtes moins bien vu. La rénovation retire la couche oxydée et protège l’optique contre les UV ; elle coûte bien moins qu’un remplacement.',
    },
  ],
  servicesTitle: 'Nos prestations',
  ctaBand: {
    title: 'Un projet pour votre véhicule ?',
    text: 'Dites-nous ce que vous souhaitez : nous vous répondons avec un devis détaillé.',
    cta: { label: 'Demander un devis', href: '/contact/' },
  },
};

/** Service pages. `still` refers to a chapter still rendered from the 3D tour. */
export const services = [
  {
    slug: 'vitres-teintees',
    chapter: 'tint',
    still: 'tint',
    name: 'Vitres teintées',
    short: 'Films solaires homologués : intimité, confort thermique et protection UV, dans le respect de la loi.',
    seo: {
      title: 'Vitres teintées et films solaires en Indre-et-Loire (37) | SOLAR CAR 37',
      description:
        'Pose de films solaires sur vitres de voiture en Indre-et-Loire : teintes de 5 % à 70 %, simulateur 3D avec prix en direct, conseil réglementaire et devis.',
    },
    h1: 'Vitres teintées et films solaires',
    intro:
      'Un film solaire de qualité change le quotidien à bord : moins de chaleur, moins d’éblouissement, des passagers et des objets à l’abri des regards, et une protection contre les UV. Chez SOLAR CAR 37, nous découpons et posons le film sur mesure, vitre par vitre, en respectant la réglementation française.',
    benefits: [
      { title: 'Intimité', text: 'Habitacle et bagages à l’abri des regards à l’arrière.' },
      { title: 'Confort thermique', text: 'Une partie de l’énergie solaire est réfléchie ou absorbée avant d’entrer.' },
      { title: 'Protection UV', text: 'Peau et sellerie mieux protégées du rayonnement.' },
      { title: 'Esthétique', text: 'Une ligne plus homogène, de la teinte légère au très sombre.' },
    ],
    steps: [
      'Choix de la teinte et vérification de la conformité avec vous',
      'Nettoyage et préparation minutieuse des vitrages',
      'Découpe et mise en forme du film sur mesure',
      'Pose, marouflage et contrôle final',
      'Conseils pour les jours qui suivent la pose (séchage, nettoyage)',
    ],
    law: [
      'Pare-brise et vitres latérales avant : 70 % de lumière transmise minimum depuis le 1er janvier 2017.',
      'Vitres latérales arrière et lunette : teinte plus forte possible.',
      'Sanction : 135 € d’amende et 3 points retirés ; dérogation possible pour raison médicale.',
    ],
    faq: [
      {
        q: 'Quelle teinte choisir pour l’arrière ?',
        a: 'Plus le pourcentage est bas, plus la vitre est sombre : 50 % reste léger, 20 % offre une bonne intimité, 5 % correspond à une teinte « limousine ». Nous vous montrons les échantillons avant la pose.',
      },
      {
        q: 'Un film clair à l’avant sert-il à quelque chose ?',
        a: 'Oui : certains films clairs conformes (70 % et plus) filtrent une partie de la chaleur et des UV sans assombrir la vitre.',
      },
      {
        q: 'Puis-je baisser mes vitres juste après la pose ?',
        a: 'Il faut laisser le film sécher quelques jours avant de manœuvrer les vitres. Nous vous donnons le délai exact selon le film et la saison.',
      },
    ],
  },
  {
    slug: 'feux-arriere-teintes',
    chapter: 'tail',
    still: 'tail',
    name: 'Feux arrière teintés',
    short: 'Film fumé sur mesure pour vos feux arrière, du voile léger au noir profond.',
    seo: {
      title: 'Feux arrière teintés et films fumés en Indre-et-Loire (37) | SOLAR CAR 37',
      description:
        'Teinte de feux arrière par film fumé découpé sur mesure en Indre-et-Loire : plusieurs intensités, pose soignée et conseil sur le cadre réglementaire. Devis sur demande.',
    },
    h1: 'Feux arrière teintés',
    intro:
      'Un film fumé sur les feux arrière donne immédiatement plus de caractère à l’arrière d’une voiture. Nous choisissons avec vous l’intensité, découpons le film à la forme exacte de vos optiques et le posons sans bulles ni débords.',
    benefits: [
      { title: 'Sur mesure', text: 'Découpe adaptée à la forme exacte de chaque optique.' },
      { title: 'Plusieurs intensités', text: 'Du voile léger qui harmonise au fumé profond.' },
      { title: 'Protection', text: 'Le film protège aussi l’optique des petites projections.' },
      { title: 'Réversible', text: 'Un film se dépose proprement si vous changez d’avis.' },
    ],
    steps: [
      'Choix de l’intensité et rappel du cadre réglementaire',
      'Nettoyage et dégraissage des optiques',
      'Découpe et thermoformage du film',
      'Pose, finition des bords et contrôle de l’allumage',
    ],
    law: [
      'Les feux doivent rester visibles et conformes à leur homologation : une teinte trop forte peut poser problème lors d’un contrôle.',
      'Nous vous expliquons les implications avant la pose et vous aidons à choisir une intensité adaptée à votre usage.',
    ],
    faq: [
      {
        q: 'Les feux restent-ils visibles ?',
        a: 'Plus le film est foncé, plus la lumière est atténuée. Nous vérifions l’allumage après la pose et vous déconseillons les teintes qui rendraient vos feux peu visibles.',
      },
      {
        q: 'Le film est-il réversible ?',
        a: 'Oui, il se retire proprement sans abîmer l’optique.',
      },
    ],
  },
  {
    slug: 'detailing-carrosserie',
    chapter: 'detailing',
    still: 'detailing',
    name: 'Detailing carrosserie',
    short: 'Décontamination, polissage, correction de peinture et protection : le brillant d’origine.',
    seo: {
      title: 'Detailing, polissage et correction de peinture en Indre-et-Loire (37) | SOLAR CAR 37',
      description:
        'Detailing automobile en Indre-et-Loire : lavage et décontamination, polissage et correction des micro-rayures, protection de la peinture. Résultat avant/après visible. Devis sur demande.',
    },
    h1: 'Detailing et correction de peinture',
    intro:
      'Avec le temps et les lavages, le vernis se couvre de micro-rayures et d’hologrammes qui ternissent la teinte. Le detailing consiste à nettoyer en profondeur, corriger ces défauts par polissage, puis protéger la peinture pour qu’elle garde sa profondeur.',
    benefits: [
      { title: 'Décontamination', text: 'Retrait des particules incrustées que le lavage ne retire pas.' },
      { title: 'Correction', text: 'Polissage en une ou plusieurs étapes contre micro-rayures et hologrammes.' },
      { title: 'Protection', text: 'Une couche protectrice adaptée à votre usage et à vos attentes.' },
      { title: 'Finitions', text: 'Jantes, plastiques, joints et vitrages traités avec le même soin.' },
    ],
    steps: [
      'Inspection de la peinture sous éclairage et mesure des défauts',
      'Lavage manuel et décontamination',
      'Polissage / correction panneau par panneau',
      'Protection de la peinture',
      'Contrôle final et conseils de lavage',
    ],
    law: null,
    faq: [
      {
        q: 'Le polissage abîme-t-il le vernis ?',
        a: 'Une correction retire une très fine épaisseur de vernis. C’est pour cela qu’elle se fait avec méthode, après inspection, et sans excès.',
      },
      {
        q: 'Combien de temps dure le résultat ?',
        a: 'Cela dépend de la protection appliquée et de la façon dont la voiture est lavée ensuite. Nous vous donnons des conseils d’entretien à la restitution.',
      },
    ],
  },
  {
    slug: 'ciel-etoile',
    chapter: 'stars',
    still: 'stars',
    name: 'Ciel étoilé',
    short: 'Ciel de toit en fibre optique : une nuit étoilée au-dessus de vos têtes.',
    seo: {
      title: 'Ciel étoilé voiture (starlight) en Indre-et-Loire (37) | SOLAR CAR 37',
      description:
        'Installation de ciel étoilé en fibre optique dans le pavillon de votre voiture, en Indre-et-Loire : lumière réglable, pose soignée. Devis selon le véhicule et le kit choisi.',
    },
    h1: 'Ciel étoilé en fibre optique',
    intro:
      'Popularisé par les berlines de prestige, le ciel étoilé transforme l’habitacle : des centaines de points lumineux dispersés dans le pavillon créent une ambiance de nuit d’été, douce et apaisante.',
    benefits: [
      { title: 'Ambiance', text: 'Une lumière d’ambiance douce qui ne gêne pas la conduite.' },
      { title: 'Personnalisation', text: 'Densité des étoiles, intensité et effets selon le kit choisi.' },
      { title: 'Intégration', text: 'Fibres insérées dans le ciel de toit, boîtier dissimulé.' },
      { title: 'Valorisation', text: 'Un détail qui marque à chaque trajet de nuit.' },
    ],
    steps: [
      'Choix du kit, de la densité et des effets',
      'Dépose du ciel de toit',
      'Perçage et insertion des fibres une à une',
      'Raccordement du boîtier lumineux et repose',
      'Essais et réglages avec vous',
    ],
    law: null,
    faq: [
      {
        q: 'Le ciel étoilé est-il compatible avec un toit ouvrant ?',
        a: 'Cela dépend du véhicule : nous étudions la configuration du pavillon au moment du devis.',
      },
      {
        q: 'Peut-on régler la luminosité ?',
        a: 'Oui, l’intensité se règle, et selon le kit, la couleur et certains effets aussi.',
      },
    ],
  },
  {
    slug: 'renovation-phares',
    chapter: 'headlights',
    still: 'headlights',
    name: 'Rénovation de phares',
    short: 'Phares jaunis ou ternes : ponçage, polissage et protection anti-UV.',
    seo: {
      title: 'Rénovation de phares jaunis et opaques en Indre-et-Loire (37) | SOLAR CAR 37',
      description:
        'Rénovation d’optiques de phares jaunies ou opaques en Indre-et-Loire : ponçage, polissage et protection anti-UV pour retrouver transparence et efficacité d’éclairage. Devis.',
    },
    h1: 'Rénovation de phares',
    intro:
      'Les optiques en polycarbonate jaunissent et s’opacifient avec les UV et les années. Résultat : un éclairage moins efficace et une voiture qui paraît plus âgée qu’elle ne l’est. La rénovation retire la couche abîmée et protège l’optique.',
    benefits: [
      { title: 'Sécurité', text: 'Un faisceau plus net : vous voyez mieux et êtes mieux vu.' },
      { title: 'Esthétique', text: 'Des optiques claires qui rajeunissent toute la face avant.' },
      { title: 'Protection', text: 'Une protection anti-UV pour ralentir le retour du jaunissement.' },
      { title: 'Économie', text: 'Bien moins coûteux que le remplacement des blocs optiques.' },
    ],
    steps: [
      'Protection de la carrosserie autour des optiques',
      'Ponçage progressif de la couche oxydée',
      'Polissage jusqu’à la transparence',
      'Application d’une protection anti-UV',
    ],
    law: [
      'Des optiques très opacifiées réduisent l’efficacité de l’éclairage et peuvent être signalées lors du contrôle technique.',
    ],
    faq: [
      {
        q: 'Combien de temps tient une rénovation ?',
        a: 'La durée dépend de l’exposition au soleil et de l’entretien ; la protection anti-UV appliquée en fin de rénovation la prolonge.',
      },
      {
        q: 'Faut-il démonter les phares ?',
        a: 'Dans la plupart des cas, non : la rénovation se fait optiques en place, la carrosserie autour étant protégée.',
      },
    ],
  },
];

export const contactPage = {
  seo: {
    title: 'Contact et devis | SOLAR CAR 37 — Indre-et-Loire (37)',
    description:
      'Demandez un devis à SOLAR CAR 37 pour vos vitres teintées, feux teintés, detailing, ciel étoilé ou rénovation de phares en Indre-et-Loire.',
  },
  h1: 'Demander un devis',
  intro: 'Décrivez votre véhicule et la prestation souhaitée. Nous revenons vers vous avec un devis détaillé.',
};

export const legalPage = {
  seo: {
    title: 'Mentions légales et confidentialité | SOLAR CAR 37',
    description: 'Mentions légales, hébergement et politique de confidentialité du site SOLAR CAR 37.',
  },
  // Host details are required by French law (LCEN). Fill in once the hosting is chosen.
  host: { name: null, address: null, phone: null },
  publisher: null, // directeur de la publication
};
