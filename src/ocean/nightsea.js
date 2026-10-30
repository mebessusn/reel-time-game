// Open Waters v1.15.10: the sea after dark.
// - Glowing plankton: the boat's wake, the bow wave and anyone swimming stir up blue-green sparks of light.
// - Squid lights: at anchor after dark, Marlowe hangs two floodlights off the stern. Their pool of light on the water
//   draws little squid that dart about in it, and the big hunters follow: giant squid and swordfish bite more often
//   from the stern at night (ctxExtra adds a bite boost; rules.rollBite reads ctx.boost).
// - Night charters: book one at Marlowe's pier and the trip runs on its own clock from after dark (openwaters.book).
import * as THREE from 'three';
import { CEPH_MATS, CEPH_NODES } from '../data/cephMesh.js';
import { buildNode } from './meshes.js';
import { oceanWave } from './waves.js';
import { SEA } from './waves.js';

const WATER_Y = 0.85;
export const NIGHT_BOOST = { giantsquid: 3, swordfish: 2.5 };
const PLANKTON = ['#5ff2dc', '#8ffff0', '#3ad8c8'];

export class NightSea {
  constructor(game, ow) { this.game = game; this.ow = ow; this.built = false; this.squid = []; this.on = 0; }
  get night() { return this.game.engine.sky?.night ?? 0; }

  build() {
    if (this.built) return;
    this.built = true;
    const boat = this.ow.boat, scene = this.game.engine.scene;
    // two flood lamps on the stern rail, facing aft and down
    this.lamps = [];
    for (const s of [-1, 1]) {
      const lamp = new THREE.Group();
      const body = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.16, 0.18), new THREE.MeshLambertMaterial({ color: '#2a3036' }));
      const lens = new THREE.Mesh(new THREE.PlaneGeometry(0.18, 0.12), new THREE.MeshBasicMaterial({ color: '#fff4d0' }));
      lens.position.z = -0.095; lens.rotation.y = Math.PI;
      lamp.add(body, lens);
      lamp.position.set(s * 1.1, 2.15, -7.0); lamp.rotation.x = 0.5;
      boat.root.add(lamp);
      this.lamps.push({ lamp, lens });
    }
    // the pool of light on the water astern
    const c = document.createElement('canvas'); c.width = c.height = 64;
    const x = c.getContext('2d'), gr = x.createRadialGradient(32, 32, 0, 32, 32, 32);
    gr.addColorStop(0, 'rgba(255,248,220,0.85)'); gr.addColorStop(0.45, 'rgba(160,230,220,0.35)'); gr.addColorStop(1, 'rgba(60,140,160,0)');
    x.fillStyle = gr; x.fillRect(0, 0, 64, 64);
    const tex = new THREE.CanvasTexture(c);
    this.pool = new THREE.Mesh(new THREE.PlaneGeometry(11, 11), new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0 }));
    this.pool.rotation.x = -Math.PI / 2; this.pool.renderOrder = 4; this.pool.name = 'squid-light-pool';
    scene.add(this.pool);
    // the little squid that come to the light
    for (let i = 0; i < 7; i++) {
      const m = buildNode(CEPH_MATS, CEPH_NODES, 'giantsquid', { shadow: false });
      m.scale.setScalar(0.22 + (i % 3) * 0.05);
      m.visible = false;
      scene.add(m);
      this.squid.push({ m, a: i * 0.9, r: 1.2 + (i % 4) * 0.8, w: (i % 2 ? 1 : -1) * (0.5 + i * 0.07), d: 0.35 + (i % 3) * 0.25, dart: 0, ph: i * 1.3 });
    }
  }

  /** Lights on: at anchor, after dark, aboard the charter. */
  lightsOn() { return !!this.ow.charter && this.night > 0.4 && !this.ow.boat.pose.moving; }
  /** The bite boost under the lights (ctxExtra). */
  boost() { return this.lightsOn() && this.ow.boat.deckY(this.game.player.pos.x, this.game.player.pos.z) != null ? NIGHT_BOOST : null; }

  update(dt, t) {
    const g = this.game, ow = this.ow;
    if (!ow.charter || !ow.atSea) { if (this.built) this.hide(); return; }
    const night = this.night;
    if (night > 0.3) this.build();
    if (!this.built) return;
    // lights: fade in at anchor after dark
    const want = this.lightsOn() ? 1 : 0;
    this.on += (want - this.on) * Math.min(1, dt * 1.5);
    for (const L of this.lamps) L.lens.material.color.set(this.on > 0.2 ? '#fff4d0' : '#555');
    const P = ow.boat.pose;
    const st = ow.boat.toWorld(0, -12.5);
    this.pool.visible = this.on > 0.02;
    if (this.pool.visible) {
      this.pool.position.set(st.x, WATER_Y + oceanWave(st.x, st.z) + 0.06, st.z);
      this.pool.rotation.z = P.yaw;
      this.pool.material.opacity = this.on * (0.75 + Math.sin(t * 1.3) * 0.05);
    }
    for (const S of this.squid) {
      S.m.visible = this.on > 0.3;
      if (!S.m.visible) continue;
      S.dart = Math.max(0, S.dart - dt);
      if (Math.random() < dt * 0.25) S.dart = 0.5;
      S.a += S.w * dt * (1 + S.dart * 5);
      const r = S.r + Math.sin(t * 0.7 + S.ph) * 0.4;
      const x = st.x + Math.cos(S.a) * r, z = st.z + Math.sin(S.a) * r;
      S.m.position.set(x, WATER_Y + oceanWave(x, z) - S.d, z);
      S.m.rotation.y = Math.atan2(-Math.sin(S.a) * Math.sign(S.w), Math.cos(S.a) * Math.sign(S.w)) - Math.PI / 2;
    }
    // plankton: the wake, the bow wave, and a swimmer (not on low graphics)
    if (night < 0.45 || SEA.lite) return;
    const fx = g.fx;
    if (P.moving) {
      const s = ow.boat.sternWorld(), b = ow.boat.bowWorld();
      const n = Math.random() < dt * 45 ? 2 : 0;
      for (let i = 0; i < n; i++) {
        const k = Math.random() - 0.5;
        const sx = s.x + Math.cos(P.yaw) * k * 3, sz = s.z - Math.sin(P.yaw) * k * 3;
        fx.spawn(sx, WATER_Y + oceanWave(sx, sz) + 0.05, sz, (Math.random() - 0.5) * 0.4, 0.05, (Math.random() - 0.5) * 0.4, PLANKTON[i % 3], 1.6 + Math.random(), 0, 0.6);
      }
      if (Math.random() < dt * 20) for (const sd of [-1, 1]) {
        const w = ow.boat.toWorld(sd * 1.7, 4 + Math.random() * 2);
        fx.spawn(w.x, WATER_Y + oceanWave(w.x, w.z) + 0.05, w.z, Math.cos(P.yaw) * sd * 0.8, 0.1, -Math.sin(P.yaw) * sd * 0.8, PLANKTON[(Math.random() * 3) | 0], 1.2, 0, 0.8);
      }
    }
    if (ow.dive.on && g.player.moving && Math.random() < dt * 14) {
      const p = g.player.pos;
      fx.spawn(p.x + (Math.random() - 0.5) * 0.8, p.y + (Math.random() - 0.5) * 0.6, p.z + (Math.random() - 0.5) * 0.8, 0, 0.05, 0, PLANKTON[(Math.random() * 3) | 0], 1.4, 0, 0.5);
    }
  }
  /** A splash at night (a bobber landing, a fish jumping) lights the water round it. */
  splash(x, z) {
    if (this.night < 0.45 || SEA.lite || !this.ow.atSea) return;
    for (let i = 0; i < 14; i++) { const a = Math.random() * Math.PI * 2, s = 0.6 + Math.random() * 1.2; this.game.fx.spawn(x, WATER_Y + oceanWave(x, z) + 0.05, z, Math.cos(a) * s, 0.15, Math.sin(a) * s, PLANKTON[i % 3], 1.3 + Math.random() * 0.6, 0, 1.4); }
  }
  hide() {
    this.on = 0;
    if (this.pool) this.pool.visible = false;
    for (const S of this.squid) S.m.visible = false;
  }
}
