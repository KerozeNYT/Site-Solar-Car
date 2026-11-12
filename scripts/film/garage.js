/**
 * The garage of the home film (scripts/film/scene.js): a dark detailing bay, premium and quiet.
 * Black PVC floor tiles with a row of yellow tiles framing the car, charcoal walls with a few
 * vertical LED strips and a cove line under a 2.5 m ceiling covered with fibre-optic stars.
 * The same room, unlit, is baked into the reflections of the paint and the glass, so the
 * strips draw their lines on the bodywork and the stars dot the roof and the bonnet.
 *
 * Car space: metres, the car at the origin, nose towards +x, right-hand side towards +z.
 */
import * as THREE from 'three';

// the room: walls on the tile grid (0.4 m), the car's bay framed by yellow tiles
const TILE = 0.4;
const ROOM = { x: [-8.4, 12.8], z: [-6.4, 8.0], h: 2.5 };
const BAY = { x: [-3.2, 3.2], z: [-2.0, 2.0] }; // inside the yellow frame (one tile wide)
const COLORS = {
  tile: [12, 12, 14],
  yellow: [168, 120, 8],
  seam: [5, 5, 6],
  wall: 0x2b2d31,
  ceiling: 0x070709,
};

/** a seeded random, so every frame of the film draws the same floor */
function rng(seed) {
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
}

/** the floor: colour (tiles, seams, a slight relief at each tile's edge) and roughness maps */
function floorMaps(renderer) {
  const nx = Math.round((ROOM.x[1] - ROOM.x[0]) / TILE);
  const nz = Math.round((ROOM.z[1] - ROOM.z[0]) / TILE);
  const px = 64;
  const color = document.createElement('canvas');
  const rough = document.createElement('canvas');
  color.width = rough.width = nx * px;
  color.height = rough.height = nz * px;
  const c = color.getContext('2d');
  const r = rough.getContext('2d');
  const rand = rng(37);
  const yellowAt = (i, j) => {
    const x = ROOM.x[0] + (i + 0.5) * TILE;
    const z = ROOM.z[0] + (j + 0.5) * TILE;
    const inX = x > BAY.x[0] - TILE && x < BAY.x[1] + TILE;
    const inZ = z > BAY.z[0] - TILE && z < BAY.z[1] + TILE;
    const inside = x > BAY.x[0] && x < BAY.x[1] && z > BAY.z[0] && z < BAY.z[1];
    return inX && inZ && !inside;
  };
  const rgb = (a, k = 0) => `rgb(${a.map((v) => Math.max(0, Math.min(255, Math.round(v + k)))).join(',')})`;
  c.fillStyle = rgb(COLORS.seam);
  c.fillRect(0, 0, color.width, color.height);
  r.fillStyle = '#fff';
  r.fillRect(0, 0, rough.width, rough.height);
  for (let i = 0; i < nx; i++)
    for (let j = 0; j < nz; j++) {
      // canvas y runs along +z (the texture is laid with v towards +z, see below)
      const x0 = i * px;
      const y0 = j * px;
      const yellow = yellowAt(i, j);
      const base = yellow ? COLORS.yellow : COLORS.tile;
      const k = (rand() - 0.5) * (yellow ? 10 : 3);
      c.fillStyle = rgb(base, k);
      c.fillRect(x0 + 2, y0 + 2, px - 4, px - 4);
      // relief: a lighter lip on two sides, a darker one on the others
      c.fillStyle = rgb(base, k + (yellow ? 18 : 6));
      c.fillRect(x0 + 2, y0 + 2, px - 4, 2);
      c.fillRect(x0 + 2, y0 + 2, 2, px - 4);
      c.fillStyle = rgb(base, k - (yellow ? 30 : 6));
      c.fillRect(x0 + 2, y0 + px - 4, px - 4, 2);
      c.fillRect(x0 + px - 4, y0 + 2, 2, px - 4);
      // the tiles' fine pastille texture
      c.fillStyle = rgb(base, k + (yellow ? -14 : 4));
      for (let a = 7; a < px - 6; a += 8) for (let b = 7; b < px - 6; b += 8) c.fillRect(x0 + a, y0 + b, 2, 2);
      // satin plastic, the yellow a little glossier; seams stay matt
      r.fillStyle = yellow ? 'rgb(0,130,0)' : 'rgb(0,160,0)';
      r.fillRect(x0 + 2, y0 + 2, px - 4, px - 4);
    }
  const tex = (canvas, srgb) => {
    const t = new THREE.CanvasTexture(canvas);
    if (srgb) t.colorSpace = THREE.SRGBColorSpace;
    // a little anisotropy keeps the far tiles crisp; more costs a lot in software rendering
    t.anisotropy = Math.min(4, renderer.capabilities.getMaxAnisotropy());
    t.generateMipmaps = true;
    t.minFilter = THREE.LinearMipmapLinearFilter;
    return t;
  };
  return { map: tex(color, true), roughnessMap: tex(rough, false) };
}

/** bars (LED tubes) as one instanced mesh: [x0, z0, x1, z1] at height y, or vertical [x, z, y0, y1] */
function bars(list, { thick = 0.045, material }) {
  const geo = new THREE.BoxGeometry(1, 1, 1);
  const mesh = new THREE.InstancedMesh(geo, material, list.length);
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const s = new THREE.Vector3();
  const p = new THREE.Vector3();
  list.forEach((b, i) => {
    if (b.vertical) {
      p.set(b.x, (b.y0 + b.y1) / 2, b.z);
      q.identity();
      s.set(b.dx ?? thick, b.y1 - b.y0, b.dz ?? thick);
    } else {
      const dx = b.x1 - b.x0;
      const dz = b.z1 - b.z0;
      p.set((b.x0 + b.x1) / 2, b.y, (b.z0 + b.z1) / 2);
      q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), -Math.atan2(dz, dx));
      s.set(Math.hypot(dx, dz), thick * 0.7, thick);
    }
    m.compose(p, q, s);
    mesh.setMatrixAt(i, m);
  });
  return mesh;
}

/** every LED strip of the room, as bar lists (shared by the lit room and its reflection) */
function leds() {
  // walls: a few vertical strips, and a cove line under the ceiling
  const walls = [];
  const inset = 0.03;
  const y0 = 0.3;
  const y1 = 2.05;
  for (const z of [-4.4, -1.6, 1.6, 4.4]) walls.push({ vertical: true, x: ROOM.x[0] + inset, z, y0, y1, dx: 0.02, dz: 0.05 });
  for (const x of [-5.6, -2.0, 1.6, 5.2, 8.8]) {
    walls.push({ vertical: true, x, z: ROOM.z[0] + inset, y0, y1, dx: 0.05, dz: 0.02 });
    walls.push({ vertical: true, x, z: ROOM.z[1] - inset, y0, y1, dx: 0.05, dz: 0.02 });
  }
  const y = ROOM.h - 0.12;
  const cove = [
    { x0: ROOM.x[0] + 0.3, z0: ROOM.z[0] + inset, x1: ROOM.x[1] - 0.3, z1: ROOM.z[0] + inset, y },
    { x0: ROOM.x[0] + 0.3, z0: ROOM.z[1] - inset, x1: ROOM.x[1] - 0.3, z1: ROOM.z[1] - inset, y },
    { x0: ROOM.x[0] + inset, z0: ROOM.z[0] + 0.3, x1: ROOM.x[0] + inset, z1: ROOM.z[1] - 0.3, y },
  ];
  return { walls, cove };
}

/** a round soft dot, the picture of one fibre end */
function dotTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 32;
  const g = c.getContext('2d');
  const r = g.createRadialGradient(16, 16, 0, 16, 16, 16);
  r.addColorStop(0, 'rgba(255,255,255,1)');
  r.addColorStop(0.35, 'rgba(255,255,255,0.85)');
  r.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = r;
  g.fillRect(0, 0, 32, 32);
  return new THREE.CanvasTexture(c);
}

/**
 * The starry ceiling: fibre ends spread over the whole ceiling, three fibre sizes, a few warm
 * ones; each group breathes slowly with its own phase (update(t)) for a gentle twinkle.
 * `px`: size of the largest fibre on screen, in pixels.
 */
function starCeiling({ px, count = 9000, seed = 11, level = 1 }) {
  const rand = rng(seed);
  const map = dotTexture();
  const group = new THREE.Group();
  const sizes = [0.45, 0.7, 1];
  const shares = [0.6, 0.3, 0.1];
  const mats = [];
  for (let k = 0; k < sizes.length; k++)
    for (let phase = 0; phase < 2; phase++) {
      const n = Math.round((count * shares[k]) / 2);
      const pos = new Float32Array(n * 3);
      const col = new Float32Array(n * 3);
      for (let i = 0; i < n; i++) {
        pos[i * 3] = ROOM.x[0] + 0.15 + rand() * (ROOM.x[1] - ROOM.x[0] - 0.3);
        pos[i * 3 + 1] = ROOM.h - 0.004;
        pos[i * 3 + 2] = ROOM.z[0] + 0.15 + rand() * (ROOM.z[1] - ROOM.z[0] - 0.3);
        const warm = rand() < 0.12;
        const b = 0.55 + 0.45 * rand();
        col[i * 3] = b;
        col[i * 3 + 1] = b * (warm ? 0.86 : 0.97);
        col[i * 3 + 2] = b * (warm ? 0.62 : 1.0);
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      g.setAttribute('color', new THREE.BufferAttribute(col, 3));
      const m = new THREE.PointsMaterial({
        size: Math.max(1, px * sizes[k]),
        sizeAttenuation: false,
        map,
        vertexColors: true,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        fog: false,
      });
      m.color.setScalar(level);
      mats.push({ m, phase: phase * Math.PI + k * 1.3, base: level });
      group.add(new THREE.Points(g, m));
    }
  group.update = (t) => {
    for (const { m, phase, base } of mats) m.color.setScalar(base * (0.82 + 0.18 * Math.sin(t * 0.9 + phase)));
  };
  return group;
}

/**
 * the shell: floor, walls, ceiling (lit materials for the room, flat colours for reflections).
 * Cut into ~0.8 m squares: one huge triangle with a corner close behind the camera is sometimes
 * dropped or mis-filled by the software renderer at 4K (a black floor on a single frame).
 */
const plane = (w, h) => new THREE.PlaneGeometry(w, h, Math.ceil(w / 0.8), Math.ceil(h / 0.8));
function shell(group, { floorMat, wallMat, ceilingMat }) {
  const W = ROOM.x[1] - ROOM.x[0];
  const D = ROOM.z[1] - ROOM.z[0];
  const cx = (ROOM.x[0] + ROOM.x[1]) / 2;
  const cz = (ROOM.z[0] + ROOM.z[1]) / 2;
  const floor = new THREE.Mesh(plane(W, D), floorMat);
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(cx, 0, cz);
  group.add(floor);
  const ceiling = new THREE.Mesh(plane(W, D), ceilingMat);
  ceiling.rotation.x = Math.PI / 2;
  ceiling.position.set(cx, ROOM.h, cz);
  group.add(ceiling);
  const wall = (w, x, z, ry) => {
    const m = new THREE.Mesh(plane(w, ROOM.h), wallMat);
    m.position.set(x, ROOM.h / 2, z);
    m.rotation.y = ry;
    group.add(m);
  };
  wall(D, ROOM.x[0], cz, Math.PI / 2);
  wall(D, ROOM.x[1], cz, -Math.PI / 2);
  wall(W, cx, ROOM.z[0], 0);
  wall(W, cx, ROOM.z[1], Math.PI);
  return floor;
}

/** a soft dark footprint under the car (the floor gets no shadow map) */
function contactShadow() {
  const cv = document.createElement('canvas');
  cv.width = 512;
  cv.height = 256;
  const g = cv.getContext('2d');
  g.filter = 'blur(26px)';
  g.fillStyle = '#000';
  g.beginPath();
  g.roundRect(70, 52, 372, 152, 60);
  g.fill();
  const t = new THREE.CanvasTexture(cv);
  const m = new THREE.Mesh(
    new THREE.PlaneGeometry(5.6, 2.8),
    new THREE.MeshBasicMaterial({ color: 0x000000, alphaMap: t, transparent: true, opacity: 0.88, depthWrite: false })
  );
  m.rotation.x = -Math.PI / 2;
  m.position.y = 0.003;
  return m;
}

/**
 * Builds the garage into `scene` and returns the reflections for the car:
 * { envMap, glassEnvMap, update(t) }. `px`: the size of a fibre end on screen (pixels).
 */
export function buildGarage(scene, renderer, { ledLevel = 4.2, px = 3, starLevel = 2.2 } = {}) {
  const room = new THREE.Group();
  const { map, roughnessMap } = floorMaps(renderer);
  // canvas columns run along +x, rows along +z (the floor plane, laid flat, puts the top of the
  // picture at the -z wall): the yellow frame sits centred on the car
  shell(room, {
    floorMat: new THREE.MeshStandardMaterial({ map, roughnessMap, roughness: 1, metalness: 0, envMapIntensity: 0.22 }),
    wallMat: new THREE.MeshStandardMaterial({ color: COLORS.wall, roughness: 0.9, metalness: 0 }),
    ceilingMat: new THREE.MeshStandardMaterial({ color: COLORS.ceiling, roughness: 0.95, metalness: 0 }),
  });
  room.add(contactShadow());
  const L = leds();
  const tube = new THREE.MeshBasicMaterial({ color: new THREE.Color(1, 0.99, 0.97).multiplyScalar(ledLevel) });
  room.add(bars(L.walls, { material: tube }), bars(L.cove, { thick: 0.03, material: tube }));
  const stars = starCeiling({ px, level: starLevel });
  room.add(stars);
  scene.add(room);

  // light: soft and cheap (no area lights, which cost a lot in software rendering): the sky of
  // the hemisphere, and lamps hidden at the strips' height, two on each long side, one behind
  const lights = new THREE.Group();
  lights.add(new THREE.HemisphereLight(0xc8d2ff, 0x121214, 0.9));
  const lamp = (x, y, z, k) => {
    const l = new THREE.PointLight(0xf6f7ff, k, 0, 2);
    l.position.set(x, y, z);
    lights.add(l);
  };
  for (const z of [ROOM.z[0] + 0.6, ROOM.z[1] - 0.6]) for (const x of [-2.6, 3.4]) lamp(x, 1.9, z, 12);
  lamp(ROOM.x[0] + 0.6, 1.9, 0, 12);
  scene.add(lights);

  // reflections: the same room, flat colours, the strips much brighter (they are the light)
  const env = new THREE.Scene();
  const flat = (c) => new THREE.MeshBasicMaterial({ color: c, side: THREE.DoubleSide });
  const envRoom = new THREE.Group();
  shell(envRoom, {
    floorMat: new THREE.MeshBasicMaterial({ map, side: THREE.DoubleSide, color: new THREE.Color(0.35, 0.35, 0.35) }),
    wallMat: flat(new THREE.Color(0x111214)),
    ceilingMat: flat(new THREE.Color(0x040405)),
  });
  const bright = new THREE.MeshBasicMaterial({ color: new THREE.Color(1, 0.99, 0.97).multiplyScalar(3.2) });
  envRoom.add(bars(L.walls, { material: bright, thick: 0.05 }), bars(L.cove, { material: bright, thick: 0.035 }));
  // the stars as seen from the car: a little larger, so they survive in the sharpest reflection
  envRoom.add(starCeiling({ px: 2.2, count: 5000, level: 3 }));
  env.add(envRoom);
  const pmrem = new THREE.PMREMGenerator(renderer);
  const envMap = pmrem.fromScene(env, 0.0, 0.05, 40, { size: 1024, position: new THREE.Vector3(0, 0.9, 0) }).texture;
  bright.color.multiplyScalar(0.6);
  const glassEnvMap = pmrem.fromScene(env, 0.0, 0.05, 40, { size: 512, position: new THREE.Vector3(0, 1.0, 0) }).texture;
  pmrem.dispose();
  return { envMap, glassEnvMap, update: (t) => stars.update(t) };
}
