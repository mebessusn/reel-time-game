// Open Waters: big-game fights and the crew. The tug itself (runs, the angler's arms, the gaff) lives in
// game/tug.js; this is the glue around it at sea:
// - hooking a big fish puts you in the fighting chair (if it's free) and tells the crew;
// - crew roles (picked on the Crew card): the captain backs the boat down on a run (hold the crew key), the gaffer
//   lands the fish when it comes alongside (press the crew key in the window), the spotter calls jumps early and
//   spots birds working bait. Nobody in a role? Marlowe does it, a little less well;
// - the sea joins the fight: a stern dropping off a wave snatches the line, worse the rougher it gets, and the
//   weather's fight difficulty applies like on the lake;
// - step away mid-fight and Marlowe holds the rod for up to a minute.
import { makeBig, gaff, BIG } from '../game/tug.js';
import { SEA } from './waves.js';
import { SPECIES_BY_ID } from '../data/species.js';
import * as THREE from 'three';
const WATER_Y = 0.85;

export const ROLES = {
  angler: { name: 'Angler', what: 'Fish, and take the chair when one\'s on.' },
  captain: { name: 'Captain', what: 'When a crewmate\'s fish runs, hold the crew key to back the boat down on it: the run eases off.' },
  gaffer: { name: 'Gaffer', what: 'When the fish comes alongside, press the crew key in the green window to gaff it aboard.' },
  spotter: { name: 'Spotter', what: 'Call birds working bait for faster bites, and warn the angler before a fish jumps.' },
};

export class BigFight {
  constructor(game, ow) {
    this.game = game; this.ow = ow;
    this.active = null; // my fight: { reel, sp, at }
    this.helping = null; // a crewmate's fight I can help with: { id, name, f }
    this.chase = false;
  }
  get role() { return this.game.ext.d.ocean?.role || 'angler'; }
  setRole(role) {
    if (!ROLES[role]) return;
    this.game.ext.change((d) => { d.ocean.role = role; });
    this.game.pushMeta();
  }
  crew() { // crewmates aboard: [{ id, name, role, state }]
    const g = this.game, c = this.ow.charter, out = [];
    if (!c) return out;
    for (const p of g.net?.peers?.values?.() || []) if (p.meta?.chtr?.id === c.id) out.push({ id: p.meta.id, name: String(p.meta.name || 'Crewmate').slice(0, 20), role: p.meta.role || 'angler', state: p.state, peer: p });
    return out;
  }
  hasRole(role) { return this.crew().some((x) => x.role === role && x.state && !x.state.afk); }

  // ---------------------------------------------------------------- my fight
  onHook(reel, bite, sp) {
    const g = this.game;
    if (!this.ow.atSea || !sp?.big || reel.junk) return;
    const k = (bite.weight - sp.weight[0]) / Math.max(1, sp.weight[1] - sp.weight[0]);
    // into the chair, if it's free (a crewmate in it already: you fight it standing at the rail, arms tire faster)
    const seated = g.chairs.seat?.kind === 'fight' || this.ow.sitChair();
    const gear = this.ow.tackle.fight(); // the Big Game Rod and the harness
    makeBig(reel, { weightK: k, chair: seated, paceK: (sp.pace || 1) * gear.paceK, armsK: gear.armsK });
    if (sp.ink) this.ink(); // a squid answers the hook with a cloud of ink
    const B = reel.big;
    B.captain = this.hasRole('captain') ? 'crew' : 'ai';
    B.gaffer = this.hasRole('gaffer') ? 'crew' : 'ai';
    B.spotter = this.hasRole('spotter');
    B.gaffAiOdds = SEA.swell > 1.5 ? 0.72 : SEA.swell > 1 ? 0.8 : 0.88; // harder to gaff in a big sea
    this.active = { reel, sp, bite, at: performance.now() };
    g.juice?.pop(seated ? 'FISH ON! Into the chair!' : 'FISH ON!', { color: '#ffd060', size: 40, ms: 1600 });
    g.audio.sfx('run');
    g.chat.npcSay?.('Captain Marlowe', [`${sp.name}! Big one! Easy now, let it run when it wants to.`, `That's a ${sp.name}! Pump and wind, pump and wind!`, `Fish on! ${seated ? 'Sit tight in that chair' : 'Brace against the rail'} and keep your rod tip up.`][Math.floor(Math.random() * 3)]);
    g.ui.toast(`Big game takes a while. Ease off when it runs or leaps, reel in bursts to rest your arms, and the ${B.gaffer === 'crew' ? 'gaffer' : 'captain'} gaffs it at the boat.`, { icon: 'fish', ms: 7000, title: 'Fighting chair' });
  }
  ink() {
    const g = this.game, b = g.fishing.bobber;
    if (!b) return;
    for (let i = 0; i < 6; i++) setTimeout(() => g.fx.smoke?.(new THREE.Vector3(b.x + (Math.random() - 0.5) * 2, WATER_Y + 0.1, b.z + (Math.random() - 0.5) * 2)), i * 120);
    g.fx.splash(new THREE.Vector3(b.x, WATER_Y, b.z), 1.4);
    g.ui.toast('Ink! The water goes black around your line.', { icon: 'fish', ms: 3000 });
  }
  onStep(r, dt) {
    if (!r?.big || !this.active) return;
    const g = this.game, B = r.big;
    B.heaveV = this.ow.boat.pose.vy || 0;
    B.seaK = Math.min(1.4, SEA.swell / 1.3);
    // live crew roles (someone may take up a role, or step away, mid-fight)
    B.captain = this.hasRole('captain') ? 'crew' : 'ai';
    if (B.gaffer === 'crew' && !this.hasRole('gaffer')) B.gaffer = 'ai';
    B.spotter = this.hasRole('spotter');
    let chase = 0;
    for (const m of this.crew()) if (m.role === 'captain' && m.state?.ch) chase = 1;
    B.chase += (chase - B.chase) * Math.min(1, dt * 3);
    // cues: a run starting, a leap called, the fish alongside
    const was = this.cue || {};
    const now = { run: B.run > 0, warn: B.warn > 0, gaff: !!B.gaff, afk: B.afk };
    if (now.run && !was.run) { g.audio.sfx('run'); g.ui.tugCue?.('run'); if (this.active.sp.ink && Math.random() < 0.5) this.ink(); }
    if (now.warn && !was.warn && B.spotter) { g.ui.tugCue?.('call'); g.audio.sfx('bell'); }
    if (now.gaff && !was.gaff) {
      g.ui.tugCue?.('gaff');
      g.audio.sfx('splashRemote');
      g.chat.npcSay?.('Captain Marlowe', B.gaffer === 'crew' ? 'Color! It\'s alongside! Gaffer, now!' : 'Color! Hold it there, I\'ve got the gaff...');
    }
    if (now.afk && !was.afk) g.ui.toast('Marlowe has the rod while you\'re away. Back within a minute or the fish wins!', { icon: 'anchor', ms: 5000 });
    this.cue = now;
  }
  onLand(r) {
    if (!this.active || !r?.big) { this.active = null; return; }
    const secs = (performance.now() - this.active.at) / 1000;
    this.lastLanded = { secs, runs: r.big.runs, missed: r.big.missed, sp: this.active.sp.id };
    this.game.audio.sfx('gaff');
    this.active = null;
    this.cue = null;
  }
  onEscape(r, snapped) {
    if (!r?.big || !this.active) return null;
    const name = this.active.sp.name;
    this.active = null; this.cue = null;
    if (r.big.lost === 'afk') return `Marlowe held on as long as he could, but the ${name} threw the hook.`;
    if (snapped) return `The ${name} parted the line. Ease off when it runs or leaps: the drag can only take so much.`;
    return `The ${name} threw the hook. The big ones do that. Cast again!`;
  }
  onCancel() { this.active = null; this.cue = null; }
  end() { this.active = null; this.helping = null; this.chase = false; }
  /** A landed catch at sea: the Open Waters log. */
  onCatch(c, sp) {
    const g = this.game;
    if (!sp?.ocean) return;
    const first = !(g.ext.d.ocean?.catches?.[sp.id]);
    g.ext.change((d) => {
      d.ocean.catches = { ...(d.ocean.catches || {}), [sp.id]: (d.ocean.catches?.[sp.id] || 0) + 1 };
      if (!(d.ocean.best?.[sp.id] >= c.weight)) d.ocean.best = { ...(d.ocean.best || {}), [sp.id]: c.weight };
    });
    g.ext.bump('oceanCatches');
    if (sp.big) g.ext.bump('trophyFish');
    const L = this.lastLanded;
    if (L && L.sp === sp.id) g.chat.system(`${sp.name}, ${Math.round(c.weight)} lb, landed after ${Math.floor(L.secs / 60)}:${String(Math.round(L.secs % 60)).padStart(2, '0')}${L.runs ? ` and ${L.runs} run${L.runs > 1 ? 's' : ''}` : ''}.`, 'catch');
    if (first) g.ui.toast(`First ${sp.name}! ${sp.fact || ''}`, { icon: 'star', title: 'Open Waters', ms: 7000 });
    this.ow.voyage?.onCatch(c, sp, L);
    this.ow.billfish?.onCatch(c, sp);
    this.ow.progress.onCatch(c, sp);
    this.ow.smugglers.onCatch();
    this.ow.quests.progress('catch', { speciesId: sp.id });
    this.lastLanded = null;
  }
  /** What the crew sees of my fight (rides in my state on the crew's side room). */
  stateExtra() {
    const out = {};
    if (this.takeReq) out.tk = this.takeReq; // I asked to take a crewmate's rod
    if (this.handoff && Date.now() - this.handoff.n < 15000) out.ho = this.handoff; // I handed mine over
    const r = this.active?.reel;
    if (r?.big) out.fight = { sp: this.active.sp.id, p: +r.progress.toFixed(2), r: r.big.run > 0 ? 1 : 0, w: r.big.warn > 0 ? 1 : 0, g: r.big.gaff ? (r.big.gaff.t >= BIG.GAFF_OPEN ? 2 : 1) : 0 }; // g: 1 alongside, 2 ready to gaff
    if (this.chase) out.ch = 1;
    return out;
  }

  // ---------------------------------------------------------------- helping a crewmate
  /** The crew key: hold to chase (captain), press to gaff (gaffer) or call (spotter), or gaff your own fish solo. */
  crewKey(down) {
    const g = this.game;
    if (!this.ow.atSea || !this.ow.charter) return;
    if (!down) { this.chase = false; return; }
    const h = this.helping;
    if (h) {
      const role = this.role;
      if (role === 'captain') { this.chase = true; return; }
      if (role === 'gaffer' && h.f.g) { g.net?.emitEvent('crew', { k: 'gaff', to: h.id }); g.audio.sfx('gaff'); return; }
      if (role === 'spotter' && h.f.w) { g.net?.emitEvent('crew', { k: 'call', to: h.id }); g.audio.sfx('bell'); return; }
    }
    // my own fish alongside, and no gaffer aboard: grab the gaff yourself
    const r = this.active?.reel;
    if (r?.big?.gaff) { const ok = gaff(r); g.audio.sfx(ok ? 'gaff' : 'miss'); if (!ok) g.ui.toast('Too early! It bolted. Wait for the green.', { icon: 'fish' }); return; }
    // the spotter's birds
    if (this.role === 'spotter' && this.ow.life.birdsVisible()) { g.net?.emitEvent('crew', { k: 'birds' }); this.ow.life.callBirds(true); }
  }
  /** Crew calls arriving on the side room. */
  onCrew({ from, data, peer }) {
    const g = this.game;
    if (!data) return;
    const who = String(peer?.meta?.name || 'A crewmate').slice(0, 20);
    if (data.k === 'birds') { this.ow.life.callBirds(false, who); return; }
    if (data.to !== g.save.userId) return;
    const r = this.active?.reel;
    if (!r?.big) return;
    if (data.k === 'gaff' && r.big.gaff && r.big.gaffer === 'ai' && r.big.missed >= 2) { g.chat.system('Marlowe\'s got the gaff this time.', 'info'); return; }
    if (data.k === 'gaff' && r.big.gaff) {
      const ok = gaff(r);
      g.chat.system(ok ? `${who} sank the gaff! Fish aboard!` : `${who} swung too early and the fish bolted!`, 'catch');
      if (!ok && r.big.missed >= 2) r.big.gaffer = 'ai'; // Marlowe takes the gaff after two misses
    }
    if (data.k === 'call' && r.big.jumpIn > 0) { r.big.jumpIn += 0.6; r.big.warn = r.big.jumpIn; g.ui.tugCue?.('call', who); g.ext.bump('jumpsCalled'); }
  }
  /** A crewmate asks for my rod (tired arms, a marathon fish): I hand it over with the fight as it stands. */
  checkHandoff() {
    const g = this.game, r = this.active?.reel;
    if (!r?.big || r.big.gaff || r.big.landed) return;
    const m = this.crew().find((x) => x.state?.tk === g.save.userId && x.state && !x.state.afk);
    if (!m) return;
    const A = this.active, b = g.fishing.bobber;
    this.handoff = { to: m.id, n: Date.now(), sp: A.sp.id, w: A.bite.weight, v: A.bite.variant, p: +r.progress.toFixed(3), s: +(r.stamina ?? 1).toFixed(3), x: +(b?.x ?? g.player.pos.x).toFixed(1), z: +(b?.z ?? g.player.pos.z).toFixed(1) };
    this.handing = true;
    g.fishing.cancel();
    this.handing = false;
    if (g.chairs.seat?.kind === 'fight') g.chairs.stand();
    g.chat.system(`You handed the rod to ${m.name}. Shake out those arms!`, 'catch');
    g.audio.sfx('click');
  }
  /** A crewmate handed me their rod: I pick up the same fish, where they left it. */
  checkTakeover() {
    const g = this.game, me = g.save.userId;
    for (const m of this.crew()) {
      const H = m.state?.ho;
      if (!H || H.to !== me || this.seenHand === `${m.id}:${H.n}`) continue;
      this.seenHand = `${m.id}:${H.n}`;
      this.takeReq = null;
      const sp = SPECIES_BY_ID[H.sp];
      if (!sp?.big || g.fishing.state === 'reeling') continue;
      if (g.fishing.busy) g.fishing.cancel();
      g.fishing.bobber = { x: H.x, z: H.z, y: WATER_Y, flying: false, dunk: 0 };
      g.fishing.forcedBite = { kind: 'fish', speciesId: sp.id, variant: H.v || 'normal', weight: H.w };
      g.fishing.hook();
      const r = g.fishing.reel;
      if (r?.big) { r.progress = Math.max(r.progress, H.p); if (r.stamina != null) r.stamina = H.s; }
      g.chat.system(`${m.name} handed you the rod: the ${sp.name} is yours to finish!`, 'catch', { popup: true });
      g.ext.bump('rodTakeovers');
      return;
    }
  }
  /** Ask to take the rod from the crewmate I'm helping. */
  askTake() {
    const h = this.helping, g = this.game;
    if (!h) return;
    g.player.touch(); // (asking is activity: a crewmate never ignores an "away" player's request)
    this.takeReq = this.takeReq === h.id ? null : h.id;
    g.ui.toast(this.takeReq ? `Asked ${h.name} for the rod. They'll hand it over in a moment.` : 'Never mind, they can keep it.', { icon: 'rod', ms: 3500 });
  }
  update(dt) {
    const g = this.game;
    // a giant squid tows the boat after it every so often (and the boat drags back on it)
    const A = this.active;
    if (A?.sp?.tow && A.reel?.big && !A.reel.big.gaff && g.fishing.bobber) {
      A.towT = (A.towT ?? 12) - dt;
      if (A.towT <= 0) { A.towT = 18 + Math.random() * 10; this.ow.tow(g.fishing.bobber.x, g.fishing.bobber.z); }
    }
    this.checkHandoff();
    this.checkTakeover();
    if (this.takeReq && !this.crew().some((m) => m.id === this.takeReq && m.state?.fight)) this.takeReq = null;
    // is a crewmate fighting one? (the first fight found, closest to done)
    let best = null;
    for (const m of this.crew()) { const f = m.state?.fight; if (f && SPECIES_BY_ID[f.sp] && (!best || f.p > best.f.p)) best = { id: m.id, name: m.name, f }; }
    if (best && !this.helping) g.audio.sfx('run');
    this.helping = best;
    if (!best) this.chase = false;
  }
}
export { BIG };
