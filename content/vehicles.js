/**
 * 3D model used for each vehicle category of the simulators.
 * `glb`  = path of a real model configured like content/car.js (realistic),
 * `preset` = procedural silhouette used until a real model is supplied.
 * To add a real model: optimise it (scripts/prepare-model.mjs), create its part map
 * (copy content/car.js), import it below and set `config`.
 */
import porsche from './car.js';
import a45 from './cars/a45.js';
import a5 from './cars/a5.js';
import cla from './cars/cla.js';
import x6 from './cars/x6.js';

export default {
  coupe: { config: porsche, preset: 'coupe', label: 'Coupé (Porsche 992 GT3 RS)' },
  citadine: { config: a45, preset: 'citadine', label: 'Citadine (Mercedes-AMG A 45)' },
  berline: { config: a5, preset: 'berline', label: 'Berline (Audi A5 Sportback)' },
  break: { config: cla, preset: 'break', label: 'Break (Mercedes-AMG CLA 45 Shooting Brake)' },
  suv: { config: x6, preset: 'suv', label: 'SUV (BMW X6 M)' },
  utilitaire: { config: null, preset: 'utilitaire', label: 'Utilitaire (silhouette provisoire)' },
};

/**
 * Supplied cars parked around as scenery (desktop / high quality only). Positions in metres,
 * car at the origin nose towards +x; ry turns the parked car (radians).
 * - studio: the tour and the dark studio of the simulators
 * - workshop: two slots behind the car of the window-film simulator, filled in this order
 *   with categories other than the one on show
 */
export const parked = {
  studio: [
    { car: 'suv', x: 5.6, z: -5.3, ry: 0 },
    { car: 'berline', x: -6.25, z: 4.85, ry: Math.PI + 0.05 },
  ],
  workshop: {
    slots: [
      { x: -5.15, z: 4.25, ry: Math.PI - 0.04 },
      { x: 4.95, z: 4.3, ry: 0.05 },
    ],
    order: ['suv', 'berline', 'break', 'citadine'],
  },
};

