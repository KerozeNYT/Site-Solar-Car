import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { Line2 } from 'three/addons/lines/Line2.js';
import { LineMaterial } from 'three/addons/lines/LineMaterial.js';
import { LineGeometry } from 'three/addons/lines/LineGeometry.js';

/**
 * Access map in 3D: the Loire valley from Tours to Vouvray, flown over like a drone.
 * Everything is served by the site (public/map/, baked by scripts/map/bake.py from open
 * data): Sentinel-2 imagery, Copernicus relief, water and the commune of Vouvray, the
 * workshop address point and the road route from the centre of Tours. No map server, no
 * cookie, nothing to break. Local coordinates: metres, x east, y north (three.js: z = -y).
 */
const BASE = '/map/';
const EXAG = 3.2; // the coteaux of the Loire are ~60 m high: lift them so they read
const LIFT = 16; // lines float this high over the relief
const GOLD = new THREE.Color(0xf0c25a);
const HAZE = new THREE.Color(0x9fa3a6);

function loadImageData(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.decoding = 'async';
    img.onload = () => {
      const c = document.createElement('canvas');
      c.width = img.width;
      c.height = img.height;
      const g = c.getContext('2d', { willReadFrequently: true });
      g.drawImage(img, 0, 0);
      resolve(g.getImageData(0, 0, img.width, img.height));
    };
    img.onerror = reject;
    img.src = url;
  });
}

const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

export async function initMap(el) {
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const small = matchMedia('(max-width: 760px)').matches || (navigator.hardwareConcurrency || 4) <= 4;
  const light = (navigator.hardwareConcurrency || 4) <= 4 || navigator.connection?.saveData;
  const [data, demImg, sat, mask] = await Promise.all([
    fetch(BASE + 'map.json').then((r) => r.json()),
    loadImageData(BASE + 'dem.png'),
    new THREE.TextureLoader().loadAsync(BASE + (light ? 'sat-1024.webp' : 'sat.webp')),
    new THREE.TextureLoader().loadAsync(BASE + 'mask.png'),
  ]);
  sat.colorSpace = THREE.SRGBColorSpace;
  sat.anisotropy = 8;
  mask.colorSpace = THREE.NoColorSpace;

  const [X0, X1, Y0, Y1] = data.extent;
  const [DW, DH] = data.dem;
  const cx = (X0 + X1) / 2;
  const cy = (Y0 + Y1) / 2;
  // relief: height = (R * 256 + G) / 100 m
  const hAt = (c, r) => {
    const i = (r * DW + c) * 4;
    return (demImg.data[i] * 256 + demImg.data[i + 1]) / 100;
  };
  let hMin = Infinity;
  for (let r = 0; r < DH; r++) for (let c = 0; c < DW; c++) hMin = Math.min(hMin, hAt(c, r));
  const Y = (h) => (h - hMin) * EXAG;
  const V = (x, y, h, lift = 0) => new THREE.Vector3(x, Y(h) + lift, -y);

  // ------------------------------------------------------------- renderer
  const canvas = document.createElement('canvas');
  canvas.className = 'visit__map-canvas';
  canvas.setAttribute('aria-hidden', 'true');
  const ui = document.createElement('div');
  ui.className = 'map3d';
  el.append(canvas, ui);
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: !small, alpha: true, powerPreference: 'high-performance' });
  } catch (err) {
    canvas.remove();
    ui.remove();
    throw err;
  }
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.08;
  renderer.setClearColor(0x000000, 0);
  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(HAZE, 9000, 30000);
  const camera = new THREE.PerspectiveCamera(38, 1, 20, 80000);

  // golden-hour light from the south-west, a cool sky fill
  const sun = new THREE.DirectionalLight(0xffe2b0, 2.6);
  sun.position.set(-0.75, 0.42, 0.52).multiplyScalar(10000);
  scene.add(sun, new THREE.HemisphereLight(0xc4d6ff, 0x4a3f2c, 0.85));

  // ------------------------------------------------------------- terrain
  const step = small ? 2 : 1;
  const gw = Math.floor((DW - 1) / step) + 1;
  const gh = Math.floor((DH - 1) / step) + 1;
  const geo = new THREE.PlaneGeometry(X1 - X0, Y1 - Y0, gw - 1, gh - 1);
  geo.rotateX(-Math.PI / 2);
  geo.translate(cx, 0, -cy);
  const pos = geo.attributes.position;
  for (let r = 0; r < gh; r++) for (let c = 0; c < gw; c++) pos.setY(r * gw + c, Y(hAt(Math.min(c * step, DW - 1), Math.min(r * step, DH - 1))));
  geo.computeVertexNormals();
  const time = { value: 0 };
  const terrainMat = new THREE.MeshStandardMaterial({ map: sat, roughness: 0.93, metalness: 0, transparent: true });
  terrainMat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, { uMask: { value: mask }, uTime: time, uHaze: { value: HAZE }, uExt: { value: new THREE.Vector4(X0, X1, -Y1, -Y0) } });
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vW;')
      .replace('#include <project_vertex>', '#include <project_vertex>\nvW = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform sampler2D uMask; uniform float uTime; uniform vec3 uHaze; uniform vec4 uExt; varying vec3 vW;')
      .replace(
        '#include <map_fragment>',
        `#include <map_fragment>
        vec3 msk = texture2D(uMask, vMapUv).rgb;
        // the Loire and the Cher: deeper, cooler water
        diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * vec3(0.55, 0.72, 0.92), msk.r * 0.75);
        // the commune of Vouvray: a warm golden veil
        diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * vec3(1.18, 1.07, 0.82) + vec3(0.03, 0.02, 0.0), msk.g * 0.55);`
      )
      .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor = mix(roughnessFactor, 0.16, msk.r);')
      .replace(
        '#include <opaque_fragment>',
        `// glints on the water, faded out with distance before they turn into dotted lines
        float ph = dot(vW.xz, vec2(0.071, 0.043));
        float sp = sin(ph + uTime * 1.6) * sin(dot(vW.xz, vec2(-0.052, 0.067)) - uTime * 1.2);
        float near = clamp(1.0 - fwidth(ph) * 1.5, 0.0, 1.0);
        outgoingLight += vec3(1.0, 0.9, 0.7) * pow(max(sp, 0.0), 18.0) * msk.r * 0.5 * near;
        // the map dissolves into the haze at its borders
        float edge = min(min(vW.x - uExt.x, uExt.y - vW.x), min(vW.z - uExt.z, uExt.w - vW.z));
        float keep = smoothstep(0.0, 1400.0, edge);
        outgoingLight = mix(uHaze * 0.9, outgoingLight, keep);
        diffuseColor.a *= keep;
        #include <opaque_fragment>`
      );
  };
  const terrain = new THREE.Mesh(geo, terrainMat);
  scene.add(terrain);

  // ------------------------------------------------------------- lines
  const lines = [];
  function line(points, { color = GOLD, width = 3, opacity = 1, dashed = false, dash = 0, gap = 0, blending = THREE.NormalBlending } = {}) {
    const g = new LineGeometry();
    g.setPositions(points.flatMap((p) => [p.x, p.y, p.z]));
    const m = new LineMaterial({ color, linewidth: width, transparent: true, opacity, depthWrite: false, dashed, dashSize: dash, gapSize: gap, blending });
    const l = new Line2(g, m);
    if (dashed) l.computeLineDistances();
    l.renderOrder = 2;
    scene.add(l);
    lines.push(m);
    return l;
  }
  // the commune of Vouvray
  const outline = data.vouvray.map(([x, y, h]) => V(x, y, h, LIFT));
  line(outline, { color: GOLD, width: 9, opacity: 0.18, blending: THREE.AdditiveBlending });
  line(outline, { color: new THREE.Color(0xffe6a8), width: 2, opacity: 0.85 });
  // the route from the centre of Tours
  const routePts = data.route.pts.map(([x, y, h]) => V(x, y, h, LIFT + 4));
  let routeLen = 0;
  for (let i = 1; i < routePts.length; i++) routeLen += routePts[i].distanceTo(routePts[i - 1]);
  line(routePts, { color: new THREE.Color(0xffb52e), width: 14, opacity: 0.22, blending: THREE.AdditiveBlending });
  line(routePts, { color: new THREE.Color(0xffd36b), width: 4.5, opacity: 1 });
  // a light travelling along it, from Tours to the workshop
  const comet = line(routePts, { color: new THREE.Color(0xffffff), width: 6, opacity: 0.95, dashed: true, dash: 520, gap: routeLen * 1.4, blending: THREE.AdditiveBlending });

  // ------------------------------------------------------------- workshop beacon
  const W = data.workshop;
  const base = V(W.x, W.y, W.h);
  const beam = new THREE.Mesh(
    new THREE.CylinderGeometry(26, 26, 1300, 32, 1, true),
    new THREE.ShaderMaterial({
      uniforms: { uColor: { value: GOLD } },
      vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader: 'uniform vec3 uColor; varying vec2 vUv; void main(){ float a = pow(1.0 - vUv.y, 1.7) * 0.6; gl_FragColor = vec4(uColor * a, a); }',
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
    })
  );
  beam.position.copy(base).add(new THREE.Vector3(0, 650, 0));
  scene.add(beam);
  const ringMat = new THREE.ShaderMaterial({
    uniforms: { uTime: time, uColor: { value: GOLD } },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `uniform float uTime; uniform vec3 uColor; varying vec2 vUv;
      void main(){
        float r = length(vUv - 0.5) * 2.0;
        float k = fract(uTime * 0.45);
        float ring = smoothstep(0.06, 0.0, abs(r - k)) * (1.0 - k);
        float core = smoothstep(0.22, 0.0, r) * 0.7;
        float a = (ring + core) * step(r, 1.0);
        gl_FragColor = vec4(uColor * a, a);
      }`,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const ring = new THREE.Mesh(new THREE.PlaneGeometry(900, 900), ringMat);
  ring.rotation.x = -Math.PI / 2;
  ring.position.copy(base).add(new THREE.Vector3(0, 6, 0));
  ring.renderOrder = 3;
  scene.add(ring);
  // start of the route: a small white beacon in Tours
  const startRing = new THREE.Mesh(new THREE.PlaneGeometry(420, 420), ringMat.clone());
  startRing.material.uniforms = { uTime: time, uColor: { value: new THREE.Color(0xffffff) } };
  startRing.rotation.x = -Math.PI / 2;
  startRing.position.copy(routePts[0]).add(new THREE.Vector3(0, -8, 0));
  scene.add(startRing);

  // ------------------------------------------------------------- labels (HTML, always crisp)
  const layer = document.createElement('div');
  layer.className = 'map3d__labels';
  ui.append(layer);
  const PRIORITY = { pin: 0, home: 1, city: 2, start: 3, water: 4, road: 5, poi: 6, town: 7 };
  const labels = [];
  const addLabel = (html, kind, at, cls = '') => {
    const e = document.createElement('div');
    e.className = `map3d__label map3d__label--${kind} ${cls}`;
    e.innerHTML = html;
    layer.append(e);
    labels.push({ e, kind, at, w: 0, h: 0 });
  };
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
  for (const l of data.labels) {
    if (l.kind === 'home') addLabel(`${esc(l.name)}`, 'home', V(l.x, l.y, l.h, 40));
    else if (l.kind === 'road') addLabel(`<span>${esc(l.name)}</span>`, 'road', V(l.x, l.y, l.h, 30));
    else if (l.kind === 'poi') addLabel(`<svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true"><path fill="currentColor" d="M21 16v-2l-8-5V3.5a1.5 1.5 0 0 0-3 0V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5Z"/></svg>${esc(l.name)}`, 'poi', V(l.x, l.y, l.h, 30));
    else addLabel(esc(l.name), l.kind, V(l.x, l.y, l.h, 30));
  }
  addLabel('<span class="map3d__dot"></span>Départ : centre de Tours', 'start', routePts[0].clone().add(new THREE.Vector3(0, 30, 0)));
  const name = el.dataset.name || 'SOLAR CAR 37';
  addLabel(
    `<span class="map3d__pin-card"><img src="/img/brand/embleme-64.webp" alt="" width="28" height="28"><span><strong>${esc(name)}</strong><small>${esc(el.dataset.address || '')}</small></span></span><span class="map3d__pin-tip"></span>`,
    'pin',
    base.clone().add(new THREE.Vector3(0, 60, 0))
  );
  labels.sort((a, b) => PRIORITY[a.kind] - PRIORITY[b.kind]);

  // ------------------------------------------------------------- overlay UI
  const km = String(data.route.km).replace('.', ',');
  const chip = document.createElement('p');
  chip.className = 'map3d__chip';
  chip.innerHTML = `<span class="map3d__chip-line" aria-hidden="true"></span><span><strong>≈ ${km} km</strong> depuis le centre de Tours</span>`;
  const bar = document.createElement('div');
  bar.className = 'map3d__bar';
  bar.innerHTML = `
    <button type="button" data-view="overview">Vue d’ensemble</button>
    <button type="button" data-view="route">▶ Le trajet depuis Tours</button>
    <button type="button" data-view="workshop">L’atelier</button>`;
  const credit = document.createElement('details');
  credit.className = 'map3d__credit';
  credit.innerHTML = `<summary>Sources</summary><p>${esc(data.credits)}</p>`;
  const hint = document.createElement('p');
  hint.className = 'map3d__hint';
  hint.textContent = matchMedia('(pointer: coarse)').matches ? 'Deux doigts pour tourner et zoomer' : 'Glisser pour tourner · Ctrl + molette pour zoomer';
  ui.append(chip, bar, credit, hint);
  el.setAttribute('role', 'img');
  el.setAttribute('aria-label', `Carte 3D : l’atelier ${name} à Vouvray, à environ ${km} km du centre de Tours par la route, au nord de la Loire.`);

  // ------------------------------------------------------------- camera, controls
  const controls = new OrbitControls(camera, canvas);
  controls.enableDamping = true;
  controls.dampingFactor = 0.07;
  controls.enablePan = false;
  controls.minDistance = 700;
  controls.maxDistance = 17000;
  controls.minPolarAngle = 0.15;
  controls.maxPolarAngle = 1.25;
  controls.rotateSpeed = 0.55;
  controls.zoomSpeed = 0.8;
  controls.autoRotateSpeed = 0.35;
  controls.touches = { ONE: null, TWO: THREE.TOUCH.DOLLY_ROTATE };
  canvas.style.touchAction = 'pan-y'; // one finger keeps scrolling the page
  // the wheel scrolls the page; Ctrl / ⌘ + wheel zooms the map
  el.addEventListener(
    'wheel',
    (e) => {
      if (e.ctrlKey || e.metaKey) return;
      e.stopPropagation();
      hint.classList.add('is-on');
      clearTimeout(hint._t);
      hint._t = setTimeout(() => hint.classList.remove('is-on'), 1400);
    },
    { capture: true }
  );

  const wsTarget = base.clone();
  // portrait frames see less of the valley: step back so the same places fit
  const far = () => Math.pow(Math.max(1, 1.35 / camera.aspect), 0.75);
  const VIEWS = {
    overview: () => {
      const t = new THREE.Vector3(cx + 300, 0, -cy - 600);
      return { target: t, pos: new THREE.Vector3(-2900, 10500, 10400).multiplyScalar(far()).add(t) };
    },
    workshop: () => {
      const t = wsTarget.clone().add(new THREE.Vector3(-500, 0, 700));
      return { target: t, pos: new THREE.Vector3(-2800, 2600, 4300).multiplyScalar(far()).add(t) };
    },
  };
  let tween = null;
  let flight = null;
  function flyTo(view, duration = 2.6, arc = 0.18) {
    flight = null;
    const v = VIEWS[view]();
    if (reduce || duration === 0) {
      controls.target.copy(v.target);
      camera.position.copy(v.pos);
      tween = null;
      return;
    }
    tween = { t: 0, duration, arc, p0: camera.position.clone(), t0: controls.target.clone(), p1: v.pos, t1: v.target };
  }
  // the route, flown at drone height, looking ahead
  const curve = new THREE.CatmullRomCurve3(routePts.map((p) => p.clone()), false, 'centripetal');
  function flyRoute() {
    if (reduce) return flyTo('workshop', 0);
    tween = null;
    controls.autoRotate = false;
    flight = { t: 0, duration: 12 };
  }
  bar.addEventListener('click', (e) => {
    const b = e.target.closest('[data-view]');
    if (!b) return;
    controls.autoRotate = false;
    if (b.dataset.view === 'route') flyRoute();
    else flyTo(b.dataset.view);
    bar.querySelectorAll('button').forEach((x) => x.classList.toggle('is-active', x === b));
    wake();
  });
  controls.addEventListener('start', () => {
    tween = null;
    flight = null;
    controls.autoRotate = false;
  });
  controls.addEventListener('change', wake);

  // ------------------------------------------------------------- loop
  const _v = new THREE.Vector3();
  let w = 0;
  let h = 0;
  function resize() {
    const r = el.getBoundingClientRect();
    w = Math.max(1, Math.round(r.width));
    h = Math.max(1, Math.round(r.height));
    renderer.setPixelRatio(Math.min(devicePixelRatio || 1, small ? 1.5 : 2));
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    for (const m of lines) m.resolution.set(w, h);
    wake();
  }
  function placeLabels() {
    const placed = [];
    for (const l of labels) {
      _v.copy(l.at).project(camera);
      const x = (_v.x * 0.5 + 0.5) * w;
      const y = (-_v.y * 0.5 + 0.5) * h;
      let show = _v.z < 1 && x > -40 && x < w + 40 && y > -20 && y < h + 20;
      if (show) {
        if (!l.w) {
          l.w = l.e.offsetWidth;
          l.h = l.e.offsetHeight;
        }
        // never cut a name at the edge of the frame
        if (l.kind !== 'pin' && (x - l.w / 2 < 6 || x + l.w / 2 > w - 6 || y - l.h < 6)) show = false;
      }
      if (show) {
        const box = { x0: x - l.w / 2 - 4, x1: x + l.w / 2 + 4, y0: y - l.h - 4, y1: y + 4 };
        if (l.kind !== 'pin' && placed.some((b) => b.x0 < box.x1 && b.x1 > box.x0 && b.y0 < box.y1 && b.y1 > box.y0)) show = false;
        else placed.push(box);
      }
      l.e.classList.toggle('is-hidden', !show);
      if (show) l.e.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0) translate(-50%, -100%)`;
    }
  }
  let visible = true;
  let running = false;
  let last = performance.now();
  function wake() {
    if (running || !visible) return;
    running = true;
    last = performance.now();
    requestAnimationFrame(frame);
  }
  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    if (!reduce) time.value += dt;
    if (tween) {
      tween.t = Math.min(1, tween.t + dt / tween.duration);
      const k = ease(tween.t);
      camera.position.lerpVectors(tween.p0, tween.p1, k);
      camera.position.y += Math.sin(Math.PI * k) * tween.p0.distanceTo(tween.p1) * tween.arc;
      controls.target.lerpVectors(tween.t0, tween.t1, k);
      if (tween.t >= 1) {
        tween = null;
        if (!reduce) controls.autoRotate = true;
      }
    } else if (flight) {
      flight.t = Math.min(1, flight.t + dt / flight.duration);
      const u = ease(flight.t) * 0.94;
      const p = curve.getPointAt(u);
      const ahead = curve.getPointAt(Math.min(1, u + 0.07));
      const dir = _v.subVectors(ahead, p).setY(0).normalize();
      camera.position.set(p.x - dir.x * 1500, p.y + 1050, p.z - dir.z * 1500);
      controls.target.copy(ahead);
      if (flight.t >= 1) {
        flight = null;
        flyTo('workshop', 2.2, 0.05);
      }
    }
    if (!reduce) comet.material.dashOffset = -((time.value * 1700) % (routeLen * 1.4 + 520));
    controls.update(dt);
    placeLabels();
    renderer.render(scene, camera);
    // keep running while something moves (water, comet, flights); stop when hidden
    if (visible && !document.hidden) requestAnimationFrame(frame);
    else running = false;
  }
  new ResizeObserver(resize).observe(el);
  const io = new IntersectionObserver(
    ([en]) => {
      visible = en.isIntersecting;
      if (visible) wake();
    },
    { threshold: 0.05 }
  );
  io.observe(el);
  document.addEventListener('visibilitychange', () => !document.hidden && wake());

  // start: the whole valley; once on screen, the drone follows the route from Tours and
  // settles over the workshop
  flyTo('overview', 0);
  resize();
  renderer.render(scene, camera);
  el.classList.add('is-live');
  const intro = new IntersectionObserver(
    ([en]) => {
      if (!en.isIntersecting) return;
      intro.disconnect();
      setTimeout(() => (reduce ? flyTo('workshop', 0) : flyRoute()), 900);
    },
    { threshold: 0.45 }
  );
  intro.observe(el);
  // test hook (poster rendering)
  window.__map3d = { flyTo, flyRoute, render: () => (placeLabels(), renderer.render(scene, camera)), controls, camera };
}
