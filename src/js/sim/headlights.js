import { headlights } from '../../../content/pricing.js';
import { fmt, readForm, setQuote, easer, stateBadge, play } from './util.js';

/** Headlight renovation on the studio Porsche: yellowed → clear, with the lights on or off. */
export function setup({ section, form, view }) {
  const totalEl = section.querySelector('[data-total]');
  const detailEl = section.querySelector('[data-detail]');
  const range = form.elements.clear;
  const clearLabel = section.querySelector('[data-clear-label]');
  const playBtn = section.querySelector('[data-play]');
  const badge = stateBadge(section);
  let viewer = null;
  let fx = null;
  let anim = null;
  let s = readForm(form);

  const targets = () => ({ clear: +s.clear / 100, on: s.on === 'on' ? 1 : 0 });

  function update() {
    s = readForm(form);
    const pct = +s.clear;
    clearLabel.textContent = pct >= 100 ? 'Rénovée' : pct <= 0 ? 'Avant' : `${pct} %`;
    badge(pct <= 0 ? 'Avant : optiques jaunies' : pct >= 100 ? 'Après rénovation' : `Polissage… ${pct} %`);
    const opts = headlights.options.filter((o) => s.opt.has(o.id));
    const price = headlights.renovation + opts.reduce((a, o) => a + o.price, 0);
    totalEl.textContent = fmt(price);
    detailEl.textContent = ['Rénovation de la paire de phares (ponçage, polissage, vernis de protection)', ...opts.map((o) => o.label.toLowerCase())].join(' + ');
    setQuote(section, {
      prestation: 'renovation-phares',
      config: `Rénovation de phares${opts.length ? ` + ${opts.map((o) => o.label).join(', ')}` : ''} — ${fmt(price)}`,
    });
    fx?.set(targets());
  }

  // stop a running demo as soon as the visitor takes the slider
  range.addEventListener('pointerdown', () => anim?.cancel());

  playBtn?.addEventListener('click', async () => {
    if (!viewer) return;
    anim?.cancel();
    if (viewer.view !== 'phare') view('phare');
    range.value = 0;
    update();
    fx.set({ clear: 0 }, true);
    const run = (anim = play(viewer, 4.2, (k) => {
      // hold "before" for a moment, then a polishing sweep
      const v = Math.round(Math.min(1, Math.max(0, (k - 0.18) / 0.78)) * 100);
      if (+range.value !== v) {
        range.value = v;
        update();
        fx.set({ clear: v / 100 }, true);
      }
    }));
    playBtn.disabled = true;
    await run.finished;
    playBtn.disabled = false;
  });

  return {
    mode: 'studio',
    initialView: 'phare',
    update,
    async attach(v) {
      viewer = v;
      fx = easer(v, targets(), (c) => {
        viewer.car.setHeadlightClear(c.clear);
        viewer.car.setHeadlights(c.on);
      });
    },
  };
}
