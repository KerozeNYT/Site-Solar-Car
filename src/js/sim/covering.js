import * as THREE from 'three';
import { FINISHES, EFFECTS, FAMILIES, simDefaults } from '../../../content/covering.js';
import vehicles from '../../../content/vehicles.js';
import { setQuote } from './util.js';

/**
 * Covering & déchromage on the showroom SUV (content/cars/x6.js `covering`).
 *
 * The form is the configuration: mode, the film of each slot (hidden fields), the zones and the
 * chrome parts ticked. The 3D side gives every slot ONE material created once (body, each
 * partial zone, the chrome delete); choosing a film only changes that material's values
 * (colour, roughness, metal, clearcoat, flip and carbon amounts): no new shader, no download,
 * whatever the number of references tried. « Voir l'origine » puts the model's own materials
 * back on the same meshes.
 */
const MODES = ['complet', 'partiel', 'dechromage'];
const MODE_LABEL = { complet: 'Covering complet', partiel: 'Covering partiel', dechromage: 'Déchromage seul' };
const norm = (t) =>
  String(t || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();

export async function setup({ section, form, view, reduceMotion = false }) {
  // the catalogue: its own small file, fetched with the simulator only
  const { films, byId, ranges } = await import('../../../content/films/index.js');
  const cov = vehicles.suv.config.covering;
  const zones = cov.zones;
  const chrome = cov.chrome;
  const blackIds = simDefaults.dechromeFilms.filter((id) => byId.has(id));
  const $ = (sel) => section.querySelector(sel);
  const field = (name) => form.elements.namedItem(name);
  const slotLabel = (slot) => (slot === 'body' ? 'carrosserie complète' : zones.find((z) => z.id === slot)?.label.toLowerCase() || '');

  // ---------------------------------------------------------------- state from the form
  function read() {
    const mode = MODES.includes(form.elements.mode.value) ? form.elements.mode.value : 'complet';
    const film = { body: field('film-body').value };
    for (const z of zones) film[z.id] = field(`film-${z.id}`).value;
    film.dechrome = form.elements['film-dechrome']?.value || simDefaults.dechrome;
    return {
      mode,
      target: form.elements.target?.value || 'body',
      film,
      zonesOn: zones.filter((z) => field(`zone-${z.id}`)?.checked).map((z) => z.id),
      dc: chrome.filter((c) => field(`dc-${c.id}`)?.checked).map((c) => c.id),
    };
  }
  const setRadio = (name, value) => {
    const el = [...form.querySelectorAll(`input[name="${name}"]`)].find((i) => i.value === value);
    if (el) el.checked = true;
    return !!el;
  };
  // saved settings and shared links may carry ids that no longer exist: back to the defaults
  function sanitize() {
    for (const f of form.querySelectorAll('input[type="hidden"][name^="film-"]')) if (!byId.has(f.value)) f.value = f.dataset.default;
    if (!blackIds.includes(form.elements['film-dechrome']?.value)) setRadio('film-dechrome', simDefaults.dechrome);
    if (!MODES.includes(form.elements.mode.value)) setRadio('mode', 'complet');
  }

  // ---------------------------------------------------------------- shared link (ids only)
  // ?cfg=m:partiel;b:3m-2080-s347;z:toit=3m-2080-g12,capot=3m-2080-m12;d:calandre,ouies;df:3m-2080-m12
  function encode(s) {
    const parts = [`m:${s.mode}`, `b:${s.film.body}`];
    if (s.zonesOn.length) parts.push(`z:${s.zonesOn.map((z) => `${z}=${s.film[z]}`).join(',')}`);
    if (s.dc.length) parts.push(`d:${s.dc.join(',')}`, `df:${s.film.dechrome}`);
    return parts.join(';');
  }
  /** applies a shared configuration to the form; returns false when something was ignored */
  function decode(code) {
    let clean = true;
    const tokens = String(code).slice(0, 600).split(';');
    const zoneIds = new Set(zones.map((z) => z.id));
    const dcIds = new Set(chrome.map((c) => c.id));
    for (const z of zones) field(`zone-${z.id}`).checked = false;
    for (const c of chrome) field(`dc-${c.id}`).checked = false;
    for (const t of tokens) {
      const [k, v = ''] = t.split(':');
      if (k === 'm' && MODES.includes(v)) setRadio('mode', v);
      else if (k === 'b' && byId.has(v)) field('film-body').value = v;
      else if (k === 'z')
        for (const pair of v.split(',')) {
          const [z, id] = pair.split('=');
          if (zoneIds.has(z) && byId.has(id)) {
            field(`zone-${z}`).checked = true;
            field(`film-${z}`).value = id;
          } else clean = false;
        }
      else if (k === 'd')
        for (const c of v.split(',')) {
          if (dcIds.has(c)) field(`dc-${c}`).checked = true;
          else clean = false;
        }
      else if (k === 'df' && blackIds.includes(v)) setRadio('film-dechrome', v);
      else clean = false;
    }
    return clean;
  }
  const modeNote = $('[data-mode-note]');
  const shared = new URLSearchParams(location.search).get('cfg');
  let note = '';
  if (shared) note = decode(shared) ? 'Configuration partagée chargée.' : 'Lien de configuration incomplet : les éléments non reconnus ont été ignorés.';
  sanitize();

  // ---------------------------------------------------------------- the colour chart
  const host = $('[data-nuancier]');
  $('[data-nuancier-loading]')?.remove();
  const familySel = selectOf('Famille', 'family', [['', 'Toutes'], ...[...new Set(films.map((f) => f.family))].map((f) => [f, FAMILIES[f] || f])]);
  const finishSel = selectOf('Finition', 'finish', [['', 'Toutes'], ...Object.keys(FINISHES).filter((k) => films.some((f) => f.finish === k)).map((k) => [k, FINISHES[k].label])]);
  const effectSel = selectOf('Effet', 'effect', [['', 'Tous'], ['none', 'Sans effet'], ...Object.keys(EFFECTS).filter((k) => films.some((f) => f.effects.includes(k))).map((k) => [k, EFFECTS[k].label])]);
  const search = document.createElement('input');
  search.type = 'search';
  search.placeholder = 'Nom, teinte ou code (ex. G12, satiné, bleu)';
  search.setAttribute('aria-label', 'Rechercher une référence par nom ou par code');
  search.className = 'nuancier__search';
  const tools = document.createElement('div');
  tools.className = 'nuancier__tools';
  tools.append(search, familySel.wrap, finishSel.wrap, effectSel.wrap);
  const count = document.createElement('p');
  count.className = 'nuancier__count';
  count.setAttribute('aria-live', 'polite');
  const grid = document.createElement('div');
  grid.className = 'nuancier__grid';
  grid.setAttribute('role', 'group');
  grid.setAttribute('aria-label', 'Références du nuancier');
  const card = document.createElement('div');
  card.className = 'nuancier__card';
  card.setAttribute('aria-live', 'polite');
  const forEl = $('[data-nuancier-for]');
  const buttons = films.map((f) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'film';
    b.dataset.film = f.id;
    b.tabIndex = -1;
    b.setAttribute('aria-pressed', 'false');
    b.innerHTML = `<span class="film__chip" data-finish="${f.finish}" data-effects="${f.effects.join(' ')}" style="--c:${f.preview};--f:${f.visual.flip || f.preview}" aria-hidden="true"></span><span class="film__code">${f.code.replace(/^2080-/, '')}</span><span class="visually-hidden">${f.brand} ${f.code} ${f.name}, ${f.label}</span>`;
    b.title = `${f.code} · ${f.name} · ${f.label}`;
    b._text = norm([f.code, f.code.replace('-', ' '), f.name, f.label, FAMILIES[f.family], FINISHES[f.finish]?.label, FINISHES[f.finish]?.long, ...f.effects.map((e) => EFFECTS[e]?.label)].join(' '));
    grid.append(b);
    return b;
  });
  host.append(tools, count, grid, card);
  filter();

  function selectOf(label, key, options) {
    const wrap = document.createElement('label');
    wrap.className = 'nuancier__filter';
    const sel = document.createElement('select');
    sel.dataset.filter = key;
    sel.innerHTML = options.map(([v, l]) => `<option value="${v}">${l}</option>`).join('');
    wrap.append(document.createTextNode(label + ' '), sel);
    return { wrap, sel };
  }
  function filter() {
    const q = norm(search.value).split(/\s+/).filter(Boolean);
    const fam = familySel.sel.value;
    const fin = finishSel.sel.value;
    const eff = effectSel.sel.value;
    let n = 0;
    for (const b of buttons) {
      const f = byId.get(b.dataset.film);
      const ok = (!fam || f.family === fam) && (!fin || f.finish === fin) && (!eff || (eff === 'none' ? !f.effects.length : f.effects.includes(eff))) && q.every((w) => b._text.includes(w));
      b.hidden = !ok;
      if (ok) n++;
    }
    count.textContent = n ? `${n} référence${n > 1 ? 's' : ''} ${ranges.map((r) => `${r.brand}™ Série ${r.range}`).join(', ')}` : 'Aucune référence ne correspond : modifiez la recherche ou les filtres.';
    rove();
  }
  for (const el of [search, familySel.sel, finishSel.sel, effectSel.sel]) el.addEventListener('input', (e) => (e.stopPropagation(), filter()));
  for (const el of [familySel.sel, finishSel.sel, effectSel.sel]) el.addEventListener('change', (e) => e.stopPropagation());
  search.addEventListener('change', (e) => e.stopPropagation());

  // one tab stop for the whole grid; arrows move between references (roving tabindex)
  function rove() {
    const visible = buttons.filter((b) => !b.hidden);
    const keep = visible.find((b) => b.getAttribute('aria-pressed') === 'true') || visible[0];
    for (const b of buttons) b.tabIndex = b === keep ? 0 : -1;
  }
  grid.addEventListener('keydown', (e) => {
    const visible = buttons.filter((b) => !b.hidden);
    const i = visible.indexOf(document.activeElement);
    if (i < 0) return;
    const cols = Math.max(1, visible.filter((b) => b.offsetTop === visible[0].offsetTop).length);
    const to = { ArrowRight: i + 1, ArrowLeft: i - 1, ArrowDown: i + cols, ArrowUp: i - cols, Home: 0, End: visible.length - 1 }[e.key];
    if (to === undefined) return;
    e.preventDefault();
    const b = visible[Math.max(0, Math.min(visible.length - 1, to))];
    for (const x of buttons) x.tabIndex = -1;
    b.tabIndex = 0;
    b.focus();
  });
  grid.addEventListener('click', (e) => {
    const b = e.target.closest('[data-film]');
    if (!b) return;
    const s = read();
    const slot = s.mode === 'complet' ? 'body' : s.target;
    if (s.mode === 'dechromage' || !field(`film-${slot}`)) return;
    field(`film-${slot}`).value = b.dataset.film;
    if (slot !== 'body') field(`zone-${slot}`).checked = true;
    pulseSlot = slot;
    form.dispatchEvent(new Event('change', { bubbles: true }));
  });

  // ---------------------------------------------------------------- summary, quote, link
  const filmText = (f) => `${f.brand}™ Série ${f.range} · ${f.code} · ${f.name} (${f.label.toLowerCase()}) · finition ${FINISHES[f.finish].fem}${f.effects.length ? `, ${f.effects.map((e) => EFFECTS[e].label.toLowerCase()).join(', ')}` : ''}`;
  function summary(s) {
    const lines = [`Type : ${MODE_LABEL[s.mode]}`];
    if (s.mode === 'complet') lines.push(`Carrosserie complète : ${filmText(byId.get(s.film.body))}`);
    if (s.mode === 'partiel') {
      if (s.zonesOn.length) for (const id of s.zonesOn) lines.push(`${zones.find((z) => z.id === id).label} : ${filmText(byId.get(s.film[id]))}`);
      else lines.push('Aucune zone cochée pour le moment');
    }
    lines.push(s.dc.length ? `Déchromage : ${s.dc.map((id) => chrome.find((c) => c.id === id).label).join(', ')} — ${filmText(byId.get(s.film.dechrome))}` : 'Déchromage : non');
    lines.push(`Simulation sur ${cov.label} (véhicule de démonstration). Faisabilité, quantité de film et prix confirmés après étude de votre véhicule.`);
    return lines;
  }
  const summaryEl = $('[data-summary]');
  const statusEl = $('[data-copy-status]');
  let summaryText = '';
  let shareUrl = '';
  async function copy(text, done) {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // older browsers, or a page without clipboard permission
      const t = document.createElement('textarea');
      t.value = text;
      t.setAttribute('readonly', '');
      t.style.position = 'fixed';
      t.style.opacity = '0';
      document.body.append(t);
      t.select();
      const ok = document.execCommand?.('copy');
      t.remove();
      if (!ok) {
        statusEl.textContent = 'La copie automatique n’est pas disponible : sélectionnez le texte du récapitulatif pour le copier.';
        return;
      }
    }
    statusEl.textContent = done;
  }
  section.querySelector('[data-copy="summary"]').addEventListener('click', () => copy(summaryText, 'Récapitulatif copié.'));
  section.querySelector('[data-copy="link"]').addEventListener('click', () => copy(shareUrl, 'Lien de partage copié : il ne contient que les références choisies.'));

  // ---------------------------------------------------------------- panel behaviour
  const panelToggle = $('[data-panel-toggle]');
  const panelBody = $('#cov-panel-body');
  panelToggle?.addEventListener('click', () => {
    const open = panelToggle.getAttribute('aria-expanded') !== 'true';
    panelToggle.setAttribute('aria-expanded', String(open));
    panelBody.hidden = !open;
  });
  // offer cards: « Simuler : covering partiel »… choose the mode
  function pendingMode() {
    const m = section.dataset.pendingMode;
    if (!m) return;
    delete section.dataset.pendingMode;
    if (setRadio('mode', m)) form.dispatchEvent(new Event('change', { bubbles: true }));
  }
  section.addEventListener('sc37:mode', pendingMode);

  let lastMode = read().mode;
  let pulseSlot = null;
  const blocks = [...section.querySelectorAll('[data-block]')];

  // ---------------------------------------------------------------- 3D
  let viewer = null;
  let three = null; // { parts: Map(name -> meshes), orig: Map(mesh -> material), mats }
  let showOrigin = false;
  const originBtn = $('[data-origin]');
  originBtn?.addEventListener('click', () => {
    showOrigin = !showOrigin;
    syncOrigin();
    paint(read());
  });
  function syncOrigin() {
    if (!originBtn) return;
    originBtn.setAttribute('aria-pressed', String(showOrigin));
    originBtn.textContent = showOrigin ? 'Voir ma configuration' : 'Voir l’origine';
  }
  let quality = 'high';

  function update() {
    sanitize();
    let s = read();
    // what happens to the other settings when the type changes: kept, and said so
    if (s.mode !== lastMode) {
      const msgs = [];
      if (s.mode === 'partiel') {
        if (lastMode === 'complet') msgs.push(`Le covering complet (${byId.get(s.film.body).code}) est gardé de côté : en partiel, seules les zones cochées sont habillées. « Complet » le retrouve.`);
        if (!s.zonesOn.length) {
          field(`zone-${zones[0].id}`).checked = true;
          setRadio('target', zones[0].id);
          msgs.push(`${zones[0].label} coché pour commencer : choisissez sa référence dans le nuancier.`);
        }
      } else if (s.mode === 'complet' && lastMode === 'partiel' && s.zonesOn.length) {
        msgs.push(`Vos zones du partiel (${s.zonesOn.map((id) => zones.find((z) => z.id === id).label).join(', ')}) sont gardées de côté : « Partiel » les retrouve.`);
      } else if (s.mode === 'dechromage') {
        msgs.push('Le covering est mis de côté (réglages conservés) : seul le déchromage est montré.');
        if (!s.dc.length) {
          for (const c of chrome) field(`dc-${c.id}`).checked = true;
          msgs.push('Toutes les pièces chromées sont cochées pour commencer.');
        }
      }
      note = msgs.join(' ');
      lastMode = s.mode;
      s = read();
    }
    // the slot the colour chart edits
    if (s.mode === 'complet' && s.target !== 'body') setRadio('target', 'body');
    if (s.mode === 'partiel' && !zones.some((z) => z.id === s.target)) setRadio('target', s.zonesOn[0] || zones[0].id);
    s = read();
    modeNote.textContent = note;
    modeNote.hidden = !note;
    for (const b of blocks) b.hidden = b.dataset.block !== 'dechromage' && b.dataset.block !== s.mode;
    host.hidden = s.mode === 'dechromage';
    for (const z of zones) section.querySelector(`[data-zone="${z.id}"]`)?.classList.toggle('is-off', !s.zonesOn.includes(z.id));
    for (const el of section.querySelectorAll('[data-current]')) {
      const f = byId.get(s.film[el.dataset.current]);
      if (!f) continue;
      el.querySelector('.swatch').style.background = f.preview;
      el.querySelector('strong').textContent = f.code;
      el.querySelector('strong').nextSibling.textContent = ` ${f.label}`;
    }
    // chart: the reference of the slot being edited is pressed (ring + tick, not colour alone)
    const slot = s.mode === 'complet' ? 'body' : s.target;
    const chosen = byId.get(s.film[slot]);
    forEl.textContent = s.mode === 'dechromage' ? '' : `— ${slotLabel(slot)}`;
    for (const b of buttons) b.setAttribute('aria-pressed', String(b.dataset.film === chosen?.id));
    rove();
    if (chosen) {
      card.innerHTML = `<span class="film__chip film__chip--big" data-finish="${chosen.finish}" data-effects="${chosen.effects.join(' ')}" style="--c:${chosen.preview};--f:${chosen.visual.flip || chosen.preview}" aria-hidden="true"></span>
        <div><p class="nuancier__name"><strong>${chosen.brand}™ ${chosen.code}</strong> <span lang="en">${chosen.name}</span></p>
        <p>${chosen.label} · ${FINISHES[chosen.finish].long}${chosen.effects.length ? ` · ${chosen.effects.map((e) => EFFECTS[e].label).join(', ')}` : ''}</p>
        <p class="nuancier__meta">Couleur d’aperçu approximative · <a href="${chosen.source}" rel="noopener" target="_blank">fiche 3M France</a> (vérifiée le ${new Date(chosen.verified + 'T12:00:00Z').toLocaleDateString('fr-FR', { timeZone: 'UTC' })})</p></div>`;
    }
    // summary, quote link, shared link
    const lines = summary(s);
    summaryText = `Covering & déchromage — ma configuration\n${lines.join('\n')}`;
    summaryEl.innerHTML = lines.map((l) => `<p>${l.replace(/&/g, '&amp;').replace(/</g, '&lt;')}</p>`).join('');
    setQuote(section, { prestation: 'covering-dechromage', config: summaryText });
    shareUrl = `${location.origin}${location.pathname}?cfg=${encodeURIComponent(encode(s))}#simulateur`;
    paint(s);
  }

  /** the configuration on the car (or the model's own materials while « Voir l'origine ») */
  function paint(s) {
    if (!three) return;
    const { parts, orig, mats } = three;
    for (const [mesh, m] of orig) mesh.material = m;
    if (!showOrigin) {
      const put = (names, mat) => names.forEach((n) => parts.get(n)?.forEach((mesh) => (mesh.material = mat)));
      if (s.mode === 'complet') {
        applyFilm(mats.body, byId.get(s.film.body));
        put(cov.body, mats.body);
      }
      if (s.mode === 'partiel')
        for (const z of zones)
          if (s.zonesOn.includes(z.id)) {
            applyFilm(mats[z.id], byId.get(s.film[z.id]));
            put(z.parts, mats[z.id]);
          }
      applyFilm(mats.dechrome, byId.get(s.film.dechrome));
      for (const c of chrome) if (s.dc.includes(c.id)) put(c.parts, mats.dechrome);
    }
    if (pulseSlot && !showOrigin && !reduceMotion) pulse(mats[pulseSlot]);
    pulseSlot = null;
    viewer.invalidate();
  }
  // a discreet golden breath on the zone just changed
  function pulse(m) {
    if (!m || m === three.mats.body) return;
    // wall-clock time: the same short breath on a slow device
    const t0 = performance.now();
    const off = viewer.addTicker(() => {
      const k = Math.min(1, (performance.now() - t0) / 900);
      m.userData.cov.uHi.value = Math.sin(Math.PI * k) * 0.6;
      if (k >= 1) off();
      return k < 1;
    });
  }

  form.addEventListener('change', (e) => {
    if (!viewer) return;
    const t = e.target;
    // follow the edit with the camera: roof from above, spoiler from the back, chrome up front
    const zone = zones.find((z) => t.name === `zone-${z.id}` || (t.name === 'target' && t.value === z.id));
    const dc = chrome.find((c) => t.name === `dc-${c.id}`);
    if (zone && (t.checked || t.name === 'target')) view(zone.view);
    else if (dc && t.checked) view(dc.view);
    if (t.name === 'target' && zone) pulseSlot = zone.id;
  });

  return {
    mode: 'showroom',
    car: 'suv',
    initialView: '34avant',
    reducedMotionOk: true,
    // no parked cars here (fewer downloads), a lighter pixel ratio on phones
    viewer: ({ mobile, weak }) => {
      quality = mobile || weak ? 'low' : 'high';
      return { parked: false, maxDpr: mobile ? 1 : 1.5 };
    },
    update,
    reset() {
      for (const f of form.querySelectorAll('input[type="hidden"][name^="film-"]')) f.value = f.dataset.default;
      setRadio('mode', 'complet');
      setRadio('target', 'body');
      lastMode = 'complet';
      note = '';
      statusEl.textContent = '';
      search.value = '';
      familySel.sel.value = finishSel.sel.value = effectSel.sel.value = '';
      filter();
      showOrigin = false;
      syncOrigin();
      if (shared) history.replaceState(null, '', location.pathname + location.hash);
      if (viewer) view('34avant');
    },
    async attach(v) {
      viewer = v;
      const entry = await v.setVehicle('suv');
      if (!entry) return;
      three = build(v, quality, cov, zones);
      // a control must change something: zones or parts missing from the model are disabled
      for (const z of zones) if (!z.parts.every((n) => three.parts.has(n))) disable(`zone-${z.id}`);
      for (const c of chrome) if (!c.parts.every((n) => three.parts.has(n))) disable(`dc-${c.id}`);
      if (originBtn) originBtn.hidden = false;
      update();
      pendingMode();
    },
    detach() {
      three = null;
      viewer = null;
      if (originBtn) originBtn.hidden = true;
    },
    films,
  };

  function disable(name) {
    const el = field(name);
    if (!el) return;
    el.checked = false;
    el.disabled = true;
    el.closest('label')?.append(' (indisponible sur ce modèle)');
  }
}

// ------------------------------------------------------------------ materials
/**
 * One material per slot. High quality: MeshPhysicalMaterial (clearcoat for gloss films); weak
 * devices and phones: MeshStandardMaterial. A single shader serves every film: flip colour,
 * carbon weave and highlight are uniforms, the clearcoat never drops to 0 (that would switch
 * shader variant).
 */
function makeMaterial(physical) {
  const m = physical ? new THREE.MeshPhysicalMaterial({ clearcoat: 1, clearcoatRoughness: 0.06 }) : new THREE.MeshStandardMaterial();
  m.envMapIntensity = 1.15;
  const u = { uFlip: { value: 0 }, uFlipCol: { value: new THREE.Color() }, uCarbon: { value: 0 }, uHi: { value: 0 } };
  m.userData.cov = u;
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, u);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vCovPos;\nvarying vec3 vCovN;')
      .replace('#include <project_vertex>', '#include <project_vertex>\nvCovPos = (modelMatrix * vec4(transformed, 1.0)).xyz;\nvCovN = normalize(mat3(modelMatrix) * objectNormal);');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform float uFlip;\nuniform vec3 uFlipCol;\nuniform float uCarbon;\nuniform float uHi;\nvarying vec3 vCovPos;\nvarying vec3 vCovN;')
      .replace(
        '#include <emissivemap_fragment>',
        `#include <emissivemap_fragment>
        // colour-shift films: the second colour shows at grazing angles
        float covFacing = clamp(dot(normal, normalize(vViewPosition)), 0.0, 1.0);
        diffuseColor.rgb = mix(diffuseColor.rgb, uFlipCol, uFlip * smoothstep(0.95, 0.15, covFacing));
        // carbon weave, projected on the dominant axis (no texture, no UV needed)
        if (uCarbon > 0.0) {
          vec3 an = abs(vCovN);
          vec2 p = (an.x > an.y && an.x > an.z ? vCovPos.zy : (an.y > an.z ? vCovPos.xz : vCovPos.xy)) * 95.0;
          vec2 g = floor(p);
          vec2 f = fract(p);
          float s = mod(g.x + g.y, 2.0) < 1.0 ? f.x : f.y;
          float weave = 0.58 + 0.42 * sin(s * 3.14159);
          diffuseColor.rgb *= mix(1.0, weave, uCarbon);
          roughnessFactor = mix(roughnessFactor, roughnessFactor * (0.7 + 0.6 * (1.0 - weave)), uCarbon);
        }
        totalEmissiveRadiance += vec3(0.95, 0.72, 0.32) * uHi * 0.22;`
      );
  };
  m.customProgramCacheKey = () => (physical ? 'cov-film-p' : 'cov-film-s');
  return m;
}

function applyFilm(m, f) {
  if (!m || !f) return;
  const fin = FINISHES[f.finish] || FINISHES.gloss;
  let metal = 0;
  for (const e of f.effects) metal = Math.max(metal, EFFECTS[e]?.metalness || 0);
  if (f.visual.metal != null) metal = f.visual.metal;
  m.color.set(f.preview); // sRGB hex, converted to the renderer's linear space by three.js
  m.metalness = metal;
  m.roughness = metal ? Math.max(0.05, fin.roughness - 0.04) : fin.roughness;
  if (m.isMeshPhysicalMaterial) {
    m.clearcoat = Math.max(0.01, fin.clearcoat);
    m.clearcoatRoughness = fin.clearcoatRoughness;
  }
  const u = m.userData.cov;
  u.uFlip.value = f.visual.flipAmount || 0;
  u.uFlipCol.value.set(f.visual.flip || f.preview);
  u.uCarbon.value = f.effects.includes('carbon') ? 1 : 0;
}

function build(viewer, quality, cov, zones) {
  const names = new Set([...cov.body, ...zones.flatMap((z) => z.parts), ...cov.chrome.flatMap((c) => c.parts)]);
  const parts = new Map();
  const orig = new Map();
  // the car and its floor reflection (a clone sharing the model's materials)
  for (const g of [viewer.car.group, viewer.mirror].filter(Boolean)) {
    g.traverse((o) => {
      if (!o.isMesh || !names.has(o.name)) return;
      if (!parts.has(o.name)) parts.set(o.name, []);
      parts.get(o.name).push(o);
      orig.set(o, o.material);
    });
  }
  const physical = quality === 'high';
  const mats = { body: makeMaterial(physical), dechrome: makeMaterial(physical) };
  for (const z of zones) mats[z.id] = makeMaterial(physical);
  // compile the film shader now, so the first choice does not stall
  const scene = viewer.car.group.parent;
  const probe = parts.get(cov.body[0])?.[0];
  if (scene && probe) {
    probe.material = mats.body;
    try {
      viewer.renderer.compile(scene, viewer.camera);
    } catch {
      /* compiled on first use instead */
    }
    probe.material = orig.get(probe);
  }
  return { parts, orig, mats };
}
