/**
 * Simulator sections for the service pages. The panels are plain HTML forms (indexable,
 * usable without WebGL); src/js/sim/*.js binds them to the 3D viewer and computes prices.
 */
import { esc } from './pages.js';
import { glazing, glazingReminder, lightsRule, roadStatus } from '../../content/regulation.js';

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

const total = (note = '', { quote = false } = {}) => `<div class="sim__total" aria-live="polite">
          <span class="sim__total-label">${quote ? 'Tarif' : 'Tarif indicatif TTC'}</span>
          <span class="sim__total-value" data-total>${quote ? 'Sur devis' : '—'}</span>
          <p class="sim__detail" data-detail>${esc(note)}</p>
        </div>`;

const actions = (slug, extra = '') => `<div class="sim__actions">
          <a class="btn btn--primary" href="/contact/?prestation=${slug}" data-quote>Demander ce devis</a>
          ${extra}
          <button type="reset" class="sim__reset">Réinitialiser</button>
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
        ${total('Choisissez vos vitres')}
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
        ${total('Choisissez vos feux')}
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
          <p class="zone__note">Limites : la rénovation traite la surface extérieure de l’optique. Buée ou humidité à l’intérieur, réflecteur abîmé ou optique fissurée ne se corrigent pas ainsi ; le résultat dépend de l’état de départ, nous vous le disons avant d’intervenir.</p>
        </fieldset>
        ${total('Rénovation des phares')}
        ${actions('renovation-phares', '<button type="button" class="btn btn--ghost" data-play>Lancer la rénovation</button>')}`;
  return shell({
    kind: 'headlights',
    title: 'Avant / après : la rénovation de vos phares',
    intro: `Faites glisser le curseur pour polir l’optique jaunie, allumez les phares pour comparer : rénovation des deux phares à ${fmt(H.renovation)} TTC, traitement céramique en option (+${fmt(H.options[0].price)}). Simulation pédagogique : le résultat réel dépend de l’état de l’optique.`,
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
          <p class="zone__note">Entretien esthétique : nettoyage et décontamination, sans polissage. Polissage : une passe qui atténue micro-rayures et ternissement. Correction : plusieurs passes pour retirer davantage de défauts. Protection céramique : un revêtement sur le vernis corrigé. Le niveau de correction possible dépend de l’état et de l’épaisseur du vernis : il est évalué à l’atelier.</p>
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
