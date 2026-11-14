// Renders compose.html picture by picture (1080 × 1920, 30 i/s) into <out>/f0000.jpg …
// WORK: the folder holding compose.html, assets/, film-sharp/, film-blur/ and the captures
// (scripts/reel/make.sh prepares it).
//   WORK=<dir> node render.cjs <capture dir name> <out dir> [every]   (every=10: one picture in ten)
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const fs = require('fs');
const path = require('path');
const http = require('http');

const ROOT = path.resolve(process.env.WORK || __dirname);
const CAP = process.argv[2] || 'cap';
const OUT = path.resolve(process.argv[3] || 'out');
const EVERY = Number(process.argv[4] || 1);
const ONLY = process.env.ONLY ? process.env.ONLY.split(',').map(Number) : null;

const TYPES = { '.html': 'text/html', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.png': 'image/png', '.woff2': 'font/woff2', '.json': 'application/json' };
const server = http.createServer((req, res) => {
  const f = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]));
  if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) return res.writeHead(404).end();
  res.writeHead(200, { 'content-type': TYPES[path.extname(f)] || 'application/octet-stream', 'cache-control': 'max-age=3600' });
  fs.createReadStream(f).pipe(res);
});

const CLIPS = [
  { name: 'home', kicker: '01 · Le film', title: 'Faites défiler,<br><em>le film avance</em>', trimEnd: 0.1 },
  { name: 'sim', kicker: '02 · Simulateur 3D', title: 'Essayez la teinte<br><em>avant la pose</em>' },
  { name: 'booking', kicker: '03 · Réservation', title: 'Votre créneau,<br><em>en quelques clics</em>' },
];

(async () => {
  await new Promise((r) => server.listen(4310, r));
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1080, height: 1920 }, deviceScaleFactor: 1 });
  page.on('console', (m) => m.type() === 'error' && console.log('[page]', m.text()));
  page.on('pageerror', (e) => console.log('[pageerror]', e.message));
  await page.goto('http://localhost:4310/compose.html');
  await page.evaluate(() => document.fonts.ready);
  const clips = CLIPS.map((c) => {
    const tj = JSON.parse(fs.readFileSync(path.join(ROOT, CAP, c.name, 'taps.json'), 'utf8'));
    return { ...c, frames: tj.frames, taps: tj.taps, viewport: tj.viewport };
  });
  const info = await page.evaluate((cfg) => window.setup(cfg), {
    capDir: CAP,
    clips,
    hookSpeed: 2.2,
    hookEnd: 3.2,
    hookOut: 2.85,
    phoneIn: 3.0,
    firstClip: 3.25,
    overlap: 0.3,
    endLen: 4.6,
    punch: { clip: 'sim', tap: 3, scale: 1.3, dy: 95 },
  });
  console.log(JSON.stringify(info));
  fs.writeFileSync(path.join(OUT, 'timeline.json'), JSON.stringify(info, null, 1));
  const t0 = Date.now();
  const list = ONLY || [...Array(info.frames).keys()].filter((n) => n % EVERY === 0);
  for (const n of list) {
    await page.evaluate((n) => window.renderFrame(n), n);
    await page.screenshot({ path: path.join(OUT, `f${String(n).padStart(4, '0')}.jpg`), type: 'jpeg', quality: 94 });
    if (n % 150 === 0) console.log(n, '/', info.frames, ((Date.now() - t0) / 1000).toFixed(0) + 's');
  }
  await browser.close();
  server.close();
})();
