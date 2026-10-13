/**
 * Keeps the 3D smooth on modest phones and computers. While a scene animates, the real time
 * between frames is sampled; when it stays too slow (median over ~45 frames), the next saving
 * in `steps` is applied (lower resolution, fewer extras...). Savings are never undone during
 * the visit, so the scene settles at what the device can carry.
 */
export function createGovernor(steps, { budgetMs = 30, samples = 45 } = {}) {
  let times = [];
  let level = 0;
  return {
    /** time (ms) between two frames drawn one after the other */
    sample(dtMs, force = false) {
      if (force && level < steps.length) {
        steps[level++]();
        return;
      }
      if (level >= steps.length || !(dtMs > 0) || dtMs > 500) return;
      times.push(dtMs);
      if (times.length < samples) return;
      times.sort((a, b) => a - b);
      const median = times[times.length >> 1];
      times = [];
      if (median <= budgetMs) return;
      const step = steps[level++];
      try {
        step();
      } catch (err) {
        console.warn('[perf]', err);
      }
    },
    get level() {
      return level;
    },
  };
}
