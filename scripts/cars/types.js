/**
 * Body types of the window tint simulator (simplified mode, /vitres-teintees/): one generic car
 * per category, built by scripts/cars/scene.js from these numbers and rendered in the studio by
 * scripts/cars/render.mjs. Proportions follow the example model of each category (overall
 * length, width, height, wheelbase, wheel size), not its styling: the pictures show which windows
 * are tinted, they are not portraits of a given make.
 *
 * Car frame: metres, nose towards +x, right-hand side towards +z, ground at y = 0, centred on
 * the middle of the wheelbase. Profiles are [x, y] points along the car, from the rear to the
 * front:
 * - body:  the top line of the lower body (boot lid, belt line, bonnet), rear to front
 * - roof:  the greenhouse outline above it, from the base of the rear window to the base of the
 *          windscreen (passing over the roof)
 * - windows: side glass outlines in the (x, y) side projection, grouped as `front` (front
 *          doors) and `rear` (everything behind the B-pillar); the rear windscreen is `rear` too.
 */
export const carTypes = [
  {
    id: 'petite-citadine',
    // Fiat 500: 3.57 m, short bonnet, tall rounded cabin, three doors
    L: 3.57, W: 1.63, wheelbase: 2.3, axle: -0.05, R: 0.3, track: 1.4, clearance: 0.14,
    body: [[-1.83, 0.62], [-1.8, 0.86], [-1.62, 0.9], [-1.4, 0.92], [-0.2, 0.95], [0.55, 0.96], [0.95, 0.9], [1.45, 0.78], [1.72, 0.66], [1.8, 0.5]],
    roof: [[-1.62, 0.9], [-1.55, 1.18], [-1.38, 1.42], [-0.9, 1.49], [0.0, 1.49], [0.25, 1.46], [0.95, 0.96]],
    windows: {
      front: [[-0.12, 0.99], [-0.12, 1.4], [0.18, 1.41], [0.84, 1.0]],
      rear: [[-1.3, 0.97], [-1.28, 1.3], [-1.0, 1.39], [-0.3, 1.39], [-0.26, 0.98]],
    },
    paint: '#f1f0ec',
  },
  {
    id: 'citadine',
    // Audi A3 Sportback: 4.34 m, five doors, hatchback
    L: 4.34, W: 1.82, wheelbase: 2.64, axle: 0.0, R: 0.33, track: 1.56, clearance: 0.14,
    body: [[-2.18, 0.58], [-2.15, 0.88], [-1.95, 0.94], [-1.6, 0.95], [-0.4, 0.97], [0.75, 0.98], [1.2, 0.9], [1.9, 0.76], [2.15, 0.62], [2.2, 0.45]],
    roof: [[-1.95, 0.94], [-1.82, 1.2], [-1.62, 1.4], [-1.2, 1.43], [0.1, 1.43], [0.5, 1.39], [1.2, 0.98]],
    windows: {
      front: [[-0.08, 1.0], [-0.08, 1.36], [0.42, 1.36], [1.08, 1.02]],
      rear: [[-1.55, 0.99], [-1.5, 1.28], [-1.12, 1.36], [-0.2, 1.36], [-0.2, 0.99]],
    },
    split: [-0.95],
    paint: '#f1f0ec',
  },
  {
    id: 'berline',
    // BMW Série 3: 4.71 m, saloon with a boot
    L: 4.71, W: 1.83, wheelbase: 2.85, axle: -0.05, R: 0.34, track: 1.58, clearance: 0.13,
    body: [[-2.4, 0.6], [-2.36, 0.94], [-2.15, 1.0], [-1.7, 1.02], [-1.35, 1.0], [-0.4, 0.98], [0.9, 0.98], [1.35, 0.9], [2.05, 0.76], [2.3, 0.62], [2.35, 0.45]],
    roof: [[-1.7, 1.02], [-1.25, 1.3], [-0.85, 1.43], [0.25, 1.44], [0.6, 1.39], [1.35, 0.99]],
    windows: {
      front: [[0.05, 1.0], [0.05, 1.38], [0.55, 1.37], [1.22, 1.02]],
      rear: [[-1.42, 1.0], [-1.06, 1.3], [-0.78, 1.38], [-0.07, 1.38], [-0.07, 1.0]],
    },
    split: [-0.92],
    paint: '#f1f0ec',
  },
  {
    id: 'cabriolet',
    // Audi A4 Cabriolet: 4.67 m, two doors, fabric hood
    L: 4.67, W: 1.82, wheelbase: 2.82, axle: -0.05, R: 0.34, track: 1.58, clearance: 0.13,
    body: [[-2.38, 0.6], [-2.34, 0.92], [-2.1, 0.98], [-1.5, 0.99], [-0.4, 0.97], [0.95, 0.97], [1.4, 0.9], [2.05, 0.76], [2.3, 0.62], [2.33, 0.45]],
    roof: [[-1.5, 0.99], [-1.1, 1.25], [-0.75, 1.36], [0.25, 1.37], [0.6, 1.33], [1.4, 0.98]],
    windows: {
      front: [[-0.12, 0.99], [-0.12, 1.31], [0.5, 1.31], [1.28, 1.0]],
      rear: [[-1.02, 1.0], [-0.85, 1.22], [-0.62, 1.3], [-0.24, 1.3], [-0.24, 0.99]],
    },
    softTop: true,
    paint: '#f1f0ec',
  },
  {
    id: 'coupe',
    // BMW Série 2 Coupé: 4.54 m, two doors, long glasshouse sweep
    L: 4.54, W: 1.84, wheelbase: 2.74, axle: -0.05, R: 0.34, track: 1.6, clearance: 0.13,
    body: [[-2.3, 0.6], [-2.26, 0.92], [-2.05, 0.98], [-1.5, 0.99], [-0.4, 0.96], [0.85, 0.96], [1.3, 0.88], [2.0, 0.74], [2.25, 0.6], [2.28, 0.44]],
    roof: [[-1.5, 0.99], [-1.05, 1.24], [-0.7, 1.37], [0.2, 1.39], [0.55, 1.34], [1.3, 0.97]],
    windows: {
      front: [[-0.2, 0.98], [-0.2, 1.33], [0.48, 1.33], [1.18, 1.0]],
      rear: [[-1.15, 0.99], [-0.9, 1.22], [-0.65, 1.32], [-0.32, 1.32], [-0.32, 0.98]],
    },
    paint: '#f1f0ec',
  },
  {
    id: 'break',
    // Audi A6 Avant: 4.94 m, estate, long roof
    L: 4.94, W: 1.89, wheelbase: 2.92, axle: -0.08, R: 0.35, track: 1.62, clearance: 0.14,
    body: [[-2.55, 0.6], [-2.5, 0.95], [-2.3, 1.0], [-1.6, 1.01], [-0.4, 1.0], [0.95, 1.0], [1.4, 0.92], [2.1, 0.78], [2.35, 0.64], [2.4, 0.46]],
    roof: [[-2.3, 1.0], [-2.2, 1.24], [-2.0, 1.43], [-1.6, 1.47], [0.2, 1.47], [0.6, 1.42], [1.4, 1.01]],
    windows: {
      front: [[0.05, 1.03], [0.05, 1.41], [0.58, 1.4], [1.27, 1.04]],
      rear: [[-2.05, 1.03], [-1.95, 1.3], [-1.6, 1.4], [-0.08, 1.41], [-0.08, 1.03]],
    },
    split: [-0.92, -1.5],
    paint: '#f1f0ec',
  },
  {
    id: 'monospace',
    // Renault Espace: 4.72 m, tall, steep windscreen sweep, three side windows
    L: 4.72, W: 1.84, wheelbase: 2.74, axle: -0.06, R: 0.36, track: 1.6, clearance: 0.17,
    body: [[-2.38, 0.66], [-2.34, 1.02], [-2.15, 1.07], [-1.6, 1.08], [-0.4, 1.06], [0.75, 1.05], [1.25, 0.98], [2.0, 0.85], [2.3, 0.7], [2.34, 0.5]],
    roof: [[-2.15, 1.07], [-2.05, 1.38], [-1.85, 1.62], [-1.4, 1.65], [0.1, 1.65], [0.45, 1.59], [1.25, 1.06]],
    windows: {
      front: [[-0.05, 1.09], [-0.05, 1.56], [0.35, 1.56], [1.12, 1.1]],
      rear: [[-1.9, 1.09], [-1.82, 1.46], [-1.5, 1.57], [-0.2, 1.57], [-0.2, 1.09]],
    },
    split: [-1.05],
    paint: '#f1f0ec',
  },
  {
    id: 'suv',
    // BMW X5: 4.92 m, 2.0 m wide, high bonnet and belt line
    L: 4.92, W: 2.0, wheelbase: 2.98, axle: -0.05, R: 0.4, track: 1.7, clearance: 0.2,
    body: [[-2.5, 0.72], [-2.45, 1.1], [-2.25, 1.15], [-1.6, 1.16], [-0.4, 1.14], [0.95, 1.14], [1.45, 1.08], [2.15, 0.96], [2.42, 0.8], [2.46, 0.58]],
    roof: [[-2.25, 1.15], [-2.15, 1.45], [-1.95, 1.71], [-1.6, 1.75], [0.25, 1.75], [0.65, 1.69], [1.45, 1.15]],
    windows: {
      front: [[0.08, 1.17], [0.08, 1.66], [0.6, 1.65], [1.32, 1.18]],
      rear: [[-1.98, 1.17], [-1.88, 1.53], [-1.6, 1.66], [-0.08, 1.66], [-0.08, 1.17]],
    },
    split: [-1.0, -1.6],
    paint: '#f1f0ec',
    cladding: true,
  },
  {
    id: 'tesla',
    // Tesla Model 3: 4.72 m, fastback saloon, all-glass roof
    L: 4.72, W: 1.85, wheelbase: 2.88, axle: -0.05, R: 0.34, track: 1.58, clearance: 0.14,
    body: [[-2.38, 0.6], [-2.34, 0.95], [-2.12, 1.0], [-1.75, 1.02], [-0.4, 0.98], [0.9, 0.97], [1.35, 0.88], [2.05, 0.72], [2.32, 0.58], [2.36, 0.44]],
    roof: [[-1.75, 1.02], [-1.25, 1.28], [-0.75, 1.42], [0.25, 1.44], [0.65, 1.38], [1.35, 0.98]],
    windows: {
      front: [[0.04, 1.0], [0.04, 1.38], [0.62, 1.36], [1.22, 1.01]],
      rear: [[-1.45, 1.01], [-1.08, 1.28], [-0.75, 1.38], [-0.08, 1.38], [-0.08, 1.0]],
    },
    split: [-0.95],
    glassRoof: true,
    paint: '#f1f0ec',
  },
  {
    id: 'utilitaire',
    // Volkswagen Transporter: 4.9 m, van, short bonnet, flat roof, vertical tail
    L: 4.9, W: 1.9, wheelbase: 3.0, axle: 0.12, R: 0.36, track: 1.62, clearance: 0.18,
    body: [[-2.45, 0.6], [-2.45, 1.08], [-1.5, 1.1], [0.6, 1.1], [1.25, 1.08], [1.9, 1.0], [2.35, 0.86], [2.45, 0.66], [2.47, 0.48]],
    roof: [[-2.45, 1.1], [-2.45, 1.93], [-2.3, 1.99], [0.8, 1.99], [1.0, 1.95], [1.9, 1.06]],
    windows: {
      front: [[0.95, 1.13], [0.95, 1.76], [1.15, 1.78], [1.78, 1.13]],
      rear: [[-2.25, 1.13], [-2.25, 1.8], [0.62, 1.8], [0.62, 1.13]],
    },
    split: [-0.6],
    van: true,
    paint: '#f1f0ec',
  },
];
