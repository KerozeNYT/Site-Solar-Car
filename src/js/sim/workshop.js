import * as THREE from 'three';

/**
 * The window-tint workshop of the configurator: a bright, daytime fitting bay (grey epoxy floor
 * with a marked work zone, linear LED fixtures, sectional door with daylight, film-roll rack,
 * cutting table, tool wall). Everything is procedural; `reflect` is mirrored in the floor.
 * The car sits at the origin, nose towards +x.
 */
export const ROOM = { x0: -8, x1: 8, z0: -6.5, z1: 6.5, h: 4.8 };

const box = (w, h, d, mat, x, y, z) => {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, y, z);
  return m;
};
const std = (color, roughness = 0.7, metalness = 0, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness, metalness, ...extra });
const glow = (r, g, b, k = 1) => new THREE.MeshBasicMaterial({ color: new THREE.Color(r, g, b).multiplyScalar(k) });

function canvasTexture(w, h, draw, { repeat = [1, 1], srgb = true } = {}) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(...repeat);
  t.anisotropy = 4;
  return t;
}

// insulated wall panels: light grey, a seam every metre, faint streaks
function panelTexture(len) {
  return canvasTexture(
    512,
    256,
    (g, w, h) => {
      g.fillStyle = '#c3c6ca';
      g.fillRect(0, 0, w, h);
      for (let i = 0; i < 900; i++) {
        g.fillStyle = `rgba(${Math.random() < 0.5 ? '255,255,255' : '90,95,100'},${Math.random() * 0.05})`;
        g.fillRect(Math.random() * w, 0, 1 + Math.random() * 3, h);
      }
      for (let x = 0; x <= w; x += 128) {
        g.fillStyle = 'rgba(60,64,70,0.55)';
        g.fillRect(x - 1, 0, 2, h);
        g.fillStyle = 'rgba(255,255,255,0.5)';
        g.fillRect(x + 1, 0, 1, h);
      }
    },
    { repeat: [len / 4, 1] }
  );
}

// sectional door: horizontal panels with a pressed rib
function doorTexture() {
  return canvasTexture(512, 512, (g, w, h) => {
    g.fillStyle = '#e4e6e8';
    g.fillRect(0, 0, w, h);
    const n = 6;
    for (let i = 0; i < n; i++) {
      const y = (i / n) * h;
      g.fillStyle = 'rgba(70,75,82,0.7)';
      g.fillRect(0, y, w, 3);
      g.fillStyle = 'rgba(255,255,255,0.8)';
      g.fillRect(0, y + 3, w, 2);
      g.fillStyle = 'rgba(120,125,130,0.25)';
      g.fillRect(0, y + h / n / 2, w, 2);
    }
  });
}

// green self-healing cutting mat with a centimetre grid
function matTexture() {
  return canvasTexture(1024, 512, (g, w, h) => {
    g.fillStyle = '#1f5a3c';
    g.fillRect(0, 0, w, h);
    for (let x = 0; x <= w; x += 16) {
      g.fillStyle = x % 80 === 0 ? 'rgba(220,240,225,0.55)' : 'rgba(220,240,225,0.18)';
      g.fillRect(x, 0, 1, h);
    }
    for (let y = 0; y <= h; y += 16) {
      g.fillStyle = y % 80 === 0 ? 'rgba(220,240,225,0.55)' : 'rgba(220,240,225,0.18)';
      g.fillRect(0, y, w, 1);
    }
    g.strokeStyle = 'rgba(255,214,90,0.6)';
    g.lineWidth = 2;
    g.beginPath();
    g.moveTo(0, h - 40);
    g.lineTo(w, h - 40);
    g.stroke();
  });
}

function pegboardTexture() {
  return canvasTexture(
    256,
    256,
    (g, w, h) => {
      g.fillStyle = '#d7d9dc';
      g.fillRect(0, 0, w, h);
      g.fillStyle = 'rgba(40,44,50,0.75)';
      for (let x = 8; x < w; x += 16) for (let y = 8; y < h; y += 16) g.fillRect(x - 1.5, y - 1.5, 3, 3);
    },
    { repeat: [3, 1.5] }
  );
}

function exitTexture() {
  return canvasTexture(256, 96, (g, w, h) => {
    g.fillStyle = '#0d8a4a';
    g.fillRect(0, 0, w, h);
    g.fillStyle = '#ffffff';
    g.font = 'bold 54px sans-serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText('SORTIE', w / 2, h / 2 + 3);
  });
}

// ---------------------------------------------------------------- floor
// Epoxy floor over the mirrored scene: opaque when looking down, reflective at grazing angles,
// a speckled finish, light pools under the fixtures and the yellow lines of the work bay.
function floorMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: { uColor: { value: new THREE.Color(0x9ea2a8) } },
    vertexShader: /* glsl */ `
      varying vec3 vWorld;
      void main(){
        vec4 w = modelMatrix * vec4(position, 1.0);
        vWorld = w.xyz;
        gl_Position = projectionMatrix * viewMatrix * w;
      }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uColor;
      varying vec3 vWorld;
      float hash(vec2 p){ return fract(sin(dot(p, vec2(41.3, 289.1))) * 43758.5453); }
      float line(float d, float w){ return 1.0 - smoothstep(w * 0.5, w * 0.5 + 0.004, abs(d)); }
      void main(){
        vec2 p = vWorld.xz;
        vec3 V = normalize(cameraPosition - vWorld);
        float fres = pow(1.0 - clamp(V.y, 0.0, 1.0), 2.5);
        // light pools under the LED rows
        float pool = exp(-pow(p.x / 6.5, 2.0)) * (exp(-pow((p.y - 1.4) / 1.4, 2.0)) + exp(-pow((p.y + 1.4) / 1.4, 2.0)));
        float sp = hash(floor(p * 260.0));
        vec3 col = uColor * (0.72 + 0.32 * pool) * (1.0 + (sp - 0.5) * 0.12);
        // painted work bay: yellow border with corner ticks, a darker apron inside
        vec2 q = abs(p) - vec2(3.4, 2.3);
        float inside = step(max(q.x, q.y), 0.0);
        col *= mix(1.0, 0.86, inside);
        float border = line(max(q.x, q.y), 0.08);
        col = mix(col, vec3(0.93, 0.74, 0.12), border * 0.92);
        // hatched no-parking strip in front of the door
        if (p.x > 6.2 && abs(p.y) < 2.4) {
          float h = step(0.5, fract((p.x + p.y) * 2.2));
          col = mix(col, vec3(0.93, 0.74, 0.12), h * 0.85);
        }
        float a = mix(0.93, 0.55, fres);
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

// ---------------------------------------------------------------- building
export function buildWorkshop({ quality = 'high', signTexture = null } = {}) {
  const hi = quality === 'high';
  const R = ROOM;
  const L = R.x1 - R.x0;
  const D = R.z1 - R.z0;
  const root = new THREE.Group();
  root.name = 'workshop';
  const reflect = new THREE.Group();
  root.add(reflect);

  // --- materials
  const wallLowX = std(0xffffff, 0.85, 0, { map: panelTexture(D) });
  const wallLowZ = std(0xffffff, 0.85, 0, { map: panelTexture(L) });
  const wallHigh = std(0xe9e9e7, 0.92);
  const ceiling = std(0x2c2f34, 0.95);
  const steel = std(0x30343a, 0.5, 0.6);
  const dark = std(0x16181c, 0.55, 0.4);
  const chrome = std(0xd0d4d8, 0.18, 1);
  const led = glow(1, 0.98, 0.95, 2.4);
  const daylight = glow(0.86, 0.92, 1.0, 1.7);

  // --- walls: panelled up to 2.6 m, painted above
  const lowH = 2.6;
  const addWall = (w, axis, pos, rotY, lowMat) => {
    const g = new THREE.Group();
    const low = new THREE.Mesh(new THREE.PlaneGeometry(w, lowH), lowMat);
    low.position.y = lowH / 2;
    const high = new THREE.Mesh(new THREE.PlaneGeometry(w, R.h - lowH), wallHigh);
    high.position.y = lowH + (R.h - lowH) / 2;
    const trim = box(w, 0.06, 0.03, dark, 0, lowH, 0.015);
    const skirting = box(w, 0.12, 0.02, dark, 0, 0.06, 0.01);
    g.add(low, high, trim, skirting);
    g.rotation.y = rotY;
    g.position[axis] = pos;
    reflect.add(g);
    return g;
  };
  addWall(D, 'x', R.x0, Math.PI / 2, wallLowX); // back (behind the tail)
  addWall(D, 'x', R.x1, -Math.PI / 2, wallLowX); // front (door side)
  addWall(L, 'z', R.z0, 0, wallLowZ); // driver's side
  addWall(L, 'z', R.z1, Math.PI, wallLowZ); // passenger side

  // --- ceiling, steel beams, linear LED fixtures
  const ceil = new THREE.Mesh(new THREE.PlaneGeometry(L, D), ceiling);
  ceil.rotation.x = Math.PI / 2;
  ceil.position.y = R.h;
  reflect.add(ceil);
  for (let x = R.x0 + 2; x < R.x1; x += 4) reflect.add(box(0.18, 0.32, D, steel, x, R.h - 0.16, 0));
  const fixtureY = R.h - 0.7;
  for (const z of [-3.8, -1.4, 1.4, 3.8]) {
    for (const x of [-4.4, 0, 4.4]) {
      const f = new THREE.Group();
      f.add(box(3.6, 0.07, 0.16, dark, 0, 0.035, 0));
      const diff = new THREE.Mesh(new THREE.PlaneGeometry(3.5, 0.11), led);
      diff.rotation.x = Math.PI / 2;
      diff.position.y = -0.001;
      f.add(diff);
      for (const dx of [-1.6, 1.6]) f.add(box(0.008, R.h - fixtureY - 0.3, 0.008, dark, dx, (R.h - fixtureY - 0.3) / 2 + 0.07, 0));
      f.position.set(x, fixtureY, z);
      reflect.add(f);
    }
  }

  // --- front wall: sectional door with a row of windows, pedestrian door, exit sign
  {
    const g = new THREE.Group();
    const dw = 4.4;
    const dh = 3.7;
    const door = new THREE.Mesh(new THREE.PlaneGeometry(dw, dh), std(0xffffff, 0.45, 0.25, { map: doorTexture() }));
    door.position.set(0, dh / 2, 0.02);
    g.add(door);
    // window row in the 5th panel
    for (let i = 0; i < 6; i++) {
      const wx = -dw / 2 + 0.37 + i * ((dw - 0.74) / 5);
      g.add(box(0.56, 0.32, 0.02, dark, wx, dh * 0.75, 0.025));
      const pane = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.26), daylight);
      pane.position.set(wx, dh * 0.75, 0.04);
      g.add(pane);
    }
    // frame, tracks and the drum box
    g.add(box(0.14, dh + 0.1, 0.12, dark, -dw / 2 - 0.07, dh / 2, 0.06), box(0.14, dh + 0.1, 0.12, dark, dw / 2 + 0.07, dh / 2, 0.06));
    g.add(box(dw + 0.4, 0.38, 0.3, std(0xd8dadc, 0.6), 0, dh + 0.3, 0.15));
    // pedestrian door
    const pd = new THREE.Group();
    pd.add(box(1.0, 2.15, 0.05, std(0xdfe1e3, 0.5, 0.1), 0, 1.075, 0.03));
    pd.add(box(1.1, 2.22, 0.03, dark, 0, 1.11, 0.01));
    const pw = new THREE.Mesh(new THREE.PlaneGeometry(0.38, 0.6), daylight);
    pw.position.set(0, 1.55, 0.06);
    pd.add(pw);
    pd.add(box(0.14, 0.03, 0.04, chrome, -0.36, 1.05, 0.08));
    const exit = new THREE.Mesh(new THREE.PlaneGeometry(0.42, 0.16), new THREE.MeshBasicMaterial({ map: exitTexture(), toneMapped: false }));
    exit.position.set(0, 2.45, 0.04);
    pd.add(exit);
    pd.position.x = 4.2;
    g.add(pd);
    g.rotation.y = -Math.PI / 2;
    g.position.x = R.x1 - 0.01;
    reflect.add(g);
  }

  // --- passenger-side wall: the official sign, film-roll rack and cutting table
  {
    const g = new THREE.Group();
    if (signTexture) {
      const tex = new THREE.TextureLoader().load(signTexture);
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.anisotropy = 4;
      const w = 4.2;
      const h = w * (640 / 2048);
      g.add(box(w + 0.08, h + 0.08, 0.06, dark, 0, 3.55, 0.03));
      const panel = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: tex, color: new THREE.Color(1.1, 1.1, 1.1), toneMapped: false }));
      panel.position.set(0, 3.55, 0.065);
      g.add(panel);
    }
    // rack: two bays of rolls on rods (1.52 m film rolls in smoked shades)
    const shades = [0x08090b, 0x111317, 0x1b1e23, 0x272b31, 0x353a41, 0x4a5058];
    const rollMats = shades.map((c) => std(c, 0.28, 0.35));
    const core = std(0xd8d0bd, 0.8);
    for (const bx of [-0.9, 0.9]) {
      g.add(box(0.05, 2.5, 0.42, steel, bx - 0.82, 1.25, 0.25), box(0.05, 2.5, 0.42, steel, bx + 0.82, 1.25, 0.25));
      for (let row = 0; row < 6; row++) {
        const y = 0.55 + row * 0.36;
        g.add(box(1.7, 0.02, 0.02, chrome, bx, y - 0.075, 0.25));
        const r = 0.055 + ((row * 7 + (bx > 0 ? 3 : 0)) % 4) * 0.012;
        const roll = new THREE.Mesh(new THREE.CylinderGeometry(r, r, 1.52, hi ? 28 : 16), rollMats[(row + (bx > 0 ? 2 : 0)) % rollMats.length]);
        roll.rotation.z = Math.PI / 2;
        roll.position.set(bx, y, 0.25);
        g.add(roll);
        for (const s of [-1, 1]) {
          const c = new THREE.Mesh(new THREE.CylinderGeometry(0.038, 0.038, 0.02, 12), core);
          c.rotation.z = Math.PI / 2;
          c.position.set(bx + s * 0.77, y, 0.25);
          g.add(c);
        }
      }
    }
    // cutting table with a green mat, a roll on its dispenser and a cut sheet of film
    const table = new THREE.Group();
    table.add(box(2.6, 0.05, 1.3, std(0xeceeef, 0.5), 0, 0.92, 0));
    const mat = new THREE.Mesh(new THREE.PlaneGeometry(2.5, 1.2), std(0xffffff, 0.85, 0, { map: matTexture() }));
    mat.rotation.x = -Math.PI / 2;
    mat.position.y = 0.946;
    table.add(mat);
    for (const [x, z] of [
      [-1.22, -0.58],
      [1.22, -0.58],
      [-1.22, 0.58],
      [1.22, 0.58],
    ])
      table.add(box(0.06, 0.9, 0.06, steel, x, 0.45, z));
    table.add(box(2.5, 0.03, 1.2, steel, 0, 0.2, 0));
    const roll = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.075, 1.52, hi ? 28 : 16), rollMats[1]);
    roll.rotation.x = Math.PI / 2;
    roll.position.set(-1.12, 1.06, 0);
    table.add(roll);
    const sheet = new THREE.Mesh(new THREE.PlaneGeometry(1.25, 0.8), new THREE.MeshPhysicalMaterial({ color: 0x0b0d10, roughness: 0.08, transparent: true, opacity: 0.82 }));
    sheet.rotation.x = -Math.PI / 2;
    sheet.rotation.z = 0.08;
    sheet.position.set(-0.25, 0.949, 0.05);
    table.add(sheet);
    table.add(box(0.3, 0.012, 0.05, std(0x2f6fd6, 0.5), 0.55, 0.952, -0.3)); // squeegee
    table.add(box(0.24, 0.012, 0.03, chrome, 0.75, 0.952, 0.2)); // cutter
    table.rotation.y = Math.PI;
    table.position.set(0, 0, -1.3);
    g.add(table);
    // fire extinguisher by the corner
    const ext = new THREE.Group();
    ext.add(new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.5, 16), std(0xc0141c, 0.35, 0.2)));
    ext.children[0].position.y = 1.0;
    ext.add(box(0.06, 0.08, 0.06, dark, 0, 1.29, 0));
    ext.position.set(4.6, 0, 0.12);
    g.add(ext);
    g.rotation.y = Math.PI;
    g.position.z = R.z1 - 0.01;
    g.position.x = -0.6;
    reflect.add(g);
  }

  // --- back wall: tool chest, pegboard with squeegees and heat guns, product shelves
  {
    const g = new THREE.Group();
    const red = std(0xb3141c, 0.32, 0.45);
    const chest = new THREE.Group();
    chest.add(box(1.5, 0.95, 0.55, red, 0, 0.6, 0));
    for (let i = 0; i < 5; i++) {
      chest.add(box(1.42, 0.005, 0.01, dark, 0, 0.25 + i * 0.17, 0.28));
      chest.add(box(1.1, 0.02, 0.02, chrome, 0, 0.33 + i * 0.17, 0.29));
    }
    chest.add(box(1.5, 0.04, 0.56, dark, 0, 1.095, 0));
    chest.add(box(1.45, 0.55, 0.45, red, 0, 1.4, -0.03));
    for (const [x, z] of [
      [-0.65, -0.2],
      [0.65, -0.2],
      [-0.65, 0.2],
      [0.65, 0.2],
    ]) {
      const w = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.04, 14), dark);
      w.rotation.x = Math.PI / 2;
      w.position.set(x, 0.07, z);
      chest.add(w);
    }
    chest.position.set(-1.6, 0, 0.3);
    g.add(chest);
    // pegboard and tools
    const peg = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 1.3), std(0xffffff, 0.8, 0, { map: pegboardTexture() }));
    peg.position.set(1.3, 1.85, 0.02);
    g.add(peg);
    const toolCols = [0x2f6fd6, 0xf2b705, 0xd9262e, 0x1d1f23, 0x2f6fd6, 0xf2b705];
    toolCols.forEach((c, i) => {
      const t = box(0.14, 0.09, 0.012, std(c, 0.5), 0.35 + i * 0.22, 2.25, 0.04);
      g.add(t);
    });
    for (const x of [0.6, 1.2]) {
      const gun = new THREE.Group();
      gun.add(box(0.24, 0.08, 0.07, std(0xe8590c, 0.45), 0, 0, 0));
      gun.add(box(0.06, 0.16, 0.06, dark, 0.05, -0.1, 0));
      gun.position.set(x + 0.9, 1.6, 0.06);
      g.add(gun);
    }
    for (let i = 0; i < 4; i++) g.add(box(0.03, 0.5, 0.03, dark, 0.3 + i * 0.1, 1.55, 0.05)); // knives / scrapers
    // shelves with product bottles and boxes
    const shelf = std(0x2a2e34, 0.6, 0.4);
    const bottles = [0xff9a3c, 0xe9edf2, 0x2a6fd6, 0x1d1f23].map((c) => std(c, 0.35));
    for (const y of [0.9, 1.5, 2.1]) {
      g.add(box(1.8, 0.04, 0.4, shelf, 4.0, y, 0.22));
      for (let i = 0; i < 9; i++) {
        const b = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.05, 0.24, 12), bottles[(i + Math.round(y * 3)) % 4]);
        b.position.set(3.25 + i * 0.18, y + 0.14, 0.22 + ((i % 2) - 0.5) * 0.12);
        g.add(b);
      }
    }
    for (const x of [3.1, 4.9]) g.add(box(0.04, 2.2, 0.4, shelf, x, 1.1, 0.22));
    g.rotation.y = Math.PI / 2;
    g.position.x = R.x0 + 0.01;
    reflect.add(g);
  }

  // --- driver's-side wall: high window band, workbench, wheeled light stand
  {
    const g = new THREE.Group();
    for (let i = 0; i < 7; i++) {
      const x = -6 + i * 2;
      g.add(box(1.78, 0.9, 0.04, dark, x, 3.55, 0.02));
      const pane = new THREE.Mesh(new THREE.PlaneGeometry(1.7, 0.82), daylight);
      pane.position.set(x, 3.55, 0.045);
      g.add(pane);
    }
    const bench = new THREE.Group();
    bench.add(box(2.4, 0.06, 0.75, std(0x9a7650, 0.7), 0, 0.92, 0));
    bench.add(box(2.3, 0.7, 0.7, std(0x3a3f46, 0.5, 0.3), 0, 0.5, -0.02));
    for (let i = 0; i < 3; i++) bench.add(box(0.7, 0.008, 0.01, dark, -0.75 + i * 0.75, 0.6, 0.34));
    const boxRoll = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 1.0, 20), std(0x14161a, 0.3, 0.35));
    boxRoll.rotation.z = Math.PI / 2;
    boxRoll.position.set(-0.3, 1.01, 0.1);
    bench.add(boxRoll);
    bench.add(box(0.3, 0.2, 0.2, std(0xe9edf2, 0.4), 0.8, 1.05, 0));
    bench.position.set(-3.2, 0, 0.42);
    g.add(bench);
    g.position.z = R.z0 + 0.01;
    reflect.add(g);
  }

  // inspection light on a wheeled stand by the car
  {
    const s = new THREE.Group();
    s.add(box(0.04, 1.7, 0.04, dark, 0, 0.85, 0));
    s.add(box(0.7, 0.03, 0.04, dark, 0, 0.04, 0), box(0.04, 0.03, 0.7, dark, 0, 0.04, 0));
    s.add(box(0.08, 1.0, 0.14, dark, 0, 1.95, 0));
    const strip = new THREE.Mesh(new THREE.PlaneGeometry(0.04, 0.94), led);
    strip.position.set(0, 1.95, 0.071);
    s.add(strip);
    s.position.set(-3.9, 0, 3.0);
    s.rotation.y = -2.4;
    reflect.add(s);
  }

  // --- floor (not mirrored)
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(L, D), floorMaterial());
  floor.rotation.x = -Math.PI / 2;
  floor.name = 'floor';
  root.add(floor);

  return { root, reflect, floor };
}

/** Reflections for the car: bright walls, LED rows, daylight from the door and windows. */
export function workshopEnvironment(renderer, quality = 'high') {
  const R = ROOM;
  const env = new THREE.Scene();
  const room = new THREE.Mesh(new THREE.BoxGeometry(R.x1 - R.x0, R.h, R.z1 - R.z0), new THREE.MeshBasicMaterial({ color: 0x8d9095, side: THREE.BackSide }));
  room.position.y = R.h / 2;
  env.add(room);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(R.x1 - R.x0, R.z1 - R.z0), new THREE.MeshBasicMaterial({ color: 0x5f6368 }));
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = 0.01;
  env.add(floor);
  const ceil = new THREE.Mesh(new THREE.PlaneGeometry(R.x1 - R.x0, R.z1 - R.z0), new THREE.MeshBasicMaterial({ color: 0x2c2f34 }));
  ceil.rotation.x = Math.PI / 2;
  ceil.position.y = R.h - 0.01;
  env.add(ceil);
  const led = new THREE.MeshBasicMaterial({ color: new THREE.Color(1, 1, 1).multiplyScalar(9) });
  for (const z of [-3.8, -1.4, 1.4, 3.8]) for (const x of [-4.4, 0, 4.4]) env.add(box(3.5, 0.04, 0.16, led, x, R.h - 0.7, z));
  const day = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.86, 0.92, 1).multiplyScalar(3.2) });
  env.add(box(0.05, 0.3, 3.6, day, R.x1 - 0.05, 2.8, 0)); // door windows
  env.add(box(13.5, 0.85, 0.05, day, 0, 3.55, R.z0 + 0.05)); // window band
  // pale upper walls give the roofline a soft highlight
  const pale = new THREE.MeshBasicMaterial({ color: 0xd8d8d6 });
  env.add(box(R.x1 - R.x0 - 0.2, 2.2, 0.05, pale, 0, 3.7, R.z1 - 0.05));
  env.add(box(0.05, 2.2, R.z1 - R.z0 - 0.2, pale, R.x0 + 0.05, 3.7, 0));
  const pmrem = new THREE.PMREMGenerator(renderer);
  const rt = pmrem.fromScene(env, 0.0, 0.1, 60, { size: quality === 'high' ? 512 : 256, position: new THREE.Vector3(0, 1.0, 0) });
  pmrem.dispose();
  return rt.texture;
}
