import { bookingRules as R, quote, amountDue, formatDuration, formatEuros, withDiscount, referralCode, discountFor } from '../../content/booking.js';
import { jobSpan, utcToZoned } from '../../booking/schedule.js';
import { deadlineText, runCountdown } from './countdown.js';
import { isGiftCode } from '../../content/offers.js';

/**
 * Online booking (/reservation/): 1. the service, priced as it is chosen (content/booking.js, the
 * same figures the server checks); 2. a free slot, read from the booking server (booking/,
 * Google Calendar); 3. contact details; 4. a deposit of 30 % or the total, paid on Stripe's page.
 */
const DAY = 86400000;
// the site may live in a sub-folder (GitHub Pages preview): the part of the address before /reservation/
const base = () => location.pathname.slice(0, location.pathname.indexOf('reservation/')) || '/';
const pad = (n) => String(n).padStart(2, '0');
const dateLabel = (date, opts = { weekday: 'long', day: 'numeric', month: 'long' }) => new Intl.DateTimeFormat('fr-FR', { ...opts, timeZone: 'UTC' }).format(new Date(`${date}T12:00:00Z`));
const hour = (t) => t.replace(/^0/, '').replace(':', ' h ');
const store = {
  get(k) {
    try {
      return JSON.parse(sessionStorage.getItem(k) || 'null');
    } catch {
      return null;
    }
  },
  set(k, v) {
    try {
      sessionStorage.setItem(k, JSON.stringify(v));
    } catch {
      /* private browsing: nothing kept */
    }
  },
};

export function startBooking(root) {
  const api = root.dataset.api;
  const form = root.querySelector('form');
  const $ = (s) => root.querySelector(s);
  const $$ = (s) => [...root.querySelectorAll(s)];
  const steps = Object.fromEntries($$('[data-step]').map((f) => [f.dataset.step, f]));
  const value = (name) => form.elements[name]?.value ?? '';
  const checked = (name) => $$(`input[name="${name}"]:checked`).map((i) => i.value);
  let slot = null; // { date, time }
  let lastKey = '';
  let referral = null; // a code checked by the server: { code, kind, label, amount | percent, services }
  let gift = null; // a gift card checked by the server: { code, balance, expires }
  const priced = (c) => {
    const q = quote(c);
    return withDiscount(q, discountFor(q, referral));
  };
  const round2 = (n) => Math.round(n * 100) / 100;
  /** what the gift card pays and what is left to pay now, for a mode (the server's own sums,
   *  booking/worker.js): the card goes first, up to the total; under 0,50 € nothing is asked */
  const withGift = (q, mode) => {
    const g = gift && !q.error ? round2(Math.min(gift.balance, q.total)) : 0;
    let now = q.error ? 0 : Math.max(0, round2(amountDue(q, mode) - g));
    if (now < 0.5) now = 0;
    return { g, now, rest: q.error ? 0 : Math.max(0, round2(q.total - g - now)) };
  };

  // ------------------------------------------------------------- the configuration
  function config() {
    const svc = checked('svc');
    const c = {};
    if (svc.includes('tint')) {
      c.tint = { vehicle: value('vehicle'), formula: value('formula') };
      if (value('windshield')) {
        c.tint.windshield = value('windshield');
        if (c.tint.windshield === 'irise') c.tint.color = value('color');
      }
    }
    if (svc.includes('lights')) c.lights = { pairs: value('pairs') };
    return c;
  }

  function refresh() {
    const svc = checked('svc');
    $('[data-block="tint"]').hidden = !svc.includes('tint');
    $('[data-block="lights"]').hidden = !svc.includes('lights');
    const formula = value('formula');
    $('[data-front-note]').hidden = !['full', 'front', 'front-quarters'].includes(formula);
    $('[data-iridescent]').hidden = value('windshield') !== 'irise';
    // the price of each package for the chosen vehicle
    const vehicle = value('vehicle');
    for (const el of $$('[data-formula-price]')) {
      const q = vehicle ? quote({ tint: { vehicle, formula: el.dataset.formulaPrice } }) : null;
      el.textContent = q && !q.error ? formatEuros(q.items[0].price) : '';
    }
    const c = config();
    const q = priced(c);
    // the summary
    const items = $('[data-items]');
    items.innerHTML = '';
    if (q.error) {
      const li = document.createElement('li');
      li.className = 'booking__empty';
      li.textContent = svc.length ? q.error : 'Choisissez une prestation.';
      items.append(li);
    } else
      for (const i of q.items) {
        const li = document.createElement('li');
        li.innerHTML = '<span><b></b><small></small></span><span class="booking__price"></span>';
        li.querySelector('b').textContent = i.label;
        li.querySelector('small').textContent = i.detail;
        li.querySelector('.booking__price').textContent = formatEuros(i.price);
        items.append(li);
      }
    $('[data-duration]').textContent = q.error ? '—' : formatDuration(q.minutes);
    $('[data-discount-row]').hidden = !q.discount;
    $('[data-discount-label]').textContent = referral?.kind === 'promo' ? `Code ${referral.code}` : referral?.kind === 'premium' ? 'Carte Premium' : 'Parrainage';
    // a code that covers none of the chosen services
    if (referral && !q.error && !q.discount) {
      codeStatus.textContent = `Le code ${referral.code} ne s’applique pas à ces prestations.`;
      codeStatus.classList.replace('is-ok', 'is-error');
    } else if (referral && q.discount) {
      codeStatus.textContent = codeText(referral);
      codeStatus.classList.replace('is-error', 'is-ok');
    }
    $('[data-discount]').textContent = q.discount ? `−${formatEuros(q.discount)}` : '—';
    $('[data-total]').textContent = q.error ? '—' : formatEuros(q.total);
    $('[data-deposit]').textContent = q.error ? '—' : formatEuros(q.deposit);
    $('[data-pay-deposit]').textContent = q.error ? '' : formatEuros(q.deposit);
    $('[data-pay-rest]').textContent = q.error ? '' : formatEuros(q.total - q.deposit);
    $('[data-pay-total]').textContent = q.error ? '' : formatEuros(q.total);
    $('[data-pay-amount]').textContent = q.error ? '' : formatEuros(amountDue(q, value('mode')));
    // a gift card: what it pays, what is left to pay now (for each way of paying)
    const pay = withGift(q, value('mode'));
    $('[data-gift-row]').hidden = !pay.g;
    $('[data-gift-amount]').textContent = pay.g ? `−${formatEuros(pay.g)}` : '—';
    $('[data-now-row]').hidden = !gift || !!q.error;
    $('[data-now]').textContent = pay.now ? formatEuros(pay.now) : 'rien';
    for (const mode of ['deposit', 'full']) {
      const p = withGift(q, mode);
      const note = $(`[data-gift-note="${mode}"]`);
      const plain = $(`[data-mode-note="${mode}"]`);
      const on = !!p.g && !q.error;
      note.hidden = !on;
      plain.hidden = on;
      if (on) note.textContent = `Carte cadeau : −${formatEuros(p.g)} · ${p.now ? `${formatEuros(p.now)} à payer maintenant` : 'rien à payer maintenant'}${p.rest ? `, ${formatEuros(p.rest)} à l’atelier` : ''}`;
    }
    const btnLabel = $('[data-pay]');
    if (gift && !q.error) {
      btnLabel.dataset.label ||= btnLabel.innerHTML;
      btnLabel.innerHTML = pay.now ? `Payer <span data-pay-amount>${formatEuros(pay.now)}</span>` : 'Confirmer le rendez-vous <span data-pay-amount></span>';
    } else if (btnLabel.dataset.label) {
      btnLabel.innerHTML = btnLabel.dataset.label;
      delete btnLabel.dataset.label;
      $('[data-pay-amount]').textContent = q.error ? '' : formatEuros(amountDue(q, value('mode')));
    }
    // a picture of the chosen tint
    const img = $('[data-preview]');
    if (c.tint && vehicle && formula) {
      const view = formula === 'full' ? 'complet' : formula === 'rear' ? 'arriere' : 'avant';
      const src = `${base()}img/vitres/${vehicle}-34-${view}-960.webp`;
      if (!img.src.endsWith(src)) img.src = src;
      img.alt = `Aperçu : ${q.items?.[0]?.detail || ''}, formule ${q.items?.[0]?.label.replace('Vitres teintées — ', '') || ''}`;
      img.hidden = false;
    } else img.hidden = true;
    // steps: the slots once the service is complete (and the server is there)
    steps.slot.disabled = !!q.error || !api;
    const key = q.error ? '' : String(q.minutes);
    if (key !== lastKey) {
      lastKey = key;
      if (slot) setSlot(null);
      if (key && api) loadMonth(firstMonth());
      else {
        $('[data-cal-grid]').innerHTML = '';
        $('[data-times]').hidden = true;
        $('[data-cal-status]').textContent = !api ? 'La réservation en ligne ouvre très bientôt : en attendant, demandez votre rendez-vous depuis la page Contact.' : 'Choisissez d’abord votre prestation.';
      }
    }
    steps.contact.disabled = steps.pay.disabled = !slot;
    $('[data-pay]').disabled = !slot || !!q.error;
    store.set('booking', { c, svc, mode: value('mode') });
    return q;
  }

  // ------------------------------------------------------------- the calendar
  const now = Date.now();
  const firstAllowed = utcToZoned(now + R.noticeHours * 3600000, R.timeZone).date;
  const lastAllowed = utcToZoned(now + R.horizonDays * DAY, R.timeZone).date;
  const firstMonth = () => firstAllowed.slice(0, 7);
  let month = firstMonth();
  let monthData = null; // { 'YYYY-MM-DD': [times] }
  let request = 0;

  async function loadMonth(m, autoAdvance = true) {
    month = m;
    const id = ++request;
    const [y, mo] = m.split('-').map(Number);
    const days = new Date(Date.UTC(y, mo, 0)).getUTCDate();
    let from = `${m}-01`;
    if (from < firstAllowed) from = firstAllowed;
    const count = days - Number(from.slice(8)) + 1;
    $('[data-cal-status]').textContent = 'Recherche des créneaux libres…';
    $('[data-cal-month]').textContent = new Intl.DateTimeFormat('fr-FR', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(Date.UTC(y, mo - 1, 15)));
    renderGrid(null);
    let data;
    try {
      const res = await fetch(`${api}/api/slots?config=${encodeURIComponent(JSON.stringify(config()))}&from=${from}&days=${count}`);
      data = await res.json();
      if (!res.ok) throw new Error(data.error);
    } catch (err) {
      if (id !== request) return;
      $('[data-cal-status]').textContent = `Les créneaux ne peuvent pas être affichés pour le moment (${err.message || 'connexion'}). Réessayez dans un instant, ou appelez l’atelier.`;
      return;
    }
    if (id !== request) return;
    monthData = Object.fromEntries(data.slots.map((d) => [d.date, d.times]));
    // the first month with a free slot
    if (autoAdvance && !data.slots.length && `${m}-01` < lastAllowed.slice(0, 7) + '-01') return loadMonth(nextMonth(m), true);
    renderGrid(monthData);
    const n = data.slots.length;
    $('[data-cal-status]').textContent = n ? `${n} jour${n > 1 ? 's' : ''} avec des créneaux libres ce mois-ci.` : 'Aucun créneau libre ce mois-ci.';
  }
  const nextMonth = (m) => {
    const [y, mo] = m.split('-').map(Number);
    return mo === 12 ? `${y + 1}-01` : `${y}-${pad(mo + 1)}`;
  };
  const prevMonth = (m) => {
    const [y, mo] = m.split('-').map(Number);
    return mo === 1 ? `${y - 1}-12` : `${y}-${pad(mo - 1)}`;
  };

  function renderGrid(data) {
    const grid = $('[data-cal-grid]');
    const [y, mo] = month.split('-').map(Number);
    const first = new Date(Date.UTC(y, mo - 1, 1));
    const lead = (first.getUTCDay() + 6) % 7;
    const days = new Date(Date.UTC(y, mo, 0)).getUTCDate();
    const cells = ['L', 'M', 'M', 'J', 'V', 'S', 'D'].map((d, i) => `<span class="cal__dow" aria-hidden="true" title="${['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche'][i]}">${d}</span>`);
    for (let i = 0; i < lead; i++) cells.push('<span></span>');
    for (let d = 1; d <= days; d++) {
      const date = `${month}-${pad(d)}`;
      const times = data?.[date];
      const on = slot?.date === date;
      cells.push(
        times
          ? `<button type="button" class="cal__day${on ? ' is-on' : ''}" data-date="${date}" aria-pressed="${on}" aria-label="${dateLabel(date)}, ${times.length} créneau${times.length > 1 ? 'x' : ''}">${d}</button>`
          : `<span class="cal__day is-off" aria-hidden="true">${d}</span>`
      );
    }
    grid.innerHTML = cells.join('');
    $('[data-cal-prev]').disabled = month <= firstMonth();
    $('[data-cal-next]').disabled = month >= lastAllowed.slice(0, 7);
  }

  function showTimes(date) {
    const times = monthData?.[date] || [];
    $('[data-times]').hidden = false;
    $('[data-times-title]').textContent = `Heure d’arrivée le ${dateLabel(date)}`;
    const groups = [
      ['Matin', times.filter((t) => t < '12:00')],
      ['Après-midi', times.filter((t) => t >= '12:00')],
    ].filter(([, l]) => l.length);
    $('[data-times-list]').innerHTML = groups
      .map(([label, l]) => `<div class="times__group"><p>${label}</p><div class="times__list">${l.map((t) => `<button type="button" class="times__btn${slot?.date === date && slot?.time === t ? ' is-on' : ''}" data-time="${t}" data-date="${date}" aria-pressed="${slot?.date === date && slot?.time === t}">${hour(t)}</button>`).join('')}</div></div>`)
      .join('');
    for (const b of $$('.cal__day[data-date]')) {
      b.classList.toggle('is-on', b.dataset.date === date);
      b.setAttribute('aria-pressed', String(b.dataset.date === date));
    }
  }

  function setSlot(s) {
    slot = s;
    const q = quote(config());
    if (s && !q.error) {
      const span = jobSpan(s.date, s.time, q.minutes, R);
      const end = utcToZoned(span.end, R.timeZone).time;
      $('[data-when]').textContent = `${dateLabel(s.date)}, ${hour(s.time)} – ${hour(end)}`;
      // within the 14 days of the right of withdrawal: the visitor asks for the work on that date
      const early = span.start - Date.now() < 14 * DAY;
      $('[data-early]').hidden = !early;
      form.elements.early.required = early;
    } else {
      $('[data-when]').textContent = '—';
      $('[data-early]').hidden = true;
    }
    for (const b of $$('.times__btn')) {
      const on = !!s && b.dataset.time === s.time && b.dataset.date === s.date;
      b.classList.toggle('is-on', on);
      b.setAttribute('aria-pressed', String(on));
    }
    steps.contact.disabled = steps.pay.disabled = !s;
    $('[data-pay]').disabled = !s;
    if (!s) $('[data-times]').hidden = true;
  }

  root.addEventListener('click', (e) => {
    const day = e.target.closest('.cal__day[data-date]');
    if (day) return showTimes(day.dataset.date);
    const t = e.target.closest('.times__btn');
    if (t) {
      setSlot({ date: t.dataset.date, time: t.dataset.time });
      steps.contact.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });
      return;
    }
    if (e.target.closest('[data-cal-prev]')) loadMonth(prevMonth(month), false);
    if (e.target.closest('[data-cal-next]')) loadMonth(nextMonth(month), false);
  });
  form.addEventListener('change', (e) => {
    if (['firstName', 'lastName', 'email', 'phone', 'carModel', 'plate', 'message', 'terms', 'early', 'connu', 'connu_autre'].includes(e.target.name)) return;
    if (e.target.name === 'code') return applyCode();
    if (e.target.name === 'gift') return applyGift();
    refresh();
  });

  // ------------------------------------------------------------- referral code
  const codeStatus = $('[data-referral-status]');
  const until = (ms) => new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long', timeZone: R.timeZone }).format(new Date(ms));
  const codeText = (j) =>
    j.kind === 'premium'
      ? `Carte Premium${j.owner ? ` de ${j.owner}` : ''} : −${j.percent} % sur toute la réservation. Réservez avec l’e-mail de la carte.`
      : j.kind === 'promo'
        ? `Code ${j.code} : ${j.percent ? `−${j.percent} %` : `${formatEuros(j.amount)} de remise`}, valable jusqu’au ${until(j.expires)}${j.members ? ' · réservé aux membres Premium : réservez avec l’e-mail de votre carte' : ''}.`
        : `Code de ${j.owner} : ${formatEuros(j.amount)} de remise, déduits du total.`;
  // a promo code: its deadline and the time left under the field (to the second on the last day);
  // at the end of the offer the discount goes (the server would refuse the code)
  const deadline = $('[data-code-deadline]');
  let stopCountdown = null;
  function hideDeadline() {
    stopCountdown?.();
    stopCountdown = null;
    if (deadline) deadline.hidden = true;
  }
  function showDeadline(j) {
    hideDeadline();
    if (!deadline || j.kind !== 'promo' || !(j.expires > Date.now())) return;
    const end = j.expires + 1;
    deadline.hidden = false;
    deadline.innerHTML = `Réservation à faire avant le <b>${deadlineText(end)}</b> · <span role="timer"></span>`;
    stopCountdown = runCountdown(deadline.querySelector('[role=timer]'), end, () => {
      referral = null;
      deadline.textContent = '';
      deadline.hidden = true;
      codeStatus.textContent = `L’offre ${j.code} s’est terminée le ${deadlineText(end)} : le code n’est plus accepté.`;
      codeStatus.classList.remove('is-ok');
      codeStatus.classList.add('is-error');
      refresh();
    });
  }
  let checking = null; // the code being checked (the field's change and the button come together)
  async function applyCode() {
    const input = form.elements.code;
    const code = referralCode(input.value);
    input.value = code;
    // a gift card typed here: it is a means of payment, it goes to its own field
    if (isGiftCode(code)) return moveToGift(code);
    if (code && (checking === code || referral?.code === code)) return;
    codeStatus.classList.remove('is-ok', 'is-error');
    referral = null;
    hideDeadline();
    store.set('booking-code', code);
    if (!code) {
      codeStatus.textContent = '';
      return refresh();
    }
    if (!api) {
      codeStatus.textContent = 'Votre code servira dès l’ouverture de la réservation en ligne.';
      return refresh();
    }
    codeStatus.textContent = 'Vérification du code…';
    checking = code;
    try {
      const res = await fetch(`${api}/api/code?code=${encodeURIComponent(code)}`);
      const j = await res.json();
      if (j.ok && j.kind === 'cadeau') {
        checking = null;
        return moveToGift(j.code || code);
      }
      if (j.ok) {
        referral = j;
        codeStatus.textContent = codeText(j);
        codeStatus.classList.add('is-ok');
        showDeadline(j);
      } else {
        codeStatus.textContent = j.error || 'Ce code n’est pas reconnu.';
        codeStatus.classList.add('is-error');
      }
    } catch {
      codeStatus.textContent = 'Le code n’a pas pu être vérifié : réessayez dans un instant.';
      codeStatus.classList.add('is-error');
    }
    checking = null;
    refresh();
  }
  $('[data-referral-apply]').addEventListener('click', () => applyCode());
  form.elements.code.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      applyCode();
    }
  });

  // ------------------------------------------------------------- gift card
  const giftBox = $('[data-gift-field]');
  const giftStatus = $('[data-gift-status]');
  function moveToGift(code) {
    form.elements.code.value = '';
    codeStatus.textContent = 'C’est une carte cadeau : elle est passée dans le champ « Carte cadeau », juste en dessous.';
    codeStatus.classList.remove('is-error');
    codeStatus.classList.add('is-ok');
    store.set('booking-code', '');
    if (referral) {
      referral = null;
      hideDeadline();
    }
    giftBox.open = true;
    form.elements.gift.value = code;
    applyGift();
  }
  let giftChecking = null;
  async function applyGift() {
    const input = form.elements.gift;
    const code = referralCode(input.value);
    input.value = code;
    if (code && (giftChecking === code || gift?.code === code)) return;
    giftStatus.classList.remove('is-ok', 'is-error');
    gift = null;
    store.set('booking-gift', code);
    if (!code) {
      giftStatus.textContent = '';
      return refresh();
    }
    if (!api) {
      giftStatus.textContent = 'Votre carte servira dès l’ouverture de la réservation en ligne.';
      return refresh();
    }
    giftStatus.textContent = 'Vérification de la carte…';
    giftChecking = code;
    try {
      const res = await fetch(`${api}/api/code?code=${encodeURIComponent(code)}`);
      const j = await res.json();
      if (j.ok && j.kind === 'cadeau') {
        if (!(j.balance > 0)) throw Object.assign(new Error(), { msg: 'Cette carte cadeau est entièrement utilisée.' });
        gift = { code: j.code || code, balance: Number(j.balance) || 0, expires: j.expires };
        const end = gift.expires ? new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long', year: 'numeric', timeZone: R.timeZone }).format(new Date(gift.expires)) : '';
        giftStatus.textContent = `Carte cadeau : ${formatEuros(gift.balance)} disponibles${end ? `, valable jusqu’au ${end}` : ''}. Le solde restera sur la carte.`;
        giftStatus.classList.add('is-ok');
      } else if (j.ok) {
        // a promotion, a referral or a Premium code typed here: back to its own field
        giftStatus.textContent = '';
        input.value = '';
        giftChecking = null;
        form.elements.code.value = code;
        return applyCode();
      } else {
        giftStatus.textContent = j.error || 'Cette carte n’est pas reconnue.';
        giftStatus.classList.add('is-error');
      }
    } catch (err) {
      giftStatus.textContent = err?.msg || 'La carte n’a pas pu être vérifiée : réessayez dans un instant.';
      giftStatus.classList.add('is-error');
    }
    giftChecking = null;
    refresh();
  }
  $('[data-gift-apply]').addEventListener('click', () => applyGift());
  form.elements.gift.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      applyGift();
    }
  });

  // ------------------------------------------------------------- payment
  const error = $('[data-error]');
  const fail = (msg) => {
    error.textContent = msg;
    error.hidden = !msg;
    if (msg) error.scrollIntoView({ block: 'center' });
  };
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    fail('');
    const q = refresh();
    if (q.error || !slot) return fail(q.error || 'Choisissez un créneau.');
    for (const name of ['firstName', 'lastName', 'email', 'phone', 'carModel']) {
      const el = form.elements[name];
      if (!el.checkValidity() || !el.value.trim()) {
        el.focus();
        return fail(`${el.labels[0].textContent.replace('*', '').trim()} : à compléter.`);
      }
    }
    if (!form.elements.terms.checked) return fail('Acceptez les conditions de réservation pour continuer.');
    if (form.elements.early.required && !form.elements.early.checked) return fail('Votre rendez-vous a lieu dans moins de 14 jours : cochez la demande de réalisation avant la fin du délai de rétractation.');
    const field = (n) => form.elements[n].value;
    // « Peugeot 308 SW (2021) »: the make, the model and the year, as one line for the workshop
    const year = /^(19|20)\d{2}$/.test(field('carYear')) ? ` (${field('carYear')})` : '';
    const customer = { firstName: field('firstName'), lastName: field('lastName'), email: field('email'), phone: field('phone'), vehicle: `${[field('carMake'), field('carModel')].filter(Boolean).join(' ')}${year}`, plate: field('plate').toUpperCase(), message: field('message') };
    // « Comment nous avez-vous connus ? » (optional)
    customer.source = { channels: $$('input[name="connu"]:checked').map((i) => i.value), other: field('connu_autre') };
    store.set('booking-contact', customer);
    const btn = $('[data-pay]');
    btn.disabled = true;
    btn.classList.add('is-busy');
    try {
      const res = await fetch(`${api}/api/checkout`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ config: config(), date: slot.date, time: slot.time, mode: value('mode'), customer, code: referral?.code || '', gift: gift?.code || '', consent: { terms: true, early: form.elements.early.checked }, back: location.origin + location.pathname }),
      });
      const j = await res.json().catch(() => ({}));
      if (res.ok && j.url) return location.assign(j.url);
      if (res.status === 409) {
        setSlot(null);
        loadMonth(month, false);
      }
      // the gift card is no longer valid (spent meanwhile, expired): dropped, the price as it is
      if (j.gift) {
        gift = null;
        giftStatus.textContent = j.error || '';
        giftStatus.classList.remove('is-ok');
        giftStatus.classList.add('is-error');
        giftBox.open = true;
        refresh();
      }
      // the code is no longer valid (used meanwhile, expired): the full price again
      if (j.code) {
        referral = null;
        hideDeadline();
        codeStatus.textContent = j.error || '';
        codeStatus.classList.remove('is-ok');
        codeStatus.classList.add('is-error');
        refresh();
      }
      fail(j.error || 'Le paiement n’a pas pu s’ouvrir. Réessayez dans un instant.');
    } catch {
      fail('Connexion impossible avec le service de réservation. Vérifiez votre connexion et réessayez.');
    }
    btn.disabled = false;
    btn.classList.remove('is-busy');
  });

  // ------------------------------------------------------------- start: from a link or a cancelled payment
  const p = new URLSearchParams(location.search);
  const saved = p.has('annule') ? store.get('booking') : null;
  const setRadio = (name, v) => {
    const el = v != null && root.querySelector(`input[name="${name}"][value="${CSS.escape(String(v))}"]`);
    if (el) el.checked = true;
  };
  const svc = saved?.svc || (p.get('prestation') || '').split(',').map((x) => ({ vitres: 'tint', feux: 'lights' })[x] || x);
  for (const s of svc) setRadio('svc', s);
  const t = saved?.c?.tint;
  setRadio('vehicle', t?.vehicle || p.get('vehicule'));
  setRadio('formula', t?.formula || p.get('formule'));
  if (t?.windshield) setRadio('windshield', t.windshield);
  if (t?.color) setRadio('color', t.color);
  const l = saved?.c?.lights;
  setRadio('pairs', l?.pairs || p.get('feux'));
  if (saved?.mode) setRadio('mode', saved.mode);
  const contact = saved ? store.get('booking-contact') : null;
  if (contact?.source) {
    for (const c of contact.source.channels || []) setRadio('connu', c);
    if (form.elements.connu_autre) form.elements.connu_autre.value = contact.source.other || '';
    const t = root.querySelector('[data-how-text]');
    if (t) t.hidden = !(contact.source.channels || []).includes('Autre');
  }
  if (contact) for (const [k, v] of Object.entries(contact)) {
    if (k === 'source') continue;
    const el = form.elements[k === 'vehicle' ? 'carModel' : k];
    if (el && 'value' in el && !(el instanceof RadioNodeList)) el.value = v;
  }
  if (p.has('annule')) fail('Paiement interrompu : votre créneau n’a pas été retenu. Choisissez-le à nouveau pour réserver.');
  // a referral code from the gift card's link (?code=…) or kept from a cancelled payment
  const code = p.get('code') || (saved ? store.get('booking-code') : '');
  // a gift card from its e-mail or its page (?cadeau=…), or kept from a cancelled payment
  const giftCode = p.get('cadeau') || (saved ? store.get('booking-gift') : '');
  refresh();
  if (code) {
    form.elements.code.value = code;
    applyCode();
  }
  if (giftCode) {
    giftBox.open = true;
    form.elements.gift.value = giftCode;
    applyGift();
  }
  root.classList.add('is-live');
}

/** /reservation/confirmee/: the booking as the server sees it, and an .ics for the visitor's agenda */
export async function startBookingDone(root) {
  const api = root.dataset.api;
  const id = new URLSearchParams(location.search).get('session');
  const $ = (s) => root.querySelector(s);
  const lead = $('[data-done-lead]');
  if (!api || !id) {
    lead.textContent = 'Aucune réservation à afficher.';
    return;
  }
  let b;
  try {
    const res = await fetch(`${api}/api/booking?session=${encodeURIComponent(id)}`);
    b = await res.json();
    if (!res.ok) throw new Error(b.error);
  } catch {
    lead.textContent = 'Votre réservation ne peut pas être affichée pour le moment. Si votre paiement est passé, vous avez reçu un reçu par e-mail ; l’atelier vous confirme le rendez-vous.';
    return;
  }
  if (!b.paid) {
    $('[data-done-title]').textContent = 'Paiement non finalisé';
    lead.innerHTML = `Le paiement n’a pas abouti : aucun rendez-vous n’a été retenu. <a href="${base()}reservation/">Choisir un créneau</a>.`;
    return;
  }
  const span = jobSpan(b.date, b.time, b.minutes, R);
  const end = utcToZoned(span.end, R.timeZone).time;
  $('[data-done-title]').textContent = 'Rendez-vous confirmé';
  lead.textContent = b.amount ? 'Merci ! Votre créneau est réservé à l’atelier. Un reçu de paiement vous a été envoyé par e-mail.' : 'Merci ! Votre créneau est réservé à l’atelier, réglé avec votre carte cadeau. La confirmation vous a été envoyée par e-mail.';
  $('[data-done-when]').textContent = `${dateLabel(b.date)} · ${hour(b.time)} – ${hour(end)}`;
  $('[data-done-items]').innerHTML = b.items.map((i) => `<li><span><b>${i.label.replace(/</g, '&lt;')}</b><small>${(i.detail || '').replace(/</g, '&lt;')}</small></span><span class="booking__price">${formatEuros(i.price)}</span></li>`).join('');
  const codeLabel = b.codeKind === 'promo' ? `Code ${String(b.code).replace(/</g, '&lt;')}` : b.codeKind === 'premium' ? 'Carte Premium' : 'Parrainage';
  const giftPaid = Number(b.gift?.amount) || 0;
  $('[data-done-totals]').innerHTML = `${b.discount ? `<div><dt>${b.code ? `${codeLabel}${b.remise ? ' et remise' : ''}` : 'Remise'}</dt><dd>−${formatEuros(b.discount)}</dd></div>` : ''}<div><dt>Total</dt><dd>${formatEuros(b.total)}</dd></div>${giftPaid ? `<div><dt>Carte cadeau</dt><dd>${formatEuros(giftPaid)}</dd></div>` : ''}${b.amount || !giftPaid ? `<div><dt>Payé en ligne</dt><dd>${formatEuros(b.amount)}</dd></div>` : ''}<div><dt>À régler à l’atelier</dt><dd>${b.remaining ? formatEuros(b.remaining) : 'rien'}</dd></div>`;
  $('[data-done-card]').hidden = false;
  $('[data-done-ics]').addEventListener('click', () => {
    const stamp = (ms) => new Date(ms).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
    const text = (s) => s.replace(/[\\,;]/g, (c) => '\\' + c).replace(/\n/g, '\\n');
    const ics = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//SOLAR CAR 37//Reservation//FR',
      'BEGIN:VEVENT',
      `UID:${id}@solarcar37.fr`,
      `DTSTAMP:${stamp(Date.now())}`,
      `DTSTART:${stamp(span.start)}`,
      `DTEND:${stamp(span.end)}`,
      `SUMMARY:${text(`${root.dataset.name} — ${b.items.map((i) => i.label).join(' + ')}`)}`,
      `LOCATION:${text(root.dataset.address)}`,
      `DESCRIPTION:${text(`${b.gift?.amount ? `Carte cadeau : ${formatEuros(b.gift.amount)}. ` : ''}Réglé en ligne : ${formatEuros(b.amount)}. Reste à régler : ${formatEuros(b.remaining)}.`)}`,
      'END:VEVENT',
      'END:VCALENDAR',
    ].join('\r\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([ics], { type: 'text/calendar' }));
    a.download = 'rendez-vous-solar-car-37.ics';
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  });
}
