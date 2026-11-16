/**
 * Photos sent to the Google Business Profile by the booking server, one a week
 * (booking/fiche-google.js, docs/FICHE-GOOGLE-AUTO.md).
 *
 * The queue is the gallery of real jobs (content/realisations.js): add a job there and its
 * photos join the queue on the next build. The order takes the first photo of each job, then the
 * second photo of each job, and so on: a job added at the top of content/realisations.js has its
 * first photo sent the following week, and two photos of the same car never follow each other.
 * The build writes each photo as a JPG (Google takes neither WebP nor AVIF) with the list in
 * /fiche-google/photos.json; the server sends the first one of the list it has not sent yet.
 *
 * Only genuine photos, already prepared by scripts/photos.mjs (plates covered, metadata
 * stripped): never a 3D render or a generated picture (forbidden on a Business Profile).
 */
import { realisations } from './realisations.js';

/**
 * Already on the profile: sent by hand with Claude navigateur on 16 November 2026 (folder
 * « 1-maintenant », docs/fiche-google/PROMPT-CLAUDE-NAVIGATEUR.md), or the same photo in another
 * crop. Never sent again.
 */
export const sentByHand = [
  'porsche-panamera-vitres-teintees',
  'porsche-cayenne-coupe-vitres-teintees-34',
  'audi-a7-sportback-vitres-teintees',
  'volvo-xc90-phares-avant-apres',
  'bmw-m2-detailing-lustrage',
  // sent in its square crop (mclaren-720s-covering-carre)
  'mclaren-720s-covering-noir-satine',
  'bmw-m2-covering-violet',
  'bmw-serie-2-ciel-etoile',
  'mazda-3-detailing',
  'bmw-covering-or-chrome',
  'mclaren-720s-covering-pose',
  'audi-s1-ciel-etoile',
];

/** Real photos that are not in the gallery, sent after its photos (same `alt` as on the site). */
export const extra = [
  { id: 'peugeot-206-feux-arriere-fonces', service: 'feux-arriere-teintes', alt: 'Peugeot 206 blanche aux feux arrière foncés, vue de trois quarts arrière' },
];

/**
 * Google's photo category, read from the photo's description: inside the workshop, in front of
 * it, during the work, or a photo of a job (ADDITIONAL).
 */
export function categoryOf(alt = '') {
  if (/dans l’atelier/i.test(alt)) return 'INTERIOR';
  if (/pendant la pose/i.test(alt)) return 'AT_WORK';
  if (/devant (l’atelier|la porte de l’atelier|le bardage)/i.test(alt)) return 'EXTERIOR';
  return 'ADDITIONAL';
}

/**
 * The queue: [{ id, service, category, description }], in sending order. `published(id)` says
 * whether the web version of a photo exists (the build passes a check of public/img/realisations).
 */
export function queue(published = () => true) {
  const skip = new Set(sentByHand);
  const jobs = [...realisations.map((r) => r.photos.map((p) => ({ ...p, service: r.service }))), ...extra.map((p) => [p])]
    .map((photos) => photos.filter((p) => !skip.has(p.id) && published(p.id)))
    .filter((photos) => photos.length);
  const out = [];
  const seen = new Set();
  for (let round = 0; jobs.some((photos) => photos.length > round); round++) {
    for (const photos of jobs) {
      const p = photos[round];
      if (!p || seen.has(p.id)) continue;
      seen.add(p.id);
      out.push({ id: p.id, service: p.service, category: categoryOf(p.alt), description: p.alt });
    }
  }
  return out;
}
