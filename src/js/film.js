/**
 * Home film: the scroll moves the video forward and back (content/film.js, section [data-film]).
 * - Once the page has loaded, a light version (360p, about 1 MB) is downloaded and kept in
 *   memory: the film answers the scroll within a second; the sharp one (900p computers, 720p
 *   phones) follows in the background and takes over with a cross-fade. Seeking in memory is
 *   instant; the encoding (scripts/film-assets.mjs) has short key-frame intervals, no B-frames.
 * - The video time follows the scroll with some easing; the chapters (copy, links) and the tabs
 *   follow the video time, so the words always match the picture.
 * - Before the video is there, each chapter shows its own image: the page reads the same.
 */
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));

export function startFilm(section) {
  let video = section.querySelector('[data-video]');
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
  const phone = matchMedia('(max-width: 760px)').matches;
  const sharp = phone ? section.dataset.srcMobile : section.dataset.srcDesktop;
  const light = section.dataset.srcPreview || sharp;

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
    units += c.first ? pace.opening ?? 0.45 : c.last ? pace.closing ?? 0.5 : pace.chapter ?? 0.55;
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

  // ------------------------------------------------------------- the video
  // 1. the light version (about 1 MB) answers the scroll within a second; 2. the sharp one
  // (phone or computer) downloads behind it and takes over with a cross-fade, at the same moment
  let ready = false;
  const show = () => {
    if (ready) return;
    ready = true;
    section.classList.add('is-ready');
    loading.hidden = true;
    seek(true);
  };
  /** the whole file in memory (seeking is then instant), with its progress */
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
    return URL.createObjectURL(new Blob(parts, { type: 'video/mp4' }));
  }
  const loaded = (v) => new Promise((resolve) => (v.readyState >= 2 ? resolve() : v.addEventListener('loadeddata', resolve, { once: true })));
  async function load() {
    let first;
    try {
      first = await blobOf(light, (k) => pct && (pct.textContent = `${Math.round(k * 100)} %`));
    } catch (err) {
      console.warn('[film] direct playback', err);
      first = light; // played from the network (seeking a little slower)
    }
    video.src = first;
    video.load();
    await loaded(video);
    show();
    if (sharp === light) return;
    // the sharp version, quietly in the background
    let hdUrl;
    try {
      hdUrl = await blobOf(sharp);
    } catch {
      return; // the light version stays: the film still works
    }
    const hd = video.cloneNode();
    hd.removeAttribute('data-video');
    hd.classList.add('tour__video--hd');
    hd.src = hdUrl;
    video.after(hd);
    hd.load();
    await loaded(hd);
    hd.currentTime = current;
    await new Promise((resolve) => hd.addEventListener('seeked', resolve, { once: true }));
    const old = video;
    video = hd;
    hd.classList.add('is-on');
    setTimeout(() => {
      old.remove();
      if (first.startsWith('blob:')) URL.revokeObjectURL(first);
    }, 900);
  }
  // the download waits for the page itself (text, images): never in the way of the first screen
  const idle = (fn) => ('requestIdleCallback' in window ? requestIdleCallback(fn, { timeout: 2000 }) : setTimeout(fn, 300));
  if (document.readyState === 'complete') idle(load);
  else addEventListener('load', () => idle(load), { once: true });
  // iPhone: a video must have been started once by a touch before it accepts seeking
  const unlock = () => {
    video.play().then(() => video.pause(), () => {});
    removeEventListener('touchstart', unlock);
  };
  addEventListener('touchstart', unlock, { passive: true });

  // ------------------------------------------------------------- the loop
  let target = timeAt(scrollY);
  let current = target;
  let last = performance.now();
  function seek(force = false) {
    if (!ready || video.readyState < 1) return;
    if (force || (!video.seeking && Math.abs(video.currentTime - current) > 1 / 60)) video.currentTime = current;
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
