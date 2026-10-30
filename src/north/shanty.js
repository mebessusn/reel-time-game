// Frostmere: renting an ice shanty. Step up to any shanty on the bay and rent it for your visit: inside it's warm
// (a little stove), your hole never skins over and the fish come a bit quicker. The shanty's walls and roof are
// swapped for a cut-away view (art/src/hearthwick.py hw_shanty_inside) so you can see yourself fishing.
import * as THREE from 'three';
import { mergedMesh } from './instancing.js';
import { addSolidFn } from '../world/colliders.js';
import { ICE_Y } from './geo.js';
import { HOLE_R } from './ice.js';

export const SHANTY_RENT = { coins: 60 };

export class Shanty {
  constructor(north) {
    this.north = north; this.game = north.game; this.inside = null; this.rented = null;
    // v1.17.1: inside, the shanty's walls are the walls: you can move about the floor (round the hole) but not through them
    addSolidFn((x, z, r) => {
      const sh = this.inside; if (!sh || r > 0.5) return false;
      const dx = x - sh.x, dz = z - sh.z, lx = dx * Math.cos(sh.ry) - dz * Math.sin(sh.ry), lz = dx * Math.sin(sh.ry) + dz * Math.cos(sh.ry);
      return Math.abs(lx) > 0.92 - r || Math.abs(lz) > 1.12 - r;
    });
  }
  /** The shanty in front of you (its door within reach). */
  near() {
    const p = this.game.player.pos;
    for (const sh of this.north.village?.shanties || []) {
      const dx = sh.x + Math.sin(sh.ry) * 1.9, dz = sh.z + Math.cos(sh.ry) * 1.9;
      if (Math.hypot(p.x - dx, p.z - dz) < 1.8) return sh;
    }
    return null;
  }
  contextActions() {
    if (this.inside) return [{ id: 'shanty-leave', label: 'Leave the shanty', color: 'green', fn: () => this.leave() }];
    const sh = this.near();
    if (!sh) return [];
    const mine = this.rented === sh;
    return [{ id: 'shanty', label: mine ? 'Go into your shanty' : `Rent this shanty (${SHANTY_RENT.coins} coins)`, color: 'gold', at: { x: sh.x, z: sh.z, y: ICE_Y, h: 3 }, fn: () => (mine ? this.enter(sh) : this.rent(sh)) }];
  }
  async rent(sh) {
    const g = this.game, r = await g.save.spend('shanty', 'rent', SHANTY_RENT);
    if (!r.ok) { g.ui.toast(r.reason || 'Not enough coins.'); return; }
    g.audio.sfx('purchase');
    this.rented = sh;
    this.enter(sh);
    this.north.onEvent('shanty');
  }
  enter(sh) {
    const g = this.game, V = this.north.village;
    g.fishing.cancel();
    V.showShanty(sh, false);
    const cut = this.cut || (this.cut = mergedMesh('hw_shanty_inside'));
    cut.position.set(sh.x, ICE_Y, sh.z); cut.rotation.y = sh.ry; cut.visible = true;
    if (!cut.parent) V.group.add(cut);
    if (!this.stove) { this.stove = new THREE.PointLight('#ff8a3a', 1.2, 6, 1.6); this.stove.userData.lbAlways = true; V.group.add(this.stove); }
    const L = (lx, lz) => ({ x: sh.x + lx * Math.cos(sh.ry) + lz * Math.sin(sh.ry), z: sh.z - lx * Math.sin(sh.ry) + lz * Math.cos(sh.ry) });
    const sp = L(-0.6, 0.4); this.stove.position.set(sp.x, ICE_Y + 0.5, sp.z); this.stove.visible = true; this.stove.intensity = 1.2;
    // the hole in the floor, and your seat on the bench behind it
    const hp = L(0.15, 0.35);
    this.hole = { x: hp.x, z: hp.z, r: HOLE_R, shanty: true, t: 0, skin: 0, mine: true };
    this.north.shantyHole = this.hole; this.north.refreshHoles();
    const seat = L(0.15, -0.55);
    g.player.pos.set(seat.x, ICE_Y + 0.12, seat.z); g.player.baseY = g.player.pos.y; g.player.target = null;
    g.player.yaw = sh.ry; // facing the hole and the door
    g.engine.cam.target.set(seat.x, ICE_Y + 0.9, seat.z); g.engine.cam.yaw = sh.ry + Math.PI; g.engine.cam.pitch = Math.max(g.engine.cam.pitch, 0.95); g.engine.cam.zoom = Math.min(g.engine.cam.zoom, 0.55); // (close in: the walls are cut away at shoulder height)
    this.inside = sh;
    g.ui.toast('Snug in your shanty. The stove\'s lit, your hole won\'t freeze, and the fish bite a little quicker in here. Fishing button to drop your line.', { title: 'Ice shanty', icon: 'home', ms: 6000 });
  }
  leave() {
    const g = this.game, sh = this.inside; if (!sh) return;
    g.fishing.cancel();
    this.north.village.showShanty(sh, true);
    if (this.cut) this.cut.visible = false;
    if (this.stove) { this.stove.visible = false; this.stove.intensity = 0; }
    this.north.shantyHole = null; this.north.refreshHoles();
    const out = { x: sh.x + Math.sin(sh.ry) * 2.2, z: sh.z + Math.cos(sh.ry) * 2.2 };
    g.player.pos.set(out.x, ICE_Y, out.z); g.player.baseY = ICE_Y;
    this.inside = null;
  }
  /** The floor boards under (x, z) while you're inside (the hatch over the hole is open), else null. */
  floorAt(x, z) {
    const sh = this.inside; if (!sh) return null;
    const dx = x - sh.x, dz = z - sh.z, lx = dx * Math.cos(sh.ry) - dz * Math.sin(sh.ry), lz = dx * Math.sin(sh.ry) + dz * Math.cos(sh.ry);
    if (Math.abs(lx) > 1.0 || Math.abs(lz) > 1.2) return null;
    if (lx > -0.3 && lx < 0.6 && lz > -0.1 && lz < 0.8) return null; // (the hatch)
    return ICE_Y + 0.12;
  }
  /** Leaving by walking off (or flying home) counts as leaving. */
  update() {
    if (!this.inside) return;
    const p = this.game.player.pos, sh = this.inside;
    if (!this.north.here || Math.hypot(p.x - sh.x, p.z - sh.z) > 2.6) this.leave();
  }
}
