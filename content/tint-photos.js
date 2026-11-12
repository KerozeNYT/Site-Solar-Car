/**
 * Visuals of the window tint simulator in simple mode (/vitres-teintees/): for each category of
 * content/pricing.js `tintVehicles`, two angles and three window choices, the chosen windows
 * already outlined in gold in the picture: 10 × 2 × 3 = 60 images.
 *
 * 1. Put them in assets-src/vitres/, named <vehicle>-<angle>-<windows>.<png|jpg|webp>:
 *    - vehicle: petite-citadine, citadine, berline, cabriolet, coupe, break, monospace, suv,
 *      tesla, utilitaire
 *    - angle:   34 (three-quarter rear) or profil (side)
 *    - windows: arriere (rear windows), avant (front windows) or complet (all of them)
 *    e.g. citadine-34-arriere.png, citadine-profil-complet.png
 * 2. `node scripts/tint-photos.mjs` makes the web files (public/img/vitres/) and the manifest the
 *    page reads. The simple mode appears once every vehicle has its 6 images; until then the page
 *    shows the 3D simulator.
 */
export const tintPhotos = {
  // shown under the picture, for every vehicle (may be empty)
  credit: 'Visuels d’illustration : véhicules représentatifs de chaque catégorie.',
};
