// v1.13.7: every building's windows light up after dark, the way Pinewood Lodge's do. Two kinds of window:
// a glow pane laid over a painted window (huts, Gus's cabin), and real glass materials that get a warm emissive
// (the lighthouse, the trailers). Driven by the same "lamps on" switch as the dock lanterns (sky.js).
import * as THREE from 'three';

const WARM = new THREE.Color('#ffc878');
const paneMat = new THREE.MeshBasicMaterial({ color: '#ffd9a0', transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending });
const glassMats = new Set();
let k = 0;

export const nightWindows = {
  /** A warm pane the size of a window (w x h), facing +z in its parent's space. */
  pane(w, h) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), paneMat);
    m.renderOrder = 2;
    return m;
  },
  /** A glass material that should glow warm at night (needs an emissive colour: Lambert or Phong). */
  glass(mat) { if (mat?.emissive) glassMats.add(mat); return mat; },
  update(dt, on) {
    const nk = k + ((on ? 1 : 0) - k) * Math.min(1, dt * 1.5);
    if (Math.abs(nk - k) < 1e-4 && (nk === 0 || nk === 1)) return;
    k = nk < 0.001 ? 0 : nk > 0.999 ? 1 : nk;
    paneMat.opacity = 0.75 * k;
    for (const m of glassMats) m.emissive.copy(WARM).multiplyScalar(0.85 * k);
  },
  get level() { return k; },
};

/** Glowing windows for the log huts (softHut paints two windows on the front wall: 14% wide, 25-55% down). */
export function buildHutWindows(scene, huts, groundY) {
  const group = new THREE.Group(); group.name = 'hut-windows';
  for (const H of huts) {
    const wh = H.h || 2.4;
    const hut = new THREE.Group();
    hut.position.set(H.x, groundY(H.x, H.z), H.z); hut.rotation.y = H.ry || 0;
    for (const wx of [-0.27, 0.27]) {
      const win = nightWindows.pane(H.w * 0.14 - 0.04, wh * 0.3 - 0.04);
      win.position.set(wx * H.w, wh * 0.6, H.d / 2 + 0.012);
      hut.add(win);
    }
    group.add(hut);
  }
  scene.add(group);
  return group;
}
