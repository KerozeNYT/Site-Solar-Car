import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import {
  makeGlass,
  makeLens,
  makeStarMaterial,
  makeGlow,
  injectPolish,
  vltToOpacity,
} from './materials.js';
import { rng, clamp } from './math.js';

/*
 * Loads a real car model (.glb) and exposes the same "service" API as the procedural car:
 * window film, smoked tail lights, paint polishing, starlight headliner, headlight renovation,
 * opening doors. Everything is driven by content/car.js so another model can be dropped in.
 *
 * Scene convention: +x = nose, +y = up, +z = the car's right-hand side, wheels on y = 0.
 */

const YAW = { '+z': Math.PI / 2, '-z': -Math.PI / 2, '+x': 0, '-x': Math.PI };

export async function loadCarModel(cfg, { quality = 'high', onProgress } = {}) {
  const loader = new GLTFLoader();
  loader.setMeshoptDecoder(MeshoptDecoder);
  const gltf = await loader.loadAsync(cfg.model, onProgress);
  const model = gltf.scene;

  const group = new THREE.Group();
  group.name = 'car';
  const holder = new THREE.Group();
  holder.name = 'carHolder';
  holder.add(model);
  group.add(holder);
  holder.rotation.y = YAW[cfg.forward] ?? 0;
  group.updateMatrixWorld(true);
  // precise bounds: rotated wheel nodes would inflate a box built from local AABBs
  const box = new THREE.Box3().setFromObject(holder, true);
  if (cfg.length) holder.scale.setScalar(cfg.length / (box.max.x - box.min.x));
  group.updateMatrixWorld(true);
  box.setFromObject(holder, true);
  holder.position.set(-(box.min.x + box.max.x) / 2, -box.min.y, -(box.min.z + box.max.z) / 2);
  group.updateMatrixWorld(true);
  box.setFromObject(holder, true);

  // ------------------------------------------------------------ part lookup
  const matNames = (o) => (Array.isArray(o.material) ? o.material : [o.material]).map((m) => m && m.name);
  // GLTFLoader turns spaces in node names into underscores; compare both spellings
  const norm = (n) => String(n || '').replace(/\s+/g, '_');
  const find = (list = []) => {
    const out = [];
    if (!list.length) return out;
    const names = list.map(norm);
    model.traverse((o) => {
      if (!o.isMesh) return;
      const hit =
        names.includes(norm(o.name)) ||
        (o.parent && names.includes(norm(o.parent.name)) && !o.parent.isScene && o.parent.children.length <= 4 && !o.parent.isMesh) ||
        matNames(o).some((n) => names.includes(norm(n)));
      if (hit) out.push(o);
    });
    return out;
  };
  const P = cfg.parts || {};
  for (const o of find(P.hide)) o.visible = false;
  // per-mesh material fixes (cloned so shared materials are not affected)
  for (const [name, o] of Object.entries(cfg.overrides || {})) {
    for (const mesh of find([name])) {
      const m = (Array.isArray(mesh.material) ? mesh.material[0] : mesh.material).clone();
      if (o.color) m.color.set(o.color);
      for (const k of ['metalness', 'roughness', 'opacity', 'clearcoat', 'clearcoatRoughness']) if (o[k] !== undefined) m[k] = o[k];
      if (o.transparent !== undefined) m.transparent = o.transparent;
      mesh.material = m;
    }
  }

  // every mesh casts nothing (no shadow maps), keeps frustum culling
  model.traverse((o) => {
    if (o.isMesh) {
      o.castShadow = o.receiveShadow = false;
      const mats = Array.isArray(o.material) ? o.material : [o.material];
      for (const m of mats) if (m && m.envMapIntensity !== undefined) m.envMapIntensity = 1.15;
    }
  });

  // ------------------------------------------------------------ paint + polish
  const carInv = new THREE.Matrix4(); // group is the car frame; it never moves
  const polishU = {
    uPolishX: { value: -10 },
    uPolishDir: { value: 1 },
    uPolishSide: { value: 0.55 },
    uDirt: { value: 0 },
    uFoam: { value: 0 },
    uIron: { value: 0 },
    uCeramic: { value: 0 },
    uBeads: { value: 0 },
    uCarInv: { value: carInv },
  };
  const paintMats = new Set();
  const finish = cfg.paint?.finish || {};
  // glTF paints without physical extensions load as MeshStandardMaterial, which has no
  // clearcoat: upgrade them so the varnish layer (gloss, swirl marks, polish) exists
  const upgraded = new Map();
  const physical = (m) => {
    if (!m || m.isMeshPhysicalMaterial || !finish.clearcoat) return m;
    if (!upgraded.has(m)) {
      const p = new THREE.MeshPhysicalMaterial();
      THREE.MeshStandardMaterial.prototype.copy.call(p, m);
      p.defines = { STANDARD: '', PHYSICAL: '' };
      upgraded.set(m, p);
    }
    return upgraded.get(m);
  };
  for (const o of find([...(cfg.paint?.materials || []), ...(cfg.paint?.accents || [])])) {
    o.material = Array.isArray(o.material) ? o.material.map(physical) : physical(o.material);
    const mats = Array.isArray(o.material) ? o.material : [o.material];
    mats.forEach((m) => m && paintMats.add(m));
  }
  for (const m of paintMats) {
    if (cfg.paint?.color) m.color.set(cfg.paint.color);
    for (const k of ['metalness', 'roughness', 'clearcoat', 'clearcoatRoughness']) if (finish[k] !== undefined && k in m) m[k] = finish[k];
    m.envMapIntensity = 1.3;
    injectPolish(m, polishU);
  }
  if (cfg.interiorAccent) {
    for (const o of find(cfg.interiorAccent.materials)) {
      const mats = Array.isArray(o.material) ? o.material : [o.material];
      mats.forEach((m) => m.color && m.color.set(cfg.interiorAccent.color));
    }
  }

  // ------------------------------------------------------------ glass
  const glass = {
    wind: makeGlass({ opacity: vltToOpacity(0.8) }),
    frontL: makeGlass({ opacity: vltToOpacity(0.75) }),
    frontR: makeGlass({ opacity: vltToOpacity(0.75) }),
    rear: makeGlass({ opacity: vltToOpacity(0.72) }),
  };
  const setMat = (meshes, mat, order = 2) =>
    meshes.forEach((o) => {
      o.material = mat;
      o.renderOrder = order;
    });
  // Front side windows roll down: shifted in car space in the vertex shader and cut below
  // the belt line (only while lowered, so the mirrored copy is unaffected at rest).
  const sc = holder.scale.x;
  const beltY = (cfg.windowBelt ?? 0) * sc + holder.position.y;
  const dropMax = (cfg.windowDrop ?? 0.35) * sc;
  for (const key of ['frontL', 'frontR']) {
    const m = glass[key];
    const u = { uDrop: { value: 0 }, uBelt: { value: beltY }, uCarInv: { value: carInv } };
    m.userData.uniforms = u;
    const prev = m.onBeforeCompile;
    m.onBeforeCompile = (sh, r) => {
      prev(sh, r);
      Object.assign(sh.uniforms, u);
      sh.vertexShader = sh.vertexShader
        .replace('#include <common>', '#include <common>\nuniform float uDrop;\nuniform mat4 uCarInv;\nvarying float vCarY;')
        .replace(
          '#include <project_vertex>',
          `#include <project_vertex>
          vec4 cp = uCarInv * modelMatrix * vec4(transformed, 1.0);
          cp.y -= uDrop;
          vCarY = cp.y;
          mvPosition = viewMatrix * inverse(uCarInv) * cp;
          gl_Position = projectionMatrix * mvPosition;`
        );
      sh.fragmentShader = sh.fragmentShader
        .replace('#include <common>', '#include <common>\nuniform float uDrop;\nuniform float uBelt;\nvarying float vCarY;')
        .replace('#include <clipping_planes_fragment>', '#include <clipping_planes_fragment>\nif (uDrop > 0.001 && vCarY < uBelt) discard;');
    };
    m.customProgramCacheKey = () => 'glass-drop-model';
  }
  setMat(find(P.windshield), glass.wind);
  setMat(find(P.frontWindows?.L), glass.frontL);
  setMat(find(P.frontWindows?.R), glass.frontR);
  setMat(find(P.rearWindows), glass.rear);

  // ------------------------------------------------------------ tail lights (smoked film)
  const tailMeshes = find(P.tailLights);
  const tailMat = new THREE.MeshPhysicalMaterial({
    color: 0x3a0204,
    emissive: 0xff1810,
    emissiveIntensity: 2.2,
    roughness: 0.12,
    clearcoat: 1,
    clearcoatRoughness: 0.03,
  });
  setMat(tailMeshes, tailMat, 0);
  const signalMat = new THREE.MeshPhysicalMaterial({ color: 0x2a1404, emissive: 0xff7a10, emissiveIntensity: 0.0, roughness: 0.15 });
  setMat(find(P.tailSignals), signalMat, 0);
  const housingMeshes = find(P.tailHousing);
  const housingMat = new THREE.MeshPhysicalMaterial({ color: 0x1a0507, roughness: 0.18, clearcoat: 1, clearcoatRoughness: 0.04, emissive: 0x6a0306, emissiveIntensity: 0.35 });
  setMat(housingMeshes, housingMat, 0);
  // brake glow: a row of soft sprites along the light bar
  const tailGlows = [];
  {
    group.updateMatrixWorld(true);
    const tb = new THREE.Box3();
    tailMeshes.forEach((m) => tb.expandByObject(m, true));
    if (!tb.isEmpty()) {
      const n = 7;
      for (let i = 0; i < n; i++) {
        const sp = makeGlow(0xff2a1a, 0.34);
        sp.position.set(tb.min.x - 0.03, (tb.min.y + tb.max.y) / 2, THREE.MathUtils.lerp(tb.min.z + 0.08, tb.max.z - 0.08, i / (n - 1)));
        group.add(sp);
        tailGlows.push(sp);
      }
    }
  }
  const redRed = new THREE.Color(0x3a0204);
  const smokeCol = new THREE.Color(0x060506);
  const housingRed = new THREE.Color(0x1a0507);

  // ------------------------------------------------------------ headlights + renovation lens
  const headMeshes = find(P.headLights);
  const headMat = new THREE.MeshStandardMaterial({ color: 0x0d1013, emissive: 0xd6ecff, emissiveIntensity: 0.6, roughness: 0.25, metalness: 0.6 });
  setMat(headMeshes, headMat, 0);
  const lens = makeLens();
  const glows = [];
  const beams = [];
  const headCenters = [];
  group.updateMatrixWorld(true);
  const toCar = (o) => new THREE.Matrix4().copy(group.matrixWorld).invert().multiply(o.matrixWorld);
  const lensSources = find(P.headLens);
  const sideBoxes = { '-1': new THREE.Box3(), 1: new THREE.Box3() };
  if (lensSources.length) {
    // dedicated lens meshes: front triangles become the renovation lens, the rest keeps its look
    for (const src of lensSources) {
      const g0 = src.geometry.index ? src.geometry.toNonIndexed() : src.geometry.clone();
      if (!g0.attributes.normal) g0.computeVertexNormals();
      const M = toCar(src);
      const pos = g0.attributes.position;
      const front = [];
      const back = [];
      const v = new THREE.Vector3();
      for (let t = 0; t < pos.count; t += 3) {
        let cx = 0;
        for (let k = 0; k < 3; k++) cx += v.fromBufferAttribute(pos, t + k).applyMatrix4(M).x;
        (cx / 3 > 0 ? front : back).push(t);
      }
      const pick = (tris) => {
        const g = new THREE.BufferGeometry();
        for (const [name, attr] of Object.entries(g0.attributes)) {
          const arr = new attr.array.constructor(tris.length * 3 * attr.itemSize);
          tris.forEach((t, i) => arr.set(attr.array.subarray(t * attr.itemSize, (t + 3) * attr.itemSize), i * 3 * attr.itemSize));
          g.setAttribute(name, new THREE.BufferAttribute(arr, attr.itemSize, attr.normalized));
        }
        return g;
      };
      const lg = pick(front);
      // sweep: across each headlight, inner edge (0) to outer edge (1), per side of the car
      const lp = lg.attributes.position;
      const zs = [];
      for (let i = 0; i < lp.count; i++) {
        v.fromBufferAttribute(lp, i).applyMatrix4(M);
        zs.push(v.z);
        sideBoxes[v.z < 0 ? '-1' : 1].expandByPoint(v);
      }
      const sweep = new Float32Array(lp.count);
      for (let i = 0; i < lp.count; i++) {
        const b = sideBoxes[zs[i] < 0 ? '-1' : 1];
        const span = b.max.z - b.min.z || 1;
        sweep[i] = zs[i] < 0 ? (b.max.z - zs[i]) / span : (zs[i] - b.min.z) / span;
      }
      lg.setAttribute('aSweep', new THREE.BufferAttribute(sweep, 1));
      const lm = new THREE.Mesh(lg, lens);
      lm.name = 'hlLens';
      lm.renderOrder = 3;
      lm.position.copy(src.position);
      lm.quaternion.copy(src.quaternion);
      lm.scale.copy(src.scale);
      src.parent.add(lm);
      if (back.length) src.geometry = pick(back);
      else src.visible = false;
    }
  } else {
    for (const h of headMeshes) {
      const b = new THREE.Box3().setFromObject(h, true).applyMatrix4(new THREE.Matrix4().copy(group.matrixWorld).invert());
      const c = b.getCenter(new THREE.Vector3());
      sideBoxes[c.z < 0 ? '-1' : 1].union(b);
    }
  }
  for (const key of ['-1', 1]) {
    const b = sideBoxes[key];
    if (b.isEmpty()) continue;
    const p = b.getCenter(new THREE.Vector3());
    p.x = b.max.x;
    headCenters.push(p);
    for (const dz of [-0.06, 0.06]) {
      const s = makeGlow(0xd8eeff, 0.3);
      s.position.set(p.x + 0.02, p.y, p.z + dz);
      group.add(s);
      glows.push(s);
    }
  }
  const beamMat = new THREE.ShaderMaterial({
    uniforms: { uOn: { value: 0 } },
    vertexShader: /* glsl */ `
      varying float vAlong; varying vec3 vN; varying vec3 vV;
      void main(){
        vAlong = uv.y;
        vec4 mv = modelViewMatrix * vec4(position,1.0);
        vN = normalize(normalMatrix * normal);
        vV = normalize(-mv.xyz);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */ `
      uniform float uOn; varying float vAlong; varying vec3 vN; varying vec3 vV;
      void main(){
        float edge = pow(abs(dot(vN, vV)), 1.6);
        float fall = pow(vAlong, 1.5);
        float a = edge * fall * uOn * 0.14;
        gl_FragColor = vec4(vec3(0.82, 0.92, 1.0) * a, a);
      }`,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
  });
  for (const p of headCenters) {
    const len = 8;
    const cone = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 1.7, len, quality === 'high' ? 32 : 16, 1, true), beamMat);
    cone.geometry.translate(0, -len / 2, 0);
    cone.rotation.z = Math.PI / 2 + 0.05;
    cone.position.copy(p);
    cone.name = 'beam';
    cone.renderOrder = 4;
    group.add(cone);
    beams.push(cone);
  }

  // ------------------------------------------------------------ starlight headliner
  const roofMeshes = find(P.roof);
  let starBox = null;
  if (cfg.starArea) {
    const hm = new THREE.Matrix4().copy(group.matrixWorld).invert().multiply(holder.matrixWorld);
    starBox = new THREE.Box3(new THREE.Vector3(...cfg.starArea.min), new THREE.Vector3(...cfg.starArea.max)).applyMatrix4(hm);
  }
  const ignore = new Set(find(cfg.starIgnore || []));
  // interior surfaces darkened while the starlight is on (headliner reads as night sky)
  const dimMats = [];
  for (const o of find(cfg.cabinDim || [])) {
    const m = (Array.isArray(o.material) ? o.material[0] : o.material).clone();
    o.material = m;
    dimMats.push({ m, base: m.color.clone() });
  }
  const stars = buildStarsByRaycast(model, group, roofMeshes, glass, quality === 'high' ? 1400 : 900, starBox, ignore);
  if (stars) {
    stars.points.geometry.setDrawRange(0, Math.min(1100, stars.count));
    group.add(stars.points);
  }
  const extras = stars ? buildStarExtras(stars) : null;
  if (extras) group.add(extras.group);

  // ------------------------------------------------------------ doors
  const doors = {};
  for (const [side, d] of Object.entries(cfg.doors || {})) {
    const node = model.getObjectByName(d.node) || model.getObjectByName(norm(d.node));
    if (!node) continue;
    doors[side] = {
      node,
      base: node.quaternion.clone(),
      axis: new THREE.Vector3(...d.axis).normalize(),
      angle: THREE.MathUtils.degToRad(d.angle),
    };
  }

  // ------------------------------------------------------------ contact shadow
  addContactShadow(group, box);

  // ------------------------------------------------------------ anchors for the flight path
  const anchors = computeAnchors({ box, find, P, headCenters, roofMeshes, group, starBox });

  const tmpQ = new THREE.Quaternion();
  let headOn = 0;
  let headSmoke = 0;
  const state = { smoke: 0, brake: 0, on: 1 };
  // smoked film: the lens turns glossy black and only lets a share of the light through
  // (80 % film ≈ a fifth); what gets through is a deeper red
  const tailEmit = new THREE.Color(0xff1810);
  const tailEmitSmoked = new THREE.Color(0xb00606);
  function applyTail() {
    const { smoke, brake, on } = state;
    // share of the lamp light that gets through the film (80 % film: a few percent of the
    // position lights, the brake light still clearly visible)
    const pass = Math.pow(1 - Math.min(smoke, 0.98), 1.6);
    tailMat.color.copy(redRed).lerp(smokeCol, Math.min(1, smoke * 1.15));
    tailMat.emissive.copy(tailEmit).lerp(tailEmitSmoked, smoke);
    tailMat.emissiveIntensity = (0.08 + on * 1.52) * pass + brake * 4.5 * (1 - 0.8 * smoke);
    housingMat.color.copy(housingRed).lerp(smokeCol, smoke);
    housingMat.emissiveIntensity = (0.02 + on * 0.33) * pass + brake * 0.8 * (1 - 0.8 * smoke);
    for (const g of tailGlows) g.material.opacity = (on * 0.12 + brake * 0.75) * (1 - 0.6 * smoke);
  }
  applyTail();

  const api = {
    group,
    box,
    anchors,
    animatedNodes: Object.values(doors).map((d) => d.node.name),
    starCapacity: stars ? stars.count : 0,
    materials: { glass, lens, tail: tailMat, beam: beamMat, stars: stars?.points.material },
    setRearVLT(v) {
      glass.rear.opacity = vltToOpacity(v);
    },
    setFrontVLT(v) {
      glass.frontL.opacity = glass.frontR.opacity = vltToOpacity(v);
    },
    setWindowDrop(side, t) {
      const m = glass[side === 'L' ? 'frontL' : 'frontR'];
      m.userData.uniforms.uDrop.value = clamp(t) * dropMax;
    },
    setDoorOpen(side, t) {
      const d = doors[side];
      if (!d) return;
      tmpQ.setFromAxisAngle(d.axis, d.angle * clamp(t));
      d.node.quaternion.copy(d.base).multiply(tmpQ);
    },
    setTailSmoke(v) {
      state.smoke = v;
      applyTail();
    },
    setBrake(v) {
      state.brake = v;
      applyTail();
    },
    /** tail lights (position lamps) on/off, 0..1 */
    setTailOn(v) {
      state.on = v;
      applyTail();
    },
    setPolish(x, dir = 1) {
      polishU.uPolishX.value = x;
      polishU.uPolishDir.value = dir;
    },
    setStars(v) {
      if (stars) stars.points.material.uniforms.uOn.value = v;
      if (extras) extras.cMat.uniforms.uOn.value = v;
      for (const d of dimMats) d.m.color.copy(d.base).multiplyScalar(1 - 0.72 * v);
    },
    /** starlight configurator: count, palette, options */
    setStarlight({ count, twinkle = true, bicolor = false, c1, c2, shooting = false, constellation = null } = {}) {
      if (!stars) return;
      const u = stars.points.material.uniforms;
      if (count) stars.points.geometry.setDrawRange(0, Math.min(count, stars.count));
      u.uTwinkle.value = twinkle ? 1 : 0;
      u.uBi.value = bicolor ? 1 : 0;
      u.uTint.value = c1 ? 1 : 0;
      if (c1) u.uC1.value.set(c1);
      if (c2) u.uC2.value.set(c2);
      if (extras) {
        extras.shooting.visible = shooting;
        extras.setConstellation(constellation);
        extras.cMat.uniforms.uTint.value = c1 ? 1 : 0;
        if (c1) extras.cMat.uniforms.uC1.value.set(c1);
      }
    },
    /** repaint the body panels (null restores the model's own colour) */
    setPaint(color) {
      for (const m of paintMats) {
        if (!m.userData.baseColor) m.userData.baseColor = m.color.clone();
        if (color) m.color.set(color);
        else m.color.copy(m.userData.baseColor);
      }
    },
    setHeadSmoke(v) {
      lens.userData.uniforms.uSmoke.value = v;
      headMat.emissiveIntensity = (0.6 + headOn * 7) * (1 - 0.6 * v);
      headSmoke = v;
    },
    /** detailing stages: 0..1 each */
    setDetailing({ dirt = 0, foam = 0, iron = 0, ceramic = 0, beads = 0, side = 0.55 } = {}) {
      polishU.uBeads.value = beads;
      polishU.uDirt.value = dirt;
      polishU.uFoam.value = foam;
      polishU.uIron.value = iron;
      polishU.uCeramic.value = ceramic;
      polishU.uPolishSide.value = side;
    },
    setHeadlightClear(v) {
      lens.userData.uniforms.uClear.value = v;
    },
    setHeadlights(on) {
      headOn = on;
      headMat.emissiveIntensity = (0.6 + on * 7) * (1 - 0.6 * headSmoke);
      beamMat.uniforms.uOn.value = on;
      for (const g of glows) g.material.opacity = on * 0.85;
    },
    update(time, viewportHeight, fovDeg) {
      if (extras) {
        extras.updateShooting(time);
        const sc = viewportHeight / (2 * Math.tan(THREE.MathUtils.degToRad(fovDeg) / 2));
        extras.cMat.uniforms.uScale.value = sc;
        extras.sMat.uniforms.uScale.value = sc;
        extras.cMat.uniforms.uTime.value = time;
      }
      if (stars) {
        const u = stars.points.material.uniforms;
        u.uTime.value = time;
        u.uScale.value = viewportHeight / (2 * Math.tan(THREE.MathUtils.degToRad(fovDeg) / 2));
      }
    },
  };
  api.setHeadlights(0);
  return api;
}

// ---------------------------------------------------------------- helpers
/**
 * Starlight: rays are cast upwards from inside the cabin across the roof footprint; the first
 * opaque surface hit is the visible ceiling, so the fibre-optic stars sit exactly on it
 * whatever the model's construction.
 */
/**
 * Starlight: vertical rays are cast upwards across the roof area; the first surface seen from
 * the cabin is the ceiling, so the fibre-optic stars sit exactly on it whatever the model's
 * construction. Only triangles visible from below are tested (cheap 2D point-in-triangle).
 */
function buildStarsByRaycast(model, group, roofMeshes, glass, count, area = null, ignore = new Set()) {
  group.updateMatrixWorld(true);
  const foot = new THREE.Box3();
  if (area) foot.copy(area);
  else roofMeshes.forEach((m) => foot.expandByObject(m, true));
  if (foot.isEmpty()) return null;
  const inv = new THREE.Matrix4().copy(group.matrixWorld).invert();
  const glassMats = new Set(Object.values(glass));
  // gather candidate triangles in car space
  const tris = []; // [ax, az, ay, bx, bz, by, cx, cz, cy, isGlass]
  const a = new THREE.Vector3();
  const b = new THREE.Vector3();
  const c = new THREE.Vector3();
  const e1 = new THREE.Vector3();
  const e2 = new THREE.Vector3();
  const M = new THREE.Matrix4();
  model.traverse((o) => {
    if (!o.isMesh || !o.visible || ignore.has(o)) return;
    const mat = Array.isArray(o.material) ? o.material[0] : o.material;
    const isGlass = glassMats.has(mat) || (mat && mat.transparent && mat.opacity < 0.9);
    const both = mat && mat.side === THREE.DoubleSide;
    M.multiplyMatrices(inv, o.matrixWorld);
    const flip = M.determinant() < 0;
    const pos = o.geometry.attributes.position;
    const idx = o.geometry.index ? o.geometry.index.array : null;
    const n = idx ? idx.length : pos.count;
    for (let t = 0; t < n; t += 3) {
      a.fromBufferAttribute(pos, idx ? idx[t] : t).applyMatrix4(M);
      b.fromBufferAttribute(pos, idx ? idx[t + 1] : t + 1).applyMatrix4(M);
      c.fromBufferAttribute(pos, idx ? idx[t + 2] : t + 2).applyMatrix4(M);
      const cx = (a.x + b.x + c.x) / 3;
      const cz = (a.z + b.z + c.z) / 3;
      const cy = (a.y + b.y + c.y) / 3;
      if (cx < foot.min.x - 0.1 || cx > foot.max.x + 0.1 || cz < foot.min.z - 0.1 || cz > foot.max.z + 0.1) continue;
      if (cy < foot.min.y || cy > foot.max.y) continue;
      const ny = e1.subVectors(b, a).cross(e2.subVectors(c, a)).normalize().y * (flip ? -1 : 1);
      if (!both && !isGlass && ny > -0.2) continue; // faces up: culled when seen from the seats
      tris.push([a.x, a.z, a.y, b.x, b.z, b.y, c.x, c.z, c.y, isGlass]);
    }
  });
  const hitY = (x, z) => {
    // highest point first found from below (the visible ceiling), or Infinity
    let best = Infinity;
    let glassHit = false;
    for (const t of tris) {
      const [ax, az, ay, bx, bz, by, cx, cz, cy] = t;
      const d = (bz - cz) * (ax - cx) + (cx - bx) * (az - cz);
      if (Math.abs(d) < 1e-12) continue;
      const l1 = ((bz - cz) * (x - cx) + (cx - bx) * (z - cz)) / d;
      const l2 = ((cz - az) * (x - cx) + (ax - cx) * (z - cz)) / d;
      const l3 = 1 - l1 - l2;
      if (l1 < 0 || l2 < 0 || l3 < 0) continue;
      const y = l1 * ay + l2 * by + l3 * cy;
      if (y < best) {
        best = y;
        glassHit = t[9];
      }
    }
    return glassHit ? Infinity : best;
  };
  const r = rng(37);
  const pos = [];
  const size = [];
  const phase = [];
  const seq = [];
  const col = [];
  const colors = [
    [1, 1, 1],
    [0.85, 0.93, 1],
    [1, 0.88, 0.7],
    [0.78, 0.86, 1],
  ];
  for (let tries = 0; tries < count * 3 && pos.length / 3 < count; tries++) {
    const x = THREE.MathUtils.lerp(foot.min.x + 0.03, foot.max.x - 0.03, r());
    const z = THREE.MathUtils.lerp(foot.min.z + 0.04, foot.max.z - 0.04, r());
    const y = hitY(x, z);
    if (!Number.isFinite(y)) continue;
    pos.push(x, y - 0.004, z);
    const big = r() < 0.08;
    size.push(big ? 0.008 + r() * 0.004 : 0.003 + r() * 0.0032);
    phase.push(r());
    seq.push(clamp((foot.max.x - x) / (foot.max.x - foot.min.x || 1)) * 0.8 + r() * 0.2);
    col.push(...colors[Math.floor(r() * colors.length)]);
  }
  if (!pos.length) return null;
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('aSize', new THREE.Float32BufferAttribute(size, 1));
  g.setAttribute('aPhase', new THREE.Float32BufferAttribute(phase, 1));
  g.setAttribute('aSeq', new THREE.Float32BufferAttribute(seq, 1));
  g.setAttribute('aColor', new THREE.Float32BufferAttribute(col, 3));
  const points = new THREE.Points(g, makeStarMaterial());
  points.name = 'stars';
  points.frustumCulled = false;
  points.renderOrder = 5;
  points.userData.candidates = tris.length;
  return { points, count: pos.length / 3, foot, place: (x, z) => hitY(x, z) - 0.004 };
}

// ---------------------------------------------------------------- shooting stars & constellations
const CONSTELLATIONS = {
  // normalised (u along the car, v across) — enough for a recognisable pattern
  'grande-ourse': [[0.12, 0.62], [0.26, 0.55], [0.38, 0.52], [0.5, 0.48], [0.56, 0.3], [0.78, 0.33], [0.8, 0.52]],
  orion: [[0.3, 0.2], [0.7, 0.24], [0.44, 0.48], [0.5, 0.5], [0.56, 0.52], [0.34, 0.8], [0.68, 0.76], [0.5, 0.08]],
  cassiopee: [[0.15, 0.4], [0.32, 0.65], [0.5, 0.42], [0.68, 0.66], [0.85, 0.38]],
  'croix-du-sud': [[0.5, 0.12], [0.5, 0.88], [0.28, 0.46], [0.72, 0.56], [0.6, 0.66]],
};

function buildStarExtras(stars) {
  const { foot, place } = stars;
  const group = new THREE.Group();
  group.name = 'starExtras';
  const at = (u, v) => {
    const x = THREE.MathUtils.lerp(foot.max.x - 0.08, foot.min.x + 0.08, u);
    const z = THREE.MathUtils.lerp(foot.min.z + 0.1, foot.max.z - 0.1, v);
    const y = place(x, z);
    return Number.isFinite(y) ? new THREE.Vector3(x, y, z) : null;
  };
  // constellation: bright fibres placed on the pattern
  const cMat = makeStarMaterial();
  cMat.uniforms.uOn.value = 1;
  cMat.uniforms.uTwinkle.value = 0.3;
  const cGeo = new THREE.BufferGeometry();
  const cPoints = new THREE.Points(cGeo, cMat);
  cPoints.frustumCulled = false;
  cPoints.renderOrder = 6;
  cPoints.visible = false;
  group.add(cPoints);
  function setConstellation(name) {
    const pat = CONSTELLATIONS[name];
    cPoints.visible = !!pat;
    if (!pat) return;
    const pos = [];
    for (const [u, v] of pat) {
      const p = at(u, v);
      if (p) pos.push(p.x, p.y, p.z);
    }
    const n = pos.length / 3;
    cGeo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    cGeo.setAttribute('aSize', new THREE.Float32BufferAttribute(new Array(n).fill(0.016), 1));
    cGeo.setAttribute('aPhase', new THREE.Float32BufferAttribute(Array.from({ length: n }, (_, i) => i / n), 1));
    cGeo.setAttribute('aSeq', new THREE.Float32BufferAttribute(new Array(n).fill(0), 1));
    cGeo.setAttribute('aColor', new THREE.Float32BufferAttribute(new Array(n * 3).fill(1), 3));
  }
  // shooting stars: short trails of points sliding across the headliner
  const TRAIL = 14;
  const N = 2;
  const sGeo = new THREE.BufferGeometry();
  const sPos = new Float32Array(N * TRAIL * 3);
  const sSize = new Float32Array(N * TRAIL);
  const sSeq = new Float32Array(N * TRAIL);
  const sCol = new Float32Array(N * TRAIL * 3).fill(1);
  const sPhase = new Float32Array(N * TRAIL);
  for (let k = 0; k < N * TRAIL; k++) sSize[k] = 0.009 * (1 - (k % TRAIL) / TRAIL) + 0.002;
  sGeo.setAttribute('position', new THREE.BufferAttribute(sPos, 3));
  sGeo.setAttribute('aSize', new THREE.BufferAttribute(sSize, 1));
  sGeo.setAttribute('aPhase', new THREE.BufferAttribute(sPhase, 1));
  sGeo.setAttribute('aSeq', new THREE.BufferAttribute(sSeq, 1));
  sGeo.setAttribute('aColor', new THREE.BufferAttribute(sCol, 3));
  const sMat = makeStarMaterial();
  sMat.uniforms.uTwinkle.value = 0;
  const shooting = new THREE.Points(sGeo, sMat);
  shooting.frustumCulled = false;
  shooting.renderOrder = 7;
  shooting.visible = false;
  group.add(shooting);
  const paths = Array.from({ length: N }, (_, i) => ({ seed: i * 7.13 + 1.7 }));
  function updateShooting(time) {
    if (!shooting.visible) return;
    const period = 3.2;
    for (let i = 0; i < N; i++) {
      const tt = time / period + paths[i].seed;
      const cycle = Math.floor(tt);
      const ph = tt - cycle;
      const r = rng(cycle * 31 + i * 101);
      const u0 = 0.15 + r() * 0.5;
      const v0 = 0.15 + r() * 0.7;
      const ang = r() * Math.PI * 2;
      const len = 0.35 + r() * 0.25;
      const active = ph < 0.35;
      const prog = ph / 0.35;
      for (let k = 0; k < TRAIL; k++) {
        const idx = i * TRAIL + k;
        const back = (k / TRAIL) * 0.22;
        const u = u0 + Math.cos(ang) * len * Math.max(0, prog - back);
        const v = v0 + Math.sin(ang) * len * Math.max(0, prog - back);
        const p = active ? at(THREE.MathUtils.clamp(u, 0, 1), THREE.MathUtils.clamp(v, 0, 1)) : null;
        if (p) sPos.set([p.x, p.y, p.z], idx * 3);
        else sPos.set([0, -10, 0], idx * 3);
        sSeq[idx] = 0;
      }
      const fade = active ? Math.sin(prog * Math.PI) : 0;
      sMat.uniforms.uOn.value = 1;
      sMat.uniforms.uBoost.value = 0.4 + 1.6 * fade;
    }
    sGeo.attributes.position.needsUpdate = true;
  }
  return { group, setConstellation, shooting, updateShooting, cMat, sMat };
}

function addContactShadow(group, box) {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 128;
  const g = c.getContext('2d');
  const grd = g.createRadialGradient(128, 64, 8, 128, 64, 128);
  grd.addColorStop(0, 'rgba(0,0,0,0.95)');
  grd.addColorStop(0.5, 'rgba(0,0,0,0.6)');
  grd.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, 256, 128);
  const tex = new THREE.CanvasTexture(c);
  const L = box.max.x - box.min.x;
  const W = box.max.z - box.min.z;
  const sh = new THREE.Mesh(
    new THREE.PlaneGeometry(L * 1.25, W * 1.3),
    new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, opacity: 0.85 })
  );
  sh.rotation.x = -Math.PI / 2;
  sh.position.y = 0.004;
  sh.renderOrder = 1;
  sh.name = 'shadow';
  group.add(sh);
}

function computeAnchors({ box, find, P, headCenters, roofMeshes, group, starBox }) {
  const bb = (meshes) => {
    const b = new THREE.Box3();
    meshes.forEach((m) => b.expandByObject(m));
    return b;
  };
  const center = (b, fallback) => (b.isEmpty() ? fallback : b.getCenter(new THREE.Vector3()));
  const tail = bb(find(P.tailLights));
  const roof = starBox && !starBox.isEmpty() ? starBox.clone() : bb(roofMeshes);
  const winL = bb(find(P.frontWindows?.L));
  const winR = bb(find(P.frontWindows?.R));
  const wind = bb(find(P.windshield));
  const rear = bb(find(P.rearWindows));
  const L = box.max.x - box.min.x;
  const H = box.max.y - box.min.y;
  return {
    length: L,
    width: box.max.z - box.min.z,
    height: H,
    front: box.max.x,
    rear: box.min.x,
    headL: headCenters.find((p) => p.z < 0) || new THREE.Vector3(box.max.x, H * 0.55, -0.6),
    headR: headCenters.find((p) => p.z > 0) || new THREE.Vector3(box.max.x, H * 0.55, 0.6),
    tail: center(tail, new THREE.Vector3(box.min.x, H * 0.75, 0)),
    roof: center(roof, new THREE.Vector3(0, box.max.y, 0)),
    roofY: roof.isEmpty() ? box.max.y : roof.min.y,
    winL: center(winL, new THREE.Vector3(0, H * 0.85, box.min.z)),
    winR: center(winR, new THREE.Vector3(0, H * 0.85, box.max.z)),
    belt: winL.isEmpty() ? H * 0.75 : winL.min.y,
    windshield: center(wind, new THREE.Vector3(L * 0.15, H * 0.85, 0)),
    rearGlass: center(rear, new THREE.Vector3(-L * 0.25, H * 0.85, 0)),
  };
}
