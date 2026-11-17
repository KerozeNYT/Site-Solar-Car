/**
 * Christmas snow over every page (content/themes.js, look « noel », December): six-branch
 * crystals and round flakes on three depths, falling and swaying, drawn on one canvas in
 * `.saison-fx` (fixed, under the header, never in the way: pointer-events none).
 *
 * Light on purpose: started once the page has loaded and is idle, never before its main picture;
 * fewer flakes on a phone; each flake shape drawn once into a small sprite; paused while the tab is
 * hidden; nothing at all for the visitors who asked their device to reduce motion (the CSS hides
 * the layer for them too, src/styles/main.css « seasonal looks »). Without the script, the CSS
 * sprinkle of small dots stays.
 */

/** a six-branch crystal, white, into a square sprite of `size` px */
function crystal(size, dpr) {
  const c = document.createElement('canvas');
  c.width = c.height = Math.ceil(size * dpr);
  const g = c.getContext('2d');
  g.scale(dpr, dpr);
  g.translate(size / 2, size / 2);
  g.strokeStyle = 'rgba(255, 255, 255, 0.95)';
  g.lineCap = 'round';
  g.lineWidth = Math.max(1, size / 14);
  g.shadowColor = 'rgba(255, 255, 255, 0.8)';
  g.shadowBlur = size / 6;
  const r = size * 0.42;
  for (let i = 0; i < 6; i++) {
    g.save();
    g.rotate((i * Math.PI) / 3);
    g.beginPath();
    g.moveTo(0, 0);
    g.lineTo(0, -r);
    // two pairs of small branches on each arm
    for (const [at, len] of [
      [0.45, 0.28],
      [0.7, 0.2],
    ]) {
      g.moveTo(0, -r * at);
      g.lineTo(-r * len, -r * (at + len * 0.75));
      g.moveTo(0, -r * at);
      g.lineTo(r * len, -r * (at + len * 0.75));
    }
    g.stroke();
    g.restore();
  }
  return c;
}

/** a round, soft flake */
function dot(size, dpr) {
  const c = document.createElement('canvas');
  c.width = c.height = Math.ceil(size * dpr);
  const g = c.getContext('2d');
  g.scale(dpr, dpr);
  const grad = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  grad.addColorStop(0, 'rgba(255, 255, 255, 0.95)');
  grad.addColorStop(0.45, 'rgba(255, 255, 255, 0.7)');
  grad.addColorStop(1, 'rgba(255, 255, 255, 0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, size, size);
  return c;
}

export function startSnow() {
  const host = document.querySelector('.saison-fx');
  if (!host || host.dataset.snow || document.documentElement.dataset.saison !== 'noel') return;
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  host.dataset.snow = '1';
  const go = () => {
    const dpr = Math.min(devicePixelRatio || 1, 1.5);
    const canvas = document.createElement('canvas');
    canvas.className = 'saison-fx__snow';
    host.append(canvas);
    host.classList.add('is-snowing');
    const g = canvas.getContext('2d');
    // three depths: far (small, slow, faint), middle, near (big crystals, faster)
    const depths = [
      { share: 0.5, sizes: [3, 5], speed: [18, 30], alpha: [0.35, 0.6], crystal: 0 },
      { share: 0.35, sizes: [6, 10], speed: [30, 48], alpha: [0.55, 0.85], crystal: 0.45 },
      { share: 0.15, sizes: [13, 22], speed: [48, 72], alpha: [0.7, 0.95], crystal: 0.9 },
    ];
    const sprites = new Map();
    const sprite = (kind, size) => {
      const key = `${kind}${size}`;
      if (!sprites.has(key)) sprites.set(key, kind === 'c' ? crystal(size, dpr) : dot(size, dpr));
      return sprites.get(key);
    };
    const rnd = (a, b) => a + Math.random() * (b - a);
    let W = 0;
    let H = 0;
    let flakes = [];
    const make = (y) => {
      const r = Math.random();
      let acc = 0;
      const d = depths.find((x) => (acc += x.share) >= r) || depths[0];
      const size = Math.round(rnd(...d.sizes));
      const kind = Math.random() < d.crystal ? 'c' : 'd';
      return { x: rnd(0, W), y: y ?? rnd(-H, 0), size, kind, img: sprite(kind, size), vy: rnd(...d.speed), sway: rnd(8, 26), phase: rnd(0, Math.PI * 2), freq: rnd(0.25, 0.7), spin: kind === 'c' ? rnd(-0.6, 0.6) : 0, rot: rnd(0, Math.PI), alpha: rnd(...d.alpha) };
    };
    const resize = () => {
      W = innerWidth;
      H = innerHeight;
      canvas.width = Math.round(W * dpr);
      canvas.height = Math.round(H * dpr);
      canvas.style.width = `${W}px`;
      canvas.style.height = `${H}px`;
      // how many: by the screen's area, fewer on a phone
      const n = Math.round(Math.min(150, Math.max(40, (W * H) / (W < 760 ? 11000 : 9000))));
      if (flakes.length > n) flakes.length = n;
      while (flakes.length < n) flakes.push(make(rnd(0, H)));
    };
    resize();
    let t0 = performance.now();
    let raf = 0;
    const frame = (t) => {
      const dt = Math.min(0.05, (t - t0) / 1000);
      t0 = t;
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      g.clearRect(0, 0, W, H);
      for (const f of flakes) {
        f.y += f.vy * dt;
        f.phase += f.freq * dt;
        f.rot += f.spin * dt;
        const x = f.x + Math.sin(f.phase) * f.sway;
        if (f.y - f.size > H) Object.assign(f, make(-f.size - rnd(0, 40)));
        g.globalAlpha = f.alpha;
        if (f.kind === 'c') {
          g.save();
          g.translate(x, f.y);
          g.rotate(f.rot);
          g.drawImage(f.img, -f.size / 2, -f.size / 2, f.size, f.size);
          g.restore();
        } else g.drawImage(f.img, x - f.size / 2, f.y - f.size / 2, f.size, f.size);
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    let timer = 0;
    addEventListener(
      'resize',
      () => {
        clearTimeout(timer);
        timer = setTimeout(resize, 200);
      },
      { passive: true }
    );
    // a hidden tab draws nothing
    document.addEventListener('visibilitychange', () => {
      cancelAnimationFrame(raf);
      if (!document.hidden) {
        t0 = performance.now();
        raf = requestAnimationFrame(frame);
      }
    });
  };
  const idle = () => ('requestIdleCallback' in window ? requestIdleCallback(go, { timeout: 2500 }) : setTimeout(go, 600));
  if (document.readyState === 'complete') idle();
  else addEventListener('load', idle, { once: true });
}
