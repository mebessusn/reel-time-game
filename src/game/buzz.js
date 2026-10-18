// v1.13.8: the Cove's local legend (name: PIG_NAME below). A pig with a crisp human buzz cut (after the meme the owner asked for),
// sleepy half-lidded eyes and a big flat snout. He potters about the meadow north-west of the dock, turns to look
// at you when you're near, and says something deadpan when you pet him (E). Purely local: every player sees him.
import * as THREE from 'three';
import { groundY, dryAt } from '../world/terrain.js';
import { blocked } from '../world/colliders.js';

// His name, shown on his nameplate, his chat lines and the Pet button. The owner sets this one line.
export const PIG_NAME = 'Wigger Pig';
const HOME = { x: -20, z: 72 }; // open meadow on the trail north-west of the cove
const ROAM_R = 7;
const LINES = ['...', 'Oink.', 'Fresh cut. Don\'t touch the hair.', 'I\'m not a regular pig.', 'Same barber as Sundae. Don\'t tell him.',
  'You looked at me. I saw that.', 'The fish respect me.', 'Oink. (I mean it.)', 'Got any truffles? No? Then why are you here.', '*stares*'];

// v1.13.8: smooth, rounded low-poly like the valley's other animals (the ducks and pets), not blocks
const lam = (c) => new THREE.MeshLambertMaterial({ color: c });
const SKIN = lam('#e2b8a0'), SKIN_D = lam('#cf9f86'), SNOUT = lam('#eaa39b'), NOSTRIL = lam('#6e3632'),
  HAIR = lam('#4c4639'), EYE = new THREE.MeshPhongMaterial({ color: '#1a120e', shininess: 90, specular: '#ffffff' }), HOOF = lam('#5a4038');
const sphere = (r, mat, sx, sy, sz, x, y, z, ws = 18, hs = 12) => {
  const m = new THREE.Mesh(new THREE.SphereGeometry(r, ws, hs), mat);
  m.scale.set(sx, sy, sz); m.position.set(x, y, z); m.castShadow = true; return m;
};

/** The pig, facing +z, feet at y = 0. */
export function buildBuzz() {
  const g = new THREE.Group(); g.name = 'buzz';
  const body = new THREE.Group(); g.add(body);
  // a plump barrel with a softer belly and a thick neck rolling into the head
  body.add(sphere(1, SKIN, 0.56, 0.47, 0.82, 0, 0.82, -0.12));
  body.add(sphere(1, SKIN_D, 0.48, 0.3, 0.66, 0, 0.62, -0.1));
  body.add(sphere(1, SKIN, 0.5, 0.5, 0.42, 0, 0.98, 0.42));
  // head: big, round and a little too human, with heavy jowls
  const head = new THREE.Group(); head.position.set(0, 1.12, 0.66); body.add(head);
  head.add(sphere(1, SKIN, 0.5, 0.47, 0.44, 0, 0.04, 0.08));
  head.add(sphere(1, SKIN, 0.53, 0.3, 0.4, 0, -0.2, 0.1)); // jowls
  head.add(sphere(1, SKIN_D, 0.36, 0.14, 0.3, 0, -0.33, 0.16)); // double chin
  // the buzz cut: a close-cropped cap over the crown, cut off in a dead-straight line across the forehead
  const cap = new THREE.Mesh(new THREE.SphereGeometry(1, 32, 16, 0, Math.PI * 2, 0, 1.12), HAIR);
  cap.scale.set(0.515, 0.49, 0.455); cap.position.set(0, 0.06, 0.08); cap.castShadow = true;
  head.add(cap);
  // sleepy eyes: glossy dark eyes, the upper half hidden under heavy lids
  for (const sx of [-1, 1]) {
    head.add(sphere(0.07, EYE, 1.15, 0.75, 0.55, sx * 0.2, 0.12, 0.43, 14, 10));
    const lid = new THREE.Mesh(new THREE.SphereGeometry(0.085, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), SKIN_D);
    lid.scale.set(1.15, 0.55, 0.62); lid.position.set(sx * 0.2, 0.135, 0.425); lid.rotation.x = 0.25;
    head.add(lid);
  }
  // the snout: a big flat disc with two nostrils, and a faint smirk under it
  const snout = new THREE.Mesh(new THREE.CylinderGeometry(0.155, 0.18, 0.2, 28), SNOUT);
  snout.rotation.x = Math.PI / 2; snout.scale.set(1.3, 1, 0.9); snout.position.set(0, -0.12, 0.47); snout.castShadow = true;
  head.add(snout);
  for (const sx of [-1, 1]) head.add(sphere(0.036, NOSTRIL, 0.75, 1.3, 0.35, sx * 0.075, -0.12, 0.565, 10, 8));
  // a faint, unimpressed mouth line under the snout
  head.add(sphere(0.1, NOSTRIL, 1.3, 0.09, 0.25, 0, -0.29, 0.43, 14, 6));
  // legs: short rounded pillars on dark hooves
  const legs = [];
  for (const [x, z] of [[-0.27, 0.36], [0.27, 0.36], [-0.27, -0.58], [0.27, -0.58]]) {
    const leg = new THREE.Group(); leg.position.set(x, 0.55, z);
    const l = new THREE.Mesh(new THREE.CapsuleGeometry(0.12, 0.3, 6, 14), SKIN); l.position.y = -0.24; l.castShadow = true;
    const hoof = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.125, 0.09, 14), HOOF); hoof.position.y = -0.5;
    leg.add(l, hoof); body.add(leg); legs.push(leg);
  }
  // a curly little tail
  const tail = new THREE.Group(); tail.position.set(0, 0.98, -0.9); body.add(tail);
  const curl = new THREE.Mesh(new THREE.TorusGeometry(0.07, 0.022, 8, 18, Math.PI * 1.7), SKIN_D);
  curl.rotation.y = Math.PI / 2; tail.add(curl);
  g.userData = { body, head, legs, tail };
  return g;
}

const walkable = (x, z) => groundY(x, z) != null && dryAt(x, z, 0.5) && !blocked(x, z, 0.5, 'shore');

export class Buzz {
  constructor(game) {
    this.game = game;
    this.bubble = null;
    this.pos = new THREE.Vector3(HOME.x, 0, HOME.z);
    this.yaw = 0; this.target = null; this.wait = 2; this.walkT = 0;
  }
  init() {
    this.mesh = buildBuzz();
    this.mesh.scale.setScalar(0.95);
    this.pos.y = groundY(this.pos.x, this.pos.z) ?? 0;
    this.mesh.position.copy(this.pos);
    this.game.engine.scene.add(this.mesh);
  }
  // The whole path is checked once, here (every 0.5 m), so walking costs nothing per frame.
  pickTarget() {
    for (let i = 0; i < 6; i++) {
      const a = Math.random() * Math.PI * 2, r = 1.5 + Math.random() * ROAM_R;
      const x = HOME.x + Math.cos(a) * r, z = HOME.z + Math.sin(a) * r;
      const d = Math.hypot(x - this.pos.x, z - this.pos.z), n = Math.ceil(d / 0.5);
      let ok = true;
      for (let k = 1; k <= n && ok; k++) ok = walkable(this.pos.x + (x - this.pos.x) * (k / n), this.pos.z + (z - this.pos.z) * (k / n));
      if (ok) return { x, z };
    }
    return null;
  }
  near(d = 3) { const p = this.game.player.pos; return Math.hypot(p.x - this.pos.x, p.z - this.pos.z) < d; }
  update(dt, t) {
    if (!this.mesh) return;
    const me = this.game.player.pos;
    const far = Math.hypot(me.x - this.pos.x, me.z - this.pos.z);
    this.mesh.visible = far < 90;
    if (!this.mesh.visible) return;
    if (far > 40 && !this.target) { this.mesh.userData.legs.forEach((l) => { l.rotation.x = 0; }); return; } // nobody near: he naps on his feet
    const { body, head, legs, tail } = this.mesh.userData;
    let moving = false;
    if (far < 4) { this.target = null; this.wait = Math.max(this.wait, 1.5); } // someone's here: stop and stare
    else if (this.target) {
      const dx = this.target.x - this.pos.x, dz = this.target.z - this.pos.z, d = Math.hypot(dx, dz);
      if (d < 0.2) { this.target = null; this.wait = 2 + Math.random() * 5; }
      else {
        const want = Math.atan2(dx, dz);
        this.yaw += Math.atan2(Math.sin(want - this.yaw), Math.cos(want - this.yaw)) * Math.min(1, dt * 4);
        const step = Math.min(d, 0.9 * dt);
        this.pos.x += Math.sin(this.yaw) * step; this.pos.z += Math.cos(this.yaw) * step; moving = true;
      }
    } else if ((this.wait -= dt) <= 0) this.target = this.pickTarget();
    if (moving || !this.settled) { this.pos.y += ((groundY(this.pos.x, this.pos.z) ?? this.pos.y) - this.pos.y) * Math.min(1, dt * 10); this.settled = !moving; }
    this.mesh.position.copy(this.pos);
    this.mesh.rotation.y = this.yaw;
    // a trot, a bob, a curious head
    this.walkT += dt * (moving ? 9 : 0);
    legs.forEach((l, i) => { l.rotation.x = moving ? Math.sin(this.walkT + (i % 2 ? Math.PI : 0) + (i > 1 ? Math.PI : 0)) * 0.5 : 0; });
    body.position.y = moving ? Math.abs(Math.sin(this.walkT)) * 0.04 : Math.sin(t * 1.3) * 0.012;
    tail.rotation.z = Math.sin(t * 3) * 0.4;
    let look = 0;
    if (far < 8) { const a = Math.atan2(me.x - this.pos.x, me.z - this.pos.z) - this.yaw; look = Math.max(-0.7, Math.min(0.7, Math.atan2(Math.sin(a), Math.cos(a)))); }
    head.rotation.y += (look - head.rotation.y) * Math.min(1, dt * 3);
  }
  say(text) {
    this.bubble = { kind: 'chat', text, until: performance.now() + 4500, key: performance.now() };
    this.game.chat?.npcSay?.(PIG_NAME, text);
  }
  pet() {
    const line = LINES[Math.floor(Math.random() * LINES.length)];
    this.say(line);
    this.game.audio?.sfx?.('plip');
  }
  contextActions() {
    const p = this.game.player;
    if (!this.mesh || p.mode !== 'shore' || !this.near(2.6)) return [];
    return [{ id: 'buzz', label: `Pet ${PIG_NAME}`, color: 'green', at: { x: this.pos.x, z: this.pos.z, y: this.pos.y, h: 2.0 }, fn: () => this.pet() }];
  }
  plates(toScreen) {
    if (!this.mesh?.visible) return [];
    const p = this.game.player.pos;
    if (Math.hypot(p.x - this.pos.x, p.z - this.pos.z) > 30) return [];
    const at = this.pos.clone(); at.y += 2.2;
    return [{ id: 'buzz', name: PIG_NAME, title: 'Local legend', level: 0, screen: toScreen(at), bubble: this.bubble && performance.now() < this.bubble.until ? this.bubble : null, npc: true }];
  }
}
