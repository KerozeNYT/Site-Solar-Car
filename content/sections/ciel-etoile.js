/**
 * Ciel étoilé (/ciel-etoile/): long-form sections and extra FAQ, rendered between the
 * simulator and the benefits (src/templates/pages.js, `richSections`).
 *
 * Facts used here come from content/site.js (service entry, business), content/pricing.js
 * (`starlight`: quote only, star counts of the simulator) and src/templates/sims.js (colours,
 * intensity, effects and constellations offered by the configurator). No price, warranty,
 * duration, kit brand or certification may be added here: the price is set on quote.
 */

export const sections = [
  {
    type: 'prose',
    id: 'fonctionnement',
    kicker: 'Le principe',
    title: 'Un pavillon étoilé, *fibre après fibre*',
    text: [
      'Un ciel étoilé, que l’on appelle aussi *starlight* ou plafond étoilé, repose sur une idée simple : chaque point lumineux visible au-dessus de vous est la pointe d’une fibre optique. Ces fibres traversent le ciel de toit, c’est-à-dire le garnissage qui habille l’intérieur du pavillon, puis se rejoignent toutes à l’arrière vers une même source de lumière.',
      'Cette source est un générateur à LED de petite taille, installé hors de la vue. Il envoie sa lumière dans le faisceau de fibres, qui la conduisent jusqu’au tissu : aucun fil électrique n’aboutit aux étoiles elles-mêmes. C’est également le générateur qui fixe la teinte, la luminosité et les animations ; le garnissage, lui, se contente de laisser passer la lumière.',
      'Le résultat se juge de nuit, portes fermées et plafonnier éteint : des centaines de points fins apparaissent sur le tissu, sans spot ni bandeau apparent. Pour approfondir le sujet avant de vous décider, consultez aussi [notre guide du ciel étoilé](/guides/ciel-etoile-voiture/).',
    ],
    points: [
      '*Les fibres optiques* : une par étoile, insérées dans le ciel de toit d’origine de votre voiture.',
      '*Le générateur* : la source lumineuse, logée à l’abri des regards.',
      '*La commande* : pour allumer, éteindre et doser la lumière, selon le kit retenu.',
      '*Le garnissage* : celui du véhicule, déposé pour la pose puis remis en place.',
    ],
  },
  {
    type: 'blocks',
    id: 'reglages',
    title: 'Densité, couleurs, effets : *ce que vous choisissez*',
    lead: 'Le configurateur placé plus haut reprend les réglages proposés pour un ciel étoilé de voiture. À l’écran, tout se combine librement ; sur votre véhicule, la disponibilité de chaque option dépend du kit posé et figure sur le devis.',
    items: [
      {
        title: 'Le nombre d’étoiles',
        text: [
          'Le curseur va de 150 à 1 200 points, en passant par 300, 450, 600, 800 et 1 000. C’est le réglage qui transforme le plus l’allure du pavillon : quelques étoiles espacées, ou une voûte serrée d’un bord à l’autre.',
        ],
      },
      {
        title: 'Une couleur ou deux',
        text: [
          'Six teintes sont proposées : blanc pur, blanc chaud, bleu glacier, violet, ambre et rouge. En mode bicolore, deux d’entre elles se partagent le ciel, par exemple un blanc chaud semé de bleu glacier.',
        ],
      },
      {
        title: 'L’intensité',
        text: [
          'De douce à maximale. Une lumière tamisée suffit souvent pour l’ambiance pendant un trajet ; la pleine luminosité se garde plutôt pour les moments à l’arrêt.',
        ],
      },
      {
        title: 'Le scintillement',
        text: [
          'Les étoiles changent doucement d’éclat, à la manière d’un vrai ciel d’été. Dans le simulateur, l’effet s’active ou se coupe d’un clic, pour comparer avec une lumière fixe.',
        ],
      },
      {
        title: 'Les étoiles filantes',
        text: [
          'De temps en temps, un trait lumineux file à travers le pavillon. Un effet ponctuel, qui surprend sans occuper le regard en permanence.',
        ],
      },
      {
        title: 'Une constellation',
        text: [
          'Grande Ourse, Orion, Cassiopée ou Croix du Sud : une figure reconnaissable peut se dessiner parmi les autres étoiles. Son emplacement sur le pavillon se valide avec vous avant le perçage.',
        ],
      },
    ],
    note: 'Vous hésitez entre deux réglages ? Composez votre ciel dans le simulateur, comparez allumé et éteint, puis envoyez la configuration avec votre [demande de devis](/contact/?prestation=ciel-etoile).',
  },
  {
    type: 'compare',
    id: 'densite-etoiles',
    title: 'Combien d’étoiles *pour votre pavillon* ?',
    lead: 'Le bon nombre dépend moins d’une règle que de la surface du toit et de l’effet recherché. Ce tableau donne des repères ; le simulateur et l’étude du véhicule permettent ensuite de trancher.',
    caption: 'Repères de densité pour un plafond étoilé en fibre optique, d’après les nombres d’étoiles du simulateur',
    head: ['', 'Ciel léger · 150 à 300', 'Ciel équilibré · 450 à 600', 'Ciel dense · 800 à 1 200'],
    rows: [
      ['Impression générale', 'Points bien espacés, beaucoup de noir entre eux', 'Ciel régulier, rempli sans être chargé', 'Voûte serrée, proche d’une Voie lactée'],
      ['Petit pavillon (coupé, citadine)', true, true, 'À doser : le ciel se densifie vite'],
      ['Grand pavillon (break, SUV, utilitaire)', 'Peut sembler clairsemé', true, true],
      ['Constellation au milieu du ciel', 'Se détache nettement', 'Reste bien lisible', 'Plus discrète parmi les autres points'],
      ['Temps de pose', 'Le plus court', 'Intermédiaire', 'Le plus long : chaque fibre est insérée séparément'],
    ],
    note: 'Le nombre d’étoiles retenu est repris sur le devis avec le reste de la configuration. Avec un toit ouvrant ou panoramique, la surface habillée est plus petite : la densité se raisonne alors sur la partie du garnissage qui reçoit réellement les fibres.',
  },
  {
    type: 'blocks',
    id: 'vehicules-compatibles',
    title: 'Quels véhicules, *quels toits* ?',
    lead: 'Le simulateur couvre toutes les catégories, du coupé à l’utilitaire. Sur le véhicule réel, la faisabilité dépend surtout de la construction du pavillon, que nous examinons avant de chiffrer quoi que ce soit.',
    items: [
      {
        title: 'Toit ouvrant ou panoramique',
        text: [
          'L’ouverture et son cadre occupent une partie du pavillon : les étoiles se placent alors sur le garnissage restant, et le rideau comme le mécanisme doivent continuer à fonctionner normalement. La réponse dépend du modèle ; nous vous la donnons au devis.',
        ],
      },
      {
        title: 'Airbags rideaux et montants',
        text: [
          'Sur de nombreuses voitures, des airbags rideaux sont logés le long des bords du pavillon, derrière les garnitures de montants. Leur emplacement est repéré avant le tracé des étoiles, et ces zones restent libres, sans fibre ni perçage.',
        ],
      },
      {
        title: 'L’état du ciel de toit',
        text: [
          'Les fibres se fixent dans le garnissage existant : s’il se décolle ou s’affaisse, mieux vaut le savoir avant de commencer. Nous vérifions son état lors de l’étude et vous en parlons avant tout perçage.',
        ],
      },
      {
        title: 'Équipements du pavillon',
        text: [
          'Plafonnier, poignées, pare-soleil, console de toit : selon le véhicule, ces éléments sont démontés puis remontés, et le tracé des étoiles tient compte de leur position.',
        ],
      },
      {
        title: 'Coupés et cabriolets',
        text: [
          'Un coupé à toit fixe se traite comme les autres voitures, sur une surface souvent plus réduite. Un cabriolet à capote souple pose une autre question : elle s’étudie au cas par cas, sur le véhicule.',
        ],
      },
    ],
  },
  {
    type: 'steps',
    id: 'pose-atelier',
    title: 'La pose à l’atelier, *étape par étape*',
    lead: 'Installer un ciel étoilé demande d’ouvrir l’habitacle avec méthode. Voici comment se déroule le travail à Vouvray ; la durée d’immobilisation dépend du véhicule et vous est confirmée au devis.',
    items: [
      {
        title: 'Étude et configuration',
        text: 'À partir de votre réglage du simulateur, de photos ou d’un passage à l’atelier, nous regardons le pavillon, ses équipements et l’état du garnissage. Densité, couleurs, effets et kit sont ensuite arrêtés ensemble.',
      },
      {
        title: 'Dépose du ciel de toit',
        text: 'Selon le modèle, pare-soleil, poignées, plafonnier et garnitures de montants sont démontés avant de descendre le ciel de toit et de le sortir de l’habitacle.',
      },
      {
        title: 'Tracé des étoiles',
        text: 'Les zones à garder libres sont marquées en premier : bords des airbags rideaux, fixations, cadre du toit ouvrant le cas échéant. Les points sont ensuite répartis selon la densité choisie, avec la constellation si vous en avez retenu une.',
      },
      {
        title: 'Perçage et insertion des fibres',
        text: 'Chaque point est percé, puis une fibre y est glissée et collée au dos du garnissage. C’est la phase la plus longue du chantier, et elle s’allonge avec le nombre d’étoiles.',
      },
      {
        title: 'Coupe au ras du tissu',
        text: 'Une fois toutes les fibres en place, leur extrémité est coupée au ras du garnissage : seule la pointe affleure, prête à s’allumer.',
      },
      {
        title: 'Générateur et repose',
        text: 'Le faisceau de fibres rejoint le générateur, placé à l’abri des regards et raccordé à l’électricité du véhicule. Le ciel de toit reprend sa place, puis chaque garniture est remontée.',
      },
      {
        title: 'Essais et restitution',
        text: 'Nous allumons le ciel avec vous : intensité, couleurs et effets choisis sont contrôlés, puis nous vous montrons comment les commander au quotidien.',
      },
    ],
  },
  {
    type: 'blocks',
    id: 'usage-entretien',
    title: 'Au quotidien : *usage et entretien*',
    items: [
      {
        title: 'Allumer, éteindre, doser',
        text: [
          'Vous dosez la luminosité à votre convenance ; couleurs et animations se pilotent aussi lorsque le kit le permet. Le mode de commande (télécommande, application ou interrupteur) dépend du matériel retenu et figure sur le devis.',
        ],
      },
      {
        title: 'De nuit, sur la route',
        text: [
          'Pour conduire, une intensité modérée garde l’ambiance sans attirer l’œil vers le plafond. La pleine puissance se savoure plutôt une fois la voiture arrêtée.',
        ],
      },
      {
        title: 'Entretenir le garnissage',
        text: [
          'Un dépoussiérage léger à la microfibre sèche suffit. Évitez de détremper le tissu ou d’y frotter un produit agressif : le revêtement du ciel de toit est collé sur son support, et l’humidité ne lui réussit pas.',
        ],
      },
      {
        title: 'Un choix qui se mûrit',
        text: [
          'Le garnissage est percé à chaque étoile : un ciel étoilé ne se retire pas comme un film. Il peut rester éteint aussi longtemps que vous le souhaitez, mais les points demeurent. Prenez donc le temps de le composer dans le simulateur.',
        ],
      },
    ],
  },
  {
    type: 'prose',
    id: 'prix-devis',
    kicker: 'Tarif',
    title: 'Le prix d’un ciel étoilé, *établi sur devis*',
    text: [
      'Il n’existe pas de tarif unique pour un pavillon étoilé : deux voitures de même catégorie peuvent demander un travail très différent selon leur toit et leurs équipements. Le prix est donc calculé sur devis, une fois le véhicule et la configuration connus.',
      'Le simulateur vous aide à préparer cette demande : le ciel que vous composez (nombre d’étoiles, couleurs, intensité, effets) part avec votre [demande de devis](/contact/?prestation=ciel-etoile). Ajoutez le modèle et l’année du véhicule, quelques photos du pavillon et du toit ouvrant s’il y en a un : nous revenons vers vous avec un chiffrage détaillé.',
    ],
    points: [
      'le véhicule et la surface de son pavillon ;',
      'le nombre d’étoiles, puisque chaque fibre est posée une à une ;',
      'les options retenues : bicolore, scintillement, étoiles filantes, constellation ;',
      'la configuration du toit : toit ouvrant ou panoramique, équipements à démonter ;',
      'le kit choisi et son mode de commande.',
    ],
  },
  {
    type: 'prose',
    id: 'atelier-pres-de-tours',
    kicker: 'Près de Tours',
    title: 'Votre ciel étoilé posé *à Vouvray*',
    text: [
      'SOLAR CAR 37 installe les ciels étoilés dans son atelier du 395 rue des Entrepreneurs, à Vouvray (ZA de l’Étang Vignon), à une dizaine de kilomètres au nord-est de Tours. Le travail se fait sur place, du démontage du pavillon jusqu’aux essais.',
      'Les conducteurs viennent de Tours, de son agglomération et plus largement d’Indre-et-Loire : la page [zones d’intervention](/zones-intervention/) indique la distance et le trajet depuis chaque commune voisine. Pour fixer un rendez-vous, téléphonez au 06 12 04 57 00 ou passez par le formulaire de devis ; la date de prise en charge est convenue ensemble.',
      'L’atelier réunit d’autres savoir-faire, à prévoir sur le même devis si vous le souhaitez : des [vitres teintées](/vitres-teintees/) à l’arrière pour un habitacle plus intime, ou un [covering](/covering-dechromage/) pour changer de style à l’extérieur. Pour juger du rendu d’un ciel étoilé, les pavillons d’une BMW Série 2 et d’une Audi S1 figurent parmi nos [réalisations](/realisations/). Accès et horaires : voir la page de [l’atelier de Vouvray](/atelier-vouvray/).',
    ],
  },
];

export const faq = [
  {
    q: 'Combien d’étoiles prévoir dans une voiture ?',
    a: 'Il n’y a pas de chiffre idéal : tout dépend de la surface du pavillon et de l’ambiance voulue. Le simulateur propose de 150 à 1 200 étoiles ; un petit toit atteint vite une forte densité, alors qu’un grand pavillon en demande davantage pour paraître rempli. Nous arrêtons le nombre avec vous au moment du devis.',
  },
  {
    q: 'Peut-on revenir en arrière après la pose ?',
    a: 'Vous pouvez tout à fait cesser de l’allumer, mais le garnissage a été percé à chaque étoile : il ne retrouve pas son aspect d’origine. C’est pourquoi la configuration est validée avec vous avant de commencer.',
  },
  {
    q: 'Quelles constellations peut-on reproduire ?',
    a: 'Le simulateur propose la Grande Ourse, Orion, Cassiopée et la Croix du Sud, dessinées parmi les autres étoiles. Leur réalisation dépend du kit posé sur votre véhicule ; elle est confirmée sur le devis.',
  },
  {
    q: 'Peut-on mélanger deux couleurs d’étoiles ?',
    a: 'C’est le mode bicolore : deux teintes, choisies dans le simulateur parmi le blanc pur, le blanc chaud, le bleu glacier, le violet, l’ambre et le rouge, se partagent le pavillon. Comme les autres options, il dépend du kit retenu.',
  },
  {
    q: 'Combien de temps la voiture reste-t-elle à l’atelier ?',
    a: 'Tout dépend du modèle, du nombre d’étoiles et des équipements à démonter. La durée d’immobilisation vous est communiquée avec le devis, et la date de prise en charge se fixe ensemble.',
  },
  {
    q: 'Les airbags rideaux empêchent-ils la pose ?',
    a: 'Pas forcément. Nous commençons par situer ces airbags, généralement le long des bords du pavillon, puis nous laissons leurs zones sans fibre. Ce repérage fait partie de l’étude du véhicule.',
  },
  {
    q: 'J’habite à Tours ou ailleurs en Indre-et-Loire : où se fait la pose ?',
    a: 'À l’atelier SOLAR CAR 37, 395 rue des Entrepreneurs à Vouvray, au nord-est de Tours. La pose impose de déposer le ciel de toit : elle se fait donc sur place, sur rendez-vous.',
  },
  {
    q: 'Que joindre à ma demande de devis ?',
    a: 'La configuration composée dans le simulateur, ou une simple description de l’ambiance souhaitée, avec le modèle et l’année du véhicule et la présence éventuelle d’un toit ouvrant. Une photo du pavillon permet un chiffrage plus précis.',
  },
];
