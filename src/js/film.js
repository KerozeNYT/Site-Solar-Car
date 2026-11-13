import { openFrames } from './film-frames.js';

/**
 * Home film: the scroll moves the video forward and back (content/film.js, section [data-film]).
 * - Once the page has loaded, a light version (about 1 MB) is downloaded and kept in memory: the
 *   film answers the scroll within a second; the sharpest one the screen can show (1080p, 1440p
 *   or 4K, or the 9:16 centre on tall screens, 720p on phones unless the connection is fast)
 *   downloads once the visitor starts scrolling and takes over with a cross-fade. The film is decoded picture by picture and drawn on a canvas (src/js/film-frames.js,
 *   WebCodecs): the picture follows the scroll at the screen's refresh rate, both ways. Where the
 *   browser cannot do that, the <video> element is moved by seeking (some 20 pictures a second);
 *   the encoding (scripts/film-assets.mjs) has short key-frame intervals, no B-frames.
 * - The video time follows the scroll with some easing; the chapters (copy, links) and the tabs
 *   follow the video time, so the words always match the picture.
 * - Before the video is there, each chapter shows its own image: the page reads the same.
 */
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));

export function startFilm(section) {
  const template = section.querySelector('[data-video]'); // replaced by the film once loaded
  const stage = section.querySelector('[data-stage]');
  const progressEl = section.querySelector('[data-progress]');
  const loading = section.querySelector('[data-loading]');
  const pct = section.querySelector('[data-loading-pct]');
  const tabs = [...section.querySelectorAll('[data-tab]')];
  const tabBar = section.querySelector('.film__tabs ul');
  const duration = Number(section.dataset.duration);
  const start = Number(section.dataset.start) || 0;
  const end = duration - 0.05;
  const chapters = [...section.querySelectorAll('[data-chapter]')].map((el, i, all) => ({
    el,
    id: el.dataset.chapter,
    copy: el.querySelector('.chapter__copy'),
    from: Number(el.dataset.from),
    to: Number(el.dataset.to),
    scroll: Number(el.dataset.scroll) || 0,
    first: i === 0,
    last: i === all.length - 1,
  }));
  // figures that follow the picture: [second, value] keys, numbers interpolated, words switched
  const readouts = [...section.querySelectorAll('[data-film-readout]')].map((el) => ({ el, keys: JSON.parse(el.dataset.filmReadout) }));
  const readoutAt = (keys, t) => {
    if (t <= keys[0][0]) return keys[0][1];
    for (let i = 1; i < keys.length; i++) {
      const [t0, v0] = keys[i - 1];
      const [t1, v1] = keys[i];
      if (t <= t1) return typeof v0 === 'number' ? Math.round(v0 + ((t - t0) / (t1 - t0)) * (v1 - v0)) : t - t0 < t1 - t - 0 ? v0 : v1;
    }
    return keys[keys.length - 1][1];
  };
  // Which version: tall screens (phones, tablets upright) get the centre of the picture in 9:16
  // over their whole height (a 16:9 film stretched to their height would be enlarged and soft);
  // then the lightest version that still has a pixel for every pixel of the screen (width drawn,
  // the video covering the stage, × pixel density): 1080p on most computers, 1440p or 4K on
  // large and Retina screens. Phones stop at the 720p version (11 MB instead of 22) unless the
  // browser reports a fast connection. Data saver or a 2G link: the light version only.
  const c = navigator.connection;
  const fast = !!c && !c.saveData && c.effectiveType === '4g' && (c.downlink || 0) >= 10;
  const tall = matchMedia('(max-aspect-ratio: 2/3)').matches && !!section.dataset.tallSrcset;
  const parse = (set = '') =>
    set
      .split(',')
      .map((x) => x.trim().split(/\s+/))
      .filter((x) => x[0])
      .map(([src, w]) => ({ src, w: parseInt(w, 10) || 0 }))
      .sort((a, b) => a.w - b.w);
  // the chosen version first, then the smaller ones: tried in turn if a device cannot play it
  const pickSharp = () => {
    const list = parse(tall ? section.dataset.tallSrcset : section.dataset.wideSrcset);
    if (!list.length) return [];
    const r = stage.getBoundingClientRect();
    const w = r.width || innerWidth;
    const h = r.height || innerHeight;
    const need = (tall ? Math.max(w, (h * 9) / 16) : Math.max(w, (h * 16) / 9)) * Math.min(devicePixelRatio || 1, 3);
    // little memory (2 GB or less): never the largest version, the film is kept in memory
    let top = navigator.deviceMemory && navigator.deviceMemory <= 2 && list.length > 1 ? list.length - 2 : list.length - 1;
    if (tall && !fast) top = 0;
    let i = list.findIndex((t) => t.w >= need * 0.9);
    i = i < 0 ? top : Math.min(i, top);
    return list.slice(0, i + 1).reverse().map((t) => t.src);
  };
  const frugal = !!c && (c.saveData || /(^|-)2g$/.test(c.effectiveType || ''));
  const preview = tall ? section.dataset.srcPreviewTall : section.dataset.srcPreview;
  const sharps = frugal && preview ? [] : pickSharp();
  const light = preview || sharps[sharps.length - 1];

  // ------------------------------------------------------------- scroll <-> time
  // Scroll -> time is not linear: each chapter gets the same scroll length (pace.chapter screens,
  // the opening and the closing their own), the passages between chapters are crossed quickly
  // (pace.gap), and the first pace.hold screens keep the opening still. Points (time, units)
  // of a piecewise linear curve, units in screen heights.
  const pace = JSON.parse(section.dataset.pace || '{}');
  const curve = [[start, 0]];
  let units = 0;
  chapters.forEach((c, i) => {
    const a = Math.max(start, c.from);
    const b = c.last ? end : Math.min(end, c.to);
    if (i > 0) curve.push([a, (units += pace.gap ?? 0.08)]);
    units += c.first ? pace.opening ?? 0.45 : c.last ? pace.closing ?? 0.5 : c.scroll || (pace.chapter ?? 0.55);
    curve.push([b, units]);
  });
  const total = units;
  const lerpCurve = (x, from, to) => {
    for (let i = 1; i < curve.length; i++) {
      const [x0, y0] = [curve[i - 1][from], curve[i - 1][to]];
      const [x1, y1] = [curve[i][from], curve[i][to]];
      if (x <= x1 || i === curve.length - 1) return x1 === x0 ? y1 : y0 + ((clamp((x - x0) / (x1 - x0))) * (y1 - y0));
    }
    return curve[curve.length - 1][to];
  };
  let top = 0;
  let screen = innerHeight;
  const measure = () => {
    top = section.getBoundingClientRect().top + scrollY;
    screen = stage.clientHeight || innerHeight;
  };
  measure();
  const hold = () => (pace.hold ?? 0.45) * screen;
  const timeAt = (y) => lerpCurve(clamp((y - top - hold()) / screen, 0, total), 1, 0);
  const scrollFor = (t) => top + hold() + lerpCurve(clamp(t, start, end), 0, 1) * screen;

  // ------------------------------------------------------------- chapters at a given time
  const FADE = 0.35;
  let activeTab = null;
  function apply(t) {
    let active = null;
    let best = 0;
    for (const c of chapters) {
      const rise = c.first ? 1 : (t - c.from) / FADE;
      const fall = c.last ? 1 : (c.to - t) / FADE;
      const o = t < c.from && !c.first ? 0 : t > c.to && !c.last ? 0 : clamp(Math.min(rise, fall));
      c.el.classList.toggle('is-visible', o > 0.01);
      c.el.toggleAttribute('inert', o < 0.5);
      c.el.style.setProperty('--o', o.toFixed(3));
      if (c.copy) {
        c.copy.style.opacity = o.toFixed(3);
        c.copy.style.transform = `translate3d(0, ${((1 - o) * 22).toFixed(1)}px, 0)`;
      }
      if (o > best) {
        best = o;
        active = c.id;
      }
    }
    for (const c of chapters) c.el.classList.toggle('is-active', c.id === active);
    progressEl.style.transform = `scaleX(${clamp((t - start) / (end - start)).toFixed(4)})`;
    for (const r of readouts) {
      const v = String(readoutAt(r.keys, t));
      if (r.el.textContent !== v) r.el.textContent = v;
    }
    // the tab of the service on screen (none during the opening and the closing)
    const tab = tabs.find((a) => a.dataset.tab === active) || null;
    if (tab !== activeTab) {
      for (const a of tabs) a.toggleAttribute('aria-current', a === tab);
      activeTab = tab;
      // phones: the bar scrolls sideways to keep the current tab in sight
      if (tab && tabBar && tabBar.scrollWidth > tabBar.clientWidth) {
        const li = tab.parentElement;
        tabBar.scrollTo({ left: li.offsetLeft - (tabBar.clientWidth - li.offsetWidth) / 2, behavior: 'smooth' });
      }
    }
  }

  // ------------------------------------------------------------- the picture
  // 1. the light version (about 1 MB) answers the scroll within a second; 2. the sharp one
  // (phone or computer) downloads behind it and takes over with a cross-fade, at the same moment.
  // A view shows the film at a given time: { el, show(t, force), ready(t), close() }.
  let view = null;
  let ready = false;
  const show = () => {
    if (ready) return;
    ready = true;
    section.classList.add('is-ready');
    loading.hidden = true;
  };
  /** the whole file in memory, with its progress */
  async function blobOf(url, onProgress) {
    const res = await fetch(url);
    if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`);
    const total = Number(res.headers.get('content-length')) || 0;
    const reader = res.body.getReader();
    const parts = [];
    let got = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      parts.push(value);
      got += value.length;
      if (total) onProgress?.(got / total);
    }
    return new Blob(parts, { type: 'video/mp4' });
  }
  /** true once the first picture is decoded, false if the browser gives up on the file */
  const playable = (v) =>
    new Promise((resolve) => {
      if (v.readyState >= 2) return resolve(true);
      v.addEventListener('loadeddata', () => resolve(true), { once: true });
      v.addEventListener('error', () => resolve(false), { once: true });
    });
  /** the <video> element moved by seeking (a blob in memory, or the file on the network) */
  async function videoView(source, cls) {
    const v = template.cloneNode();
    v.removeAttribute('data-video');
    v.className = cls;
    const url = source instanceof Blob ? URL.createObjectURL(source) : source;
    v.src = url;
    v.load();
    if (!(await playable(v))) {
      if (url !== source) URL.revokeObjectURL(url);
      return null;
    }
    const seekTo = (t, force) => {
      if (v.readyState >= 1 && (force || (!v.seeking && Math.abs(v.currentTime - t) > 1 / 120))) v.currentTime = t;
    };
    return {
      el: v,
      video: v,
      show: seekTo,
      ready: (t) =>
        new Promise((resolve) => {
          v.addEventListener('seeked', resolve, { once: true });
          seekTo(t, true);
        }),
      close: () => url !== source && URL.revokeObjectURL(url),
    };
  }
  /** the best view of a file: its pictures decoded on a canvas, else the <video> element */
  async function viewOf(blob, cls) {
    const canvas = document.createElement('canvas');
    canvas.className = cls;
    canvas.setAttribute('aria-hidden', 'true');
    let frames = null;
    const fallBack = async () => {
      // the decoder failed on this device: the same file, in the video element
      const v = await videoView(blob, cls);
      if (!v || view?.el !== canvas) return;
      canvas.replaceWith(v.el);
      v.el.classList.toggle('is-on', canvas.classList.contains('is-on'));
      view = v;
      frames?.close();
      v.show(current, true);
    };
    try {
      frames = await openFrames(await blob.arrayBuffer(), canvas, { onError: fallBack });
    } catch (err) {
      console.warn('[film] decoding', err);
    }
    if (!frames) return videoView(blob, cls);
    return { el: canvas, show: (t) => frames.show(t), ready: (t) => frames.ready(t), close: () => frames.close() };
  }
  /** put a view on the stage, its picture at the current time, before it shows */
  async function mount(v, before) {
    before.after(v.el);
    const ok = await Promise.race([v.ready(current).then(() => true, () => false), new Promise((r) => setTimeout(() => r(false), 8000))]);
    if (!ok) {
      v.el.remove();
      v.close();
    }
    return ok;
  }
  async function load() {
    let blob = null;
    try {
      blob = await blobOf(light, (k) => pct && (pct.textContent = `${Math.round(k * 100)} %`));
    } catch (err) {
      console.warn('[film] direct playback', err);
    }
    // played from the network if the download failed (seeking a little slower)
    let first = blob ? await viewOf(blob, 'tour__video') : null;
    if (first && !(await mount(first, template))) first = null;
    if (!first) {
      first = await videoView(light, 'tour__video');
      if (!first || !(await mount(first, template))) return;
    }
    template.remove();
    view = first;
    show();
    // the sharp version, quietly in the background once the visitor starts the film (a visit
    // that stays on the first screen never downloads it); if the device cannot play it
    // (decoder, memory), the next smaller one; if none, the light version stays and the film works
    await engaged;
    for (const src of sharps) {
      if (src === light) return;
      const b = await blobOf(src).catch(() => null);
      if (!b) return;
      const hd = await viewOf(b, 'tour__video tour__video--hd');
      if (!hd || !(await mount(hd, view.el))) continue;
      const old = view;
      view = hd;
      hd.el.classList.add('is-on');
      setTimeout(() => {
        old.el.remove();
        old.close();
      }, 900);
      return;
    }
  }
  // the first scroll (a tab, a link to a chapter, the keyboard: all of them scroll)
  const engaged = new Promise((resolve) => {
    if (scrollY > 0) return resolve();
    const go = () => {
      removeEventListener('scroll', go);
      resolve();
    };
    addEventListener('scroll', go, { passive: true });
  });
  // the download waits for the page itself (text, images): never in the way of the first screen
  const idle = (fn) => ('requestIdleCallback' in window ? requestIdleCallback(fn, { timeout: 2000 }) : setTimeout(fn, 300));
  if (document.readyState === 'complete') idle(load);
  else addEventListener('load', () => idle(load), { once: true });
  // iPhone: a video must have been started once by a touch before it accepts seeking
  const unlock = () => {
    if (!view) return; // nothing loaded yet: at the next touch
    const v = view.video;
    if (v) v.play().then(() => v.pause(), () => {});
    removeEventListener('touchstart', unlock);
  };
  addEventListener('touchstart', unlock, { passive: true });

  // ------------------------------------------------------------- the loop
  let target = timeAt(scrollY);
  let current = target;
  let last = performance.now();
  function seek() {
    if (ready && view) view.show(current);
  }
  let running = false;
  let visible = false;
  function frame(now) {
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    target = timeAt(scrollY);
    // long jumps (tabs, keyboard) cut straight there, otherwise the time eases after the scroll
    if (Math.abs(target - current) > 6) current = target;
    else current += (target - current) * (1 - Math.exp(-dt * 7));
    if (Math.abs(target - current) < 0.002) current = target;
    apply(current);
    seek();
    // while the video is loading and the visitor has gone past the opening, say so
    if (!ready) loading.hidden = current < start + 0.8;
    if (visible) requestAnimationFrame(frame);
    else running = false;
  }
  const wake = () => {
    if (running || !visible) return;
    running = true;
    last = performance.now();
    requestAnimationFrame(frame);
  };
  new IntersectionObserver(([en]) => {
    visible = en.isIntersecting;
    wake();
  }).observe(section);
  addEventListener('resize', () => {
    measure();
    wake();
  });
  apply(current);

  // ------------------------------------------------------------- tabs and in-page links
  section.addEventListener('click', (e) => {
    const a = e.target.closest('[data-film-at]');
    if (!a) return;
    e.preventDefault();
    measure();
    const y = scrollFor(Number(a.dataset.filmAt));
    const far = Math.abs(y - scrollY) > innerHeight * 3;
    scrollTo({ top: y, behavior: far || matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
    history.replaceState(null, '', a.getAttribute('href'));
  });
  // arriving with #chapitre-… in the address: go to that moment of the film
  const hash = location.hash.match(/^#chapitre-(.+)$/);
  if (hash) {
    const a = section.querySelector(`[data-tab="${CSS.escape(hash[1])}"]`);
    if (a) requestAnimationFrame(() => scrollTo({ top: scrollFor(Number(a.dataset.filmAt)) }));
  }
  section.classList.add('is-live');
}
