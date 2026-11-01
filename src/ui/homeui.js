// The cabin screen: your room (or a friend's) with panels for decor, the aquarium and colours.
import { h, clear, fmt, lb } from './dom.js';
import { icon, iconURL } from './icons.js';
import { fishThumb } from './thumbs.js';
import * as THREE from 'three';
import { HomeScene, DECOR, WALLS, FLOORS, MOVABLE, WALL_ITEMS, ROOM, clampWall, clampFloor, homeLayout, sanitizeLayout, HOME_TIERS, tierNeeds } from '../game/home.js';
import { buildAvatar, animateAvatar } from '../entities/avatar2.js';
import { HOME_DOOR } from '../world/props.js';
import { SPECIES_BY_ID } from '../data/species.js';

const priceEl = (price) => h('span.price', h('img', { src: iconURL(price.coins ? 'coin' : 'pearl') }), fmt(price.coins || price.pearls));

export class HomeUI {
  constructor(game) {
    this.game = game;
    this.view = null;
    this.tab = 'decor';
    this.mode = 'walk';
    try { this.snap = !!localStorage.getItem('rt_home_snap'); } catch { this.snap = false; }
  }

  /** Walk in through the front door of your cottage. */
  enter() { this.open(null, { fromDoor: true }); }

  get active() { return !!this.view; }

  myLayout() { return homeLayout(this.game.ext.d, this.game.profile); }

  /** Open your own cabin, or a visiting friend's from their presence layout. */
  open(owner = null, { fromDoor = false } = {}) {
    const g = this.game;
    if (g.fishing.busy) { g.ui.toast('Finish this cast first.'); return; }
    this.close(true);
    g.ui.closeAll();
    const scene = this.scene || (this.scene = new HomeScene());
    const layout = owner ? sanitizeLayout(owner.layout) : sanitizeLayout(this.myLayout());
    if (!layout) { g.ui.toast('That cabin is closed right now.'); return; }
    // you, walking around inside
    if (scene.avatar) { scene.avatar.group.parent?.remove(scene.avatar.group); scene.avatar.dispose?.(); }
    scene.avatar = buildAvatar(g.profile.avatar);
    scene.build(layout);
    scene.resize(g.engine.width, g.engine.height);
    g.engine.overlay = scene;
    this.owner = owner;
    this.fromDoor = fromDoor;
    this.me = { x: scene.door.x + 0.9, z: scene.door.z, yaw: Math.PI / 2, seat: null, target: null, moving: false };
    scene.walkYaw = -Math.PI / 2 + 0.5; scene.walkPitch = 0.55;
    scene.onTick = (dt, t) => this.tick(dt, t);
    this.setMode('walk', true);
    this.buildPanel();
    this.bindOrbit();
    document.body.classList.add('in-home'); // v1.13.11: hides the outside world's names, feed and chat pop-ups
    g.audio.sfx('open');
    if (owner) { g.ext.bump('visits'); g.quests?.progress('visit', {}); g.netEvent('visit', { to: owner.id }); }
    else g.ext.bump('homeVisits');
  }

  close(silent = false) {
    if (!this.view) return;
    this.view.remove();
    this.view = null;
    document.body.classList.remove('in-home');
    this.hover = null;
    this.game.engine.renderer.domElement.style.cursor = '';
    this.game.engine.overlay = null;
    this.unbind?.();
    if (this.scene) this.scene.onTick = null;
    if (!silent) this.game.audio.sfx('close');
    // came in through the cottage door: step back out onto the porch
    if (this.fromDoor && !silent) {
      const pl = this.game.player;
      pl.pos.set(HOME_DOOR.x, pl.pos.y, HOME_DOOR.z - 0.6); pl.yaw = Math.PI; pl.target = null;
    }
  }

  setMode(mode, quiet = false) {
    this.mode = mode;
    if (this.scene) { this.scene.mode = mode; if (this.scene.avatar) this.scene.avatar.group.visible = mode === 'walk'; }
    this.view?.classList.toggle('editing', mode === 'edit');
    this.modeBtns?.forEach((b) => b.classList.toggle('on', b.dataset.mode === mode));
    if (this.hint) this.hint.textContent = mode === 'walk' ? 'WASD or click the floor to walk · drag, Q / E or the arrows to turn the camera · scroll to zoom · E to sit' : 'Hover a piece to highlight it, then click and drag to move it (wall pieces slide along the walls) · R turns it · arrows nudge · right-drag or Q / E turns the room · drag the floor to pan';
    this.selected = null;
    this.hover = null; this.refreshGlow();
    if (this.game.engine?.renderer) this.game.engine.renderer.domElement.style.cursor = '';
    this.renderPlace();
    if (!quiet) this.game.audio.sfx('page');
  }

  /** v1.10: on-screen camera controls (hold to turn), and a reset. */
  camBar() {
    const hold = (dir) => ({
      pointerdown: (e) => { e.preventDefault(); this.camSpin = dir; e.currentTarget.setPointerCapture?.(e.pointerId); },
      pointerup: () => { this.camSpin = 0; }, pointercancel: () => { this.camSpin = 0; }, lostpointercapture: () => { this.camSpin = 0; },
    });
    const reset = () => { const sc = this.scene; if (this.mode === 'walk') { sc.walkYaw = (this.me?.yaw ?? 0) + Math.PI; sc.walkPitch = 0.55; sc.walkDist = 4.6; } else { sc.yaw = 0.55; sc.pitch = 0.5; sc.dist = 15; sc.panX = 0; sc.panZ = 0; } this.game.audio.sfx('click'); };
    return h('div.home-cam.plank', { role: 'group', 'aria-label': 'Camera' },
      h('button.btn.ghost.on-dark.small', { 'aria-label': 'Turn camera left (Q)', title: 'Turn left (Q)', on: hold(1) }, icon('rotL')),
      h('button.btn.ghost.on-dark.small', { 'aria-label': 'Reset camera', title: 'Reset view', on: { click: reset } }, icon('target')),
      h('button.btn.ghost.on-dark.small', { 'aria-label': 'Turn camera right (E)', title: 'Turn right (E)', on: hold(-1) }, icon('rotR')));
  }

  // ---------------- walking around inside ----------------
  tick(dt, t) {
    if (!this.view || !this.scene?.avatar) return;
    const sc = this.scene, me = this.me, av = sc.avatar;
    const pl = this.game.player, km = this.game.keymap;
    let mx = 0, mz = 0;
    if (this.mode === 'walk' && !me.seat) {
      const held = (a) => [...this.keys].some((k) => km?.action(k) === a);
      const f = (held('up') ? 1 : 0) - (held('down') ? 1 : 0), r = (held('right') ? 1 : 0) - (held('left') ? 1 : 0);
      if (f || r) {
        me.target = null;
        const fx = -Math.sin(sc.walkYaw), fz = -Math.cos(sc.walkYaw);
        mx = fx * f - fz * r; mz = fz * f + fx * r;
      } else if (me.target) {
        const dx = me.target.x - me.x, dz = me.target.z - me.z, d = Math.hypot(dx, dz);
        if (d < 0.12) me.target = null; else { mx = dx / d; mz = dz / d; }
      }
    }
    // v1.10: Q / X (and the on-screen arrows) turn the camera in both views, seated too
    const held2 = (a) => [...this.keys].some((k) => km?.action(k) === a);
    // v1.12: Q / E turn the camera in here (X still works); E only sits you down when there's a seat to take
    const eTurn = this.keys.has('e') && (this.mode === 'edit' || (!me.seat && !this.actions().length));
    const spin = (held2('camLeft') ? 1 : 0) - (held2('camRight') || eTurn ? 1 : 0) + (this.camSpin || 0);
    if (spin) { if (this.mode === 'walk') sc.walkYaw += dt * 2 * spin; else sc.yaw += dt * 1.6 * spin; }
    const len = Math.hypot(mx, mz);
    me.moving = false;
    if (len > 0) {
      mx /= len; mz /= len;
      const step = 3.2 * dt;
      const nx = me.x + mx * step, nz = me.z + mz * step;
      if (sc.canStand(nx, nz)) { me.x = nx; me.z = nz; me.moving = true; }
      else if (sc.canStand(nx, me.z)) { me.x = nx; me.moving = true; }
      else if (sc.canStand(me.x, nz)) { me.z = nz; me.moving = true; }
      else me.target = null;
      let dy = Math.atan2(mx, mz) - me.yaw; dy = Math.atan2(Math.sin(dy), Math.cos(dy));
      me.yaw += dy * Math.min(1, dt * 10);
    }
    const hip = av.hip || 0.32;
    if (me.seat) {
      av.group.position.set(me.seat.x, me.seat.y + 0.02 - hip, me.seat.z);
      av.group.rotation.y = me.seat.yaw;
      animateAvatar(av, 'idle', t, { sitting: true, chair: -Math.acos(Math.min(0.95, Math.max(0.3, (me.seat.y + 0.02) / hip))) });
    } else {
      av.group.position.set(me.x, 0, me.z);
      av.group.rotation.y = me.yaw;
      animateAvatar(av, me.moving ? 'walk' : 'idle', t, {});
    }
    void pl;
    this.updatePrompt();
  }

  nearSeat() {
    const me = this.me;
    let best = null, bd = 1.3;
    for (const s of this.scene.seats || []) { const d = Math.hypot(s.x - me.x, s.z - me.z); if (d < bd) { best = s; bd = d; } }
    return best;
  }
  actions() {
    if (this.mode !== 'walk') return [];
    const me = this.me;
    if (me.seat) return [{ label: 'Stand up', fn: () => this.standUp() }];
    const acts = [];
    const s = this.nearSeat();
    if (s) acts.push({ label: s.label, fn: () => this.sitOn(s) });
    if (Math.hypot(this.scene.door.x - me.x, this.scene.door.z - me.z) < 1.4) acts.push({ label: this.owner ? 'Leave' : 'Go outside', fn: () => this.close() });
    return acts;
  }
  sitOn(s) { this.me.seat = s; this.me.target = null; this.game.audio.sfx('plop'); }
  standUp() {
    const s = this.me.seat; this.me.seat = null;
    const out = [[Math.sin(s.yaw) * 0.9, Math.cos(s.yaw) * 0.9], [0.9, 0], [-0.9, 0], [0, 0.9]].map(([dx, dz]) => ({ x: s.x + dx, z: s.z + dz })).find((p) => this.scene.canStand(p.x, p.z));
    if (out) { this.me.x = out.x; this.me.z = out.z; }
  }
  updatePrompt() {
    if (!this.prompt) return;
    const acts = this.actions();
    const key = acts.map((a) => a.label).join('|');
    if (key !== this.promptKey) {
      this.promptKey = key;
      clear(this.prompt);
      acts.forEach((a, i) => this.prompt.append(h(`button.prompt-btn${i === 0 ? '.main' : ''}`, { on: { click: () => a.fn() } }, i === 0 ? h('kbd', 'E') : null, h('span', a.label))));
      this.prompt.classList.toggle('hidden', !acts.length);
    }
    if (!acts.length) return;
    const av = this.scene.avatar.group.position;
    const v = new THREE.Vector3(av.x, 2.2, av.z).project(this.scene.camera);
    const g = this.game;
    this.prompt.style.left = `${Math.round((v.x * 0.5 + 0.5) * g.engine.width)}px`;
    this.prompt.style.top = `${Math.round((-v.y * 0.5 + 0.5) * g.engine.height)}px`;
  }

  bindOrbit() {
    const g = this.game;
    const el = g.engine.renderer.domElement;
    const sc = this.scene;
    const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
    const floorAt = (e) => {
      const r = el.getBoundingClientRect();
      ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
      ray.setFromCamera(ndc, sc.camera);
      const p = new THREE.Vector3();
      return ray.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), p) ? p : null;
    };
    // v1.13.7: where the pointer points on the back wall (0) or the left wall (1), for hanging pieces
    const wallAt = (e) => {
      floorAt(e);
      const cands = [];
      const pn = new THREE.Vector3(), pw = new THREE.Vector3();
      if (ray.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 0, 1), -ROOM.z0), pn) && pn.x >= ROOM.x0 && pn.x <= ROOM.x1 && pn.y >= 0 && pn.y <= 3.4) cands.push({ wall: 0, u: pn.x, y: pn.y, d: ray.ray.origin.distanceTo(pn) });
      if (ray.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(1, 0, 0), -ROOM.x0), pw) && pw.z >= ROOM.z0 && pw.z <= ROOM.z1 && pw.y >= 0 && pw.y <= 3.4) cands.push({ wall: 1, u: pw.z, y: pw.y, d: ray.ray.origin.distanceTo(pw) });
      if (cands.length) return cands.sort((a, b) => a.d - b.d)[0];
      const f = floorAt(e); if (!f) return null;
      // pointing at the floor: slide along whichever wall is nearer
      return f.z - ROOM.z0 < f.x - ROOM.x0 ? { wall: 0, u: f.x, y: null } : { wall: 1, u: f.z, y: null };
    };
    let drag = null;
    this.keys = new Set();
    const down = (e) => {
      if (!this.view) return;
      const hit = floorAt(e);
      drag = { x: e.clientX, y: e.clientY, button: e.button, moved: false, hit };
      if (this.mode === 'edit' && e.button === 0 && hit && !this.owner) {
        // grab the piece of furniture under the pointer
        const hits = ray.intersectObjects(Object.values(sc.items || {}), true);
        let o = hits[0]?.object; while (o && !o.userData.decorId) o = o.parent;
        if (o && o.userData.wall != null) {
          const w = wallAt(e);
          drag.item = o; drag.wallOff = w && w.wall === o.userData.wall ? { u: o.userData.u - w.u, y: w.y == null ? 0 : o.userData.y - w.y } : { u: 0, y: 0 };
          this.select(o.userData.decorId); this.setHover(o); el.style.cursor = 'grabbing'; el.setPointerCapture?.(e.pointerId);
        } else if (o) { drag.item = o; drag.off = { x: o.position.x - hit.x, z: o.position.z - hit.z }; this.select(o.userData.decorId); this.setHover(o); el.style.cursor = 'grabbing'; el.setPointerCapture?.(e.pointerId); }
        else { drag.pan = { x: sc.panX || 0, z: sc.panZ || 0 }; drag.deselect = true; }
      }
    };
    // v1.12: what's under the pointer in the editor (a piece of furniture, or nothing)
    const itemAt = (e) => {
      if (this.mode !== 'edit' || this.owner || !floorAt(e)) return null;
      const hits = ray.intersectObjects(Object.values(sc.items || {}), true);
      let o = hits[0]?.object; while (o && !o.userData.decorId) o = o.parent;
      return o || null;
    };
    const move = (e) => {
      if (!this.view) return;
      if (!drag) {
        if (e.target !== el) { this.setHover(null); return; }
        const o = itemAt(e);
        this.setHover(o);
        el.style.cursor = o ? 'grab' : '';
        return;
      }
      const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
      if (Math.hypot(dx, dy) > 4) drag.moved = true;
      if (drag.item && drag.item.userData.wall != null) {
        const w = wallAt(e); if (!w) return;
        const it = drag.item, same = w.wall === it.userData.wall;
        const sn = (v) => (this.snap ? Math.round(v * 4) / 4 : v);
        const u = sn(w.u + (same ? drag.wallOff.u : 0)), y = w.y == null ? it.userData.y : sn(w.y + (same ? drag.wallOff.y : 0));
        if (!same) drag.wallOff = { u: 0, y: 0 };
        this.placeWallItem(it, clampWall(it.userData.decorId, w.wall, u, y));
        return;
      }
      if (drag.item) {
        const p = floorAt(e); if (!p) return;
        const m = MOVABLE[drag.item.userData.decorId];
        const snap = (v) => (this.snap ? Math.round(v / 0.25) * 0.25 : v);
        [drag.item.position.x, drag.item.position.z] = this.clampXZ(m, drag.item.rotation.y, snap(p.x + drag.off.x), snap(p.z + drag.off.z));
        this.syncPlace();
        return;
      }
      if (drag.pan && drag.moved) {
        // pan along the floor, in the direction you drag
        const k = sc.dist * 0.0016;
        const cx = Math.cos(sc.yaw), sx = Math.sin(sc.yaw);
        sc.panX = Math.max(-4, Math.min(sc.tier >= 1 ? 9 : 4, drag.pan.x - (dx * cx + dy * sx) * k)); // (v1.17.1: over to the den, in a Cottage)
        sc.panZ = Math.max(-3.5, Math.min(3.5, drag.pan.z - (-dx * sx + dy * cx) * k));
        return;
      }
      // walking: drag with any button to look around (a plain click still walks you there)
      if ((this.mode === 'walk' && drag.moved) || drag.button === 2 || (this.mode === 'edit' && drag.button !== 0)) {
        if (this.mode === 'walk') { sc.walkYaw -= (e.clientX - (drag.lx ?? drag.x)) * 0.008; sc.walkPitch = Math.max(0.12, Math.min(1.25, sc.walkPitch + (e.clientY - (drag.ly ?? drag.y)) * 0.004)); }
        else { sc.yaw -= (e.clientX - (drag.lx ?? drag.x)) * 0.006; sc.pitch = Math.max(0.15, Math.min(1.25, sc.pitch + (e.clientY - (drag.ly ?? drag.y)) * 0.004)); }
        drag.lx = e.clientX; drag.ly = e.clientY;
      }
    };
    const up = (e) => {
      if (!drag) return;
      if (drag.item) { if (drag.moved) this.saveItem(drag.item); el.style.cursor = 'grab'; }
      else if (drag.deselect && !drag.moved && e.button === 0) this.select(null);
      else if (this.mode === 'walk' && drag.button === 0 && !drag.moved && drag.hit && !this.me.seat) this.me.target = { x: drag.hit.x, z: drag.hit.z };
      drag = null;
    };
    const wheel = (e) => { if (!this.view) return; e.preventDefault?.(); if (this.mode === 'edit') sc.dist = Math.max(6, Math.min(22, sc.dist * (1 + Math.sign(e.deltaY) * 0.08))); else sc.walkDist = Math.max(1.8, Math.min(7.5, (sc.walkDist ?? 4.6) * (1 + Math.sign(e.deltaY) * 0.1))); };
    const ctx = (e) => { if (this.view) e.preventDefault(); };
    const kd = (e) => {
      if (!this.view || e.target instanceof HTMLInputElement) return;
      const k = e.key.toLowerCase();
      this.keys.add(k);
      const act = g.keymap?.action(k);
      if (act === 'interact' && !e.repeat && this.mode === 'walk') { const a = this.actions()[0]; if (a) { e.stopPropagation(); a.fn(); } }
      if (k === 'e' && this.mode === 'edit') { e.preventDefault(); e.stopPropagation(); }
      if (this.mode === 'walk' && this.me.seat && ['up', 'down', 'left', 'right'].includes(act)) this.standUp();
      if (this.mode === 'edit' && this.selected && sc.items[this.selected]) {
        // v1.10: fine placement. R / Shift+R turns 15°, the arrow keys nudge 10 cm (Shift: 50 cm), Delete puts it away
        if (k === 'r') { e.preventDefault(); e.stopPropagation(); this.turnItem(e.shiftKey ? -15 : 15); }
        const dir = { arrowup: [0, -1], arrowdown: [0, 1], arrowleft: [-1, 0], arrowright: [1, 0] }[k];
        if (dir) { e.preventDefault(); e.stopPropagation(); this.nudgeItem(dir[0], dir[1], e.shiftKey ? 0.5 : 0.1); }
        if (k === 'escape') { e.preventDefault(); e.stopPropagation(); this.select(null); }
      }
    };
    const ku = (e) => this.keys.delete(e.key.toLowerCase());
    const blur = () => this.keys.clear();
    el.addEventListener('pointerdown', down); window.addEventListener('pointermove', move); window.addEventListener('pointerup', up); el.addEventListener('wheel', wheel, { passive: false }); el.addEventListener('contextmenu', ctx);
    window.addEventListener('keydown', kd, true); window.addEventListener('keyup', ku); window.addEventListener('blur', blur);
    this.unbind = () => { el.removeEventListener('pointerdown', down); window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); el.removeEventListener('wheel', wheel); el.removeEventListener('contextmenu', ctx); window.removeEventListener('keydown', kd, true); window.removeEventListener('keyup', ku); window.removeEventListener('blur', blur); };
  }

  // ---------------- v1.10: fine furniture placement ----------------
  /** Keeps a piece inside the room, allowing for how it's turned. */
  clampXZ(m, r, x, z) {
    const c = Math.abs(Math.cos(r)), sn = Math.abs(Math.sin(r));
    const hw = (c * m.size[0] + sn * m.size[1]) / 2, hd = (sn * m.size[0] + c * m.size[1]) / 2;
    return clampFloor(x, z, hw, hd, this.scene?.tier || 0); // (v1.17.1: the main room, or the den you've dragged it into)
  }
  /** v1.12: a warm glow on the piece under the pointer (and a softer one on the piece you've picked). Each piece
   * gets its own copies of its materials the first time, so pieces that share a material don't light up together. */
  glow(o, k) {
    if (!o) return;
    if (!o.userData.ownMats) {
      o.traverse((m) => { if (m.isMesh && m.material) m.material = Array.isArray(m.material) ? m.material.map((x) => x.clone()) : m.material.clone(); });
      o.userData.ownMats = true;
    }
    o.traverse((m) => {
      if (!m.isMesh) return;
      for (const mat of Array.isArray(m.material) ? m.material : [m.material]) {
        if (!mat?.emissive) continue;
        if (mat.userData.baseEm == null) mat.userData.baseEm = mat.emissive.getHex();
        if (k > 0) mat.emissive.setRGB(0.55 * k, 0.4 * k, 0.12 * k); else mat.emissive.setHex(mat.userData.baseEm);
      }
    });
  }
  refreshGlow() {
    const items = this.scene?.items || {};
    for (const o of Object.values(items)) {
      const k = o === this.hover ? 1 : o.userData.decorId === this.selected ? 0.55 : 0;
      if (k !== (o.userData.glowK || 0)) { this.glow(o, k); o.userData.glowK = k; }
    }
  }
  setHover(o) {
    if (o === this.hover) return;
    this.hover = o;
    this.refreshGlow();
  }
  select(id) {
    this.selected = id;
    queueMicrotask(() => this.refreshGlow());
    this.game.audio.sfx(id ? 'click' : 'page');
    this.renderPlace();
  }
  item() { return this.selected ? this.scene?.items?.[this.selected] : null; }
  /** v1.13.7: hang a wall piece at [wall, along, height]. */
  placeWallItem(it, [wall, u, y]) {
    if (wall === 1) { it.position.set(ROOM.x0, y, u); it.rotation.y = Math.PI / 2; } else { it.position.set(u, y, ROOM.z0); it.rotation.y = 0; }
    it.userData.wall = wall; it.userData.u = u; it.userData.y = y;
    this.syncPlace();
  }
  isWall(it = this.item()) { return !!it && it.userData.wall != null; }
  /** Nudge along the screen's directions (so "up" is always away from you, however the room is turned). */
  nudgeItem(dx, dz, step) {
    const it = this.item(); if (!it) return;
    if (this.isWall(it)) {
      // on a wall: left/right slide along it (as you see it), up/down raise and lower it
      const d = it.userData.wall === 1 ? -dx : dx;
      this.placeWallItem(it, clampWall(this.selected, it.userData.wall, it.userData.u + d * step, it.userData.y - dz * step, false));
      this.commitSoon(it);
      return;
    }
    const yaw = this.scene.yaw, c = Math.cos(yaw), sn = Math.sin(yaw);
    const wx = dx * c + dz * sn, wz = -dx * sn + dz * c;
    // move along whichever world axis is closest, so a nudge never drifts diagonally
    const ax = Math.abs(wx) >= Math.abs(wz);
    const m = MOVABLE[this.selected];
    const nx = ax ? Math.round((it.position.x + Math.sign(wx) * step) * 100) / 100 : it.position.x, nz = ax ? it.position.z : Math.round((it.position.z + Math.sign(wz) * step) * 100) / 100;
    [it.position.x, it.position.z] = this.clampXZ(m, it.rotation.y, nx, nz);
    this.commitSoon(it);
  }
  turnItem(deg, abs = false) {
    const it = this.item(); if (!it || this.isWall(it)) return;
    let a = abs ? deg : Math.round(it.rotation.y * 180 / Math.PI) + deg;
    a = ((Math.round(a) % 360) + 360) % 360;
    it.rotation.y = a * Math.PI / 180;
    const m = MOVABLE[this.selected];
    [it.position.x, it.position.z] = this.clampXZ(m, it.rotation.y, it.position.x, it.position.z);
    this.commitSoon(it);
  }
  setItemPos(axis, v) {
    const it = this.item(); if (!it || !Number.isFinite(v)) return;
    if (this.isWall(it)) {
      const d = it.userData;
      this.placeWallItem(it, clampWall(this.selected, d.wall, axis === 'x' ? v : d.u, axis === 'z' ? v : d.y, false));
      this.commitSoon(it);
      return;
    }
    [it.position.x, it.position.z] = this.clampXZ(MOVABLE[this.selected], it.rotation.y, axis === 'x' ? v : it.position.x, axis === 'z' ? v : it.position.z);
    this.commitSoon(it);
  }
  commitSoon(it) {
    this.syncPlace();
    clearTimeout(this.commitT);
    this.commitT = setTimeout(() => { if (this.view && it.parent) this.saveItem(it, true); }, 320);
  }
  /** A soft ring on the floor under the piece you've picked. */
  syncPlace() {
    const sc = this.scene, it = this.item();
    if (!sc) return;
    if (!this.ring) {
      this.ring = new THREE.Mesh(new THREE.RingGeometry(0.92, 1, 48), new THREE.MeshBasicMaterial({ color: '#f2c040', transparent: true, opacity: 0.85, depthWrite: false }));
      this.ring.rotation.x = -Math.PI / 2; this.ring.renderOrder = 3;
    }
    if (!it || this.mode !== 'edit' || this.isWall(it)) { this.ring.parent?.remove(this.ring); }
    else {
      if (this.ring.parent !== sc.scene) sc.scene.add(this.ring);
      const m = MOVABLE[this.selected], r = Math.max(m.size[0], m.size[1]) * 0.62 + 0.15;
      this.ring.scale.setScalar(r); this.ring.position.set(it.position.x, 0.06, it.position.z);
    }
    const P = this.placeEls;
    if (P && it && this.isWall(it)) { P.x.value = it.userData.u.toFixed(2); P.z.value = it.userData.y.toFixed(2); }
    else if (P && it) {
      P.x.value = it.position.x.toFixed(2); P.z.value = it.position.z.toFixed(2);
      const deg = Math.round(it.rotation.y * 180 / Math.PI) % 360;
      P.rot.value = String((deg + 360) % 360); P.deg.textContent = `${(deg + 360) % 360}°`;
    }
  }
  renderPlace() {
    const box = this.placeBox;
    if (!box) return;
    clear(box);
    this.placeEls = null;
    const it = this.item();
    box.hidden = !(it && this.mode === 'edit');
    this.syncPlace();
    if (box.hidden) return;
    const name = DECOR[this.selected]?.name || this.selected;
    if (this.isWall(it)) {
      const num2 = (axis, label) => h('input.place-num', { type: 'number', step: '0.05', 'aria-label': `${label} (metres)`, on: { change: (e) => this.setItemPos(axis, parseFloat(e.target.value)) } });
      const nb2 = (ic, label, fn) => h('button.btn.ghost.small.place-nudge', { 'aria-label': label, title: label, on: { click: fn } }, icon(ic));
      const along = num2('x', 'Along the wall'), height = num2('z', 'Height');
      this.placeEls = { x: along, z: height };
      box.append(
        h('div.place-head', h('b', name), h('button.btn.ghost.small', { 'aria-label': 'Done', on: { click: () => this.select(null) } }, icon('check'), 'Done')),
        h('div.place-row', h('span.place-lbl', 'Move'),
          h('div.place-pad', nb2('up', 'Raise (↑)', () => this.nudgeItem(0, -1, 0.1)), h('div', nb2('left', 'Slide left (←)', () => this.nudgeItem(-1, 0, 0.1)), nb2('right', 'Slide right (→)', () => this.nudgeItem(1, 0, 0.1))), nb2('down', 'Lower (↓)', () => this.nudgeItem(0, 1, 0.1))),
          h('div.place-xyz', h('label', 'Along', along), h('label', 'Height', height))),
        h('div.place-row.place-opts',
          h('label.place-snap', h('input', { type: 'checkbox', checked: !!this.snap, on: { change: (e) => { this.snap = e.target.checked; try { localStorage.setItem('rt_home_snap', this.snap ? '1' : ''); } catch { /* ignore */ } this.renderPlace(); } } }), 'Snap to grid (25 cm)'),
          h('button.btn.ghost.small', { on: { click: () => { const it2 = this.item(); this.placeWallItem(it2, WALL_ITEMS[this.selected].at); this.commitSoon(it2); } } }, icon('undo'), 'Reset')),
        h('div.place-keys.muted', 'Drag it onto the back or left wall · arrow keys slide and raise it (Shift for 50 cm) · Esc to deselect'));
      this.syncPlace();
      return;
    }
    const num = (axis) => h('input.place-num', { type: 'number', step: '0.05', 'aria-label': `${axis.toUpperCase()} position (metres)`, on: { change: (e) => this.setItemPos(axis, parseFloat(e.target.value)) } });
    const nb = (ic, label, fn) => h('button.btn.ghost.small.place-nudge', { 'aria-label': label, title: label, on: { click: fn } }, icon(ic));
    const x = num('x'), z = num('z');
    const rot = h('input.place-rot', { type: 'range', min: '0', max: '359', step: this.snap ? '15' : '1', 'aria-label': 'Rotation (degrees)', on: { input: (e) => this.turnItem(+e.target.value, true) } });
    const deg = h('span.place-deg');
    this.placeEls = { x, z, rot, deg };
    box.append(
      h('div.place-head', h('b', name), h('button.btn.ghost.small', { 'aria-label': 'Done', on: { click: () => this.select(null) } }, icon('check'), 'Done')),
      h('div.place-row', h('span.place-lbl', 'Move'),
        h('div.place-pad', nb('up', 'Nudge away (↑)', () => this.nudgeItem(0, -1, 0.1)), h('div', nb('left', 'Nudge left (←)', () => this.nudgeItem(-1, 0, 0.1)), nb('right', 'Nudge right (→)', () => this.nudgeItem(1, 0, 0.1))), nb('down', 'Nudge closer (↓)', () => this.nudgeItem(0, 1, 0.1))),
        h('div.place-xyz', h('label', 'X', x), h('label', 'Z', z))),
      h('div.place-row', h('span.place-lbl', 'Turn'),
        nb('rotL', 'Turn left 15° (Shift+R)', () => this.turnItem(-15)), rot, nb('rotR', 'Turn right 15° (R)', () => this.turnItem(15)), deg),
      h('div.place-row.place-opts',
        h('label.place-snap', h('input', { type: 'checkbox', checked: !!this.snap, on: { change: (e) => { this.snap = e.target.checked; try { localStorage.setItem('rt_home_snap', this.snap ? '1' : ''); } catch { /* ignore */ } this.renderPlace(); } } }), 'Snap to grid (25 cm, 15°)'),
        h('button.btn.ghost.small', { on: { click: () => { const m = MOVABLE[this.selected], it2 = this.item(); it2.position.set(m.at[0], 0, m.at[1]); it2.rotation.y = m.at[2] || 0; this.commitSoon(it2); } } }, icon('undo'), 'Reset')),
      h('div.place-keys.muted', 'Arrow keys nudge (Shift for 50 cm) · R / Shift+R turn · Esc to deselect'));
    this.syncPlace();
  }

  saveItem(it, quiet = false) {
    const id = it.userData.decorId;
    const v = it.userData.wall != null ? [it.userData.wall, +it.userData.u.toFixed(2), +it.userData.y.toFixed(2)] : [+it.position.x.toFixed(2), +it.position.z.toFixed(2), +it.rotation.y.toFixed(3)];
    this.game.ext.change((x) => { x.home.pos = x.home.pos || {}; x.home.pos[id] = v; });
    if (!quiet) this.game.audio.sfx('plop');
    this.rebuild();
  }

  rebuild() {
    if (!this.view || this.owner) return;
    this.scene.build(sanitizeLayout(this.myLayout()));
    this.hover = null; this.refreshGlow(); // (fresh pieces: re-light the one you've picked)
    this.game.pushMeta();
    this.renderBody();
    if (this.selected && !this.scene.items?.[this.selected]) this.selected = null;
    this.renderPlace();
  }

  buildPanel() {
    const g = this.game;
    const mine = !this.owner;
    this.body = h('div.home-body');
    this.tabs = h('div.tabs');
    const modeBtn = (mode, label, ic) => h(`button.seg-btn${this.mode === mode ? '.on' : ''}`, { 'data-mode': mode, on: { click: () => this.setMode(mode) } }, icon(ic), label);
    this.modeBtns = mine ? [modeBtn('walk', 'Walk', 'user'), modeBtn('edit', 'Editor', 'sliders')] : [];
    this.hint = h('div.home-hint');
    this.prompt = h('div.context-btn.home-prompt.hidden');
    this.view = h('div.home-ui',
      h('div.home-head.plank', icon('home'), h('b', mine ? 'Your cottage' : `${this.owner.name}'s cottage`),
        mine ? h('div.home-modes', this.modeBtns) : null,
        h('button.btn.small', { 'aria-label': 'Leave', on: { click: () => this.close() } }, icon('exit'), 'Leave')),
      this.hint, this.prompt, this.camBar(), (this.placeBox = h('div.home-place.plank', { hidden: true })),
      mine ? h('div.home-panel.plank', this.tabs, this.body) : h('div.home-panel.plank', h('div.muted', `You're visiting ${this.owner.name}. Drag to look around.`), this.visitBody()));
    g.ui.root.append(this.view);
    this.setMode(this.mode, true);
    if (mine) this.renderBody();
  }

  visitBody() {
    const L = sanitizeLayout(this.owner.layout);
    return h('div.home-visit',
      h('div.meta', `${L.t.length} fish in the tank · ${L.d.length} pieces of decor`),
      h('div.home-fish', L.t.map((f) => h('img', { src: fishThumb(f.speciesId, f.variant), title: SPECIES_BY_ID[f.speciesId].name }))),
      h('button.btn.green.small', { on: { click: () => { this.game.chat?.command?.(`/w ${this.owner.name} I love your cabin!`); this.game.ui.toast('Compliment sent.'); } } }, 'Leave a compliment'));
  }

  renderBody() {
    const g = this.game, d = g.ext.d;
    clear(this.tabs); clear(this.body);
    for (const [id, label] of [['decor', 'Decor'], ['tank', 'Aquarium'], ['style', 'Colours'], ['grow', 'Bigger home'], ['visit', 'Visit']]) {
      this.tabs.append(h(`button.tab${this.tab === id ? '.on' : ''}`, { on: { click: () => { this.tab = id; g.audio.sfx('page'); this.renderBody(); } } }, label));
    }
    const B = this.body;
    if (this.tab === 'decor') {
      B.append(h('div.muted', g.nearCabin() ? 'Gus delivers right to your door.' : 'Decor is bought from Gus. You can place what you own from anywhere.'));
      B.append(h('div.row-list', Object.entries(DECOR).map(([id, it]) => {
        const owned = d.home.decor.includes(id) || (d.home.owned || []).includes(id);
        const placed = d.home.decor.includes(id);
        let btn;
        if (owned) btn = h(`button.btn.small${placed ? '' : '.green'}`, { on: { click: () => { g.ext.change((x) => { x.home.decor = placed ? x.home.decor.filter((k) => k !== id) : [...x.home.decor, id]; x.home.owned = [...new Set([...(x.home.owned || []), id])]; }); this.rebuild(); } } }, placed ? 'Put away' : 'Place');
        else if (it.earned) btn = h('span.muted', it.how ? 'Not earned yet' : 'Complete the collection');
        else if ((it.tier || 0) > (d.home.tier || 0)) btn = h('button.btn.small', { on: { click: () => { this.tab = 'grow'; this.renderBody(); } } }, `Needs the ${HOME_TIERS[it.tier].name}`);
        else btn = h('button.btn.gold.small', { on: { click: () => this.buyDecor(id) } }, 'Buy');
        return h('div.list-row', h('div.grow', h('div.ttl', it.name), h('div.meta', it.desc || (it.earned ? it.how || 'Earned from a lake collection' : '')), owned || it.earned ? null : priceEl(it.price)), btn);
      })));
    } else if (this.tab === 'tank') {
      const cap = d.home.decor.includes('tank2') ? 8 : 4;
      B.append(h('div.muted', `Pick up to ${cap} fish from your backpack and storage to swim in your tank. They stay yours (they are copies, so you can still sell the originals).`));
      const inTank = new Set(d.home.tank.map((f) => f.id));
      const all = [...g.profile.creel, ...g.profile.storage].filter((c) => !SPECIES_BY_ID[c.speciesId]?.shell); // v1.12: shellfish stay out of the aquarium
      const seen = new Set();
      const uniq = all.filter((c) => { const k = `${c.speciesId}|${c.variant}`; if (seen.has(k) && !inTank.has(c.id)) return false; seen.add(k); return true; }).slice(0, 60);
      if (!uniq.length) B.append(h('div.empty', 'Keep a fish or two first!'));
      B.append(h('div.home-pick', uniq.map((c) => h(`button.home-fishbtn${inTank.has(c.id) ? '.on' : ''}`, {
        title: `${g.traits?.label(c) || SPECIES_BY_ID[c.speciesId].name} · ${lb(c.weight)}`,
        on: { click: () => {
          g.ext.change((x) => {
            if (inTank.has(c.id)) x.home.tank = x.home.tank.filter((f) => f.id !== c.id);
            else if (x.home.tank.length < cap) x.home.tank = [...x.home.tank, { id: c.id, speciesId: c.speciesId, variant: c.variant, weight: c.weight }];
            else g.ui.toast(`The tank holds ${cap}. Take one out first${cap === 4 ? ', or buy the Bigger Aquarium' : ''}.`);
          });
          this.rebuild();
        } },
      }, h('img', { src: fishThumb(c.speciesId, c.variant) })))));
    } else if (this.tab === 'style') {
      B.append(h('div.section-title', 'Walls'), h('div.chooser', Object.entries(WALLS).map(([id, col]) => h(`button${d.home.wall === id ? '.on' : ''}`, { style: { borderBottom: `6px solid ${col}` }, on: { click: () => { g.ext.change((x) => { x.home.wall = id; }); this.rebuild(); } } }, id))));
      B.append(h('div.section-title', 'Floor'), h('div.chooser', Object.entries(FLOORS).map(([id, col]) => h(`button${d.home.floor === id ? '.on' : ''}`, { style: { borderBottom: `6px solid ${col}` }, on: { click: () => { g.ext.change((x) => { x.home.floor = id; }); this.rebuild(); } } }, id))));
    } else if (this.tab === 'grow') {
      // v1.17.1: bigger homes. The next tier up: what it adds, what it needs, and the price (coins, or pearls instead)
      const cur = d.home.tier || 0, next = HOME_TIERS[cur + 1];
      B.append(h('div.muted', `Your home: the ${HOME_TIERS[cur].name}.`));
      if (!next) B.append(h('div.empty', 'This is the biggest home there is for now. The Lodge and the Lakehouse are on their way.'));
      else {
        const needs = tierNeeds(cur + 1, g.profile, d), ok = !needs.length;
        const tick = (done, text) => h(`div.home-need${done ? '.done' : ''}`, icon(done ? 'check' : 'lock'), text);
        B.append(h('div.home-tier',
          h('div.ttl', `The ${next.name}`), h('div.meta', next.desc),
          tick((g.profile.level || 1) >= next.level, `Level ${next.level}`),
          tick(Object.keys(d.collections || {}).length >= next.collections, `${next.collections} lake collections (Fishpedia, Collections)`),
          h('div.home-buy',
            h('button.btn.gold.small', { disabled: !ok, on: { click: () => this.buyTier(cur + 1, next.price) } }, 'Build it for ', priceEl(next.price)),
            h('button.btn.small', { disabled: !ok, title: 'Pearls can stand in for the coins (never for the level or the collections)', on: { click: () => this.buyTier(cur + 1, next.alt) } }, 'or ', priceEl(next.alt))),
          ok ? null : h('div.meta', `Still to do: ${needs.join('; ')}.`)));
      }
    } else if (this.tab === 'visit') {
      const peers = [...(g.net?.peers?.values?.() || [])].filter((p) => p.meta?.home);
      B.append(h('div.muted', 'Anglers on the lake right now. Their cabins are open while they play.'));
      if (!peers.length) B.append(h('div.empty', 'Nobody else is on the lake right now.'));
      B.append(h('div.row-list', peers.map((p) => h('div.list-row', h('div.grow', h('div.ttl', p.meta.name || 'Angler'), h('div.meta', `${p.meta.home.t?.length || 0} fish in the tank`)),
        h('button.btn.blue.small', { on: { click: () => this.open({ id: p.id, name: p.meta.name || 'Angler', layout: p.meta.home }) } }, 'Visit')))));
    }
  }

  /** v1.17.1: build the next home tier (the level and the collections are checked again here, not just on the button). */
  async buyTier(tier, price) {
    const g = this.game, T = HOME_TIERS[tier], d = g.ext.d;
    if (!T || (d.home.tier || 0) !== tier - 1 || tierNeeds(tier, g.profile, d).length) return;
    const r = await g.save.spend('home', T.id, price);
    if (!r.ok) { g.ui.toast(price.pearls ? 'Not enough pearls yet.' : 'Not enough coins yet.'); return; }
    g.ext.change((x) => { x.home.tier = tier; });
    g.audio.sfx('purchase');
    g.ui.toast(`Your ${T.name} is built! Walk through the new doorway in the east wall.`, { icon: 'home', title: 'Bigger home', ms: 5000 });
    g.ext.bump('homeTier');
    this.rebuild();
  }

  async buyDecor(id) {
    const g = this.game, it = DECOR[id];
    if ((it.tier || 0) > (g.ext.d.home.tier || 0)) return;
    const r = await g.save.spend('decor', id, it.price);
    if (!r.ok) { g.ui.toast(r.reason || 'Not enough yet.'); return; }
    g.ext.change((x) => { x.home.owned = [...new Set([...(x.home.owned || []), id])]; if (!x.home.decor.includes(id)) x.home.decor.push(id); });
    g.audio.sfx('purchase');
    g.ui.toast(`${it.name} delivered!`, { icon: 'home' });
    g.ext.bump('decorBought');
    this.rebuild();
  }
}
