// Prepares the home page film (content/film.js) from its 4K frames or a 3840×2160 master.
// Needs ffmpeg.
//   node scripts/film-assets.mjs '<frames>/f%04d.jpg'      (scripts/film/render.mjs output, film.fps)
//   node scripts/film-assets.mjs <master-2160p.mp4>
//   FAST=1 node scripts/film-assets.mjs ...                 (quick draft encodes, for tests)
//   node scripts/film-assets.mjs ... --only=mobile.mp4,images   (only those videos / the images)
// - public/video/: H.264 versions made for scrolling (a key frame every film.gop pictures, no
//   B-frames, fast start, no sound, film.fps pictures a second, the light ones 24), all scaled
//   down from the 4K picture (lanczos):
//   · wide screens: accueil-360p.mp4 (light, answers the scroll within a second), then the
//     sharpest of 1080p / 1440p / 2160p the screen can show (`sources.wide`);
//   · tall screens (phones, tablets upright): the centre of the picture in 9:16 over the whole
//     height: accueil-mobile-360.mp4 first, then 720×1280 or 1214×2160 (`sources.tall`).
// - public/img/film/<chapter>-960|1600|2560.webp, -1600.jpg and -tall-720|1080.webp: one image
//   per chapter (its `still` second) for the page before the video is loaded, without
//   JavaScript and with reduced motion.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import sharp from 'sharp';
import { film } from '../content/film.js';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const src = process.argv[2];
if (!src) {
  console.error("usage: node scripts/film-assets.mjs '<frames>/f%04d.jpg' | <master-2160p.mp4>");
  process.exit(1);
}
const frames = src.includes('%');
// --only=a,b: the videos whose name contains one of them, and the images if `images` is listed
const only = process.argv.find((a) => a.startsWith('--only='))?.slice(7).split(',');
const wanted = (name) => !only || only.some((o) => name.includes(o));
const FPS = film.fps || 24;
const GOP = film.gop || 12;
const input = frames ? ['-framerate', String(FPS), '-start_number', '0', '-i', src] : ['-i', src];
const run = (args) => execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', ...args], { stdio: 'inherit' });
const scroll = (crf, gop = GOP) => [
  '-an',
  '-c:v', 'libx264',
  '-preset', process.env.FAST ? 'ultrafast' : 'slow',
  '-pix_fmt', 'yuv420p',
  '-profile:v', 'high',
  '-g', String(gop), '-keyint_min', String(gop), '-sc_threshold', '0', '-bf', '0',
  // more bits in the dark, smooth areas of the picture (the studio), where banding would show
  '-x264-params', 'aq-mode=3:aq-strength=0.9',
  '-crf', String(crf),
  '-movflags', '+faststart',
];
// the centre of the 16:9 picture in 9:16, full height (even width)
const TALL = 'crop=trunc(ih*9/32)*2:ih:(iw-trunc(ih*9/32)*2)/2:0';
const scale = (w, h) => `scale=${w}:${h}:flags=lanczos,setsar=1`; // square pixels (the 9:16 crop is 1214 wide)
const vf = (fps, ...steps) => ['-vf', [`fps=${fps}`, ...steps].join(',')];

const S = film.sources;
const jobs = [
  // the light versions: 24 pictures a second (half the weight), a key frame every 12
  [S.preview, vf(24, scale(640, 360)), 30, 12],
  ...S.wide.map((t) => [t.src, vf(FPS, scale(t.w, Math.round((t.w * 9) / 16))), t.crf]),
  [S.previewTall, vf(24, TALL, scale(360, 640)), 30, 12],
  ...S.tall.map((t) => [t.src, vf(FPS, TALL, scale(t.w, t.h)), t.crf]),
];
fs.mkdirSync(path.join(root, 'public/video'), { recursive: true });
for (const [out, filter, crf, gop] of jobs.filter(([out]) => wanted(out))) {
  const t0 = Date.now();
  run([...input, ...filter, ...scroll(crf, gop), path.join(root, 'public', out)]);
  console.log(out, `${((Date.now() - t0) / 1000).toFixed(0)} s`);
}

const imgDir = path.join(root, 'public/img/film');
const chapters = wanted('images') ? film.chapters : [];
fs.mkdirSync(imgDir, { recursive: true });
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'film-'));
for (const c of chapters) {
  let still;
  if (frames) still = src.replace(/%0?(\d*)d/, (m, n) => String(Math.round(c.still * FPS)).padStart(Number(n) || 0, '0'));
  else {
    still = path.join(tmp, `${c.id}.png`);
    run(['-ss', String(c.still), '-i', src, '-frames:v', '1', still]);
  }
  const img = () => sharp(still);
  const { width, height } = await img().metadata();
  const tw = Math.round((height * 9) / 16 / 2) * 2;
  const tall = { left: Math.round((width - tw) / 2), top: 0, width: tw, height };
  await img().resize(2560).webp({ quality: 80, effort: 6 }).toFile(path.join(imgDir, `${c.id}-2560.webp`));
  await img().resize(1600).webp({ quality: 80, effort: 6 }).toFile(path.join(imgDir, `${c.id}-1600.webp`));
  await img().resize(960).webp({ quality: 76, effort: 6 }).toFile(path.join(imgDir, `${c.id}-960.webp`));
  await img().resize(1600).jpeg({ quality: 82, mozjpeg: true }).toFile(path.join(imgDir, `${c.id}-1600.jpg`));
  await img().extract(tall).resize(1080).webp({ quality: 80, effort: 6 }).toFile(path.join(imgDir, `${c.id}-tall-1080.webp`));
  await img().extract(tall).resize(720).webp({ quality: 78, effort: 6 }).toFile(path.join(imgDir, `${c.id}-tall-720.webp`));
}
fs.rmSync(tmp, { recursive: true, force: true });
const size = (f) => (fs.statSync(path.join(root, 'public', f)).size / 1048576).toFixed(1) + ' Mo';
console.log('vidéos :', jobs.map(([f]) => `${f} ${size(f)}`).join(' · '));
console.log('images :', film.chapters.map((c) => c.id).join(', '));
