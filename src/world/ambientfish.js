// Ambient fish: small schools of common/uncommon fish, and bigger loners cruising on their own, under the surface so the water
// feels alive. Purely decorative and local to each player (no networking). They scatter from
// bobbers and boats.
import * as THREE from 'three';
import { HALF, heightAt, WATER_Y, zoneAt } from './terrain.js';
import { SPECIES } from '../data/species.js';
import { softFishModel } from '../entities/softfish.js';
import { mulberry32 } from '../core/rng.js';

const SCHOOLS = 40; // schools and loners together
const VIEW_R = 48; // only draw and animate schools near the camera focus (v1.13.19: was 70; past this they're lost in the water)

function deepEnough(x, z, need = 1.2) {
  const h = heightAt(x, z);
  return h <= 0 && WATER_Y - h >= need;
}

export class AmbientFish {
  constructor(scene, count = SCHOOLS) {
    this.group = new THREE.Group();
    this.group.name = 'ambient-fish';
    scene.add(this.group);
    const r = mulberry32(4242);
    this.r = r;
    const pool = SPECIES.filter((s) => (s.tier === 'common' || s.tier === 'uncommon') && !s.weather && !s.shell && !s.spots);
    this.schools = [];
    for (let i = 0; i < count; i++) {
      const home = this.randomSpot();
      if (!home) break;
      const zone = zoneAt(home.x, home.z) || 'open';
      const local = pool.filter((s) => s.zones.includes(zone));
      const sp = (local.length ? local : pool)[Math.floor(r() * (local.length || pool.length))];
      // about 45% swim alone: usually the bigger fish (bass, pike, carp, catfish), slower and roaming wider
      const solo = r() < 0.45;
      const n = solo ? 1 : 3 + Math.floor(r() * 4);
      const model = softFishModel(sp.id, 'normal', { lod: 2 }); // v1.13.19: the light version (seen faintly through the water)
      // Seen through the surface: drawn after the water, tinted and see-through
      const mat = model.material.clone();
      mat.transparent = true; mat.opacity = 0.62; mat.depthWrite = false;
      mat.color = new THREE.Color('#9cc8d8');
      const len = solo ? 0.85 + r() * 0.55 : 0.62 + r() * 0.4;
      const scale = len / model.length;
      const fish = [];
      for (let k = 0; k < n; k++) {
        const m = new THREE.Mesh(model.geometry, mat);
        m.renderOrder = 3;
        m.scale.setScalar(scale * (0.85 + r() * 0.3));
        m.castShadow = false;
        m.position.set(home.x + (r() - 0.5) * 2, home.y, home.z + (r() - 0.5) * 2);
        this.group.add(m);
        fish.push({ m, off: solo ? new THREE.Vector3() : new THREE.Vector3((r() - 0.5) * 1.6, (r() - 0.5) * 0.35, (r() - 0.5) * 1.6), phase: r() * 6.28, speed: 0.9 + r() * 0.3, vel: new THREE.Vector3() });
      }
      this.schools.push({ species: sp.id, solo, fish, pos: new THREE.Vector3(home.x, home.y, home.z), target: new THREE.Vector3(home.x, home.y, home.z), speed: solo ? 0.45 + r() * 0.45 : 0.7 + r() * 0.6, wait: 0, flee: 0 });
    }
  }

  randomSpot(near = null, radius = 14) {
    for (let t = 0; t < 40; t++) {
      const x = near ? near.x + (this.r() - 0.5) * radius * 2 : (this.r() - 0.5) * HALF * 1.8;
      const z = near ? near.z + (this.r() - 0.5) * radius * 2 : (this.r() - 0.5) * HALF * 1.8;
      if (!deepEnough(x, z, 1.4)) continue;
      const bed = heightAt(x, z);
      const y = Math.max(bed + 0.45, WATER_Y - 0.4 - this.r() * Math.min(0.9, WATER_Y - bed - 1));
      return { x, y, z };
    }
    return null;
  }

  // scare: list of {x, z} points (bobbers, boats, splashes) that make nearby schools dart away
  update(dt, t, focus, scare = []) {
    for (const s of this.schools) {
      const far = Math.hypot(s.pos.x - focus.x, s.pos.z - focus.z) > VIEW_R;
      for (const f of s.fish) f.m.visible = !far;
      if (far) continue;
      // fright
      for (const p of scare) {
        const dx = s.pos.x - p.x, dz = s.pos.z - p.z;
        const d = Math.hypot(dx, dz);
        if (d < 3.2 && s.flee <= 0) {
          s.flee = 1.4;
          const away = this.randomSpot({ x: s.pos.x + (dx / (d || 1)) * 7, z: s.pos.z + (dz / (d || 1)) * 7 }, 3) || this.randomSpot(s.pos, 10);
          if (away) s.target.set(away.x, away.y, away.z);
        }
      }
      s.flee = Math.max(0, s.flee - dt);
      // wander
      const toT = new THREE.Vector3().subVectors(s.target, s.pos);
      const dist = toT.length();
      if (dist < 0.6) {
        s.wait -= dt;
        if (s.wait <= 0) {
          const nxt = this.randomSpot(s.pos, s.solo ? 18 : 12);
          if (nxt) s.target.set(nxt.x, nxt.y, nxt.z);
          s.wait = s.solo ? 2 + this.r() * 7 : 1 + this.r() * 4; // loners hang still, then cruise off
        }
      } else {
        const sp = s.speed * (s.flee > 0 ? 4 : 1);
        toT.multiplyScalar(Math.min(dist, sp * dt) / dist);
        const nx = s.pos.x + toT.x, nz = s.pos.z + toT.z;
        if (deepEnough(nx, nz, 1.1)) s.pos.add(toT);
        else { const nxt = this.randomSpot(s.pos, 8); if (nxt) s.target.set(nxt.x, nxt.y, nxt.z); }
      }
      // members follow the school point with a little lag and a wiggle
      for (const f of s.fish) {
        const want = new THREE.Vector3(
          s.pos.x + f.off.x + Math.sin(t * 0.7 + f.phase) * (s.solo ? 0.12 : 0.3),
          s.pos.y + f.off.y + Math.sin(t * 1.1 + f.phase) * 0.06,
          s.pos.z + f.off.z + Math.cos(t * 0.6 + f.phase) * (s.solo ? 0.12 : 0.3));
        const bed = heightAt(want.x, want.z);
        want.y = Math.min(WATER_Y - 0.25, Math.max(bed + 0.3, want.y));
        const k = Math.min(1, dt * (s.flee > 0 ? 6 : 2.2) * f.speed);
        f.vel.subVectors(want, f.m.position).multiplyScalar(k);
        f.m.position.add(f.vel);
        const vx = f.vel.x, vz = f.vel.z;
        if (vx * vx + vz * vz > 1e-7) {
          let yaw = Math.atan2(-vz, vx);
          let d = yaw - f.m.rotation.y; d = Math.atan2(Math.sin(d), Math.cos(d));
          f.m.rotation.y += d * Math.min(1, dt * 6);
        }
        // tail-wag: a quick yaw wobble, faster when fleeing
        f.m.rotation.x = 0;
        f.m.rotation.z = Math.sin(t * (s.flee > 0 ? 22 : 9) + f.phase) * 0.04;
        f.m.rotation.y += Math.sin(t * (s.flee > 0 ? 20 : 8) + f.phase) * 0.012;
      }
    }
  }
}
