/**
 * THE single source of truth for prices: simulators, price tables, SEO titles, FAQ answers and
 * guides all read them from here (see `priceText` at the bottom), so a price changes in one place.
 *
 * Tax included (TTC), as supplied by SOLAR CAR 37. `validated: false` = a figure waiting for the
 * workshop's confirmation: it is kept here, ready, but never shown as a price (the site shows
 * « Sur devis » instead). `quote: true` = priced on quote: the simulator sends the chosen
 * configuration with the quote request. Prices are indicative: the quote confirms them after
 * looking at the vehicle (docs/V2-ROADMAP.md lists what is waiting for validation).
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
  // windshield film, priced on its own line. Road status comes from content/regulation.js
  // (the 70 % threshold applies to glass + film, so no film is "compliant" by its own %).
  // `vlt` = the film's own transmission: confirm it with the reference actually fitted (the
  // iridescent value is a typical one). Darker film: visual preview only (price assumed the
  // same as the clear film). Iridescent (chameleon) film: colour chosen below; `colors` = the
  // two tones the 3D preview slides between with the viewing angle, `film` = thin-film thickness (nm).
  windshield: {
    films: [
      { id: 'athermique', label: 'Athermique 70 %', vlt: 70, price: 290 },
      { id: 'teinte50', label: 'Teinté 50 %', vlt: 50, price: 290 },
      { id: 'irise', label: 'Irisé', vlt: 76, price: 350, iridescent: true },
    ],
    colors: [
      { id: 'bleu-violet', label: 'Bleu-violet', swatch: 'linear-gradient(135deg,#3d6cff,#9b46ff)', colors: ['#3d6cff', '#b04dff'], film: [380, 460] },
      { id: 'jaune-dore', label: 'Jaune doré', swatch: 'linear-gradient(135deg,#f7da78,#c4860f)', colors: ['#f2c94c', '#c77a12'], film: [180, 250] },
      { id: 'rouge', label: 'Rouge', swatch: 'linear-gradient(135deg,#ff6a4d,#b0124f)', colors: ['#ff5a3c', '#c0145a'], film: [290, 350] },
    ],
  },
};

// Tinted lights: price per pair (front pair or rear pair), depending on the vehicle. Two
// materials, presented separately: smoked vinyl (covering) and tinted PPF (polyurethane).
// To confirm: covering at 100-120 € (validated earlier) or 120 € flat, and PPF at 190 € (V2 brief).
export const lights = {
  validated: true,
  currency: 'EUR',
  shades: [
    { id: 50, label: 'Fumé 50 %', smoke: 0.5 },
    { id: 80, label: 'Fumé 80 %', smoke: 0.82 },
  ],
  materials: [
    {
      id: 'covering',
      label: 'Covering (vinyle fumé)',
      text: 'Film vinyle teinté, fin et souple, découpé à la forme de l’optique.',
      perPair: { min: 100, max: 120 },
      validated: true,
    },
    {
      id: 'ppf',
      label: 'PPF teinté',
      text: 'Film de protection en polyuréthane (TPU), plus épais que le vinyle et conçu pour protéger la surface des petits impacts. Propriétés exactes selon la référence posée, précisées sur le devis.',
      perPair: { min: 190, max: 190 },
      validated: false,
    },
  ],
  // kept for the price texts: the covering range
  get perPair() {
    return this.materials[0].perPair;
  },
};

export const headlights = {
  validated: true,
  currency: 'EUR',
  // price for both headlights (the pair)
  renovation: 79,
  options: [{ id: 'ceramic', label: 'Traitement céramique', price: 30 }],
};

// Starlight headliner: priced on quote (the configurator sends the chosen setup). The range is
// the V2 brief's order of magnitude, shown only once validated.
export const starlight = {
  quote: true,
  range: { min: 1090, max: 1490, validated: false },
  starSteps: [150, 300, 450, 600, 800, 1000, 1200],
};

// Detailing: priced on quote, after looking at the paint (packages describe the work). The
// polishing + protection range is the V2 brief's order of magnitude, shown only once validated.
export const detailing = {
  quote: true,
  range: { min: 590, max: 1090, validated: false },
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
    { id: 'signature', label: 'Signature céramique', steps: ['wash', 'decon', 'rinse', 'polish', 'ceramic', 'finish'], text: 'Correction approfondie de la peinture et protection céramique.' },
  ],
};

/** every price on the site is shown tax included */
export const taxNote = 'TTC';

export const formatPrice = (n) =>
  new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n);

/** "1 090" (French grouping, plain spaces so titles and meta descriptions stay simple) */
const num = (n) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
const range = (r) => (r.min === r.max ? `${num(r.min)} €` : `${num(r.min)} à ${num(r.max)} €`);

/** Price phrases for copy (titles, descriptions, FAQ, guides), built from the figures above. */
export const priceText = {
  tintFrom: `${num(Math.min(...Object.values(tint.rearPackage)))} €`,
  tintFrontOnly: `${num(tint.frontOnly)} €`,
  tintFrontWithRear: `+${num(tint.frontWithRear)} €`,
  windshield: (id) => `${num(tint.windshield.films.find((f) => f.id === id).price)} €`,
  lightsPair: range(lights.perPair),
  headlights: `${num(headlights.renovation)} €`,
  headlightsCeramic: `+${num(headlights.options.find((o) => o.id === 'ceramic').price)} €`,
  // shown only once validated: otherwise null and the copy says « sur devis »
  starlight: starlight.range.validated ? range(starlight.range) : null,
  detailing: detailing.range.validated ? range(detailing.range) : null,
};
