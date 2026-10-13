/**
 * Service-page simulators. The panel (an ordinary form) computes the price on its own; the 3D
 * viewer is an enhancement loaded when the simulator comes into view or on "Lancer la vue 3D".
 */
import { restoreForm, saveForm, forgetForm } from './util.js';

const loaders = {
  tint: () => import('./tint.js'),
  lights: () => import('./lights.js'),
  headlights: () => import('./headlights.js'),
  starlight: () => import('./starlight.js'),
  detailing: () => import('./detailing.js'),
};

export async function initSimulator(section, { webgl = true } = {}) {
  const load = loaders[section.dataset.sim];
  if (!load) return;
  const mod = await load();
  const form = section.querySelector('[data-sim-form]');
  const key = `simulateur:${section.dataset.sim}`;
  // the visitor's last settings come back (before the first update)
  const restored = restoreForm(form, key);
  const viewEl = section.querySelector('[data-sim-view]');
  const startBtn = section.querySelector('[data-sim-start]');
  const viewBtns = [...section.querySelectorAll('[data-view]')];
  form.addEventListener('submit', (e) => e.preventDefault());

  /** move the camera and keep the view buttons in sync (unknown names clear them) */
  function view(name, opts) {
    for (const b of viewBtns) b.setAttribute('aria-pressed', String(b.dataset.view === name));
    viewer?.setView(name, opts);
  }
  let viewer = null;
  const sim = mod.setup({ section, form, view: (name, opts) => view(name, opts) });
  sim.update();
  const changed = () => {
    sim.update();
    saveForm(form, key);
  };
  form.addEventListener('input', changed);
  form.addEventListener('change', changed);
  // « Réinitialiser »: back to the page's defaults (the form resets itself first)
  form.addEventListener('reset', () => {
    forgetForm(key);
    section.querySelector('[data-sim-restored]')?.setAttribute('hidden', '');
    setTimeout(() => {
      sim.reset?.();
      sim.update();
    });
  });
  if (restored) section.querySelector('[data-sim-restored]')?.removeAttribute('hidden');

  if (!webgl) {
    startBtn.hidden = true;
    const p = document.createElement('p');
    p.className = 'sim__fallback';
    p.textContent = 'La vue 3D n’est pas disponible sur cet appareil : le simulateur de prix reste utilisable.';
    viewEl.append(p);
    return;
  }

  let starting = null;
  const label = startBtn.textContent;
  function start() {
    if (starting) return starting;
    startBtn.disabled = true;
    startBtn.textContent = 'Chargement de la 3D…';
    const mobile = matchMedia('(max-width: 760px)').matches;
    const weak = (navigator.hardwareConcurrency || 4) <= 4 || (navigator.deviceMemory || 8) <= 4;
    starting = import('./viewer.js')
      .then(({ createViewer }) =>
        createViewer(viewEl, {
          quality: mobile || weak ? 'low' : 'high',
          mode: sim.mode,
          car: sim.car,
          onProgress: (e) => {
            if (e.total) startBtn.textContent = `Chargement de la 3D… ${Math.round((e.loaded / e.total) * 100)} %`;
          },
        })
      )
      .then(async (v) => {
        viewer = v;
        await sim.attach(v);
        view(sim.initialView, { instant: true });
        section.classList.add('is-ready');
        dispatchEvent(new CustomEvent('sc37:sim', { detail: { service: section.dataset.sim } }));
        window.__sim = { viewer, sim };
        viewer.renderer.domElement.addEventListener('webglcontextlost', (ev) => {
          ev.preventDefault();
          section.classList.remove('is-ready');
          startBtn.hidden = true;
        });
      })
      .catch((err) => {
        console.warn('[sim] 3D unavailable', err);
        startBtn.textContent = 'Vue 3D indisponible';
      });
    return starting;
  }
  startBtn.addEventListener('click', start);
  for (const b of viewBtns) b.addEventListener('click', () => view(b.dataset.view));

  // computers: loads by itself when it nears the viewport. Phones and data savers: the preview
  // image stays until the visitor asks for the 3D (several megabytes of models)
  const conn = navigator.connection;
  const lite = conn?.saveData || /(^|-)2g$/.test(conn?.effectiveType || '');
  const phone = matchMedia('(max-width: 760px)').matches;
  if (lite || phone) startBtn.textContent = `${label} (quelques Mo)`;
  else if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver(
      ([e]) => {
        if (!e.isIntersecting) return;
        io.disconnect();
        start();
      },
      { rootMargin: '300px 0px' }
    );
    io.observe(viewEl);
  }
}
