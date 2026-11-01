// Waystones: a glowing stone at each lake and settlement. Walk past one to light it; after that you can
// travel between them in a blink (v1.9.9: only while standing at a waystone, not from anywhere on the map).
import * as THREE from 'three';
import { heightAt, groundY, JETTIES, scAround } from '../world/terrain.js';
import { WAYSTONE_MATS, WAYSTONE_NODES } from '../data/waystoneMesh.js';

function nearJetty(lake) {
  const j = JETTIES.find((x) => x.lake === lake);
  let x = j.end.x, z = j.end.z;
  for (let k = 0; k < 30 && heightAt(x, z) <= 0; k++) { x -= j.dir[0]; z -= j.dir[1]; }
  x -= j.dir[0] * 3; z -= j.dir[1] * 3;
  for (const side of [-3, 3, -4.5, 4.5]) {
    const sx = x + j.dir[1] * side, sz = z - j.dir[0] * side;
    if (groundY(sx, sz) == null) continue;
    return { x: sx, z: sz };
  }
  return { x, z };
}

export const WAYSTONES = [
  { id: 'cove', name: 'Cozy Cove', at: { x: 6.5, z: 47.5 } },
  { id: 'frost', name: 'Frostpine Lake', at: nearJetty('frost') },
  { id: 'pond', name: 'Fern Pond', at: nearJetty('pond') },
  { id: 'marsh', name: 'Lilymarsh', at: nearJetty('marsh') },
  { id: 'quarry', name: 'Old Quarry', at: (() => { const j = JETTIES.find((x) => x.lake === 'quarry'); return { x: j.pivot.x + 5, z: j.pivot.z + 3 }; })() }, // v1.9.2: up on the grass beside the jetty, off the sand
  { id: 'lodge', name: 'Pinewood Lodge', at: (([x, z]) => ({ x, z }))(scAround(5, -88, 0, -97)) },
  { id: 'camp', name: 'Fern Camp', at: (([x, z]) => ({ x, z }))(scAround(-86, 90, -92, 95)) },
  { id: 'river', name: 'Willow River Bridge', at: { x: 47.5, z: 25 } },
];
// make sure each stands on walkable ground
for (const w of WAYSTONES) {
  if (groundY(w.at.x, w.at.z) != null) continue;
  outer: for (let r = 1; r < 10; r++) for (let a = 0; a < 12; a++) {
    const x = w.at.x + Math.cos(a / 12 * Math.PI * 2) * r, z = w.at.z + Math.sin(a / 12 * Math.PI * 2) * r;
    if (groundY(x, z) != null) { w.at = { x, z }; break outer; }
  }
}

// v1.13.11: each waystone is its own model (art/waystones.blend -> art/waystones.glb -> src/data/waystoneMesh.js):
// a barnacled sea stack at the cove, an ice spire at Frostpine, a mossy cairn at Fern Pond, a leaning marsh slab,
// a banded obelisk at the quarry, a carved post with a lantern at the lodge, a standing stone and crook at camp and
// a little stone arch at the river. Every glowing part shares one "rune" material per stone, recoloured when lit.
const lin = (a) => new THREE.Color().setRGB(a[0], a[1], a[2], THREE.LinearSRGBColorSpace);
let shared = null;
const RUNE = WAYSTONE_MATS.findIndex((m) => m.name === 'rune');
function sharedMats() {
  if (shared) return shared;
  shared = WAYSTONE_MATS.map((m) => {
    const color = lin(m.color);
    if (m.metal > 0.5) return new THREE.MeshPhongMaterial({ color, shininess: 60, specular: '#8a8a90' });
    if (m.rough < 0.35) return new THREE.MeshPhongMaterial({ color, shininess: 80, specular: '#ffffff' });
    return new THREE.MeshLambertMaterial({ color });
  });
  return shared;
}

export function buildStone(id) {
  const g = new THREE.Group();
  const rune = new THREE.MeshLambertMaterial({ color: '#4a5a7a', emissive: '#000000' });
  const n = WAYSTONE_NODES.find((x) => x.name === `ws_${id}`) || WAYSTONE_NODES.find((x) => x.name === 'ws_cove');
  const mats = sharedMats();
  for (const p of n.prims) {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(p.pos), 3));
    geo.setAttribute('normal', new THREE.BufferAttribute(new Int8Array(p.nrm), 3, true));
    geo.setIndex(new THREE.Uint16BufferAttribute(p.idx, 1));
    const mesh = new THREE.Mesh(geo, p.m === RUNE ? rune : mats[p.m]);
    mesh.castShadow = true;
    g.add(mesh);
  }
  g.userData.rune = rune;
  return g;
}

export class Waystones {
  constructor(game) {
    this.game = game;
    this.meshes = new Map();
    for (const w of WAYSTONES) {
      const m = buildStone(w.id);
      const y = groundY(w.at.x, w.at.z) ?? heightAt(w.at.x, w.at.z);
      m.position.set(w.at.x, y, w.at.z);
      // turn the carved face toward the land, away from the lake's jetty (settlements keep their default facing)
      const j = JETTIES.find((x) => x.lake === w.id);
      if (j) m.rotation.y = Math.atan2(w.at.x - j.end.x, w.at.z - j.end.z);
      m.name = `waystone-${w.id}`;
      game.engine.scene.add(m);
      this.meshes.set(w.id, m);
    }
  }
  get lit() { return new Set(this.game.ext.d.waystones || []); }

  refresh() {
    const lit = this.lit;
    for (const [id, m] of this.meshes) {
      const on = lit.has(id);
      m.userData.rune.color.set(on ? '#8ae0ff' : '#4a5a7a');
      m.userData.rune.emissive.set(on ? '#3a90c0' : '#000000');
    }
  }

  tick() {
    const p = this.game.player.pos;
    const lit = this.lit;
    for (const w of WAYSTONES) {
      if (lit.has(w.id)) continue;
      if (Math.hypot(p.x - w.at.x, p.z - w.at.z) < 6) {
        this.game.ext.change((d) => { d.waystones = [...new Set([...(d.waystones || []), w.id])]; });
        this.refresh();
        this.game.audio.sfx('achievement');
        this.game.ui.toast(`Waystone lit: ${w.name}. Stand at any lit waystone and press E to travel between them.`, { icon: 'map', title: 'Fast travel', ms: 4500 });
        this.game.ext.bump('waystones');
      }
    }
  }

  near(r = 2.5) {
    const p = this.game.player.pos;
    return WAYSTONES.find((w) => Math.hypot(p.x - w.at.x, p.z - w.at.z) < r) || null;
  }

  travel(id) {
    const g = this.game;
    const w = WAYSTONES.find((x) => x.id === id);
    if (!w || !this.lit.has(id)) { g.ui.toast('Visit that waystone first to light it.'); return false; }
    if (g.fishing.busy) g.fishing.cancel(); // any line in the water is reeled in as you go
    if (g.selfie?.active) g.selfie.stop();
    g.ui.closeAll();
    const fade = document.createElement('div');
    fade.className = 'travel-fade';
    g.ui.root.append(fade);
    g.audio.sfx('meteor');
    setTimeout(() => {
      if (g.player.mode === 'boat') { g.player.mode = 'shore'; g.actor.setMode('shore'); }
      const y = groundY(w.at.x + 1.2, w.at.z) ?? groundY(w.at.x, w.at.z) ?? 1;
      g.player.pos.set(w.at.x + 1.2, y, w.at.z);
      g.player.baseY = y; g.player.target = null;
      g.engine.cam.target.set(g.player.pos.x, y + 0.8, g.player.pos.z);
      g.fx.sparkle(g.actor.headWorld(), '#8ae0ff', 30);
      g.ext.bump('travels');
    }, 350);
    setTimeout(() => fade.remove(), 900);
    return true;
  }
}
