/**
 * The statistics page of the site (GET /stats?cle=…&periode=30&site=site), rendered by the booking
 * server from the Stats database (booking/stats.js). Read-only, protected by the STATS_KEY secret,
 * never indexed, no script at all (hover details are pure CSS, every figure is also in a table).
 */
import { utcToZoned, addDays } from './schedule.js';
import { report, ACTIONS, SOURCES, TZ } from './stats.js';
import { oldSite } from '../content/stats.js';

/** the periods offered; `days` counted back from today (today included) */
export const PERIODS = {
  7: { days: 7, label: '7 jours', unit: 'day', per: 'par jour' },
  30: { days: 30, label: '30 jours', unit: 'day', per: 'par jour' },
  90: { days: 91, label: '3 mois', unit: 'week', per: 'par semaine' },
  365: { days: 365, label: '12 mois', unit: 'month', per: 'par mois' },
};

// ------------------------------------------------------------------ formatting
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const nf = (v) => new Intl.NumberFormat('fr-FR').format(v);
const n1 = (v) => new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 1 }).format(v);
const n2 = (v) => new Intl.NumberFormat('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v);
const pct = (v) => `${new Intl.NumberFormat('fr-FR', { maximumFractionDigits: v < 10 ? 1 : 0 }).format(v)} %`;
const eur = (v) => new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(v);
const date = (s, o) => new Intl.DateTimeFormat('fr-FR', { timeZone: 'UTC', ...o }).format(new Date(`${s}T12:00:00Z`));
const longDay = (s) => date(s, { day: 'numeric', month: 'long', year: 'numeric' });
const shortDay = (s) => date(s, { day: 'numeric', month: 'short' });
const daysBetween = (a, b) => Math.round((Date.parse(`${b}T12:00:00Z`) - Date.parse(`${a}T12:00:00Z`)) / 86400000) + 1;
const plural = (n, one, many) => `${nf(n)} ${n > 1 ? many : one}`;
const pageName = (p) => (p === '/' ? 'Accueil' : p);

/** constant-time comparison of the key */
function sameKey(a, b) {
  if (!a || !b || a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}

const HEADERS = {
  'content-type': 'text/html; charset=utf-8',
  'cache-control': 'no-store',
  'content-security-policy': "default-src 'none'; style-src 'unsafe-inline'; img-src data:; base-uri 'none'; form-action 'none'; frame-ancestors 'none'",
  'x-robots-tag': 'noindex, nofollow',
  'referrer-policy': 'no-referrer',
  'x-content-type-options': 'nosniff',
};
const respond = (body, status = 200) => new Response(body, { status, headers: HEADERS });

export async function statsPage(req, env, url, now) {
  if (!env.STATS || !sameKey(url.searchParams.get('cle') || '', env.STATS_KEY || '')) {
    return respond(shell('Statistiques', '<main class="wrap"><h1>Statistiques</h1><p>Lien incomplet ou clé incorrecte : ouvrez l’adresse complète qui vous a été donnée.</p></main>'), 403);
  }
  const per = PERIODS[url.searchParams.get('periode')] ? url.searchParams.get('periode') : '30';
  const site = url.searchParams.get('site') === 'apercu' ? 'apercu' : 'site';
  const P = PERIODS[per];
  const to = utcToZoned(now, TZ).date;
  const from = addDays(to, -(P.days - 1));
  const pto = addDays(from, -1);
  const pfrom = addDays(pto, -(P.days - 1));
  const r = await report(env, { site, from, to, pfrom, pto });
  return respond(render({ r, env, key: url.searchParams.get('cle'), per, site, from, to, pfrom, pto, now }));
}

// ------------------------------------------------------------------ figures
function sum(rows) {
  const o = { views: 0, visits: 0, paid: 0 };
  for (const k of Object.keys(ACTIONS)) o[k] = 0;
  for (const x of rows) {
    if (x.kind === 'page') {
      o.views = x.n;
      o.visits = x.visits || 0;
    } else if (x.kind in ACTIONS) {
      o[x.kind] = x.n;
      if (x.kind === 'rdv') o.paid = x.value || 0;
    }
  }
  o.contacts = o.demande_envoyee + o.rdv + o.appel + o.email;
  return o;
}

/** visits and page views per day, week (7 days ending today) or calendar month */
function buckets(days, from, to, unit) {
  const m = new Map(days.map((x) => [x.day, x]));
  const out = [];
  const add = (a, b, label, tip) => {
    let visits = 0;
    let views = 0;
    for (let d = a; d <= b; d = addDays(d, 1)) {
      visits += m.get(d)?.visits || 0;
      views += m.get(d)?.views || 0;
    }
    out.push({ from: a, to: b, visits, views, label, tip });
  };
  if (unit === 'day') {
    for (let d = from; d <= to; d = addDays(d, 1)) add(d, d, daysBetween(from, to) <= 7 ? date(d, { weekday: 'short', day: 'numeric' }) : shortDay(d), date(d, { weekday: 'long', day: 'numeric', month: 'long' }));
  } else if (unit === 'week') {
    for (let d = from; d <= to; d = addDays(d, 7)) {
      const e = addDays(d, 6) < to ? addDays(d, 6) : to;
      add(d, e, shortDay(d), `du ${shortDay(d)} au ${shortDay(e)}`);
    }
  } else {
    let d = from;
    while (d <= to) {
      const month = d.slice(0, 7);
      let e = d;
      while (addDays(e, 1) <= to && addDays(e, 1).slice(0, 7) === month) e = addDays(e, 1);
      const whole = d.endsWith('-01') && (addDays(e, 1).slice(0, 7) !== month);
      add(d, e, date(d, { month: 'short' }), whole ? date(d, { month: 'long', year: 'numeric' }) : `du ${shortDay(d)} au ${shortDay(e)}`);
      d = addDays(e, 1);
    }
  }
  return out;
}

/** a round top for the axis: 4, 5, 10, 20, 25, 50… */
function niceMax(v) {
  if (v <= 4) return 4;
  const p = 10 ** Math.floor(Math.log10(v));
  return [1, 1.2, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10].map((f) => f * p).find((x) => x >= v);
}

// ------------------------------------------------------------------ pieces
function delta(cur, prev, show) {
  if (!show || !prev) return '';
  const p = Math.round(((cur - prev) / prev) * 100);
  if (p === 0) return '<span class="delta">stable</span>';
  const up = p > 0;
  return `<span class="delta ${up ? 'up' : 'down'}"><span aria-hidden="true">${up ? '▲' : '▼'}</span> ${up ? '+' : '−'}${nf(Math.abs(p))} %<span class="sr"> par rapport à la période précédente</span></span>`;
}

const tile = (label, value, { d = '', sub = '', cls = '' } = {}) =>
  `<div class="tile ${cls}"><p class="tile__label">${esc(label)}</p><p class="tile__value">${value}</p>${d || sub ? `<p class="tile__foot">${d}${sub ? `<span class="tile__sub">${sub}</span>` : ''}</p>` : ''}</div>`;

function columns(bs, unit) {
  const max = Math.max(0, ...bs.map((b) => b.visits));
  const top = niceMax(max);
  const n = bs.length;
  const k = Math.ceil(n / 7);
  const peak = max > 0 ? bs.map((b) => b.visits).lastIndexOf(max) : -1;
  const ticks = [top, top / 2, 0].filter((t) => Number.isInteger(t));
  const bars = bs
    .map((b, i) => {
      const h = (b.visits / top) * 100;
      const tip = `${plural(b.visits, 'visite', 'visites')} · ${plural(b.views, 'page vue', 'pages vues')} — ${b.tip}`;
      return `<div class="col" tabindex="0" role="img" aria-label="${esc(tip)}" data-tip="${esc(tip)}" style="--h:${h.toFixed(2)}%;--x:${(((i + 0.5) / n) * 100).toFixed(2)}%"><i></i>${i === peak ? `<b class="col__v">${nf(b.visits)}</b>` : ''}</div>`;
    })
    .join('');
  const xs = bs.map((b, i) => `<span>${(n - 1 - i) % k === 0 ? esc(b.label) : ''}</span>`).join('');
  const rows = bs.map((b) => `<tr><th scope="row">${esc(b.tip)}</th><td>${nf(b.visits)}</td><td>${nf(b.views)}</td></tr>`).join('');
  return `<div class="cols" style="--n:${n}">
      <div class="cols__plot">
        ${ticks.map((t) => `<span class="cols__tick" style="--y:${(t / top) * 100}%"><span>${nf(t)}</span></span>`).join('')}
        <div class="cols__bars">${bars}</div>
      </div>
      <div class="cols__x" aria-hidden="true">${xs}</div>
    </div>
    <details class="table-view"><summary>Voir les chiffres</summary><table><thead><tr><th scope="col">${unit === 'day' ? 'Jour' : unit === 'week' ? 'Semaine' : 'Mois'}</th><th scope="col">Visites</th><th scope="col">Pages vues</th></tr></thead><tbody>${rows}</tbody></table></details>`;
}

function sourcesBlock(r, visits) {
  const by = Object.fromEntries(r.sources.map((s) => [s.source, s.n]));
  const list = Object.keys(SOURCES)
    .map((k) => ({ k, n: by[k] || 0 }))
    .sort((a, b) => b.n - a.n);
  const max = Math.max(1, ...list.map((s) => s.n));
  const bars = list
    .map((s) => `<li><span class="hbar__name">${esc(SOURCES[s.k])}</span><span class="hbar__track"><i style="--w:${((s.n / max) * 100).toFixed(2)}%"></i></span><span class="hbar__val">${visits ? pct((s.n / visits) * 100) : '—'} <small>(${nf(s.n)})</small></span></li>`)
    .join('');
  const refs = r.refs.length
    ? `<table class="list"><caption>Sites qui envoient des visiteurs</caption><thead><tr><th scope="col">Site</th><th scope="col">Type</th><th scope="col" class="n">Visites</th></tr></thead><tbody>${r.refs.map((x) => `<tr><td>${esc(x.ref)}</td><td>${esc(SOURCES[x.source] || '')}</td><td class="n">${nf(x.n)}</td></tr>`).join('')}</tbody></table>`
    : '';
  return `<ul class="hbars">${bars}</ul>${refs}`;
}

function devicesBlock(r, visits) {
  const by = Object.fromEntries(r.devices.map((x) => [x.device, x.visits || 0]));
  const parts = [
    { k: 'telephone', name: 'Téléphone', n: by.telephone || 0 },
    { k: 'ordinateur', name: 'Ordinateur ou tablette', n: by.ordinateur || 0 },
  ];
  const total = parts[0].n + parts[1].n;
  if (!total) return '<p class="muted">Pas encore de visite sur cette période.</p>';
  const seg = parts
    .filter((p) => p.n)
    .map((p) => `<i class="seg__${p.k}" style="--w:${((p.n / total) * 100).toFixed(2)}%"></i>`)
    .join('');
  const legend = parts.map((p) => `<li><span class="swatch seg__${p.k}" aria-hidden="true"></span>${esc(p.name)} <strong>${pct((p.n / total) * 100)}</strong> <small>(${nf(p.n)})</small></li>`).join('');
  return `<div class="seg" role="img" aria-label="${esc(parts.map((p) => `${p.name} : ${pct((p.n / total) * 100)}`).join(', '))}">${seg}</div><ul class="legend">${legend}</ul>`;
}

function pagesBlock(r) {
  if (!r.pages.length) return '<p class="muted">Pas encore de page vue sur cette période.</p>';
  return `<table class="list"><thead><tr><th scope="col">Page</th><th scope="col" class="n">Vues</th><th scope="col" class="n">Arrivées</th></tr></thead><tbody>${r.pages.map((p) => `<tr><td>${esc(pageName(p.page))}</td><td class="n">${nf(p.views)}</td><td class="n">${nf(p.entries || 0)}</td></tr>`).join('')}</tbody></table>
  <p class="note">Arrivées : visites qui ont commencé sur cette page.</p>`;
}

function actionsBlock(r) {
  const rows = r.actions.filter((a) => a.kind !== 'demande_erreur').slice(0, 15);
  if (!rows.length) return '<p class="muted">Aucune action sur cette période.</p>';
  return `<table class="list"><thead><tr><th scope="col">Action</th><th scope="col">Depuis la page</th><th scope="col" class="n">Nombre</th></tr></thead><tbody>${rows.map((a) => `<tr><td>${esc(ACTIONS[a.kind] || a.kind)}</td><td>${esc(pageName(a.page))}</td><td class="n">${nf(a.n)}</td></tr>`).join('')}</tbody></table>`;
}

function bookingsBlock(r) {
  if (!r.bookings.length) return '';
  return `<section class="card"><h2>RDV réservés en ligne</h2><table class="list"><thead><tr><th scope="col">Prestations</th><th scope="col" class="n">RDV</th><th scope="col" class="n">Payé en ligne</th></tr></thead><tbody>${r.bookings.map((b) => `<tr><td>${esc(b.detail)}</td><td class="n">${nf(b.n)}</td><td class="n">${eur(b.value || 0)}</td></tr>`).join('')}</tbody></table></section>`;
}

/** per-day averages, side by side with the old site (local.fr) */
function comparison(cur, r, from, to, visits) {
  const start = r.first && r.first > from ? r.first : from;
  const span = r.first ? daysBetween(start, to) : 0;
  const oldDays = daysBetween(oldSite.from, oldSite.to);
  const search = visits ? pct(((Object.fromEntries(r.sources.map((s) => [s.source, s.n])).moteurs || 0) / visits) * 100) : '—';
  const row = (label, a, b) => `<tr><th scope="row">${label}</th><td class="n">${a}</td><td class="n">${b}</td></tr>`;
  return `<table class="list compare"><thead><tr><th scope="col"></th><th scope="col" class="n">${esc(oldSite.label)}<br><small>du ${shortDay(oldSite.from)} au ${longDay(oldSite.to)}</small></th><th scope="col" class="n">Nouveau site<br><small>${span ? plural(span, 'jour compté', 'jours comptés') : 'pas encore de données'}</small></th></tr></thead><tbody>
    ${row('Visites par jour', `${n1(oldSite.visitors / oldDays)} <small>(visiteurs uniques)</small>`, span ? n1(cur.visits / span) : '—')}
    ${row('Pages vues par jour', n1(oldSite.pageViews / oldDays), span ? n1(cur.views / span) : '—')}
    ${row('Pages par visite', n2(oldSite.pageViews / oldSite.visitors), cur.visits ? n2(cur.views / cur.visits) : '—')}
    ${row('Arrivées par un moteur de recherche', esc(oldSite.searchShare), search)}
    ${row('Demandes et RDV par jour', '<small>inconnu (compteur de messages faussé par le spam)</small>', span ? n1((cur.demande_envoyee + cur.rdv) / span) : '—')}
  </tbody></table>
  <p class="note">Les deux outils ne comptent pas exactement de la même façon : comparez les ordres de grandeur, et surtout le nombre de vraies demandes.</p>`;
}

// ------------------------------------------------------------------ page
function render({ r, env, key, per, site, from, to, pfrom, pto, now }) {
  const P = PERIODS[per];
  const cur = sum(r.totals);
  const prev = sum(r.previous);
  const compare = !!r.first && r.first <= pfrom;
  const link = (o) => `?${new URLSearchParams({ cle: key, periode: per, site, ...o })}`;
  const seg = (items, current, param) =>
    items.map(([v, label]) => `<a href="${esc(link({ [param]: v }))}"${v === current ? ' aria-current="page"' : ''}>${esc(label)}</a>`).join('');
  const time = new Intl.DateTimeFormat('fr-FR', { timeZone: TZ, hour: 'numeric', minute: '2-digit' }).format(new Date(now)).replace(':', ' h ');
  const siteUrl = String(env.SITE_URL || '').replace(/\/$/, '');
  const bs = buckets(r.days, from, to, P.unit);
  const pagesPerVisit = cur.visits ? n2(cur.views / cur.visits) : '—';
  const rate = cur.visits ? pct((cur.contacts / cur.visits) * 100) : '—';
  const prevRate = prev.visits ? (prev.contacts / prev.visits) * 100 : 0;
  const curRate = cur.visits ? (cur.contacts / cur.visits) * 100 : 0;
  const secondary = ['clic_devis', 'devis_simulateur', 'simulateur_3d', 'email', 'itineraire', 'demande_erreur']
    .filter((k) => k !== 'demande_erreur' || cur[k])
    .map((k) => `<li><span>${esc(ACTIONS[k])}</span><strong>${nf(cur[k])}</strong>${delta(cur[k], prev[k], compare)}</li>`)
    .join('');
  const scope = compare
    ? `Comparé aux ${esc(P.label)} précédents (du ${shortDay(pfrom)} au ${shortDay(pto)}).`
    : r.first
      ? `Comptage commencé le ${longDay(r.first)} : la comparaison avec la période précédente viendra ensuite.`
      : 'Le comptage démarre à la première visite.';

  const body = `
<header class="top">
  <div class="wrap">
    <p class="brand"><span class="brand__dot" aria-hidden="true"></span>SOLAR CAR 37</p>
    <h1>Statistiques du site</h1>
    <p class="muted">${site === 'apercu' ? 'Aperçu et essais (pas les vrais visiteurs)' : 'Site public'} · du ${shortDay(from)} au ${longDay(to)} · mis à jour à ${esc(time)}</p>
  </div>
</header>
<main class="wrap">
  <nav class="filters" aria-label="Période et site">
    <div class="segctl">${seg(Object.entries(PERIODS).map(([k, v]) => [k, v.label]), per, 'periode')}</div>
    <div class="segctl">${seg([['site', 'Site public'], ['apercu', 'Aperçu']], site, 'site')}</div>
  </nav>
  <p class="scope">${scope}</p>

  <section class="hero card" aria-label="Visites">
    <p class="tile__label">Visites</p>
    <p class="hero__value">${nf(cur.visits)}</p>
    <p class="tile__foot">${delta(cur.visits, prev.visits, compare)}<span class="tile__sub">${P.days > 7 && r.first ? `${n1(cur.visits / daysBetween(r.first > from ? r.first : from, to))} par jour en moyenne` : ''}</span></p>
  </section>

  <section class="tiles" aria-label="Chiffres clés">
    ${tile('Pages vues', nf(cur.views), { d: delta(cur.views, prev.views, compare) })}
    ${tile('Pages par visite', pagesPerVisit)}
    ${tile('Demandes envoyées', nf(cur.demande_envoyee), { d: delta(cur.demande_envoyee, prev.demande_envoyee, compare), sub: 'formulaire de contact' })}
    ${tile('RDV réservés en ligne', nf(cur.rdv), { d: delta(cur.rdv, prev.rdv, compare), sub: cur.rdv ? `${eur(cur.paid)} payés en ligne` : '' })}
    ${tile('Appels', nf(cur.appel), { d: delta(cur.appel, prev.appel, compare), sub: 'clics sur le numéro' })}
    ${tile('Taux de contact', rate, { d: compare && prevRate ? delta(curRate, prevRate, true) : '', sub: 'demandes, RDV, appels et e-mails pour 100 visites' })}
  </section>

  <section class="card">
    <h2>Visites ${esc(P.per)}</h2>
    ${columns(bs, P.unit)}
  </section>

  <div class="grid2">
    <section class="card">
      <h2>D’où viennent les visiteurs</h2>
      ${sourcesBlock(r, cur.visits)}
    </section>
    <section class="card">
      <h2>Autres actions</h2>
      <ul class="kv">${secondary}</ul>
      <h2 class="h2--spaced">Appareils</h2>
      ${devicesBlock(r, cur.visits)}
    </section>
  </div>

  <div class="grid2">
    <section class="card">
      <h2>Pages les plus vues</h2>
      ${pagesBlock(r)}
    </section>
    <section class="card">
      <h2>Contacts : depuis quelles pages</h2>
      ${actionsBlock(r)}
    </section>
  </div>

  ${bookingsBlock(r)}

  <section class="card">
    <h2>Par rapport à l’ancien site</h2>
    ${comparison(cur, r, from, to, cur.visits)}
  </section>

  <section class="notes">
    <h2>Comment c’est compté</h2>
    <ul>
      <li>Sans cookie et sans rien enregistrer sur l’appareil des visiteurs : ni adresse IP ni identifiant ne sont gardés. Une <strong>visite</strong> = une arrivée sur le site depuis l’extérieur (moteur de recherche, réseau social, autre site, application, adresse tapée).</li>
      <li>Les robots et les outils de test ne sont pas comptés. Les RDV sont comptés par le serveur au moment du paiement.</li>
      ${siteUrl ? `<li><strong>Vos propres visites</strong> : ouvrez <a href="${esc(siteUrl)}/?stats=off">${esc(siteUrl.replace(/^https?:\/\//, ''))}/?stats=off</a> une fois sur chacun de vos appareils (téléphone, ordinateur) pour ne plus être compté.</li>` : ''}
      <li>« Fiche Google » : visiteurs venus par le bouton « Site web » de la fiche Google, si son lien se termine par <code>?utm_source=fiche-google</code>.</li>
      <li>Les données sont effacées au bout de 25 mois.</li>
    </ul>
  </section>
</main>`;
  return shell('Statistiques — SOLAR CAR 37', body);
}

function shell(title, body) {
  return `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<meta name="referrer" content="no-referrer">
<link rel="icon" href="data:,">
<title>${esc(title)}</title>
<style>${CSS}</style>
</head>
<body>
${body}
</body>
</html>
`;
}

const CSS = `
:root{color-scheme:light;--page:#f9f9f7;--surface:#fcfcfb;--ink:#0b0b0b;--ink-2:#52514e;--muted:#6f6d68;--grid:#e1e0d9;--axis:#c3c2b7;--border:rgba(11,11,11,.10);--s1:#2a78d6;--s2:#eb6834;--up:#006300;--down:#b42318;--accent:#e8a33d;--tip:#0b0b0b;--tip-ink:#fcfcfb}
@media (prefers-color-scheme:dark){:root{color-scheme:dark;--page:#0d0d0d;--surface:#1a1a19;--ink:#f0efec;--ink-2:#c3c2b7;--muted:#9c9a93;--grid:#2c2c2a;--axis:#383835;--border:rgba(255,255,255,.10);--s1:#3987e5;--s2:#d95926;--up:#0ca30c;--down:#f07a7a;--tip:#f0efec;--tip-ink:#1a1a19}}
*{box-sizing:border-box}
body{margin:0;background:var(--page);color:var(--ink);font:16px/1.5 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;-webkit-text-size-adjust:100%}
a{color:inherit}
.wrap{max-width:1080px;margin:0 auto;padding:0 16px}
.top{padding:24px 0 8px}
.brand{margin:0;font-size:13px;font-weight:600;letter-spacing:.08em;color:var(--ink-2);display:flex;align-items:center;gap:8px}
.brand__dot{width:10px;height:10px;border-radius:50%;background:var(--accent)}
h1{font-size:26px;line-height:1.2;margin:4px 0 4px}
h2{font-size:16px;margin:0 0 14px}
.h2--spaced{margin-top:24px}
.muted{color:var(--ink-2);margin:0}
.filters{display:flex;flex-wrap:wrap;gap:8px 12px;margin:16px 0 8px}
.segctl{display:inline-flex;background:var(--surface);border:1px solid var(--border);border-radius:10px;padding:3px;overflow-x:auto;max-width:100%}
.segctl a{padding:6px 12px;border-radius:7px;text-decoration:none;font-size:14px;color:var(--ink-2);white-space:nowrap}
.segctl a[aria-current]{background:var(--ink);color:var(--surface);font-weight:600}
.segctl a:focus-visible{outline:2px solid var(--s1);outline-offset:1px}
.scope{font-size:14px;color:var(--ink-2);margin:0 0 16px}
.card{background:var(--surface);border:1px solid var(--border);border-radius:14px;padding:18px;margin:0 0 16px;min-width:0}
.hero__value{font-size:56px;line-height:1.05;font-weight:650;margin:2px 0 6px}
.tiles{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:12px;margin:0 0 16px}
.tile{background:var(--surface);border:1px solid var(--border);border-radius:14px;padding:14px 16px}
.tile__label{margin:0;font-size:14px;color:var(--ink-2)}
.tile__value{margin:2px 0 0;font-size:30px;font-weight:650;line-height:1.2}
.tile__foot{margin:4px 0 0;font-size:13px;color:var(--ink-2);display:flex;flex-wrap:wrap;gap:2px 8px}
.tile__sub{color:var(--muted)}
.delta{font-weight:600;white-space:nowrap}
.delta.up{color:var(--up)}
.delta.down{color:var(--down)}
.sr{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}
.grid2{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,420px),1fr));gap:0 16px}
/* columns: visits per day / week / month */
.cols{--yw:34px}
.cols__plot{position:relative;height:190px;margin:22px 0 0 var(--yw)}
.cols__tick{position:absolute;left:0;right:0;bottom:var(--y);border-top:1px solid var(--grid)}
.cols__tick:last-of-type{border-top-color:var(--axis)}
.cols__tick span{position:absolute;right:calc(100% + 8px);top:-9px;font-size:12px;color:var(--muted);font-variant-numeric:tabular-nums}
.cols__bars{position:absolute;inset:0;display:grid;grid-template-columns:repeat(var(--n),1fr);gap:2px}
.col{display:flex;align-items:flex-end;justify-content:center;height:100%;outline:none;cursor:default}
.col i{display:block;width:min(24px,100%);height:var(--h);background:var(--s1);border-radius:4px 4px 0 0;transition:filter .15s}
.col:hover i,.col:focus-visible i{filter:brightness(1.25)}
.col:focus-visible{box-shadow:inset 0 0 0 2px var(--s1);border-radius:4px}
.col__v{position:absolute;left:var(--x);transform:translateX(-50%);bottom:calc(var(--h) + 4px);font-size:12px;font-weight:600;color:var(--ink);font-variant-numeric:tabular-nums}
.col::after{content:attr(data-tip);display:none;position:absolute;bottom:calc(var(--h) + 24px);left:clamp(0px,calc(var(--x) - 110px),calc(100% - 220px));width:220px;background:var(--tip);color:var(--tip-ink);font-size:13px;line-height:1.35;padding:6px 9px;border-radius:7px;text-align:center;pointer-events:none;z-index:2}
.col:hover::after,.col:focus::after{display:block}
.cols__x{display:grid;grid-template-columns:repeat(var(--n),1fr);gap:2px;margin:6px 0 0 var(--yw);font-size:12px;color:var(--muted)}
.cols__x span{white-space:nowrap;text-align:center;overflow:visible;display:flex;justify-content:center}
.table-view{margin-top:14px;font-size:14px}
.table-view summary{cursor:pointer;color:var(--ink-2)}
/* horizontal bars: traffic sources */
.hbars{list-style:none;margin:0 0 8px;padding:0;display:grid;gap:12px}
.hbars li{display:grid;grid-template-columns:minmax(0,1fr) auto;grid-template-areas:"name val" "track track";gap:4px 12px;font-size:14px}
.hbar__name{grid-area:name}
.hbar__val{grid-area:val;font-weight:600;font-variant-numeric:tabular-nums}
.hbar__val small{font-weight:400;color:var(--muted)}
.hbar__track{grid-area:track;height:12px;border-left:1px solid var(--axis)}
.hbar__track i{display:block;height:100%;width:var(--w);background:var(--s1);border-radius:0 4px 4px 0}
/* segmented bar: devices */
.seg{display:flex;gap:2px;height:8px}
.seg i{display:block;width:var(--w);border-radius:4px}
.seg__telephone{background:var(--s1)}
.seg__ordinateur{background:var(--s2)}
.legend{list-style:none;margin:10px 0 0;padding:0;display:flex;flex-wrap:wrap;gap:6px 18px;font-size:14px}
.legend small{color:var(--muted)}
.swatch{display:inline-block;width:10px;height:10px;border-radius:3px;margin-right:6px;vertical-align:baseline}
.kv{list-style:none;margin:0;padding:0}
.kv li{display:flex;align-items:baseline;gap:10px;padding:7px 0;border-bottom:1px solid var(--grid);font-size:14px}
.kv li span:first-child{flex:1}
.kv strong{font-variant-numeric:tabular-nums}
.kv .delta{font-size:12px}
table{border-collapse:collapse;width:100%}
.list{font-size:14px;margin-top:6px}
.list caption{text-align:left;font-weight:600;padding:10px 0 4px}
.list th,.list td{text-align:left;padding:7px 8px 7px 0;border-bottom:1px solid var(--grid);vertical-align:top}
.list thead th{font-weight:500;color:var(--ink-2)}
.list .n{text-align:right;font-variant-numeric:tabular-nums;white-space:nowrap}
.list td{overflow-wrap:anywhere}
.list small{color:var(--muted);font-weight:400}
.compare th[scope=row]{font-weight:500}
.compare .n{white-space:normal}
.table-view table th,.table-view table td{text-align:left;padding:5px 8px 5px 0;border-bottom:1px solid var(--grid);font-variant-numeric:tabular-nums}
.note{font-size:13px;color:var(--muted);margin:10px 0 0}
.notes{font-size:14px;color:var(--ink-2);padding:8px 0 32px}
.notes ul{padding-left:18px;margin:0}
.notes li{margin:0 0 6px}
code{font-size:13px;background:var(--grid);padding:1px 5px;border-radius:5px;word-break:break-all}
@media (max-width:520px){.hero__value{font-size:48px}.tile__value{font-size:26px}.tiles{grid-template-columns:1fr 1fr}.card{padding:16px}}
@media (prefers-reduced-motion:reduce){*{transition:none!important}}
`;
