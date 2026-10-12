/**
 * Berline of the window-tint simulator: Audi A5 Sportback S line (2021), file supplied by
 * SOLAR CAR 37 (.usdz converted with scripts/convert-usdz.mjs, then prepared with
 * assets-src/models/a5.prep.json, which names the paint, groups the LEDs and splits the side
 * glass at the B-pillar). Same format as content/car.js.
 */
export default {
  model: '/models/a5.glb',
  credit: { text: 'Modèle 3D Audi A5 Sportback — fourni par SOLAR CAR 37 (crédit à compléter selon la licence)', url: null },
  forward: '+z',
  length: 4.76,
  paint: {
    color: null,
    materials: ['paint'],
    accents: [],
    finish: { metalness: 0.6, roughness: 0.3, clearcoat: 1, clearcoatRoughness: 0.03 },
  },
  overrides: {},
  parts: {
    windshield: ['win_windshield'],
    frontWindows: { L: ['win_front_L'], R: ['win_front_R'] },
    rearWindows: ['win_rear_L', 'win_rear_R', 'win_quarter_L', 'win_quarter_R', 'win_rearscreen'],
    tailLights: ['tail_leds'],
    tailHousing: [],
    tailSignals: [],
    headLights: ['head_leds'],
    headLens: ['head_lens_L', 'head_lens_R'],
    hide: [],
  },
  windowBelt: 1.09,
  windowDrop: 0.4,
  doors: {},
};
