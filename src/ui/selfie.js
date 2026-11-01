// Selfie camera: swing the camera round to face your angler, pick a catch to hold up and a pose,
// then snap a polaroid. Photos land in a small album (this browser) and can be saved as PNGs.
import * as THREE from 'three';
import { h, clear, lb } from './dom.js';
import { icon } from './icons.js';
import { fishThumb } from './thumbs.js';
import { SPECIES_BY_ID, ZONES } from '../data/species.js';
import { regionName } from '../world/terrain.js';

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

const store = {
  get() { try { return JSON.parse(localStorage.getItem(ALBUM_KEY)) || []; } catch { return []; } },
  set(list) {
    for (let n = list.length; n > 0; n--) { // drop the oldest if the browser runs out of room
      try { localStorage.setItem(ALBUM_KEY, JSON.stringify(list.slice(-n))); return n; } catch { /* quota */ }
    }
    return 0;
  },
};
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
    this.buildOverlay(choices);
    g.audio.sfx('open');
  }

  stop() {
    if (!this.active) return;
    this.active = false;
    this.game.actor.clearHeld();
    this.overlay?.remove(); this.overlay = null;
    this.card?.remove(); this.card = null;
    this.game.ui.setVisible(true);
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
    if (this.nearT <= 0) { this.nearT = 1; if (this.refreshBar && this.friendsNear().length !== this.groupN) this.refreshBar(); }
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
    const bar = h('div.selfie-bar.plank',
      h('div.selfie-label', 'Hold up'), fishRow,
      h('div.selfie-label', 'Pose'), poseRow,
      h('div.selfie-actions',
        h('button.btn.ghost.small', { on: { click: () => this.stop() } }, 'Done'),
        h('button.btn.small', { on: { click: () => this.openAlbum() } }, 'Album'),
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
    };
    this.refreshBar();
    const drag = h('div.selfie-drag', { title: 'Drag to move the camera, scroll to zoom' });
    let last = null;
    drag.addEventListener('pointerdown', (e) => { last = { x: e.clientX, y: e.clientY }; drag.setPointerCapture?.(e.pointerId); });
    drag.addEventListener('pointermove', (e) => {
      if (!last) return;
      this.angle = Math.max(-1.3, Math.min(1.3, this.angle - (e.clientX - last.x) * 0.006));
      this.tilt = Math.max(-0.25, Math.min(0.9, this.tilt + (e.clientY - last.y) * 0.004));
      last = { x: e.clientX, y: e.clientY };
    });
    const end = () => { last = null; };
    drag.addEventListener('pointerup', end); drag.addEventListener('pointercancel', end);
    drag.addEventListener('wheel', (e) => { e.preventDefault(); this.dist = Math.max(2.2, Math.min(7, this.dist * (1 + Math.sign(e.deltaY) * 0.08))); }, { passive: false });
    this.overlay = h('div.selfie', drag, frame, h('div.selfie-tip', 'Drag to frame the shot · scroll to zoom · Space to snap'), bar);
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
    const line1 = sp ? `${who} & a ${v}${sp.name}` : crew.length ? `${who} & friends at ${where}` : `${who} at ${where}`;
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
    const shot = { id: Date.now().toString(36), url: pc.toDataURL('image/jpeg', 0.86), caption: `${line1}${withLine ? ` ${withLine}` : ''} — ${line2}`, ts: Date.now() };
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
