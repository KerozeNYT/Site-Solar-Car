/**
 * Christmas dressing of the film's garage and car (knob xmas=1 of scripts/film/scene.js), for the
 * Christmas ad (docs/PUB-NOEL.md): the car wrapped like a present (a red satin ribbon around it
 * both ways, a large bow on the roof), fir garlands lit with warm bulbs along the walls, two lit
 * Christmas trees in the corners. The image and video models make it photographic; the shapes
 * only have to be the same from one key frame to the next.
 *
 * The ribbon follows the body: rays cast towards the car from outside, in two planes (across the
 * roof, and along the car's centre line), give the points of each band.
 */
import * as THREE from 'three';

const RED = '#b0101a';

/** a seeded random: the same garlands and trees in every frame */
function rng(seed) {
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
}

/** the visible meshes of the car (no sprites: the light halos), the targets of the rays */
function meshesOf(car) {
  const out = [];
  car.traverse((o) => {
    if (!o.isMesh || o.isSprite) return;
    for (let p = o; p; p = p.parent) if (!p.visible) return;
    out.push(o);
  });
  return out;
}

/** the first point of the car hit by a ray from `from` towards `to` */
function hit(ray, meshes, from, to) {
  ray.set(from, to.clone().sub(from).normalize());
  ray.far = from.distanceTo(to);
  return ray.intersectObjects(meshes, false)[0] || null;
}

/** a flat band through points `pts`, `width` wide across `side` (a unit vector), lifted off the body */
function band(pts, side, width, material) {
  const pos = [];
  const idx = [];
  pts.forEach((p, i) => {
    const a = p.clone().addScaledVector(side, width / 2);
    const b = p.clone().addScaledVector(side, -width / 2);
    pos.push(a.x, a.y, a.z, b.x, b.y, b.z);
    if (i) idx.push(2 * i - 2, 2 * i - 1, 2 * i, 2 * i - 1, 2 * i + 1, 2 * i);
  });
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return new THREE.Mesh(g, material);
}

/** the points of the body's outline in a plane, rays cast from an arc outside towards an axis */
function outline(ray, meshes, { plane, center, radius, from, to, steps, lift, floor }) {
  const pts = [];
  for (let i = 0; i <= steps; i++) {
    const a = from + ((to - from) * i) / steps;
    // plane 'x': across the car (y, z); plane 'z': along it (x, y)
    const o = plane === 'x' ? new THREE.Vector3(center.x, center.y + radius * Math.sin(a), radius * Math.cos(a)) : new THREE.Vector3(center.x + radius * Math.cos(a) * 1.6, center.y + radius * Math.sin(a), center.z);
    const target = plane === 'x' ? new THREE.Vector3(center.x, center.y, 0) : new THREE.Vector3(center.x, center.y, center.z);
    const h = hit(ray, meshes, o, target);
    if (!h || h.point.y < floor) continue;
    const n = h.face ? h.face.normal.clone().transformDirection(h.object.matrixWorld) : o.clone().sub(target).normalize();
    if (n.dot(o.clone().sub(h.point)) < 0) n.negate();
    pts.push(h.point.clone().addScaledVector(n, lift));
  }
  // smooth out the small steps between panels
  return pts.map((p, i) => (i && i < pts.length - 1 ? p.clone().add(pts[i - 1]).add(pts[i + 1]).multiplyScalar(1 / 3) : p));
}

/** a large bow: two loops, a knot, two tails */
function bow(material, size = 1) {
  const g = new THREE.Group();
  const loopGeo = new THREE.TorusGeometry(0.2 * size, 0.03 * size, 14, 40);
  for (const s of [-1, 1]) {
    const loop = new THREE.Mesh(loopGeo, material);
    loop.scale.set(1.15, 0.85, 0.2);
    loop.rotation.set(0, Math.PI / 2, s * 0.55);
    loop.position.set(0, 0.13 * size, s * 0.2 * size);
    g.add(loop);
  }
  const knot = new THREE.Mesh(new THREE.SphereGeometry(0.075 * size, 20, 14), material);
  knot.scale.set(1, 0.8, 1.2);
  knot.position.y = 0.06 * size;
  g.add(knot);
  const tailGeo = new THREE.BoxGeometry(0.11 * size, 0.012, 0.42 * size);
  for (const s of [-1, 1]) {
    const tail = new THREE.Mesh(tailGeo, material);
    tail.position.set(s * 0.09 * size, 0.02, s * 0.18 * size);
    tail.rotation.set(s * 0.25, s * 0.5, 0);
    g.add(tail);
  }
  return g;
}

/** a garland of fir lit with bulbs, hanging in swags between `a` and `b` */
function garland(group, a, b, { swags, sag, rand, bulbs }) {
  const pts = [];
  const n = swags * 16;
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const u = (t * swags) % 1;
    const p = a.clone().lerp(b, t);
    p.y -= sag * 4 * u * (1 - u);
    pts.push(p);
  }
  const curve = new THREE.CatmullRomCurve3(pts);
  const fir = new THREE.Mesh(new THREE.TubeGeometry(curve, n * 2, 0.085, 8, false), new THREE.MeshStandardMaterial({ color: 0x14361f, roughness: 0.95, metalness: 0 }));
  group.add(fir);
  const count = Math.round(curve.getLength() / 0.12);
  for (let i = 0; i < count; i++) {
    const p = curve.getPointAt((i + rand()) / count);
    p.x += (rand() - 0.5) * 0.06;
    p.y += (rand() - 0.5) * 0.06 - 0.02;
    p.z += (rand() - 0.5) * 0.06;
    bulbs.push(p);
  }
}

/** a Christmas tree: stacked cones of fir, warm bulbs, a gold star */
function tree(group, at, h, rand, bulbs, stars) {
  const fir = new THREE.MeshStandardMaterial({ color: 0x103a1c, roughness: 0.9, metalness: 0 });
  const layers = 5;
  for (let i = 0; i < layers; i++) {
    const r = (0.62 - i * 0.1) * (h / 2.2);
    const cone = new THREE.Mesh(new THREE.ConeGeometry(r, h * 0.34, 18), fir);
    cone.position.set(at.x, h * (0.22 + i * 0.15), at.z);
    group.add(cone);
  }
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 0.3, 10), new THREE.MeshStandardMaterial({ color: 0x3a2412, roughness: 1 }));
  trunk.position.set(at.x, 0.15, at.z);
  group.add(trunk);
  // bulbs on a spiral around the cone
  for (let i = 0; i < 90; i++) {
    const t = i / 90;
    const y = h * (0.12 + t * 0.8);
    const r = (0.66 * (1 - t) + 0.05) * (h / 2.2);
    const a = t * Math.PI * 2 * 6 + rand() * 0.4;
    bulbs.push(new THREE.Vector3(at.x + Math.cos(a) * r, y, at.z + Math.sin(a) * r));
  }
  stars.push(new THREE.Vector3(at.x, h * 1.0, at.z));
}

/** wrapped presents: [x, z, width, height, depth, paper, ribbon, turn, lifted y] */
function gifts(group, list) {
  for (const [x, z, w, h, d, paper, ribbon, turn, y = 0] of list) {
    const box = new THREE.Group();
    const p = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshPhysicalMaterial({ color: paper, roughness: 0.4, clearcoat: 0.4 }));
    const r = new THREE.MeshPhysicalMaterial({ color: ribbon, roughness: 0.3, metalness: ribbon === '#e9cd82' ? 0.6 : 0, sheen: 1 });
    const b1 = new THREE.Mesh(new THREE.BoxGeometry(w + 0.01, h + 0.01, d * 0.16), r);
    const b2 = new THREE.Mesh(new THREE.BoxGeometry(w * 0.16, h + 0.01, d + 0.01), r);
    const knot = new THREE.Mesh(new THREE.TorusGeometry(w * 0.13, w * 0.04, 8, 20), r);
    knot.position.y = h / 2 + w * 0.08;
    box.add(p, b1, b2, knot);
    box.position.set(x, y + h / 2, z);
    box.rotation.y = turn;
    group.add(box);
  }
}

/**
 * Adds the dressing. `car`: the car's group (rays for the ribbon); `room`: { x: [min, max],
 * z: [min, max], h }. Returns { update(fx) }: fx.ribbon 1 shows the ribbon and the bow, 0 hides them.
 */
export function addChristmas(scene, car, room) {
  const rand = rng(1225);
  const ray = new THREE.Raycaster();
  car.updateMatrixWorld(true);
  const meshes = meshesOf(car);
  // the size of the body from its visible meshes only (the hidden headlight beam cones reach far
  // ahead of the car)
  const box = new THREE.Box3();
  for (const m of meshes) box.expandByObject(m);
  // the model's halves are mirrored copies (negative scale): one side's faces look inwards to a
  // ray, so both faces count while the ribbon is laid, then the materials are set back
  const sides = new Map();
  for (const m of meshes) for (const mat of [].concat(m.material)) if (!sides.has(mat)) sides.set(mat, mat.side);
  for (const mat of sides.keys()) mat.side = THREE.DoubleSide;

  // ---------------------------------------------------------------- the ribbon and the bow
  const satin = new THREE.MeshPhysicalMaterial({ color: RED, roughness: 0.3, metalness: 0, sheen: 1, sheenColor: new THREE.Color('#ff7a7a'), sheenRoughness: 0.35, clearcoat: 0.35, clearcoatRoughness: 0.25, side: THREE.DoubleSide });
  const wrap = new THREE.Group();
  // the top of the roof: the highest point along the centre line
  let roof = { x: 0, y: 0 };
  for (let x = box.min.x * 0.6; x <= box.max.x * 0.6; x += 0.05) {
    const h = hit(ray, meshes, new THREE.Vector3(x, box.max.y + 1, 0), new THREE.Vector3(x, 0, 0));
    if (h && h.point.y > roof.y && h.point.y < box.max.y - 0.01) roof = { x, y: h.point.y };
  }
  const mid = new THREE.Vector3(roof.x, box.min.y + (box.max.y - box.min.y) * 0.42, 0);
  const across = outline(ray, meshes, { plane: 'x', center: mid, radius: 2.4, from: 0.04 * Math.PI, to: 0.96 * Math.PI, steps: 90, lift: 0.012, floor: 0.32 });
  // a few centimetres off the centre plane: the model's two mirrored halves meet exactly at z = 0,
  // where rays slip between them
  const along = outline(ray, meshes, { plane: 'z', center: new THREE.Vector3((box.min.x + box.max.x) / 2, mid.y, 0.035), radius: 2.4, from: 0.03 * Math.PI, to: 0.97 * Math.PI, steps: 140, lift: 0.014, floor: 0.3 });
  for (const [mat, side] of sides) mat.side = side;
  wrap.add(band(across, new THREE.Vector3(1, 0, 0), 0.17, satin), band(along, new THREE.Vector3(0, 0, 1), 0.17, satin));
  const b = bow(satin, 1.25);
  b.position.set(roof.x, roof.y + 0.02, 0);
  wrap.add(b);
  scene.add(wrap);

  // ---------------------------------------------------------------- garlands and trees
  const deco = new THREE.Group();
  const bulbs = [];
  const tops = [];
  const y = room.h - 0.18;
  const inset = 0.08;
  const [x0, x1] = room.x;
  const [z0, z1] = room.z;
  garland(deco, new THREE.Vector3(x0 + 0.3, y, z0 + inset), new THREE.Vector3(x1 - 0.3, y, z0 + inset), { swags: 9, sag: 0.45, rand, bulbs });
  garland(deco, new THREE.Vector3(x0 + 0.3, y, z1 - inset), new THREE.Vector3(x1 - 0.3, y, z1 - inset), { swags: 9, sag: 0.45, rand, bulbs });
  garland(deco, new THREE.Vector3(x0 + inset, y, z0 + 0.3), new THREE.Vector3(x0 + inset, y, z1 - 0.3), { swags: 5, sag: 0.45, rand, bulbs });
  garland(deco, new THREE.Vector3(x1 - inset, y, z0 + 0.3), new THREE.Vector3(x1 - inset, y, z1 - 0.3), { swags: 5, sag: 0.45, rand, bulbs });
  // the corners, and a tall tree right behind the car in the front three-quarter views
  tree(deco, new THREE.Vector3(x0 + 1.0, 0, z0 + 1.0), 2.3, rand, bulbs, tops);
  tree(deco, new THREE.Vector3(x1 - 1.0, 0, z0 + 1.0), 2.3, rand, bulbs, tops);
  tree(deco, new THREE.Vector3(x0 + 1.0, 0, z1 - 1.0), 2.3, rand, bulbs, tops);
  tree(deco, new THREE.Vector3(-3.3, 0, z0 + 1.0), 2.5, rand, bulbs, tops);
  // presents on the floor, beside the car's nose
  gifts(deco, [
    [3.05, -1.35, 0.5, 0.42, 0.5, '#b0101a', '#e9cd82', 0.3],
    [3.55, -1.0, 0.36, 0.3, 0.36, '#e9cd82', '#b0101a', -0.4],
    [3.12, -1.3, 0.3, 0.26, 0.3, '#0f3a22', '#e9cd82', 0.9, 0.42],
  ]);
  // the bulbs: mostly warm white, some gold and red, bright enough to bloom
  const warm = [new THREE.Color(1.0, 0.78, 0.45), new THREE.Color(1.0, 0.62, 0.2), new THREE.Color(1.0, 0.18, 0.12)];
  const lamp = new THREE.InstancedMesh(new THREE.SphereGeometry(0.022, 10, 8), new THREE.MeshBasicMaterial({ toneMapped: true }), bulbs.length);
  const m = new THREE.Matrix4();
  bulbs.forEach((p, i) => {
    lamp.setMatrixAt(i, m.makeTranslation(p.x, p.y, p.z));
    const r = rand();
    lamp.setColorAt(i, warm[r < 0.7 ? 0 : r < 0.88 ? 1 : 2].clone().multiplyScalar(5.5));
  });
  deco.add(lamp);
  const gold = new THREE.MeshBasicMaterial({ color: new THREE.Color(1, 0.8, 0.35).multiplyScalar(6) });
  for (const p of tops) {
    const s = new THREE.Mesh(new THREE.OctahedronGeometry(0.11, 0), gold);
    s.position.copy(p);
    s.scale.set(1, 1.3, 0.35);
    deco.add(s);
  }
  // a warm glow from the garlands and the trees on the car and the floor
  for (const p of [new THREE.Vector3(x0 + 1.0, 1.4, z0 + 1.0), new THREE.Vector3(x1 - 1.0, 1.4, z0 + 1.0), new THREE.Vector3(x0 + 1.0, 1.4, z1 - 1.0)]) {
    const l = new THREE.PointLight(0xffa64d, 1.4, 7, 2);
    l.position.copy(p);
    deco.add(l);
  }
  scene.add(deco);
  console.log('[scene] xmas', JSON.stringify({ roof, across: across.length, along: along.length, bulbs: bulbs.length }));
  return {
    update(fx = {}) {
      wrap.visible = (fx.ribbon ?? 0) > 0.5;
    },
  };
}
