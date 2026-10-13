import { loadCarModel } from './car-model.js';

/**
 * One of the supplied cars as static scenery (parked in the studio or the workshop): pristine
 * paint, lights off, no halos. `spot` = { config, x, z, ry, color? }.
 */
export async function loadParkedCar({ config, x = 0, z = 0, ry = 0, color = null }, { quality = 'high' } = {}) {
  const cfg = color ? { ...config, paint: { ...config.paint, color } } : config;
  const api = await loadCarModel(cfg, { quality });
  // polished everywhere: the boundary sits beyond the room (paint shaders work in world x here)
  api.setPolish(10, -1);
  api.setTailOn?.(0); // parked: lights off
  api.group.traverse((o) => {
    if (o.isSprite || o.isPoints || o.isLight) o.visible = false;
  });
  api.group.name = 'parked';
  api.group.position.set(x, 0, z);
  api.group.rotation.y = ry;
  return api.group;
}
