// Talking to a local (v1.9.3): a short cutscene. The camera eases round to frame the local over your
// shoulder, they turn to face you, and a dialogue box slides up at the bottom with their name, their words
// (typed out) and your choices. Pick one (click, 1/2/3, or Enter for the first) and you're back to normal.
// Escape leaves at any time.
import * as THREE from 'three';
import { h } from './dom.js';

const tmp = new THREE.Vector3();

export class Dialogue {
  constructor(game) {
    this.game = game;
    this.active = null;
    window.addEventListener('keydown', (e) => {
      if (!this.active) return;
      const k = e.key;
      if (k === 'Escape') { e.preventDefault(); e.stopImmediatePropagation(); this.close(null); return; }
      if (!this.typed) { if (k === 'Enter' || k === ' ' || k.toLowerCase() === 'e') { e.preventDefault(); e.stopImmediatePropagation(); this.finishTyping(); } return; }
      const i = k === 'Enter' || k.toLowerCase() === 'e' ? 0 : '123'.indexOf(k);
      if (i >= 0 && this.active.choices[i]) { e.preventDefault(); e.stopImmediatePropagation(); this.close(this.active.choices[i]); }
    }, true);
  }

  /**
   * npc: a local ({ name, pos, actor, yaw }); text: what they say; choices: [{ label, fn?, primary? }].
   * Resolves with the chosen choice (or null if you walked away with Escape).
   */
  open({ npc, title = '', text, choices = [{ label: 'Bye!' }] }) {
    if (this.active) this.close(null);
    const g = this.game;
    g.fishing.cancel?.();
    g.player.target = null; g.player.keys?.clear?.();
    g.audio.sfx('open');
    // they turn to you and stop what they're doing
    npc.yaw = Math.atan2(g.player.pos.x - npc.pos.x, g.player.pos.z - npc.pos.z);
    npc.target = null; npc.wait = 1e9; npc.talking = true;
    g.player.yaw = Math.atan2(npc.pos.x - g.player.pos.x, npc.pos.z - g.player.pos.z);
    const body = h('div.dlg-text');
    const btns = h('div.dlg-choices', choices.map((c, i) => h(`button.btn${c.primary ? '.gold' : '.ghost'}.dlg-choice`, { on: { click: () => this.close(c) } }, h('span.dlg-key', String(i + 1)), c.label)));
    const el = h('div.dlg.plank', { role: 'dialog', 'aria-label': `Talking to ${npc.name}` },
      h('div.dlg-head', h('span.dlg-name', npc.name), title ? h('span.dlg-title', title) : null, h('span.dlg-esc', 'Esc to leave')),
      body, btns);
    btns.classList.add('hidden');
    g.ui.root.append(el);
    document.body.classList.add('in-dialogue');
    let resolve;
    const done = new Promise((r) => { resolve = r; });
    this.active = { npc, el, body, btns, choices, resolve, text, t0: performance.now(), camFrom: g.engine.camera.position.clone(), lookFrom: g.engine.cam.target.clone(), k: 0 };
    this.typed = false;
    // type the words out, a few letters at a time
    let n = 0;
    const tick = () => {
      if (!this.active || this.active.el !== el) return;
      n = Math.min(text.length, n + 2);
      body.textContent = text.slice(0, n);
      if (n < text.length) { this.active.typer = setTimeout(tick, 22); if (n % 8 === 0) g.audio.sfx('tick'); }
      else this.finishTyping();
    };
    tick();
    return done;
  }

  finishTyping() {
    const a = this.active;
    if (!a) return;
    clearTimeout(a.typer);
    a.body.textContent = a.text;
    a.btns.classList.remove('hidden');
    this.typed = true;
    a.btns.querySelector('button')?.focus();
  }

  close(choice) {
    const a = this.active;
    if (!a) return;
    clearTimeout(a.typer);
    this.active = null;
    a.npc.talking = false; a.npc.wait = 2;
    a.el.classList.add('out');
    setTimeout(() => a.el.remove(), 180);
    document.body.classList.remove('in-dialogue');
    this.game.audio.sfx('close');
    this.game.engine.cam.yaw = this.restoreYaw ?? this.game.engine.cam.yaw;
    a.resolve(choice || null);
    if (choice?.fn) choice.fn();
  }

  /** The cutscene camera: over your shoulder, framing the local's face. */
  updateCamera(dt) {
    const a = this.active, g = this.game, cam = g.engine.camera;
    if (!a) return false;
    const p = g.player.pos, head = a.npc.actor.headWorld(tmp.clone());
    const dx = head.x - p.x, dz = head.z - p.z, d = Math.hypot(dx, dz) || 1, ux = dx / d, uz = dz / d;
    // behind you and a little to the right, a bit above head height
    const want = new THREE.Vector3(p.x - ux * 2.2 + uz * 1.15, head.y + 0.35, p.z - uz * 2.2 - ux * 1.15);
    a.k = Math.min(1, a.k + dt * 2.2);
    const e = a.k * a.k * (3 - 2 * a.k);
    cam.position.lerpVectors(a.camFrom, want, e);
    const look = new THREE.Vector3(head.x - ux * 0.3, head.y - 0.25, head.z - uz * 0.3);
    cam.lookAt(new THREE.Vector3().lerpVectors(a.lookFrom, look, e));
    this.restoreYaw = Math.atan2(-ux, -uz);
    return true;
  }
}
