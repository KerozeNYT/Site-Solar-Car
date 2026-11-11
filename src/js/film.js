/**
 * Home film: the scroll moves the video forward and back (content/film.js, section [data-film]).
 * - The whole video is downloaded once the page has loaded (1080p on computers, 720p on phones),
 *   kept in memory: seeking is then instant, without a network request at each frame. The
 *   encoding (scripts/film-assets.mjs) has a key frame every 12 images and no B-frames.
 * - The video time follows the scroll with some easing; the chapters (copy, links) and the tabs
 *   follow the video time, so the words always match the picture.
 * - Before the video is there, each chapter shows its own image: the page reads the same.
 */
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));

export function startFilm(section) {
  const video = section.querySelector('[data-video]');
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
  const phone = matchMedia('(max-width: 760px)').matches;
  const src = phone ? section.dataset.srcMobile : section.dataset.srcDesktop;

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
  let ready = false;
  const show = () => {
    if (ready) return;
    ready = true;
    section.classList.add('is-ready');
    loading.hidden = true;
    seek(true);
  };
  async function load() {
    try {
      const res = await fetch(src);
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
        if (total && pct) pct.textContent = `${Math.round((got / total) * 100)} %`;
      }
      video.src = URL.createObjectURL(new Blob(parts, { type: 'video/mp4' }));
    } catch (err) {
      console.warn('[film] direct playback', err);
      video.src = src; // played from the network (seeking a little slower)
    }
    video.addEventListener('loadeddata', show, { once: true });
    video.load();
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
