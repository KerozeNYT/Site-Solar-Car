import { lights } from '../../../content/pricing.js';
import { fmt, readForm, setQuote, easer } from './util.js';

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
    const parts = [];
    if (s.rear) parts.push(`feux arrière ${labelOf(s.rearShade).toLowerCase()}`);
    if (s.front) parts.push(`feux avant ${labelOf(s.frontShade).toLowerCase()}`);
    price = s.rear && s.front ? lights.both : s.rear ? lights.rear : s.front ? lights.front : 0;
    totalEl.textContent = price ? fmt(price) : '—';
    detailEl.textContent = price
      ? `${parts.join(' + ')}${s.rear && s.front ? ` (forfait avant + arrière, au lieu de ${fmt(lights.front + lights.rear)})` : ''}`
      : 'Cochez les feux à teinter.';
    quote.setAttribute('aria-disabled', String(!price));
    setQuote(section, { prestation: 'feux-arriere-teintes', config: price ? `Feux teintés — ${parts.join(', ')} — ${fmt(price)}` : '' });
    fx?.set(targets());
  }

  return {
    mode: 'studio',
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
