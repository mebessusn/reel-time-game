// Selfie camera: swing the camera round to face your angler, pick a catch to hold up and a pose,
// then snap a polaroid. Photos land in a small album (this browser) and can be saved as PNGs.
import * as THREE from 'three';
import { h, clear, lb } from './dom.js';
import { icon } from './icons.js';
import { fishThumb } from './thumbs.js';
import { SPECIES_BY_ID, ZONES } from '../data/species.js';
import { regionName, surfaceY, WATER_Y } from '../world/terrain.js';
import { aan } from '../core/text.js';
import { FILTERS, FILTER_BY_ID, filterCanvas, filterElement } from './photofilters.js';
import { addEvictor } from '../save/store.js';

// v1.17.15 photo mode: a free camera that leaves your angler where they stand (within FREE_R of them, never under the
// ground or the water), filters, and the camera's own controls hidden for a clean screen.
const FREE_R = 12; // how far the free camera's pivot may wander from you (m)
const FREE_D = [1.2, 14]; // how close and how far the free camera sits from its pivot
const FREE_PITCH = [-0.35, 1.45];

const ALBUM_KEY = 'rt_album';
const ALBUM_MAX = 12;
const PHOTO = 640; // px, square
const POSES = [
  { id: 'hold', label: 'Hold it up', needsFish: true },
  { id: 'idle', label: 'Smile' },
  { id: 'wave', label: 'Wave' },
  { id: 'cheer', label: 'Cheer' },
  { id: 'dance', label: 'Dance' },
  { id: 'shrug', label: 'Shrug' },
];

const ALBUM_BYTES = 1500000; // v1.17.18: the album never takes more than this, so the save always has room
const store = {
  get() { try { return JSON.parse(localStorage.getItem(ALBUM_KEY)) || []; } catch { return []; } },
  set(list) {
    for (let n = list.length; n > 0; n--) { // drop the oldest if it's over its share or the browser runs out of room
      const s = JSON.stringify(list.slice(-n));
      if (s.length > ALBUM_BYTES && n > 1) continue;
      try { localStorage.setItem(ALBUM_KEY, s); return n; } catch { /* quota */ }
    }
    try { localStorage.removeItem(ALBUM_KEY); } catch { /* ignore */ }
    return 0;
  },
};
// progress comes before photos: when a save write runs out of room, the oldest photo goes first (store.js)
addEvictor(() => { const l = store.get(); if (!l.length) return false; store.set(l.slice(1)); return 'your oldest photo'; });
export const album = {
  list: () => store.get(),
  add(photo) { const l = store.get(); l.push(photo); const kept = store.set(l.slice(-ALBUM_MAX)); return kept; },
  remove(id) { store.set(store.get().filter((p) => p.id !== id)); },
};

// The photo lives as a data: URL. The artifact's CSP blocks fetch() of data: URLs, so decode it by hand.
export function photoBlob(photo) {
  const [head, b64] = photo.url.split(',');
  const bin = atob(b64), bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], { type: (head.match(/data:([^;]+)/) || [])[1] || 'image/jpeg' });
}
const photoName = (photo) => `reel-time-${new Date(photo.ts).toISOString().slice(0, 10)}-${photo.id}.jpg`;

/** Save to the computer. Resolves 'saved', 'declined' (the viewer said no) or 'failed'. */
export async function savePhoto(photo) {
  let blob;
  try { blob = photoBlob(photo); } catch { return 'failed'; }
  const name = photoName(photo);
  const dl = await window.claude?.use?.('downloads').catch(() => null);
  if (dl) {
    try { await dl.save({ filename: name, data: blob }); return 'saved'; } catch (e) {
      if (/declin|cancel|denied|not_granted|abort/i.test(`${e?.code} ${e?.message}`)) return 'declined';
    }
  }
  try {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = name;
    document.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
    return 'saved';
  } catch { return 'failed'; }
}

/** Copy the photo to the clipboard, ready to paste into a post or chat. */
export async function copyPhoto(photo) {
  try {
    // Clipboards take PNG most widely: re-encode the JPEG through a canvas.
    const img = new Image(); img.src = photo.url; await img.decode();
    const cv = document.createElement('canvas'); cv.width = img.naturalWidth; cv.height = img.naturalHeight;
    cv.getContext('2d').drawImage(img, 0, 0);
    const png = await new Promise((r) => cv.toBlob(r, 'image/png'));
    await navigator.clipboard.write([new ClipboardItem({ 'image/png': png })]);
    return true;
  } catch { return false; }
}

/** The phone/OS share sheet, where the browser offers one for files. */
export const canSharePhoto = () => { try { return !!navigator.canShare?.({ files: [new File([''], 'x.jpg', { type: 'image/jpeg' })] }); } catch { return false; } };
export async function sharePhoto(photo) {
  try { await navigator.share({ files: [new File([photoBlob(photo)], photoName(photo), { type: 'image/jpeg' })], title: 'Reel Time', text: photo.caption }); return true; } catch { return false; }
}

/** Buttons for a photo, each giving its own feedback (sound, label change, flash) so it works with the HUD hidden. */
export function photoButtons(photo, game, { big = false } = {}) {
  const cls = big ? '' : '.small';
  const feedback = (btn, ok, okText, failText) => {
    game.audio.sfx(ok ? 'purchase' : 'miss');
    btn.classList.toggle('done', ok);
    const label = btn.querySelector('span') || btn;
    const was = btn.dataset.label || label.textContent; btn.dataset.label = was;
    label.textContent = ok ? okText : failText;
    if (ok) { const f = document.createElement('div'); f.className = 'save-flash'; document.body.append(f); setTimeout(() => f.remove(), 450); }
    clearTimeout(btn._t); btn._t = setTimeout(() => { label.textContent = was; btn.classList.remove('done'); }, 2600);
    game.ui.toast(ok ? okText : failText, { icon: ok ? 'check' : 'info', force: true });
  };
  const save = h(`button.btn.green${cls}`, { on: { click: async () => {
    save.disabled = true; game.audio.sfx('click');
    const r = await savePhoto(photo); save.disabled = false;
    feedback(save, r === 'saved', 'Saved to your computer', r === 'declined' ? 'Save cancelled' : "Couldn't save");
  } } }, icon('down'), h('span', 'Save'));
  const copy = h(`button.btn${cls}`, { on: { click: async () => feedback(copy, await copyPhoto(photo), 'Copied: paste it anywhere', "Couldn't copy") } }, icon('copy'), h('span', 'Copy'));
  const share = canSharePhoto() ? h(`button.btn${cls}`, { on: { click: async () => { if (await sharePhoto(photo)) game.audio.sfx('purchase'); } } }, icon('link'), h('span', 'Share')) : null;
  return [save, copy, share].filter(Boolean);
}

export class Selfie {
  constructor(game) {
    this.game = game;
    this.active = false;
    this.angle = 0; this.tilt = 0.08; this.dist = 3.3;
    this.pose = 'idle';
    this.fish = null;
    this.cam = new THREE.Vector3();
    // photo mode (v1.17.15)
    this.free = false; this.clean = false; this.filter = 'none';
    this.pivot = new THREE.Vector3(); this.fy = 0; this.fp = 0.3; this.fd = 4; this.held = new Set(); this.padMove = null;
  }

  fishChoices() {
    const g = this.game, out = [];
    const seen = new Set();
    const add = (c) => { if (!c || !SPECIES_BY_ID[c.speciesId]) return; const k = `${c.speciesId}|${c.variant}|${c.weight}`; if (seen.has(k)) return; seen.add(k); out.push(c); };
    add(g.lastCatch);
    for (const c of [...(g.profile.creel || [])].reverse()) add(c);
    for (const c of [...(g.profile.storage || [])].reverse()) add(c);
    return out.slice(0, 10);
  }

  start(withFish = undefined) {
    this.groupManual = false; // until you tap Group shot yourself, friends walking up are framed in
    const g = this.game;
    if (this.active) return;
    const st = g.fishing.state;
    if (['charge', 'flying', 'bite', 'reeling'].includes(st)) { g.ui.toast('Land this one first, then strike a pose!'); return; }
    if (st === 'waiting' || st === 'nibble') g.fishing.reelIn();
    g.ui.closeAll();
    this.active = true;
    this.angle = 0; this.tilt = 0.1; this.dist = 4.2;
    this.cam.copy(g.engine.camera.position);
    g.player.target = null; g.player.keys.clear();
    const choices = this.fishChoices();
    this.setFish(withFish === undefined ? choices[0] || null : withFish);
    this.pose = this.fish ? 'hold' : 'idle';
    g.ui.setVisible(false);
    this.free = false; this.clean = false; this.held.clear(); this.padMove = null;
    this.buildOverlay(choices);
    filterElement(g.engine.renderer.domElement, this.filter); // (the filter you last used stays picked)
    g.audio.sfx('open');
  }

  stop() {
    if (!this.active) return;
    this.active = false;
    this.game.actor.clearHeld();
    this.overlay?.remove(); this.overlay = null;
    this.card?.remove(); this.card = null;
    this.free = false; this.held.clear(); this.padMove = null;
    this.setClean(false);
    filterElement(this.game.engine.renderer.domElement, 'none');
    this.game.ui.setVisible(true);
  }

  // ---------------------------------------------------------------- photo mode (v1.17.15)
  /** Free camera on or off. It starts where the selfie camera is, looking at the same spot. */
  setFree(on) {
    if (!this.active || on === this.free) return;
    this.free = on; this.held.clear();
    if (on) {
      const g = this.game, head = g.actor.headWorld(new THREE.Vector3()), c = g.engine.camera.position;
      this.pivot.set(g.player.pos.x, head.y - 0.5, g.player.pos.z);
      const dx = c.x - this.pivot.x, dy = c.y - this.pivot.y, dz = c.z - this.pivot.z, d = Math.hypot(dx, dy, dz) || 4;
      this.fy = Math.atan2(dx, dz); this.fp = Math.asin(Math.max(-1, Math.min(1, dy / d))); this.fd = Math.max(FREE_D[0], Math.min(FREE_D[1], d));
      this.cam.copy(c);
    }
    this.game.audio.sfx('toggle');
    this.refreshBar?.();
  }
  setFilter(id) {
    if (!FILTER_BY_ID[id]) return;
    this.filter = id;
    filterElement(this.game.engine.renderer.domElement, id);
    this.game.audio.sfx('click');
    this.refreshBar?.();
  }
  stepFilter(d) { const i = FILTERS.findIndex((f) => f.id === this.filter); this.setFilter(FILTERS[(i + d + FILTERS.length) % FILTERS.length].id); }
  /** Hide the camera's own controls (and everything else on screen) for a clean view; any tap, H, X or B brings them back. */
  setClean(on) {
    this.clean = !!on;
    this.overlay?.classList.toggle('clean', this.clean);
    document.body.classList.toggle('photo-clean', this.clean);
  }
  /** Keys while the camera's up. True when the key was the camera's. */
  onKey(k, act, e) {
    if (this.card) return false;
    const MOVE = { w: 'f', arrowup: 'f', s: 'b', arrowdown: 'b', a: 'l', arrowleft: 'l', d: 'r', arrowright: 'r', q: 'dn', e: 'up' };
    const dir = { up: 'f', down: 'b', left: 'l', right: 'r' }[act] || MOVE[k];
    if (this.free && dir) { this.held.add(dir); e.preventDefault(); return true; }
    if (act === 'sprint') { this.fast = true; return true; }
    if (e.repeat) return !!dir;
    if (k === 'f') { this.setFree(!this.free); return true; }
    if (k === 'h') { this.setClean(!this.clean); return true; }
    if (k === 'g') { this.stepFilter(e.shiftKey ? -1 : 1); return true; }
    if (/^[1-9]$/.test(k) && FILTERS[+k - 1]) { this.setFilter(FILTERS[+k - 1].id); return true; }
    if (!this.free && dir === 'l') { this.angle = Math.max(-1.3, this.angle + 0.15); return true; }
    if (!this.free && dir === 'r') { this.angle = Math.min(1.3, this.angle - 0.15); return true; }
    return false;
  }
  onKeyUp(k, act) {
    const MOVE = { w: 'f', arrowup: 'f', s: 'b', arrowdown: 'b', a: 'l', arrowleft: 'l', d: 'r', arrowright: 'r', q: 'dn', e: 'up' };
    const dir = { up: 'f', down: 'b', left: 'l', right: 'r' }[act] || MOVE[k];
    if (dir) this.held.delete(dir);
    if (act === 'sprint') this.fast = false;
  }
  /** A controller while the camera's up (src/game/controls.js hands it over). */
  pad(p, { pressed, b, lx, ly, rx, ry }, dt) {
    if (pressed(1)) { if (this.clean) this.setClean(false); else this.stop(); return; }
    if (pressed(0)) { if (this.clean) this.setClean(false); this.snap(); return; }
    if (pressed(2)) this.setClean(!this.clean);
    if (pressed(3)) this.setFree(!this.free);
    if (pressed(4)) this.stepFilter(-1);
    if (pressed(5)) this.stepFilter(1);
    if (pressed(14) || pressed(15)) { const ok = POSES.filter((q) => !q.needsFish || this.fish), i = ok.findIndex((q) => q.id === this.pose); this.pose = ok[(i + (pressed(15) ? 1 : ok.length - 1)) % ok.length].id; this.refreshBar?.(); }
    const zoom = (p.buttons[6]?.value || 0) - (p.buttons[7]?.value || 0);
    if (this.free) {
      this.fy -= rx * dt * 2.2; this.fp = Math.max(FREE_PITCH[0], Math.min(FREE_PITCH[1], this.fp + ry * dt * 1.4));
      this.fd = Math.max(FREE_D[0], Math.min(FREE_D[1], this.fd * (1 + zoom * dt * 1.5)));
      this.padMove = { x: lx, z: ly, y: (b(12) ? 1 : 0) - (b(13) ? 1 : 0), fast: b(10) };
    } else {
      this.angle = Math.max(-1.3, Math.min(1.3, this.angle - (rx || lx) * dt * 1.8));
      this.tilt = Math.max(-0.25, Math.min(0.9, this.tilt + (ry || ly) * dt * 1.2));
      const z = zoom || ((b(13) ? 1 : 0) - (b(12) ? 1 : 0));
      this.dist = Math.max(2.2, Math.min(7, this.dist * (1 + z * dt * 1.5)));
    }
  }
  /** The lowest the free camera may go here: just over the ground, and over the water unless you're under it. */
  floorAt(x, z) {
    const gy = surfaceY(x, z), under = this.game.player.pos.y < WATER_Y - 0.5;
    return under ? (gy ?? -1e9) + 0.3 : Math.max(gy ?? WATER_Y, WATER_Y) + 0.3;
  }
  updateFree(dt) {
    const g = this.game, pl = g.player, cam = g.engine.camera, P = this.pivot;
    // move the pivot: keys (relative to where the camera looks), or the controller's left stick
    const H = this.held, M = this.padMove;
    let f = (H.has('f') ? 1 : 0) - (H.has('b') ? 1 : 0), r = (H.has('r') ? 1 : 0) - (H.has('l') ? 1 : 0), u = (H.has('up') ? 1 : 0) - (H.has('dn') ? 1 : 0);
    if (M) { f -= M.z; r += M.x; u += M.y; }
    const sp = (this.fast || M?.fast ? 9 : 4) * dt;
    if (f || r || u) {
      const sx = Math.sin(this.fy), cz = Math.cos(this.fy);
      P.x += (-sx * f + cz * r) * sp; P.z += (-cz * f - sx * r) * sp; P.y += u * sp * 0.7;
    }
    // stay near your angler, above the ground and not too high
    const dx = P.x - pl.pos.x, dz = P.z - pl.pos.z, d = Math.hypot(dx, dz);
    if (d > FREE_R) { P.x = pl.pos.x + dx / d * FREE_R; P.z = pl.pos.z + dz / d * FREE_R; }
    P.y = Math.max(this.floorAt(P.x, P.z) + 0.2, Math.min(pl.pos.y + 8, P.y));
    // the camera on its orbit, pulled in where the ground is between it and the pivot
    const want = new THREE.Vector3(P.x + Math.sin(this.fy) * Math.cos(this.fp) * this.fd, P.y + Math.sin(this.fp) * this.fd, P.z + Math.cos(this.fy) * Math.cos(this.fp) * this.fd);
    const N = 24;
    for (let i = 1; i <= N; i++) {
      const t = i / N, x = P.x + (want.x - P.x) * t, y = P.y + (want.y - P.y) * t, z = P.z + (want.z - P.z) * t;
      if (y < this.floorAt(x, z)) { const k = Math.max(0.05, (i - 1) / N); want.set(P.x + (want.x - P.x) * k, P.y + (want.y - P.y) * k, P.z + (want.z - P.z) * k); break; }
    }
    const fit = g.engine.camFit?.(P.x, P.y, P.z, want.x, want.y, want.z); // (inside a cave or a mine: its own walls)
    if (fit != null && fit < 1) want.set(P.x + (want.x - P.x) * fit, P.y + (want.y - P.y) * fit, P.z + (want.z - P.z) * fit);
    want.y = Math.max(want.y, this.floorAt(want.x, want.z));
    this.cam.lerp(want, Math.min(1, dt * 10));
    this.cam.y = Math.max(this.cam.y, this.floorAt(this.cam.x, this.cam.z));
    cam.position.copy(this.cam);
    cam.lookAt(P);
    cam.updateMatrixWorld();
  }
  tipText() {
    const pad = this.game.pads?.active, touch = matchMedia?.('(pointer: coarse)').matches;
    if (pad) return this.free ? 'Left stick to move · right stick to look · LT/RT zoom · D-pad up/down to rise · LB/RB filter · X hide · Y selfie camera · A snap'
      : 'Sticks to frame the shot · LT/RT zoom · LB/RB filter · X hide · Y free camera · A snap';
    if (touch) return this.free ? 'Drag to look round · pinch to zoom · two fingers to slide' : 'Drag to frame the shot · pinch to zoom';
    return this.free ? 'WASD to move · Q/E down and up · drag to look round · right-drag to slide · scroll to zoom · Space to snap · F selfie camera · G filter · H hide'
      : 'Drag to frame the shot · scroll to zoom · Space to snap · F free camera · G filter · H hide';
  }

  setFish(c) {
    this.fish = c;
    if (c) this.game.actor.showHeld(c.speciesId, c.variant, c.weight, 1e6);
    else this.game.actor.clearHeld();
    if (!c && this.pose === 'hold') this.pose = 'idle';
    this.refreshBar?.();
  }

  /** Friends close enough to be in a group shot. */
  friendsNear() {
    const g = this.game;
    return [...(g.remotes?.list?.values() || [])].filter((r) => r.peer.state && r.actor.root.visible && r.pos.distanceTo(g.player.pos) < 10);
  }

  // Camera in front of the angler, orbiting with drag, zooming with the wheel. In a group shot it frames
  // everyone nearby: aimed at the middle of the group and pulled back to fit them all in.
  updateCamera(dt) {
    // friends walking up (or away) light the group-shot button up as it happens
    this.nearT = (this.nearT || 0) - dt;
    if (this.nearT <= 0) { this.nearT = 1; if (this.refreshBar && this.friendsNear().length !== this.groupN) this.refreshBar(); if (this.tipEl && this.tipEl.textContent !== this.tipText()) this.tipEl.textContent = this.tipText(); }
    if (this.free) { this.updateFree(dt); return; }
    const g = this.game, pl = g.player, cam = g.engine.camera;
    const head = g.actor.headWorld(new THREE.Vector3());
    const yaw = pl.yaw + this.angle;
    const target = new THREE.Vector3(pl.pos.x, head.y - 0.55 + (this.pose === 'hold' && this.fish ? 0.25 : 0), pl.pos.z);
    let dist = this.dist;
    if (this.group) {
      const crew = this.friendsNear();
      if (crew.length) {
        let sx = pl.pos.x, sz = pl.pos.z, spread = 0;
        for (const r of crew) { sx += r.pos.x; sz += r.pos.z; }
        sx /= crew.length + 1; sz /= crew.length + 1;
        for (const p of [pl.pos, ...crew.map((r) => r.pos)]) spread = Math.max(spread, Math.hypot(p.x - sx, p.z - sz));
        target.x = sx; target.z = sz;
        dist = Math.max(this.dist, 3.4 + spread * 1.9);
      }
    }
    const want = new THREE.Vector3(
      target.x + Math.sin(yaw) * Math.cos(this.tilt) * dist,
      target.y + Math.sin(this.tilt) * dist + 0.1,
      target.z + Math.cos(yaw) * Math.cos(this.tilt) * dist);
    this.cam.lerp(want, this.cam.lengthSq() ? Math.min(1, dt * 6) : 1);
    cam.position.copy(this.cam);
    cam.lookAt(target);
  }

  buildOverlay(choices) {
    const g = this.game;
    const frame = h('div.selfie-frame');
    const fishRow = h('div.selfie-fish');
    const poseRow = h('div.selfie-poses');
    const snapBtn = h('button.btn.gold.selfie-snap', { on: { click: () => this.snap() } }, icon('camera'), 'Snap');
    // group shot: everyone nearby gets framed in, and their games tell them to smile
    const groupBtn = h('button.btn.small.selfie-group', { on: { click: () => {
      this.group = !this.group;
      this.groupManual = true;
      if (this.group) { g.netEvent('groupSelfie', { x: g.player.pos.x, z: g.player.pos.z }); g.audio.sfx('whistle'); }
      this.refreshBar();
    } } });
    this.group = this.friendsNear().length > 0; // with friends around, default to a group shot
    const camRow = h('div.selfie-poses.selfie-cams'), filterRow = h('div.selfie-poses.selfie-filters');
    const hideBtn = h('button.btn.small.selfie-hide', { title: 'Hide everything on screen (H). Tap, H or X to bring it back', on: { click: () => this.setClean(true) } }, icon('eye'), h('span', 'Hide'));
    const bar = h('div.selfie-bar.plank',
      h('div.selfie-label', 'Hold up'), fishRow,
      h('div.selfie-label', 'Pose'), poseRow,
      h('div.selfie-label', 'Camera'), camRow,
      h('div.selfie-label', 'Filter'), filterRow,
      h('div.selfie-actions',
        h('button.btn.ghost.small', { on: { click: () => this.stop() } }, 'Done'),
        h('button.btn.small', { on: { click: () => this.openAlbum() } }, 'Album'),
        hideBtn,
        groupBtn,
        snapBtn));
    this.refreshBar = () => {
      clear(fishRow).append(
        h(`button.selfie-chip${this.fish ? '' : '.on'}`, { title: 'No fish', on: { click: () => this.setFish(null) } }, '—'),
        ...choices.map((c) => h(`button.selfie-chip${this.fish === c ? '.on' : ''}`, { title: `${SPECIES_BY_ID[c.speciesId].name} · ${lb(c.weight)}`, on: { click: () => { this.setFish(c); this.pose = 'hold'; this.refreshBar(); } } }, h('img', { src: fishThumb(c.speciesId, c.variant) }))));
      if (!choices.length) fishRow.append(h('span.selfie-hint', 'Catch something to show it off!'));
      const n = this.friendsNear().length;
      // the group shot lives here in the camera: always shown, ready once a friend is close
      if (n === 0) this.group = false;
      else if (!this.groupManual && !this.group) { this.group = true; g.netEvent('groupSelfie', { x: g.player.pos.x, z: g.player.pos.z }); } // friends walked up: frame them in
      this.groupN = n;
      groupBtn.disabled = n === 0;
      groupBtn.title = n === 0 ? 'Stand close to friends to take a group shot' : 'Frame everyone nearby; their games tell them to smile';
      clear(groupBtn).append(icon('users'), h('span', n === 0 ? 'Group shot (nobody near)' : this.group ? `Group shot (${n + 1})` : `Group shot? ${n} near`));
      groupBtn.classList.toggle('gold', !!this.group);
      clear(poseRow).append(...POSES.map((p) => h(`button.btn.small${this.pose === p.id ? '.gold' : '.ghost'}`, { disabled: p.needsFish && !this.fish, on: { click: () => { this.pose = p.id; this.refreshBar(); } } }, p.label)));
      clear(camRow).append(
        h(`button.btn.small${this.free ? '.ghost' : '.gold'}`, { 'data-cam': 'selfie', on: { click: () => this.setFree(false) } }, 'Selfie'),
        h(`button.btn.small${this.free ? '.gold' : '.ghost'}`, { 'data-cam': 'free', title: 'Move the camera away from your angler (F)', on: { click: () => this.setFree(true) } }, 'Free camera'));
      clear(filterRow).append(...FILTERS.map((f, i) => h(`button.btn.small${this.filter === f.id ? '.gold' : '.ghost'}`, { 'data-filter': f.id, title: `${f.label} (${i + 1})`, on: { click: () => this.setFilter(f.id) } }, f.label)));
      if (this.tipEl) this.tipEl.textContent = this.tipText();
    };
    // Drag to orbit (selfie: round the front of your angler; free: anywhere), the wheel or a pinch to zoom, and in the free
    // camera a right-drag (or two fingers) to slide it about. With everything hidden, a tap brings it back.
    const drag = h('div.selfie-drag', { title: 'Drag to move the camera, scroll to zoom' });
    const pts = new Map(); let moved = 0, pan = false, pinch = 0;
    const mid = () => { const a = [...pts.values()]; return { x: a.reduce((s, q) => s + q.x, 0) / a.length, y: a.reduce((s, q) => s + q.y, 0) / a.length, d: a.length > 1 ? Math.hypot(a[0].x - a[1].x, a[0].y - a[1].y) : 0 }; };
    let last = null;
    const zoomBy = (k) => { if (this.free) this.fd = Math.max(FREE_D[0], Math.min(FREE_D[1], this.fd * k)); else this.dist = Math.max(2.2, Math.min(7, this.dist * k)); };
    drag.addEventListener('contextmenu', (e) => e.preventDefault());
    drag.addEventListener('pointerdown', (e) => {
      pts.set(e.pointerId, { x: e.clientX, y: e.clientY }); drag.setPointerCapture?.(e.pointerId);
      if (pts.size === 1) moved = 0;
      pan = e.button === 2 || e.shiftKey; last = mid(); pinch = last.d;
    });
    drag.addEventListener('pointermove', (e) => {
      if (!pts.has(e.pointerId)) return;
      pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
      const m = mid(), dx = m.x - last.x, dy = m.y - last.y; moved += Math.abs(dx) + Math.abs(dy);
      if (pts.size > 1 && pinch && m.d) { zoomBy(pinch / m.d); pinch = m.d; }
      if (this.free && (pan || pts.size > 1)) { // slide the pivot across the screen
        const k = this.fd * 0.0022, sx = Math.sin(this.fy), cz = Math.cos(this.fy);
        this.pivot.x += (-cz * dx - sx * dy) * k; this.pivot.z += (sx * dx - cz * dy) * k;
      } else if (this.free) {
        this.fy -= dx * 0.006; this.fp = Math.max(FREE_PITCH[0], Math.min(FREE_PITCH[1], this.fp + dy * 0.004));
      } else if (pts.size === 1) {
        this.angle = Math.max(-1.3, Math.min(1.3, this.angle - dx * 0.006));
        this.tilt = Math.max(-0.25, Math.min(0.9, this.tilt + dy * 0.004));
      }
      last = m;
    });
    const end = (e) => {
      pts.delete(e.pointerId); last = pts.size ? mid() : null; pinch = last?.d || 0;
      if (!pts.size && this.clean && moved < 6) this.setClean(false); // (a tap: show the controls again)
    };
    drag.addEventListener('pointerup', end); drag.addEventListener('pointercancel', end);
    drag.addEventListener('wheel', (e) => { e.preventDefault(); zoomBy(1 + Math.sign(e.deltaY) * 0.08); }, { passive: false });
    this.tipEl = h('div.selfie-tip');
    this.refreshBar();
    this.overlay = h('div.selfie', drag, frame, this.tipEl, bar);
    g.ui.root.append(this.overlay);
  }

  // Render the selfie camera view, crop the centre square, and print it on a polaroid.
  snap() {
    const g = this.game, eng = g.engine;
    const flash = h('div.selfie-flash');
    g.ui.root.append(flash);
    setTimeout(() => flash.remove(), 700);
    g.audio.sfx('click');
    eng.renderer.render(eng.scene, eng.camera);
    const src = eng.renderer.domElement;
    const s = Math.min(src.width, src.height);
    const photo = document.createElement('canvas');
    photo.width = photo.height = PHOTO;
    const p = photo.getContext('2d');
    p.drawImage(src, (src.width - s) / 2, (src.height - s) / 2, s, s, 0, 0, PHOTO, PHOTO);
    // instant-film look: warm lift, faded blacks, soft vignette
    p.globalCompositeOperation = 'soft-light'; p.fillStyle = 'rgba(255,190,120,0.35)'; p.fillRect(0, 0, PHOTO, PHOTO);
    p.globalCompositeOperation = 'lighten'; p.fillStyle = 'rgba(40,30,40,1)'; p.fillRect(0, 0, PHOTO, PHOTO);
    p.globalCompositeOperation = 'source-over';
    const vg = p.createRadialGradient(PHOTO / 2, PHOTO / 2, PHOTO * 0.35, PHOTO / 2, PHOTO / 2, PHOTO * 0.75);
    vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(30,15,0,0.38)');
    p.fillStyle = vg; p.fillRect(0, 0, PHOTO, PHOTO);
    filterCanvas(photo, this.filter); // v1.17.15 the filter you picked, the same sums as the live view
    // the polaroid
    // v1.8.2: everyone near you is in a group shot, and their names get a line of their own on the polaroid
    const crew = this.group ? this.friendsNear().map((r) => String(r.peer.meta?.name || r.name || 'a friend').slice(0, 18)) : [];
    const W = PHOTO + 64, H = PHOTO + 190 + (crew.length ? 40 : 0);
    const pc = document.createElement('canvas');
    pc.width = W; pc.height = H;
    const c = pc.getContext('2d');
    c.fillStyle = '#f7f3ea'; c.fillRect(0, 0, W, H);
    for (let i = 0; i < 900; i++) { c.fillStyle = `rgba(120,100,70,${Math.random() * 0.05})`; c.fillRect(Math.random() * W, Math.random() * H, 2, 2); }
    c.drawImage(photo, 32, 32);
    c.strokeStyle = 'rgba(0,0,0,0.12)'; c.lineWidth = 2; c.strokeRect(32, 32, PHOTO, PHOTO);
    const prof = g.profile;
    const f = this.fish, sp = f && SPECIES_BY_ID[f.speciesId];
    const v = f?.variant === 'diamond' ? 'Diamond ' : f?.variant === 'gold' ? 'Gold ' : '';
    const where = (f && ZONES[f.zone]?.name) || regionName(g.player.pos.x, g.player.pos.z) || 'Cozy Cove';
    const when = new Date();
    const who = prof.name;
    const line1 = sp ? `${who} & ${aan((v) + (sp.name))} ${v}${sp.name}` : crew.length ? `${who} & friends at ${where}` : `${who} at ${where}`;
    const withLine = crew.length ? `with ${crew.slice(0, 6).join(', ').replace(/, ([^,]*)$/, ' & $1')}${crew.length > 6 ? ` +${crew.length - 6}` : ''}` : '';
    const line2 = [sp ? lb(f.weight) : null, sp ? where : null, when.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })].filter(Boolean).join('  ·  ');
    c.fillStyle = '#2e3a6a';
    c.textAlign = 'center';
    c.font = 'italic 800 34px Nunito, "Segoe Print", "Comic Sans MS", cursive';
    c.fillText(line1, W / 2, PHOTO + 32 + 70, W - 60);
    const dy = withLine ? 40 : 0;
    if (withLine) { c.font = 'italic 700 26px Nunito, "Segoe Print", "Comic Sans MS", cursive'; c.fillText(withLine, W / 2, PHOTO + 32 + 108, W - 60); }
    c.font = '600 21px Nunito, system-ui, sans-serif';
    c.fillStyle = '#6a5a4a';
    c.fillText(line2, W / 2, PHOTO + 32 + 112 + dy, W - 60);
    c.font = '16px Silkscreen, monospace';
    c.fillStyle = '#b8a888';
    c.fillText('REEL TIME', W / 2, H - 22);
    const shot = { id: Date.now().toString(36), url: pc.toDataURL('image/jpeg', 0.86), caption: `${line1}${withLine ? ` ${withLine}` : ''} · ${line2}`, ts: Date.now() };
    if (this.group && crew.length) { g.netEvent('groupSelfie', { x: g.player.pos.x, z: g.player.pos.z, snap: 1 }); g.ext?.bump('groupSelfies'); }
    const kept = album.add(shot);
    this.showCard(shot, kept);
  }

  showCard(shot, kept) {
    this.card?.remove();
    // The developing photo takes the stage: hide the camera controls until it's put away.
    this.overlay?.classList.add('developing');
    const close = () => { this.card?.remove(); this.card = null; this.overlay?.classList.remove('developing'); };
    this.card = h('div.polaroid-card',
      h('img.polaroid', { src: shot.url, alt: shot.caption }),
      h('div.polaroid-actions',
        ...photoButtons(shot, this.game, { big: true }),
        h('button.btn.ghost', { on: { click: close } }, 'Take another'),
        h('button.btn', { on: { click: () => { close(); this.stop(); } } }, 'Done')),
      h('div.selfie-hint', kept ? 'Kept in your album (Journal > Photo album). Save or copy it to post it anywhere.' : 'Your album is full in this browser, so this one was not kept. Save it!'));
    this.game.ui.root.append(this.card);
    this.game.audio.sfx('reveal', { tier: 'rare' });
  }

  openAlbum() { this.stop(); this.game.ui.sheets.open('album'); }
}
