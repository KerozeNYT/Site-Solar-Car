/**
 * Seasonal looks of the whole site (colours, buttons, logo, decoration), each between two days in
 * Paris, inclusive (from `starts` 00:00 to `ends` 23:59). The page picks the look itself as it
 * opens, before anything is drawn (inline script in the <head>, src/templates/pages.js): no rebuild
 * is needed on the day it changes. Outside these dates, the usual black and gold.
 *
 * id: the look, styled in src/styles/main.css (« seasonal looks »), logos in public/img/brand
 * (*-neon-*, *-noel-*, made by scripts/logo-saisons.mjs).
 *   - 'neon': sunset and neon lights (pink, orange, violet, cyan), palms and a sun over a grid at
 *     the foot of the page: an original drawing for the release of GTA 6, no image, logo or
 *     lettering of the game
 *   - 'noel': red and gold, falling snow, garland lights under the header, a Santa hat on the logo
 *
 * color: the browser's bar on phones (meta theme-color).
 *
 * Preview whatever the date: …/?apercu-theme=neon (or noel); …/?apercu-theme=aucun goes back to
 * the dates (the choice is kept for the visit).
 */
export const siteThemes = [
  { id: 'neon', label: 'Néon (sortie de GTA 6)', starts: '2026-11-17', ends: '2026-11-30', color: '#0b0613' },
  { id: 'noel', label: 'Noël', starts: '2026-12-01', ends: '2026-12-31', color: '#0b0708' },
];
