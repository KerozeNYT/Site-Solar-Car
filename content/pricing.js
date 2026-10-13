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
  // windshield film, priced on its own line. Clear heat-rejection film at 70 % = legal; darker
  // films are possible but neither advised nor legal (price assumed the same as the 70 %:
  // to confirm). Iridescent (chameleon) film: colour chosen below; `colors` = the two tones the
  // 3D preview slides between with the viewing angle, `film` = thin-film thickness (nm).
  windshield: {
    films: [
      { id: 'athermique', label: 'Athermique 70 %', vlt: 70, price: 290, legal: true },
      { id: 'teinte50', label: 'Teinté 50 %', vlt: 50, price: 290, legal: false },
      { id: 'irise', label: 'Irisé', vlt: 76, price: 350, iridescent: true },
    ],
    colors: [
      { id: 'bleu-violet', label: 'Bleu-violet', swatch: 'linear-gradient(135deg,#3d6cff,#9b46ff)', colors: ['#3d6cff', '#b04dff'], film: [380, 460] },
      { id: 'jaune-dore', label: 'Jaune doré', swatch: 'linear-gradient(135deg,#f7da78,#c4860f)', colors: ['#f2c94c', '#c77a12'], film: [180, 250] },
      { id: 'rouge', label: 'Rouge', swatch: 'linear-gradient(135deg,#ff6a4d,#b0124f)', colors: ['#ff5a3c', '#c0145a'], film: [290, 350] },
    ],
  },
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
  // price for both headlights (the pair)
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
    { id: 'wash', label: 'Prélavage à la mousse active', text: 'La mousse active recouvre la carrosserie, puis coule le long des panneaux jusqu’au sol en emportant la saleté, sans frotter.' },
    { id: 'decon', label: 'Décontamination chimique', text: 'Le décontaminant ferreux vire au violet au contact des particules métalliques incrustées et ruisselle sur la carrosserie ; la barre d’argile retire le reste.' },
    { id: 'rinse', label: 'Rinçage à l’eau claire', text: 'Rinçage haute pression à l’eau claire, du toit vers le bas : mousse, décontaminant et saleté partent au sol, la carrosserie est nette.' },
    { id: 'polish', label: 'Polissage / correction de peinture', text: 'La polisseuse efface micro-rayures et hologrammes, panneau par panneau : la peinture retrouve profondeur et reflets.' },
    { id: 'ceramic', label: 'Protection céramique', text: 'Le revêtement céramique scelle le vernis : brillance profonde, effet miroir, surface protégée et facile à entretenir.' },
    { id: 'finish', label: 'Finitions : jantes & brillant pneus', text: 'Jantes lustrées, brillant pneus, joints, vitrages et optiques : la touche finale qui fait la différence à la livraison.' },
  ],
  packages: [
    { id: 'essentiel', label: 'Essentiel', steps: ['wash', 'decon', 'rinse', 'finish'], text: 'Remise en beauté complète, sans polissage.' },
    { id: 'eclat', label: 'Éclat', steps: ['wash', 'decon', 'rinse', 'polish', 'finish'], text: 'Polissage en une étape : brillance et micro-rayures atténuées.' },
    { id: 'signature', label: 'Signature céramique', steps: ['wash', 'decon', 'rinse', 'polish', 'ceramic', 'finish'], text: 'Correction approfondie et protection céramique longue durée.' },
  ],
};

/** every price on the site is shown tax included */
export const taxNote = 'TTC';

export const formatPrice = (n) =>
  new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n);
