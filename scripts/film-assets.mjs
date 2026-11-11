// Prepares the home page film (content/film.js) from a source video. Needs ffmpeg.
//   node scripts/film-assets.mjs <video-1080p.mp4> [video-720p.mp4]
// - public/video/accueil-1080p.mp4 and accueil-720p.mp4: H.264 encoded for scrolling (a key
//   frame every 12 images, no B-frames: seeking forward and back stays instant), light
//   denoising (grain costs a lot of weight for nothing on screen), fast start, no sound;
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
const scroll = ['-an', '-c:v', 'libx264', '-preset', 'slow', '-pix_fmt', 'yuv420p', '-profile:v', 'high', '-g', '12', '-keyint_min', '12', '-sc_threshold', '0', '-bf', '0', '-movflags', '+faststart'];

const videoDir = path.join(root, 'public/video');
fs.mkdirSync(videoDir, { recursive: true });
run(['-i', src1080, '-vf', 'hqdn3d=1.5:1.5:5:5,scale=1920:-2', ...scroll, '-crf', '26', path.join(root, 'public', film.sources.desktop)]);
run(['-i', src720, '-vf', 'hqdn3d=1.5:1.5:5:5,scale=1280:-2', ...scroll, '-crf', '27', path.join(root, 'public', film.sources.mobile)]);

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
console.log('vidéos :', film.sources.desktop, size(film.sources.desktop), '·', film.sources.mobile, size(film.sources.mobile));
console.log('images :', film.chapters.map((c) => c.id).join(', '));
