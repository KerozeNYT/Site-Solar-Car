/**
 * Detailing carrosserie: the long-form sections of the service page (rendered by `richSections`
 * in src/templates/pages.js) and extra FAQ entries.
 *
 * Every forfait reads « Sur devis »: the workshop's detailing prices are not validated yet.
 * The French market ranges below come from the public pages of about fifteen detailing
 * businesses (2025–2026), aggregated, never named: they are market references, not the
 * workshop's prices. Nothing here may promise a product, a warranty or a duration of the
 * workshop's own work (« selon l’état, confirmé au devis »).
 *
 * FAQ answers are plain text (no *emphasis*, no links): faqBlock escapes them.
 */

export const sections = [
  {
    type: 'packages',
    id: 'forfaits',
    title: 'Quatre forfaits, du nettoyage en profondeur à la *céramique*',
    lead: 'Chaque forfait reprend le précédent et va un peu plus loin. Nous vous orientons vers le bon niveau après avoir vu la peinture : polir un vernis qui n’en a pas besoin ne sert à rien.',
    items: [
      {
        id: 'essentiel',
        label: 'Essentiel',
        kicker: 'Sans polissage',
        tagline: 'Une carrosserie remise à neuf au toucher comme à l’œil, sans toucher au vernis.',
        includes: [
          'Prélavage à la mousse active, avant tout contact',
          'Lavage manuel au gant, de haut en bas',
          'Décontamination ferreuse et passage à l’argile',
          'Jantes nettoyées et décontaminées, pneus ravivés',
          'Vitres extérieures, joints et plastiques extérieurs',
          'Protection légère en finition',
        ],
        forWho: 'une peinture en bon état, peu marquée, ou un grand nettoyage de saison.',
      },
      {
        id: 'eclat',
        label: 'Éclat',
        kicker: 'Polissage en une étape',
        tagline: 'L’Essentiel, complété par un polissage « one step » qui ravive les reflets.',
        includes: [
          'Tout le contenu du forfait Essentiel',
          'Polissage en une étape, panneau par panneau',
          'Atténue une partie des micro-rayures et redonne de la profondeur à la teinte',
          'Dégraissage de la carrosserie avant protection',
          'Protection de type scellant (sealant)',
        ],
        forWho: 'une peinture un peu terne, légèrement micro-rayée, ou une voiture à présenter à la vente.',
      },
      {
        id: 'correction',
        label: 'Correction',
        kicker: 'Polissage en plusieurs étapes',
        tagline: 'Une vraie *correction de peinture*, pour les vernis marqués par les lavages.',
        includes: [
          'Lavage et décontamination complets',
          'Inspection détaillée et, selon le véhicule, mesure de l’épaisseur de peinture',
          'Polissage en plusieurs étapes : correction, puis finition',
          'Retire la majorité des micro-rayures et des hologrammes, selon l’épaisseur du vernis',
          'Protection de type scellant après dégraissage',
        ],
        forWho: 'une peinture voilée par les rouleaux de lavage ou d’anciens polissages, surtout sur une teinte foncée.',
      },
      {
        id: 'signature',
        label: 'Signature céramique',
        kicker: 'Correction + céramique',
        tagline: 'La peinture corrigée selon son état, puis scellée par un *revêtement céramique*.',
        includes: [
          'Lavage et décontamination complets',
          'Correction adaptée à l’état : une ou plusieurs étapes',
          'Dégraissage soigné de toute la carrosserie',
          'Revêtement céramique sur les surfaces peintes',
          'Temps de séchage respecté avant la restitution',
          'Consignes d’entretien pour les premières semaines',
        ],
        forWho: 'une voiture que vous gardez longtemps, une peinture neuve à protéger dès le départ, ou des lavages plus simples au quotidien.',
      },
    ],
    note: 'Tous les forfaits sont établis *sur devis* : le prix dépend de l’état de la peinture, du gabarit du véhicule et des options choisies. Il est confirmé après examen de la carrosserie à l’atelier de Vouvray, tout comme la durée d’immobilisation, qui dépend elle aussi de l’état du vernis.',
  },
  {
    type: 'compare',
    id: 'comparatif-forfaits',
    title: 'Ce que comprend *chaque forfait*',
    lead: 'Le même ordre de travail pour tous : nettoyer, décontaminer, corriger si besoin, protéger. Seuls la profondeur du polissage et le type de protection changent.',
    caption: 'Contenu indicatif, ajusté au devis selon le véhicule et l’état de la peinture.',
    head: ['', 'Essentiel', 'Éclat', 'Correction', 'Signature céramique'],
    rows: [
      ['Prélavage à la mousse active', true, true, true, true],
      ['Lavage manuel', true, true, true, true],
      ['Décontamination ferreuse', true, true, true, true],
      ['Argile (décontamination mécanique)', true, true, true, true],
      ['Polissage en une étape', false, true, false, 'Selon l’état'],
      ['Correction en plusieurs étapes', false, false, true, 'Selon l’état'],
      ['Micro-rayures retirées', 'Aucune', 'Une partie', 'La majorité, selon le vernis', 'Selon l’état'],
      ['Scellant ou cire', 'Protection légère', 'Scellant', 'Scellant', 'Remplacé par la céramique'],
      ['Revêtement céramique', false, false, false, true],
      ['Jantes et pneus', true, true, true, true],
      ['Vitres extérieures', true, true, true, true],
      ['Intérieur', 'En option', 'En option', 'En option', 'En option'],
    ],
  },
  {
    type: 'blocks',
    id: 'options-detailing',
    title: 'Les options, *sur devis*',
    lead: 'À ajouter au forfait de votre choix. Comme les forfaits, elles sont chiffrées après avoir vu le véhicule.',
    items: [
      {
        title: 'Intérieur',
        text: ['Aspiration, plastiques, vitres intérieures, tapis et sièges selon leur matière. Le contenu exact dépend de l’état de l’habitacle : nous le définissons ensemble au devis.'],
      },
      {
        title: 'Céramique vitres et jantes',
        text: [
          'Sur le pare-brise et les vitres, un revêtement déperlant aide la pluie à s’évacuer. Il complète les essuie-glaces, il ne les remplace pas.',
          'Sur les jantes, il limite l’incrustation de la poussière de frein et rend le nettoyage plus rapide.',
        ],
      },
      {
        title: 'Entretien annuel',
        text: ['Une visite par an : lavage dans les règles, contrôle de la protection et ravivage si besoin. Certaines céramiques en font une condition de la tenue annoncée par leur fabricant.'],
      },
      {
        title: 'Phares jaunis',
        text: ['Des optiques ternes gâchent une carrosserie qui brille. Leur remise en état est une prestation à part, avec son propre tarif : voir la [rénovation de phares](/renovation-phares/).'],
      },
    ],
  },
  {
    type: 'prose',
    id: 'detailing-ou-lavage',
    kicker: 'Comprendre',
    title: 'Detailing ou lavage : *quelle différence ?*',
    text: [
      'Un lavage, même soigné, enlève la saleté posée sur la carrosserie. Le detailing va plus loin : il retire aussi ce qui s’est incrusté dans le vernis, corrige les défauts de surface par polissage, puis protège la peinture. C’est un travail manuel, panneau par panneau, qui se compte en heures plutôt qu’en minutes.',
      'On parle aussi de lustrage ou de rénovation de carrosserie. Les mots changent d’un atelier à l’autre : ce qui compte, c’est le nombre d’étapes de polissage prévues et la protection posée à la fin.',
      'Le résultat se remarque surtout au soleil et sur les teintes foncées : des reflets nets au lieu d’un voile, une couleur plus profonde, une carrosserie qui se lave plus facilement.',
    ],
    points: [
      '*Lavage* : la saleté de surface, en quelques dizaines de minutes.',
      '*Décontamination* : particules métalliques, goudron et résidus que le lavage laisse en place.',
      '*Polissage* : micro-rayures et hologrammes, dans l’épaisseur du vernis.',
      '*Protection* : une couche qui ralentit l’encrassement et facilite les lavages suivants.',
    ],
  },
  {
    type: 'steps',
    id: 'etapes-detailing',
    title: 'Le detailing *étape par étape*',
    lead: 'Voici comment se déroule un detailing complet. Pour l’Essentiel, les étapes de polissage sont simplement retirées.',
    items: [
      {
        title: 'Inspection sous éclairage',
        text: 'La carrosserie est examinée sous une lumière qui révèle micro-rayures, hologrammes, traces gravées et éléments repeints. Nous vous montrons ce que le polissage peut corriger, et ce qu’il ne corrigera pas.',
      },
      {
        title: 'Mesure de l’épaisseur de peinture, selon le véhicule',
        text: 'Avant une correction, une jauge d’épaisseur aide à repérer les panneaux repeints ou déjà polis, et à estimer la marge de vernis disponible. Pour un simple Essentiel, elle n’est pas nécessaire.',
      },
      {
        title: 'Prélavage et lavage manuel',
        text: 'La mousse active ramollit la saleté et en emporte une bonne partie avant le premier contact. Viennent ensuite les jantes, puis le lavage au gant microfibre, du toit vers les bas de caisse, et un rinçage soigné.',
      },
      {
        title: 'Décontamination',
        text: 'Le décontaminant ferreux dissout la poussière de frein et la limaille fixées dans le vernis ; si besoin, un détachant traite les points de goudron ; l’argile retire les derniers résidus. La peinture devient lisse au toucher, condition d’un polissage propre.',
      },
      {
        title: 'Polissage ou correction',
        text: 'Joints, plastiques bruts et arêtes fragiles sont protégés, puis la polisseuse travaille élément par élément. Une zone d’essai permet de retenir la méthode la moins agressive qui donne le résultat attendu : une étape pour Éclat, plusieurs pour Correction, selon l’état pour Signature.',
      },
      {
        title: 'Dégraissage et protection',
        text: 'Les résidus de polish sont retirés pour que la protection accroche au vernis et non à un film gras. Vient ensuite la protection prévue au forfait, avec le temps de séchage qu’elle demande.',
      },
      {
        title: 'Finitions',
        text: 'Jantes, pneus, vitres, joints et plastiques extérieurs sont repris un à un. Un dernier contrôle sous lumière permet de vérifier chaque élément avant la restitution.',
      },
      {
        title: 'Restitution et conseils',
        text: 'Nous vous expliquons comment laver la voiture pour garder le résultat et, après une céramique, ce qu’il faut éviter les premiers jours. La durée totale dépend de l’état de la peinture : elle est confirmée au devis.',
      },
    ],
  },
  {
    type: 'compare',
    id: 'cire-scellant-ceramique',
    title: 'Cire, scellant ou *traitement céramique* ?',
    lead: 'Trois familles de protection, qui se posent toutes sur une peinture propre et décontaminée. Les durées indiquées sont les fourchettes courantes annoncées par les fabricants : en pratique, elles dépendent des lavages, du stationnement et du kilométrage.',
    caption: 'Tendances générales : chaque produit a ses propres caractéristiques, précisées au devis.',
    head: ['', 'Cire', 'Scellant (sealant)', 'Revêtement céramique'],
    rows: [
      ['Tenue annoncée', 'Quelques semaines, rarement plus de 3 mois', 'Environ 3 à 6 mois, parfois davantage', '2 à 9 ans selon les produits, sans test indépendant'],
      ['Brillance', 'Chaude, appréciée sur les teintes foncées', 'Nette, reflets précis', 'Nette et stable dans le temps'],
      ['Effet déperlant', 'Bon au début, s’estompe vite', 'Bon pendant plusieurs mois', 'Marqué et plus durable'],
      ['Résistance aux lavages et détergents', 'Faible', 'Moyenne', 'Élevée'],
      ['Pose', 'Simple, à renouveler souvent', 'Simple', 'Exigeante : vernis corrigé et dégraissé, puis temps de durcissement'],
      ['Protège des gravillons', false, false, false],
      ['Rend la peinture inrayable', false, false, false],
    ],
    note: 'Aucune de ces protections n’arrête un gravillon ni une rayure franche. Contre les impacts, la solution est un film de protection de peinture (PPF), à ne pas confondre avec le film décoratif présenté sur la page [covering et déchromage](/covering-dechromage/). Pour le détail des différences, lisez notre guide [polissage, céramique ou cire](/guides/polissage-ceramique-cire/).',
  },
  {
    type: 'prose',
    id: 'rayures-hologrammes',
    title: 'Peut-on effacer *toutes les rayures* ?',
    text: [
      'Non, et mieux vaut le savoir avant de commencer. Le polissage agit dans le vernis, la couche transparente posée sur la teinte. Sur une voiture récente, cette couche ne mesure souvent que quelques dizaines de microns : chaque passe en consomme un peu, et la marge n’est pas illimitée.',
      'Les micro-rayures de lavage et les hologrammes laissés par une polisseuse mal maîtrisée restent en surface : une correction en retire la plus grande partie. Une rayure qui accroche l’ongle est généralement plus profonde ; elle peut être atténuée, rarement effacée. Si l’apprêt ou le métal apparaît, la rayure a traversé le vernis : c’est un travail de retouche ou de carrosserie, pas de polissage.',
      'C’est pourquoi nous préférons ne pas annoncer de pourcentage de correction avant d’avoir vu la voiture. Sur un élément déjà repeint ou très poli, la préservation du vernis passe avant le dernier reflet.',
    ],
    points: [
      '*Micro-rayures de lavage* : en grande partie retirées, selon le forfait.',
      '*Hologrammes* : retirés par une correction ou une finition adaptée.',
      '*Traces gravées de calcaire, de fientes ou de sève* : atténuées selon leur profondeur.',
      '*Rayure qui accroche l’ongle* : atténuée, rarement effacée.',
      '*Rayure jusqu’à l’apprêt, éclat de gravillon* : retouche ou carrosserie.',
    ],
  },
  {
    type: 'compare',
    id: 'prix-detailing-france',
    kicker: 'Repères de marché',
    title: 'Prix du detailing en France : *les fourchettes observées*',
    lead: 'Pour vous situer, voici les prix publiés par une quinzaine de professionnels du detailing en France, relevés en 2025 et 2026. Ce sont des repères de marché, *pas les tarifs de SOLAR CAR 37* : les nôtres sont établis sur devis, après examen de votre peinture.',
    caption: 'Fourchettes agrégées à partir de pages publiques, sans citer de prestataire. HT ou TTC selon les pages, pas toujours précisé.',
    head: ['', 'Contenu habituel', 'Prix observés', 'Durée annoncée'],
    rows: [
      ['Lavage extérieur détaillé', 'Prélavage, lavage au gant, jantes décontaminées, séchage', '50 à 130 €', '1 h 30 à 3 h'],
      ['Décontamination seule', 'Décontaminant ferreux, détachant goudron, argile', 'Environ 50 à 80 €', 'Souvent incluse dans les formules supérieures'],
      ['Lustrage « éclat »', 'Lavage, argile, une passe de finition, protection légère', '100 à 200 €', 'Environ 3 h'],
      ['Polissage en une étape', 'Lavage, décontamination, une passe, cire ou scellant ; 40 à 75 % des défauts annoncés retirés', '275 à 680 €, de la citadine au grand SUV', 'Environ une journée'],
      ['Correction en 2 ou 3 étapes', 'Plusieurs passes ; 70 à 95 % des défauts annoncés retirés', '450 à 960 €, jusqu’à environ 1 200 € HT', '1,5 à 5 jours'],
      ['Céramique sur véhicule neuf', 'Préparation, passe de finition, une ou deux couches', '450 à 840 €', '1 à 2 jours, plus environ 24 h de durcissement'],
      ['Polissage une étape + céramique 2 à 3 ans', 'Formule combinée', '450 à 1 300 €', 'Environ une journée'],
      ['Correction + céramique 3 à 5 ans et plus', 'Formule combinée', '990 à 1 850 €', '1,5 à 5 jours'],
      ['Options céramique', 'Vitres ; pare-brise seul ; plastiques ; cuir', '120 à 150 € ; environ 80 € ; environ 180 € ; 120 à 150 €', 'Rarement indiquée'],
      ['Entretien d’une céramique', 'Visite annuelle', '90 à 120 €', 'Rarement indiquée'],
      ['Intérieur', 'Contenu très variable selon les formules', '55 à 170 €', 'Rarement publiée'],
    ],
    note: 'Relevé réalisé sur les pages publiques des prestataires, à partir des prix affichés. Certaines pages étaient anciennes ou incohérentes entre elles : prenez ces chiffres comme des ordres de grandeur. Les pourcentages de défauts retirés sont ceux que les prestataires annoncent, pas des mesures vérifiées.',
  },
  {
    type: 'prose',
    id: 'bien-comparer-detailing',
    kicker: 'Bien comparer',
    title: 'Pourquoi les prix varient autant, et *quoi demander*',
    text: [
      'Deux critères expliquent l’essentiel des écarts. Le premier est le gabarit : les professionnels appliquent soit un supplément fixe, souvent de 50 à 150 €, soit trois à cinq catégories de taille. Entre une citadine et un grand SUV, l’écart observé va d’environ 40 à 80 %.',
      'Le second pèse encore plus lourd : l’état de la peinture. Une même prestation a par exemple été affichée 690 € pour une voiture neuve et 1 190 € pour une voiture d’occasion ; un autre prestataire distingue trois niveaux, à 800, 1 300 et 1 850 €, selon la densité des micro-rayures. Plus le vernis est marqué, plus la correction demande de passes, donc d’heures.',
      'Les tenues publiées pour les céramiques vont de 2 à 9 ans. Ce sont des affirmations de fabricants ou d’applicateurs : aucune n’a été vérifiée par un test indépendant, et toutes supposent un entretien régulier. La mention « 9H » renvoie à une échelle de dureté au crayon : c’est surtout un argument commercial, qui ne rend pas la peinture inrayable. Certaines garanties de marque exigent enfin un applicateur agréé et une visite annuelle.',
      'Une « céramique » vendue à très bas prix est souvent un produit en spray, appliqué en quelques minutes après le lavage. L’effet déperlant est réel, mais ce n’est pas un revêtement posé sur une peinture décontaminée, corrigée et dégraissée, et sa tenue se compte plutôt en mois qu’en années.',
      'Avant de comparer deux devis, posez ces quelques questions :',
    ],
    points: [
      'Le prix est-il TTC ou HT, et pour quelle taille de véhicule ?',
      'La peinture a-t-elle été vue avant le chiffrage, et combien d’étapes de polissage sont prévues ?',
      'L’épaisseur de peinture est-elle contrôlée avant de corriger ?',
      'Quelle protection est posée : cire, scellant, céramique en spray ou véritable revêtement céramique ?',
      'D’où vient la durée de tenue annoncée, et quel entretien suppose-t-elle ?',
      'S’il existe une garantie, qui la donne et à quelles conditions ?',
    ],
  },
  {
    type: 'blocks',
    id: 'entretien-apres-detailing',
    title: 'Après le detailing : *garder le résultat*',
    lead: 'Un vernis corrigé peut se rayer de nouveau dès le premier mauvais lavage. Quelques habitudes suffisent à faire durer le résultat, avec ou sans céramique.',
    items: [
      {
        title: 'Lavez à la main',
        text: [
          'Méthode des deux seaux : l’un pour le shampoing, l’autre pour rincer le gant, avec une grille au fond si possible. Gant microfibre propre, shampoing au pH neutre, du haut vers le bas.',
          'Séchez avec une microfibre épaisse ou par soufflage, sans raclette.',
        ],
      },
      {
        title: 'Évitez les rouleaux',
        text: ['Les portiques à brosses sont l’une des premières causes de micro-rayures. En station, préférez la haute pression sans contact, lance tenue à distance de la peinture et des joints.'],
      },
      {
        title: 'Les premiers jours après une céramique',
        text: ['Le revêtement continue de durcir après la restitution. En règle générale : ni pluie ni lavage pendant les premières 24 heures, ni shampoing ni produit pendant une semaine environ. La consigne exacte dépend du produit : nous vous la donnons à la restitution.'],
      },
      {
        title: 'Agissez vite sur les taches',
        text: ['Fientes, sève, insectes et calcaire attaquent le vernis au soleil, même protégé. Retirez-les rapidement avec un produit adapté et une microfibre humide, sans frotter à sec.'],
      },
    ],
  },
  {
    type: 'prose',
    id: 'detailing-pres-de-tours',
    kicker: 'Près de chez vous',
    title: 'Un atelier de detailing *à Vouvray, près de Tours*',
    text: [
      'SOLAR CAR 37 vous reçoit au 395 rue des Entrepreneurs, à Vouvray, à l’est de Tours. Le polissage et la céramique se font sur place, dans un local propre et bien éclairé : il en faut autant pour juger une peinture que pour poser une protection.',
      'Passer à l’atelier a un autre avantage : nous regardons la peinture avec vous avant de proposer un forfait. Le devis correspond alors à l’état réel de votre voiture, pas à une grille théorique.',
      'Nous accueillons des conducteurs de Tours et de toute l’Indre-et-Loire, de Rochecorbon à Amboise en passant par Montlouis-sur-Loire et Saint-Cyr-sur-Loire. Les communes desservies sont listées sur la page [zones d’intervention](/zones-intervention/) ; l’accès et les horaires sont sur la page [l’atelier](/atelier-vouvray/).',
      'Pour voir le résultat sur de vraies voitures, parcourez nos [réalisations](/realisations/). Pour un devis, [décrivez votre véhicule](/contact/?prestation=detailing-carrosserie) : modèle, année, couleur, défauts remarqués et forfait envisagé.',
    ],
  },
];

export const faq = [
  {
    q: 'Quelle différence entre lustrage et polissage ?',
    a: 'Le mot « lustrage » désigne souvent une passe légère qui ravive la brillance, parfois avec un produit qui comble les micro-rayures plus qu’il ne les retire. Le polissage, ou correction de peinture, nivelle réellement le vernis. Sur un devis, demandez toujours combien d’étapes de polissage sont prévues.',
  },
  {
    q: 'Combien coûte un detailing près de Tours ?',
    a: 'Chaque forfait est chiffré sur devis, une fois la peinture examinée à l’atelier de Vouvray. Pour vous situer, cette page présente aussi les fourchettes relevées chez des professionnels du detailing en France.',
  },
  {
    q: 'Pendant combien de temps faut-il laisser la voiture ?',
    a: 'Cela dépend du forfait et de l’état du vernis : un Essentiel est bien plus rapide qu’une correction en plusieurs étapes suivie d’une céramique, qui demande en plus un temps de séchage. La durée d’immobilisation figure sur le devis ; nous convenons ensemble du jour où vous déposez la voiture.',
  },
  {
    q: 'Une voiture neuve a-t-elle besoin d’être polie ?',
    a: 'Pas toujours. Une voiture neuve peut toutefois porter des défauts de transport ou de préparation, comme des marques de lavage en concession. L’inspection sous éclairage indique si une passe de finition est utile avant la protection, ou si la peinture peut être protégée directement.',
  },
  {
    q: 'Peut-on poser une céramique sans polissage ?',
    a: 'Oui sur une peinture neuve ou impeccable, après lavage, décontamination et dégraissage. Sur un vernis marqué, c’est déconseillé : les micro-rayures resteraient visibles sous le revêtement pendant toute sa durée de vie. Le forfait Signature commence donc par une correction adaptée à l’état.',
  },
  {
    q: 'Le traitement céramique protège-t-il des gravillons et des rayures ?',
    a: 'Non. Il résiste mieux aux salissures et aux produits agressifs, et rend le lavage plus simple, mais un gravillon ou une rayure franche le traverse. Seul un film de protection de peinture (PPF) est conçu pour encaisser les impacts.',
  },
  {
    q: 'Un detailing est-il utile avant de vendre sa voiture ?',
    a: 'Souvent, oui : une carrosserie décontaminée et ravivée par un polissage en une étape se présente mieux, en photo comme à l’essai. Le forfait Éclat convient bien à cet usage. Un detailing ne masque pas pour autant un choc ou une rayure profonde.',
  },
  {
    q: 'Traitez-vous les peintures mates et les véhicules covérés ?',
    a: 'Une peinture mate ou satinée ne se polit pas : l’abrasif la rendrait brillante par endroits. Un covering ne se traite pas non plus comme un vernis. Ces surfaces demandent un lavage et une protection spécifiques : signalez-le dans votre demande, nous vous dirons ce qui est possible.',
  },
  {
    q: 'Faut-il refaire la céramique chaque année ?',
    a: 'Non, un revêtement céramique ne se repose pas tous les ans. Un entretien annuel aide en revanche à conserver ses propriétés, et certaines marques l’exigent pour maintenir leur garantie. Nous vous indiquons ce que demande la protection appliquée sur votre voiture.',
  },
  {
    q: 'Les jantes, les vitres et les phares sont-ils compris ?',
    a: 'Jantes, pneus et vitres extérieures sont nettoyés dans tous les forfaits ; une céramique pour les jantes ou les vitres est proposée en option. La rénovation des phares jaunis est une prestation distincte, présentée sur sa propre page.',
  },
  {
    q: 'Comment obtenir un devis pour un detailing ?',
    a: 'Indiquez le modèle, l’année, la couleur et l’usage de la voiture, les défauts que vous avez remarqués et le forfait qui vous intéresse. Nous convenons ensuite d’un rendez-vous pour examiner la peinture : le tarif et la durée sont confirmés à ce moment-là.',
  },
];
