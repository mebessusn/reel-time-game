// Feeding schools ("swirls" in code): schools of fish that gather at new open-water spots every few minutes.
// Fishing inside one *from a boat* boosts rare odds. They only spawn far beyond cast range of
// any shore, dock or island, so walkers can't reach them. Everyone sees the same pools: positions
// come from the shared wall clock.
import * as THREE from 'three';
import { HALF, heightAt, onDock, boatable, WATER_Y, waterBody, zoneAt } from './terrain.js';
import { mulberry32 } from '../core/rng.js';
import { leviathanAt } from './frostbones.js';
import { gateAt } from '../game/spots.js';

export const SWIRL_MS = 6 * 60 * 1000; // pools move every 6 real minutes
export const SWIRL_R = 3.2; // fishing radius
const MIN_SHORE = 21; // max cast is ~18 + perks; keep pools out of reach from land
const MAX_POOLS = 8;
// v1.8.1: the big waters always have two pools spinning; the small ones get one
const SLOTS = { cove: 2, marsh: 2, frost: 2, pond: 1, quarry: 1 };
// after a pool spins out, its slot rests this long before the next one opens
export const SWIRL_REST_MS = 60 * 1000;
const FADE_MS = 15000;
// Each school gives up a limited number of fish (SUCCESSFUL casts only, shared by everyone on the lake),
// then scatters and a new one gathers elsewhere in the same water. Usage comes from the shared db via
// setSwirlUsage(). (v1.8.2: was 12 casts, landed or not.)
export const SWIRL_CATCHES = 8;
export const SWIRL_CASTS = SWIRL_CATCHES; // old name
const usage = new Map(); // poolId -> fish caught so far
const lastCast = new Map(); // poolId -> time of its latest catch (when it scattered, once it is used up)
export function setSwirlUsage(map, times = null) {
  usage.clear(); for (const [k, v] of map) usage.set(k, v);
  if (times) for (const [k, v] of times) lastCast.set(k, Math.max(lastCast.get(k) || 0, v));
}
export function noteSwirlCast(poolId, at = Date.now()) { usage.set(poolId, (usage.get(poolId) || 0) + 1); lastCast.set(poolId, Math.max(lastCast.get(poolId) || 0, at)); }
export const swirlCastsLeft = (pool) => Math.max(0, SWIRL_CATCHES - (usage.get(pool.id) || 0));
export const noteSwirlCatch = noteSwirlCast, swirlCatchesLeft = swirlCastsLeft;

let candidates = null;
function findCandidates() {
  if (candidates) return candidates;
  const N = HALF * 2, INF = 1e9;
  const solid = (x, z) => heightAt(x, z) > 0 || onDock(x + 0.5, z + 0.5);
  // 1) chamfer distance transform (fast, slightly over-estimates) as a pre-filter
  const D = new Float32Array(N * N);
  for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) D[i * N + j] = solid(i - HALF, j - HALF) ? 0 : INF;
  const S2 = Math.SQRT2;
  for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) {
    let d = D[i * N + j];
    if (i > 0) d = Math.min(d, D[(i - 1) * N + j] + 1, j > 0 ? D[(i - 1) * N + j - 1] + S2 : INF, j < N - 1 ? D[(i - 1) * N + j + 1] + S2 : INF);
    if (j > 0) d = Math.min(d, D[i * N + j - 1] + 1);
    D[i * N + j] = d;
  }
  for (let i = N - 1; i >= 0; i--) for (let j = N - 1; j >= 0; j--) {
    let d = D[i * N + j];
    if (i < N - 1) d = Math.min(d, D[(i + 1) * N + j] + 1, j < N - 1 ? D[(i + 1) * N + j + 1] + S2 : INF, j > 0 ? D[(i + 1) * N + j - 1] + S2 : INF);
    if (j < N - 1) d = Math.min(d, D[i * N + j + 1] + 1);
    D[i * N + j] = d;
  }
  // 2) the chamfer distance over-estimates by at most ~8%, so ask for a little more than MIN_SHORE
  // (an exact shoreline check is too slow on the v1.8 map)
  const out = [];
  for (let x = -HALF; x < HALF; x += 2) for (let z = -HALF; z < HALF; z += 2) {
    if (Math.hypot(x - 131.2, z - 159.6) < 21) continue; // clear of the old wreck in Lilymarsh
    const zn = zoneAt(x, z);
    // v1.8.2: the small lakes (the quarry, Fern Pond) can't fit a spot out of casting range of land, so
    // their schools sit as far out as the water allows
    const minShore = zn === 'quarry' ? 7 : zn === 'pond' ? 11 : MIN_SHORE;
    if (D[(x + HALF) * N + z + HALF] < minShore * 1.09) continue;
    if (!boatable(x, z) || heightAt(x, z) > -2) continue;
    if (leviathanAt(x, z, 6)) continue; // v1.9.13: not under the Frozen Leviathan's ice
    if (!zn || zn === 'cave' || zn === 'river') continue;
    // v1.13.7: is the whole pool on the lake's open water (its base level), clear of the level-gated deep end and
    // landmark? Pools there are fishable as soon as you can fish the lake at all.
    const px = x + 0.5, pz = z + 0.5;
    let open = gateAt(px, pz).tier === 'base';
    for (let i = 0; open && i < 8; i++) { const a = (i / 8) * Math.PI * 2; if (gateAt(px + Math.cos(a) * (SWIRL_R + 0.8), pz + Math.sin(a) * (SWIRL_R + 0.8)).tier !== 'base') open = false; }
    out.push({ x: px, z: pz, open });
  }
  candidates = out;
  return out;
}

const epochCache = new Map();
// Pools active in a given epoch (deterministic for every client).
export function poolsForEpoch(epoch) {
  if (epochCache.has(epoch)) return epochCache.get(epoch);
  const cand = findCandidates();
  if (!cand.length) return [];
  // group by lake so pools spread across the valley (cove + river + marsh count as one water body,
  // but the marsh gets its own slot so it sees pools too)
  const groups = {};
  for (const c of cand) {
    const z0 = zoneAt(c.x, c.z);
    const key = ['frost', 'marsh', 'pond', 'quarry'].includes(z0) ? z0 : 'cove';
    const gr = (groups[key] = groups[key] || { open: [], gated: [] });
    (c.open ? gr.open : gr.gated).push(c);
  }
  const keys = Object.keys(groups).sort();
  const r = mulberry32((epoch * 7919 + 99) >>> 0);
  const out = [];
  for (const k of keys) for (let n = 0; n < (SLOTS[k] || 1) && out.length < MAX_POOLS; n++) {
    const { open, gated } = groups[k];
    // a slot: the first pool and the spots its replacements open at, each a fair way from the last and
    // from the other pools on the same water. v1.13.7: about 9 in 10 sit on open water anyone who can fish
    // the lake can reach; the rest may drift over the deep end or the landmark.
    const seq = [];
    let wantGated = r() < 0.1; // rolled once per position, so retries don't add up
    for (let tries = 0; tries < 80 && seq.length < 6; tries++) {
      const list = (wantGated && gated.length) || !open.length ? gated : open;
      const c = list[Math.floor(r() * list.length)];
      const prev = seq[seq.length - 1];
      if (!seq.length && !out.every((p) => Math.hypot(p.x - c.x, p.z - c.z) > 16) && tries < 60) continue;
      if (prev && Math.hypot(prev.x - c.x, prev.z - c.z) < 10 && tries < 60) continue;
      seq.push({ x: c.x, z: c.z });
      wantGated = r() < 0.1;
    }
    if (seq.length) out.push({ x: seq[0].x, z: seq[0].z, id: `${epoch}:${out.length}`, slot: out.length, seq, water: k });
  }
  if (epochCache.size > 8) epochCache.clear();
  epochCache.set(epoch, out);
  return out;
}

export function activePools(now = Date.now()) {
  const epoch = Math.floor(now / SWIRL_MS);
  const into = now - epoch * SWIRL_MS;
  const left = SWIRL_MS - into;
  const strength = Math.min(1, into / FADE_MS, left / FADE_MS);
  const out = [];
  for (const slot of poolsForEpoch(epoch)) {
    let gen = 0;
    while (gen < 24 && (usage.get(`${epoch}:${slot.slot}:${gen}`) || 0) >= SWIRL_CASTS) gen++;
    // the slot rests for a minute after a pool spins out, then the next one opens (fading in)
    let born = 1;
    if (gen > 0) {
      const spent = lastCast.get(`${epoch}:${slot.slot}:${gen - 1}`) || 0;
      if (now - spent < SWIRL_REST_MS) continue;
      born = Math.min(1, (now - spent - SWIRL_REST_MS) / FADE_MS);
    }
    const at = slot.seq[gen % slot.seq.length];
    out.push({ x: at.x, z: at.z, id: `${epoch}:${slot.slot}:${gen}`, slot: slot.slot, gen, water: slot.water, strength: Math.min(strength, born) });
  }
  return out;
}

export function swirlAt(x, z, now = Date.now()) {
  return activePools(now).find((p) => p.strength > 0.2 && Math.hypot(p.x - x, p.z - z) <= SWIRL_R) || null;
}

// ---------------------------------------------------------------- visuals
// v1.8.2: a feeding school, not a whirlpool. A patch of churned, glittering water where a school of fish
// circles just under the surface: backs and fins break the water, and every few moments one leaps clear
// with a splash and a ring. (The mechanics are unchanged: casts from a boat, limited casts, a minute's rest.)
const FISH_PER = 14;

const patchMat = () => new THREE.ShaderMaterial({
  transparent: true, depthWrite: false,
  uniforms: { uTime: { value: 0 }, uStrength: { value: 1 }, uLight: { value: 1 } },
  vertexShader: /* glsl */ `varying vec2 vUv; void main() { vUv = uv * 2.0 - 1.0; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  fragmentShader: /* glsl */ `
    uniform float uTime; uniform float uStrength; uniform float uLight; varying vec2 vUv;
    float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
    float noise(vec2 p) {
      vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
      return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y);
    }
    void main() {
      float r = length(vUv);
      if (r > 1.0) discard;
      // v1.9: easy to spot from afar: a deep blue pool of darker water spreading out from the middle, with
      // slow rings rolling outward, and the churn and glints of the school in the inner part
      float ri = r * 1.6; // the school itself fills the inner ~60%
      vec2 p = vUv * 8.0;
      float n1 = noise(p * 1.3 + vec2(uTime * 0.9, -uTime * 0.6));
      float n2 = noise(p * 2.7 - vec2(uTime * 1.4, uTime * 1.1));
      float chop = n1 * 0.6 + n2 * 0.4;
      float inner = smoothstep(1.0, 0.55, ri);
      float crest = smoothstep(0.66, 0.82, chop) * inner;
      float glint = step(0.985, hash(floor(p * 4.0) + floor(uTime * 7.0))) * smoothstep(1.0, 0.3, ri);
      float deep = pow(1.0 - r, 1.4); // the gradient: darkest in the middle, fading out to open water
      float rings = (0.5 + 0.5 * sin(r * 22.0 - uTime * 2.4)) * smoothstep(1.0, 0.35, r) * smoothstep(0.1, 0.35, r);
      vec3 col = mix(vec3(0.10, 0.30, 0.45), vec3(0.0, 0.05, 0.17), deep);
      col = mix(col, vec3(0.30, 0.55, 0.70), rings * 0.25);
      col = mix(col, vec3(0.86, 0.94, 0.97), crest * 0.7);
      col += vec3(1.0) * glint * 0.8;
      float alpha = deep * 0.92 + rings * 0.08 * (1.0 - r) + crest * 0.5 + glint * 0.7;
      gl_FragColor = vec4(col * max(uLight, 0.55), clamp(alpha, 0.0, 0.92) * uStrength);
    }`,
});

// a small low-poly fish: a slim body (dark back, silver belly) and a forked tail, nose along +Z
function fishGeo() {
  const body = new THREE.SphereGeometry(1, 7, 5);
  body.scale(0.075, 0.065, 0.22);
  const tail = new THREE.BufferGeometry();
  tail.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, -0.18, 0, 0.09, -0.33, 0, 0, -0.27, 0, 0, -0.18, 0, 0, -0.27, 0, -0.08, -0.33], 3));
  const parts = [body.toNonIndexed(), tail];
  body.dispose();
  for (const g of parts) {
    const pos = g.attributes.position, col = new Float32Array(pos.count * 3);
    for (let i = 0; i < pos.count; i++) {
      const y = pos.getY(i), k = Math.max(0, Math.min(1, (y + 0.065) / 0.13));
      const c = new THREE.Color('#d8e2e6').lerp(new THREE.Color('#33454f'), k); // silver belly to dark back
      col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
    }
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  }
  const merged = new THREE.BufferGeometry();
  const cat = (name) => { const a = parts.map((g) => g.attributes[name].array); const out = new Float32Array(a.reduce((n, x) => n + x.length, 0)); let o = 0; for (const x of a) { out.set(x, o); o += x.length; } return out; };
  merged.setAttribute('position', new THREE.BufferAttribute(cat('position'), 3));
  merged.setAttribute('color', new THREE.BufferAttribute(cat('color'), 3));
  merged.computeVertexNormals();
  parts.forEach((g) => g.dispose());
  return merged;
}

export class SwirlField {
  constructor(scene, fx = null) {
    this.fx = fx;
    this.water = null; // set by the game: rings on the surface where fish break it
    this.fxT = 0;
    this.scene = scene;
    this.meshes = new Map();
    this.epoch = -1;
    this.R = SWIRL_R * 1.15;
    this.geo = new THREE.CircleGeometry(this.R * 1.6, 48).rotateX(-Math.PI / 2); // the dark pool spreads past the fishing radius
    this.fish = new THREE.InstancedMesh(fishGeo(), new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true, side: THREE.DoubleSide }), MAX_POOLS * FISH_PER);
    this.fish.frustumCulled = false; this.fish.name = 'school-fish';
    scene.add(this.fish);
    this.schools = new Map(); // poolId -> [{ a, r, speed, phase, jump, next }]
    this._m = new THREE.Matrix4(); this._q = new THREE.Quaternion(); this._e = new THREE.Euler(); this._v = new THREE.Vector3(); this._s = new THREE.Vector3();
    this.onChange = null;
  }
  update(t, light = 1, dt = 1 / 60) {
    const now = Date.now();
    const pools = activePools(now);
    const epoch = Math.floor(now / SWIRL_MS);
    const sig = pools.map((p) => p.id).join(',');
    if (sig !== this.sig) {
      const first = this.epoch === -1, newEpoch = epoch !== this.epoch;
      this.epoch = epoch; this.sig = sig;
      // a fished-out school scatters (its patch fades); a new one gathers somewhere else
      for (const [id, m] of this.meshes) {
        if (pools.some((p) => p.id === id)) continue;
        this.meshes.delete(id);
        if (newEpoch) { this.scene.remove(m); m.material.dispose(); continue; }
        (this.dying = this.dying || []).push({ m, t: 1 });
        this.onSpent?.(m.position);
      }
      for (const p of pools) {
        if (this.meshes.has(p.id)) continue;
        const m = new THREE.Mesh(this.geo, patchMat());
        m.position.set(p.x, WATER_Y + 0.03, p.z);
        m.renderOrder = 3;
        m.name = 'swirl';
        m.userData.born = newEpoch ? 1 : 0;
        this.scene.add(m);
        this.meshes.set(p.id, m);
      }
      if (!first && newEpoch && pools.length) this.onChange?.(pools);
    }
    if (this.dying?.length) {
      for (const d of this.dying) { d.t -= dt / 3; d.m.material.uniforms.uStrength.value = Math.max(0, d.t); d.m.material.uniforms.uTime.value = t; }
      for (const d of this.dying.filter((x) => x.t <= 0)) { this.scene.remove(d.m); d.m.material.dispose(); }
      this.dying = this.dying.filter((x) => x.t > 0);
    }
    this.fxT -= dt;
    const flick = this.fx && this.fxT <= 0;
    if (flick) this.fxT = 0.12;
    let fi = 0;
    const R = this.R;
    for (const p of pools) {
      const m = this.meshes.get(p.id);
      if (m) {
        m.material.uniforms.uTime.value = t;
        m.userData.born = Math.min(1, (m.userData.born || 0) + dt / 3);
        m.material.uniforms.uStrength.value = p.strength * m.userData.born;
        m.material.uniforms.uLight.value = light;
      }
      const k = p.strength * (m?.userData.born ?? 1);
      // little flicks of spray where backs and tails break the surface
      if (flick && k > 0.3) {
        const a = Math.random() * Math.PI * 2, rr = Math.sqrt(Math.random()) * R * 0.75;
        const x = p.x + Math.cos(a) * rr, z = p.z + Math.sin(a) * rr;
        for (let i = 0; i < 4; i++) this.fx.spawn(x, WATER_Y + 0.05, z, (Math.random() - 0.5) * 0.8, 0.8 + Math.random() * 0.9, (Math.random() - 0.5) * 0.8, i % 2 ? '#e8f6ff' : '#bfe4f4', 0.45, -9);
      }
      let st = this.schools.get(p.id);
      if (!st) {
        st = Array.from({ length: FISH_PER }, () => ({ a: Math.random() * 6.283, r: 0.2 + Math.random() * 0.6, speed: (0.5 + Math.random() * 0.5) * (Math.random() < 0.85 ? 1 : -1), phase: Math.random() * 6.283, jump: null, next: 1 + Math.random() * 10 }));
        this.schools.set(p.id, st);
      }
      for (const f of st) {
        let x, y, z, yaw, pitch = 0;
        if (f.jump) {
          // a leap: a short arc clear of the water, nose up then down
          const J = f.jump;
          J.t += dt;
          const u = Math.min(1, J.t / J.dur);
          x = J.x0 + (J.x1 - J.x0) * u; z = J.z0 + (J.z1 - J.z0) * u;
          y = WATER_Y - 0.1 + Math.sin(Math.PI * u) * J.h;
          yaw = J.yaw; pitch = -Math.cos(Math.PI * u) * 0.9;
          if (u >= 1) {
            this.fx?.splash(new THREE.Vector3(x, WATER_Y, z), 0.45);
            this.water?.ripple(x, z, 0.5);
            f.jump = null; f.next = 3 + Math.random() * 9;
            f.a = Math.atan2(z - p.z, x - p.x); f.r = Math.min(0.85, Math.hypot(x - p.x, z - p.z) / R);
          }
        } else {
          f.a += f.speed * dt * (0.8 + k * 0.4);
          f.r = Math.max(0.15, Math.min(0.85, f.r + Math.sin(t * 0.7 + f.phase) * dt * 0.08));
          x = p.x + Math.cos(f.a) * f.r * R; z = p.z + Math.sin(f.a) * f.r * R;
          y = WATER_Y - 0.11 + Math.sin(t * 2.3 + f.phase) * 0.08; // backs roll up through the surface now and then
          yaw = Math.atan2(-Math.sin(f.a) * Math.sign(f.speed), Math.cos(f.a) * Math.sign(f.speed));
          f.next -= dt;
          if (f.next <= 0 && k > 0.5) {
            const h = 0.45 + Math.random() * 0.45, len = 0.8 + Math.random() * 0.8;
            f.jump = { t: 0, dur: 0.55 + h * 0.4, h, x0: x, z0: z, x1: x + Math.sin(yaw) * len, z1: z + Math.cos(yaw) * len, yaw };
            this.fx?.splash(new THREE.Vector3(x, WATER_Y, z), 0.3);
          }
        }
        const sc = Math.min(1, k * 1.4) * 1.15;
        this._e.set(pitch, yaw, 0, 'YXZ');
        this._m.compose(this._v.set(x, y, z), this._q.setFromEuler(this._e), this._s.set(sc, sc, sc));
        if (fi < this.fish.count) this.fish.setMatrixAt(fi++, this._m);
      }
    }
    // hide unused fish and forget schools that are gone
    this._m.makeScale(0, 0, 0);
    for (; fi < this.fish.count; fi++) this.fish.setMatrixAt(fi, this._m);
    this.fish.instanceMatrix.needsUpdate = true;
    for (const id of this.schools.keys()) if (!pools.some((p) => p.id === id)) this.schools.delete(id);
    this.pools = pools;
  }
}
