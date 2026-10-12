import { detailing, vehicleTypes } from '../../../content/pricing.js';
import { fmt, readForm, vehicleLabel, setQuote, stateBadge, play } from './util.js';
import { smoothstep } from '../tour/math.js';

const IDS = detailing.steps.map((s) => s.id);
const CAMERA = { wash: 'flanc', decon: 'flanc', polish: 'flanc', ceramic: 'dessus', finish: '34avant' };
const DURATION = { wash: 5, decon: 4.5, polish: 5.5, ceramic: 4, finish: 3.5 };

/** Paint state once the given steps are done (the car arrives dirty and swirled). */
function stateAfter(done) {
  return {
    dirt: done.has('wash') ? 0 : 1,
    foam: 0,
    iron: 0,
    polishX: done.has('polish') ? 10 : -10,
    ceramic: done.has('ceramic') ? 1 : 0,
    beads: 0,
    lights: done.has('finish') ? 1 : 0,
  };
}

/** The step's own animation, k = 0..1, layered on the state before it. */
function animate(id, k, st) {
  switch (id) {
    case 'wash':
      st.foam = smoothstep(0, 0.3, k) * (1 - smoothstep(0.62, 0.95, k));
      st.dirt = 1 - smoothstep(0.45, 0.9, k);
      break;
    case 'decon':
      st.iron = smoothstep(0.05, 0.4, k) * (1 - smoothstep(0.7, 0.98, k));
      break;
    case 'polish':
      st.polishX = -2.7 + 5.4 * smoothstep(0.08, 0.95, k);
      if (k >= 1) st.polishX = 10;
      break;
    case 'ceramic':
      st.ceramic = smoothstep(0.1, 0.6, k);
      // water test: the coated paint beads up
      st.beads = smoothstep(0.45, 0.75, k);
      break;
    case 'finish':
      st.lights = smoothstep(0.2, 0.6, k);
      break;
  }
  return st;
}

/** Detailing steps played on the studio Porsche, packages and size-based prices. */
export function setup({ section, form, view }) {
  const totalEl = section.querySelector('[data-total]');
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
    car.setDetailing?.({ dirt: st.dirt, foam: st.foam, iron: st.iron, ceramic: st.ceramic, beads: st.beads, side: -5 });
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
    const factor = detailing.sizeFactor[s.vehicle] ?? 1;
    const priceOf = (p) => Math.round((p.from * factor) / 10) * 10;
    for (const p of detailing.packages) {
      const el = section.querySelector(`[data-pkg-price="${p.id}"]`);
      if (el) el.textContent = `dès ${fmt(priceOf(p))}`;
    }
    for (const b of stepBtns) b.classList.toggle('is-included', pkg.steps.includes(b.dataset.step));
    const label = vehicleLabel(vehicleTypes, s.vehicle);
    const price = priceOf(pkg);
    totalEl.textContent = `dès ${fmt(price)}`;
    detailEl.textContent = `Forfait ${pkg.label} · ${label} — ${pkg.steps.length} étapes : ${pkg.steps
      .map((id) => detailing.steps.find((x) => x.id === id).label.split(' ')[0].toLowerCase())
      .join(', ')}. Prix final selon l’état de la peinture.`;
    setQuote(section, { prestation: 'detailing-carrosserie', vehicle: label, config: `Detailing — forfait ${pkg.label} — ${label} — dès ${fmt(price)}` });
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
