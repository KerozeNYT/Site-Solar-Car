import { detailing, vehicleTypes } from '../../../content/pricing.js';
import { readForm, vehicleLabel, setQuote, stateBadge, play } from './util.js';
import { smoothstep } from '../tour/math.js';

const IDS = detailing.steps.map((s) => s.id);
const CAMERA = { wash: 'flanc', decon: 'flanc', rinse: 'flanc', polish: 'flanc', ceramic: '34avant', finish: '34avant' };
const DURATION = { wash: 6.5, decon: 5.5, rinse: 6.5, polish: 5.5, ceramic: 4.5, finish: 4 };
const ROOF = 1.9; // above the roof: a "height" that covers the whole car

/** State of the car once the given steps are done (it arrives dirty and swirled). */
function stateAfter(done) {
  const rinsed = done.has('rinse');
  return {
    dirt: rinsed ? 0 : done.has('wash') ? 0.35 : 1,
    // after the pre-wash, foam is left low on the body (it ran down to the sills); once the
    // iron remover is on, only traces remain
    foam: rinsed || !done.has('wash') ? 0 : done.has('decon') ? 0.15 : 1,
    foamTop: 0.32,
    iron: !rinsed && done.has('decon') ? 1 : 0,
    rinseY: 9,
    wet: 0,
    flow: 8,
    floorFoam: !rinsed && done.has('wash') ? 1 : 0,
    floorIron: !rinsed && done.has('decon') ? 1 : 0,
    floorWet: rinsed && !done.has('polish') ? 1 : 0,
    spray: 0,
    sprayX: 0,
    polishX: done.has('polish') ? 10 : -10,
    ceramic: done.has('ceramic') ? 1 : 0,
    sweep: 0,
    tyre: done.has('finish') ? 1 : 0,
    lights: done.has('finish') ? 1 : 0,
  };
}

/** The step's own animation, k = 0..1, layered on the state before it. */
function animate(id, k, st) {
  const t = k * DURATION[id];
  switch (id) {
    case 'wash':
      // the foam covers the car, dwells, then runs down the panels and onto the floor
      st.flow = t;
      st.foam = smoothstep(0, 0.2, k);
      st.foamTop = ROOF - (ROOF - 0.32) * smoothstep(0.3, 0.95, k);
      st.floorFoam = smoothstep(0.3, 0.9, k);
      st.dirt = 1 - 0.65 * smoothstep(0.35, 0.95, k);
      break;
    case 'decon':
      // the last of the foam has run off; the iron remover goes on and bleeds purple
      st.flow = 8 + t;
      st.foam *= 1 - 0.85 * smoothstep(0, 0.3, k);
      st.iron = smoothstep(0.08, 0.5, k);
      st.floorIron = smoothstep(0.35, 0.95, k);
      break;
    case 'rinse': {
      // pressure washer from the roof down, rear to front; everything leaves with the water
      st.flow = 14 + t;
      const r = smoothstep(0.08, 0.88, k);
      st.rinseY = ROOF - (ROOF + 0.35) * r;
      st.wet = smoothstep(0.05, 0.25, k);
      st.spray = smoothstep(0.02, 0.1, k) * (1 - smoothstep(0.9, 0.98, k));
      st.sprayX = -2.1 + 4.2 * smoothstep(0.05, 0.9, k);
      st.floorFoam *= 1 - smoothstep(0.35, 1, k);
      st.floorIron *= 1 - smoothstep(0.35, 1, k);
      st.floorWet = smoothstep(0.1, 0.6, k);
      if (k >= 1) {
        Object.assign(st, { dirt: 0, foam: 0, iron: 0, rinseY: 9, wet: 0, floorFoam: 0, floorIron: 0, spray: 0 });
      }
      break;
    }
    case 'polish':
      st.polishX = -2.7 + 5.4 * smoothstep(0.08, 0.95, k);
      st.floorWet *= 1 - smoothstep(0, 0.6, k);
      if (k >= 1) st.polishX = 10;
      break;
    case 'ceramic':
      // the coating goes on, then a band of light runs over the deeper gloss
      st.ceramic = smoothstep(0.05, 0.45, k);
      st.sweep = smoothstep(0.3, 0.98, k);
      break;
    case 'finish':
      st.tyre = smoothstep(0.1, 0.5, k);
      st.lights = smoothstep(0.55, 0.9, k);
      break;
  }
  return st;
}

/** Detailing steps played on the studio Porsche (the car arrives dirty and swirled); packages are priced on quote. */
export function setup({ section, form, view }) {
  const detailEl = section.querySelector('[data-detail]');
  const stepText = section.querySelector('[data-step-text]');
  const stepBtns = [...section.querySelectorAll('[data-step]')];
  const playBtn = section.querySelector('[data-play]');
  const badge = stateBadge(section);
  let viewer = null;
  let anim = null;
  let s = readForm(form);
  let pkg = detailing.packages[0];

  const apply = (st) => {
    const car = viewer?.car;
    if (!car) return;
    car.setDetailing?.({ ...st, rims: st.tyre, side: -5 });
    car.setPolish(st.polishX, -1);
    car.setHeadlights(st.lights);
    viewer.invalidate();
  };

  function markStep(id) {
    const i = IDS.indexOf(id);
    stepBtns.forEach((b) => (b.dataset.step === id ? b.setAttribute('aria-current', 'step') : b.removeAttribute('aria-current')));
    const step = detailing.steps[i];
    stepText.textContent = step.text;
    badge(`Étape ${i + 1}/${IDS.length} — ${step.label}`);
  }

  const doneBefore = (id) => new Set(IDS.slice(0, IDS.indexOf(id)).filter((x) => pkg.steps.includes(x)));

  /** play one step from the state the car would be in after the previous ones */
  async function playStep(id) {
    const before = doneBefore(id);
    markStep(id);
    if (!viewer) return true;
    view(CAMERA[id]);
    const run = (anim = play(viewer, DURATION[id], (k) => apply(animate(id, k, stateAfter(before)))));
    return run.finished;
  }

  async function playAll() {
    anim?.cancel();
    playBtn.disabled = true;
    viewer?.autoRotate(false);
    for (const id of pkg.steps) {
      const ok = await playStep(id);
      if (!ok) break;
    }
    playBtn.disabled = false;
  }

  for (const b of stepBtns) {
    b.addEventListener('click', () => {
      anim?.cancel();
      playBtn.disabled = false;
      viewer?.autoRotate(false);
      playStep(b.dataset.step);
    });
  }
  playBtn?.addEventListener('click', playAll);

  function update() {
    s = readForm(form);
    pkg = detailing.packages.find((p) => p.id === s.package) || detailing.packages[0];
    for (const b of stepBtns) b.classList.toggle('is-included', pkg.steps.includes(b.dataset.step));
    const label = vehicleLabel(vehicleTypes, s.vehicle);
    detailEl.textContent = `Forfait ${pkg.label} · ${label} — ${pkg.steps.length} étapes : ${pkg.steps
      .map((id) => detailing.steps.find((x) => x.id === id).label.split(' ')[0].toLowerCase())
      .join(', ')}. Prix établi après examen de la peinture.`;
    setQuote(section, { prestation: 'detailing-carrosserie', vehicle: label, config: `Detailing — forfait ${pkg.label} — ${label}` });
  }

  return {
    mode: 'studio',
    initialView: 'flanc',
    update,
    /** show one moment of a step without animating (posters, tests) */
    preview(id, k) {
      anim?.cancel();
      markStep(id);
      apply(animate(id, k, stateAfter(doneBefore(id))));
    },
    async attach(v) {
      viewer = v;
      // the car arrives as it would at the workshop: dirty, paint swirled
      apply(stateAfter(new Set()));
      badge('Arrivée à l’atelier : carrosserie sale, vernis micro-rayé');
    },
  };
}
