/**
 * SOLAR CAR side script on the GT3 RS, in place of the factory « GT3 RS » door decal: a slim
 * satin-graphite stripe along the bottom of each door, the « SOLAR CAR » wordmark set in the
 * logo's typeface (Archivo, widest and heaviest cut) at its rear end, and a hairline of the
 * emblem's gold under the letters. Discreet, as a decal the workshop would have laid itself.
 *
 * The artwork is drawn on a canvas, then projected onto the body (DecalGeometry) on both sides:
 * it follows the curve of the doors and sits under the same clearcoat look as the paint.
 *
 * Car space: metres, the car at the origin, nose towards +x, its right-hand side towards +z.
 */
import * as THREE from 'three';
import { DecalGeometry } from 'three/addons/geometries/DecalGeometry.js';

// the decal on the body: length along the car, height, centre (x along the car, y above the
// ground): on the door only, where the factory script was; the wordmark sits at the rear end of
// the stripe, the stripe points forward
export const LIVERY = { length: 1.02, height: 0.12, x: 0.09, y: 0.36 };
const COLORS = { stripe: '#2b2e34', letters: '#2b2e34', gold: '#c9a24a' };
const PX_PER_M = 2000; // texture resolution: 1.02 m -> 2040 px
// the model's own door script (red stripe and « GT3 RS » letters): right door, left door, rear
const FACTORY_SCRIPT = ['Object_78', 'Object_62', 'Object_3'];

/** the font of the logo (Archivo variable: width and weight axes) */
async function loadFont(fontUrl) {
  const face = new FontFace('LiveryArchivo', `url(${fontUrl})`, { weight: '100 900', stretch: '62% 125%' });
  await face.load();
  document.fonts.add(face);
}

/**
 * The artwork on a transparent canvas: the wordmark at the `anchor` end ('left' or 'right'),
 * the stripe running from it to the other end, where it tapers to a point.
 */
function drawArtwork(anchor) {
  const W = Math.round(LIVERY.length * PX_PER_M);
  const H = Math.round(LIVERY.height * PX_PER_M);
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const g = c.getContext('2d');
  // the wordmark, letter-spaced a little like the logo, centred on the decal's height
  const cap = H * 0.62;
  g.font = `900 ${cap}px LiveryArchivo`;
  g.fontStretch = 'expanded';
  g.letterSpacing = `${(cap * 0.04).toFixed(1)}px`;
  g.textBaseline = 'alphabetic';
  const word = 'SOLAR CAR';
  const tw = g.measureText(word).width;
  const margin = W * 0.03;
  const left = anchor === 'left' ? margin : W - margin - tw;
  const base = H / 2 + cap / 2;
  g.fillStyle = COLORS.letters;
  g.fillText(word, left, base);
  // a hairline of gold under the wordmark
  g.fillStyle = COLORS.gold;
  g.fillRect(left, base + cap * 0.14, tw - cap * 0.04, Math.max(2, H * 0.022));
  // the stripe: a slim band through the middle of the letters' height, from a gap after the
  // wordmark to the far end, tapering to a point there
  const sh = H * 0.14;
  const sy = H / 2 - sh / 2;
  const gap = cap * 0.42;
  const [a, b] = anchor === 'left' ? [left + tw + gap, W * 0.985] : [W * 0.015, left - gap];
  const taper = W * 0.12;
  g.fillStyle = COLORS.stripe;
  g.beginPath();
  if (anchor === 'left') {
    g.moveTo(a, sy);
    g.lineTo(b - taper, sy);
    g.lineTo(b, sy + sh / 2);
    g.lineTo(b - taper, sy + sh);
    g.lineTo(a, sy + sh);
  } else {
    g.moveTo(b, sy);
    g.lineTo(a + taper, sy);
    g.lineTo(a, sy + sh / 2);
    g.lineTo(a + taper, sy + sh);
    g.lineTo(b, sy + sh);
  }
  g.closePath();
  g.fill();
  return c;
}

/**
 * Lays the livery on both sides of the car. `meshes`: the body meshes it may land on (the paint
 * panels); `anisotropy`: the renderer's maximum.
 */
export async function addLivery(scene, carGroup, meshes, { fontUrl, anisotropy = 8 } = {}) {
  await loadFont(fontUrl);
  carGroup.updateMatrixWorld(true);
  const ray = new THREE.Raycaster();
  // the factory « GT3 RS » script: its pieces fill cut-outs in the doors and the rear quarters;
  // painted like the body, the doors read smooth again
  const door = meshes.find((m) => m.name === 'Object_77') || meshes[0];
  const paint = door.material;
  for (const name of FACTORY_SCRIPT) {
    const o = carGroup.getObjectByName(name);
    if (!o) continue;
    const pos = o.geometry.attributes.position;
    if (!o.geometry.attributes.carbonMask) o.geometry.setAttribute('carbonMask', new THREE.BufferAttribute(new Float32Array(pos.count), 1));
    o.material = paint;
  }
  const surfaces = [...meshes, ...FACTORY_SCRIPT.map((n) => carGroup.getObjectByName(n)).filter(Boolean)];
  const out = new THREE.Group();
  const made = [];
  for (const side of [1, -1]) {
    // the projector's x axis runs towards the nose on the right-hand side, towards the tail on
    // the left-hand one: the wordmark is drawn at the matching end so it sits at the rear of the
    // stripe on both sides, the stripe pointing forward
    const tex = new THREE.CanvasTexture(drawArtwork(side > 0 ? 'left' : 'right'));
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = anisotropy;
    // where the door surface is: a ray from outside the car, at the decal's centre
    ray.set(new THREE.Vector3(LIVERY.x, LIVERY.y, side * 3), new THREE.Vector3(0, 0, -side));
    const hit = ray.intersectObjects(surfaces, false)[0];
    if (!hit) continue;
    const normal = hit.face.normal.clone().transformDirection(hit.object.matrixWorld);
    // projector facing the door, its x axis along the car and level
    const helper = new THREE.Object3D();
    helper.position.copy(hit.point);
    helper.lookAt(hit.point.clone().add(new THREE.Vector3(0, 0, side)));
    const size = new THREE.Vector3(LIVERY.length, LIVERY.height, 0.35);
    const mat = new THREE.MeshPhysicalMaterial({
      map: tex,
      transparent: true,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -4,
      roughness: 0.42,
      metalness: 0,
      clearcoat: 1,
      clearcoatRoughness: 0.03,
      envMapIntensity: 1.1,
    });
    for (const m of surfaces) {
      const geo = new DecalGeometry(m, hit.point, helper.rotation, size);
      if (!geo.attributes.position.count) continue;
      const d = new THREE.Mesh(geo, mat);
      d.renderOrder = 2;
      out.add(d);
    }
    made.push({ side, point: hit.point.toArray().map((v) => +v.toFixed(3)), normal: normal.toArray().map((v) => +v.toFixed(2)), mesh: hit.object.name });
  }
  scene.add(out);
  return { group: out, made };
}
