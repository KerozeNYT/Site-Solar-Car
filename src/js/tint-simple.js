/**
 * Window tint simulator, simple mode (/vitres-teintees/, src/templates/sims.js simTintSimple):
 * a photo of a car of the chosen category, the chosen windows darkened and outlined in gold
 * (masks rendered with the pictures, scripts/cars/render.mjs), the price at once. The 3D
 * simulator stays one click away (section #simulateur-3d, loaded only when shown).
 */
const fmt = (n) => new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n);
const ZONES = {
  rear: { label: 'Vitres arrière', detail: 'vitres latérales arrière et lunette' },
  front: { label: 'Vitres avant', detail: 'vitres conducteur et passager' },
  all: { label: 'Toutes les vitres', detail: 'vitres latérales et lunette, hors pare-brise' },
};
const VIEWS = { 34: 'vue de trois quarts arrière', side: 'vue de profil' };

export function startTintSimple(section) {
  const cars = JSON.parse(section.dataset.cars || '[]');
  const form = section.querySelector('[data-tsim-form]');
  const img = section.querySelector('[data-photo-img]');
  const zones = Object.fromEntries([...section.querySelectorAll('[data-zone]')].map((el) => [el.dataset.zone, el]));
  const priceEl = section.querySelector('[data-price]');
  const noteEl = section.querySelector('[data-price-note]');
  const law = section.querySelector('[data-law]');
  const quote = section.querySelector('[data-quote]');
  const credit = section.querySelector('[data-credit]');
  const layout = section.querySelector('.tsim__layout');
  const three = document.getElementById('simulateur-3d');
  // the site may live in a sub-folder: take the prefix from the first picture
  const src0 = img.getAttribute('src');
  const prefix = src0.slice(0, src0.indexOf('img/vitres/'));
  const file = (id, view, part) => `${prefix}img/vitres/${id}-${view}-${part}.webp`;
  let view = '34';

  function update() {
    const car = cars.find((c) => c.id === form.elements.car.value) || cars[0];
    const zone = form.elements.zone.value;
    const shade = Number(form.elements.shade.value);
    // the picture and its window masks
    const src = file(car.id, view, 960);
    if (img.getAttribute('src') !== src) {
      img.src = src;
      img.srcset = `${src} 960w, ${file(car.id, view, 1600)} 1600w`;
      img.alt = `${car.label} (${car.example}) ${VIEWS[view]}`;
    }
    for (const [g, el] of Object.entries(zones)) {
      el.style.setProperty('--mask', `url("${file(car.id, view, g)}")`);
      el.classList.toggle('is-on', zone === 'all' || zone === g);
    }
    // darkness: the chosen shade at the rear; at the front a clear film (the law)
    zones.rear.style.setProperty('--tint', ((1 - shade / 100) * 0.88).toFixed(2));
    zones.front.style.setProperty('--tint', '0.16');
    // price
    const p = car.price ? car.price[zone] : null;
    priceEl.textContent = p == null ? 'Sur devis' : fmt(p);
    noteEl.textContent = car.price
      ? `${ZONES[zone].label} : ${ZONES[zone].detail}.`
      : `${car.label} : forfait spécifique, nous vous répondons avec un devis détaillé.`;
    law.hidden = zone === 'rear';
    credit.textContent = car.credit || '';
    const config = `Vitres teintées — ${ZONES[zone].label} (${ZONES[zone].detail}) — teinte arrière ${shade} % — ${car.label} (${car.example})${p == null ? ' — sur devis' : ` — ${fmt(p)} TTC indicatif`}`;
    const url = new URL(quote.getAttribute('href'), location.href);
    url.searchParams.set('prestation', 'vitres-teintees');
    url.searchParams.set('vehicule', `${car.label} (${car.example})`);
    url.searchParams.set('config', config);
    quote.href = url.pathname + url.search;
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
  // the other pictures of this category, ready when the visitor switches the view
  const warm = () => cars.forEach((c) => ['34', 'side'].forEach((v) => (new Image().src = file(c.id, v, 960))));
  'requestIdleCallback' in window ? requestIdleCallback(warm, { timeout: 4000 }) : setTimeout(warm, 2000);
}
