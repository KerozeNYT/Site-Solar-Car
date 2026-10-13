import { keys, beats, effects, stills } from '../../../content/flight.js';
import carConfig from '../../../content/car.js';
import vehicles, { parked } from '../../../content/vehicles.js';
import { createStage } from './stage.js';
import { createPath, createTimeline, createEffects } from './flight.js';
import { clamp, smoothstep } from './math.js';
import { createGovernor } from '../perf.js';

const FADE = 18; // vh used by a chapter to fade in / out

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
  const params = new URLSearchParams(location.search);
  const stillId = params.get('still');

  const timeline = createTimeline(beats);
  const path = createPath(keys);
  const fx = createEffects(effects);
  section.style.setProperty('--travel', timeline.total);

  const mobile = matchMedia('(max-width: 760px)').matches;
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

  let vhPx = stageEl.clientHeight || innerHeight;
  let sectionTop = 0;
  const measure = () => {
    vhPx = stageEl.clientHeight || innerHeight;
    sectionTop = section.getBoundingClientRect().top + scrollY;
    stage.resize(stageEl.clientWidth, stageEl.clientHeight);
  };
  measure();
  new ResizeObserver(measure).observe(stageEl);

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
      const inA = first ? 1 : smoothstep(r.start, r.start + FADE, vh);
      const outA = last ? 1 : 1 - smoothstep(r.end - FADE, r.end, vh);
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

    // HUD
    progressEl.style.transform = `scaleX(${clamp(vh / timeline.total).toFixed(4)})`;
    if (active) {
      const i = order.indexOf(active);
      indexEl.textContent = String(i + 1).padStart(2, '0');
      nameEl.textContent = names[active].replace(/^\d+\s*—\s*/, '');
    }
    for (const r of readouts) {
      if (r.dataset.readout === 'vlt') r.textContent = Math.round(e.rearVLT * 100);
      if (r.dataset.readout === 'beforeAfter') r.textContent = e.headClear < 0.98 && t > 46 ? (e.headClear < 0.5 ? 'Avant' : 'Après') : 'Après';
    }
  }

  // ------------------------------------------------------------- still mode (posters)
  if (stillId) {
    document.documentElement.classList.add('is-still');
    await parking;
    measure();
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
  let last = performance.now();
  const io = new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting;
    if (visible) start();
  });
  io.observe(section);
  document.addEventListener('visibilitychange', () => !document.hidden && start());

  // savings for slow devices, in order (src/js/perf.js)
  const governor = createGovernor([() => stage.setMaxDpr(1.25), () => stage.unpark(), () => stage.setMaxDpr(1), () => stage.setMirror(false)]);
  let lastFrame = 0;
  function frame(now) {
    if (!visible || document.hidden) {
      running = false;
      lastFrame = 0;
      return;
    }
    if (lastFrame) governor.sample(now - lastFrame);
    lastFrame = now;
    // rAF timestamps can precede performance.now() taken in start(): never step backwards
    const dt = clamp((now - last) / 1000, 0, 0.1);
    last = now;
    const vh = scrollVh();
    const target = timeline.timeAt(vh);
    // ease towards the scroll target; long jumps (links, keyboard) cut straight there
    if (Math.abs(target - current) > 9) current = target;
    else current += (target - current) * (1 - Math.exp(-dt * 6.5));
    apply(current, vh, dt);
    stage.render(now / 1000);
    requestAnimationFrame(frame);
  }
  function start() {
    if (running) return;
    lastFrame = 0;
    running = true;
    last = performance.now();
    requestAnimationFrame(frame);
  }
  canvas.addEventListener('webglcontextlost', (ev) => {
    ev.preventDefault();
    document.documentElement.classList.remove('tour-live');
    section.classList.add('is-static');
  });

  apply(current, scrollVh(), 1);
  stage.render(0);
  section.classList.add('is-ready');
  window.__tour = { stage, timeline, get time() { return current; }, get vh() { return scrollVh(); }, get vhPx() { return vhPx; }, get top() { return sectionTop; } };
  start();
}
