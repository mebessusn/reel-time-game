// Open Waters v1.15.12: things that happen at sea. Rolled per minute from the charter's id and the weather
// (voyageData.seaEventAt), and placed from where the charter's course had the boat, so the whole crew sees the same
// event in the same place with no network traffic.
// - Bait ball: a boil of baitfish close to the boat, with birds diving into it. Cast into it: bites come three times as
//   fast and the hunters (mahi, tuna, wahoo, trevally) come with them.
// - Waterspout: a grey funnel walking across the horizon in rain and storms. Scenery (and a story for Marlowe).
// - Fog bank: the sea goes grey and close for a few minutes. Marlowe sounds the horn every so often; if you're off the
//   boat, follow it home (the strip says where the boat is). Things come up in the fog: makos and great whites.
import * as THREE from 'three';
import { seaEventAt, EVENT_SLOT } from './voyageData.js';
import { inOcean, oceanSurfaceY } from './geo.js';
import { oceanWave } from './waves.js';

const WATER_Y = 0.85;
export const BAIT_BOOST = { mahi: 2.5, yellowfin: 2, wahoo: 2.5, gt: 2.5 };
export const FOG_BOOST = { mako: 2, greatwhite: 2 };
const seedOf = (s) => { let h = 7; for (const c of String(s)) h = (h * 31 + c.charCodeAt(0)) | 0; return h; };
const DIRS = ['north', 'north-east', 'east', 'south-east', 'south', 'south-west', 'west', 'north-west'];
/** A compass word for a bearing in the world (z grows south on the chart). */
export function compass(dx, dz) { const a = Math.atan2(dx, -dz); return DIRS[((Math.round(a / (Math.PI / 4)) % 8) + 8) % 8]; }

export class SeaEvents {
  constructor(game, ow) { this.game = game; this.ow = ow; this.live = new Map(); this.fogK = 0; this.t = 0; this.hornT = 0; }

  update(dt, t) {
    const g = this.game, ow = this.ow, c = ow.charter;
    if (!c || !ow.atSea) { if (this.live.size) this.clear(); this.fogK = Math.max(0, this.fogK - dt); return; }
    const now = Date.now(), w = g.engine.sky.state.weather || 'clear';
    this.t -= dt;
    if (this.t <= 0) {
      this.t = 1;
      const seed = seedOf(c.id), cur = Math.floor(now / EVENT_SLOT);
      for (let s = cur - 3; s <= cur; s++) {
        if (this.live.has(s)) continue;
        const ev = seaEventAt(seed, s, w);
        if (ev && now < ev.end && now >= ev.start) this.open(ev);
        else this.live.set(s, null); // (nothing this slot, or it's over)
      }
      for (const [s, e] of this.live) if ((!e && s < cur - 4) || (e && now > e.end)) { this.close(e); this.live.delete(s); }
    }
    let fog = 0;
    for (const e of this.live.values()) {
      if (!e) continue;
      const age = (now - e.start) / 1000, left = (e.end - now) / 1000;
      if (e.kind === 'baitball') this.baitball(e, dt, t, age);
      else if (e.kind === 'spout') this.spout(e, dt, t, age, left);
      else if (e.kind === 'fog') fog = Math.max(fog, Math.min(1, age / 15, left / 15));
    }
    this.fogK += (fog - this.fogK) * Math.min(1, dt * 0.8);
    if (this.fogK > 0.5) this.horn(dt);
  }

  open(ev) {
    const g = this.game, ow = this.ow;
    const at = ow.life.boatAt(ev.start) || ow.boat.pose;
    const e = { ...ev, meshes: [], x: at.x + Math.cos(ev.a) * ev.d, z: at.z + Math.sin(ev.a) * ev.d };
    if (ev.kind !== 'fog' && (!inOcean(e.x, e.z) || oceanSurfaceY(e.x, e.z) > -5)) { this.live.set(ev.slot, null); return; } // (never in the shallows)
    this.live.set(ev.slot, e);
    const P = ow.boat.pose, where = compass(e.x - P.x, e.z - P.z);
    if (ev.kind === 'baitball') {
      for (let i = 0; i < 4; i++) e.meshes.push(ow.life.get('gull'));
      e.ph = e.meshes.map((m, i) => ({ a: i * 1.6, R: 2 + i * 0.9, w: (0.8 + i * 0.15) * (i % 2 ? 1 : -1), dive: i * 1.3 }));
      g.audio.sfx('gulls');
      g.chat.npcSay?.('Captain Marlowe', `Bait ball off the ${where}! See the water boil? Cast right into it!`);
      g.ext.bump('baitBalls');
    } else if (ev.kind === 'spout') {
      e.mesh = this.funnel();
      this.game.engine.scene.add(e.mesh);
      e.dir = ev.a + Math.PI / 2;
      g.chat.npcSay?.('Captain Marlowe', `Waterspout to the ${where}! Don't worry, it's a long way off. Pretty thing, from here.`);
      if (!g.ext.d.ocean?.sawSpout) { g.ext.change((d) => { d.ocean.sawSpout = Date.now(); }); g.chat.system('Journal: a waterspout walked across the horizon, a grey funnel from the clouds to the sea.', 'level', { popup: true }); }
      g.ext.bump('waterspouts');
    } else if (ev.kind === 'fog') {
      g.chat.npcSay?.('Captain Marlowe', 'Fog bank rolling in. Stay close: I\'ll sound the horn so you can find the boat. Things come up in the fog, mind.');
      this.hornT = 2;
      g.ext.bump('fogBanks');
    }
  }
  close(e) {
    if (!e) return;
    for (const m of e.meshes || []) this.ow.life.put(m);
    if (e.mesh) { this.game.engine.scene.remove(e.mesh); e.mesh.geometry.dispose(); }
  }
  clear() { for (const e of this.live.values()) this.close(e); this.live.clear(); }

  // ---------------------------------------------------------------- the bait ball
  baitball(e, dt, t, age) {
    const g = this.game, ow = this.ow;
    const k = Math.min(1, age / 6);
    if (Math.random() < dt * 14 * k) { // baitfish breaking the surface: silver flicks and little splashes
      const a = Math.random() * Math.PI * 2, r = Math.random() * 3.5, x = e.x + Math.cos(a) * r, z = e.z + Math.sin(a) * r, y = WATER_Y + oceanWave(x, z);
      g.fx.spawn(x, y + 0.05, z, Math.cos(a) * 0.6, 2 + Math.random() * 1.5, Math.sin(a) * 0.6, Math.random() < 0.5 ? '#e8f0f8' : '#b8c8d8', 0.7, -9);
      if (Math.random() < 0.3) g.engine.water.ripple(x, z, 0.5);
    }
    e.meshes.forEach((m, i) => {
      if (!m) return;
      const p = e.ph[i];
      p.a += p.w * dt; p.dive -= dt;
      let hgt = 5 + Math.sin(t * 0.9 + i) * 1;
      if (p.dive < 0) { const q = Math.min(1, -p.dive / 1.2); hgt = 5 - Math.sin(q * Math.PI) * 5; if (q >= 1) p.dive = 2 + ((i * 3.7) % 3); if (q > 0.45 && q < 0.5) g.fx.splash(new THREE.Vector3(e.x + Math.cos(p.a) * p.R, WATER_Y, e.z + Math.sin(p.a) * p.R), 0.35); }
      m.position.set(e.x + Math.cos(p.a) * p.R, WATER_Y + hgt, e.z + Math.sin(p.a) * p.R);
      const hx = -Math.sin(p.a) * Math.sign(p.w), hz = Math.cos(p.a) * Math.sign(p.w);
      m.rotation.set(0, Math.atan2(-hz, hx), Math.sign(p.w) * 0.35);
      const flap = Math.sin(t * 12 + i) * 0.6;
      if (m.userData.parts?.wingL) m.userData.parts.wingL.rotation.x = flap;
      if (m.userData.parts?.wingR) m.userData.parts.wingR.rotation.x = -flap;
    });
    if (ow.ui && !e.hinted && age > 3 && g.fishing.state === 'idle') { e.hinted = true; g.ui.toast('Cast into the bait ball: bites come three times as fast.', { icon: 'fish', ms: 4000 }); }
  }
  /** Is (x, z) inside a bait ball right now? */
  inBaitball(x, z) {
    for (const e of this.live.values()) if (e?.kind === 'baitball' && Date.now() - e.start > 4000 && Math.hypot(x - e.x, z - e.z) < 6.5) return true;
    return false;
  }

  // ---------------------------------------------------------------- the waterspout
  funnel() {
    const geo = new THREE.CylinderGeometry(9, 1.4, 70, 20, 24, true);
    geo.translate(0, 35, 0);
    const mat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, side: THREE.DoubleSide, fog: true,
      uniforms: { uTime: { value: 0 }, uK: { value: 0 }, ...THREE.UniformsLib.fog },
      vertexShader: /* glsl */ `
        uniform float uTime; varying vec2 vUv; varying float vY;
        #include <fog_pars_vertex>
        void main() {
          vUv = uv; vY = position.y / 70.0;
          vec3 p = position;
          float tw = uTime * 1.6 + vY * 7.0;
          float c = cos(tw), s = sin(tw);
          p.xz = mat2(c, -s, s, c) * p.xz;
          p.x += sin(vY * 3.0 + uTime * 0.7) * 5.0 * vY;
          vec4 mvPosition = modelViewMatrix * vec4(p, 1.0);
          gl_Position = projectionMatrix * mvPosition;
          #include <fog_vertex>
        }`,
      fragmentShader: /* glsl */ `
        uniform float uTime, uK; varying vec2 vUv; varying float vY;
        #include <fog_pars_fragment>
        void main() {
          float band = 0.55 + 0.45 * sin(vUv.x * 40.0 + vY * 18.0 - uTime * 6.0);
          float a = uK * (0.3 + 0.35 * band) * smoothstep(0.0, 0.08, vY) * (1.0 - smoothstep(0.8, 1.0, vY) * 0.6);
          gl_FragColor = vec4(mix(vec3(0.55, 0.6, 0.64), vec3(0.85, 0.88, 0.9), band * 0.5), a);
          #include <fog_fragment>
        }`,
    });
    const m = new THREE.Mesh(geo, mat);
    m.name = 'waterspout'; m.renderOrder = 5; m.frustumCulled = false;
    return m;
  }
  spout(e, dt, t, age, left) {
    const g = this.game, m = e.mesh;
    if (!m) return;
    e.x += Math.cos(e.dir) * dt * 2; e.z += Math.sin(e.dir) * dt * 2;
    m.position.set(e.x, WATER_Y, e.z);
    m.material.uniforms.uTime.value = t;
    m.material.uniforms.uK.value = Math.min(1, age / 10, left / 10);
    if (Math.random() < dt * 10) g.fx.mist(new THREE.Vector3(e.x + (Math.random() - 0.5) * 6, WATER_Y + 0.5, e.z + (Math.random() - 0.5) * 6));
  }

  // ---------------------------------------------------------------- the fog bank
  /** Marlowe's horn every so often; off the boat, the strip says where she is. */
  horn(dt) {
    const g = this.game, ow = this.ow, p = g.player.pos;
    this.hornT -= dt;
    if (this.hornT > 0) return;
    this.hornT = 14;
    const P = ow.boat.pose, d = Math.hypot(P.x - p.x, P.z - p.z);
    g.audio.sfx('horn', { x: P.x, z: P.z });
    if (ow.boat.deckY(p.x, p.z) == null && d > 12 && !this.toldHorn) { this.toldHorn = true; g.ui.toast('Fog! Follow Marlowe\'s horn back to the boat. The strip at the top says which way.', { icon: 'anchor', ms: 5000 }); }
  }
  /** For the sea strip: in fog and off the boat, which way she is. */
  hornHint() {
    if (this.fogK < 0.5) return '';
    const g = this.game, ow = this.ow, p = g.player.pos, P = ow.boat.pose;
    if (ow.boat.deckY(p.x, p.z) != null) return 'fog';
    const d = Math.hypot(P.x - p.x, P.z - p.z);
    return d < 10 ? 'fog' : `fog · the boat is ${Math.round(d)} m ${compass(P.x - p.x, P.z - p.z)}`;
  }
  boost(ctx, bobber) {
    let b = null;
    if (bobber && this.inBaitball(bobber.x, bobber.z)) { ctx.baitball = true; b = { ...BAIT_BOOST }; }
    if (this.fogK > 0.5) b = { ...(b || {}), ...FOG_BOOST };
    return b;
  }
}
