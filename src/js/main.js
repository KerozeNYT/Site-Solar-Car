// Site-wide behaviour. Everything here is progressive enhancement: pages work without it.

const html = document.documentElement;
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

// ---------------------------------------------------------------- navigation
const toggle = document.querySelector('[data-nav-toggle]');
if (toggle) {
  const list = document.getElementById(toggle.getAttribute('aria-controls'));
  toggle.addEventListener('click', () => {
    const open = toggle.getAttribute('aria-expanded') !== 'true';
    toggle.setAttribute('aria-expanded', String(open));
    list.classList.toggle('is-open', open);
  });
  list.addEventListener('click', (e) => {
    if (e.target.closest('a')) {
      toggle.setAttribute('aria-expanded', 'false');
      list.classList.remove('is-open');
    }
  });
}

// ---------------------------------------------------------------- in-page links
document.addEventListener('click', (e) => {
  const a = e.target.closest('a[data-scroll]');
  if (!a) return;
  const target = document.querySelector(a.getAttribute('href'));
  if (!target) return;
  e.preventDefault();
  target.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' });
  history.replaceState(null, '', a.getAttribute('href'));
});

// ---------------------------------------------------------------- 3D tour
function webgl2() {
  try {
    const c = document.createElement('canvas');
    const gl = c.getContext('webgl2', { failIfMajorPerformanceCaveat: true });
    if (gl) gl.getExtension('WEBGL_lose_context')?.loseContext();
    return !!gl;
  } catch {
    return false;
  }
}
const tour = document.querySelector('[data-tour]');
if (tour) {
  const fallback = () => {
    html.classList.remove('tour-live');
    tour.classList.add('is-static');
  };
  if (html.classList.contains('tour-live') && webgl2()) {
    import('./tour/index.js')
      .then((m) => m.startTour(tour))
      .catch((err) => {
        console.warn('[tour] static fallback', err);
        fallback();
      });
  } else fallback();
}

// ---------------------------------------------------------------- simulators
const sims = document.querySelectorAll('[data-sim]');
if (sims.length) {
  import('./sim/index.js').then((m) => sims.forEach((el) => m.initSimulator(el, { webgl: webgl2() && !reduceMotion })));
}

// ---------------------------------------------------------------- reveal on scroll
if (!reduceMotion && 'IntersectionObserver' in window) {
  const io = new IntersectionObserver(
    (entries) => {
      for (const en of entries) {
        if (en.isIntersecting) {
          en.target.classList.add('is-in');
          io.unobserve(en.target);
        }
      }
    },
    { rootMargin: '0px 0px -8% 0px' }
  );
  document.querySelectorAll('.service-card, .steps li, .benefits li, .faq__item, .checklist li').forEach((el) => {
    el.classList.add('reveal');
    io.observe(el);
  });
}

// ---------------------------------------------------------------- contact form
const form = document.querySelector('[data-form]');
if (form) {
  const status = form.querySelector('[data-form-status]');
  // prefill from a simulator ("demander ce devis") or a service page link
  const q = new URLSearchParams(location.search);
  const presta = q.get('prestation');
  if (presta) form.querySelectorAll(`input[name="prestations"][value="${CSS.escape(presta)}"]`).forEach((i) => (i.checked = true));
  const config = q.get('config');
  if (config) {
    const msg = form.querySelector('[name="message"]');
    if (msg && !msg.value) msg.value = `Configuration choisie sur le simulateur :\n${config}\n\n`;
  }
  const vehicle = q.get('vehicule');
  if (vehicle) {
    const v = form.querySelector('[name="vehicule"]');
    if (v && !v.value) v.value = vehicle;
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    status.className = 'form__status';
    if (!form.checkValidity()) {
      form.reportValidity();
      status.textContent = 'Merci de compléter les champs obligatoires.';
      status.classList.add('is-error');
      return;
    }
    if (form.hasAttribute('data-demo')) {
      status.textContent = 'Démonstration : le formulaire n’est pas encore relié à une adresse de réception, aucun message n’a été envoyé.';
      status.classList.add('is-error');
      return;
    }
    const btn = form.querySelector('[type="submit"]');
    btn.disabled = true;
    status.textContent = 'Envoi en cours…';
    try {
      const res = await fetch(form.action, { method: 'POST', body: new FormData(form), headers: { Accept: 'application/json' } });
      if (!res.ok) throw new Error(String(res.status));
      form.reset();
      status.textContent = 'Merci ! Votre demande a bien été envoyée, nous revenons vers vous rapidement.';
      status.classList.add('is-ok');
    } catch {
      status.textContent = 'L’envoi a échoué. Réessayez ou contactez-nous directement par téléphone ou e-mail.';
      status.classList.add('is-error');
    } finally {
      btn.disabled = false;
    }
  });
}
