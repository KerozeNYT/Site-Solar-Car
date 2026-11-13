/**
 * Film V5 (docs/FILM-V5.md): the key frames of the one-take, horizontal (16:9). Each shot of the
 * film goes from one key frame to the next (K0 -> K1 is the wash, K1 -> K2 the polish, ...); the
 * AI video model gets them as its first and last pictures.
 *
 *   node scripts/film/render.mjs <out dir> 3840 2160 --keys scripts/film/keyframes.js
 *   with FILM_QUERY='paint=f2f2ee&metal=0.02&rough=0.2&livery=1&ceiling=leds&rims=17181a&exp=0.95'
 *
 * Car space: metres, the car at the origin, nose towards +x, right-hand side towards +z.
 * cam: [x, y, z, look x, look y, look z, fov]. fx: the state of every service effect at that
 * moment (scripts/film/scene.js); t only selects the glass of the right-hand quarter window.
 */

// the car as it arrives: dull paint, yellowed headlights off, clear glass, no film anywhere
const before = {
  fade: 1,
  bloom: 0.16,
  headlights: 0,
  headClear: 0,
  polishX: 10,
  rearVLT: 0.7,
  frontVLT: 0.75,
  tailSmoke: 0,
  tailOn: 0,
  windowR: 0,
  sheen: 0,
  stars: 0,
  carbonX: -10,
  backlight: 0,
};
// each service, once done
const polished = { polishX: -10 };
const headlights = { headClear: 1, headlights: 0.7 };
const carbon = { carbonX: 2.45 };
const tails = { tailSmoke: 0.45, tailOn: 1 };
const tint = { rearVLT: 0.05 };

export const keyframes = [
  // 01 Wash: rear three-quarter, high and wide, the swan-neck wing under the curtain of water
  { id: 'K0', t: 20, cam: [-4.6, 1.45, 3.4, -0.3, 0.6, 0, 36], fx: { ...before } },
  // end of the wash / start of the polish: the right-hand profile, the SOLAR CAR script on the door
  { id: 'K1', t: 20, cam: [-1.2, 0.95, 4.4, 0.3, 0.55, 0.3, 38], fx: { ...before } },
  // end of the polish / start of the headlight: front right-hand corner, the yellowed lens
  { id: 'K2', t: 20, cam: [3.3, 0.85, 1.9, 1.9, 0.6, 0.55, 38], fx: { ...before, ...polished } },
  // headlight renovated and lit, close
  { id: 'K3', t: 20, cam: [2.75, 0.72, 1.35, 1.95, 0.62, 0.62, 30], fx: { ...before, ...polished, ...headlights } },
  // covering: over the right-hand wing, the carbon bonnet laid
  { id: 'K4', t: 20, cam: [2.9, 1.65, 1.2, 1.4, 0.75, -0.1, 40], fx: { ...before, ...polished, ...headlights, ...carbon } },
  // tail lights: behind the car, the smoked light bar lit
  { id: 'K5', t: 20, cam: [-5.0, 1.15, 0.9, -2.1, 0.75, 0, 34], fx: { ...before, ...polished, ...headlights, ...carbon, ...tails } },
  // window tint: the right-hand rear side, the quarter window and rear window turned black
  { id: 'K6', t: 20, cam: [-0.9, 1.1, 3.4, -0.6, 0.95, 0.7, 36], fx: { ...before, ...polished, ...headlights, ...carbon, ...tails, ...tint, backlight: 1 } },
  // starlight: inside the cabin, the starlit headliner
  { id: 'K7', t: 20, cam: [-1.28, 0.98, 0.0, 0.5, 1.4, 0.0, 70], fx: { ...before, ...polished, ...headlights, ...carbon, ...tails, ...tint, stars: 1 } },
  // final: front three-quarter, everything done, lights on
  { id: 'K8', t: 20, cam: [4.6, 0.95, 3.2, 0.2, 0.55, 0, 36], fx: { ...before, ...polished, ...headlights, ...carbon, ...tails, ...tint } },
];

// the phone version (9:16): the same moments and the same camera targets; the camera steps back
// along its line of sight (three.js fov is vertical, so a tall frame shows far less width) and the
// lens opens a little, more for wide shots than for close-ups
const VERTICAL = { K0: [1.55, 1.25], K1: [1.6, 1.25], K2: [1.45, 1.25], K3: [1.25, 1.2], K4: [1.35, 1.2], K5: [1.5, 1.25], K6: [1.45, 1.25], K7: [1.0, 1.0], K8: [1.55, 1.25] };
export const keyframesVertical = keyframes.map((k) => {
  const [far, lens] = VERTICAL[k.id];
  const [px, py, pz, lx, ly, lz, fov] = k.cam;
  const cam = [lx + (px - lx) * far, ly + (py - ly) * far, lz + (pz - lz) * far, lx, ly, lz, Math.min(78, fov * lens)];
  return { ...k, id: k.id + 'v', cam };
});
