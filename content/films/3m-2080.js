/**
 * Covering film catalogue — 3M™ Wrap Film Series 2080 (« Films de covering 3M™ Série 2080 »).
 *
 * Only references whose product page exists on the official 3M France site are listed: the code
 * and the official name below are copied from the title of that page (`source`). A product sold
 * elsewhere (3m.com United States…) is NOT proof that it is sold in France: such references stay
 * in `pending` (never shown) until the workshop confirms them with its supplier.
 *
 * `preview` is an APPROXIMATE sRGB colour for the swatch and the 3D view (no official value is
 * published): the real film is always checked on the workshop's sample book. `visual` holds
 * optional render hints (metal, flip colour of colour-shift films); the finish and the effects
 * set the rest (content/covering.js, FINISHES / EFFECTS).
 *
 * To add a reference: copy a line, give it a new unique `id` (never reuse or rename one: shared
 * links and saved settings point to it), paste the 3M France page in `source`, set `verified` to
 * the day you checked it. To add a brand: create content/films/<brand>-<range>.js with the same
 * fields and list it in content/films/index.js.
 */

export const range = {
  brand: '3M',
  range: '2080',
  name: '3M™ Wrap Film Series 2080',
  label: 'Films de covering 3M™ Série 2080',
  source: 'https://www.3mfrance.fr/3M/fr_FR/p/d/b5005081006/',
  // how the references were checked
  method:
    'Titre de la fiche produit sur 3mfrance.fr (code, nom officiel) relevé par moteur de recherche ; la page n’a pas pu être ouverte directement depuis l’environnement de travail.',
};

const V = '2026-10-13';
const P = 'https://www.3mfrance.fr/3M/fr_FR/p/';

// [id, code, official name, French label, family, finish, effects, preview, source path, visual?]
const rows = [
  ['3m-2080-g12', '2080-G12', 'Gloss Black', 'Noir brillant', 'noir', 'gloss', [], '#0d0e10', 'dc/v101666042/'],
  ['3m-2080-s12', '2080-S12', 'Satin Black', 'Noir satiné', 'noir', 'satin', [], '#18191b', 'dc/v101651125/'],
  // listed on the 3M France catalogue page filtered on « Noir mat » (3M ID 7100308564)
  ['3m-2080-m12', '2080-M12', 'Matte Black', 'Noir mat', 'noir', 'matte', [], '#1d1e20', 'c/films/covering-de-vehicules/films-non-imprimables/i/automobile/?attra1798=Noir+mat'],
  ['3m-2080-hg212', '2080-HG212', 'High Gloss Black Metallic', 'Noir métallisé, brillant miroir', 'noir', 'high-gloss', ['metallic'], '#1a1b1f', 'dc/v101624073/'],
  ['3m-2080-hgp221', '2080-HGP221', 'High Gloss Flip Black Psychedelic', 'Noir à reflets changeants, brillant miroir', 'noir', 'high-gloss', ['flip'], '#141317', 'dc/v101845132/', { flip: '#3f6b4a', flipAmount: 0.55 }],
  ['3m-2080-hg10', '2080-HG10', 'High Gloss White', 'Blanc brillant miroir', 'blanc', 'high-gloss', [], '#f3f4f2', 'dc/v101624067/'],
  ['3m-2080-s10', '2080-S10', 'Satin White', 'Blanc satiné', 'blanc', 'satin', [], '#ecece8', 'dc/v101651129/'],
  ['3m-2080-m10', '2080-M10', 'Matte White', 'Blanc mat', 'blanc', 'matte', [], '#e6e6e2', 'dc/v101651131/'],
  ['3m-2080-g79', '2080-G79', 'Gloss Light Ivory', 'Ivoire clair brillant', 'blanc', 'gloss', [], '#ebe4cf', 'd/v101624049/'],
  ['3m-2080-sp10', '2080-SP10', 'Satin Pearl White', 'Blanc nacré satiné', 'blanc', 'satin', ['pearl'], '#ecebe4', 'dc/v100832956/', { flip: '#e9dcc4', flipAmount: 0.35 }],
  ['3m-2080-sp280', '2080-SP280', 'Satin Flip Ghost Pearl', 'Blanc nacré à reflets changeants, satiné', 'blanc', 'satin', ['flip', 'pearl'], '#e7e9ec', 'dc/v101651172/', { flip: '#aebde3', flipAmount: 0.6 }],
  ['3m-2080-gp240', '2080-GP240', 'Gloss White Gold Sparkle', 'Blanc pailleté or, brillant', 'blanc', 'gloss', ['metallic'], '#eae2cc', 'dc/v101666046/', { metal: 0.35, flip: '#d6bd83', flipAmount: 0.3 }],
  ['3m-2080-g120', '2080-G120', 'Gloss White Aluminum', 'Aluminium blanc brillant', 'gris', 'gloss', ['metallic'], '#c8cacc', 'dc/v101273307/'],
  ['3m-2080-m21', '2080-M21', 'Matte Silver Metallic', 'Argent métallisé mat', 'gris', 'matte', ['metallic'], '#a6a9ac', 'dc/v101651148/'],
  ['3m-2080-cfs201', '2080-CFS201', 'Carbon Fiber Anthracite', 'Carbone anthracite', 'gris', 'satin', ['carbon'], '#3a3c40', 'd/v101651142/'],
  ['3m-2080-hg77', '2080-HG77', 'High Gloss Sky Blue', 'Bleu ciel brillant miroir', 'bleu', 'high-gloss', [], '#6ea7d6', 'dc/v101550057/'],
  ['3m-2080-hg378', '2080-HG378', 'High Gloss Blue Raspberry', 'Bleu framboise brillant miroir', 'bleu', 'high-gloss', [], '#2552c4', 'dc/v101624072/'],
  ['3m-2080-gp272', '2080-GP272', 'Gloss Midnight Blue', 'Bleu nuit brillant', 'bleu', 'gloss', [], '#1c2644', 'dc/v101624054/'],
  ['3m-2080-s347', '2080-S347', 'Satin Perfect Blue', 'Bleu satiné', 'bleu', 'satin', [], '#24498f', 'dc/v101651163/'],
  ['3m-2080-m227', '2080-M227', 'Matte Blue Metallic', 'Bleu métallisé mat', 'bleu', 'matte', ['metallic'], '#2f4e7d', 'd/v101651153/'],
  ['3m-2080-g363', '2080-G363', 'Gloss Dragon Fire Red', 'Rouge feu brillant', 'rouge', 'gloss', [], '#b3211f', 'dc/v101279820/'],
  ['3m-2080-hg73', '2080-HG73', 'High Gloss Ruby Rosso', 'Rouge rubis brillant miroir', 'rouge', 'high-gloss', [], '#8e1020', 'dc/v101723001/'],
  ['3m-2080-s363', '2080-S363', 'Satin Smoldering Red', 'Rouge braise satiné', 'rouge', 'satin', [], '#6e1b1e', 'dc/v101651164/'],
  ['3m-2080-m13', '2080-M13', 'Matte Red', 'Rouge mat', 'rouge', 'matte', [], '#a42420', 'dc/v101651132/'],
  ['3m-2080-sp236', '2080-SP236', 'Satin Flip Volcanic Flare', 'Rouge volcan à reflets changeants, satiné', 'rouge', 'satin', ['flip'], '#8a2a1e', 'dc/v101651166/', { flip: '#c7702a', flipAmount: 0.6 }],
  ['3m-2080-m26', '2080-M26', 'Matte Military Green', 'Vert militaire mat', 'vert', 'matte', [], '#4b5140', 'dc/v101651134/'],
  ['3m-2080-m206', '2080-M206', 'Matte Pine Green Metallic', 'Vert sapin métallisé mat', 'vert', 'matte', ['metallic'], '#2f4a3b', 'd/v101651150/'],
  ['3m-2080-hgp258', '2080-HGP258', 'High Gloss Plum Explosion 2.0', 'Prune brillant miroir', 'violet', 'high-gloss', [], '#4e1f50', 'dc/v101845133/'],
  ['3m-2080-sp264', '2080-SP264', 'Satin Flip Golden Aurora', 'Or à reflets changeants, satiné', 'or', 'satin', ['flip'], '#c39e4c', 'dc/v101811007/', { flip: '#a86a36', flipAmount: 0.55 }],
];

export const films = rows.map(([id, code, name, label, family, finish, effects, preview, src, visual = {}]) => ({
  id,
  brand: '3M',
  range: '2080',
  code,
  name,
  label,
  family,
  finish,
  effects,
  preview,
  approx: true,
  visual,
  source: P + src,
  verified: V,
}));

/**
 * Seen only outside 3M France (or not at all) when checked: never shown. Confirm availability
 * with the supplier, find the 3M France page, then move the line above.
 */
export const pending = [
  { code: '2080-HG61', name: 'High Gloss Nardo Gray', note: 'Fiche trouvée sur 3m.com (États-Unis), pas sur 3mfrance.fr ; 3M France liste un PWF-G61 Gloss Nardo Gray, autre gamme (Protection Wrap).', checked: V },
  { code: '2080-S327', name: 'Satin Ocean Shimmer', note: 'Fiche trouvée sur 3m.com (États-Unis) ; 3M France montre la référence 1080-S327 (ancienne gamme 1080).', checked: V },
];
