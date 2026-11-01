// Camp chairs on the banks around every fishing spot: walk up, press E to sit, and fish from the chair.
// Chairs are placed from a fixed seed, so every player sees the same ones; who is sitting where is
// shared through the normal state (seat: 1), and a chair someone else is in can't be taken.
import { mulberry32 } from '../core/rng.js';
import { groundY, isWater, RIVER, dryAt, walkY, onDock, deckHit } from '../world/terrain.js';
import { addCircle, blocked } from '../world/colliders.js';
import { softChairs } from '../world/softprops.js';
import { CAMPFIRE, CAMP_FIRE } from '../world/props.js';
import { FERNVIEW_FIRE } from '../world/campers.js';
import { CAIRNS } from '../world/dressing.js';
import { heightAt } from '../world/terrain.js';
import { AREAS, bankSpot } from './npcs.js';

export const SEAT_H = 0.26; // seat height above the ground

const walkable = (x, z) => groundY(x, z) != null && dryAt(x, z, 0.55, 0.22) && !blocked(x, z, 0.35, 'shore') && !onDock(x, z) && !deckHit(x, z, 3) && Object.values(CAIRNS).every((c) => Math.hypot(x - c.x, z - c.z) > 3); // v1.8.2: the whole chair on dry ground; v1.9.3: on the bank, not on or beside a dock
const waterAhead = (x, z, yaw, d = 4) => isWater(x + Math.sin(yaw) * d, z + Math.cos(yaw) * d);

/** Pick chair spots: a pair side by side and a lone chair or two per fishing area. Pure, from a seed. */
export function chairSpots(avoid = []) {
  const r = mulberry32(90210);
  const out = [];
  const clear = (s, d) => out.every((c) => Math.hypot(c.x - s.x, c.z - s.z) > d) && avoid.every((a) => Math.hypot(a.x - s.x, a.z - s.z) > 4);
  for (const area of AREAS) {
    const cands = [];
    if (area.river) {
      for (let i = 2; i < RIVER.length - 1; i += 2) {
        const [x0, z0] = RIVER[i], [x1, z1] = RIVER[i + 1];
        const len = Math.hypot(x1 - x0, z1 - z0), px = -(z1 - z0) / len, pz = (x1 - x0) / len;
        for (const s of [1, -1]) { const sp = bankSpot(x0, z0, px * s, pz * s); if (sp) cands.push(sp); }
      }
    } else if (area.water) {
      const off = r();
      for (let i = 0; i < 24; i++) {
        const ang = ((i * 7) % 24 / 24 + off) * Math.PI * 2; // spread the tries around the shore
        const sp = bankSpot(area.water.x, area.water.z, Math.cos(ang), Math.sin(ang));
        if (sp) cands.push(sp);
      }
    } else continue;
    const want = area.id === 'cove' ? 4 : 3;
    let n = 0, paired = false;
    for (const c of cands) {
      if (n >= want) break;
      if (!walkable(c.x, c.z) || !clear(c, n ? 9 : 3)) continue;
      out.push({ x: c.x, z: c.z, yaw: c.yaw, area: area.id }); n++;
      if (!paired) { // a friend's chair beside the first one
        const sx = Math.cos(c.yaw), sz = -Math.sin(c.yaw); // sideways
        for (const s of [1.15, -1.15]) {
          const p = { x: c.x + sx * s, z: c.z + sz * s };
          if (walkable(p.x, p.z) && waterAhead(p.x, p.z, c.yaw, 4.5) && clear(p, 1)) { out.push({ ...p, yaw: c.yaw, area: area.id }); n++; paired = true; break; }
        }
      }
    }
  }
  return out;
}

export class Chairs {
  constructor(game) {
    this.game = game;
    const avoid = (game.npcs?.list || []).map((n) => n.home);
    this.list = chairSpots(avoid).map((c, i) => ({ ...c, id: i, y: walkY(c.x, c.z) ?? groundY(c.x, c.z) ?? 1, h: SEAT_H, kind: 'chair' }));
    this.mesh = softChairs(this.list);
    game.engine.scene.add(this.mesh);
    for (const c of this.list) addCircle(c.x, c.z, 0.3);
    // the log benches by both campfires: two seats each, facing the flames
    let id = this.list.length;
    for (const f of [CAMPFIRE, CAMP_FIRE, FERNVIEW_FIRE]) {
      for (const ox of [-2.25, 2.25]) for (const oz of [-0.25, 0.65]) {
        const x = f.x + ox * 0.97, z = f.z + oz, y = heightAt(f.x + ox, f.z + oz);
        this.list.push({ id: id++, x, z, y, h: 0.42, kind: 'log', yaw: Math.atan2(f.x - x, f.z - z) });
      }
    }
    this.seat = null; // the chair you're in
  }

  /** The nearest free chair within reach, or null. */
  near(pos, reach = 1.7) {
    let best = null, bd = reach;
    for (const c of this.list) {
      const d = Math.hypot(c.x - pos.x, c.z - pos.z);
      if (d < bd && !this.taken(c)) { best = c; bd = d; }
    }
    return best;
  }

  taken(c) {
    for (const r of this.game.remotes?.list?.values?.() || []) {
      const s = r.peer?.state;
      if (s?.seat && Math.hypot(s.x - c.x, s.z - c.z) < 0.5) return true;
    }
    return false;
  }

  sit(c) {
    const g = this.game, pl = g.player;
    if (!c || pl.mode !== 'shore') return;
    this.standAt = { x: pl.pos.x, z: pl.pos.z };
    this.seat = c;
    pl.target = null; pl.air = 0; pl.vy = 0;
    pl.pos.set(c.x, c.y, c.z); pl.baseY = c.y; pl.yaw = c.yaw;
    g.myEmote = null;
    g.audio?.sfx?.('plop');
    if (c.kind === 'log') g.ui.toast('Warm hands by the fire. Move to get up.', { icon: 'flame' });
    else if (!g.profile.stats?.chairSits) g.ui.toast('Comfy. Cast from your chair; move to get up.', { icon: 'info' });
    g.bumpStat?.('chairSits');
  }

  stand() {
    const g = this.game, pl = g.player, c = this.seat;
    if (!c) return;
    this.seat = null;
    // step out beside or behind the chair
    const back = { x: c.x - Math.sin(c.yaw) * 0.8, z: c.z - Math.cos(c.yaw) * 0.8 };
    const side = { x: c.x + Math.cos(c.yaw) * 0.8, z: c.z - Math.sin(c.yaw) * 0.8 };
    const to = [this.standAt, back, side, { x: c.x - Math.cos(c.yaw) * 0.8, z: c.z + Math.sin(c.yaw) * 0.8 }].find((p) => p && pl.canStand(p.x, p.z)) || back;
    pl.pos.x = to.x; pl.pos.z = to.z;
  }

  /** Per frame, before the player moves: get up on any move input, else stay put in the chair. */
  hold(dt) {
    const g = this.game, pl = g.player, c = this.seat;
    if (!c) return false;
    const wantsMove = (pl.keys.size && ['up', 'down', 'left', 'right'].some((k) => pl.held(k)) && g.fishing.state !== 'reeling') || pl.stick || pl.target || pl.mode !== 'shore';
    if (wantsMove && !g.fishing.busy) { this.stand(); return false; }
    return true;
  }

  /** After the player update: pin to the seat and keep facing roughly out from the chair. */
  pin() {
    const pl = this.game.player, c = this.seat;
    if (!c) return;
    pl.pos.set(c.x, c.y, c.z); pl.baseY = c.y; pl.moving = false; pl.target = null;
    let d = pl.yaw - c.yaw; d = Math.atan2(Math.sin(d), Math.cos(d));
    pl.yaw = c.yaw + Math.max(-0.8, Math.min(0.8, d));
  }

  contextActions() {
    const g = this.game, pl = g.player;
    if (pl.mode !== 'shore') return [];
    if (this.seat) return [{ id: 'stand', label: 'Stand up', fn: () => this.stand() }];
    const c = this.near(pl.pos);
    return c ? [{ id: 'sit', label: c.kind === 'log' ? 'Sit by the fire' : 'Sit down', color: 'green', at: { x: c.x, y: c.y, z: c.z, h: c.kind === 'log' ? 1.5 : 1.3 }, fn: () => this.sit(c) }] : [];
  }
}

