import { lights } from '../../../content/pricing.js';
import { fmtRange, readForm, setQuote, easer } from './util.js';

const LIGHTS = {
  on: { on: 1, brake: 0, beams: 1 },
  brake: { on: 1, brake: 1, beams: 1 },
  off: { on: 0, brake: 0, beams: 0 },
};

/** Smoked lights on the studio Porsche: rear and/or front, 50 % or 80 %, lit or not. */
export function setup({ section, form, view }) {
  const totalEl = section.querySelector('[data-total]');
  const detailEl = section.querySelector('[data-detail]');
  const quote = section.querySelector('[data-quote]');
  const zones = Object.fromEntries([...section.querySelectorAll('[data-zone]')].map((z) => [z.dataset.zone, z]));
  const materialNotes = [...section.querySelectorAll('[data-material-note]')];
  const material = () => lights.materials.find((m) => m.id === s.material) || lights.materials[0];
  const smokeOf = (id) => lights.shades.find((x) => String(x.id) === String(id))?.smoke ?? 0;
  const labelOf = (id) => lights.shades.find((x) => String(x.id) === String(id))?.label ?? '';
  let viewer = null;
  let fx = null;
  let s = readForm(form);
  let price = 0;

  form.addEventListener('change', (e) => {
    const zone = e.target.closest('[data-zone]');
    if (zone && e.target.type === 'radio') zone.querySelector('.zone__toggle input').checked = true;
    if (!viewer) return;
    if (zone) view(zone.dataset.zone === 'rear' ? 'arriere' : '34avant');
    else if (e.target.name === 'lightsOn' && e.target.value === 'brake') view('arriere');
  });

  quote.addEventListener('click', (e) => {
    if (price) return;
    e.preventDefault();
    detailEl.classList.add('is-flash');
    setTimeout(() => detailEl.classList.remove('is-flash'), 900);
  });

  const targets = () => ({
    tail: s.rear ? smokeOf(s.rearShade) : 0,
    head: s.front ? smokeOf(s.frontShade) : 0,
    ...LIGHTS[s.lightsOn || 'on'],
  });

  function update() {
    s = readForm(form);
    zones.rear.classList.toggle('is-off', !s.rear);
    zones.front.classList.toggle('is-off', !s.front);
    const m = material();
    materialNotes.forEach((el) => (el.hidden = el.dataset.materialNote !== m.id));
    const parts = [];
    if (s.rear) parts.push(`feux arrière ${labelOf(s.rearShade).toLowerCase()}`);
    if (s.front) parts.push(`feux avant ${labelOf(s.frontShade).toLowerCase()}`);
    // price per pair (front or rear), between min and max depending on the vehicle; a price
    // waiting for validation is never shown: « Sur devis »
    const pairs = (s.rear ? 1 : 0) + (s.front ? 1 : 0);
    price = pairs;
    const range = pairs && m.validated ? `${fmtRange(m.perPair.min * pairs, m.perPair.max * pairs)} TTC` : 'sur devis';
    totalEl.textContent = !pairs ? '—' : m.validated ? fmtRange(m.perPair.min * pairs, m.perPair.max * pairs) : 'Sur devis';
    detailEl.textContent = pairs
      ? `${m.label} — ${parts.join(' + ')} — ${pairs} paire${pairs > 1 ? 's' : ''}, ${m.validated ? 'tarif indicatif selon le véhicule' : 'tarif établi sur devis'}`
      : 'Cochez les feux à teinter.';
    quote.setAttribute('aria-disabled', String(!pairs));
    setQuote(section, { prestation: 'feux-arriere-teintes', config: pairs ? `Feux teintés — ${m.label} — ${parts.join(', ')} — ${range}` : '' });
    fx?.set(targets());
  }

  return {
    mode: 'studio',
    car: 'suv', // the X6: big light clusters, the smoke reads clearly
    initialView: '34arriere',
    update,
    async attach(v) {
      viewer = v;
      fx = easer(v, targets(), (c) => {
        const car = viewer.car;
        car.setTailSmoke(c.tail);
        car.setHeadSmoke?.(c.head);
        car.setTailOn?.(c.on);
        car.setBrake(c.brake);
        car.setHeadlights(c.beams);
      });
    },
  };
}
