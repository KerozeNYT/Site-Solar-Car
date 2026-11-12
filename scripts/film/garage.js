/**
 * The garage of the home film (scripts/film/scene.js): a dark detailing bay, premium and quiet.
 * Black PVC floor tiles with a row of yellow tiles framing the car, charcoal walls with a few
 * vertical LED strips and a cove line, a honeycomb of LED tubes on the ceiling above the car.
 * The same room, unlit, is baked into the reflections of the paint and the glass, so the tubes
 * draw their lines on the bodywork.
 *
 * Car space: metres, the car at the origin, nose towards +x, right-hand side towards +z.
 */
import * as THREE from 'three';
import { RectAreaLightUniformsLib } from 'three/addons/lights/RectAreaLightUniformsLib.js';

// the room: walls on the tile grid (0.4 m), the car's bay framed by yellow tiles
const TILE = 0.4;
const ROOM = { x: [-8.4, 12.8], z: [-6.4, 8.0], h: 4.0 };
const BAY = { x: [-3.2, 3.2], z: [-2.0, 2.0] }; // inside the yellow frame (one tile wide)
const COLORS = {
  tile: [12, 12, 14],
  yellow: [168, 120, 8],
  seam: [5, 5, 6],
  wall: 0x15161a,
  ceiling: 0x0c0d0f,
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
    t.anisotropy = renderer.capabilities.getMaxAnisotropy();
    t.generateMipmaps = true;
    t.minFilter = THREE.LinearMipmapLinearFilter;
    return t;
  };
  return { map: tex(color, true), roughnessMap: tex(rough, false) };
}

/** the honeycomb of LED tubes above the car: one segment per hexagon side, shared sides once */
function honeycomb({ radius = 0.46, cols = 9, rows = 5, y = ROOM.h - 0.35 } = {}) {
  const segs = new Map();
  const w = Math.sqrt(3) * radius;
  const pts = [];
  for (let q = 0; q < cols; q++)
    for (let r = 0; r < rows; r++) {
      // flat-topped layout along x (the car's length)
      const cx = (q - (cols - 1) / 2) * radius * 1.5;
      const cz = (r - (rows - 1) / 2) * w + (q % 2 ? w / 2 : 0) - w / 4;
      for (let k = 0; k < 6; k++) {
        const a0 = (Math.PI / 3) * k;
        const a1 = (Math.PI / 3) * (k + 1);
        const p0 = [cx + radius * Math.cos(a0), cz + radius * Math.sin(a0)];
        const p1 = [cx + radius * Math.cos(a1), cz + radius * Math.sin(a1)];
        const key = [((p0[0] + p1[0]) / 2).toFixed(3), ((p0[1] + p1[1]) / 2).toFixed(3)].join(',');
        if (!segs.has(key)) segs.set(key, [p0, p1]);
      }
      pts.push([cx, cz]);
    }
  return { segs: [...segs.values()], y, radius };
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

/** every LED of the room, as bar lists (shared by the lit room and its reflection) */
function leds() {
  const hex = honeycomb();
  const ceiling = hex.segs.map(([a, b]) => ({ x0: a[0], z0: a[1], x1: b[0], z1: b[1], y: hex.y }));
  // a rectangle around the honeycomb
  const fx = 3.75;
  const fz = 1.75;
  const y = hex.y;
  ceiling.push({ x0: -fx, z0: -fz, x1: fx, z1: -fz, y }, { x0: -fx, z0: fz, x1: fx, z1: fz, y });
  ceiling.push({ x0: -fx, z0: -fz, x1: -fx, z1: fz, y }, { x0: fx, z0: -fz, x1: fx, z1: fz, y });
  // walls: a few vertical strips, and a cove line under the ceiling on the long walls
  const walls = [];
  const inset = 0.03;
  for (const z of [-4.4, -1.6, 1.6, 4.4]) walls.push({ vertical: true, x: ROOM.x[0] + inset, z, y0: 0.35, y1: 3.1, dx: 0.02, dz: 0.05 });
  for (const x of [-5.6, -2.0, 1.6, 5.2, 8.8]) {
    walls.push({ vertical: true, x, z: ROOM.z[0] + inset, y0: 0.35, y1: 3.1, dx: 0.05, dz: 0.02 });
    walls.push({ vertical: true, x, z: ROOM.z[1] - inset, y0: 0.35, y1: 3.1, dx: 0.05, dz: 0.02 });
  }
  const cove = [
    { x0: ROOM.x[0] + 0.3, z0: ROOM.z[0] + inset, x1: ROOM.x[1] - 0.3, z1: ROOM.z[0] + inset, y: 3.45 },
    { x0: ROOM.x[0] + 0.3, z0: ROOM.z[1] - inset, x1: ROOM.x[1] - 0.3, z1: ROOM.z[1] - inset, y: 3.45 },
    { x0: ROOM.x[0] + inset, z0: ROOM.z[0] + 0.3, x1: ROOM.x[0] + inset, z1: ROOM.z[1] - 0.3, y: 3.45 },
  ];
  return { ceiling, walls, cove };
}

/** the shell: floor, walls, ceiling (lit materials for the room, flat colours for reflections) */
function shell(group, { floorMat, wallMat, ceilingMat }) {
  const W = ROOM.x[1] - ROOM.x[0];
  const D = ROOM.z[1] - ROOM.z[0];
  const cx = (ROOM.x[0] + ROOM.x[1]) / 2;
  const cz = (ROOM.z[0] + ROOM.z[1]) / 2;
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(W, D), floorMat);
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(cx, 0, cz);
  group.add(floor);
  const ceiling = new THREE.Mesh(new THREE.PlaneGeometry(W, D), ceilingMat);
  ceiling.rotation.x = Math.PI / 2;
  ceiling.position.set(cx, ROOM.h, cz);
  group.add(ceiling);
  const wall = (w, x, z, ry) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, ROOM.h), wallMat);
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
 * { envMap, glassEnvMap, lights }.
 */
export function buildGarage(scene, renderer, { ledLevel = 4.2 } = {}) {
  RectAreaLightUniformsLib.init();
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
  const tube = new THREE.MeshBasicMaterial({ color: new THREE.Color(1, 0.99, 0.97).multiplyScalar(ledLevel), toneMapped: true });
  room.add(bars(L.ceiling, { material: tube }), bars(L.walls, { material: tube }), bars(L.cove, { thick: 0.03, material: tube }));
  scene.add(room);

  // light: the honeycomb as a soft area light from above, a dim fill from the walls
  const lights = new THREE.Group();
  const panel = new THREE.RectAreaLight(0xfff8f0, 1.8, 7.4, 3.4);
  panel.position.set(0, ROOM.h - 0.36, 0);
  panel.lookAt(0, 0, 0);
  lights.add(panel);
  for (const z of [ROOM.z[0] + 0.1, ROOM.z[1] - 0.1]) {
    const strip = new THREE.RectAreaLight(0xf4f6ff, 0.35, 14, 2.6);
    strip.position.set(1.6, 1.75, z);
    strip.lookAt(1.6, 1.0, 0);
    lights.add(strip);
  }
  const back = new THREE.RectAreaLight(0xf4f6ff, 0.35, 9, 2.6);
  back.position.set(ROOM.x[0] + 0.1, 1.75, 0);
  back.lookAt(0, 1.0, 0);
  lights.add(back);
  lights.add(new THREE.HemisphereLight(0xd8e0ff, 0x101012, 0.12));
  scene.add(lights);

  // reflections: the same room, flat colours, the tubes much brighter (they are the light)
  const env = new THREE.Scene();
  const flat = (c) => new THREE.MeshBasicMaterial({ color: c, side: THREE.DoubleSide });
  const envRoom = new THREE.Group();
  shell(envRoom, {
    floorMat: new THREE.MeshBasicMaterial({ map, side: THREE.DoubleSide, color: new THREE.Color(0.35, 0.35, 0.35) }),
    wallMat: flat(new THREE.Color(0x08090b)),
    ceilingMat: flat(new THREE.Color(0x050506)),
  });
  // the honeycomb a little dimmer than the walls: the bonnet and the roof face it whole
  const bright = new THREE.MeshBasicMaterial({ color: new THREE.Color(1, 0.99, 0.97).multiplyScalar(3.2) });
  const brightTop = new THREE.MeshBasicMaterial({ color: new THREE.Color(1, 0.99, 0.97).multiplyScalar(2.0) });
  envRoom.add(bars(L.ceiling, { material: brightTop, thick: 0.03 }), bars(L.walls, { material: bright, thick: 0.05 }), bars(L.cove, { material: bright, thick: 0.035 }));
  env.add(envRoom);
  const pmrem = new THREE.PMREMGenerator(renderer);
  const envMap = pmrem.fromScene(env, 0.0, 0.05, 40, { size: 1024, position: new THREE.Vector3(0, 0.9, 0) }).texture;
  bright.color.multiplyScalar(0.6);
  brightTop.color.multiplyScalar(0.6);
  const glassEnvMap = pmrem.fromScene(env, 0.0, 0.05, 40, { size: 512, position: new THREE.Vector3(0, 1.0, 0) }).texture;
  pmrem.dispose();
  return { envMap, glassEnvMap, lights, room };
}
