/**
 * SOLAR CAR 37 — all business copy, contact details and SEO settings.
 *
 * Fields set to null are unknown and are simply not rendered (and kept out of the
 * structured data) until you fill them in. Never invent them: search engines and customers
 * rely on them. Run `npm run check` to list what is still missing.
 */

import { priceText as P } from './pricing.js';
import { glazing as G } from './regulation.js';

export const business = {
  name: 'SOLAR CAR 37',
  // Used for canonical URLs, sitemap and social cards. The domain comes back from local.fr at
  // the end of the year; until then the preview runs on GitHub Pages (noindex).
  siteUrl: 'https://www.solarcar37.fr',
  tagline: 'Vitres teintées, detailing & lumière automobile',
  department: 'Indre-et-Loire',
  departmentCode: '37',
  region: 'Centre-Val de Loire',
  // Legal status: SOLAR CAR 37 is the trade name of an individual entrepreneur (EI,
  // micro-entreprise). The law asks for the name followed by "EI" on documents.
  legalName: 'Nicolas MALAGA EI',
  legalForm: 'Entrepreneur individuel (EI) — micro-entreprise',
  owner: 'Nicolas MALAGA',
  phone: '06 12 04 57 00',
  email: 'contact@solarcar37.fr',
  emailAlt: null, // a second address to display (none: only contact@ is public)
  address: {
    street: '395 rue des Entrepreneurs',
    postalCode: '37210',
    city: 'Vouvray',
  },
  // GPS point of the workshop: the national address point (BAN) of 395 rue des Entrepreneurs,
  // ZA de l'Étang Vignon (same point as the 3D map, scripts/map/common.py).
  geo: { lat: 47.436104, lng: 0.797154 },
  // Opening hours (schema.org form). Displayed as "Lundi au vendredi, 8 h – 12 h et 13 h – 17 h".
  openingHours: [
    { days: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'], opens: '08:00', closes: '12:00' },
    { days: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'], opens: '13:00', closes: '17:00' },
  ],
  hoursText: 'Du lundi au vendredi, de 8 h à 12 h et de 13 h à 17 h',
  social: {
    instagram: 'https://www.instagram.com/solarcar37/',
    tiktok: 'https://www.tiktok.com/@solarcar37',
    facebook: null,
  },
  // Google: the business profile. Paste the share link of your Google profile (Maps > Partager)
  // in `profileUrl` and, if you have it, the review link (Profil > Demander des avis) in
  // `reviewUrl`. Until then the buttons open a Google Maps search for the workshop.
  google: {
    profileUrl: null,
    reviewUrl: null,
    // Live reviews (the latest Google gives, up to 5, refreshed on every visit). Needs the
    // Place ID of the profile (Google "Place ID Finder") and a Maps JavaScript API key with
    // the Places API (New) enabled, restricted to the site's domain (HTTP referrers).
    placeId: null,
    mapsApiKey: null,
  },
  // Instagram: the latest posts (5) on the home page, refreshed by the feed service. Instagram
  // no longer offers a public feed: connect the account to a feed service (e.g. Behold,
  // behold.so, "JSON feed") and paste the feed URL in `feedUrl`. Until then the block links to
  // the profile. Also reads a JSON shaped like the Instagram API answer ({ data: [...] }).
  instagramFeed: { feedUrl: null, count: 5 },
  // Towns close to the workshop, quoted in the "Accès" section (real places, no doorway pages).
  nearby: ['Tours', 'Rochecorbon', 'Vernou-sur-Brenne', 'Montlouis-sur-Loire', 'Saint-Pierre-des-Corps', 'Parçay-Meslay', 'Monnaie', 'Saint-Cyr-sur-Loire', 'Amboise'],
  siret: '890 162 761 00039',
  priceRange: '€€',
  // Where the contact form posts. FormSubmit (formsubmit.co, free, no account) forwards each
  // request by e-mail to the address in the URL; the very first request sends an "Activate
  // Form" e-mail to that address, to click once. After activation FormSubmit e-mails a random
  // alias: it can replace the address below. When null the form opens the visitor's e-mail app.
  formEndpoint: 'https://formsubmit.co/contact@solarcar37.fr',
};

// Header menu. `services: true` = a "Nos prestations" drop-down listing the service pages.
export const nav = [
  { label: 'Nos prestations', services: true },
  { label: 'L’atelier', href: '/atelier-vouvray/' },
  { label: 'Guides', href: '/guides/' },
  { label: 'Contact', href: '/contact/' },
];

/** Home page. The tour chapters are matched to content/flight.js by id. */
export const home = {
  seo: {
    title: 'Vitres teintées & detailing à Vouvray, près de Tours | SOLAR CAR 37',
    description:
      `Atelier SOLAR CAR 37 à Vouvray, près de Tours : vitres teintées dès ${P.tintFrom} TTC, feux fumés, phares ${P.headlights} la paire, detailing, céramique, ciel étoilé. Simulateurs 3D.`,
  },
  tour: {
    label: 'Visite de l’atelier en vol continu',
    skip: 'Passer la visite',
    loading: 'Préparation du studio 3D',
    chapters: {
      hero: {
        kicker: 'Atelier automobile · Vouvray, près de Tours (37)',
        title: 'Vitres teintées, detailing et rénovation de phares à Vouvray, près de Tours',
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
        text: 'Intimité, confort thermique et protection UV, de 70 % à 5 % de lumière transmise. À l’avant, la loi impose au moins 70 % de lumière, vitre et film compris : nous faisons le point avec vous, zone par zone.',
        readout: 'vlt',
        link: { label: 'Découvrir les vitres teintées', href: '/vitres-teintees/' },
        side: 'left',
      },
      tail: {
        kicker: '02 — Feux arrière teintés',
        title: 'Un regard plus sombre, des feux toujours lisibles',
        text: 'Film fumé découpé sur mesure, du voile léger au noir profond. Nous vous conseillons l’intensité adaptée et le cadre réglementaire avant toute pose.',
        link: { label: 'Découvrir les feux teintés', href: '/feux-arriere-teintes/' },
        side: 'right',
      },
      detailing: {
        kicker: '03 — Detailing carrosserie',
        title: 'Le brillant d’origine, panneau par panneau',
        text: 'Décontamination, polissage et correction des micro-rayures, puis protection : la ligne qui avance sépare la peinture terne de la peinture corrigée.',
        link: { label: 'Découvrir le detailing', href: '/detailing-carrosserie/' },
        side: 'left',
      },
      stars: {
        kicker: '04 — Ciel étoilé',
        title: 'Une nuit étoilée au-dessus de vos têtes',
        text: 'Des centaines de points de fibre optique intégrés au pavillon, une lumière douce et réglable : l’habitacle devient une nuit d’été.',
        link: { label: 'Découvrir le ciel étoilé', href: '/ciel-etoile/' },
        side: 'left',
      },
      headlights: {
        kicker: '05 — Rénovation de phares',
        title: 'Des optiques claires comme au premier jour',
        text: 'Ponçage, polissage et protection anti-UV : les phares jaunis retrouvent leur transparence et votre éclairage son efficacité.',
        readout: 'beforeAfter',
        link: { label: 'Découvrir la rénovation de phares', href: '/renovation-phares/' },
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
      `Depuis le ${G.since}, le pare-brise et les vitres latérales avant doivent laisser passer au moins ${G.frontMin} % de la lumière, mesurés sur la vitre et son film ensemble (${G.decree}).`,
      'Une vitre d’origine ne laisse déjà pas passer toute la lumière : un film annoncé à 70 % fait en général descendre l’ensemble sous ce seuil.',
      'La lunette arrière et les vitres latérales arrière peuvent être teintées plus fortement (véhicule équipé de deux rétroviseurs extérieurs).',
      `En cas d’infraction : amende forfaitaire de ${G.fine} €, retrait de ${G.points} points et immobilisation possible du véhicule.`,
      'Dérogations limitées : véhicules blindés homologués et transport d’une personne atteinte d’une affection listée par l’arrêté du 18 octobre 2016.',
    ],
    note: 'Toutes les teintes sont disponibles pour l’arrière. Pour l’avant, l’accord du client ne remplace pas la règle des 70 % : nous vous conseillons une configuration adaptée à la route.',
  },
  faq: [
    {
      q: 'Peut-on teinter les vitres avant de sa voiture ?',
      a: `Depuis 2017, le pare-brise et les vitres avant doivent laisser passer au moins ${G.frontMin} % de la lumière, film compris : un film annoncé à 70 % fait en général passer l’ensemble sous ce seuil. Les vitres arrière et la lunette peuvent être teintées librement. L’accord du client ne remplace pas la règle : nous vous conseillons une configuration adaptée à la route.`,
    },
    {
      q: 'Combien de temps dure la pose de vitres teintées ?',
      a: 'Cela dépend du véhicule et du nombre de vitres. Nous vous indiquons la durée d’immobilisation au moment du devis.',
    },
    {
      q: 'Les feux arrière teintés sont-ils autorisés ?',
      a: 'Les feux sont homologués : un film modifie la lumière qu’ils émettent et peut les rendre non conformes pour circuler sur la voie publique, surtout à l’avant. Nous vous expliquons le cadre avant la pose et vous conseillons une intensité adaptée à votre usage.',
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
    short: 'Films solaires posés sur mesure : intimité, confort thermique et protection UV, avec un conseil clair sur la réglementation.',
    seo: {
      title: `Vitres teintées à Vouvray (Tours) dès ${P.tintFrom} TTC | SOLAR CAR 37`,
      description:
        `Films solaires posés à Vouvray, près de Tours : 3/4 arrière dès ${P.tintFrom} TTC, teintes de 5 à 70 %, simulateur 3D avec prix en direct et conseil sur la loi.`,
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
      'Choix de la teinte et point sur la réglementation, zone par zone',
      'Nettoyage et préparation minutieuse des vitrages',
      'Découpe et mise en forme du film sur mesure',
      'Pose, marouflage et contrôle final',
      'Conseils pour les jours qui suivent la pose (séchage, nettoyage)',
    ],
    law: [
      `Pare-brise et vitres latérales avant : ${G.frontMin} % de lumière transmise minimum depuis le ${G.since}, mesurés sur la vitre et son film ensemble.`,
      'Un film annoncé à 70 % ne suffit donc pas à rester conforme : posé sur une vitre d’origine, l’ensemble descend en général autour de 60 %.',
      'Vitres latérales arrière et lunette : teinte plus forte possible.',
      `Sanction : ${G.fine} € d’amende, ${G.points} points retirés, immobilisation possible ; dérogations limitées (véhicules blindés homologués, affections listées par l’arrêté du 18 octobre 2016).`,
    ],
    faq: [
      {
        q: 'Quelle teinte choisir pour l’arrière ?',
        a: 'Plus le pourcentage est bas, plus la vitre est sombre : 50 % reste léger, 20 % offre une bonne intimité, 5 % correspond à une teinte « limousine ». Nous vous montrons les échantillons avant la pose.',
      },
      {
        q: 'Un film clair à l’avant sert-il à quelque chose ?',
        a: `Un film très clair filtre une partie de la chaleur et des UV sans assombrir la vitre. À l’avant, c’est la transmission du vitrage complet (vitre + film) qui doit rester d’au moins ${G.frontMin} % : elle se vérifie sur le véhicule.`,
      },
      {
        q: 'Peut-on poser un film sur le pare-brise ?',
        a: `Techniquement oui (film athermique ${P.windshield('athermique')} TTC, film irisé ${P.windshield('irise')} TTC), mais le pare-brise doit laisser passer au moins ${G.frontMin} % de la lumière, film compris. Un film annoncé à 70 % posé sur un pare-brise d’origine donne en général moins que ce seuil : la conformité dépend du film et du vitrage, et ne peut pas être promise sans mesure. Un film plus foncé n’est pas autorisé sur route. Le film irisé (effet caméléon bleu-violet, jaune doré ou rouge) réduit lui aussi la transmission : sa référence et sa transmission figurent sur le devis.`,
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
      title: `Feux teintés à Vouvray (Tours) : ${P.lightsPair} la paire | SOLAR CAR 37`,
      description:
        `Covering fumé 50 % ou 80 % ou PPF teinté sur vos feux, posé à Vouvray près de Tours : covering ${P.lightsPair} TTC la paire. Simulateur 3D feux allumés et au freinage.`,
    },
    h1: 'Feux arrière teintés',
    intro:
      'Un film fumé sur les feux arrière donne immédiatement plus de caractère à l’arrière d’une voiture. Nous choisissons avec vous l’intensité, découpons le film à la forme exacte de vos optiques et le posons sans bulles ni débords.',
    benefits: [
      { title: 'Sur mesure', text: 'Découpe adaptée à la forme exacte de chaque optique.' },
      { title: 'Plusieurs intensités', text: 'Du voile léger qui harmonise au fumé profond.' },
      { title: 'Deux matériaux', text: 'Covering vinyle fumé ou PPF teinté, plus épais : nous vous expliquons la différence.' },
      { title: 'Réversible', text: 'Un film se dépose proprement si vous changez d’avis.' },
    ],
    steps: [
      'Choix de l’intensité et rappel du cadre réglementaire',
      'Nettoyage et dégraissage des optiques',
      'Découpe et thermoformage du film',
      'Pose, finition des bords et contrôle de l’allumage',
    ],
    law: [
      'Les feux sont des dispositifs homologués : un film modifie la lumière émise et peut les rendre non conformes pour circuler sur la voie publique, surtout à l’avant.',
      'Un feu filmé peut être relevé au contrôle technique ou lors d’un contrôle routier. Nous vous expliquons ce cadre avant la pose ; la simulation 3D montre un rendu, elle ne prouve pas la conformité.',
    ],
    faq: [
      {
        q: 'Les feux restent-ils visibles ?',
        a: 'Plus le film est foncé, plus la lumière est atténuée. Nous vérifions l’allumage après la pose et vous déconseillons les teintes qui rendraient vos feux peu visibles.',
      },
      {
        q: 'Le film est-il réversible ?',
        a: 'Un film de qualité se retire en principe sans abîmer l’optique ; nous vous indiquons les précautions selon le matériau posé.',
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
      title: 'Detailing, polissage, céramique à Vouvray (Tours) | SOLAR CAR 37',
      description:
        'Detailing à Vouvray, près de Tours : lavage, décontamination, polissage anti micro-rayures et hologrammes, protection céramique. Forfaits sur devis.',
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
      title: 'Ciel étoilé voiture à Vouvray, près de Tours | SOLAR CAR 37',
      description:
        'Ciel étoilé en fibre optique posé à Vouvray, près de Tours : densité, bicolore, scintillement, étoiles filantes, constellation. Configurateur 3D et devis.',
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
      title: `Rénovation de phares à Vouvray (Tours) : ${P.headlights} la paire | SOLAR CAR 37`,
      description:
        `Phares jaunis ou opaques : ponçage, polissage et protection à Vouvray (37), près de Tours. Rénovation des deux phares ${P.headlights} TTC, céramique ${P.headlightsCeramic}. Avant/après en 3D.`,
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

/** Local page: where the workshop is, how to get there, opening hours. */
export const atelierPage = {
  seo: {
    title: 'Atelier SOLAR CAR 37 à Vouvray : accès, horaires, itinéraire',
    description:
      'SOLAR CAR 37, 395 rue des Entrepreneurs, 37210 Vouvray, à 10 km de Tours. Ouvert du lundi au vendredi, 8 h – 12 h et 13 h – 17 h. Carte et itinéraire.',
  },
  kicker: 'L’atelier',
  h1: 'Votre atelier de vitres teintées et de detailing à Vouvray, près de Tours',
  intro:
    'SOLAR CAR 37 vous accueille dans son atelier de Vouvray, à une dizaine de kilomètres de Tours : un espace dédié à la pose de films solaires, au detailing et à la personnalisation de votre véhicule.',
  access:
    'Facile d’accès depuis Tours et l’est de l’agglomération, l’atelier reçoit les conducteurs de toute la Touraine. Pour être sûr d’être accueilli dans les meilleures conditions, appelez-nous ou envoyez votre demande avant de passer : nous convenons ensemble d’un créneau.',
  faq: [
    {
      q: 'Où se trouve l’atelier SOLAR CAR 37 ?',
      a: 'Au 395 rue des Entrepreneurs, 37210 Vouvray (Indre-et-Loire), à une dizaine de kilomètres de Tours.',
    },
    {
      q: 'Quels sont vos horaires d’ouverture ?',
      a: 'Du lundi au vendredi, de 8 h à 12 h et de 13 h à 17 h.',
    },
    {
      q: 'Faut-il prendre rendez-vous ?',
      a: 'Oui, de préférence : appelez le 06 12 04 57 00 ou envoyez votre demande de devis, nous fixons ensemble la date de prise en charge du véhicule.',
    },
  ],
};

/** Google reviews: links only — no rating or review is ever displayed without coming from Google. */
// Partner brands (as given by SOLAR CAR 37). Shown as wordmarks in the site's style; a `logo`
// (single-colour SVG or PNG on a transparent background, in public/img/partners/) is shown
// instead, painted in the site's gold. 3M: logo from the Simple Icons set (CC0 drawing).
export const partners = {
  title: 'Nos marques partenaires',
  text: 'Films, outillage et produits professionnels : nous travaillons avec des marques reconnues, choisies pour leur qualité et leur tenue dans le temps.',
  brands: [
    { name: 'Milwaukee', logo: null },
    { name: 'TeckWrap', logo: null },
    { name: 'RUPES', logo: null },
    { name: '3M', logo: '/img/partners/3m.svg' },
    { name: 'Solar Screen', logo: null },
    { name: 'Tego', logo: null },
    { name: 'Coverstyl’', logo: null },
    { name: 'STEK', logo: null },
    { name: 'Protector', logo: null },
  ],
};

export const reviews = {
  title: 'Votre avis compte',
  text: 'Vous êtes venu à l’atelier ? Partagez votre expérience sur Google : votre avis aide d’autres conducteurs de Touraine à nous trouver. Et pour vous faire une idée avant de venir, lisez les avis de nos clients.',
};

export const contactPage = {
  seo: {
    title: 'Contact et devis — atelier de Vouvray, près de Tours | SOLAR CAR 37',
    description:
      'Devis vitres teintées, feux fumés, detailing, ciel étoilé, phares : 06 12 04 57 00 ou contact@solarcar37.fr. Atelier au 395 rue des Entrepreneurs, Vouvray.',
  },
  h1: 'Demander un devis',
  intro: 'Décrivez votre véhicule et la prestation souhaitée. Nous revenons vers vous avec un devis détaillé.',
};

export const legalPage = {
  seo: {
    title: 'Mentions légales et confidentialité | SOLAR CAR 37',
    description: 'Mentions légales, hébergement et politique de confidentialité du site SOLAR CAR 37.',
  },
  // Host details are required by French law (LCEN). The site is published with GitHub Pages;
  // change this if it moves to another host.
  host: { name: 'GitHub, Inc. (GitHub Pages)', address: '88 Colin P. Kelly Jr. Street, San Francisco, CA 94107, États-Unis', phone: null },
  publisher: 'Nicolas MALAGA', // directeur de la publication
  // Consumer mediator (mandatory for services sold to private customers, Code de la consommation
  // L612-1): { name, url, address }. Unknown for now: the page shows « à compléter ».
  mediator: null,
  // How long quote requests are kept, e.g. '3 ans après le dernier contact'. Until it is set,
  // the page states the criterion (the time needed to answer and follow up the request).
  retention: null,
};
