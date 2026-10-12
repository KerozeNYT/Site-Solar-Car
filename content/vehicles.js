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
