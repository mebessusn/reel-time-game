// Five Lakes Valley props (Cozy Cove in the middle): dock, cabin, trees, reeds, lily pads, lanterns, campfire, lighthouse, ruins, waterfall.
import * as THREE from 'three';
import { buildWaterfall } from './waterfall.js';
import { buildFire } from './fire.js';
import { buildGroundCover } from './groundcover.js';
import { buildLodgeLamps } from './lodgelamps.js';
import { buildHutWindows, nightWindows } from './nightwindows.js';
import { buildCave, caveRockAt } from './cave.js';
import { buildShipwreck } from './shipwreck.js';
import { buildCampers, FERNVIEW_FIRE, camperAt } from './campers.js';
import { buildDressing } from './dressing.js';
import { buildLeviathan, leviathanAt } from './frostbones.js';
import { buildLakePOIs } from './lakepois.js';
import { splitByTiles } from '../render/cull.js';
import { dryAt, heightAt, surfaceY, isWater, groundY, DOCK, FALLS_C, DEEP_C, LIGHTHOUSE_ISLE, HALF, LAKE_R, scatterSpots, WATER_Y, JETTIES, BRIDGES, bridgeYAlong, sc, scAround, LAKES, CLEARINGS, TRAILS, trailDist, valleyWater, riverSd, zoneAt, gentleAt, onBridge } from './terrain.js';
import { buildGus as buildGusModel } from '../entities/gus.js';
import { softCabin, softDock, softTrees, softPlants, softLilyPads, softLanterns, softCampfire, softBoard, softRack, softLighthouse, softRuins, softTrophyBoard, TROPHY_SLOTS, softJetties, softBridge, softHut, softSignposts } from './softprops.js';
import { buildFish, shellModel } from '../entities/fish.js';
import { SPECIES_BY_ID } from '../data/species.js';
import { softFishModel } from '../entities/softfish.js';
import { addBox, addCircle, addSolidFn, clearColliders, blocked } from './colliders.js';
import { natureTrees } from './nature.js';
import { buildLogCabin, placeModels } from './polyfork.js';
import { buildCampground } from './campground.js';

// Gus's shop (the cabin). v1.10: turned 15° and set 2.5 m further inland so no part of it hangs over the water.
// The cabin is laid out in its own frame (walls x 0..7, z 0..6, porch to x 8.7); CABIN_POSE puts that frame's
// centre (4.35, 3) in the world. cabinPt() maps a cabin-frame point to the world (three.js rotation.y convention).
export const CABIN_POSE = { x: -10.65, z: 42.5, yaw: -15 * Math.PI / 180, cx: 4.35, cz: 3 };
export function cabinPt(lx, lz) {
  const c = Math.cos(CABIN_POSE.yaw), s = Math.sin(CABIN_POSE.yaw), px = lx - CABIN_POSE.cx, pz = lz - CABIN_POSE.cz;
  return { x: CABIN_POSE.x + px * c + pz * s, z: CABIN_POSE.z - px * s + pz * c };
}
function cabinLocal(x, z) {
  const c = Math.cos(CABIN_POSE.yaw), s = Math.sin(CABIN_POSE.yaw), dx = x - CABIN_POSE.x, dz = z - CABIN_POSE.z;
  return { x: dx * c - dz * s + CABIN_POSE.cx, z: dx * s + dz * c + CABIN_POSE.cz };
}
export const CABIN = { x: CABIN_POSE.x, z: CABIN_POSE.z, door: cabinPt(8.3, 3.5), front: cabinPt(11.7, 3.2) }; // front: where you stand to shop (past the rocks by the porch)
// v1.8.2: the notice board stands beside your cottage's front corner, facing the cove
export const BOARD = { x: 3.6, z: 57.2, ry: Math.PI };
// Lake Legends trophy board on the beach east of the dock, facing the dock (-x).
// up on the grassy rise above the beach, facing the dock (the smooth shoreline put the old spot in the shallows)
// v1.8.2: Lake Legends turns to face the trail running past in front of it (front = local +z)
export const TROPHY = (() => {
  const x = 16.2, z = 41.6;
  let best = null;
  for (let dx = -10; dx <= 10; dx += 0.5) for (let dz = -10; dz <= 10; dz += 0.5) {
    if (trailDist(x + dx, z + dz) > 0.6) continue;
    const d = Math.hypot(dx, dz);
    if (d > 1.5 && (!best || d < best.d)) best = { d, dx, dz };
  }
  const ux = best ? best.dx / best.d : -1, uz = best ? best.dz / best.d : 0;
  return { x, z, ry: Math.atan2(ux, uz), front: { x: x + ux * 1.5, z: z + uz * 1.5 } };
})();
export const RACK = { x: 11, z: 39.6, launch: { x: 4.5, z: 27 } };
export const CAMPFIRE = { x: 2.5, z: 45 }; // v1.9.12: down on the level ground by the shore (off the trail, between the signposts and the waystone)
export const LIGHTHOUSE = { x: LIGHTHOUSE_ISLE.x, z: LIGHTHOUSE_ISLE.z };
const LIGHTHOUSE_SCALE = 1.3; // v1.14.3: 30% taller (it looked small from the dock)


// Ground height under a block's centre on the smooth surface, sunk a touch so trunks and stems never float
// on a slope. Used where a builder takes a block-coordinate height function.
const blockSurf = (x, z) => surfaceY(Math.floor(x) + 0.5, Math.floor(z) + 0.5) - 0.06;

function buildDock() {
  // the end rail stops walkers stepping past it (the deck runs a little beyond it, to z0)
  addBox(DOCK.x0 - 0.2, DOCK.z0 - 0.3, DOCK.x1 + 1.2, DOCK.z0 + 0.32, { top: DOCK.deckY + 1.1 }); // (v1.17.1: a rail's height, so a cast goes over it)
  return softDock(DOCK, heightAt);
}

function cabinColliders() {
  // boxes in the cabin's own frame (it is turned, so they are tested in that frame)
  const boxes = [
    [-0.3, -0.3, 7.3, 6.3], // log walls + foundation
    [7.0, 3.2, 8.3, 4.6], // Gus's counter and the space behind it
    [7.2, 0.35, 7.7, 1.4], // barrels
    [7.92, 0.5, 8.68, 1.0], // crate
  ];
  addSolidFn((x, z, r) => {
    const p = cabinLocal(x, z);
    return boxes.some(([x0, z0, x1, z1]) => p.x > x0 - r && p.x < x1 + r && p.z > z0 - r && p.z < z1 + r);
  });
  for (const z of [1.55, 4.45]) { const w = cabinPt(8.5, z); addCircle(w.x, w.z, 0.12); } // porch posts
}

function buildCabin() {
  cabinColliders();
  const m = softCabin();
  const y = heightAt(CABIN.x, CABIN.z);
  const g = new THREE.Group();
  g.add(m); m.position.set(-CABIN_POSE.cx, 0, -CABIN_POSE.cz);
  // v1.13.7: Tackle & Tide's four windows (north and south walls, log rows 3-5) glow at night
  for (const [x0, x1] of [[1.3, 2.5], [4.5, 5.7]]) for (const [z, ry] of [[-0.2, Math.PI], [6.2, 0]]) {
    const pane = nightWindows.pane(x1 - x0 - 0.12, 1.0);
    pane.position.set((x0 + x1) / 2, 0.5 + 0.36 * 4.5, z); pane.rotation.y = ry;
    m.add(pane);
  }
  g.position.set(CABIN_POSE.x, y, CABIN_POSE.z); g.rotation.y = CABIN_POSE.yaw;
  const ch = cabinPt(1.9, 4.4);
  return { mesh: g, chimney: new THREE.Vector3(ch.x, y + 6.0, ch.z), porchY: y + 0.5 };
}

export const GUS = cabinPt(7.65, 4.0);
function buildGus(porchY) {
  const g = buildGusModel();
  g.position.set(GUS.x, porchY, GUS.z);
  g.rotation.y += CABIN_POSE.yaw;
  g.scale.setScalar(1.0);
  g.name = 'gus';
  return g;
}

function buildTrees() {
  const spots = scatterSpots(99, 1600, (x, z) => {
    const h = heightAt(x, z);
    if (h < 2 || h > 11) return false;
    if (Math.abs(x) < 15 && z > 30 && z < 52) return false; // dock/cabin clearing
    { const l = cabinLocal(x + 0.5, z + 0.5); if (l.x > -3.5 && l.x < 12.5 && l.z > -3.5 && l.z < 9.5) return false; } // v1.14.3: a clear yard all round Gus's cabin (its west side sticks out past the clearing)
    if (Math.hypot(x - LIGHTHOUSE.x, z - LIGHTHOUSE.z) < 10.5) return false; // keep the lighthouse island a clear beach
    if (trailDist(x + 0.5, z + 0.5) < 2.6) return false; // keep the trails open
    for (const c of Object.values(CLEARINGS)) if (Math.hypot(x - c.x, z - c.z) < c.r + 3) return false;
    if (Math.hypot(x - TROPHY.x, z - TROPHY.z) < 4) return false;
    if (Math.hypot(x - 9, z - 58) < 7.5) return false; // your cottage and its yard
    if (camperAt(x + 0.5, z + 0.5, 1)) return false; // v1.17.1: off the campgrounds' tents, tables and boats
    if (caveRockAt(x, z) > -0.6) return false; // nothing grows on (or through) the cavern's rock
    if (leviathanAt(x + 0.5, z + 0.5, 2)) return false; // v1.9.11: the Frozen Leviathan's frozen pool
    if (!gentleAt(x + 0.5, z + 0.5, 0.7)) return false; // v1.9.1: no trees on cliffs and rock faces
    return true;
  });
  for (const s of spots) addCircle(s.x + 0.5, s.z + 0.5, 0.45); // trunks
  addCircle(-16.5, 46.5, 0.45);
  addCircle(16.5, 44.5, 0.45);
  // snow on the pines around Frostpine Lake (and up its creek)
  const F = LAKES.frost;
  const snowy = (x, z) => ((x - F.cx) / (F.rx + 26)) ** 2 + ((z - F.cz) / (F.rz + 26)) ** 2 < 1;
  return natureTrees(spots, [['oak', -17, 46, 1], ['pine', 16, 44, 2]], blockSurf, { snowy });
}

function buildPlants() {
  const reedy = (x, z) => {
    const h = heightAt(x, z);
    if (h < -1 || h > 1 || trailDist(x + 0.5, z + 0.5) < 1.5) return false;
    if (x < -14 && Math.abs(x) < 56 && Math.abs(z) < 56 && Math.hypot(x, z) > 18) return true; // cove reed shallows
    const w = valleyWater(x, z);
    return (w.zone === 'marsh' && w.sd > -5 && w.sd < 5) || (w.zone === 'pond' && w.sd > -2 && w.sd < 2.5) || (riverSd(x, z) > -0.5 && riverSd(x, z) < 1.5);
  };
  const reeds = scatterSpots(7, 240, reedy);
  const flowers = scatterSpots(31, 280, (x, z) => { const h = heightAt(x, z); return h >= 2 && h < 7 && Math.hypot(x - CABIN.door.x, z - CABIN.door.z) > 3.5 && trailDist(x + 0.5, z + 0.5) > 1.2; });
  // the fallen log on the sand between the bridge and Pip's spot (moved toward the shore in v1.9.3, and again in v1.17.1)
  const LOG = { x: -31.8, z: 30.15 }; // (v1.17.1: out on the sand toward the shore, where Megan marked it)
  addBox(LOG.x, LOG.z + 0.05, LOG.x + 4, LOG.z + 0.95);
  return softPlants(reeds, flowers, { ...LOG, y: surfaceY(LOG.x + 0.5, LOG.z + 0.5) }, blockSurf);
}

function buildLilyPads(extra = []) {
  const spots = scatterSpots(55, 160, (x, z) => {
    if (!isWater(x, z) || heightAt(x, z) < -2) return false;
    if (x < -12 && Math.abs(x) < 56 && Math.abs(z) < 56) return true;
    const zn = zoneAt(x, z);
    return zn === 'marsh' || zn === 'pond';
  });
  return softLilyPads(spots.concat(extra), WATER_Y);
}

function haloTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 32;
  const g = c.getContext('2d'); const grd = g.createRadialGradient(16, 16, 0, 16, 16, 16);
  grd.addColorStop(0, 'rgba(255,230,180,1)'); grd.addColorStop(0.3, 'rgba(255,200,120,0.45)'); grd.addColorStop(1, 'rgba(255,180,100,0)');
  g.fillStyle = grd; g.fillRect(0, 0, 32, 32);
  return new THREE.CanvasTexture(c);
}

function buildLanterns() {
  const lights = [];
  const posts = [];
  for (const z of [DOCK.z0 + 1, DOCK.z0 + 7, DOCK.z0 + 13]) for (const x of [DOCK.x0, DOCK.x1 + 1]) posts.push({ x: x + (x === DOCK.x0 ? 0.15 : -0.15), z: z + 0.5, y: DOCK.deckY });
  posts.push({ x: CABIN.door.x + 1.5, z: CABIN.door.z - 2, y: surfaceY(CABIN.door.x + 1.5, CABIN.door.z - 2) - 0.04 });
  for (const j of JETTIES) { // a lantern at the water end of each jetty
    const side = j.rot ? { x: j.end.x - j.dir[0] * 0.4 - j.dir[1] * 0.8, z: j.end.z - j.dir[1] * 0.4 + j.dir[0] * 0.8 } : j.along === 'x' ? { x: j.end.x - j.dir[0] * 0.4, z: j.z1 - 0.2 } : { x: j.x1 - 0.2, z: j.end.z - j.dir[1] * 0.4 };
    posts.push({ ...side, y: j.deckY });
  }
  // street lanterns along every trail between the lakes, alternating sides, about every 11 blocks
  const trailPosts = [];
  for (const tr of Object.values(TRAILS)) {
    let carry = 4, side = 1;
    for (let i = 0; i < tr.pts.length - 1; i++) {
      const [x0, z0] = tr.pts[i], [x1, z1] = tr.pts[i + 1];
      const len = Math.hypot(x1 - x0, z1 - z0), dx = (x1 - x0) / len, dz = (z1 - z0) / len;
      for (let d = carry; d < len; d += 11) {
        const cx = x0 + dx * d, cz = z0 + dz * d;
        for (const off of [1.7, 2.4, 1.2]) {
          const x = cx - dz * off * side, z = cz + dx * off * side;
          const gy = groundY(x, z);
          if (gy == null || isWater(x, z) || !dryAt(x, z, 0.5) || surfaceY(x, z) < WATER_Y + 0.3 || [0, 1, 2, 3, 4, 5].some((k) => onBridge(x + Math.cos(k) * 2.5, z + Math.sin(k) * 2.5)) || blocked(x, z, 0.4, 'shore') || Math.hypot(x - TROPHY.x, z - TROPHY.z) < 3.6 || trailPosts.some((q) => Math.hypot(q.x - x, q.z - z) < 6)) continue;
          trailPosts.push({ x, z, y: surfaceY(x, z) - 0.04 });
          side = -side;
          break;
        }
        carry = d + 11 - len;
      }
    }
  }
  posts.push(...trailPosts);
  for (const p of posts) {
    lights.push(new THREE.Vector3(p.x, p.y + 1.7, p.z));
    addCircle(p.x, p.z, 0.12);
  }
  const { group, glowMat } = softLanterns(posts);
  // a soft halo around every lamp after dark (one draw call)
  const haloGeo = new THREE.BufferGeometry().setFromPoints(posts.map((p) => new THREE.Vector3(p.x, p.y + 1.66, p.z)));
  const haloMat = new THREE.PointsMaterial({ map: haloTexture(), color: '#ffcf8a', size: 2.2, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0 });
  const halo = new THREE.Points(haloGeo, haloMat);
  halo.frustumCulled = false;
  group.add(halo);
  glowMat.userData.halo = haloMat;
  return { group, lights, glowMat };
}

function buildCampfire() {
  const y = heightAt(CAMPFIRE.x, CAMPFIRE.z);
  addCircle(CAMPFIRE.x, CAMPFIRE.z, 0.8); // fire ring
  for (const ox of [-2.25, 2.25]) addBox(CAMPFIRE.x + ox - 0.22, CAMPFIRE.z - 0.75, CAMPFIRE.x + ox + 0.22, CAMPFIRE.z + 1.0); // log benches
  return softCampfire(CAMPFIRE, y);
}

function buildBoard() {
  addBox(BOARD.x - 1.45, BOARD.z - 0.25, BOARD.x + 1.45, BOARD.z + 0.25);
  // built at the origin, then placed and turned (its notices are on its local +z face)
  const m = softBoard({ x: 0, z: 0 }, 0);
  m.position.set(BOARD.x, Math.min(surfaceY(BOARD.x - 1.3, BOARD.z), surfaceY(BOARD.x + 1.3, BOARD.z)) - 0.04, BOARD.z);
  m.rotation.y = BOARD.ry || 0;
  return m;
}

function buildRack() {
  addBox(RACK.x - 1.6, RACK.z - 0.85, RACK.x + 1.6, RACK.z + 0.85);
  return softRack(RACK, heightAt(RACK.x, RACK.z));
}

function buildLighthouse() {
  const y = heightAt(LIGHTHOUSE.x, LIGHTHOUSE.z);
  const { mesh: m, lampY: lampY0 } = softLighthouse(LIGHTHOUSE, y);
  // scale the whole tower up about the middle of its foot
  const pivot = new THREE.Vector3(LIGHTHOUSE.x + 0.25, y, LIGHTHOUSE.z + 0.25);
  for (const c of m.children) { c.position.sub(pivot).multiplyScalar(LIGHTHOUSE_SCALE).add(pivot); c.scale.multiplyScalar(LIGHTHOUSE_SCALE); }
  const lampY = y + (lampY0 - y) * LIGHTHOUSE_SCALE;
  for (const mat of m.userData.windows || []) nightWindows.glass(mat); // v1.13.7: the keeper's windows light up
  addCircle(LIGHTHOUSE.x + 0.25, LIGHTHOUSE.z + 0.25, 1.8 * LIGHTHOUSE_SCALE, { water: true });
  const lampMat = new THREE.MeshBasicMaterial({ color: '#fff4c0' });
  const lamp = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.34, 0.62, 12), lampMat);
  lamp.scale.setScalar(LIGHTHOUSE_SCALE);
  lamp.position.set(LIGHTHOUSE.x + 0.25, lampY, LIGHTHOUSE.z + 0.25);
  // v1.9.2: a real lighthouse light. A rotating lens throws two opposed beams: soft volumetric shafts that
  // are brightest at the lens, fade along their length and toward their edges, shimmer with drifting haze
  // and thin out in the fog. When a beam swings past you the lens flares, and a pool of light sweeps the water.
  const beam = new THREE.Group();
  beam.name = 'lighthouse-beams';
  const beamMat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneFactor, side: THREE.DoubleSide, fog: true,
    uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { uColor: { value: new THREE.Color('#ffe9b8') }, uOn: { value: 0 }, uTime: { value: 0 } }]),
    vertexShader: `
      varying float vT; varying vec3 vN; varying vec3 vV; varying vec3 vW;
      #include <fog_pars_vertex>
      void main() {
        vT = uv.y;
        vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
        vN = normalize(normalMatrix * normal); vV = normalize(-mvPosition.xyz);
        vW = (modelMatrix * vec4(position, 1.0)).xyz;
        gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
      }`,
    fragmentShader: `
      uniform vec3 uColor; uniform float uOn; uniform float uTime;
      varying float vT; varying vec3 vN; varying vec3 vV; varying vec3 vW;
      #include <fog_pars_fragment>
      float h(vec3 p) { return fract(sin(dot(p, vec3(12.9898, 78.233, 37.719))) * 43758.5453); }
      float n3(vec3 p) { vec3 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
        return mix(mix(mix(h(i), h(i + vec3(1,0,0)), f.x), mix(h(i + vec3(0,1,0)), h(i + vec3(1,1,0)), f.x), f.y),
                   mix(mix(h(i + vec3(0,0,1)), h(i + vec3(1,0,1)), f.x), mix(h(i + vec3(0,1,1)), h(i + vec3(1,1,1)), f.x), f.y), f.z); }
      void main() {
        float along = 1.0 - vT;                                  // 0 at the lens, 1 at the far end
        float core = pow(abs(dot(vN, vV)), 1.6);                 // soft edges: thick in the middle of the shaft
        float fall = pow(1.0 - along, 1.8) * smoothstep(0.0, 0.03, along);
        float haze = 0.75 + 0.25 * n3(vW * 0.35 + vec3(uTime * 0.25, 0.0, uTime * 0.12));
        float a = uOn * 0.5 * core * fall * haze;
        #ifdef USE_FOG
          a *= 1.0 - 0.85 * smoothstep(fogNear, fogFar, vFogDepth); // the fog swallows the far end of the beam
        #endif
        gl_FragColor = vec4(uColor * a, 1.0);                     // additive: one plus the light
      }`,
  });
  for (const side of [0, Math.PI]) {
    const g = new THREE.CylinderGeometry(0.28, 5.5, 64, 32, 1, true); // narrow at the lens, spreading out
    g.translate(0, -32, 0); g.rotateZ(Math.PI / 2); g.rotateY(side);
    beam.add(new THREE.Mesh(g, beamMat));
  }
  beam.position.copy(lamp.position);
  // the lens flare: a soft star of light at the lamp that blooms as a beam points at you
  const fc = document.createElement('canvas'); fc.width = fc.height = 128;
  { const c = fc.getContext('2d'), gr = c.createRadialGradient(64, 64, 0, 64, 64, 64);
    gr.addColorStop(0, 'rgba(255,250,235,1)'); gr.addColorStop(0.15, 'rgba(255,238,190,0.75)'); gr.addColorStop(0.45, 'rgba(255,214,140,0.16)'); gr.addColorStop(1, 'rgba(255,200,120,0)');
    c.fillStyle = gr; c.fillRect(0, 0, 128, 128);
    c.globalCompositeOperation = 'lighter'; c.fillStyle = 'rgba(255,240,200,0.35)'; c.fillRect(0, 62, 128, 4); c.fillRect(62, 0, 4, 128); }
  const flareTex = new THREE.CanvasTexture(fc); flareTex.colorSpace = THREE.SRGBColorSpace;
  const flare = new THREE.Sprite(new THREE.SpriteMaterial({ map: flareTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0 }));
  flare.position.copy(lamp.position);
  beam.userData.flare = flare;
  // a real light from the lamp that sweeps across the water with the beam
  const sweep = new THREE.SpotLight('#ffe3a8', 0, 70, 0.2, 0.6, 1.2);
  sweep.position.copy(lamp.position);
  sweep.target.position.copy(lamp.position).add(new THREE.Vector3(30, -lamp.position.y + 0.8, 0));
  beam.userData.sweep = sweep;
  lampMat.color.set('#fffaf0');
  return { mesh: m, lamp, lampMat, beam, beamMat, flare, sweep };
}

function buildRuins() {
  const cx = DEEP_C.x, cz = DEEP_C.z;
  const pillars = [];
  for (let i = 0; i < 6; i++) {
    const ang = (i / 6) * Math.PI * 2;
    const x = Math.round(cx + Math.cos(ang) * 3), z = Math.round(cz + Math.sin(ang) * 3);
    const base = heightAt(x, z);
    const h = 2 + (i % 3);
    pillars.push({ x, z, base, h });
    if (base + h > WATER_Y) addCircle(x + 0.5, z + 0.5, 0.6, { water: true });
  }
  const b = heightAt(cx, cz);
  const arch = [-2, -1, 0, 1, 2].map((x) => ({ x: cx + x, y: b, z: cz + 1, r: (x % 2) * 0.1 }));
  return softRuins(pillars, arch);
}

function buildTrophyBoard() {
  const g = new THREE.Group();
  g.name = 'trophy-board';
  const ax = Math.cos(TROPHY.ry), az = -Math.sin(TROPHY.ry); // the board's local x (its width) in the world
  g.position.set(TROPHY.x, Math.min(surfaceY(TROPHY.x - ax * 2, TROPHY.z - az * 2), surfaceY(TROPHY.x, TROPHY.z), surfaceY(TROPHY.x + ax * 2, TROPHY.z + az * 2)) - 0.04, TROPHY.z);
  g.rotation.y = TROPHY.ry;
  g.add(softTrophyBoard());
  const mounts = new THREE.Group();
  g.add(mounts);
  // board footprint: a row of posts along its width, whatever way it faces
  // v1.8.2: two rows (the board and its front step), so you and the locals stand in front of it, never in it
  const fx = Math.sin(TROPHY.ry), fz = Math.cos(TROPHY.ry); // the board's front (local +z) in the world
  for (let t = -1.8; t <= 1.81; t += 0.45) for (const d of [-0.1, 0.4]) addCircle(TROPHY.x + ax * t + fx * d, TROPHY.z + az * t + fz * d, 0.45);
  const slotFor = [1, 0, 2]; // rank 1 in the middle, 2 on the left, 3 on the right
  let key = '';
  g.userData.setTrophies = (list) => {
    const k = list.map((t) => `${t.id}:${t.variant}`).join('|');
    if (k === key) return;
    key = k;
    mounts.clear();
    list.slice(0, 3).forEach((t, i) => {
      const fish = buildFish(t.speciesId, t.variant, t.weight);
      fish.scale.setScalar(0.84 / ((SPECIES_BY_ID[t.speciesId]?.shell || SPECIES_BY_ID[t.speciesId]?.mesh) ? shellModel(t.speciesId).length : softFishModel(t.speciesId).length));
      fish.position.set(TROPHY_SLOTS[slotFor[i]], 1.92, 0.3);
      fish.rotation.set(0, 0, 0.08);
      fish.castShadow = true;
      mounts.add(fish);
    });
  };
  return g;
}

// ---------------------------------------------------------------- the valley
const at = (x, z, c) => { const [nx, nz] = scAround(x, z, c[0], c[1]); return { x: nx, z: nz }; };
const LODGE = [0, -97], CAMP = [-92, 95], BOG = [99, 99], SHED = [98, -58];
export const HUTS = [
  { name: 'lodge', ...at(0, -100, LODGE), w: 7, d: 5, ry: 0, sign: 'PINEWOOD LODGE', chimney: true, h: 2.8 },
  { name: 'lodge-west', ...at(-9.5, -95, LODGE), w: 4, d: 4, ry: 0.35 },
  { name: 'lodge-east', ...at(9.5, -95, LODGE), w: 4, d: 4, ry: -0.35, wall: '#7a4a2a', roof: '#4a6a8a' },
  { name: 'bog', ...at(100, 100, BOG), w: 4.5, d: 4, ry: -2.36, sign: 'BOG HUT', wall: '#6a6448', roof: '#5a6a3a' },
  { name: 'shed', ...at(100, -58, SHED), w: 5, d: 4, ry: -Math.PI / 2, sign: 'QUARRY', wall: '#7a7068', roof: '#4a5a6a' },
  // your own cottage, up the hill north of the cove: walk in through the door
  { name: 'home', x: 9, z: 60, w: 5.5, d: 4.5, ry: Math.PI, sign: 'HOME', chimney: true, wall: '#9a6a3e', roof: '#3f7a5c', h: 2.6 },
];
/** The door of your cottage (outside, on the porch). */
export const HOME_DOOR = { x: 9, z: 60 - 4.5 / 2 - 0.9 };
export const CAMP_FIRE = at(-90, 93, CAMP);
const TENTS = [{ ...at(-96, 97, CAMP), ry: 0.4, color: '#c86a3a' }, { ...at(-88, 99, CAMP), ry: -0.3, color: '#4a8ac0' }, { ...at(-96, 89, CAMP), ry: 1.2, color: '#d8b040' }];
const dirTo = (from, to) => Math.atan2(-(to[1] - from[1]), to[0] - from[0]);
export const SIGNPOSTS = [
  { at: [2.5, 46.5], boards: [['FERN POND', [-22, 56]], ['FROSTPINE', [-38, 34]], ['LILYMARSH', [22, 51]], ['QUARRY', [26, 31]]] },
  { at: [-50.5, -19.5], boards: [['LODGE', [-30, -48]], ['FROSTPINE', [-53, -42]], ['COVE', [-46, 8]]] },
  { at: [2.5, -84], boards: [['COVE', [-10, -58]]] },
  { at: [46.5, 18.5], boards: [['QUARRY', [44, 3]], ['COVE', [26, 31]]] },
  { at: [36.5, 66], boards: [['COVE', [22, 51]]] },
  { at: [-56, 69], boards: [['COVE', [-22, 56]]] },
].map((p) => ({ at: sc(...p.at), boards: p.boards.map(([t, to]) => [t, sc(...to)]) }));
// (a signpost whose spot ended up in water or on a slope steps to the nearest dry, level ground)
for (const p of SIGNPOSTS) {
  if (groundY(p.at[0], p.at[1]) != null && trailDist(p.at[0], p.at[1]) < 4) continue;
  let best = null, bd = 1e9;
  for (let dx = -8; dx <= 8; dx += 0.5) for (let dz = -8; dz <= 8; dz += 0.5) {
    const x = p.at[0] + dx, z = p.at[1] + dz;
    if (groundY(x, z) == null) continue;
    const d = Math.hypot(dx, dz) + Math.max(0, trailDist(x, z) - 2) * 2;
    if (d < bd) { bd = d; best = [x, z]; }
  }
  if (best) p.at = best;
}

// v1.8.2: the cove crossroads post is split in two, one beside each trail that leaves the clearing, stood
// at the trail's edge (not on it) and well clear of the campfire: the boards pointing the same way share a post.
{
  const hub = SIGNPOSTS[0], boards = hub.boards;
  const groups = [boards.filter(([, to]) => to[0] >= hub.at[0]), boards.filter(([, to]) => to[0] < hub.at[0])].filter((g) => g.length);
  const split = groups.map((grp) => {
    const tx = grp.reduce((a, [, to]) => a + to[0], 0) / grp.length, tz = grp.reduce((a, [, to]) => a + to[1], 0) / grp.length;
    const dl = Math.hypot(tx - hub.at[0], tz - hub.at[1]), ux = (tx - hub.at[0]) / dl, uz = (tz - hub.at[1]) / dl;
    // out along that way, then the nearest spot just off the trail's edge
    const ax = hub.at[0] + ux * 6, az = hub.at[1] + uz * 6;
    let best = null, bd = 1e9;
    for (let dx = -5; dx <= 5; dx += 0.25) for (let dz = -5; dz <= 5; dz += 0.25) {
      const x = ax + dx, z = az + dz, td = trailDist(x, z);
      if (groundY(x, z) == null || td < 1.7 || td > 2.6 || Math.hypot(x - CAMPFIRE.x, z - CAMPFIRE.z) < 4.5) continue;
      const d = Math.hypot(dx, dz);
      if (d < bd) { bd = d; best = [x, z]; }
    }
    return { at: best || [ax, az], boards: grp };
  });
  SIGNPOSTS.splice(0, 1, ...split);
}

function buildValley(scene) {
  scene.add(softJetties(JETTIES, heightAt));
  for (const B of BRIDGES) {
    // built along local +z, then turned to follow the trail
    const toWorld = (lx, lz) => [B.cx + B.ux * lz + B.uz * lx, B.cz + B.uz * lz - B.ux * lx];
    const mesh = softBridge({ x0: -B.w / 2, x1: B.w / 2, z0: -B.half, z1: B.half }, (lx, lz) => bridgeYAlong(B, lz), (lx, lz) => heightAt(...toWorld(lx, lz)));
    mesh.position.set(B.cx, 0, B.cz);
    mesh.rotation.y = Math.atan2(B.ux, B.uz);
    scene.add(mesh);
    // rails stop walkers stepping off the sides (posts along both edges)
    for (let s = -B.half + 1.5; s <= B.half - 1.5; s += 0.5) for (const side of [-1, 1]) addCircle(...toWorld(side * (B.w / 2 + 0.05), s), 0.12);
  }
  for (const hut of HUTS) {
    const y = heightAt(hut.x, hut.z);
    scene.add(softHut(hut, y));
    const c = Math.abs(Math.cos(hut.ry)), s = Math.abs(Math.sin(hut.ry));
    const ex = (hut.w * c + hut.d * s) / 2, ez = (hut.w * s + hut.d * c) / 2;
    addBox(hut.x - ex + 0.2, hut.z - ez + 0.2, hut.x + ex - 0.2, hut.z + ez - 0.2);
  }
  // v1.17.1: Fern Camp's tents are Polyfork models (src/world/polyfork.js), doors to the fire, with chairs, a cooler
  // and a stack of firewood
  {
    const F = CAMP_FIRE, face = (x, z) => Math.atan2(F.x - x, F.z - z);
    const pf = TENTS.map((t, i) => ({ m: ['dome-tent', 'canvas-ridge-tent', 'canvas-wall-tent'][i], x: t.x, z: t.z, ry: face(t.x, t.z) }));
    for (const [m, dx, dz] of [['folding-camp-chair', 0.2, -2.4], ['folding-camp-chair', 1.6, 2.1], ['camp-cooler', 3.2, -2.6], ['cordwood-pile', -1.5, -5.5]]) pf.push({ m, x: F.x + dx, z: F.z + dz, ry: m === 'cordwood-pile' ? 0.3 : face(F.x + dx, F.z + dz) });
    scene.add(placeModels('fern-camp-polyfork', pf));
  }
  scene.add(softCampfire(CAMP_FIRE, heightAt(CAMP_FIRE.x, CAMP_FIRE.z)));
  addCircle(CAMP_FIRE.x, CAMP_FIRE.z, 0.8);
  for (const ox of [-2.25, 2.25]) addBox(CAMP_FIRE.x + ox - 0.22, CAMP_FIRE.z - 0.75, CAMP_FIRE.x + ox + 0.22, CAMP_FIRE.z + 1.0);
  const posts = SIGNPOSTS.map((p) => ({ x: p.at[0], z: p.at[1], y: surfaceY(p.at[0], p.at[1]) - 0.05, boards: p.boards.map(([text, to]) => ({ text, yaw: dirTo(p.at, to) })) }));
  for (const p of posts) addCircle(p.x, p.z, 0.15);
  scene.add(softSignposts(posts));
}

// Wind: plants and tree canopies sway. Each vertex gets its height above the ground (aLift), so the
// bases stay put and the tips move; uWind is set from the weather and the season each frame.
export const WIND = { uWind: { value: 0.3 }, uWT: { value: 0 } };
function addSway(mesh, minLift = 0, scale = 1) {
  const g = mesh.geometry;
  const pos = g.attributes.position;
  const lift = new Float32Array(pos.count);
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
    lift[i] = Math.max(0, y - Math.max(surfaceY(x, z), 0) - minLift);
  }
  g.setAttribute('aLift', new THREE.BufferAttribute(lift, 1));
  mesh.material.onBeforeCompile = (sh) => {
    sh.uniforms.uWind = WIND.uWind; sh.uniforms.uWT = WIND.uWT;
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nattribute float aLift; uniform float uWind; uniform float uWT;')
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        float sway = min(aLift, 2.5) * uWind * ${(0.07 * scale).toFixed(3)};
        float ph = position.x * 0.35 + position.z * 0.27;
        transformed.x += sway * (sin(uWT * 1.7 + ph) + 0.4 * sin(uWT * 3.1 + ph * 2.0));
        transformed.z += sway * 0.6 * cos(uWT * 1.3 + ph);`);
  };
  mesh.material.needsUpdate = true;
}

export function buildProps(scene) {
  const out = {};
  clearColliders();
  scene.add(buildDock());
  const cabin = buildCabin();
  scene.add(cabin.mesh);
  out.chimney = cabin.chimney;
  out.gus = buildGus(cabin.porchY ?? heightAt(CABIN.x, CABIN.z) + 0.5);
  if (out.gus) scene.add(out.gus);
  const trees = buildTrees();
  addSway(trees, 2.2, 0.35);
  scene.add(splitByTiles(trees, 40));
  out.leviathan = buildLeviathan(scene); // v1.9.11 (before the dressing, so nothing is set down inside it)
  out.dressing = buildDressing(scene);
  const plants = buildPlants();
  addSway(plants, 0, 1);
  scene.add(splitByTiles(plants, 40, { range: 80 })); // reeds and flowers are specks past 80 m (v1.13.19)
  out.lilypads = buildLilyPads(out.dressing.pads);
  scene.add(out.lilypads);
  const lanterns = buildLanterns();
  scene.add(lanterns.group);
  out.lanternLights = lanterns.lights;
  out.lanternGlow = lanterns.glowMat;
  scene.add(buildCampfire());
  out.campfire = new THREE.Vector3(CAMPFIRE.x, heightAt(CAMPFIRE.x, CAMPFIRE.z) + 0.3, CAMPFIRE.z);
  out.fires = [buildFire(out.campfire)];
  scene.add(buildBoard());
  buildValley(scene);
  out.lodgeLamps = buildLodgeLamps(scene, HUTS.filter((h) => h.name.startsWith('lodge')), heightAt); // v1.12
  buildHutWindows(scene, HUTS.filter((h) => !h.name.startsWith('lodge')), heightAt); // v1.13.7: every hut's windows glow at night
  out.campfire2 = new THREE.Vector3(CAMP_FIRE.x, heightAt(CAMP_FIRE.x, CAMP_FIRE.z) + 0.3, CAMP_FIRE.z);
  out.fires.push(buildFire(out.campfire2));
  scene.add(...out.fires);
  out.trophyBoard = buildTrophyBoard();
  scene.add(out.trophyBoard);
  const lh = buildLighthouse();
  scene.add(lh.mesh, lh.lamp, lh.beam, lh.flare, lh.sweep, lh.sweep.target);
  out.lighthouse = lh;
  scene.add(buildRuins());
  out.falls = buildWaterfall();
  scene.add(out.falls);
  // last, so it can keep clear of everything solid placed above
  out.cave = buildCave(scene);
  out.wreck = buildShipwreck(scene);
  out.lakePOIs = buildLakePOIs(scene); // v1.13: each lake's landmark
  // v1.9.4: Sundae's Trailer Park and Fernview Campground (with its own campfire and log benches)
  out.campers = buildCampers(scene);
  scene.add(softCampfire(FERNVIEW_FIRE, heightAt(FERNVIEW_FIRE.x, FERNVIEW_FIRE.z)));
  addCircle(FERNVIEW_FIRE.x, FERNVIEW_FIRE.z, 0.8);
  for (const ox of [-2.25, 2.25]) addBox(FERNVIEW_FIRE.x + ox - 0.22, FERNVIEW_FIRE.z - 0.75, FERNVIEW_FIRE.x + ox + 0.22, FERNVIEW_FIRE.z + 1.0);
  out.campfire3 = new THREE.Vector3(FERNVIEW_FIRE.x, heightAt(FERNVIEW_FIRE.x, FERNVIEW_FIRE.z) + 0.3, FERNVIEW_FIRE.z);
  { const f = buildFire(out.campfire3); out.fires.push(f); scene.add(f); }
  out.logCabin = buildLogCabin(scene); // v1.17.1: the first Polyfork model, a log cabin in the woods off the Lilymarsh trail
  out.campground = buildCampground(scene); // v1.17.1: the ranger station and the Frostpine A-frame (Polyfork models)
  out.groundCover = buildGroundCover(scene, WIND, { cabinPt, cabinLocal, y: heightAt(CABIN.x, CABIN.z) });
  return out;
}

export { groundY, HALF, LAKE_R };
