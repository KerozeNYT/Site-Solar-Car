/**
 * Vitres teintées: the long-form sections of the service page (rendered by `richSections` in
 * src/templates/pages.js, below the simulator) and extra FAQ entries.
 *
 * Every price comes from content/pricing.js and every legal figure from content/regulation.js:
 * nothing here is typed by hand, so a price or a rule changes in one place. The road status of
 * each shade (front windows, windscreen) is computed with `roadStatus()`, like the simulator.
 *
 * Nothing here names the brand of film fitted or promises a warranty, a duration or a heat
 * rejection figure: the reference proposed and its data sheet are given on the quote.
 *
 * FAQ answers are plain text (no *emphasis*, no links): faqBlock escapes them.
 */
import { tint, priceText, formatPrice } from '../pricing.js';
import { glazing as G, onTypicalGlass, roadStatus } from '../regulation.js';
import { realisations } from '../realisations.js';

// ------------------------------------------------------------------------- figures
const eur = (n) => (tint.validated ? formatPrice(n) : 'Sur devis');
const ttc = (n) => (tint.validated ? `${formatPrice(n)} TTC` : 'sur devis');
const rearPrices = Object.values(tint.rearPackage);
const fullMin = Math.min(...rearPrices) + tint.frontWithRear;
const fullMax = Math.max(...rearPrices) + tint.frontWithRear;
const shades = [...tint.shades].sort((a, b) => a - b);
const darkest = shades[0];
const lightest = shades[shades.length - 1];
/** "a, b et c" */
const joinList = (word) => (a) => (a.length < 2 ? a.join('') : `${a.slice(0, -1).join(', ')} ${word} ${a[a.length - 1]}`);
const andList = joinList('et');
const orList = joinList('ou');
const NUMBERS = ['Zéro', 'Une', 'Deux', 'Trois', 'Quatre', 'Cinq', 'Six', 'Sept', 'Huit', 'Neuf', 'Dix'];
const count = (n) => NUMBERS[n] || String(n);

const windshield = (id) => tint.windshield.films.find((f) => f.id === id);
const athermique = windshield('athermique');
const irise = windshield('irise');
// windscreen films that can never stay above the threshold: shown in the simulator only
const darkWindshield = tint.windshield.films.filter((f) => roadStatus('windshield', f.vlt).id === 'no');
const iriseColors = orList(tint.windshield.colors.map((c) => c.label.toLowerCase()));

/** what a shade means on the front windows, from the same rule as the simulator */
const frontVerdict = (v) =>
  ({
    no: 'Non autorisé sur route',
    risk: 'En général sous le seuil : mesure indispensable',
    check: 'Possible, à vérifier par mesure',
  })[roadStatus('front', v).id];

// ------------------------------------------------------------------------- price grid rows
// The vehicle types of the simulator, each mapped to a pricing category of content/pricing.js.
// `cat: null` = specific package, priced on quote.
const vehicleRows = [
  { label: 'Petite citadine', example: 'Fiat 500', cat: 'citadine' },
  { label: 'Citadine', example: 'Audi A3 Sportback', cat: 'citadine' },
  { label: 'Berline', example: 'BMW Série 3', cat: 'berline' },
  { label: 'Cabriolet', example: 'Audi A4 Cabriolet', cat: 'coupe' },
  { label: 'Coupé', example: 'BMW Série 2', cat: 'coupe' },
  { label: 'Break', example: 'Audi A6 Avant', cat: 'break' },
  { label: 'Monospace', example: 'Renault Espace', cat: 'suv' },
  { label: 'SUV', example: 'BMW X5', cat: 'suv' },
  { label: 'Tesla Model 3', example: null, cat: null },
  { label: 'Utilitaire', example: 'Volkswagen Transporter', cat: 'utilitaire' },
];

const priceRow = ({ label, example, cat }) =>
  cat
    ? [`${label} (ex. ${example})`, eur(tint.rearPackage[cat]), eur(tint.frontOnly), eur(tint.rearPackage[cat] + tint.frontWithRear)]
    : [`${label} (forfait spécifique)`, 'Sur devis', 'Sur devis', 'Sur devis'];

// ------------------------------------------------------------------------- shades
// How each shade usually looks. A shade added to content/pricing.js without a line here still
// gets its row (empty description) until it is written.
const shadeLook = {
  5: ['Noir profond : l’habitacle reste invisible en plein jour', 'Paysage nettement assombri ; de nuit, on distingue surtout les éclairages', 'Intimité maximale, look « limousine », matériel ou bagages hors de vue'],
  15: ['Très foncé : à peine une silhouette en s’approchant de la vitre', 'Vision nette le jour, plus sombre au crépuscule', 'Le compromis intimité et visibilité très demandé à l’arrière'],
  25: ['Foncé : l’intérieur se devine de près', 'Vision confortable, un peu plus claire la nuit qu’en 15 %', 'Enfants à l’arrière, intimité sans aller jusqu’au noir complet'],
  35: ['Teinte franche, intérieur visible en plein jour', 'Luminosité proche de celle d’origine', 'Moins d’éblouissement, trajets fréquents de nuit, rendu sobre'],
  50: ['Voile léger : la voiture garde un aspect clair', 'Presque aucune différence de luminosité', 'Esthétique discrète, soleil rasant du matin et du soir'],
  70: ['Très léger, à peine perceptible', 'Aucune gêne visuelle', 'Chaleur et UV avec un film performant, sans assombrir'],
};

// ------------------------------------------------------------------------- local proof
const tintJobs = realisations.filter((r) => r.service === 'vitres-teintees').map((r) => r.vehicle);
const jobsLine = tintJobs.length
  ? `Parmi les voitures passées à l’atelier pour leurs vitres : ${andList(tintJobs.slice(0, 4))}. Les photos sont sur la page [réalisations](/realisations/).`
  : 'Les photos de nos chantiers sont publiées sur la page [réalisations](/realisations/).';

// ------------------------------------------------------------------------- sections
export const sections = [
  {
    type: 'compare',
    id: 'grille-tarifs',
    kicker: 'Tarifs',
    title: 'Le prix selon *votre véhicule*',
    lead: `Le tarif dépend de la taille du véhicule et des vitres traitées, jamais de la teinte choisie : de ${darkest} % à ${lightest} %, le prix reste identique. Le forfait vitres arrière démarre à ${priceText.tintFrom} TTC, film posé.`,
    caption: 'Prix TTC indicatifs, film et pose compris, selon le type de véhicule',
    head: ['Véhicule', 'Vitres arrière', 'Vitres avant seules', 'Toutes les vitres (hors pare-brise)'],
    rows: vehicleRows.map(priceRow),
    note: `Prix TTC indicatifs, confirmés par le devis une fois le véhicule vu (forme des vitres, ancien film éventuel). « Vitres arrière » : vitres latérales arrière, custodes et lunette. Les vitres avant se posent uniquement avec un film qui laisse au vitrage complet au moins ${G.frontMin} % de lumière : voir [ce que dit la loi](/vitres-teintees/#loi-vitres-teintees). Le pare-brise se chiffre à part. Ce qui fait varier le prix : [prix des vitres teintées à Tours](/guides/prix-vitres-teintees-tours/).`,
  },
  {
    type: 'blocks',
    id: 'notre-film-nano-ceramique',
    kicker: 'Notre film',
    title: 'Un film *nano-céramique*, garanti à vie',
    lead: 'À l’atelier, nous ne posons qu’un seul type de film : le nano-céramique. Beaucoup de centres posent encore des films métallisés, moins chers à l’achat ; nous avons fait le choix inverse, pour le confort à l’usage et pour la tenue dans le temps. [Comprendre le film nano-céramique](/guides/film-nano-ceramique/).',
    items: [
      {
        title: 'Aucun métal dans le film',
        text: [
          'Un film métallisé contient de fines particules de métal : il renvoie la chaleur, mais il peut aussi gêner les ondes qui traversent la vitre, comme le GPS, le téléphone, le badge de télépéage ou certaines clés mains libres, et donne un reflet miroir.',
          'Le nano-céramique filtre la chaleur avec des particules céramiques : pas de reflet miroir, pas de gêne pour vos appareils.',
        ],
      },
      {
        title: 'La chaleur filtrée, pas seulement la lumière',
        text: [
          'Le nano-céramique agit sur l’infrarouge, la part du rayonnement solaire qui chauffe l’habitacle. À teinte égale, l’habitacle chauffe moins qu’avec un film simplement teinté, et même une teinte claire apporte du confort.',
        ],
      },
      {
        title: 'Une teinte qui ne vire pas',
        text: [
          'Avec les années, certains films bas de gamme se décolorent et tirent vers le violet. Le nano-céramique garde sa teinte neutre : vos vitres restent nettes, sans voile ni changement de couleur.',
        ],
      },
      {
        title: 'Garanti à vie',
        text: [
          'Notre film nano-céramique posé à l’atelier est garanti à vie. Les conditions de la garantie vous sont remises avec votre facture ; en cas de souci, vous revenez simplement à l’atelier de Vouvray.',
        ],
      },
    ],
  },
  {
    type: 'blocks',
    id: 'vitres-concernees',
    title: 'Arrière, avant, pare-brise : *ce que couvre chaque option*',
    lead: 'Trois zones, trois cadres différents : les vitres traitées dans chaque option, et ce que la réglementation permet pour chacune.',
    items: [
      {
        title: 'Vitres arrière : le forfait 3/4 arrière',
        text: [
          'Le forfait couvre les vitres des portes arrière, les petites vitres de custode quand votre voiture en possède, et la lunette arrière. C’est l’option la plus demandée : passagers, sièges enfants et coffre passent à l’abri des regards.',
          `Toutes les teintes sont permises, jusqu’à ${darkest} %, dès lors que le véhicule a deux rétroviseurs extérieurs. À partir de ${priceText.tintFrom} TTC selon la catégorie.`,
        ],
      },
      {
        title: 'Vitres avant : conducteur et passager',
        text: [
          `Les deux vitres latérales avant coûtent ${ttc(tint.frontOnly)} seules, ou ${ttc(tint.frontWithRear)} de plus quand elles s’ajoutent au forfait arrière.`,
          `La loi demande ici au moins ${G.frontMin} % de lumière transmise, verre et film réunis. Même notre teinte la plus claire (${lightest} %) donne en général un vitrage autour de ${onTypicalGlass(lightest)} % : seul un film plus clair encore peut rester au-dessus du seuil, et seule une mesure sur la voiture, film posé, permet de le vérifier.`,
        ],
      },
      {
        title: 'Pare-brise : un film à part',
        text: [
          `Le film couvre la face intérieure du pare-brise et fait l’objet d’une ligne séparée : film athermique ${ttc(athermique.price)}, ou film irisé à effet caméléon ${ttc(irise.price)}, au choix ${iriseColors}.`,
          `Le pare-brise suit la même règle que les vitres avant : ${G.frontMin} % minimum, film compris. Sur un pare-brise d’origine, même un film clair laisse le plus souvent l’ensemble sous ce seuil : personne ne peut promettre la conformité sans mesure.${darkWindshield.length ? ` Un film plus foncé (${andList(darkWindshield.map((f) => `${f.vlt} %`))}) est interdit sur route.` : ''}`,
        ],
      },
    ],
  },
  {
    type: 'compare',
    id: 'teintes',
    kicker: 'Nuancier',
    title: `De ${darkest} % à ${lightest} % : *bien lire une teinte*`,
    lead: `Le pourcentage indique la part de lumière visible qui traverse le film. Un chiffre bas donne une vitre foncée, un chiffre haut une vitre presque claire. ${count(shades.length)} teintes au choix, toutes au même prix.`,
    caption: 'Rendu habituel d’un film sur une vitre claire. Une vitre arrière déjà surteintée d’usine donne un résultat plus foncé.',
    head: ['Teinte', 'Vue de l’extérieur', 'Depuis l’habitacle', 'Usage fréquent'],
    rows: shades.map((v) => [`${v} %`, ...(shadeLook[v] || ['', '', ''])]),
    note: 'Pensez à la nuit : plus la lunette est foncée, moins on voit au travers en marche arrière, surtout sur un parking ou une route peu éclairés. La chaleur, elle, tient d’abord à la technologie du film plutôt qu’à sa couleur. Les échantillons sont à l’atelier, et notre guide détaille [comment choisir sa teinte](/guides/choisir-teinte-vitres/).',
  },
  {
    type: 'prose',
    id: 'loi-vitres-teintees',
    kicker: 'Réglementation',
    title: `Ce que dit la loi : *${G.frontMin} % minimum à l’avant*`,
    text: [
      `Le pare-brise et les deux vitres latérales avant doivent offrir une transmission lumineuse d’au moins ${G.frontMin} %. La règle est posée par l’${G.article} ; elle s’applique depuis le ${G.since}, en vertu du ${G.decree}. Ce taux ne concerne pas le film seul : il se mesure sur la vitre équipée de son film.`,
      `Or un verre d’origine ne laisse jamais passer toute la lumière. En première approche, les deux valeurs se multiplient : un film vendu « ${lightest} % » collé sur une vitre qui transmet environ ${G.typicalGlass} % donne un vitrage proche de ${onTypicalGlass(lightest)} %. Un film affiché à ${lightest} % ne rend donc pas une vitre avant conforme ; seule une mesure, film posé, permet de trancher.`,
      `À l’arrière, aucun seuil : vitres latérales arrière et lunette peuvent recevoir la teinte de votre choix, jusqu’à ${darkest} %, à condition que le véhicule soit équipé de deux rétroviseurs extérieurs.`,
      `En cas de contrôle, un vitrage avant trop foncé coûte une amende forfaitaire de ${G.fine} € et la perte de ${G.points} points sur le permis, et le véhicule peut être immobilisé. Les forces de l’ordre disposent d’appareils qui mesurent la transmission sur place.`,
      `Les dérogations se limitent aux cas suivants : ${G.exemptions}. Être sensible à la lumière, sans l’une de ces affections, ne suffit pas. Et même avec votre accord, une teinte trop foncée à l’avant reste interdite : nous vous orientons vers une configuration utilisable sur route.`,
    ],
    points: [
      `Pare-brise et vitres avant : ${G.frontMin} % au moins, verre et film ensemble`,
      'Vitres arrière et lunette : teinte libre avec deux rétroviseurs extérieurs',
      `Infraction : ${G.fine} €, ${G.points} points, immobilisation possible`,
    ],
    note: 'Textes, dérogations et cas particuliers sont détaillés dans [le guide de la loi](/guides/vitres-teintees-loi/).',
  },
  {
    type: 'blocks',
    id: 'avantages-film-solaire',
    kicker: 'Au quotidien',
    title: 'Ce qu’un film solaire *apporte vraiment*',
    lead: 'Des bénéfices concrets, à condition de choisir la bonne technologie et la bonne teinte. Et quelques limites, que nous préférons vous dire avant la pose.',
    items: [
      {
        title: 'Moins de chaleur à bord',
        text: ['Le film limite une partie de l’énergie solaire qui entre par les vitres. En été, une voiture garée au soleil chauffe moins vite et la climatisation peut être moins sollicitée. L’efficacité dépend surtout de la technologie retenue.'],
      },
      {
        title: 'UV filtrés',
        text: ['Le film contribue à filtrer les ultraviolets : la peau des passagers est mieux protégée sur les longs trajets, et sellerie, plastiques et tableau de bord vieillissent moins vite au soleil.'],
      },
      {
        title: 'Intimité, objets hors de vue',
        text: ['À l’arrière, une teinte foncée masque passagers, sièges enfants, bagages ou matériel laissés dans la voiture. Ce qui ne se voit pas attire moins l’attention.'],
      },
      {
        title: 'Moins d’éblouissement',
        text: ['Soleil bas, reflets, phares dans le rétroviseur la nuit : le film adoucit la lumière qui entre et rend les trajets plus reposants, en particulier pour les enfants assis à l’arrière.'],
      },
      {
        title: 'Vitre mieux tenue en cas de bris',
        text: ['Collé sur toute la surface, le film aide à retenir les éclats si la vitre se brise, lors d’un choc ou d’une tentative d’effraction. Il ne rend pas la vitre incassable, mais peut limiter les projections de verre dans l’habitacle.'],
      },
      {
        title: 'Une ligne plus homogène',
        text: ['Des vitres fumées affinent la silhouette, surtout sur une carrosserie foncée, et s’accordent avec des [feux arrière teintés](/feux-arriere-teintes/) pour un arrière cohérent.'],
      },
      {
        title: 'Ce qu’un film ne fait pas',
        text: ['Il ne remplace pas la climatisation, ne rend pas légale une vitre avant foncée et ne cache pas un verre rayé : un défaut de la vitre reste visible sous le film. Mieux vaut le savoir avant la pose.'],
      },
    ],
  },
  {
    type: 'steps',
    id: 'pose-vitres-teintees',
    kicker: 'À l’atelier',
    title: 'La pose, *étape par étape*',
    lead: 'Le film est posé dans l’atelier de Vouvray, sur la face intérieure de chaque vitre. Voici ce qui se passe entre l’arrivée de votre véhicule et sa restitution.',
    items: [
      {
        title: 'Conseil et devis',
        text: 'Nous choisissons ensemble les vitres à traiter et la teinte de notre film nano-céramique, en vérifiant ce que la loi autorise pour chaque vitre. Le devis indique le prix, la référence proposée et la durée d’immobilisation du véhicule.',
      },
      {
        title: 'Dépose d’un ancien film, si besoin',
        text: 'Un film usé, bullé ou trop foncé à l’avant est retiré avec ses résidus de colle. Sur la lunette, l’opération demande une attention particulière pour préserver les filaments du dégivrage. Cette étape est précisée sur le devis.',
      },
      {
        title: 'Nettoyage minutieux',
        text: 'Chaque vitre est lavée côté intérieur, angles et bords de joints compris. C’est une étape décisive : une poussière oubliée sous le film resterait visible ensuite.',
      },
      {
        title: 'Découpe et thermoformage',
        text: 'Le film est découpé à la forme exacte de chaque vitre. Sur les vitrages bombés, la lunette en particulier, il est mis en forme à la chaleur sur la face extérieure, pour épouser la courbure sans pli.',
      },
      {
        title: 'Application et marouflage',
        text: 'Le film est appliqué sur la face intérieure avec une solution de pose qui permet de l’ajuster au millimètre. La raclette chasse ensuite l’eau et l’air vers les bords : c’est le marouflage. Les finitions sont reprises le long des joints.',
      },
      {
        title: 'Contrôle et restitution',
        text: 'Chaque vitre est inspectée à la lumière avant que vous repartiez. Nous vous expliquons les précautions des jours suivants : ne pas descendre les vitres pendant quelques jours, le temps que le film sèche (nous vous donnons le délai adapté au film et à la saison), et attendre avant de nettoyer leur face intérieure.',
      },
    ],
  },
  {
    type: 'prose',
    id: 'entretien-vitres-teintees',
    kicker: 'Après la pose',
    title: 'Entretenir *vos vitres teintées*',
    text: [
      'Un film bien posé demande peu d’entretien : quelques précautions les premiers jours, puis de bonnes habitudes de nettoyage.',
      'Pendant le séchage, de petites gouttes ou un léger voile peuvent apparaître sous le film : c’est l’eau de pose qui s’évacue. Ils disparaissent d’eux-mêmes, plus ou moins vite selon la température. Si une bulle reste visible après le délai indiqué, [contactez l’atelier](/contact/).',
    ],
    points: [
      'Attendez le délai indiqué avant de descendre les vitres et de nettoyer leur face intérieure.',
      'Nettoyez avec une microfibre douce et de l’eau savonneuse, ou un produit pour vitres sans ammoniaque.',
      'Évitez éponges abrasives, grattoirs et lames sur la face qui porte le film.',
      'Ne collez ni ventouse ni autocollant sur le film, et attention aux objets durs : boucles de ceinture, bagues, chargement appuyé contre la lunette.',
      'Lavez l’extérieur comme d’habitude : le film est côté habitacle, à l’abri des rouleaux et du jet haute pression.',
    ],
  },
  {
    type: 'prose',
    id: 'atelier-touraine',
    kicker: 'Vouvray · Tours · Indre-et-Loire',
    title: 'Teinter ses vitres *près de Tours*',
    text: [
      'SOLAR CAR 37 pose les films solaires à Vouvray, dans son atelier de la ZA de l’Étang Vignon : une dizaine de kilomètres seulement le séparent de Tours. Il est facile d’accès depuis l’agglomération tourangelle et les communes voisines, comme Rochecorbon, Saint-Pierre-des-Corps, Montlouis-sur-Loire, Saint-Cyr-sur-Loire ou Amboise, et accueille des conducteurs de tout l’Indre-et-Loire.',
      'Venir sur place a un intérêt concret : vous voyez les échantillons de teinte à la lumière du jour, et le devis est confirmé après un coup d’œil sur votre véhicule. Pendant le séchage, une question se règle simplement avec l’atelier qui a posé le film.',
      jobsLine,
      'Pour préparer votre venue : [l’atelier](/atelier-vouvray/) (accès et horaires), nos [zones d’intervention](/zones-intervention/) avec la distance depuis votre commune, ou la page [vitres teintées à Tours](/vitres-teintees-tours/). Pour un devis, le plus simple reste le [formulaire de contact](/contact/).',
    ],
  },
];

// ------------------------------------------------------------------------- extra FAQ
export const faq = [
  {
    q: 'Quel film posez-vous sur les vitres ?',
    a: 'Uniquement un film nano-céramique, garanti à vie. Contrairement aux films métallisés que posent encore certains centres, il ne contient pas de métal : pas de reflet miroir, pas de gêne pour le GPS, le téléphone ou le télépéage, et une teinte qui ne vire pas au violet avec le temps.',
  },
  {
    q: 'Quelle garantie sur vos vitres teintées ?',
    a: 'Le film nano-céramique posé à l’atelier est garanti à vie. Les conditions de la garantie vous sont remises avec votre facture ; en cas de souci, il suffit de revenir à l’atelier de Vouvray.',
  },
  {
    q: 'Combien coûte une voiture entièrement teintée ?',
    a: tint.validated
      ? `Hors pare-brise, comptez de ${formatPrice(fullMin)} à ${formatPrice(fullMax)} TTC selon la catégorie du véhicule : le forfait vitres arrière, plus ${formatPrice(tint.frontWithRear)} pour les deux vitres avant. Le film de pare-brise se chiffre à part. À l’avant, seul un film qui laisse le vitrage à ${G.frontMin} % au moins est utilisable sur route.`
      : `Le prix dépend de la catégorie du véhicule et des vitres traitées : il est établi sur devis. À l’avant, seul un film qui laisse le vitrage à ${G.frontMin} % au moins est utilisable sur route.`,
  },
  {
    q: 'Que comprend exactement le forfait « 3/4 arrière » ?',
    a: `Trois zones : les deux vitres latérales arrière, les éventuelles vitres de custode et la lunette, film et pose compris, à partir de ${priceText.tintFrom} TTC. Les vitres du conducteur et du passager avant n’en font pas partie : elles s’ajoutent en option.`,
  },
  {
    q: 'Mes vitres arrière sont déjà surteintées d’origine : un film est-il utile ?',
    a: 'Oui, si vous cherchez davantage d’intimité ou de confort thermique : une vitre surteintée d’usine assombrit la vue mais n’agit pas toujours beaucoup sur la chaleur. Le film s’ajoute à la teinte du verre, le résultat est donc plus foncé que le pourcentage du film seul. À l’atelier, les échantillons permettent de juger du rendu sur votre propre vitre.',
  },
  {
    q: 'Quelle teinte choisir quand on transporte des enfants à l’arrière ?',
    a: 'Une teinte entre 15 % et 35 % atténue bien le soleil et protège des regards, tout en laissant les enfants voir dehors. Pour la chaleur, la technologie du film compte plus que sa noirceur : un film céramique filtre en général davantage les infrarouges. Le film contribue aussi à filtrer les UV, appréciable pour une peau fragile.',
  },
  {
    q: 'Un film teinté protège-t-il des UV ?',
    a: 'Oui : un film solaire de qualité filtre une large part des rayons ultraviolets, y compris dans les teintes claires, car ce filtrage ne dépend pas seulement de la couleur. La valeur exacte dépend de la référence ; elle figure sur sa fiche technique, communiquée avec le devis.',
  },
  {
    q: 'Pourquoi le film est-il posé à l’intérieur de la vitre ?',
    a: 'Côté habitacle, le film est à l’abri de la pluie, des lavages et des frottements extérieurs, ce qui le préserve dans le temps. C’est aussi pour cela qu’il faut le laisser sécher avant de manœuvrer les vitres : l’eau de pose doit d’abord s’évacuer.',
  },
  {
    q: 'Le dégivrage de la lunette arrière fonctionne-t-il encore ?',
    a: 'Oui. Le film se pose sur la face intérieure, par-dessus les filaments chauffants, et le dégivrage continue de fonctionner. La vraie précaution concerne la dépose d’un ancien film, qui doit se faire sans arracher ces filaments.',
  },
  {
    q: 'Des petites bulles ou un voile après la pose : est-ce normal ?',
    a: 'Oui, pendant les premiers jours : il reste un peu d’eau de pose entre le film et la vitre, qui s’évapore progressivement. Par temps froid ou humide, cela prend plus longtemps. Une bulle qui persiste au-delà du délai que nous vous avons indiqué doit nous être signalée.',
  },
  {
    q: 'J’ai acheté une voiture aux vitres avant trop foncées : que faire ?',
    a: `Faites retirer le film : sous ${G.frontMin} % de transmission, vitre comprise, vous risquez ${G.fine} € d’amende et ${G.points} points en moins. L’ancien film et sa colle sont retirés à l’atelier, et cette dépose est chiffrée sur le devis. Un film très clair peut ensuite être envisagé, sous réserve de mesure.`,
  },
  {
    q: 'Peut-on faire teinter une seule vitre, par exemple après un remplacement ?',
    a: 'Oui, sur devis : après le remplacement d’une vitre cassée, on peut filmer la vitre neuve dans la teinte des autres. Indiquez-nous la teinte posée à l’origine si vous la connaissez ; sinon, nous la comparons avec les échantillons sur place.',
  },
];
