import { giftCard, giftAmount, offerEuros } from '../../content/offers.js';
import { mountCard, longDate, euros, siteBase, keep, copyText } from './card3d.js';

/**
 * The gift card (content/offers.js), sold through the booking server (booking/worker.js):
 *   /carte-cadeau/          the card composed live in 3D, then Stripe's payment page (startGift)
 *   /carte-cadeau/merci/    the card revealed once paid (startGiftDone)
 *   /carte-cadeau/voir/     the card itself, its balance, printing (startGiftView)
 */
const session = keep('session');
const base = () => siteBase('carte-cadeau/');
const parisDay = (ms = Date.now()) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Paris', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(ms));
const addDays = (date, n) => {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};
const dayText = (date) => new Intl.DateTimeFormat('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' }).format(new Date(`${date}T12:00:00Z`));
/** the day a card bought now ends */
const until = () => {
  const d = new Date();
  d.setMonth(d.getMonth() + giftCard.months);
  return longDate(d.getTime());
};
const cardAmount = (n) => offerEuros(n).replace(/\s?€$/, '');
/** the amount on the card ([data-len] sizes it) */
function setAmount(card, n) {
  const txt = cardAmount(n);
  card.set('amount', txt);
  card.card.querySelector('[data-c="amount"]')?.setAttribute('data-len', String(txt.length));
}
/** fills a card from the server's answer (booking/worker.js, GET /api/cadeau) */
function fillCard(card, c) {
  card.look(c.look || 'or');
  setAmount(card, c.amount);
  card.set('to', c.toName);
  card.set('sender', c.sender);
  card.set('message', c.message);
  card.set('code', c.code);
  card.set('until', longDate(c.expires));
}
const bookHref = (code) => `${base()}reservation/?cadeau=${encodeURIComponent(code)}`;

// ---------------------------------------------------------------------------------- purchase
export function startGift(root) {
  const api = root.dataset.api;
  const form = root.querySelector('form');
  const $ = (s) => root.querySelector(s);
  const card = mountCard(root.querySelector('[data-card3d]'));
  const field = (n) => form.elements[n];
  const val = (n) => String(field(n)?.value ?? '').trim();
  const radio = (n) => form.querySelector(`input[name="${n}"]:checked`)?.value || '';
  const today = parisDay();
  const dateInput = field('sendOn');
  dateInput.min = today;
  dateInput.max = addDays(today, giftCard.sendDays);
  if (!dateInput.value) dateInput.value = today;
  card.set('until', until());
  // the « De la part de » follows the buyer's first name until the visitor writes their own
  let senderTouched = false;

  /** the amount chosen, or null (a free amount out of bounds) */
  const amount = () => (radio('amount') === 'libre' ? giftAmount(val('free')) : giftAmount(radio('amount')));

  function refresh() {
    const free = radio('amount') === 'libre';
    $('[data-free]').hidden = !free;
    const a = amount();
    setAmount(card, a ?? (free ? 0 : 100));
    $('[data-gift-total]').textContent = a ? offerEuros(a) : '—';
    card.look(radio('look') || 'or');
    card.set('to', val('to'));
    if (!senderTouched) field('sender').value = val('firstName');
    card.set('sender', val('sender'));
    card.set('message', val('message'));
    $('[data-count]').textContent = String(val('message').length);
    const toThem = radio('delivery') === 'destinataire';
    $('[data-recipient]').hidden = !toThem;
    field('toEmail').required = toThem;
    session.set('gift-form', Object.fromEntries([...new FormData(form)].filter(([k]) => k !== 'terms')));
  }
  form.addEventListener('input', (e) => {
    if (e.target.name === 'sender') senderTouched = !!e.target.value;
    refresh();
  });
  form.addEventListener('change', (e) => {
    refresh();
    if (e.target.name === 'look') card.nudge();
    if (e.target.name === 'amount' && e.target.value === 'libre') field('free').focus();
  });
  // the message is on the back: the card turns over while it is written, and back afterwards
  field('message').addEventListener('focus', () => card.flip(true));
  field('message').addEventListener('blur', () => card.flip(false));
  field('sender').addEventListener('focus', () => card.flip(true));
  field('sender').addEventListener('blur', () => card.flip(false));
  field('to').addEventListener('focus', () => card.flip(false));

  const error = $('[data-error]');
  const fail = (msg, el) => {
    error.textContent = msg;
    error.hidden = !msg;
    if (el) el.focus();
    else if (msg) error.scrollIntoView({ block: 'center' });
  };
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    fail('');
    const a = amount();
    if (!a) return fail(`Choisissez un montant entre ${giftCard.min} et ${giftCard.max} €.`, radio('amount') === 'libre' ? field('free') : null);
    const toThem = radio('delivery') === 'destinataire';
    const email = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
    if (toThem && !email.test(val('toEmail'))) return fail('Indiquez l’e-mail du destinataire.', field('toEmail'));
    if (toThem && !(val('sendOn') >= today && val('sendOn') <= dateInput.max)) return fail('Choisissez le jour d’envoi : aujourd’hui ou plus tard.', dateInput);
    for (const n of ['firstName', 'lastName', 'email']) {
      const el = field(n);
      if (!el.value.trim() || !el.checkValidity()) return fail(`${el.labels[0].textContent.replace('*', '').trim()} : à compléter.`, el);
    }
    if (!field('terms').checked) return fail('Acceptez les conditions des cartes cadeaux pour continuer.', field('terms'));
    if (!api) return fail('La vente en ligne ouvre très bientôt : en attendant, la carte s’achète à l’atelier.');
    const btn = $('[data-pay]');
    btn.disabled = true;
    btn.classList.add('is-busy');
    try {
      const res = await fetch(`${api}/api/cadeau/checkout`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          amount: a,
          look: radio('look') || 'or',
          to: { name: val('to'), email: toThem ? val('toEmail') : '' },
          from: { firstName: val('firstName'), lastName: val('lastName'), email: val('email'), phone: val('phone') },
          sender: val('sender') || val('firstName'),
          message: val('message').slice(0, giftCard.messageMax),
          delivery: toThem ? 'destinataire' : 'moi',
          sendOn: toThem ? val('sendOn') : today,
          consent: { terms: true },
          back: location.origin + location.pathname,
        }),
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

  // back from a cancelled payment: the form as it was
  const p = new URLSearchParams(location.search);
  const saved = p.has('annule') ? session.get('gift-form') : null;
  if (saved) {
    for (const [k, v] of Object.entries(saved)) {
      const el = field(k);
      if (!el) continue;
      if (el instanceof RadioNodeList) {
        const r = form.querySelector(`input[name="${k}"][value="${CSS.escape(String(v))}"]`);
        if (r) r.checked = true;
      } else el.value = v;
    }
    senderTouched = !!saved.sender && saved.sender !== saved.firstName;
    fail('Paiement interrompu : rien n’a été débité. Votre carte vous attend, il ne reste qu’à la régler.');
  }
  // a finish or an amount chosen from a link (?finition=noel&montant=150)
  const look = p.get('finition');
  if (look) {
    const r = form.querySelector(`input[name="look"][value="${CSS.escape(look)}"]`);
    if (r) r.checked = true;
  }
  const m = p.get('montant');
  if (m && giftAmount(m)) {
    const r = form.querySelector(`input[name="amount"][value="${CSS.escape(m)}"]`);
    if (r) r.checked = true;
    else {
      form.querySelector('input[name="amount"][value="libre"]').checked = true;
      field('free').value = m;
    }
  }
  // during the Christmas look (content/themes.js), the card is dressed for it
  if (!saved && !look && document.documentElement.dataset.saison === 'noel') form.querySelector('input[name="look"][value="noel"]').checked = true;
  refresh();
}

// ---------------------------------------------------------------------------------- after the payment
/** GET /api/cadeau?…, polled while the payment is being written (Stripe's notice may come late) */
async function fetchCard(api, query, onWait) {
  const started = Date.now();
  for (;;) {
    const res = await fetch(`${api}/api/cadeau?${query}`);
    const j = await res.json().catch(() => ({}));
    if (j.card) return j;
    if (!res.ok || j.ok === false || (j.paid === false && !j.pending)) return j;
    if (Date.now() - started > 30000) return { ...j, late: true };
    onWait?.();
    await new Promise((ok) => setTimeout(ok, 2000));
  }
}

export async function startGiftDone(root) {
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
    j = await fetchCard(api, `session=${encodeURIComponent(id)}`, () => (lead.textContent = 'Paiement reçu : votre carte est en cours de création…'));
  } catch {
    j = { error: 'connexion' };
  }
  if (!j.card) {
    if (j.paid === false) {
      $('[data-done-title]').textContent = 'Paiement non finalisé';
      lead.innerHTML = `Le paiement n’a pas abouti : rien n’a été débité. <a href="${base()}carte-cadeau/">Revenir à la carte cadeau</a>.`;
    } else lead.textContent = j.late ? 'Votre paiement est bien reçu : la carte arrive par e-mail d’ici quelques minutes. Si elle tarde, appelez-nous, nous vous la renvoyons.' : 'Votre carte ne peut pas être affichée pour le moment. Si le paiement est passé, elle vous arrive par e-mail.';
    return;
  }
  const c = j.card;
  session.remove('gift-form');
  lead.textContent = c.delivery === 'destinataire' ? 'Votre carte cadeau est prête. Elle partira toute seule, au jour dit.' : 'Votre carte cadeau est prête : elle vous attend aussi dans votre boîte e-mail.';
  const stage = $('[data-done-card] [data-card3d]');
  const card = mountCard(stage);
  fillCard(card, c);
  $('[data-done-code]').textContent = c.code;
  $('[data-done-next]').textContent =
    c.delivery === 'destinataire'
      ? c.sent
        ? `Elle vient de partir par e-mail à ${c.toEmail}. Vous en avez une copie dans votre boîte e-mail, avec le reçu.`
        : `Elle partira par e-mail à ${c.toEmail} le ${dayText(c.sendOn)}, vers 8 h. En attendant, vous en avez une copie dans votre boîte e-mail, avec le reçu.`
      : 'Imprimez-la ou transférez l’e-mail : le destinataire n’a plus qu’à réserver avec le code, en ligne ou à l’atelier.';
  if (c.viewUrl) $('[data-done-view]').href = c.viewUrl;
  else $('[data-done-view]').hidden = true;
  $('[data-done-book]').href = bookHref(c.code);
  $('[data-copy]').addEventListener('click', (e) => copyText(c.code, e.currentTarget));
  $('[data-done-card]').hidden = false;
  stage.classList.add('is-revealed');
  card.nudge();
}

export async function startGiftView(root) {
  const api = root.dataset.api;
  const $ = (s) => root.querySelector(s);
  const p = new URLSearchParams(location.search);
  const lead = $('[data-view-lead]');
  if (!api || !p.get('c') || !p.get('t')) {
    lead.textContent = 'Ce lien de carte cadeau est incomplet : ouvrez-le depuis l’e-mail reçu.';
    return;
  }
  let j;
  try {
    const res = await fetch(`${api}/api/cadeau?c=${encodeURIComponent(p.get('c'))}&t=${encodeURIComponent(p.get('t'))}`);
    j = await res.json();
  } catch {
    j = { error: 'La carte ne peut pas être affichée pour le moment : réessayez dans un instant.' };
  }
  if (!j.card) {
    lead.textContent = j.error || 'Cette carte cadeau est introuvable.';
    return;
  }
  const c = j.card;
  const card = mountCard($('[data-view-card] [data-card3d]'));
  fillCard(card, c);
  const state = { active: 'Active', epuisee: 'Entièrement utilisée', expiree: 'Expirée' }[c.status] || 'Active';
  $('[data-view-title]').innerHTML = c.toName ? `Pour <em>${c.toName.replace(/[<>&"]/g, '')}</em>` : 'Votre carte <em>cadeau</em>';
  lead.textContent =
    c.status === 'active'
      ? `${c.sender ? `De la part de ${c.sender}. ` : ''}Une carte de ${euros(c.amount)} à dépenser à l’atelier, sur la prestation de votre choix.`
      : c.status === 'epuisee'
        ? 'Cette carte a été entièrement utilisée. Merci, et à bientôt à l’atelier !'
        : 'Cette carte a dépassé sa date de validité.';
  $('[data-view-facts]').innerHTML = `<div><dt>Solde disponible</dt><dd>${euros(c.balance)}</dd></div><div><dt>Valable jusqu’au</dt><dd>${longDate(c.expires)}</dd></div><div><dt>État</dt><dd>${state}</dd></div>`;
  const book = $('[data-view-book]');
  book.href = bookHref(c.code);
  book.hidden = c.status !== 'active';
  $('[data-print]').addEventListener('click', () => {
    card.flip(false);
    window.print();
  });
  $('[data-view-card]').hidden = false;
  card.nudge();
}
