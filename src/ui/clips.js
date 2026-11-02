// Tutorial clips: short silent demos that pop up the first time you meet something, in place of a block of text. There are no
// video files (nothing binary goes in the artifact): each clip is a little scene the game plays live on its own small stage, with
// your own character in it. The world dims with a spotlight on the thing to watch, and the clip loops till you close it.
// The style guide is docs/tutorial-clips.md. A clip is { title, watch (CSS selector to spotlight), secs, meter?, captions, build(stage) }:
// build sets the scene and returns update(t, dt), with t running 0..secs; captions are [fromSecond, text].
import * as THREE from 'three';
import { Actor } from '../game/actor.js';
import { placeModels } from '../world/polyfork.js';
import { h } from './dom.js';
import { CLIPS, CLIP_GROUPS } from '../data/clips.js';
export { CLIPS, CLIP_GROUPS };

const W = 460, H = 270;

/** The small stage a clip plays on: its own scene, camera and lights. */
class Stage {
  constructor(canvas, game) {
    this.game = game; this.scene = new THREE.Scene(); this.camera = new THREE.PerspectiveCamera(38, W / H, 0.1, 200);
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'low-power' });
    this.renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1)); this.renderer.setSize(W, H, false);
  }
  model(m, x, z, ry = 0, s = 1) { const y = this.y || 0, g = new THREE.Group(); g.add(placeModels(`clip-${m}`, [{ m, x: 0, z: 0, y: 0, ry, s, solid: false }], { colliders: false })); g.position.set(x, y, z); this.scene.add(g); return g; }
  /** Your own character, in the given clothes. */
  person(look = {}) { const p = this.game.profile, a = new Actor(this.scene); a.setLook({ ...p.avatar, ...look }, p.equipped); a.dress = (o) => a.setLook({ ...p.avatar, ...o }, p.equipped); return a; }
  /** Stand or walk them this frame. */
  pose(a, dt, t, x, z, yaw, moving = false, o = {}) { a.update(dt, t, { x, y: 0, z, yaw, mode: 'shore', pose: 'idle', moving, rod: 'none', ...o }); if (a.rod) a.rod.visible = !!o.rod; }
  draw() { this.renderer.render(this.scene, this.camera); }
  dispose() { this.renderer.dispose(); this.renderer.forceContextLoss?.(); }
}

export class Clips {
  constructor(game) {
    this.game = game; this.open = null; this.rest = 0;
    const q = new URLSearchParams(location.search); this.skip = q.has('autoplay') || q.has('notutorial'); // (dev and the browser tests drive the game themselves)
    if (!this.skip) setInterval(() => this.watch(), 500);
  }
  /** Is it a good moment? Nothing on top, in the game, not mid-trip. */
  calm() { const g = this.game; return g.started && !document.querySelector('.title-screen, .loading') && !document.hidden && !this.open && !g.dialogue?.active && !g.ui?.sheets?.current && !document.querySelector('.ow-modal, .creator, .tut-welcome'); }
  /** Twice a second: the first clip whose moment has come. */
  watch() {
    const g = this.game; if (performance.now() < this.rest || !this.calm()) return;
    for (const [id, C] of Object.entries(CLIPS)) {
      if (!C.when || this.seen(id)) continue;
      let hit = false; try { hit = C.when(g); } catch { hit = false; }
      if (!hit) continue;
      if (C.fresh && (g.profile.catchCount || 0) > 0) { g.ext.change((d) => { d.clips = { ...(d.clips || {}), [id]: 1 }; }); continue; }
      this.play(id); return;
    }
  }
  get all() { return CLIPS; }
  seen(id) { return !!this.game.ext.d.clips?.[id]; }
  /** Play one: the first time it's met, or again on request (`force`). */
  play(id, { force = false } = {}) {
    const C = CLIPS[id]; if (!C || this.open || (!force && (this.seen(id) || this.skip))) return false;
    const g = this.game, canvas = h('canvas.clip-canvas', { width: W, height: H }), stage = new Stage(canvas, g), cap = h('div.clip-cap'), fill = h('div.clip-time-fill'), frost = h('div.clip-frost');
    const meter = C.meter ? h('div.clip-meter', h('span', C.meter.icon), h('div.clip-meter-bar', h('div.clip-meter-fill'))) : null;
    const close = h('button.btn.gold.small.clip-close', { on: { click: () => this.close() } }, 'Got it');
    const card = h('div.clip-card.plank', h('div.clip-title', C.title), h('div.clip-view', canvas, frost, meter), h('div.clip-time', fill), cap, close);
    const shade = h('div.clip-shade');
    const spot = C.watch && [...document.querySelectorAll(C.watch)].find((e) => e.offsetParent !== null);
    const ring = spot ? h('div.clip-spot') : null;
    if (spot) { const place = () => { const r = spot.getBoundingClientRect(), q = g.ui.root.getBoundingClientRect(); Object.assign(ring.style, { left: `${r.left - q.left - 7}px`, top: `${r.top - q.top - 7}px`, width: `${r.width + 14}px`, height: `${r.height + 14}px` }); }; place(); shade.classList.add('with-spot'); }
    g.ui.root.append(shade, ...(ring ? [ring] : []), card);
    const update = C.build(stage);
    const keys = (e) => { e.stopImmediatePropagation(); if (e.type === 'keydown' && ['Escape', 'Enter', ' ', 'e', 'E'].includes(e.key)) { e.preventDefault(); this.close(); } };
    addEventListener('keydown', keys, true);
    const fit = (t) => { let text = ''; for (const [at, s] of C.captions) if (t >= at) text = s; if (cap.textContent !== text) cap.textContent = text; };
    const t0 = performance.now(); let last = t0, run = true; void CLIP_GROUPS;
    const tick = () => {
      if (!run) return;
      const now = performance.now(), dt = Math.min(0.05, (now - last) / 1000), t = ((now - t0) / 1000) % C.secs; last = now;
      const st = update(t, dt) || {}; stage.draw();
      fill.style.width = `${(t / C.secs) * 100}%`; fit(t);
      if (meter) { const f = meter.querySelector('.clip-meter-fill'); f.style.width = `${st.meter ?? 100}%`; meter.classList.toggle('cold', st.meter < (C.meter.coldAt || 0)); meter.classList.toggle('hot', st.meter > (C.meter.hotAt || 101)); }
      frost.style.opacity = st.frost || 0;
      requestAnimationFrame(tick);
    };
    this.open = { id, stop: () => { run = false; removeEventListener('keydown', keys, true); stage.dispose(); for (const el of [shade, ring, card]) el?.remove(); } };
    g.ext.change((d) => { d.clips = { ...(d.clips || {}), [id]: 1 }; });
    tick();
    return true;
  }
  close() { this.open?.stop(); this.open = null; this.rest = performance.now() + 4000; }
}
