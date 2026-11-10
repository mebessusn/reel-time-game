import { moveFocus, pressFocused, setKbNav } from '../ui/nav.js';
// Rebindable keys and controller support.
//
// Keyboard: every action has a default key; Settings > Controls lets you rebind any of them (saved per
// player). Movement keeps WASD/arrows as well as whatever you bind.
//
// Controller (standard mapping, e.g. Xbox/PlayStation): left stick moves/rows/steers, right stick turns the
// camera, A casts (hold) / hooks / reels, B cancels or closes, X uses what's nearby (E), Y opens the
// creel, LB hops (swims up), RB sprints (boosts, dives down), LB/RB angle the rod in a fight (the left stick
// works too), LT gets on or off your ride, RT is the first action another map adds (the crew call at sea), L3 sprints too, R3 stows the rod,
// D-pad up/down zooms, left the emotes, right the bait, Start pauses, Back/Select opens the map.
// The buttons that stand for an action (PAD_KEYS) press its bound key, so every map's own use of it works.
export const PAD_KEYS = { 4: 'jump', 5: 'sprint', 6: 'bike', 7: 'extra', 10: 'sprint', 11: 'rod' };
export const PAD_HELP = [
  ['Left stick', 'Move, row and steer'], ['Right stick', 'Camera'], ['A', 'Cast (hold), hook, reel; press in menus'],
  ['B', 'Back, close, cancel a cast'], ['X', 'Use what’s nearby'], ['Y', 'Inventory'], ['LB', 'Hop, swim up; rod left in a fight'],
  ['RB / L3', 'Sprint, boost, dive down; rod right in a fight'], ['LT', 'Get on or off your ride'], ['RT', () => ACTION_BY_ID[extraAction()]?.label || 'Nothing here'],
  ['R3', 'Stow rod'], ['D-pad', 'Zoom (up, down), emotes (left), bait (right); move in menus'], ['LB / RB in menus', 'Switch tabs'],
  ['Start', 'Pause menu'], ['Back / Select', 'Map'],
  ['In the camera', 'Sticks frame the shot, LT/RT zoom, LB/RB filter, X hide, Y free camera, A snap'],
];

export const ACTIONS = [
  { id: 'up', label: 'Move forward', key: 'w' },
  { id: 'down', label: 'Move back', key: 's' },
  { id: 'left', label: 'Move left / rod left', key: 'a' },
  { id: 'right', label: 'Move right / rod right', key: 'd' },
  { id: 'cast', label: 'Cast / hook / reel (hold)', key: 'k' },
  { id: 'interact', label: 'Use nearby (shop, boat, gear)', key: 'e' },
  { id: 'jump', label: 'Hop', key: ' ' },
  { id: 'sprint', label: 'Sprint', key: 'shift' },
  { id: 'creel', label: 'Inventory', key: 'c' },
  { id: 'tackle', label: 'Tackle box (rods, lures, boats)', key: 'g' },
  { id: 'pedia', label: 'Fishpedia', key: 'f' },
  { id: 'board', label: 'Notice board & quests', key: 'b' },
  { id: 'journal', label: 'Journal', key: 'j' },
  { id: 'map', label: 'Map', key: 'm' },
  { id: 'home', label: 'Your cabin', key: 'h' },
  { id: 'emotes', label: 'Emotes', key: 'r' },
  { id: 'rod', label: 'Stow rod', key: 't' },
  { id: 'selfie', label: 'Selfie camera', key: 'p' },
  { id: 'camLeft', label: 'Turn camera left', key: 'q' },
  { id: 'camRight', label: 'Turn camera right', key: 'x' },
  { id: 'bait', label: 'Switch bait', key: 'v' },
  { id: 'bike', label: 'Get on / off your ride', key: 'n' },
  { id: 'rideSwap', label: 'Swap between your rides', key: 'u' },
  { id: 'social', label: 'Friends & party', key: 'o' },
];
export const ACTION_BY_ID = Object.fromEntries(ACTIONS.map((a) => [a.id, a]));
const BASE_ACTIONS = ACTIONS.length;
/** The first action another map added (RT on a controller). */
export const extraAction = () => ACTIONS[BASE_ACTIONS]?.id || null;
/** Another map's own key actions ({ id, label, key }), handled by its keyDown hook. */
export function addActions(list) { for (const a of list) { ACTIONS.push(a); ACTION_BY_ID[a.id] = a; } }

export const keyName = (k) => (k === ' ' ? 'Space' : k === 'shift' ? 'Shift' : k.startsWith('arrow') ? `${k[5].toUpperCase()}${k.slice(6)} arrow` : k.length === 1 ? k.toUpperCase() : k[0].toUpperCase() + k.slice(1));

export class Keymap {
  constructor(ext) { this.ext = ext; this.rebuild(); }
  keyFor(id) { return (this.ext.d.keymap || {})[id] || ACTION_BY_ID[id]?.key; }
  rebuild() {
    this.byKey = new Map();
    for (const a of ACTIONS) this.byKey.set(this.keyFor(a.id), a.id);
  }
  /** Action for a key press (lowercase key). The movement arrows always work. */
  action(k) {
    if (k === 'arrowup') return 'up';
    if (k === 'arrowdown') return 'down';
    if (k === 'arrowleft') return 'left';
    if (k === 'arrowright') return 'right';
    return this.byKey.get(k) || null;
  }
  bind(id, k) {
    const reserved = ['escape', 'enter', '/', 'tab'];
    if (reserved.includes(k)) return 'That key is kept for menus and chat.';
    this.ext.change((d) => {
      d.keymap = d.keymap || {};
      // whoever had this key gets the old key of the action you're rebinding (a swap)
      const prevOwner = ACTIONS.find((a) => a.id !== id && this.keyFor(a.id) === k);
      if (prevOwner) d.keymap[prevOwner.id] = this.keyFor(id);
      d.keymap[id] = k;
    });
    this.rebuild();
    return null;
  }
  reset() { this.ext.change((d) => { d.keymap = {}; }); this.rebuild(); }
}

// ---------------------------------------------------------------- controller
const DEAD = 0.22;
const dz = (v) => (Math.abs(v) < DEAD ? 0 : (v - Math.sign(v) * DEAD) / (1 - DEAD));

// ---- haptics: what the fight feels like in the hands
// fightHaptic(strength 0..1, ms) is the one door: it rumbles the controller in use, and calls whatever a platform
// build has hooked in with setFightHaptic (the phone build's own haptics). Off when settings.vibration is false
// (there is no toggle in Settings yet, so it is on).
let padsInUse = null, hapticHook = null;
/** A platform's own haptics: fn(strength 0..1, ms). */
export function setFightHaptic(fn) { hapticHook = fn; }
export function fightHaptic(strength, ms = 120) {
  const k = Math.max(0, Math.min(1, +strength || 0));
  if (k < 0.03 || padsInUse?.game.profile?.settings?.vibration === false) return;
  try { hapticHook?.(k, ms); } catch { /* a platform's haptics must never break a fight */ }
  if (!padsInUse?.active) return; // (a controller lying on the desk stays still while you play with the mouse)
  try {
    const p = padsInUse.pad();
    p?.vibrationActuator?.playEffect?.('dual-rumble', { startDelay: 0, duration: ms, weakMagnitude: k, strongMagnitude: k * k })?.catch?.(() => {});
  } catch { /* no rumble on this controller or browser */ }
}

export class Gamepads {
  constructor(game) {
    padsInUse = this;
    this.game = game;
    this.prev = {};
    this.keysDown = new Set(); // actions a button is holding down
    this.connected = false;
    window.addEventListener('gamepadconnected', (e) => { this.connected = true; game.ui?.toast(`Controller connected: ${e.gamepad.id.split('(')[0].trim().slice(0, 30)}`, { icon: 'smile' }); });
    window.addEventListener('gamepaddisconnected', () => { this.connected = !!this.pad(); });
  }
  pad() { const list = navigator.getGamepads?.() || []; for (const p of list) if (p && p.connected) return p; return null; }

  update(dt) {
    const p = this.pad();
    const g = this.game;
    if (!p) { if (this.active) { g.player.stick = null; g.player.padDir = null; this.releaseKeys(); this.active = false; } return; }
    const b = (i) => !!p.buttons[i]?.pressed;
    const pressed = (i) => b(i) && !this.prev[i];
    const released = (i) => !b(i) && this.prev[i];
    const lx = dz(p.axes[0] || 0), ly = dz(p.axes[1] || 0), rx = dz(p.axes[2] || 0), ry = dz(p.axes[3] || 0);
    const any = lx || ly || rx || ry || p.buttons.some((x) => x.pressed);
    if (any) { this.active = true; g.player.touch(); g.audio.unlock(); }
    if (!this.active) return;
    const modal = g.ui.modalOpen || g.home?.active;
    if (any) setKbNav(true);
    // v1.17.15 photo mode has its own buttons (sticks frame the shot, A snaps, B backs out); its printed photo is an ordinary menu
    if (g.selfie?.active && !g.selfie.card && !g.menus?.open && !g.dialogue?.active) {
      g.player.stick = null; g.player.padDir = null; this.releaseKeys();
      g.selfie.pad(p, { pressed, b, lx, ly, rx, ry }, dt); this.save(p); return;
    }
    // B: back out of anything (the pause menu first, then panels)
    if (pressed(1)) {
      if (g.menus?.open) g.menus.close();
      else if (document.querySelector('.confirm-screen')) document.querySelector('.confirm-screen .btn.ghost')?.click();
      else if (g.home?.active) g.home.close();
      else if (modal) g.ui.closeAll();
      else if (g.fishing.state === 'charge') g.fishing.cancel();
      else if (g.fishing.state === 'waiting' || g.fishing.state === 'nibble') g.fishing.reelIn();
    }
    // Start: the pause menu
    if (pressed(9)) { if (g.menus?.open) g.menus.close(); else if (!modal && g.started) g.menus?.pause(); }
    if (modal) {
      g.player.padDir = null; this.releaseKeys();
      // menus: d-pad or the left stick move focus, A presses
      const stick = Math.abs(lx) > 0.6 || Math.abs(ly) > 0.6 ? (Math.abs(lx) > Math.abs(ly) ? (lx > 0 ? 'right' : 'left') : (ly > 0 ? 'down' : 'up')) : null;
      const dpad = pressed(12) ? 'up' : pressed(13) ? 'down' : pressed(14) ? 'left' : pressed(15) ? 'right' : null;
      const now = performance.now();
      if (dpad) moveFocus(dpad);
      else if (stick && (stick !== this.lastStick || now - this.stickT > 280)) { moveFocus(stick); this.stickT = now; }
      this.lastStick = stick;
      if (pressed(0)) pressFocused();
      if (pressed(4) || pressed(5)) { // bumpers flip tabs
        const tabs = [...(document.querySelector('.sheet .tabs')?.querySelectorAll('.tab') || [])];
        const i = tabs.findIndex((t) => t.classList.contains('on'));
        const next = tabs[(i + (pressed(5) ? 1 : tabs.length - 1)) % tabs.length];
        if (next) { next.click(); requestAnimationFrame(() => document.querySelector('.sheet .tab.on')?.focus()); }
      }
      this.save(p); return;
    }
    // movement (stick) and camera
    g.player.stick = (lx || ly) && g.fishing.state !== 'reeling' ? { x: lx, y: ly } : null;
    const dirs = new Set();
    if (g.fishing.state !== 'reeling') { if (ly < -0.35) dirs.add('up'); if (ly > 0.35) dirs.add('down'); if (lx < -0.35) dirs.add('left'); if (lx > 0.35) dirs.add('right'); }
    g.player.padDir = dirs.size ? dirs : null;
    // the buttons that stand for an action press its key (held while the button is)
    const fight = g.fishing.state === 'reeling', want = new Set();
    for (const [i, a] of Object.entries(PAD_KEYS)) {
      const id = a === 'extra' ? extraAction() : a;
      if (id && b(+i) && !(fight && (i === '4' || i === '5'))) want.add(id);
    }
    for (const id of this.keysDown) if (!want.has(id)) this.sendKey(id, false);
    for (const id of want) if (!this.keysDown.has(id)) this.sendKey(id, true);
    const cs = g.camFeel || { speed: 1, x: 1, y: 1 };
    g.engine.cam.yaw -= rx * dt * 2.4 * cs.speed * cs.x;
    g.engine.cam.pitch = Math.min(1.25, Math.max(-1.25, g.engine.cam.pitch + ry * dt * 1.4 * cs.speed * cs.y));
    // the rod in a fight: left stick or the bumpers
    if (g.fishing.state === 'reeling') {
      const aim = lx || (b(5) ? 1 : 0) - (b(4) ? 1 : 0);
      if (aim) g.rodAim = Math.max(-1, Math.min(1, aim));
    }
    // A: cast (hold), hook, reel
    if (pressed(0)) g.primaryDown(null);
    if (released(0)) g.primaryUp();
    if (pressed(2)) g.interact();
    if (pressed(3)) g.ui.sheets.open('creel');
    if (pressed(8)) g.ui.sheets.open('map');
    if (pressed(12)) g.engine.cam.zoom = Math.max(0.45, g.engine.cam.zoom * 0.9);
    if (pressed(13)) g.engine.cam.zoom = Math.min(2.2, g.engine.cam.zoom * 1.1);
    if (pressed(14)) g.ui.toggleWheel();
    if (pressed(15)) g.bait?.cycle();
    this.save(p);
  }
  save(p) { p.buttons.forEach((x, i) => { this.prev[i] = x.pressed; }); }
  /** Press or let go of an action's bound key, as if typed. */
  sendKey(id, down) {
    const k = this.game.keymap?.keyFor(id);
    if (down) this.keysDown.add(id); else this.keysDown.delete(id);
    if (k) window.dispatchEvent(new KeyboardEvent(down ? 'keydown' : 'keyup', { key: k === 'shift' ? 'Shift' : k }));
  }
  releaseKeys() { for (const id of [...this.keysDown]) this.sendKey(id, false); }
}
