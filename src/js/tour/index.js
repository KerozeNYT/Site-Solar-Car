import { keys, beats, effects, stills, mobileScale } from '../../../content/flight.js';
import carConfig from '../../../content/car.js';
import vehicles, { parked } from '../../../content/vehicles.js';
import { createStage } from './stage.js';
import { createPath, createTimeline, createEffects } from './flight.js';
import { clamp, smoothstep } from './math.js';
import { createGovernor, BUDGET } from '../perf.js';
import { createCoveringSpot } from './covering-spot.js';

const FADE = 14; // vh used by a chapter to fade in / out (at the computer's pace)

/**
 * Scroll-driven fly-through. Native scrolling is never hijacked: scroll position is read,
 * mapped through the beat timeline to the flight clock, and the camera eases towards it.
 */
export async function startTour(section) {
  const stageEl = section.querySelector('[data-stage]');
  const canvas = section.querySelector('[data-canvas]');
  const chapterEls = [...section.querySelectorAll('[data-chapter]')];
  const progressEl = section.querySelector('[data-progress]');
  const indexEl = section.querySelector('[data-chapter-index]');
  const nameEl = section.querySelector('[data-chapter-name]');
  const loadingEl = section.querySelector('[data-loading]');
  const pctEl = section.querySelector('[data-loading-pct]');
  const readouts = [...section.querySelectorAll('[data-readout]')];
  // clock times read from the beats (never hard-coded): headlight chapter start, last road shot
  const headStart = beats.find((b) => b.chapter === 'headlights')?.from ?? Infinity;
  const revealFrom = beats.find((b) => b.id === 'reveal')?.from ?? Infinity;
  const params = new URLSearchParams(location.search);
  const stillId = params.get('still');
  // everything this tour instance listens to ends together (relaunch, static fallback)
  const ac = new AbortController();
  const signal = ac.signal;

  const mobile = matchMedia('(max-width: 760px)').matches;
  // phones: a more direct tour (same camera path, less scrolling)
  const scale = mobile && !stillId ? mobileScale : 1;
  const fade = FADE * scale;
  const timeline = createTimeline(scale === 1 ? beats : beats.map((b) => ({ ...b, vh: b.vh * scale })));
  const path = createPath(keys);
  const fx = createEffects(effects);
  section.style.setProperty('--travel', timeline.total);
  section.dataset.scale = String(scale); // read by the "fly to a chapter" links (src/js/main.js)

  const weak = (navigator.hardwareConcurrency || 4) <= 4 || (navigator.deviceMemory || 8) <= 4;
  const quality = stillId ? 'high' : mobile || weak ? 'low' : 'high';

  loadingEl.hidden = false;
  const stage = await createStage(canvas, {
    quality,
    maxDpr: stillId ? Number(params.get('dpr') || 1) : mobile ? 1.25 : 1.5,
    carConfig,
    signTexture: '/img/brand/enseigne.webp',
    onProgress: (e) => {
      if (e.total) pctEl.textContent = Math.round((e.loaded / e.total) * 100) + ' %';
    },
  });
  loadingEl.hidden = true;
  // the other supplied cars parked around the studio (scenery, desktop only)
  const parking =
    quality === 'high' && !navigator.connection?.saveData
      ? stage.park(parked.studio.map((s) => ({ ...s, config: vehicles[s.car].config })))
      : Promise.resolve();

  // chapter ranges (vh) from the beats; chapter elements keep their document order
  const ranges = timeline.chapters;
  const order = chapterEls.map((el) => el.dataset.chapter);
  const names = Object.fromEntries(chapterEls.map((el) => [el.dataset.chapter, el.querySelector('.kicker')?.textContent || '']));
  const sideOf = Object.fromEntries(chapterEls.map((el) => [el.dataset.chapter, el.classList.contains('chapter--right') ? -1 : 1]));
  // covering chapter: the interactive spot on the door (src/js/tour/covering-spot.js)
  const spotChapter = section.querySelector('[data-chapter="covering"]');
  let spotFilm = null;
  try {
    spotFilm = JSON.parse(spotChapter?.querySelector('[data-spot]')?.dataset.film || 'null');
  } catch {
    /* no spot */
  }
  let spot = null;
  try {
    if (spotFilm) spot = createCoveringSpot({ chapter: spotChapter, stage: { car: stage.car, wake: () => start() }, film: spotFilm, reduceMotion: matchMedia('(prefers-reduced-motion: reduce)').matches, signal });
  } catch (err) {
    console.warn('[tour] covering spot unavailable', err); // the chapter's own links remain
  }

  let vhPx = stageEl.clientHeight || innerHeight;
  let sectionTop = 0;
  const measure = () => {
    vhPx = stageEl.clientHeight || innerHeight;
    sectionTop = section.getBoundingClientRect().top + scrollY;
    stage.resize(stageEl.clientWidth, stageEl.clientHeight);
  };
  measure();
  const ro = new ResizeObserver(measure);
  ro.observe(stageEl);

  const scrollVh = () => ((scrollY - sectionTop) / vhPx) * 100;
  let current = stillId ? stills[stillId] ?? 0 : timeline.timeAt(scrollVh());
  const sample = {};
  let offX = 0;
  let offY = 0;

  function chapterState(vh) {
    let active = null;
    let best = 0;
    const weights = {};
    ranges.forEach((r, i) => {
      const first = i === 0;
      const last = i === ranges.length - 1;
      const inA = first ? 1 : smoothstep(r.start, r.start + fade, vh);
      const outA = last ? 1 : 1 - smoothstep(r.end - fade, r.end, vh);
      const o = clamp(Math.min(inA, outA));
      weights[r.id] = o;
      if (o > best) {
        best = o;
        active = r.id;
      }
    });
    return { weights, active };
  }

  function apply(t, vh, dt) {
    path.sample(t, sample);
    const e = fx(t);
    const c = stage.car;
    c.setRearVLT(e.rearVLT);
    c.setFrontVLT(e.frontVLT);
    c.setTailSmoke(e.tailSmoke);
    c.setBrake(e.brake);
    c.setPolish(e.polishX, -1);
    c.setWindowDrop('R', e.windowR);
    c.setWindowDrop('L', e.windowL);
    c.setStars(e.stars);
    c.setHeadlightClear(e.headClear);
    c.setHeadlights(e.headlights);

    // copy
    const { weights, active } = chapterState(vh);
    if (spot && !stillId) {
      spot.step(weights.covering ?? 0, dt);
      spot.camera(sample);
    }
    let tx = 0;
    let ty = 0;
    for (const el of chapterEls) {
      const id = el.dataset.chapter;
      const o = stillId ? 0 : weights[id] ?? 0;
      const visible = o > 0.01;
      el.classList.toggle('is-visible', visible);
      el.classList.toggle('is-active', id === active);
      el.toggleAttribute('inert', !visible || o < 0.5);
      el.style.setProperty('--o', o.toFixed(3));
      const copy = el.querySelector('.chapter__copy') || el;
      copy.style.opacity = o.toFixed(3);
      copy.style.transform = `translate3d(0, ${((1 - o) * 24).toFixed(1)}px, 0)`;
      if (mobile) ty += o;
      else tx += o * sideOf[id];
    }
    // shift the subject away from the copy (desktop: sideways, mobile: upwards)
    const targetX = mobile ? 0 : tx * 0.2;
    const targetY = mobile ? -Math.min(1, ty) * 0.14 : 0;
    const k = clamp(1 - Math.exp(-dt * 5));
    offX = clamp(offX + (targetX - offX) * k, -0.4, 0.4);
    offY = clamp(offY + (targetY - offY) * k, -0.4, 0.4);
    stage.setView({ pos: sample.pos, look: sample.look, fov: sample.fov, roll: sample.roll, offsetX: stillId ? 0 : offX, offsetY: stillId ? 0 : offY });
    if (spot && (weights.covering ?? 0) > 0.01) spot.place(stage.camera, stageEl.clientWidth, stageEl.clientHeight);

    // HUD
    progressEl.style.transform = `scaleX(${clamp(vh / timeline.total).toFixed(4)})`;
    if (active) {
      const i = order.indexOf(active);
      indexEl.textContent = String(i + 1).padStart(2, '0');
      nameEl.textContent = names[active].replace(/^\d+\s*—\s*/, '');
    }
    for (const r of readouts) {
      if (r.dataset.readout === 'vlt') r.textContent = Math.round(e.rearVLT * 100);
      if (r.dataset.readout === 'beforeAfter') r.textContent = e.headClear < 0.98 && t > headStart ? (e.headClear < 0.5 ? 'Avant' : 'Après') : 'Après';
    }
    return e;
  }

  // ------------------------------------------------------------- still mode (posters)
  if (stillId) {
    document.documentElement.classList.add('is-still');
    await parking;
    measure();
    if (stillId === 'covering') spot?.preview();
    apply(current, 0, 1);
    stage.render(3);
    stage.render(3);
    section.classList.add('is-ready');
    window.__tour = { stage, timeline };
    window.__stillReady = true;
    return;
  }

  // ------------------------------------------------------------- live loop
  let visible = true;
  let running = false;
  let dead = false; // this instance was replaced (relaunch) or the page went static
  let lost = false; // the browser took the WebGL context away (memory, background tab…)
  let recoverTimer = 0;
  let waitingForScreen = false;
  let last = performance.now();
  const io = new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting;
    if (visible && lost && waitingForScreen) recover();
    if (visible) start();
  });
  io.observe(section);
  document.addEventListener('visibilitychange', () => !document.hidden && start(), { signal });

  // savings for slow devices, in order (src/js/perf.js): only the sharpness goes down. Nothing
  // visible (parked cars, floor reflections) is ever removed during the visit.
  const governor = createGovernor([
    { apply: () => stage.setMaxDpr(1.25), budget: BUDGET.sharpness },
    { apply: () => stage.setMaxDpr(1), budget: BUDGET.sharpness },
    // a device that really struggles (under ~18, then ~15 images a second): softer still
    { apply: () => stage.setMaxDpr(0.85), budget: 55 },
    { apply: () => stage.setMaxDpr(0.7), budget: 66 },
  ]);
  let lastFrame = 0;
  // rendering on demand: full rate while the camera moves; once it has settled, about 20 frames
  // a second while something lives on its own (traffic outside, twinkling stars), else nothing
  // until the next scroll (battery and heat on phones)
  let idle = 0;
  let lastVh = NaN;
  let lastDraw = 0;
  function frame(now) {
    if (dead || lost || !visible || document.hidden) {
      running = false;
      lastFrame = 0;
      return;
    }
    // rAF timestamps can precede performance.now() taken in start(): never step backwards
    const dt = clamp((now - last) / 1000, 0, 0.1);
    last = now;
    const vh = scrollVh();
    const target = timeline.timeAt(vh);
    // ease towards the scroll target; long jumps (links, keyboard) cut straight there
    if (Math.abs(target - current) > 9) current = target;
    else current += (target - current) * (1 - Math.exp(-dt * 6.5));
    const settled = Math.abs(target - current) < 0.002 && vh === lastVh && !spot?.busy;
    lastVh = vh;
    idle = settled ? idle + 1 : 0;
    const e = apply(current, vh, dt);
    // things that move by themselves: the road outside (start and end of the flight), the stars
    const alive = e.stars > 0.01 || current < 7 || current > revealFrom - 2;
    if (idle > 60 && !alive) {
      running = false; // fully still: wait for a scroll, a resize or the tab coming back
      lastFrame = 0;
      return;
    }
    if (idle > 60 && now - lastDraw < 48) {
      lastFrame = 0;
      requestAnimationFrame(frame);
      return;
    }
    // the performance governor only measures back-to-back frames while things move
    if (lastFrame && idle === 0) governor.sample(now - lastFrame);
    lastFrame = now;
    lastDraw = now;
    stage.render(now / 1000);
    requestAnimationFrame(frame);
  }
  function start() {
    if (running || dead || lost) return;
    lastFrame = 0;
    idle = 0;
    running = true;
    last = performance.now();
    requestAnimationFrame(frame);
  }
  addEventListener('scroll', start, { passive: true, signal });
  addEventListener('resize', start, { signal });

  // ------------------------------------------------------------- lost 3D
  // Phones free the WebGL memory of a page under pressure (a second 3D scene, another app, a
  // background tab). The copy stays as it is; the browser usually hands the context back
  // (webglcontextrestored): the scene resumes. Otherwise, once the tour is on screen, it is
  // relaunched once on a fresh canvas (model from the HTTP cache); a second loss leaves the
  // static version, with every chapter readable.
  canvas.addEventListener(
    'webglcontextlost',
    (ev) => {
      ev.preventDefault(); // tells the browser we want it back
      lost = true;
      running = false;
      loadingEl.hidden = false;
      clearTimeout(recoverTimer);
      recoverTimer = setTimeout(() => {
        if (!lost || dead) return;
        if (visible) recover();
        else waitingForScreen = true; // no layout change while the visitor is elsewhere
      }, 2500);
    },
    { signal }
  );
  canvas.addEventListener(
    'webglcontextrestored',
    () => {
      if (dead) return;
      clearTimeout(recoverTimer);
      waitingForScreen = false;
      lost = false;
      stage.restore();
      loadingEl.hidden = true;
      start();
    },
    { signal }
  );
  function teardown() {
    dead = true;
    clearTimeout(recoverTimer);
    ac.abort();
    io.disconnect();
    ro.disconnect();
    spot?.reset();
    try {
      stage.renderer.dispose();
    } catch {
      /* already gone */
    }
  }
  function recover() {
    waitingForScreen = false;
    teardown();
    if (section.dataset.relaunched) {
      staticTour(section);
      return;
    }
    section.dataset.relaunched = '1';
    section.classList.remove('is-ready');
    const fresh = canvas.cloneNode(false);
    canvas.replaceWith(fresh);
    startTour(section).catch((err) => {
      console.warn('[tour] relaunch failed, static version', err);
      staticTour(section);
    });
  }

  apply(current, scrollVh(), 1);
  stage.render(0);
  section.classList.add('is-ready');
  window.__tour = { stage, timeline, get perfLevel() { return governor.level; }, get time() { return current; }, get vh() { return scrollVh(); }, get vhPx() { return vhPx; }, get top() { return sectionTop; } };
  start();
}

/**
 * The static version of the tour (no 3D): chapters stacked over their still images, every title,
 * text and button visible. Clears what the live tour set on them (opacity, inert…).
 */
export function staticTour(section) {
  document.documentElement.classList.remove('tour-live');
  section.classList.remove('is-ready');
  section.classList.add('is-static');
  section.querySelector('[data-loading]')?.setAttribute('hidden', '');
  for (const el of section.querySelectorAll('[data-chapter]')) {
    el.classList.remove('is-visible', 'is-active', 'has-spot-open');
    el.removeAttribute('inert');
    el.style.removeProperty('--o');
    const copy = el.querySelector('.chapter__copy');
    if (copy) {
      copy.style.opacity = '';
      copy.style.transform = '';
    }
  }
}
