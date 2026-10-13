/**
 * Prices shown by the 3D simulators and the price tables, tax included (TTC), as supplied by
 * SOLAR CAR 37. `quote: true` = priced on quote: the simulator shows « Sur devis » and sends
 * the chosen configuration with the quote request.
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
  // prices tax included (TTC)
  // "3/4 arrière" package: rear side windows + rear windscreen
  rearPackage: { coupe: 210, citadine: 220, berline: 270, break: 280, suv: 300, utilitaire: 320 },
  // front side windows on their own (no rear package)
  frontOnly: 100,
  // front side windows added to the rear package (full car)
  frontWithRear: 50,
  shades: [5, 15, 25, 35, 50, 70], // % of visible light transmitted
  legalFrontMin: 70,
};

// Tinted lights: price per pair (front pair or rear pair), depending on the vehicle.
export const lights = {
  validated: true,
  currency: 'EUR',
  shades: [
    { id: 50, label: 'Fumé 50 %', smoke: 0.5 },
    { id: 80, label: 'Fumé 80 %', smoke: 0.82 },
  ],
  perPair: { min: 100, max: 120 },
};

export const headlights = {
  validated: true,
  currency: 'EUR',
  // price for the headlights of the vehicle (to confirm: pair)
  renovation: 79,
  options: [{ id: 'ceramic', label: 'Traitement céramique', price: 30 }],
};

// Starlight headliner: priced on quote (the configurator sends the chosen setup).
export const starlight = {
  quote: true,
  starSteps: [150, 300, 450, 600, 800, 1000, 1200],
};

// Detailing: priced on quote, after looking at the paint (packages describe the work).
export const detailing = {
  quote: true,
  steps: [
    { id: 'wash', label: 'Lavage manuel & mousse active', text: 'Pré-lavage à la mousse active qui décolle la saleté sans frotter, puis lavage manuel aux deux seaux et rinçage.' },
    { id: 'decon', label: 'Décontamination ferreuse & argile', text: 'Le décontaminant ferreux vire au violet au contact des particules métalliques incrustées ; la barre d’argile retire le reste.' },
    { id: 'polish', label: 'Polissage / correction de peinture', text: 'La polisseuse efface micro-rayures et hologrammes, panneau par panneau : la peinture retrouve profondeur et reflets.' },
    { id: 'ceramic', label: 'Protection céramique', text: 'Le revêtement céramique protège le vernis et rend la surface hydrophobe : l’eau perle et glisse.' },
    { id: 'finish', label: 'Finitions jantes, pneus & vitrages', text: 'Jantes, pneus, joints, vitrages et optiques : les détails qui font la différence à la livraison.' },
  ],
  packages: [
    { id: 'essentiel', label: 'Essentiel', steps: ['wash', 'decon', 'finish'], text: 'Remise en beauté complète, sans polissage.' },
    { id: 'eclat', label: 'Éclat', steps: ['wash', 'decon', 'polish', 'finish'], text: 'Polissage en une étape : brillance et micro-rayures atténuées.' },
    { id: 'signature', label: 'Signature céramique', steps: ['wash', 'decon', 'polish', 'ceramic', 'finish'], text: 'Correction approfondie et protection céramique longue durée.' },
  ],
};

/** every price on the site is shown tax included */
export const taxNote = 'TTC';

export const formatPrice = (n) =>
  new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n);
