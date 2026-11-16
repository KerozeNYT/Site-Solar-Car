/**
 * Citadine of the window-tint simulator: Mercedes-AMG A 45 (2018), file supplied by
 * SOLAR CAR 37 (Sketchfab export). Prepared with assets-src/models/a45.prep.json, which also
 * splits the merged glass mesh into the windows used below. Same format as content/car.js.
 */
export default {
  model: '/models/a45.glb',
  credit: {
    text: 'Modèle 3D « Mercedes-Benz A45 AMG 2018 » par Lexyc16, licence CC BY-NC 4.0, adapté par SOLAR CAR 37',
    url: 'https://sketchfab.com/3d-models/mercedes-benz-a45-amg-2018-9482f251f9c34a6e91d7777db5934cfc',
  },
  forward: '-z',
  length: 4.36,
  paint: {
    color: null,
    materials: ['main_color'],
    accents: [],
    finish: { metalness: 0.6, roughness: 0.3, clearcoat: 1, clearcoatRoughness: 0.03 },
  },
  overrides: {},
  parts: {
    windshield: ['win_windshield'],
    frontWindows: { L: ['win_front_L'], R: ['win_front_R'] },
    rearWindows: ['win_rear_L', 'win_rear_R', 'win_rearscreen'],
    tailLights: ['Object_7', 'Object_9'],
    tailHousing: ['Object_8'],
    tailSignals: [],
    headLights: ['Object_5'],
    headLens: ['head_lens_L', 'head_lens_R'],
    hide: [],
  },
  // SOLAR CAR plate over the car's own plate: height of its centre above the ground (metres)
  plate: { y: 0.765 },
  windowBelt: 4.97,
  windowDrop: 1.6,
  doors: {},
};
