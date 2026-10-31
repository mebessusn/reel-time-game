// Frostmere: keeping warm. A gentle warmth meter while you're up north: the cold, the wind, the night and the snow
// draw it down (good clothes slow that); fires, the lodge, the sauna, a shanty, the hot spring and Elsi's cocoa bring
// it back. Low, you shiver and slow down and frost creeps in at the edges of the screen; at zero you're walked back to
// the lodge fire (no penalty, just the trip).
// Also here: thin ice (it creaks; stand still on it and you go through, and Astrid fishes you out, soaked), the sauna
// and its plunge hole, and the warm buffs (cocoa, smoked fish, the plunge).
import * as THREE from 'three';
import { toLocal, toWorld, inNorth, kindAt, isIce, ICE_Y, SPRINGS, thinIce } from './geo.js';
import { BUILDINGS, SAUNA_HOLE } from './hearthwick.js';
import { northSfx } from './sounds.js';
import { h } from '../ui/dom.js';

const WARM_SHIRTS = new Set(['puffer', 'sweater', 'raincoat', 'flannel', 'cardigan', 'hoodie', 'parka', 'shirt_parka', 'shirt_sweater_snow', 'shirt_sweater_deer', 'shirt_raincoat_yellow', 'shirt_musher']);
const WARM_HATS = new Set(['beanie', 'trapper', 'hat_earflap', 'hat_bobble', 'hat_aviator']);
const WARM_ACC = new Set(['acc_scarf', 'acc_mittens', 'acc_aurora_scarf']);
const WARM_SHOES = new Set(['boots', 'shoes_furboots']);
const B = Object.fromEntries(BUILDINGS.map((b) => [b.id, b]));

export class Warmth {
  constructor(north) {
    this.north = north; this.game = north.game;
    this.warm = 100; this.soaked = 0; this.buff = null; // buff: { kind, until (ms), mult }
    this.still = 0; this.thinWarnT = 0; this.creakT = 0; this.saunaAt = -1e9;
    const bar = h('div.warmth-fill');
    this.el = h('div.warmth.hidden', h('div.warmth-ico', '❄'), h('div.warmth-bar', bar), h('div.warmth-tag'));
    this.bar = bar; this.tag = this.el.querySelector('.warmth-tag');
    this.vignette = h('div.frost-vignette');
    this.game.ui.root.append(this.el, this.vignette);
  }
  /** v1.17.2: how many pieces of cold-weather gear you have on (a parka counts as two). */
  pieces() {
    const a = this.game.profile.avatar || {}, e = this.game.profile.equipped || {}, on = (set, k) => set.has(a[k]) || set.has(e[k]);
    let n = 0;
    if (on(WARM_SHIRTS, 'shirt')) n += a.shirt === 'parka' || a.shirt === 'shirt_parka' || e.shirt === 'shirt_parka' ? 2 : 1;
    if (on(WARM_HATS, 'hat')) n++;
    if (WARM_ACC.has(a.accessory) || WARM_ACC.has(e.accessory) || WARM_ACC.has(e.extra)) n++;
    if (WARM_SHOES.has(a.shoes)) n++;
    if (a.eyewear === 'eye_snowgoggles') n++;
    return n;
  }
  /** How fast the cold gets to you: one piece slows it, two slow it more, three or more stop it (unless you're soaked). */
  clothes() { return [1, 0.6, 0.3, 0][Math.min(3, this.pieces())]; }
  /** Where warmth comes from right now (per second), and a word for it. */
  source() {
    const N = this.north, p = this.game.player.pos, V = N.village;
    if (!V) return null;
    if (V.bonfire && Math.hypot(p.x - V.bonfire.x, p.z - V.bonfire.z) < 7) return [7, 'By the fire'];
    { const e = N.builtExtras && N.expeditions.warmSource(); if (e) return e; }
    if (N.shanty?.inside) return [5, 'In your shanty'];
    if (N.lodge?.inside) return [12, 'In the Hearth Lodge'];
    if (V.floorAt(p.x, p.z) != null) return [3, 'On the porch'];
    const [u, v] = toLocal(p.x, p.z);
    if (Math.hypot(u - SPRINGS.u, v - SPRINGS.v) < SPRINGS.r + 7) return [5, 'Steam from the spring'];
    for (const pl of this.game.remotes?.campfires?.() || []) if (Math.hypot(p.x - pl.x, p.z - pl.z) < 5) return [5, 'By a campfire'];
    return null;
  }
  update(dt) {
    const g = this.game, N = this.north, here = N.here && !N.trip;
    this.el.classList.toggle('hidden', !here);
    if (!here) { this.vignette.style.opacity = 0; g.player.speedMult = 1; return; }
    const sky = g.engine.sky, st = sky.state || {}, night = sky.night || 0;
    const now = performance.now();
    if (this.buff && now > this.buff.until) { g.ui.toast(`${this.buff.name} has worn off.`, { ms: 2500 }); this.buff = null; }
    const src = this.source();
    if (src) {
      this.warm = Math.min(100, this.warm + src[0] * dt);
      if (this.soaked > 0) this.soaked = Math.max(0, this.soaked - dt * (src[0] / 4));
    } else {
      let drain = 0.24 * (1 + night * 0.6) * (st.weather === 'storm' ? 1.7 : st.weather === 'rain' ? 1.35 : st.weather === 'overcast' ? 1.15 : 1);
      if (N.ice?.onIce()) drain *= 1.15;
      drain *= this.clothes();
      if (this.soaked > 0) { drain = Math.max(drain, 0.12) * 4; this.soaked = Math.max(0, this.soaked - dt); }
      if (this.buff) drain *= this.buff.mult;
      this.warm = Math.max(0, this.warm - drain * dt);
    }
    // the bar, the shiver and the frost
    this.bar.style.width = `${this.warm}%`;
    this.el.classList.toggle('cold', this.warm < 30); this.el.classList.toggle('soaked', this.soaked > 0); this.el.classList.toggle('buffed', !!this.buff);
    this.tag.textContent = this.soaked > 0 ? 'Soaked!' : src ? src[1] : this.buff ? this.buff.name : this.warm < 30 ? 'Freezing' : this.pieces() >= 3 ? 'Dressed for it' : '';
    const cold = Math.max(0, (45 - this.warm) / 45);
    this.vignette.style.opacity = (Math.min(1, cold * 1.25) + (this.soaked > 0 ? 0.25 : 0)).toFixed(3);
    g.player.speedMult = 1 - cold * 0.18;
    // v1.17.2: you can't miss it now: you shiver, the view shakes a little, your breath shows, and it tells you what to do
    this.shiver = src ? 0 : Math.min(1, cold * 1.3);
    this.el.classList.toggle('danger', !src && this.warm < 15);
    if (this.shiver > 0.3) g.engine.shake = Math.max(g.engine.shake || 0, 0.12 + this.shiver * 0.14);
    if (this.shiver > 0.2 && Math.random() < dt * 1.2) { const p = g.player.pos; g.fx.mist(new THREE.Vector3(p.x, p.y + 1.5, p.z)); }
    if (src) { if (this.warm > 60) this.warned = 0; }
    else for (const [at, lvl, title, text] of [[55, 1, 'Getting cold', `Your warmth is dropping. Three pieces of warm gear stop it (you have ${this.pieces()} on).`], [30, 2, 'Freezing!', 'Get warm soon, or you\'ll pass out.'], [12, 3, 'You\'re about to pass out!', 'Get to a fire now.']]) {
      if (this.warm < at && (this.warned || 0) < lvl) { this.warned = lvl; g.audio.sfx('toggle'); g.ui.toast(`${text} ${this.nearest()}`, { title, icon: 'snow', ms: 7000 }); }
    }
    if (this.warm <= 0) this.frozen();
    this.thinIce(dt);
  }
  /** The nearest warmth, in words. */
  nearest() {
    const N = this.north, p = this.game.player.pos, V = N.village, list = [{ name: 'Hearthwick\'s bonfire', x: V.bonfire.x, z: V.bonfire.z }];
    const s = toWorld(SPRINGS.u, SPRINGS.v); list.push({ name: 'Steamhole Springs', x: s.x, z: s.z });
    if (N.builtExtras) { for (const H of N.expeditions.huts) list.push({ name: N.d.huts?.[H.id] ? `the ${H.name} stove` : `the ${H.name} (light its stove)`, x: H.door.x, z: H.door.z }); for (const q of N.expeditions.pools) list.push({ name: 'Ember Hollow\'s hot pools', x: q.x, z: q.z }); }
    let best = list[0], bd = 1e9; for (const q of list) { const d = Math.hypot(q.x - p.x, q.z - p.z); if (d < bd) { bd = d; best = q; } }
    return `Nearest warmth: ${best.name}, ${Math.round(bd)} m away.`;
  }
  /** The first time you land up north: what the meter means and what to do about it. */
  showHelp() {
    const g = this.game;
    if (this.north.d.warmHelp || document.querySelector('.warm-help')) return;
    const close = () => { el.remove(); g.ext.change((d) => { d.north.warmHelp = 1; }); };
    const el = h('div.warm-help.plank', h('b', '❄ Stay warm up here'), h('ul',
      h('li', 'The bar under your level is your warmth. It drains outdoors, faster at night, in snow and on the ice.'),
      h('li', 'When it gets low you shiver, frost creeps in and you slow down. At zero you pass out and wake by the bonfire.'),
      h('li', 'Warm up at a fire, in the Hearth Lodge, a shanty, a trail hut with its stove lit, or a hot pool.'),
      h('li', 'Warm clothes count: one piece slows the cold, two slow it more, and three or more (say a parka and a warm hat) stop it. Hats, boots, goggles, scarves and mittens all count. Pell sells them.')),
    h('button.btn.gold.small', { on: { click: close } }, 'Got it'));
    g.ui.root.append(el);
  }
  /** At zero: walked back to the lodge fire. */
  frozen() {
    const g = this.game;
    this.warm = 70; this.soaked = 0;
    const fade = h('div.travel-fade'); g.ui.root.append(fade); setTimeout(() => fade.remove(), 1400);
    setTimeout(() => {
      g.fishing.cancel();
      this.toLodge();
      this.warned = 0; g.ui.toast('You got too cold! Astrid sat you down by the bonfire to thaw out. Next time, warm clothes, a fire, a lit hut stove or a hot pool will keep you going.', { title: 'Brrr', icon: 'star', ms: 6000 });
    }, 500);
  }
  toLodge() {
    const g = this.game, V = this.north.village, f = V.bonfire;
    const x = f.x + 3.2, z = f.z + 2;
    this.north.races?.abort(); // (a race can't go on from the lodge fire)
    g.player.pos.set(x, f.y - 0.6, z); g.player.baseY = g.player.pos.y; g.player.target = null;
    g.engine.cam.target.set(x, g.player.pos.y + 0.8, z);
  }

  // ---------------------------------------------------------------- thin ice
  thinIce(dt) {
    const g = this.game, pl = g.player, p = pl.pos;
    if (pl.mode !== 'shore' || !inNorth(p.x, p.z) || Math.abs(p.y - ICE_Y) > 0.3 || this.north.shanty?.inside) { this.still = 0; return; }
    const [u, v] = toLocal(p.x, p.z);
    if (!isIce(kindAt(u, v))) { this.still = 0; return; }
    const t = thinIce(u, v), cleats = this.north.ice?.has('cleats');
    const warnAt = cleats ? 0.25 : 0.4;
    if (t < warnAt) { this.still = 0; return; }
    this.creakT -= dt;
    if (this.creakT <= 0) { this.creakT = 2.5 + Math.random() * 3 - t * 1.5; northSfx(g.audio, 'creak', { vol: 0.6 + t }); }
    this.thinWarnT -= dt;
    if (this.thinWarnT <= 0) { this.thinWarnT = 40; g.ui.toast('The ice is thin here. It creaks under you: keep moving!', { title: 'Thin ice', icon: 'waves', ms: 4500 }); }
    const busy = g.fishing.busy || this.north.ice?.drill;
    this.still = pl.moving && !busy ? Math.max(0, this.still - dt * 2) : this.still + dt;
    const limit = t > 0.75 ? 4 : t > 0.55 ? 7 : 12;
    if (this.still > limit - 1.5 && !this.cracked) { this.cracked = true; northSfx(g.audio, 'crack', { vol: 0.6 }); g.juice?.hit({ shake: 0.2 }); }
    if (this.still < limit - 2) this.cracked = false;
    if (this.still > limit) this.fallThrough();
  }
  fallThrough() {
    const g = this.game, p = g.player.pos;
    this.still = 0; this.cracked = false;
    g.fishing.cancel(); this.north.ice?.endDrill(false);
    northSfx(g.audio, 'crack'); setTimeout(() => northSfx(g.audio, 'splash'), 120);
    g.fx.splash?.(new THREE.Vector3(p.x, ICE_Y, p.z), 1.6);
    for (let i = 0; i < 20; i++) g.fx.spawn(p.x, ICE_Y, p.z, (Math.random() - 0.5) * 3, 1 + Math.random() * 2, (Math.random() - 0.5) * 3, i % 3 ? '#e8f6ff' : '#9ac8dc', 0.8, -8);
    g.juice?.hit({ stop: 0.1, shake: 0.6, zoom: 0.9 });
    g.juice?.pop('SPLASH!', { color: '#9ad8ff', size: 44, ms: 1300 });
    const fade = h('div.travel-fade'); g.ui.root.append(fade); setTimeout(() => fade.remove(), 1800);
    setTimeout(() => {
      this.toLodge();
      this.warm = Math.max(10, this.warm - 35); this.soaked = 60;
      g.ui.toast('You went through the ice! Astrid hauled you out and marched you to the fire. You\'re soaked: get warm, fast.', { title: 'Gone through', icon: 'waves', ms: 7000 });
      g.chat?.npcSay?.('Astrid Lund', 'What did I tell you about thin ice?! Sit. By. The. Fire.');
      this.north.onEvent('gonethrough');
    }, 700);
  }

  // ---------------------------------------------------------------- the sauna and the plunge
  contextActions() {
    const g = this.game, p = g.player.pos, out = [];
    const S = B.sauna, door = { x: S.x + Math.sin(S.ry) * (S.hd + 1.2), z: S.z + Math.cos(S.ry) * (S.hd + 1.2) };
    if (Math.hypot(p.x - door.x, p.z - door.z) < 2.4 && !this.inSauna) out.push({ id: 'sauna', label: 'Take a sauna', color: 'gold', at: { x: door.x, z: door.z, y: S.y + 0.5, h: 2.6 }, fn: () => this.sauna() });
    const ph = toWorld(SAUNA_HOLE.u, SAUNA_HOLE.v);
    if (Math.hypot(p.x - ph.x, p.z - ph.z) < 2.6) out.push({ id: 'plunge', label: 'Polar plunge!', color: 'blue', at: { x: ph.x, z: ph.z, y: ICE_Y, h: 1.2 }, fn: () => this.plunge(ph) });
    return out;
  }
  sauna() {
    const g = this.game, S = B.sauna;
    this.inSauna = true;
    g.fishing.cancel();
    const fade = h('div.travel-fade.sauna-fade', h('div.sauna-steam', 'Ahhh...')); g.ui.root.append(fade);
    g.player.hidden = true; this.north.hidePlayer?.(true);
    northSfx(g.audio, 'hiss');
    setTimeout(() => northSfx(g.audio, 'hiss'), 2200);
    setTimeout(() => {
      fade.remove(); this.inSauna = false; this.north.hidePlayer?.(false); g.player.hidden = false;
      this.warm = 100; this.soaked = 0; this.saunaAt = performance.now();
      this.setBuff('Sauna glow', 4 * 60, 0.5);
      g.ext.change((d) => { d.north.saunas = (d.north.saunas || 0) + 1; });
      g.ui.toast('Toasty! Now the brave part: the plunge hole is just out on the ice.', { title: 'Sauna', icon: 'sun', ms: 5000 });
      this.north.onEvent('sauna');
    }, 4200);
    for (let i = 0; i < 40; i++) setTimeout(() => g.fx.smoke(new THREE.Vector3(S.x + (Math.random() - 0.5) * 3, S.y + 3.5, S.z + (Math.random() - 0.5) * 3)), i * 90);
  }
  plunge(ph) {
    const g = this.game, recent = performance.now() - this.saunaAt < 4 * 60 * 1000;
    g.fishing.cancel();
    g.player.pos.set(ph.x, ICE_Y, ph.z);
    northSfx(g.audio, 'splash');
    g.fx.splash?.(new THREE.Vector3(ph.x, ICE_Y, ph.z), 1.8);
    g.juice?.pop(recent ? 'BRRRACING!' : 'COLD!!', { color: '#9ad8ff', size: 44, ms: 1400 });
    this.north.hidePlayer?.(true);
    setTimeout(() => {
      this.north.hidePlayer?.(false);
      const out = { x: ph.x + 2.2, z: ph.z + 1.2 };
      g.player.pos.set(out.x, ICE_Y, out.z); g.player.baseY = ICE_Y;
      if (recent) {
        this.setBuff('Plunge rush', 10 * 60, 0.35);
        g.audio.sfx('buff');
        g.ui.toast('Sauna, then the plunge: you feel AMAZING. You\'ll stay warm for a good while.', { title: 'Polar plunge', icon: 'star', ms: 5000 });
        this.north.onEvent('plunge');
      } else {
        this.warm = Math.max(5, this.warm - 30); this.soaked = 40;
        g.ui.toast('Yikes! That\'s what the sauna is for. Get warm first next time.', { title: 'Polar plunge', icon: 'waves', ms: 5000 });
      }
    }, 1300);
  }
  setBuff(name, secs, mult) {
    this.buff = { name, until: performance.now() + secs * 1000, mult };
  }
}
