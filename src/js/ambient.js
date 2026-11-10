/**
 * Garage ambience under every page: the ceiling tubes, the wet floor and the light sweep are pure
 * CSS (src/styles/main.css, "garage ambience"); the smoke is drawn here, once, into two small
 * canvases (nothing to download) that the CSS stretches and drifts slowly. Canvases are never a
 * page's "largest content", so the smoke cannot delay the first screen.
 */

/** value noise on a lattice, smoothly interpolated (deterministic for a seed) */
function noise2(seed) {
  const N = 256;
  const perm = new Uint8Array(N * 2);
  const val = new Float32Array(N);
  let s = seed * 9301 + 49297;
  const rnd = () => ((s = (s * 9301 + 49297) % 233280) / 233280);
  for (let i = 0; i < N; i++) {
    perm[i] = i;
    val[i] = rnd();
  }
  for (let i = N - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [perm[i], perm[j]] = [perm[j], perm[i]];
  }
  for (let i = 0; i < N; i++) perm[N + i] = perm[i];
  const at = (x, y) => val[perm[(perm[x & 255] + y) & 511]];
  return (x, y) => {
    const xi = Math.floor(x);
    const yi = Math.floor(y);
    const xf = x - xi;
    const yf = y - yi;
    const u = xf * xf * (3 - 2 * xf);
    const v = yf * yf * (3 - 2 * yf);
    const a = at(xi, yi);
    const b = at(xi + 1, yi);
    const c = at(xi, yi + 1);
    const d = at(xi + 1, yi + 1);
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
  };
}

/** one smoke layer: wisps stretched sideways, thicker near the floor, white-grey with alpha */
function smoke(seed, w = 200, h = 112) {
  const n = noise2(seed);
  const fbm = (x, y) => {
    let sum = 0;
    let amp = 0.5;
    for (let o = 0; o < 5; o++) {
      sum += amp * n(x, y);
      x = x * 2.03 + 17.1;
      y = y * 2.03 + 3.7;
      amp *= 0.5;
    }
    return sum;
  };
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const g = c.getContext('2d');
  const img = g.createImageData(w, h);
  const d = img.data;
  for (let y = 0; y < h; y++) {
    const fy = y / h;
    // haze profile: a layer above the floor, a thinner one under the ceiling lights
    const profile = Math.max(Math.exp(-((fy - 0.72) ** 2) / 0.05), 0.55 * Math.exp(-((fy - 0.22) ** 2) / 0.02));
    for (let x = 0; x < w; x++) {
      const fx = x / w;
      // domain warp: curls in the wisps
      const wx = fbm(fx * 3 + 5.2, fy * 4 + 1.3);
      const wy = fbm(fx * 3 + 1.7, fy * 4 + 9.2);
      const v = fbm(fx * 2.6 + wx * 1.6, fy * 5.2 + wy * 1.2);
      const a = Math.min(1, Math.max(0, (v - 0.42) * 2.6)) * profile;
      // soft fade on the left and right edges (the layer drifts sideways)
      const edge = Math.min(1, fx * 6, (1 - fx) * 6);
      const i = (y * w + x) * 4;
      d[i] = 206;
      d[i + 1] = 212;
      d[i + 2] = 222;
      d[i + 3] = Math.round(a * edge * 255);
    }
  }
  g.putImageData(img, 0, 0);
  c.className = 'ambient__smoke';
  return c;
}

export function startAmbient() {
  const host = document.querySelector('[data-ambient]');
  if (!host || host.dataset.on) return;
  host.dataset.on = '1';
  // the tubes flicker on at the first page of a visit only, then they are simply on
  try {
    if (!sessionStorage.getItem('ambient')) {
      host.classList.add('is-first');
      sessionStorage.setItem('ambient', '1');
    }
  } catch {
    /* storage blocked: no flicker */
  }
  const haze = host.querySelector('[data-haze]');
  const idle = (fn) => ('requestIdleCallback' in window ? requestIdleCallback(fn, { timeout: 2000 }) : setTimeout(fn, 400));
  // one layer per idle slot: each takes a few milliseconds, never one long task
  idle(() => {
    haze.append(smoke(7));
    requestAnimationFrame(() => host.classList.add('is-on'));
    idle(() => {
      const b = smoke(23);
      b.classList.add('ambient__smoke--b');
      haze.append(b);
    });
  });
}
