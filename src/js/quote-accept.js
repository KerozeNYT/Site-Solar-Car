// www.solarcar37.fr/devis/?n=12&t=…: the client accepts a quote from the button of its e-mail.
// The link only shows the quote; accepting takes a click on this page (a mail scanner that opens
// links never accepts anything). Booking server: GET /api/devis, POST /api/devis/accepter.
const el = (tag, cls, text) => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text != null) e.textContent = text;
  return e;
};
const euros = (n) => new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', minimumFractionDigits: n % 1 ? 2 : 0, maximumFractionDigits: 2 }).format(n);

export function startQuoteAccept(box) {
  const api = box.dataset.api;
  const q = new URLSearchParams(location.search);
  const n = q.get('n') || '';
  const t = q.get('t') || '';
  const title = box.querySelector('[data-qa-title]');
  const lead = box.querySelector('[data-qa-lead]');
  const card = box.querySelector('[data-qa-card]');
  const done = (heading, text) => {
    title.textContent = heading;
    lead.textContent = text;
  };
  const invalid = () => done('Lien de devis non valable', 'Ce lien est incomplet ou n’est plus valable. Appelez-nous, ou répondez à notre e-mail : nous confirmons votre devis avec vous.');
  if (!api || !/^\d+$/.test(n) || !/^[0-9a-f]{32}$/.test(t)) return invalid();
  fetch(`${api}/api/devis?n=${n}&t=${t}`)
    .then((r) => r.json())
    .then((info) => {
      if (!info.ok) return invalid();
      title.textContent = `Votre devis n°${info.n}`;
      const items = card.querySelector('[data-qa-items]');
      for (const [k, v] of [
        ['Véhicule', info.vehicle],
        ['Prestation(s)', info.services],
        ['Montant', info.amount ? euros(info.amount) : ''],
      ]) {
        if (!v) continue;
        const li = el('li');
        li.append(el('span', null, k), el('strong', null, v));
        items.append(li);
      }
      card.hidden = false;
      if (info.status === 'valide') return done(`Devis n°${info.n} accepté`, 'Ce devis est déjà accepté : nous vous appelons pour fixer la date du rendez-vous.');
      lead.textContent = `${info.firstName ? `${info.firstName}, ce` : 'Ce'} devis vous convient ? Confirmez-le ici : nous vous appelons ensuite pour fixer la date du rendez-vous.`;
      const btn = card.querySelector('[data-qa-accept]');
      btn.hidden = false;
      btn.addEventListener('click', async () => {
        btn.disabled = true;
        btn.textContent = 'Envoi…';
        try {
          const res = await fetch(`${api}/api/devis/accepter`, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=UTF-8' }, body: JSON.stringify({ n: Number(n), t }) });
          const j = await res.json();
          if (!j.ok) throw new Error(j.error || String(res.status));
          btn.hidden = true;
          done(`Merci${j.firstName ? ` ${j.firstName}` : ''} !`, j.already ? 'Ce devis était déjà accepté : nous vous appelons pour fixer la date du rendez-vous.' : 'Votre devis est accepté. L’atelier est prévenu et vous appelle très vite pour fixer la date du rendez-vous.');
        } catch {
          btn.disabled = false;
          btn.textContent = 'J’accepte ce devis';
          lead.textContent = 'L’envoi n’a pas abouti : réessayez dans un instant, ou appelez-nous.';
        }
      });
    })
    .catch(() => done('Votre devis', 'Le devis n’a pas pu être chargé pour le moment : réessayez dans un instant, ou appelez-nous.'));
}
