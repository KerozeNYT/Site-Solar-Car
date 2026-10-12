import * as THREE from 'three';
import { rng, lerp } from './math.js';
import { glowTexture } from './materials.js';

/*
 * The premises: a detailing studio (hex LED ceiling, epoxy floor, turntable) inside a
 * dark clad workshop on a small business park at night. +x is the street side; the big
 * sectional door is in the +x wall, facing the forecourt and the access road.
 */

export const BLD = {
  x0: -9,
  x1: 9,
  z0: -6.5,
  z1: 6.5,
  h: 5.4,
  doorZ0: -2.7,
  doorZ1: 2.7,
  doorH: 4.1,
  wall: 0.25,
};

// ---------------------------------------------------------------- reflective floor
// Mirror trick: the scene is drawn a second time flipped under y=0; the floor is a
// translucent layer over it whose opacity rises at normal incidence (Fresnel).
function makeFloorMaterial({ color, nearAlpha, farAlpha, speckle = 0.0, pool = [], disc = 0 }) {
  return new THREE.ShaderMaterial({
    uniforms: {
      uColor: { value: new THREE.Color(color) },
      uNear: { value: nearAlpha },
      uFar: { value: farAlpha },
      uSpeckle: { value: speckle },
      uPools: { value: Array.from({ length: 8 }, (_, i) => new THREE.Vector4(...(pool[i] || [0, 0, 1, 0]))) },
      uPoolCount: { value: pool.length },
      uDisc: { value: disc },
    },
    vertexShader: /* glsl */ `
      varying vec3 vWorld;
      void main(){
        vec4 w = modelMatrix * vec4(position, 1.0);
        vWorld = w.xyz;
        gl_Position = projectionMatrix * viewMatrix * w;
      }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uColor; uniform float uNear; uniform float uFar; uniform float uSpeckle;
      uniform vec4 uPools[8]; uniform int uPoolCount; uniform float uDisc;
      varying vec3 vWorld;
      float hash(vec2 p){ return fract(sin(dot(p, vec2(41.3, 289.1))) * 43758.5453); }
      void main(){
        vec3 V = normalize(cameraPosition - vWorld);
        float fres = pow(1.0 - clamp(V.y, 0.0, 1.0), 3.0);
        float light = 0.0;
        for (int i = 0; i < 8; i++) {
          if (i >= uPoolCount) break;
          vec4 p = uPools[i];
          float d = length((vWorld.xz - p.xy) / vec2(p.z, p.z * 0.75));
          light += p.w * exp(-d * d * 2.2);
        }
        float sp = hash(floor(vWorld.xz * 220.0));
        vec3 col = uColor * (0.35 + light) * (1.0 + uSpeckle * (sp - 0.5) * 0.35);
        float a = mix(uNear, uFar, fres);
        if (uDisc > 0.0) {
          float r = length(vWorld.xz);
          float inDisc = 1.0 - smoothstep(uDisc - 0.01, uDisc + 0.01, r);
          float seam = smoothstep(0.02, 0.0, abs(r - uDisc - 0.03));
          col = mix(col, uColor * 0.45 * (0.5 + light), inDisc);
          a = mix(a, mix(0.72, 0.3, fres), inDisc);
          col *= 1.0 - seam * 0.6;
        }
        gl_FragColor = vec4(col * a, a);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
    transparent: true,
    depthWrite: true,
    blending: THREE.CustomBlending,
    blendSrc: THREE.OneFactor,
    blendDst: THREE.OneMinusSrcAlphaFactor,
  });
}

// ---------------------------------------------------------------- hex light grid
function hexEdges(cx, cz, w, d, r) {
  // flat-topped hexagons tiled over a rectangle; returns unique edges [x1,z1,x2,z2]
  const edges = new Map();
  const hx = 1.5 * r;
  const hz = Math.sqrt(3) * r;
  for (let i = -20; i <= 20; i++) {
    for (let j = -20; j <= 20; j++) {
      const x = cx + i * hx;
      const z = cz + j * hz + (i % 2 ? hz / 2 : 0);
      if (Math.abs(x - cx) > w / 2 - r * 0.5 || Math.abs(z - cz) > d / 2 - r * 0.5) continue;
      for (let k = 0; k < 6; k++) {
        const a0 = (k / 6) * Math.PI * 2;
        const a1 = ((k + 1) / 6) * Math.PI * 2;
        const e = [x + r * Math.cos(a0), z + r * Math.sin(a0), x + r * Math.cos(a1), z + r * Math.sin(a1)];
        const key = [((e[0] + e[2]) / 2).toFixed(3), ((e[1] + e[3]) / 2).toFixed(3)].join(',');
        edges.set(key, e);
      }
    }
  }
  return [...edges.values()];
}

function hexLights({ y, w, d, r, intensity }) {
  const edges = hexEdges(0, 0, w, d, r);
  // outer frame
  const fw = w / 2 + 0.25;
  const fd = d / 2 + 0.25;
  const frame = [
    [-fw, -fd, fw, -fd],
    [fw, -fd, fw, fd],
    [fw, fd, -fw, fd],
    [-fw, fd, -fw, -fd],
  ];
  const all = edges.concat(frame);
  const geo = new THREE.BoxGeometry(1, 0.035, 0.05);
  const mat = new THREE.MeshBasicMaterial({ color: new THREE.Color(1, 1, 1).multiplyScalar(intensity) });
  const mesh = new THREE.InstancedMesh(geo, mat, all.length);
  const o = new THREE.Object3D();
  all.forEach((e, i) => {
    const [x1, z1, x2, z2] = e;
    o.position.set((x1 + x2) / 2, y, (z1 + z2) / 2);
    o.rotation.set(0, -Math.atan2(z2 - z1, x2 - x1), 0);
    o.scale.set(Math.hypot(x2 - x1, z2 - z1) + 0.04, 1, 1);
    o.updateMatrix();
    mesh.setMatrixAt(i, o.matrix);
  });
  mesh.name = 'hex';
  return mesh;
}

// ---------------------------------------------------------------- canvas textures
function claddingTexture() {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 64;
  const g = c.getContext('2d');
  g.fillStyle = '#1a1c20';
  g.fillRect(0, 0, 512, 64);
  for (let i = 0; i < 16; i++) {
    const x = i * 32;
    const grd = g.createLinearGradient(x, 0, x + 32, 0);
    grd.addColorStop(0, '#24272c');
    grd.addColorStop(0.45, '#2e3238');
    grd.addColorStop(0.5, '#121316');
    grd.addColorStop(1, '#1e2025');
    g.fillStyle = grd;
    g.fillRect(x, 0, 32, 64);
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

function slatTexture() {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 16;
  const g = c.getContext('2d');
  g.fillStyle = '#16181c';
  g.fillRect(0, 0, 256, 16);
  for (let i = 0; i < 8; i++) {
    g.fillStyle = '#0b0c0e';
    g.fillRect(i * 32 + 29, 0, 3, 16);
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** Brand sign texture rendered from the logo SVG markup (no external fetch). */
export function logoTexture(svgMarkup, w = 1024, h = 256) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const img = new Image();
  img.onload = () => {
    const g = c.getContext('2d');
    g.clearRect(0, 0, w, h);
    const s = Math.min(w / img.width, h / img.height) * 0.92;
    const iw = img.width * s;
    const ih = img.height * s;
    g.drawImage(img, (w - iw) / 2, (h - ih) / 2, iw, ih);
    tex.needsUpdate = true;
  };
  img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svgMarkup);
  return tex;
}

// ---------------------------------------------------------------- building
function box(w, h, d, mat, x, y, z) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, y, z);
  return m;
}

export function buildPremises({ quality = 'high', logoSvg = null, signTexture = null } = {}) {
  const hi = quality === 'high';
  const root = new THREE.Group();
  root.name = 'premises';
  const reflect = new THREE.Group(); // everything that appears in floor reflections
  reflect.name = 'reflect';
  root.add(reflect);
  const B = BLD;
  const r = rng(11);

  // --- materials
  const clad = claddingTexture();
  const extWall = new THREE.MeshStandardMaterial({ map: clad, color: 0xffffff, roughness: 0.62, metalness: 0.35 });
  const intWall = new THREE.MeshStandardMaterial({ color: 0x1b1d22, roughness: 0.85, metalness: 0.0 });
  const slats = slatTexture();
  const slatWall = new THREE.MeshStandardMaterial({ map: slats, roughness: 0.8 });
  const ceiling = new THREE.MeshStandardMaterial({ color: 0x0b0c0e, roughness: 0.95 });
  const roofMat = new THREE.MeshStandardMaterial({ color: 0x24262a, roughness: 0.9 });
  const ledWarm = new THREE.MeshBasicMaterial({ color: new THREE.Color(1.0, 0.62, 0.25).multiplyScalar(2.2) });
  const ledCool = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.8, 0.9, 1).multiplyScalar(2.4) });

  // --- walls (interior face colour on the inside, cladding outside)
  const L = B.x1 - B.x0;
  const D = B.z1 - B.z0;
  const t = B.wall;
  const wallMats = (inside, outside, insideAxis) => {
    // BoxGeometry face order: +x, -x, +y, -y, +z, -z
    const m = [outside, outside, roofMat, roofMat, outside, outside];
    m[insideAxis] = inside;
    return m;
  };
  // tile the cladding to metres
  const cladFor = (len) => {
    const m = extWall.clone();
    m.map = clad.clone();
    m.map.repeat.set(len / 4, 1);
    m.map.needsUpdate = true;
    return m;
  };
  const back = new THREE.Mesh(new THREE.BoxGeometry(t, B.h, D), wallMats(slatWall, cladFor(D), 0));
  slatWall.map.repeat.set(D / 2, 1);
  back.position.set(B.x0 - t / 2, B.h / 2, 0);
  reflect.add(back);
  const sideMatsR = wallMats(intWall, cladFor(L), 5);
  const sideR = new THREE.Mesh(new THREE.BoxGeometry(L + 2 * t, B.h, t), sideMatsR);
  sideR.position.set(0, B.h / 2, B.z1 + t / 2);
  reflect.add(sideR);
  const sideL = new THREE.Mesh(new THREE.BoxGeometry(L + 2 * t, B.h, t), wallMats(intWall, cladFor(L), 4));
  sideL.position.set(0, B.h / 2, B.z0 - t / 2);
  reflect.add(sideL);
  // front wall with the door opening
  const fm = () => wallMats(intWall, cladFor(4), 1);
  const leftW = B.doorZ0 - B.z0;
  const rightW = B.z1 - B.doorZ1;
  const fl = new THREE.Mesh(new THREE.BoxGeometry(t, B.h, leftW), fm());
  fl.position.set(B.x1 + t / 2, B.h / 2, B.z0 + leftW / 2);
  const fr = new THREE.Mesh(new THREE.BoxGeometry(t, B.h, rightW), fm());
  fr.position.set(B.x1 + t / 2, B.h / 2, B.z1 - rightW / 2);
  const lintel = new THREE.Mesh(new THREE.BoxGeometry(t, B.h - B.doorH, B.doorZ1 - B.doorZ0), fm());
  lintel.position.set(B.x1 + t / 2, B.doorH + (B.h - B.doorH) / 2, 0);
  reflect.add(fl, fr, lintel);
  // raised-door housing and LED portal outline
  const housing = box(0.5, 0.45, B.doorZ1 - B.doorZ0 + 0.3, new THREE.MeshStandardMaterial({ color: 0x15171a, roughness: 0.6, metalness: 0.4 }), B.x1 - 0.3, B.doorH + 0.25, 0);
  reflect.add(housing);
  const portal = new THREE.Group();
  const pw = 0.05;
  portal.add(box(0.04, pw, B.doorZ1 - B.doorZ0, ledWarm, B.x1 + t + 0.02, B.doorH + 0.02, 0));
  portal.add(box(0.04, B.doorH, pw, ledWarm, B.x1 + t + 0.02, B.doorH / 2, B.doorZ0 - 0.02));
  portal.add(box(0.04, B.doorH, pw, ledWarm, B.x1 + t + 0.02, B.doorH / 2, B.doorZ1 + 0.02));
  reflect.add(portal);
  // ceiling + roof
  const ceil = new THREE.Mesh(new THREE.BoxGeometry(L + 2 * t, 0.3, D + 2 * t), [roofMat, roofMat, roofMat, ceiling, roofMat, roofMat]);
  ceil.position.set(0, B.h + 0.15, 0);
  reflect.add(ceil);
  // parapet + roof clutter (seen in the final aerial)
  const par = new THREE.MeshStandardMaterial({ color: 0x1c1e22, roughness: 0.8, metalness: 0.3 });
  reflect.add(box(L + 2 * t, 0.5, 0.2, par, 0, B.h + 0.55, B.z0 - t + 0.1));
  reflect.add(box(L + 2 * t, 0.5, 0.2, par, 0, B.h + 0.55, B.z1 + t - 0.1));
  reflect.add(box(0.2, 0.5, D + 2 * t, par, B.x0 - t + 0.1, B.h + 0.55, 0));
  reflect.add(box(0.2, 0.5, D + 2 * t, par, B.x1 + t - 0.1, B.h + 0.55, 0));
  const hvac = new THREE.MeshStandardMaterial({ color: 0x5a5e66, roughness: 0.55, metalness: 0.6 });
  reflect.add(box(1.6, 0.9, 1.2, hvac, -5.5, B.h + 0.75, -3.8));
  reflect.add(box(1.2, 0.7, 1.0, hvac, -6.8, B.h + 0.65, 3.5));
  // skylights glow from the studio below
  const sky = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.85, 0.92, 1).multiplyScalar(1.4) });
  for (const x of [-4.5, -1.5, 1.5, 4.5]) for (const z of [-4.2, 4.2]) reflect.add(box(1.4, 0.06, 0.9, sky, x, B.h + 0.33, z));

  // --- studio interior dressing
  const studio = new THREE.Group();
  studio.name = 'studio';
  reflect.add(studio);
  const hex = hexLights({ y: 4.35, w: 9.2, d: 6.4, r: 0.62, intensity: 3.2 });
  studio.add(hex);
  // hanging rods
  const rodMat = new THREE.MeshStandardMaterial({ color: 0x0c0d0f });
  for (const [x, z] of [
    [-4.5, -3],
    [4.5, -3],
    [-4.5, 3],
    [4.5, 3],
  ])
    studio.add(box(0.02, B.h - 4.35, 0.02, rodMat, x, (B.h + 4.35) / 2, z));
  // horizontal LED strips on the side walls, vertical ones on the back wall
  for (const z of [B.z0 + 0.03, B.z1 - 0.03]) studio.add(box(L - 1, 0.03, 0.02, ledCool, 0, 2.6, z));
  for (let i = -5; i <= 5; i++) studio.add(box(0.02, 3.6, 0.04, ledCool, B.x0 + 0.03, 2.2, i * 1.1));
  // brand signs: the official logo on backlit white panels (back wall + above the door)
  if (signTexture || logoSvg) {
    let tex;
    if (signTexture) {
      tex = new THREE.TextureLoader().load(signTexture);
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.anisotropy = 4;
    } else tex = logoTexture(logoSvg, 2048, 512);
    const signMat = new THREE.MeshBasicMaterial({ map: tex, color: new THREE.Color(1, 1, 1).multiplyScalar(1.15), toneMapped: false });
    const frameMat = new THREE.MeshStandardMaterial({ color: 0x1a1d22, metalness: 0.8, roughness: 0.35 });
    const addSign = (w, x, y, z, ry, parent) => {
      const h = w * (640 / 2048);
      const g = new THREE.Group();
      const panel = new THREE.Mesh(new THREE.PlaneGeometry(w, h), signMat);
      panel.position.z = 0.031;
      const frame = new THREE.Mesh(new THREE.BoxGeometry(w + 0.08, h + 0.08, 0.06), frameMat);
      g.add(frame, panel);
      g.position.set(x, y, z);
      g.rotation.y = ry;
      parent.add(g);
    };
    addSign(5.2, B.x0 + 0.05, 3.0, 0, Math.PI / 2, studio);
    addSign(3.6, B.x1 + t + 0.04, B.doorH + 0.68, 0, Math.PI / 2, reflect);
    // rooftop lightbox, read from the air in the final reveal
    const roofSign = new THREE.Group();
    addSign(9.5, 0, 0, 0, 0, roofSign);
    // lying flat, readable from the street side (camera looking towards -x)
    roofSign.quaternion.setFromRotationMatrix(
      new THREE.Matrix4().makeBasis(new THREE.Vector3(0, 0, -1), new THREE.Vector3(-1, 0, 0), new THREE.Vector3(0, 1, 0))
    );
    roofSign.position.set(1.0, B.h + 0.42, 0);
    reflect.add(roofSign);
  }
  // flush turntable: LED ring at floor level (the disc itself is drawn by the floor shader)
  const ring = new THREE.Mesh(new THREE.TorusGeometry(3.3, 0.014, 8, hi ? 160 : 80), ledWarm);
  ring.rotation.x = Math.PI / 2;
  ring.position.y = 0.002;
  ring.scale.z = 0.25;
  studio.add(ring);
  // detailing props: two inspection light stands and a trolley
  const standMat = new THREE.MeshStandardMaterial({ color: 0x101114, roughness: 0.5, metalness: 0.7 });
  for (const [x, z, ry] of [
    [-3.6, 3.4, 0.6],
    [3.2, -3.6, -2.4],
  ]) {
    const s = new THREE.Group();
    s.add(box(0.04, 1.6, 0.04, standMat, 0, 0.8, 0));
    s.add(box(0.6, 0.03, 0.03, standMat, 0, 0.02, 0));
    s.add(box(0.03, 0.03, 0.6, standMat, 0, 0.02, 0));
    s.add(box(0.06, 0.9, 0.12, standMat, 0, 1.8, 0));
    s.add(box(0.02, 0.84, 0.08, ledCool, 0.035, 1.8, 0));
    s.position.set(x, 0, z);
    s.rotation.y = ry;
    studio.add(s);
  }
  const trolley = new THREE.Group();
  const trolMat = new THREE.MeshStandardMaterial({ color: 0x1d2025, roughness: 0.5, metalness: 0.6 });
  trolley.add(box(0.9, 0.04, 0.5, trolMat, 0, 0.9, 0));
  trolley.add(box(0.9, 0.04, 0.5, trolMat, 0, 0.45, 0));
  for (const [x, z] of [
    [-0.42, -0.22],
    [0.42, -0.22],
    [-0.42, 0.22],
    [0.42, 0.22],
  ])
    trolley.add(box(0.03, 0.9, 0.03, trolMat, x, 0.45, z));
  const bottleMats = [0xff9a3c, 0xe9edf2, 0x2a6fd6].map((c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.35 }));
  for (let i = 0; i < 6; i++) {
    const b = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.2, 12), bottleMats[i % 3]);
    b.position.set(-0.32 + i * 0.12, 1.02, (i % 2 ? 0.08 : -0.08));
    trolley.add(b);
  }
  trolley.position.set(-6.4, 0, -4.6);
  trolley.rotation.y = 0.3;
  studio.add(trolley);
  // wall shelving with product boxes along the left wall
  const shelfMat = new THREE.MeshStandardMaterial({ color: 0x15171b, roughness: 0.7, metalness: 0.3 });
  for (const y of [1.2, 1.8, 2.4]) studio.add(box(3.2, 0.04, 0.4, shelfMat, -5.2, y, B.z0 + 0.25));
  for (let i = 0; i < 14; i++) {
    const y = [1.2, 1.8, 2.4][i % 3] + 0.14;
    const c = r() < 0.3 ? 0xff9a3c : r() < 0.5 ? 0x3a3f47 : 0xd9dde3;
    studio.add(box(0.18, 0.24, 0.24, new THREE.MeshStandardMaterial({ color: c, roughness: 0.6 }), -6.6 + (i / 14) * 2.9, y, B.z0 + 0.27));
  }

  // --- floors (interior epoxy + exterior asphalt) — added to root, not reflected
  const floorIn = new THREE.Mesh(
    new THREE.PlaneGeometry(L, D),
    makeFloorMaterial({
      color: 0x2a2d33,
      nearAlpha: 0.9,
      farAlpha: 0.42,
      speckle: 0.6,
      disc: 3.25,
      pool: [
        [0, 0, 5.5, 0.9],
        [B.x1 - 1.2, 0, 3.2, 0.25],
      ],
    })
  );
  floorIn.rotation.x = -Math.PI / 2;
  floorIn.renderOrder = 0;
  floorIn.name = 'floor';
  root.add(floorIn);

  // --- exterior: forecourt, access road, main road, neighbours
  const ext = new THREE.Group();
  ext.name = 'exterior';
  reflect.add(ext);
  const asphalt = makeFloorMaterial({
    color: 0x24282e,
    nearAlpha: 0.96,
    farAlpha: 0.78,
    speckle: 0.25,
    pool: [
      [B.x1 + 3.5, 0, 4.6, 1.25], // door spill
      [B.x1 + 12, 9, 5, 0.7], // street lamps
      [B.x1 + 12, -11, 5, 0.7],
      [B.x1 + 26, -2, 6, 0.6],
      [B.x1 + 26, 18, 6, 0.6],
      [B.x1 + 26, -22, 6, 0.6],
      [B.x1 + 26, 38, 6, 0.6],
      [B.x1 + 26, -42, 6, 0.6],
    ],
  });
  // ground with a hole for the building footprint (the epoxy floor covers the inside)
  const gShape = new THREE.Shape();
  gShape.moveTo(-130, -130);
  gShape.lineTo(130, -130);
  gShape.lineTo(130, 130);
  gShape.lineTo(-130, 130);
  gShape.closePath();
  const hole = new THREE.Path();
  hole.moveTo(B.x0, -B.z1);
  hole.lineTo(B.x0, -B.z0);
  hole.lineTo(B.x1, -B.z0);
  hole.lineTo(B.x1, -B.z1);
  hole.closePath();
  gShape.holes.push(hole);
  const ground = new THREE.Mesh(new THREE.ShapeGeometry(gShape), asphalt);
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(0, -0.001, 0);
  ground.renderOrder = 0;
  ground.name = 'ground';
  root.add(ground);
  // grass verges and kerbs read as slightly lighter dark areas
  const verge = new THREE.MeshStandardMaterial({ color: 0x0d120e, roughness: 1 });
  const kerb = new THREE.MeshStandardMaterial({ color: 0x3a3d42, roughness: 0.9 });
  const paintLine = new THREE.MeshStandardMaterial({ color: 0xbfc3c8, roughness: 0.7, emissive: 0x111111 });
  // main road runs along z at x ≈ B.x1 + 26
  const roadX = B.x1 + 26;
  ext.add(box(0.15, 0.12, 200, kerb, roadX - 5.2, 0.06, 0));
  ext.add(box(0.15, 0.12, 200, kerb, roadX + 5.2, 0.06, 0));
  for (let z = -98; z < 98; z += 6) ext.add(box(0.15, 0.01, 3, paintLine, roadX, 0.006, z));
  ext.add(box(14, 0.05, 200, verge, roadX + 12.5, 0.02, 0));
  // access road from the forecourt to the main road
  for (let x = B.x1 + 6; x < roadX - 6; x += 3) ext.add(box(1.6, 0.01, 0.12, paintLine, x, 0.006, 4.2));
  ext.add(box(roadX - 5.3 - (B.x1 + 0.3), 0.04, 6, verge, (roadX - 5.3 + B.x1 + 0.3) / 2, 0.015, 15)); // verge north
  ext.add(box(roadX - 5.3 - (B.x1 + 0.3), 0.04, 6, verge, (roadX - 5.3 + B.x1 + 0.3) / 2, 0.015, -16));
  // parking bays on the forecourt
  for (let i = 0; i < 6; i++) ext.add(box(4.8, 0.01, 0.1, paintLine, B.x1 + 5.4, 0.006, -12.5 + i * 2.6));
  for (let i = 0; i < 6; i++) ext.add(box(4.8, 0.01, 0.1, paintLine, B.x1 + 5.4, 0.006, 7.5 + i * 2.6));
  // bollards with small lights
  const boll = new THREE.MeshStandardMaterial({ color: 0x2a2d32, roughness: 0.5, metalness: 0.6 });
  for (const z of [-4.2, 4.2]) {
    ext.add(box(0.16, 0.9, 0.16, boll, B.x1 + 1.6, 0.45, z));
    ext.add(box(0.17, 0.05, 0.17, ledWarm, B.x1 + 1.6, 0.78, z));
  }
  // street lamps
  const lampMat = new THREE.MeshStandardMaterial({ color: 0x24272c, roughness: 0.5, metalness: 0.6 });
  const lampHead = new THREE.MeshBasicMaterial({ color: new THREE.Color(1, 0.86, 0.66).multiplyScalar(3) });
  const lamps = [
    [B.x1 + 12, 9],
    [B.x1 + 12, -11],
    [roadX - 6, -2],
    [roadX - 6, 18],
    [roadX - 6, -22],
    [roadX - 6, 38],
    [roadX - 6, -42],
  ];
  const glowMat = new THREE.SpriteMaterial({
    map: glowTexture(),
    color: 0xffd9a8,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    opacity: 0.55,
  });
  for (const [x, z] of lamps) {
    ext.add(box(0.12, 6, 0.12, lampMat, x, 3, z));
    ext.add(box(1.4, 0.08, 0.12, lampMat, x + 0.65, 6, z));
    ext.add(box(0.5, 0.05, 0.22, lampHead, x + 1.2, 5.95, z));
    const s = new THREE.Sprite(glowMat);
    s.position.set(x + 1.2, 5.85, z);
    s.scale.setScalar(2.2);
    ext.add(s);
  }
  // neighbouring units: same industrial vocabulary, a few lit windows
  const neighMat = new THREE.MeshStandardMaterial({ color: 0x15171a, roughness: 0.8, metalness: 0.3 });
  const win = new THREE.MeshBasicMaterial({ color: new THREE.Color(1, 0.8, 0.55).multiplyScalar(1.2) });
  const neighbours = [
    [-6, -26, 22, 7, 14],
    [-4, 26, 18, 6, 15],
    [-34, 0, 14, 8, 24],
    [B.x1 + 44, -18, 16, 9, 20],
    [B.x1 + 44, 16, 20, 7, 18],
    [-30, -32, 16, 6, 12],
    [-28, 30, 18, 7, 16],
  ];
  for (const [x, z, w, h, d] of neighbours) {
    ext.add(box(w, h, d, neighMat, x, h / 2, z));
    const n = 2 + Math.floor(r() * 4);
    for (let i = 0; i < n; i++) {
      const fx = x + (r() - 0.5) * (w - 2);
      const fy = 1.2 + r() * (h - 2.5);
      const face = r() < 0.5 ? 1 : -1;
      ext.add(box(1.4, 0.8, 0.04, win, fx, fy, z + face * (d / 2 + 0.03)));
    }
  }
  // trees: dark layered cones along the verges
  const treeMat = new THREE.MeshStandardMaterial({ color: 0x0a110c, roughness: 1 });
  const trunk = new THREE.MeshStandardMaterial({ color: 0x14100c, roughness: 1 });
  const treeGeo = new THREE.ConeGeometry(1.6, 5, 7);
  const trunkGeo = new THREE.CylinderGeometry(0.12, 0.15, 1.6, 6);
  for (let i = 0; i < 26; i++) {
    const zz = -60 + i * 4.6 + r() * 2;
    if (Math.abs(zz) < 6) continue;
    const x = roadX + 9 + r() * 6;
    const t0 = new THREE.Mesh(treeGeo, treeMat);
    t0.position.set(x, 3.4, zz);
    t0.scale.setScalar(0.7 + r() * 0.6);
    ext.add(t0);
    const tr = new THREE.Mesh(trunkGeo, trunk);
    tr.position.set(x, 0.8, zz);
    ext.add(tr);
  }
  for (let i = 0; i < 8; i++) {
    const t0 = new THREE.Mesh(treeGeo, treeMat);
    t0.position.set(B.x0 - 4 - r() * 8, 3.2, -14 + i * 4);
    t0.scale.setScalar(0.8 + r() * 0.5);
    ext.add(t0);
  }

  // --- traffic on the main road: light pairs gliding both ways
  const traffic = [];
  const head = new THREE.MeshBasicMaterial({ color: new THREE.Color(1, 0.95, 0.85).multiplyScalar(4) });
  const tailM = new THREE.MeshBasicMaterial({ color: new THREE.Color(1, 0.08, 0.05).multiplyScalar(3) });
  const carBody = new THREE.MeshStandardMaterial({ color: 0x1a1c20, roughness: 0.4, metalness: 0.6 });
  for (let i = 0; i < 8; i++) {
    const dir = i % 2 ? 1 : -1;
    const g = new THREE.Group();
    g.add(box(4.2, 1.2, 1.8, carBody, 0, 0.75, 0));
    g.add(box(2.2, 0.5, 1.6, carBody, -0.3, 1.5, 0));
    g.add(box(0.05, 0.12, 0.3, head, 2.11, 0.75, 0.6));
    g.add(box(0.05, 0.12, 0.3, head, 2.11, 0.75, -0.6));
    g.add(box(0.05, 0.1, 0.35, tailM, -2.11, 0.85, 0.6));
    g.add(box(0.05, 0.1, 0.35, tailM, -2.11, 0.85, -0.6));
    g.rotation.y = dir > 0 ? -Math.PI / 2 : Math.PI / 2;
    g.userData = { dir, lane: roadX + (dir > 0 ? 2 : -2), offset: i * 27 + r() * 10, speed: 10 + r() * 4 };
    ext.add(g);
    traffic.push(g);
  }

  // --- night sky with stars (echo of the starlight headliner)
  const skyGeo = new THREE.SphereGeometry(400, 32, 16);
  const skyMat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    uniforms: {},
    vertexShader: `varying vec3 vDir; void main(){ vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
    fragmentShader: `varying vec3 vDir;
      float hash(vec3 p){ return fract(sin(dot(p, vec3(12.9898,78.233,37.719))) * 43758.5453); }
      void main(){
        float h = clamp(vDir.y, 0.0, 1.0);
        vec3 col = mix(vec3(0.045,0.055,0.085), vec3(0.008,0.01,0.02), pow(h, 0.6));
        vec3 q = floor(vDir * 380.0);
        float s = hash(q);
        float star = step(0.9965, s) * smoothstep(0.02, 0.25, h) * (0.4 + 0.6 * hash(q + 3.1));
        col += vec3(star);
        gl_FragColor = vec4(col, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
  const skyMesh = new THREE.Mesh(skyGeo, skyMat);
  skyMesh.name = 'sky';
  skyMesh.renderOrder = -1;
  root.add(skyMesh);

  return {
    root,
    reflect,
    hex,
    traffic,
    update(time) {
      for (const g of traffic) {
        const { dir, lane, offset, speed } = g.userData;
        const span = 220;
        const z = ((((offset + time * speed) % span) + span) % span) - span / 2;
        g.position.set(lane, 0, z * dir);
      }
    },
  };
}

// ---------------------------------------------------------------- environment for reflections
export function buildEnvironment(renderer) {
  const env = new THREE.Scene();
  const B = BLD;
  const room = new THREE.Mesh(
    new THREE.BoxGeometry(B.x1 - B.x0, B.h, B.z1 - B.z0),
    new THREE.MeshBasicMaterial({ color: 0x1a1c20, side: THREE.BackSide })
  );
  room.position.set(0, B.h / 2, 0);
  env.add(room);
  // floor slightly lighter so lower body panels pick up a gradient
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(B.x1 - B.x0, B.z1 - B.z0), new THREE.MeshBasicMaterial({ color: 0x24272c }));
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = 0.01;
  env.add(floor);
  const hex = hexLights({ y: 4.35, w: 9.2, d: 6.4, r: 0.62, intensity: 9 });
  env.add(hex);
  // soft side panels: long horizontal softboxes give the body sides a clean highlight line
  const soft = new THREE.MeshBasicMaterial({ color: new THREE.Color(1, 1, 1).multiplyScalar(2.2) });
  for (const z of [B.z0 + 0.05, B.z1 - 0.05]) env.add(box(L(B) - 1, 0.25, 0.05, soft, 0, 2.6, z));
  for (let i = -5; i <= 5; i++) env.add(box(0.05, 3.6, 0.06, soft, B.x0 + 0.06, 2.2, i * 1.1));
  // the open door: dark night outside with a warm portal frame
  env.add(box(0.1, B.doorH, B.doorZ1 - B.doorZ0, new THREE.MeshBasicMaterial({ color: 0x05070c }), B.x1 - 0.02, B.doorH / 2, 0));
  const warm = new THREE.MeshBasicMaterial({ color: new THREE.Color(1, 0.62, 0.25).multiplyScalar(3) });
  env.add(box(0.1, 0.06, B.doorZ1 - B.doorZ0, warm, B.x1 - 0.05, B.doorH, 0));
  // big overhead diffuser above the car for broad top reflections
  env.add(box(5.5, 0.05, 2.4, new THREE.MeshBasicMaterial({ color: new THREE.Color(1, 1, 1).multiplyScalar(0.9) }), 0, 4.6, 0));
  const pmrem = new THREE.PMREMGenerator(renderer);
  const rt = pmrem.fromScene(env, 0.0, 0.1, 60, { size: 512, position: new THREE.Vector3(0, 0.9, 0) });
  pmrem.dispose();
  return rt.texture;
}
function L(B) {
  return B.x1 - B.x0;
}
