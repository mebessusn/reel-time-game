// Frostmere: something out past the floe edge. Now and then, far out to sea, a long neck and three humps rise out of the
// water, drift along the horizon for a minute and sink again. It never comes close and there's nothing to find: it stays
// a flat silhouette, more than 500 m out over water you can't reach, tinted from the fog so it sits in the haze in any light.
// Built here rather than in Blender: it's only an outline, so a few tapered tubes do it (one draw call, no mesh data).
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { toWorld, toLocal, WATER_Y } from './geo.js';

const V = -770, U_MAX = 240; // its line along the horizon (geo.js local: -v is out to sea)
const SHOW_NEAR = 540, SHOW_FAR = 640; // (only from the coast and the sea ice: the view's far plane is 820 m)

/** A tube along pts, thick at the start and thin at the end. */
function taper(pts, r0, r1) {
  const curve = new THREE.CatmullRomCurve3(pts.map((p) => new THREE.Vector3(...p))), seg = 18, rad = 6;
  const geo = new THREE.TubeGeometry(curve, seg, 1, rad, false), pos = geo.attributes.position, c = new THREE.Vector3(), v = new THREE.Vector3();
  for (let i = 0; i <= seg; i++) {
    curve.getPointAt(i / seg, c);
    const r = r0 + (r1 - r0) * (i / seg);
    for (let j = 0; j <= rad; j++) { const k = i * (rad + 1) + j; v.fromBufferAttribute(pos, k).sub(c).multiplyScalar(r).add(c); pos.setXYZ(k, v.x, v.y, v.z); }
  }
  geo.deleteAttribute('uv'); geo.deleteAttribute('normal');
  return geo;
}
/** A hump: half an arch out of the water. */
const hump = (x, h, w, r) => taper([[x - w, -6, 0], [x - w * 0.55, h * 0.8, 0], [x, h, 0], [x + w * 0.55, h * 0.8, 0], [x + w, -6, 0]], r, r * 0.8);

function buildShape() {
  const head = new THREE.SphereGeometry(1, 8, 5).scale(5.4, 2.1, 2.2).translate(-6.5, 39, 0);
  head.deleteAttribute('uv'); head.deleteAttribute('normal');
  const parts = [
    taper([[46, -6, 0], [40, 7, 0], [29, 15, 0], [17, 25, 0], [7, 36, 0], [0, 40, 0]], 6.5, 1.9), // the neck, leaning out ahead of the body
    head,
    hump(68, 15, 15, 6.2), hump(99, 11, 13, 5), hump(127, 6.5, 10, 3.2),
    taper([[147, -6, 0], [153, 2.4, 0], [162, 2.8, 0], [169, -4, 0]], 2.2, 0.5), // the tail's tip
  ];
  return mergeGeometries(parts.map((g) => (g.index ? g.toNonIndexed() : g)));
}

export class SeaMonster {
  constructor(group) {
    this.mat = new THREE.MeshBasicMaterial({ color: '#34424f', fog: false, transparent: true, opacity: 0, side: THREE.DoubleSide });
    this.mesh = new THREE.Mesh(buildShape(), this.mat);
    this.mesh.name = 'sea-monster'; this.mesh.visible = false; this.mesh.frustumCulled = false; this.mesh.scale.setScalar(0.72);
    this.mesh.castShadow = this.mesh.receiveShadow = false;
    group.add(this.mesh);
    this.u = -120 + Math.random() * 240; this.dir = Math.random() < 0.5 ? -1 : 1;
    this.t = 0; this.wait = 25 + Math.random() * 35; // (soon after you first get here, then every few minutes)
    this.up = 0; this.stay = 0;
  }
  /** player: the angler's position. fog: the scene's fog, for the colour; storm: hidden from sight in a blizzard. */
  update(dt, t, player, fog, storm) {
    const m = this.mesh;
    if (this.wait > 0) { this.wait -= dt; m.visible = false; if (this.wait <= 0) { this.dir = this.u > 0 ? -1 : this.u < 0 ? 1 : this.dir; this.stay = 55 + Math.random() * 40; } return; }
    this.t += dt;
    const rising = this.t < this.stay; // 12 s up, a minute or so of slow drifting, 12 s down
    this.up = Math.max(0, Math.min(1, this.up + (rising ? dt : -dt) / 12));
    if (!rising && this.up <= 0) { this.t = 0; this.wait = 120 + Math.random() * 180; m.visible = false; return; }
    this.u = Math.max(-U_MAX, Math.min(U_MAX, this.u + this.dir * 2.2 * dt));
    const [u, v] = toLocal(player.x, player.z), w = toWorld(this.u, V), d = Math.hypot(this.u - u, V - v);
    const near = Math.max(0, Math.min(1, (SHOW_FAR - d) / (SHOW_FAR - SHOW_NEAR)));
    this.seen = (this.seen ?? 0) + ((storm ? 0 : near) - (this.seen ?? 0)) * Math.min(1, dt * 0.6);
    m.visible = this.seen > 0.01;
    if (!m.visible) return;
    const ease = this.up * this.up * (3 - 2 * this.up);
    m.position.set(w.x, WATER_Y - 48 * (1 - ease) + Math.sin(t * 0.25) * 0.8, w.z);
    m.rotation.set(0, this.dir > 0 ? Math.PI : 0, Math.sin(t * 0.2) * 0.012);
    this.mat.color.copy(fog.color).multiplyScalar(0.42); // (darker than the haze, the same hue)
    this.mat.opacity = this.seen * 0.9;
  }
}
