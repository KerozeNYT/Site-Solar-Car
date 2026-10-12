/**
 * Break of the window-tint simulator: Mercedes-AMG CLA 45 Shooting Brake (2016), file supplied
 * by SOLAR CAR 37. Prepared with assets-src/models/cla.prep.json (windows and lights split
 * into the parts below). Same format as content/car.js.
 */
const M = 'CLAMercedesBenz_CLA45AMGShootingBrakeBoss_2015';
export default {
  model: '/models/cla.glb',
  credit: { text: 'Modèle 3D Mercedes-AMG CLA 45 Shooting Brake — fourni par SOLAR CAR 37 (crédit à compléter selon la licence)', url: null },
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
  windowBelt: 0.92,
  windowDrop: 0.36,
  doors: {},
};
