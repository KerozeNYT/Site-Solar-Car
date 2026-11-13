/**
 * Simulator sections for the service pages. The panels are plain HTML forms (indexable,
 * usable without WebGL); src/js/sim/*.js binds them to the 3D viewer and computes prices.
 */
import { esc } from './pages.js';
import { glazing, glazingReminder, lightsRule, roadStatus } from '../../content/regulation.js';
import vehicles from '../../content/vehicles.js';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../..');

const fmt = (n) => new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n);

function shell({ kind, title, intro, poster, posterAlt, views, panel, tag = '', kicker = 'Simulateur 3D en temps réel', startLabel = 'Lancer la vue 3D', viewExtra = '', cls = '', attrs = '', id = 'simulateur' }) {
  return `<section class="sim${cls ? ' ' + cls : ''}" data-sim="${kind}" id="${id}" aria-labelledby="${id}-title"${attrs}>
  <div class="container">
    <div class="sim__head">
      <p class="kicker" style="color:var(--gold-300)">${esc(kicker)}</p>
      <h2 id="${id}-title">${esc(title)}</h2>
      <p>${esc(intro)}</p>
    </div>
    <div class="sim__layout">
      <div class="sim__view" data-sim-view>
        <img src="/stills/sim-${kind}-960.webp" srcset="/stills/sim-${kind}-960.webp 960w, /stills/sim-${kind}-1600.webp 1600w" sizes="(min-width: 960px) 60vw, 100vw" width="1600" height="1000" alt="${esc(posterAlt)}" loading="lazy" decoding="async">
        ${tag ? `<p class="sim__tag">${tag}</p>` : ''}
        <button class="btn btn--primary sim__start" type="button" data-sim-start>${esc(startLabel)}</button>${viewExtra}
        <div class="sim__views" role="group" aria-label="Points de vue">${views
          .map(([id, label], i) => `<button type="button" data-view="${id}" aria-pressed="${i === 0}">${esc(label)}</button>`)
          .join('')}</div>
        <p class="sim__hint">Glissez pour tourner · pincez ou molette pour zoomer</p>
      </div>
      <form class="sim__panel" data-sim-form>
        <p class="sim__restored" data-sim-restored hidden>Vos derniers réglages ont été repris. <button type="reset">Repartir de zéro</button></p>
        ${panel}
      </form>
    </div>
  </div>
</section>`;
}

/** road status line of a window zone (updated live by src/js/sim/tint.js) */
const road = (zone, vlt) => {
  const r = roadStatus(zone, vlt);
  return `<p class="road road--${r.id}" data-road="${zone}"><strong>${esc(r.label)}</strong> <span>${esc(r.note)}</span></p>`;
};

const chips = (name, items, checked, type = 'radio') =>
  `<div class="chips">${items
    .map(
      ({ value, label, swatch, disabled }) =>
        `<label class="chip"><input type="${type}" name="${name}" value="${esc(value)}"${value === checked ? ' checked' : ''}${disabled ? ' disabled' : ''}><span>${swatch ? `<i class="swatch" style="background:${swatch}"></i>` : ''}${esc(label)}</span></label>`
    )
    .join('')}</div>`;

const vehicleGroup = (pricing, legend = 'Votre véhicule', checked = 'berline') => `<fieldset class="sim__group">
          <legend>${esc(legend)}</legend>
          ${chips(
            'vehicle',
            pricing.vehicleTypes.map((v) => ({ value: v.id, label: v.label })),
            checked
          )}
        </fieldset>`;

/** price box; `value` = the default configuration's price, written in the page (visible before
 *  the script runs, and without it) */
const total = (note = '', { quote = false, value = '' } = {}) => `<div class="sim__total" aria-live="polite">
          <span class="sim__total-label">${quote ? 'Tarif' : 'Tarif indicatif TTC'}</span>
          <span class="sim__total-value" data-total>${quote ? 'Sur devis' : value || '—'}</span>
          <p class="sim__detail" data-detail>${esc(note)}</p>
        </div>`;

const actions = (slug, extra = '') => `<div class="sim__actions">
          <a class="btn btn--primary" href="/contact/?prestation=${slug}" data-quote>Demander ce devis</a>
          ${extra}
          <button type="reset" class="sim__reset">Réinitialiser</button>
        </div>`;

// ------------------------------------------------------------------------- window tint
export function simTint(ctx, { hidden = false } = {}) {
  const { tint, vehicleTypes } = ctx.pricing;
  const shadeItems = tint.shades.map((v) => ({ value: String(v), label: `${v} %`, swatch: `rgba(10,14,20,${(1 - v / 100) * 0.95 + 0.04})` }));
  const panel = `
        ${vehicleGroup(ctx.pricing, 'Votre véhicule', 'coupe')}
        <fieldset class="sim__group">
          <legend>Vitres à teinter</legend>
          <div class="zone" data-zone="rear">
            <label class="zone__toggle"><input type="checkbox" name="rear" checked> 3/4 arrière <small>vitres latérales arrière + lunette</small></label>
            ${chips('rearShade', shadeItems, '15')}
            ${road('rear', 15)}
          </div>
          <div class="zone is-off" data-zone="front">
            <label class="zone__toggle"><input type="checkbox" name="front"> Vitres avant <small>conducteur + passager</small></label>
            ${chips('frontShade', shadeItems, '70')}
            ${road('front', 70)}
          </div>
          <div class="zone is-off" data-zone="windshield">
            <label class="zone__toggle"><input type="checkbox" name="windshield"> Pare-brise <small>film athermique ou irisé</small></label>
            ${chips(
              'windshieldFilm',
              tint.windshield.films.map((f) => ({ value: f.id, label: `${f.label} · ${fmt(f.price)}`, swatch: f.iridescent ? 'linear-gradient(135deg,#3d6cff,#9b46ff 45%,#f7da78)' : `rgba(10,14,20,${(1 - f.vlt / 100) * 0.95 + 0.04})` })),
              'athermique'
            )}
            <div class="zone__more" data-irise hidden>
              <p class="zone__label">Couleur du film irisé</p>
              ${chips('iriseColor', tint.windshield.colors.map((c) => ({ value: c.id, label: c.label, swatch: c.swatch })), tint.windshield.colors[0].id)}
              <p class="zone__note">Effet caméléon : la teinte change selon l’angle et la lumière. La référence du film et sa transmission figurent sur le devis.</p>
            </div>
            ${road('windshield', tint.windshield.films[0].vlt)}
          </div>
          <div class="warning" data-front-warning hidden>
            <p><strong>Réglementation (${esc(glazing.article)}) :</strong> ${esc(glazingReminder)}</p>
            <p>Les configurations marquées « visualisation esthétique » sont montrées pour le rendu : elles ne sont pas autorisées sur la voie publique. L’atelier vous conseille une alternative adaptée.</p>
          </div>
        </fieldset>
        <fieldset class="sim__group">
          <legend>Couleur de la carrosserie</legend>
          ${chips(
            'paint',
            [
              { value: '#0c1c44', label: 'Bleu nuit', swatch: '#14295e' },
              { value: '#c9ccd1', label: 'Gris argent', swatch: '#c9ccd1' },
              { value: '#f2f2f0', label: 'Blanc', swatch: '#f2f2f0' },
              { value: '#101215', label: 'Noir', swatch: '#101215' },
              { value: '#8a1d1d', label: 'Rouge', swatch: '#8a1d1d' },
            ],
            '#0c1c44'
          )}
        </fieldset>
        ${total('Choisissez vos vitres', { value: fmt(tint.rearPackage.coupe) })}
        ${actions('vitres-teintees', '<button type="button" class="btn btn--ghost" data-compare aria-pressed="false">Avant / après</button>')}
        <p class="price-note">Prix TTC indicatifs, confirmés par le devis après vérification du véhicule. Rendu 3D indicatif : il ne mesure pas la transmission lumineuse réelle. Véhicules 3D présentés à titre d’illustration de chaque catégorie ; le tarif dépend de la catégorie, pas du modèle. Crédits des modèles : <a href="/mentions-legales/">mentions légales</a>.</p>`;
  return shell({
    kind: 'tint',
    title: 'Simulez la teinte de vos vitres et votre prix',
    intro: 'Choisissez votre type de véhicule, les vitres à teinter et l’intensité du film : le rendu change en direct sur la voiture et le prix s’affiche immédiatement. Tournez autour, passez à l’intérieur pour voir la route à travers le film.',
    poster: 'tint',
    posterAlt: 'Aperçu du simulateur de vitres teintées',
    views: [
      ['34arriere', '3/4 arrière'],
      ['profil', 'Profil'],
      ['34avant', '3/4 avant'],
      ['arriere', 'Arrière'],
      ['interieur', 'Intérieur'],
      ['dessus', 'Vue drone'],
    ],
    tag: '<span class="badge-demo" data-model-tag hidden>Silhouette provisoire</span>',
    panel,
    // behind the simple mode: hidden, its 3D loads only once shown
    ...(hidden ? { id: 'simulateur-3d', attrs: ' hidden data-sim-lazy', kicker: 'Simulateur 3D en temps réel' } : {}),
  });
}

// ------------------------------------------------------------------------- tint, simple mode
/**
 * The visuals of the simple mode (content/tint-photos.js: 60 pictures, the chosen windows
 * already outlined in gold; made into web files and a manifest by scripts/tint-photos.mjs).
 */
function tintPictures() {
  const file = path.join(ROOT, 'public/img/vitres/manifest.json');
  if (!fs.existsSync(file)) return null;
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}
const WINDOW_FILES = { rear: 'arriere', front: 'avant', all: 'complet' };

/** Simple mode: a car of the chosen category, the chosen windows in gold, the price at once */
export function simTintSimple(ctx, pictures) {
  const { tint, tintVehicles } = ctx.pricing;
  const cars = tintVehicles.filter((v) => pictures.cars[v.id]);
  const price = (v) => (v.quote ? null : { rear: tint.rearPackage[v.cat], front: tint.frontOnly, all: tint.rearPackage[v.cat] + tint.frontWithRear });
  const data = cars.map((v) => ({ id: v.id, label: v.label, example: v.example, price: price(v), ...pictures.cars[v.id] }));
  const first = cars[0];
  const size0 = pictures.cars[first.id];
  const img = (id, angle, win, w) => `/img/vitres/${id}-${angle}-${WINDOW_FILES[win]}-${w}.webp`;
  const zones = [
    { value: 'rear', label: 'Vitres arrière', hint: 'latérales arrière + lunette' },
    { value: 'front', label: 'Vitres avant', hint: 'conducteur + passager' },
    { value: 'all', label: 'Toutes les vitres', hint: 'hors pare-brise' },
  ];
  const picture = (cls, extra = '') =>
    `<img class="tsim__img ${cls}" src="${img(first.id, '34', 'rear', 960)}" srcset="${img(first.id, '34', 'rear', 960)} 960w, ${img(first.id, '34', 'rear', 1600)} 1600w" sizes="(min-width: 960px) 58vw, 100vw" width="${size0.w}" height="${size0.h}" alt="${esc(`${first.label} (${first.example}) vue de trois quarts arrière, vitres arrière en surbrillance`)}" loading="lazy" decoding="async"${extra}>`;
  return `<section class="sim tsim" id="simulateur" data-tint-simple aria-labelledby="tsim-title" data-cars="${esc(JSON.stringify(data))}">
  <div class="container">
    <div class="sim__head">
      <p class="kicker" style="color:var(--gold-300)">Simulateur · prix immédiat</p>
      <h2 id="tsim-title">Votre prix en deux clics</h2>
      <p>Choisissez votre type de véhicule et les vitres à teinter : elles apparaissent en doré sur la photo et le prix s’affiche aussitôt. Envie de tourner autour de la voiture et d’essayer les teintes ? Passez au simulateur 3D.</p>
    </div>
    <div class="tsim__modes" role="group" aria-label="Mode du simulateur">
      <button type="button" class="tsim__mode" aria-pressed="true" data-mode="simple">Simulateur photo</button>
      <button type="button" class="tsim__mode" aria-pressed="false" data-mode="3d">Simulateur 3D</button>
    </div>
    <div class="tsim__layout">
      <div class="tsim__stage">
        <figure class="tsim__photo" data-photo style="--ar:${size0.w} / ${size0.h}">
          ${picture('is-shown', ' data-photo-a')}
          ${picture('', ' data-photo-b aria-hidden="true"')}
        </figure>
        <div class="tsim__views" role="group" aria-label="Point de vue">
          <button type="button" aria-pressed="true" data-view="34">3/4 arrière</button>
          <button type="button" aria-pressed="false" data-view="profil">Profil</button>
        </div>
        <p class="tsim__credit">${esc(pictures.credit || '')}</p>
      </div>
      <form class="tsim__panel" data-tsim-form>
        <fieldset class="sim__group">
          <legend>1. Quel type de véhicule avez-vous ?</legend>
          <div class="chips tsim__cars">${cars
            .map((v, i) => `<label class="chip"><input type="radio" name="car" value="${v.id}"${i === 0 ? ' checked' : ''}><span>${esc(v.label)}<small>${esc(v.example)}</small></span></label>`)
            .join('')}</div>
        </fieldset>
        <fieldset class="sim__group">
          <legend>2. Quelles vitres voulez-vous teinter ?</legend>
          <div class="chips">${zones.map((z, i) => `<label class="chip"><input type="radio" name="zone" value="${z.value}"${i === 0 ? ' checked' : ''}><span>${esc(z.label)}<small>${esc(z.hint)}</small></span></label>`).join('')}</div>
        </fieldset>
        <div class="tsim__price" aria-live="polite">
          <span>Prix TTC, pose comprise</span>
          <strong data-price>—</strong>
          <small data-price-note></small>
        </div>
        <p class="tsim__law" data-law hidden>À l’avant, la loi impose au moins ${glazing.frontMin} % de lumière, vitre et film compris : seul un film très clair convient, contrôlé sur votre véhicule. Les vitres arrière et la lunette peuvent être aussi foncées que vous le souhaitez (${tint.shades.join(', ')} %, toutes au même prix).</p>
        <div class="ctas">
          <a class="btn btn--primary" href="/contact/?prestation=vitres-teintees" data-quote>Demander ce devis</a>
          <button type="button" class="btn btn--ghost" data-mode="3d">Voir en 3D</button>
        </div>
        <p class="price-note">Prix TTC indicatifs, confirmés par le devis après vérification du véhicule. Visuels de véhicules représentatifs de chaque catégorie ; le tarif dépend de la catégorie, pas du modèle exact.</p>
      </form>
    </div>
  </div>
</section>`;
}

/** the tint simulators of the page: the simple mode first when its pictures exist, the 3D one behind a switch */
export function tintSims(ctx) {
  const pictures = tintPictures();
  const ok = pictures && ctx.pricing.tintVehicles.every((v) => pictures.cars?.[v.id]);
  if (!ok) return simTint(ctx);
  return simTintSimple(ctx, pictures) + simTint(ctx, { hidden: true });
}


export function tintPriceTable(ctx) {
  const { tint, vehicleTypes } = ctx.pricing;
  return `<section class="section" aria-labelledby="tarifs-title">
  <div class="container container--narrow">
    <h2 id="tarifs-title">Tarifs de pose de vitres teintées</h2>
    <table class="price-table">
      <caption>Prix TTC par catégorie de véhicule, film posé</caption>
      <thead><tr><th scope="col">Catégorie</th><th scope="col" class="num">3/4 arrière</th><th scope="col" class="num">Véhicule complet</th></tr></thead>
      <tbody>
        ${vehicleTypes
          .map(
            (v) =>
              `<tr><th scope="row">${esc(v.label)}${v.examples ? `<small>${esc(v.examples)}</small>` : ''}</th><td class="num">${fmt(tint.rearPackage[v.id])}</td><td class="num">${fmt(tint.rearPackage[v.id] + tint.frontWithRear)}</td></tr>`
          )
          .join('')}
      </tbody>
    </table>
    <p class="price-note">Vitres avant seules (sans forfait arrière) : <strong>${fmt(tint.frontOnly)}</strong>. Avec le forfait 3/4 arrière, les vitres avant ajoutent <strong>${fmt(tint.frontWithRear)}</strong>. Toutes les teintes au même prix : ${tint.shades.join(' %, ')} % de transmission lumineuse.</p>
    <p class="price-note">Pare-brise : film athermique <strong>${fmt(tint.windshield.films.find((f) => f.id === 'athermique').price)}</strong> · film irisé effet caméléon <strong>${fmt(tint.windshield.films.find((f) => f.iridescent).price)}</strong> (${tint.windshield.colors.map((c) => c.label.toLowerCase()).join(', ')}…). Le pare-brise et les vitres avant doivent laisser passer au moins ${glazing.frontMin} % de la lumière, film compris : la conformité dépend du film et du vitrage, elle se vérifie sur le véhicule.</p>
    <p class="price-note">« 3/4 arrière » : vitres latérales arrière et lunette arrière. Prix TTC indicatifs ; devis définitif après vérification du véhicule.</p>
  </div>
</section>`;
}

// ------------------------------------------------------------------------- tinted lights
export function simLights(ctx) {
  const L = ctx.pricing.lights;
  const shades = L.shades.map((s) => ({ value: String(s.id), label: s.label, swatch: `rgba(12,10,12,${s.smoke})` }));
  const pairPrice = (m) => (m.validated ? (m.perPair.min === m.perPair.max ? fmt(m.perPair.min) : `${m.perPair.min} à ${fmt(m.perPair.max)}`) : 'sur devis');
  const panel = `
        <fieldset class="sim__group">
          <legend>Matériau</legend>
          ${chips(
            'material',
            L.materials.map((m) => ({ value: m.id, label: `${m.label} · ${pairPrice(m)}` })),
            L.materials[0].id
          )}
          ${L.materials.map((m) => `<p class="zone__note" data-material-note="${m.id}"${m.id === L.materials[0].id ? '' : ' hidden'}>${esc(m.text)}</p>`).join('')}
        </fieldset>
        <fieldset class="sim__group">
          <legend>Feux à teinter</legend>
          <div class="zone" data-zone="rear">
            <label class="zone__toggle"><input type="checkbox" name="rear" checked> Feux arrière</label>
            ${chips('rearShade', shades, '50')}
          </div>
          <div class="zone is-off" data-zone="front">
            <label class="zone__toggle"><input type="checkbox" name="front"> Feux avant</label>
            ${chips('frontShade', shades, '50')}
          </div>
        </fieldset>
        <fieldset class="sim__group">
          <legend>Éclairage</legend>
          ${chips(
            'lightsOn',
            [
              { value: 'on', label: 'Feux allumés' },
              { value: 'brake', label: 'Freinage' },
              { value: 'off', label: 'Éteints' },
            ],
            'on'
          )}
        </fieldset>
        <div class="warning"><p><strong>Réglementation :</strong> ${esc(lightsRule)}</p></div>
        ${total('Choisissez vos feux', { value: pairPrice(L.materials[0]) })}
        <p class="price-note">${L.materials.map((m) => `${esc(m.label)} : ${pairPrice(m)}${m.validated ? ' TTC la paire' : ''}`).join(' · ')}. Prix indicatifs selon le véhicule, confirmés par le devis.</p>
        ${actions('feux-arriere-teintes', '<button type="button" class="btn btn--ghost" data-compare aria-pressed="false">Avant / après</button>')}`;
  return shell({
    kind: 'lights',
    title: 'Simulez vos feux fumés',
    intro: `Covering ou PPF, feux avant ou arrière, fumé 50 % ou 80 % : voyez le rendu sur le BMW X6 du studio, allumez les feux ou freinez pour juger la visibilité, et obtenez votre tarif indicatif : covering ${pairPrice(L.materials[0])} TTC la paire.`,
    poster: 'tail',
    posterAlt: 'Feux arrière fumés sur le BMW X6 du studio',
    views: [
      ['arriere', 'Arrière'],
      ['34arriere', '3/4 arrière'],
      ['avant', 'Avant'],
      ['34avant', '3/4 avant'],
    ],
    panel,
  });
}

// ------------------------------------------------------------------------- headlights
/** Headlight renovation: prices and limits (no simulator: the result depends on the optic). */
export function headlightsPriceTable(ctx) {
  const H = ctx.pricing.headlights;
  return `<section class="section" id="tarifs" aria-labelledby="tarifs-title">
  <div class="container container--narrow">
    <h2 id="tarifs-title">Tarifs de rénovation de phares</h2>
    <table class="price-table">
      <caption>Prix TTC, optiques traitées en place à l’atelier</caption>
      <thead><tr><th scope="col">Prestation</th><th scope="col" class="num">Prix TTC</th></tr></thead>
      <tbody>
        <tr><th scope="row">Rénovation des deux phares<small>Ponçage, polissage, protection anti-UV</small></th><td class="num">${fmt(H.renovation)}</td></tr>
        ${H.options.map((o) => `<tr><th scope="row">Option : ${esc(o.label)}</th><td class="num">+${fmt(o.price)}</td></tr>`).join('')}
      </tbody>
    </table>
    <p class="price-note">Limites : la rénovation traite la surface extérieure de l’optique. Buée ou humidité à l’intérieur, réflecteur abîmé ou optique fissurée ne se corrigent pas ainsi ; le résultat dépend de l’état de départ, nous vous le disons avant d’intervenir.</p>
    <p class="price-note"><a class="btn btn--primary" href="/contact/?prestation=renovation-phares">Demander un devis</a></p>
  </div>
</section>`;
}

// ------------------------------------------------------------------------- starlight
export function simStarlight(ctx) {
  const S = ctx.pricing.starlight;
  const colors = [
    { value: '#ffffff', label: 'Blanc pur', swatch: '#ffffff' },
    { value: '#ffe2b0', label: 'Blanc chaud', swatch: '#ffe2b0' },
    { value: '#9fc6ff', label: 'Bleu glacier', swatch: '#9fc6ff' },
    { value: '#c49bff', label: 'Violet', swatch: '#c49bff' },
    { value: '#ffb347', label: 'Ambre', swatch: '#ffb347' },
    { value: '#ff6b6b', label: 'Rouge', swatch: '#ff6b6b' },
  ];
  const panel = `
        <fieldset class="sim__group">
          <legend>Nombre d’étoiles</legend>
          <input class="range" type="range" name="count" min="0" max="${S.starSteps.length - 1}" value="3" step="1" aria-label="Nombre d’étoiles">
          <div class="range-row"><span>${S.starSteps[0]}</span><strong data-count-label>${S.starSteps[3]} étoiles</strong><span>${S.starSteps[S.starSteps.length - 1]}</span></div>
        </fieldset>
        <fieldset class="sim__group">
          <legend>Couleur des étoiles</legend>
          ${chips('c1', colors, '#ffffff')}
          <label class="choice" style="margin-top:10px"><input type="checkbox" name="opt" value="bicolor"> Bicolore — seconde couleur :</label>
          <div data-c2>${chips('c2', colors, '#9fc6ff')}</div>
        </fieldset>
        <fieldset class="sim__group">
          <legend>Intensité</legend>
          <input class="range" type="range" name="intensity" min="20" max="100" value="100" step="5" aria-label="Intensité lumineuse">
          <div class="range-row"><span>Douce</span><strong data-intensity-label>100 %</strong><span>Maximale</span></div>
        </fieldset>
        <fieldset class="sim__group">
          <legend>Effets</legend>
          <label class="choice"><input type="checkbox" name="opt" value="twinkle" checked> Scintillement</label><br>
          <label class="choice"><input type="checkbox" name="opt" value="shooting"> Étoiles filantes</label><br>
          <label class="choice"><input type="checkbox" name="opt" value="constellation"> Constellation :</label>
          <select name="constellation" aria-label="Constellation">
            <option value="grande-ourse">Grande Ourse</option>
            <option value="orion">Orion</option>
            <option value="cassiopee">Cassiopée</option>
            <option value="croix-du-sud">Croix du Sud</option>
          </select>
          <p class="zone__note">Couleurs, bicolore, étoiles filantes et constellations dépendent du kit posé : leur disponibilité pour votre véhicule est confirmée sur le devis.</p>
        </fieldset>
        ${vehicleGroup(ctx.pricing, 'Votre véhicule')}
        ${total('Tarif établi selon le véhicule et la configuration choisie', { quote: true })}
        ${actions('ciel-etoile', '<button type="button" class="btn btn--ghost" data-compare aria-pressed="false">Éteindre</button>')}`;
  return shell({
    kind: 'starlight',
    title: 'Composez votre ciel étoilé',
    intro: 'Densité des étoiles, couleur unie ou bicolore, étoiles filantes, constellation : réglez votre ciel, regardez-le s’allumer dans l’habitacle de la Porsche du studio, puis envoyez votre configuration pour recevoir un devis.',
    poster: 'stars',
    posterAlt: 'Ciel étoilé en fibre optique dans l’habitacle',
    views: [
      ['plafond', 'Ciel de toit'],
      ['habitacle', 'Habitacle'],
    ],
    panel,
  });
}

export function simFor(ctx, slug) {
  switch (slug) {
    case 'vitres-teintees':
      return tintSims(ctx); // the price grid of every category is a section of the page (content/sections/vitres-teintees.js)
    case 'feux-arriere-teintes':
      return simLights(ctx);
    case 'renovation-phares':
      return headlightsPriceTable(ctx);
    case 'ciel-etoile':
      return simStarlight(ctx);
    default:
      return '';
  }
}
