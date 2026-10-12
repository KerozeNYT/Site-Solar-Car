/**
 * Prices shown by the 3D simulators and the price tables.
 *
 * `validated: true`  = real prices supplied by SOLAR CAR 37 (shown as such).
 * `validated: false` = EXAMPLE values so the simulator works; the site labels them
 *                      « tarif indicatif à confirmer » and keeps them out of the structured data.
 */

/** Vehicle categories shared by every simulator. `model` = 3D model id in content/vehicles.js */
export const vehicleTypes = [
  { id: 'coupe', label: 'Coupé / cabriolet', examples: 'Alfa GT, 308 CC…', model: 'coupe' },
  { id: 'citadine', label: 'Citadine 3 ou 5 portes', examples: 'Audi A3, BMW Série 1, Mercedes Classe A…', model: 'citadine' },
  { id: 'berline', label: 'Berline 5 portes', examples: 'Peugeot 508, Skoda Superb, Audi A4…', model: 'berline' },
  { id: 'break', label: 'Break', examples: '', model: 'break' },
  { id: 'suv', label: 'Monospace, SUV & 4×4', examples: '', model: 'suv' },
  // examples as supplied by SOLAR CAR 37 — to confirm (they look like SUVs)
  { id: 'utilitaire', label: 'Utilitaire & mini-van', examples: 'Ford Edge, Mercedes ML…', model: 'utilitaire' },
];

export const tint = {
  validated: true,
  currency: 'EUR',
  // "3/4 arrière" package: rear side windows + rear windscreen
  rearPackage: { coupe: 210, citadine: 220, berline: 270, break: 280, suv: 300, utilitaire: 320 },
  // front side windows on their own (no rear package)
  frontOnly: 100,
  // front side windows added to the rear package (full car)
  frontWithRear: 50,
  shades: [5, 15, 25, 35, 50, 70], // % of visible light transmitted
  legalFrontMin: 70,
};

export const lights = {
  validated: false,
  currency: 'EUR',
  shades: [
    { id: 50, label: 'Fumé 50 %', smoke: 0.5 },
    { id: 80, label: 'Fumé 80 %', smoke: 0.82 },
  ],
  // EXAMPLE prices per pair of lights
  front: 120,
  rear: 120,
  both: 210,
};

export const headlights = {
  validated: false,
  currency: 'EUR',
  // EXAMPLE prices for a pair of headlights
  renovation: 89,
  options: [{ id: 'uv', label: 'Protection céramique anti-UV renforcée', price: 30 }],
};

export const starlight = {
  validated: false,
  currency: 'EUR',
  // EXAMPLE pricing: base kit covers `baseStars`, then per extra 100 stars
  base: 590,
  baseStars: 300,
  per100: 70,
  starSteps: [150, 300, 450, 600, 800, 1000, 1200],
  options: [
    { id: 'bicolor', label: 'Bicolore', price: 90 },
    { id: 'shooting', label: 'Étoiles filantes', price: 120 },
    { id: 'constellation', label: 'Constellation sur mesure', price: 150 },
    { id: 'twinkle', label: 'Scintillement', price: 60 },
  ],
  // pavilion size factor per vehicle category
  sizeFactor: { coupe: 0.9, citadine: 0.95, berline: 1, break: 1.1, suv: 1.15, utilitaire: 1.2 },
};

export const detailing = {
  validated: false,
  currency: 'EUR',
  // EXAMPLE packages; `from` prices for a citadine, multiplied by the size factor
  sizeFactor: { coupe: 1, citadine: 1, berline: 1.15, break: 1.2, suv: 1.3, utilitaire: 1.4 },
  steps: [
    { id: 'wash', label: 'Lavage manuel & mousse active' },
    { id: 'decon', label: 'Décontamination ferreuse & argile' },
    { id: 'polish', label: 'Polissage / correction de peinture' },
    { id: 'ceramic', label: 'Protection céramique' },
    { id: 'finish', label: 'Finitions jantes, pneus & vitrages' },
  ],
  packages: [
    { id: 'essentiel', label: 'Essentiel', from: 149, steps: ['wash', 'decon', 'finish'], text: 'Remise en beauté complète, sans polissage.' },
    { id: 'eclat', label: 'Éclat', from: 349, steps: ['wash', 'decon', 'polish', 'finish'], text: 'Polissage en une étape : brillance et micro-rayures atténuées.' },
    { id: 'signature', label: 'Signature céramique', from: 790, steps: ['wash', 'decon', 'polish', 'ceramic', 'finish'], text: 'Correction approfondie et protection céramique longue durée.' },
  ],
};

export const formatPrice = (n) =>
  new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n);
