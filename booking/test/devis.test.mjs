// The quotes as PDF (booking/devis.js): one page, the sums, the validity of one month.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { devisPdf, plusMonths } from '../devis.js';

test('a quote as PDF: the sums, the deposit, valid one month', async () => {
  const logo = readFileSync(new URL('../assets/logo-sombre-800.png', import.meta.url));
  const r = await devisPdf(
    {
      number: 'D-2026-0001',
      date: Date.UTC(2026, 10, 19, 10),
      client: { name: 'Mathieu Exemple', phone: '06 12 34 56 78', email: 'mathieu@example.com' },
      vehicle: 'Peugeot 308',
      items: [
        { label: 'Vitres teintées — Complet', detail: 'Berline, teinte choisie à l’atelier', qty: 1, unit: 270 },
        { label: 'Feux teintés — Feux arrière', qty: 2, unit: 60 },
      ],
      discount: { label: 'Remise', amount: 39 },
      minutes: 180,
    },
    { logo }
  );
  assert.equal(Buffer.from(r.bytes.slice(0, 5)).toString(), '%PDF-');
  assert.equal(r.total, 351);
  assert.equal(r.deposit, 105.3);
  assert.equal(new Date(r.validUntil).toISOString().slice(0, 10), '2026-12-19');
  // characters the standard fonts cannot write do not break it
  const odd = await devisPdf({ number: 'D-2026-0002', date: Date.now(), client: { name: 'Zoé → Ł' }, items: [{ label: 'Ciel étoilé − option', qty: 1, unit: 1234.5 }] });
  assert.equal(odd.total, 1234.5);
});

test('one month later: the end of a shorter month', () => {
  assert.equal(new Date(plusMonths(Date.UTC(2027, 0, 31, 10), 1)).toISOString().slice(0, 10), '2027-02-28');
});
