// Ground cover for the smooth valley: lush grass tufts that sway in the wind (drawn in tiles around you),
// bushes, big mossy boulders and fallen branches scattered across the meadows. Everything keeps off the
// paths, the water, the docks and anything solid.
import * as THREE from 'three';
import { mergeGeometries, mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { camperAt } from './campers.js';
import { leviathanAt } from './frostbones.js';
import { surfaceY, grassAt, heightAt, groundY, onDock, trailDist, WATER_Y, HALF, CLEARINGS, LAKES } from './terrain.js';
import { blocked, addCircle } from './colliders.js';
import { natureBushes } from './nature.js';
import { caveRockAt } from './cave.js';
import { splitByTiles } from '../render/cull.js';
import { WAYSTONES } from '../game/waystones.js';

const rng = (seed) => () => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const C = (h) => new THREE.Color(h);

// Places nothing should grow: paths, settlements' hearts, waystones, the dock/cabin clearing, your yard, the lighthouse.
function open(x, z, pad = 0) {
  if (trailDist(x, z) < 1.25 + pad) return false;
  // v1.9.2: keep the whole thing (a big boulder's full width) off docks, jetties and bridges
  const dr = 0.6 + pad;
  if (onDock(x, z)) return false;
  for (let i = 0; i < 12; i++) { const a = (i / 12) * Math.PI * 2; for (const k of [0.5, 1]) if (onDock(x + Math.cos(a) * dr * k, z + Math.sin(a) * dr * k)) return false; }
  const y = surfaceY(x, z);
  if (y < WATER_Y + 0.08) return false;
  if (groundY(x, z) == null) return false;
  if (caveRockAt(x, z) > -0.6) return false; // nothing grows on (or through) the cavern's rock
  for (const c of Object.values(CLEARINGS)) if (Math.hypot(x - c.x, z - c.z) < c.r * 0.7) return false;
  if (camperAt(x, z, pad)) return false;
  if (leviathanAt(x, z, pad)) return false; // v1.9.11: nor through the Frozen Leviathan
  for (const w of WAYSTONES) if (Math.hypot(x - w.at.x, z - w.at.z) < 3.5 + pad) return false; // keep every waystone clear to walk up to
  return true;
}

// ---------------------------------------------------------------- shared wind sway
function addWind(mat, wind, strength, key) {
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uWind = wind.uWind; sh.uniforms.uWT = wind.uWT;
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nuniform float uWind; uniform float uWT; attribute float aBend;')
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        {
          #ifdef USE_INSTANCING
            vec3 wp0 = vec3(instanceMatrix[3][0], 0.0, instanceMatrix[3][2]);
          #else
            vec3 wp0 = (modelMatrix * vec4(position, 1.0)).xyz;
          #endif
          float ph = wp0.x * 0.37 + wp0.z * 0.29;
          float gust = 0.35 + uWind;
          float sway = aBend * aBend * ${strength.toFixed(3)} * gust;
          transformed.x += sway * (sin(uWT * 1.9 + ph) + 0.35 * sin(uWT * 4.1 + ph * 1.7));
          transformed.z += sway * 0.55 * cos(uWT * 1.5 + ph);
        }`);
  };
  mat.customProgramCacheKey = () => key;
}

// ---------------------------------------------------------------- grass tufts
function tuftGeometry(r) {
  const geos = [];
  const blades = 7;
  for (let i = 0; i < blades; i++) {
    const h = 0.13 + r() * 0.17, w = 0.03 + r() * 0.022;
    const a = r() * Math.PI, lean = (r() - 0.5) * 0.5;
    const ox = (r() - 0.5) * 0.18, oz = (r() - 0.5) * 0.18;
    // a tapered blade: two triangles, the tip bent over a little
    const pos = [-w, 0, 0, w, 0, 0, w * 0.35, h * 0.6, lean * 0.4, -w * 0.35, h * 0.6, lean * 0.4, 0, h, lean];
    const idx = [0, 1, 2, 0, 2, 3, 3, 2, 4];
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setIndex(idx);
    g.rotateY(a); g.translate(ox, 0, oz);
    const base = C('#4f8f3c'), tip = C(['#a6d66c', '#93c95a', '#b8dc78'][i % 3]);
    const col = [], bend = [];
    const p = g.attributes.position;
    for (let k = 0; k < p.count; k++) { const t = p.getY(k) / 0.3; const c = base.clone().lerp(tip, Math.min(1, t * 1.2)); col.push(c.r, c.g, c.b); bend.push(t); }
    g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    g.setAttribute('aBend', new THREE.Float32BufferAttribute(bend, 1));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(new Array(p.count * 3).fill(0).map((_, j) => (j % 3 === 1 ? 1 : 0)), 3));
    geos.push(g);
  }
  return mergeGeometries(geos);
}

class GrassField {
  constructor(scene, wind) {
    this.scene = scene;
    this.TILE = 12;
    this.tiles = new Map();
    this.geo = tuftGeometry(rng(4242));
    this.mat = new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide });
    addWind(this.mat, wind, 0.09, 'grass-tufts');
    // v1.8.2: both sides of a blade lit the same bright green (no dark backs): keep the up-facing normal
    // on back faces instead of flipping it, so the light doesn't change with which side you see
    const windCompile = this.mat.onBeforeCompile;
    this.mat.onBeforeCompile = (sh, r) => {
      windCompile?.(sh, r);
      sh.fragmentShader = sh.fragmentShader.replace('#include <normal_fragment_begin>', '#include <normal_fragment_begin>\n\tnormal = normalize( vNormal );');
    };
    this.mat.customProgramCacheKey = () => 'grass-tufts-2side';
    this.radius = 30;
    this.t = 0;
  }
  // Low graphics skips grass tufts entirely (their overdraw is the costliest part on weak GPUs); bushes, rocks and twigs stay
  setQuality(q) { this.radius = q === 'low' ? 0 : q === 'high' ? 40 : 28; this.t = 0; }
  buildTile(ti, tj) {
    const T = this.TILE, r = rng(ti * 7919 + tj * 104729 + 17);
    const mats = [];
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0);
    const cols = [];
    const step = 0.55;
    for (let a = 0; a < T; a += step) for (let b = 0; b < T; b += step) {
      const x = ti * T + a + r() * step, z = tj * T + b + r() * step;
      const g = grassAt(x, z);
      if (g < 0.35 || r() > g * 1.15) continue;
      if (!open(x, z, -0.35)) continue;
      if (blocked(x, z, 0.12)) continue;
      const k = 0.7 + r() * 0.65;
      p.set(x, surfaceY(x, z) - 0.02, z);
      q.setFromAxisAngle(up, r() * 6.283);
      s.set(k, k * (0.75 + g * 0.35), k);
      m.compose(p, q, s);
      mats.push(m.clone());
      const tint = 0.82 + r() * 0.3;
      cols.push(tint, tint * (0.96 + r() * 0.08), tint * 0.9);
    }
    if (!mats.length) return null;
    const mesh = new THREE.InstancedMesh(this.geo, this.mat, mats.length);
    mats.forEach((mm, i) => mesh.setMatrixAt(i, mm));
    mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(cols), 3);
    mesh.instanceMatrix.needsUpdate = true;
    mesh.computeBoundingSphere();
    mesh.frustumCulled = true;
    mesh.receiveShadow = true;
    mesh.name = 'grass-tile';
    return mesh;
  }
  update(dt, pos) {
    this.t -= dt;
    if (this.t > 0) return;
    this.t = 0.1;
    if (this.radius <= 0) { for (const mesh of this.tiles.values()) if (mesh) mesh.visible = false; return; }
    const T = this.TILE, R = this.radius;
    const want = new Set();
    const t0 = performance.now();
    for (let i = Math.floor((pos.x - R) / T); i <= Math.floor((pos.x + R) / T); i++) {
      for (let j = Math.floor((pos.z - R) / T); j <= Math.floor((pos.z + R) / T); j++) {
        if (i * T < -HALF || j * T < -HALF || i * T >= HALF || j * T >= HALF) continue;
        const cx = (i + 0.5) * T, cz = (j + 0.5) * T;
        if (Math.hypot(cx - pos.x, cz - pos.z) > R + T * 0.7) continue;
        const key = `${i},${j}`;
        want.add(key);
        if (!this.tiles.has(key)) {
          if (performance.now() - t0 > 6) continue; // about 6 ms of building per check, so it never hitches
          const mesh = this.buildTile(i, j);
          this.tiles.set(key, mesh);
          if (mesh) this.scene.add(mesh);
        } else { const mesh = this.tiles.get(key); if (mesh) mesh.visible = true; }
      }
    }
    for (const [key, mesh] of this.tiles) {
      if (want.has(key)) continue;
      if (mesh) mesh.visible = false;
      if (this.tiles.size > 90 && mesh) { this.scene.remove(mesh); mesh.dispose(); this.tiles.delete(key); }
      else if (this.tiles.size > 90) this.tiles.delete(key);
    }
  }
}

// ---------------------------------------------------------------- bushes
function lumpy(geo, r, amt) {
  const p = geo.attributes.position, v = new THREE.Vector3(), seen = new Map();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    const key = `${v.x.toFixed(3)},${v.y.toFixed(3)},${v.z.toFixed(3)}`;
    if (!seen.has(key)) seen.set(key, 1 + (r() - 0.5) * amt);
    v.multiplyScalar(seen.get(key));
    p.setXYZ(i, v.x, v.y, v.z);
  }
  geo.computeVertexNormals();
  return geo;
}
function paint(geo, fn) {
  const p = geo.attributes.position, n = geo.attributes.normal, col = [];
  const v = new THREE.Vector3(), nn = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) { v.fromBufferAttribute(p, i); nn.fromBufferAttribute(n, i); const c = fn(v, nn); col.push(c.r, c.g, c.b); }
  geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  return geo;
}
function bushGeometry(r, berries) {
  const parts = [];
  const n = 4 + Math.floor(r() * 4), R = 0.45 + r() * 0.35;
  const leaf = C(['#3f7d36', '#4a8a3a', '#356b2e', '#5a8f3c'][Math.floor(r() * 4)]);
  for (let i = 0; i < n; i++) {
    const rr = R * (0.55 + r() * 0.5), a = r() * 6.283, d = R * 0.55 * r();
    // shared vertices so the leafy blobs shade smoothly
    const ico = new THREE.IcosahedronGeometry(rr, 1); ico.deleteAttribute('normal'); ico.deleteAttribute('uv');
    const g = lumpy(mergeVertices(ico), r, 0.28);
    g.scale(1, 0.78, 1);
    g.translate(Math.cos(a) * d, rr * 0.62 + r() * 0.15, Math.sin(a) * d);
    paint(g, (v, nn) => leaf.clone().multiplyScalar(0.72 + Math.max(0, nn.y) * 0.45 + (r() - 0.5) * 0.12));
    const bend = new Float32Array(g.attributes.position.count);
    for (let k = 0; k < bend.length; k++) bend[k] = Math.min(1, g.attributes.position.getY(k) / (R * 1.6));
    g.setAttribute('aBend', new THREE.BufferAttribute(bend, 1));
    parts.push(g);
  }
  if (berries) {
    const bc = C(berries);
    for (let i = 0; i < 9; i++) {
      const a = r() * 6.283, y = R * (0.4 + r() * 0.8);
      const g = new THREE.IcosahedronGeometry(0.045, 0); g.deleteAttribute('uv');
      g.translate(Math.cos(a) * R * 0.85, y, Math.sin(a) * R * 0.85);
      paint(g, () => bc);
      g.setAttribute('aBend', new THREE.BufferAttribute(new Float32Array(g.attributes.position.count).fill(0.5), 1));
      parts.push(g);
    }
  }
  return parts.map((g) => (g.index ? g.toNonIndexed() : g));
}

// ---------------------------------------------------------------- boulders
// Colliders that match what you see: the part of a rock above the ground, as one circle or (for long
// rocks) two circles along its long axis, so you neither walk into the stone nor stop short of it.
function footprintColliders(geo, cx, cz, ground, solid = false) { // solid (v1.13.18): no top to hop onto, and the full outline
  const pos = geo.attributes.position, pts = [];
  let top = ground;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
    // solid rocks measure against the ground under each point, so a rock on a slope is solid on its downhill side too
    if (y > (solid ? surfaceY(x, z) : ground) + 0.04) { pts.push([x, z]); top = Math.max(top, y); }
  }
  // the collider is as tall as the rock (a touch lower: the crown is rounded), so you can jump onto it
  const opt = solid ? {} : { top: top - 0.06 };
  if (pts.length < 3) return;
  let mx = 0, mz = 0;
  for (const [x, z] of pts) { mx += x; mz += z; }
  mx /= pts.length; mz /= pts.length;
  let sxx = 0, szz = 0, sxz = 0;
  for (const [x, z] of pts) { sxx += (x - mx) ** 2; szz += (z - mz) ** 2; sxz += (x - mx) * (z - mz); }
  const ang = 0.5 * Math.atan2(2 * sxz, sxx - szz), ux = Math.cos(ang), uz = Math.sin(ang);
  let a = 0, b = 0;
  for (const [x, z] of pts) { const dx = x - mx, dz = z - mz; a = Math.max(a, Math.abs(dx * ux + dz * uz)); b = Math.max(b, Math.abs(-dx * uz + dz * ux)); }
  if (!solid) { a *= 0.9; b *= 0.9; } // the outermost points are rounded edges you can brush past
  const k = solid ? 1 : 0.92;
  if (a < b * 1.25) { addCircle(mx, mz, (solid ? Math.max(a, b) : (a + b) / 2) * k, opt); return; }
  const off = a - b;
  addCircle(mx + ux * off, mz + uz * off, b * k, opt);
  addCircle(mx - ux * off, mz - uz * off, b * k, opt);
  addCircle(mx, mz, b * k, opt);
}

function rockGeometry(r, size) {
  const g = lumpy(new THREE.IcosahedronGeometry(size, 1), r, 0.42);
  g.scale(1 + r() * 0.5, 0.55 + r() * 0.3, 1 + r() * 0.4);
  g.computeVertexNormals();
  const stone = C(['#8f8b84', '#9c978e', '#827e78'][Math.floor(r() * 3)]), moss = C('#6f9a48');
  return paint(g, (v, n) => {
    const m = Math.max(0, n.y - 0.55) * 2.2 * (0.6 + r() * 0.4);
    return stone.clone().multiplyScalar(0.82 + r() * 0.16).lerp(moss, Math.min(1, m));
  });
}

// ---------------------------------------------------------------- branches
function branchGeometry(r) {
  const parts = [];
  const len = 0.5 + r() * 1.1, rad = 0.025 + r() * 0.025;
  const bark = C(['#6b4a2c', '#5e4630', '#7a5a3a'][Math.floor(r() * 3)]);
  const main = new THREE.CylinderGeometry(rad * 0.6, rad, len, 6, 1);
  main.rotateZ(Math.PI / 2);
  parts.push(main);
  for (let i = 0; i < 2; i++) {
    if (r() < 0.35) continue;
    const l = len * (0.25 + r() * 0.25);
    const s = new THREE.CylinderGeometry(rad * 0.3, rad * 0.55, l, 5, 1);
    s.translate(0, l / 2, 0);
    s.rotateZ(-Math.PI / 2 + 0.7 * (r() > 0.5 ? 1 : -1));
    s.rotateY((r() - 0.5) * 1.2);
    s.translate((r() - 0.5) * len * 0.6, 0, 0);
    parts.push(s);
  }
  return parts.map((g) => paint(g.toNonIndexed(), () => bark.clone().multiplyScalar(0.85 + r() * 0.3)));
}

// ---------------------------------------------------------------- build
// v1.12: the bike shop's stall and display rack (src/game/bikes.js STALL/RACK) are built after the scatter, so
// a boulder that lands on them is slid out to the edge of this circle instead (keeping the seeded layout).
const BIKE_YARD = { x: -9.2, z: -181.2, r: 4.6 };

export function buildGroundCover(scene, wind, cabin = null) {
  const r = rng(90210);
  const spot = (tries, ok) => {
    for (let k = 0; k < tries; k++) {
      const x = (r() * 2 - 1) * (HALF - 6), z = (r() * 2 - 1) * (HALF - 6);
      if (ok(x, z)) return { x, z };
    }
    return null;
  };
  const placed = [];
  const clear = (x, z, d) => placed.every((p) => Math.hypot(p.x - x, p.z - z) > d);

  // bushes on grassy ground (v1.8.1: natural low-poly bushes from art/nature.blend)
  const bushList = [];
  for (let i = 0; i < 620; i++) {
    const s = spot(30, (x, z) => grassAt(x, z) > 0.55 && open(x, z, 0.8) && !blocked(x, z, 0.9) && clear(x, z, 2.2) && heightAt(x, z) <= 6);
    if (!s) continue;
    placed.push(s);
    const berries = r() < 0.3 ? 1 + Math.floor(r() * 3) : 0;
    bushList.push({ x: s.x, y: surfaceY(s.x, s.z) - 0.06, z: s.z, ry: r() * 6.28, s: 0.8 + r() * 0.55, shape: Math.floor(r() * 3), green: Math.floor(r() * 4), berries });
  }
  const bushes = natureBushes(bushList);
  addWind(bushes.material, wind, 0.05, 'bushes-nature');
  bushes.name = 'bushes';
  scene.add(splitByTiles(bushes, 40));

  // big mossy boulders, half sunk into the ground (the big ones are solid)
  const rockParts = [];
  for (let i = 0; i < 380; i++) {
    const size = 0.35 + Math.pow(r(), 2) * 1.4;
    const s = spot(30, (x, z) => open(x, z, size + 0.6) && !blocked(x, z, size + 0.3) && clear(x, z, size + 1.6) && heightAt(x, z) <= 7);
    if (!s) continue;
    {
      const dx = s.x - BIKE_YARD.x, dz = s.z - BIKE_YARD.z, d = Math.hypot(dx, dz), need = BIKE_YARD.r + size * 1.4;
      if (d < need) { const k = need / Math.max(d, 0.01); s.x = BIKE_YARD.x + (d < 0.01 ? need : dx * k); s.z = BIKE_YARD.z + (d < 0.01 ? 0 : dz * k); }
    }
    placed.push(s);
    const g = rockGeometry(r, size);
    g.rotateY(r() * 6.28); g.rotateX((r() - 0.5) * 0.3); g.rotateZ((r() - 0.5) * 0.3);
    g.translate(s.x, surfaceY(s.x, s.z) - size * 0.22, s.z);
    rockParts.push(g.index ? g.toNonIndexed() : g);
    if (size > 0.45) footprintColliders(g, s.x, s.z, surfaceY(s.x, s.z));
    // a few pebbles around the bigger ones
    if (size > 0.6) for (let k = 0; k < 3; k++) {
      const a = r() * 6.28, d = size * (1.1 + r() * 0.6), px = s.x + Math.cos(a) * d, pz = s.z + Math.sin(a) * d;
      if (!open(px, pz)) continue;
      const pg = rockGeometry(r, 0.08 + r() * 0.12);
      pg.translate(px, surfaceY(px, pz) - 0.02, pz);
      rockParts.push(pg.index ? pg.toNonIndexed() : pg);
    }
  }
  // v1.12 / v1.12.1: one row of big mossy boulders all round Gus's shop wherever the ground falls away from the
  // floor, so the building never floats. Each rock is sized so its top reaches the floor line, and the next one
  // starts where it ends (spaced by its own width), so they sit side by side instead of piling into each other.
  // Their own seed, so the meadow scatter above never moves. In front of Gus's counter: nothing, the way stays clear.
  if (cabin) {
    const rc = rng(4242);
    const x0 = -0.3, x1 = 8.8, z0 = -0.3, z1 = 6.3; // the footprint, porch included
    const sides = [[x0, z0, x1, z0, 0, -1], [x0, z1, x1, z1, 0, 1], [x0, z0, x0, z1, -1, 0], [x1, z0, x1, z1, 1, 0]];
    const counter = (lx, lz) => lx > 8 && lz > 2.9 && lz < 4.9;
    const gapAt = (lx, lz) => { const w = cabin.cabinPt(lx, lz); return cabin.y - surfaceY(w.x, w.z); };
    for (const [ax, az, bx, bz, ox, oz] of sides) {
      const len = Math.hypot(bx - ax, bz - az), ux = (bx - ax) / len, uz = (bz - az) / len;
      let t = 0.1;
      while (t < len) {
        const lx = ax + ux * t, lz = az + uz * t;
        const gap = Math.max(gapAt(lx + ox * 0.2, lz + oz * 0.2), gapAt(lx + ux * 0.4 + ox * 0.2, lz + uz * 0.4 + oz * 0.2));
        if (gap < 0.08 || counter(lx, lz)) { t += 0.4; continue; }
        // v1.13.20: by the shop's front (porch side, by the barrels and the lantern) they stay modest; the deep gap
        // toward the water there made them huge
        const front = lx > 7.4;
        const size = Math.max(0.45, Math.min(front ? 0.75 : 1.3, gap + 0.3)) * (0.95 + rc() * 0.15);
        const cx = lx + ux * size * 0.8 + ox * size * 0.35, cz = lz + uz * size * 0.8 + oz * size * 0.35;
        const w = cabin.cabinPt(cx, cz), gy = surfaceY(w.x, w.z);
        if (gy > WATER_Y - 0.25) {
          const g = rockGeometry(rc, size);
          g.rotateY(rc() * 6.28);
          // (rocks stand about 0.7 of their size above the centre: the top lands just over the floor line)
          g.translate(w.x, cabin.y + 0.12 - size * 0.7, w.z);
          rockParts.push(g.index ? g.toNonIndexed() : g);
          footprintColliders(g, w.x, w.z, gy, true); // fully solid (v1.13.18: no stepping through low ones)
        }
        t += size * 1.6; // the next rock starts about where this one ends
      }
    }
    // v1.13.17: a close-packed bank of mossy stones of mixed sizes along the shop's front (the wall either side of the
    // porch, the porch's sides and its front edge, and round both front corners), so neither the foundation nor the
    // dark space under the porch deck shows. Tops reach just under the floor line; each one is solid. Own seed, so
    // nothing placed above moves.
    const rf = rng(4343);
    const floor = cabin.y + 0.5;
    const runs = [ // [ax, az, bx, bz, outward x, outward z, biggest size, grow to fill a deep gap]
      // (v1.13.18: the north corner by the barrels is left to the ring above; it was crowded)
      [7.2, 1.38, 8.65, 1.38, 0, -1, 0.6, false], // porch side (north)
      [8.66, 1.4, 8.66, 4.6, 1, 0, 0.62, true], // porch front edge
      [8.65, 4.62, 7.2, 4.62, 0, 1, 0.7, true], // porch side (south)
      [7.25, 4.62, 7.25, 6.25, 1, 0, 1.0, true], // wall beyond the porch
      [7.25, 6.25, -0.25, 6.25, 0, 1, 1.0, true], // the whole south wall (the windowed side you see walking up from the pond)
    ];
    for (const [ax, az, bx, bz, ox, oz, big, fill] of runs) {
      const len = Math.hypot(bx - ax, bz - az), ux = (bx - ax) / len, uz = (bz - az) / len;
      let t = 0;
      while (t <= len) {
        const lx = ax + ux * t, lz = az + uz * t;
        const w0 = cabin.cabinPt(lx + ox * 0.3, lz + oz * 0.3), gap = floor - surfaceY(w0.x, w0.z);
        const size = Math.max(0.3, Math.min(fill ? Math.max(big, gap * 1.05) : big, gap + 0.15)) * (0.8 + rf() * 0.35);
        const out = -size * rf() * 0.15; // tucked into the wall a touch, so the stone's crown meets the foundation
        const w = cabin.cabinPt(lx + ox * out, lz + oz * out), gy = surfaceY(w.x, w.z);
        if (gy > WATER_Y - 0.25) {
          const g = rockGeometry(rf, size);
          g.rotateY(rf() * 6.28);
          const top = floor - 0.03 - rf() * 0.09; // just under the floor line, a little uneven
          g.translate(w.x, Math.min(top - size * 0.7, gy + size * 0.3), w.z); // (never so high its base shows)
          rockParts.push(g.index ? g.toNonIndexed() : g);
          footprintColliders(g, w.x, w.z, gy, true);
          // now and then a small stone tucked in front of the bigger one
          if (size > 0.5 && rf() < 0.5) {
            const ps = 0.18 + rf() * 0.16, pw = cabin.cabinPt(lx + ox * (out + size * 1.15) + ux * (rf() - 0.5) * size, lz + oz * (out + size * 1.15) + uz * (rf() - 0.5) * size);
            const pg = rockGeometry(rf, ps), pgy = surfaceY(pw.x, pw.z);
            pg.rotateY(rf() * 6.28); pg.translate(pw.x, pgy - ps * 0.15, pw.z);
            rockParts.push(pg.index ? pg.toNonIndexed() : pg);
            footprintColliders(pg, pw.x, pw.z, pgy, true); // the little ones too
          }
        }
        t += size * 0.95; // packed edge to edge, a little overlap so no gap shows between them
      }
    }
  }
  const rocks = new THREE.Mesh(mergeGeometries(rockParts), new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true }));
  rocks.castShadow = true; rocks.receiveShadow = true; rocks.name = 'boulders';
  scene.add(splitByTiles(rocks, 40));

  // fallen branches and twigs
  const twigParts = [];
  for (let i = 0; i < 900; i++) {
    const s = spot(20, (x, z) => open(x, z, 0.1) && !blocked(x, z, 0.3) && heightAt(x, z) <= 7);
    if (!s) continue;
    const y = surfaceY(s.x, s.z);
    for (const g of branchGeometry(r)) { g.rotateY(r() * 6.28); g.translate(s.x, y + 0.02, s.z); twigParts.push(g); }
  }
  const twigs = new THREE.Mesh(mergeGeometries(twigParts), new THREE.MeshLambertMaterial({ vertexColors: true }));
  twigs.receiveShadow = true; twigs.name = 'branches';
  scene.add(splitByTiles(twigs, 40, { range: 60 })); // twigs vanish into the grass long before that (v1.13.19)

  const grass = new GrassField(scene, wind);
  return {
    grass, bushes, rocks, twigs,
    setQuality: (q) => grass.setQuality(q),
    update: (dt, pos) => grass.update(dt, pos),
  };
}
