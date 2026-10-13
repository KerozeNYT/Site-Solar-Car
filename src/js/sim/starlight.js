import { starlight, vehicleTypes } from '../../../content/pricing.js';
import { readForm, vehicleLabel, setQuote, stateBadge } from './util.js';

const OPTIONS = [
  { id: 'bicolor', label: 'bicolore' },
  { id: 'twinkle', label: 'scintillement' },
  { id: 'shooting', label: 'étoiles filantes' },
  { id: 'constellation', label: 'constellation' },
];
const CONSTELLATIONS = { 'grande-ourse': 'Grande Ourse', orion: 'Orion', cassiopee: 'Cassiopée', 'croix-du-sud': 'Croix du Sud' };

/** Fibre-optic headliner in the studio Porsche: density, colours, twinkle, shooting stars. */
export function setup({ section, form }) {
  const detailEl = section.querySelector('[data-detail]');
  const countLabel = section.querySelector('[data-count-label]');
  const c2 = section.querySelector('[data-c2]');
  const steps = starlight.starSteps;
  const maxStep = steps[steps.length - 1];
  const intensityLabel = section.querySelector('[data-intensity-label]');
  const compareBtn = section.querySelector('[data-compare]');
  const badge = stateBadge(section);
  let viewer = null;
  let s = readForm(form);
  // « Éteindre / Allumer »: the headliner with the fibres off, to compare
  let off = false;
  const setOff = (v) => {
    off = v;
    compareBtn?.setAttribute('aria-pressed', String(v));
    if (compareBtn) compareBtn.textContent = v ? 'Allumer' : 'Éteindre';
    badge(v ? 'Ciel étoilé éteint' : '');
  };
  compareBtn?.addEventListener('click', () => {
    setOff(!off);
    apply();
  });

  // choosing a second colour switches the bicolour option on
  form.addEventListener('change', (e) => {
    if (e.target.name === 'c2') form.querySelector('input[name="opt"][value="bicolor"]').checked = true;
    if (e.target.name === 'constellation') form.querySelector('input[name="opt"][value="constellation"]').checked = true;
  });

  function apply() {
    const car = viewer?.car;
    if (!car?.setStarlight) return;
    const count = steps[+s.count];
    // the 3D headliner holds a fixed number of points: show the density proportionally
    const cap = car.starCapacity || maxStep;
    // the intensity setting dims the whole headliner (fibres off when compared)
    car.setStars(off ? 0 : Math.max(0.2, (+s.intensity || 100) / 100));
    car.setStarlight({
      count: Math.max(1, Math.round((count / maxStep) * Math.min(cap, maxStep))),
      twinkle: s.opt.has('twinkle'),
      bicolor: s.opt.has('bicolor'),
      c1: s.c1,
      c2: s.c2,
      shooting: s.opt.has('shooting'),
      constellation: s.opt.has('constellation') ? s.constellation : null,
    });
    viewer.invalidate();
  }

  // the chip's visible name ("Bleu glacier") rather than its colour code
  const colorName = (name) => form.querySelector(`input[name="${name}"]:checked`)?.closest('label')?.textContent.trim() || '';

  function update() {
    s = readForm(form);
    const count = steps[+s.count];
    countLabel.textContent = `${count} étoiles`;
    if (intensityLabel) intensityLabel.textContent = `${s.intensity || 100} %`;
    c2.classList.toggle('is-off', !s.opt.has('bicolor'));
    const opts = OPTIONS.filter((o) => s.opt.has(o.id));
    const optLabels = opts.map((o) => (o.id === 'constellation' ? `constellation ${CONSTELLATIONS[s.constellation]}` : o.label));
    const label = vehicleLabel(vehicleTypes, s.vehicle);
    detailEl.textContent = `${count} étoiles${optLabels.length ? ' · ' + optLabels.join(' · ') : ''} · ${label}`;
    setQuote(section, {
      prestation: 'ciel-etoile',
      vehicle: label,
      config: `Ciel étoilé — ${count} étoiles, intensité ${s.intensity || 100} %, couleur ${colorName('c1')}${s.opt.has('bicolor') ? ` / ${colorName('c2')}` : ''}${optLabels.length ? ', ' + optLabels.join(', ') : ''} — ${label}`,
    });
    apply();
  }

  return {
    mode: 'studio',
    initialView: 'plafond',
    update,
    reset: () => setOff(false),
    async attach(v) {
      viewer = v;
      // seen up close in a small frame: slightly larger, brighter fibres than in the tour
      const u = v.car.materials?.stars?.uniforms;
      if (u) {
        u.uSize.value = 1.5;
        u.uBoost.value = 1.35;
      }
      apply();
      // twinkle and shooting stars need a running clock while the simulator is on screen
      v.addTicker(() => s.opt.has('twinkle') || s.opt.has('shooting') || s.opt.has('constellation'));
    },
  };
}
