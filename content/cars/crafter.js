/**
 * Utilitaire of the window-tint simulator: Volkswagen Crafter (long van with side windows),
 * file supplied by SOLAR CAR 37 (.usdz converted with scripts/convert-usdz.mjs, then prepared
 * with assets-src/models/crafter.prep.json: paint found by colour, inner glass layers removed,
 * the windscreen and side windows split out of one mesh). Same format as content/car.js.
 */
export default {
  model: '/models/crafter.glb',
  credit: { text: 'Modèle 3D Volkswagen Crafter — fourni par SOLAR CAR 37 (crédit à compléter selon la licence)', url: null },
  forward: '+z',
  // a long-wheelbase Crafter with extended overhang (L5): its proportions match 7.39 m
  length: 7.39,
  paint: {
    color: null,
    materials: ['paint'],
    accents: [],
    finish: { metalness: 0.45, roughness: 0.32, clearcoat: 1, clearcoatRoughness: 0.04 },
  },
  overrides: {},
  parts: {
    windshield: ['win_windshield'],
    frontWindows: { L: ['win_front_L'], R: ['win_front_R'] },
    rearWindows: ['win_side_L', 'win_side_R', 'win_slide_R', 'win_door_L', 'win_door_R'],
    tailLights: ['tail_lamps'],
    tailHousing: [],
    tailSignals: [],
    headLights: [],
    headLens: [],
    hide: [],
  },
  // SOLAR CAR plate over the van's own plate, on the left rear door
  plate: { y: 0.585, z: -0.375 },
  windowBelt: 0.99,
  windowDrop: 0.4,
  doors: {},
};
