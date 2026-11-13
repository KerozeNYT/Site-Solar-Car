/**
 * Window tint simulator, simple mode (/vitres-teintees/, src/templates/sims.js simTintSimple):
 * a visual of a car of the chosen category with the chosen windows in gold (60 pictures,
 * content/tint-photos.js), cross-faded on every change, and the price at once. The
 * 3D simulator stays one click away (section #simulateur-3d, loaded only when shown).
 */
const fmt = (n) => new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n);
const ZONES = {
  rear: { label: 'Vitres arrière', detail: 'vitres latérales arrière et lunette', file: 'arriere' },
  front: { label: 'Vitres avant', detail: 'vitres conducteur et passager', file: 'avant' },
  all: { label: 'Toutes les vitres', detail: 'vitres latérales et lunette, hors pare-brise', file: 'complet' },
};
const VIEWS = { 34: 'vue de trois quarts arrière', profil: 'vue de profil' };

export function startTintSimple(section) {
  const cars = JSON.parse(section.dataset.cars || '[]');
  const form = section.querySelector('[data-tsim-form]');
  const layers = [section.querySelector('[data-photo-a]'), section.querySelector('[data-photo-b]')];
  const priceEl = section.querySelector('[data-price]');
  const noteEl = section.querySelector('[data-price-note]');
  const law = section.querySelector('[data-law]');
  const quote = section.querySelector('[data-quote]');
  const book = section.querySelector('[data-book]');
  const layout = section.querySelector('.tsim__layout');
  const three = document.getElementById('simulateur-3d');
  // the site may live in a sub-folder: take the prefix from the first picture
  const src0 = layers[0].getAttribute('src');
  const prefix = src0.slice(0, src0.indexOf('img/vitres/'));
  const file = (car, view, zone, w) => `${prefix}img/vitres/${car}-${view}-${ZONES[zone].file}-${w}.webp`;
  let view = '34';
  let shown = 0;
  let wanted = '';

  /** the new picture on the hidden layer, then a cross-fade once it is decoded */
  function picture(car, zone) {
    const src = file(car.id, view, zone, 960);
    if (src === wanted) return;
    wanted = src;
    const next = layers[1 - shown];
    next.src = src;
    next.srcset = `${src} 960w, ${file(car.id, view, zone, 1600)} 1600w`;
    next.alt = `${car.label} (${car.example}) ${VIEWS[view]}, ${ZONES[zone].label.toLowerCase()} en surbrillance`;
    const swap = () => {
      if (wanted !== src) return;
      next.classList.add('is-shown');
      next.removeAttribute('aria-hidden');
      layers[shown].classList.remove('is-shown');
      layers[shown].setAttribute('aria-hidden', 'true');
      shown = 1 - shown;
    };
    (next.decode ? next.decode() : Promise.resolve()).then(swap, swap);
  }

  function update() {
    const car = cars.find((c) => c.id === form.elements.car.value) || cars[0];
    const zone = form.elements.zone.value;
    picture(car, zone);
    const p = car.price ? car.price[zone] : null;
    priceEl.textContent = p == null ? 'Sur devis' : fmt(p);
    noteEl.textContent = car.price
      ? `${ZONES[zone].label} : ${ZONES[zone].detail}.`
      : `${car.label} : forfait spécifique, nous vous répondons avec un devis détaillé.`;
    law.hidden = zone === 'rear';
    const config = `Vitres teintées — ${ZONES[zone].label} (${ZONES[zone].detail}) — ${car.label} (${car.example})${p == null ? ' — sur devis' : ` — ${fmt(p)} TTC indicatif`}`;
    const url = new URL(quote.getAttribute('href'), location.href);
    url.searchParams.set('prestation', 'vitres-teintees');
    url.searchParams.set('vehicule', `${car.label} (${car.example})`);
    url.searchParams.set('config', config);
    quote.href = url.pathname + url.search;
    // online booking of this very configuration (not for a vehicle priced on quote)
    if (book) {
      book.hidden = p == null;
      book.href = `${book.pathname}?prestation=vitres&vehicule=${encodeURIComponent(car.id)}&formule=${{ rear: 'rear', front: 'front', all: 'full' }[zone]}`;
    }
  }
  form.addEventListener('change', update);
  form.addEventListener('submit', (e) => e.preventDefault());
  for (const b of section.querySelectorAll('[data-view]'))
    b.addEventListener('click', () => {
      view = b.dataset.view;
      for (const x of section.querySelectorAll('[data-view]')) x.setAttribute('aria-pressed', String(x === b));
      update();
    });
  // simple mode / 3D: the 3D section appears in place of the photo
  const modeBtns = [...section.querySelectorAll('[data-mode]')];
  function mode(m) {
    for (const b of modeBtns.filter((x) => x.classList.contains('tsim__mode'))) b.setAttribute('aria-pressed', String(b.dataset.mode === m));
    layout.hidden = m === '3d';
    if (three) {
      three.hidden = m !== '3d';
      if (m === '3d') three.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });
    }
  }
  for (const b of modeBtns) b.addEventListener('click', () => mode(b.dataset.mode));
  if (location.hash === '#simulateur-3d') mode('3d');
  update();
  // the other visuals of the chosen car, ready before the visitor asks for them
  const warm = () => {
    const car = form.elements.car.value;
    for (const v of Object.keys(VIEWS)) for (const z of Object.keys(ZONES)) new Image().src = file(car, v, z, 960);
  };
  form.addEventListener('change', () => ('requestIdleCallback' in window ? requestIdleCallback(warm) : setTimeout(warm, 300)));
  'requestIdleCallback' in window ? requestIdleCallback(warm, { timeout: 3000 }) : setTimeout(warm, 1500);
}
