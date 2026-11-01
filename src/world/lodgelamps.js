// v1.12: Pinewood Lodge after dark. Each of the three lodge buildings gets a pair of iron wall lanterns either side
// of its door, its windows glow warm, and a soft pool of light spills on the ground in front. One real point
// light hangs on the main lodge's porch (only while you're nearby); everything else is glow sprites and pools,
// so it costs next to nothing. Driven by the same "lamps on" switch as the dock lanterns (sky.js).
import * as THREE from 'three';

const WARM = '#ffcf8a';
let tex = null;
function glowTexture() {
  if (tex) return tex;
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const g = c.getContext('2d');
  const grd = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grd.addColorStop(0, 'rgba(255,220,160,1)'); grd.addColorStop(0.4, 'rgba(255,190,120,0.4)'); grd.addColorStop(1, 'rgba(255,170,100,0)');
  g.fillStyle = grd; g.fillRect(0, 0, 64, 64);
  tex = new THREE.CanvasTexture(c);
  return tex;
}

/** huts: HUTS entries ({ x, z, w, d, ry, h }); groundY(x, z) gives each one's floor height. */
export function buildLodgeLamps(scene, huts, groundY) {
  const group = new THREE.Group(); group.name = 'lodge-lamps';
  const iron = new THREE.MeshLambertMaterial({ color: '#2e2a26' });
  const glass = new THREE.MeshBasicMaterial({ color: '#c8b48a' });
  const winMat = new THREE.MeshBasicMaterial({ color: '#ffd9a0', transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending });
  const haloMat = new THREE.SpriteMaterial({ map: glowTexture(), color: WARM, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0 });
  const poolMat = new THREE.MeshBasicMaterial({ map: glowTexture(), color: WARM, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0 });
  const boxG = new THREE.BoxGeometry(0.2, 0.26, 0.2), capG = new THREE.ConeGeometry(0.17, 0.14, 4), armG = new THREE.BoxGeometry(0.04, 0.04, 0.26);
  let porch = null;
  for (const H of huts) {
    const wh = H.h || 2.4, y0 = groundY(H.x, H.z);
    const hut = new THREE.Group();
    hut.position.set(H.x, y0, H.z); hut.rotation.y = H.ry || 0;
    const fz = H.d / 2;
    const ly = Math.min(wh * 0.72, 1.95);
    for (const sx of [-1, 1]) {
      const lx = sx * (H.w * 0.11 + 0.32);
      const arm = new THREE.Mesh(armG, iron); arm.position.set(lx, ly + 0.2, fz + 0.13);
      const box = new THREE.Mesh(boxG, glass); box.position.set(lx, ly, fz + 0.26);
      const cap = new THREE.Mesh(capG, iron); cap.position.set(lx, ly + 0.2, fz + 0.26); cap.rotation.y = Math.PI / 4;
      const halo = new THREE.Sprite(haloMat); halo.position.set(lx, ly, fz + 0.3); halo.scale.setScalar(1.5);
      hut.add(arm, box, cap, halo);
    }
    // the painted windows (softHut: 14% of the wall wide, from 25% to 55% down from the eaves) glow from inside
    for (const wx of [-0.27, 0.27]) {
      const win = new THREE.Mesh(new THREE.PlaneGeometry(H.w * 0.14 - 0.04, wh * 0.3 - 0.04), winMat);
      win.position.set(wx * H.w, wh * 0.6, fz + 0.012);
      hut.add(win);
    }
    const pool = new THREE.Mesh(new THREE.PlaneGeometry(H.w * 1.1, 3.6), poolMat);
    pool.rotation.x = -Math.PI / 2; pool.position.set(0, 0.06, fz + 1.4); pool.renderOrder = 2;
    hut.add(pool);
    group.add(hut);
    if (!porch) { hut.updateMatrixWorld(true); porch = new THREE.Vector3(0, ly, fz + 0.9).applyMatrix4(hut.matrixWorld); }
  }
  const light = new THREE.PointLight(WARM, 0, 16, 1.5);
  if (porch) light.position.copy(porch);
  scene.add(group, light);
  let k = 0;
  return {
    group,
    update(dt, t, on, focus) {
      k += ((on ? 1 : 0) - k) * Math.min(1, dt * 1.5);
      const flick = 0.95 + Math.sin(t * 8.3) * 0.03 + Math.sin(t * 12.9) * 0.02;
      glass.color.set(k > 0.5 ? '#ffe6b0' : '#c8b48a');
      haloMat.opacity = 0.9 * k * flick;
      poolMat.opacity = 0.55 * k * flick;
      winMat.opacity = 0.75 * k;
      const near = porch && focus ? porch.distanceTo(focus) < 60 : true;
      light.intensity = near ? 3.2 * k * flick : 0;
    },
  };
}
