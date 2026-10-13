/**
 * Guides (articles) — practical answers to the questions customers type into Google.
 * Each guide links to its service page; keep the facts precise and dated (`updated`).
 *
 * Fields: slug (URL /guides/<slug>/), title (H1), seo, kicker, updated (YYYY-MM-DD),
 * service (related service slug), still (image id in /stills), intro, sections [{ h2, p: [],
 * list?: [] }], faq [{ q, a }].
 */
import { priceText as P, tint, vehicleTypes } from './pricing.js';
import { glazing as G } from './regulation.js';

export const guidesPage = {
  seo: {
    title: 'Guides vitres teintées, feux, phares, detailing | SOLAR CAR 37',
    description:
      'Loi sur les vitres teintées, feux fumés, phares jaunis, ciel étoilé, polissage et céramique : les réponses claires de l’atelier SOLAR CAR 37, près de Tours.',
  },
  h1: 'Guides pratiques',
  intro:
    'Les questions que l’on nous pose le plus souvent à l’atelier, avec des réponses claires : ce que dit la loi, comment se déroule une intervention, ce qu’il faut savoir avant de se lancer.',
};

export const guides = [
  {
    slug: 'vitres-teintees-loi',
    title: 'Vitres teintées : ce que dit la loi en France',
    seo: {
      title: 'Vitres teintées et loi : règle des 70 %, sanctions | SOLAR CAR 37',
      description:
        'Pare-brise et vitres avant : 70 % de lumière minimum depuis 2017. Sanctions, vitres arrière libres, dérogation médicale : tout savoir avant de teinter.',
    },
    kicker: 'Réglementation',
    updated: '2026-10-13',
    service: 'vitres-teintees',
    still: 'tint',
    intro:
      'Teinter ses vitres est légal, à condition de respecter une règle simple pour l’avant du véhicule. Voici ce que prévoit la réglementation française et comment choisir une teinte en connaissance de cause.',
    sections: [
      {
        h2: 'La règle des 70 % à l’avant',
        p: [
          'Depuis le 1er janvier 2017 (décret n° 2016-448 du 13 avril 2016), le pare-brise et les vitres latérales avant, côté conducteur et côté passager, doivent laisser passer au moins 70 % de la lumière visible.',
          'Ce taux se mesure sur l’ensemble vitre + film : une vitre d’origine ne laisse déjà pas passer 100 % de la lumière, si bien qu’un film même clair peut faire descendre l’ensemble sous la barre des 70 %. C’est pour cela que nous vous conseillons avant toute pose à l’avant.',
        ],
      },
      {
        h2: 'À l’arrière, aucune limite',
        p: [
          'Les vitres latérales arrière et la lunette arrière ne sont pas concernées par cette règle, à condition que le véhicule dispose de deux rétroviseurs extérieurs : vous pouvez choisir la teinte que vous voulez, jusqu’aux films les plus sombres (5 % de transmission).',
          'C’est la configuration la plus demandée : « 3/4 arrière » teinté pour l’intimité et le confort des passagers, vitres avant laissées claires.',
        ],
      },
      {
        h2: 'Les sanctions en cas de vitres avant trop sombres',
        p: ['Rouler avec des vitres avant ou un pare-brise sous le seuil des 70 % expose le conducteur à :'],
        list: [`une amende forfaitaire de ${G.fine} € ;`, `un retrait de ${G.points} points sur le permis de conduire ;`, 'une possible immobilisation du véhicule.'],
      },
      {
        h2: 'Les dérogations',
        p: [
          'Les dérogations sont limitées : elles concernent les véhicules blindés homologués, et les véhicules transportant une personne atteinte de l’une des affections listées par l’arrêté du 18 octobre 2016 (protoporphyrie érythropoïétique, porphyrie érythropoïétique congénitale, xeroderma pigmentosum). Une simple gêne à la lumière ne suffit pas.',
          'En dehors de ces cas, une teinte plus sombre à l’avant n’est pas autorisée sur la voie publique, même si le client l’accepte : son accord ne remplace pas la règle. Nous vous conseillons une solution adaptée à un usage routier.',
        ],
      },
      {
        h2: 'Bien choisir sa teinte',
        list: [
          '70 % : voile très léger ; à l’avant, même ce film fait en général descendre l’ensemble vitre + film sous le seuil légal ;',
          '50 % à 35 % : teinte visible, confort thermique, la route reste très lisible ;',
          '25 % à 15 % : intimité nette, le choix le plus courant à l’arrière ;',
          '5 % : noir profond, intimité maximale.',
        ],
        p: ['Le simulateur 3D de notre page vitres teintées vous permet de comparer ces teintes sur votre catégorie de véhicule et d’afficher le prix immédiatement.'],
      },
    ],
    faq: [
      {
        q: 'Puis-je teinter mes vitres arrière en 5 % ?',
        a: 'Oui. Les vitres latérales arrière et la lunette arrière ne sont soumises à aucun seuil minimal de transmission lumineuse.',
      },
      {
        q: 'Le film est-il visible au contrôle technique ?',
        a: 'Le contrôle technique vérifie notamment l’état et la visibilité à travers le pare-brise. À l’avant, respectez le seuil de 70 % : c’est la règle que les forces de l’ordre peuvent contrôler avec un appareil de mesure.',
      },
    ],
  },
  {
    slug: 'feux-teintes-legal',
    title: 'Feux arrière teintés : est-ce légal ?',
    seo: {
      title: 'Feux teintés ou fumés : est-ce légal ? | SOLAR CAR 37',
      description:
        'Film fumé sur les feux : homologation, visibilité, contrôle technique, réversibilité. Ce qu’il faut savoir avant de teinter vos feux.',
    },
    kicker: 'Réglementation',
    updated: '2026-10-13',
    service: 'feux-arriere-teintes',
    still: 'tail',
    intro:
      'Les feux fumés donnent un regard plus sombre et plus homogène à la voiture. Ils touchent pourtant à un élément de sécurité : voici les règles à connaître avant de vous décider.',
    sections: [
      {
        h2: 'Des feux homologués, qui doivent rester visibles',
        p: [
          'Les dispositifs d’éclairage et de signalisation d’un véhicule sont homologués : leur couleur et leur intensité lumineuse sont encadrées. Un film posé sur un feu modifie la lumière qu’il émet et peut le rendre non conforme pour circuler sur la voie publique.',
          'Plus le film est foncé, plus le risque est élevé : un feu stop ou un clignotant doit rester parfaitement perceptible de jour comme de nuit.',
        ],
      },
      {
        h2: 'Arrière ou avant : pas le même enjeu',
        p: [
          'Les feux avant éclairent la route : réduire leur puissance dégrade votre visibilité de nuit. C’est pourquoi nous déconseillons les films sombres sur les phares. À l’arrière, un fumé léger change l’allure sans éteindre le feu, mais le principe de conformité reste le même.',
        ],
      },
      {
        h2: 'Contrôle technique et contrôles routiers',
        p: [
          'Un feu dont la couleur ou l’intensité est altérée peut être relevé lors du contrôle technique ou d’un contrôle routier.',
        ],
      },
      {
        h2: 'Nos recommandations',
        list: [
          'privilégier un fumé 50 % plutôt qu’un 80 % si le véhicule circule beaucoup de nuit ;',
          'vérifier la visibilité feux allumés et au freinage avant de valider (notre simulateur 3D le montre) ;',
          'retenir qu’une simulation montre un rendu : elle ne prouve pas qu’un feu filmé reste conforme.',
        ],
        p: [`À l’atelier, le covering fumé est facturé ${P.lightsPair} TTC la paire de feux selon le véhicule ; le PPF teinté, plus épais, est chiffré sur devis.`],
      },
    ],
    faq: [
      {
        q: 'Le film fumé est-il réversible ?',
        a: 'En principe oui : un film de qualité se dépose sans abîmer l’optique, par exemple avant une revente. Nous vous indiquons les précautions selon le matériau.',
      },
    ],
  },
  {
    slug: 'phares-jaunis-renovation',
    title: 'Phares jaunis ou opaques : pourquoi et comment les rénover',
    seo: {
      title: `Phares jaunis : causes et rénovation (${P.headlights} la paire) | SOLAR CAR 37`,
      description:
        `Pourquoi les optiques jaunissent, ce que change une rénovation (ponçage, polissage, protection) et quand remplacer le phare. Rénovation des deux phares ${P.headlights} TTC près de Tours.`,
    },
    kicker: 'Entretien',
    updated: '2026-10-13',
    service: 'renovation-phares',
    still: 'headlights',
    intro:
      'Avec les années, la plupart des optiques de phares en plastique jaunissent et se voilent. Bonne nouvelle : dans la majorité des cas, une rénovation leur rend leur transparence pour une fraction du prix d’un phare neuf.',
    sections: [
      {
        h2: 'Pourquoi les phares jaunissent',
        p: [
          'Les optiques modernes sont en polycarbonate, protégé en usine par un vernis anti-UV. Soleil, intempéries, lavages et projections usent ce vernis : le plastique s’oxyde, jaunit, devient mat et peut se microfissurer en surface.',
        ],
      },
      {
        h2: 'Ce que vous y perdez',
        list: [
          'un éclairage moins puissant et plus diffus, donc une moins bonne visibilité de nuit ;',
          'davantage d’éblouissement pour les autres usagers, la lumière étant dispersée ;',
          'un aspect vieilli de toute la face avant ;',
          'une optique très dégradée peut être relevée au contrôle technique.',
        ],
      },
      {
        h2: 'Comment se déroule une rénovation',
        list: [
          'nettoyage et protection de la carrosserie autour du phare ;',
          'ponçage progressif à l’eau pour retirer la couche oxydée ;',
          'polissage jusqu’à retrouver une transparence complète ;',
          'application d’une protection pour ralentir le retour du jaunissement.',
        ],
        p: [
          `À l’atelier, la rénovation des deux phares est à ${P.headlights} TTC. Le traitement céramique en option (${P.headlightsCeramic}) ajoute une couche de protection sur l’optique.`,
        ],
      },
      {
        h2: 'Quand faut-il remplacer plutôt que rénover ?',
        p: [
          'La rénovation traite la surface extérieure de l’optique. Si la buée ou l’humidité est à l’intérieur du phare, si le réflecteur est abîmé ou si l’optique est fendue, il faut réparer ou remplacer le bloc : nous vous le disons avant d’intervenir.',
        ],
      },
    ],
    faq: [
      {
        q: 'Combien de temps tient une rénovation de phares ?',
        a: 'Cela dépend de l’exposition au soleil et de l’entretien. La couche de protection finale est ce qui fait durer le résultat : c’est l’intérêt du traitement céramique proposé en option.',
      },
    ],
  },
  {
    slug: 'ciel-etoile-voiture',
    title: 'Ciel étoilé dans la voiture : comment ça marche ?',
    seo: {
      title: 'Ciel étoilé voiture : fonctionnement et options | SOLAR CAR 37',
      description:
        'Fibre optique, générateur LED, scintillement, étoiles filantes, constellation : comment se pose un ciel étoilé dans le pavillon d’une voiture.',
    },
    kicker: 'Personnalisation',
    updated: '2026-10-13',
    service: 'ciel-etoile',
    still: 'stars',
    intro:
      'Popularisé par les voitures de grand luxe, le ciel étoilé transforme le pavillon en voûte céleste. Voici comment il est conçu et posé, et les options à choisir.',
    sections: [
      {
        h2: 'Le principe : la fibre optique',
        p: [
          'Chaque étoile est l’extrémité d’une fibre optique. Toutes les fibres partent d’un petit générateur à LED dissimulé dans le pavillon ou derrière un garnissage : c’est lui qui produit la lumière, sa couleur et ses effets.',
        ],
      },
      {
        h2: 'La pose, étape par étape',
        list: [
          'dépose du ciel de toit (le garnissage du pavillon) ;',
          'perçage des points d’étoiles selon la densité et le motif choisis ;',
          'passage des fibres, collage, puis coupe au ras du garnissage ;',
          'repose du ciel de toit, raccordement électrique du générateur et réglages.',
        ],
        p: [
          'Le garnissage étant percé, l’opération n’est pas réversible à l’identique : mieux vaut bien choisir sa configuration, d’où notre simulateur 3D.',
        ],
      },
      {
        h2: 'Les options',
        list: [
          'densité : de quelques centaines à plus d’un millier d’étoiles ;',
          'couleur unie ou bicolore ;',
          'scintillement, pour des étoiles qui vibrent doucement ;',
          'étoiles filantes, qui traversent le ciel par intermittence ;',
          'constellation reproduite fidèlement (Grande Ourse, Orion…).',
        ],
      },
      {
        h2: 'Le prix',
        p: [
          'Le tarif dépend du véhicule, de la surface du pavillon et des options : il est établi sur devis. Configurez votre ciel dans le simulateur, puis envoyez-le : nous revenons vers vous avec un devis détaillé.',
        ],
      },
    ],
    faq: [
      {
        q: 'Le ciel étoilé gêne-t-il la conduite de nuit ?',
        a: 'L’intensité se règle : l’ambiance reste douce et ne doit pas éblouir le conducteur.',
      },
    ],
  },
  {
    slug: 'polissage-ceramique-cire',
    title: 'Polissage, céramique ou cire : quelle protection pour votre peinture ?',
    seo: {
      title: 'Polissage, céramique ou cire : les différences | SOLAR CAR 37',
      description:
        'Micro-rayures, hologrammes, perte de brillance : ce que corrige un polissage, et ce qu’apportent cire, scellant et protection céramique.',
    },
    kicker: 'Detailing',
    updated: '2026-10-13',
    service: 'detailing-carrosserie',
    still: 'detailing',
    intro:
      'Une peinture qui a perdu son éclat n’est souvent pas « usée » : elle est couverte de micro-rayures. Polissage et protection sont deux étapes différentes, et complémentaires.',
    sections: [
      {
        h2: 'D’où viennent les micro-rayures',
        p: [
          'Lavages aux rouleaux, éponges chargées de grains, chiffons secs : chaque frottement raye très légèrement le vernis. Au soleil ou sous un éclairage LED, ces rayures dessinent des cercles autour des reflets, les fameux « hologrammes », et la peinture paraît voilée.',
        ],
      },
      {
        h2: 'Le polissage corrige',
        p: [
          'Le polissage retire une très fine épaisseur de vernis pour niveler la surface : les micro-rayures disparaissent et les reflets redeviennent nets, comme un miroir. Selon l’état de la peinture, il se fait en une ou plusieurs étapes.',
          'Une rayure qui a traversé le vernis ne se polit pas : elle relève de la retouche ou de la carrosserie. Nous mesurons et examinons la peinture avant de proposer un forfait.',
        ],
      },
      {
        h2: 'La protection préserve',
        list: [
          'la cire : brillance chaude, protection de quelques semaines ;',
          'le scellant synthétique : plus résistant, de l’ordre de quelques mois ;',
          'le revêtement céramique : une couche dure et hydrophobe qui protège plus longtemps et facilite le lavage, selon le produit et l’entretien.',
        ],
        p: [
          'Aucune protection ne rend une peinture inrayable : elle la rend plus résistante et plus facile à entretenir. Un lavage doux reste indispensable.',
        ],
      },
      {
        h2: 'Dans quel ordre ?',
        p: [
          'Toujours décontaminer (lavage, décontaminant ferreux, argile), puis polir, puis protéger : une céramique posée sur une peinture micro-rayée figerait les défauts sous la couche.',
          'Nos forfaits Essentiel, Éclat et Signature céramique suivent cet ordre ; le prix est établi sur devis, après examen du véhicule.',
        ],
      },
    ],
    faq: [
      {
        q: 'Le polissage abîme-t-il la peinture ?',
        a: 'Réalisé avec méthode, il retire une épaisseur infime de vernis. C’est pourquoi on ne repolit pas une voiture à chaque lavage : une protection prend ensuite le relais.',
      },
    ],
  },
  {
    slug: 'prix-vitres-teintees-tours',
    title: 'Prix des vitres teintées près de Tours : ce qui fait le tarif',
    seo: {
      title: `Prix vitres teintées près de Tours : dès ${P.tintFrom} TTC | SOLAR CAR 37`,
      description: `Tarifs de pose de films solaires à Vouvray, près de Tours : 3/4 arrière dès ${P.tintFrom} TTC selon la catégorie, vitres avant, pare-brise. Ce qui fait varier le prix.`,
    },
    kicker: 'Tarifs',
    updated: '2026-10-13',
    service: 'vitres-teintees',
    still: 'tint',
    intro:
      'Combien coûte la pose de vitres teintées ? À l’atelier, le prix dépend d’abord de la catégorie du véhicule et des vitres traitées, pas de la teinte. Voici nos tarifs indicatifs et ce qui peut les faire varier.',
    sections: [
      {
        h2: 'Nos tarifs indicatifs',
        p: ['Forfait « 3/4 arrière » (vitres latérales arrière et lunette), film posé, prix TTC :'],
        list: vehicleTypes.map((v) => `${v.label} : ${tint.rearPackage[v.id]} € ;`),
      },
      {
        h2: 'Vitres avant et pare-brise',
        p: [
          `Les deux vitres avant seules coûtent ${P.tintFrontOnly} TTC ; ajoutées au forfait arrière, elles comptent ${P.tintFrontWithRear}. Le film de pare-brise est chiffré à part (${P.windshield('athermique')} TTC pour le film athermique).`,
          'À l’avant, la règle des 70 % de lumière transmise s’applique au vitrage complet, film compris : nous faisons le point avec vous avant toute pose (voir notre guide sur la loi).',
        ],
      },
      {
        h2: 'Ce qui fait varier le prix',
        list: [
          'la catégorie du véhicule : nombre, taille et forme des vitres ;',
          'la lunette arrière : une grande lunette très bombée demande plus de temps de mise en forme du film ;',
          'un ancien film à déposer : il allonge l’intervention, nous le précisons sur le devis ;',
          'les vitres traitées : arrière seul, véhicule complet, pare-brise.',
        ],
        p: ['La teinte, elle, ne change pas le prix : 5 %, 15 %, 25 %, 35 %, 50 % ou 70 % sont au même tarif.'],
      },
      {
        h2: 'Obtenir votre prix exact',
        p: [
          'Le simulateur 3D de la page vitres teintées affiche le tarif de votre catégorie en direct, avec la teinte choisie. Le devis confirme ensuite le prix après un coup d’œil au véhicule.',
        ],
      },
    ],
    faq: [
      { q: 'Le prix dépend-il de la teinte choisie ?', a: 'Non : toutes les teintes proposées sont au même prix. Le tarif dépend de la catégorie du véhicule et des vitres traitées.' },
      { q: 'Combien coûtent les vitres avant ?', a: `${P.tintFrontOnly} TTC seules, ou ${P.tintFrontWithRear} avec le forfait arrière. Attention à la règle des 70 % à l’avant, film compris.` },
    ],
  },
  {
    slug: 'choisir-teinte-vitres',
    title: 'Vitres teintées : 5 %, 15 %, 25 %, 35 % ou 50 %, quelle teinte choisir ?',
    seo: {
      title: 'Teinte vitres : 5 %, 15 %, 25 %, 35 %, que choisir ? | SOLAR CAR 37',
      description: 'Ce que veut dire le pourcentage d’un film teinté, le rendu de chaque teinte, la visibilité de nuit, la chaleur et la règle des 70 % à l’avant.',
    },
    kicker: 'Conseils',
    updated: '2026-10-13',
    service: 'vitres-teintees',
    still: 'tint',
    intro:
      'Le pourcentage d’un film teinté n’est pas une intensité de « noir » : c’est la part de lumière visible qui le traverse. Plus le chiffre est bas, plus la vitre est sombre. Voici comment choisir.',
    sections: [
      {
        h2: 'Que veut dire le pourcentage ?',
        p: [
          'Un film à 15 % laisse passer environ 15 % de la lumière visible ; un film à 50 % en laisse passer la moitié. Posé sur une vitre, le film s’ajoute à la teinte d’origine du verre : le vitrage complet est donc toujours un peu plus sombre que le chiffre du film seul.',
        ],
      },
      {
        h2: 'Le rendu de chaque teinte',
        list: [
          '5 % : noir profond, intérieur quasiment invisible de l’extérieur ;',
          '15 % : forte intimité, le choix le plus courant à l’arrière ;',
          '25 % : sombre, avec un peu plus de visibilité vers l’extérieur la nuit ;',
          '35 % : teinte bien visible, ambiance plus claire à bord ;',
          '50 % : teinte légère, surtout pour l’esthétique et l’éblouissement ;',
          '70 % : voile très léger.',
        ],
      },
      {
        h2: 'Visibilité de nuit et marche arrière',
        p: [
          'Plus la lunette est sombre, moins on voit à travers la nuit, en particulier en marche arrière. Les vitres arrière ne sont pas soumises à un seuil, à condition que le véhicule dispose de deux rétroviseurs extérieurs : pensez à votre usage (stationnement de nuit, routes non éclairées) avant de choisir le plus foncé.',
        ],
      },
      {
        h2: 'La chaleur ne dépend pas que de la teinte',
        p: [
          'Le pourcentage décrit la lumière visible, pas la chaleur. Un film clair de technologie céramique peut filtrer davantage d’infrarouges qu’un film plus sombre simplement teinté. Pour le confort thermique, c’est la technologie du film qui compte, plus que sa couleur.',
        ],
      },
      {
        h2: 'À l’avant : la règle des 70 %',
        p: [
          `Le pare-brise et les vitres latérales avant doivent laisser passer au moins ${G.frontMin} % de la lumière, vitre et film ensemble. Un film à 70 % posé sur une vitre d’origine fait en général descendre l’ensemble sous ce seuil : à l’avant, seule une mesure sur le véhicule permet de conclure.`,
        ],
      },
    ],
    faq: [
      { q: 'Quelle teinte pour l’intimité sans trop assombrir ?', a: 'Le 15 % à 25 % à l’arrière est le compromis le plus demandé : bonne intimité, visibilité correcte vers l’extérieur.' },
      { q: 'Peut-on voir le rendu avant la pose ?', a: 'Oui : le simulateur 3D montre chaque teinte sur votre catégorie de véhicule, de l’extérieur et depuis l’habitacle, et nous vous montrons les échantillons à l’atelier.' },
    ],
  },
  {
    slug: 'film-nano-ceramique',
    title: 'Film nano-céramique : comment il filtre la chaleur',
    seo: {
      title: 'Film nano-céramique pour vitres : principe et intérêt | SOLAR CAR 37',
      description: 'Film teinté, métallisé ou nano-céramique : comment chacun agit sur la lumière et la chaleur, et pourquoi le pourcentage de teinte ne dit pas tout.',
    },
    kicker: 'Technologie',
    updated: '2026-10-13',
    service: 'vitres-teintees',
    still: 'tint',
    intro:
      'Tous les films solaires ne se valent pas. À teinte égale, un film nano-céramique et un film simplement teinté n’ont pas le même effet sur la chaleur. Voici les différences, sans jargon.',
    sections: [
      {
        h2: 'Trois grandes familles de films',
        list: [
          'film teinté dans la masse : il assombrit la vitre en absorbant la lumière ; c’est le plus simple ;',
          'film métallisé : de fines couches métalliques réfléchissent une partie de l’énergie solaire ; il peut gêner certaines ondes (téléphone, GPS, télépéage) ;',
          'film nano-céramique : des particules céramiques filtrent une partie du rayonnement infrarouge, sans métal, donc sans gêner les ondes.',
        ],
      },
      {
        h2: 'Pourquoi la céramique pour la chaleur',
        p: [
          'Une grande partie de la chaleur du soleil arrive sous forme d’infrarouges, invisibles. Les particules céramiques sont choisies pour en filtrer une part tout en laissant passer la lumière visible voulue : un film céramique clair peut ainsi améliorer le confort sans assombrir beaucoup la vitre.',
        ],
      },
      {
        h2: 'Lire une fiche technique',
        list: [
          'transmission lumineuse (en %) : la teinte, ce que voit l’œil ;',
          'rejet d’énergie solaire totale : la part de la chaleur du soleil qui n’entre pas ;',
          'rejet des infrarouges et des UV : à lire selon la longueur d’onde indiquée.',
        ],
        p: ['Ces valeurs varient d’une référence à l’autre : nous vous indiquons la référence posée et ses caractéristiques sur le devis.'],
      },
      {
        h2: 'Et la loi ?',
        p: [
          `La technologie ne change rien à la règle : à l’avant, le vitrage complet doit laisser passer au moins ${G.frontMin} % de la lumière, film compris. À l’arrière, la teinte est libre (véhicule équipé de deux rétroviseurs extérieurs).`,
        ],
      },
    ],
    faq: [
      { q: 'Un film céramique clair chauffe-t-il moins qu’un film foncé ?', a: 'Cela peut être le cas : la chaleur dépend surtout de la technologie du film, pas seulement de sa teinte. Comparez les fiches techniques des références proposées.' },
      { q: 'Le film céramique gêne-t-il le téléphone ou le GPS ?', a: 'Non, il ne contient pas de couche métallique, contrairement aux films métallisés.' },
    ],
  },
];
