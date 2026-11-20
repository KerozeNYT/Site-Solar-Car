// The workshop's look for its space (/atelier): the logo (light version, for the dark pages) and
// the app icon (the shield in a black gear on gold, design/logo/atelier/proposition-b: not the
// plain shield of the other apps), served by the worker itself: imported as binary data
// (booking/wrangler.toml, [[rules]] "Data"). Loaded only by their routes, never by the tests
// (Node cannot import an image). Made from public/img/brand/ (booking/assets/).
import logo from './assets/logo-clair-400.webp';
import logoPng from './assets/logo-clair-280.png';
import icon512 from './assets/icone-512.png';
import icon180 from './assets/icone-180.png';
// the PDF files (booking/devis.js, booking/pro-sheet.js): the logo for a white page, the shades
import logoDark from './assets/logo-sombre-800.png';
import { SHADES } from './pdf-shades.js';

export const PDF_ASSETS = { logo: logoDark, shades: SHADES };

export const BRAND = {
  'logo.webp': [logo, 'image/webp'],
  // for the e-mails (every mail app reads PNG)
  'logo.png': [logoPng, 'image/png'],
  'icone-512.png': [icon512, 'image/png'],
  'icone-180.png': [icon180, 'image/png'],
};
