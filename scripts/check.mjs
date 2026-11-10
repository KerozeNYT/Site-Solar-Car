// Lists what the site still waits for from the business (`npm run check`): fields left empty in
// content/, legal mentions to complete, 3D model credits, real photos. Nothing is invented: an
// empty field is simply not shown on the site until it is filled in.
import fs from 'node:fs';
import path from 'node:path';
import { business, legalPage } from '../content/site.js';
import car from '../content/car.js';
import vehicles from '../content/vehicles.js';
import { realisations } from '../content/realisations.js';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const todo = [];
const add = (where, what, why) => todo.push({ where, what, why });

if (!legalPage.mediator) add('content/site.js → legalPage.mediator', 'Médiateur de la consommation', 'obligatoire pour vendre à des particuliers (Code de la consommation, L612-1)');
if (!legalPage.retention) add('content/site.js → legalPage.retention', 'Durée de conservation des demandes de devis', 'mentions RGPD plus précises');
if (!business.google?.profileUrl) add('content/site.js → business.google.profileUrl', 'Lien de la fiche Google (Maps > Partager)', 'référencement local : relie le site à la fiche, boutons « avis » exacts');
if (!business.google?.reviewUrl) add('content/site.js → business.google.reviewUrl', 'Lien « Demander des avis » de la fiche Google', 'bouton « Laisser un avis » direct');
if (!business.google?.placeId || !business.google?.mapsApiKey) add('content/site.js → business.google.placeId / mapsApiKey', 'Identifiant de la fiche et clé Google Maps', 'afficher les 5 derniers avis Google sur le site (facultatif)');
if (!business.instagramFeed?.feedUrl) add('content/site.js → business.instagramFeed.feedUrl', 'Flux Instagram (service type Behold)', 'afficher les 5 dernières publications (facultatif)');
if (!business.social?.facebook) add('content/site.js → business.social.facebook', 'Page Facebook', 'seulement si elle existe');

const credits = [car, ...Object.values(vehicles).map((v) => v.config).filter(Boolean)].map((c) => c.credit).filter(Boolean);
const open = [...new Set(credits.filter((c) => /compléter/i.test(c.text)).map((c) => c.text.split(' — ')[0]))];
if (open.length) add('content/car.js, content/cars/*.js → credit', `Licence et crédit des modèles 3D (${open.length}) : ${open.join(', ')}`, 'droit d’utilisation des modèles, affiché dans les mentions légales');

const photos = (realisations || []).flatMap((r) => r.photos || []);
const missing = photos.filter((p) => !fs.existsSync(path.join(root, 'public/img/realisations', `${p.id}-960.webp`)));
if (!photos.length) add('content/realisations.js', 'Photos de réalisations', 'galerie et pages de prestations (de vrais chantiers rassurent et se référencent)');
else if (missing.length) add('public/img/realisations/', `${missing.length} photo(s) déclarée(s) sans version web : ${missing.map((p) => p.id).join(', ')}`, 'lancer node scripts/photos.mjs');

if (!todo.length) console.log('Rien ne manque.');
else {
  console.log(`${todo.length} élément(s) à fournir :\n`);
  for (const t of todo) console.log(`- ${t.what}\n    où : ${t.where}\n    pourquoi : ${t.why}\n`);
}
