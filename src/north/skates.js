// Frostmere: ice skates. Rent a pair at the rink's skate hut (free) or buy your own from Pell; lace them up on any
// ice. On skates you glide with real momentum (player.skateStep): long curving turns, a hockey stop with a spray of
// ice when you pull back hard, and a speed boost when you sprint. On snow they're hopeless: you clomp.
import { toLocal, inNorth, kindAt, isIce, ICE_Y } from './geo.js';
import { BUILDINGS } from './hearthwick.js';
import { northSfx } from './sounds.js';

export class Skates {
  constructor(north) { this.north = north; this.game = north.game; this.on = false; this.rented = false; this.sndT = 0; this.sprayT = 0; this.landWarned = false; }
  get owned() { return !!this.north.d.gear?.skates || this.rented; }
  hut() { const b = BUILDINGS.find((q) => q.id === 'skatehut'); return { x: b.x + Math.sin(b.ry) * (b.hd + 1.1), z: b.z + Math.cos(b.ry) * (b.hd + 1.1), y: b.y }; }
  onIce() {
    const p = this.game.player.pos;
    if (!inNorth(p.x, p.z)) return false;
    const [u, v] = toLocal(p.x, p.z);
    return isIce(kindAt(u, v)) && Math.abs(p.y - ICE_Y) < 0.35 && !this.north.ice?.holeNear(0.5) && this.north.floorAt?.(p.x, p.z) == null; // (not on a shanty's or a dock's floor)
  }
  /** For the avatar: 2 pushing, 1 gliding, 0 not skating. */
  pose() { const pl = this.game.player; return this.on && pl.skating ? (pl.pushing ? 2 : pl.moving ? 1 : 0) || 1 : 0; }
  contextActions() {
    const g = this.game, p = g.player.pos, H = this.hut(), out = [];
    if (Math.hypot(p.x - H.x, p.z - H.z) < 2.6) {
      if (!this.owned) out.push({ id: 'skates-rent', label: 'Rent skates (free)', color: 'blue', at: { x: H.x, z: H.z, y: H.y, h: 2.4 }, fn: () => { this.rented = true; this.set(true); g.ui.toast('Skates on! Glide out onto the ice. Sprint to skate faster; pull back hard to hockey-stop.', { title: 'Skates', icon: 'star', ms: 5000 }); } });
      else if (this.rented && !this.north.d.gear?.skates) out.push({ id: 'skates-return', label: 'Return the skates', at: { x: H.x, z: H.z, y: H.y, h: 2.4 }, fn: () => { this.rented = false; this.set(false); } });
    }
    if (this.owned && !g.fishing.busy && !out.length) {
      if (this.on) out.push({ id: 'skates-off', label: 'Take off skates', fn: () => this.set(false) });
      else if (this.onIce()) out.push({ id: 'skates-on', label: 'Lace up skates', color: 'blue', fn: () => this.set(true) });
    }
    return out;
  }
  set(on) {
    const g = this.game;
    this.on = on;
    if (!on) { g.player.skating = false; g.player.skateV?.set(0, 0, 0); }
    g.audio.sfx('click');
    if (on) this.north.onEvent('skates');
  }
  update(dt) {
    const g = this.game, pl = g.player;
    if (!this.on || !this.north.here || this.north.trip || this.north.sleds?.riding) { pl.skating = false; return; }
    if (g.fishing.busy || this.north.ice?.drill) { pl.skating = false; pl.skateV?.set(0, 0, 0); return; }
    const ice = this.onIce();
    if (ice !== pl.skating && !ice) pl.skateV?.set(0, 0, 0);
    pl.skating = ice;
    if (!ice && pl.mode === 'shore') {
      pl.speedMult = (pl.speedMult ?? 1) * 0.45; // clomping over the snow on blades
      if (!this.landWarned && pl.moving) { this.landWarned = true; g.ui.toast('Skates are no good on snow! Take them off (E), or get back on the ice.', { icon: 'waves', ms: 3500 }); }
      return;
    }
    this.landWarned = false;
    const sp = Math.hypot(pl.skateV?.x || 0, pl.skateV?.z || 0);
    this.sndT -= dt;
    if (pl.pushing && sp > 1.5 && this.sndT <= 0) { this.sndT = 0.55; northSfx(g.audio, 'skate', { vol: 0.5 + sp / 20 }); }
    // a hockey stop sprays ice; a fast glide kicks up a little sparkle
    if (pl.hockeyStop && sp > 2) {
      this.sprayT -= dt;
      if (this.sprayT <= 0) { this.sprayT = 0.4; northSfx(g.audio, 'hockeystop'); }
      const p = pl.pos, d = pl.dir;
      for (let i = 0; i < 3; i++) g.fx.spawn(p.x + d.x * 0.4, ICE_Y + 0.05, p.z + d.z * 0.4, d.x * sp * 0.4 + (Math.random() - 0.5) * 2, 0.8 + Math.random() * 1.2, d.z * sp * 0.4 + (Math.random() - 0.5) * 2, i % 2 ? '#ffffff' : '#dcecf6', 0.5, -6);
      if (sp < 3) this.north.onEvent('hockeystop');
    } else this.sprayT = 0;
    if (sp > 6 && Math.random() < dt * sp) g.fx.spawn(pl.pos.x, ICE_Y + 0.03, pl.pos.z, (Math.random() - 0.5) * 0.6, 0.3, (Math.random() - 0.5) * 0.6, '#eef8ff', 0.4, -2);
  }
}
