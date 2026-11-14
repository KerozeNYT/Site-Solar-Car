// Screen recording of the site on a phone, picture by picture (30 i/s), with the page's own
// clock (JS timers, requestAnimationFrame) moved 1/30 s per picture and the CSS animations
// slowed down to the same pace. Output: <out>/<clip>/f0000.jpg … and <out>/<clip>/taps.json.
//   node capture.cjs <out> [clip] (DRAFT=1: 1x pictures, no pacing)
const { chromium, devices } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const fs = require('fs');
const path = require('path');

const OUT = process.argv[2];
const ONLY = process.argv[3];
const DRAFT = process.env.DRAFT === '1';
const BASE = process.env.BASE || 'http://localhost:4190';
const FPS = 30;
const DT = 1000 / FPS;
const PACE = DRAFT ? 0 : 360; // real ms per picture (CSS animations slowed to match)
const VW = 390;
const VH = 760;
const DSF = DRAFT ? 1 : 2;

const ease = (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
const easeOut = (x) => 1 - Math.pow(1 - x, 3);

/** the page's clock in our hands: one requestAnimationFrame per picture, 1/30 s apart */
async function takeClock(page) {
  if (page._clock) return;
  page._clock = true;
  await page.clock.install();
  await page.clock.pauseAt(new Date(Date.now() + 1000));
  await page.evaluate((dt) => {
    window.requestAnimationFrame = (cb) => setTimeout(() => cb(performance.now()), dt);
  }, DT);
}
/** let the page work (downloads, decoding) while its clock moves on at 30 i/s */
async function pump(page, sec, until) {
  const end = Date.now() + sec * 1000;
  while (Date.now() < end) {
    await page.clock.runFor(DT);
    await page.waitForTimeout(40);
    if (until && (await page.evaluate(until).catch(() => false))) break;
  }
}

async function recorder(page, ctx, name) {
  const dir = path.join(OUT, name);
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });
  await takeClock(page);
  const cdp = await ctx.newCDPSession(page);
  await cdp.send('Animation.enable');
  if (PACE) await cdp.send('Animation.setPlaybackRate', { playbackRate: DT / PACE });
  let i = 0;
  let last = Date.now();
  const taps = [];
  const scrollY = () => page.evaluate(() => scrollY);
  const setY = (y) => page.evaluate((y) => window.scrollTo({ top: y, behavior: 'instant' }), y);
  const rec = {
    get i() {
      return i;
    },
    async frame() {
      await page.clock.runFor(DT);
      const wait = PACE - (Date.now() - last);
      if (wait > 0) await page.waitForTimeout(wait);
      last = Date.now();
      await page.screenshot({ path: path.join(dir, `f${String(i).padStart(4, '0')}.jpg`), type: 'jpeg', quality: 92 });
      i++;
    },
    async hold(sec) {
      for (let k = Math.round(sec * FPS); k > 0; k--) await rec.frame();
    },
    /** scroll to y (or to y given by a function of the progress) over `sec`, eased */
    async scroll(to, sec, fn = ease) {
      const from = await scrollY();
      const n = Math.max(1, Math.round(sec * FPS));
      for (let k = 1; k <= n; k++) {
        await setY(from + (to - from) * fn(k / n));
        await rec.frame();
      }
    },
    /** a tap at the centre of an element (it must be on screen) */
    async tap(locator) {
      const bb = await locator.boundingBox();
      const x = bb.x + bb.width / 2;
      const y = bb.y + bb.height / 2;
      taps.push({ frame: i, x, y });
      await page.touchscreen.tap(x, y);
    },
    /** scroll so that the element's top is `at` px from the top of the screen */
    async yFor(locator, at) {
      return locator.evaluate((e, at) => e.getBoundingClientRect().top + scrollY - at, at);
    },
    setY,
    done() {
      fs.writeFileSync(path.join(dir, 'taps.json'), JSON.stringify({ viewport: [VW, VH], dsf: DSF, fps: FPS, frames: i, taps }, null, 1));
      console.log(name, i, 'pictures', taps.length, 'taps');
    },
  };
  return rec;
}

const clips = {
  // home page: the film follows the scroll, chapter by chapter
  async home(page, ctx) {
    await page.goto(BASE + '/', { waitUntil: 'networkidle' });
    // the first scroll fetches the sharp version of the film: let it arrive, then back to the top
    await page.evaluate(() => scrollTo(0, 30));
    await page.waitForFunction(() => document.querySelector('.tour__video--hd.is-on'), null, { timeout: 60000 }).catch(() => console.log('no hd version'));
    await page.waitForTimeout(2000);
    await page.evaluate(() => scrollTo({ top: 0, behavior: 'instant' }));
    await page.waitForTimeout(1500);
    const map = await page.evaluate(() => {
      const s = document.querySelector('[data-film]');
      const stage = s.querySelector('[data-stage]');
      const pace = JSON.parse(s.dataset.pace || '{}');
      return { top: s.getBoundingClientRect().top + scrollY, screen: stage.clientHeight || innerHeight, hold: pace.hold, rate: pace.rate, start: Number(s.dataset.start) || 0 };
    });
    const yAt = (t) => map.top + map.hold * map.screen + (t - map.start) * map.rate * map.screen;
    const rec = await recorder(page, ctx, 'home');
    let t = 0;
    const film = async (to, sec, fn = ease) => {
      const from = t;
      const n = Math.round(sec * FPS);
      for (let k = 1; k <= n; k++) {
        const tt = from + (to - from) * fn(k / n);
        await rec.setY(k === 1 && from === 0 ? Math.max(yAt(tt), 2) : yAt(tt));
        await rec.frame();
      }
      t = to;
    };
    await rec.hold(0.5);
    await film(9.6, 1.7);
    await film(10.6, 0.9, (x) => x);
    await film(16.6, 1.2);
    await film(17.0, 0.5, (x) => x);
    await film(31.4, 1.4);
    await film(33.4, 1.1, easeOut);
    await rec.hold(0.3);
    rec.done();
  },

  // window tint simulator in 3D: shades of the rear windows, then an iridescent windscreen
  async sim(page, ctx) {
    await page.goto(BASE + '/vitres-teintees/', { waitUntil: 'networkidle' });
    await page.locator('button.tsim__mode[data-mode="3d"]').first().click();
    await page.waitForTimeout(800);
    const sec = page.locator('#simulateur-3d');
    // white paint (like the film's car), clear film, side view: set before the 3D starts
    await sec.locator('label:has(input[name=paint][value="#f2f2f0"])').click({ force: true });
    await sec.locator('label:has(input[name=rearShade][value="70"])').click({ force: true });
    await takeClock(page);
    await sec.locator('[data-sim-start]').evaluate((e) => e.click());
    await pump(page, 90, () => !!document.querySelector('#simulateur-3d canvas') && document.querySelector('#simulateur-3d .sim__state')?.hidden !== false);
    await pump(page, 25);
    await sec.locator('[data-view="profil"]').click({ force: true });
    await pump(page, 8);
    const header = await page.evaluate(() => document.querySelector('[data-header]').getBoundingClientRect().bottom);
    const view = sec.locator('[data-sim-view]');
    const y0 = await view.evaluate((e, h) => e.getBoundingClientRect().top + scrollY - h - 8, header);
    await page.evaluate((y) => scrollTo({ top: y, behavior: 'instant' }), y0);
    await pump(page, 3);
    const rec = await recorder(page, ctx, 'sim');
    await rec.hold(0.5);
    const chip = (v) => sec.locator(`label:has(input[name=rearShade][value="${v}"])`);
    const LOW = 600; // keep the touched chips clear of the action bar at the bottom
    const need = await chip('35').evaluate((e) => e.getBoundingClientRect().bottom);
    if (need > LOW) await rec.scroll(y0 + (need - LOW), 0.5);
    await rec.tap(chip('35'));
    await rec.hold(1.1);
    await rec.tap(chip('5'));
    await rec.hold(0.8);
    // straight behind: the rear window, where the film shows most
    await rec.tap(sec.locator('[data-view="arriere"]'));
    await rec.hold(1.1);
    // the price, and « Avant / après »: the car without the film, then with it again
    const total = sec.locator('[data-total]');
    const tt = await total.evaluate((e) => e.getBoundingClientRect().top);
    await rec.scroll((await page.evaluate(() => scrollY)) + (tt - 372), 0.7);
    await rec.hold(0.2);
    const cmp = sec.locator('[data-compare]');
    await rec.tap(cmp);
    await rec.hold(1.0);
    await rec.tap(cmp);
    await rec.hold(1.1);
    rec.done();
  },

  // online booking: a day, a time, the summary
  async booking(page, ctx) {
    await page.addInitScript(() => {
      Element.prototype.scrollIntoView = function () {};
    });
    await page.goto(BASE + '/reservation/?prestation=vitres&vehicule=berline&formule=rear', { waitUntil: 'networkidle' });
    await page.waitForFunction(() => document.querySelector('.cal__day[data-date]'), null, { timeout: 30000 });
    await page.waitForTimeout(1000);
    const header = await page.evaluate(() => document.querySelector('[data-header]').getBoundingClientRect().bottom);
    const rec = await recorder(page, ctx, 'booking');
    await rec.hold(0.7);
    const slot = page.locator('fieldset[data-step="slot"]');
    await rec.scroll(await rec.yFor(slot, header + 10), 1.0);
    await rec.hold(0.3);
    const day = page.locator('.cal__day[data-date]').nth(1);
    await rec.tap(day);
    await rec.hold(0.5);
    const times = page.locator('[data-times]');
    const tb = await times.evaluate((e) => e.getBoundingClientRect().top);
    await rec.scroll((await page.evaluate(() => scrollY)) + tb - 300, 0.7);
    await rec.hold(0.2);
    await rec.tap(page.locator('.times__btn').nth(2));
    await rec.hold(0.6);
    const sum = page.locator('.booking__summary, [data-summary], .booking aside').first();
    const ys = (await sum.count()) ? await rec.yFor(sum, header + 12) : 0;
    await rec.scroll(Math.max(0, ys), 1.0);
    await rec.hold(1.3);
    rec.done();
  },
};

(async () => {
  const browser = await chromium.launch({ args: ['--hide-scrollbars'] });
  for (const [name, fn] of Object.entries(clips)) {
    if (ONLY && ONLY !== name) continue;
    const ctx = await browser.newContext({ ...devices['iPhone 13'], viewport: { width: VW, height: VH }, deviceScaleFactor: DSF });
    const page = await ctx.newPage();
    page.on('console', (m) => m.type() === 'error' && console.log('[page]', m.text().slice(0, 160)));
    const t0 = Date.now();
    await fn(page, ctx);
    console.log(name, ((Date.now() - t0) / 1000).toFixed(0), 's');
    await ctx.close();
  }
  await browser.close();
})();
