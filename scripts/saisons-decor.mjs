// Palm silhouettes of the « neon » look (content/themes.js), drawn here (no image of anyone
// else): public/img/saisons/palmier-*.svg, shown at the foot of every page by the CSS.
// Usage: node scripts/saisons-decor.mjs
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const out = path.join(root, 'public/img/saisons');
fs.mkdirSync(out, { recursive: true });
const lerp = (a, b, k) => a + (b - a) * k;
function rng(seed) {
  let s = seed >>> 0 || 1;
  return () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296;
}
function palmSVG(h, lean, seed, color) {
  const r = rng(seed);
  const top = { x: lean, y: -h };
  // trunk: tapered, gently curved
  const N = 24;
  const left = [], right = [];
  for (let i = 0; i <= N; i++) {
    const k = i / N;
    const x = lean * Math.pow(k, 1.7) + Math.sin(k * 3.1) * 6;
    const y = -h * k;
    const w = lerp(26, 11, k);
    left.push([x - w / 2, y]);
    right.push([x + w / 2, y]);
  }
  let trunk = 'M' + left.map((p) => p.join(' ')).join(' L') + ' L' + right.reverse().map((p) => p.join(' ')).join(' L') + 'Z';
  // rings on the trunk
  let rings = '';
  for (let i = 1; i < N; i += 1) {
    const k = i / N;
    const x = lean * Math.pow(k, 1.7) + Math.sin(k * 3.1) * 6;
    const y = -h * k;
    const w = lerp(26, 11, k) / 2 + 2;
    rings += `M${x - w} ${y + 2} Q ${x} ${y - 4} ${x + w} ${y + 2} L ${x + w} ${y + 5} Q ${x} ${y - 1} ${x - w} ${y + 5}Z`;
  }
  // fronds: long arched leaves with a few notches
  let fronds = '';
  const n = 9;
  for (let i = 0; i < n; i++) {
    const a = (-Math.PI) + (i / (n - 1)) * Math.PI + (r() - 0.5) * 0.3; // from left to right over the top
    const len = 150 + r() * 70;
    const droop = 70 + r() * 70;
    const dx = Math.cos(a) * len;
    const dy = Math.sin(a) * len * 0.55;
    const end = [top.x + dx * 1.05, top.y + dy + droop];
    const mid = [top.x + dx * 0.55, top.y + dy - 40 + droop * 0.1];
    const width = 26 + r() * 10;
    // upper edge, then lower edge back, with notches on the lower edge
    const nx = -(end[1] - top.y), ny = end[0] - top.x;
    const nl = Math.hypot(nx, ny) || 1;
    const ox = (nx / nl) * width, oy = (ny / nl) * width;
    let d = `M${top.x} ${top.y} Q ${mid[0]} ${mid[1]} ${end[0]} ${end[1]}`;
    const steps = 7;
    for (let j = steps; j >= 0; j--) {
      const k = j / steps;
      // point on the quadratic curve
      const qx = (1 - k) * (1 - k) * top.x + 2 * (1 - k) * k * mid[0] + k * k * end[0];
      const qy = (1 - k) * (1 - k) * top.y + 2 * (1 - k) * k * mid[1] + k * k * end[1];
      const w = Math.sin(k * Math.PI) * (j % 2 ? 1 : 0.55);
      d += ` L${qx + ox * w * 0.6} ${qy + oy * w * 0.6 + w * 14}`;
    }
    fronds += d + 'Z';
  }
  const pad = 260;
  return `<svg width="${pad * 2 + Math.abs(lean)}" height="${h + 260}" viewBox="${-pad + Math.min(0, lean)} ${-h - 200} ${pad * 2 + Math.abs(lean)} ${h + 260}">
    <path d="${trunk}" fill="${color}"/><path d="${rings}" fill="rgba(255,90,160,.18)"/><path d="${fronds}" fill="${color}"/>
    <circle cx="${top.x}" cy="${top.y}" r="12" fill="${color}"/></svg>`;
}

const PALMS = [
  ['palmier-1.svg', 520, 90, 3],
  ['palmier-2.svg', 430, -110, 11],
  ['palmier-3.svg', 340, 60, 21],
];
for (const [name, h, lean, seed] of PALMS) {
  const svg = palmSVG(h, lean, seed, '#0b0214')
    .replace('<svg ', '<svg xmlns="http://www.w3.org/2000/svg" ')
    .replace(/\s+/g, ' ')
    .replace(/(\d+\.\d)\d+/g, '$1');
  fs.writeFileSync(path.join(out, name), svg + '\n');
  console.log('wrote', name, svg.length, 'bytes');
}
