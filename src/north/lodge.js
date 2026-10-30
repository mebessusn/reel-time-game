// v1.16.2 Frostmere: inside the Hearth Lodge. The front door on the porch takes you into a big log hall (22 x 14 m)
// with a roaring stone fireplace, Hilde's counter (hot food that keeps the cold off), long tables with villagers
// eating and playing cards, armchairs by the fire, a darts board, your trophy wall and the boards.
//
// The hall is built away from the map, high over the northern sea where nobody walks (like Coralhaven), so it can be
// bigger inside than the lodge is outside. Its walls face inward, so the camera can swing outside them and still see
// in. Its floor is a game floor (floorAt), its walls and furniture are colliders, and it counts as warm.
import * as THREE from 'three';
import { mergedMesh } from './instancing.js';
import { toWorld, ICE_Y } from './geo.js';
import { BUILDINGS } from './hearthwick.js';
import { addBox, addCircle } from '../world/colliders.js';
import { Actor } from '../game/actor.js';
import { LOOKS } from './villagers.js';
import { buildFish } from '../entities/fish.js';
import { SPECIES_BY_ID } from '../data/species.js';
import { NORTH_SPECIES } from '../data/northSpecies.js';
import { openShop } from './shop.js';
import { northSfx } from './sounds.js';
import { h } from '../ui/dom.js';

const W = 22, D = 14, H = 5.2;
export const HALL = (() => { const o = toWorld(-330, -340); return { x: o.x, z: o.z, y: 60 }; })();
const at = (lx, lz) => ({ x: HALL.x + lx, z: HALL.z + lz });

function woodTex(kind) {
  const c = document.createElement('canvas'); c.width = 256; c.height = 256;
  const x = c.getContext('2d');
  if (kind === 'logs') {
    for (let i = 0; i < 8; i++) {
      const y = i * 32, g = x.createLinearGradient(0, y, 0, y + 32);
      g.addColorStop(0, '#5a3a22'); g.addColorStop(0.18, '#9a6a40'); g.addColorStop(0.55, '#875a36'); g.addColorStop(0.9, '#5e3c24'); g.addColorStop(1, '#3a2414');
      x.fillStyle = g; x.fillRect(0, y, 256, 32);
      x.strokeStyle = 'rgba(40,24,12,0.25)'; x.lineWidth = 1;
      for (let k = 0; k < 6; k++) { x.beginPath(); const yy = y + 6 + Math.random() * 20; x.moveTo(0, yy); x.bezierCurveTo(80, yy + 2, 170, yy - 2, 256, yy + 1); x.stroke(); }
      x.fillStyle = 'rgba(220,210,190,0.35)'; x.fillRect(0, y + 30, 256, 2); // the chinking between logs
    }
  } else if (kind === 'planks') {
    for (let i = 0; i < 8; i++) {
      const y = i * 32, shade = 0.85 + ((i * 37) % 10) / 40;
      x.fillStyle = `rgb(${Math.round(150 * shade)},${Math.round(104 * shade)},${Math.round(66 * shade)})`; x.fillRect(0, y, 256, 32);
      x.strokeStyle = 'rgba(60,36,18,0.18)';
      for (let k = 0; k < 5; k++) { x.beginPath(); const yy = y + 4 + Math.random() * 24; x.moveTo(0, yy); x.bezierCurveTo(90, yy + 3, 170, yy - 3, 256, yy); x.stroke(); }
      x.fillStyle = 'rgba(40,24,12,0.6)'; x.fillRect(0, y, 256, 1.5);
      const cut = (i * 97) % 256; x.fillRect(cut, y, 1.5, 32);
    }
  } else {
    x.fillStyle = '#4a3220'; x.fillRect(0, 0, 256, 256);
    x.fillStyle = 'rgba(0,0,0,0.15)'; for (let i = 0; i < 16; i++) x.fillRect(i * 16, 0, 1, 256);
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 4;
  return t;
}

export class Lodge {
  constructor(north) { this.north = north; this.game = north.game; this.inside = false; this.built = false; this.people = []; this.darts = null; this.best = 0; }
  /** The lodge's front door, out on the porch. */
  door() {
    const B = BUILDINGS.find((b) => b.id === 'lodge'); if (!B?.x) return null;
    const lz = (B.porch?.z0 ?? B.hd) + 0.9;
    return { x: B.x + lz * Math.sin(B.ry), z: B.z + lz * Math.cos(B.ry), y: (B.y || 0) + (B.porch?.y || 0.6), ry: B.ry };
  }
  floorAt(x, z) { return this.built && Math.abs(x - HALL.x) < W / 2 && Math.abs(z - HALL.z) < D / 2 ? HALL.y : null; }

  build() {
    if (this.built) return;
    this.built = true;
    const g = this.game, grp = this.group = new THREE.Group(); grp.name = 'hearth-lodge-hall';
    grp.position.set(HALL.x, HALL.y, HALL.z);
    // the shell: one box seen from inside (log walls, plank floor, a dark boarded ceiling)
    const logs = woodTex('logs'); logs.repeat.set(W / 3, H / 3);
    const logs2 = logs.clone(); logs2.repeat.set(D / 3, H / 3); logs2.needsUpdate = true;
    const planks = woodTex('planks'); planks.repeat.set(W / 4, D / 4); planks.rotation = Math.PI / 2;
    const ceil = woodTex('ceiling'); ceil.repeat.set(W / 4, D / 4);
    const M = (map) => new THREE.MeshLambertMaterial({ map, side: THREE.BackSide });
    const shell = new THREE.Mesh(new THREE.BoxGeometry(W, H, D), [M(logs2), M(logs2), M(ceil), M(planks), M(logs), M(logs)]);
    shell.position.y = H / 2; shell.receiveShadow = true; grp.add(shell);
    // the roof beams and posts
    const beamM = new THREE.MeshLambertMaterial({ color: '#4a2e1a' });
    for (let k = -4; k <= 4; k++) { const b = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.35, D - 0.1), beamM); b.position.set(k * 2.5, H - 0.25, 0); grp.add(b); }
    for (const s of [-1, 1]) { const b = new THREE.Mesh(new THREE.BoxGeometry(W - 0.1, 0.4, 0.35), beamM); b.position.set(0, H - 0.5, s * 3.5); grp.add(b); }
    for (const [x, z] of [[-6, -3.5], [6, -3.5], [-6, 3.5], [6, 3.5]]) { const p = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.22, H, 10), beamM); p.position.set(x, H / 2, z); grp.add(p); addCircle(HALL.x + x, HALL.z + z, 0.3); }
    // the door (seen from inside only, so it never blocks the camera from outside the wall)
    const door = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 2.5), new THREE.MeshLambertMaterial({ color: '#6a3f22' }));
    door.position.set(0, 1.25, D / 2 - 0.03); door.rotation.y = Math.PI; grp.add(door);
    const knob = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 6), new THREE.MeshLambertMaterial({ color: '#c9a24a' })); knob.position.set(-0.6, 1.2, D / 2 - 0.08); grp.add(knob);
    // a dark floor running on past the walls, so a camera that swings outside the room still sees floor below it
    const apron = new THREE.Mesh(new THREE.PlaneGeometry(70, 70), new THREE.MeshBasicMaterial({ color: '#2a1a10' })); apron.rotation.x = -Math.PI / 2; apron.position.y = -0.03; grp.add(apron);
    const put = (node, x, z, ry = 0, y = 0, s = 1) => { const m = mergedMesh(node, { shadow: true }); m.position.set(x, y, z); m.rotation.y = ry; m.scale.setScalar(s); grp.add(m); return m; };
    // the north wall: the fireplace, antlers over it, the trophy wall either side
    put('hw_li_fireplace', 0, -D / 2 + 0.2, 0, 0, 1.15); addBox(HALL.x - 2.3, HALL.z - D / 2, HALL.x + 2.3, HALL.z - D / 2 + 1.3);
    put('hw_li_antlers', 0, -D / 2 + 0.35, 0, 3.0);
    this.plaques = [];
    for (let k = 0; k < 6; k++) { const x = (k < 3 ? -4.2 - k * 1.3 : 4.2 + (k - 3) * 1.3), y = 2.0 + (k % 2) * 0.6; const m = put('hw_li_plaque', x, -D / 2 + 0.05, 0, y); this.plaques.push(m); }
    // before the fire: the rug, three armchairs, a barrel
    put('hw_li_rug', 0, -3.3, 0, 0, 1.3);
    this.chairs = [[-2.3, -3.6, 0.7], [0, -2.4, Math.PI], [2.3, -3.6, -0.7]].map(([x, z, ry]) => { put('hw_li_armchair', x, z, ry + Math.PI); return { x, z, ry }; });
    // Hilde's counter along the west wall, shelves behind
    put('hw_li_bar', -W / 2 + 2.2, 0, Math.PI / 2); addBox(HALL.x - W / 2 + 1.5, HALL.z - 2.7, HALL.x - W / 2 + 2.6, HALL.z + 2.7);
    // three long tables
    this.tables = [[2.2, 1.0], [6.8, 1.0], [6.8, -2.6]];
    for (const [x, z] of this.tables) { put('hw_li_table', x, z, Math.PI / 2); addBox(HALL.x + x - 0.5, HALL.z + z - 1.7, HALL.x + x + 0.5, HALL.z + z + 1.7); }
    // the east wall: the darts board; a bookshelf; windows on the south wall; barrels in the corners
    put('hw_li_dartboard', W / 2 - 0.05, 4.5, -Math.PI / 2, 1.75);
    this.dartAt = { x: W / 2 - 3.2, z: 4.5 };
    put('hw_li_shelf', W / 2 - 0.25, -4.5, -Math.PI / 2); addBox(HALL.x + W / 2 - 0.5, HALL.z - 5.2, HALL.x + W / 2, HALL.z - 3.8);
    for (const x of [-8, 8]) put('hw_li_window', x, D / 2 - 0.05, Math.PI, 2.2);
    for (const x of [-7, 7]) put('hw_li_window', x, -D / 2 + 0.05, 0, 2.5);
    for (const [x, z] of [[-W / 2 + 0.6, -D / 2 + 0.6], [W / 2 - 0.6, D / 2 - 0.6], [-W / 2 + 0.6, D / 2 - 0.6]]) { put('hw_li_barrel', x, z); addCircle(HALL.x + x, HALL.z + z, 0.4); }
    for (const x of [-5, 5]) put('hw_li_chandelier', x, 0, 0, H - 0.4);
    // the walls block
    const t = 0.3;
    addBox(HALL.x - W / 2 - t, HALL.z - D / 2 - t, HALL.x - W / 2 + 0.25, HALL.z + D / 2 + t);
    addBox(HALL.x + W / 2 - 0.25, HALL.z - D / 2 - t, HALL.x + W / 2 + t, HALL.z + D / 2 + t);
    addBox(HALL.x - W / 2, HALL.z - D / 2 - t, HALL.x + W / 2, HALL.z - D / 2 + 0.25);
    addBox(HALL.x - W / 2, HALL.z + D / 2 - 0.25, HALL.x + W / 2, HALL.z + D / 2 + t);
    // light: the fire and the two chandeliers (in the light budget, lit day and night: it's indoors)
    this.fire = new THREE.PointLight('#ff8a3a', 2.4, 16, 1.4); this.fire.position.set(0, 1.0, -D / 2 + 1.6); this.fire.userData.lbAlways = true; grp.add(this.fire);
    for (const x of [-5, 5]) { const l = new THREE.PointLight('#ffcf8a', 1.4, 14, 1.4); l.position.set(x, H - 1.4, 0); l.userData.lbAlways = true; grp.add(l); }
    grp.visible = false;
    this.north.world.group.add(grp);
    // the armchairs are seats (E to sit, like the camp chairs)
    for (const c of this.chairs) { const w = at(c.x, c.z); g.chairs?.list.push({ id: `lodge-${c.x}`, x: w.x, z: w.z, y: HALL.y + 0.02, h: 0.45, kind: 'armchair', yaw: c.ry }); addCircle(w.x, w.z, 0.2); }
    this.buildPeople();
  }

  buildPeople() {
    const g = this.game;
    const mk = (id, name, title, look, x, z, yaw, extra = {}) => {
      const a = new Actor(g.engine.scene); a.lite = true; a.setLook(look, { rod: 'rod_willow', lure: 'lure_classic', boat: 'boat_oak' });
      a.root.visible = false; if (a.rod) a.rod.visible = false; // (no rods indoors)
      const w = at(x, z);
      const p = { id, name, title, actor: a, pos: new THREE.Vector3(w.x, HALL.y, w.z), yaw, home: yaw, ...extra };
      this.people.push(p); return p;
    };
    const L = { ...LOOKS };
    this.hilde = mk('hilde', 'Hilde Lund', 'Cook at the Hearth Lodge', { ...L.astrid, hair: 'buns', hairColor: 3, hat: 'none', shirt: 'cardigan', shirtColor: 2 }, -W / 2 + 1.2, 0, Math.PI / 2);
    this.nils = mk('nils', 'Nils', 'Fiddler', { ...L.torvald, hair: 'shag', facialHair: 'none', hat: 'none', shirt: 'shirt_sweater_deer', shirtColor: 3, skin: 2 }, 3.6, -4.6, -0.5, { pose: 'cheer', lines: ['Request a tune? I only know four, but I know them very well.', 'This one\'s about a fish that got away. They\'re all about a fish that got away.'] });
    this.brita = mk('brita', 'Brita', 'Plays cards', { ...L.june, hat: 'none', eyewear: 'none', shirt: 'sweater', shirtColor: 6 }, 6.8 - 0.78, 1.6, Math.PI / 2, { seat: 0.44, lines: ['Olaf cheats. I can\'t prove it. But I know.', 'Pull up a bench! Mind, we play for buttons.'] });
    this.olaf = mk('olaf', 'Olaf', 'Plays cards', { ...L.torvald, hair: 'crop', facialHair: 'moustache', hat: 'beanie', shirt: 'flannel', shirtColor: 4, skin: 4 }, 6.8 + 0.78, 1.6, -Math.PI / 2, { seat: 0.44, lines: ['I have never cheated in my life. Today.', 'Brita\'s winning. Brita is always winning.'] });
    this.ingeborg = mk('ingeborg', 'Ingeborg', 'Eating her stew', { ...L.astrid, hair: 'long', hairColor: 8, hat: 'hat_bobble', skin: 5, height: 'medium' }, 2.2 - 0.78, 0.2, Math.PI / 2, { seat: 0.44, lines: ['Hilde\'s reindeer stew. Nothing in the world warms you up faster.', 'I\'ve been out on the ice since dawn. My toes are only now speaking to me again.'] });
    this.sven = mk('sven', 'Old Sven', 'Napping by the fire', { ...L.torvald, hair: 'bald', facialHair: 'beard', hairColor: 9, hat: 'none', skin: 1 }, -4.6, -4.4, 0.5, { seat: 0.45, pose: 'sleep', lines: ['Zzz... the big one... zzz... it was THIS big...'] });
    for (const p of [this.hilde, this.nils, this.brita, this.olaf, this.ingeborg, this.sven]) addCircle(p.pos.x, p.pos.z, 0.35);
  }

  /** Fill the trophy wall: your heaviest Frostmere fish, biggest first, one per plaque. */
  refreshTrophies() {
    const best = this.game.profile.fishpedia || {};
    const top = NORTH_SPECIES.filter((s) => best[s.id]?.best).sort((a, b) => best[b.id].best - best[a.id].best).slice(0, 6);
    if (this.trophyKey === top.map((s) => s.id + best[s.id].best).join()) return;
    this.trophyKey = top.map((s) => s.id + best[s.id].best).join();
    this.plaques.forEach((pl, i) => {
      if (pl.userData.fish) { pl.remove(pl.userData.fish); pl.userData.fish = null; }
      const sp = top[i]; if (!sp) return;
      const f = buildFish(sp.id, 'normal', best[sp.id].best);
      const box = new THREE.Box3().setFromObject(f), len = Math.max(0.05, box.max.x - box.min.x, box.max.z - box.min.z);
      f.scale.multiplyScalar(0.75 / len); f.position.set(0, 0.02, 0.1); f.rotation.y = Math.PI / 2;
      pl.add(f); pl.userData.fish = f; pl.userData.sp = sp;
    });
  }

  // ---------------------------------------------------------------- in and out
  enter() {
    const g = this.game;
    this.build();
    g.fishing.cancel();
    const fade = h('div.travel-fade'); g.ui.root.append(fade); setTimeout(() => fade.remove(), 900);
    setTimeout(() => {
      const p = at(0, D / 2 - 2.6);
      g.player.pos.set(p.x, HALL.y, p.z); g.player.baseY = HALL.y; g.player.target = null; g.player.yaw = Math.PI;
      g.engine.cam.target.set(p.x, HALL.y + 0.9, p.z); g.engine.cam.yaw = 0; g.engine.cam.pitch = 0.35;
      this.setInside(true);
      g.audio.sfx('creak');
      if (!this.north.d.lodgeIn) { g.ext.change((d) => { d.north.lodgeIn = Date.now(); }); g.ui.toast('The Hearth Lodge! Warm up by the fire, get something hot from Hilde, try the darts, and see your biggest catches on the trophy wall.', { title: 'Hearth Lodge', icon: 'home', ms: 7000 }); }
    }, 350);
  }
  leave() {
    const g = this.game, Dd = this.door(); if (!Dd) return;
    const fade = h('div.travel-fade'); g.ui.root.append(fade); setTimeout(() => fade.remove(), 900);
    this.endDarts();
    setTimeout(() => {
      if (g.chairs?.seat) g.chairs.stand();
      const out = { x: Dd.x + Math.sin(Dd.ry) * 1.2, z: Dd.z + Math.cos(Dd.ry) * 1.2 };
      const y = this.north.groundAt(out.x, out.z) ?? Dd.y;
      g.player.pos.set(out.x, Math.max(y, this.north.floorAt(out.x, out.z) ?? y), out.z); g.player.baseY = g.player.pos.y; g.player.target = null; g.player.yaw = Dd.ry;
      g.engine.cam.target.set(out.x, g.player.pos.y + 0.9, out.z);
      this.setInside(false);
    }, 350);
  }
  setInside(on) {
    this.inside = on;
    this.group.visible = on;
    for (const p of this.people) p.actor.root.visible = on;
    if (on) this.refreshTrophies();
    const sky = this.north.sky; if (on && sky) { sky.snow.visible = false; sky.dust.visible = false; }
  }

  // ---------------------------------------------------------------- each frame
  update(dt, t) {
    if (!this.built) return;
    const g = this.game, p = g.player.pos;
    const inHall = this.floorAt(p.x, p.z) != null && p.y > HALL.y - 3;
    if (inHall !== this.inside) this.setInside(inHall);
    if (!this.inside) return;
    if (g.engine.cam.zoom > 0.85) g.engine.cam.zoom = 0.85;
    const sky = this.north.sky; if (sky) { sky.snow.visible = false; sky.dust.visible = false; }
    this.fire.intensity = 2.2 + Math.sin(t * 9) * 0.25 + Math.sin(t * 23) * 0.15;
    if (Math.random() < dt * 6) g.fx.spawn(HALL.x + (Math.random() - 0.5) * 1.2, HALL.y + 0.5, HALL.z - D / 2 + 1.0, (Math.random() - 0.5) * 0.3, 0.8 + Math.random(), 0.1, Math.random() < 0.5 ? '#ffb040' : '#ff6a20', 0.25, 0.4);
    for (const pe of this.people) {
      const near = Math.hypot(pe.pos.x - p.x, pe.pos.z - p.z) < 3.5 && !pe.seat;
      const want = near ? Math.atan2(p.x - pe.pos.x, p.z - pe.pos.z) : pe.home;
      let d = want - pe.yaw; d = Math.atan2(Math.sin(d), Math.cos(d)); pe.yaw += d * Math.min(1, dt * 3);
      const pose = pe.pose === 'cheer' ? (Math.sin(t * 2) > 0 ? 'cheer' : 'idle') : pe.pose || 'idle';
      pe.actor.update(dt, t, { x: pe.pos.x, y: pe.pos.y, z: pe.pos.z, yaw: pe.yaw, mode: 'shore', pose, moving: false, rod: 'back', seat: pe.seat || 0, seatYaw: pe.seat ? pe.home : undefined });
      if (pe.actor.rod) pe.actor.rod.visible = false; // (no rods indoors)
    }
    if (this.darts) this.updateDarts(dt, t);
  }

  // ---------------------------------------------------------------- things to do
  contextActions() {
    const g = this.game, p = g.player.pos, out = [];
    if (!this.inside) {
      const Dd = this.door();
      if (Dd && Math.hypot(p.x - Dd.x, p.z - Dd.z) < 2.4) out.push({ id: 'lodge-in', label: 'Go inside the Hearth Lodge', color: 'gold', at: { x: Dd.x, z: Dd.z, y: Dd.y, h: 2.6 }, fn: () => this.enter() });
      return out;
    }
    const L = (x, z) => at(x, z), near = (x, z, r) => { const w = L(x, z); return Math.hypot(w.x - p.x, w.z - p.z) < r; };
    if (this.darts) return [{ id: 'darts-stop', label: 'Put the darts down', fn: () => this.endDarts() }];
    if (near(0, D / 2 - 1.5, 2.6)) out.push({ id: 'lodge-out', label: 'Go back outside', color: 'green', fn: () => this.leave() });
    if (near(-W / 2 + 3, 0, 2.6)) out.push({ id: 'lodge-food', label: 'Order something hot from Hilde', color: 'gold', fn: () => this.menu() });
    if (near(this.dartAt.x, this.dartAt.z, 2.2)) out.push({ id: 'darts', label: `Play darts${this.best ? ` (best ${this.best})` : ''}`, color: 'blue', fn: () => this.startDarts() });
    if (Math.abs(p.z - (HALL.z - D / 2)) < 3.2 && Math.abs(p.x - HALL.x) > 3 && Math.abs(p.x - HALL.x) < 9) out.push({ id: 'trophies', label: 'Look at the trophy wall', fn: () => this.trophyCard() });
    for (const pe of this.people) {
      if (pe === this.hilde) continue;
      if (Math.hypot(pe.pos.x - p.x, pe.pos.z - p.z) < 2.2) out.push({ id: `lodge-talk-${pe.id}`, label: `Talk to ${pe.name}`, color: 'gold', at: { x: pe.pos.x, z: pe.pos.z, y: HALL.y, h: 2.2 }, fn: () => g.dialogue.open({ npc: pe, title: pe.title, text: pe.lines[Math.floor(Math.random() * pe.lines.length)], choices: [{ label: 'Ha!' }] }) });
    }
    return out;
  }
  /** Hilde's menu: hot food that warms you through and keeps the cold off for a while. */
  menu() {
    const g = this.game, W2 = this.north.warmth;
    const item = (id, name, what, coins, warm, mins, mult) => ({ id, name, what, price: { coins }, owned: false, buy: async () => {
      const r = await g.save.spend('lodgefood', id, { coins });
      if (!r.ok) { g.ui.toast(r.reason || 'Not enough coins.'); return false; }
      g.audio.sfx('buff'); W2.warm = Math.min(100, W2.warm + warm); W2.setBuff(name, mins * 60, mult);
      g.ui.toast(`${name}. ${what}`, { icon: 'star', ms: 3500 }); this.north.onEvent?.('lodgefood', { id });
      return true;
    } });
    openShop(g, { title: 'Hilde\'s counter', sub: 'Hot food at the Hearth Lodge', text: '"Sit, sit! You look frozen. What\'ll it be?"', items: () => [
      item('cocoa', 'Hot cocoa', 'Marshmallows on top. Warm for 5 minutes.', 15, 30, 5, 0.4),
      item('stew', 'Reindeer stew', 'Thick and peppery. The cold barely touches you for 12 minutes.', 45, 100, 12, 0.3),
      item('pie', 'Cloudberry pie', 'Sweet and tart. Warm for 8 minutes.', 30, 50, 8, 0.35),
      item('soup', 'Fish soup', 'Torvald\'s favourite. Warm for 10 minutes.', 35, 70, 10, 0.32),
    ] });
  }
  trophyCard() {
    const g = this.game, best = g.profile.fishpedia || {};
    const top = NORTH_SPECIES.filter((s) => best[s.id]?.best).sort((a, b) => best[b.id].best - best[a.id].best).slice(0, 6);
    g.dialogue.open({ npc: this.hilde, title: 'The trophy wall', text: top.length ? `Your biggest catches up north: ${top.map((s) => `${SPECIES_BY_ID[s.id].name} ${best[s.id].best.toFixed(1)} lb`).join(', ')}. Hilde dusts them every morning.` : 'Six empty plaques, waiting. Catch fish up north and the biggest go up here.', choices: [{ label: 'Nice' }] });
  }

  // ---------------------------------------------------------------- darts: three darts, a wandering aim, press to throw
  startDarts() {
    const g = this.game, w = at(this.dartAt.x, this.dartAt.z);
    g.player.pos.set(w.x, HALL.y, w.z); g.player.yaw = Math.PI / 2; g.player.target = null;
    g.engine.cam.target.set(w.x + 1, HALL.y + 1.6, w.z); g.engine.cam.yaw = -Math.PI / 2; g.engine.cam.pitch = 0.08; g.engine.cam.zoom = 0.35;
    const el = h('div.darts-hud', h('div.dh-title', 'Darts'), h('div.dh-score', '0'), h('div.dh-tip', 'Press the fishing button (or click) to throw when the aim crosses the bull. Three darts.'));
    g.ui.root.append(el);
    const board = h('div.darts-board', h('i.db-ring.r1'), h('i.db-ring.r2'), h('i.db-ring.r3'), h('i.db-ring.r4'), h('i.db-bull'), h('b.db-aim'));
    g.ui.root.append(board);
    this.darts = { left: 3, score: 0, el, board, t: 0, ax: 0, ay: 0, hits: [] };
  }
  updateDarts(dt, t) {
    const Dt = this.darts; Dt.t += dt;
    // the aim drifts in a lazy figure of eight that tightens a little each dart
    const k = 0.75 - (3 - Dt.left) * 0.08;
    Dt.ax = Math.sin(Dt.t * 1.7) * k + Math.sin(Dt.t * 4.3) * 0.08; Dt.ay = Math.sin(Dt.t * 2.3 + 1) * k * 0.8 + Math.cos(Dt.t * 3.1) * 0.08;
    const aim = Dt.board.querySelector('.db-aim'); aim.style.left = `${50 + Dt.ax * 50}%`; aim.style.top = `${50 + Dt.ay * 50}%`;
  }
  /** The fishing button while playing darts. */
  primary(down) {
    if (!down || !this.darts || this.darts.left <= 0) return false;
    const Dt = this.darts, r = Math.hypot(Dt.ax, Dt.ay);
    const pts = r < 0.06 ? 50 : r < 0.16 ? 25 : r < 0.36 ? 15 : r < 0.6 ? 10 : r < 0.85 ? 5 : 0;
    Dt.score += pts; Dt.left--;
    const mark = h('i.db-hit'); mark.style.left = `${50 + Dt.ax * 50}%`; mark.style.top = `${50 + Dt.ay * 50}%`; Dt.board.append(mark);
    Dt.el.querySelector('.dh-score').textContent = `${Dt.score}`;
    this.game.juice?.pop(pts === 50 ? 'BULLSEYE! 50' : pts ? `+${pts}` : 'Missed!', { color: pts >= 25 ? '#ffd84a' : '#ffffff', size: 34, ms: 800 });
    northSfx(this.game.audio, 'tick');
    if (Dt.left <= 0) setTimeout(() => this.finishDarts(), 900);
    return true;
  }
  async finishDarts() {
    const g = this.game, Dt = this.darts; if (!Dt) return;
    const s = Dt.score, first = !this.north.d.dartsBest;
    this.best = Math.max(this.best, s, this.north.d.dartsBest || 0);
    g.ext.change((d) => { d.north.dartsBest = Math.max(d.north.dartsBest || 0, s); });
    g.chat.system(`Darts: ${s} points${s >= (this.north.d.dartsBest || 0) && s > 0 ? ' (your best!)' : ''}. Nils plays a little fanfare.`, 'info', { popup: true });
    if (first && s > 0) await g.reward('north', 'darts', { coins: 50, xp: 40 }, 'Your first game of darts at the Hearth Lodge');
    if (s >= 120) await g.reward('north', 'darts120', { coins: 150, xp: 80 }, 'Darts: 120 or more!');
    this.endDarts();
  }
  endDarts() {
    if (!this.darts) return;
    this.darts.el.remove(); this.darts.board.remove(); this.darts = null;
    this.game.engine.cam.zoom = 0.6; this.game.engine.cam.pitch = 0.35;
  }
}
export { ICE_Y };
