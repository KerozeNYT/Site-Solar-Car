/**
 * Workshop map: MapLibre GL with OpenFreeMap vector tiles (free, no API key, no cookie).
 * Loaded only when the map nears the viewport. The pin comes from `data-lat/lng` when known,
 * otherwise from the national address base (Géoplateforme / BAN), queried by the visitor's
 * browser. If the map cannot start (no WebGL, network), the address card stays in place.
 */
const STYLES = ['https://tiles.openfreemap.org/styles/dark', 'https://tiles.openfreemap.org/styles/liberty'];
const TOURS = [0.6848, 47.3941];
const VOUVRAY = [0.7994, 47.4114];

function loadCss(href) {
  if (document.querySelector(`link[href="${href}"]`)) return Promise.resolve();
  return new Promise((resolve) => {
    const l = document.createElement('link');
    l.rel = 'stylesheet';
    l.href = href;
    l.onload = l.onerror = () => resolve();
    document.head.append(l);
  });
}

async function geocode(address) {
  const urls = [
    `https://data.geopf.fr/geocodage/search?q=${encodeURIComponent(address)}&limit=1`,
    `https://api-adresse.data.gouv.fr/search/?q=${encodeURIComponent(address)}&limit=1`,
  ];
  for (const url of urls) {
    try {
      const res = await fetch(url, { headers: { Accept: 'application/json' } });
      if (!res.ok) continue;
      const f = (await res.json()).features?.[0];
      if (f && f.properties?.score > 0.5) return f.geometry.coordinates;
    } catch {
      /* next source */
    }
  }
  return null;
}

function pin(name) {
  const el = document.createElement('div');
  el.className = 'map-pin';
  el.innerHTML = `<span class="map-pin__label">${name}</span><span class="map-pin__badge"><img src="/img/brand/embleme-64.webp" alt="" width="30" height="30"></span><span class="map-pin__tip"></span>`;
  return el;
}

export async function initMap(el) {
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const [{ default: maplibregl }] = await Promise.all([import('maplibre-gl'), loadCss('/assets/vendor/maplibre-gl.css')]);
  const known = el.dataset.lat ? [Number(el.dataset.lng), Number(el.dataset.lat)] : null;
  const target = known || (await geocode(el.dataset.address)) || null;

  const holder = document.createElement('div');
  holder.className = 'visit__map-canvas';
  el.append(holder);
  let styleIndex = 0;
  let map;
  try {
    map = new maplibregl.Map({
      container: holder,
      style: STYLES[0],
      center: TOURS,
      zoom: 9.6,
      pitch: 0,
      attributionControl: { compact: true },
      cooperativeGestures: true,
      fadeDuration: 0,
    });
  } catch (err) {
    holder.remove(); // no WebGL: keep the address card
    throw err;
  }
  map.on('error', (e) => {
    // the style itself failed: try the next one once
    if (!map.isStyleLoaded() && styleIndex < STYLES.length - 1 && /style|Failed to fetch/i.test(String(e?.error?.message || ''))) {
      styleIndex++;
      map.setStyle(STYLES[styleIndex]);
    }
  });
  map.addControl(new maplibregl.NavigationControl({ showCompass: true, visualizePitch: true }), 'top-right');
  map.once('load', () => {
    el.classList.add('is-live');
    const dest = target || VOUVRAY;
    if (target) new maplibregl.Marker({ element: pin(el.dataset.name || ''), anchor: 'bottom' }).setLngLat(target).addTo(map);
    const view = { center: dest, zoom: target ? 15.4 : 13, pitch: 52, bearing: -18 };
    // fly from Tours to the workshop once the map is on screen
    const go = () => (reduce ? map.jumpTo(view) : map.flyTo({ ...view, duration: 4200, curve: 1.5, essential: true }));
    const io = new IntersectionObserver(([en]) => {
      if (!en.isIntersecting) return;
      io.disconnect();
      go();
    }, { threshold: 0.4 });
    io.observe(el);
  });
}
