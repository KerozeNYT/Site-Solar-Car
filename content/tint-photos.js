/**
 * Photos of the window tint simulator in simple mode (/vitres-teintees/): one car per category
 * (content/pricing.js `tintVehicles`), seen from the three-quarter rear (`34`) and from the side
 * (`side`), always the same framing and background.
 *
 * 1. Put the pictures in assets-src/vitres/ (JPEG, PNG or WebP, any size, ideally 16:10).
 * 2. List them below with the outline of their windows: polygons in % of the picture's width
 *    and height, [x, y] from the top-left corner, one or more polygons per group:
 *    - front: the front side windows (driver, passenger)
 *    - rear:  the rear side windows, rear quarter windows and the rear windscreen
 * 3. `node scripts/tint-photos.mjs` makes the web files (public/img/vitres/) and the manifest the
 *    page reads. The simple mode appears once every category has its two pictures; until then
 *    the page shows the 3D simulator.
 * `credit`: shown under the picture (e.g. « Image générée — illustration »), may be empty.
 */
export const tintPhotos = {
  // example of an entry:
  // 'petite-citadine': {
  //   credit: 'Illustration',
  //   views: {
  //     34: { file: 'petite-citadine-34.png', front: [[61, 33], [70, 31], [72, 42], [62, 44]], rear: [[40, 30], [52, 29], [53, 40], [41, 41]] },
  //     side: { file: 'petite-citadine-side.png', front: [[…]], rear: [[…]] },
  //   },
  // },
};
