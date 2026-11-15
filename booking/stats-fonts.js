// The site's own fonts for the statistics page (Geist, Geist Mono, Instrument Serif italic), served
// by the worker itself at /stats/f/<name>: imported as binary data (booking/wrangler.toml, [[rules]]
// "Data"). Loaded only by the font route, never by the tests (Node cannot import a .woff2).
import geist from '../node_modules/@fontsource-variable/geist/files/geist-latin-wght-normal.woff2';
import mono from '../node_modules/@fontsource-variable/geist-mono/files/geist-mono-latin-wght-normal.woff2';
import serif from '../node_modules/@fontsource/instrument-serif/files/instrument-serif-latin-400-italic.woff2';

export const FONTS = { 'geist.woff2': geist, 'geist-mono.woff2': mono, 'serif.woff2': serif };
