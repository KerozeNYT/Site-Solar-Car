/**
 * SUV of the window-tint simulator: BMW X6 M (2016), file supplied by SOLAR CAR 37 (Sketchfab
 * export). Prepared with assets-src/models/x6.prep.json (parts renamed below). Same format as
 * content/car.js.
 */
export default {
  model: '/models/x6.glb',
  credit: { text: 'Modèle 3D BMW X6 M — fourni par SOLAR CAR 37 (crédit à compléter selon la licence)', url: null },
  forward: '+z',
  length: 4.91,
  paint: {
    color: null,
    materials: ['BM_CarPaint_Max1'],
    accents: [],
    finish: { metalness: 0.6, roughness: 0.3, clearcoat: 1, clearcoatRoughness: 0.03 },
  },
  overrides: {},
  parts: {
    windshield: ['win_windshield'],
    frontWindows: { L: ['win_front_L'], R: ['win_front_R'] },
    rearWindows: ['win_rear_L', 'win_rear_R', 'win_quarter_L', 'win_quarter_R', 'win_rearscreen'],
    tailLights: ['tail_lens_L', 'tail_lens_R', 'tail_lens_boot'],
    tailHousing: ['tail_inner_L', 'tail_inner_R', 'tail_inner_boot'],
    tailSignals: [],
    headLights: ['head_inner_L', 'head_inner_R'],
    headLens: ['head_lens_L', 'head_lens_R'],
    hide: [],
  },
  windowBelt: 0.92,
  windowDrop: 0.4,
  doors: {},
};
