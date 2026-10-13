/** Helpers shared by the simulators. */
export const fmt = (n) => new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n);
/** "100 à 120 €" */
export const fmtRange = (a, b) => (a === b ? fmt(a) : `${a} à ${fmt(b)}`);

/** current form values: radios/selects as strings, checkboxes as booleans, `opt` as a Set */
export function readForm(form) {
  const out = { opt: new Set() };
  for (const el of form.elements) {
    if (!el.name) continue;
    if (el.type === 'radio') {
      if (el.checked) out[el.name] = el.value;
    } else if (el.type === 'checkbox') {
      if (el.name === 'opt') {
        if (el.checked) out.opt.add(el.value);
      } else out[el.name] = el.checked;
    } else out[el.name] = el.value;
  }
  return out;
}

/** vehicle label for a category id */
export const vehicleLabel = (types, id) => types.find((v) => v.id === id)?.label || id;

/** point the "Demander ce devis" link at the contact form, prefilled with the configuration */
export function setQuote(section, { prestation, vehicle, config }) {
  const a = section.querySelector('[data-quote]');
  if (!a) return;
  const q = new URLSearchParams({ prestation });
  if (vehicle) q.set('vehicule', vehicle);
  if (config) q.set('config', config);
  a.href = `/contact/?${q}`;
}

/**
 * Smoothly eases numeric values towards their targets and calls apply() while they move,
 * so every change on the panel glides on the car instead of snapping.
 */
export function easer(viewer, initial, apply, rate = 7) {
  const cur = { ...initial };
  const tgt = { ...initial };
  apply(cur);
  viewer.addTicker((dt) => {
    let changed = false;
    let moving = false;
    for (const k in tgt) {
      const d = tgt[k] - cur[k];
      if (d === 0) continue;
      changed = true;
      if (Math.abs(d) < 0.003) cur[k] = tgt[k];
      else {
        cur[k] += d * (1 - Math.exp(-dt * rate));
        moving = true;
      }
    }
    if (changed) apply(cur);
    return moving || changed;
  });
  return {
    cur,
    tgt,
    set(values, instant = false) {
      Object.assign(tgt, values);
      if (instant) {
        Object.assign(cur, values);
        apply(cur);
      }
      viewer.invalidate();
    },
  };
}

/** small caption over the 3D view ("Avant", "Étape 2/5"…); returns a setter, '' hides it */
export function stateBadge(section) {
  const el = document.createElement('p');
  el.className = 'sim__state';
  el.hidden = true;
  section.querySelector('[data-sim-view]').append(el);
  return (text) => {
    el.hidden = !text;
    el.textContent = text;
  };
}

/** time-based animation through the viewer loop; resolves when done, cancel() stops it */
export function play(viewer, duration, step) {
  let t = 0;
  let stop = false;
  let done;
  const finished = new Promise((r) => (done = r));
  const remove = viewer.addTicker((dt) => {
    if (stop) return false;
    t = Math.min(duration, t + dt);
    step(t / duration, t);
    if (t >= duration) {
      remove();
      done(true);
      return true;
    }
    return true;
  });
  return {
    finished,
    cancel() {
      stop = true;
      remove();
      done(false);
    },
  };
}
