/**
 * Covering: the long-form sections of the service page /covering-dechromage/ (rendered by
 * `richSections` in src/templates/pages.js) and extra FAQ entries. The déchromage has its own
 * page (/dechromage/, content/sections/dechromage.js): it is only linked from here.
 *
 * Everything reads « Sur devis ». Nothing here may promise a warranty, a lifespan or a duration
 * of the workshop's own work (« selon le véhicule, confirmé au devis »). Durability belongs to
 * the film makers' technical sheets and is always presented as their claim, never as a figure.
 *
 * Colour change and registration (checked in November 2026, from secondary sources only: the
 * official pages could not be opened from the writing session): a certificat d'immatriculation
 * must be updated when a transformation changes a characteristic printed on it, and the French
 * certificate is reported to carry no colour field. The copy says so cautiously and sends the
 * reader to service-public.fr / ANTS and to the insurer. Re-check on service-public.fr
 * (« Véhicule modifié et certificat d'immatriculation ») before going live.
 *
 * FAQ answers are plain text (no *emphasis*, no links): faqBlock escapes them.
 */

export const sections = [
  {
    type: 'blocks',
    id: 'zones-habillage',
    title: 'Complet, partiel ou simples accents : *jusqu’où habiller*',
    lead: 'Un covering voiture ne se résume pas à « tout ou rien ». Chaque zone se décide séparément, avec sa propre référence de film, et le devis suit exactement ce que vous retenez.',
    items: [
      {
        title: 'Toute la carrosserie',
        text: [
          'Ailes, portières, capot, hayon, boucliers et bas de caisse prennent la nouvelle teinte. C’est la façon la plus nette de changer la couleur de sa voiture, et la plus exigeante en démontage.',
          'Sur une carrosserie très découpée (prises d’air, becquet intégré, arêtes vives), quelques raccords peuvent être nécessaires. Leur emplacement se décide avant la pose : vous savez où ils seront.',
        ],
      },
      {
        title: 'Les encadrements de portes',
        text: [
          'Portière ouverte, l’ancienne couleur reste visible sur les feuillures et les montants si seul l’extérieur est habillé. Les traiter aussi rend le changement plus complet, au prix de démontages et d’un temps de pose supplémentaires.',
          'C’est une option à part entière, étudiée selon le véhicule et indiquée clairement sur le devis.',
        ],
      },
      {
        title: 'Toit, capot et rétroviseurs',
        text: [
          'Un toit noir brillant affine la silhouette et prolonge visuellement des vitres teintées ; un capot mat ou carbone durcit le regard ; des coques de rétroviseurs contrastées suffisent parfois à personnaliser une voiture discrète.',
          'Le toit et le capot, à plat face au soleil, sont les zones les plus exposées : le choix du film en tient compte.',
        ],
      },
      {
        title: 'Becquet, lames et bas de caisse',
        text: ['Un becquet, une lame avant, des jupes latérales ou un diffuseur habillés de noir ou de carbone soulignent les lignes basses du véhicule sans toucher au reste de la carrosserie.'],
      },
      {
        title: 'Filets, bandes et accents',
        text: [
          'Deux bandes sur le capot, un liseré sur le bouclier, des filets de couleur le long des bas de caisse : de petites touches qui transforment une silhouette. La Mercedes Classe A grise relevée d’orange, visible dans nos [réalisations](/realisations/), en est un exemple.',
          'Les jantes, exposées à la chaleur des freins et aux nettoyants, ne se traitent pas comme une carrosserie : une telle demande s’étudie au cas par cas.',
        ],
      },
      {
        title: 'Et les chromes ?',
        text: ['Calandre, entourages de vitres, baguettes : les pièces chromées se traitent à part, avec ou sans covering de la carrosserie. Tout est détaillé sur notre page consacrée au [déchromage](/dechromage/).'],
      },
    ],
  },
  {
    type: 'blocks',
    id: 'finitions-effets',
    title: 'Brillant, mat, chrome : *ce que chaque finition implique*',
    lead: 'Une finition change l’allure du véhicule, mais aussi la manière de le laver et de le réparer. Avant de vous décider, voici les contraintes propres à chacune.',
    items: [
      {
        title: 'Brillant',
        text: ['Le rendu le plus proche d’une peinture d’usine : des reflets nets, des lignes lisibles. En contrepartie, un film brillant montre les micro-rayures de lavage comme le ferait un vernis, et réclame les mêmes gestes doux.'],
      },
      {
        title: 'Satiné',
        text: ['Des reflets adoucis et une teinte qui paraît plus dense. Le satiné marque moins les traces que le brillant, mais il ne se polit pas : une cire ou un produit lustrant y laisserait des zones plus brillantes que le reste.'],
      },
      {
        title: 'Mat',
        text: ['Sans aucun reflet, le mat fait ressortir les volumes et les arêtes. Il demande des produits sans cire ni agent brillant, et une intervention rapide sur les fientes, la sève ou les gouttes de carburant, qui peuvent marquer la surface.'],
      },
      {
        title: 'Métallisé, nacré, color flip',
        text: [
          'Paillettes et pigments à effet réagissent à l’angle de la lumière. Pour un rendu homogène, tous les panneaux doivent être posés dans le même sens, idéalement avec un film issu d’un même lot de fabrication.',
          'Un color flip se juge au soleil, à l’ombre et sous un éclairage artificiel : sa teinte change réellement d’une situation à l’autre.',
        ],
      },
      {
        title: 'Carbone',
        text: ['La texture carbone reproduit le tissage d’une pièce composite, parfois avec un léger relief au toucher. Elle se prête surtout aux accents : coques de rétroviseurs, toit, becquet, inserts de bouclier.'],
      },
      {
        title: 'Chrome et effets miroir',
        text: ['Les films chromés, comme l’or miroir d’une BMW passée par l’atelier, sont les plus spectaculaires et les plus délicats. Ils s’étirent moins, révèlent le moindre défaut de la surface et se rayent plus facilement : ils conviennent aux projets où ces contraintes sont acceptées en connaissance de cause.'],
      },
    ],
  },
  {
    type: 'prose',
    id: 'choisir-teinte',
    kicker: 'Nuanciers à l’atelier',
    title: 'Bien choisir sa couleur *sur nuancier*',
    text: [
      'Une teinte vue sur un écran ou sur une photo ne dit presque rien du rendu final. Les gammes des marques que nous posons, Avery Dennison, 3M™, Oracal, TeckWrap, APA ou Ravoony, se consultent à Vouvray, près de Tours, lors d’un rendez-vous : c’est là que le choix se fait vraiment.',
      'Un nuancier montre la couleur à plat. Sur une carrosserie, la même référence paraît plus claire sur les arrondis qui accrochent la lumière et plus sombre dans les creux. L’échantillon est donc présenté contre votre véhicule, sur une aile ou une portière, puis regardé dehors, en plein jour et à l’ombre.',
      'Pensez aussi à tout ce qui ne changera pas : jantes, plastiques noirs, vitres teintées, feux et chromes. Une teinte séduisante seule peut mal s’accorder avec eux, et c’est souvent là qu’un [déchromage](/dechromage/) complète utilement un covering.',
      'Chaque finition vit enfin à sa façon : un blanc montre vite la poussière de route, un noir brillant les traces de lavage, un mat les marques de doigts. Mieux vaut choisir une couleur avec laquelle vous serez à l’aise au quotidien, pas seulement le jour de la livraison.',
    ],
    points: [
      'Apportez des photos de véhicules dont la teinte vous plaît : elles orientent la recherche dans les nuanciers.',
      'Regardez chaque échantillon sur une zone plane, puis sur une zone bombée.',
      'Comparez deux ou trois références voisines côte à côte plutôt qu’une seule.',
      'Notez la référence exacte retenue : elle figure sur le devis et resservira en cas de réparation.',
      'Des teintes déjà posées figurent dans nos [réalisations](/realisations/) ; pour venir, l’itinéraire est indiqué sur la page de [l’atelier](/atelier-vouvray/).',
    ],
  },
  {
    type: 'blocks',
    id: 'tenue-covering',
    title: 'Ce qui fait durer *un covering*',
    lead: 'Il n’existe pas de durée unique. Les fabricants publient une durabilité dans la fiche technique de chaque gamme, souvent distincte pour les surfaces verticales et horizontales : ce sont leurs valeurs annoncées, établies dans des conditions définies, et non un engagement de l’atelier. Sur la route, cinq facteurs font la différence.',
    items: [
      {
        title: 'Film coulé ou calandré',
        text: [
          'Un film *coulé* est obtenu en étalant la matière en couche très fine sur un support, puis en la séchant : il ne subit presque aucune contrainte et garde ses dimensions une fois posé. Il épouse creux et galbes sans chercher à revenir à sa forme initiale.',
          'Un film *calandré* est laminé entre des rouleaux. Plus rigide, il conserve une « mémoire » qui le pousse à se rétracter avec le temps : il convient aux surfaces planes et aux usages courts, beaucoup moins à une carrosserie entière.',
        ],
      },
      {
        title: 'L’exposition',
        text: ['Le toit, le capot et le haut du hayon prennent le soleil de plein fouet, la pluie et les retombées : ils vieillissent plus vite que les portières. Une voiture rangée au garage ou sous abri garde son film plus longtemps qu’une voiture dehors toute l’année.'],
      },
      {
        title: 'La teinte et l’effet',
        text: ['À gamme égale, les références ne réagissent pas toutes de la même façon aux UV : les fabricants annoncent souvent une durabilité plus courte pour certains effets, comme les chromes ou les films à reflets changeants, que pour les teintes unies. La fiche technique de la référence choisie fait foi.'],
      },
      {
        title: 'La préparation et la pose',
        text: ['Un film posé sur une surface mal dégraissée, trop étiré dans un creux ou mal chauffé sur un bord finit par se soulever. Le nettoyage, la tension du film et la *post-chauffe* des zones étirées, qui fige le film dans sa nouvelle forme, comptent autant que la marque.'],
      },
      {
        title: 'L’entretien',
        text: [
          'Shampoing doux, gant microfibre, séchage par tamponnage. Les fientes, la sève, les insectes et les éclaboussures de carburant autour de la trappe se retirent sans attendre ; la lance haute pression reste éloignée et n’est jamais braquée sur un bord de film.',
          'Certaines protections sont formulées pour les films, mats compris : demandez-nous si elles ont du sens pour votre référence. Et le jour où le film est retiré, un [detailing](/detailing-carrosserie/) ravive la peinture d’origine.',
        ],
      },
    ],
  },
  {
    type: 'prose',
    id: 'couleur-carte-grise',
    kicker: 'Démarches',
    title: 'Changer de couleur : *carte grise, assurance, revente*',
    text: [
      'En France, le certificat d’immatriculation doit être mis à jour lorsqu’une transformation modifie l’une des caractéristiques qui y sont inscrites. D’après les informations publiées à ce sujet, la couleur ne compte pas parmi les rubriques du certificat français : un covering ne devrait donc pas imposer de nouvelle carte grise. Nous ne sommes pas juristes et les règles évoluent : vérifiez la situation en vigueur sur service-public.fr ou auprès de l’ANTS avant la pose.',
      'L’assurance est le point le plus concret. Votre contrat peut vous demander de signaler les modifications apportées au véhicule : un appel ou un courriel à votre assureur, en précisant la nouvelle teinte, évite toute discussion en cas de sinistre ou de vol.',
      'Gardez la facture et quelques photos avant et après la pose : elles servent auprès de l’assureur, en cas de vol et au moment de vendre. Deux options s’offrent alors à vous : céder la voiture avec son covering, ou faire retirer le film pour retrouver la teinte d’origine, restée dessous.',
      'Pour en parler, passez à l’atelier de Vouvray ou [présentez-nous votre projet](/contact/?prestation=covering-dechromage) : modèle, année, zones à habiller et, si vous l’avez déjà repérée, la référence qui vous tente. L’atelier reçoit des automobilistes venus de Tours comme du reste de l’Indre-et-Loire.',
    ],
  },
];

export const faq = [
  {
    q: 'Peut-on poser un covering sur une voiture en leasing (LLD ou LOA) ?',
    a: 'Le film ne touche pas à la peinture, mais c’est votre contrat qui décide. Un contrat de location demande en général de rendre le véhicule dans son état d’origine, et certains exigent l’accord du loueur avant toute modification. Relisez-le, interrogez le loueur si besoin, et prévoyez la dépose du film avant la restitution.',
  },
  {
    q: 'Le covering cache-t-il les rayures et les bosses ?',
    a: 'Non. Le film épouse la surface sur laquelle il est posé : une micro-rayure peut disparaître dessous, mais un sillon profond, un impact de gravillon ou un enfoncement restent visibles, parfois davantage avec un film brillant. Ces défauts se réparent avant la pose ; nous vous les signalons lors de l’étude du véhicule.',
  },
  {
    q: 'Faut-il refaire la carte grise après un changement de couleur ?',
    a: 'La carte grise est à actualiser quand une transformation touche une caractéristique imprimée dessus. Selon les sources que nous avons consultées, le certificat français ne mentionne pas la couleur, si bien qu’un covering ne devrait entraîner aucune démarche de ce côté. Confirmez-le auprès de l’ANTS ou sur le site service-public.fr, et informez votre assureur de la nouvelle teinte.',
  },
  {
    q: 'Quand peut-on laver la voiture après la pose ?',
    a: 'La colle du film continue de prendre pendant quelques jours. Les fabricants recommandent un délai avant le premier lavage, variable selon le film : nous vous le précisons à la restitution. Ensuite, lavez à la main ou au jet sans contact, et évitez les portiques à rouleaux.',
  },
  {
    q: 'Un panneau abîmé peut-il être refait seul ?',
    a: 'Oui. Après un accrochage ou une rayure, le panneau concerné peut être habillé de nouveau avec la même référence, sans reprendre toute la voiture. Selon l’âge du covering et le lot de film, une légère différence de teinte avec les panneaux voisins reste possible : d’où l’intérêt de conserver la référence exacte posée.',
  },
  {
    q: 'Combien de temps dure un covering ?',
    a: 'Il n’y a pas de réponse unique : la tenue dépend du film, de sa teinte, de l’exposition au soleil, du stationnement et de l’entretien. Chaque fabricant publie une durabilité pour ses gammes ; c’est sa propre valeur, pas une garantie de notre part. Nous vous indiquons ce que dit la fiche du film retenu.',
  },
  {
    q: 'Pendant combien de jours faut-il confier la voiture ?',
    a: 'Cela dépend du véhicule, des surfaces habillées, des démontages et du film : un toit ou des rétroviseurs ne demandent pas le même temps qu’un covering complet avec encadrements de portes. La durée d’immobilisation est confirmée au devis, et la date de dépôt convenue avec vous.',
  },
  {
    q: 'Un covering fait-il perdre de la valeur à la voiture ?',
    a: 'La peinture d’origine reste sous le film, à l’abri du soleil et des petites agressions du quotidien. À la revente, vous pouvez garder le film ou le faire retirer : l’acheteur retrouve alors la teinte d’origine, à condition que la peinture ait été saine au moment de la pose. Après un covering partiel, les zones protégées peuvent paraître un peu plus fraîches que celles restées exposées.',
  },
];
