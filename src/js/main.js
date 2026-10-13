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
// "Nos prestations" drop-down: hover opens it on desktop (CSS), the button toggles it
// everywhere (keyboard, touch, mobile menu); Escape or a click elsewhere closes it
document.querySelectorAll('[data-submenu]').forEach((group) => {
  const btn = group.querySelector('button');
  const set = (open) => {
    btn.setAttribute('aria-expanded', String(open));
    group.classList.toggle('is-open', open);
  };
  btn.addEventListener('click', () => set(btn.getAttribute('aria-expanded') !== 'true'));
  document.addEventListener('click', (e) => !group.contains(e.target) && set(false));
  group.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && group.classList.contains('is-open')) {
      set(false);
      btn.focus();
    }
  });
  group.addEventListener('focusout', (e) => !group.contains(e.relatedTarget) && matchMedia('(min-width: 981px)').matches && set(false));
});

// ---------------------------------------------------------------- in-page links
document.addEventListener('click', (e) => {
  const a = e.target.closest('a[data-scroll]');
  if (!a) return;
  // into the 3D tour: its chapters are layered in one sticky stage, so scroll to the chapter's
  // position along the tour (in viewport heights) and let the camera fly there
  const tourEl = a.dataset.tourAt && html.classList.contains('tour-live') && document.querySelector('[data-tour]');
  if (tourEl) {
    e.preventDefault();
    // positions are written at the computer's pace; phones run a shorter tour (data-scale)
    const at = Number(a.dataset.tourAt) * (Number(tourEl.dataset.scale) || 1);
    const top = tourEl.getBoundingClientRect().top + scrollY + (at / 100) * innerHeight;
    scrollTo({ top, behavior: reduceMotion ? 'auto' : 'smooth' });
    return;
  }
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
  const optIn = tour.querySelector('[data-tour-start]');
  const fallback = () => {
    html.classList.remove('tour-live');
    tour.classList.add('is-static');
  };
  const go = () =>
    import('./tour/index.js')
      .then((m) => m.startTour(tour))
      .catch((err) => {
        console.warn('[tour] static fallback', err);
        fallback();
      });
  const gl = webgl2();
  if (html.classList.contains('tour-live') && gl) {
    // phones: the page (text, buttons, images) first, the 3D once the phone is idle
    if (matchMedia('(max-width: 760px)').matches) {
      const later = () => ('requestIdleCallback' in window ? requestIdleCallback(go, { timeout: 2500 }) : setTimeout(go, 600));
      if (document.readyState === 'complete') later();
      else addEventListener('load', later, { once: true });
    } else go();
  } else {
    fallback();
    // the 3D was left out (data saver, slow connection, reduced motion): the visitor may still ask for it
    if (gl && optIn) {
      optIn.hidden = false;
      optIn.querySelector('button').addEventListener('click', () => {
        optIn.hidden = true;
        tour.classList.remove('is-static');
        html.classList.add('tour-live');
        scrollTo({ top: tour.getBoundingClientRect().top + scrollY, behavior: 'auto' });
        go();
      });
    }
  }
}

// ---------------------------------------------------------------- simulators
// `data-sim-lazy`: the simulator's code (and its catalogue) loads only when it nears the screen
const sims = [...document.querySelectorAll('[data-sim]')];
if (sims.length) {
  const init = (el) => import('./sim/index.js').then((m) => m.initSimulator(el, { webgl: webgl2(), reduceMotion }));
  const lazy = 'IntersectionObserver' in window ? sims.filter((el) => el.hasAttribute('data-sim-lazy')) : [];
  sims.filter((el) => !lazy.includes(el)).forEach(init);
  if (lazy.length) {
    const io = new IntersectionObserver(
      (entries) => {
        for (const en of entries) {
          if (!en.isIntersecting) continue;
          io.unobserve(en.target);
          init(en.target);
        }
      },
      { rootMargin: '600px 0px' }
    );
    lazy.forEach((el) => io.observe(el));
  }
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
// without WebGL the still image stays (no attempt, no console error)
if (maps.length && 'IntersectionObserver' in window && webgl2()) {
  const io = new IntersectionObserver(
    (entries) => {
      for (const en of entries) {
        if (!en.isIntersecting) continue;
        io.unobserve(en.target);
        import('./map3d.js')
          .then((m) => m.initMap(en.target))
          .catch((err) => console.warn('[map] still image kept', err));
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

// ---------------------------------------------------------------- live Google reviews (lazy)
const reviewsEl = document.querySelector('[data-reviews]');
if (reviewsEl && 'IntersectionObserver' in window) {
  const io = new IntersectionObserver(
    ([en]) => {
      if (!en.isIntersecting) return;
      io.disconnect();
      import('./reviews.js')
        .then((m) => m.showReviews(reviewsEl))
        .catch((err) => console.warn('[reviews] links kept', err));
    },
    { rootMargin: '300px 0px' }
  );
  io.observe(reviewsEl);
}

// ---------------------------------------------------------------- latest Instagram posts (lazy)
const instaEl = document.querySelector('[data-insta]');
if (instaEl && 'IntersectionObserver' in window) {
  const io = new IntersectionObserver(
    ([en]) => {
      if (!en.isIntersecting) return;
      io.disconnect();
      import('./instagram.js')
        .then((m) => m.showInstagram(instaEl))
        .catch((err) => {
          console.warn('[instagram] profile link kept', err);
          instaEl.querySelector('[data-insta-list]')?.remove();
        });
    },
    { rootMargin: '400px 0px' }
  );
  io.observe(instaEl);
}

// ---------------------------------------------------------------- living gold buttons
// each gold button gets its own rhythm so the light sweeps never fire all at once
document.querySelectorAll('.btn--primary').forEach((btn, i) => {
  btn.style.setProperty('--sheen-delay', `${(0.8 + ((i * 2.3) % 5.2) + Math.random() * 0.8).toFixed(2)}s`);
});

// ---------------------------------------------------------------- before / after photos
// the range input (keyboard, touch, mouse) drives the split; the "before" photo is clipped
document.querySelectorAll('[data-ba]').forEach((fig) => {
  const frame = fig.querySelector('.ba__frame');
  const range = fig.querySelector('.ba__range');
  const set = () => frame.style.setProperty('--pos', `${range.value}%`);
  range.addEventListener('input', set);
  set();
});
// a job's other photos: a tap on a thumbnail shows it in place (without JavaScript the link opens it)
document.addEventListener('click', (e) => {
  const a = e.target.closest('[data-work-photo]');
  if (!a) return;
  e.preventDefault();
  const box = a.closest('.work__media');
  const img = box.querySelector('.work__img');
  const id = a.dataset.workPhoto;
  img.src = `${a.getAttribute('href').replace(/[^/]*$/, '')}${id}-960.webp`;
  img.srcset = `${img.src} 960w, ${a.getAttribute('href')} 1600w`;
  img.alt = a.dataset.alt;
  img.style.objectPosition = a.dataset.focus || '';
  box.querySelectorAll('[data-work-photo]').forEach((t) => t.toggleAttribute('aria-current', t === a));
});

// gallery filter by service (all jobs stay listed without JavaScript)
const filter = document.querySelector('[data-works-filter]');
if (filter) {
  const works = [...document.querySelectorAll('[data-works] > [data-service]')];
  filter.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-filter]');
    if (!btn) return;
    filter.querySelectorAll('[data-filter]').forEach((b) => b.setAttribute('aria-pressed', String(b === btn)));
    works.forEach((w) => (w.hidden = !!btn.dataset.filter && w.dataset.service !== btn.dataset.filter));
  });
}

// ---------------------------------------------------------------- conversion events
// Privacy first: no tracker, no cookie, no personal data. Each event is a name plus a few
// non-personal details (page, service), dispatched as `sc37:event` on window and kept in
// window.sc37Events, ready for a cookieless audience tool if one is configured later.
const events = (window.sc37Events = window.sc37Events || []);
function track(name, detail = {}) {
  const ev = { name, page: location.pathname, ...detail, at: Date.now() };
  events.push(ev);
  dispatchEvent(new CustomEvent('sc37:event', { detail: ev }));
}
document.addEventListener('click', (e) => {
  const a = e.target.closest('a[href]');
  if (!a) return;
  const href = a.getAttribute('href');
  if (href.startsWith('tel:')) track('appel');
  else if (/google\.[a-z.]+\/maps|maps\.apple|waze\.com/.test(href)) track('itineraire');
  else if (a.hasAttribute('data-quote')) track('devis_simulateur', { service: a.closest('[data-sim]')?.dataset.sim });
  else if (/\/contact\/$/.test(a.pathname)) track('clic_devis');
});
addEventListener('sc37:sim', (e) => track('simulateur_3d', e.detail));

// ---------------------------------------------------------------- contact form
const form = document.querySelector('[data-form]');
if (form) {
  const status = form.querySelector('[data-form-status]');
  // the earliest wished date is today (the page itself may be older)
  const dateInput = form.querySelector('input[type="date"]');
  if (dateInput) dateInput.min = new Date().toISOString().slice(0, 10);
  // prefill from a simulator ("demander ce devis") or a service page link
  const q = new URLSearchParams(location.search);
  const presta = q.get('prestation');
  if (presta) form.querySelectorAll(`input[name="prestations"][value="${CSS.escape(presta)}"]`).forEach((i) => (i.checked = true));
  const config = q.get('config');
  const vehicle = q.get('vehicule');
  const msg = form.querySelector('[name="message"]');
  if (msg && !msg.value && (config || vehicle)) {
    const lines = ['Configuration choisie sur le simulateur :'];
    if (config) lines.push(config);
    if (vehicle && !(config || '').includes(vehicle)) lines.push(`Catégorie de véhicule : ${vehicle}`);
    msg.value = lines.join('\n') + '\n\n';
  }
  // at least one service ticked (the browser checks the rest)
  const boxes = [...form.querySelectorAll('[data-required-group] input[type="checkbox"]')];
  const syncGroup = () => boxes[0]?.setCustomValidity(boxes.some((b) => b.checked) ? '' : 'Cochez au moins une prestation (ou « Autre demande »).');
  boxes.forEach((b) => b.addEventListener('change', syncGroup));
  syncGroup();
  const fields = (d) => {
    const label = (v) => form.querySelector(`input[name="prestations"][value="${CSS.escape(v)}"]`)?.parentElement.textContent.trim() || v;
    const prestations = d.getAll('prestations').map(label);
    const car = [d.get('marque'), d.get('modele'), d.get('annee')].filter(Boolean).join(' ');
    const wish = [d.get('date_souhaitee') ? `à partir du ${new Date(d.get('date_souhaitee')).toLocaleDateString('fr-FR')}` : '', d.get('moment') || ''].filter(Boolean).join(', ');
    return { prestations, car, wish, subject: `Demande de devis${prestations.length ? ' – ' + prestations.join(', ') : ''} – ${car}` };
  };

  /** the whole request as a pre-filled e-mail (no form service, or the service failed) */
  const mailtoHref = (to, d) => {
    const { prestations, car, wish, subject } = fields(d);
    const body = [
      `Nom : ${d.get('nom') || ''}`,
      `Prénom : ${d.get('prenom') || ''}`,
      `E-mail : ${d.get('email') || ''}`,
      `Téléphone : ${d.get('telephone') || ''}`,
      `Véhicule : ${car}`,
      `Prestation(s) : ${prestations.join(', ')}`,
      `Rendez-vous souhaité : ${wish || 'indifférent'}`,
      '',
      String(d.get('message') || ''),
    ].join('\n');
    return `mailto:${to}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  };

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
      location.href = mailtoHref(form.dataset.mailto, new FormData(form));
      status.textContent = 'Votre messagerie s’ouvre avec la demande pré-remplie : vérifiez-la puis envoyez-la. Rien ne s’ouvre ? Écrivez-nous à ' + form.dataset.mailto + ' ou appelez-nous.';
      status.classList.add('is-ok');
      return;
    }
    const btn = form.querySelector('[type="submit"]');
    // bots fill the hidden field: pretend nothing happened
    if (form.elements._honey?.value || form.elements._gotcha?.value) return;
    // optional attachments: images or PDF, 10 MB in all
    const fileInput = form.querySelector('input[type="file"]');
    const files = fileInput ? [...fileInput.files] : [];
    const maxMb = Number(fileInput?.dataset.maxMb || 10);
    if (files.reduce((a, f) => a + f.size, 0) > maxMb * 1024 * 1024 || files.some((f) => !/^image\/|pdf$/.test(f.type))) {
      status.textContent = `Pièces jointes : images ou PDF uniquement, ${maxMb} Mo maximum au total.`;
      status.classList.add('is-error');
      fileInput.focus();
      return;
    }
    btn.disabled = true;
    status.textContent = 'Envoi en cours…';
    try {
      let res;
      if (/formsubmit\.co\//.test(form.action)) {
        // FormSubmit AJAX endpoint: readable labels in the e-mail, reply-to = the visitor
        const d = new FormData(form);
        const { prestations, wish, subject } = fields(d);
        const payload = {
          Nom: d.get('nom') || '',
          Prénom: d.get('prenom') || '',
          email: d.get('email') || '',
          Téléphone: d.get('telephone') || '',
          Marque: d.get('marque') || '',
          Modèle: d.get('modele') || '',
          Année: d.get('annee') || '',
          'Prestation(s)': prestations.join(', '),
          'Rendez-vous souhaité': wish || 'indifférent',
          Message: d.get('message') || '',
          _subject: subject,
          _template: 'table',
          _captcha: 'false',
          _honey: '',
        };
        if (files.length) {
          // with attachments: the classic multipart post FormSubmit documents for files (its
          // AJAX endpoint is not documented for uploads), then back to our thank-you page
          const root = new URL(document.querySelector('.site-header__logo')?.getAttribute('href') || '/', location.href);
          const post = document.createElement('form');
          post.method = 'post';
          post.enctype = 'multipart/form-data';
          post.action = form.action;
          post.hidden = true;
          for (const [k, v] of Object.entries({ ...payload, _next: new URL('contact/merci/', root).href })) {
            const input = document.createElement('input');
            input.type = 'hidden';
            input.name = k;
            input.value = v;
            post.append(input);
          }
          fileInput.name = 'attachment';
          post.append(fileInput); // moved with its files
          document.body.append(post);
          track('demande_envoyee', { pieces_jointes: files.length });
          post.submit();
          return;
        }
        const url = form.action.replace('formsubmit.co/', 'formsubmit.co/ajax/');
        res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify(payload) });
        const json = await res.json().catch(() => ({}));
        // only a confirmed success counts (the service answers success: "true" or true)
        if (!res.ok || String(json.success) !== 'true') throw new Error(json.message || String(res.status));
      } else {
        res = await fetch(form.action, { method: 'POST', body: new FormData(form), headers: { Accept: 'application/json' } });
        if (!res.ok) throw new Error(String(res.status));
      }
      form.reset();
      track('demande_envoyee', { pieces_jointes: 0 });
      status.textContent = 'Merci ! Votre demande a bien été envoyée, nous revenons vers vous rapidement.';
      status.classList.add('is-ok');
      status.scrollIntoView({ block: 'center', behavior: reduceMotion ? 'auto' : 'smooth' });
    } catch (err) {
      // e.g. "This form needs Activation": the first request sends an activation e-mail to the
      // workshop address, to click once
      console.warn('[form]', err?.message || err);
      track('demande_erreur');
      // nothing is lost: the same request, ready to send from the visitor's own mail app
      const mail = form.dataset.fallback;
      const phone = document.querySelector('a[href^="tel:"]');
      status.innerHTML = '';
      const p = document.createElement('p');
      p.textContent = 'L’envoi en ligne n’a pas abouti. Votre demande n’est pas perdue : envoyez-la depuis votre messagerie (elle est déjà rédigée), ou appelez-nous.';
      const actions = document.createElement('p');
      actions.className = 'form__fallback';
      if (mail) {
        const a = document.createElement('a');
        a.className = 'btn btn--primary btn--sm';
        a.href = mailtoHref(mail, new FormData(form));
        a.textContent = 'Envoyer ma demande par e-mail';
        a.addEventListener('click', () => track('demande_par_email'));
        actions.append(a);
      }
      if (phone) {
        const t = document.createElement('a');
        t.className = 'btn btn--ghost btn--sm';
        t.href = phone.getAttribute('href');
        t.textContent = 'Appeler l’atelier';
        actions.append(t);
      }
      status.append(p, actions);
      if (files.length) {
        const f = document.createElement('p');
        f.textContent = 'Pensez à joindre vos photos à l’e-mail.';
        status.append(f);
      }
      status.classList.add('is-error');
    } finally {
      btn.disabled = false;
    }
  });
}
