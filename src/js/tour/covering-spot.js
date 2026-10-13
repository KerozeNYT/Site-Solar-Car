import * as THREE from 'three';
import { clamp } from './math.js';

/**
 * Home tour, covering chapter: a spot pinned on the passenger door. Opening it (click, tap,
 * Enter) brings the camera a little closer and lays a film over the existing body paint, from the
 * rear to the front; closing it (button, Escape, leaving the chapter) lays it back off and the
 * paint returns exactly as it was. Uniform changes only: no shader is rebuilt, nothing is
 * downloaded (the colour is one verified 3M reference, content/covering.js `homeDemo`).
 */
export function createCoveringSpot({ chapter, stage, film, reduceMotion = false, signal }) {
  const btn = chapter?.querySelector('[data-spot]');
  const card = chapter?.querySelector('[data-spot-card]');
  const car = stage.car;
  if (!btn || !card || !car.setWrap) return null;

  // the door's surface, found by casting a ray at the car's flank (no mesh index involved)
  const box = new THREE.Box3().setFromObject(car.group);
  const ray = new THREE.Raycaster(new THREE.Vector3(0.15, 0.56, box.max.z + 2), new THREE.Vector3(0, 0, -1));
  const meshes = [];
  car.group.traverse((o) => o.isMesh && o.visible && meshes.push(o));
  const hit = ray.intersectObjects(meshes, false)[0];
  const anchor = hit ? hit.point.clone() : new THREE.Vector3(0.15, 0.56, box.max.z - 0.05);
  // where the camera comes to when the spot is open (a step towards the door, slightly above)
  const focus = { pos: anchor.clone().add(new THREE.Vector3(1.9, 0.55, 2.85)), look: anchor.clone().add(new THREE.Vector3(0.1, 0.06, -0.35)), fov: 38 };
  const L = box.max.x - box.min.x;
  const front = box.max.x + 0.2;
  const rear = box.min.x - 0.2;

  let open = false;
  let f = 0; // camera approach 0..1
  let lay = 0; // film laid 0..1 along the car
  const v = new THREE.Vector3();
  car.setWrap({ amount: 0, x: rear, film });

  function set(on, { focusBack = true } = {}) {
    if (on === open) return;
    open = on;
    btn.setAttribute('aria-expanded', String(on));
    card.hidden = !on;
    chapter.classList.toggle('has-spot-open', on);
    if (!on && focusBack && card.contains(document.activeElement)) btn.focus();
    stage.wake?.();
  }
  // listeners end with the tour instance (`signal`): a relaunched tour never doubles them
  btn.addEventListener('click', () => set(!open), { signal });
  card.querySelector('[data-spot-close]')?.addEventListener('click', () => set(false), { signal });
  chapter.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && open) {
      e.stopPropagation();
      set(false);
    }
  }, { signal });

  return {
    get busy() {
      return (open && (f < 1 || lay < 1)) || (!open && (f > 0 || lay > 0));
    },
    /** chapter weight 0..1, frame time: animate the film and close when the chapter is left */
    step(weight, dt) {
      if (open && weight < 0.5) set(false, { focusBack: false });
      const k = reduceMotion ? 1 : dt;
      f = clamp(f + (open ? 1 : -1) * k / 0.9);
      lay = clamp(lay + (open ? 1 : -1) * k / (open ? 1.4 : 0.8));
      const e = lay < 0.5 ? 2 * lay * lay : 1 - Math.pow(-2 * lay + 2, 2) / 2;
      car.setWrap({ amount: lay > 0 ? 1 : 0, x: rear + (front - rear) * e + (lay >= 1 ? L : 0) });
      btn.hidden = weight < 0.5;
    },
    /** blends the tour camera towards the door while the spot is open */
    camera(sample) {
      if (f <= 0) return;
      const e = f * f * (3 - 2 * f);
      sample.pos.lerp(focus.pos, e);
      sample.look.lerp(focus.look, e);
      sample.fov += (focus.fov - sample.fov) * e;
      sample.roll *= 1 - e;
    },
    /** pins the button on the door (screen position from the 3D anchor) */
    place(camera, width, height) {
      camera.updateMatrixWorld();
      v.copy(anchor).project(camera);
      const behind = v.z > 1;
      btn.style.transform = `translate3d(${((v.x * 0.5 + 0.5) * width).toFixed(1)}px, ${((-v.y * 0.5 + 0.5) * height).toFixed(1)}px, 0)`;
      btn.classList.toggle('is-off-screen', behind || Math.abs(v.x) > 0.95 || Math.abs(v.y) > 0.95);
    },
    /** back to the closed state (tour relaunched or switched to its static version) */
    reset() {
      set(false, { focusBack: false });
      btn.hidden = true;
    },
    /** still images: the film fully laid */
    preview() {
      lay = 1;
      car.setWrap({ amount: 1, x: front + L, film });
    },
  };
}
