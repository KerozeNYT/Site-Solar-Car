/**
 * The fly-through: one continuous camera move, edited here.
 *
 * Coordinates are metres in the studio. The car sits at the origin, nose towards +x (the
 * street door at x = 9), its right-hand side towards +z, the driver's side towards -z.
 *
 * - keys:    camera keyframes on a virtual flight clock `t` (seconds). p = position, l = point
 *            looked at, fov = vertical field of view. Banking is added automatically from the
 *            path's curvature, like a pilot leaning into a turn.
 * - beats:   how scroll maps onto the clock. Each beat owns `vh` viewport-heights of scrolling
 *            and moves the clock from `from` to `to` (equal values = a still hold). `chapter`
 *            is the copy shown during the beat (see `tour.chapters` in content/site.js).
 * - effects: service demonstrations keyed on the same clock ([t, value] pairs, eased).
 */

export const keys = [
  // 01 — Arrival: on the forecourt at night, the lit studio framed by the open door
  { t: 0, p: [16.0, 1.5, 3.6], l: [3.0, 1.0, -0.2], fov: 30 },
  { t: 2.5, p: [13.0, 1.4, 2.2], l: [3.0, 0.95, -0.4], fov: 38 },
  { t: 4.5, p: [10.8, 1.3, 1.2], l: [3.0, 0.9, -0.7], fov: 47 },
  // through the door, slowing down, yawing to the driver's side
  { t: 6, p: [7.2, 1.25, -0.5], l: [1.0, 0.95, -1.3], fov: 50 },
  // 02 — Window film: sweep along the driver's side, rising to see the rear glass darken
  { t: 8, p: [3.4, 1.25, -2.9], l: [0.4, 1.0, -0.8], fov: 46 },
  { t: 10, p: [0.6, 1.45, -2.9], l: [-0.9, 1.0, -0.5], fov: 44 },
  { t: 12, p: [-2.2, 1.85, -2.6], l: [-1.0, 0.95, -0.2], fov: 44 },
  // rounding the rear corner, dropping low
  { t: 14, p: [-3.7, 1.3, -1.6], l: [-1.9, 0.85, -0.1], fov: 44 },
  // 03 — Smoked tail lights: low behind the car
  { t: 16, p: [-3.85, 0.92, -0.8], l: [-2.1, 0.78, 0.0], fov: 38 },
  { t: 19, p: [-3.7, 0.88, 0.45], l: [-2.1, 0.78, 0.1], fov: 36 },
  { t: 21, p: [-3.4, 0.95, 2.6], l: [-1.4, 0.75, 0.8], fov: 44 },
  // 04 — Detailing: along the passenger side, rear to front, the polish following
  { t: 23, p: [-2.2, 1.0, 3.0], l: [-1.0, 0.7, 0.6], fov: 44 },
  { t: 26, p: [-0.2, 1.0, 3.1], l: [0.0, 0.65, 0.7], fov: 44 },
  { t: 29, p: [1.8, 1.0, 3.0], l: [1.0, 0.7, 0.7], fov: 46 },
  // into the cabin through the lowered passenger window
  { t: 31, p: [0.55, 1.1, 1.9], l: [0.1, 1.02, 0.6], fov: 52 },
  { t: 33, p: [0.05, 1.04, 1.05], l: [-0.05, 1.02, 0.0], fov: 60 },
  { t: 34.5, p: [-0.05, 1.0, 0.3], l: [-0.25, 1.2, -0.05], fov: 72 },
  // 05 — Starlight headliner: looking up, slow yaw across the ceiling
  { t: 37, p: [-0.12, 0.98, 0.1], l: [-0.4, 1.3, 0.0], fov: 82 },
  { t: 40, p: [-0.2, 0.97, -0.05], l: [-0.2, 1.3, -0.35], fov: 82 },
  // out through the driver's window, banking towards the nose
  { t: 42, p: [-0.05, 1.02, -0.3], l: [0.0, 1.02, -1.4], fov: 66 },
  { t: 43.5, p: [0.05, 1.04, -1.1], l: [0.6, 0.95, -2.2], fov: 56 },
  { t: 45, p: [1.4, 1.1, -2.5], l: [1.9, 0.75, -0.5], fov: 50 },
  // 06 — Headlight renovation: close on the driver's-side headlight
  { t: 47, p: [3.4, 0.82, -1.65], l: [2.0, 0.66, -0.7], fov: 40 },
  { t: 51, p: [3.15, 0.78, -1.15], l: [2.0, 0.66, -0.68], fov: 34 },
  { t: 53.5, p: [3.7, 0.85, -0.6], l: [1.8, 0.7, -0.3], fov: 40 },
  // exit: backwards out of the door, still facing the car, then climb
  { t: 55.5, p: [6.2, 1.2, -0.2], l: [0.5, 0.8, 0.0], fov: 46 },
  { t: 57.5, p: [9.6, 1.9, 0.0], l: [0.5, 0.9, 0.0], fov: 48 },
  { t: 60, p: [16.0, 6.5, 0.5], l: [4.0, 1.0, 0.0], fov: 50 },
  // 07 — Reveal: the workshop on its business park, roads and traffic around it
  { t: 63, p: [27.0, 19.0, 11.0], l: [5.0, 0.0, -1.0], fov: 50 },
];

export const beats = [
  { id: 'hero', vh: 80, from: 0, to: 0, chapter: 'hero' },
  { id: 'approach', vh: 110, from: 0, to: 6, chapter: null },
  { id: 'tint', vh: 150, from: 6, to: 12.5, chapter: 'tint' },
  { id: 'corner', vh: 50, from: 12.5, to: 15, chapter: null },
  { id: 'tail', vh: 120, from: 15, to: 20.5, chapter: 'tail' },
  { id: 'around', vh: 45, from: 20.5, to: 22, chapter: null },
  { id: 'detailing', vh: 150, from: 22, to: 29.6, chapter: 'detailing' },
  { id: 'window-in', vh: 70, from: 29.6, to: 34.5, chapter: null },
  { id: 'stars', vh: 140, from: 34.5, to: 41, chapter: 'stars' },
  { id: 'window-out', vh: 70, from: 41, to: 46, chapter: null },
  { id: 'headlights', vh: 150, from: 46, to: 54, chapter: 'headlights' },
  { id: 'reveal', vh: 120, from: 54, to: 63, chapter: null },
  { id: 'final', vh: 80, from: 63, to: 63, chapter: 'final' },
];

export const effects = {
  // rear window + rear quarter windows: from 70 % to 5 % visible light transmission
  rearVLT: [[0, 0.7], [9, 0.7], [12.2, 0.05]],
  // front side windows stay legal (≥ 70 %) throughout
  frontVLT: [[0, 0.75]],
  tailSmoke: [[0, 0], [15.5, 0], [18, 1]],
  brake: [[0, 0], [18.3, 0], [18.8, 1], [20.4, 1], [21.4, 0]],
  // polish boundary along the car (m). Polished where x < value: sweeps rear -> front.
  polishX: [[0, -10], [21, -10], [22.2, -2.5], [29.2, 2.5], [29.6, 10]],
  windowR: [[0, 0], [30.3, 0], [31.8, 1], [36, 1], [37, 0]],
  windowL: [[0, 0], [40.5, 0], [42.2, 1], [45, 1], [46, 0]],
  stars: [[0, 0], [34.5, 0], [37.6, 1], [42.5, 1], [44, 0]],
  // lenses are "aged" while the camera is inside the cabin, then restored on camera
  headClear: [[0, 1], [38.9, 1], [39, 0], [48, 0], [51.5, 1]],
  headlights: [[0, 0], [51.8, 0], [53, 1]],
};

// Representative clock time of each chapter (stills for reduced motion, posters, OG image).
export const stills = {
  hero: 0,
  tint: 11.8,
  tail: 19.6,
  detailing: 25.6,
  stars: 39.5,
  headlights: 53.4,
  final: 63,
};
