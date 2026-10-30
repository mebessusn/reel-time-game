// Frostmere: the two airbases. In the valley, Frostpine Seaplane Base on Frostpine Lake's east shore (a clearing at
// the end of a trail spur, terrain.js CLEARINGS.seabase): Skye's hangar, a float dock with the Snow Goose moored
// alongside, a windsock and a fuel shed. Up north, the Hearthwick ice strip's hangar where she parks.
import * as THREE from 'three';
import { addWalkway, WATER_Y } from '../world/terrain.js';
import { addBox, addCircle } from '../world/colliders.js';
import { SnowGoose, Windsock, node, signBoard } from './plane.js';
import { Actor } from '../game/actor.js';
import { defaultAvatar } from '../data/avatarOptions.js';
import { toWorld, P, ICE_Y } from './geo.js';

export const SKYE_LOOK = { ...defaultAvatar('female'), skin: 2, height: 'tall', frame: 'slim', hair: 'braids', hairColor: 3, eyes: 'focused', brows: 'arched', mouth: 'smirk', hat: 'trapper', eyewear: 'goggles', shirt: 'puffer', shirtColor: 0, pants: 'cargo', pantsColor: 1, shoes: 'boots', accessory: 'acc_scarf' };

// the valley base (world coordinates)
export const BASE = {
  hangar: { x: -63, z: -140, ry: -Math.PI / 2, s: 0.75 }, // (v1.17.1: back on dry land, clear of the pond behind it)
  dock: { x: -78, z: -140, len: 16, y: 1.2 }, // runs west from the shore
  mooring: { x: -89, z: -144.6, yaw: -Math.PI / 2 }, // nose west, floats alongside the dock's south side
  windsock: { x: -50, z: -154 },
  fuel: { x: -53.5, z: -147.5, ry: Math.PI }, // (v1.17.1: moved inland off Tarn Run's bank, round behind the hangar's south corner)
  skye: { x: -86, z: -141.4 },
};
// the Hearthwick ice strip (world coordinates from geo.js local)
const SH = toWorld(30, 134), SP = toWorld(32, 100), SS = toWorld(36, 103), SW = toWorld(52, 120);
export const STRIP = {
  hangar: { x: SH.x, z: SH.z, ry: Math.PI, s: 0.75 },
  park: { x: SP.x, z: SP.z, yaw: Math.PI }, // where the plane stops after landing, nose north toward the lake
  skye: { x: SS.x, z: SS.z },
  windsock: { x: SW.x, z: SW.z },
  exit: toWorld(35, 106),
};

export class Airbases {
  /** v1.17.2: the whole sign board stands out in front of the eaves (they reach z 7.6), carried on two brackets. */
  hangSign(hg) {
    hg.traverse((o) => { if (!o.isMesh) return; o.geometry.computeBoundingBox(); const b = o.geometry.boundingBox; if (b.min.y > 5.4 && b.max.y < 6.6 && b.min.z > 7 && b.max.x - b.min.x > 5) o.position.z += 0.75; }); // (the board and its red backing)
    for (const s of [-1.9, 1.9]) { const b = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.12, 0.9), new THREE.MeshLambertMaterial({ color: '#3a2a1c' })); b.position.set(s, 6.05, 7.5); hg.add(b); }
  }
  constructor(game) {
    this.game = game;
    const scene = game.engine.scene;
    // ---------------- the valley's seaplane base
    const vb = this.valley = new THREE.Group(); vb.name = 'seaplane-base';
    const B = BASE;
    const hg = node('ab_hangar'); hg.position.set(B.hangar.x, 1.0, B.hangar.z); hg.rotation.y = B.hangar.ry; hg.scale.setScalar(B.hangar.s); vb.add(hg);
    this.hangSign(hg);
    const sign = signBoard('FROSTPINE AIR', 5.0 * B.hangar.s, 0.78 * B.hangar.s); sign.position.set(B.hangar.x - 8.42 * B.hangar.s, 1.0 + 6.05 * B.hangar.s, B.hangar.z); sign.rotation.y = -Math.PI / 2; vb.add(sign); // (v1.17.1: the lettering sits on the hangar's own sign board over the door (art/src/snowgoose.py: 0, H + 1.45, D + 0.2))
    // (hangar walls: the back and both sides; the open front faces the lake)
    const hw = 8.5 * B.hangar.s, hd = 7 * B.hangar.s;
    addBox(B.hangar.x + hd - 0.3, B.hangar.z - hw, B.hangar.x + hd + 0.3, B.hangar.z + hw);
    addBox(B.hangar.x - hd, B.hangar.z - hw - 0.3, B.hangar.x + hd, B.hangar.z - hw + 0.3);
    addBox(B.hangar.x - hd, B.hangar.z + hw - 0.3, B.hangar.x + hd, B.hangar.z + hw + 0.3);
    const dk = node('ab_dock'); dk.position.set(B.dock.x, B.dock.y - 0.66, B.dock.z); dk.rotation.y = -Math.PI / 2; vb.add(dk);
    addWalkway({ cx: B.dock.x - B.dock.len / 2, cz: B.dock.z, ux: -1, uz: 0, half: B.dock.len / 2 + 0.3, w: 3, y: B.dock.y });
    this.vsock = new Windsock(); this.vsock.group.position.set(B.windsock.x, 1.0, B.windsock.z); vb.add(this.vsock.group);
    addCircle(B.windsock.x, B.windsock.z, 0.35);
    const fs = node('ab_fuelshed'); fs.position.set(B.fuel.x, 1.0, B.fuel.z); fs.rotation.y = B.fuel.ry; vb.add(fs);
    addBox(B.fuel.x - 1.4, B.fuel.z - 1.3, B.fuel.x + 1.4, B.fuel.z + 1.3); addCircle(B.fuel.x - 2.1, B.fuel.z - 0.15, 0.85); addCircle(B.fuel.x + 1.6, B.fuel.z - 0.6, 0.25); // (the drums, and the fuel pump)
    scene.add(vb);
    // the plane, moored (this one flies the trips from the valley; the north has its own copy)
    this.plane = new SnowGoose();
    this.moor();
    scene.add(this.plane.group);
    addCircle(B.mooring.x, B.mooring.z, 3, { water: true }); addCircle(B.mooring.x - 3.5, B.mooring.z, 2.5, { water: true });
    // Skye, on the dock by her plane
    this.skye = this.makeSkye(scene, B.skye.x, B.dock.y, B.skye.z, Math.PI);
    // ---------------- up north: the strip's hangar (built with the rest of the north, on the first trip)
    this.northBuilt = false;
  }
  makeSkye(scene, x, y, z, yaw) {
    const actor = new Actor(scene);
    actor.setLook(SKYE_LOOK, { rod: 'rod_bamboo', lure: 'lure_classic', boat: 'boat_oak' });
    const p = { name: 'Skye Halloran', title: 'Bush pilot', actor, pos: new THREE.Vector3(x, y, z), yaw, face: yaw };
    actor.update(0, 0, { x, y, z, yaw, mode: 'shore', pose: 'idle', moving: false, rod: 'back' });
    return p;
  }
  /** The plane back at its mooring, bobbing at the dock. */
  moor() {
    const M = BASE.mooring;
    this.plane.group.position.set(M.x, WATER_Y - 0.3, M.z); this.plane.group.rotation.set(0, M.yaw, 0);
    this.plane.rpm = 0; this.atMooring = true;
  }
  buildNorth(world) {
    if (this.northBuilt) return;
    this.northBuilt = true;
    const g = new THREE.Group(); g.name = 'north-airbase';
    const S = STRIP;
    const hg = node('ab_hangar_snow'); hg.position.set(S.hangar.x, 0, S.hangar.z); hg.rotation.y = S.hangar.ry; hg.scale.setScalar(S.hangar.s);
    // (sit it on the snow: the ground under its middle)
    hg.position.y = this.game.north.groundAt(S.hangar.x, S.hangar.z) ?? 2;
    g.add(hg);
    this.hangSign(hg);
    const sign = signBoard('HEARTHWICK AIR', 3.6, 0.55); sign.position.set(S.hangar.x, hg.position.y + 6.05 * S.hangar.s, S.hangar.z - 8.42 * S.hangar.s); // (v1.17.2: out in front of the roof's edge)
    sign.rotation.y = Math.PI; g.add(sign);
    const hw = 8.5 * S.hangar.s, hd = 7 * S.hangar.s;
    addBox(S.hangar.x - hw, S.hangar.z + hd - 0.3, S.hangar.x + hw, S.hangar.z + hd + 0.3);
    addBox(S.hangar.x - hw - 0.3, S.hangar.z - hd, S.hangar.x - hw + 0.3, S.hangar.z + hd);
    addBox(S.hangar.x + hw - 0.3, S.hangar.z - hd, S.hangar.x + hw + 0.3, S.hangar.z + hd);
    this.nsock = new Windsock(); this.nsock.group.position.set(S.windsock.x, this.game.north.groundAt(S.windsock.x, S.windsock.z) ?? ICE_Y, S.windsock.z); g.add(this.nsock.group);
    addCircle(S.windsock.x, S.windsock.z, 0.35);
    world.group.add(g);
    this.northSkye = this.makeSkye(this.game.engine.scene, S.skye.x, ICE_Y, S.skye.z, -2.4);
    this.northSkye.actor.root.visible = false;
  }
  /** Each frame: windsocks, the moored plane bobbing, Skye turning to you when you come close. */
  update(dt, t, { north, wind = 0.6 } = {}) {
    const g = this.game, p = g.player.pos;
    this.vsock.update(t, 0.6, wind);
    this.nsock?.update(t, -0.4, wind);
    if (this.atMooring) {
      const M = BASE.mooring;
      this.plane.group.position.y = WATER_Y - 0.3 + Math.sin(t * 1.3) * 0.04;
      this.plane.group.rotation.z = Math.sin(t * 0.9) * 0.012; this.plane.group.rotation.x = Math.sin(t * 1.1 + 1) * 0.008;
      this.plane.group.position.x = M.x;
      this.plane.animate(dt, { throttle: 0 });
    }
    for (const s of [this.skye, north ? this.northSkye : null]) {
      if (!s) continue;
      const vis = s.pos.distanceTo(p) < 80;
      s.actor.root.visible = vis && (s !== this.northSkye || north);
      if (!s.actor.root.visible) continue;
      const dx = p.x - s.pos.x, dz = p.z - s.pos.z, close = dx * dx + dz * dz < 25;
      const want = close ? Math.atan2(dx, dz) : s.yaw + Math.sin(t * 0.3) * 0.3;
      let d = want - s.face; d = Math.atan2(Math.sin(d), Math.cos(d)); s.face += d * Math.min(1, dt * 3);
      s.actor.update(dt, t, { x: s.pos.x, y: s.pos.y, z: s.pos.z, yaw: s.face, mode: 'shore', pose: close && Math.sin(t * 0.6) > 0.97 ? 'wave' : 'idle', moving: false, rod: 'back' });
    }
  }
}
