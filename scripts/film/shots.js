/**
 * Home page film (36 s, one continuous camera move): camera keys and service effects.
 *
 * Same conventions as content/flight.js: metres, the car at the origin, nose towards +x, its
 * right-hand side towards +z. t = seconds of the film. Chapter times must match content/film.js
 * (copy on screen, readouts), so move them together.
 */
export const duration = 36;

export const keys = [
  // 01 — Hero: straight in front, the car comes out of the dark, slow push in
  { t: 0, p: [10.0, 1.12, 0], l: [0, 0.55, 0], fov: 28 },
  { t: 4.4, p: [5.5, 1.2, 0], l: [0, 0.52, 0], fov: 28 },
  // swing to the right-hand headlight
  { t: 5.4, p: [4.4, 0.88, 1.9], l: [1.3, 0.6, 0.2], fov: 34 },
  // 02 — Headlights: close on the right-hand lens, aged then renovated, then lit
  { t: 6.6, p: [2.95, 0.74, 1.75], l: [1.55, 0.6, 0.3], fov: 36 },
  { t: 8.6, p: [2.65, 0.9, 1.8], l: [1.75, 0.6, 0.5], fov: 36 },
  // 03 — Detailing: down the right-hand side, the polish line moving towards the rear
  { t: 10.0, p: [2.3, 1.05, 3.1], l: [0.8, 0.6, 0.5], fov: 40 },
  { t: 11.4, p: [0.9, 0.98, 2.55], l: [-0.1, 0.58, 0.55], fov: 40 },
  { t: 12.5, p: [-0.15, 0.92, 2.1], l: [-1.05, 0.6, 0.7], fov: 42 },
  { t: 13.6, p: [-0.9, 0.9, 2.35], l: [-1.7, 0.62, 0.6], fov: 42 },
  // 04 — Window tint: back out to the profile, rear windows darkening
  { t: 15.3, p: [0.3, 0.9, 6.1], l: [0.0, 0.62, 0], fov: 34 },
  { t: 18.6, p: [-0.8, 0.92, 5.4], l: [-0.2, 0.62, 0], fov: 34 },
  // 05 — Tail lights: round the rear corner, low and close on the smoked strip
  { t: 20.2, p: [-4.7, 1.12, 4.5], l: [-0.7, 0.6, 0.1], fov: 34 },
  { t: 21.8, p: [-5.4, 1.02, 2.7], l: [-1.3, 0.62, 0.15], fov: 32 },
  { t: 23.6, p: [-4.0, 1.25, 1.15], l: [-2.0, 0.72, 0.1], fov: 34 },
  // 06 — Starlight: along the right-hand side at window height, in through the lowered window
  { t: 24.8, p: [-2.6, 1.15, 2.25], l: [-1.0, 0.92, 0.6], fov: 42 },
  { t: 25.9, p: [-0.95, 1.1, 1.95], l: [0.25, 0.98, 0.45], fov: 46 },
  { t: 26.8, p: [-0.2, 1.08, 1.45], l: [0.1, 1.0, 0.3], fov: 52 },
  { t: 27.5, p: [-0.15, 1.08, 0.95], l: [-0.7, 0.88, -0.3], fov: 60 },
  { t: 28.2, p: [-0.85, 1.0, 0.12], l: [0.2, 1.22, 0.0], fov: 68 },
  { t: 28.8, p: [-1.28, 0.98, 0.0], l: [0.5, 1.4, 0.0], fov: 70 },
  // forward between the seats, then out through the same window, above the mirror
  { t: 29.6, p: [-0.45, 0.99, 0.05], l: [0.8, 1.05, 0.6], fov: 66 },
  { t: 30.2, p: [-0.08, 1.04, 0.6], l: [1.3, 0.98, 1.1], fov: 58 },
  { t: 30.7, p: [0.05, 1.12, 1.35], l: [1.6, 0.85, 0.75], fov: 52 },
  { t: 31.4, p: [1.0, 1.1, 2.45], l: [1.7, 0.72, 0.6], fov: 44 },
  // 07 — Final: three-quarter front, lights on, slow drift
  { t: 32.6, p: [4.5, 0.88, 3.9], l: [0.1, 0.5, 0.0], fov: 34 },
  { t: 36, p: [5.4, 0.86, 4.3], l: [0.0, 0.5, 0.0], fov: 34 },
];

// [t, value] pairs, eased (src/js/tour/math.js `track`)
export const effects = {
  // the picture comes out of black
  fade: [[0, 0], [0.25, 0], [2.4, 1]],
  // headlights: on for the opening, off while the lens is aged, on once renovated and to the end
  headlights: [[0, 0], [0.4, 0], [2.2, 0.7], [4.5, 0.7], [4.9, 0], [7.7, 0], [8.2, 0.7]],
  // lens: aged (0) during the swing, renovated (1) on camera — readout "Avant" 6.7, "Après" 8.0
  headClear: [[0, 1], [4.7, 1], [4.8, 0], [6.9, 0], [7.7, 1]],
  // polish line (m along the car): paint polished in front of it; dulled during the swing
  polishX: [[0, -10], [9.35, -10], [9.4, 2.7], [10.0, 2.4], [14.0, -2.4], [14.4, -10]],
  // rear window and rear quarter windows: 70 % -> 5 % (readout 15.9 -> 17.9)
  rearVLT: [[0, 0.7], [15.9, 0.7], [17.9, 0.05]],
  frontVLT: [[0, 0.75]],
  tailSmoke: [[0, 0.85]],
  tailOn: [[0, 0], [20.2, 0], [20.8, 0.6]],
  // right-hand window down to let the camera in, up again on the way out
  windowR: [[0, 0], [25.3, 0], [26.5, 1], [30.6, 1], [31.9, 0]],
  // the moving pane catches a little light so it reads on screen
  sheen: [[0, 0], [25.1, 0], [25.4, 1], [26.6, 1], [27.0, 0], [30.4, 0], [30.7, 1], [32.0, 1], [32.6, 0]],
  stars: [[0, 0], [27.0, 0], [27.9, 1], [29.9, 1], [30.5, 0]],
  // bloom strength: lower on the rear (the red strip must stay a sharp line)
  bloom: [[0, 0.16], [19.4, 0.16], [19.9, 0.1], [24.6, 0.1], [25.1, 0.16]],
};
