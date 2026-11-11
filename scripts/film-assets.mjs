// Prepares the home page film (content/film.js) from a source video. Needs ffmpeg.
//   node scripts/film-assets.mjs <video-1080p.mp4> [video-720p.mp4]
// - public/video/: three H.264 versions made for scrolling (no B-frames, fast start, no sound,
//   light denoising: the grain costs a lot of weight for nothing on screen, 24 images/s):
//   · accueil-360p.mp4  ~1 Mo, shown within a second (a key frame every 12 images),
//   · accueil-720p.mp4  phones, then accueil-900p.mp4 computers, downloaded in the background
//     and swapped in with a cross-fade (a key frame every 24 images);
// - public/img/film/<chapter>-1600.webp and -960.webp: one image per chapter (its `still` second)
//   for the page before the video is loaded, without JavaScript and with reduced motion.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import sharp from 'sharp';
import { film } from '../content/film.js';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const [src1080, src720 = src1080] = process.argv.slice(2);
if (!src1080) {
  console.error('usage: node scripts/film-assets.mjs <video-1080p.mp4> [video-720p.mp4]');
  process.exit(1);
}
const run = (args) => execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', ...args], { stdio: 'inherit' });
const scroll = (gop) => ['-an', '-c:v', 'libx264', '-preset', 'slow', '-pix_fmt', 'yuv420p', '-profile:v', 'high', '-g', String(gop), '-keyint_min', String(gop), '-sc_threshold', '0', '-bf', '0', '-movflags', '+faststart'];
const filter = (w) => ['-vf', `hqdn3d=2:2:6:6,fps=24,scale=${w}:-2`];

const videoDir = path.join(root, 'public/video');
fs.mkdirSync(videoDir, { recursive: true });
run(['-i', src720, ...filter(640), ...scroll(12), '-crf', '31', path.join(root, 'public', film.sources.preview)]);
run(['-i', src720, ...filter(1280), ...scroll(24), '-crf', '29', path.join(root, 'public', film.sources.mobile)]);
run(['-i', src1080, ...filter(1600), ...scroll(24), '-crf', '29', path.join(root, 'public', film.sources.desktop)]);

const imgDir = path.join(root, 'public/img/film');
fs.mkdirSync(imgDir, { recursive: true });
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'film-'));
for (const c of film.chapters) {
  const png = path.join(tmp, `${c.id}.png`);
  run(['-ss', String(c.still), '-i', src1080, '-frames:v', '1', png]);
  await sharp(png).resize(1600).webp({ quality: 80 }).toFile(path.join(imgDir, `${c.id}-1600.webp`));
  await sharp(png).resize(960).webp({ quality: 76 }).toFile(path.join(imgDir, `${c.id}-960.webp`));
  await sharp(png).resize(1600).jpeg({ quality: 82, mozjpeg: true }).toFile(path.join(imgDir, `${c.id}-1600.jpg`));
}
fs.rmSync(tmp, { recursive: true, force: true });
const size = (f) => (fs.statSync(path.join(root, 'public', f)).size / 1048576).toFixed(1) + ' Mo';
console.log('vidéos :', Object.values(film.sources).map((f) => `${f} ${size(f)}`).join(' · '));
console.log('images :', film.chapters.map((c) => c.id).join(', '));
