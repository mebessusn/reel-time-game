// Personal lights after dark: every angler carries a little belt lantern that glows and throws a soft
// pool of light on the ground. Real point lights are expensive, so a fixed pool of three follows the
// anglers nearest the camera (you first); everyone else gets the lantern glow and the ground pool.
import * as THREE from 'three';

const WARM = '#ffcf8a';

let glowTex = null;
function groundGlowTexture() {
  if (glowTex) return glowTex;
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  const grd = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grd.addColorStop(0, 'rgba(255,214,150,0.85)');
  grd.addColorStop(0.45, 'rgba(255,190,120,0.32)');
  grd.addColorStop(1, 'rgba(255,170,100,0)');
  g.fillStyle = grd; g.fillRect(0, 0, 64, 64);
  glowTex = new THREE.CanvasTexture(c);
  return glowTex;
}

/** A small hanging lantern plus a ground glow, added to an actor's body. */
export function makeLantern() {
  const g = new THREE.Group();
  g.name = 'lantern';
  const metal = new THREE.MeshLambertMaterial({ color: '#3a3226' });
  const glass = new THREE.MeshBasicMaterial({ color: '#ffe2a8', transparent: true, opacity: 0.95 });
  const cage = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.13, 0.11), glass);
  const cap = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.03, 0.14), metal); cap.position.y = 0.08;
  const base = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.025, 0.13), metal); base.position.y = -0.075;
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.035, 0.008, 4, 10), metal); ring.position.y = 0.115;
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: groundGlowTexture(), color: WARM, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.9 }));
  halo.scale.setScalar(0.55);
  g.add(cage, cap, base, ring, halo);
  const pool = new THREE.Mesh(new THREE.PlaneGeometry(4.2, 4.2), new THREE.MeshBasicMaterial({ map: groundGlowTexture(), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0 }));
  pool.rotation.x = -Math.PI / 2;
  pool.renderOrder = 2;
  g.userData = { glass, halo, pool };
  return g;
}

export class NightLights {
  constructor(scene) {
    this.lights = [0, 1, 2].map(() => { const l = new THREE.PointLight(WARM, 0, 9, 1.7); scene.add(l); return l; });
    this.k = 0;
  }

  /** actors: [{ actor, pos }] nearest first. dark: 0..1 */
  update(dt, t, dark, actors) {
    const want = dark > 0.35 ? Math.min(1, (dark - 0.35) / 0.35) : 0;
    this.k += (want - this.k) * Math.min(1, dt * 1.5);
    const k = this.k;
    const flick = 0.94 + Math.sin(t * 9.1) * 0.03 + Math.sin(t * 13.7) * 0.03;
    actors.forEach((a, i) => a.actor.setNightGlow?.(k, flick));
    this.lights.forEach((l, i) => {
      const a = actors[i];
      if (!a || k < 0.01) { l.intensity = 0; return; }
      const lp = a.actor.lanternWorld?.();
      if (lp) l.position.copy(lp).y += 0.35;
      l.intensity = 2.08 * k * flick; // 20% softer than the first pass
    });
  }
}
