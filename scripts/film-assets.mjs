// Prepares the home page film (content/film.js) from a 1920×1080 master. Needs ffmpeg.
//   node scripts/film-assets.mjs <video-1080p.mp4> [--denoise]
// - public/video/: four H.264 versions made for scrolling (no B-frames, fast start, no sound,
//   24 images/s), chosen by the shape of the screen:
//   · wide screens:  accueil-360p.mp4 (~1 Mo, shown within a second, a key frame every 12
//     images), then accueil-1080p.mp4 (full definition) downloaded behind it and swapped in;
//   · tall screens (phones, tablets upright): the centre of the picture in 3:4, where a 16:9 film
//     stretched to the screen's height would be enlarged and soft: accueil-portrait-640.mp4 first,
//     then accueil-portrait.mp4 (810×1080, full definition);
//   --denoise: light denoising for camera footage (grain costs weight for nothing); never needed
//   for a 3D render.
// - public/img/film/<chapter>-1600.webp, -960.webp, -1600.jpg and -portrait.webp (810×1080): one
//   image per chapter (its `still` second) for the page before the video is loaded, without
//   JavaScript and with reduced motion.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import sharp from 'sharp';
import { film } from '../content/film.js';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const args = process.argv.slice(2);
const src1080 = args.find((a) => !a.startsWith('--'));
const denoise = args.includes('--denoise');
if (!src1080) {
  console.error('usage: node scripts/film-assets.mjs <video-1080p.mp4> [--denoise]');
  process.exit(1);
}
const run = (args) => execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', ...args], { stdio: 'inherit' });
const scroll = (gop) => ['-an', '-c:v', 'libx264', '-preset', 'slow', '-pix_fmt', 'yuv420p', '-profile:v', 'high', '-g', String(gop), '-keyint_min', String(gop), '-sc_threshold', '0', '-bf', '0', '-movflags', '+faststart'];
// the centre of the 16:9 picture in 3:4 (what a tall screen shows of it)
const PORTRAIT = 'crop=810:1080:(in_w-810)/2:0';
const filter = (...steps) => ['-vf', [...(denoise ? ['hqdn3d=2:2:6:6'] : []), 'fps=24', ...steps].join(',')];

const videoDir = path.join(root, 'public/video');
fs.mkdirSync(videoDir, { recursive: true });
const out = (k) => path.join(root, 'public', film.sources[k]);
run(['-i', src1080, ...filter('scale=640:-2'), ...scroll(12), '-crf', '31', out('preview')]);
run(['-i', src1080, ...filter(PORTRAIT, 'scale=480:640'), ...scroll(12), '-crf', '31', out('previewPortrait')]);
run(['-i', src1080, ...filter(PORTRAIT), ...scroll(24), '-crf', '27', out('portrait')]);
run(['-i', src1080, ...filter('scale=1920:-2'), ...scroll(24), '-crf', '27', out('desktop')]);

const imgDir = path.join(root, 'public/img/film');
fs.mkdirSync(imgDir, { recursive: true });
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'film-'));
for (const c of film.chapters) {
  const png = path.join(tmp, `${c.id}.png`);
  run(['-ss', String(c.still), '-i', src1080, '-frames:v', '1', png]);
  await sharp(png).resize(1600).webp({ quality: 80 }).toFile(path.join(imgDir, `${c.id}-1600.webp`));
  await sharp(png).resize(960).webp({ quality: 76 }).toFile(path.join(imgDir, `${c.id}-960.webp`));
  await sharp(png).resize(1600).jpeg({ quality: 82, mozjpeg: true }).toFile(path.join(imgDir, `${c.id}-1600.jpg`));
  await sharp(png).extract({ left: 555, top: 0, width: 810, height: 1080 }).webp({ quality: 80 }).toFile(path.join(imgDir, `${c.id}-portrait.webp`));
}
fs.rmSync(tmp, { recursive: true, force: true });
const size = (f) => (fs.statSync(path.join(root, 'public', f)).size / 1048576).toFixed(1) + ' Mo';
console.log('vidéos :', Object.values(film.sources).map((f) => `${f} ${size(f)}`).join(' · '));
console.log('images :', film.chapters.map((c) => c.id).join(', '));
