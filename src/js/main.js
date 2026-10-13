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

// ---------------------------------------------------------------- mobile quick actions
// tucked away while the 3D tour (it has its own calls to action) or the footer is on screen
const bar = document.querySelector('.action-bar');
if (bar && 'IntersectionObserver' in window) {
  const hideOn = [...document.querySelectorAll('[data-tour], .site-footer')];
  const seen = new Set();
  const io = new IntersectionObserver((entries) => {
    for (const en of entries) en.isIntersecting ? seen.add(en.target) : seen.delete(en.target);
    bar.classList.toggle('is-hidden', seen.size > 0);
  });
  hideOn.forEach((el) => io.observe(el));
}

// ---------------------------------------------------------------- workshop map (lazy)
const maps = document.querySelectorAll('[data-map]');
if (maps.length && 'IntersectionObserver' in window) {
  const io = new IntersectionObserver(
    (entries) => {
      for (const en of entries) {
        if (!en.isIntersecting) continue;
        io.unobserve(en.target);
        import('./map.js')
          .then((m) => m.initMap(en.target))
          .catch((err) => console.warn('[map] address card kept', err));
      }
    },
    { rootMargin: '400px 0px' }
  );
  maps.forEach((m) => io.observe(m));
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
  document.querySelectorAll('.service-card, .steps li, .benefits li, .faq__item, .checklist li, .reveal-up, .guide-card, .related__list li').forEach((el) => {
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
    if (form.hasAttribute('data-mailto')) {
      // no form service configured: compose the e-mail in the visitor's mail app
      if (form.elements._gotcha?.value) return;
      const d = new FormData(form);
      const prestations = d.getAll('prestations').map((v) => form.querySelector(`input[name="prestations"][value="${CSS.escape(v)}"]`)?.parentElement.textContent.trim() || v);
      const body = [
        `Nom : ${d.get('nom') || ''}`,
        `E-mail : ${d.get('email') || ''}`,
        d.get('telephone') ? `Téléphone : ${d.get('telephone')}` : '',
        `Véhicule : ${d.get('vehicule') || ''}`,
        prestations.length ? `Prestation(s) : ${prestations.join(', ')}` : '',
        '',
        String(d.get('message') || ''),
      ]
        .filter((l, i, a) => l !== '' || a[i - 1] !== '')
        .join('\n');
      const subject = `Demande de devis${prestations.length ? ' – ' + prestations.join(', ') : ''} – ${d.get('vehicule') || ''}`;
      location.href = `mailto:${form.dataset.mailto}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
      status.textContent = 'Votre messagerie s’ouvre avec la demande pré-remplie : vérifiez-la puis envoyez-la. Rien ne s’ouvre ? Écrivez-nous à ' + form.dataset.mailto + ' ou appelez-nous.';
      status.classList.add('is-ok');
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
