// Treasure maps (v1.8): now and then a catch comes up with a soggy map in its mouth. The map is a sketch of
// a patch of the valley with a red X somewhere on it (not in the middle: you have to read the land), and
// the name of the nearest place. Walk there; as you get close the map "warms" in your hands. Press E to
// dig anywhere near the X: a wrong guess turns up worms and a hint, the right spot a chest.
import * as THREE from 'three';
import { h, clear } from '../ui/dom.js';
import { icon } from '../ui/icons.js';
import { baseMap } from '../ui/worldmap.js';
import { HALF, walkY, heightAt, trailDist, regionName, CLEARINGS, onDock } from '../world/terrain.js';
import { blocked } from '../world/colliders.js';
import { ITEMS } from '../data/items.js';
import { buildChest, coinMaterial, pearlMaterial } from '../entities/treasureModels.js';

const FIND_CHANCE = 0.01; // per fish landed (v1.13.9: was 0.04, about a map every 25 fish)
const DIG_R = 2.4; // how close to the X counts
const SENSE_R = 40;

export class Treasure {
  constructor(game) {
    this.game = game;
    this.chest = null;
    this.sense = -1;
    this.dig = null;
  }
  get d() { return this.game.ext.d; }
  get map() { return this.d.treasure?.active ? this.d.treasure : null; }

  // a buried spot: dry, level, off the trails and away from settlements, docks and props
  pickSpot() {
    for (let i = 0; i < 400; i++) {
      const x = (Math.random() * 2 - 1) * (HALF - 20), z = (Math.random() * 2 - 1) * (HALF - 20);
      if (Math.hypot(x, z) < 40) continue;
      if (walkY(x, z) == null || heightAt(x, z) > 5 || trailDist(x, z) < 4 || onDock(x, z) || blocked(x, z, 1.2)) continue;
      if (Object.values(CLEARINGS).some((c) => Math.hypot(x - c.x, z - c.z) < c.r + 4)) continue;
      return { x: Math.round(x * 2) / 2, z: Math.round(z * 2) / 2 };
    }
    return null;
  }

  /** After a fish is landed: maybe it brought a map. */
  onCatch() {
    if (this.map || Math.random() > FIND_CHANCE * (this.game.forceTreasure ? 100 : 1)) return false;
    return this.grant();
  }

  /** v1.15.5 Open Waters: a smugglers' map to a fixed spot at sea (Smuggler's Rock's grotto), with richer loot. */
  grantAt(at, place) {
    if (this.map) return false;
    const id = Date.now().toString(36);
    const ox = (Math.random() - 0.5) * 20, oz = (Math.random() - 0.5) * 20;
    this.game.ext.change((d) => { d.treasure = { active: true, id, x: at.x, z: at.z, ox, oz, place, wrong: 0, found: d.treasure?.found || 0, sea: true }; });
    this.mark();
    this.game.audio.sfx('reveal', { tier: 'epic' });
    this.game.chat?.system(`A smugglers' map! The X is somewhere on ${place}. ${this.hasShovel ? 'Bring your shovel.' : 'You\'ll need a shovel to dig: Gus sells one at Cozy Cove.'}`, 'quest', { popup: true });
    const show = () => { if (this.game.ui.revealCard?.isConnected || this.game.fishing.state === 'landed') setTimeout(show, 300); else this.open(); };
    setTimeout(show, 50);
    return true;
  }

  grant() {
    const at = this.pickSpot();
    if (!at) return false;
    const id = Date.now().toString(36);
    // where the X sits on the sketch: offset from the middle so it isn't a giveaway
    const ox = (Math.random() - 0.5) * 36, oz = (Math.random() - 0.5) * 36;
    this.game.ext.change((d) => { d.treasure = { active: true, id, x: at.x, z: at.z, ox, oz, place: regionName(at.x, at.z), wrong: 0, found: d.treasure?.found || 0 }; });
    this.mark(); // v1.8.2: the spot goes straight onto your map (a red X) and your waypoint
    this.game.audio.sfx('reveal', { tier: 'rare' });
    this.game.chat?.system(`A soggy treasure map came up on your hook! It shows a spot near ${this.map.place}. Look at it again any time from the Journal (J).${this.hasShovel ? '' : ' You\'ll need a shovel to dig it up: Gus sells one.'}`, 'quest', { popup: true });
    // show the map once the catch card is closed, never on top of it (its buttons must stay clickable)
    const show = () => { if (this.game.ui.revealCard?.isConnected || this.game.fishing.state === 'landed') setTimeout(show, 300); else this.open(); };
    setTimeout(show, 50);
    return true;
  }

  /** v1.8.2: put the X on the valley map (for MARK_MS) and point your waypoint at it. */
  mark() {
    const g = this.game, m = this.map;
    if (!m) return;
    g.ext.change((d) => { d.treasure.markedUntil = Date.now() + MARK_MS; d.waypoint = { x: Math.round(m.x), z: Math.round(m.z), name: 'Treasure X' }; });
    g.waypoint?.sync?.();
  }
  /** Seconds the X stays on the map (0 = not marked). */
  markLeft() { const m = this.map; return m?.markedUntil ? Math.max(0, (m.markedUntil - Date.now()) / 1000) : 0; }
  get marked() { return this.markLeft() > 0; }

  /** The map card: a sepia sketch of the land around the X. */
  open() {
    const m = this.map;
    if (!m) { this.game.ui.toast('You have no treasure map right now. Keep fishing: maps turn up on hooks now and then.', { icon: 'map' }); return; }
    const g = this.game;
    const span = 90; // blocks across the sketch
    const cx = m.x + m.ox, cz = m.z + m.oz;
    const cv = document.createElement('canvas'); cv.width = cv.height = 360;
    const c = cv.getContext('2d');
    if (m.sea && this.seaSketch) this.seaSketch(c, cx, cz, span); // a sea map (Open Waters draws the island)
    else { const src = baseMap(), S = src.width / (HALF * 2); c.drawImage(src, (cx - span / 2 + HALF) * S, (cz - span / 2 + HALF) * S, span * S, span * S, 0, 0, 360, 360); }
    // age it: sepia, faded, stained edges
    const img = c.getImageData(0, 0, 360, 360);
    for (let i = 0; i < img.data.length; i += 4) {
      const v = (img.data[i] * 0.3 + img.data[i + 1] * 0.59 + img.data[i + 2] * 0.11);
      img.data[i] = 120 + v * 0.55; img.data[i + 1] = 92 + v * 0.48; img.data[i + 2] = 58 + v * 0.3;
    }
    c.putImageData(img, 0, 0);
    const vg = c.createRadialGradient(180, 180, 110, 180, 180, 250);
    vg.addColorStop(0, 'rgba(90,60,30,0)'); vg.addColorStop(1, 'rgba(70,40,15,0.65)');
    c.fillStyle = vg; c.fillRect(0, 0, 360, 360);
    // the X, a dotted path from the nearest edge, and a compass rose
    const px = (m.x - (cx - span / 2)) / span * 360, pz = (m.z - (cz - span / 2)) / span * 360;
    c.strokeStyle = 'rgba(120,30,20,0.7)'; c.setLineDash([6, 7]); c.lineWidth = 3;
    c.beginPath(); c.moveTo(px < 180 ? 0 : 360, pz + 40); c.quadraticCurveTo((px + 180) / 2, pz + 70, px, pz); c.stroke();
    c.setLineDash([]); c.strokeStyle = '#b01e14'; c.lineWidth = 7; c.lineCap = 'round';
    c.beginPath(); c.moveTo(px - 13, pz - 13); c.lineTo(px + 13, pz + 13); c.moveTo(px + 13, pz - 13); c.lineTo(px - 13, pz + 13); c.stroke();
    c.fillStyle = '#4a3018'; c.font = 'bold 22px serif'; c.textAlign = 'center'; c.fillText('N', 330, 34);
    c.beginPath(); c.moveTo(330, 40); c.lineTo(323, 62); c.lineTo(330, 56); c.lineTo(337, 62); c.closePath(); c.fill();
    const close = () => { card.remove(); };
    const card = h('div.treasure-card', { role: 'dialog', 'aria-label': 'Treasure map' },
      h('div.tm-paper', h('div.tm-title', 'Treasure map'), cv,
        h('div.tm-hint', `Somewhere near ${m.place}. North is up. ${this.marked ? 'The X is on your map (M) too.' : ''} Find the spot, then press E to dig.`),
        h('div.tm-btns',
          h('button.btn.ghost', { on: { click: () => { this.mark(); g.ui.toast('The X is on your map (M) for the next 10 minutes, and your waypoint points to it.', { icon: 'pin' }); close(); } } }, icon('pin'), this.marked ? 'Marked on your map' : 'Mark it again'),
          h('button.btn.gold', { on: { click: close } }, 'Got it'))));
    card.addEventListener('click', (e) => { if (e.target === card) close(); });
    g.ui.root.append(card);
  }

  // ---- the shovel (v1.8.1): you need one to dig. Gus sells it in the shop's Away gear tab. ----
  get hasShovel() { return !!this.d.tools?.shovel; }
  async buyShovel() {
    const g = this.game;
    if (this.hasShovel) return true;
    const r = await g.save.spend('gear', 'shovel', SHOVEL_PRICE);
    if (!r.ok) { g.ui.toast(r.reason || 'Not enough yet.'); return false; }
    g.ext.change((d) => { d.tools = { ...(d.tools || {}), shovel: true }; });
    g.audio.sfx('purchase');
    g.ui.toast(this.map ? 'You bought a shovel. Go find that X and press E to dig!' : 'You bought a shovel. Now you just need a treasure map: they turn up on hooks now and then.', { icon: 'map', ms: 4000 });
    return true;
  }

  contextActions() {
    const m = this.map, g = this.game;
    if (!m || g.player.mode !== 'shore' || this.dig || this.chest?.phase === 'rise') return [];
    const d = Math.hypot(g.player.pos.x - m.x, g.player.pos.z - m.z);
    if (d > 14) return [];
    if (!this.hasShovel) return [{ id: 'dig', label: 'Dig (needs a shovel)', color: 'blue', fn: () => this.needShovel() }];
    return [{ id: 'dig', label: 'Dig for treasure', color: 'gold', fn: () => this.startDig() }];
  }

  needShovel() {
    const g = this.game;
    g.ui.toast(`You need a shovel to dig. Gus sells one at the shop (Away gear tab) for ${SHOVEL_PRICE.coins} coins.`, { icon: 'shop', ms: 4500 });
    g.audio.sfx('miss');
  }

  startDig() {
    const g = this.game;
    if (!this.hasShovel) { this.needShovel(); return; }
    g.fishing.cancel();
    g.myEmote = null;
    this.dig = { t: 0, x: g.player.pos.x, z: g.player.pos.z, stroke: -1 };
    g.player.target = null;
    // a little mound of dirt grows beside you as you dig
    const fx = Math.sin(g.player.yaw), fz = Math.cos(g.player.yaw);
    const hx = this.dig.x + fx * 0.55, hz = this.dig.z + fz * 0.55;
    this.dig.hole = { x: hx, z: hz };
    this.mound?.parent?.remove(this.mound);
    this.mound = buildMound();
    this.mound.position.set(hx - fz * 0.55, (walkY(hx, hz) ?? g.player.pos.y) - 0.02, hz + fx * 0.55);
    this.mound.scale.setScalar(0.01);
    this.mound.userData.life = 25;
    g.engine.scene.add(this.mound);
  }

  async finishDig() {
    const g = this.game, m = this.map;
    const { x, z } = this.dig;
    this.dig = null;
    if (!m) return;
    const d = Math.hypot(x - m.x, z - m.z);
    if (d > DIG_R) {
      g.ext.change((s) => { s.treasure.wrong = (s.treasure.wrong || 0) + 1; s.bait.worm = (s.bait.worm || 0) + 1; });
      const way = this.relWay(m.x, m.z);
      g.ui.toast(d < 6 ? `Just a worm (+1). So close: try a few steps ${way}.` : `Only worms here (+1). Follow the compass: the X is ${way}, about ${Math.round(d)} m.`, { icon: 'worm', ms: 4200 });
      return;
    }
    g.audio.sfx('shovelhit');
    // the chest! It rises out of the hole, rattles, then the lid flies open and the loot bursts out.
    const chest = buildChest();
    const gy = walkY(m.x, m.z, 0.5) ?? g.player.pos.y;
    const hx = this.mound ? this.mound.position.x : m.x, hz = this.mound ? this.mound.position.z : m.z;
    // put it in front of you, facing you
    const fx = Math.sin(g.player.yaw), fz = Math.cos(g.player.yaw);
    const cx = g.player.pos.x + fx * 1.3, cz = g.player.pos.z + fz * 1.3;
    chest.position.set(cx, (walkY(cx, cz, 0.5) ?? gy) - 0.6, cz);
    chest.rotation.y = g.player.yaw + Math.PI;
    g.engine.scene.add(chest);
    void hx; void hz;
    // what's inside: coins and pearls, and sometimes a piece of gear you don't have
    const sea = !!m.sea; // v1.15.5: the smugglers' hoard pays better
    const coins = sea ? 900 + Math.floor(Math.random() * 600) : 150 + Math.floor(Math.random() * 300), pearls = sea ? 6 + Math.floor(Math.random() * 5) : 1 + Math.floor(Math.random() * 4); // v1.13.9: was 300-900 coins, 3-10 pearls
    const loot = ITEMS.filter((it) => ['lure', 'rod', 'hat', 'accessory'].includes(it.kind) && it.source === 'shop' && !g.profile.owned.includes(it.id) && it.price?.coins && it.price.coins < 1500);
    const item = Math.random() < 0.35 && loot.length ? loot[Math.floor(Math.random() * loot.length)].id : null;
    this.chest = { mesh: chest, t: 0, phase: 'rise', groundY: chest.position.y + 0.6, loot: { coins, pearls, item, id: m.id } };
    g.ext.change((s) => { s.treasure.active = false; s.treasure.markedUntil = 0; s.treasure.found = (s.treasure.found || 0) + 1; if (s.waypoint?.name === 'Treasure X') s.waypoint = null; });
    g.waypoint?.sync?.();
    g.ext.bump('treasures');
    if (sea) g.ext.bump('smugglerHoards');
    g.quests?.progress('treasure', {});
    this.lastFound = { coins, pearls, item };
  }

  /** Words for a direction relative to where the camera faces: ahead, to your right, behind you... */
  relWay(tx, tz) {
    const g = this.game, ang = this.screenAngle(tx, tz);
    const names = ['straight ahead', 'ahead and to the right', 'to your right', 'behind you, to the right', 'behind you', 'behind you, to the left', 'to your left', 'ahead and to the left'];
    return names[((Math.round(ang / (Math.PI / 4)) % 8) + 8) % 8] + (g ? '' : '');
  }

  /** Angle of (tx, tz) from the player, clockwise from "up the screen" (radians). */
  screenAngle(tx, tz) {
    const g = this.game, yaw = g.engine.cam.yaw;
    const fx = -Math.sin(yaw), fz = -Math.cos(yaw), rx = -fz, rz = fx;
    const dx = tx - g.player.pos.x, dz = tz - g.player.pos.z;
    return Math.atan2(dx * rx + dz * rz, dx * fx + dz * fz);
  }

  async openChest() {
    const g = this.game, c = this.chest, L = c.loot;
    g.audio.sfx('chestburst');
    g.audio.sfx('reveal', { tier: 'epic' });
    g.juice?.pop('TREASURE!', { color: '#ffd84a', size: 42, ms: 1500 });
    const top = c.mesh.position.clone().add(new THREE.Vector3(0, 0.6, 0));
    g.fx.sparkle(top, '#ffe070', 60, 1.6);
    g.fx.ring(c.mesh.position.clone().add(new THREE.Vector3(0, 0.05, 0)), '#ffd84a', 36);
    g.engine.shake = Math.max(g.engine.shake || 0, 0.35);
    this.burst = new LootBurst(g, top, Math.min(42, 18 + Math.round(L.coins / 30)), Math.min(14, L.pearls + 2));
    await g.reward('treasure', `t-${L.id}`, { coins: L.coins, pearls: L.pearls, xp: 120, item: L.item }, L.item ? `Buried treasure, with a ${ITEMS.find((i) => i.id === L.item)?.name}!` : 'Buried treasure');
  }

  update(dt) {
    const g = this.game, m = this.map;
    if (this.dig) {
      const D = this.dig;
      D.t += dt;
      g.player.target = null;
      // one stroke every 1.1 s, same as the 'dig' pose: blade bites at 0.3, dirt flies at 0.68
      const ph = (D.t % DIG_STROKE) / DIG_STROKE, stroke = Math.floor(D.t / DIG_STROKE);
      if (stroke !== D.stroke) { D.stroke = stroke; D.bit = D.tossed = false; }
      const hy = walkY(D.hole.x, D.hole.z, 0.5) ?? g.player.pos.y;
      if (!D.bit && ph > 0.3) {
        D.bit = true; g.audio.sfx('dig');
        for (let i = 0; i < 10; i++) g.fx.spawn(D.hole.x + (Math.random() - 0.5) * 0.3, hy + 0.05, D.hole.z + (Math.random() - 0.5) * 0.3, (Math.random() - 0.5) * 1.2, 1 + Math.random() * 1.2, (Math.random() - 0.5) * 1.2, Math.random() < 0.5 ? '#6a4a2a' : '#8a6438', 0.6, -9);
      }
      if (!D.tossed && ph > 0.68) {
        D.tossed = true; g.audio.sfx('dirt');
        // over the right shoulder
        const sx = Math.sin(g.player.yaw - 1.3), sz = Math.cos(g.player.yaw - 1.3);
        for (let i = 0; i < 26; i++) g.fx.spawn(D.hole.x, hy + 0.6, D.hole.z, sx * (1.5 + Math.random() * 1.5) + (Math.random() - 0.5), 2.2 + Math.random() * 1.6, sz * (1.5 + Math.random() * 1.5) + (Math.random() - 0.5), ['#5a3c20', '#7a5530', '#8f6a3e', '#4a3018'][i % 4], 0.9 + Math.random() * 0.4, -10);
      }
      if (this.mound) this.mound.scale.setScalar(Math.min(1, 0.15 + D.t / (DIG_STROKE * DIG_STROKES)));
      if (D.t > DIG_STROKE * DIG_STROKES) this.finishDig();
    }
    if (this.mound) {
      this.mound.userData.life -= dt;
      if (this.mound.userData.life < 2) this.mound.scale.y = Math.max(0.01, this.mound.userData.life / 2);
      if (this.mound.userData.life <= 0) { this.mound.parent?.remove(this.mound); this.mound = null; }
    }
    if (this.chest) this.updateChest(dt);
    if (this.burst && !this.burst.update(dt)) this.burst = null;
    this.updateCompass();
    // the map warms in your hands as you near the X
    if (!m) { this.sense = -1; return; }
    if (m.markedUntil === undefined) this.mark(); // a map found before v1.8.2: mark it now
    else if (m.markedUntil && Date.now() > m.markedUntil) {
      g.ext.change((d) => { d.treasure.markedUntil = 0; if (d.waypoint?.name === 'Treasure X') d.waypoint = null; });
      g.waypoint?.sync?.();
      g.ui.toast('The X faded from your map. Open your treasure map from the Journal (J) to mark it again.', { icon: 'map', ms: 5000 });
    }
    const d = Math.hypot(g.player.pos.x - m.x, g.player.pos.z - m.z);
    const s = d < 6 ? 3 : d < 15 ? 2 : d < SENSE_R ? 1 : 0;
    if (s !== this.sense) {
      if (s > this.sense && s > 0) g.ui.toast(['', 'Your treasure map feels warm. Your compass is out: follow the red needle.', 'Warmer! The map is practically humming.', `Hot! It must be right around here. ${this.hasShovel ? 'Press E to dig.' : 'You\'ll need a shovel from Gus to dig.'}`][s], { icon: 'map', ms: 3200 });
      this.sense = s;
    }
  }

  updateChest(dt) {
    const g = this.game, c = this.chest, ch = c.mesh, lid = ch.userData.lid, glow = ch.userData.glow;
    c.t += dt;
    if (c.phase === 'rise') {
      // pushes up out of the ground, shedding dirt
      const k = Math.min(1, c.t / 0.8), e = 1 - Math.pow(1 - k, 3);
      ch.position.y = c.groundY - 0.6 * (1 - e);
      ch.rotation.z = Math.sin(c.t * 40) * 0.03 * (1 - k);
      if (Math.random() < dt * 30) g.fx.spawn(ch.position.x + (Math.random() - 0.5), c.groundY + 0.05, ch.position.z + (Math.random() - 0.5), (Math.random() - 0.5) * 2, 1.5 + Math.random() * 2, (Math.random() - 0.5) * 2, Math.random() < 0.5 ? '#6a4a2a' : '#8a6438', 0.7, -9);
      if (k >= 1) { c.phase = 'rattle'; c.t = 0; g.audio.sfx('creak'); }
    } else if (c.phase === 'rattle') {
      // the lid strains against the lock, glowing at the seam
      lid.rotation.x = -Math.abs(Math.sin(c.t * 34)) * 0.07;
      ch.rotation.z = Math.sin(c.t * 30) * 0.025;
      glow.intensity = c.t * 2.5;
      if (c.t > 0.7) { c.phase = 'open'; c.t = 0; ch.rotation.z = 0; this.openChest(); }
    } else if (c.phase === 'open') {
      // the lid flips back hard and bounces on its hinge
      const k = c.t;
      const open = 1.95, w = 14, damp = 5;
      lid.rotation.x = -(open - open * Math.exp(-damp * k) * Math.cos(w * k));
      glow.intensity = 2.6 + Math.sin(c.t * 6) * 0.4;
      if (Math.random() < dt * 6) g.fx.sparkle(ch.position.clone().add(new THREE.Vector3((Math.random() - 0.5) * 0.6, 0.6, (Math.random() - 0.5) * 0.4)), '#ffe070', 3, 0.4);
      if (c.t > 18) { c.phase = 'sink'; c.t = 0; }
    } else if (c.phase === 'sink') {
      ch.position.y = c.groundY - c.t * 0.5;
      glow.intensity = Math.max(0, 2.6 - c.t * 2);
      if (c.t > 1.4) { g.engine.scene.remove(ch); this.chest = null; }
    }
  }

  // ---- the dig-site compass (v1.8.1) ----
  updateCompass() {
    const g = this.game, m = this.map;
    const d = m ? Math.hypot(g.player.pos.x - m.x, g.player.pos.z - m.z) : 1e9;
    const show = !!m && d < SENSE_R && !g.home?.active;
    if (!show) { if (this.compass) this.compass.el.classList.remove('on'); return; }
    if (!this.compass) this.compass = buildCompass(g.ui.root);
    const C = this.compass;
    C.el.classList.add('on');
    const toDeg = (r) => (r * 180) / Math.PI;
    C.needle.style.transform = `rotate(${toDeg(this.screenAngle(m.x, m.z)).toFixed(1)}deg)`;
    const n = this.screenAngle(g.player.pos.x, g.player.pos.z - 100);
    C.dial.style.transform = `rotate(${toDeg(n).toFixed(1)}deg)`;
    const here = d <= DIG_R;
    C.el.classList.toggle('here', here);
    C.el.classList.toggle('hot', !here && d < 6);
    C.dist.textContent = here ? (this.hasShovel ? 'Dig here!' : 'Need a shovel') : `${Math.round(d)} m`;
  }
}

const SHOVEL_PRICE = { coins: 250 };
const MARK_MS = 10 * 60 * 1000; // how long a treasure X stays on the map
const DIG_STROKE = 1.1, DIG_STROKES = 3;
export { SHOVEL_PRICE };

function buildCompass(root) {
  const el = h('div.treasure-compass', { 'aria-live': 'polite', role: 'img', 'aria-label': 'Treasure compass' });
  el.innerHTML = `<svg viewBox="-60 -60 120 120" aria-hidden="true">
    <circle r="56" class="tc-rim"/><circle r="48" class="tc-face"/>
    <g class="tc-dial">${[0, 45, 90, 135, 180, 225, 270, 315].map((a) => `<line x1="0" y1="-48" x2="0" y2="${a % 90 ? -42 : -38}" transform="rotate(${a})" class="tc-tick"/>`).join('')}
      <text y="-28" class="tc-n">N</text><text y="36" class="tc-l">S</text><text x="-33" y="4" class="tc-l">W</text><text x="33" y="4" class="tc-l">E</text></g>
    <g class="tc-needle"><path d="M0,-44 L9,4 L0,-3 L-9,4 Z" class="tc-red"/><path d="M0,-3 L9,4 L0,24 L-9,4 Z" class="tc-back"/><text y="-30" class="tc-x">✕</text></g>
    <circle r="5" class="tc-pin"/></svg><div class="tc-dist"></div>`;
  root.append(el);
  return { el, needle: el.querySelector('.tc-needle'), dial: el.querySelector('.tc-dial'), dist: el.querySelector('.tc-dist') };
}

function buildMound() {
  const geo = new THREE.SphereGeometry(0.42, 9, 6, 0, Math.PI * 2, 0, Math.PI / 2);
  geo.scale(1, 0.55, 1);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) { const k = 1 + (Math.sin(i * 12.9898) * 43758.5453 % 1) * 0.12; pos.setXYZ(i, pos.getX(i) * k, pos.getY(i), pos.getZ(i) * k); }
  geo.computeVertexNormals();
  const m = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ color: '#6b4a2a', flatShading: true }));
  m.castShadow = true;
  return m;
}

/** Real little coins and pearls that pop out of the chest, bounce, spin, then zip into your pockets. */
class LootBurst {
  constructor(game, at, nCoins, nPearls) {
    this.g = game;
    this.t = 0;
    const coinGeo = new THREE.CylinderGeometry(0.075, 0.075, 0.02, 12), pearlGeo = new THREE.IcosahedronGeometry(0.055, 1);
    this.coins = new THREE.InstancedMesh(coinGeo, coinMaterial(), nCoins);
    this.pearls = new THREE.InstancedMesh(pearlGeo, pearlMaterial(), nPearls);
    for (const im of [this.coins, this.pearls]) { im.frustumCulled = false; im.castShadow = true; game.engine.scene.add(im); }
    this.p = [];
    const mk = (im, i, pearl) => {
      const a = Math.random() * Math.PI * 2, s = 1 + Math.random() * 2.2;
      this.p.push({ im, i, pearl, x: at.x, y: at.y, z: at.z, vx: Math.cos(a) * s, vy: 4.2 + Math.random() * 3.2, vz: Math.sin(a) * s, rx: Math.random() * 6, rz: Math.random() * 6, sx: (Math.random() - 0.5) * 22, sz: (Math.random() - 0.5) * 22, delay: Math.random() * 0.35, home: 1.5 + Math.random() * 0.9, gone: false, k: 0 });
    };
    for (let i = 0; i < nCoins; i++) mk(this.coins, i, false);
    for (let i = 0; i < nPearls; i++) mk(this.pearls, i, true);
    this.m = new THREE.Matrix4(); this.q = new THREE.Quaternion(); this.e = new THREE.Euler(); this.v = new THREE.Vector3(); this.sc = new THREE.Vector3();
    this.lastPing = 0;
  }
  update(dt) {
    const g = this.g, pl = g.player.pos;
    this.t += dt;
    let alive = 0;
    for (const p of this.p) {
      let scale = 1;
      if (p.gone) scale = 0;
      else if (this.t < p.delay) scale = 0;
      else if (this.t < p.home) {
        alive++;
        p.vy -= 13 * dt;
        p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
        const gy = (walkY(p.x, p.z, 1) ?? pl.y) + 0.03;
        if (p.y < gy) { p.y = gy; p.vy = Math.abs(p.vy) * 0.38; p.vx *= 0.6; p.vz *= 0.6; p.sx *= 0.6; p.sz *= 0.6; }
        p.rx += p.sx * dt; p.rz += p.sz * dt;
      } else {
        // magnet to the player, shrinking as it lands in your pocket
        alive++;
        p.k = Math.min(1, p.k + dt * 2.6);
        const tx = pl.x, ty = pl.y + 0.7, tz = pl.z;
        const e = p.k * p.k;
        p.x += (tx - p.x) * e; p.y += (ty - p.y) * e + Math.sin(p.k * Math.PI) * dt * 3; p.z += (tz - p.z) * e;
        p.rx += 20 * dt;
        scale = 1 - e * 0.6;
        if (p.k >= 1 || Math.hypot(tx - p.x, ty - p.y, tz - p.z) < 0.18) {
          p.gone = true; scale = 0;
          if (this.t - this.lastPing > 0.035) { this.lastPing = this.t; g.audio.sfx('coinpick', { pearl: p.pearl }); }
        }
      }
      this.e.set(p.rx, 0, p.rz); this.q.setFromEuler(this.e);
      this.m.compose(this.v.set(p.x, p.y, p.z), this.q, this.sc.setScalar(scale));
      p.im.setMatrixAt(p.i, this.m);
    }
    this.coins.instanceMatrix.needsUpdate = true; this.pearls.instanceMatrix.needsUpdate = true;
    if (!alive && this.t > 1) { this.dispose(); return false; }
    return true;
  }
  dispose() {
    for (const im of [this.coins, this.pearls]) { im.parent?.remove(im); im.geometry.dispose(); }
  }
}


