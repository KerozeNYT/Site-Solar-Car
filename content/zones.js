import data from './zones-data.js';

/**
 * Local pages, one per nearby town: real road distance and route to the workshop (computed
 * by scripts/map/towns.py on the OpenStreetMap road network), the services and prices. They
 * are linked from the footer and from /zones-intervention/ — visible pages, no doorway pages.
 * To add a town: add it to TOWNS in scripts/map/towns.py, rerun it, then add it below.
 */
export const zonesPage = {
  path: '/zones-intervention/',
  seo: {
    title: 'Zones d’intervention autour de Tours | SOLAR CAR 37, Vouvray',
    description:
      'Tours, Joué-lès-Tours, Amboise, Montlouis, Saint-Cyr… : distance par la route et trajet jusqu’à l’atelier SOLAR CAR 37 de Vouvray (vitres teintées, detailing, phares).',
  },
  h1: 'Nos zones d’intervention',
  intro:
    'L’atelier est à Vouvray, au nord-est de Tours, dans la zone d’activités de l’Étang Vignon. Nos clients viennent de toute l’agglomération tourangelle et des communes voisines : voici, pour chacune, la distance par la route et le trajet jusqu’à l’atelier.',
};

const TOWNS = [
  ['tours', 'Tours'],
  ['joue-les-tours', 'Joué-lès-Tours'],
  ['saint-cyr-sur-loire', 'Saint-Cyr-sur-Loire'],
  ['saint-pierre-des-corps', 'Saint-Pierre-des-Corps'],
  ['saint-avertin', 'Saint-Avertin'],
  ['chambray-les-tours', 'Chambray-lès-Tours'],
  ['la-riche', 'La Riche'],
  ['fondettes', 'Fondettes'],
  ['montlouis-sur-loire', 'Montlouis-sur-Loire'],
  ['amboise', 'Amboise'],
  ['rochecorbon', 'Rochecorbon'],
  ['vernou-sur-brenne', 'Vernou-sur-Brenne'],
  ['monnaie', 'Monnaie'],
  ['parcay-meslay', 'Parçay-Meslay'],
];

export const zones = TOWNS.filter(([, town]) => data[town]).map(([slug, town]) => ({ slug: `vitres-teintees-${slug}`, town, ...data[town] }));
