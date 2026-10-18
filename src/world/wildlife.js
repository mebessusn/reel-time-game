// Wildlife: ducks paddling in little groups near the shore, herons wading in the shallows, and geese
// flying over in a V now and then. Ducks and herons take off when you row or walk too close, then
// settle somewhere else after a while.
import * as THREE from 'three';
import { WATER_Y, isWater, heightAt, LAKES } from './terrain.js';
import { buildCritter } from '../entities/critters.js';

const lam = (c) => new THREE.MeshLambertMaterial({ color: c });
const box = (w, h, d, m, x, y, z) => { const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); b.position.set(x, y, z); return b; };
const M = { body: lam('#8a6a4a'), head: lam('#2e7a4a'), white: lam('#f0eee6'), bill: lam('#f0a020'), grey: lam('#9aa4b0'), dark: lam('#3a3e46'), goose: lam('#6a6458'), black: lam('#1e1e22') };

// v1.8.2: cute low-poly mallards from art/critters.blend (drake and hen), in place of the old boxes
function buildDuck(male) {
  const g = buildCritter(male ? 'drake' : 'hen', { shadows: false });
  const { head, wingL, wingR } = g.userData.parts;
  wingL.visible = wingR.visible = false;
  head.userData.y = head.position.y;
  g.userData = { wingL, wingR, head };
  return g;
}
function buildHeron() {
  const g = new THREE.Group();
  g.add(box(0.5, 0.26, 0.24, M.grey, 0, 0.95, 0));
  g.add(box(0.04, 0.8, 0.04, M.bill, 0.02, 0.42, 0.06), box(0.04, 0.8, 0.04, M.bill, 0.02, 0.42, -0.06));
  const neck = box(0.07, 0.42, 0.07, M.white, 0.24, 1.25, 0);
  const head = box(0.14, 0.12, 0.1, M.white, 0.28, 1.5, 0);
  head.add(box(0.26, 0.04, 0.04, M.bill, 0.18, 0, 0), box(0.12, 0.03, 0.03, M.black, -0.05, 0.06, 0));
  g.add(neck, head);
  const wingL = box(0.5, 0.04, 0.55, M.grey, 0, 1.05, 0.3), wingR = box(0.5, 0.04, 0.55, M.grey, 0, 1.05, -0.3);
  wingL.visible = wingR.visible = false;
  g.add(wingL, wingR);
  g.userData = { wingL, wingR, head };
  return g;
}
function buildGoose() {
  const g = new THREE.Group();
  g.add(box(0.5, 0.2, 0.22, M.goose, 0, 0, 0), box(0.06, 0.06, 0.3, M.black, 0.28, 0.06, 0), box(0.1, 0.1, 0.1, M.black, 0.36, 0.08, 0));
  const wingL = box(0.3, 0.03, 0.6, M.goose, 0, 0.05, 0.38), wingR = box(0.3, 0.03, 0.6, M.goose, 0, 0.05, -0.38);
  g.add(wingL, wingR);
  g.userData = { wingL, wingR };
  return g;
}

// Water spots a couple of blocks from shore
function shallowSpot(cx, cz, rx, rz, r) {
  for (let i = 0; i < 40; i++) {
    const a = r() * Math.PI * 2, k = 0.55 + r() * 0.4;
    const x = cx + Math.cos(a) * rx * k, z = cz + Math.sin(a) * rz * k;
    const h = heightAt(x, z);
    if (isWater(x, z) && h <= 0 && h >= -3) return { x, z };
  }
  return null;
}
function wadeSpot(cx, cz, rx, rz, r) {
  for (let i = 0; i < 60; i++) {
    const a = r() * Math.PI * 2, k = 0.7 + r() * 0.5;
    const x = cx + Math.cos(a) * rx * k, z = cz + Math.sin(a) * rz * k;
    if (heightAt(x, z) === 0) return { x, z };
  }
  return null;
}

const HOMES = [{ cx: 0, cz: -2, rx: 30, rz: 30 }, ...Object.values(LAKES).filter((l) => l.name !== 'Echo Cavern').map((l) => ({ cx: l.cx, cz: l.cz, rx: l.rx, rz: l.rz }))];

export class Wildlife {
  constructor(scene, seed = 4242) {
    this.scene = scene;
    let a = seed;
    this.r = () => { a = (a * 1103515245 + 12345) >>> 0; return a / 4294967296; };
    this.ducks = [];
    this.herons = [];
    this.geese = null;
    this.geeseT = 40;
    for (let i = 0; i < 5; i++) this.addFlock(HOMES[i % HOMES.length]);
    for (let i = 0; i < 3; i++) this.addHeron(HOMES[(i * 2) % HOMES.length]);
  }

  addFlock(home) {
    const s = shallowSpot(home.cx, home.cz, home.rx, home.rz, this.r);
    if (!s) return;
    const n = 2 + Math.floor(this.r() * 3);
    for (let i = 0; i < n; i++) {
      const m = buildDuck(i === 0);
      const d = { m, home, x: s.x + i * 0.6, z: s.z + (i % 2) * 0.5, yaw: this.r() * 6.28, lead: i === 0, i, state: 'swim', t: 0, target: null, vy: 0, y: WATER_Y };
      m.position.set(d.x, WATER_Y, d.z);
      this.scene.add(m);
      this.ducks.push(d);
    }
  }
  addHeron(home) {
    const s = wadeSpot(home.cx, home.cz, home.rx, home.rz, this.r);
    if (!s) return;
    const m = buildHeron();
    const h = { m, home, x: s.x, z: s.z, y: WATER_Y - 0.25, yaw: this.r() * 6.28, state: 'wade', t: this.r() * 5 };
    m.position.set(h.x, h.y, h.z);
    this.scene.add(m);
    this.herons.push(h);
  }

  scared(x, z, threats, r) { return threats.some((p) => Math.hypot(p.x - x, p.z - z) < r); }

  update(dt, t, player, boating, audio) {
    const threats = [{ x: player.x, z: player.z }];
    const flee = boating ? 5 : 3;
    // ducks paddle after their leader, take off when you come close
    for (const d of this.ducks) {
      const near = Math.hypot(player.x - d.x, player.z - d.z) < 70;
      d.m.visible = near || d.state === 'fly';
      if (!d.m.visible) continue;
      if (d.state === 'swim') {
        if (this.scared(d.x, d.z, threats, flee)) {
          d.state = 'fly'; d.t = 0; d.vy = 2.5 + this.r();
          const away = Math.atan2(d.z - player.z, d.x - player.x) + (this.r() - 0.5) * 0.6;
          d.yaw = away;
          if (audio && Math.hypot(player.x - d.x, player.z - d.z) < 12) audio.sfx('flap');
          continue;
        }
        if (!d.target || Math.hypot(d.target.x - d.x, d.target.z - d.z) < 0.4) {
          const lead = d.lead ? null : this.ducks.find((o) => o.lead && o.home === d.home && o.state === 'swim');
          d.target = lead ? { x: lead.x - Math.cos(lead.yaw) * (0.7 + d.i * 0.5), z: lead.z - Math.sin(lead.yaw) * (0.7 + d.i * 0.5) } : (shallowSpot(d.home.cx, d.home.cz, d.home.rx, d.home.rz, this.r) || { x: d.x, z: d.z });
        }
        const dx = d.target.x - d.x, dz = d.target.z - d.z, dist = Math.hypot(dx, dz);
        if (dist > 0.05) {
          const sp = Math.min(dist, dt * (d.lead ? 0.5 : 0.7));
          const nx = d.x + (dx / dist) * sp, nz = d.z + (dz / dist) * sp;
          if (isWater(nx, nz)) { d.x = nx; d.z = nz; } else d.target = null;
          let dy = Math.atan2(dz, dx) - d.yaw; dy = Math.atan2(Math.sin(dy), Math.cos(dy));
          d.yaw += dy * Math.min(1, dt * 3);
        }
        d.y = WATER_Y - 0.08 + Math.sin(t * 2 + d.i) * 0.02;
        const dab = Math.max(0, Math.sin(t * 0.8 + d.i * 2) - 0.93) * 14; // the odd dabble: head down, bottom up
        d.m.userData.head.rotation.z = -Math.min(1.3, dab);
        d.m.rotation.z = -Math.min(0.5, dab * 0.4);
        d.m.userData.wingL.visible = d.m.userData.wingR.visible = false;
      } else {
        d.t += dt;
        d.x += Math.cos(d.yaw) * dt * 5; d.z += Math.sin(d.yaw) * dt * 5;
        d.y += d.vy * dt; d.vy = Math.max(0.6, d.vy - dt * 0.8);
        const flap = Math.sin(t * 22 + d.i) * 0.9;
        d.m.userData.wingL.visible = d.m.userData.wingR.visible = true;
        d.m.userData.head.rotation.z = 0; d.m.rotation.z = 0;
        d.m.userData.wingL.rotation.x = flap; d.m.userData.wingR.rotation.x = -flap;
        if (d.t > 9) { // land back home somewhere else
          const s = shallowSpot(d.home.cx, d.home.cz, d.home.rx, d.home.rz, this.r);
          if (s) { d.x = s.x + d.i * 0.6; d.z = s.z; }
          d.y = WATER_Y; d.state = 'swim'; d.target = null;
        }
      }
      d.m.position.set(d.x, d.y, d.z);
      d.m.rotation.y = -d.yaw;
    }
    // herons stand still and stab at fish now and then
    for (const h of this.herons) {
      const near = Math.hypot(player.x - h.x, player.z - h.z) < 70;
      h.m.visible = near || h.state === 'fly';
      if (!h.m.visible) continue;
      h.t += dt;
      if (h.state === 'wade') {
        const stab = Math.max(0, Math.sin(h.t * 0.5) - 0.96) * 20;
        h.m.userData.head.position.set(0.28 + stab * 0.08, 1.5 - stab * 0.4, 0);
        if (this.scared(h.x, h.z, threats, flee + 1.5)) {
          h.state = 'fly'; h.t = 0; h.yaw = Math.atan2(h.z - player.z, h.x - player.x);
          if (audio && Math.hypot(player.x - h.x, player.z - h.z) < 14) audio.sfx('flap');
        }
      } else {
        h.x += Math.cos(h.yaw) * dt * 4; h.z += Math.sin(h.yaw) * dt * 4; h.y += dt * 1.6;
        const flap = Math.sin(t * 7) * 0.7;
        h.m.userData.wingL.visible = h.m.userData.wingR.visible = true;
        h.m.userData.wingL.rotation.x = flap; h.m.userData.wingR.rotation.x = -flap;
        if (h.t > 12) {
          const s = wadeSpot(h.home.cx, h.home.cz, h.home.rx, h.home.rz, this.r);
          if (s) { h.x = s.x; h.z = s.z; }
          h.y = WATER_Y - 0.25; h.state = 'wade';
          h.m.userData.wingL.visible = h.m.userData.wingR.visible = false;
        }
      }
      h.m.position.set(h.x, h.y, h.z);
      h.m.rotation.y = -h.yaw;
    }
    // geese overhead in a V every few minutes
    this.geeseT -= dt;
    if (!this.geese && this.geeseT <= 0) {
      const g = new THREE.Group();
      for (let i = 0; i < 7; i++) {
        const goose = buildGoose();
        const side = i % 2 ? 1 : -1, row = Math.ceil(i / 2);
        goose.position.set(-row * 1.4, 0, side * row * 1.2);
        g.add(goose);
      }
      const a = this.r() * Math.PI * 2;
      g.userData = { x: player.x - Math.cos(a) * 110, z: player.z - Math.sin(a) * 110, yaw: a, t: 0 };
      g.position.y = player.y + 26;
      this.scene.add(g);
      this.geese = g;
      if (audio) audio.sfx('honk');
    }
    if (this.geese) {
      const u = this.geese.userData;
      u.t += dt;
      u.x += Math.cos(u.yaw) * dt * 9; u.z += Math.sin(u.yaw) * dt * 9;
      this.geese.position.x = u.x; this.geese.position.z = u.z;
      this.geese.rotation.y = -u.yaw;
      this.geese.children.forEach((c, i) => { const f = Math.sin(t * 6 + i) * 0.6; c.userData.wingL.rotation.x = f; c.userData.wingR.rotation.x = -f; });
      if (u.t > 26) { this.scene.remove(this.geese); this.geese = null; this.geeseT = 120 + this.r() * 180; }
    }
  }
}
