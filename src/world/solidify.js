// v1.17.12: colliders read off a built model, for the parts of a merged model that stand up where you walk (lantern
// posts, bollards, rails, a hut's walls, a rock's flanks): every bit of its surface at body height becomes a little
// round solid where it stands.
import * as THREE from 'three';
import { addCircle } from './colliders.js';

const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _c = new THREE.Vector3(), _p = new THREE.Vector3();

/** obj: a built, placed Object3D. Only the surface between heights `above` and `below` counts (things overhead don't);
 *  with `ground(x, z)` those are heights over the ground there, otherwise world heights. Returns how many solids it added. */
export function solidPoles(obj, { above, below = Infinity, ground = null, cell = 0.5, r = 0.14, opts = {} }) {
  obj.updateMatrixWorld(true);
  const cells = new Map();
  const take = (v) => {
    const g = ground ? ground(v.x, v.z) : 0;
    if (v.y < g + above || v.y > g + below) return;
    const k = `${Math.floor(v.x / cell)},${Math.floor(v.z / cell)}`;
    const c = cells.get(k) || cells.set(k, { x0: Infinity, x1: -Infinity, z0: Infinity, z1: -Infinity }).get(k);
    c.x0 = Math.min(c.x0, v.x); c.x1 = Math.max(c.x1, v.x); c.z0 = Math.min(c.z0, v.z); c.z1 = Math.max(c.z1, v.z);
  };
  obj.traverse((m) => {
    const p = m.isMesh && m.geometry?.attributes?.position;
    if (!p) return;
    const idx = m.geometry.index, n = idx ? idx.count : p.count;
    for (let i = 0; i + 2 < n; i += 3) { // every triangle, sampled finely enough that a long wall isn't just its corners
      const ia = idx ? idx.getX(i) : i, ib = idx ? idx.getX(i + 1) : i + 1, ic = idx ? idx.getX(i + 2) : i + 2;
      _a.fromBufferAttribute(p, ia).applyMatrix4(m.matrixWorld); _b.fromBufferAttribute(p, ib).applyMatrix4(m.matrixWorld); _c.fromBufferAttribute(p, ic).applyMatrix4(m.matrixWorld);
      const s = Math.max(1, Math.min(24, Math.ceil(Math.max(_a.distanceTo(_b), _b.distanceTo(_c), _c.distanceTo(_a)) / (cell * 0.7))));
      for (let u = 0; u <= s; u++) for (let w = 0; w <= s - u; w++) take(_p.copy(_a).multiplyScalar(1 - (u + w) / s).addScaledVector(_b, u / s).addScaledVector(_c, w / s));
    }
  });
  for (const c of cells.values()) addCircle((c.x0 + c.x1) / 2, (c.z0 + c.z1) / 2, Math.max(r, Math.hypot(c.x1 - c.x0, c.z1 - c.z0) / 2), opts);
  return cells.size;
}
