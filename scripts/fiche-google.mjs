// The photo queue of the Google Business Profile (content/fiche-google.js), written by the build:
//   dist/fiche-google/<id>.jpg     each photo as a JPG (Google takes JPG or PNG, 10 KB to 5 MB),
//                                  from its 1280 px web version (plates already covered)
//   dist/fiche-google/photos.json  { photos: [{ id, file, service, category, description }] }, in
//                                  sending order; read every week by the booking server
//                                  (booking/fiche-google.js), which sends the first one not sent yet
// Usage: node scripts/fiche-google.mjs [outDir]   (the build calls writeFicheGoogle)
import fs from 'node:fs';
import path from 'node:path';
import { queue } from '../content/fiche-google.js';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const source = (id) => path.join(root, 'public', 'img', 'realisations', `${id}-1280.webp`);

export async function writeFicheGoogle(out) {
  let sharp;
  try {
    ({ default: sharp } = await import('sharp'));
  } catch {
    console.warn('fiche-google: sharp is missing (npm ci), photo queue not written');
    return null;
  }
  const dir = path.join(out, 'fiche-google');
  fs.mkdirSync(dir, { recursive: true });
  const photos = [];
  for (const p of queue((id) => fs.existsSync(source(id)))) {
    const file = `${p.id}.jpg`;
    await sharp(source(p.id)).jpeg({ quality: 88, mozjpeg: true }).toFile(path.join(dir, file));
    photos.push({ id: p.id, file, service: p.service, category: p.category, description: p.description });
  }
  fs.writeFileSync(path.join(dir, 'photos.json'), JSON.stringify({ photos }, null, 1) + '\n');
  return photos.length;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const n = await writeFicheGoogle(path.resolve(process.argv[2] || path.join(root, 'dist')));
  console.log('fiche-google', n, 'photos');
}
