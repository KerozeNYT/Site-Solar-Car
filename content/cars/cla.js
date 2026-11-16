/**
 * Break of the window-tint simulator: Mercedes-AMG CLA 45 Shooting Brake (2016), file supplied
 * by SOLAR CAR 37. Prepared with assets-src/models/cla.prep.json (windows and lights split
 * into the parts below). Same format as content/car.js.
 */
const M = 'CLAMercedesBenz_CLA45AMGShootingBrakeBoss_2015';
export default {
  model: '/models/cla.glb',
  credit: {
    text: 'Modèle 3D « 2016 Mercedes-Benz CLA45 AMG Shooting Brake » par Ddiaz Design, licence CC BY-NC-SA 4.0, adapté par SOLAR CAR 37',
    url: 'https://sketchfab.com/3d-models/2016-mercedes-benz-cla45-amg-shooting-brake-9423d22e95aa461e9cdd65039d32e75f',
  },
  forward: '+z',
  length: 4.63,
  paint: {
    color: null,
    materials: [`${M}Paint_Material1`],
    accents: [],
    finish: { metalness: 0.6, roughness: 0.3, clearcoat: 1, clearcoatRoughness: 0.03 },
  },
  overrides: {},
  parts: {
    windshield: ['win_windshield'],
    frontWindows: { L: ['win_front_L'], R: ['win_front_R'] },
    rearWindows: ['win_rear_L', 'win_rear_R', 'win_rearscreen'],
    tailLights: ['tail_lens'],
    tailHousing: ['tail_inner'],
    tailSignals: [],
    headLights: ['head_inner'],
    headLens: ['head_lens_L', 'head_lens_R'],
    hide: [],
  },
  // SOLAR CAR plate over the car's own plate: height of its centre above the ground (metres)
  plate: { y: 0.78 },
  windowBelt: 0.92,
  windowDrop: 0.36,
  doors: {},
};
