/**
 * Simulator sections for the service pages. The panels are plain HTML forms (indexable,
 * usable without WebGL); src/js/sim/*.js binds them to the 3D viewer and computes prices.
 */
import { esc } from './pages.js';

const fmt = (n) => new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n);

function shell({ kind, title, intro, poster, posterAlt, views, panel, tag = '' }) {
  return `<section class="sim" data-sim="${kind}" id="simulateur" aria-labelledby="sim-title">
  <div class="container">
    <div class="sim__head">
      <p class="kicker" style="color:var(--gold-300)">Simulateur 3D en temps réel</p>
      <h2 id="sim-title">${esc(title)}</h2>
      <p>${esc(intro)}</p>
    </div>
    <div class="sim__layout">
      <div class="sim__view" data-sim-view>
        <img src="/stills/sim-${kind}-960.webp" srcset="/stills/sim-${kind}-960.webp 960w, /stills/sim-${kind}-1600.webp 1600w" sizes="(min-width: 960px) 60vw, 100vw" width="1600" height="1000" alt="${esc(posterAlt)}" loading="lazy" decoding="async">
        ${tag ? `<p class="sim__tag">${tag}</p>` : ''}
        <button class="btn btn--primary sim__start" type="button" data-sim-start>Lancer la vue 3D</button>
        <div class="sim__views" role="group" aria-label="Points de vue">${views
          .map(([id, label], i) => `<button type="button" data-view="${id}" aria-pressed="${i === 0}">${esc(label)}</button>`)
          .join('')}</div>
        <p class="sim__hint">Glissez pour tourner · pincez ou molette pour zoomer</p>
      </div>
      <form class="sim__panel" data-sim-form>
        ${panel}
      </form>
    </div>
  </div>
</section>`;
}

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

const total = (note = '', { quote = false } = {}) => `<div class="sim__total" aria-live="polite">
          <span class="sim__total-label">${quote ? 'Tarif' : 'Votre tarif TTC'}</span>
          <span class="sim__total-value" data-total>${quote ? 'Sur devis' : '—'}</span>
          <p class="sim__detail" data-detail>${esc(note)}</p>
        </div>`;

const actions = (slug, extra = '') => `<div class="sim__actions">
          <a class="btn btn--primary" href="/contact/?prestation=${slug}" data-quote>Demander ce devis</a>
          ${extra}
        </div>`;

// ------------------------------------------------------------------------- window tint
export function simTint(ctx) {
  const { tint, vehicleTypes } = ctx.pricing;
  const shadeItems = tint.shades.map((v) => ({ value: String(v), label: `${v} %`, swatch: `rgba(10,14,20,${(1 - v / 100) * 0.95 + 0.04})` }));
  const panel = `
        ${vehicleGroup(ctx.pricing, 'Votre véhicule', 'coupe')}
        <fieldset class="sim__group">
          <legend>Vitres à teinter</legend>
          <div class="zone" data-zone="rear">
            <label class="zone__toggle"><input type="checkbox" name="rear" checked> 3/4 arrière <small>vitres latérales arrière + lunette</small></label>
            ${chips('rearShade', shadeItems, '15')}
          </div>
          <div class="zone is-off" data-zone="front">
            <label class="zone__toggle"><input type="checkbox" name="front"> Vitres avant <small>conducteur + passager</small></label>
            ${chips('frontShade', shadeItems, '70')}
          </div>
          <div class="warning" data-front-warning hidden>
            <p><strong>Attention — réglementation :</strong> depuis le 1er janvier 2017, le pare-brise et les vitres latérales avant doivent laisser passer au moins ${tint.legalFrontMin} % de la lumière (décret n° 2016-448). Une teinte plus foncée à l’avant expose le conducteur à une amende de 135 € et au retrait de 3 points, sauf dérogation médicale.</p>
            <p>Cette pose est réalisée à la demande expresse du client, sous sa seule responsabilité : ${esc(ctx.business.name)} ne pourra être tenu responsable des conséquences de son utilisation sur la voie publique.</p>
            <label class="choice"><input type="checkbox" name="ack" data-ack> J’ai pris connaissance de la réglementation et j’en accepte la responsabilité.</label>
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
        ${total('Choisissez vos vitres')}
        ${actions('vitres-teintees', '<button type="button" class="btn btn--ghost" data-compare aria-pressed="false">Avant / après</button>')}
        <p class="price-note">Véhicules 3D présentés à titre d’illustration de chaque catégorie ; le tarif dépend de la catégorie, pas du modèle. Crédits des modèles : <a href="/mentions-legales/">mentions légales</a>.</p>`;
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
  });
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
    <p class="price-note">« 3/4 arrière » : vitres latérales arrière et lunette arrière. Devis définitif après vérification du véhicule.</p>
  </div>
</section>`;
}

// ------------------------------------------------------------------------- tinted lights
export function simLights(ctx) {
  const L = ctx.pricing.lights;
  const shades = L.shades.map((s) => ({ value: String(s.id), label: s.label, swatch: `rgba(12,10,12,${s.smoke})` }));
  const panel = `
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
        <div class="warning"><p><strong>Réglementation :</strong> les feux doivent rester visibles et conformes à leur homologation. Un film sur les feux, en particulier à l’avant, peut rendre le véhicule non conforme pour la circulation sur la voie publique. La pose est réalisée à la demande du client, sous sa responsabilité.</p></div>
        ${total('Choisissez vos feux')}
        <p class="price-note">De ${L.perPair.min} à ${L.perPair.max} € TTC la paire de feux, selon le véhicule.</p>
        ${actions('feux-arriere-teintes')}`;
  return shell({
    kind: 'lights',
    title: 'Simulez vos feux fumés',
    intro: 'Feux avant, feux arrière, fumé 50 % ou 80 % : voyez le rendu sur le BMW X6 du studio, allumez les feux ou freinez pour juger la visibilité, et obtenez votre tarif : de 100 à 120 € TTC la paire.',
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
export function simHeadlights(ctx) {
  const H = ctx.pricing.headlights;
  const panel = `
        <fieldset class="sim__group">
          <legend>Avant / après</legend>
          <input class="range" type="range" min="0" max="100" value="0" step="1" name="clear" aria-label="Avancement de la rénovation">
          <div class="range-row"><span>Optique jaunie</span><span data-clear-label>0 %</span><span>Rénovée</span></div>
        </fieldset>
        <fieldset class="sim__group">
          <legend>Phares</legend>
          ${chips(
            'on',
            [
              { value: 'off', label: 'Éteints' },
              { value: 'on', label: 'Allumés' },
            ],
            'off'
          )}
        </fieldset>
        <fieldset class="sim__group">
          <legend>Options</legend>
          ${H.options.map((o) => `<label class="choice"><input type="checkbox" name="opt" value="${o.id}"> ${esc(o.label)} (+${fmt(o.price)} TTC)</label>`).join('')}
        </fieldset>
        ${total('Rénovation des phares')}
        ${actions('renovation-phares', '<button type="button" class="btn btn--ghost" data-play>Lancer la rénovation</button>')}`;
  return shell({
    kind: 'headlights',
    title: 'Avant / après : la rénovation de vos phares',
    intro: 'Faites glisser le curseur pour polir l’optique jaunie, allumez les phares pour comparer : rénovation des deux phares à 79 € TTC, traitement céramique en option (+30 €).',
    poster: 'headlights',
    posterAlt: 'Phares du BMW X6 après rénovation',
    views: [
      ['phare', 'Gros plan'],
      ['avant', 'Face avant'],
      ['34avant', '3/4 avant'],
    ],
    panel,
  });
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
        </fieldset>
        ${vehicleGroup(ctx.pricing, 'Votre véhicule')}
        ${total('Tarif établi selon le véhicule et la configuration choisie', { quote: true })}
        ${actions('ciel-etoile')}`;
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

// ------------------------------------------------------------------------- detailing
export function simDetailing(ctx) {
  const D = ctx.pricing.detailing;
  const panel = `
        <fieldset class="sim__group">
          <legend>Les étapes, en immersion</legend>
          <ol class="steps-rail">${D.steps.map((s, i) => `<li><button type="button" data-step="${s.id}"${i === 0 ? ' aria-current="step"' : ''}>${i + 1}. ${esc(s.label)}</button></li>`).join('')}</ol>
          <p class="price-note" data-step-text>Cliquez une étape ou lancez la démonstration complète.</p>
        </fieldset>
        <fieldset class="sim__group">
          <legend>Forfaits</legend>
          <div class="packages">${D.packages
            .map(
              (p, i) =>
                `<label class="package"><input type="radio" name="package" value="${p.id}"${i === 1 ? ' checked' : ''}><span><strong><span>${esc(p.label)}</span><span>Sur devis</span></strong><small>${esc(p.text)}</small></span></label>`
            )
            .join('')}</div>
        </fieldset>
        ${vehicleGroup(ctx.pricing)}
        ${total('Prix établi après examen de la peinture', { quote: true })}
        ${actions('detailing-carrosserie', '<button type="button" class="btn btn--ghost" data-play>Lancer la démonstration</button>')}`;
  return shell({
    kind: 'detailing',
    title: 'Le detailing, étape par étape',
    intro: 'Lavage, décontamination, polissage, protection céramique, finitions : suivez chaque étape sur la Porsche du studio, choisissez votre forfait et demandez votre devis.',
    poster: 'detailing',
    posterAlt: 'Polissage de la carrosserie de la Porsche dans le studio',
    views: [
      ['flanc', 'Flanc'],
      ['34avant', '3/4 avant'],
      ['34arriere', '3/4 arrière'],
      ['dessus', 'Vue drone'],
    ],
    panel,
  });
}

export function simFor(ctx, slug) {
  switch (slug) {
    case 'vitres-teintees':
      return simTint(ctx) + tintPriceTable(ctx);
    case 'feux-arriere-teintes':
      return simLights(ctx);
    case 'renovation-phares':
      return simHeadlights(ctx);
    case 'ciel-etoile':
      return simStarlight(ctx);
    case 'detailing-carrosserie':
      return simDetailing(ctx);
    default:
      return '';
  }
}
