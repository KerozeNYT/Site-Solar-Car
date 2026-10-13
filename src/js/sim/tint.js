import { tint, vehicleTypes } from '../../../content/pricing.js';
import { fmt, readForm, vehicleLabel, setQuote, easer, stateBadge } from './util.js';

const CLEAR = 0.88; // untreated glass, for "avant / après"

/** Window film: vehicle category, rear package and/or front windows, shade, paint colour. */
export function setup({ section, form, view }) {
  const totalEl = section.querySelector('[data-total]');
  const detailEl = section.querySelector('[data-detail]');
  const warning = section.querySelector('[data-front-warning]');
  const ack = section.querySelector('[data-ack]');
  const quote = section.querySelector('[data-quote]');
  const compareBtn = section.querySelector('[data-compare]');
  const tag = section.querySelector('[data-model-tag]');
  const zones = Object.fromEntries([...section.querySelectorAll('[data-zone]')].map((z) => [z.dataset.zone, z]));
  const iriseBox = section.querySelector('[data-irise]');
  const windNote = section.querySelector('[data-wind-note]');
  const W = tint.windshield;
  const windFilm = () => W.films.find((f) => f.id === s.windshieldFilm) || W.films[0];
  const windColor = () => W.colors.find((c) => c.id === s.iriseColor) || W.colors[0];
  const badge = stateBadge(section);
  let viewer = null;
  let fx = null;
  let compare = false;
  let shown = null; // vehicle on screen
  let s = readForm(form);
  let state = { price: 0, illegal: false };

  // touching a shade switches its zone on, and the camera turns to that zone
  form.addEventListener('change', (e) => {
    const zone = e.target.closest('[data-zone]');
    if (!zone) return;
    const toggle = zone.querySelector('.zone__toggle input');
    if (e.target.type === 'radio') toggle.checked = true;
    if (viewer && viewer.view !== 'interieur') view({ rear: '34arriere', front: 'profil', windshield: 'parebrise' }[zone.dataset.zone] || 'profil');
  });

  compareBtn?.addEventListener('click', () => {
    compare = !compare;
    compareBtn.setAttribute('aria-pressed', String(compare));
    compareBtn.textContent = compare ? 'Voir avec le film' : 'Avant / après';
    update();
  });

  quote.addEventListener('click', (e) => {
    if (!state.price) {
      e.preventDefault();
      detailEl.classList.add('is-flash');
      setTimeout(() => detailEl.classList.remove('is-flash'), 900);
    } else if (state.illegal && !ack.checked) {
      e.preventDefault();
      warning.classList.add('is-flash');
      setTimeout(() => warning.classList.remove('is-flash'), 900);
      ack.focus();
    }
  });

  function targets() {
    if (compare) return { rear: CLEAR, front: CLEAR, wind: CLEAR, irid: 0 };
    const f = windFilm();
    return {
      rear: s.rear ? +s.rearShade / 100 : CLEAR,
      front: s.front ? +s.frontShade / 100 : CLEAR,
      wind: s.windshield ? f.vlt / 100 : CLEAR,
      irid: s.windshield && f.iridescent ? 1 : 0,
    };
  }

  async function showVehicle(type) {
    if (!viewer || shown === type) return;
    shown = type;
    section.querySelector('[data-sim-view]').toggleAttribute('data-busy', true);
    const entry = await viewer.setVehicle(type);
    section.querySelector('[data-sim-view]').toggleAttribute('data-busy', false);
    if (!entry) return; // superseded by a newer choice
    tag.hidden = entry.real;
    // the provisional silhouettes have no detailed cabin: no inside view for them
    const inside = section.querySelector('[data-view="interieur"]');
    if (inside) {
      inside.disabled = !entry.real;
      inside.title = entry.real ? '' : 'Vue intérieure disponible avec le modèle réaliste';
    }
    viewer.car.setPaint?.(s.paint);
    fx.set(targets(), true);
    view(!entry.real && viewer.view === 'interieur' ? '34arriere' : viewer.view || '34arriere');
  }

  function update() {
    s = readForm(form);
    zones.rear.classList.toggle('is-off', !s.rear);
    zones.front.classList.toggle('is-off', !s.front);
    zones.windshield.classList.toggle('is-off', !s.windshield);
    const rearShade = +s.rearShade;
    const frontShade = +s.frontShade;
    const wf = windFilm();
    const wc = windColor();
    iriseBox.hidden = !wf.iridescent;
    windNote.hidden = wf.id !== 'athermique';
    const illegalFront = !!s.front && frontShade < tint.legalFrontMin;
    const illegalWind = !!s.windshield && !wf.legal && !wf.iridescent;
    const illegal = illegalFront || illegalWind;
    warning.hidden = !illegal;
    const label = vehicleLabel(vehicleTypes, s.vehicle);
    const parts = [];
    let price = 0;
    if (s.rear) {
      price += tint.rearPackage[s.vehicle];
      parts.push(`3/4 arrière ${rearShade} % : ${fmt(tint.rearPackage[s.vehicle])}`);
    }
    if (s.front) {
      const p = s.rear ? tint.frontWithRear : tint.frontOnly;
      price += p;
      parts.push(`vitres avant ${frontShade} % : ${s.rear ? '+ ' : ''}${fmt(p)}`);
    }
    if (s.windshield) {
      price += wf.price;
      parts.push(`pare-brise ${wf.iridescent ? `irisé ${wc.label.toLowerCase()}` : wf.label.toLowerCase()} : ${parts.length ? '+ ' : ''}${fmt(wf.price)}`);
    }
    state = { price, illegal };
    totalEl.textContent = price ? fmt(price) : '—';
    detailEl.textContent = price ? `${label} — ${parts.join(' · ')}` : 'Cochez au moins une zone à teinter.';
    quote.setAttribute('aria-disabled', String(!price || (illegal && !s.ack)));
    setQuote(section, {
      prestation: 'vitres-teintees',
      vehicle: label,
      config: price
        ? `Vitres teintées — ${label} : ${parts.join(', ')} — total ${fmt(price)}` +
          (illegalFront ? ` — teinte avant ${frontShade} % (< ${tint.legalFrontMin} %) demandée sous la responsabilité du client` : '') +
          (illegalWind ? ` — pare-brise ${wf.vlt} % (< ${tint.legalFrontMin} %) demandé sous la responsabilité du client` : '')
        : '',
    });
    badge(compare ? 'Sans film (avant)' : '');
    if (!viewer) return;
    viewer.car.setPaint?.(s.paint);
    fx.set(targets());
    // the film colour is not eased: apply it now (with the current eased amounts)
    viewer.car?.setWindshield?.({ vlt: fx.cur.wind, irid: fx.cur.irid, film: windColor().film, colors: windColor().colors });
    viewer.invalidate?.();
    showVehicle(s.vehicle);
  }

  return {
    mode: 'showroom',
    initialView: '34arriere',
    update,
    async attach(v) {
      viewer = v;
      fx = easer(v, targets(), (c) => {
        viewer.car?.setRearVLT(c.rear);
        viewer.car?.setFrontVLT(c.front);
        viewer.car?.setWindshield?.({ vlt: c.wind, irid: c.irid, film: windColor().film, colors: windColor().colors });
      });
      await showVehicle(s.vehicle);
    },
  };
}
