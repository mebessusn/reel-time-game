// A living lake: seasons that turn every real week, wind in the reeds and trees, fish that jump
// (and hint at what's biting there), a rainbow after rain, and Gus remembering you.
import * as THREE from 'three';
import { softDot } from '../render/softdot.js';
import { WATER_Y, isWater, zoneAt, CLEARINGS, LAKES, groundY, surfaceY, heightAt , inValley } from '../world/terrain.js';
import { mulberry32 } from '../core/rng.js';
import { CABIN, WIND } from '../world/props.js';
import { SPECIES_BY_ID } from '../data/species.js';
import { worldTime, weatherFor } from '../core/clock.js';
import { eligibleSpecies, effectiveZone } from './rules.js';
import { buildFish } from '../entities/fish.js';

import { SEASONS, seasonFor, seasonBoost } from '../data/seasons.js';

/** Pure: was there rain earlier today (in-game day) or yesterday, and is it clear now? */
export function rainbowNow(wt) {
  if (wt.weather !== 'clear' || (wt.phase !== 'day' && wt.phase !== 'dawn')) return false;
  const prev = weatherFor(wt.day - 1);
  return (prev === 'rain' || prev === 'storm') && wt.f < 0.55;
}

export class Living {
  constructor(game) {
    this.game = game;
    this.season = seasonFor();
    this.jumpT = 4;
    this.jumps = [];
    this.hint = null; // { x, z, speciesId, until }
    const scene = game.engine.scene;
    // seasonal particles: a cloud that follows you (petals, pollen, leaves or snow)
    const N = 260;
    this.pPos = new Float32Array(N * 3);
    this.pSeed = Array.from({ length: N }, () => [Math.random() * 50 - 25, Math.random() * 14, Math.random() * 50 - 25, Math.random() * 6.28, 0.5 + Math.random()]);
    const pg = new THREE.BufferGeometry();
    pg.setAttribute('position', new THREE.BufferAttribute(this.pPos, 3));
    this.pMat = new THREE.PointsMaterial({ map: softDot(), color: SEASONS[this.season].particle, size: 0.22, transparent: true, opacity: 0.85, depthWrite: false, alphaTest: 0.02 });
    this.particles = new THREE.Points(pg, this.pMat);
    this.particles.frustumCulled = false;
    scene.add(this.particles);
    // the rainbow: a big soft arc over the far shore
    const rb = new THREE.Mesh(new THREE.TorusGeometry(42, 4, 8, 64, Math.PI), new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, fog: false, side: THREE.DoubleSide,
      uniforms: { uO: { value: 0 } },
      vertexShader: 'varying vec3 vP; void main() { vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader: `uniform float uO; varying vec3 vP;
        vec3 hue(float h) { return clamp(abs(mod(h * 6.0 + vec3(0.0, 4.0, 2.0), 6.0) - 3.0) - 1.0, 0.0, 1.0); }
        void main() { float r = (length(vP.xy) - 38.0) / 8.0; if (r < 0.0 || r > 1.0) discard; float edge = smoothstep(0.0, 0.2, r) * smoothstep(1.0, 0.8, r);
          gl_FragColor = vec4(mix(hue(0.8 - r * 0.8), vec3(1.0), 0.25), edge * uO); }`,
    }));
    rb.position.set(0, WATER_Y - 3, -2);
    this.rainbow = rb;
    scene.add(rb);
  }

  init() {
    const s = SEASONS[this.season];
    const g = this.game;
    if (g.ext.d.stats.lastSeason !== this.season) {
      g.ext.change((d) => { d.stats.lastSeason = this.season; });
      g.chat?.system(`${s.name} has come to the valley. ${s.blurb}`, 'event', { popup: true });
    }
    this.applyTint();
  }

  applyTint() {
    // a gentle season tint on the ground and plants (blush in spring, warm in autumn, cold in winter)
    const c = new THREE.Color(SEASONS[this.season].tint);
    for (const name of ['plants', 'trees']) { const o = this.game.engine.scene.getObjectByName(name); o?.traverse((m) => { if (m.isMesh && m.material?.color) m.material.color.copy(c); }); }
    for (const m of this.game.engine.terrain.children) if (m.material?.color) m.material.color.copy(c);
  }

  // ---- fish that jump, hinting at what's here
  spawnJump() {
    const g = this.game, p = g.player.pos;
    for (let tries = 0; tries < 10; tries++) {
      const a = Math.random() * Math.PI * 2, r = 6 + Math.random() * 18;
      const x = p.x + Math.cos(a) * r, z = p.z + Math.sin(a) * r;
      const zone = zoneAt(x, z);
      if (!zone || !isWater(x + 1, z) || !isWater(x - 1, z)) continue;
      const wt = g.engine.sky.state;
      const eff = effectiveZone(zone, g.profile.level, wt.phase, {});
      const pool = eligibleSpecies(null, { zone: eff, phase: wt.phase, weather: wt.weather }).filter((s) => s.tier !== 'mythic' && s.tier !== 'legendary');
      if (!pool.length) continue;
      const weights = pool.map((s) => ({ common: 6, uncommon: 4, rare: 2, epic: 1 }[s.tier] || 1) * seasonBoost(this.season, s.id));
      let k = Math.random() * weights.reduce((x, y) => x + y, 0), sp = pool[0];
      for (let i = 0; i < pool.length; i++) { k -= weights[i]; if (k <= 0) { sp = pool[i]; break; } }
      const mesh = buildFish(sp.id, 'normal');
      g.engine.scene.add(mesh);
      const dir = Math.random() * Math.PI * 2;
      this.jumps.push({ mesh, x, z, dir, t: 0, dur: 0.9 + Math.random() * 0.3, h: 0.9 + Math.random() * 0.8 });
      g.fx.splash(new THREE.Vector3(x, WATER_Y, z), 0.6);
      g.engine.water.ripple(x, z, 0.5);
      if (Math.hypot(x - p.x, z - p.z) < 16) g.audio.sfx('splashRemote');
      // rarer jumpers get a little label, and casting near one gives you a better chance at it
      this.hint = { x, z, speciesId: sp.id, until: performance.now() + 20000 };
      if (sp.tier !== 'common') this.label(sp, x, z);
      return;
    }
  }

  label(sp, x, z) {
    const g = this.game;
    this.jumpLabel = { text: `${sp.name}!`, at: new THREE.Vector3(x, WATER_Y + 1.6, z), until: performance.now() + 2600, key: performance.now() };
  }

  /** Hook-time: a fish jumped near your bobber lately? Chance the bite is that one. */
  hintBite(bobber) {
    const h = this.hint;
    if (!h || performance.now() > h.until || !bobber) return null;
    if (Math.hypot(bobber.x - h.x, bobber.z - h.z) > 4.5) return null;
    return Math.random() < 0.45 ? h.speciesId : null;
  }

  // ---- Gus remembers you
  gusTick() {
    const g = this.game;
    if (this.gusDone || !g.nearCabin()) return;
    this.gusDone = true;
    const name = g.profile.name;
    const last = g.ext.d.stats.lastGreatLabel;
    const lines = last
      ? [`Welcome back, ${name}! Still thinking about that ${last} of yours.`, `${name}! Folks are still talking about your ${last}.`]
      : g.profile.catchCount > 0 ? [`Good to see you again, ${name}. Fish are biting.`, `Morning, ${name}! The lake missed you.`] : [`Welcome to Cozy Cove, ${name}! Holler if you need tackle.`];
    const text = lines[Math.floor(Math.random() * lines.length)];
    g.chat?.npcSay?.('Gus', text);
    this.gusBubble = { kind: 'chat', text, until: performance.now() + 5000, key: performance.now() };
  }

  /** Extra nameplate entries (Gus's bubble, a jumping fish's name). */
  plates(toScreen) {
    const out = [];
    const now = performance.now();
    const gus = this.game.engine.props.gus;
    if (this.gusBubble && now < this.gusBubble.until && gus) {
      const at = gus.position.clone(); at.y += 2.4;
      out.push({ id: 'gus', name: 'Gus', title: 'Tackle & Tide', level: 0, screen: toScreen(at), bubble: this.gusBubble, npc: true });
    }
    if (this.jumpLabel && now < this.jumpLabel.until) out.push({ id: 'jump', name: '', isMe: true, screen: toScreen(this.jumpLabel.at), bubble: { kind: 'chat', text: this.jumpLabel.text, key: this.jumpLabel.key } });
    return out;
  }

  update(dt, t) {
    const g = this.game;
    const wt = g.engine.sky.state;
    // wind follows the weather and the season
    const target = SEASONS[this.season].wind + (wt.weather === 'storm' ? 0.8 : wt.weather === 'rain' ? 0.35 : wt.weather === 'overcast' ? 0.12 : 0);
    // and it comes in gusts: a few windier spells every in-game day
    const gust = Math.max(0, Math.sin(t * 0.021) * 0.22 + Math.sin(t * 0.0537 + 1.3) * 0.14);
    WIND.uWind.value += (target + gust - WIND.uWind.value) * Math.min(1, dt * 0.5);
    if (g.engine.water?.uniforms.uWind) g.engine.water.uniforms.uWind.value = WIND.uWind.value;
    WIND.uWT.value = t;
    // jumping fish
    this.jumpT -= dt;
    if (this.jumpT <= 0) { this.jumpT = 5 + Math.random() * 9; this.spawnJump(); }
    for (let i = this.jumps.length - 1; i >= 0; i--) {
      const j = this.jumps[i];
      j.t += dt;
      const k = j.t / j.dur;
      const along = (k - 0.5) * 1.6;
      j.mesh.position.set(j.x + Math.cos(j.dir) * along, WATER_Y - 0.3 + Math.sin(Math.PI * Math.min(1, k)) * j.h, j.z + Math.sin(j.dir) * along);
      j.mesh.rotation.set(0, -j.dir, (0.5 - k) * 2.2);
      if (k >= 1) {
        g.fx.splash(new THREE.Vector3(j.mesh.position.x, WATER_Y, j.mesh.position.z), 0.5);
        g.engine.scene.remove(j.mesh);
        this.jumps.splice(i, 1);
      }
    }
    // seasonal particles drift around you
    const p = g.player.pos;
    const fall = this.season === 'winter' ? 1.2 : this.season === 'autumn' ? 0.9 : 0.35;
    const night = wt.phase === 'night';
    this.particles.visible = !(this.season === 'summer' && night) && wt.weather !== 'storm' && inValley(g.player.pos.x); // (not in Open Waters or Frostmere)
    if (this.particles.visible) {
      const w = WIND.uWind.value;
      this.pSeed.forEach((s, i) => {
        s[1] -= dt * fall * s[4];
        if (s[1] < -1) s[1] += 14;
        const sx = s[0] + Math.sin(t * 0.6 + s[3]) * 1.2 + t * w * 1.5;
        const sz = s[2] + Math.cos(t * 0.5 + s[3]) * 1.2;
        this.pPos[i * 3] = p.x + (((sx % 50) + 75) % 50) - 25;
        this.pPos[i * 3 + 1] = Math.max(WATER_Y + 0.1, p.y - 1 + s[1]);
        this.pPos[i * 3 + 2] = p.z + (((sz % 50) + 75) % 50) - 25;
      });
      this.particles.geometry.attributes.position.needsUpdate = true;
      this.pMat.size = this.season === 'winter' ? 0.12 : 0.15;
    }
    // rainbow after rain
    const want = rainbowNow(wt) ? 0.42 : 0;
    const u = this.rainbow.material.uniforms.uO;
    u.value += (want - u.value) * Math.min(1, dt * 0.3);
    const was = this.rainbow.visible;
    this.rainbow.visible = u.value > 0.01;
    if (this.rainbow.visible) {
      // v1.9.10: it stands still in one spot (the same for everyone that day) instead of turning to face you,
      // with one foot on dry land, and a little pot of gold and pearls waiting there
      if (!was || !this.rbAt) this.placeRainbow(wt.day);
      this.rainbow.position.set(this.rbAt.x, WATER_Y - 3, this.rbAt.z);
      this.rainbow.rotation.y = this.rbAt.yaw;
      if (this.pot) {
        this.pot.visible = !this.potTaken(wt.day);
        this.pot.userData.glint.material.opacity = 0.5 + Math.sin(performance.now() / 300) * 0.3;
      }
    } else { this.rbAt = null; if (this.pot) this.pot.visible = false; }
  }

  /** Pick the day's rainbow: over one lake, turned so one end lands on dry ground (where the pot goes). */
  placeRainbow(day) {
    const r = mulberry32(day * 977 + 13);
    const lakes = [{ x: 0, z: -2 }, ...['frost', 'marsh', 'pond', 'quarry'].map((k) => ({ x: LAKES[k].cx, z: LAKES[k].cz }))];
    const R = 40; // where the arc meets the ground (the torus's centre radius is 42, the bands 38..46)
    let pick = null;
    for (let tries = 0; tries < 40 && !pick; tries++) {
      const L = lakes[Math.floor(r() * lakes.length)], yaw = r() * Math.PI * 2;
      // the torus lies in its local x-y plane: its feet are at local x = +-42
      const ex = L.x + Math.cos(yaw) * R, ez = L.z - Math.sin(yaw) * R;
      if (groundY(ex, ez) != null && !isWater(ex, ez) && heightAt(ex, ez) <= 5) pick = { x: L.x, z: L.z, yaw, foot: { x: ex, z: ez } };
    }
    pick ||= { x: 0, z: -2, yaw: 0, foot: { x: 40, z: -2 } };
    this.rbAt = pick;
    this.rbDay = day;
    if (!this.pot) this.pot = this.buildPot();
    this.pot.position.set(pick.foot.x, surfaceY(pick.foot.x, pick.foot.z), pick.foot.z);
  }

  buildPot() {
    const g = new THREE.Group();
    const iron = new THREE.MeshPhongMaterial({ color: '#2a2a2e', shininess: 40 });
    const gold = new THREE.MeshPhongMaterial({ color: '#f2c040', emissive: '#6a4a00', shininess: 90, specular: '#fff2b0' });
    const pearl = new THREE.MeshPhongMaterial({ color: '#f4f0f6', emissive: '#30303a', shininess: 120, specular: '#ffffff' });
    const pot = new THREE.Mesh(new THREE.SphereGeometry(0.42, 16, 10, 0, Math.PI * 2, Math.PI * 0.25, Math.PI * 0.75), iron);
    pot.position.y = 0.36; g.add(pot);
    const rim = new THREE.Mesh(new THREE.TorusGeometry(0.31, 0.05, 6, 20), iron); rim.rotation.x = Math.PI / 2; rim.position.y = 0.66; g.add(rim);
    for (const a of [0, 2.1, 4.2]) { const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.03, 0.14, 6), iron); leg.position.set(Math.cos(a) * 0.24, 0.05, Math.sin(a) * 0.24); g.add(leg); }
    const heap = new THREE.Mesh(new THREE.SphereGeometry(0.3, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), gold); heap.scale.y = 0.55; heap.position.y = 0.64; g.add(heap);
    const coin = new THREE.CylinderGeometry(0.07, 0.07, 0.02, 12), bead = new THREE.SphereGeometry(0.045, 10, 8);
    const rr = mulberry32(5);
    for (let i = 0; i < 14; i++) { const c = new THREE.Mesh(coin, gold); const a = rr() * 6.28, d = rr() * 0.22; c.position.set(Math.cos(a) * d, 0.7 + rr() * 0.1, Math.sin(a) * d); c.rotation.set(rr() * 1.2, 0, rr() * 1.2); g.add(c); }
    for (let i = 0; i < 6; i++) { const c = new THREE.Mesh(coin, gold); const a = rr() * 6.28, d = 0.5 + rr() * 0.25; c.position.set(Math.cos(a) * d, 0.012, Math.sin(a) * d); g.add(c); } // a few spilled on the grass
    for (let i = 0; i < 7; i++) { const b = new THREE.Mesh(bead, pearl); const a = rr() * 6.28, d = rr() * 0.2; b.position.set(Math.cos(a) * d, 0.78 + rr() * 0.05, Math.sin(a) * d); g.add(b); }
    const glint = new THREE.Mesh(new THREE.SphereGeometry(0.9, 12, 8), new THREE.MeshBasicMaterial({ color: '#ffe68a', transparent: true, opacity: 0.4, depthWrite: false, blending: THREE.AdditiveBlending }));
    glint.position.y = 0.7; glint.scale.setScalar(0.6); g.add(glint);
    g.traverse((o) => { if (o.isMesh && o !== glint) o.castShadow = true; });
    g.userData.glint = glint;
    g.visible = false;
    this.game.engine.scene.add(g);
    return g;
  }

  potTaken(day) { return (this.game.ext.d.gifts || []).includes(`rainbow-${day}`); }

  contextActions() {
    const p = this.game.player.pos;
    if (!this.pot?.visible || !this.rbAt || this.game.player.mode !== 'shore') return [];
    const q = this.pot.position;
    if (Math.hypot(p.x - q.x, p.z - q.z) > 2.2) return [];
    return [{ id: 'rainbow-pot', label: 'Pot of gold!', color: 'gold', at: { x: q.x, y: q.y, z: q.z, h: 1.4 }, fn: () => this.takePot() }];
  }

  async takePot() {
    const g = this.game, day = this.rbDay;
    if (this.potTaken(day)) return;
    g.ext.change((d) => { d.gifts = [...(d.gifts || []), `rainbow-${day}`]; });
    g.fx?.sparkle?.(this.pot.position.clone().setY(this.pot.position.y + 0.8), '#ffe080', 40);
    const r = await g.reward('treasure', `rainbow-${day}`, { coins: 300, pearls: 3, xp: 60 }, 'The pot of gold at the end of the rainbow!');
    if (!r?.ok) g.ext.change((d) => { d.gifts = (d.gifts || []).filter((x) => x !== `rainbow-${day}`); });
  }

  tick() { this.gusTick(); const s = seasonFor(); if (s !== this.season) { this.season = s; this.pMat.color.set(SEASONS[s].particle); this.applyTint(); this.init(); } }
}

export { CLEARINGS, CABIN, SEASONS, seasonFor, seasonBoost };
