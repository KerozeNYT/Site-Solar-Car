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
  // lights glow from the model's own light texture (LED guides, angel-eye rings) behind glass
  lights: { textured: true },
  // SOLAR CAR plate over the car's own plate: height of its centre above the ground (metres)
  plate: { y: 1.02 },
  // Covering & déchromage simulator: panels named by assets-src/models/x6.prep.json. Body, chrome
  // and seals are separate materials in this model; glass, tyres, rims, lights, grilles and
  // seals are never wrapped.
  covering: {
    label: 'BMW X6 M',
    body: [
      'paint_hood', 'paint_roof', 'paint_fender_L', 'paint_fender_R', 'paint_door_FL', 'paint_door_FR', 'paint_rear_sides', 'paint_rear_lower',
      'paint_tailgate', 'paint_spoiler', 'paint_bumper_F', 'paint_bumper_R', 'paint_skirts', 'paint_diffuser_A', 'paint_diffuser_B', 'paint_mirror_L', 'paint_mirror_R',
    ],
    // partial wrap: each zone gets its own reference
    zones: [
      { id: 'toit', label: 'Toit', parts: ['paint_roof'], view: 'dessus' },
      { id: 'capot', label: 'Capot', parts: ['paint_hood'], view: '34avant' },
      { id: 'retros', label: 'Coques de rétroviseurs', parts: ['paint_mirror_L', 'paint_mirror_R'], view: '34avant' },
      { id: 'becquet', label: 'Becquet de hayon', parts: ['paint_spoiler'], view: '34arriere' },
    ],
    // chrome delete: the parts that are really chrome on this model
    chrome: [
      { id: 'calandre', label: 'Calandre (entourage chromé)', parts: ['chrome_grille'], view: 'avant' },
      { id: 'ouies', label: 'Ouïes d’ailes avant', parts: ['chrome_gill_L', 'chrome_gill_R'], view: '34avant' },
    ],
    notes: [
      'Contours de vitres : noir brillant d’origine sur ce modèle (pas de chrome à habiller).',
      'Sorties d’échappement chromées : non traitées par film (chaleur). Logo de marque conservé.',
    ],
  },
  windowBelt: 0.92,
  windowDrop: 0.4,
  doors: {},
};
