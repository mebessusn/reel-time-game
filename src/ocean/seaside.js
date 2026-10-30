// Open Waters v1.15.11: the Billfish Derby and the tides.
// - The Billfish Derby: every week (Monday to Sunday, UTC) the lake keeps a board of each angler's heaviest billfish
//   (sailfish, blue marlin, swordfish), in the shared `billfish` collection (the artifact's db; this device elsewhere).
//   The week's winner gets the Derby Cup for the cottage wall (and coins and pearls); the podium gets coins. Each
//   angler's own game claims their prize from last week's board, once. Entries are other players' writes: sanitized.
// - Tides: two a day on the sea's clock (low at dawn and dusk). At low tide rock pools along the island beaches come
//   up out of the water with something glinting in them: search one (once a low tide) for a shell, a piece of sea
//   glass, or now and then a pearl. All six shells or all five colours of glass send a piece home to the cottage. At
//   high tide the reef fish crowd in, and spearfishing finds more of them (dive.js reads `high`).
import * as THREE from 'three';
import { h } from '../ui/dom.js';
import { icon } from '../ui/icons.js';
import { SPECIES_BY_ID } from '../data/species.js';
import { ISLANDS, ISLAND_BY_ID, DOCKS, GROTTO, oceanSurfaceY, padAt } from './geo.js';
import { ISLEPROP_MATS, ISLEPROP_NODES } from '../data/islePropsMesh.js';
import { buildNode } from './meshes.js';
import { dayFraction, dayIndex } from '../core/clock.js';
import { pathDist } from './islands.js';
import { weekId, weekEnds, WEEK_MS, BILLFISH_IDS, billfishBoard, derbyPrize, tideLevel, tideName, lowTideId, forageRoll, SHELLS, SEAGLASS } from './voyageData.js';

const WATER_Y = 0.85;
const lb = (w) => `${Math.round(w)} lb`;

export class BillfishDerby {
  constructor(game, ow) { this.game = game; this.ow = ow; this.rows = { now: [], last: [] }; this.loaded = { now: false, last: false }; this.wk = null; this.t = 6; } // (first look a few seconds in, once the shared store is up)
  get me() { return String(this.game.save.userId || 'me'); }
  maxOf(sp) { return (SPECIES_BY_ID[sp]?.weight?.[1] || 2000) * 1.05; }

  /** Watch this week's board and last week's (re-armed when the week turns). */
  watch() {
    const g = this.game, wk = weekId(), last = weekId(Date.now() - WEEK_MS);
    if ((this.wk === wk && this.kind === g.shared?.kind) || !g.shared?.watchWhere) return;
    this.wk = wk; this.kind = g.shared.kind;
    this.unsub?.(); this.unsub2?.();
    this.loaded = { now: false, last: false };
    this.unsub = g.shared.watchWhere('billfish', 'wk', wk, (docs) => { this.rows.now = billfishBoard(docs, wk, (sp) => this.maxOf(sp)); this.loaded.now = true; });
    this.unsub2 = g.shared.watchWhere('billfish', 'wk', last, (docs) => { this.rows.last = billfishBoard(docs, last, (sp) => this.maxOf(sp)); this.loaded.last = true; this.lastWk = last; });
  }
  myBest() { return this.rows.now.find((r) => r.u === this.me)?.w || this.game.ext.d.ocean?.derbyBest?.[weekId()] || 0; }
  rank() { const i = this.rows.now.findIndex((r) => r.u === this.me); return i < 0 ? 0 : i + 1; }

  /** A billfish landed: enter it if it beats my best this week. */
  onCatch(c, sp) {
    const g = this.game;
    if (!sp || !BILLFISH_IDS.includes(sp.id) || c.speared) return;
    const wk = weekId(), w = Math.round(c.weight * 10) / 10;
    if (w <= this.myBest()) { g.ui.toast(`Billfish Derby: your best this week is still ${lb(this.myBest())}.`, { icon: 'trophy' }); return; }
    g.ext.change((d) => { d.ocean.derbyBest = { [wk]: w }; });
    const doc = { wk, u: this.me, sp: sp.id, w, n: String(g.profile.name || 'Angler').slice(0, 20), at: Date.now() };
    g.shared.set('billfish', `${wk}-${this.me}`, doc).catch?.(() => {});
    // rank right away from what we know (the watch catches up a moment later)
    this.rows.now = billfishBoard([...this.rows.now.map((r) => ({ ...r, wk })), doc], wk, (s) => this.maxOf(s));
    const r = this.rank();
    g.audio.sfx('derby');
    g.juice?.pop(r === 1 ? 'DERBY LEADER!' : `DERBY #${r}`, { color: '#ffd060', size: 34 });
    g.chat.system(`Billfish Derby: your ${sp.name} (${lb(w)}) puts you #${r} of ${this.rows.now.length} this week. The board closes Sunday at midnight (UTC).`, 'derby', { popup: true });
  }

  /** Last week's prize, claimed once by your own game. */
  async claim() {
    const g = this.game, last = this.lastWk;
    if (!this.loaded.last || !last || g.ext.d.ocean?.derbyClaimed?.[last] != null) return;
    const i = this.rows.last.findIndex((r) => r.u === this.me);
    g.ext.change((d) => { d.ocean.derbyClaimed = { ...(d.ocean.derbyClaimed || {}), [last]: i < 0 ? 0 : i + 1 }; });
    if (i < 0) return;
    const place = i + 1, field = this.rows.last.length, prize = derbyPrize(place, field);
    if (prize.cup) {
      g.ext.change((d) => {
        d.ocean.derbyWins = (d.ocean.derbyWins || 0) + 1;
        d.home.owned = [...new Set([...(d.home.owned || []), 'ow_cup'])];
        if (!d.home.decor.includes('ow_cup')) d.home.decor.push('ow_cup');
      });
      g.chat.system(`You won last week's Billfish Derby with a ${lb(this.rows.last[0].w)} ${SPECIES_BY_ID[this.rows.last[0].sp]?.name}! Marlowe has sent the Derby Cup to your cottage wall.`, 'derby', { popup: true });
      g.audio.sfx('achievement');
    } else g.chat.system(`Last week's Billfish Derby: you placed #${place} of ${field}.`, 'derby', { popup: true });
    const { cup, ...pay } = prize;
    await g.reward('billfish', last, pay, `Billfish Derby #${place}`);
    g.pushMeta?.();
  }

  update(dt) {
    this.t -= dt;
    if (this.t > 0) return;
    this.t = 20;
    this.watch();
    this.claim().catch((e) => console.warn('[open waters] derby claim', e));
  }

  /** The board, as a card (from Marlowe at the pier, or the chart at sea). */
  card() {
    const ui = this.ow.ui, rows = this.rows.now.slice(0, 10), left = Math.max(0, weekEnds() - Date.now());
    const d = Math.floor(left / 86400000), hrs = Math.floor((left % 86400000) / 3600000);
    const last = this.rows.last[0];
    ui.openModal('ow-derby',
      h('div.ow-head', h('span.ow-badge', icon('trophy')), h('div', h('b', 'Billfish Derby'), h('span', `This week · closes in ${d ? `${d}d ` : ''}${hrs}h (Sunday midnight UTC)`))),
      h('p.ow-note', 'Your heaviest sailfish, blue marlin or swordfish this week counts. The winner takes the Derby Cup home for the cottage wall (plus 1,500 coins and 3 pearls); second and third get 600 coins.'),
      rows.length ? h('ol.ow-derby-list', rows.map((r, i) => h(`li${r.u === this.me ? '.me' : ''}`, h('i', String(i + 1)), h('b', r.n), h('span', `${lb(r.w)} ${SPECIES_BY_ID[r.sp]?.name || ''}`))))
        : h('p.ow-note', 'No billfish on the board yet this week. Sailfish in the Weed Line by day, marlin in the Deep Blue, swordfish over the Canyon at night.'),
      last ? h('p.ow-note.dim', `Last week's winner: ${last.n}, ${lb(last.w)} ${SPECIES_BY_ID[last.sp]?.name || ''}.`) : null,
      h('div.ow-acts', h('button.btn.ghost.on-dark', { on: { click: () => ui.closeModal() } }, 'Close')));
  }
}

export class Tides {
  constructor(game, ow) { this.game = game; this.ow = ow; this.sites = []; this.built = false; this.level = 1; }
  get high() { return this.level > 0.5; }
  get low() { return this.level < -0.5; }
  name() { return tideName(this.level); }

  /** Rock pools along the island beaches, just under the water at mid tide (built with the islands). */
  build() {
    if (this.built || !this.ow.islands.built) return;
    this.built = true;
    const scene = this.game.engine.scene;
    const glintTex = (() => { const c = document.createElement('canvas'); c.width = c.height = 32; const x = c.getContext('2d'), gr = x.createRadialGradient(16, 16, 0, 16, 16, 16); gr.addColorStop(0, 'rgba(255,255,240,1)'); gr.addColorStop(0.3, 'rgba(255,240,200,0.6)'); gr.addColorStop(1, 'rgba(255,240,200,0)'); x.fillStyle = gr; x.fillRect(0, 0, 32, 32); return new THREE.CanvasTexture(c); })();
    for (const I of ISLANDS) {
      const want = I.id === 'smuggler' ? 2 : 5, D = DOCKS[I.id];
      for (let k = 0, n = 0; k < 72 && n < want; k++) {
        const a = ((k * 29) % 72) / 72 * Math.PI * 2, ux = Math.cos(a), uz = Math.sin(a);
        // out from the middle (an atoll: from its dune ring) to just past the water's edge
        let d = I.atoll ? I.r * 0.75 : 0;
        while (d < 260 && oceanSurfaceY(I.x + ux * d, I.z + uz * d) > WATER_Y - 0.05) d += 0.5;
        const x = I.x + ux * (d + 0.6), z = I.z + uz * (d + 0.6), sy = oceanSurfaceY(x, z);
        if (sy < WATER_Y - 0.9 || sy > WATER_Y) continue; // (a cliff drops straight into deep water: no pools there)
        if (Math.hypot(x - D.x0, z - D.z0) < 14 || Math.hypot(x - D.end.x, z - D.end.z) < 10 || padAt(x, z, 6) || Math.hypot(x - GROTTO.mouth.x, z - GROTTO.mouth.z) < 12) continue;
        if (pathDist(I.id, x, z) < 2 || this.sites.some((s) => Math.hypot(s.x - x, s.z - z) < 14)) continue;
        const m = buildNode(ISLEPROP_MATS, ISLEPROP_NODES, 'isle_tidepool', { shadow: false });
        m.rotation.y = a * 3.1; m.scale.setScalar(1.15);
        const glint = new THREE.Sprite(new THREE.SpriteMaterial({ map: glintTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0 }));
        glint.scale.setScalar(0.6);
        scene.add(m, glint);
        this.sites.push({ id: `${I.id}${n}`, island: I.id, x, z, sy, m, glint, ph: k });
        n++;
      }
    }
  }

  update(dt, t) {
    const ow = this.ow;
    this.level = tideLevel(dayFraction());
    if (!ow.atSea) return;
    this.build();
    const lowK = Math.max(0, Math.min(1, (-this.level - 0.15) / 0.55)); // 0 covered .. 1 uncovered
    const lowId = lowTideId(dayIndex(), dayFraction()), done = this.game.ext.d.ocean?.foraged || {};
    const cam = this.game.engine.camera.position;
    for (const s of this.sites) {
      const near = Math.hypot(cam.x - s.x, cam.z - s.z) < 120;
      s.m.visible = near;
      if (!near) { s.glint.visible = false; continue; }
      s.m.position.set(s.x, WATER_Y - 0.55 + lowK * 0.58, s.z);
      const fresh = this.low && done[s.id] !== lowId;
      s.glint.visible = fresh;
      if (fresh) { s.glint.position.set(s.x + 0.2, WATER_Y + 0.35 + Math.sin(t * 2 + s.ph) * 0.05, s.z); s.glint.material.opacity = 0.5 + Math.max(0, Math.sin(t * 3.1 + s.ph)) * 0.5; }
    }
  }
  siteNear(p = this.game.player.pos) { return this.sites.find((s) => Math.hypot(p.x - s.x, p.z - s.z) < 2.8) || null; }
  contextActions() {
    const g = this.game;
    if (!this.ow.atSea || g.player.mode !== 'shore' || this.ow.dive.on) return [];
    const s = this.siteNear();
    if (!s) return [];
    const lowId = lowTideId(dayIndex(), dayFraction());
    if (!this.low) return [{ id: 'pool', label: 'Rock pool (search at low tide)', fn: () => g.ui.toast(`It's ${this.name()} tide: the pool's under water. Low tide comes at dawn and dusk.`, { icon: 'waves' }) }];
    if (g.ext.d.ocean?.foraged?.[s.id] === lowId) return [];
    return [{ id: 'forage', label: 'Search the tide pool', color: 'gold', at: { x: s.x, z: s.z, y: WATER_Y + 0.2, h: 1.2 }, fn: () => this.forage(s, lowId) }];
  }
  async forage(s, lowId) {
    const g = this.game;
    g.ext.change((d) => { d.ocean.foraged = { ...(d.ocean.foraged || {}), [s.id]: lowId }; });
    g.player.faceToward?.(s.x, s.z);
    g.audio.sfx('dig');
    g.fx.splash(new THREE.Vector3(s.x, WATER_Y + 0.1, s.z), 0.4);
    const got = forageRoll(Math.random(), Math.random());
    g.ext.bump('tidePools');
    if (got.kind === 'pearl') {
      g.juice?.pop('A PEARL!', { color: '#f0f0ff', size: 36 });
      await g.reward('forage', `${lowId}-${s.id}`, { pearls: 1, xp: 20 }, 'Tide pool pearl');
      g.chat.system('You found a pearl in the tide pool, tucked inside an old oyster!', 'catch', { popup: true });
      return;
    }
    const key = got.kind === 'shell' ? 'shells' : 'glass', list = got.kind === 'shell' ? SHELLS : SEAGLASS;
    const had = g.ext.d.ocean?.beach?.[key]?.[got.id] || 0;
    g.ext.change((d) => { d.ocean.beach = d.ocean.beach || {}; d.ocean.beach[key] = { ...(d.ocean.beach[key] || {}), [got.id]: had + 1 }; });
    const coll = g.ext.d.ocean.beach[key], have = list.filter((x) => coll[x.id]).length;
    const label = got.kind === 'shell' ? got.name : `${got.name} sea glass`;
    g.ui.toast(`${had ? '' : 'New! '}${label}${had ? ` (you have ${had + 1})` : ''} · ${have}/${list.length} ${got.kind === 'shell' ? 'shells' : 'colours'}`, { icon: 'star', title: 'Tide pool', ms: 4200 });
    await g.reward('forage', `${lowId}-${s.id}`, { coins: 15, xp: 10 }, 'Tide pool');
    if (!had && have === list.length) {
      const id = got.kind === 'shell' ? 'ow_shells' : 'ow_glassjar';
      g.ext.change((d) => { d.home.owned = [...new Set([...(d.home.owned || []), id])]; if (!d.home.decor.includes(id)) d.home.decor.push(id); });
      g.audio.sfx('achievement');
      g.chat.system(got.kind === 'shell' ? 'All six shells! You\'ve framed them in a shadow box: find it on your cottage wall.' : 'Every colour of sea glass! You\'ve filled a jar with it: find it in your cottage.', 'catch', { popup: true });
      g.pushMeta?.();
    }
  }
}
