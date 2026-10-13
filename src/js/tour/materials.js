import * as THREE from 'three';

/**
 * Materials with scroll-driven "service" effects.
 * Every effect is a plain uniform so the same material instance drives the car
 * and its mirrored reflection in the studio floor.
 */

// ---------------------------------------------------------------- paint (detailing)
// uPolish: boundary along the car length (local x). Fragments on the polished side get a
// mirror clear-coat; the other side looks swirled and oxidised. uPolishDir flips the side.
export function makePaint(color = 0x0c2746) {
  const uniforms = {
    uPolishX: { value: -10 },
    uPolishDir: { value: 1 },
    uPolishSide: { value: 0.5 },
  };
  const m = new THREE.MeshPhysicalMaterial({
    color,
    metalness: 0.55,
    roughness: 0.32,
    clearcoat: 1,
    clearcoatRoughness: 0.025,
    envMapIntensity: 1.25,
  });
  m.userData.uniforms = uniforms;
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, uniforms);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vLocalPos;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvLocalPos = position;');
    sh.fragmentShader = sh.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
        varying vec3 vLocalPos;
        uniform float uPolishX;
        uniform float uPolishDir;
        uniform float uPolishSide;
        float swirlNoise(vec3 p){
          // cheap circular "holograms": concentric rings around a few centres
          float r = length(p.xy - vec2(floor(p.x*2.0)/2.0+0.25, 0.7));
          return 0.5 + 0.5*sin(r*180.0);
        }`
      )
      .replace(
        '#include <metalnessmap_fragment>',
        `#include <metalnessmap_fragment>
        float polished = smoothstep(-0.025, 0.025, (vLocalPos.x - uPolishX) * uPolishDir);
        // only the right-hand flank is "before": the hero side stays showroom-perfect
        float dull = (1.0 - polished) * smoothstep(uPolishSide - 0.06, uPolishSide + 0.06, vLocalPos.z);
        roughnessFactor = mix(roughnessFactor, 0.62, dull);
        metalnessFactor = mix(metalnessFactor, 0.28, dull);
        diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * 1.35 + vec3(0.035, 0.037, 0.04), dull);`
      )
      .replace(
        '#include <clearcoat_normal_fragment_maps>',
        `#include <clearcoat_normal_fragment_maps>
        #ifdef USE_CLEARCOAT
          if (dull > 0.001) {
            // project on the plane facing the panel, tilt along the scratches, back to view space
            vec3 an = abs(vCarNormal);
            vec3 U = an.y > max(an.x, an.z) ? vec3(1.0, 0.0, 0.0) : an.z > an.x ? vec3(1.0, 0.0, 0.0) : vec3(0.0, 0.0, 1.0);
            vec3 V = an.y > max(an.x, an.z) ? vec3(0.0, 0.0, 1.0) : vec3(0.0, 1.0, 0.0);
            vec2 t = swirlTilt(vec2(dot(vCarPos, U), dot(vCarPos, V)));
            vec3 tCar = (U * t.x + V * t.y) * 0.45 * dull;
            vec3 tView = mat3(viewMatrix) * (transpose(mat3(uCarInv)) * tCar);
            clearcoatNormal = normalize(clearcoatNormal + tView);
          }
        #endif`
      )
      .replace(
        '#include <lights_physical_fragment>',
        `#include <lights_physical_fragment>
        #ifdef USE_CLEARCOAT
          float sw = swirlNoise(vLocalPos * vec3(1.0, 1.0, 1.0));
          material.clearcoat = mix(material.clearcoat, 0.45, dull);
          material.clearcoatRoughness = mix(material.clearcoatRoughness, 0.34 + 0.12 * sw, dull);
        #endif`
      );
  };
  m.customProgramCacheKey = () => 'paint-polish';
  return m;
}

/**
 * Same "before / after" polish effect injected into an existing physical material (e.g. a
 * GLB paint). Positions are taken in car space through uCarInv so every mesh agrees.
 */
export function injectPolish(m, uniforms) {
  m.userData.uniforms = uniforms;
  const prev = m.onBeforeCompile;
  m.onBeforeCompile = (sh, r) => {
    if (prev) prev(sh, r);
    Object.assign(sh.uniforms, uniforms);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nuniform mat4 uCarInv;\nvarying vec3 vCarPos;\nvarying vec3 vCarNormal;')
      .replace(
        '#include <project_vertex>',
        '#include <project_vertex>\nvCarPos = (uCarInv * modelMatrix * vec4(transformed, 1.0)).xyz;\nvCarNormal = normalize(mat3(uCarInv) * mat3(modelMatrix) * objectNormal);'
      );
    sh.fragmentShader = sh.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
        uniform mat4 uCarInv;
        varying vec3 vCarPos;
        varying vec3 vCarNormal;
        uniform float uPolishX;
        uniform float uPolishDir;
        uniform float uPolishSide;
        uniform float uDirt;
        uniform float uFoam;
        uniform float uIron;
        uniform float uCeramic;
        uniform float uBeads;
        float h31(vec3 p){ p = fract(p * 0.1031); p += dot(p, p.zyx + 31.32); return fract((p.x + p.y) * p.z); }
        float vnoise(vec3 p){
          vec3 i = floor(p); vec3 f = fract(p); f = f * f * (3.0 - 2.0 * f);
          return mix(mix(mix(h31(i), h31(i + vec3(1,0,0)), f.x), mix(h31(i + vec3(0,1,0)), h31(i + vec3(1,1,0)), f.x), f.y),
                     mix(mix(h31(i + vec3(0,0,1)), h31(i + vec3(1,0,1)), f.x), mix(h31(i + vec3(0,1,1)), h31(i + vec3(1,1,1)), f.x), f.y), f.z);
        }
        // Buffer swirls: broken concentric scratches around random centres, as left by a
        // rotary machine. Returns a small tilt (2D, in the plane of p) for the clearcoat normal;
        // scratches thinner than a pixel fade out instead of shimmering.
        vec2 swirlTilt(vec2 p){
          const float CELL = 0.22;
          vec2 acc = vec2(0.0);
          vec2 cell = floor(p / CELL);
          for (int i = -1; i <= 1; i++) {
            for (int j = -1; j <= 1; j++) {
              vec2 c = cell + vec2(float(i), float(j));
              vec3 h = vec3(h31(vec3(c, 1.7)), h31(vec3(c, 5.3)), h31(vec3(c, 9.1)));
              vec2 d = p - (c + h.xy) * CELL;
              float r = length(d);
              if (r < 0.004 || r > 0.3) continue;
              // one ring every ~1.6 cm: each stands for a bundle of finer scratches, so the
              // marks stay readable at screen scale instead of vanishing below a pixel
              float ring = r * 62.0 + h.z * 13.0;
              float id = floor(ring);
              float keep = step(0.62, h31(vec3(c * 3.1, id)));
              float a = atan(d.y, d.x);
              float arc = smoothstep(0.35, 0.7, sin(a * (1.0 + floor(h.z * 3.0)) + id * 2.3 + h.x * 6.28));
              float line = exp(-pow((fract(ring) - 0.5) / 0.2, 2.0));
              float aa = 1.0 - smoothstep(0.35, 0.9, fwidth(ring));
              acc += (d / r) * keep * arc * line * aa * (1.0 - r / 0.3);
            }
          }
          return acc;
        }`
      )
      .replace(
        '#include <metalnessmap_fragment>',
        `#include <metalnessmap_fragment>
        float polished = smoothstep(-0.025, 0.025, (vCarPos.x - uPolishX) * uPolishDir);
        // before polishing the paint stays glossy but micro-scratched: swirl marks in the
        // clearcoat (see below) and the faint milky veil they cast on a dark colour
        float dull = (1.0 - polished) * smoothstep(uPolishSide - 0.06, uPolishSide + 0.06, vCarPos.z);
        diffuseColor.rgb += vec3(0.016, 0.018, 0.022) * dull;
        // the polishing pass: a warm glint travelling with the boundary
        float sideMask = smoothstep(uPolishSide - 0.06, uPolishSide + 0.06, vCarPos.z);
        float glint = (1.0 - smoothstep(0.0, 0.035, abs(vCarPos.x - uPolishX))) * sideMask * step(abs(uPolishX), 3.0);
        // detailing stages: road grime, snow foam, iron fallout. The noise domain is rotated
        // so its blobs never line up with the car's axes.
        vec3 q = mat3(0.80, 0.36, -0.48, -0.60, 0.48, -0.64, 0.0, 0.80, 0.60) * vCarPos;
        float n1 = vnoise(q * 7.0);
        float n2 = vnoise(q * 38.0);
        float fb = n1 * 0.5 + vnoise(q * 15.0) * 0.3 + n2 * 0.2;
        float low = 1.0 - smoothstep(0.2, 1.0, vCarPos.y);
        float grime = uDirt * clamp(0.3 + 0.8 * low + (n1 - 0.5) * 0.9, 0.0, 1.0);
        diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.30, 0.27, 0.21), grime * 0.8);
        roughnessFactor = mix(roughnessFactor, 0.92, grime);
        metalnessFactor = mix(metalnessFactor, 0.0, grime);
        // snow foam: a thick, almost continuous blanket with a bubbly texture
        float foam = uFoam * smoothstep(0.26, 0.46, fb + 0.1 * low);
        diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.93, 0.95, 0.97) * (0.8 + 0.2 * vnoise(q * 170.0)), foam);
        roughnessFactor = mix(roughnessFactor, 1.0, foam);
        metalnessFactor = mix(metalnessFactor, 0.0, foam);
        // iron remover turning purple and running down the panels, heavier low on the body
        float runs = vnoise(vec3(vCarPos.x * 34.0, vCarPos.y * 4.0, vCarPos.z * 34.0));
        float iron = uIron * smoothstep(0.5, 0.7, runs * 0.65 + n2 * 0.35) * (0.45 + 0.55 * low);
        diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.40, 0.05, 0.50), iron * 0.88);
        roughnessFactor = mix(roughnessFactor, 0.5, iron);
        float mud = grime + foam;`
      )
      .replace(
        '#include <lights_physical_fragment>',
        `#include <lights_physical_fragment>
        #ifdef USE_CLEARCOAT
          material.clearcoatRoughness = mix(material.clearcoatRoughness, 0.1, dull);
          material.clearcoat *= 1.0 - clamp(mud, 0.0, 1.0);
          material.clearcoatRoughness = mix(material.clearcoatRoughness, 0.0525, uCeramic);
        #endif
        totalEmissiveRadiance += vec3(1.0, 0.72, 0.38) * glint * 0.9;
        // ceramic coating: tight water beads catching the light on upward faces
        vec3 cell = fract(vCarPos * vec3(26.0, 26.0, 26.0)) - 0.5;
        float bead = (1.0 - smoothstep(0.05, 0.12, length(cell.xz))) * step(0.55, h31(floor(vCarPos * 26.0)));
        totalEmissiveRadiance += vec3(0.42) * bead * uBeads * smoothstep(0.4, 0.9, vCarNormal.y);`
      );
  };
  m.customProgramCacheKey = () => 'polish-' + m.name;
  m.needsUpdate = true;
}

// ---------------------------------------------------------------- glass (window film)
// Premultiplied blending: the background is dimmed by opacity (= film darkness) while
// reflections are added on top at full strength, like real glass.
export function makeGlass({ opacity = 0.22, color = 0x0a0e13, side = THREE.DoubleSide } = {}) {
  const m = new THREE.MeshPhysicalMaterial({
    color,
    metalness: 0,
    roughness: 0.03,
    transparent: true,
    opacity,
    side,
    depthWrite: false,
    envMapIntensity: 1.35,
    ior: 1.52,
    specularIntensity: 1,
  });
  m.blending = THREE.CustomBlending;
  m.blendEquation = THREE.AddEquation;
  m.blendSrc = THREE.OneFactor;
  m.blendDst = THREE.OneMinusSrcAlphaFactor;
  m.onBeforeCompile = (sh) => {
    sh.fragmentShader = sh.fragmentShader.replace(
      '#include <opaque_fragment>',
      'gl_FragColor = vec4( totalDiffuse * diffuseColor.a + totalSpecular + totalEmissiveRadiance, diffuseColor.a );'
    );
  };
  m.customProgramCacheKey = () => 'glass-premul';
  return m;
}

/** Visible light transmission (0..1) -> on-screen film darkness. Tuned by eye, not physics. */
export const vltToOpacity = (vlt) => THREE.MathUtils.clamp(1.04 - vlt * 1.2, 0.16, 0.96);

// ---------------------------------------------------------------- headlight lens (renovation)
// uClear 0 = yellowed, oxidised, frosted lens; 1 = crystal clear. The change sweeps across
// the lens along uv.x like a polishing pass.
export function makeLens() {
  // clear by default: the lenses only look aged during the renovation demo
  const uniforms = { uClear: { value: 1 }, uSmoke: { value: 0 } };
  const m = new THREE.MeshPhysicalMaterial({
    color: 0xffffff,
    metalness: 0,
    roughness: 0.03,
    transparent: true,
    opacity: 1,
    depthWrite: false,
    envMapIntensity: 1.8,
  });
  m.blending = THREE.CustomBlending;
  m.blendEquation = THREE.AddEquation;
  m.blendSrc = THREE.OneFactor;
  m.blendDst = THREE.OneMinusSrcAlphaFactor;
  m.userData.uniforms = uniforms;
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, uniforms);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nattribute float aSweep;\nvarying vec2 vLensUv;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvLensUv = vec2(aSweep, fract(position.y * 37.0));');
    sh.fragmentShader = sh.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
        varying vec2 vLensUv;
        uniform float uClear;
        uniform float uSmoke;
        float lhash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }`
      )
      .replace(
        '#include <metalnessmap_fragment>',
        `#include <metalnessmap_fragment>
        // polishing pass sweeps from the inner end (uv.x = 1) to the outer end
        float edge = uClear * 1.3 - 0.15;
        float c = 1.0 - smoothstep(edge - 0.08, edge + 0.08, 1.0 - vLensUv.x);
        float grain = lhash(floor(vLensUv * vec2(260.0, 40.0)));
        float cloud = 0.5 + 0.5 * sin(vLensUv.x * 23.0 + sin(vLensUv.y * 9.0) * 2.0);
        vec3 haze = mix(vec3(0.42, 0.29, 0.07), vec3(0.7, 0.55, 0.22), cloud * 0.7 + grain * 0.3);
        diffuseColor.rgb = mix(haze, vec3(0.02, 0.025, 0.03), c);
        diffuseColor.a = mix(0.62 + 0.2 * cloud, 0.05, c);
        roughnessFactor = mix(0.45 + 0.25 * grain, 0.02, c);
        // smoked film over a clear lens
        diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.012, 0.012, 0.014), uSmoke * c);
        diffuseColor.a = mix(diffuseColor.a, 0.55 + 0.4 * uSmoke, uSmoke * c);`
      )
      .replace(
        '#include <opaque_fragment>',
        'gl_FragColor = vec4( totalDiffuse * diffuseColor.a + totalSpecular + totalEmissiveRadiance, diffuseColor.a );'
      );
  };
  m.customProgramCacheKey = () => 'lens-renovation';
  return m;
}

// ---------------------------------------------------------------- tail light (smoked film)
export function makeTailLens() {
  const uniforms = { uSmoke: { value: 0 }, uBrake: { value: 0 } };
  const m = new THREE.MeshPhysicalMaterial({
    color: 0x5a0306,
    emissive: 0xff1a12,
    emissiveIntensity: 1,
    metalness: 0,
    roughness: 0.08,
    clearcoat: 1,
    clearcoatRoughness: 0.03,
    envMapIntensity: 1.3,
  });
  m.userData.uniforms = uniforms;
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, uniforms);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec2 vTailUv;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvTailUv = uv;');
    sh.fragmentShader = sh.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
        varying vec2 vTailUv;
        uniform float uSmoke;
        uniform float uBrake;`
      )
      .replace(
        '#include <emissivemap_fragment>',
        `#include <emissivemap_fragment>
        float line = smoothstep(0.32, 0.46, vTailUv.y) * (1.0 - smoothstep(0.54, 0.68, vTailUv.y));
        float body = 0.18 + 0.15 * vTailUv.y;
        float ends = smoothstep(0.0, 0.04, vTailUv.x);
        float glow = (line * (1.2 + 5.0 * uBrake) + body * (0.4 + 1.6 * uBrake)) * ends;
        totalEmissiveRadiance *= glow * mix(1.0, 0.32, uSmoke);
        diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.018, 0.016, 0.018), uSmoke);`
      );
  };
  m.customProgramCacheKey = () => 'tail-smoke';
  return m;
}

// ---------------------------------------------------------------- starlight headliner
export function makeStarMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uOn: { value: 0 },
      uScale: { value: 600 },
      uTwinkle: { value: 1 },
      uBi: { value: 0 },
      uC1: { value: new THREE.Color(1, 1, 1) },
      uC2: { value: new THREE.Color(0.55, 0.7, 1) },
      uTint: { value: 0 },
      uBoost: { value: 1 },
      uSize: { value: 1 },
    },
    vertexShader: /* glsl */ `
      attribute float aSize;
      attribute float aPhase;
      attribute float aSeq;
      attribute vec3 aColor;
      uniform float uTime;
      uniform float uOn;
      uniform float uScale;
      uniform float uTwinkle;
      uniform float uBi;
      uniform vec3 uC1;
      uniform vec3 uC2;
      uniform float uTint;
      uniform float uBoost;
      uniform float uSize;
      varying vec3 vColor;
      varying float vAlpha;
      void main(){
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        gl_Position = projectionMatrix * mv;
        float tw = mix(1.0, 0.55 + 0.45 * sin(uTime * (0.8 + aPhase * 1.7) + aPhase * 40.0), uTwinkle);
        // stars light up in sequence across the headliner as uOn rises
        float on = smoothstep(aSeq, aSeq + 0.12, uOn * 1.12);
        vAlpha = on * tw;
        vec3 pal = mix(uC1, uC2, step(0.5, fract(aPhase * 7.31)) * uBi);
        vColor = mix(aColor, pal, uTint) * uBoost;
        gl_PointSize = max(1.5, aSize * uSize * uScale / max(0.05, -mv.z));
      }`,
    fragmentShader: /* glsl */ `
      varying vec3 vColor;
      varying float vAlpha;
      void main(){
        float d = length(gl_PointCoord - 0.5) * 2.0;
        float core = smoothstep(1.0, 0.0, d);
        core = core * core * core;
        gl_FragColor = vec4(vColor * core * vAlpha * 1.6, core * vAlpha);
      }`,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
}

// ---------------------------------------------------------------- additive glow sprite
let glowTex = null;
export function glowTexture() {
  if (glowTex) return glowTex;
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  const grd = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  grd.addColorStop(0, 'rgba(255,255,255,1)');
  grd.addColorStop(0.18, 'rgba(255,255,255,0.55)');
  grd.addColorStop(0.45, 'rgba(255,255,255,0.12)');
  grd.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, 128, 128);
  glowTex = new THREE.CanvasTexture(c);
  glowTex.colorSpace = THREE.SRGBColorSpace;
  return glowTex;
}

export function makeGlow(color = 0xffffff, size = 0.3) {
  const mat = new THREE.SpriteMaterial({
    map: glowTexture(),
    color,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    opacity: 0,
  });
  const s = new THREE.Sprite(mat);
  s.scale.setScalar(size);
  return s;
}

// ---------------------------------------------------------------- common solids
export function makeCommon() {
  return {
    trim: new THREE.MeshPhysicalMaterial({
      color: 0x050607,
      metalness: 0.2,
      roughness: 0.18,
      clearcoat: 1,
      clearcoatRoughness: 0.04,
      envMapIntensity: 1.1,
    }),
    satin: new THREE.MeshStandardMaterial({ color: 0x0b0c0e, metalness: 0.3, roughness: 0.55 }),
    chrome: new THREE.MeshStandardMaterial({ color: 0xb9bec4, metalness: 1, roughness: 0.22 }),
    grille: new THREE.MeshStandardMaterial({ color: 0x07080a, metalness: 0.4, roughness: 0.48 }),
    tire: new THREE.MeshStandardMaterial({ color: 0x111214, metalness: 0, roughness: 0.86 }),
    rim: new THREE.MeshStandardMaterial({ color: 0x2b2f35, metalness: 0.9, roughness: 0.28 }),
    rimFace: new THREE.MeshStandardMaterial({ color: 0x9aa1aa, metalness: 1, roughness: 0.16 }),
    disc: new THREE.MeshStandardMaterial({ color: 0x5b5e63, metalness: 0.95, roughness: 0.45 }),
    caliper: new THREE.MeshPhysicalMaterial({
      color: 0xff8a1f,
      metalness: 0.1,
      roughness: 0.3,
      clearcoat: 1,
      clearcoatRoughness: 0.05,
    }),
    liner: new THREE.MeshStandardMaterial({ color: 0x050505, roughness: 0.95, side: THREE.DoubleSide }),
    interior: new THREE.MeshStandardMaterial({ color: 0x141518, roughness: 0.72, metalness: 0.05, side: THREE.BackSide }),
    headliner: new THREE.MeshStandardMaterial({ color: 0x07080a, roughness: 0.96, side: THREE.BackSide }),
    leather: new THREE.MeshPhysicalMaterial({
      color: 0x1a1b1e,
      roughness: 0.52,
      metalness: 0,
      sheen: 0.4,
      sheenColor: new THREE.Color(0x30333a),
    }),
    stitch: new THREE.MeshStandardMaterial({ color: 0xff9a3c, emissive: 0x3a1a04, roughness: 0.6 }),
    dash: new THREE.MeshStandardMaterial({ color: 0x0f1013, roughness: 0.66, metalness: 0.1 }),
    screen: new THREE.MeshStandardMaterial({ color: 0x050608, emissive: 0x0d2236, emissiveIntensity: 1, roughness: 0.15 }),
    ambient: new THREE.MeshBasicMaterial({ color: 0xff9a3c }),
    housing: new THREE.MeshStandardMaterial({ color: 0x0e1013, metalness: 0.9, roughness: 0.3 }),
    led: new THREE.MeshBasicMaterial({ color: 0xdff2ff }),
    plate: new THREE.MeshStandardMaterial({ color: 0xe9ebee, roughness: 0.4, metalness: 0.1 }),
    plateBlue: new THREE.MeshStandardMaterial({ color: 0x1d3f9a, roughness: 0.45 }),
    carpet: new THREE.MeshStandardMaterial({ color: 0x0c0d0f, roughness: 1 }),
  };
}
