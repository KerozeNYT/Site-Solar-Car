/**
 * Garage ambience under every page. Everything is drawn here once, at idle time, into canvases
 * (never a page's "largest content", nothing to download): the ceiling tubes and their
 * reflection on the wet floor, in perspective, two smoke layers and fine dust. The CSS
 * (src/styles/main.css, "garage ambience") moves them once the page has loaded: the smoke drifts,
 * the dust rises, the tubes breathe, a light sweeps the room. Transforms and opacity only.
 */

/** ceiling tubes in perspective, cut into segments, and their blurred reflection on the floor */
function drawGarage(c) {
  const dpr = Math.min(devicePixelRatio || 1, 2);
  const W = innerWidth;
  const H = innerHeight;
  c.width = Math.round(W * dpr);
  c.height = Math.round(H * dpr);
  const g = c.getContext('2d');
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  g.clearRect(0, 0, W, H);
  // eye at 38 % of the height; the ceiling meets the top of the screen at depth z0
  const vx = W / 2;
  const vy = H * 0.38;
  const f = Math.max(W, H * 1.2) * 0.62;
  const ceil = 1;
  const z0 = (f * ceil) / vy;
  const px = (X, z) => vx + (f * X) / z;
  const pyC = (z) => vy - (f * ceil) / z;
  const pyF = (z) => vy + (f * ceil * 1.6) / z;
  const quad = (x1a, x1b, y1, x2a, x2b, y2) => {
    g.beginPath();
    g.moveTo(x1a, y1);
    g.lineTo(x1b, y1);
    g.lineTo(x2b, y2);
    g.lineTo(x2a, y2);
    g.closePath();
    g.fill();
  };
  const rows = [-4.5, -3.5, -2.5, -1.5, -0.5, 0.5, 1.5, 2.5, 3.5, 4.5].map((r) => r * 0.62);
  for (const X of rows) {
    for (let z = z0 * 0.8; z < 16; z += 2.4) {
      const z1 = z;
      const z2 = z + 1.65;
      const fade = Math.max(0, 1 - z / 15) ** 1.4;
      for (const [hw, a] of [
        [0.11, 0.05],
        [0.045, 0.16],
        [0.014, 0.9],
      ]) {
        // ceiling: a soft halo, then the bright core
        g.fillStyle = `rgba(236, 242, 255, ${(a * fade).toFixed(3)})`;
        quad(px(X - hw, z1), px(X + hw, z1), pyC(z1), px(X - hw, z2), px(X + hw, z2), pyC(z2));
        // floor: the same tube, wider and fainter (wet surface)
        g.fillStyle = `rgba(236, 242, 255, ${(a * fade * 0.16).toFixed(3)})`;
        quad(px(X - hw * 2.2, z1), px(X + hw * 2.2, z1), pyF(z1), px(X - hw * 2.2, z2), px(X + hw * 2.2, z2), pyF(z2));
      }
    }
  }
}

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

/** fine dust in the light: specks drawn twice (top and bottom halves) so the loop is seamless */
function drawDust(c) {
  const W = innerWidth;
  const H = innerHeight;
  c.width = W;
  c.height = H * 2;
  const g = c.getContext('2d');
  let s = 11;
  const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  const n = Math.round((W * H) / 7000);
  for (let i = 0; i < n; i++) {
    const x = rnd() * W;
    const y = rnd() * H;
    const r = 0.5 + rnd() * rnd() * 1.6;
    const a = 0.08 + rnd() * 0.3;
    for (const dy of [0, H]) {
      const grad = g.createRadialGradient(x, y + dy, 0, x, y + dy, r * 2.4);
      grad.addColorStop(0, `rgba(255, 244, 222, ${a.toFixed(3)})`);
      grad.addColorStop(1, 'rgba(255, 244, 222, 0)');
      g.fillStyle = grad;
      g.fillRect(x - r * 2.4, y + dy - r * 2.4, r * 4.8, r * 4.8);
    }
  }
}

export function startAmbient() {
  const host = document.querySelector('[data-ambient]');
  if (!host || host.dataset.on) return;
  host.dataset.on = '1';
  const idle = (fn) => ('requestIdleCallback' in window ? requestIdleCallback(fn, { timeout: 2500 }) : setTimeout(fn, 500));
  // 1. the room: ceiling tubes and floor (redrawn when the window changes size)
  idle(() => {
    const room = document.createElement('canvas');
    room.className = 'ambient__room';
    drawGarage(room);
    host.prepend(room);
    let t = 0;
    addEventListener('resize', () => {
      clearTimeout(t);
      t = setTimeout(() => drawGarage(room), 250);
    }, { passive: true });
    requestAnimationFrame(() => host.classList.add('is-on'));
    // 2. smoke, one layer per idle slot (a few milliseconds each)
    const haze = host.querySelector('[data-haze]');
    idle(() => {
      haze.append(smoke(7));
      idle(() => {
        const b = smoke(23);
        b.classList.add('ambient__smoke--b');
        haze.append(b);
      });
    });
  });
  // 3. dust, then the motion: it starts once the page has loaded (never during the first paint)
  const go = () =>
    idle(() => {
      const dust = document.createElement('canvas');
      dust.className = 'ambient__dust';
      drawDust(dust);
      host.querySelector('[data-haze]').after(dust);
      host.classList.add('is-live');
    });
  if (document.readyState === 'complete') go();
  else addEventListener('load', go, { once: true });
}
