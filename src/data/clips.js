// The tutorial clips (played by src/ui/clips.js; the style guide and the list are in docs/tutorial-clips.md). Each is a small scene
// on a fixed stage: `when` says when it first plays (asked twice a second, by src/ui/clips.js), `captions` are [second, text], and
// `build` sets the stage and returns update(t, dt). `fresh` means only a brand-new angler needs it.
import * as THREE from 'three';
import { WATER_Y, JETTIES } from '../world/terrain.js';
import { buildFish } from '../entities/fish.js';
import { buildBoat } from '../entities/gear.js';

export const lerp = (a, b, k) => a + (b - a) * Math.max(0, Math.min(1, k));
export const span = (t, a, b) => Math.max(0, Math.min(1, (t - a) / (b - a)));
export const Q = Math.PI / 2, LAND = 1.05;
export const dist = (g, q) => Math.hypot(g.player.pos.x - q.x, g.player.pos.z - q.z);

// ---------------------------------------------------------------- the stage kit
const ENV = {
  summer: { sky: '#a9d8ee', ground: '#7fb868', hemi: 2.1 }, beach: { sky: '#a9dcf0', ground: '#e8d8a4', hemi: 2.2 }, dusk: { sky: '#d8a888', ground: '#6a8a58', hemi: 1.5 },
  snow: { sky: '#b9d0e4', ground: '#e9f1f8', hemi: 2.4 }, ice: { sky: '#c4dcec', ground: '#bcd9ea', hemi: 2.4 }, sea: { sky: '#9fd4ee', ground: null, hemi: 2.2 },
  under: { sky: '#1c6a88', ground: '#c8bc88', hemi: 1.8, fog: [5, 24] }, hall: { sky: '#2e6a70', ground: '#a89a84', hemi: 2 }, mine: { sky: '#17120e', ground: '#4a4238', hemi: 1.5, fog: [5, 16] },
  inside: { sky: '#3a2a1e', ground: '#8a5e38', hemi: 2.2 },
};
export function env(S, name, { shore = null, y = 0, cam = [0, 2.3, 6.8, 0, 0.95, 0] } = {}) {
  const E = ENV[name], sc = S.scene; S.y = y;
  sc.background = new THREE.Color(E.sky); sc.fog = new THREE.Fog(E.sky, ...(E.fog || [12, 28]));
  sc.add(new THREE.HemisphereLight('#f2f7ff', '#b0b8a8', E.hemi)); const sun = new THREE.DirectionalLight('#fff4e0', 1.3); sun.position.set(-4, 8, 6); sc.add(sun);
  const plane = (col, cx, w, py) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, 60), new THREE.MeshLambertMaterial({ color: col })); m.rotation.x = -Math.PI / 2; m.position.set(cx, py, 0); sc.add(m); return m; };
  if (shore != null || !E.ground) S.water = plane('#3a90bc', (shore ?? -30) + 30, 60, WATER_Y);
  if (E.ground) plane(E.ground, (shore ?? 30) - 30, 60, y);
  S.camera.position.set(cam[0], cam[1] + y, cam[2]); S.camera.lookAt(cam[3], cam[4] + y, cam[5]);
}
/** A walk through time: keys are [second, x, z, extras], and they stand still between keys at the same spot. */
export function track(S, a, keys, base = {}) {
  let yaw = 0; keys.forEach((k, i) => { const n = keys[i + 1], o = k[3] || {}; if (o.yaw != null) yaw = o.yaw; else if (n && (n[1] !== k[1] || n[2] !== k[2])) yaw = Math.atan2(n[1] - k[1], n[2] - k[2]); k.yaw = yaw; });
  return (t, dt) => {
    let i = 0; while (i < keys.length - 1 && t >= keys[i + 1][0]) i++;
    const k = keys[i], n = keys[i + 1] || k, u = n === k ? 0 : span(t, k[0], n[0]), moved = n[1] !== k[1] || n[2] !== k[2], x = lerp(k[1], n[1], u), z = lerp(k[2], n[2], u);
    S.pose(a, dt, t, x, z, k.yaw, moved, { y: S.y, ...base, ...(k[3] || {}) });
    return { x, z, moving: moved, k };
  };
}
export const mesh = (S, geo, col, x, y, z, basic = true) => { const m = new THREE.Mesh(geo, basic ? new THREE.MeshBasicMaterial({ color: col }) : new THREE.MeshLambertMaterial({ color: col })); m.position.set(x, y, z); S.scene.add(m); return m; };
export const bobber = (S) => mesh(S, new THREE.SphereGeometry(0.12, 12, 10), '#e23a2e', 0, 0, 0);
export const ring = (S, col = '#ffffff') => { const m = mesh(S, new THREE.RingGeometry(0.3, 0.42, 24), col, 0, WATER_Y + 0.02, 0); m.rotation.x = -Math.PI / 2; m.material.transparent = true; m.material.side = THREE.DoubleSide; return m; };
export const ripple = (m, k) => { m.visible = k > 0 && k < 1; m.scale.setScalar(1 + k * 2.4); m.material.opacity = 1 - k; };
export const fish = (S, id = 'bluegill', s = 1) => { const o = buildFish(id, 'normal'); o.scale.multiplyScalar(s); S.scene.add(o); return o; };
export function word(S, text, col = '#ffd27a', size = 0.9) {
  const c = document.createElement('canvas'); c.width = 256; c.height = 128; const x = c.getContext('2d'); x.font = '900 72px "Baloo 2", Nunito, sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.lineWidth = 10; x.strokeStyle = 'rgba(20,30,40,0.85)'; x.strokeText(text, 128, 66); x.fillStyle = col; x.fillText(text, 128, 66);
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), transparent: true, depthTest: false })); sp.scale.set(size * 2, size, 1); S.scene.add(sp); return sp;
}
export function snow(S, n = 240) {
  const wide = 14, pos = new Float32Array(n * 3); for (let i = 0; i < n * 3; i += 3) { pos[i] = (Math.random() - 0.5) * wide; pos[i + 1] = Math.random() * 7; pos[i + 2] = (Math.random() - 0.5) * wide; }
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  S.scene.add(new THREE.Points(geo, new THREE.PointsMaterial({ color: '#ffffff', size: 0.07, transparent: true, opacity: 0.9, depthWrite: false })));
  return (dt) => { for (let i = 0; i < n * 3; i += 3) { pos[i + 1] -= dt * 1.1; pos[i] -= dt * 0.5; if (pos[i + 1] < 0) { pos[i + 1] = 7; pos[i] = (Math.random() - 0.5) * wide; } } geo.attributes.position.needsUpdate = true; };
}
export function fire(S, x, z) {
  const y = S.y, outer = mesh(S, new THREE.ConeGeometry(0.34, 0.95, 7), '#ff9a30', x, y + 0.6, z), inner = mesh(S, new THREE.ConeGeometry(0.19, 0.6, 7), '#ffd060', x, y + 0.5, z);
  const light = new THREE.PointLight('#ffa860', 9, 8, 1.6); light.position.set(x, y + 1.1, z); S.scene.add(light);
  return (t) => { outer.scale.y = 1 + Math.sin(t * 19) * 0.13; inner.scale.y = 1 + Math.sin(t * 26 + 1) * 0.16; outer.rotation.y = t * 3; light.intensity = 8.4 + Math.sin(t * 13) * 1.4; };
}

export const BARE = { shirt: 'tee', hat: 'none', accessory: 'none', shoes: 'sneakers' };

export const CLIP_GROUPS = [['Five Lakes', ['cast','hook','reel','boats','schools','waystones','cookout','cabin','quests','timed']]];

export const CLIPS = {
  // ================================================================ the Five Lakes
  cast: {
    title: 'Casting', secs: 8, fresh: true, meter: { icon: '🎣' }, captions: [[0, 'Hold to power up'], [2.6, 'Let go near the top'], [4.2, 'Now wait for a bite']],
    when: (g) => g.player.onDock || (g.tutorial.active && g.tutorial.i === 2),
    build(S) {
      env(S, 'summer', { shore: 1, y: LAND }); const a = S.person(), go = track(S, a, [[0, -1, 0, { yaw: Q, rod: 'hand', pose: 'charge' }], [2.6, -1, 0, { yaw: Q, rod: 'hand', pose: 'cast' }], [3.2, -1, 0, { yaw: Q, rod: 'hand', pose: 'wait' }]]), b = bobber(S), r = ring(S);
      S.model('trail-signpost', -3.4, -2);
      return (t, dt) => { go(t, dt); const k = span(t, 2.6, 4); b.visible = t > 2.6; b.position.set(lerp(-0.5, 3.2, k), lerp(LAND + 1.4, WATER_Y, k) + Math.sin(k * Math.PI) * 1.8 + (k >= 1 ? Math.sin(t * 3) * 0.03 : 0), 0); r.position.x = 3.2; ripple(r, span(t, 4, 5.2)); return { meter: t < 2.6 ? lerp(4, 94, t / 2.6) : lerp(94, 0, span(t, 2.6, 3)) }; };
    },
  },
  hook: {
    title: 'Hook it', secs: 7, fresh: true, captions: [[0, 'Watch the bobber'], [2.4, 'It dips, and a "!" pops up'], [3.6, 'Click fast!']],
    when: (g) => g.fishing.state === 'waiting',
    build(S) {
      env(S, 'summer', { shore: 1, y: LAND }); const a = S.person(), go = track(S, a, [[0, -1, 0, { yaw: Q, rod: 'hand', pose: 'wait' }], [2.4, -1, 0, { yaw: Q, rod: 'hand', pose: 'bite' }], [4, -1, 0, { yaw: Q, rod: 'hand', pose: 'reel' }]]), b = bobber(S), r = ring(S), mark = word(S, '!', '#ffd27a', 1.1); r.position.x = 2.8;
      return (t, dt) => { go(t, dt); const dip = t > 2.4 && t < 4 ? 0.2 + Math.sin(t * 16) * 0.08 : 0; b.position.set(2.8, WATER_Y + Math.sin(t * 3) * 0.03 - dip, 0); ripple(r, t > 2.4 ? (t * 1.4) % 1 : 0); mark.visible = t > 2.4 && t < 4.4; mark.position.set(-1, LAND + 2.5 + Math.sin(t * 8) * 0.05, 0); };
    },
  },
  reel: {
    title: 'Reel it in', secs: 9, fresh: true, meter: { icon: '🐟', coldAt: 0, hotAt: 80 }, captions: [[0, 'Hold to reel'], [2.2, 'Pull against the fish'], [4.6, 'Red? Let go!'], [6.4, 'Reel again till it lands']],
    when: (g) => g.fishing.state === 'reeling',
    build(S) {
      env(S, 'summer', { shore: 1, y: LAND }); const a = S.person(), go = track(S, a, [[0, -1, 0, { yaw: Q, rod: 'hand', pose: 'reel' }], [4.6, -1, 0, { yaw: Q, rod: 'hand', pose: 'wait' }], [6.2, -1, 0, { yaw: Q, rod: 'hand', pose: 'reel' }]]), f = fish(S, 'bluegill', 2.2), r = ring(S);
      return (t, dt) => { go(t, dt); const x = t < 4.6 ? lerp(3.6, 2.8, t / 4.6) : t < 6.2 ? 2.8 + (t - 4.6) * 0.4 : lerp(3.4, 1.4, span(t, 6.2, 9)); const z = Math.sin(t * 2.2) * (t < 7 ? 1.1 : 0.3); f.position.set(x, WATER_Y - 0.04 + Math.abs(Math.sin(t * 5)) * 0.08, z); f.rotation.y = Math.cos(t * 2.2) * 0.7 + Math.PI; r.position.set(x, WATER_Y + 0.02, z); ripple(r, (t * 1.5) % 1); return { meter: t < 4.6 ? lerp(30, 92, t / 4.6) : t < 6.2 ? lerp(92, 26, span(t, 4.6, 6.2)) : lerp(26, 60, span(t, 6.2, 9)) }; };
    },
  },
  boats: {
    title: 'Your boat', secs: 10, captions: [[0, 'Launch from any jetty'], [3, 'Row out with WASD'], [6, 'Cast from the boat']],
    when: (g) => g.profile.level >= 3 && JETTIES.some((j) => Math.hypot(g.player.pos.x - (j.x0 + j.x1) / 2, g.player.pos.z - (j.z0 + j.z1) / 2) < 7),
    build(S) {
      env(S, 'summer', { shore: -3, y: LAND }); mesh(S, new THREE.BoxGeometry(3.4, 0.14, 1.4), '#8a5a32', -1.8, LAND, 0, false); const a = S.person(), go = track(S, a, [[0, -3.6, 0], [1.6, -0.5, 0], [2.4, -0.5, 0], [2.5, 0.6, 0, { mode: 'boat' }], [6, 3.4, 0, { mode: 'boat', yaw: Q }], [6.4, 3.4, 0, { mode: 'boat', yaw: Q, pose: 'wait', rod: 'hand' }]]);
      return (t, dt) => { go(t, dt); };
    },
  },
  schools: {
    title: 'Feeding schools', secs: 9, captions: [[0, 'Look for churning water'], [3.4, 'Cast right into it'], [6, 'Better odds on rare fish']],
    when: (g) => (g.swirls?.pools || []).some((p) => dist(g, p) < 28),
    build(S) {
      env(S, 'sea', { cam: [0, 3, 7.4, 0.6, 1.1, 0] }); const a = S.person(), boat = track(S, a, [[0, -1.7, 0.4, { mode: 'boat', yaw: Q, rod: 'hand', pose: 'wait' }]]), rs = [0, 1, 2, 3].map((i) => { const r = ring(S); r.position.set(2.6 + Math.sin(i * 2) * 0.9, WATER_Y + 0.02, Math.cos(i * 2) * 0.8); return r; }), fs = [0, 1, 2].map(() => fish(S, 'bluegill', 1.6)), b = bobber(S);
      return (t, dt) => { boat(t, dt); rs.forEach((r, i) => ripple(r, (t * 0.9 + i * 0.27) % 1)); fs.forEach((f, i) => { const k = (t * 0.8 + i * 0.33) % 1; f.position.set(2.4 + i * 0.5, WATER_Y + Math.sin(k * Math.PI) * 0.8, -0.3 + i * 0.3); f.rotation.z = lerp(0.9, -0.9, k); }); const c = span(t, 3.4, 4.6); b.visible = t > 3.4; b.position.set(lerp(-1.8, 2.6, c), WATER_Y + Math.sin(c * Math.PI) * 1.6, 0.3); };
    },
  },
  waystones: {
    title: 'Waystones', secs: 8, captions: [[0, 'Touch a waystone to light it'], [3.4, 'Stand by one that is lit'], [5, 'Travel to any other']],
    when: (g) => !!g.waystones.near(5),
    build(S) {
      env(S, 'summer'); S.model('stone-cairn', 1.8, -0.6); const a = S.person(), glow = mesh(S, new THREE.CylinderGeometry(0.5, 0.7, 7, 14, 1, true), '#7cc3c2', 1.8, 3.5, -0.6); glow.material.transparent = true; glow.material.opacity = 0; glow.material.side = THREE.DoubleSide; const go = track(S, a, [[0, -3, 0.4], [2.2, 0.8, 0.4], [5, 0.8, 0.4]]);
      return (t, dt) => { const p = go(t, dt); glow.material.opacity = t > 2.6 ? 0.28 : 0; a.root.visible = !(t > 5.6 && t < 7.2); a.root.scale.setScalar(t > 5 && t < 5.6 ? 1 - (t - 5) : 1); void p; };
    },
  },
  cookout: {
    title: 'Campfire cookout', secs: 8, captions: [[0, 'Sit by a fire'], [2.6, 'Roast a fish'], [5.4, 'Well Fed: fish bite sooner']],
    when: (g) => g.cookout.contextActions().length > 0,
    build(S) {
      env(S, 'dusk', { cam: [0, 2, 6, 0, 0.8, 0] }); S.model('stone-fire-pit', 0.6, 0); S.model('folding-camp-chair', -1.1, 0.3, Q); const flame = fire(S, 0.6, 0), a = S.person(), sit = track(S, a, [[0, -3.6, 0.3], [1.8, -1.1, 0.3], [2.1, -1.1, 0.3, { seat: 0.5, seatYaw: Q, yaw: Q }]]), f = fish(S, 'bluegill', 1.2), yum = word(S, 'Well Fed', '#ffd27a', 0.7);
      return (t, dt) => { flame(t); sit(t, dt); f.visible = t > 2.6 && t < 5.4; f.position.set(0.1, 1.1, 0.3); f.rotation.x = t * 3; yum.visible = t > 5.4; yum.position.set(-1.1, 2.4 + (t - 5.4) * 0.1, 0.3); };
    },
  },
  cabin: {
    title: 'Your cabin', secs: 8, captions: [[0, 'Walk around your home'], [3.2, 'Switch to the Editor'], [5, 'Drag furniture anywhere']],
    when: (g) => g.home.active,
    build(S) {
      env(S, 'inside', { cam: [0, 3.6, 6.8, 0, 0.6, 0] }); mesh(S, new THREE.BoxGeometry(14, 3.4, 0.2), '#a87848', 0, 1.7, -3, false); mesh(S, new THREE.BoxGeometry(2, 1.3, 0.1), '#8fc9f0', 2.6, 2, -2.88); const a = S.person(), chair = mesh(S, new THREE.BoxGeometry(1, 0.9, 1), '#b0604a', -1.6, 0.45, -0.6, false), rug = mesh(S, new THREE.BoxGeometry(2.6, 0.03, 1.8), '#c8a050', 1, 0.02, 0.6, false), go = track(S, a, [[0, -3, 1.6], [3, 2.6, 1.6]]), hand = word(S, '⇄', '#ffffff', 0.7);
      return (t, dt) => { go(t, dt); void rug; const k = span(t, 5, 7); chair.position.x = lerp(-1.6, 1.6, k); chair.position.z = lerp(-0.6, -1.4, k); hand.visible = t > 4.6; hand.position.set(chair.position.x, 1.7, chair.position.z); };
    },
  },
  quests: {
    title: 'Following a quest', secs: 8, captions: [[0, 'Your next step is at the top left'], [2.8, 'Walk to the gold beam'], [5.6, 'Press E when you get there']],
    when: (g) => g.saga.active().length > 0,
    build(S) {
      env(S, 'summer'); const beam = mesh(S, new THREE.CylinderGeometry(0.5, 0.7, 12, 14, 1, true), '#ffd46a', 2.8, 6, -0.4); beam.material.transparent = true; beam.material.opacity = 0.3; beam.material.side = THREE.DoubleSide; const a = S.person(), go = track(S, a, [[0, -2.6, 0.4], [2.8, -2.6, 0.4], [5.4, 2.2, 0], [8, 2.2, 0]]), e = word(S, 'E', '#ffd27a', 0.7);
      return (t, dt) => { go(t, dt); e.visible = t > 5.6; e.position.set(2.2, 2.6, 0); };
    },
  },
  timed: {
    title: 'Helping out', secs: 8, meter: { icon: '⏱' }, captions: [[0, 'Pick it up and go'], [2.6, 'The clock is running'], [5.4, 'Reach the beam in time']],
    when: (g) => !!g.saga.carry,
    build(S) {
      env(S, 'summer', { cam: [0, 2.8, 7.4, 0, 0.8, 0] }); const can = S.model('camp-canoe', 0, 0, Q), beam = mesh(S, new THREE.CylinderGeometry(0.5, 0.7, 12, 14, 1, true), '#ffd46a', 4, 6, 0); beam.material.transparent = true; beam.material.opacity = 0.3; beam.material.side = THREE.DoubleSide; const a = S.person(), go = track(S, a, [[0, -3.6, 0.2], [1.2, -3.6, 0.2], [7, 3.6, 0.2], [8, 3.6, 0.2]]);
      return (t, dt) => { const p = go(t, dt); can.position.set(p.x - 3.2, 0, 0.2); return { meter: lerp(100, 18, span(t, 1.2, 7)) }; };
    },
  },
};
/** Another map's clips, and its group in the How to tab. */
export function addClips(group, ids, clips) { Object.assign(CLIPS, clips); CLIP_GROUPS.push([group, ids]); }
