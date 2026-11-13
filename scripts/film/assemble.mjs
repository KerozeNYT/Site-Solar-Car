// Film V5: joins the generated shots (docs/FILM-V5.md) into one master, frame-accurately.
//
//   node scripts/film/assemble.mjs <out.mp4> [--fade=3,5] [--soften=4@112,7@75] [--fps=24] shot1.mp4 shot2.mp4 …
//
// Each shot ends on the very picture the next one starts with: that duplicate first picture is
// dropped, so the camera never holds still at a join. A shot listed in --fade (1-based) joins the
// previous one with a 0.5 s cross-fade instead (used while a join does not match yet). Use the
// same --fade list for the horizontal and the vertical film: both then keep the same timeline,
// which content/film.js shares between them.
// --soften=<shot>@<picture>: the video model sometimes cuts inside a shot (<picture>: the first
// picture after the cut, counted from 0 in that shot); the cut becomes a 0.5 s dissolve over
// the same number of pictures (the last picture before the cut and the first after it are held
// while they blend), so the timeline does not move.
// Prints the second at which each shot starts.
import { execFileSync } from 'node:child_process';

const args = process.argv.slice(2);
const out = args.shift();
const opt = (name) => args.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3);
const shots = args.filter((a) => !a.startsWith('--'));
if (!out || shots.length < 2) {
  console.error('usage: node scripts/film/assemble.mjs <out.mp4> [--fade=3,5] [--soften=4@112] shot1.mp4 shot2.mp4 …');
  process.exit(1);
}
const FPS = Number(opt('fps') || 24);
const fades = new Set((opt('fade') || '').split(',').filter(Boolean).map(Number));
const softens = new Map((opt('soften') || '').split(',').filter(Boolean).map((s) => s.split('@').map(Number)));
const FADE = Math.round(0.5 * FPS); // pictures
const K = FADE / 2; // a softened cut: K pictures each side
const tb = `settb=1/${FPS}`;

const frames = (f) =>
  Number(execFileSync('ffprobe', ['-v', 'error', '-count_frames', '-select_streams', 'v:0', '-show_entries', 'stream=nb_read_frames', '-of', 'csv=p=0', f]).toString().trim());

const graph = [];
/** shot i (0-based) as label [s<i>], its cut softened if asked */
function shot(i) {
  const base = `[${i}:v]fps=${FPS},setpts=PTS-STARTPTS,${tb}`;
  const c = softens.get(i + 1);
  if (!c) {
    graph.push(`${base}[s${i}]`);
    return;
  }
  const t = (from, to) => `trim=start_frame=${from}${to == null ? '' : `:end_frame=${to}`},setpts=PTS-STARTPTS,${tb}`;
  graph.push(`${base},split=4[p${i}][a${i}][b${i}][q${i}]`);
  graph.push(`[p${i}]${t(0, c - K)}[pre${i}]`);
  graph.push(`[a${i}]${t(c - K, c)},tpad=stop=${K}:stop_mode=clone[x${i}]`);
  graph.push(`[b${i}]${t(c, c + K)},tpad=start=${K}:start_mode=clone[y${i}]`);
  graph.push(`[x${i}][y${i}]xfade=transition=fade:duration=${(2 * K) / FPS}:offset=0,${tb}[mix${i}]`);
  graph.push(`[q${i}]${t(c + K)}[post${i}]`);
  graph.push(`[pre${i}][mix${i}][post${i}]concat=n=3:v=1:a=0,${tb}[s${i}]`);
}

shots.forEach((_, i) => shot(i));
let cur = '[s0]';
let length = frames(shots[0]); // pictures in the film so far
const starts = [0];
for (let i = 1; i < shots.length; i++) {
  const n = frames(shots[i]);
  const next = `[c${i}]`;
  if (fades.has(i + 1)) {
    const offset = (length - FADE) / FPS;
    graph.push(`${cur}[s${i}]xfade=transition=fade:duration=${FADE / FPS}:offset=${offset.toFixed(6)},${tb}${next}`);
    starts.push(length - FADE);
    length += n - FADE;
  } else {
    graph.push(`[s${i}]trim=start_frame=1,setpts=PTS-STARTPTS,${tb}[v${i}]`);
    graph.push(`${cur}[v${i}]concat=n=2:v=1:a=0,${tb}${next}`);
    starts.push(length);
    length += n - 1;
  }
  cur = next;
}
execFileSync(
  'ffmpeg',
  [
    '-hide_banner', '-loglevel', 'error', '-y',
    ...shots.flatMap((s) => ['-i', s]),
    '-filter_complex', graph.join(';'),
    '-map', cur,
    '-an', '-c:v', 'libx264', '-preset', 'medium', '-crf', '12', '-pix_fmt', 'yuv420p', '-r', String(FPS),
    out,
  ],
  { stdio: 'inherit' }
);
console.log(JSON.stringify({ out, frames: length, duration: +(length / FPS).toFixed(4), starts: starts.map((f) => +(f / FPS).toFixed(4)) }));
