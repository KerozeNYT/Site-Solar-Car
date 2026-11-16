/**
 * Permanent (301) redirects from the pages of the previous website (www.solarcar37.fr, built
 * with local.fr; its sitemap listed 10 pages in November 2026, and a crawl of all its links on
 * 16 November 2026 found 3 more addresses) to the closest new page,
 * so their search ranking and old links carry over. The build writes them for the usual hosts
 * (scripts/build.mjs, production build only): `_redirects` (Netlify, Cloudflare Pages),
 * `.htaccess` (Apache, OVH) and, for hosts without redirect rules (GitHub Pages), a small page
 * at each old address that sends the visitor on (meta refresh + canonical).
 */
export const redirects = [
  { from: '/renovation-des-optiques-de-phares', to: '/renovation-phares/' },
  { from: '/feux-teintes', to: '/feux-arriere-teintes/' },
  { from: '/detailing', to: '/detailing-carrosserie/' },
  // former « nettoyage automobile » page: the Essentiel package of the detailing page
  { from: '/nettoyage-automobile-', to: '/detailing-carrosserie/' },
  // former covering, « stickage publicitaire » and déchromage page
  { from: '/covering-stickage-publicitaire-et-dechromage', to: '/covering-dechromage/' },
  // former interior ambient lighting page: the closest service is the starlight headliner
  { from: '/eclairage-d-ambiance-interieur-', to: '/ciel-etoile/' },
  // found by the crawl: the privacy page (now a section of the legal page), the old address of
  // the cleaning page (it already pointed to the home page) and a broken link of the old
  // « feux teintés » page
  { from: '/politique-de-confidentialite', to: '/mentions-legales/' },
  { from: '/nettoyage-automobile', to: '/detailing-carrosserie/' },
  { from: '/covering-et-dechromage', to: '/covering-dechromage/' },
  // same pages, now with a trailing slash
  { from: '/vitres-teintees', to: '/vitres-teintees/' },
  { from: '/contact', to: '/contact/' },
  { from: '/mentions-legales', to: '/mentions-legales/' },
];
