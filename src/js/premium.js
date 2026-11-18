import { premium } from '../../content/offers.js';
import { mountCard, monthYear, longDate, shortDate, euros, siteBase, keep, copyText } from './card3d.js';

/**
 * SOLAR CAR Premium (content/offers.js), sold through the booking server (booking/worker.js):
 *   /premium/              the club, its levels lit one by one, the form (startPremium)
 *   /premium/bienvenue/    the new member's card revealed (startPremiumDone)
 *   /premium/carte/        « Mon espace Premium », installable (startPremiumCard)
 */
const session = keep('session');
const local = keep('local');
const base = () => siteBase('premium/');
const STORE = 'sc37-premium';
const tierById = (id) => premium.tiers.find((t) => t.id === id) || premium.tiers[0];
const escHtml = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const fullName = (m) => [m.firstName, m.lastName].filter(Boolean).join(' ');
const reduce = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

/** the member's card from the server's answer */
function fillCard(card, m) {
  const t = tierById(m.tier?.id);
  card.tier(t.id, t.color, t.label);
  card.set('name', fullName(m));
  card.set('number', m.number);
  card.set('since', monthYear(m.since));
  card.set('until', monthYear(m.expires));
}

/** the level tracks: lit one light after the other when they come into view */
export function lightLevels(root = document) {
  for (const track of root.querySelectorAll('[data-levels]:not(.levels--compact)')) {
    if (reduce() || !('IntersectionObserver' in window)) continue;
    track.setAttribute('data-anim', '');
    const io = new IntersectionObserver(
      ([en]) => {
        if (!en.isIntersecting) return;
        track.classList.add('is-lit');
        io.disconnect();
      },
      { threshold: 0.35 }
    );
    io.observe(track);
  }
}

// ---------------------------------------------------------------------------------- join
export function startPremium(root) {
  const api = root.dataset.api;
  const form = root.querySelector('form');
  const $ = (s) => root.querySelector(s);
  lightLevels(document);
  // the hero's card: a member at every level, in turn (a slow showcase of the neons)
  const heroStage = document.querySelector('.card3d-stage--hero');
  if (heroStage) {
    const hero = mountCard(heroStage);
    let i = 0;
    if (!reduce())
      setInterval(() => {
        if (document.hidden || hero.card.classList.contains('is-flipped')) return;
        i = (i + 1) % premium.tiers.length;
        const t = premium.tiers[i];
        hero.tier(t.id, t.color, t.label);
      }, 2600);
  }
  const card = mountCard(root.querySelector('[data-card3d]'));
  const field = (n) => form.elements[n];
  const val = (n) => String(field(n)?.value ?? '').trim();
  const now = Date.now();
  const end = new Date();
  end.setMonth(end.getMonth() + premium.months);
  card.set('since', monthYear(now));
  card.set('until', monthYear(end.getTime()));
  const refresh = () => {
    card.set('name', [val('firstName'), val('lastName')].filter(Boolean).join(' '));
    session.set('premium-form', { firstName: val('firstName'), lastName: val('lastName'), email: val('email'), phone: val('phone'), nonews: field('nonews').checked });
  };
  form.addEventListener('input', refresh);
  form.addEventListener('change', refresh);

  const error = $('[data-error]');
  const fail = (msg, el) => {
    error.textContent = msg;
    error.hidden = !msg;
    if (el) el.focus();
  };
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    fail('');
    for (const n of ['firstName', 'lastName', 'email', 'phone']) {
      const el = field(n);
      if (!el.value.trim() || !el.checkValidity()) return fail(`${el.labels[0].textContent.replace('*', '').trim()} : à compléter.`, el);
    }
    if (val('phone').replace(/\D/g, '').length < 9) return fail('Numéro de téléphone à vérifier.', field('phone'));
    if (!field('terms').checked) return fail(`Acceptez les conditions de ${premium.name} pour continuer.`, field('terms'));
    if (!api) return fail('L’adhésion en ligne ouvre très bientôt.');
    const btn = $('[data-pay]');
    btn.disabled = true;
    btn.classList.add('is-busy');
    try {
      const res = await fetch(`${api}/api/premium/checkout`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ customer: { firstName: val('firstName'), lastName: val('lastName'), email: val('email'), phone: val('phone') }, news: !field('nonews').checked, consent: { terms: true }, back: location.origin + location.pathname }),
      });
      const j = await res.json().catch(() => ({}));
      if (res.ok && j.url) return location.assign(j.url);
      fail(j.error || 'Le paiement n’a pas pu s’ouvrir. Réessayez dans un instant.', j.field && field(j.field) ? field(j.field) : null);
    } catch {
      fail('Connexion impossible avec le service de paiement. Vérifiez votre connexion et réessayez.');
    }
    btn.disabled = false;
    btn.classList.remove('is-busy');
  });
  const p = new URLSearchParams(location.search);
  const saved = p.has('annule') ? session.get('premium-form') : null;
  if (saved) {
    for (const k of ['firstName', 'lastName', 'email', 'phone']) field(k).value = saved[k] || '';
    field('nonews').checked = !!saved.nonews;
    fail('Paiement interrompu : rien n’a été débité. Votre carte vous attend.');
    document.getElementById('adhesion')?.scrollIntoView({ block: 'start' });
  }
  refresh();
}

// ---------------------------------------------------------------------------------- welcome
async function fetchMember(api, query, onWait) {
  const started = Date.now();
  for (;;) {
    const res = await fetch(`${api}/api/premium?${query}`);
    const j = await res.json().catch(() => ({}));
    if (j.member) return j;
    if (!res.ok || j.ok === false || (j.paid === false && !j.pending)) return j;
    if (Date.now() - started > 30000) return { ...j, late: true };
    onWait?.();
    await new Promise((ok) => setTimeout(ok, 2000));
  }
}
const appHref = (m) => m.cardUrl || `${base()}premium/carte/?n=${encodeURIComponent(m.number)}&t=${encodeURIComponent(m.token)}`;
const bookHref = (code) => `${base()}reservation/?code=${encodeURIComponent(code)}`;

export async function startPremiumDone(root) {
  const api = root.dataset.api;
  const $ = (s) => root.querySelector(s);
  const id = new URLSearchParams(location.search).get('session');
  const lead = $('[data-done-lead]');
  if (!api || !id) {
    lead.textContent = 'Aucune carte à afficher ici.';
    return;
  }
  let j;
  try {
    j = await fetchMember(api, `session=${encodeURIComponent(id)}`, () => (lead.textContent = 'Paiement reçu : votre carte est en cours de création…'));
  } catch {
    j = { error: 'connexion' };
  }
  if (!j.member) {
    if (j.paid === false) {
      $('[data-done-title]').textContent = 'Paiement non finalisé';
      lead.innerHTML = `Le paiement n’a pas abouti : rien n’a été débité. <a href="${base()}premium/#adhesion">Revenir à l’adhésion</a>.`;
    } else lead.textContent = j.late ? 'Votre paiement est bien reçu : votre carte arrive par e-mail d’ici quelques minutes.' : 'Votre carte ne peut pas être affichée pour le moment. Si le paiement est passé, elle vous arrive par e-mail.';
    return;
  }
  const m = j.member;
  session.remove('premium-form');
  // this device now knows the member: « Mon espace » opens without the e-mail's link
  local.set(STORE, { n: m.number, t: m.token });
  $('[data-done-title]').innerHTML = m.renewed ? `Merci, <em>${escHtml(m.firstName)}</em>` : `Bienvenue au club, <em>${escHtml(m.firstName)}</em>`;
  lead.textContent = m.renewed ? `Votre carte est renouvelée jusqu’au ${longDate(m.expires)}. Vos niveaux sont toujours là.` : `Votre carte ${premium.name} est active jusqu’au ${longDate(m.expires)}. Elle vous attend aussi par e-mail.`;
  const stage = $('[data-done-card] [data-card3d]');
  const card = mountCard(stage);
  fillCard(card, m);
  $('[data-done-code]').textContent = m.number;
  $('[data-done-next]').textContent = `En ligne, saisissez ce numéro dans le champ « Code » au moment du paiement, avec l’e-mail de votre carte : −${m.percent || premium.percent} % sur toute la réservation. À l’atelier, donnez simplement votre nom.`;
  if (m.referral?.code) {
    $('[data-done-referral]').hidden = false;
    $('[data-referral-text]').textContent = `Votre code de parrainage offre ${euros(m.referral.amount)} à un proche sur sa première prestation :`;
    $('[data-referral-code]').textContent = m.referral.code;
  }
  $('[data-done-app]').href = appHref(m);
  $('[data-done-book]').href = bookHref(m.number);
  $('[data-copy]').addEventListener('click', (e) => copyText(m.number, e.currentTarget));
  $('[data-done-card]').hidden = false;
  stage.classList.add('is-revealed');
  card.nudge();
}

// ---------------------------------------------------------------------------------- « Mon espace Premium »
const dayParts = (date) => {
  const d = new Date(`${date}T12:00:00Z`);
  return {
    day: new Intl.DateTimeFormat('fr-FR', { day: 'numeric', timeZone: 'UTC' }).format(d),
    month: new Intl.DateTimeFormat('fr-FR', { month: 'short', timeZone: 'UTC' }).format(d).replace('.', ''),
    long: new Intl.DateTimeFormat('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }).format(d),
  };
};
const hourText = (t) => String(t || '').replace(/^0/, '').replace(':', ' h ');

export async function startPremiumCard(root) {
  const api = root.dataset.api;
  const $ = (s) => root.querySelector(s);
  const show = (which) => {
    $('[data-pm-loading]').hidden = which !== 'loading';
    $('[data-pm-login]').hidden = which !== 'login';
    $('[data-pm-main]').hidden = which !== 'main';
  };
  // the link of an e-mail (?n=&t=): kept on this device, then taken out of the address bar
  const p = new URLSearchParams(location.search);
  if (p.get('n') && p.get('t')) {
    local.set(STORE, { n: p.get('n'), t: p.get('t') });
    history.replaceState(null, '', location.pathname + location.hash);
  }
  const creds = local.get(STORE);

  // « Espace membre »: the e-mail, then the 6-digit code it receives (the e-mail's button opens
  // the space directly on the device that reads it). The same answer whether the address is a
  // member's or not: nobody learns who is.
  const status = $('[data-pm-find-status]');
  const find = $('[data-pm-find]');
  const codeForm = $('[data-pm-code]');
  let email = '';
  const ask = async () => {
    status.textContent = 'Envoi…';
    try {
      const res = await fetch(`${api}/api/premium/lien`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email }) });
      const r = await res.json().catch(() => ({}));
      if (!res.ok) throw Object.assign(new Error(), { msg: r.error });
      status.textContent = `Si ${email} est l’adresse d’une carte Premium, un code vient d’y partir.`;
      find.hidden = true;
      codeForm.hidden = false;
      codeForm.elements.code.value = '';
      codeForm.elements.code.focus();
    } catch (err) {
      status.textContent = err?.msg || 'L’envoi n’a pas abouti : vérifiez votre connexion et réessayez.';
    }
  };
  find.addEventListener('submit', (e) => {
    e.preventDefault();
    const input = find.elements.email;
    email = input.value.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
      status.textContent = 'Indiquez une adresse e-mail valide.';
      input.focus();
      return;
    }
    ask();
  });
  codeForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const code = codeForm.elements.code.value.replace(/\D/g, '');
    if (code.length !== 6) {
      status.textContent = 'Le code fait 6 chiffres.';
      codeForm.elements.code.focus();
      return;
    }
    status.textContent = 'Connexion…';
    try {
      const res = await fetch(`${api}/api/premium/connexion`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email, code }) });
      const r = await res.json().catch(() => ({}));
      if (!r.ok) {
        status.textContent = r.error || 'Code non reconnu : demandez-en un nouveau.';
        return;
      }
      local.set(STORE, { n: r.n, t: r.t });
      status.textContent = '';
      load({ n: r.n, t: r.t });
    } catch {
      status.textContent = 'Connexion impossible : vérifiez votre connexion et réessayez.';
    }
  });
  $('[data-pm-resend]').addEventListener('click', () => ask());
  $('[data-pm-other]').addEventListener('click', () => {
    codeForm.hidden = true;
    find.hidden = false;
    status.textContent = '';
    find.elements.email.focus();
  });
  $('[data-pm-logout]').addEventListener('click', () => {
    local.remove(STORE);
    codeForm.hidden = true;
    find.hidden = false;
    show('login');
  });

  async function load(c) {
    show('loading');
    let j;
    try {
      const res = await fetch(`${api}/api/premium?n=${encodeURIComponent(c.n)}&t=${encodeURIComponent(c.t)}`);
      j = await res.json();
    } catch {
      $('[data-pm-loading]').textContent = 'Votre carte ne peut pas être chargée pour le moment : vérifiez votre connexion, puis rouvrez la page.';
      return;
    }
    if (!j.member) {
      local.remove(STORE);
      show('login');
      status.textContent = j.error || 'Ce lien n’est plus valable : connectez-vous avec votre e-mail.';
      return;
    }
    renderApp(root, j.member);
    show('main');
  }
  if (!api || !creds?.n || !creds?.t) return show('login');
  load(creds);
}

function renderApp(root, m) {
  const $ = (s) => root.querySelector(s);
  const now = Date.now();
  const t = tierById(m.tier?.id);
  const tiers = premium.tiers;
  const ti = tiers.indexOf(t);
  const next = m.next ? tierById(m.next.id) : null;
  const card = mountCard($('[data-card3d]'));
  fillCard(card, m);
  $('[data-pm-first]').textContent = m.firstName || '';
  const days = Math.ceil((m.expires - now) / 86400000);
  $('[data-pm-status]').innerHTML = m.active
    ? `Carte active jusqu’au <b>${escHtml(longDate(m.expires))}</b> · niveau <b style="color:${escHtml(t.color)}">${escHtml(t.label)}</b>`
    : `Carte expirée le <b>${escHtml(longDate(m.expires))}</b> · vos niveaux sont gardés`;
  $('[data-pm-book]').href = bookHref(m.number);
  $('[data-pm-copy]').addEventListener('click', (e) => copyText(m.number, e.currentTarget));

  // the level: where the member is, the next light and its gift
  const left = next ? Math.max(1, (m.next.visits ?? next.visits) - (m.visits || 0)) : 0;
  // the gauge: the whole way, from the first level to the last, in the levels' colours
  const top = tiers.at(-1).visits || 1;
  const pc = Math.min(100, Math.round(((m.visits || 0) / top) * 100));
  const level = $('[data-pm-level]');
  level.style.setProperty('--lvl', t.color);
  if (next) level.style.setProperty('--nx', next.color);
  level.innerHTML = `<p class="pm-level__now">Niveau <span>${escHtml(t.label)}</span></p>
<div class="pm-bar" role="progressbar" aria-valuemin="0" aria-valuemax="${top}" aria-valuenow="${m.visits || 0}" aria-label="Prestations faites en tant que membre"><span style="--pc:${Math.max(3, pc)}%;background-image:linear-gradient(90deg, ${tiers.map((x) => x.color).join(', ')});background-size:${Math.round(10000 / Math.max(3, pc))}% 100%"></span></div>
<p class="pm-level__next">${
    next
      ? `Encore <b>${left} prestation${left > 1 ? 's' : ''}</b> pour passer <b style="color:${escHtml(next.color)}">${escHtml(next.label)}</b>${m.next.gift || next.gift ? ` : ${escHtml(((g) => g.charAt(0).toLowerCase() + g.slice(1))(m.next.gift || next.gift))}.` : '.'}`
      : `Vous êtes au sommet : <b style="color:${escHtml(t.color)}">${escHtml(t.label)}</b>. Merci pour votre fidélité !`
  }</p>`;
  for (const [i, li] of root.querySelectorAll('[data-levels] .level').entries()) {
    li.classList.remove('is-past', 'is-current', 'is-next');
    li.classList.add(i < ti ? 'is-past' : i === ti ? 'is-current' : i === ti + 1 ? 'is-next' : 'is-future');
  }

  // the appointments: to come first, then the past ones
  const list = [...(m.bookings || [])].sort((a, b) => (a.upcoming === b.upcoming ? (a.upcoming ? `${a.date}${a.time}`.localeCompare(`${b.date}${b.time}`) : `${b.date}${b.time}`.localeCompare(`${a.date}${a.time}`)) : a.upcoming ? -1 : 1));
  $('[data-pm-bookings]').innerHTML = list.length
    ? `<ul class="pm-list">${list
        .map((b) => {
          const d = dayParts(b.date);
          const items = (b.items || []).map(escHtml).join(' + ');
          const money = Number(b.left) > 0 ? `${euros(b.total)} · réglé ${euros(b.paid)} · reste ${euros(b.left)} à l’atelier` : `${euros(b.total)} · tout est réglé`;
          return `<li class="pm-rdv${b.upcoming ? ' is-upcoming' : ''}"><span class="pm-rdv__date"><b>${escHtml(d.day)}</b><small>${escHtml(d.month)}</small></span><span class="pm-rdv__body">${b.upcoming ? '<span class="pm-tag">À venir</span>' : ''}<b>${items || 'Rendez-vous'}</b><span>${escHtml(d.long)}${b.time ? `, ${escHtml(hourText(b.time))}` : ''}</span><span class="pm-rdv__money">${escHtml(money)}</span></span></li>`;
        })
        .join('')}</ul>`
    : `<p class="pm-empty">Pas encore de rendez-vous avec votre carte.</p><a class="btn btn--ghost btn--sm" href="${escHtml(bookHref(m.number))}">Réserver</a>`;

  // the gifts reached
  const gifts = (m.gifts || []).filter((g) => g.gift);
  $('[data-pm-gifts-block]').hidden = !gifts.length;
  $('[data-pm-gifts]').innerHTML = gifts
    .map((g) => {
      const gt = tierById(g.tier);
      return `<li style="--c:${escHtml(gt.color)}"><i aria-hidden="true"></i><div><b>${escHtml(g.label || gt.label)}</b><p>${escHtml(g.gift)}</p><small>${g.given ? `Remis le ${escHtml(shortDate(g.given))}` : 'À retirer à l’atelier, lors de votre rendez-vous'}</small></div></li>`;
    })
    .join('');

  // the members' offers on now
  const offers = (m.offers || []).filter((o) => !o.expires || o.expires > now);
  $('[data-pm-offers]').innerHTML = offers.length
    ? `<div class="pm-list">${offers
        .map(
          (o) => `<div class="pm-offer"><div class="pm-offer__top"><b>${escHtml(o.label || `Code ${o.code}`)}</b><span class="pm-offer__off">${o.percent ? `−${escHtml(String(o.percent).replace('.', ','))} %` : `−${escHtml(euros(o.amount))}`}</span></div><div class="pm-offer__row"><button class="pm-chip" type="button" data-copy-code="${escHtml(o.code)}" title="Copier le code">${escHtml(o.code)}</button><a class="btn btn--primary btn--sm" href="${escHtml(bookHref(o.code))}">Réserver avec ce code</a></div>${o.expires ? `<small>Jusqu’au ${escHtml(longDate(o.expires))} · réservé aux membres, avec l’e-mail de votre carte</small>` : ''}</div>`
        )
        .join('')}</div>`
    : `<p class="pm-empty">Pas d’offre en cours. Les prochaines arrivent par e-mail${m.email ? ` (${escHtml(m.email)})` : ''} et s’affichent ici. Votre −${m.percent || premium.percent} % vaut toute l’année.</p>`;
  for (const b of root.querySelectorAll('[data-copy-code]')) b.addEventListener('click', () => copyText(b.dataset.copyCode, b));

  // the relatives: the referral code
  if (m.referral?.code) {
    $('[data-pm-referral]').hidden = false;
    $('[data-pm-referral-text]').textContent = `Votre carte est à votre nom. Pour vos proches : votre code de parrainage leur offre ${euros(m.referral.amount)} sur leur première prestation${m.referral.expires ? `, jusqu’au ${longDate(m.referral.expires)}` : ''}.`;
    $('[data-pm-referral-code]').textContent = m.referral.code;
    $('[data-pm-referral-copy]').addEventListener('click', (e) => copyText(m.referral.code, e.currentTarget));
    const share = $('[data-pm-share]');
    if (navigator.share) {
      share.hidden = false;
      share.addEventListener('click', () =>
        navigator.share({ title: 'SOLAR CAR 37', text: `${euros(m.referral.amount)} offerts sur ta première prestation chez SOLAR CAR 37 (vitres teintées, detailing…) avec mon code ${m.referral.code}`, url: `${location.origin}${base()}reservation/?code=${encodeURIComponent(m.referral.code)}` }).catch(() => {})
      );
    }
  }

  // the end of the year: renew (never automatic)
  if (!m.active || days <= 30) {
    $('[data-pm-renew]').hidden = false;
    $('[data-pm-renew-title]').textContent = m.active ? `Votre carte se termine dans ${days} jour${days > 1 ? 's' : ''}` : 'Votre carte est arrivée à échéance';
    $('[data-pm-renew-text]').textContent = `Renouvelez pour un an avec la même adresse e-mail : vos niveaux et vos cadeaux restent acquis.${m.active ? ' L’année s’ajoute à celle en cours.' : ''}`;
  }
  installHint(root);
}

/** « Ajouter à l'écran d'accueil »: Chrome's prompt where there is one, a word on iPhone */
function installHint(root) {
  const box = root.querySelector('[data-pm-install]');
  if (!box || matchMedia('(display-mode: standalone)').matches || navigator.standalone) return;
  const text = root.querySelector('[data-pm-install-text]');
  const btn = root.querySelector('[data-pm-install-btn]');
  const ios = /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  if (ios) {
    box.hidden = false;
    text.innerHTML = 'Dans Safari : touchez <b>Partager</b>, puis <b>Sur l’écran d’accueil</b>. Votre carte s’ouvrira comme une app.';
    return;
  }
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    box.hidden = false;
    text.textContent = 'Votre carte, vos rendez-vous et vos offres, en un geste depuis l’écran d’accueil.';
    btn.hidden = false;
    btn.onclick = async () => {
      e.prompt();
      await e.userChoice.catch(() => null);
      box.hidden = true;
    };
  });
}
