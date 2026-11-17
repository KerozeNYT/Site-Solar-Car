/**
 * The Christmas ad (docs/PUB-NOEL.md): the key frames of a vertical (9:16) one-take, for TikTok,
 * Instagram Reels and Stories. The car is a present: wrapped in a red ribbon in the Christmas
 * garage, the ribbon comes undone, then each service shows on its own (tinted windows, smoked tail
 * lights, starlight headliner) and the car ends lit, front three-quarter, room left above and below
 * for the words of the offer (added at the edit, never generated).
 *
 *   KEYS_SET=vertical FILM_QUERY='paint=f2f2ee&metal=0.02&rough=0.2&livery=1&ceiling=leds&rims=17181a&exp=0.95&swirl=0&dullcoat=0.8&fog=0.005&xmas=1' \
 *     node scripts/film/render.mjs <out dir> 1080 1920 --keys scripts/film/keyframes-noel.js
 *
 * Car space: metres, the car at the origin, nose towards +x, right-hand side towards +z.
 * cam: [x, y, z, look x, look y, look z, fov] (fov vertical: a tall frame).
 */

// the car as a present: polished white, glass clear, lights off, no film; the ribbon on
const present = {
  fade: 1,
  bloom: 0.13,
  headlights: 0,
  headClear: 1,
  polishX: -10,
  ceramic: 1,
  rearVLT: 0.7,
  frontVLT: 0.75,
  tailSmoke: 0,
  tailOn: 0,
  windowR: 0,
  sheen: 0,
  stars: 0,
  carbonX: -10,
  backlight: 0,
  ribbon: 1,
};
const open = { ribbon: 0, headlights: 0.7 };
const tint = { rearVLT: 0.05, backlight: 1 };
const tails = { tailSmoke: 0.45, tailOn: 1 };

const N = [
  // 1. the present: front three-quarter, the ribbon and the bow, the lit trees and garlands behind
  { id: 'N0', cam: [4.6, 1.15, 3.6, 0.0, 0.7, 0, 34], fx: { ...present } },
  // 2. unwrapped: the same view a little closer, the ribbon gone, the headlights on
  { id: 'N1', cam: [4.0, 1.0, 3.1, 0.1, 0.62, 0, 34], fx: { ...present, ...open } },
  // 3. window tint: the right-hand rear three-quarter, the quarter window and the rear window black
  { id: 'N2', cam: [-3.5, 1.25, 3.3, -0.9, 0.85, 0.3, 36], fx: { ...present, ...open, ...tint } },
  // 4. tail lights: behind the car, the smoked light bar lit
  { id: 'N3', cam: [-5.0, 1.15, 0.9, -2.1, 0.75, 0, 34], fx: { ...present, ...open, ...tint, ...tails } },
  // 5. starlight: inside the cabin, the starlit headliner
  { id: 'N4', cam: [-1.28, 0.98, 0.0, 0.5, 1.4, 0.0, 70], fx: { ...present, ...open, ...tint, ...tails, stars: 1 } },
  // 6. final: front three-quarter, wide, everything done and lit (room for the offer's words)
  { id: 'N5', cam: [4.6, 0.95, 3.2, 0.2, 0.62, 0, 36], fx: { ...present, ...open, ...tint, ...tails } },
];

// the tall frame (three.js fov is vertical): the camera steps back along its line of sight and the
// lens opens, as for the phone version of the home film (scripts/film/keyframes.js)
const VERTICAL = { N0: [1.45, 1.3], N1: [1.45, 1.3], N2: [1.55, 1.25], N3: [1.4, 1.25], N4: [1.0, 1.0], N5: [1.45, 1.3] };
const vertical = N.map((k) => {
  const [far, lens] = VERTICAL[k.id];
  const [px, py, pz, lx, ly, lz, fov] = k.cam;
  return { ...k, id: k.id + 'v', t: 20, cam: [lx + (px - lx) * far, ly + (py - ly) * far, lz + (pz - lz) * far, lx, ly, lz, Math.min(78, fov * lens)] };
});

// render.mjs reads `keyframes`, or `keyframesVertical` with KEYS_SET=vertical: both are the tall ones
export const keyframes = vertical;
export const keyframesVertical = vertical;
