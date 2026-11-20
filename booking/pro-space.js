// The professionals' own space (atelier.solarcar37.fr/pro): each partner sees only its own. The
// workshop makes its card (/atelier/pros/<n>) and one link to invite it; the partner chooses its
// password there (never seen by the workshop), signs the partnership agreement on its phone, and its
// space opens: its carbon card in 3D (its code on the back), its month (the confirmed appointments
// that bring it to −15 %), how to book, the prices. Installable on a phone (« Sur l'écran d'accueil »).
//
//   GET  /pro                    its space (or the login)
//   GET  /pro/invitation/<token> the password to choose (POST: saved, signed in)
//   GET  /pro/connexion          e-mail + password (POST: signed in) · GET /pro/deconnexion
//   POST /pro/signer             the agreement signed by the partner
//   GET  /pro/convention         the agreement, with both signatures · /pro/tarifs.pdf the prices
//   GET  /pro/logo, /pro/app.css, /pro/app.js, /pro/manifest.webmanifest
import { business as B } from '../content/site.js';
import { bookingRules as R } from '../content/booking.js';
import { vatNote } from '../content/pricing.js';
import { glazing } from '../content/regulation.js';
import { db, atelierFetch } from './store.js';
import { proSheetPdf } from './pro-sheet.js';
import { quote, withExtra, bookableVehicles, tintFormulas, lightsBooking, atelierExtras, formatDuration } from '../content/booking.js';
import { utcToZoned } from './schedule.js';
import { atelierBooking, atelierSlots } from './worker.js';
import { send, card as mailCard, shell as mailShell } from './mail.js';
import { notify } from './push.js';

const COOKIE = 'sc37_pro';
const DAYS = 90;
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const enc = new TextEncoder();
const b64 = (u8) => btoa(String.fromCharCode(...u8));
const unb64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
const dateFr = (ms) => new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long', year: 'numeric', timeZone: R.timeZone }).format(new Date(ms));
const timeFr = (ms) => new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: R.timeZone }).format(new Date(ms)).replace(':', ' h ');
const monthFr = (ym) => new Intl.DateTimeFormat('fr-FR', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${ym}-15T12:00:00Z`));
const dayFr = (d) => new Intl.DateTimeFormat('fr-FR', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' }).format(new Date(`${d}T12:00:00Z`));
const eur = (n) => new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: Number(n) % 1 ? 2 : 0 }).format(Number(n) || 0);
const site = (env) => String(env.SITE_URL || B.siteUrl).replace(/\/$/, '');

// ---------------------------------------------------------------- passwords and the session
/** PBKDF2-SHA-256, 100 000 rounds (the most a worker allows), 16 bytes of salt */
export async function hashPassword(pw, salt = crypto.getRandomValues(new Uint8Array(16))) {
  const key = await crypto.subtle.importKey('raw', enc.encode(pw), 'PBKDF2', false, ['deriveBits']);
  const bits = new Uint8Array(await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations: 100000 }, key, 256));
  return `pbkdf2$100000$${b64(salt)}$${b64(bits)}`;
}
export async function checkPassword(pw, stored) {
  const [, , salt, want] = String(stored || '').split('$');
  if (!salt || !want) return false;
  const got = (await hashPassword(pw, unb64(salt))).split('$')[3];
  let d = got.length ^ want.length;
  for (let i = 0; i < Math.min(got.length, want.length); i++) d |= got.charCodeAt(i) ^ want.charCodeAt(i);
  return d === 0;
}
async function hmac(secret, text) {
  const k = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return [...new Uint8Array(await crypto.subtle.sign('HMAC', k, enc.encode(text)))].map((x) => x.toString(16).padStart(2, '0')).join('');
}
/** the cookie names the partner and its password's stamp: a new password signs every device out */
const cookieFor = async (env, id, stamp, now) => {
  const exp = now + DAYS * 86400000;
  return `${COOKIE}=${id}.${exp}.${await hmac(env.ATELIER_SECRET, `pro:${id}:${exp}:${stamp}`)}; Path=/pro; Max-Age=${DAYS * 86400}; HttpOnly; Secure; SameSite=Lax`;
};
async function signedIn(req, env, now) {
  const m = (req.headers.get('cookie') || '').match(new RegExp(`${COOKIE}=(\\d+)\\.(\\d+)\\.([a-f0-9]{64})`));
  if (!m || Number(m[2]) < now) return null;
  const s = await db(env, 'pro/space', { id: Number(m[1]), now });
  if (!s.ok || !s.pro.active) return null;
  return (await hmac(env.ATELIER_SECRET, `pro:${m[1]}:${m[2]}:${s.pro.stamp}`)) === m[3] ? s : null;
}
/** a random token for the invitation link */
export const inviteToken = () => b64(crypto.getRandomValues(new Uint8Array(30))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

// ---------------------------------------------------------------- the agreement
/** the partnership agreement: [title, text] — the same text for both parties, their space and the workshop's */
export function agreement(pro, terms, code) {
  const T = terms;
  const D = Number(pro.discount) || Number(T.discount);
  return [
    ['Les parties', `${B.name} — ${B.legalName}, ${String(B.legalForm || '').replace(/^E/, 'e').replace(' — ', ', ')}, SIRET ${B.siret}, ${B.address.street}, ${B.address.postalCode} ${B.address.city} (« l’atelier »), et ${pro.name}${pro.legal ? `, ${pro.legal}` : ''}${pro.siret ? `, SIRET ${pro.siret}` : ''}${pro.address ? `, ${pro.address}` : ''} (« le partenaire »).`],
    ['1. Objet', 'L’atelier réalise, pour les véhicules que le partenaire lui confie (les siens ou ceux de ses clients), la pose de films de vitres teintées, la teinte des feux et la rénovation des phares, aux conditions ci-dessous. Le partenariat n’est pas exclusif.'],
    ['2. Tarifs', `Les prix publics de l’atelier, remis au partenaire dans son dossier de partenariat, diminués de ${D} %. À partir du ${T.volumeFrom}e véhicule confirmé dans le même mois civil, chaque véhicule suivant bénéficie de ${T.volumeDiscount} %. Le compteur repart à zéro le 1er de chaque mois. ${code ? `Le code pro ${code} applique ces remises automatiquement.` : 'Le code pro du partenaire applique ces remises automatiquement.'}`],
    ['3. Rendez-vous', `Pour un véhicule, le partenaire réserve en ligne sur ${site({}).replace(/^https?:\/\//, '')} avec son code pro, ou appelle l’atelier. À partir de deux véhicules, il appelle l’atelier au ${B.phone} : le créneau est fixé ensemble, selon les disponibilités de l’atelier, avec une souplesse réservée aux partenaires.`],
    ['4. Déplacement', `À partir de ${T.travelFrom} véhicules le même jour, l’atelier peut intervenir dans les locaux du partenaire, sans frais de déplacement. Pour un seul véhicule, le déplacement reste possible avec des frais kilométriques${String(T.kmRate || '').trim() ? ` de ${String(T.kmRate).replace('.', ',')} € par km` : ' indiqués à la prise de rendez-vous'}, ou le véhicule est déposé à l’atelier.`],
    ['5. Facturation', `Une facture est établie pour chaque intervention, la remise appliquée. ${vatNote}. Règlement à la remise du véhicule, sauf accord écrit contraire.`],
    ['6. Réglementation', `Le pare-brise et les vitres latérales avant doivent laisser passer au moins ${glazing.frontMin} % de la lumière, vitre et film ensemble (${glazing.article}). L’atelier refuse toute pose non conforme ; le partenaire en informe ses clients.`],
    ['7. Assurance', `L’atelier est assuré en responsabilité civile professionnelle${B.insurance ? ` (${B.insurance.name})` : ''}. À la remise de chaque véhicule, le partenaire signale les défauts déjà présents sur les vitres et les optiques.`],
    ['8. Durée', 'La convention prend effet à sa signature par les deux parties, avec une période d’essai d’un mois pendant laquelle chacun peut y mettre fin sans préavis ni motif, par simple e-mail. Ensuite, elle se poursuit sans limite de durée ; chacun peut y mettre fin à tout moment par e-mail, avec un préavis d’un mois. Un changement de tarifs est annoncé au partenaire au moins un mois à l’avance.'],
    ['9. Signature', 'Les parties conviennent que leur signature électronique, tracée à l’écran, avec la date et l’heure enregistrées, les engage comme une signature manuscrite (articles 1366 et 1367 du Code civil). Chacune peut consulter la convention signée dans son espace.'],
  ];
}
export const agreementHtml = (pro, terms) =>
  `<article class="conv">${agreement(pro, terms, pro.code)
    .map(([t, p]) => `<h3>${esc(t)}</h3><p>${esc(p)}</p>`)
    .join('')}
<div class="sigs"><div><b>Pour le partenaire</b>${pro.sign_pro_at ? `<img src="${esc(pro.sign_pro)}" alt="Signature du partenaire"><small>${esc(pro.sign_pro_name)} · ${esc(timeFr(pro.sign_pro_at))}</small>` : '<small>En attente de signature</small>'}</div>
<div><b>Pour ${esc(B.name)}</b>${pro.sign_me_at ? `<img src="${esc(pro.sign_me)}" alt="Signature de l’atelier"><small>${esc(B.owner)} · ${esc(timeFr(pro.sign_me_at))}</small>` : '<small>En attente de signature</small>'}</div></div></article>`;

// ---------------------------------------------------------------- the look
const CSS = `:root{--bg:#07080a;--card:#111215;--line:rgba(255,255,255,.09);--text:#f4f1ea;--dim:#a8a397;--gold:#e3c27a;--gold-2:#f1dca2;--ok:#8fdcaa}
*{box-sizing:border-box}html{-webkit-text-size-adjust:100%}body{margin:0;background:radial-gradient(1200px 600px at 50% -10%,#1d1a12 0,var(--bg) 60%) fixed,var(--bg);color:var(--text);font:16px/1.55 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;min-height:100vh}
a{color:var(--gold)}main{max-width:720px;margin:0 auto;padding:22px 16px 60px}
.top{display:flex;align-items:center;justify-content:space-between;gap:12px;margin:0 0 22px}.top img.us{height:34px}.top .them{background:#fff;border-radius:12px;padding:6px 10px;height:46px;display:grid;place-items:center}.top .them img{max-height:34px;max-width:120px}.x{color:var(--gold);font-size:22px}
h1{font-size:28px;line-height:1.15;margin:6px 0 6px;letter-spacing:-.01em}h2{font-size:18px;margin:0 0 12px}.lead{color:var(--dim);margin:0 0 22px}
.box{background:linear-gradient(180deg,rgba(255,255,255,.04),rgba(255,255,255,.015));border:1px solid var(--line);border-radius:22px;padding:20px;margin:0 0 16px}
label{display:block;font-size:13px;color:var(--dim);margin:12px 0 6px}input{width:100%;font:inherit;color:var(--text);background:rgba(0,0,0,.35);border:1px solid var(--line);border-radius:14px;padding:13px 14px}input:focus{outline:2px solid rgba(227,194,122,.6);outline-offset:1px}
button,.btn{display:inline-flex;align-items:center;justify-content:center;gap:8px;font:inherit;font-weight:700;border:0;border-radius:999px;padding:13px 20px;background:linear-gradient(180deg,var(--gold-2),var(--gold));color:#141006;text-decoration:none;cursor:pointer}.ghost{background:transparent;color:var(--gold);border:1px solid rgba(227,194,122,.5)}
.btns{display:flex;flex-wrap:wrap;gap:10px;margin-top:14px}.msg{padding:12px 14px;border-radius:14px;margin:0 0 16px;font-weight:600}.msg--err{background:rgba(255,120,110,.12);color:#ffb3ab}.msg--ok{background:rgba(143,220,170,.12);color:var(--ok)}
.dim{color:var(--dim)}small{color:var(--dim)}
/* the carbon card, in 3D: drag it, tap it to see its back */
.stage{perspective:1100px;margin:6px 0 26px;touch-action:pan-y;user-select:none;-webkit-user-select:none}
.card3d{position:relative;width:min(100%,420px);aspect-ratio:1.586;margin:0 auto;transform-style:preserve-3d;transition:transform .7s cubic-bezier(.2,.8,.2,1);cursor:grab}
.card3d.drag{transition:none;cursor:grabbing}
.face{position:absolute;inset:0;border-radius:20px;backface-visibility:hidden;-webkit-backface-visibility:hidden;overflow:hidden;padding:22px 24px;display:flex;flex-direction:column;justify-content:space-between;box-shadow:0 30px 60px -20px rgba(0,0,0,.8),inset 0 0 0 1px rgba(255,255,255,.08);
background:linear-gradient(115deg,rgba(255,255,255,.10) 0%,rgba(255,255,255,0) 32%,rgba(255,255,255,0) 60%,rgba(255,255,255,.06) 100%),repeating-linear-gradient(45deg,#16171a 0 4px,#0d0e10 4px 8px),repeating-linear-gradient(-45deg,rgba(255,255,255,.035) 0 4px,rgba(0,0,0,.25) 4px 8px),#0e0f11;background-blend-mode:screen,normal,overlay,normal}
.face::after{content:"";position:absolute;inset:0;background:linear-gradient(var(--shine,120deg),transparent 35%,rgba(241,220,162,.16) 50%,transparent 65%);pointer-events:none}
.back{transform:rotateY(180deg)}
.face .logo{height:30px;width:auto;align-self:flex-start}.face .kick{font-size:10px;letter-spacing:.24em;text-transform:uppercase;color:var(--gold)}.face .name{font-size:clamp(18px,5.4vw,26px);font-weight:800;letter-spacing:.02em;line-height:1.1;color:#fbf7ee;text-shadow:0 1px 0 rgba(0,0,0,.6)}
.face .row{display:flex;justify-content:space-between;align-items:flex-end;gap:10px}.chip{width:44px;height:34px;border-radius:7px;background:linear-gradient(135deg,#f6e2a8,#b98d3b 55%,#f1d690);box-shadow:inset 0 0 0 1px rgba(0,0,0,.25)}
.face .code{font:800 clamp(22px,7vw,32px)/1 ui-monospace,SFMono-Regular,Menlo,monospace;letter-spacing:.08em;background:linear-gradient(180deg,#fff3c9,#d7aa4f);-webkit-background-clip:text;background-clip:text;color:transparent}
.face .stripe{position:absolute;left:0;right:0;top:22px;height:40px;background:#050506}.face .terms{font-size:12px;color:#d9d3c5}
.hint3d{text-align:center;color:var(--dim);font-size:12px;margin:-14px 0 22px}
/* the month */
.steps{display:grid;grid-template-columns:repeat(var(--n),1fr);gap:5px;margin:14px 0 8px}.steps i{height:12px;border-radius:6px;background:rgba(255,255,255,.08)}.steps i.on{background:linear-gradient(90deg,var(--gold),var(--gold-2))}.steps i.v{outline:1px dashed rgba(227,194,122,.6);outline-offset:2px}
.big{font-size:40px;font-weight:800;line-height:1;color:var(--gold-2)}.rdv{list-style:none;margin:10px 0 0;padding:0}.rdv li{display:flex;justify-content:space-between;gap:10px;padding:10px 0;border-top:1px solid var(--line);font-size:14px}
/* the agreement and the signature */
.conv h3{font-size:14px;margin:16px 0 4px;color:var(--gold-2)}.conv p{margin:0;color:#d9d3c5;font-size:14px}
.sigs{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:18px}.sigs>div{background:#fff;color:#111;border-radius:14px;padding:12px;min-height:110px}.sigs img{display:block;width:100%;height:70px;object-fit:contain}.sigs small{display:block;color:#555;font-size:11px}
.pad{display:block;width:100%;height:180px;background:#fff;border-radius:16px;touch-action:none;margin:6px 0 8px}
/* booking cars */
select{width:100%;font:inherit;color:var(--text);background:rgba(0,0,0,.35);border:1px solid var(--line);border-radius:14px;padding:12px 14px}
.cars details,.car{border:1px solid var(--line);border-radius:18px;padding:14px 16px;margin:0 0 12px;background:rgba(0,0,0,.2)}.cars summary{cursor:pointer;font-weight:700;color:var(--gold-2)}
.row2{display:grid;grid-template-columns:1fr 1fr;gap:10px}.radios{display:grid;gap:8px;margin:8px 0}.radios label{display:flex;gap:10px;align-items:center;margin:0;color:var(--text);font-size:15px}.radios input{width:auto}
.days{display:grid;gap:12px}.days h3{margin:6px 0 6px;font-size:14px;color:var(--gold-2)}.times{display:flex;flex-wrap:wrap;gap:8px}.times label{margin:0}.times input{position:absolute;opacity:0}.times span{display:inline-block;padding:9px 14px;border-radius:999px;border:1px solid var(--line);color:var(--text);font-weight:650;cursor:pointer}.times input:checked+span{background:linear-gradient(180deg,var(--gold-2),var(--gold));color:#141006;border-color:transparent}
.sum{list-style:none;margin:0;padding:0}.sum li{display:flex;justify-content:space-between;gap:10px;padding:9px 0;border-top:1px solid var(--line);font-size:14px}.sum s{color:var(--dim);margin-right:6px}
@media (max-width:560px){.row2{grid-template-columns:1fr}}
@media print{body{background:#fff;color:#111}.box{border:0}.conv p{color:#111}.btns,.top .x{display:none}}`;

// the 3D card (drag, tap to turn) and the signature pad; no inline script (CSP)
const JS = `(function(){var c=document.querySelector('.card3d');if(c){var rx=-6,ry=-18,turned=false,sx=0,sy=0,moved=false,down=false;function draw(){c.style.transform='rotateX('+rx+'deg) rotateY('+(ry+(turned?180:0))+'deg)';c.style.setProperty('--shine',(120+ry)+'deg');c.querySelectorAll('.face').forEach(function(f){f.style.setProperty('--shine',(120+ry*1.5)+'deg')})}
draw();c.addEventListener('pointerdown',function(e){down=true;moved=false;sx=e.clientX;sy=e.clientY;c.classList.add('drag');c.setPointerCapture(e.pointerId)});
c.addEventListener('pointermove',function(e){if(!down)return;var dx=e.clientX-sx,dy=e.clientY-sy;if(Math.abs(dx)+Math.abs(dy)>4)moved=true;ry+=dx*.5;rx=Math.max(-35,Math.min(35,rx-dy*.35));sx=e.clientX;sy=e.clientY;draw()});
function up(){if(!down)return;down=false;c.classList.remove('drag');if(!moved)turned=!turned;else{var t=((ry%360)+360)%360;if(t>90&&t<270){turned=!turned;ry-=180}ry=Math.max(-28,Math.min(28,((ry%360)+540)%360-180))}rx=-6;draw()}
c.addEventListener('pointerup',up);c.addEventListener('pointercancel',up);
var t0=performance.now();(function sway(t){if(!down&&!document.hidden&&!matchMedia('(prefers-reduced-motion: reduce)').matches&&!c.dataset.still){var k=Math.sin((t-t0)/1600)*3;c.style.transform='rotateX('+(rx+k*.4)+'deg) rotateY('+(ry+k+(turned?180:0))+'deg)'}requestAnimationFrame(sway)})(t0)}
document.querySelectorAll('canvas.pad').forEach(function(cv){var x=cv.getContext('2d'),r=window.devicePixelRatio||1,w=cv.clientWidth,h=cv.clientHeight,dirty=false,last=null;cv.width=w*r;cv.height=h*r;x.scale(r,r);x.lineWidth=2.4;x.lineCap='round';x.lineJoin='round';x.strokeStyle='#111';
function p(e){var b=cv.getBoundingClientRect();return[e.clientX-b.left,e.clientY-b.top]}
cv.addEventListener('pointerdown',function(e){last=p(e);e.preventDefault()});cv.addEventListener('pointermove',function(e){if(!last)return;var q=p(e);x.beginPath();x.moveTo(last[0],last[1]);x.lineTo(q[0],q[1]);x.stroke();last=q;dirty=true;e.preventDefault()});
['pointerup','pointercancel'].forEach(function(k){window.addEventListener(k,function(){last=null})});
var f=cv.closest('form');var clr=f.querySelector('[data-clear]');if(clr)clr.addEventListener('click',function(){x.clearRect(0,0,w,h);dirty=false});
f.addEventListener('submit',function(e){if(!dirty){e.preventDefault();alert('Signez dans le cadre blanc.');return}f.querySelector('[name=image]').value=cv.toDataURL('image/png')})})})();`;

const page = (title, body, { status = 200, extra = {} } = {}) =>
  new Response(
    `<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><meta name="robots" content="noindex"><title>${esc(title)} — ${esc(B.name)} Pro</title><link rel="manifest" href="/pro/manifest.webmanifest"><link rel="apple-touch-icon" href="/atelier/icone-180.png?v=2"><meta name="theme-color" content="#07080a"><meta name="apple-mobile-web-app-capable" content="yes"><meta name="apple-mobile-web-app-status-bar-style" content="black-translucent"><meta name="apple-mobile-web-app-title" content="SOLAR CAR Pro"><link rel="stylesheet" href="/pro/app.css?v=1"><script src="/pro/app.js?v=1" defer></script></head><body><main>${body}</main></body></html>`,
    { status, headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store', 'x-robots-tag': 'noindex', 'content-security-policy': "default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'self'; frame-ancestors 'none'; form-action 'self'", 'referrer-policy': 'same-origin', ...extra } }
  );
const redirect = (to, extra = {}) => new Response(null, { status: 303, headers: { location: to, 'cache-control': 'no-store', ...extra } });
const msg = (url) => (url.searchParams.get('err') ? `<p class="msg msg--err" role="alert">${esc(url.searchParams.get('err'))}</p>` : url.searchParams.get('ok') ? `<p class="msg msg--ok" role="status">${esc(url.searchParams.get('ok'))}</p>` : '');
const top = (pro) => `<div class="top"><img class="us" src="/atelier/logo.webp" alt="${esc(B.name)}">${pro ? `<span class="x">×</span>${pro.has_logo ? `<span class="them"><img src="/pro/logo?v=${pro.updated}" alt="${esc(pro.name)}"></span>` : `<b>${esc(pro.name)}</b>`}` : ''}</div>`;

/** the carbon card: its name on the front, its code on the back */
export const card3d = (pro, terms) => `<div class="stage"><div class="card3d" role="img" aria-label="Carte partenaire ${esc(pro.name)}, code ${esc(pro.code)}">
<div class="face"><img class="logo" src="/atelier/logo.webp" alt=""><div><div class="kick">Partenaire professionnel</div><div class="name">${esc(pro.name)}</div></div><div class="row"><span class="chip"></span><small>${pro.sign_pro_at ? `Membre depuis ${esc(monthFr(new Date(pro.sign_pro_at).toISOString().slice(0, 7)))}` : 'Carte en attente de signature'}</small></div></div>
<div class="face back"><div class="stripe"></div><div style="margin-top:58px"><div class="kick">Votre code pro</div><div class="code">${esc(pro.code || '—')}</div></div><div class="terms">-${esc(pro.discount || terms.discount)} % sur tout · -${esc(terms.volumeDiscount)} % dès le ${esc(terms.volumeFrom)}e véhicule du mois<br>${esc(B.phone)} · ${esc(String(B.siteUrl).replace(/^https?:\/\//, ''))}</div></div>
</div></div><p class="hint3d">Faites-la tourner du doigt · touchez-la pour voir le verso</p>`;

/** the month: n confirmed appointments, the step to −15 % */
function monthBox(m) {
  const goal = m.from - 1;
  const steps = Array.from({ length: m.from }, (_, i) => `<i class="${i < m.n ? 'on' : ''}${i === m.from - 1 ? ' v' : ''}"></i>`).join('');
  const left = Math.max(0, goal - m.n);
  return `<section class="box"><h2>Votre mois de ${esc(monthFr(m.month))}</h2>
<div style="display:flex;align-items:flex-end;gap:14px"><span class="big">${m.n}</span><span class="dim">véhicule${m.n > 1 ? 's' : ''} confirmé${m.n > 1 ? 's' : ''}<br>remise actuelle : <b style="color:var(--gold-2)">-${m.percent} %</b></span></div>
<div class="steps" style="--n:${m.from}">${steps}</div>
<p class="dim" style="margin:0">${left ? `Encore ${left} véhicule${left > 1 ? 's' : ''} ce mois-ci, et le suivant passe à -${m.volume} %.` : `Palier atteint : -${m.volume} % sur chaque véhicule jusqu’à la fin du mois.`} Le compteur repart à zéro le 1er.</p>
${m.rows.length ? `<ul class="rdv">${m.rows.map((r) => `<li><span>${esc(dayFr(r.date))} · ${esc(String(r.time).replace(':', ' h '))}<br><small>${esc(r.vehicle || (JSON.parse(r.items || '[]')[0] || {}).label || '')}</small></span><b>${eur(r.total)}</b></li>`).join('')}</ul>` : ''}</section>`;
}

// ---------------------------------------------------------------- the routes
export async function proSpace(req, env, url, now) {
  const path = url.pathname.replace(/\/+$/, '') || '/pro';
  if (path === '/pro/app.css') return new Response(CSS, { headers: { 'content-type': 'text/css; charset=utf-8', 'cache-control': 'public, max-age=3600' } });
  if (path === '/pro/app.js') return new Response(JS, { headers: { 'content-type': 'text/javascript; charset=utf-8', 'cache-control': 'public, max-age=3600' } });
  if (path === '/pro/manifest.webmanifest')
    return new Response(JSON.stringify({ name: `${B.name} Pro`, short_name: 'SOLAR CAR Pro', start_url: '/pro', scope: '/pro', display: 'standalone', background_color: '#07080a', theme_color: '#07080a', icons: [{ src: '/atelier/icone-512.png?v=2', sizes: '512x512', type: 'image/png', purpose: 'any' }, { src: '/atelier/icone-180.png?v=2', sizes: '180x180', type: 'image/png' }] }), { headers: { 'content-type': 'application/manifest+json' } });
  if (!env.ATELIER_SECRET || !env.ATELIER) return page('Espace pro', '<h1>Espace pro bientôt disponible</h1>', { status: 503 });
  // a form from another site: refused (the browser sends its Origin with every form post)
  const origin = req.headers.get('origin');
  if (req.method === 'POST' && origin && origin !== url.origin) return new Response('Origine refusée', { status: 403 });

  // the invitation: the partner chooses its password
  const inv = path.match(/^\/pro\/invitation\/([A-Za-z0-9_-]{30,80})$/);
  if (inv) {
    const r = await db(env, 'pro/by-invite', { token: inv[1], now });
    if (!r.ok) return page('Lien expiré', `${top()}<h1>Ce lien a expiré</h1><p class="lead">Demandez-en un nouveau à ${esc(B.name)} : ${esc(B.phone)}.</p><a class="btn ghost" href="/pro/connexion">J’ai déjà un mot de passe</a>`, { status: 410 });
    if (req.method === 'POST') {
      const f = await req.formData();
      const pw = String(f.get('password') || '');
      if (pw.length < 8) return redirect(`${path}?${new URLSearchParams({ err: 'Choisissez un mot de passe d’au moins 8 caractères.' })}`);
      if (pw !== String(f.get('password2') || '')) return redirect(`${path}?${new URLSearchParams({ err: 'Les deux mots de passe ne sont pas les mêmes.' })}`);
      const hash = await hashPassword(pw);
      const s = await db(env, 'pro/password', { token: inv[1], pass: hash, now });
      if (!s.ok) return redirect(`${path}?${new URLSearchParams({ err: s.error })}`);
      return redirect('/pro?ok=' + encodeURIComponent('Bienvenue ! Votre mot de passe est enregistré.'), { 'set-cookie': await cookieFor(env, s.id, hash.slice(-12), now) });
    }
    return page('Bienvenue', `${top()}<h1>Bienvenue, ${esc(r.pro.name)}</h1><p class="lead">Choisissez votre mot de passe : vous seul le connaissez. Vous vous connecterez ensuite avec votre e-mail${r.pro.email ? ` (${esc(r.pro.email)})` : ''}.</p>${msg(url)}
<form class="box" method="post"><label for="pw">Mot de passe (8 caractères au moins)</label><input id="pw" name="password" type="password" autocomplete="new-password" minlength="8" required><label for="pw2">Le même, une seconde fois</label><input id="pw2" name="password2" type="password" autocomplete="new-password" minlength="8" required><div class="btns"><button>Créer mon espace</button></div></form>`);
  }
  if (path === '/pro/connexion') {
    if (req.method === 'POST') {
      const f = await req.formData();
      const r = await db(env, 'pro/login', { email: String(f.get('email') || ''), now });
      if (r.locked) return redirect(`/pro/connexion?${new URLSearchParams({ err: 'Trop d’essais : réessayez dans 15 minutes.' })}`);
      const good = r.ok && (await checkPassword(String(f.get('password') || ''), r.pass));
      if (r.ok) await db(env, 'pro/login-result', { id: r.id, good, now });
      if (!good) return redirect(`/pro/connexion?${new URLSearchParams({ err: 'E-mail ou mot de passe incorrect.' })}`);
      return redirect('/pro', { 'set-cookie': await cookieFor(env, r.id, r.pass.slice(-12), now) });
    }
    return page('Connexion', `${top()}<h1>Espace <span style="color:var(--gold)">pro</span></h1><p class="lead">Partenaires de ${esc(B.name)} : votre carte, votre code, vos rendez-vous du mois.</p>${msg(url)}
<form class="box" method="post"><label for="em">E-mail</label><input id="em" name="email" type="email" autocomplete="username" required><label for="pw">Mot de passe</label><input id="pw" name="password" type="password" autocomplete="current-password" required><div class="btns"><button>Se connecter</button></div><p class="dim" style="margin:14px 0 0;font-size:13px">Mot de passe oublié ? Appelez ${esc(B.phone)} : nous vous envoyons un nouveau lien.</p></form>`);
  }
  if (path === '/pro/deconnexion') return redirect('/pro/connexion', { 'set-cookie': `${COOKIE}=; Path=/pro; Max-Age=0; HttpOnly; Secure; SameSite=Lax` });

  const s = await signedIn(req, env, now);
  if (!s) return redirect('/pro/connexion');
  const { pro, month, terms } = s;
  if (path === '/pro/logo') {
    const res = await atelierFetch(env, `pro/logo?id=${pro.id}`, { method: 'GET' });
    return res.ok ? new Response(res.body, { headers: { 'content-type': res.headers.get('content-type') || 'image/png', 'cache-control': 'private, max-age=300' } }) : new Response('', { status: 404 });
  }
  if (path === '/pro/signer' && req.method === 'POST') {
    const f = await req.formData();
    const r = await db(env, 'pro/sign', { id: pro.id, who: 'pro', name: String(f.get('name') || ''), image: String(f.get('image') || ''), now });
    if (r.ok) await (await import('./push.js')).notify(env, { title: 'Convention signée', body: `${pro.name} a signé la convention de partenariat : contre-signez-la.`, url: `/atelier/pros/${pro.id}`, tag: `pro-${pro.id}` }, now).catch(() => {});
    return redirect(`/pro?${new URLSearchParams(r.ok ? { ok: 'Merci ! Convention signée : votre espace et votre code pro sont actifs.' } : { err: r.error })}`);
  }
  if (path === '/pro/convention') return page('Convention', `${top(pro)}<h1>Convention de partenariat</h1><p class="lead">${esc(B.name)} × ${esc(pro.name)}</p><section class="box">${agreementHtml(pro, terms)}</section><div class="btns"><a class="btn ghost" href="/pro">← Mon espace</a></div>`);
  if (path === '/pro/tarifs.pdf') {
    let logo = null;
    if (pro.has_logo) {
      const res = await atelierFetch(env, `pro/logo?id=${pro.id}`, { method: 'GET' });
      if (res.ok) logo = new Uint8Array(await res.arrayBuffer());
    }
    const assets = await import('./brand.js').then((m) => m.PDF_ASSETS).catch(() => ({ logo: null, shades: {} }));
    const bytes = await proSheetPdf({ ...pro, logo, logoType: pro.logo_type }, { terms: { ...terms, discount: Number(pro.discount) || terms.discount }, now, logo: assets.logo ? new Uint8Array(assets.logo) : null, shades: Object.fromEntries(Object.entries(assets.shades || {}).map(([k, v]) => [k, new Uint8Array(v)])) });
    return new Response(bytes, { headers: { 'content-type': 'application/pdf', 'content-disposition': `inline; filename*=UTF-8''${encodeURIComponent(`Tarifs pros ${B.name}.pdf`)}`, 'cache-control': 'no-store' } });
  }
  if (path === '/pro/reserver') return pro.sign_pro_at ? proBook(req, env, url, s, now) : redirect('/pro');
  if (path !== '/pro') return redirect('/pro');

  // its space: before the signature, the agreement to sign; after, everything
  const signed = !!pro.sign_pro_at;
  const book = `${site(env)}/reservation/?code=${encodeURIComponent(pro.code)}`;
  const tel = B.phone.replace(/[^\d+]/g, '');
  const body = signed
    ? `${top(pro)}${msg(url)}<p class="dim" style="margin:0">Espace partenaire</p><h1>${esc(pro.contact ? `Bonjour ${String(pro.contact).split(' ')[0]}` : pro.name)}</h1>
${card3d(pro, terms)}${monthBox(month)}
<section class="box"><h2>Prendre rendez-vous</h2><p style="margin:0 0 6px">Réservez <b>un ou plusieurs véhicules</b> (jusqu’à 5 à la suite) sur nos créneaux libres : à l’atelier ou chez vous${terms.travelFrom ? ` (sans frais de déplacement dès ${terms.travelFrom} véhicules)` : ''}. Votre remise s’applique toute seule.</p><p style="margin:0" class="dim">Un besoin particulier, une journée entière ? Appelez-nous, nous calons ça ensemble.</p>
<div class="btns"><a class="btn" href="/pro/reserver">Réserver des véhicules</a><a class="btn ghost" href="${esc(book)}">Réservation en ligne</a><a class="btn ghost" href="tel:${esc(tel)}">Appeler ${esc(B.phone)}</a></div></section>
<section class="box"><h2>Nos tarifs ensemble</h2><p class="dim" style="margin:0">Prix public, prix pro (-${esc(pro.discount || terms.discount)} %) et prix dès le ${esc(terms.volumeFrom)}e véhicule du mois (-${esc(terms.volumeDiscount)} %), avec les teintes et les fiches techniques.</p><div class="btns"><a class="btn ghost" href="/pro/tarifs.pdf">Ouvrir le PDF des tarifs</a></div></section>
<section class="box"><h2>Notre convention</h2><p class="dim" style="margin:0">Signée le ${esc(dateFr(pro.sign_pro_at))}${pro.sign_me_at ? `, contre-signée par ${esc(B.name)} le ${esc(dateFr(pro.sign_me_at))}` : ` ; contre-signature de ${esc(B.name)} en cours`}.</p><div class="btns"><a class="btn ghost" href="/pro/convention">Lire la convention</a></div></section>
<p class="dim" style="font-size:13px">Sur iPhone : Partager → « Sur l’écran d’accueil » pour garder votre espace comme une application. <a href="/pro/deconnexion">Se déconnecter</a></p>`
    : `${top(pro)}${msg(url)}<h1>Bienvenue, ${esc(pro.name)}</h1><p class="lead">Dernière étape : lisez et signez la convention de partenariat. Elle débloque votre espace et active votre code pro.</p>
${card3d(pro, terms)}<section class="box">${agreementHtml(pro, terms)}</section>
<form class="box" method="post" action="/pro/signer"><h2>Signature</h2><label for="nm">Nom et prénom du signataire</label><input id="nm" name="name" value="${esc(pro.contact || '')}" required autocomplete="name"><label>Signez dans le cadre</label><canvas class="pad" aria-label="Cadre de signature"></canvas><input type="hidden" name="image"><div class="btns"><button>Je signe la convention</button><button type="button" class="ghost" data-clear>Effacer</button></div><p class="dim" style="margin:12px 0 0;font-size:13px">En signant, vous acceptez la convention ci-dessus. Date et heure enregistrées.</p></form>`;
  return page('Mon espace', body);
}


// ---------------------------------------------------------------- the partner books its cars (21 November 2026)
// One to five cars at once: for each, its category, its window tint, its lights, its headlights;
// where (the workshop or the partner's own place); then the free slots of the workshop's calendar
// for them all, one after the other; booked at once (no payment online: invoiced), each car its own
// appointment in the calendar (« Ma journée »), counted for the month's step to −15 %.
const MAXCARS = 5;
const PHARES = atelierExtras.filter((x) => /phares/i.test(x.id));
const carsOf = (f) =>
  Array.from({ length: MAXCARS }, (_, i) => {
    const g = (k) => String(f.get(`${k}${i}`) ?? '').trim();
    return { cat: g('cat'), vt: g('vt'), feux: g('feux'), phares: g('phares'), model: g('modele').slice(0, 60), plate: g('plaque').toUpperCase().slice(0, 15) };
  }).filter((c) => c.vt || c.feux || c.phares);
function pricedCar(c) {
  const cat = bookableVehicles.find((v) => v.id === c.cat) || bookableVehicles[0];
  const config = {};
  if (c.vt) config.tint = { vehicle: cat.id, formula: c.vt };
  if (c.feux) config.lights = { pairs: c.feux };
  const ph = PHARES.find((x) => x.id === c.phares);
  const extra = ph ? [{ kind: 'other', label: ph.label, price: ph.price, minutes: ph.minutes }] : [];
  const q = withExtra(quote(config), extra);
  return { cat, config, extra, q };
}
const hidden = (f) =>
  Array.from({ length: MAXCARS }, (_, i) => ['cat', 'vt', 'feux', 'phares', 'modele', 'plaque'].map((k) => `<input type="hidden" name="${k}${i}" value="${esc(f.get(`${k}${i}`) ?? '')}">`).join('')).join('') + `<input type="hidden" name="lieu" value="${esc(f.get('lieu') ?? 'atelier')}">`;

async function proBook(req, env, url, s, now) {
  const { pro, month, terms } = s;
  const f = req.method === 'POST' ? await req.formData() : new URLSearchParams();
  const action = String(f.get('action') || '');
  const D = Number(pro.discount) || Number(terms.discount);
  const V = Number(terms.volumeDiscount);
  const pctAt = (i) => (month.n + i >= Number(terms.volumeFrom) - 1 ? V : D);
  const cars = carsOf(f);
  const priced = cars.map(pricedCar);
  const bad = priced.find((p) => p.q.error);
  const place = f.get('lieu') === 'chez' ? 'chez' : 'atelier';
  const total = priced.reduce((a, p) => a + (p.q.minutes || 0), 0);
  const sumHtml = () =>
    `<ul class="sum">${priced
      .map((p, i) => {
        const pct = pctAt(i);
        const net = Math.round(p.q.total * (1 - pct / 100) * 100) / 100;
        return `<li><span><b>Véhicule ${i + 1}</b> · ${esc(cars[i].model || p.cat.label)}${cars[i].plate ? ` · ${esc(cars[i].plate)}` : ''}<br><small>${esc(p.q.items.map((x) => x.label).join(' + '))} · ${esc(formatDuration(p.q.minutes))}</small></span><span><s>${eur(p.q.total)}</s><b>${eur(net)}</b><br><small>-${pct} %</small></span></li>`;
      })
      .join('')}</ul>`;
  const back = (q) => redirect(`/pro/reserver?${new URLSearchParams(q)}`);

  // 3. booked: the cars one after the other from the slot chosen
  if (action === 'reserver') {
    if (!cars.length || bad) return back({ err: bad ? bad.q.error : 'Choisissez au moins une prestation.' });
    const [date, time] = String(f.get('creneau') || '').split('|');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date || '') || !/^\d{2}:\d{2}$/.test(time || '')) return back({ err: 'Choisissez un créneau.' });
    const free = await atelierSlots(env, date, total, now, 1).catch(() => ({ times: [] }));
    if (!(free.times || []).includes(time)) return back({ err: 'Ce créneau vient d’être pris : choisissez-en un autre.' });
    const [first, ...rest] = String(pro.contact || '').split(' ');
    const where = place === 'chez' ? `chez ${pro.name}${pro.address ? ` (${pro.address})` : ''}` : 'à l’atelier';
    let t = time;
    const made = [];
    for (let i = 0; i < cars.length; i++) {
      const p = priced[i];
      const r = await atelierBooking(
        env,
        {
          customer: { firstName: first || pro.name, lastName: [rest.join(' '), `(${pro.name})`].filter(Boolean).join(' '), email: pro.email, phone: pro.phone, vehicle: cars[i].model || p.cat.label, plate: cars[i].plate },
          config: p.config,
          extra: p.extra,
          date,
          time: t,
          force: true,
          mode: 'none',
          canal: 'pro',
          code: pro.code,
          note: `Réservé par ${pro.name} depuis son espace pro · ${where}`,
          quiet: true,
        },
        now
      ).catch((err) => ({ error: err.message }));
      if (!r.ok) {
        console.error('[pro] booking', r.error);
        break;
      }
      made.push({ ...r, car: cars[i], label: p.q.items.map((x) => x.label).join(' + '), time: t });
      t = utcToZoned(r.end, R.timeZone).time;
    }
    if (!made.length) return back({ err: 'La réservation n’a pas pu être enregistrée : appelez-nous.' });
    const when = `${dayFr(date)} à ${time.replace(':', ' h ')}`;
    const lines = made.map((m, i) => `${m.time.replace(':', ' h ')} · ${m.car.model || 'véhicule ' + (i + 1)}${m.car.plate ? ` (${m.car.plate})` : ''} · ${m.label}`);
    await notify(env, { title: `Réservation pro : ${pro.name}`, body: `${made.length} véhicule${made.length > 1 ? 's' : ''} le ${when} · ${where}`, url: `/atelier/journee?date=${date}`, tag: `pro-${pro.id}-${date}` }, now).catch(() => {});
    if (env.NOTIFY_TO && env.RESEND_API_KEY)
      await send(env, {
        to: env.NOTIFY_TO.split(',').map((x) => x.trim()),
        reply_to: pro.email || undefined,
        subject: `Réservation pro — ${pro.name} — ${made.length} véhicule${made.length > 1 ? 's' : ''} le ${when}`,
        html: mailShell(`Réservation de ${pro.name}`, `<p style="margin:0 0 12px;font-size:15px;color:#111"><b>${esc(pro.name)}</b> a réservé ${made.length} véhicule${made.length > 1 ? 's' : ''} le <b>${esc(when)}</b>, ${esc(where)}.</p><ul style="margin:0;padding-left:18px;font-size:14px;color:#111">${lines.map((l) => `<li>${esc(l)}</li>`).join('')}</ul><p style="margin:14px 0 0;font-size:13px;color:#6b6b6b">Code ${esc(pro.code)} appliqué · ${esc(pro.contact || '')} ${esc(pro.phone || '')}</p>`),
      }).catch((err) => console.error('[mail] pro booking', err.message));
    if (pro.email && env.MAIL_CLIENTS === '1' && env.RESEND_API_KEY)
      await send(env, {
        to: [pro.email],
        reply_to: B.email,
        subject: `Vos rendez-vous du ${when} chez ${B.name}`,
        html: mailCard({ badge: ['Réservation confirmée', 'ok'], kicker: 'Vos rendez-vous', big: esc(dayFr(date)), sub: esc(time.replace(':', ' h ')) }, `<p style="margin:0 0 12px;font-size:15px;line-height:1.6;color:#111">Bonjour ${esc(first || pro.name)},<br>vos ${made.length} véhicule${made.length > 1 ? 's sont' : ' est'} réservé${made.length > 1 ? 's' : ''}, ${esc(where)} :</p><ul style="margin:0 0 14px;padding-left:18px;font-size:14px;line-height:1.7;color:#111">${lines.map((l) => `<li>${esc(l)}</li>`).join('')}</ul><p style="margin:0;font-size:13px;color:#77736b">Votre remise pro s’applique sur la facture. Un changement ? Appelez-nous au ${esc(B.phone)}.</p>`),
      }).catch((err) => console.error('[mail] pro confirm', err.message));
    return redirect(`/pro?${new URLSearchParams({ ok: `C’est réservé : ${made.length} véhicule${made.length > 1 ? 's' : ''} le ${when}.${made.length < cars.length ? ' Un véhicule n’a pas pu être ajouté : appelez-nous.' : ''}` })}`);
  }

  // 2. the free slots for them all
  if (action === 'creneaux') {
    if (!cars.length) return back({ err: 'Choisissez au moins une prestation.' });
    if (bad) return back({ err: bad.q.error });
    const today = utcToZoned(now, R.timeZone).date;
    const r = await atelierSlots(env, today, total, now, 30).catch(() => ({ days: [] }));
    const days = (r.days || []).filter((d) => d.times?.length).slice(0, 14);
    const body = `${top(pro)}<p class="dim" style="margin:0">Réserver</p><h1>Choisissez le créneau</h1><p class="lead">${cars.length} véhicule${cars.length > 1 ? 's' : ''} à la suite · ${esc(formatDuration(total))} en tout · ${place === 'chez' ? `chez vous${cars.length < Number(terms.travelFrom) ? ' (frais de déplacement pour un seul véhicule)' : ''}` : 'à l’atelier de ' + esc(B.address.city)}.</p>
<section class="box"><h2>Vos véhicules</h2>${sumHtml()}</section>
<form class="box" method="post" action="/pro/reserver">${hidden(f)}<input type="hidden" name="action" value="reserver"><h2>Créneaux libres</h2>${
      days.length
        ? `<div class="days">${days.map((d) => `<div><h3>${esc(dayFr(d.date))}</h3><div class="times">${d.times.map((t) => `<label><input type="radio" name="creneau" value="${d.date}|${t}" required><span>${t.replace(':', ' h ')}</span></label>`).join('')}</div></div>`).join('')}</div><div class="btns"><button>Réserver</button><a class="btn ghost" href="/pro/reserver">Modifier</a></div>`
        : `<p>Pas de créneau assez long dans les 30 prochains jours pour ces ${cars.length} véhicules : appelez-nous au <a href="tel:${esc(B.phone.replace(/[^\d+]/g, ''))}">${esc(B.phone)}</a>, nous trouvons une solution.</p>`
    }</form>`;
    return page('Réserver', body);
  }

  // 1. the cars and the services
  const opt = (list, cur) => list.map(([v, l]) => `<option value="${esc(v)}"${String(cur) === String(v) ? ' selected' : ''}>${esc(l)}</option>`).join('');
  const carForm = (i) => `<div class="row2"><div><label for="cat${i}">Catégorie</label><select id="cat${i}" name="cat${i}">${opt(bookableVehicles.map((v) => [v.id, `${v.label} — ${(v.models || [v.example]).slice(0, 2).join(', ')}`]), 'citadine')}</select></div><div><label for="modele${i}">Modèle (facultatif)</label><input id="modele${i}" name="modele${i}" placeholder="ex. Peugeot 3008" autocomplete="off"></div></div>
<div class="row2"><div><label for="vt${i}">Vitres teintées</label><select id="vt${i}" name="vt${i}">${opt([['', 'Non'], ...tintFormulas.filter((x) => ['rear', 'full'].includes(x.id)).map((x) => [x.id, x.label])], '')}</select></div><div><label for="feux${i}">Feux teintés</label><select id="feux${i}" name="feux${i}">${opt([['', 'Non'], ...lightsBooking.pairs.map((x) => [x.id, x.label])], '')}</select></div></div>
<div class="row2"><div><label for="phares${i}">Rénovation de phares</label><select id="phares${i}" name="phares${i}">${opt([['', 'Non'], ...PHARES.map((x) => [x.id, x.label])], '')}</select></div><div><label for="plaque${i}">Immatriculation (facultatif)</label><input id="plaque${i}" name="plaque${i}" autocomplete="off" style="text-transform:uppercase"></div></div>`;
  const body = `${top(pro)}${msg(url)}<p class="dim" style="margin:0">Réserver</p><h1>Vos véhicules</h1><p class="lead">Jusqu’à ${MAXCARS} véhicules à la suite. Ce mois-ci : ${month.n} véhicule${month.n > 1 ? 's' : ''} confirmé${month.n > 1 ? 's' : ''}, remise -${pctAt(0)} %.</p>
<form method="post" action="/pro/reserver"><input type="hidden" name="action" value="creneaux">
<section class="box"><h2>Où ?</h2><div class="radios"><label><input type="radio" name="lieu" value="atelier" checked> À l’atelier de ${esc(B.address.city)}</label><label><input type="radio" name="lieu" value="chez"> Chez vous${pro.address ? ` (${esc(pro.address)})` : ''}${terms.travelFrom ? ` — sans frais dès ${esc(terms.travelFrom)} véhicules` : ''}</label></div></section>
<div class="cars"><div class="car"><b style="color:var(--gold-2)">Véhicule 1</b>${carForm(0)}</div>${Array.from({ length: MAXCARS - 1 }, (_, k) => `<details><summary>+ Véhicule ${k + 2}</summary>${carForm(k + 1)}</details>`).join('')}</div>
<div class="btns"><button>Voir les créneaux libres</button><a class="btn ghost" href="/pro">Retour</a></div></form>`;
  return page('Réserver', body);
}
