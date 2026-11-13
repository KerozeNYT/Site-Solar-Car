import { bookingRules as R, quote, amountDue, formatDuration, formatEuros } from '../../content/booking.js';
import { jobSpan, utcToZoned } from '../../booking/schedule.js';

/**
 * Online booking (/reservation/): 1. the service, priced as it is chosen (content/booking.js, the
 * same figures the server checks); 2. a free slot, read from the booking server (booking/,
 * Google Calendar); 3. contact details; 4. a deposit of 30 % or the total, paid on Stripe's page.
 */
const DAY = 86400000;
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

  // ------------------------------------------------------------- the configuration
  function config() {
    const svc = checked('svc');
    const c = {};
    if (svc.includes('tint')) {
      c.tint = { vehicle: value('vehicle'), formula: value('formula'), shade: Number(value('shade')) };
      if (value('windshield')) {
        c.tint.windshield = value('windshield');
        if (c.tint.windshield === 'irise') c.tint.color = value('color');
      }
    }
    if (svc.includes('lights')) c.lights = { pairs: value('pairs'), shade: Number(value('lightShade')) };
    return c;
  }

  function refresh() {
    const svc = checked('svc');
    $('[data-block="tint"]').hidden = !svc.includes('tint');
    $('[data-block="lights"]').hidden = !svc.includes('lights');
    const formula = value('formula');
    $('[data-rear-shade]').hidden = !(formula === 'rear' || formula === 'full' || !formula);
    $('[data-front-note]').hidden = !['full', 'front', 'front-quarters'].includes(formula);
    $('[data-iridescent]').hidden = value('windshield') !== 'irise';
    // the price of each package for the chosen vehicle
    const vehicle = value('vehicle');
    for (const el of $$('[data-formula-price]')) {
      const q = vehicle ? quote({ tint: { vehicle, formula: el.dataset.formulaPrice, shade: 15 } }) : null;
      el.textContent = q && !q.error ? formatEuros(q.items[0].price) : '';
    }
    const c = config();
    const q = quote(c);
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
    $('[data-total]').textContent = q.error ? '—' : formatEuros(q.total);
    $('[data-deposit]').textContent = q.error ? '—' : formatEuros(q.deposit);
    $('[data-pay-deposit]').textContent = q.error ? '' : formatEuros(q.deposit);
    $('[data-pay-rest]').textContent = q.error ? '' : formatEuros(q.total - q.deposit);
    $('[data-pay-total]').textContent = q.error ? '' : formatEuros(q.total);
    $('[data-pay-amount]').textContent = q.error ? '' : formatEuros(amountDue(q, value('mode')));
    // a picture of the chosen tint
    const img = $('[data-preview]');
    if (c.tint && vehicle && formula) {
      const view = formula === 'full' ? 'complet' : formula === 'rear' ? 'arriere' : 'avant';
      const src = `/img/vitres/${vehicle}-34-${view}-960.webp`;
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
    if (['firstName', 'lastName', 'email', 'phone', 'carModel', 'plate', 'message', 'terms', 'early'].includes(e.target.name)) return;
    refresh();
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
    const customer = { firstName: field('firstName'), lastName: field('lastName'), email: field('email'), phone: field('phone'), vehicle: field('carModel'), plate: field('plate'), message: field('message') };
    store.set('booking-contact', customer);
    const btn = $('[data-pay]');
    btn.disabled = true;
    btn.classList.add('is-busy');
    try {
      const res = await fetch(`${api}/api/checkout`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ config: config(), date: slot.date, time: slot.time, mode: value('mode'), customer, consent: { terms: true, early: form.elements.early.checked }, back: location.origin + location.pathname }),
      });
      const j = await res.json().catch(() => ({}));
      if (res.ok && j.url) return location.assign(j.url);
      if (res.status === 409) {
        setSlot(null);
        loadMonth(month, false);
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
  setRadio('shade', t?.shade || p.get('teinte'));
  if (t?.windshield) setRadio('windshield', t.windshield);
  if (t?.color) setRadio('color', t.color);
  const l = saved?.c?.lights;
  setRadio('pairs', l?.pairs || p.get('feux'));
  setRadio('lightShade', l?.shade);
  if (saved?.mode) setRadio('mode', saved.mode);
  const contact = saved ? store.get('booking-contact') : null;
  if (contact) for (const [k, v] of Object.entries(contact)) {
    const el = form.elements[k === 'vehicle' ? 'carModel' : k];
    if (el && 'value' in el && !(el instanceof RadioNodeList)) el.value = v;
  }
  if (p.has('annule')) fail('Paiement interrompu : votre créneau n’a pas été retenu. Choisissez-le à nouveau pour réserver.');
  refresh();
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
    lead.innerHTML = 'Le paiement n’a pas abouti : aucun rendez-vous n’a été retenu. <a href="/reservation/">Choisir un créneau</a>.';
    return;
  }
  const span = jobSpan(b.date, b.time, b.minutes, R);
  const end = utcToZoned(span.end, R.timeZone).time;
  $('[data-done-title]').textContent = 'Rendez-vous confirmé';
  lead.textContent = 'Merci ! Votre créneau est réservé à l’atelier. Un reçu de paiement vous a été envoyé par e-mail.';
  $('[data-done-when]').textContent = `${dateLabel(b.date)} · ${hour(b.time)} – ${hour(end)}`;
  $('[data-done-items]').innerHTML = b.items.map((i) => `<li><span><b>${i.label.replace(/</g, '&lt;')}</b><small>${(i.detail || '').replace(/</g, '&lt;')}</small></span><span class="booking__price">${formatEuros(i.price)}</span></li>`).join('');
  $('[data-done-totals]').innerHTML = `<div><dt>Total TTC</dt><dd>${formatEuros(b.total)}</dd></div><div><dt>Payé en ligne</dt><dd>${formatEuros(b.amount)}</dd></div><div><dt>À régler à l’atelier</dt><dd>${b.remaining ? formatEuros(b.remaining) : 'rien'}</dd></div>`;
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
      `DESCRIPTION:${text(`Réglé en ligne : ${formatEuros(b.amount)}. Reste à régler : ${formatEuros(b.remaining)}.`)}`,
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
