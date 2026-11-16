/**
 * The statistics page of the site (GET /stats?cle=…&periode=30&site=site), rendered by the booking
 * server from the Stats database (booking/stats.js), in the site's "garage de nuit" style: the
 * site's fonts (served by the worker, booking/stats-fonts.js), gold on deep black.
 * Protected by the STATS_KEY secret, never indexed nor cached. One small script (allowed by a
 * nonce) animates the figures and drives the curve's crosshair; without it every figure is still
 * there, and each chart has its table.
 */
import { utcToZoned, addDays } from './schedule.js';
import { report, totalsOf, ACTIONS, SOURCES, HEARD, TZ } from './stats.js';
import { shiftMonth } from './stats-report.js';
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
const monthLabel = (ym) => date(`${ym}-15`, { month: 'long', year: 'numeric' });
const daysBetween = (a, b) => Math.round((Date.parse(`${b}T12:00:00Z`) - Date.parse(`${a}T12:00:00Z`)) / 86400000) + 1;
const plural = (n, one, many) => `${nf(n)} ${n > 1 ? many : one}`;
const pageName = (p) => (p === '/' ? 'Accueil' : p);
const change = (cur, prev) => (prev ? Math.round(((cur - prev) / prev) * 100) : null);

/** constant-time comparison of the key */
function sameKey(a, b) {
  if (!a || !b || a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}

const headers = (nonce) => ({
  'content-type': 'text/html; charset=utf-8',
  'cache-control': 'no-store',
  'content-security-policy': `default-src 'none'; script-src ${nonce ? `'nonce-${nonce}'` : "'none'"}; style-src 'unsafe-inline'; font-src 'self'; img-src data:; base-uri 'none'; form-action 'none'; frame-ancestors 'none'`,
  'x-robots-tag': 'noindex, nofollow',
  'referrer-policy': 'no-referrer',
  'x-content-type-options': 'nosniff',
});

export async function statsPage(req, env, url, now) {
  if (!env.STATS || !sameKey(url.searchParams.get('cle') || '', env.STATS_KEY || '')) {
    const body = `<main class="wrap denied"><p class="kicker">SOLAR CAR 37</p><h1>Statistiques <em>du site</em></h1><p class="lead">Lien incomplet ou clé incorrecte : ouvrez l’adresse complète qui vous a été donnée.</p></main>`;
    return new Response(shell('Statistiques — SOLAR CAR 37', body), { status: 403, headers: headers() });
  }
  const per = PERIODS[url.searchParams.get('periode')] ? url.searchParams.get('periode') : '30';
  const site = url.searchParams.get('site') === 'apercu' ? 'apercu' : 'site';
  const P = PERIODS[per];
  const to = utcToZoned(now, TZ).date;
  const from = addDays(to, -(P.days - 1));
  const pto = addDays(from, -1);
  const pfrom = addDays(pto, -(P.days - 1));
  const mfrom = `${shiftMonth(to.slice(0, 7), -11)}-01`;
  const r = await report(env, { site, from, to, pfrom, pto, mfrom });
  const nonce = crypto.randomUUID().replace(/-/g, '');
  return new Response(render({ r, env, key: url.searchParams.get('cle'), per, site, from, to, pfrom, pto, now, nonce }), { headers: headers(nonce) });
}

// ------------------------------------------------------------------ periods and curves
/** day -> { visits, views, <action>: n } */
function dayMap(rows) {
  const m = new Map();
  for (const x of rows) {
    const d = m.get(x.day) || {};
    if (x.kind === 'page' || x.kind === undefined) {
      d.views = (d.views || 0) + (x.n || 0);
      d.visits = (d.visits || 0) + (x.visits || 0);
    } else d[x.kind] = (d[x.kind] || 0) + x.n;
    m.set(x.day, d);
  }
  return m;
}

/** the slices of a period: days, weeks (7 days ending today) or calendar months */
function slices(from, to, unit) {
  const out = [];
  if (unit === 'day') {
    for (let d = from; d <= to; d = addDays(d, 1)) out.push({ from: d, to: d, label: daysBetween(from, to) <= 7 ? date(d, { weekday: 'short', day: 'numeric' }) : shortDay(d), tip: date(d, { weekday: 'long', day: 'numeric', month: 'long' }) });
  } else if (unit === 'week') {
    for (let d = from; d <= to; d = addDays(d, 7)) {
      const e = addDays(d, 6) < to ? addDays(d, 6) : to;
      out.push({ from: d, to: e, label: shortDay(d), tip: `du ${shortDay(d)} au ${shortDay(e)}` });
    }
  } else {
    let d = from;
    while (d <= to) {
      const month = d.slice(0, 7);
      let e = d;
      while (addDays(e, 1) <= to && addDays(e, 1).slice(0, 7) === month) e = addDays(e, 1);
      const whole = d.endsWith('-01') && addDays(e, 1).slice(0, 7) !== month;
      out.push({ from: d, to: e, label: date(d, { month: 'short' }), tip: whole ? date(d, { month: 'long', year: 'numeric' }) : `du ${shortDay(d)} au ${shortDay(e)}` });
      d = addDays(e, 1);
    }
  }
  return out;
}
const total = (m, s, f) => {
  let v = 0;
  for (let d = s.from; d <= s.to; d = addDays(d, 1)) v += m.get(d)?.[f] || 0;
  return v;
};
const contactsOf = (m, s) => ['demande_envoyee', 'rdv', 'appel', 'email'].reduce((a, k) => a + total(m, s, k), 0);

/** a round top for the axis */
function niceMax(v) {
  if (v <= 4) return 4;
  const p = 10 ** Math.floor(Math.log10(v));
  return [1, 1.2, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10].map((f) => f * p).find((x) => x >= v);
}

/** a smooth curve that never overshoots its points (monotone cubic, Fritsch–Carlson) */
function curve(pts) {
  const n = pts.length;
  if (n < 2) return '';
  const r = (v) => Math.round(v * 10) / 10;
  const m = [];
  for (let i = 0; i < n - 1; i++) m.push((pts[i + 1][1] - pts[i][1]) / (pts[i + 1][0] - pts[i][0]));
  const t = pts.map((_, i) => (i === 0 ? m[0] : i === n - 1 ? m[n - 2] : m[i - 1] * m[i] <= 0 ? 0 : (m[i - 1] + m[i]) / 2));
  for (let i = 0; i < n - 1; i++) {
    if (m[i] === 0) {
      t[i] = 0;
      t[i + 1] = 0;
      continue;
    }
    const a = t[i] / m[i];
    const b = t[i + 1] / m[i];
    const h = a * a + b * b;
    if (h > 9) {
      const k = 3 / Math.sqrt(h);
      t[i] = k * a * m[i];
      t[i + 1] = k * b * m[i];
    }
  }
  let d = `M${r(pts[0][0])},${r(pts[0][1])}`;
  for (let i = 0; i < n - 1; i++) {
    const h = (pts[i + 1][0] - pts[i][0]) / 3;
    d += ` C${r(pts[i][0] + h)},${r(pts[i][1] + t[i] * h)} ${r(pts[i + 1][0] - h)},${r(pts[i + 1][1] - t[i + 1] * h)} ${r(pts[i + 1][0])},${r(pts[i + 1][1])}`;
  }
  return d;
}

// ------------------------------------------------------------------ icons (1.6px line, currentColor)
const ICONS = {
  eye: '<path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
  layers: '<path d="M12 3 2 8l10 5 10-5-10-5z"/><path d="m2 13 10 5 10-5"/>',
  message: '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>',
  calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 10h18"/>',
  phone: '<path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.4 1.8.7 2.7a2 2 0 0 1-.5 2.1L8 9.8a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.7.7a2 2 0 0 1 1.7 2z"/>',
  target: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.2"/>',
  mobile: '<rect x="7" y="2" width="10" height="20" rx="2.5"/><path d="M11 18h2"/>',
  desktop: '<rect x="2" y="4" width="20" height="13" rx="2"/><path d="M8 21h8M12 17v4"/>',
  up: '<path d="m3 17 6-6 4 4 8-8"/><path d="M15 7h6v6"/>',
  down: '<path d="m3 7 6 6 4-4 8 8"/><path d="M15 17h6v-6"/>',
  flat: '<path d="M3 12h18"/><path d="m15 6 6 6-6 6"/>',
  spark: '<path d="M12 2v4M12 18v4M4.9 4.9l2.8 2.8M16.3 16.3l2.8 2.8M2 12h4M18 12h4M4.9 19.1l2.8-2.8M16.3 7.7l2.8-2.8"/>',
  mail: '<rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 6-10 7L2 6"/>',
  arrow: '<path d="M7 17 17 7M8 7h9v9"/>',
};
const icon = (name, cls = '') => `<svg class="ico ${cls}" viewBox="0 0 24 24" aria-hidden="true">${ICONS[name]}</svg>`;

// ------------------------------------------------------------------ pieces
function delta(cur, prev, show) {
  if (!show || !prev) return '';
  const p = Math.round(((cur - prev) / prev) * 100);
  if (p === 0) return '<span class="pill pill--flat">= stable</span>';
  const up = p > 0;
  return `<span class="pill ${up ? 'pill--up' : 'pill--down'}"><span aria-hidden="true">${up ? '▲' : '▼'}</span> ${up ? '+' : '−'}${nf(Math.abs(p))} %<span class="sr"> par rapport à la période précédente</span></span>`;
}

/** a small trend: the period in gray, its last point in gold */
function spark(values) {
  const n = values.length;
  if (n < 2) return '';
  const max = Math.max(...values);
  const y = (v) => (max ? 28 - (v / max) * 26 : 28);
  const d = values.map((v, i) => `${i ? 'L' : 'M'}${((i / (n - 1)) * 100).toFixed(2)},${y(v).toFixed(2)}`).join(' ');
  const last = values[n - 1];
  return `<div class="spark" aria-hidden="true"><svg viewBox="0 0 100 30" preserveAspectRatio="none"><path d="${d}"/></svg><i style="bottom:${(((6 + (max ? (last / max) * 26 : 0)) / 38) * 100).toFixed(2)}%"></i></div>`;
}

const tile = ({ label, ico, value, count, d = '', sub = '', trend = '' }) =>
  `<article class="tile card reveal" data-spot>
    <p class="tile__label">${icon(ico)}${esc(label)}</p>
    <p class="tile__value"${count !== undefined ? ` data-count="${count}"` : ''}>${value}</p>
    <p class="tile__foot">${d}${sub ? `<span class="tile__sub">${sub}</span>` : ''}</p>
    ${trend}
  </article>`;

/** the curve of the visits, the period before as a gray line */
function trend(sl, cur, prev, compare, unit) {
  const n = sl.length;
  const pv = compare ? prev : [];
  const top = niceMax(Math.max(1, ...cur, ...pv));
  const W = 1000;
  const H = 300;
  const pt = (v, i) => [n > 1 ? (i / (n - 1)) * W : W / 2, H - (v / top) * H];
  const line = curve(cur.map(pt));
  const area = line ? `${line} L${W},${H} L0,${H} Z` : '';
  const ghost = pv.length > 1 ? curve(pv.slice(0, n).map(pt)) : '';
  const peak = Math.max(...cur) > 0 ? cur.lastIndexOf(Math.max(...cur)) : -1;
  const x = (i) => (n > 1 ? (i / (n - 1)) * 100 : 50);
  const k = Math.ceil(n / 6);
  const ticks = [top, top / 2, 0].filter((t) => Number.isInteger(t));
  const points = sl.map((s, i) => ({ t: s.tip, v: cur[i], w: s.views, p: compare && pv[i] !== undefined ? pv[i] : null }));
  const labels = sl
    .map((s, i) => ((n - 1 - i) % k === 0 ? `<span class="trend__x${i === 0 ? ' is-first' : i === n - 1 ? ' is-last' : ''}${((n - 1 - i) / k) % 2 ? ' is-minor' : ''}" style="left:${x(i).toFixed(2)}%">${esc(s.label)}</span>` : ''))
    .join('');
  const rows = sl.map((s, i) => `<tr><th scope="row">${esc(s.tip)}</th><td class="n">${nf(cur[i])}</td><td class="n">${nf(s.views)}</td>${compare ? `<td class="n">${pv[i] !== undefined ? nf(pv[i]) : '—'}</td>` : ''}</tr>`).join('');
  return `<div class="trend" data-trend data-top="${top}" data-points="${esc(JSON.stringify(points))}">
      ${compare ? `<ul class="legend legend--trend"><li><span class="key key--line"></span>Cette période</li><li><span class="key key--ghost"></span>Période précédente</li></ul>` : ''}
      <div class="trend__plot">
        ${ticks.map((t) => `<span class="trend__tick" style="bottom:${(t / top) * 100}%"><span>${nf(t)}</span></span>`).join('')}
        <svg class="trend__svg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" aria-hidden="true">
          <defs><linearGradient id="wash" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#c98500" stop-opacity=".30"/><stop offset="1" stop-color="#c98500" stop-opacity="0"/></linearGradient></defs>
          ${area ? `<path class="trend__area" d="${area}"/>` : ''}
          ${ghost ? `<path class="trend__ghost" d="${ghost}"/>` : ''}
          ${line ? `<path class="trend__line" d="${line}"/>` : ''}
        </svg>
        ${peak >= 0 ? `<b class="trend__peak" style="left:${x(peak).toFixed(2)}%;bottom:${((cur[peak] / top) * 100).toFixed(2)}%">${nf(cur[peak])}</b>` : ''}
        <div class="trend__hit" tabindex="0" role="img" aria-label="Courbe des visites ${unit === 'day' ? 'par jour' : unit === 'week' ? 'par semaine' : 'par mois'} : flèches gauche et droite pour lire chaque point">
          <i class="trend__cross"></i><i class="trend__dot"></i><div class="trend__tip" role="status" aria-live="polite"></div>
        </div>
      </div>
      <div class="trend__axis" aria-hidden="true">${labels}</div>
    </div>
    <details class="table-view"><summary>Voir les chiffres</summary><table class="list"><thead><tr><th scope="col">${unit === 'day' ? 'Jour' : unit === 'week' ? 'Semaine' : 'Mois'}</th><th scope="col" class="n">Visites</th><th scope="col" class="n">Pages vues</th>${compare ? '<th scope="col" class="n">Période préc.</th>' : ''}</tr></thead><tbody>${rows}</tbody></table></details>`;
}

/** "out of 100 visits": each action against the visits (a meter list) */
function per100(cur) {
  const rows = [
    ['Simulateurs 3D ouverts', cur.simulateur_3d],
    ['Clics vers un devis', cur.clic_devis + cur.devis_simulateur],
    ['Contacts (demandes, RDV, appels, e-mails)', cur.contacts, true],
    ['Demandes et RDV', cur.requests],
  ];
  if (!cur.visits) return '<p class="muted">Pas encore de visite sur cette période.</p>';
  return `<ul class="meters">${rows
    .map(([name, n, strong]) => {
      const v = (n / cur.visits) * 100;
      return `<li${strong ? ' class="is-key"' : ''}><span class="meters__name">${esc(name)}</span><span class="meters__val">${n1(v)}<small> / 100</small></span><span class="meters__track"><i style="--w:${Math.min(100, v).toFixed(2)}%"></i></span></li>`;
    })
    .join('')}</ul>`;
}

function sourcesBlock(r, visits) {
  const by = Object.fromEntries(r.sources.map((s) => [s.source, s.n]));
  const list = Object.keys(SOURCES)
    .filter((k) => k !== 'pub' || by.pub)
    .map((k) => ({ k, n: by[k] || 0 }))
    .sort((a, b) => b.n - a.n);
  const max = Math.max(1, ...list.map((s) => s.n));
  const bars = list
    .map((s) => `<li><span class="rank__name">${esc(SOURCES[s.k])}</span><span class="rank__val">${visits ? pct((s.n / visits) * 100) : '—'} <small>${nf(s.n)}</small></span><span class="rank__track"><i style="--w:${((s.n / max) * 100).toFixed(2)}%"></i></span></li>`)
    .join('');
  const chips = r.refs.length ? `<p class="sub-h">Sites qui envoient des visiteurs</p><ul class="chips">${r.refs.map((x) => `<li title="${esc(SOURCES[x.source] || '')}">${esc(x.ref)} <b>${nf(x.n)}</b></li>`).join('')}</ul>` : '';
  return `<ul class="rank">${bars}</ul>${chips}`;
}

function devicesBlock(r) {
  const by = Object.fromEntries(r.devices.map((x) => [x.device, x.visits || 0]));
  const parts = [
    { k: 'telephone', name: 'Téléphone', ico: 'mobile', n: by.telephone || 0 },
    { k: 'ordinateur', name: 'Ordinateur ou tablette', ico: 'desktop', n: by.ordinateur || 0 },
  ];
  const sum = parts[0].n + parts[1].n;
  if (!sum) return '<p class="muted">Pas encore de visite sur cette période.</p>';
  return `<div class="devices">${parts.map((p) => `<div class="device"><span class="device__ico device__ico--${p.k}">${icon(p.ico)}</span><p class="device__pct">${pct((p.n / sum) * 100)}</p><p class="device__name"><span class="swatch swatch--${p.k}" aria-hidden="true"></span>${esc(p.name)} <small>${nf(p.n)}</small></p></div>`).join('')}</div>
    <div class="seg" role="img" aria-label="${esc(parts.map((p) => `${p.name} : ${pct((p.n / sum) * 100)}`).join(', '))}">${parts.filter((p) => p.n).map((p) => `<i class="seg__${p.k}" style="--w:${((p.n / sum) * 100).toFixed(2)}%"></i>`).join('')}</div>`;
}

function pagesBlock(r) {
  if (!r.pages.length) return '<p class="muted">Pas encore de page vue sur cette période.</p>';
  const max = Math.max(...r.pages.map((p) => p.views));
  return `<ol class="pages">${r.pages
    .slice(0, 10)
    .map((p, i) => `<li style="--w:${((p.views / max) * 100).toFixed(2)}%"><span class="pages__rank">${i + 1}</span><span class="pages__name">${esc(pageName(p.page))}</span><span class="pages__val">${nf(p.views)}<small>${nf(p.entries || 0)} arrivées</small></span></li>`)
    .join('')}</ol>`;
}

function actionsBlock(r) {
  const rows = r.actions.filter((a) => a.kind !== 'demande_erreur').slice(0, 10);
  if (!rows.length) return '<p class="muted">Aucune action sur cette période.</p>';
  return `<table class="list"><thead><tr><th scope="col">Action</th><th scope="col">Depuis la page</th><th scope="col" class="n">Nombre</th></tr></thead><tbody>${rows.map((a) => `<tr><td>${esc(ACTIONS[a.kind] || a.kind)}</td><td class="dim">${esc(pageName(a.page))}</td><td class="n">${nf(a.n)}</td></tr>`).join('')}</tbody></table>`;
}

function monthsBlock(r, to) {
  if (!r.months.length) return '<p class="muted">Le premier mois apparaîtra ici dès les premières visites.</p>';
  const cur = to.slice(0, 7);
  const max = Math.max(1, ...r.months.map((m) => m.visits || 0));
  const rows = r.months.map((m, i) => ({ ...m, prev: r.months[i - 1] && r.months[i - 1].month === shiftMonth(m.month, -1) ? r.months[i - 1] : null })).reverse();
  return `<ol class="months">${rows
    .map((m) => {
      const c = m.month === cur ? null : m.prev ? change(m.visits || 0, m.prev.visits || 0) : null;
      const evo = m.month === cur ? '<span class="pill pill--flat">en cours</span>' : c === null ? '<span class="dim">—</span>' : c === 0 ? '<span class="pill pill--flat">= stable</span>' : `<span class="pill ${c > 0 ? 'pill--up' : 'pill--down'}"><span aria-hidden="true">${c > 0 ? '▲' : '▼'}</span> ${c > 0 ? '+' : '−'}${nf(Math.abs(c))} %</span>`;
      return `<li><span class="months__name">${esc(monthLabel(m.month))}</span><span class="months__bar"><i style="--w:${(((m.visits || 0) / max) * 100).toFixed(2)}%"></i></span><span class="months__val">${nf(m.visits || 0)} <small>visites</small></span><span class="months__val">${nf(m.requests || 0)} <small>demandes et RDV</small></span><span class="months__evo">${evo}</span></li>`;
    })
    .join('')}</ol>`;
}

/** « Comment nous avez-vous connus ? »: the answers, most frequent first, « Sans réponse » last */
function heardBlock(r) {
  const list = (r.heard || []).filter((x) => HEARD[x.source]).sort((a, b) => (a.source === 'sans') - (b.source === 'sans') || b.n - a.n);
  if (!list.length) return '<p class="muted">Pas encore de réponse sur cette période : elles arrivent avec les demandes de devis et les RDV réservés en ligne.</p>';
  const max = Math.max(1, ...list.map((x) => x.n));
  const bars = list
    .map((x) => `<li><span class="rank__name">${esc(HEARD[x.source])}</span><span class="rank__val">${nf(x.n)}${x.rdv ? ` <small>dont ${nf(x.rdv)} RDV</small>` : ''}</span><span class="rank__track"><i style="--w:${((x.n / max) * 100).toFixed(2)}%"></i></span></li>`)
    .join('');
  const other = (r.heardOther || []).length ? `<p class="sub-h">Réponses « Autre »</p><ul class="chips">${r.heardOther.map((x) => `<li>${esc(x.detail)} <b>${nf(x.n)}</b></li>`).join('')}</ul>` : '';
  return `<ul class="rank">${bars}</ul>${other}<p class="note">Réponses du formulaire de devis et de la réservation en ligne ; plusieurs cases peuvent être cochées.</p>`;
}

function bookingsBlock(r) {
  if (!r.bookings.length) return '';
  return `<section class="card reveal" data-spot><h2>${icon('calendar')}RDV réservés en ligne</h2><ul class="kv">${r.bookings.map((b) => `<li><span>${esc(b.detail)}</span><strong>${nf(b.n)}</strong><span class="dim">${eur(b.value || 0)}</span></li>`).join('')}</ul></section>`;
}

/** per-day averages, side by side with the old site (local.fr) */
function versus(cur, r, from, to, visits) {
  const start = r.first && r.first > from ? r.first : from;
  const span = r.first ? daysBetween(start, to) : 0;
  const oldDays = daysBetween(oldSite.from, oldSite.to);
  const oldPerDay = oldSite.visitors / oldDays;
  const newPerDay = span ? cur.visits / span : 0;
  const search = visits ? pct(((Object.fromEntries(r.sources.map((s) => [s.source, s.n])).moteurs || 0) / visits) * 100) : '—';
  const factor = span && newPerDay ? newPerDay / oldPerDay : null;
  const badge = factor === null ? '' : factor >= 1.05 ? `<span class="badge badge--up">×${n1(factor)}</span>` : factor <= 0.95 ? `<span class="badge badge--down">−${Math.round((1 - factor) * 100)} %</span>` : '<span class="badge">≈ pareil</span>';
  const row = (label, a, b) => `<tr><th scope="row">${label}</th><td class="n dim">${a}</td><td class="n">${b}</td></tr>`;
  return `<div class="vs">
      <div class="vs__side"><p class="kicker">${esc(oldSite.label)}</p><p class="vs__big">${n1(oldPerDay)}</p><p class="dim">visiteurs par jour<br><small>du ${shortDay(oldSite.from)} au ${longDay(oldSite.to)}</small></p></div>
      <div class="vs__mid">${badge || '<span class="badge">VS</span>'}</div>
      <div class="vs__side vs__side--new"><p class="kicker">Nouveau site</p><p class="vs__big">${span ? n1(newPerDay) : '—'}</p><p class="dim">visites par jour<br><small>${span ? plural(span, 'jour compté', 'jours comptés') : 'pas encore de données'}</small></p></div>
    </div>
    <table class="list"><thead><tr><th scope="col"></th><th scope="col" class="n">Ancien</th><th scope="col" class="n">Nouveau</th></tr></thead><tbody>
      ${row('Pages vues par jour', n1(oldSite.pageViews / oldDays), span ? n1(cur.views / span) : '—')}
      ${row('Pages par visite', n2(oldSite.pageViews / oldSite.visitors), cur.visits ? n2(cur.views / cur.visits) : '—')}
      ${row('Arrivées par un moteur de recherche', esc(oldSite.searchShare), search)}
      ${row('Demandes et RDV par jour', 'inconnu', span ? n1(cur.requests / span) : '—')}
    </tbody></table>
    <p class="note">L’ancien site comptait des « visiteurs uniques », le nouveau compte des visites : comparez les ordres de grandeur, et surtout les vraies demandes. Son compteur de messages (1 013) était faussé par le spam.</p>`;
}

/** the sentence at the top: up, down or stable */
function verdict(cur, prev, compare, r, P) {
  if (!compare) {
    const text = r.first ? `Comptage commencé le ${longDay(r.first)}. La tendance apparaîtra dès que les ${P.label} précédents seront entièrement comptés.` : 'Le comptage démarre à la première visite du site.';
    return `<div class="verdict verdict--new reveal">${icon('spark')}<p>${esc(text)}</p></div>`;
  }
  const dv = change(cur.visits, prev.visits);
  const dc = change(cur.contacts, prev.contacts);
  const tone = dv === null ? 'flat' : dv >= 5 ? 'up' : dv <= -5 ? 'down' : 'flat';
  const word = { up: 'En hausse', down: 'En baisse', flat: 'Stable' }[tone];
  const s = (v) => (v === null ? '' : `${v > 0 ? '+' : v < 0 ? '−' : ''}${nf(Math.abs(v))} %`);
  return `<div class="verdict verdict--${tone} reveal">${icon(tone)}<p><strong>${word}</strong> : ${plural(cur.visits, 'visite', 'visites')}${dv !== null ? ` (${s(dv)})` : ''} et ${plural(cur.contacts, 'contact', 'contacts')}${dc !== null ? ` (${s(dc)})` : ''} par rapport aux ${esc(P.label)} précédents.</p></div>`;
}

// ------------------------------------------------------------------ page
function render({ r, env, key, per, site, from, to, pfrom, pto, now, nonce }) {
  const P = PERIODS[per];
  const cur = totalsOf(r.totals);
  const prev = totalsOf(r.previous);
  const compare = !!r.first && r.first <= pfrom;
  const link = (o) => `?${new URLSearchParams({ cle: key, periode: per, site, ...o })}`;
  const seg = (items, current, param) => items.map(([v, label]) => `<a href="${esc(link({ [param]: v }))}"${v === current ? ' aria-current="page"' : ''}>${esc(label)}</a>`).join('');
  const time = new Intl.DateTimeFormat('fr-FR', { timeZone: TZ, hour: 'numeric', minute: '2-digit' }).format(new Date(now)).replace(':', ' h ');
  const siteUrl = String(env.SITE_URL || '').replace(/\/$/, '');
  const lastMonth = shiftMonth(to.slice(0, 7), -1);
  // the slices of the period, the same slices of the period before (aligned by position)
  const sl = slices(from, to, P.unit);
  const psl = slices(pfrom, pto, P.unit);
  const m = dayMap(r.series);
  const pm = dayMap(r.before);
  for (const s of sl) s.views = total(m, s, 'views');
  const visitsBy = sl.map((s) => total(m, s, 'visits'));
  const prevBy = psl.map((s) => total(pm, s, 'visits'));
  const series = (f) => sl.map((s) => (typeof f === 'function' ? f(s) : total(m, s, f)));
  const rate = cur.visits ? (cur.contacts / cur.visits) * 100 : 0;
  const prevRate = prev.visits ? (prev.contacts / prev.visits) * 100 : 0;
  const avg = r.first ? cur.visits / daysBetween(r.first > from ? r.first : from, to) : 0;
  const others = ['clic_devis', 'devis_simulateur', 'simulateur_3d', 'email', 'itineraire', 'demande_erreur']
    .filter((k) => k !== 'demande_erreur' || cur[k])
    .map((k) => `<li><span>${esc(ACTIONS[k])}</span><strong>${nf(cur[k])}</strong>${delta(cur[k], prev[k], compare)}</li>`)
    .join('');

  const body = `
<div class="bg" aria-hidden="true"><div class="bg__glow"></div><div class="bg__sweep"></div><div class="bg__floor"></div></div>
<header class="top wrap">
  <div class="top__bar">
    <p class="brand"><span class="brand__mark"></span>SOLAR CAR 37</p>
    <p class="live"><span class="live__dot"></span>Mis à jour à ${esc(time)}</p>
  </div>
  <h1>Statistiques <em>du site</em></h1>
  <p class="lead">${site === 'apercu' ? 'Aperçu et essais, pas les vrais visiteurs' : 'Site public'} · du ${shortDay(from)} au ${longDay(to)}</p>
  <nav class="filters" aria-label="Période et site">
    <div class="segctl">${seg(Object.entries(PERIODS).map(([k, v]) => [k, v.label]), per, 'periode')}</div>
    <div class="segctl">${seg([['site', 'Site public'], ['apercu', 'Aperçu']], site, 'site')}</div>
    <a class="ghost-link" href="${esc(`/stats/bilan?${new URLSearchParams({ cle: key, mois: lastMonth, site })}`)}">${icon('mail')}Bilan de ${esc(date(`${lastMonth}-15`, { month: 'long' }))}</a>
  </nav>
  ${verdict(cur, prev, compare, r, P)}
</header>

<main class="wrap">
  <section class="hero card reveal" data-spot aria-label="Visites">
    <div class="hero__head">
      <div>
        <p class="tile__label">${icon('eye')}Visites</p>
        <p class="hero__value" data-count="${cur.visits}">${nf(cur.visits)}</p>
        <p class="tile__foot">${delta(cur.visits, prev.visits, compare)}${P.days > 7 && r.first ? `<span class="tile__sub">${n1(avg)} par jour en moyenne</span>` : ''}</p>
      </div>
      <p class="hero__per">${esc(P.per)}</p>
    </div>
    ${trend(sl, visitsBy, prevBy, compare, P.unit)}
  </section>

  <section class="tiles" aria-label="Chiffres clés">
    ${tile({ label: 'Pages vues', ico: 'eye', value: nf(cur.views), count: cur.views, d: delta(cur.views, prev.views, compare), trend: spark(series('views')) })}
    ${tile({ label: 'Pages par visite', ico: 'layers', value: cur.visits ? n2(cur.views / cur.visits) : '—', trend: spark(sl.map((s, i) => (visitsBy[i] ? s.views / visitsBy[i] : 0))) })}
    ${tile({ label: 'Demandes envoyées', ico: 'message', value: nf(cur.demande_envoyee), count: cur.demande_envoyee, d: delta(cur.demande_envoyee, prev.demande_envoyee, compare), sub: 'formulaire de contact', trend: spark(series('demande_envoyee')) })}
    ${tile({ label: 'RDV réservés en ligne', ico: 'calendar', value: nf(cur.rdv), count: cur.rdv, d: delta(cur.rdv, prev.rdv, compare), sub: cur.rdv ? `${eur(cur.paid)} payés en ligne` : 'vitres et feux teintés', trend: spark(series('rdv')) })}
    ${tile({ label: 'Appels', ico: 'phone', value: nf(cur.appel), count: cur.appel, d: delta(cur.appel, prev.appel, compare), sub: 'clics sur le numéro', trend: spark(series('appel')) })}
    ${tile({ label: 'Taux de contact', ico: 'target', value: cur.visits ? pct(rate) : '—', d: compare && prevRate ? delta(rate, prevRate, true) : '', sub: 'contacts pour 100 visites', trend: spark(sl.map((s, i) => (visitsBy[i] ? (contactsOf(m, s) / visitsBy[i]) * 100 : 0))) })}
  </section>

  <div class="grid2">
    <section class="card reveal" data-spot>
      <h2>${icon('target')}Sur 100 visites</h2>
      ${per100(cur)}
    </section>
    <section class="card reveal" data-spot>
      <h2>${icon('arrow')}D’où viennent les visiteurs</h2>
      ${sourcesBlock(r, cur.visits)}
    </section>
  </div>

  <div class="grid2">
    <section class="card reveal" data-spot>
      <h2>${icon('calendar')}Mois par mois</h2>
      ${monthsBlock(r, to)}
      <p class="note">Le bilan du mois arrive aussi par e-mail le 1<sup>er</sup> de chaque mois.</p>
    </section>
    <section class="card reveal" data-spot>
      <h2>${icon('mobile')}Appareils</h2>
      ${devicesBlock(r)}
      <h2 class="h2--spaced">${icon('spark')}Autres actions</h2>
      <ul class="kv">${others}</ul>
    </section>
  </div>

  <div class="grid2">
    <section class="card reveal" data-spot>
      <h2>${icon('eye')}Pages les plus vues</h2>
      ${pagesBlock(r)}
    </section>
    <section class="card reveal" data-spot>
      <h2>${icon('phone')}Contacts : depuis quelles pages</h2>
      ${actionsBlock(r)}
    </section>
  </div>

  <section class="card reveal" data-spot>
    <h2>${icon('message')}Comment ils vous ont connus</h2>
    ${heardBlock(r)}
  </section>

  ${bookingsBlock(r)}

  <section class="card reveal" data-spot>
    <h2>${icon('up')}Par rapport à l’ancien site</h2>
    ${versus(cur, r, from, to, cur.visits)}
  </section>

  <details class="notes reveal">
    <summary>Comment c’est compté</summary>
    <ul>
      <li>Sans cookie et sans rien enregistrer sur l’appareil des visiteurs : ni adresse IP ni identifiant ne sont gardés. Une <strong>visite</strong> = une arrivée sur le site depuis l’extérieur (moteur de recherche, réseau social, autre site, application, adresse tapée).</li>
      <li>Les robots et les outils de test ne sont pas comptés. Les RDV sont comptés par le serveur au moment du paiement.</li>
      ${siteUrl ? `<li><strong>Vos propres visites</strong> : ouvrez <a href="${esc(siteUrl)}/?stats=off">${esc(siteUrl.replace(/^https?:\/\//, ''))}/?stats=off</a> une fois sur chacun de vos appareils pour ne plus être compté.</li>` : ''}
      <li>« Fiche Google » : visiteurs venus par le bouton « Site web » de la fiche, si son lien se termine par <code>?utm_source=fiche-google</code>. « Publicité » : clics sur une annonce Google Ads.</li>
      <li>Les données sont effacées au bout de 25 mois.</li>
    </ul>
  </details>
</main>
<script nonce="${nonce}">${SCRIPT}</script>`;
  return shell('Statistiques — SOLAR CAR 37', body);
}

// the page's only script: figures that count up, cards that appear, the light that follows the
// pointer, the curve's crosshair (pointer and arrow keys). Labels are written with textContent.
const SCRIPT = `(() => {
  const d = document, reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const fmt = new Intl.NumberFormat('fr-FR');
  d.documentElement.classList.add('js');
  const count = (root) => root.querySelectorAll('[data-count]').forEach((el) => {
    const end = Number(el.dataset.count);
    if (reduce || !end) return;
    const t0 = performance.now(), dur = 900 + Math.min(700, end * 2);
    const step = (t) => { const k = Math.min(1, (t - t0) / dur); el.textContent = fmt.format(Math.round(end * (1 - Math.pow(1 - k, 3)))); if (k < 1) requestAnimationFrame(step); };
    requestAnimationFrame(step);
  });
  const show = (el) => { el.classList.add('is-in'); count(el); };
  const io = !reduce && 'IntersectionObserver' in window ? new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { io.unobserve(e.target); show(e.target); } }), { threshold: 0.08 }) : null;
  d.querySelectorAll('.reveal').forEach((el, i) => { el.style.setProperty('--i', String(i % 6)); io ? io.observe(el) : show(el); });
  if (matchMedia('(hover: hover)').matches) d.addEventListener('pointermove', (e) => {
    const c = e.target.closest && e.target.closest('[data-spot]');
    if (!c) return;
    const r = c.getBoundingClientRect();
    c.style.setProperty('--mx', (e.clientX - r.left) + 'px');
    c.style.setProperty('--my', (e.clientY - r.top) + 'px');
  });
  d.querySelectorAll('[data-trend]').forEach((chart) => {
    const pts = JSON.parse(chart.dataset.points), n = pts.length, top = Number(chart.dataset.top);
    const hit = chart.querySelector('.trend__hit'), cross = hit.querySelector('.trend__cross'), dot = hit.querySelector('.trend__dot'), tip = hit.querySelector('.trend__tip');
    let at = n - 1;
    const line = (cls, value, label) => { const p = d.createElement('p'); const k = d.createElement('span'); k.className = 'key ' + cls; const b = d.createElement('strong'); b.textContent = value; p.append(k, b, ' ' + label); return p; };
    const go = (i) => {
      at = Math.max(0, Math.min(n - 1, i));
      const p = pts[at], x = n > 1 ? at / (n - 1) * 100 : 50;
      cross.style.left = x + '%'; dot.style.left = x + '%'; dot.style.bottom = (p.v / top * 100) + '%';
      tip.replaceChildren();
      const h = d.createElement('p'); h.className = 'trend__when'; h.textContent = p.t; tip.append(h);
      tip.append(line('key--line', fmt.format(p.v), p.v > 1 ? 'visites' : 'visite'));
      const w = d.createElement('p'); w.className = 'dim'; w.textContent = fmt.format(p.w) + (p.w > 1 ? ' pages vues' : ' page vue'); tip.append(w);
      if (p.p !== null) tip.append(line('key--ghost', fmt.format(p.p), 'période préc.'));
      chart.classList.add('is-active');
      const W = hit.clientWidth, tw = tip.offsetWidth;
      tip.style.left = Math.max(0, Math.min(W - tw, x / 100 * W - tw / 2)) + 'px';
    };
    hit.addEventListener('pointermove', (e) => { const r = hit.getBoundingClientRect(); go(Math.round((e.clientX - r.left) / r.width * (n - 1))); });
    hit.addEventListener('pointerdown', (e) => { const r = hit.getBoundingClientRect(); go(Math.round((e.clientX - r.left) / r.width * (n - 1))); });
    hit.addEventListener('pointerleave', () => { if (d.activeElement !== hit) chart.classList.remove('is-active'); });
    hit.addEventListener('focus', () => go(at));
    hit.addEventListener('blur', () => chart.classList.remove('is-active'));
    hit.addEventListener('keydown', (e) => {
      const k = { ArrowLeft: at - 1, ArrowRight: at + 1, Home: 0, End: n - 1 }[e.key];
      if (k !== undefined) { e.preventDefault(); go(k); }
    });
  });
})();`;

function shell(title, body) {
  return `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="robots" content="noindex, nofollow">
<meta name="referrer" content="no-referrer">
<meta name="color-scheme" content="dark">
<meta name="theme-color" content="#07080a">
<link rel="icon" href="data:,">
<link rel="preload" href="/stats/f/geist.woff2" as="font" type="font/woff2" crossorigin>
<title>${esc(title)}</title>
<style>${CSS}</style>
</head>
<body>
${body}
</body>
</html>
`;
}

// "garage de nuit": the site's black, gold and ivory. Data marks: amber #c98500 and blue #3987e5,
// validated together on the dark surface (lightness band, colour-blind separation, contrast).
const CSS = `
@font-face{font-family:'Geist';src:url('/stats/f/geist.woff2') format('woff2-variations');font-weight:100 900;font-display:swap}
@font-face{font-family:'Geist Mono';src:url('/stats/f/geist-mono.woff2') format('woff2-variations');font-weight:100 900;font-display:swap}
@font-face{font-family:'Instrument Serif';src:url('/stats/f/serif.woff2') format('woff2');font-style:italic;font-weight:400;font-display:swap}
:root{color-scheme:dark;--bg:#07080a;--surface:#121317;--glass:rgba(22,23,28,.66);--line:rgba(255,255,255,.08);--line-2:rgba(255,255,255,.14);--text:#f3f0ea;--text-2:#c7c3ba;--text-3:#9b978e;--gold:#e3c27a;--gold-2:#f1dca2;--data:#c98500;--data-2:#3987e5;--ghost:#6f6c66;--grid:rgba(255,255,255,.07);--up:#3ccb5a;--up-bg:rgba(12,163,12,.16);--down:#ff8a80;--down-bg:rgba(208,59,59,.18);--font:'Geist',system-ui,-apple-system,'Segoe UI',Roboto,sans-serif;--mono:'Geist Mono',ui-monospace,'SF Mono',Menlo,monospace;--serif:'Instrument Serif',Georgia,serif}
*{box-sizing:border-box}
html{background:var(--bg)}
body{margin:0;background:var(--bg);color:var(--text);font:16px/1.5 var(--font);-webkit-font-smoothing:antialiased;-webkit-text-size-adjust:100%;min-height:100vh;overflow-x:hidden}
a{color:inherit}
.wrap{max-width:1160px;margin:0 auto;padding:0 16px;position:relative}
.ico{width:18px;height:18px;flex:none;fill:none;stroke:currentColor;stroke-width:1.6;stroke-linecap:round;stroke-linejoin:round}
.sr{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}
.dim{color:var(--text-3)}
.muted{color:var(--text-2);margin:0}
/* the night garage behind */
.bg{position:fixed;inset:0;z-index:-1;overflow:hidden;pointer-events:none}
.bg__glow{position:absolute;inset:-20%;background:radial-gradient(42% 36% at 18% 6%,rgba(227,194,122,.16),transparent 70%),radial-gradient(38% 34% at 92% 28%,rgba(57,135,229,.10),transparent 70%),radial-gradient(60% 40% at 50% 110%,rgba(227,194,122,.07),transparent 70%)}
.bg__sweep{position:absolute;top:-30%;left:-60%;width:40%;height:160%;background:linear-gradient(90deg,transparent,rgba(241,220,162,.05),transparent);transform:rotate(18deg);animation:sweep 14s ease-in-out infinite}
.bg__floor{position:absolute;left:-50%;right:-50%;bottom:-6%;height:46%;background-image:linear-gradient(rgba(227,194,122,.09) 1px,transparent 1px),linear-gradient(90deg,rgba(227,194,122,.09) 1px,transparent 1px);background-size:64px 64px;transform:perspective(520px) rotateX(64deg);transform-origin:bottom;-webkit-mask-image:linear-gradient(to top,#000 10%,transparent 85%);mask-image:linear-gradient(to top,#000 10%,transparent 85%);animation:floor 18s linear infinite}
@keyframes sweep{0%{left:-60%}55%,100%{left:130%}}
@keyframes floor{to{background-position:0 64px,0 0}}
/* header */
.top{padding:22px 16px 8px}
.top__bar{display:flex;justify-content:space-between;align-items:center;gap:12px}
.brand{margin:0;font:600 12px/1 var(--mono);letter-spacing:.22em;color:var(--gold);display:flex;align-items:center;gap:10px}
.brand__mark{width:22px;height:22px;border-radius:7px;background:linear-gradient(135deg,var(--gold-2),#a87f2e);box-shadow:0 0 18px rgba(227,194,122,.45)}
.live{margin:0;font:500 12px/1 var(--mono);color:var(--text-3);display:flex;align-items:center;gap:8px;letter-spacing:.04em}
.live__dot{width:8px;height:8px;border-radius:50%;background:var(--up);box-shadow:0 0 0 0 rgba(60,203,90,.6);animation:pulse 2.4s infinite}
@keyframes pulse{70%{box-shadow:0 0 0 8px rgba(60,203,90,0)}100%{box-shadow:0 0 0 0 rgba(60,203,90,0)}}
h1{font:650 clamp(34px,6vw,56px)/1.02 var(--font);letter-spacing:-.025em;margin:26px 0 8px}
h1 em{font:400 italic 1.08em/1 var(--serif);letter-spacing:0;color:var(--gold);background:linear-gradient(180deg,var(--gold-2),var(--gold) 60%,#b8913f);-webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent}
.lead{margin:0;color:var(--text-2);font-size:15px}
.kicker{margin:0 0 6px;font:600 11px/1.2 var(--mono);letter-spacing:.18em;text-transform:uppercase;color:var(--gold)}
.filters{display:flex;flex-wrap:wrap;align-items:center;gap:10px 12px;margin:20px 0 14px}
.segctl{display:inline-flex;background:rgba(255,255,255,.04);border:1px solid var(--line);border-radius:999px;padding:4px;max-width:100%;overflow-x:auto;backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px)}
.segctl a{padding:7px 14px;border-radius:999px;text-decoration:none;font-size:14px;color:var(--text-2);white-space:nowrap;transition:background .2s,color .2s}
.segctl a:hover{color:var(--text)}
.segctl a[aria-current]{background:linear-gradient(180deg,var(--gold-2),var(--gold));color:#0a0a0b;font-weight:650;box-shadow:0 4px 18px rgba(227,194,122,.28)}
.segctl a:focus-visible,.ghost-link:focus-visible,.trend__hit:focus-visible,summary:focus-visible{outline:2px solid var(--gold);outline-offset:2px}
.ghost-link{display:inline-flex;align-items:center;gap:8px;font-size:14px;color:var(--text-2);text-decoration:none;padding:8px 14px;border:1px solid var(--line);border-radius:999px;background:rgba(255,255,255,.03)}
.ghost-link:hover{color:var(--text);border-color:var(--line-2)}
.verdict{display:flex;gap:14px;align-items:center;padding:14px 18px;border-radius:16px;border:1px solid var(--line);background:var(--glass);backdrop-filter:blur(14px);-webkit-backdrop-filter:blur(14px);margin:0 0 18px}
.verdict .ico{width:26px;height:26px;padding:5px;border-radius:9px;box-sizing:content-box}
.verdict p{margin:0;font-size:15px;color:var(--text-2)}
.verdict strong{color:var(--text)}
.verdict--up .ico{color:var(--up);background:var(--up-bg)}
.verdict--down .ico{color:var(--down);background:var(--down-bg)}
.verdict--flat .ico,.verdict--new .ico{color:var(--gold);background:rgba(227,194,122,.12)}
/* cards: glass, a gold light that follows the pointer */
.card{position:relative;background:radial-gradient(520px circle at var(--mx,50%) var(--my,-40%),rgba(227,194,122,.07),transparent 42%),linear-gradient(180deg,rgba(255,255,255,.045),rgba(255,255,255,.012)),var(--glass);border:1px solid var(--line);border-radius:22px;padding:20px;margin:0 0 16px;min-width:0;backdrop-filter:blur(16px);-webkit-backdrop-filter:blur(16px);box-shadow:inset 0 1px 0 rgba(255,255,255,.06),0 24px 60px -30px rgba(0,0,0,.8);transition:border-color .3s}
.card:hover{border-color:var(--line-2)}
.card h2{display:flex;align-items:center;gap:10px;font-size:16px;font-weight:600;margin:0 0 16px;letter-spacing:-.005em}
.card h2 .ico{color:var(--gold)}
.h2--spaced{margin-top:26px!important}
.sub-h{margin:18px 0 8px;font:600 11px/1.2 var(--mono);letter-spacing:.14em;text-transform:uppercase;color:var(--text-3)}
.js .reveal{opacity:0;transform:translateY(14px);transition:opacity .7s cubic-bezier(.2,.7,.2,1),transform .7s cubic-bezier(.2,.7,.2,1);transition-delay:calc(var(--i,0) * 60ms)}
.js .reveal.is-in{opacity:1;transform:none}
/* hero: the visits and their curve */
.hero{padding:22px 22px 18px;border-color:rgba(227,194,122,.18)}
.hero__head{display:flex;justify-content:space-between;align-items:flex-start;gap:12px}
.hero__value{font:650 clamp(56px,11vw,96px)/1 var(--font);letter-spacing:-.04em;margin:8px 0 8px;background:linear-gradient(180deg,#fff,#d8d2c4);-webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent}
.hero__per{margin:0;font:500 12px/1 var(--mono);color:var(--text-3);letter-spacing:.06em;text-transform:uppercase;white-space:nowrap}
.tile__label{margin:0;display:flex;align-items:center;gap:8px;font-size:14px;color:var(--text-2)}
.tile__label .ico{color:var(--gold);width:16px;height:16px}
.tile__foot{margin:0;display:flex;flex-wrap:wrap;align-items:center;gap:6px 10px;font-size:13px;min-height:22px}
.tile__sub{color:var(--text-3)}
.pill{display:inline-flex;align-items:center;gap:4px;font-weight:650;font-size:12.5px;padding:3px 9px;border-radius:999px;white-space:nowrap}
.pill--up{color:var(--up);background:var(--up-bg)}
.pill--down{color:var(--down);background:var(--down-bg)}
.pill--flat{color:var(--text-2);background:rgba(255,255,255,.07)}
.trend{margin-top:14px}
.legend{list-style:none;margin:0 0 6px;padding:0;display:flex;flex-wrap:wrap;gap:6px 18px;font-size:13px;color:var(--text-2)}
.legend li{display:flex;align-items:center;gap:8px}
.key{display:inline-block;width:16px;height:0;border-top:2px solid var(--data);border-radius:2px;vertical-align:middle}
.key--ghost{border-top-color:var(--ghost)}
.trend__plot{position:relative;height:clamp(200px,32vw,300px);margin:26px 0 0 40px}
.trend__tick{position:absolute;left:0;right:0;border-top:1px solid var(--grid)}
.trend__tick:last-of-type{border-top-color:rgba(255,255,255,.16)}
.trend__tick span{position:absolute;right:calc(100% + 10px);top:-9px;font:500 12px/1 var(--mono);color:var(--text-3);font-variant-numeric:tabular-nums}
.trend__svg{position:absolute;inset:0;width:100%;height:100%;overflow:visible}
.trend__area{fill:url(#wash)}
.trend__ghost{fill:none;stroke:var(--ghost);stroke-width:2;vector-effect:non-scaling-stroke;stroke-linejoin:round;stroke-linecap:round;opacity:.9}
.trend__line{fill:none;stroke:var(--data);stroke-width:2.5;vector-effect:non-scaling-stroke;stroke-linejoin:round;stroke-linecap:round;filter:drop-shadow(0 0 6px rgba(201,133,0,.55))}
.js .trend__svg{clip-path:inset(-24px 100% -24px -24px)}
.js .is-in .trend__svg{animation:wipe 1.6s cubic-bezier(.4,0,.2,1) .15s forwards}
@keyframes wipe{to{clip-path:inset(-24px -24px -24px -24px)}}
.trend__peak{position:absolute;transform:translate(-50%,calc(-100% - 10px));font:650 13px/1 var(--font);color:var(--text);background:rgba(7,8,10,.7);border:1px solid rgba(227,194,122,.35);padding:4px 8px;border-radius:999px;white-space:nowrap;pointer-events:none;transition:opacity .2s}
.trend__hit{position:absolute;inset:0;cursor:crosshair;touch-action:pan-y;border-radius:8px}
.trend__cross,.trend__dot,.trend__tip{position:absolute;opacity:0;transition:opacity .15s;pointer-events:none}
.is-active .trend__cross,.is-active .trend__dot,.is-active .trend__tip{opacity:1}
.is-active .trend__peak{opacity:0}
.trend__cross{top:0;bottom:0;width:1px;background:linear-gradient(to bottom,transparent,rgba(241,220,162,.55));transform:translateX(-.5px)}
.trend__dot{width:12px;height:12px;border-radius:50%;background:var(--data);border:2px solid var(--surface);box-shadow:0 0 0 4px rgba(201,133,0,.25),0 0 16px rgba(201,133,0,.7);transform:translate(-50%,50%);margin-bottom:0}
.trend__tip{top:-6px;transform:translateY(-100%);min-width:170px;background:rgba(14,15,18,.92);border:1px solid var(--line-2);border-radius:12px;padding:9px 12px;backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px);box-shadow:0 12px 30px rgba(0,0,0,.5);z-index:3}
.trend__tip p{margin:0;font-size:13px;line-height:1.5;white-space:nowrap;display:flex;align-items:center;gap:6px}
.trend__tip strong{font-size:15px}
.trend__when{color:var(--text-3);font:500 11.5px/1.6 var(--mono)!important;text-transform:uppercase;letter-spacing:.06em}
.trend__axis{position:relative;height:22px;margin:8px 0 0 40px;font:500 12px/1 var(--mono);color:var(--text-3)}
.trend__x{position:absolute;top:4px;transform:translateX(-50%);white-space:nowrap}
.trend__x.is-first{transform:none}
.trend__x.is-last{transform:translateX(-100%)}
.table-view{margin-top:10px;font-size:14px}
.table-view summary{cursor:pointer;color:var(--text-3);font-size:13px;width:max-content}
/* tiles */
.tiles{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:14px;margin:0 0 16px}
.tile{margin:0;padding:18px 18px 0;display:flex;flex-direction:column;gap:6px;overflow:hidden}
.tile__value{margin:2px 0 0;font:650 clamp(30px,4.4vw,40px)/1.05 var(--font);letter-spacing:-.03em}
.spark{position:relative;height:38px;margin:6px -18px 0;-webkit-mask-image:linear-gradient(90deg,transparent,#000 12%);mask-image:linear-gradient(90deg,transparent,#000 12%)}
.spark svg{position:absolute;left:18px;right:18px;top:4px;bottom:4px;width:calc(100% - 36px);height:30px;overflow:visible}
.spark path{fill:none;stroke:var(--ghost);stroke-width:1.6;vector-effect:non-scaling-stroke;stroke-linejoin:round}
.spark i{position:absolute;right:14px;width:8px;height:8px;border-radius:50%;background:var(--data);box-shadow:0 0 10px rgba(201,133,0,.8);transform:translateY(50%)}
.grid2{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:0 16px;align-items:start}
/* meters: out of 100 visits */
.meters,.rank{list-style:none;margin:0;padding:0;display:grid;gap:14px}
.meters li,.rank li{display:grid;grid-template-columns:minmax(0,1fr) auto;grid-template-areas:"name val" "track track";gap:6px 12px;font-size:14px}
.meters__name,.rank__name{grid-area:name;color:var(--text-2)}
.meters__val,.rank__val{grid-area:val;font-weight:650;font-variant-numeric:tabular-nums}
.meters__val small,.rank__val small{font-weight:400;color:var(--text-3);margin-left:4px}
.meters__track,.rank__track{grid-area:track;height:8px;border-radius:999px;background:rgba(255,255,255,.06);overflow:hidden}
.meters__track i,.rank__track i{display:block;height:100%;width:var(--w);border-radius:999px;background:linear-gradient(90deg,#8a5c00,var(--data));transform-origin:left}
.meters .is-key .meters__name{color:var(--text);font-weight:600}
.meters .is-key .meters__track i{box-shadow:0 0 14px rgba(201,133,0,.6)}
.js .reveal .meters__track i,.js .reveal .rank__track i,.js .reveal .months__bar i,.js .reveal .seg i{transform:scaleX(0);transition:transform 1.1s cubic-bezier(.2,.7,.2,1) .2s}
.js .reveal.is-in .meters__track i,.js .reveal.is-in .rank__track i,.js .reveal.is-in .months__bar i,.js .reveal.is-in .seg i{transform:none}
.chips{list-style:none;margin:0;padding:0;display:flex;flex-wrap:wrap;gap:8px}
.chips li{font-size:13px;color:var(--text-2);padding:5px 10px;border-radius:999px;border:1px solid var(--line);background:rgba(255,255,255,.03)}
.chips b{color:var(--text);margin-left:4px;font-weight:650}
/* months */
.months{list-style:none;margin:0;padding:0}
.months li{display:grid;grid-template-columns:minmax(0,1.2fr) minmax(0,1fr) 6.2em;grid-template-areas:"name bar evo" "v1 v2 evo";gap:4px 14px;align-items:center;padding:10px 0;border-bottom:1px solid var(--grid);font-size:14px}
.months li:last-child{border-bottom:0}
.months__name{grid-area:name;text-transform:capitalize;color:var(--text)}
.months__bar{grid-area:bar;height:6px;border-radius:999px;background:rgba(255,255,255,.06);overflow:hidden}
.months__bar i{display:block;height:100%;width:var(--w);background:linear-gradient(90deg,#8a5c00,var(--data));border-radius:999px;transform-origin:left}
.months__val{font-weight:600;font-variant-numeric:tabular-nums}
.months__val:nth-of-type(3){grid-area:v1}
.months__val:nth-of-type(4){grid-area:v2}
.months__val small{color:var(--text-3);font-weight:400}
.months__evo{grid-area:evo;justify-self:end}
/* devices */
.devices{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:14px}
.device{padding:14px;border-radius:16px;background:rgba(255,255,255,.03);border:1px solid var(--line)}
.device__ico{display:inline-grid;place-items:center;width:34px;height:34px;border-radius:10px;background:rgba(201,133,0,.14);color:#f0b84a}
.device__ico--ordinateur{background:rgba(57,135,229,.16);color:#8fbaf3}
.device__pct{margin:10px 0 2px;font:650 30px/1 var(--font);letter-spacing:-.03em}
.device__name{margin:0;font-size:13px;color:var(--text-2);display:flex;align-items:center;gap:6px;flex-wrap:wrap}
.device__name small{color:var(--text-3)}
.swatch{display:inline-block;width:9px;height:9px;border-radius:3px}
.swatch--telephone,.seg__telephone{background:var(--data)}
.swatch--ordinateur,.seg__ordinateur{background:var(--data-2)}
.seg{display:flex;gap:2px;height:8px}
.seg i{display:block;width:var(--w);border-radius:999px;transform-origin:left}
.kv{list-style:none;margin:0;padding:0}
.kv li{display:flex;align-items:center;gap:10px;padding:9px 0;border-bottom:1px solid var(--grid);font-size:14px}
.kv li:last-child{border-bottom:0}
.kv li>span:first-child{flex:1;color:var(--text-2)}
.kv strong{font-variant-numeric:tabular-nums}
/* pages: ranked, a wash behind each row */
.pages{list-style:none;margin:0;padding:0;display:grid;gap:6px}
.pages li{position:relative;display:grid;grid-template-columns:28px minmax(0,1fr) auto;align-items:center;gap:10px;padding:9px 12px;border-radius:12px;font-size:14px;overflow:hidden;isolation:isolate}
.pages li::before{content:"";position:absolute;inset:0;width:var(--w);background:linear-gradient(90deg,rgba(201,133,0,.16),rgba(201,133,0,.04));border-radius:12px;z-index:-1}
.pages__rank{font:600 12px/1 var(--mono);color:var(--gold)}
.pages__name{overflow-wrap:anywhere}
.pages__val{font-weight:650;text-align:right;font-variant-numeric:tabular-nums;display:flex;flex-direction:column;line-height:1.25}
.pages__val small{font-weight:400;color:var(--text-3);font-size:12px}
/* tables */
table{border-collapse:collapse;width:100%}
.list{font-size:14px}
.list th,.list td{text-align:left;padding:9px 10px 9px 0;border-bottom:1px solid var(--grid);vertical-align:top}
.list thead th{font:500 11px/1.3 var(--mono);letter-spacing:.1em;text-transform:uppercase;color:var(--text-3)}
.list th[scope=row]{font-weight:500;color:var(--text-2)}
.list .n{text-align:right;font-variant-numeric:tabular-nums;white-space:nowrap;padding-right:0;padding-left:12px}
.list td{overflow-wrap:anywhere}
.note{font-size:13px;color:var(--text-3);margin:12px 0 0}
/* versus */
.vs{display:grid;grid-template-columns:1fr auto 1fr;align-items:center;gap:12px;margin-bottom:12px}
.vs__side{padding:16px;border-radius:16px;background:rgba(255,255,255,.03);border:1px solid var(--line)}
.vs__side--new{border-color:rgba(227,194,122,.3);background:linear-gradient(180deg,rgba(227,194,122,.08),rgba(227,194,122,.02))}
.vs__side .dim{margin:0;font-size:13px}
.vs__big{margin:4px 0;font:650 clamp(32px,6vw,48px)/1 var(--font);letter-spacing:-.03em}
.badge{display:inline-grid;place-items:center;min-width:52px;height:52px;padding:0 10px;border-radius:999px;font:700 15px/1 var(--font);color:var(--text-2);background:rgba(255,255,255,.06);border:1px solid var(--line-2)}
.badge--up{color:#0a0a0b;background:linear-gradient(180deg,var(--gold-2),var(--gold));border:0;box-shadow:0 0 24px rgba(227,194,122,.45)}
.badge--down{color:var(--down);background:var(--down-bg)}
.notes{font-size:14px;color:var(--text-2);padding:6px 0 40px}
.notes summary{cursor:pointer;font-weight:600;color:var(--text);width:max-content;margin-bottom:10px}
.notes ul{padding-left:18px;margin:0}
.notes li{margin:0 0 6px}
code{font:12.5px var(--mono);background:rgba(255,255,255,.07);padding:1px 6px;border-radius:6px;word-break:break-all}
.denied{padding-top:18vh}
@media (max-width:860px){.tiles{grid-template-columns:repeat(2,minmax(0,1fr))}.grid2{grid-template-columns:minmax(0,1fr)}}
@media (max-width:520px){.tiles{gap:10px}.tile{padding:14px 14px 0}.spark{margin:4px -14px 0}.card{padding:16px;border-radius:18px}.hero{padding:18px 16px 14px}.trend__plot{margin-left:32px}.trend__axis{margin-left:32px}.trend__x.is-minor{display:none}.device__pct{font-size:26px}.vs{grid-template-columns:1fr}.vs__mid{justify-self:center}.months li{grid-template-columns:minmax(0,1fr) auto;grid-template-areas:"name evo" "bar bar" "v1 v2"}.months__val:nth-of-type(4){justify-self:end}.live{font-size:11px}}
@media (prefers-reduced-motion:reduce){*,*::before,*::after{animation:none!important;transition:none!important}.js .reveal{opacity:1;transform:none}.js .trend__svg{clip-path:none}}
`;
