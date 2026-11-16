/**
 * The monthly statistics e-mail: on the 1st of each month (cron in booking/wrangler.toml), the
 * month that just ended, compared with the month before and with the same month a year earlier,
 * sent to the workshop (env.NOTIFY_TO) through Resend (booking/mail.js). Nothing is sent while
 * the public site has no visit (before it is online on solarcar37.fr).
 *
 *   GET  /stats/bilan?cle=…&mois=YYYY-MM[&site=apercu]   the e-mail, shown in the browser
 *   POST /stats/bilan?cle=…&mois=YYYY-MM[&site=apercu]   sends it now (a test, the subject says so)
 */
import { report, totalsOf, SOURCES, HEARD, TZ } from './stats.js';
import { utcToZoned, addDays } from './schedule.js';
import { send, shell } from './mail.js';

const list = (s) => (s || '').split(',').map((x) => x.trim()).filter(Boolean);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const nf = (v) => new Intl.NumberFormat('fr-FR').format(v);
const n1 = (v) => new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 1 }).format(v);
const eur = (v) => new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(v);
const visits = (n) => `${nf(n)} visite${n > 1 ? 's' : ''}`;
const monthName = (ym, year = true) => new Intl.DateTimeFormat('fr-FR', { month: 'long', ...(year ? { year: 'numeric' } : {}), timeZone: 'UTC' }).format(new Date(`${ym}-15T12:00:00Z`));

/** "YYYY-MM" shifted by n months */
export function shiftMonth(ym, n) {
  const [y, m] = ym.split('-').map(Number);
  const d = new Date(Date.UTC(y, m - 1 + n, 1));
  return d.toISOString().slice(0, 7);
}
const bounds = (ym) => ({ from: `${ym}-01`, to: addDays(`${shiftMonth(ym, 1)}-01`, -1) });

/** the figures of a month, the month before and the same month a year earlier */
export async function monthFigures(env, month, site = 'site') {
  const m = bounds(month);
  const p = bounds(shiftMonth(month, -1));
  const y = bounds(shiftMonth(month, -12));
  const r = await report(env, { site, from: m.from, to: m.to, pfrom: p.from, pto: p.to });
  const ly = await report(env, { site, from: y.from, to: y.to, pfrom: y.from, pto: y.to });
  return { month, site, first: r.first, cur: totalsOf(r.totals), prev: totalsOf(r.previous), year: totalsOf(ly.totals), sources: r.sources, pages: r.pages, heard: r.heard || [] };
}

const change = (cur, prev) => (prev ? Math.round(((cur - prev) / prev) * 100) : null);

/** { subject, html } of the e-mail */
export function monthMail(f, { dashboard, test = false } = {}) {
  const { cur, prev, year } = f;
  const name = monthName(f.month);
  const before = monthName(shiftMonth(f.month, -1), false);
  const lastYear = monthName(shiftMonth(f.month, -12));
  const dv = change(cur.visits, prev.visits);
  const rate = (t) => (t.visits ? (t.contacts / t.visits) * 100 : 0);
  // the verdict, from the visits (stable within ±5 %)
  const tone = dv === null ? 'new' : dv >= 5 ? 'up' : dv <= -5 ? 'down' : 'flat';
  const verdict = {
    new: [`Premier mois compté : ${visits(cur.visits)}.`, '#f4f2ee', '#3d3a33', '●'],
    up: [`Mois en hausse : ${visits(cur.visits)}, +${dv} % par rapport à ${before}.`, '#e6f4e6', '#0d5c0d', '▲'],
    down: [`Mois en baisse : ${visits(cur.visits)}, −${Math.abs(dv)} % par rapport à ${before}.`, '#fbe9e7', '#9b2316', '▼'],
    flat: [`Mois stable : ${visits(cur.visits)} (${dv > 0 ? '+' : dv < 0 ? '−' : ''}${Math.abs(dv)} % par rapport à ${before}).`, '#f4f2ee', '#3d3a33', '■'],
  }[tone];
  const showYear = year.visits > 0;
  const evo = (a, b) => {
    const c = change(a, b);
    if (c === null) return '<span style="color:#8a877f">—</span>';
    if (c === 0) return '<span style="color:#55524b">stable</span>';
    return c > 0 ? `<span style="color:#0d5c0d;font-weight:700">▲ +${c} %</span>` : `<span style="color:#9b2316;font-weight:700">▼ −${Math.abs(c)} %</span>`;
  };
  const td = 'padding:9px 8px;border-bottom:1px solid #ece8e0;text-align:right;white-space:nowrap';
  const row = (label, a, b, c, ev) => `<tr><td style="padding:9px 8px 9px 0;border-bottom:1px solid #ece8e0;color:#111">${label}</td><td style="${td};font-weight:700;color:#111">${a}</td><td style="${td};color:#55524b">${b}</td>${showYear ? `<td style="${td};color:#55524b">${c}</td>` : ''}<td style="${td}">${ev}</td></tr>`;
  const rows = [
    row('Visites', nf(cur.visits), nf(prev.visits), nf(year.visits), evo(cur.visits, prev.visits)),
    row('Pages vues', nf(cur.views), nf(prev.views), nf(year.views), evo(cur.views, prev.views)),
    row('Demandes envoyées', nf(cur.demande_envoyee), nf(prev.demande_envoyee), nf(year.demande_envoyee), evo(cur.demande_envoyee, prev.demande_envoyee)),
    row('RDV réservés en ligne', `${nf(cur.rdv)}${cur.rdv ? `<br><small style="font-weight:400;color:#55524b">${eur(cur.paid)}</small>` : ''}`, nf(prev.rdv), nf(year.rdv), evo(cur.rdv, prev.rdv)),
    row('Appels', nf(cur.appel), nf(prev.appel), nf(year.appel), evo(cur.appel, prev.appel)),
    row('Taux de contact', `${n1(rate(cur))} %`, `${n1(rate(prev))} %`, `${n1(rate(year))} %`, evo(rate(cur), rate(prev))),
  ].join('');
  const total = f.sources.reduce((a, s) => a + s.n, 0);
  const sources = [...f.sources]
    .sort((a, b) => b.n - a.n)
    .slice(0, 4)
    .map((s) => `<tr><td style="padding:5px 0;color:#111">${esc(SOURCES[s.source] || s.source)}</td><td style="padding:5px 0;text-align:right;font-weight:700;color:#111">${total ? Math.round((s.n / total) * 100) : 0} %</td></tr>`)
    .join('');
  const pages = f.pages
    .slice(0, 3)
    .map((p) => `<tr><td style="padding:5px 0;color:#111">${esc(p.page === '/' ? 'Accueil' : p.page)}</td><td style="padding:5px 0;text-align:right;color:#55524b">${nf(p.views)} vues</td></tr>`)
    .join('');
  // « Comment nous avez-vous connus ? »: the answers of the month, most frequent first
  const heard = (f.heard || [])
    .filter((x) => HEARD[x.source] && x.source !== 'sans')
    .sort((a, b) => b.n - a.n)
    .slice(0, 5)
    .map((x) => `<tr><td style="padding:5px 0;color:#111">${esc(HEARD[x.source])}</td><td style="padding:5px 0;text-align:right;font-weight:700;color:#111">${nf(x.n)}</td></tr>`)
    .join('');
  const h2 = 'margin:22px 0 8px;font-size:15px;color:#111';
  const body = `
<p style="margin:0 0 16px;padding:12px 14px;border-radius:10px;background:${verdict[1]};color:${verdict[2]};font-size:15px;font-weight:700"><span aria-hidden="true">${verdict[3]}</span> ${esc(verdict[0])}</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="font-size:14px;border-collapse:collapse">
<tr><td style="padding:0 8px 6px 0;color:#8a877f;font-size:12px"></td><td style="padding:0 8px 6px;text-align:right;color:#8a877f;font-size:12px">${esc(name)}</td><td style="padding:0 8px 6px;text-align:right;color:#8a877f;font-size:12px">${esc(before)}</td>${showYear ? `<td style="padding:0 8px 6px;text-align:right;color:#8a877f;font-size:12px">${esc(lastYear)}</td>` : ''}<td style="padding:0 8px 6px;text-align:right;color:#8a877f;font-size:12px">Évolution</td></tr>
${rows}
</table>
${sources ? `<h2 style="${h2}">D’où viennent les visiteurs</h2><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="font-size:14px">${sources}</table>` : ''}
${heard ? `<h2 style="${h2}">Comment ils vous ont connus</h2><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="font-size:14px">${heard}</table>` : ''}
${pages ? `<h2 style="${h2}">Pages les plus vues</h2><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="font-size:14px">${pages}</table>` : ''}
${dashboard ? `<p style="margin:24px 0 4px"><a href="${esc(dashboard)}" style="display:inline-block;background:#0b0c0f;color:#e9cd82;text-decoration:none;font-weight:700;padding:12px 18px;border-radius:10px">Ouvrir le tableau de bord</a></p>` : ''}
<p style="margin:16px 0 0;color:#8a877f;font-size:12px">Comptage sans cookie du site ${f.site === 'apercu' ? '(aperçu et essais, pas les vrais visiteurs)' : 'public'}. Évolution : par rapport à ${esc(before)}.</p>`;
  const dvText = dv === null ? '' : ` (${dv > 0 ? '+' : dv < 0 ? '−' : ''}${Math.abs(dv)} %)`;
  const requests = cur.requests ? `${nf(cur.requests)} demande${cur.requests > 1 ? 's' : ''} et RDV` : 'aucune demande ni RDV';
  const subject = `${test ? '[Essai] ' : ''}Bilan de ${name} : ${visits(cur.visits)}${dvText}, ${requests}`;
  return { subject, html: shell(`Bilan de ${name}`, body) };
}

const dashboardOf = (env, month) => (env.STATS_PAGE && env.STATS_KEY ? `${env.STATS_PAGE}?${new URLSearchParams({ cle: env.STATS_KEY, periode: '30' })}` : '');

/** the cron: the month that just ended, if the public site had visits */
export async function sendMonthly(env, now = Date.now()) {
  if (!env.STATS || !env.RESEND_API_KEY || !list(env.NOTIFY_TO).length) return { sent: false, why: 'not configured' };
  const month = shiftMonth(utcToZoned(now, TZ).date.slice(0, 7), -1);
  const f = await monthFigures(env, month, 'site');
  if (!f.cur.visits && !f.prev.visits) return { sent: false, why: 'no visit yet' };
  const mail = monthMail(f, { dashboard: dashboardOf(env, month) });
  await send(env, { to: list(env.NOTIFY_TO), ...mail });
  return { sent: true, subject: mail.subject };
}

/** /stats/bilan: the e-mail in the browser (GET), or sent now as a test (POST) */
export async function monthRoute(req, env, url, now) {
  const month = /^\d{4}-\d{2}$/.test(url.searchParams.get('mois') || '') ? url.searchParams.get('mois') : shiftMonth(utcToZoned(now, TZ).date.slice(0, 7), -1);
  const site = url.searchParams.get('site') === 'apercu' ? 'apercu' : 'site';
  const f = await monthFigures(env, month, site);
  const test = req.method === 'POST';
  const mail = monthMail(f, { dashboard: dashboardOf(env, month), test });
  if (test) {
    if (!env.RESEND_API_KEY) return Response.json({ sent: false, why: 'RESEND_API_KEY' }, { status: 503 });
    await send(env, { to: list(env.NOTIFY_TO), ...mail });
    return Response.json({ sent: true, subject: mail.subject });
  }
  return new Response(mail.html, { headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store', 'x-robots-tag': 'noindex, nofollow', 'referrer-policy': 'no-referrer', 'content-security-policy': "default-src 'none'; style-src 'unsafe-inline'; img-src data:" } });
}
