// The professionals of the workshop's space: their card (SIRET, logo), the terms, the partnership
// file as PDF; the public directory read by SIRET.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { companyBySiret } from '../atelier.js';
import { proSheetPdf } from '../pro-sheet.js';
import { PDFDocument } from 'pdf-lib';
const count = async (bytes) => (await PDFDocument.load(bytes)).getPageCount();

test('a company found by its SIRET in the public directory', async () => {
  let asked = '';
  const fetcher = async (u) => {
    asked = u;
    return Response.json({ results: [{ nom_complet: 'GARAGE DU CENTRE', nom_raison_sociale: 'GARAGE DU CENTRE', nature_juridique: '5499', activite_principale: '45.20A', siege: { siret: '12345678900012', adresse: '1 RUE DE LA GARE 37000 TOURS' }, matching_etablissements: [{ siret: '12345678900034', adresse: '8 AVENUE DE GRAMMONT 37000 TOURS', activite_principale: '45.20A', liste_enseignes: ['AUTO 37'] }] }] });
  };
  const c = await companyBySiret('123 456 789 00034', fetcher);
  assert.match(asked, /q=12345678900034/);
  assert.deepEqual(c, { name: 'AUTO 37 (GARAGE DU CENTRE)', legal: 'SARL', address: '8 AVENUE DE GRAMMONT 37000 TOURS', activity: 'Entretien et réparation de véhicules légers (45.20A)', siret: '12345678900034' });
  assert.equal(await companyBySiret('123', fetcher), null);
});

test('the partnership file: both logos, the terms, one page per service', async () => {
  const logo = readFileSync(new URL('../assets/logo-sombre-800.png', import.meta.url));
  const bytes = await proSheetPdf({ name: 'Garage du Centre', contact: 'Julien Martin', address: 'Tours', logo, logoType: 'image/png' }, { logo, now: Date.UTC(2026, 10, 20), terms: { kmRate: '0,60' } });
  assert.equal(Buffer.from(bytes.slice(0, 5)).toString(), '%PDF-');
  // cover, terms, tint (+ its overflow), shades, lights, headlights
  const pages = await count(bytes);
  assert.ok(pages >= 6, `${pages} pages`);
  const one = await proSheetPdf({ name: 'Solo' }, { sheets: ['phares'] });
  assert.equal(await count(one), 3);
});

test('companies found by name: Indre-et-Loire first, else all of France', async () => {
  const { companySearch } = await import('../atelier.js');
  const asked = [];
  const fetcher = async (u) => {
    asked.push(new URL(u).searchParams);
    const dept = new URL(u).searchParams.get('departement');
    return Response.json({ results: dept ? [] : [{ nom_complet: 'GARAGE DU LAC', nature_juridique: '5710', siege: { siret: '11122233300015', adresse: '2 RUE DU LAC 41000 BLOIS', activite_principale: '45.20A' } }] });
  };
  const list = await companySearch('garage du lac', fetcher);
  assert.equal(asked[0].get('departement'), '37');
  assert.equal(asked[0].get('etat_administratif'), 'A');
  assert.equal(asked[1].get('departement'), null);
  assert.deepEqual(list, [{ name: 'GARAGE DU LAC', legal: 'SAS', address: '2 RUE DU LAC 41000 BLOIS', activity: 'Entretien et réparation de véhicules légers (45.20A)', siret: '11122233300015' }]);
  assert.deepEqual(await companySearch('a', fetcher), []);
});
