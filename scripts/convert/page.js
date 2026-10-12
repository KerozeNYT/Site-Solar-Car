// Browser side of scripts/convert-usdz.mjs: loads a USD/USDZ with three.js, bakes skinning
// into static meshes and exports a binary glTF.
import * as THREE from 'three';
import { USDLoader } from 'three/addons/loaders/USDLoader.js';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';

function bakeSkinned(root) {
  root.updateMatrixWorld(true);
  const skinned = [];
  root.traverse((o) => o.isSkinnedMesh && skinned.push(o));
  const m = new THREE.Matrix4();
  const acc = new THREE.Matrix4();
  const full = new THREE.Matrix4();
  const nm = new THREE.Matrix3();
  const v = new THREE.Vector3();
  for (const s of skinned) {
    s.skeleton.update();
    const g = s.geometry.clone();
    const pos = g.attributes.position;
    const nrm = g.attributes.normal;
    const si = g.attributes.skinIndex;
    const sw = g.attributes.skinWeight;
    for (let i = 0; i < pos.count; i++) {
      acc.set(0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0);
      for (let k = 0; k < 4; k++) {
        const w = sw.getComponent(i, k);
        if (!w) continue;
        const b = si.getComponent(i, k);
        m.multiplyMatrices(s.skeleton.bones[b].matrixWorld, s.skeleton.boneInverses[b]);
        for (let e = 0; e < 16; e++) acc.elements[e] += m.elements[e] * w;
      }
      full.multiplyMatrices(s.bindMatrixInverse, acc).multiply(s.bindMatrix);
      v.fromBufferAttribute(pos, i).applyMatrix4(full);
      pos.setXYZ(i, v.x, v.y, v.z);
      if (nrm) {
        nm.getNormalMatrix(full);
        v.fromBufferAttribute(nrm, i).applyMatrix3(nm).normalize();
        nrm.setXYZ(i, v.x, v.y, v.z);
      }
    }
    g.deleteAttribute('skinIndex');
    g.deleteAttribute('skinWeight');
    const mesh = new THREE.Mesh(g, s.material);
    mesh.name = s.name;
    mesh.position.copy(s.position);
    mesh.quaternion.copy(s.quaternion);
    mesh.scale.copy(s.scale);
    s.parent.add(mesh);
    s.parent.remove(s);
  }
  // drop bones/empty skeleton nodes left behind
  const bones = [];
  root.traverse((o) => o.isBone && bones.push(o));
  bones.forEach((b) => b.parent && b.children.every((c) => c.isBone) && b.parent.remove(b));
  return skinned.length;
}

const root = await new USDLoader().loadAsync('/input/model.usdz');
const baked = bakeSkinned(root);
await new Promise((r) => setTimeout(r, 3000)); // let textures decode
const buf = await new GLTFExporter().parseAsync(root, { binary: true, maxTextureSize: 2048 });
const u8 = new Uint8Array(buf);
let s = '';
for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000));
window.__result = { baked, b64: btoa(s) };
