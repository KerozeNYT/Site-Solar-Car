import data from './zones-data.js';

/**
 * Local pages, one per nearby town: real road distance and route to the workshop (computed
 * by scripts/map/towns.py on the OpenStreetMap road network), the services and prices. They
 * are linked from the footer and from /zones-intervention/ — visible pages, no doorway pages.
 * To add a town: add it to TOWNS in scripts/map/towns.py, rerun it, then add it below: to
 * PAGES with its own account of the trip (a page), or to LISTED (a line on /zones-intervention/).
 */
export const zonesPage = {
  path: '/zones-intervention/',
  seo: {
    title: 'Zones d’intervention autour de Tours | SOLAR CAR 37, Vouvray',
    description:
      'Tours, Joué-lès-Tours, Amboise, Montlouis, Saint-Cyr… : distance et trajet jusqu’à l’atelier SOLAR CAR 37 de Vouvray (vitres teintées, detailing, phares).',
  },
  h1: 'Nos zones d’intervention',
  intro:
    'L’atelier est à Vouvray, au nord-est de Tours, dans la zone d’activités de l’Étang Vignon. Nos clients viennent de toute l’agglomération tourangelle et des communes voisines : voici, pour chacune, la distance par la route et le trajet jusqu’à l’atelier.',
};

// Towns with their own page: the eight largest communes around the workshop (more than 11 000
// inhabitants), each with its own account of the trip (`intro`). Facts only: the route comes from
// scripts/map/towns.py, the geography is that of the map. The smaller neighbouring villages,
// often closer still, are listed on /zones-intervention/ without a page of their own (a page per
// village would repeat the same text: Google treats such pages as doorway pages).
const PAGES = [
  [
    'tours',
    'Tours',
    'Depuis le centre de Tours, l’atelier est à l’est, en amont sur la Loire : on passe sur la rive droite, puis on longe le fleuve par le quai de la Loire, à travers Rochecorbon, jusqu’à Vouvray. L’atelier n’est pas dans le bourg mais au nord, dans la zone d’activités de l’Étang Vignon, sur la route de Monnaie.',
  ],
  [
    'joue-les-tours',
    'Joué-lès-Tours',
    'Deuxième ville d’Indre-et-Loire, Joué-lès-Tours est au sud-ouest de l’agglomération, de l’autre côté du Cher et de la Loire par rapport à Vouvray. Le plus simple est de rejoindre l’A10, qui traverse Tours du sud au nord et franchit les deux rivières, puis de suivre les bords de Loire, rive droite, jusqu’à Vouvray et la zone de l’Étang Vignon.',
  ],
  [
    'saint-cyr-sur-loire',
    'Saint-Cyr-sur-Loire',
    'Saint-Cyr-sur-Loire est, comme Vouvray, sur la rive droite de la Loire : le trajet ne traverse pas le fleuve. On suit les quais de la rive nord (quai de Portillon, quai Paul-Bert, quai de Marmoutier) puis le quai de la Loire, avant de monter vers le nord de Vouvray par la route de Monnaie.',
  ],
  [
    'saint-pierre-des-corps',
    'Saint-Pierre-des-Corps',
    'Entre Loire et Cher, juste à l’est de Tours, Saint-Pierre-des-Corps est l’une des communes les plus proches de l’atelier à vol d’oiseau : la Loire seule l’en sépare. Après le pont, le quai de la Loire mène à Vouvray, puis la route de Monnaie à la zone de l’Étang Vignon.',
  ],
  [
    'saint-avertin',
    'Saint-Avertin',
    'Saint-Avertin, au bord du Cher au sud-est de Tours, rejoint l’atelier par l’A10, qui passe le Cher puis la Loire, avant de longer la rive droite du fleuve jusqu’à Vouvray. L’atelier est au nord du bourg, dans la zone d’activités de l’Étang Vignon.',
  ],
  [
    'chambray-les-tours',
    'Chambray-lès-Tours',
    'Au sud de l’agglomération, Chambray-lès-Tours a l’A10 à sa porte, par l’avenue du Grand Sud : l’autoroute traverse Tours et passe la Loire, puis le quai de la Loire mène à Vouvray et la route de Monnaie à la zone de l’Étang Vignon.',
  ],
  [
    'montlouis-sur-loire',
    'Montlouis-sur-Loire',
    'Montlouis-sur-Loire fait face à Vouvray sur l’autre rive de la Loire : c’est, parmi ces communes, la plus proche de l’atelier. Une fois le fleuve franchi, la route d’Amboise puis la route de Monnaie conduisent à la zone d’activités de l’Étang Vignon, au nord du bourg de Vouvray.',
  ],
  [
    'amboise',
    'Amboise',
    'Depuis Amboise, on passe la Loire par le pont du Maréchal-Leclerc puis on file vers l’ouest par la route d’Amboise, sur la rive droite : on arrive à Vouvray sans passer par Tours. La route de Monnaie mène ensuite à la zone d’activités de l’Étang Vignon.',
  ],
];
// listed (distance, direction) on /zones-intervention/, without a page
const LISTED = ['La Riche', 'Fondettes', 'Rochecorbon', 'Vernou-sur-Brenne', 'Monnaie', 'Parçay-Meslay'];

export const zones = PAGES.filter(([, town]) => data[town]).map(([slug, town, intro]) => ({ slug: `vitres-teintees-${slug}`, town, intro, ...data[town] }));
export const zonesListed = LISTED.filter((town) => data[town]).map((town) => ({ town, ...data[town] }));
