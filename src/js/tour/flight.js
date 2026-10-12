import * as THREE from 'three';
import { clamp, track } from './math.js';

/**
 * Camera path on the flight clock. Positions and look-at points use time-aware cubic
 * Hermite curves (Catmull-Rom tangents scaled by the key spacing), so speed varies
 * smoothly between keys without overshooting holds.
 */
export function createPath(keys) {
  const n = keys.length;
  const T = keys.map((k) => k.t);
  const P = keys.map((k) => new THREE.Vector3(...k.p));
  const L = keys.map((k) => new THREE.Vector3(...k.l));
  const F = keys.map((k) => k.fov ?? 50);
  const tangents = (pts) =>
    pts.map((p, i) => {
      if (i === 0 || i === n - 1) return new THREE.Vector3();
      const dt = T[i + 1] - T[i - 1];
      return pts[i + 1].clone().sub(pts[i - 1]).multiplyScalar(1 / dt);
    });
  const MP = tangents(P);
  const ML = tangents(L);

  const seg = (t) => {
    if (t <= T[0]) return [0, 0];
    if (t >= T[n - 1]) return [n - 2, 1];
    let i = 0;
    while (i < n - 2 && t > T[i + 1]) i++;
    return [i, (t - T[i]) / (T[i + 1] - T[i])];
  };
  const herm = (pts, ms, i, u, out) => {
    const h = T[i + 1] - T[i];
    const u2 = u * u;
    const u3 = u2 * u;
    const h00 = 2 * u3 - 3 * u2 + 1;
    const h10 = u3 - 2 * u2 + u;
    const h01 = -2 * u3 + 3 * u2;
    const h11 = u3 - u2;
    return out
      .copy(pts[i])
      .multiplyScalar(h00)
      .addScaledVector(ms[i], h10 * h)
      .addScaledVector(pts[i + 1], h01)
      .addScaledVector(ms[i + 1], h11 * h);
  };

  const _a = new THREE.Vector3();
  const _b = new THREE.Vector3();
  const _c = new THREE.Vector3();
  const pos = (t, out = new THREE.Vector3()) => {
    const [i, u] = seg(t);
    return herm(P, MP, i, u, out);
  };

  return {
    duration: T[n - 1],
    sample(t, out = {}) {
      const [i, u] = seg(t);
      out.pos = herm(P, MP, i, u, out.pos || new THREE.Vector3());
      out.look = herm(L, ML, i, u, out.look || new THREE.Vector3());
      const s = u * u * (3 - 2 * u);
      out.fov = F[i] + (F[i + 1] - F[i]) * s;
      // automatic bank: lean into the turn from lateral acceleration (finite differences)
      const e = 0.12;
      pos(t - e, _a);
      pos(t + e, _c);
      pos(t, _b);
      const vx = (_c.x - _a.x) / (2 * e);
      const vz = (_c.z - _a.z) / (2 * e);
      const ax = (_c.x - 2 * _b.x + _a.x) / (e * e);
      const az = (_c.z - 2 * _b.z + _a.z) / (e * e);
      const speed = Math.hypot(vx, vz);
      const lateral = speed > 0.05 ? (vx * az - vz * ax) / speed : 0;
      out.roll = clamp(-lateral * 0.045, -0.22, 0.22);
      return out;
    },
  };
}

/**
 * Piecewise scroll timeline: each beat maps its own scroll span (in viewport heights) to its
 * own span of the flight clock. A beat with from === to is a hold on a single frame.
 */
export function createTimeline(beats) {
  let acc = 0;
  const spans = beats.map((b) => {
    const s = { ...b, start: acc, end: acc + b.vh };
    acc += b.vh;
    return s;
  });
  const total = acc;
  // chapter ranges = union of consecutive beats carrying the same chapter id
  const chapters = [];
  for (const s of spans) {
    if (!s.chapter) continue;
    const last = chapters[chapters.length - 1];
    if (last && last.id === s.chapter && last.end === s.start) last.end = s.end;
    else chapters.push({ id: s.chapter, start: s.start, end: s.end });
  }
  return {
    total,
    spans,
    chapters,
    /** scroll position (vh) -> flight time */
    timeAt(vh) {
      const v = clamp(vh, 0, total);
      for (const s of spans) {
        if (v <= s.end) {
          const u = s.vh ? (v - s.start) / s.vh : 1;
          return s.from + (s.to - s.from) * u;
        }
      }
      return spans[spans.length - 1].to;
    },
    /** flight time -> first scroll position (vh) that reaches it */
    vhAt(t) {
      for (const s of spans) {
        const lo = Math.min(s.from, s.to);
        const hi = Math.max(s.from, s.to);
        if (t >= lo && t <= hi && s.to !== s.from) return s.start + ((t - s.from) / (s.to - s.from)) * s.vh;
        if (s.to === s.from && t === s.from) return s.start;
      }
      return total;
    },
  };
}

/** Effect tracks keyed on the flight clock. */
export function createEffects(defs) {
  const tracks = {};
  for (const [k, v] of Object.entries(defs)) tracks[k] = track(v);
  return (t) => {
    const out = {};
    for (const [k, f] of Object.entries(tracks)) out[k] = f(t);
    return out;
  };
}
