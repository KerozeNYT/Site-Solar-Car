import { starlight, vehicleTypes } from '../../../content/pricing.js';
import { fmt, readForm, vehicleLabel, setQuote } from './util.js';

const CONSTELLATIONS = { 'grande-ourse': 'Grande Ourse', orion: 'Orion', cassiopee: 'Cassiopée', 'croix-du-sud': 'Croix du Sud' };

/** Fibre-optic headliner in the studio Porsche: density, colours, twinkle, shooting stars. */
export function setup({ section, form }) {
  const totalEl = section.querySelector('[data-total]');
  const detailEl = section.querySelector('[data-detail]');
  const countLabel = section.querySelector('[data-count-label]');
  const c2 = section.querySelector('[data-c2]');
  const steps = starlight.starSteps;
  const maxStep = steps[steps.length - 1];
  let viewer = null;
  let s = readForm(form);

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
    car.setStars(1);
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

  function update() {
    s = readForm(form);
    const count = steps[+s.count];
    countLabel.textContent = `${count} étoiles`;
    c2.classList.toggle('is-off', !s.opt.has('bicolor'));
    const factor = starlight.sizeFactor[s.vehicle] ?? 1;
    const extra = Math.max(0, count - starlight.baseStars);
    const kit = (starlight.base + Math.ceil(extra / 100) * starlight.per100) * factor;
    const opts = starlight.options.filter((o) => s.opt.has(o.id));
    const price = Math.round((kit + opts.reduce((a, o) => a + o.price, 0)) / 10) * 10;
    const optLabels = opts.map((o) => (o.id === 'constellation' ? `constellation ${CONSTELLATIONS[s.constellation]}` : o.label.toLowerCase()));
    const label = vehicleLabel(vehicleTypes, s.vehicle);
    totalEl.textContent = fmt(price);
    detailEl.textContent = `${count} étoiles${optLabels.length ? ' · ' + optLabels.join(' · ') : ''} · ${label}`;
    setQuote(section, {
      prestation: 'ciel-etoile',
      vehicle: label,
      config: `Ciel étoilé — ${count} étoiles, couleur ${s.c1}${s.opt.has('bicolor') ? ` / ${s.c2}` : ''}${optLabels.length ? ', ' + optLabels.join(', ') : ''} — ${label} — ${fmt(price)}`,
    });
    apply();
  }

  return {
    mode: 'studio',
    initialView: 'plafond',
    update,
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
