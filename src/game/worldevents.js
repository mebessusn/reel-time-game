// Rare world events, the same for everyone (seeded by the in-game day):
//   Meteor shower (some nights): shooting stars, rare fish up 30%.
//   Fog night: thick fog rolls in and the Sunken Ruins glow; the Lanternfish is twice as likely.
//   Migration morning (some dawns): schools of fish leap across the cove; bites come much faster.
// ?event=meteor|fog|migration forces one (for testing).
import * as THREE from 'three';
import { mulberry32 } from '../core/rng.js';
import { DEEP_C, WATER_Y, isWater } from '../world/terrain.js';

const FORCED = typeof location !== 'undefined' ? new URLSearchParams(location.search).get('event') : null;

export const EVENT_INFO = {
  meteor: { name: 'Meteor shower', blurb: 'Shooting stars! Rare fish are 30% more likely tonight.' },
  fog: { name: 'Fog night', blurb: 'A thick fog rolls in and the Sunken Ruins are glowing. The Lanternfish stirs.' },
  migration: { name: 'Migration morning', blurb: 'Schools of fish are pouring through the cove. Bites come fast this dawn!' },
};

/** Pure: which event (if any) is on for a world time. */
export function eventFor(wt) {
  if (FORCED && EVENT_INFO[FORCED]) return FORCED;
  const r = mulberry32(wt.day * 104729 + 3)();
  if (wt.phase === 'night' && r < 0.18 && wt.weather !== 'storm' && wt.weather !== 'rain') return 'meteor';
  if (wt.phase === 'night' && r >= 0.18 && r < 0.3 && wt.weather !== 'storm') return 'fog';
  if (wt.phase === 'dawn' && r >= 0.5 && r < 0.72) return 'migration';
  return null;
}

export class WorldEvents {
  constructor(game) {
    this.game = game;
    this.current = null;
    this.t = 0;
    const scene = game.engine.scene;
    // shooting stars: glowing ribbons, bright at the head and fading down the tail (additive, so black = invisible)
    const geo = new THREE.BufferGeometry();
    this.streakPos = new Float32Array(6 * 4 * 3);
    const col = new Float32Array(6 * 4 * 3), idx = [];
    for (let i = 0; i < 6; i++) {
      col.set([1, 0.97, 0.85, 1, 0.97, 0.85, 0, 0, 0, 0, 0, 0], i * 12);
      const b = i * 4; idx.push(b, b + 1, b + 2, b + 1, b + 3, b + 2);
    }
    geo.setAttribute('position', new THREE.BufferAttribute(this.streakPos, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    geo.setIndex(idx);
    this.streaks = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, depthWrite: false, side: THREE.DoubleSide, fog: false, blending: THREE.AdditiveBlending }));
    this.streaks.frustumCulled = false;
    this.streaks.renderOrder = -1;
    this.streaks.visible = false;
    this.meteors = Array.from({ length: 6 }, () => ({ life: 0 }));
    this._v = [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()];
    scene.add(this.streaks);
    // the ruins' glow on fog nights
    this.glow = new THREE.PointLight('#ffd060', 0, 28, 1.4);
    this.glow.position.set(DEEP_C.x, WATER_Y + 1.5, DEEP_C.z);
    // v1.8.2: a soft shaft of light, not a solid cone: brightest at the water, fading upward and toward its
    // edges (seen from any side), drawn into the fog like everything else
    const beamMat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, fog: true,
      uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { opacity: { value: 0 }, uColor: { value: new THREE.Color('#ffc870') } }]),
      vertexShader: `varying float vH; varying float vEdge; varying vec3 vN;
        #include <fog_pars_vertex>
        void main() {
          vH = uv.y;
          vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
          vec3 n = normalize(normalMatrix * normal);
          vEdge = abs(dot(n, normalize(-mvPosition.xyz)));
          gl_Position = projectionMatrix * mvPosition;
          #include <fog_vertex>
        }`,
      fragmentShader: `uniform float opacity; uniform vec3 uColor; varying float vH; varying float vEdge;
        #include <fog_pars_fragment>
        void main() {
          float a = opacity * pow(1.0 - vH, 1.6) * pow(vEdge, 2.2);
          gl_FragColor = vec4(uColor * a, a);
          #include <fog_fragment>
        }`,
    });
    Object.defineProperty(beamMat, 'opacity', { get() { return this.uniforms.opacity.value; }, set(v) { if (this.uniforms) this.uniforms.opacity.value = v; } });
    const beam = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 3.0, 9, 24, 1, true), beamMat);
    beam.position.set(DEEP_C.x, WATER_Y + 4.5, DEEP_C.z);
    this.beam = beam;
    const ring = new THREE.Mesh(new THREE.RingGeometry(2.2, 4.2, 32), new THREE.MeshBasicMaterial({ color: '#ffd870', transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide, fog: true, blending: THREE.AdditiveBlending }));
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(DEEP_C.x, WATER_Y + 0.06, DEEP_C.z);
    this.ring = ring;
    scene.add(this.glow, beam, ring);
  }

  /** Context for bites. */
  get ctxEvent() { return this.current; }

  tick() {
    const g = this.game;
    const ev = eventFor(g.engine.sky.state);
    if (ev !== this.current) {
      this.current = ev;
      if (ev) {
        g.chat?.system(`${EVENT_INFO[ev].name}! ${EVENT_INFO[ev].blurb}`, 'event', { popup: true });
        g.ext.change((d) => { d.stats[`event_${ev}`] = (d.stats[`event_${ev}`] || 0) + 1; });
      }
    }
  }

  update(dt, t) {
    const g = this.game;
    const ev = this.current;
    const cam = g.engine.camera.position;
    // meteor shower
    // a shooting star now and then on any clear night (about one every half minute); a shower during the event
    const wt = g.engine.sky.state;
    const night = wt.phase === 'night' && wt.weather !== 'rain' && wt.weather !== 'storm';
    this.streaks.visible = ev === 'meteor' || night || this.meteors.some((m) => m.life > 0);
    if (this.streaks.visible) {
      const rate = ev === 'meteor' ? 0.5 : night ? 0.006 : 0;
      for (let i = 0; i < this.meteors.length; i++) {
        const m = this.meteors[i];
        if (m.life <= 0 && Math.random() < dt * rate) {
          const a = Math.random() * Math.PI * 2;
          if (Math.random() < 0.45) { // high overhead, for anyone looking straight up
            const d = Math.random() * 50;
            Object.assign(m, { life: 1, x: cam.x + Math.cos(a) * d, y: cam.y + 95 + Math.random() * 35, z: cam.z + Math.sin(a) * d, vx: Math.cos(a + 1.6) * 70, vy: -10, vz: Math.sin(a + 1.6) * 70 });
          } else Object.assign(m, { life: 1, x: cam.x + Math.cos(a) * 140, y: cam.y + 32 + Math.random() * 26, z: cam.z + Math.sin(a) * 140, vx: -Math.cos(a) * 60 + (Math.random() - 0.5) * 40, vy: -12, vz: -Math.sin(a) * 60 + (Math.random() - 0.5) * 40 });
          if (Math.random() < 0.3) g.audio.sfx('meteor');
        }
        if (m.life > 0) {
          m.life -= dt * 1.4; m.x += m.vx * dt; m.y += m.vy * dt; m.z += m.vz * dt;
          // ribbon across the view: side = vel x (to camera), head wide, tail thin
          const [vel, toCam, side] = this._v;
          vel.set(m.vx, m.vy, m.vz);
          toCam.set(cam.x - m.x, cam.y - m.y, cam.z - m.z);
          const dist = toCam.length();
          side.crossVectors(vel, toCam).normalize().multiplyScalar(dist * 0.003 * Math.min(1, m.life * 2.5));
          const tl = 0.22, hx = m.x, hy = m.y, hz = m.z, tx = m.x - m.vx * tl, ty = m.y - m.vy * tl, tz = m.z - m.vz * tl;
          this.streakPos.set([hx + side.x, hy + side.y, hz + side.z, hx - side.x, hy - side.y, hz - side.z,
            tx + side.x * 0.2, ty + side.y * 0.2, tz + side.z * 0.2, tx - side.x * 0.2, ty - side.y * 0.2, tz - side.z * 0.2], i * 12);
        } else this.streakPos.fill(-999, i * 12, i * 12 + 12);
      }
      this.streaks.geometry.attributes.position.needsUpdate = true;
    }
    // fog night: pull the fog in and light the ruins
    const fogOn = ev === 'fog';
    this.glow.intensity += ((fogOn ? 3 + Math.sin(t * 2) * 0.6 : 0) - this.glow.intensity) * Math.min(1, dt);
    this.beam.material.opacity += ((fogOn ? 0.55 + Math.sin(t * 1.3) * 0.12 : 0) - this.beam.material.opacity) * Math.min(1, dt);
    this.beam.visible = this.beam.material.opacity > 0.005;
    this.ring.material.opacity = this.beam.material.opacity * 0.5;
    this.ring.visible = this.beam.visible;
    this.ring.scale.setScalar(1 + Math.sin(t * 1.7) * 0.08);
    if (fogOn) { g.engine.scene.fog.near = 6; g.engine.scene.fog.far = 55; }
    // migration: fish leaping in lines across the cove
    if (ev === 'migration' && Math.random() < dt * 6) {
      const k = (t * 0.07) % 1;
      const x = -26 + k * 52 + (Math.random() - 0.5) * 6, z = -20 + Math.sin(k * 6) * 10 + (Math.random() - 0.5) * 6;
      if (isWater(x, z)) { g.fx.splash(new THREE.Vector3(x, WATER_Y, z), 0.5); g.engine.water.ripple(x, z, 0.4); }
    }
  }
}
