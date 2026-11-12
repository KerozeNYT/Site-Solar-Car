/**
 * Déchromage: the whole service page /dechromage/ (`page`, same shape as a service of
 * content/site.js) and its long-form sections (`sections`, rendered by `richSections` in
 * src/templates/pages.js). The covering itself lives on /covering-dechromage/.
 *
 * Everything reads « Sur devis ». Nothing here may promise a warranty, a lifespan or a duration
 * of the workshop's own work (« selon le véhicule, confirmé au devis »). Exhaust tips are not
 * wrapped with film (too hot for an adhesive film): the copy says so and stops there.
 *
 * FAQ answers are plain text (no *emphasis*, no links): faqBlock escapes them.
 */

export const page = {
  slug: 'dechromage',
  shortName: 'Déchromage',
  tagline: 'Les chromes passent au noir',
  name: 'Déchromage',
  short: 'Chromes de calandre, entourages de vitres, baguettes et logos habillés de film noir brillant, satiné, mat ou carbone.',
  seo: {
    title: 'Déchromage voiture près de Tours (Vouvray) | SOLAR CAR 37',
    description:
      'Déchromage à Vouvray, près de Tours : calandre, entourages de vitres, baguettes et logos chromés passés au noir brillant, satiné ou mat. Réversible, sur devis.',
  },
  h1: 'Déchromage voiture *près de Tours*',
  intro:
    'Le déchromage habille de film les pièces chromées de votre véhicule : calandre, entourages de vitres, baguettes, logos. Elles passent au noir brillant, satiné ou mat, en carbone ou dans une autre teinte, sans peinture ni pièce neuve, et le chrome d’origine reste intact dessous. La pose se fait à l’atelier de Vouvray, en Indre-et-Loire, sur rendez-vous.',
  benefits: [
    { title: 'Réversible', text: 'Le chrome d’origine reste sous le film : un professionnel peut le retirer le jour où vous voulez revenir en arrière.' },
    { title: 'Une ligne plus sobre', text: 'Sans reflets brillants, la face avant et le profil paraissent plus homogènes, souvent plus sportifs.' },
    { title: 'Pièce par pièce', text: 'Calandre seule, entourages de vitres, logos ou l’ensemble : vous choisissez les éléments concernés.' },
    { title: 'Sans pièces neuves', text: 'Ni commande de pièces noires, ni peinture : les éléments d’origine sont simplement habillés.' },
  ],
  steps: [
    'Repérage des pièces réellement chromées et choix de la finition sur nuancier',
    'Nettoyage et dégraissage soigné des chromes et de leurs joints',
    'Dépose des éléments qui doivent l’être, selon le véhicule : calandre, logos…',
    'Découpe du film, pose et rentrés des bords derrière la pièce quand c’est possible',
    'Chauffe des bords et des zones étirées pour fixer le film',
    'Remontage, contrôle de chaque bord et conseils d’entretien',
  ],
  faq: [
    {
      q: 'Déchromage, chrome delete, black pack : est-ce la même chose ?',
      a: 'Oui, ces mots désignent le même principe. « Chrome delete » est l’expression anglaise ; « black pack » ou « pack noir » reprend le nom des finitions que certains constructeurs proposent d’usine, avec des pièces noires à la place des chromes. Ici, l’effet est obtenu avec un film posé sur les pièces existantes.',
    },
    {
      q: 'Quelles pièces peut-on déchromer ?',
      a: 'Le plus souvent : l’entourage ou les lamelles de calandre, les entourages de vitres, les baguettes de portes et de pare-chocs, les logos et monogrammes, les coques de rétroviseurs, les inserts de diffuseur et les barres de toit. Tout dépend de la forme de chaque pièce et de son état : nous les examinons avec vous, sur le véhicule, avant d’établir le devis.',
    },
    {
      q: 'Peut-on déchromer les sorties d’échappement ?',
      a: 'Pas avec un film. Un embout d’échappement chauffe bien au-delà de ce qu’un film adhésif peut supporter : il finirait par se décoller ou brûler. Pour des sorties noires, il faut se tourner vers d’autres solutions que le film.',
    },
    {
      q: 'Le film abîme-t-il le chrome d’origine ?',
      a: 'Sur un chrome sain, non : le film le recouvre et le met même à l’abri des petites agressions. La dépose, faite à chaud par un professionnel, laisse en principe la pièce propre. Un chrome déjà piqué, écaillé ou qui se décolle est plus délicat : le film y accroche mal et la dépose peut arracher une partie du revêtement. Nous vérifions l’état des pièces avant la pose.',
    },
    {
      q: 'Combien de temps tient un déchromage ?',
      a: 'Cela dépend du film, de l’exposition et de l’entretien. Les fabricants indiquent une durabilité dans leurs fiches techniques ; c’est leur valeur annoncée, pas un engagement de l’atelier. Sur un déchromage, le point sensible reste les bords : un lavage attentif autour des entourages et des baguettes pèse beaucoup dans la tenue.',
    },
    {
      q: 'Peut-on choisir une autre couleur que le noir ?',
      a: 'Oui. Le noir brillant, satiné ou mat reste le choix classique, mais les pièces peuvent aussi passer en carbone, dans une teinte proche de la carrosserie ou dans une couleur franche en contraste. Les nuanciers de toutes les marques que nous posons sont consultables à l’atelier.',
    },
    {
      q: 'Faut-il démonter les pièces ?',
      a: 'Pas toujours. Les entourages de vitres et les baguettes se traitent souvent en place, le film étant arrêté proprement contre les joints. Une calandre, des lamelles ou certains logos se déposent plus volontiers, pour que le film s’enroule derrière la pièce. La décision se prend pièce par pièce, selon le véhicule.',
    },
    {
      q: 'Le film se voit-il de près ?',
      a: 'Sur une pièce bien préparée, il suit la forme et les arêtes, et la plupart des regards n’y voient qu’une pièce noire. De très près, un œil averti peut deviner un bord ou la texture du film, surtout sur un entourage laissé en place. C’est pour cela que chaque bord est contrôlé avant la restitution.',
    },
    {
      q: 'Peut-on combiner le déchromage avec un covering ou des vitres teintées ?',
      a: 'Oui, et c’est souvent plus simple : les pièces déjà démontées pour un covering se déchroment dans la foulée, et un même rendez-vous peut aussi inclure la pose de vitres teintées arrière. L’ensemble figure sur un seul devis.',
    },
    {
      q: 'Comment obtenir un devis de déchromage ?',
      a: 'Indiquez-nous le modèle de la voiture et son année, joignez quelques photos des pièces chromées et précisez la finition qui vous tente, par le formulaire de devis ou par téléphone. Le prix dépend du nombre de pièces, de leur forme et des démontages : il est fixé sur devis, une fois le véhicule vu.',
    },
  ],
};

export const sections = [
  {
    type: 'prose',
    id: 'principe-dechromage',
    kicker: 'Chrome delete',
    title: 'Le déchromage, *qu’est-ce que c’est*',
    text: [
      'Calandre cerclée de chrome, entourages de vitres brillants, baguettes sur les portières : beaucoup de voitures sortent d’usine avec des pièces chromées. Le déchromage, aussi appelé chrome delete ou black pack, consiste à les habiller d’un film adhésif, le plus souvent noir, pour une ligne plus sobre et plus homogène.',
      'Ce n’est ni une peinture ni un remplacement : la pièce d’origine reste en place, recouverte d’un film qui pourra être retiré. Des baguettes chromées passées au noir s’accordent avec des vitres teintées, une carrosserie foncée ou des jantes noires ; sur une teinte claire, elles créent au contraire un contraste net.',
      'Tout ce qui brille n’est pas forcément chromé : certaines pièces sont en aluminium poli ou anodisé, d’autres en plastique métallisé. Le film s’y pose aussi, à condition que la surface soit saine. Sur certains modèles, des entourages anodisés se tachent ou blanchissent au fil des lavages : un film masque ces marques, sans pour autant les réparer.',
    ],
  },
  {
    type: 'blocks',
    id: 'pieces-dechromage',
    title: 'Les pièces que l’on déchrome *le plus souvent*',
    lead: 'Chaque véhicule a ses propres chromes. Voici les éléments les plus courants, et ce qu’il faut savoir pour chacun avant de se lancer.',
    items: [
      {
        title: 'Calandre et entourage de calandre',
        text: [
          'Le cadre chromé de la calandre, et parfois ses lamelles, est la pièce la plus visible de la face avant. Selon le véhicule, la calandre se dépose pour que le film soit enroulé derrière chaque bord.',
          'Certains logos et certaines calandres cachent un capteur radar (régulateur adaptatif, freinage d’urgence). Les notices demandent en général de ne rien coller sur la zone du capteur : elle reste telle quelle.',
        ],
      },
      {
        title: 'Entourages de vitres et baguettes',
        text: ['Les entourages de vitres latérales et les baguettes de portes ou de pare-chocs dessinent la ligne de chrome du profil. Fins et longs, ils demandent une découpe précise et un film arrêté proprement contre les joints.'],
      },
      {
        title: 'Logos et monogrammes',
        text: ['Logos et lettres de modèle se déchroment quand leur relief le permet. Les plus fins ou les plus découpés sont parfois déposés pour être habillés à plat, puis remis en place.'],
      },
      {
        title: 'Rétroviseurs, poignées, barres de toit',
        text: ['Coques de rétroviseurs, poignées de portes et barres de toit chromées complètent souvent l’ensemble. Ce sont des pièces très manipulées ou très exposées : le choix du film et le soin apporté aux bords y comptent particulièrement.'],
      },
      {
        title: 'Diffuseur et inserts de bouclier',
        text: ['Les inserts chromés d’un diffuseur arrière ou d’un bouclier avant passent volontiers au noir brillant ou au carbone, pour une poupe plus sportive.'],
      },
      {
        title: 'Sorties d’échappement : à part',
        text: ['Les embouts d’échappement montent à des températures qu’un film de covering n’est pas conçu pour supporter : ils ne se déchroment pas au film. Des sorties noires passent par des pièces de remplacement ou un revêtement résistant à la chaleur, ce qui relève d’un autre métier.'],
      },
    ],
  },
  {
    type: 'blocks',
    id: 'finitions-dechromage',
    title: 'Noir brillant, satiné, mat ou carbone : *quelle finition choisir*',
    lead: 'Le choix dépend de la teinte de la carrosserie, des autres pièces noires du véhicule et de l’entretien que vous comptez y consacrer. Les échantillons se comparent directement contre la pièce, à l’atelier.',
    items: [
      {
        title: 'Noir brillant',
        text: ['Le plus proche des finitions noir laqué proposées d’usine. Il s’accorde avec les vitres teintées et les plastiques noirs brillants, mais montre les traces de lavage comme un vernis.'],
      },
      {
        title: 'Noir satiné',
        text: ['Plus discret, il adoucit les reflets sans les éteindre. C’est un bon compromis sur une carrosserie mate ou satinée, ou quand les joints et plastiques voisins sont eux-mêmes satinés.'],
      },
      {
        title: 'Noir mat',
        text: ['L’effet le plus radical : plus aucun reflet sur les entourages. Comme tout film mat, il se nettoie sans cire ni produit lustrant, et garde plus facilement les marques de doigts.'],
      },
      {
        title: 'Carbone',
        text: ['La texture tissée apporte une touche sportive aux coques de rétroviseurs, aux inserts de bouclier ou au diffuseur. Sur des entourages de vitres très fins, le motif se lit moins : un noir uni y est souvent plus net.'],
      },
      {
        title: 'Teinte carrosserie ou contraste',
        text: ['Les chromes peuvent aussi prendre une couleur proche de la carrosserie, pour un effet monochrome, ou une couleur franche qui tranche. Un film ne reproduit jamais exactement une peinture : la référence la plus proche se choisit sur l’échantillon, tenu contre la carrosserie.'],
      },
    ],
  },
  {
    type: 'steps',
    id: 'pose-dechromage',
    title: 'Comment se déroule *un déchromage*',
    lead: 'Le principe est simple, l’exécution beaucoup moins : sur des pièces fines et très visibles, chaque bord compte. Voici les étapes, adaptées à chaque véhicule.',
    items: [
      {
        title: 'Repérage et choix',
        text: 'Nous faisons le tour du véhicule avec vous pour lister les pièces réellement chromées, vérifier leur état et comparer les finitions sur nuancier. Le devis détaille chaque pièce retenue.',
      },
      {
        title: 'Nettoyage et dégraissage',
        text: 'Les chromes et leurs abords sont lavés puis dégraissés avec soin, joints compris : un reste de cire, de silicone ou de produit de lavage suffit à empêcher le film d’accrocher sur les bords.',
      },
      {
        title: 'Démontage quand il le faut',
        text: 'Calandre, logos ou certaines baguettes se déposent selon le véhicule, pour que le film soit enroulé derrière la pièce plutôt qu’arrêté en surface. Sur un véhicule ancien, des clips fragilisés peuvent devoir être remplacés : nous vous le signalons avant.',
      },
      {
        title: 'Découpe et pose',
        text: 'Le film est découpé un peu plus grand que la pièce, posé sans bulles, puis ajusté. Sur les pièces laissées en place, comme les entourages de vitres, la coupe se fait au ras du joint, sans marquer la peinture ni le caoutchouc.',
      },
      {
        title: 'Chauffe des bords',
        text: 'Les bords repliés et les zones étirées sont chauffés pour que le film garde sa nouvelle forme au lieu de chercher à se rétracter. C’est cette étape qui évite de voir un bord se soulever quelques semaines plus tard.',
      },
      {
        title: 'Remontage et contrôle',
        text: 'Les pièces déposées sont remontées et chaque bord est vérifié à la lumière. Nous vous expliquons ensuite comment laver le véhicule. Le temps nécessaire varie avec le nombre de pièces et les démontages ; il est précisé sur le devis.',
      },
    ],
  },
  {
    type: 'prose',
    id: 'entretien-depose',
    title: 'Entretien et dépose : *ce qu’il faut savoir*',
    text: [
      'Un déchromage s’entretient comme le reste de la carrosserie, avec une attention particulière aux bords. Le lavage se fait à la main ou en station sans contact, lance éloignée des entourages et des baguettes ; évitez les rouleaux de lavage, qui accrochent les bords des pièces fines.',
      'En hiver, le grattoir à givre ne doit pas passer sur les entourages de vitres habillés. Les films mats et satinés se passent de cire et de produit lustrant : un nettoyant adapté aux films suffit. Fientes et insectes s’enlèvent rapidement, avant de sécher au soleil.',
      'Le jour où vous voulez retrouver vos chromes, avant une revente ou une fin de location par exemple, un professionnel retire le film à chaud, sans forcer, puis nettoie les éventuelles traces de colle.',
    ],
  },
  {
    type: 'prose',
    id: 'dechromage-indre-et-loire',
    kicker: 'Vouvray, Tours, Indre-et-Loire',
    title: 'Déchromage à Vouvray, *pour Tours et l’Indre-et-Loire*',
    text: [
      'Les pièces sont traitées dans notre atelier de la zone d’activité de l’Étang Vignon, à Vouvray (395 rue des Entrepreneurs), à l’est de Tours, sur la rive nord de la Loire. Nous recevons sur rendez-vous des automobilistes de l’agglomération tourangelle et de tout le département : les horaires et le plan d’accès sont détaillés dans la présentation de [l’atelier](/atelier-vouvray/), la liste des communes desservies sur notre page [zones d’intervention](/zones-intervention/).',
      'Un déchromage se combine volontiers avec d’autres prestations. Les chromes passés au noir prolongent un [covering](/covering-dechromage/) de la carrosserie ; ils répondent à des [vitres teintées](/vitres-teintees/) sur les places arrière, dans le respect de la règle qui encadre les vitres avant ; des [feux arrière teintés](/feux-arriere-teintes/) peuvent compléter l’ensemble, sous réserve des règles rappelées sur leur page.',
      'Pour recevoir un devis, [présentez-nous votre véhicule](/contact/?prestation=dechromage) : modèle, année, pièces à traiter et finition souhaitée, avec quelques photos si possible. Le tarif tient compte de la quantité de pièces, de leurs formes et des démontages à prévoir. Pour voir des voitures passées par l’atelier, consultez nos [réalisations](/realisations/).',
    ],
  },
];
