/**
 * Keeps the 3D smooth on modest phones and computers. While a scene animates, the real time
 * between frames is sampled (median over ~45 frames). A saving is applied only when the scene
 * stays slow over two windows in a row: a single hitch (a shader compiled the first time an
 * effect shows up, a busy moment while scrolling back and forth) never strips anything.
 *
 * Each step has its own budget. Resolution steps react below ~25 images a second; steps that
 * remove something visible (parked cars, floor reflections) only when the device really
 * struggles (below ~18 and ~15 images a second). A steady 30 images a second on a 60 Hz screen
 * (33 ms between frames) keeps the whole scene. Savings are never undone during the visit.
 *
 * `steps`: functions (default budget) or { apply, budget } objects, applied in order.
 */
export function createGovernor(steps, { samples = 45, budgetMs = 40, confirm = 2 } = {}) {
  const list = steps.map((s) => (typeof s === 'function' ? { apply: s, budget: budgetMs } : s));
  let times = [];
  let level = 0;
  let strikes = 0;
  const apply = () => {
    const step = list[level++];
    try {
      step.apply();
    } catch (err) {
      console.warn('[perf]', err);
    }
  };
  return {
    /** time (ms) between two frames drawn one after the other */
    sample(dtMs, force = false) {
      if (force && level < list.length) {
        apply();
        return;
      }
      // a stall (compilation, tab switch, garbage collection) says nothing about the steady pace
      if (level >= list.length || !(dtMs > 0) || dtMs > 250) return;
      times.push(dtMs);
      if (times.length < samples) return;
      times.sort((a, b) => a - b);
      const median = times[times.length >> 1];
      times = [];
      if (median <= list[level].budget) {
        strikes = 0;
        return;
      }
      if (++strikes < confirm) return;
      strikes = 0;
      apply();
    },
    get level() {
      return level;
    },
  };
}

/** budgets (ms between frames) of the usual savings: sharpness first, visible content last */
export const BUDGET = { sharpness: 40, scenery: 55, reflections: 66 };
