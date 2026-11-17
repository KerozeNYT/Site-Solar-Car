// Files too large for the host: Cloudflare Pages takes files of 25 MiB at most, and the sharpest
// versions of the home film are larger (1440p, 4K). They are cut into parts at build time
// (`<file>.p1`, `<file>.p2`…, 20 MiB each); the page knows how many (data-parts on the film), and
// src/js/film.js downloads the parts and puts them back together in memory: the same file, no loss.
import fs from 'node:fs';
import path from 'node:path';

const LIMIT = 24 * 1024 * 1024;
const PART = 20 * 1024 * 1024;

/** how many parts a file of this size is cut into (0: kept whole) */
export const partsOf = (size) => (size > LIMIT ? Math.ceil(size / PART) : 0);

/** { '/video/x.mp4': 2, … } for the files of `dir` (public/ or dist/) that are cut */
export function partsMap(dir, sub = 'video') {
  const map = {};
  const d = path.join(dir, sub);
  if (!fs.existsSync(d)) return map;
  for (const f of fs.readdirSync(d)) {
    const n = partsOf(fs.statSync(path.join(d, f)).size);
    if (n) map[`/${sub}/${f}`] = n;
  }
  return map;
}

/** cuts the large files of dist/<sub> into parts, the whole file removed; returns the map */
export function splitLarge(dir, sub = 'video') {
  const map = partsMap(dir, sub);
  for (const [rel, n] of Object.entries(map)) {
    const file = path.join(dir, rel);
    const data = fs.readFileSync(file);
    for (let i = 0; i < n; i++) fs.writeFileSync(`${file}.p${i + 1}`, data.subarray(i * PART, (i + 1) * PART));
    fs.rmSync(file);
  }
  return map;
}
