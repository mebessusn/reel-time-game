// Dev only (never imported by the game): renders a contact sheet of mesh-library nodes for checking models.
//   in a browser on the dev server: (await import('/src/dev/sheet.js')).sheet(['pl_cub', ...])
import * as THREE from 'three';
import { buildNode } from '../ocean/meshes.js';
import { AIRRACES_MATS, AIRRACES_NODES } from '../data/airracesMesh.js';

export function sheet(names, W = 1200, H = 800, libs = [[AIRRACES_MATS, AIRRACES_NODES]]) {
  const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
  Object.assign(cv.style, { position: 'fixed', left: '0', top: '0', zIndex: 99999 }); document.body.append(cv);
  const r = new THREE.WebGLRenderer({ canvas: cv, antialias: true }); r.setScissorTest(true); r.outputColorSpace = THREE.SRGBColorSpace;
  const cols = Math.ceil(Math.sqrt(names.length * 1.5)), rows = Math.ceil(names.length / cols), w = W / cols, h = H / rows;
  names.forEach((n, i) => {
    const sc = new THREE.Scene(); sc.background = new THREE.Color('#bcd8e8');
    sc.add(new THREE.HemisphereLight('#ffffff', '#667788', 1.6)); const d = new THREE.DirectionalLight('#fff', 1.6); d.position.set(3, 5, 4); sc.add(d);
    let g = null; for (const [M, N] of libs) { if (N.find((x) => x.name === n)) { g = buildNode(M, N, n); break; } }
    if (!g) return; sc.add(g);
    const box = new THREE.Box3().setFromObject(g), c = box.getCenter(new THREE.Vector3()), s = box.getSize(new THREE.Vector3()).length();
    const cam = new THREE.PerspectiveCamera(40, w / h, 0.01, 5000); cam.position.copy(c).add(new THREE.Vector3(0.75, 0.45, 0.9).multiplyScalar(s * 1.15)); cam.lookAt(c);
    const x = (i % cols) * w, y = H - (Math.floor(i / cols) + 1) * h; r.setViewport(x, y, w, h); r.setScissor(x, y, w, h); r.render(sc, cam);
  });
  return true;
}
