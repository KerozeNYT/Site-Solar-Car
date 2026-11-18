// Site-wide behaviour. Everything here is progressive enhancement: pages work without it.
import { startAmbient } from './ambient.js';
import { startSnow } from './snow.js';
import { deadlineText, runCountdown } from './countdown.js';

const html = document.documentElement;
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

// ---------------------------------------------------------------- garage ambience (backdrop)
startAmbient();
// December (look « noel »): snow over the pages
startSnow();
{
  // the backdrop rests while the 3D tour fills the screen (it is hidden behind it anyway)
  const ambient = document.querySelector('[data-ambient]');
  const stage = document.querySelector('[data-tour], [data-film]');
  if (ambient && stage && 'IntersectionObserver' in window)
    new IntersectionObserver(([en]) => ambient.classList.toggle('is-paused', en.intersectionRatio > 0.6), { threshold: [0, 0.6, 1] }).observe(stage);
}

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
  // into the home film: src/js/film.js turns the link into the film's moment
  if (a.dataset.filmAt && document.querySelector('[data-film].is-live')) return;
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

// ---------------------------------------------------------------- home film
// the video moved by the scroll; without it (reduced motion, data saver, ?static) the chapters
// stay one under the other over their images (CSS)
const filmEl = document.querySelector('[data-film]');
if (filmEl && html.classList.contains('tour-live')) {
  import('./film.js')
    .then((m) => m.startFilm(filmEl))
    .catch((err) => {
      console.warn('[film] static version', err);
      html.classList.remove('tour-live');
    });
}

// ---------------------------------------------------------------- 3D tour
/** can this device draw 3D? Asked once, and only when a 3D scene is about to start: creating a
 *  test context is not free (seconds without a graphics card), so a page never pays it on load */
let gl2;
function webgl2() {
  if (gl2 !== undefined) return gl2;
  try {
    const c = document.createElement('canvas');
    const gl = c.getContext('webgl2', { failIfMajorPerformanceCaveat: true });
    if (gl) gl.getExtension('WEBGL_lose_context')?.loseContext();
    gl2 = !!gl;
  } catch {
    gl2 = false;
  }
  return gl2;
}
const tour = document.querySelector('[data-tour]');
if (tour) {
  const optIn = tour.querySelector('[data-tour-start]');
  // the static version: every chapter readable (clears what a started tour may have set)
  const fallback = () => {
    html.classList.remove('tour-live');
    tour.classList.remove('is-ready');
    tour.classList.add('is-static');
    tour.querySelectorAll('[data-chapter]').forEach((el) => {
      el.classList.remove('is-visible');
      el.removeAttribute('inert');
      el.querySelector('.chapter__copy')?.removeAttribute('style');
    });
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

// ---------------------------------------------------------------- « Comment nous avez-vous connus ? »
// the short text opens when « Autre » is ticked (always visible without JavaScript)
for (const box of document.querySelectorAll('[data-how-heard]')) {
  const other = box.querySelector('[data-how-other]');
  const text = box.querySelector('[data-how-text]');
  if (!other || !text) continue;
  const sync = () => {
    text.hidden = !other.checked;
    if (other.checked && document.activeElement === other) text.querySelector('input')?.focus();
  };
  other.addEventListener('change', sync);
  text.hidden = !other.checked;
}

// ---------------------------------------------------------------- online booking
const bookingEl = document.querySelector('[data-booking]');
if (bookingEl) import('./booking.js').then((m) => m.startBooking(bookingEl));
const bookingDone = document.querySelector('[data-booking-done]');
if (bookingDone) import('./booking.js').then((m) => m.startBookingDone(bookingDone));
// a quote accepted from the button of its e-mail (/devis/)
// the gift card and SOLAR CAR Premium (content/offers.js): their pages, and the 3D cards
// shown elsewhere (the home page's teaser)
const offerPages = [
  ['[data-gift]', './gift.js', 'startGift'],
  ['[data-gift-done]', './gift.js', 'startGiftDone'],
  ['[data-gift-view]', './gift.js', 'startGiftView'],
  ['[data-premium]', './premium.js', 'startPremium'],
  ['[data-premium-done]', './premium.js', 'startPremiumDone'],
  ['[data-premium-card]', './premium.js', 'startPremiumCard'],
];
{
  let started = false;
  for (const [sel, mod, fn] of offerPages) {
    const el = document.querySelector(sel);
    if (!el) continue;
    started = true;
    (mod === './gift.js' ? import('./gift.js') : import('./premium.js')).then((m) => m[fn](el));
  }
  // the other cards of the page (teasers, cross-links): mounted once near the screen
  const loose = [...document.querySelectorAll('[data-card3d]')];
  if (loose.length) {
    const mount = (el) => import('./card3d.js').then((m) => m.mountCard(el));
    if ('IntersectionObserver' in window) {
      const io = new IntersectionObserver(
        (entries) => {
          for (const en of entries)
            if (en.isIntersecting) {
              io.unobserve(en.target);
              // the page's own module mounts its cards first (mountCard skips a card mounted twice)
              setTimeout(() => mount(en.target), started ? 300 : 0);
            }
        },
        { rootMargin: '200px' }
      );
      loose.forEach((el) => io.observe(el));
    } else loose.forEach(mount);
  }
}

const quoteAccept = document.querySelector('[data-quote-accept]');
if (quoteAccept) import('./quote-accept.js').then((m) => m.startQuoteAccept(quoteAccept));

// ---------------------------------------------------------------- simulators
// window tint simulator, simple mode (photos): no 3D, started at once
const tintSimple = document.querySelector('[data-tint-simple]');
if (tintSimple) import('./tint-simple.js').then((m) => m.startTintSimple(tintSimple));

// `data-sim-lazy`: the simulator's code (and its catalogue) loads only when it nears the screen
const sims = [...document.querySelectorAll('[data-sim]')];
if (sims.length) {
  const init = (el) => import('./sim/index.js').then((m) => m.initSimulator(el, { webgl: webgl2, reduceMotion }));
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
  const hideOn = [...document.querySelectorAll('[data-tour], [data-film], .site-footer')];
  const seen = new Set();
  const io = new IntersectionObserver((entries) => {
    for (const en of entries) en.isIntersecting ? seen.add(en.target) : seen.delete(en.target);
    bar.classList.toggle('is-hidden', seen.size > 0);
  });
  hideOn.forEach((el) => io.observe(el));
}

// ---------------------------------------------------------------- reveal on scroll
// Only what is still below the screen fades in: the first report of the observer says where each
// element is, without forcing a layout (nor the logos of a band not yet shown); what the visitor
// already sees is left as it is (no flash, the page's main picture is never hidden).
if (!reduceMotion && 'IntersectionObserver' in window) {
  const seen = new WeakSet();
  const io = new IntersectionObserver((entries) => {
    for (const en of entries) {
      const el = en.target;
      if (!seen.has(el)) {
        seen.add(el);
        if (en.isIntersecting) io.unobserve(el);
        else el.classList.add('reveal');
      } else if (en.isIntersecting) {
        el.classList.add('is-in');
        io.unobserve(el);
      }
    }
  });
  document
    .querySelectorAll('.service-card, .steps li, .benefits li, .faq__item, .checklist li, .reveal-up, .guide-card, .related__list li, .section-head, .cov-offer, .work, .price-table')
    .forEach((el) => io.observe(el));
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
  img.srcset = `${img.src} 960w, ${a.getAttribute('href')} 1280w`;
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

// ---------------------------------------------------------------- visit statistics
// Counted by the site's own server (booking/stats.js, docs/STATISTIQUES.md): no cookie, nothing
// kept on the device, no identifier. Each page sends its address, phone or computer and, on
// arrival from outside, the name of the referring site; then the actions below. Robots, test
// browsers and devices opted out with ?stats=off (the owner's) are not counted.
const statsUrl = document.body.dataset.stats;
const statsOff = (() => {
  try {
    const q = new URLSearchParams(location.search).get('stats');
    if (q === 'off') localStorage.setItem('sc37-stats', 'off');
    else if (q === 'on') localStorage.removeItem('sc37-stats');
    return localStorage.getItem('sc37-stats') === 'off';
  } catch {
    return false;
  }
})();
const counted = !!statsUrl && !statsOff && !navigator.webdriver && !/bot|crawl|spider|slurp|headless|lighthouse|pagespeed|ptst/i.test(navigator.userAgent);
// the page's own path, also on the preview (served from a sub-folder): its canonical address
const statsPath = (() => {
  try {
    return new URL(document.querySelector('link[rel="canonical"]').href).pathname;
  } catch {
    return location.pathname;
  }
})();
function sendHit(hit) {
  if (!counted) return;
  const body = JSON.stringify({ p: statsPath, d: matchMedia('(max-width: 760px)').matches ? 'telephone' : 'ordinateur', ...hit });
  try {
    if (navigator.sendBeacon(statsUrl, body)) return;
  } catch {}
  fetch(statsUrl, { method: 'POST', body, keepalive: true, mode: 'no-cors' }).catch(() => {});
}
{
  const ref = (() => {
    try {
      return document.referrer ? new URL(document.referrer).hostname : '';
    } catch {
      return '';
    }
  })();
  const bare = (h) => h.replace(/^www\./, '');
  const nav = performance.getEntriesByType?.('navigation')[0]?.type || 'navigate';
  // a visit starts on a page reached from outside: not a reload, not a page of the site, not the
  // way back from the payment page
  const entry = nav === 'navigate' && bare(ref) !== bare(location.hostname) && !/(^|\.)stripe\.com$/.test(ref);
  // campaign tags of the address: utm_source (the Google profile link), utm_medium and the ad click
  // ids Google Ads and TikTok ads add (only "there was one" is sent, never the id itself)
  const qs = new URLSearchParams(location.search);
  const ad = ['gclid', 'gbraid', 'wbraid', 'ttclid'].some((k) => qs.has(k)) ? 1 : 0;
  const hit = entry ? { t: 'page', e: 1, r: ref, u: qs.get('utm_source') || '', m: qs.get('utm_medium') || '', g: ad } : { t: 'page', e: 0 };
  if (document.prerendering) document.addEventListener('prerenderingchange', () => sendHit(hit), { once: true });
  else sendHit(hit);
  const optout = document.querySelector('[data-stats-optout]');
  if (optout && statsOff) optout.textContent = 'Vos visites ne sont plus comptées sur cet appareil.';
}

// ---------------------------------------------------------------- conversion events
// Each event is a name plus a few non-personal details (page, service): sent to the statistics,
// dispatched as `sc37:event` on window and kept in window.sc37Events.
const events = (window.sc37Events = window.sc37Events || []);
function track(name, detail = {}) {
  const ev = { name, page: location.pathname, ...detail, at: Date.now() };
  events.push(ev);
  dispatchEvent(new CustomEvent('sc37:event', { detail: ev }));
  sendHit({ t: name, x: detail.service || (detail.pieces_jointes ? 'avec pièces jointes' : '') });
}
document.addEventListener('click', (e) => {
  const a = e.target.closest('a[href]');
  if (!a) return;
  const href = a.getAttribute('href');
  if (href.startsWith('tel:')) track('appel');
  else if (href.startsWith('mailto:')) track('email');
  else if (/google\.[a-z.]+\/maps|maps\.apple|waze\.com/.test(href)) track('itineraire');
  else if (a.hasAttribute('data-quote')) track('devis_simulateur', { service: a.closest('[data-sim]')?.dataset.sim });
  else if (/\/contact\/$/.test(a.pathname)) track('clic_devis');
});
addEventListener('sc37:sim', (e) => track('simulateur_3d', e.detail));

// ---------------------------------------------------------------- the workshop's server
// (booking/: the client file and the promotion band of the workshop's space, docs/ATELIER.md)
const api = document.body.dataset.api;

/** a copy of a quote request sent, into the workshop's client file (prestations and wish as the
 *  e-mail reads them) */
/**
 * An attachment ready to send to the site's server: a photo made lighter (2000 px on its longest
 * side, JPEG; its position and camera details dropped with it), a PDF as it is. A photo the
 * browser cannot draw (HEIC on some browsers) goes as it is. { name, type, data (base64), size }
 */
async function prepareFile(file) {
  let blob = file;
  let { name, type } = file;
  if (/^image\/(jpeg|png|webp|heic|heif|avif|bmp)$/i.test(type) && typeof createImageBitmap === 'function') {
    try {
      const bmp = await createImageBitmap(file);
      const scale = Math.min(1, 2000 / Math.max(bmp.width, bmp.height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(bmp.width * scale));
      canvas.height = Math.max(1, Math.round(bmp.height * scale));
      const g = canvas.getContext('2d');
      g.fillStyle = '#fff';
      g.fillRect(0, 0, canvas.width, canvas.height);
      g.drawImage(bmp, 0, 0, canvas.width, canvas.height);
      bmp.close?.();
      const out = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.85));
      if (out && out.size < file.size) {
        blob = out;
        type = 'image/jpeg';
        name = `${name.replace(/\.[^.]+$/, '') || 'photo'}.jpg`;
      }
    } catch {
      /* sent as it is */
    }
  }
  const data = await new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result).split(',')[1] || '');
    r.onerror = () => reject(r.error);
    r.readAsDataURL(blob);
  });
  return { name, type, data, size: blob.size };
}

function fileRequest(d, { prestations, wish }) {
  if (!api) return;
  const body = JSON.stringify({
    firstName: d.get('prenom') || '',
    lastName: d.get('nom') || '',
    email: d.get('email') || '',
    phone: d.get('telephone') || '',
    make: d.get('marque') || '',
    model: d.get('modele') || '',
    year: d.get('annee') || '',
    services: prestations.join(', '),
    wish: wish || '',
    message: d.get('message') || '',
    source: { channels: d.getAll('connu'), other: String(d.get('connu_autre') || '') },
    // checked again by the server, at the time it receives the request
    code: String(d.get('code') || ''),
  });
  try {
    if (navigator.sendBeacon(`${api}/api/demande`, body)) return;
  } catch {}
  fetch(`${api}/api/demande`, { method: 'POST', body, keepalive: true, mode: 'no-cors' }).catch(() => {});
}

// the promotion band, set from the workshop's space: a banner that drops in under the header of
// every page, its message scrolling, in the look chosen (classique, noel, neon); its cross hides it
// for the rest of the visit. It makes room for itself (the page goes down by its height, `--band-h`)
// and scrolls away with the page: it never hides a title. ?apercu-bandeau=<id>: that band,
// whatever its dates (preview).
function showBand(b, preview) {
  const root = new URL(document.querySelector('.site-header__logo')?.getAttribute('href') || '/', location.href);
  const el = document.createElement('aside');
  el.className = `promo-band promo-band--${/^(classique|noel|neon)$/.test(b.theme) ? b.theme : 'classique'}`;
  el.setAttribute('aria-label', 'Offre du moment');
  el.innerHTML =
    '<div class="promo-band__fx" aria-hidden="true"></div><p class="promo-band__title"></p><div class="promo-band__ticker"><p class="visually-hidden"></p><div class="promo-band__track" aria-hidden="true"><span></span><span></span></div></div><a class="promo-band__cta"></a><button type="button" class="promo-band__close" aria-label="Fermer l’offre">×</button>';
  const title = el.querySelector('.promo-band__title');
  if (b.title) title.textContent = b.title;
  else title.remove();
  const msg = b.code && !String(b.text).includes(b.code) ? `${b.text} · Code ${b.code}` : b.text;
  el.querySelector('.visually-hidden').textContent = msg;
  for (const s of el.querySelectorAll('.promo-band__track span')) s.textContent = `${msg}   ✦   `;
  // the same speed whatever the length of the text
  el.style.setProperty('--ticker', `${Math.max(14, msg.length * 0.22).toFixed(1)}s`);
  const a = el.querySelector('.promo-band__cta');
  a.textContent = b.cta || 'Réserver';
  a.href = new URL(`reservation/${b.code ? `?code=${encodeURIComponent(b.code)}` : ''}`, root).href;
  // the code's deadline and the time left (« Plus que 5 jours », then to the second on the last
  // day), once the code is valid; the band goes at the end of the offer
  const now = Date.now();
  if (b.ends > now && !(b.starts > now)) {
    const left = document.createElement('p');
    left.className = 'promo-band__left';
    left.innerHTML = `<span class="promo-band__until">Jusqu’au ${deadlineText(b.ends)}</span> <span class="promo-band__time" role="timer"></span>`;
    el.querySelector('.promo-band__cta').before(left);
    el.classList.add('has-left');
    runCountdown(left.querySelector('[role=timer]'), b.ends, () => hide());
  }
  const html = document.documentElement;
  const room = () => html.style.setProperty('--band-h', `${el.offsetHeight}px`);
  const watch = 'ResizeObserver' in window ? new ResizeObserver(room) : null;
  function hide() {
    el.classList.add('is-out');
    html.classList.remove('has-band');
    watch?.disconnect();
    setTimeout(() => el.remove(), 450);
  }
  el.querySelector('button').addEventListener('click', () => {
    hide();
    if (!preview)
      try {
        sessionStorage.setItem('sc37-band', b.id);
      } catch {}
  });
  document.body.append(el);
  room();
  html.classList.add('has-band');
  watch?.observe(el);
  requestAnimationFrame(() => requestAnimationFrame(() => el.classList.add('is-in')));
}
// not on the pages that close a booking or a quote
if (api && !/\/(reservation\/confirmee|devis)\//.test(location.pathname)) {
  const preview = new URLSearchParams(location.search).get('apercu-bandeau');
  fetch(`${api}/api/promo${preview ? `?apercu=${encodeURIComponent(preview)}` : ''}`)
    .then((r) => (r.ok ? r.json() : null))
    .then((j) => {
      const b = j?.banner;
      if (!b) return;
      if (!preview)
        try {
          if (sessionStorage.getItem('sc37-band') === b.id) return;
        } catch {}
      showBand(b, !!preview);
    })
    .catch(() => {});
}

// ---------------------------------------------------------------- contact form
/** « Comment nous avez-vous connus ? » as one line: the ticked boxes, « Autre : … » with its text */
const howHeardLine = (d) => {
  const other = String(d.get('connu_autre') || '').replace(/\s+/g, ' ').trim();
  return d
    .getAll('connu')
    .map((c) => (c === 'Autre' && other ? `Autre : ${other}` : c))
    .join(', ');
};
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
  const forfait = q.get('forfait');
  const msg = form.querySelector('[name="message"]');
  if (msg && !msg.value && (config || vehicle || forfait)) {
    // detailing packages (content/sections/detailing-carrosserie.js)
    const label = { essentiel: 'Essentiel', eclat: 'Éclat', correction: 'Correction', signature: 'Signature céramique' }[forfait];
    const lines = [config ? 'Configuration choisie sur le simulateur :' : `Forfait souhaité : ${label || forfait}`];
    if (config) lines.push(config);
    if (vehicle && !(config || '').includes(vehicle)) lines.push(`Catégorie de véhicule : ${vehicle}`);
    msg.value = lines.join('\n') + '\n\n';
  }
  // ---- a promo or referral code (one only): checked by the booking server, said in the e-mail
  // with the result, so that the workshop knows it was valid the day the request was sent
  const codeBox = form.querySelector('[data-code-field]');
  const codeInput = codeBox?.querySelector('input');
  const codeStatus = codeBox?.querySelector('[data-code-status]');
  const deadline = codeBox?.querySelector('[data-code-deadline]');
  let codeInfo = null; // { code, line }: the check of the code typed, for the e-mail
  let stopCountdown = null;
  const cleanCode = (v) => String(v || '').toUpperCase().replace(/\s+/g, '').replace(/[^A-Z0-9-]/g, '').slice(0, 20);
  const dayFr = (ms) => new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Europe/Paris' }).format(new Date(ms)).replace(/^1 /, '1er ');
  const hideDeadline = () => {
    stopCountdown?.();
    stopCountdown = null;
    if (deadline) deadline.hidden = true;
  };
  const showDeadline = (j) => {
    hideDeadline();
    if (!deadline || !(j.expires > Date.now())) return;
    const end = j.expires + 1;
    deadline.hidden = false;
    deadline.innerHTML = `Demande à envoyer avant le <b>${deadlineText(end)}</b> · <span role="timer"></span>`;
    stopCountdown = runCountdown(deadline.querySelector('[role=timer]'), end, () => {
      deadline.textContent = `L’offre ${j.code} s’est terminée le ${deadlineText(end)}.`;
      codeInfo = null;
    });
  };
  const checkCode = async () => {
    if (!codeInput) return null;
    const code = cleanCode(codeInput.value);
    codeInput.value = code;
    if (code && codeInfo?.code === code) return codeInfo;
    codeStatus.classList.remove('is-ok', 'is-error');
    hideDeadline();
    if (!code) {
      codeInfo = null;
      codeStatus.textContent = '';
      return null;
    }
    const set = (line, text, ok) => {
      codeInfo = { code, line };
      codeStatus.textContent = text;
      if (ok != null) codeStatus.classList.add(ok ? 'is-ok' : 'is-error');
      return codeInfo;
    };
    if (!api) return set(`${code} (à vérifier par l’atelier)`, 'Votre code sera vérifié par l’atelier avec votre demande.');
    codeStatus.textContent = 'Vérification du code…';
    try {
      const res = await fetch(`${api}/api/code?code=${encodeURIComponent(code)}`, { signal: AbortSignal.timeout?.(6000) });
      const j = await res.json();
      if (j.ok && j.kind === 'promo') {
        showDeadline(j);
        const off = j.percent ? `−${j.percent} %` : `−${j.amount} €`;
        return set(`${j.code} — code promo valable le jour de la demande : ${off}${j.expires ? `, offre jusqu’au ${dayFr(j.expires)} à 23 h 59` : ''}`, `Code promo ${j.code} : ${off} appliqués à votre devis.`, true);
      }
      // a SOLAR CAR Premium card, a gift card (content/offers.js)
      if (j.ok && j.kind === 'premium') return set(`${j.code} — carte Premium${j.owner ? ` de ${j.owner}` : ''}, valable : −${j.percent} % (même e-mail que la carte à vérifier)`, `Carte Premium${j.owner ? ` de ${j.owner}` : ''} : −${j.percent} % appliqués à votre devis.`, true);
      if (j.ok && j.kind === 'cadeau') return set(`${j.code} — carte cadeau, solde ${j.balance} € (à déduire à l’atelier)`, `Carte cadeau : ${String(j.balance).replace('.', ',')} € disponibles, déduits à l’atelier.`, true);
      if (j.ok) return set(`${j.code} — code de parrainage de ${j.owner}, valable : ${j.amount} € de remise (à marquer utilisé dans l’espace atelier)`, `Code de ${j.owner} : ${j.amount} € de remise appliqués à votre devis.`, true);
      return set(`${code} — non valable le jour de la demande : ${j.error || 'code inconnu'}`, j.error || 'Ce code n’est pas reconnu.', false);
    } catch {
      return set(`${code} (n’a pas pu être vérifié : à contrôler)`, 'Le code n’a pas pu être vérifié pour le moment : il est joint à votre demande, l’atelier le vérifiera.', false);
    }
  };
  if (codeInput) {
    codeInput.addEventListener('input', () => {
      codeInfo = null;
      hideDeadline();
    });
    codeBox.querySelector('[data-code-check]')?.addEventListener('click', () => checkCode());
    codeInput.addEventListener('change', () => checkCode());
    codeInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        checkCode();
      }
    });
    // from a link (an ad, the band, the booking page): /contact/?code=NOEL
    if (q.get('code')) {
      codeInput.value = q.get('code');
      checkCode();
    }
  }
  // ---- what is missing, said in red under each field and listed at the top of the form
  const boxes = [...form.querySelectorAll('[data-required-group] input[type="checkbox"]')];
  const summary = form.querySelector('[data-form-summary]');
  const checks = [
    ...[...form.querySelectorAll('[data-error-for]')].map((err) => {
      const key = err.dataset.errorFor;
      if (key === 'prestations') return { err, label: 'la prestation souhaitée', target: boxes[0], ok: () => boxes.some((b) => b.checked) };
      const input = key === 'consentement' ? form.elements.consentement : form.querySelector('#' + CSS.escape(key));
      const label = key === 'consentement' ? 'votre accord pour l’utilisation de vos données' : (form.querySelector(`label[for="${key}"]`)?.firstChild.textContent || key).trim().toLowerCase();
      return { err, label, target: input, ok: () => (input.type === 'checkbox' ? input.checked : input.value.trim() !== '' && input.checkValidity()) };
    }),
  ];
  const mark = (c, show) => {
    const bad = !c.ok();
    if (show || !bad) c.err.hidden = !bad;
    if (c.target) c.target.toggleAttribute('aria-invalid', bad && !c.err.hidden);
    return bad;
  };
  /** check every required field; `show`: reveal the red lines and the summary */
  const validate = (show) => {
    const missing = checks.filter((c) => mark(c, show));
    if (show) {
      summary.hidden = !missing.length;
      summary.innerHTML = '';
      if (missing.length) {
        const p = document.createElement('p');
        p.textContent = missing.length === 1 ? 'Pour envoyer votre demande, il manque une information :' : `Pour envoyer votre demande, il manque ${missing.length} informations :`;
        const ul = document.createElement('ul');
        for (const c of missing) {
          const li = document.createElement('li');
          const a = document.createElement('a');
          a.href = '#' + (c.target?.id || c.err.id);
          a.textContent = c.err.textContent;
          a.addEventListener('click', (e) => {
            e.preventDefault();
            c.target?.focus();
          });
          li.append(a);
          ul.append(li);
        }
        summary.append(p, ul);
      }
    } else if (!summary.hidden && !missing.length) summary.hidden = true;
    return missing;
  };
  // fixing a field clears its red line (and the summary once all is complete)
  form.addEventListener('input', () => validate(false));
  form.addEventListener('change', () => validate(false));
  form.addEventListener('focusout', (e) => {
    const c = checks.find((x) => x.target === e.target);
    if (c && e.target.value) mark(c, true);
  });
  const fields = (d) => {
    const label = (v) => form.querySelector(`input[name="prestations"][value="${CSS.escape(v)}"]`)?.parentElement.textContent.trim() || v;
    const prestations = d.getAll('prestations').map(label);
    const car = [d.get('marque'), d.get('modele'), d.get('annee')].filter(Boolean).join(' ');
    const wish = [d.get('date_souhaitee') ? `à partir du ${new Date(d.get('date_souhaitee')).toLocaleDateString('fr-FR')}` : '', d.get('moment') || ''].filter(Boolean).join(', ');
    // the e-mail's subject, as the workshop asked: the details are in the e-mail itself
    return { prestations, car, wish, subject: 'Nouvelle demande de devis' };
  };

  // duplicates: one request at a time, and the same request sent again within 15 minutes is
  // only re-sent on purpose (a double tap, a back-and-forth, a reload never sends it twice)
  const DUP_KEY = 'sc37:derniere-demande';
  const signature = () => {
    const d = new FormData(form);
    return JSON.stringify(['nom', 'prenom', 'email', 'telephone', 'marque', 'modele', 'message'].map((k) => String(d.get(k) || '').trim().toLowerCase()).concat(d.getAll('prestations').sort()));
  };
  const lastSent = () => {
    try {
      const v = JSON.parse(sessionStorage.getItem(DUP_KEY) || 'null');
      return v && Date.now() - v.at < 15 * 60 * 1000 ? v : null;
    } catch {
      return null;
    }
  };
  const remember = (sig) => {
    try {
      sessionStorage.setItem(DUP_KEY, JSON.stringify({ sig, at: Date.now() }));
    } catch {
      /* storage unavailable */
    }
  };
  let sending = false;
  let resendOk = false;
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (sending) return;
    status.className = 'form__status';
    const sig = signature();
    const prev = lastSent();
    if (prev && prev.sig === sig && !resendOk) {
      const minutes = Math.max(1, Math.round((Date.now() - prev.at) / 60000));
      status.innerHTML = '';
      const p = document.createElement('p');
      p.textContent = `Cette demande nous a déjà été envoyée il y a ${minutes} min : inutile de la renvoyer, nous revenons vers vous.`;
      const again = document.createElement('button');
      again.type = 'button';
      again.className = 'btn btn--ghost btn--sm';
      again.textContent = 'La renvoyer quand même';
      again.addEventListener('click', () => {
        resendOk = true;
        form.requestSubmit();
      });
      status.append(p, again);
      status.classList.add('is-ok');
      return;
    }
    resendOk = false;
    const missing = validate(true);
    if (missing.length) {
      status.textContent = '';
      summary.scrollIntoView({ block: 'center', behavior: reduceMotion ? 'auto' : 'smooth' });
      missing[0].target?.focus({ preventScroll: true });
      return;
    }
    const btn = form.querySelector('[type="submit"]');
    // bots fill the hidden field: pretend nothing happened
    if (form.elements._honey?.value || form.elements._gotcha?.value) return;
    // optional attachments: images or PDF, 10 MB in all (to the site's server: once the photos
    // are made lighter, see prepareFile)
    const fileInput = form.querySelector('input[type="file"]');
    const files = fileInput ? [...fileInput.files] : [];
    const maxMb = Number(fileInput?.dataset.maxMb || 10);
    const direct = /\/api\/demande$/.test(form.action);
    if ((!direct && files.reduce((a, f) => a + f.size, 0) > maxMb * 1024 * 1024) || files.some((f) => !/^image\/|pdf$/.test(f.type))) {
      status.textContent = `Pièces jointes : images ou PDF uniquement, ${maxMb} Mo maximum au total.`;
      status.classList.add('is-error');
      fileInput.focus();
      return;
    }
    btn.disabled = true;
    sending = true;
    status.textContent = 'Envoi en cours…';
    // the code typed and the result of its check, done again now: valid the day the request is sent
    codeInfo = null;
    const code = await checkCode();
    let acked = false;
    let reason = '';
    try {
      let res;
      if (direct) {
        // the site's own server (booking/store.js, quote/submit): one e-mail to the workshop, the
        // photos attached, answering it writes to the visitor; an acknowledgment to the visitor
        const d = new FormData(form);
        const { prestations, wish } = fields(d);
        if (files.length) status.textContent = 'Préparation des photos…';
        const prepared = [];
        for (const f of files) prepared.push(await prepareFile(f));
        if (prepared.reduce((a, f) => a + f.size, 0) > maxMb * 1024 * 1024) {
          reason = `Pièces jointes trop lourdes : ${maxMb} Mo maximum au total. Retirez un fichier, ou envoyez-le en répondant à notre e-mail.`;
          throw new Error('too heavy');
        }
        status.textContent = 'Envoi en cours…';
        res = await fetch(form.action, {
          method: 'POST',
          // plain text: no preflight request; the server reads it as JSON
          headers: { 'Content-Type': 'text/plain;charset=UTF-8' },
          body: JSON.stringify({
            v: 2,
            firstName: d.get('prenom') || '',
            lastName: d.get('nom') || '',
            email: d.get('email') || '',
            phone: d.get('telephone') || '',
            make: d.get('marque') || '',
            model: d.get('modele') || '',
            year: d.get('annee') || '',
            services: prestations.join(', '),
            wish,
            message: d.get('message') || '',
            source: { channels: d.getAll('connu'), other: String(d.get('connu_autre') || '') },
            code: String(d.get('code') || ''),
            consent: !!d.get('consentement'),
            trap: String(d.get('_gotcha') || ''),
            files: prepared.map(({ name, type, data }) => ({ name, type, data })),
          }),
        });
        const json = await res.json().catch(() => ({}));
        if (!res.ok || !json.ok) {
          // a field the server finds missing, files too heavy: said as it is
          if (res.status === 400 || res.status === 413) reason = json.error || '';
          throw new Error(json.error || String(res.status));
        }
        acked = !!json.ack;
      } else if (/formsubmit\.co\//.test(form.action)) {
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
          'Nous a connus': howHeardLine(d) || 'non précisé',
          ...(code ? { 'Code promo ou parrainage': code.line } : {}),
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
          remember(sig);
          track('demande_envoyee', { pieces_jointes: files.length });
          sendHit({ t: 'connu', c: d.getAll('connu'), o: String(d.get('connu_autre') || '') });
          fileRequest(d, { prestations, wish });
          post.submit();
          return;
        }
        const url = form.action.replace('formsubmit.co/', 'formsubmit.co/ajax/');
        res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify(payload) });
        const json = await res.json().catch(() => ({}));
        // a form not activated yet ("This form needs Activation"): FormSubmit keeps the request
        // and delivers it once the workshop clicks "Activate Form". It counts as sent: asking the
        // visitor to try again made every attempt arrive as one more copy (5 on 17/11/2026)
        const held = /activat/i.test(String(json.message || ''));
        if (held) console.warn('[form] FormSubmit en attente d’activation : la demande sera transmise après activation');
        // otherwise only a confirmed success counts (the service answers success: "true" or true)
        else if (!res.ok || String(json.success) !== 'true') throw new Error(json.message || String(res.status));
      } else {
        res = await fetch(form.action, { method: 'POST', body: new FormData(form), headers: { Accept: 'application/json' } });
        if (!res.ok) throw new Error(String(res.status));
      }
      remember(sig);
      const heard = new FormData(form);
      // the site's server files the request itself
      if (!direct) fileRequest(heard, fields(heard));
      form.reset();
      codeInfo = null;
      if (codeStatus) codeStatus.textContent = '';
      hideDeadline();
      track('demande_envoyee', { pieces_jointes: 0 });
      // the answers to « Comment nous avez-vous connus ? », counted in the statistics
      sendHit({ t: 'connu', c: heard.getAll('connu'), o: String(heard.get('connu_autre') || '') });
      status.textContent = acked
        ? 'Merci ! Votre demande a bien été envoyée : un e-mail de confirmation vient de vous être adressé. Nous revenons vers vous rapidement.'
        : 'Merci ! Votre demande a bien été envoyée, nous revenons vers vous rapidement.';
      status.classList.add('is-ok');
      status.scrollIntoView({ block: 'center', behavior: reduceMotion ? 'auto' : 'smooth' });
    } catch (err) {
      // e.g. "This form needs Activation": the first request sends an activation e-mail to the
      // workshop address, to click once
      console.warn('[form]', err?.message || err);
      track('demande_erreur');
      // the request stays in the form: the visitor tries again, or calls
      const phone = document.querySelector('a[href^="tel:"]');
      status.innerHTML = '';
      const p = document.createElement('p');
      p.textContent = reason
        ? `Votre demande n’est pas partie. ${reason}`
        : 'L’envoi n’a pas abouti (connexion ou service momentanément indisponible). Votre demande est toujours là : réessayez dans un instant, ou appelez-nous.';
      const actions = document.createElement('p');
      actions.className = 'form__fallback';
      const retry = document.createElement('button');
      retry.type = 'button';
      retry.className = 'btn btn--primary btn--sm';
      retry.textContent = 'Réessayer l’envoi';
      retry.addEventListener('click', () => form.requestSubmit());
      actions.append(retry);
      if (phone) {
        const t = document.createElement('a');
        t.className = 'btn btn--ghost btn--sm';
        t.href = phone.getAttribute('href');
        t.textContent = 'Appeler l’atelier';
        actions.append(t);
      }
      status.append(p, actions);
      status.classList.add('is-error');
    } finally {
      btn.disabled = false;
      sending = false;
    }
  });
}
