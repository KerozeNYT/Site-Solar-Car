/**
 * The workshop's referral and promo codes page: GET /parrainage?cle=… (same key as the statistics page).
 *   - the promo campaigns (content/booking.js `promos`): period, state, uses (online, at the
 *     workshop), amount of the services and of the discounts, last uses;
 *   - the figures of the referral codes: codes given, codes used, discounts granted;
 *   - « Un client utilise un code à l'atelier »: checks a code and marks it used (a service booked
 *     by phone or quoted at the workshop); a promo code is noted with the price of the service;
 *   - « Donner un code à un client »: a code for any client (shown here, to give by text message,
 *     on a card…);
 *   - every code, with its state.
 * The forms post to the same address (POST), then come back here with a message.
 */
import { bookingRules as R, promoOf, percentOff, dayText, formatEuros } from '../content/booking.js';
import { business as B } from '../content/site.js';
import { listReferrals, referralFor, redeemReferral, checkReferral } from './referral.js';
import { listPromos, usePromo, checkPromo } from './promo.js';

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
    if (action === 'utiliser' && promoOf(f.get('code'))) {
      // a promo code at the workshop (a service quoted with the code): noted with its price
      const p = promoOf(f.get('code'));
      const who = String(f.get('client') || '').trim() || 'client de l’atelier';
      const price = Number(String(f.get('montant') || '').replace(/\s|€/g, '').replace(',', '.'));
      if (!(price > 0)) return back({ err: `Code ${p.code} : indiquez le prix de la prestation avant remise, pour calculer les ${p.percent} %.` });
      const discount = percentOff({ total: price }, p.percent);
      const total = Math.round((price - discount) * 100) / 100;
      const r = await usePromo(env, p.code, { ref: `atelier-${now}`, who, place: 'à l’atelier', detail: String(f.get('prestation') || '').trim(), total, discount }, now);
      if (!r.ok) return back({ err: r.error });
      const today = new Intl.DateTimeFormat('en-CA', { timeZone: R.timeZone }).format(new Date(now));
      const outside = today < p.from || today > p.to ? ` Attention : l’offre court du ${dayText(p.from)} au ${dayText(p.to)} ; vérifiez que la demande de devis date de cette période.` : '';
      return back({ ok: `Code ${p.code} noté pour ${who} : ${formatEuros(price)} − ${p.percent} % (−${formatEuros(discount)}) = ${formatEuros(total)}.${outside}` });
    }
    if (action === 'verifier' && promoOf(f.get('code'))) {
      const r = await checkPromo(env, String(f.get('code') || ''), now);
      return back(r.ok ? { ok: `Code ${r.code} valable aujourd’hui : −${r.percent} %, jusqu’au ${dayText(r.to)}${r.left != null ? ` (encore ${r.left} utilisation${r.left > 1 ? 's' : ''})` : ''}.` } : { err: r.error });
    }
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
  const [data, { promos }] = await Promise.all([listReferrals(env), listPromos(env, now)]);
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
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: R.timeZone }).format(new Date(now));
  const promoTag = (p) =>
    today < p.from
      ? '<span class="tag tag--off">À venir</span>'
      : today > p.to
        ? '<span class="tag tag--off">Terminée</span>'
        : p.state.ok
          ? '<span class="tag tag--ok">En cours</span>'
          : '<span class="tag tag--used">Épuisée</span>';
  const promoCards = promos.length
    ? promos
        .map(
          (p) => `<div class="promo"><div class="promo__head"><span class="code promo__code">${esc(p.code)}</span>${promoTag(p)}</div>
<p class="promo__what">−${p.percent} % sur toutes les prestations · ${esc(p.label || '')}<br><small>Réservations et demandes de devis du ${esc(dayText(p.from))} au ${esc(dayText(p.to))} · ${p.uses == null ? 'utilisations illimitées' : `${p.uses} utilisations au plus`}</small></p>
<div class="figs figs--promo"><div class="fig"><b>${p.used}</b><span>utilisations<br>${p.online} en ligne · ${p.used - p.online} à l’atelier</span></div><div class="fig"><b>${esc(formatEuros(p.total))}</b><span>de prestations<br>(remise déduite)</span></div><div class="fig"><b>${esc(formatEuros(p.discount))}</b><span>de remises</span></div></div>
${p.last.length ? `<table><thead><tr><th scope="col">Date</th><th scope="col">Client</th><th scope="col">Montant</th></tr></thead><tbody>${p.last.map((u) => `<tr><td>${esc(day(u.at))}<small>${esc(u.place)}</small></td><td>${esc(u.who)}<small>${esc(u.detail)}</small></td><td>${esc(formatEuros(u.total))}<small>−${esc(formatEuros(u.discount))}</small></td></tr>`).join('')}</tbody></table>` : '<p class="empty">Pas encore utilisé.</p>'}</div>`
        )
        .join('')
    : '';
  const html = `<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>Parrainage et codes promo — ${esc(B.name)}</title>
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
.promo{background:var(--card);border:1px solid var(--gold);border-radius:14px;padding:16px;margin:0 0 20px}.promo__head{display:flex;align-items:center;gap:10px;margin:0 0 6px}.promo__code{font-size:22px;font-weight:800}.promo__what{margin:0 0 12px}.promo__what small{color:var(--dim)}
.figs--promo{margin:0 0 12px}.figs--promo .fig{background:#0f1115}.promo table{background:#0f1115}h2.part{font-size:18px;margin:28px 0 12px}
.tag{display:inline-block;font-size:12px;font-weight:700;border-radius:999px;padding:2px 8px}.tag--ok{background:#13261a;color:var(--ok)}.tag--used{background:#2a2414;color:var(--gold)}.tag--off{background:#222;color:var(--dim)}
@media (max-width:640px){.grid{grid-template-columns:1fr}.figs{grid-template-columns:1fr 1fr 1fr}.fig b{font-size:20px}th:nth-child(2),td:nth-child(2){display:none}}
</style></head><body><main>
<h1><span>Parrainage</span> et codes promo — ${esc(B.name)}</h1>
<p class="lead">Un seul code par réservation ou par devis : un code promo et un code de parrainage ne s’additionnent jamais.</p>
${msg}${fresh}
${promoCards ? `<h2 class="part">Codes promo</h2>${promoCards}` : ''}
<h2 class="part">Parrainage</h2>
<p class="lead">Chaque client reçoit un code personnel : ${R.referral.amount} € de remise pour un proche (ou pour une autre voiture), une seule fois, pendant ${R.referral.months} mois.</p>
<div class="figs"><div class="fig"><b>${data.given}</b><span>codes donnés</span></div><div class="fig"><b>${data.used}</b><span>codes utilisés</span></div><div class="fig"><b>${data.offered} €</b><span>de remises offertes</span></div></div>
<div class="grid">
<form class="card" method="post" action="${esc(action)}"><h2>Un client utilise un code à l’atelier</h2>
<label for="u-code">Code (parrainage ou promo)</label><input id="u-code" name="code" required autocomplete="off" placeholder="JEAN-7K2QX ou ${esc(promos[0]?.code || 'NOEL15')}">
<label for="u-client">Client qui en profite</label><input id="u-client" name="client" autocomplete="off" placeholder="Prénom et nom">
<label for="u-presta">Code promo : prestation <span>(facultatif)</span></label><input id="u-presta" name="prestation" autocomplete="off" placeholder="ex. Ciel étoilé">
<label for="u-montant">Code promo : prix avant remise (€)</label><input id="u-montant" name="montant" inputmode="decimal" autocomplete="off" placeholder="ex. 450">
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
