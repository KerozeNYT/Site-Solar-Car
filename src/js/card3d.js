/**
 * The 3D cards of the gift card and of SOLAR CAR Premium (src/templates/pages.js, giftCardHtml /
 * premiumCardHtml; styles « 3D cards » in src/styles/main.css): HTML and CSS only, no WebGL.
 * The card leans towards the pointer (or the finger dragged on it), a light slides over its foil,
 * it sways slowly when left alone; a click, a tap, Enter or the « Retourner » button turns it
 * over. Visitors who reduce motion get a still card that turns over at once.
 *
 *   mountCard(stage) → { flip(state?), set(key, value), look(id), tier(id) }
 * stage: an element [data-card3d] holding .card3d (and optionally a [data-card-flip] button).
 * The fields of the card are [data-c="key"] elements; set() writes their text.
 */
const reduce = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

export function mountCard(stage) {
  if (!stage || stage.card3d) return stage?.card3d;
  const card = stage.querySelector('.card3d');
  const tilt = card.querySelector('.card3d__tilt');
  const flipper = card.querySelector('.card3d__flip');
  let flipped = card.classList.contains('is-flipped');
  // tilt: where it is (cur) and where it goes (to), in degrees; light position 0..1
  const cur = { x: 0, y: 0, lx: 0.5, ly: 0.3 };
  const to = { x: 0, y: 0, lx: 0.5, ly: 0.3 };
  let lastInput = 0;
  let raf = 0;
  let visible = true;
  const t0 = performance.now();

  function paint() {
    tilt.style.setProperty('--rx', `${cur.x.toFixed(2)}deg`);
    tilt.style.setProperty('--ry', `${cur.y.toFixed(2)}deg`);
    // the light and the foil follow the tilt (unitless, for calc())
    card.style.setProperty('--lx', `${(cur.lx * 100).toFixed(1)}%`);
    card.style.setProperty('--ly', `${(cur.ly * 100).toFixed(1)}%`);
    card.style.setProperty('--tx', (cur.y / 16).toFixed(3));
    card.style.setProperty('--ty', (cur.x / 12).toFixed(3));
  }
  function frame(now) {
    raf = 0;
    if (!visible || document.hidden) return;
    // left alone for a moment: a slow, wide sway, as if the card were turned in the hand
    if (!reduce() && now - lastInput > 1800) {
      const t = (now - t0) / 1000;
      to.y = Math.sin(t * 0.55) * 11;
      to.x = Math.sin(t * 0.37 + 1) * 5;
      to.lx = 0.5 + Math.sin(t * 0.55) * 0.38;
      to.ly = 0.32 + Math.sin(t * 0.37 + 1) * 0.2;
    }
    const k = now - lastInput > 1800 ? 0.035 : 0.14;
    let moving = false;
    for (const key of ['x', 'y', 'lx', 'ly']) {
      const d = to[key] - cur[key];
      if (Math.abs(d) > 0.001) moving = true;
      cur[key] += d * k;
    }
    paint();
    if (moving || !reduce()) raf = requestAnimationFrame(frame);
  }
  const wake = () => {
    if (!raf && visible && !document.hidden) raf = requestAnimationFrame(frame);
  };

  // the pointer over the stage (mouse) or a finger dragged on the card (touch)
  let drag = null;
  // the last press was a drag (to look at the card), not a tap: no flip on its click
  let dragged = false;
  function aim(e) {
    const r = card.getBoundingClientRect();
    const px = clamp((e.clientX - r.left) / r.width, -0.2, 1.2);
    const py = clamp((e.clientY - r.top) / r.height, -0.2, 1.2);
    to.y = (px - 0.5) * 26;
    to.x = (0.5 - py) * 18;
    to.lx = px;
    to.ly = py;
    lastInput = performance.now();
    wake();
  }
  if (!reduce()) {
    stage.addEventListener('pointermove', (e) => {
      if (e.pointerType === 'mouse' || drag) aim(e);
    });
    stage.addEventListener('pointerleave', (e) => {
      if (e.pointerType !== 'mouse') return;
      to.x = to.y = 0;
      to.lx = 0.5;
      to.ly = 0.3;
      lastInput = performance.now();
      wake();
    });
  }
  // a picture of the card (a teaser in a link): it leans and sways, it never turns over
  const still = stage.dataset.card3d === 'static';
  card.addEventListener('pointerdown', (e) => {
    drag = { x: e.clientX, y: e.clientY, t: performance.now(), moved: false };
  });
  const release = () => {
    if (!drag) return;
    dragged = drag.moved;
    drag = null;
    lastInput = performance.now();
  };
  window.addEventListener('pointerup', release);
  window.addEventListener('pointercancel', release);
  card.addEventListener('pointermove', (e) => {
    if (drag && Math.hypot(e.clientX - drag.x, e.clientY - drag.y) > 8) drag.moved = true;
  });
  if (!still) card.addEventListener('click', (e) => {
    // a drag to look at the card is not a tap (a keyboard « click » has detail 0)
    if (e.detail && dragged) {
      dragged = false;
      return;
    }
    flip();
  });
  if (!still) card.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      flip();
    }
  });
  for (const b of stage.querySelectorAll('[data-card-flip]')) b.addEventListener('click', () => flip());

  function flip(state = !flipped) {
    flipped = !!state;
    card.classList.toggle('is-flipped', flipped);
    if (!still) card.setAttribute('aria-pressed', String(flipped));
    for (const b of stage.querySelectorAll('[data-card-flip]')) b.setAttribute('aria-pressed', String(flipped));
    // the hidden face is not read aloud (a still card is a picture: hidden as a whole)
    if (still) return;
    card.querySelector('.card3d__face--front')?.setAttribute('aria-hidden', String(flipped));
    card.querySelector('.card3d__face--back')?.setAttribute('aria-hidden', String(!flipped));
    if (flipper) flipper.dataset.side = flipped ? 'back' : 'front';
  }

  if ('IntersectionObserver' in window)
    new IntersectionObserver(([en]) => {
      visible = en.isIntersecting;
      wake();
    }).observe(stage);
  document.addEventListener('visibilitychange', wake);
  paint();
  wake();
  flip(flipped);

  const api = {
    flip,
    /** the text of a field ([data-c="key"]), empty → its placeholder (data-empty) */
    set(key, value) {
      for (const el of card.querySelectorAll(`[data-c="${key}"]`)) {
        const v = String(value ?? '').trim();
        el.textContent = v || el.dataset.empty || '';
        el.classList.toggle('is-empty', !v);
      }
    },
    /** the gift card's finish: or, carbone, noel */
    look(id) {
      for (const c of [...card.classList]) if (c.startsWith('card3d--look-')) card.classList.remove(c);
      card.classList.add(`card3d--look-${id}`);
      card.dataset.look = id;
    },
    /** the Premium card's level (content/offers.js, premium.tiers): its neon on the card */
    tier(id, color, label) {
      card.dataset.tier = id;
      if (color) card.style.setProperty('--lvl', color);
      if (label) api.set('tier', label);
    },
    /** a little turn to show the card is alive (after a change of finish, a reveal) */
    nudge() {
      if (reduce()) return;
      to.y = cur.y + 24;
      cur.y -= 18;
      lastInput = performance.now() - 1200;
      wake();
    },
    card,
  };
  stage.card3d = api;
  return api;
}

/** every [data-card3d] of the page not mounted yet (the home teaser, the pages' static cards) */
export function mountAll(root = document) {
  return [...root.querySelectorAll('[data-card3d]')].map(mountCard);
}

/** « 15 nov. 2027 » */
export const shortDate = (ms) => (ms ? new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Europe/Paris' }).format(new Date(ms)) : '');
/** « 11/27 » (a card's validity) */
export const monthYear = (ms) => (ms ? new Intl.DateTimeFormat('fr-FR', { month: '2-digit', year: '2-digit', timeZone: 'Europe/Paris' }).format(new Date(ms)) : '');
/** « 15 novembre 2027 » */
export const longDate = (ms) => (ms ? new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Europe/Paris' }).format(new Date(ms)) : '');
/** « 100 € », « 72,50 € » */
export const euros = (n) => new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', minimumFractionDigits: Number.isInteger(Number(n)) ? 0 : 2, maximumFractionDigits: 2 }).format(Number(n) || 0);
/** the part of the address before a page of the site (the preview lives in a sub-folder) */
export const siteBase = (page) => {
  const i = location.pathname.indexOf(page);
  return i >= 0 ? location.pathname.slice(0, i) : '/';
};
/** sessionStorage / localStorage that never throws (private browsing, blocked storage) */
export const keep = (kind = 'session') => ({
  get(k) {
    try {
      return JSON.parse((kind === 'local' ? localStorage : sessionStorage).getItem(k) || 'null');
    } catch {
      return null;
    }
  },
  set(k, v) {
    try {
      (kind === 'local' ? localStorage : sessionStorage).setItem(k, JSON.stringify(v));
    } catch {
      /* nothing kept */
    }
  },
  remove(k) {
    try {
      (kind === 'local' ? localStorage : sessionStorage).removeItem(k);
    } catch {
      /* nothing kept */
    }
  },
});
/** copies a text, with a word for the button (« Copié ») */
export async function copyText(text, btn) {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    const t = document.createElement('textarea');
    t.value = text;
    t.setAttribute('readonly', '');
    t.style.position = 'fixed';
    t.style.opacity = '0';
    document.body.append(t);
    t.select();
    try {
      document.execCommand('copy');
    } catch {
      /* the visitor copies by hand */
    }
    t.remove();
  }
  if (btn) {
    const was = btn.dataset.label || btn.textContent;
    btn.dataset.label = was;
    btn.textContent = 'Copié ✓';
    setTimeout(() => (btn.textContent = was), 1600);
  }
}
