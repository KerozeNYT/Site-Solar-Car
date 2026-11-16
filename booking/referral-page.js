/**
 * The workshop's referral page: GET /parrainage?cle=… (same key as the statistics page).
 *   - the figures: codes given, codes used, discounts granted;
 *   - « Un client utilise un code à l'atelier »: checks a code and marks it used (a service booked
 *     by phone or quoted at the workshop);
 *   - « Donner un code à un client »: a code for any client (shown here, to give by text message,
 *     on a card…);
 *   - every code, with its state.
 * The forms post to the same address (POST), then come back here with a message.
 */
import { bookingRules as R } from '../content/booking.js';
import { business as B } from '../content/site.js';
import { listReferrals, referralFor, redeemReferral, checkReferral } from './referral.js';

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const day = (ms) => new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short', year: 'numeric', timeZone: R.timeZone }).format(new Date(ms));
const HEADERS = {
  'content-type': 'text/html; charset=utf-8',
  'cache-control': 'no-store',
  'x-robots-tag': 'noindex, nofollow',
  // the key is in the address: never sent to another site
  'referrer-policy': 'no-referrer',
  'x-content-type-options': 'nosniff',
  'content-security-policy': "default-src 'none'; style-src 'unsafe-inline'; img-src data:; form-action 'self'; frame-ancestors 'none'; base-uri 'none'",
};

export async function referralPage(req, env, url, now) {
  if (!env.PARRAINAGE) return new Response('Parrainage non configuré', { status: 503, headers: HEADERS });
  const key = url.searchParams.get('cle') || '';
  const back = (q) => new Response(null, { status: 303, headers: { location: `/parrainage?${new URLSearchParams({ cle: key, ...q })}`, 'cache-control': 'no-store', 'referrer-policy': 'no-referrer' } });
  if (req.method === 'POST') {
    const f = await req.formData().catch(() => new FormData());
    const action = f.get('action');
    if (action === 'utiliser') {
      const code = String(f.get('code') || '');
      const who = String(f.get('client') || '').trim() || 'client de l’atelier';
      const r = await redeemReferral(env, code, { by: who, ref: `atelier-${now}`, where: 'à l’atelier' }, now);
      return back(r.ok ? { ok: `Code ${code.toUpperCase()} utilisé : ${R.referral.amount} € de remise pour ${who}.` } : { err: r.error });
    }
    if (action === 'verifier') {
      const r = await checkReferral(env, String(f.get('code') || ''), now);
      return back(r.ok ? { ok: `Code ${r.code} valable (${r.amount} €, client ${r.owner}) jusqu’au ${day(r.expires)} : pas encore utilisé.` } : { err: r.error });
    }
    if (action === 'creer') {
      const owner = String(f.get('prenom') || '').trim();
      if (!owner) return back({ err: 'Indiquez le prénom du client.' });
      const r = await referralFor(env, { owner, email: String(f.get('email') || ''), origin: `atelier-${now}` }, now);
      return back({ nouveau: r.code, pour: owner });
    }
    return back({ err: 'Action inconnue.' });
  }
  const data = await listReferrals(env);
  const msg = url.searchParams.get('ok') ? `<p class="msg msg--ok">${esc(url.searchParams.get('ok'))}</p>` : url.searchParams.get('err') ? `<p class="msg msg--err">${esc(url.searchParams.get('err'))}</p>` : '';
  const fresh = url.searchParams.get('nouveau')
    ? `<div class="new"><p>Code de ${esc(url.searchParams.get('pour') || '')} : à lui donner (SMS, carte…), valable ${R.referral.months} mois, une fois.</p><p class="new__code">${esc(url.searchParams.get('nouveau'))}</p></div>`
    : '';
  const state = (c) =>
    c.used
      ? `<span class="tag tag--used">Utilisé le ${esc(day(c.used))}</span><small>${esc(c.used_by)} · ${esc(c.used_where)}</small>`
      : c.expires < now
        ? '<span class="tag tag--off">Expiré</span>'
        : `<span class="tag tag--ok">Disponible</span><small>jusqu’au ${esc(day(c.expires))}</small>`;
  const rows = data.codes.length
    ? data.codes.map((c) => `<tr><td class="code">${esc(c.code)}</td><td>${esc(c.owner)}<small>${c.origin.startsWith('atelier') ? 'donné à l’atelier' : 'e-mail après RDV'} · ${esc(day(c.created))}</small></td><td>${state(c)}</td></tr>`).join('')
    : '<tr><td colspan="3" class="empty">Aucun code pour l’instant : ils partent avec l’e-mail envoyé une semaine après chaque RDV, ou se créent ci-dessus.</td></tr>';
  const action = `/parrainage?cle=${encodeURIComponent(key)}`;
  const html = `<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>Parrainage — ${esc(B.name)}</title>
<style>
:root{color-scheme:dark;--bg:#0b0c0f;--card:#15171c;--line:#2a2d35;--gold:#e9cd82;--text:#f2efe8;--dim:#9a968c;--ok:#7fd49b;--err:#ff8a7a}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--text);font:15px/1.5 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif}
main{max-width:860px;margin:0 auto;padding:24px 16px 48px}h1{font-size:24px;margin:0 0 4px}h1 span{color:var(--gold)}h2{font-size:16px;margin:0 0 12px}
.lead{color:var(--dim);margin:0 0 20px}.figs{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin:0 0 20px}
.fig{background:var(--card);border:1px solid var(--line);border-radius:14px;padding:14px}.fig b{display:block;font-size:26px;color:var(--gold)}.fig span{color:var(--dim);font-size:13px}
.grid{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin:0 0 20px}.card{background:var(--card);border:1px solid var(--line);border-radius:14px;padding:16px}
label{display:block;font-size:13px;color:var(--dim);margin:0 0 4px}input{width:100%;padding:10px 12px;border-radius:10px;border:1px solid var(--line);background:#0f1115;color:var(--text);font:inherit;margin:0 0 10px}
input[name=code]{text-transform:uppercase;font-family:ui-monospace,Menlo,Consolas,monospace;letter-spacing:.08em}
.btns{display:flex;gap:8px;flex-wrap:wrap}button{border:0;border-radius:999px;padding:10px 16px;font:inherit;font-weight:700;cursor:pointer;background:var(--gold);color:#0b0c0f}button.ghost{background:transparent;color:var(--gold);border:1px solid var(--gold)}
.msg{padding:12px 14px;border-radius:12px;margin:0 0 16px;font-weight:600}.msg--ok{background:#13261a;color:var(--ok)}.msg--err{background:#2a1513;color:var(--err)}
.new{background:var(--card);border:1px solid var(--gold);border-radius:14px;padding:16px;margin:0 0 20px}.new p{margin:0}.new__code{font:800 28px/1.2 ui-monospace,Menlo,Consolas,monospace;letter-spacing:.12em;color:var(--gold);margin-top:8px!important}
table{width:100%;border-collapse:collapse;background:var(--card);border:1px solid var(--line);border-radius:14px;overflow:hidden}th,td{text-align:left;padding:10px 12px;border-bottom:1px solid var(--line);vertical-align:top}th{color:var(--dim);font-size:12px;font-weight:600}
td small{display:block;color:var(--dim);font-size:12px}.code{font-family:ui-monospace,Menlo,Consolas,monospace;letter-spacing:.06em;color:var(--gold);white-space:nowrap}.empty{color:var(--dim)}
.tag{display:inline-block;font-size:12px;font-weight:700;border-radius:999px;padding:2px 8px}.tag--ok{background:#13261a;color:var(--ok)}.tag--used{background:#2a2414;color:var(--gold)}.tag--off{background:#222;color:var(--dim)}
@media (max-width:640px){.grid{grid-template-columns:1fr}.figs{grid-template-columns:1fr 1fr 1fr}.fig b{font-size:20px}th:nth-child(2),td:nth-child(2){display:none}}
</style></head><body><main>
<h1><span>Parrainage</span> — ${esc(B.name)}</h1>
<p class="lead">Chaque client reçoit un code personnel : ${R.referral.amount} € de remise pour un proche (ou pour une autre voiture), une seule fois, pendant ${R.referral.months} mois.</p>
${msg}${fresh}
<div class="figs"><div class="fig"><b>${data.given}</b><span>codes donnés</span></div><div class="fig"><b>${data.used}</b><span>codes utilisés</span></div><div class="fig"><b>${data.offered} €</b><span>de remises offertes</span></div></div>
<div class="grid">
<form class="card" method="post" action="${esc(action)}"><h2>Un client utilise un code à l’atelier</h2>
<label for="u-code">Code</label><input id="u-code" name="code" required autocomplete="off" placeholder="JEAN-7K2QX">
<label for="u-client">Client qui en profite</label><input id="u-client" name="client" autocomplete="off" placeholder="Prénom et nom">
<div class="btns"><button name="action" value="utiliser">Utiliser le code</button><button class="ghost" name="action" value="verifier" formnovalidate>Vérifier seulement</button></div></form>
<form class="card" method="post" action="${esc(action)}"><h2>Donner un code à un client</h2>
<label for="c-prenom">Prénom du client</label><input id="c-prenom" name="prenom" required autocomplete="off">
<label for="c-email">E-mail <span>(facultatif)</span></label><input id="c-email" name="email" type="email" autocomplete="off">
<div class="btns"><button name="action" value="creer">Créer son code</button></div></form>
</div>
<table><thead><tr><th scope="col">Code</th><th scope="col">Client</th><th scope="col">État</th></tr></thead><tbody>${rows}</tbody></table>
</main></body></html>`;
  return new Response(html, { headers: HEADERS });
}
