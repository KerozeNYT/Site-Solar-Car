/**
 * The home film decoded picture by picture (WebCodecs) and drawn on a canvas, instead of seeking
 * in a <video> element. A seek costs the browser a few hundredths of a second (more in 4K), so a
 * video moved by the scroll shows only some 20 pictures a second; here:
 * - scrolling forward decodes the next pictures in order, one or two per screen refresh;
 * - scrolling back decodes again from the key frame before (the encoding has one every few
 *   pictures, scripts/film-assets.mjs) and keeps those pictures for the next steps back;
 * - a long jump starts again at the key frame before the target, never decoding the way there.
 * The file is the same MP4 (H.264, no B-frames, kept in memory by src/js/film.js); its sample
 * table is read here. openFrames() returns null where WebCodecs cannot decode it: the <video>
 * element is used instead.
 */

const AHEAD = 2; // pictures decoded beyond the one asked: some decoders hold one or two back

/** the video track of an MP4 file: decoder configuration and where each picture is */
export function parseMp4(buffer) {
  const d = new DataView(buffer);
  const str = (o) => String.fromCharCode(d.getUint8(o), d.getUint8(o + 1), d.getUint8(o + 2), d.getUint8(o + 3));
  const each = (start, end, fn) => {
    for (let o = start; o + 8 <= end; ) {
      let size = d.getUint32(o);
      let head = 8;
      if (size === 1) {
        size = Number(d.getBigUint64(o + 8));
        head = 16;
      } else if (size === 0) size = end - o;
      if (size < head || o + size > end) return;
      if (fn(str(o + 4), o + head, o + size, o) === false) return;
      o += size;
    }
  };
  const find = (type, [start, end]) => {
    let r = null;
    each(start, end, (t, a, b) => {
      if (t !== type) return true;
      r = [a, b];
      return false;
    });
    if (!r) throw new Error(`mp4: no ${type}`);
    return r;
  };
  const moov = find('moov', [0, d.byteLength]);
  let mdia = null;
  each(moov[0], moov[1], (t, a, b) => {
    if (t !== 'trak' || mdia) return;
    const m = find('mdia', [a, b]);
    if (str(find('hdlr', m)[0] + 8) === 'vide') mdia = m;
  });
  if (!mdia) throw new Error('mp4: no video track');
  const mdhd = find('mdhd', mdia)[0];
  const timescale = d.getUint32(mdhd + (d.getUint8(mdhd) === 1 ? 20 : 12));
  const stbl = find('stbl', find('minf', mdia));

  // sample description: avc1 (visual sample entry, 78 bytes) then its avcC box
  const entry = find('stsd', stbl)[0] + 8;
  const kind = str(entry + 4);
  if (kind !== 'avc1' && kind !== 'avc3') throw new Error(`mp4: ${kind}`);
  const width = d.getUint16(entry + 32);
  const height = d.getUint16(entry + 34);
  const avcC = find('avcC', [entry + 86, entry + d.getUint32(entry)]);
  const description = new Uint8Array(buffer.slice(avcC[0], avcC[1]));
  const hex = (b) => b.toString(16).padStart(2, '0');
  const codec = `avc1.${hex(description[1])}${hex(description[2])}${hex(description[3])}`;

  // sizes, then offsets (chunks of samples), times and key frames
  const stsz = find('stsz', stbl)[0];
  const fixed = d.getUint32(stsz + 4);
  const n = d.getUint32(stsz + 8);
  const size = new Uint32Array(n);
  for (let i = 0; i < n; i++) size[i] = fixed || d.getUint32(stsz + 12 + i * 4);

  let chunks;
  try {
    const stco = find('stco', stbl)[0];
    chunks = Array.from({ length: d.getUint32(stco + 4) }, (_, i) => d.getUint32(stco + 8 + i * 4));
  } catch {
    const co64 = find('co64', stbl)[0];
    chunks = Array.from({ length: d.getUint32(co64 + 4) }, (_, i) => Number(d.getBigUint64(co64 + 8 + i * 8)));
  }
  const stsc = find('stsc', stbl)[0];
  const runs = Array.from({ length: d.getUint32(stsc + 4) }, (_, i) => [d.getUint32(stsc + 8 + i * 12), d.getUint32(stsc + 12 + i * 12)]);
  const offset = new Float64Array(n);
  let s = 0;
  for (let c = 0; c < chunks.length && s < n; c++) {
    let r = runs.length - 1;
    while (r > 0 && runs[r][0] > c + 1) r--;
    let o = chunks[c];
    for (let k = 0; k < runs[r][1] && s < n; k++, s++) {
      offset[s] = o;
      o += size[s];
    }
  }

  const time = new Float64Array(n);
  const stts = find('stts', stbl)[0];
  let t = 0;
  s = 0;
  for (let e = 0, count = d.getUint32(stts + 4); e < count; e++) {
    const many = d.getUint32(stts + 8 + e * 8);
    const delta = d.getUint32(stts + 12 + e * 8);
    for (let k = 0; k < many && s < n; k++, s++, t += delta) time[s] = t;
  }

  const key = new Uint8Array(n);
  try {
    const stss = find('stss', stbl)[0];
    for (let e = 0, count = d.getUint32(stss + 4); e < count; e++) key[d.getUint32(stss + 8 + e * 4) - 1] = 1;
  } catch {
    key.fill(1); // no sync sample table: every picture is a key frame
  }
  return { codec, description, width, height, timescale, count: n, offset, size, time, key };
}

/**
 * Decode `buffer` (an MP4 file) onto `canvas`. Resolves to { show(t), ready(t), close() }, or
 * null where this browser cannot decode the file this way. show(t): the picture at t seconds,
 * as soon as it is decoded (meanwhile the nearest one decoded); ready(t): a promise, resolved
 * once that picture is on the canvas. onError: the decoder failed (the caller falls back).
 */
export async function openFrames(buffer, canvas, { onError } = {}) {
  if (typeof VideoDecoder === 'undefined' || typeof EncodedVideoChunk === 'undefined') return null;
  const m = parseMp4(buffer);
  const config = { codec: m.codec, description: m.description, codedWidth: m.width, codedHeight: m.height, optimizeForLatency: true };
  const support = await VideoDecoder.isConfigSupported(config).catch(() => null);
  if (!support || !support.supported) return null;

  const n = m.count;
  const bytes = new Uint8Array(buffer);
  const us = (i) => Math.round((m.time[i] * 1e6) / m.timescale);
  const byStamp = new Map();
  for (let i = 0; i < n; i++) byStamp.set(us(i), i);
  const keyOf = new Int32Array(n);
  let gop = 1;
  for (let i = 0, k = 0; i < n; i++) {
    if (m.key[i]) k = i;
    keyOf[i] = k;
    gop = Math.max(gop, i - k + 1);
  }
  const step = n > 1 ? m.time[1] - m.time[0] : m.timescale / 24;
  // decoded pictures kept: the key frame run behind the one shown (steps back) and a few ahead
  const keep = gop + AHEAD + 2;

  canvas.width = m.width;
  canvas.height = m.height;
  const ctx = canvas.getContext('2d', { alpha: false });
  const cache = new Map(); // picture index -> VideoFrame
  // the current run: pictures sent to the decoder in order from a key frame (runStart), the last
  // sent (fed) and the last decoded (out); those in between are still in the decoder
  let runStart = 0;
  let fed = -1;
  let out = -1;
  let want = 0;
  let drawn = -1;
  let closed = false;
  let failed = false;
  let waiters = [];

  const decoder = new VideoDecoder({
    output(frame) {
      const i = byStamp.get(frame.timestamp);
      if (closed || i === undefined) return frame.close();
      if (i >= runStart && i <= fed && i > out) out = i;
      cache.get(i)?.close();
      cache.set(i, frame);
      prune();
      draw();
      pump();
    },
    error(err) {
      if (closed) return;
      failed = true;
      for (const w of waiters) w.reject(err);
      waiters = [];
      onError?.(err);
    },
  });
  decoder.configure(config);

  function prune() {
    if (cache.size <= keep) {
      for (const [i, f] of cache) if (i < want - gop - 1 || i > want + AHEAD + 1) (f.close(), cache.delete(i));
      return;
    }
    // too many: the farthest from the one asked go first
    const order = [...cache.keys()].sort((a, b) => Math.abs(b - want) - Math.abs(a - want));
    for (const i of order.slice(0, cache.size - keep)) {
      cache.get(i).close();
      cache.delete(i);
    }
  }
  function draw() {
    let best = -1;
    for (const i of cache.keys()) if (best < 0 || Math.abs(i - want) < Math.abs(best - want)) best = i;
    if (best >= 0 && best !== drawn) {
      ctx.drawImage(cache.get(best), 0, 0, canvas.width, canvas.height);
      drawn = best;
    }
    if (drawn === want && waiters.length) {
      for (const w of waiters) w.resolve();
      waiters = [];
    }
  }
  function pump() {
    if (closed || failed || decoder.state !== 'configured') return;
    const goal = Math.min(n - 1, want + AHEAD);
    if (fed >= goal && cache.has(want)) return;
    const k = keyOf[want];
    // behind the run with the picture gone (already decoded and let go, or before the run), or
    // so far ahead that starting again at the key frame is shorter: a new run from the key frame
    // (what is still queued is dropped)
    const gone = !cache.has(want) && (want < runStart || want <= out);
    if (gone || fed < k - 1) {
      if (decoder.decodeQueueSize > 0) {
        decoder.reset();
        decoder.configure(config);
      }
      runStart = k;
      fed = out = k - 1;
    }
    try {
      while (fed < goal && decoder.decodeQueueSize < 8) {
        const i = fed + 1;
        decoder.decode(
          new EncodedVideoChunk({
            type: m.key[i] ? 'key' : 'delta',
            timestamp: us(i),
            duration: Math.round((step * 1e6) / m.timescale),
            data: bytes.subarray(m.offset[i], m.offset[i] + m.size[i]),
          })
        );
        fed = i;
      }
    } catch (err) {
      failed = true;
      onError?.(err);
    }
  }
  decoder.addEventListener?.('dequeue', pump);

  const indexAt = (t) => Math.min(n - 1, Math.max(0, Math.round((t * m.timescale) / step)));
  return {
    width: m.width,
    height: m.height,
    show(t) {
      if (closed || failed) return;
      want = indexAt(t);
      prune();
      draw();
      pump();
    },
    ready(t) {
      this.show(t);
      if (drawn === want) return Promise.resolve();
      return new Promise((resolve, reject) => waiters.push({ resolve, reject }));
    },
    close() {
      closed = true;
      for (const f of cache.values()) f.close();
      cache.clear();
      if (decoder.state !== 'closed') decoder.close();
    },
  };
}
