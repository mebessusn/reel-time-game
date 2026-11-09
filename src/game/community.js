// The lake-wide goal: every catch by anyone on the lake fills one shared meter for the week.
// Fill it and the Lantern Festival starts: paper lanterns over the cove, fireworks every night
// until the week ends, and a gift for everyone who helped.
import * as THREE from 'three';
import { weekId } from '../core/clock.js';
import { WATER_Y } from '../world/terrain.js';

export const COMMUNITY_GOAL = 300;

/** Pure: total catches this week from untrusted per-player docs. */
export function communityTotal(docs, week) {
  let n = 0;
  for (const d of docs) if (d && d.week === week) n += Math.max(0, Math.min(2000, Math.floor(Number(d.n) || 0)));
  return n;
}

export class Community {
  constructor(game) {
    this.game = game;
    this.total = 0;
    this.mine = 0;
    this.week = weekId();
    this.fireT = 2;
    // fireworks get their own bigger sparks (the shared FX points are sized for splashes)
    const N = 900; // (v1.17.15: room for the ending's fireworks night too)
    this.pos = new Float32Array(N * 3); this.col = new Float32Array(N * 3);
    this.parts = Array.from({ length: N }, () => ({ life: 0 }));
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(this.col, 3));
    this.points = new THREE.Points(geo, new THREE.PointsMaterial({ size: 1.0, vertexColors: true, transparent: true, depthWrite: false, fog: false, blending: THREE.AdditiveBlending }));
    this.points.frustumCulled = false;
    this.next = 0;
    game.engine.scene.add(this.points);
  }

  burst(at, color, n = 60, speed = 6, life = 2.2) {
    const c = new THREE.Color(color);
    for (let i = 0; i < n; i++) {
      const p = this.parts[this.next++ % this.parts.length];
      const a = Math.random() * Math.PI * 2, b = Math.acos(2 * Math.random() - 1), s = speed + Math.random() * speed * 0.5;
      Object.assign(p, { x: at.x, y: at.y, z: at.z, vx: Math.sin(b) * Math.cos(a) * s, vy: Math.cos(b) * s, vz: Math.sin(b) * Math.sin(a) * s, life, max: life, r: c.r, g: c.g, b: c.b });
    }
  }
  /** v1.17.15: a rocket. A gold spark climbs from the water to `at`, leaving a trail, and bursts there (the ending's fireworks night). */
  launch(at, color, { n = 90, speed = 7, ring = null } = {}) {
    (this.rockets ||= []).push({ x: at.x + (Math.random() - 0.5) * 3, y: WATER_Y + 0.4, z: at.z + (Math.random() - 0.5) * 3, to: at, color, n, speed, ring, trailT: 0 });
  }
  /** How many sparks are alight (tests). */
  get lit() { return this.parts.reduce((n, p) => n + (p.life > 0 ? 1 : 0), 0); }

  init() {
    const g = this.game;
    this.myDoc = `${this.week}_${g.save.userId}`;
    this.unsub = g.shared.watch('community', (docs) => {
      this.week = weekId();
      const before = this.festival;
      this.total = communityTotal(docs, this.week);
      const me = docs.find((d) => d.id === this.myDoc.replace(/[^\w-]/g, '_'));
      this.mine = Math.max(this.mine, Number(me?.n) || 0);
      if (!before && this.festival && this.ready) g.chat?.system(`The lake filled the meter: ${this.total} catches! The Lantern Festival begins. Fireworks every night this week, and a gift from Gus at the notice board.`, 'festival', { popup: true });
      this.ready = true;
      g.ui.sheets.current?.name === 'board' && g.ui.sheets.refresh();
    }, { limit: 500 });
  }

  get festival() { return this.total >= COMMUNITY_GOAL; }
  get progress() { return Math.min(1, this.total / COMMUNITY_GOAL); }

  async onCatch() {
    const g = this.game;
    if (weekId() !== this.week) { this.week = weekId(); this.mine = 0; this.myDoc = `${this.week}_${g.save.userId}`; }
    this.mine++;
    this.total++;
    await g.shared.set('community', this.myDoc, { week: this.week, n: this.mine, at: Date.now() });
  }

  canClaim() { return this.festival && this.mine > 0 && !this.game.ext.d.festival.claimed[this.week]; }
  async claim() {
    if (!this.canClaim()) return;
    const r = await this.game.reward('festival', this.week, { coins: 150, pearls: 2, xp: 100 }, 'Lantern Festival');
    if (r?.ok !== false) this.game.ext.change((d) => { d.festival.claimed[this.week] = Date.now(); });
  }

  // Fireworks over the cove on festival nights.
  update(dt, force = false) {
    // sparks
    for (let i = 0; i < this.parts.length; i++) {
      const p = this.parts[i];
      if (p.life > 0) {
        p.life -= dt; p.vy -= 3 * dt; p.vx *= 1 - dt * 1.2; p.vy *= 1 - dt * 1.2; p.vz *= 1 - dt * 1.2;
        p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
        const k = Math.max(0, p.life / (p.max || 2.2));
        this.pos[i * 3] = p.x; this.pos[i * 3 + 1] = p.y; this.pos[i * 3 + 2] = p.z;
        this.col[i * 3] = p.r * k; this.col[i * 3 + 1] = p.g * k; this.col[i * 3 + 2] = p.b * k;
      } else this.pos[i * 3 + 1] = -999;
    }
    // rockets climbing to their burst
    if (this.rockets?.length) {
      for (const R of this.rockets) {
        const dy = R.to.y - R.y;
        R.x += (R.to.x - R.x) * Math.min(1, dt * 2); R.z += (R.to.z - R.z) * Math.min(1, dt * 2); R.y += Math.min(dy, (8 + dy * 1.5) * dt);
        R.trailT -= dt;
        if (R.trailT <= 0) { R.trailT = 0.03; this.burst({ x: R.x, y: R.y, z: R.z }, '#ffd88a', 1, 0.4, 0.5); }
        if (R.to.y - R.y < 0.05) {
          R.done = true; this.burst(R.to, R.color, R.n, R.speed, 2.6);
          if (R.ring) this.burst(R.to, R.ring, Math.round(R.n / 2), R.speed * 0.45, 2.2);
          if (this.game.player.pos.distanceTo(R.to) < 150) this.game.audio.sfx('firework');
        }
      }
      this.rockets = this.rockets.filter((R) => !R.done);
    }
    this.points.geometry.attributes.position.needsUpdate = true;
    this.points.geometry.attributes.color.needsUpdate = true;
    if (!this.festival && !force) return;
    const g = this.game;
    if (g.engine.sky.state.phase !== 'night' && !force) return;
    this.fireT -= dt;
    if (this.fireT > 0) return;
    this.fireT = 1 + Math.random() * 2;
    const at = new THREE.Vector3((Math.random() - 0.5) * 50, WATER_Y + 9 + Math.random() * 7, -22 + (Math.random() - 0.5) * 20);
    this.burst(at, ['#ff6a8a', '#f2c040', '#8ae0ff', '#a0f080', '#d8a0ff'][Math.floor(Math.random() * 5)]);
    if (g.player.pos.distanceTo(at) < 80) g.audio.sfx('firework');
  }
}
