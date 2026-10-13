/**
 * Car model configuration.
 *
 * To swap the car:
 *   1. optimise the model: node scripts/prepare-model.mjs assets-src/models/<name>.prep.json
 *      (a .usdz can first be converted with node scripts/convert-usdz.mjs <file.usdz>)
 *   2. list its meshes:    node scripts/inspect-model.mjs public/models/<name>.glb
 *   3. point `model` at the file and fill in the part lists below (mesh or material names).
 * Coordinates in this file are in the model's own space (as printed by inspect-model).
 */
export default {
  model: '/models/porsche.glb',
  // Footer credit for the 3D model (fill in according to the model's licence).
  credit: {
    text: 'Modèle 3D Porsche 992 GT3 RS — fourni par SOLAR CAR 37 (crédit à compléter selon la licence)',
    url: null,
  },
  // Axis the model's nose points to, and an optional target length in metres (null = keep).
  forward: '-z',
  length: 4.57,

  paint: {
    // null keeps the model's own colour; any CSS colour repaints the body (bleu nuit brillant)
    color: '#0c1c44',
    // body panels that receive the polishing effect (and the colour above)
    materials: ['Object_2', 'Object_77', 'Object_61', 'Object_103', 'Object_17'],
    accents: [],
    finish: { metalness: 0.58, roughness: 0.3, clearcoat: 1, clearcoatRoughness: 0.018 },
  },

  // Per-mesh material fixes (e.g. tyres exported as metal).
  overrides: {
    Object_195: { color: '#0c0c0d', metalness: 0, roughness: 0.82 },
    Object_200: { color: '#0c0c0d', metalness: 0, roughness: 0.82 },
    Object_167: { color: '#0c0c0d', metalness: 0, roughness: 0.82 },
    Object_173: { color: '#0c0c0d', metalness: 0, roughness: 0.82 },
  },

  parts: {
    windshield: ['Object_187'],
    frontWindows: { L: ['Object_178'], R: ['Object_183'] },
    // glass that may legally be tinted dark in France (rear window, rear quarter windows)
    rearWindows: ['Object_189', 'Object_181'],
    tailLights: ['Object_150', 'Object_93', 'Object_13', 'Object_15', 'Object_164', 'Object_165'],
    tailHousing: ['Object_151'],
    tailSignals: [],
    // emissive light elements inside the headlights (DRL ring and modules)
    headLights: ['Object_128', 'Object_127', 'Object_92', 'Object_121', 'Object_122', 'Object_118', 'Object_119'],
    // outer headlight lenses (receive the renovation effect); rear triangles are left untouched
    headLens: ['Object_120'],
    // tyres (tyre shine) and rims (finishing gloss) of the detailing simulator
    tyres: ['Object_195', 'Object_200', 'Object_167', 'Object_173'],
    rims: ['Object_196', 'Object_201', 'Object_166', 'Object_172'],
    // reflection overlays shipped with the glass; the site renders its own reflections
    hide: ['Object_188', 'Object_180', 'Object_185', 'Object_182', 'Object_186', 'Object_190'],
  },

  // Roof area that receives the starlight (model space). Rays are cast upwards inside it and
  // stars are placed on the first opaque surface; listed meshes (roll cage...) are ignored.
  starArea: { min: [-0.5, 0.95, -0.1], max: [0.5, 1.45, 0.92] },
  starIgnore: ['Object_53'],
  // interior surfaces dimmed while the stars are on (Alcantara headliner)
  cabinDim: ['Object_39'],

  // SOLAR CAR show plate on the rear bumper: height of its centre above the ground (metres).
  plate: { y: 0.47, text: 'SOLAR CAR 37', sub: 'VITRES TEINTÉES · DETAILING · VOUVRAY' },

  // Front side windows roll down so the camera can fly into the cabin (model-space belt line).
  windowBelt: 0.915,
  windowDrop: 0.36,
  doors: {},
};
