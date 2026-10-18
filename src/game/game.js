// Game orchestrator: world + player + fishing + saves + multiplayer + audio + UI.
import * as THREE from 'three';
import { Engine } from './engine.js';
import { Player } from './player.js';
import { Fishing } from './fishing.js';
import { Actor } from './actor.js';
import { FX } from './fx.js';
import { Remotes } from './remotes.js';
import { UI } from '../ui/ui.js';
import { openCreator } from '../ui/creator.js';
import { AudioEngine } from '../audio/audio.js';
import { zoneAt, WATER_Y, FALLS_C, groundY, launchPointNear, nearestLanding, regionName, COVE_LAUNCH, boatable } from '../world/terrain.js';
import { blocked } from '../world/colliders.js';
import { CABIN, BOARD, RACK, TROPHY, HOME_DOOR } from '../world/props.js';
import { Trophies } from './trophies.js';
import { Npcs } from './npcs.js';
import { ClaudeLink } from './claudelink.js';
import { ZONES, SPECIES_BY_ID } from '../data/species.js';
import * as R from './rules.js';

/** v1.8.1: the buff a Super Cast lights up. Another Super Cast tops it back up. */
export const GOLDEN_LINE = { name: 'Golden Line', seconds: 75, perks: { biteSpeed: 0.15, reelZone: 0.08, hookWindow: 0.15, goldOdds: 0.15, castDistance: 2 } };
import { newId } from '../save/local.js';
import { RodHolders } from './rodholders.js';
import { Treasure } from './treasure.js';
import { updateCulling } from '../render/cull.js';
import { updateShadowCasters } from '../render/shadowcull.js';
import { SwirlField, swirlAt, setSwirlUsage, noteSwirlCatch, swirlCatchesLeft } from '../world/swirls.js';
import { caveCamFit } from '../world/cave.js';
import { Bikes } from './bikes.js';
import { Buzz } from './buzz.js';
import { NullNet } from '../net/net.js';
import { PATIENT, ANSWER_STREAK, turnBonus, recentRewards, canReward } from './claudeperks.js';
import { Dialogue } from '../ui/dialogue.js';
import { AmbientFish } from '../world/ambientfish.js';
import { Selfie } from '../ui/selfie.js';
import { Ext } from './ext.js';
import { Shared } from './shared.js';
import { LakeFlag } from './lakeflag.js';
import { Moderation } from './mod.js';
import { Party, NEAR_RANGE } from './party.js';
import { spotAt, unlocksAt, nextUnlock, LEVEL_REWARDS, SPOTS, LAKE_LEVELS, LAKE_NAMES } from './spots.js';
import { Cookout } from './cookout.js';
import { AwayGear } from './awaygear.js';
import { HomeUI } from '../ui/homeui.js';
import { homeLayout } from './home.js';
import { Traits } from './traits.js';
import { Quests } from './quests.js';
import { Collections } from './collections.js';
import { Waystones } from './waystones.js';
import { Tackle } from './tackle.js';
import { Derby } from './derby.js';
import { Community } from './community.js';
import { Bottles } from './bottles.js';
import { WorldEvents } from './worldevents.js';
import { RealWeather } from './realweather.js';
import { Keymap, Gamepads } from './controls.js';
import { Tutorial } from '../ui/tutorial.js';
import { Juice } from './juice.js';
import { Ladder } from './ladder.js';
import { Living } from './living.js';
import { Wildlife } from '../world/wildlife.js';
import { Fauna } from '../world/fauna.js';
import { Social } from './social.js';
import { Pet } from './pet.js';
import { Chairs, SEAT_H } from './chairs.js';
import { Menus } from '../ui/menus.js';
import { NightLights } from './nightlights.js';
import { Places } from './places.js';
import { Waypoint } from './waypoint.js';
import { bindUiSounds } from '../ui/nav.js';
import { onDock, heightAt } from '../world/terrain.js';

export class Game {
  constructor({ stage, uiRoot, save = null, net = null, auth = {} }) {
    this.engine = new Engine(stage);
    this.audio = new AudioEngine();
    this.save = save;
    this.net = net;
    this.auth = auth || {};
    this.setAuth(auth);
    this.fx = new FX(this.engine.scene);
    this.swirls = new SwirlField(this.engine.scene, this.fx);
    this.swirls.water = this.engine.water;
    this.engine.camFit = caveCamFit; // the camera stays inside the cavern
    this.swirls.onSpent = (at) => { if (Math.hypot(at.x - this.player.pos.x, at.z - this.player.pos.z) < 40) this.chat?.system('That school of fish scattered. A new one will gather on this water in about a minute.', 'swirl'); };
    this.swirls.onChange = () => this.chat?.system('The fish moved. New feeding schools are churning up open water. Row out and cast into one for rare fish!', 'swirl', { popup: true });
    this.ambient = new AmbientFish(this.engine.scene);
    this.trophies = new Trophies(this);
    this.selfie = new Selfie(this);
    this.trophies.on('change', (list) => { this.engine.props.trophyBoard?.userData.setTrophies(list); this.ui.sheets.current?.name === 'legends' && this.ui.sheets.refresh(); });
    this.trophies.on('new', ({ t, rank }) => {
      const sp = SPECIES_BY_ID[t.speciesId];
      const v = t.variant === 'diamond' ? 'Diamond ' : t.variant === 'gold' ? 'Gold ' : '';
      const mine = t.userId === this.save?.userId;
      this.chat.system(`${mine ? 'Your' : `${t.name}'s`} ${v}${sp?.name || 'fish'} now hangs on the Lake Legends board at #${rank}!`, 'trophy', { popup: true, inline: true });
      if (mine) this.audio.sfx('achievement');
    });
    this.player = new Player();
    this.actor = new Actor(this.engine.scene);
    Actor.camera = this.engine.camera;
    this.fishing = new Fishing(this);
    this.remotes = new Remotes(this);
    this.npcs = new Npcs(this);
    this.chairs = new Chairs(this);
    this.nightLights = new NightLights(this.engine.scene);
    this.places = new Places(this);
    this.waypoint = new Waypoint(this);
    this.claude = new ClaudeLink(this);
    this.claude.on('working', ({ elapsed = 0 } = {}) => {
      const m = Math.floor(elapsed / 60);
      const lead = m >= 1 ? `Claude has been working on your prompt for ${m} min. Your wait so far counts.` : 'Claude is working on your prompt.';
      this.chat?.system(`${lead} Cast a line! ${PATIENT.name}: bites come faster until it's done.`, 'info');
    });
    this.claude.on('ready', ({ seconds, steps }) => this.answerReady(seconds, steps));
    // Newer systems (see each module): extended save, shared lake data, away gear, cabin, quests...
    this.ext = new Ext();
    this.shared = new Shared();
    this.gear = new AwayGear(this);
    this.holders = new RodHolders(this);
    this.treasure = new Treasure(this);
    this.traits = new Traits(this);
    this.quests = new Quests(this);
    this.collections = new Collections(this);
    this.waystones = new Waystones(this);
    this.tackle = new Tackle(this);
    this.bait = this.tackle;
    this.derby = new Derby(this);
    this.community = new Community(this);
    this.lakeFlag = new LakeFlag(this);
    this.mod = new Moderation(this);
    this.party = new Party(this);
    this.cookout = new Cookout(this);
    this.bottles = new Bottles(this);
    this.events = new WorldEvents(this);
    this.realWeather = new RealWeather(this);
    this.pads = new Gamepads(this);
    this.juice = new Juice(this);
    this.ladder = new Ladder(this);
    this.living = new Living(this);
    this.social = new Social(this);
    this.pet = new Pet(this);
    this.bikes = new Bikes(this);
    this.buzz = new Buzz(this); // v1.13.8: the buzz-cut pig
    this.dialogue = new Dialogue(this);
    this.wildlife = new URLSearchParams(location.search).has('nonpc') ? null : new Wildlife(this.engine.scene);
    this.fauna = new URLSearchParams(location.search).has('nonpc') ? null : new Fauna(this.engine.scene); // v1.9.7 deer, rabbits, raccoons, gulls, hawks
    this.uiRoot = uiRoot;
    this.ui = new UI(uiRoot, this);
    this.menus = new Menus(this);
    bindUiSounds(this.audio);
    this.ui.setVisible(false);
    this.home = new HomeUI(this);
    this.tutorial = new Tutorial(this);
    this.myEmote = null;
    this.myBubble = null;
    this.sendTimer = 0;
    this.lastShowoff = null;
    this.raftCooldown = new Map();
    this.fromClaude = new URLSearchParams(location.search).get('src') === 'claude';
    this.smokeT = 0;
  }

  get profile() { return this.save.profile; }
  get chat() { return this.ui?.chat; }

  // Slowly orbit the lake behind the splash / creator before play starts.
  backdrop() {
    const focus = new THREE.Vector3(0, 2, 26);
    this.engine.cam.dist = 30; this.engine.cam.pitch = 0.42;
    this.engine.start((dt, t) => {
      this.engine.cam.yaw = Math.sin(t * 0.05) * 0.6;
      this.pads?.update(dt); // controllers work on the title screen and in the creator
      this.engine.sky.update(dt, t, focus, this.engine.water, this.engine.props);
      this.fx.update(dt);
      this.engine.updateCamera(dt, focus);
    });
  }

  setAuth(auth = {}) { this.auth = auth; this.cloudAvailable = !!auth.available; this.authLabel = auth.label || ''; }

  // Menus before play (title screen settings) need the key map and extended save.
  prepareMenus() {
    if (this.extLoaded) return;
    this.ext.load(this.save);
    this.extLoaded = true;
    this.keymap = new Keymap(this.ext);
    this.player.keymap = this.keymap;
  }

  async start() {
    const p = this.profile;
    this.prepareMenus();
    this.started = true;
    this.ui.setVisible(true);
    this.engine.cam.dist = 11.5; this.engine.cam.pitch = 0.52; this.engine.cam.yaw = 0;
    this.applySettings();
    this.actor.setLook(p.avatar, p.equipped);
    this.bindInput();
    // v1.10 moderation: the ban list is read before you join the lake, and banned anglers never appear on it
    await this.shared.init().catch(() => {});
    await this.mod.init().catch((e) => console.warn('[mod]', e));
    this.party.initMail(); // v1.12: friend requests (and the angler directory) need the shared db ready first
    // Network (v1.13.7: single player fishes on a NullNet, with nobody else on the lake)
    if (this.net) await this.attachNet(this.net);
    this.chat.system(`Welcome to Cozy Cove, ${p.name}! Press Enter to chat, / for commands, /help for the list.`, 'info');
    // v1.10: the lake rules, once, the first time this angler starts the game
    if (!new URLSearchParams(location.search).has('autoplay')) {
      import('../ui/conduct.js').then((m) => { if (!m.conductAccepted(this)) m.showConduct(this, { firstTime: true }); });
    }
    // Feed
    this.save.onFeed((e) => {
      if (this.net?.kind === 'none' && this.playMode === 'solo' && e.userId !== this.save.userId) return; // single player: nobody else's news
      this.ui.addFeed(e);
      if (e.userId !== this.save.userId && e.kind === 'catch') this.logCatch(e.name, { ...e.payload, tier: SPECIES_BY_ID[e.payload?.speciesId]?.tier }, true);
      if (e.kind === 'achievement' && e.userId !== this.save.userId) this.chat.system(`${e.name} earned a gold achievement.`, 'achievement');
    });
    const recent = await this.save.listFeed().catch(() => []);
    recent.slice(0, 3).reverse().forEach((e) => this.ui.addFeed(e, false));
    this.engine.sky.onThunder = () => this.audio.sfx('thunder');
    this.engine.props.trophyBoard?.userData.setTrophies(this.trophies.list);
    this.trophies.init().catch((e) => console.warn('[trophies]', e));
    this.engine.start((dt, t) => this.update(dt, t));
    // feeding-school cast counts, shared by everyone: one doc per pool per angler
    this.swirlMine = new Map();
    this.shared.watch?.('swirls', (docs) => {
      const m = new Map(), times = new Map();
      for (const d of docs) if (typeof d.pool === 'string' && d.pool.length < 40) {
        m.set(d.pool, (m.get(d.pool) || 0) + Math.max(0, Math.min(50, Math.floor(Number(d.n) || 0))));
        const at = Math.min(Date.now() + 5000, Number(d.at) || 0);
        if (at) times.set(d.pool, Math.max(times.get(d.pool) || 0, at));
      }
      for (const [k, v] of this.swirlMine) m.set(k, Math.max(m.get(k) || 0, v));
      setSwirlUsage(m, times);
    }, { limit: 400 });
    this.tackle.init();
    this.gear.init();
    this.quests.init();
    this.collections.placeStatues();
    this.waystones.refresh();
    this.community.init();
    this.lakeFlag.init();
    this.bottles.init();
    this.living.init();
    this.social.init();
    this.pet.init();
    this.bikes.init();
    this.buzz.init();
    this.testerGift();
    this.ui.captions.on = !!p.settings.captions;
    this.audio.onSound = (id) => this.ui.captions.show(id);
    if (p.settings.realWeather) this.realWeather.enable();
    if (!this.tutorial.maybeStart()) this.ui.tips.welcome((p.catchCount || 0) === 0);
    window.addEventListener('beforeunload', () => this.ext.flush());
    this.claude.init().catch((e) => console.warn('[claude link]', e));
    window.addEventListener('blur', () => this.applyFocusMute(true));
    window.addEventListener('focus', () => this.applyFocusMute(false));
    document.addEventListener('visibilitychange', () => this.applyFocusMute(document.hidden));
    await this.autoClaim();
  }

  applyFocusMute(bg) { this.audio.setFocusMuted(bg && this.profile.settings.muteUnfocused); }

  meta() {
    const p = this.profile;
    return { id: this.save.userId, name: p.name, avatar: p.avatar, equipped: p.equipped, lvl: p.level, title: p.title, crown: (p.stats.weeklyWins || 0) > 0 && p.title === 'Champion', home: this.ext ? homeLayout(this.ext.d, p) : null, derby: this.derby?.myEntry() || null, pet: this.ext?.d.pet || null, ...(this.party ? this.party.meta() : {}) };
  }
  pushMeta() { if (this.started) this.net?.setMeta(this.meta()); this.actor.setLook(this.profile.avatar, this.profile.equipped); }

  // ---------------- v1.13.7: single player or multiplayer ----------------
  /** 'solo' (just you, nobody else on the lake) or 'multi' (the shared lake). Remembered on this device. */
  get playMode() { try { return localStorage.getItem('rt_play_mode') === 'solo' ? 'solo' : 'multi'; } catch { return 'multi'; } }
  get solo() { return this.net?.kind === 'none' && this.playMode === 'solo'; }
  async attachNet(net) {
    net.isBlocked = (peer) => this.mod.blockedPeer(peer);
    this.remotes.attach(net);
    const announce = (peer) => { peer.announced = true; this.ui.addFeed({ kind: 'join', name: peer.meta.name }); this.chat.system(`${peer.meta.name} paddled in.`, 'join'); };
    net.on('peer:join', (peer) => { if (peer.meta?.name) announce(peer); });
    net.on('peer:meta', (peer) => { if (peer && !peer.announced && peer.meta?.name) announce(peer); });
    net.on('peer:leave', (peer) => { if (!peer.announced) return; this.ui.addFeed({ kind: 'leave', name: peer.meta?.name || 'Someone' }); this.chat.system(`${peer.meta?.name || 'Someone'} headed home.`, 'leave'); });
    net.on('chat', (e) => this.chat.receive(e));
    net.on('solo', () => {
      this.chat.system('You are fishing solo: this copy of the game can\'t reach the shared lake. To play together, ask whoever shared it to invite you by email from Claude\'s Share menu, then open it signed in to Claude.', 'info');
      this.ui.toast('Fishing solo. Open Play with friends to see how to join others.', { icon: 'users', ms: 6000 });
    });
    await net.connect(this.meta());
  }
  /** Switch modes, live: leave the shared lake (every other angler vanishes) or join it again. */
  async setPlayMode(mode) {
    try { localStorage.setItem('rt_play_mode', mode === 'solo' ? 'solo' : 'multi'); } catch { /* private mode: this session only */ }
    this.playModeNow = mode;
    if (!this.started) return;
    const wantSolo = mode === 'solo', isSolo = this.net?.kind === 'none';
    if (wantSolo === isSolo) return;
    if (!wantSolo && !this.makeNet) return;
    if (this.party?.inParty) this.party.leave(true);
    this.net?.leave?.();
    for (const id of [...this.remotes.list.keys()]) this.remotes.remove(id);
    this.net = wantSolo ? new NullNet() : this.makeNet();
    await this.attachNet(this.net);
    this.chat.system(wantSolo ? 'Single player: it\'s just you on the lake now. Switch back from the title screen any time.' : 'Multiplayer: you\'re back on the shared lake.', 'info');
  }

  perks() {
    const p = R.perksOf(this.profile);
    // v1.8.1 Golden Line (a Super Cast's buff): quicker bites, a wider reel zone, a longer hook window,
    // more gold fish and a longer cast, while it lasts
    if (this.buffLeft() > 0) for (const [k, v] of Object.entries(GOLDEN_LINE.perks)) p[k] = (p[k] || 0) + v;
    for (const [k, v] of Object.entries(this.cookout?.perks() || {})) p[k] = (p[k] || 0) + v; // v1.9.5 Well Fed
    if (this.patientAngler()) for (const [k, v] of Object.entries(PATIENT.perks)) p[k] = (p[k] || 0) + v; // v1.12.1
    return p;
  }
  /** What the active buff does, for the HUD's hover card (v1.8.2). */
  buffInfo() {
    const left = this.buffLeft();
    if (!(left > 0)) return null;
    const P = GOLDEN_LINE.perks, pct = (v) => `${Math.round(v * 100)}%`;
    return {
      name: GOLDEN_LINE.name, left, from: 'From a Super Cast. Another Super Cast tops it back up.',
      lines: [`Fish bite ${pct(P.biteSpeed)} faster`, `Reel zone ${pct(P.reelZone)} wider in Tug & Turn`, `Hook window ${pct(P.hookWindow)} longer`, `Gold fish ${pct(P.goldOdds)} more likely`, `Casts fly ${P.castDistance} m further`],
    };
  }
  buffLeft() { return Math.max(0, ((this.buff?.until || 0) - performance.now()) / 1000); }
  /** v1.12.1: Patient Angler is on while Claude works on your prompt (and never longer than two hours). */
  patientAngler() { return !!this.claude?.working && this.claude.elapsed() < PATIENT.maxSeconds; }
  patientInfo() {
    if (!this.patientAngler()) return null;
    const pct = (v) => `${Math.round(v * 100)}%`;
    return { name: PATIENT.name, elapsed: this.claude.elapsed(), lines: [`Fish bite ${pct(PATIENT.perks.biteSpeed)} faster`, `Reel zone ${pct(PATIENT.perks.reelZone)} wider in Tug & Turn`], from: 'While Claude works on your prompt. Ends when your answer is ready.' };
  }
  goldenLine() {
    const fresh = this.buffLeft() <= 0;
    this.buff = { kind: 'golden', until: performance.now() + GOLDEN_LINE.seconds * 1000 };
    this.audio.sfx('buff');
    this.chat?.system(fresh ? `Golden Line! For ${GOLDEN_LINE.seconds} s: faster bites, an easier reel, more gold fish and longer casts.` : `Golden Line topped back up to ${GOLDEN_LINE.seconds} s.`, 'catch');
  }
  goodCompany() { return this.remotes.within(this.player.pos, 4) >= 1; }
  claimableCount() { return R.claimableAchievements(this.profile).length; }

  netEvent(type, data) { this.net?.emitEvent(type, data); }

  // ---------------- input ----------------
  bindInput() {
    const el = this.engine.renderer.domElement;
    let down = null;
    const pointers = new Map();
    el.addEventListener('contextmenu', (e) => e.preventDefault());
    // Hold left + right mouse together to walk (or row) forward; move the mouse to steer the camera.
    // A second button pressed mid-press arrives as a pointermove (chorded buttons), so every handler checks.
    const syncWalk = (e) => {
      const both = (e.buttons & 3) === 3;
      if (both === !!this.player.mouseWalk) return;
      this.player.mouseWalk = both;
      if (both) {
        if (down?.timer) clearTimeout(down.timer);
        if (this.fishing.state === 'charge') this.fishing.cancel();
        down = { orbit: true, walk: true, x: e.clientX, y: e.clientY };
        this.player.target = null;
      }
    };
    el.addEventListener('mousedown', syncWalk);
    window.addEventListener('mouseup', syncWalk);
    window.addEventListener('blur', () => { this.player.mouseWalk = false; });
    el.addEventListener('pointerdown', (e) => {
      this.audio.unlock();
      this.player.touch();
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      el.setPointerCapture?.(e.pointerId);
      if (this.ui.modalOpen) return;
      if ((e.buttons & 3) === 3) { syncWalk(e); return; }
      if (e.button === 2 || pointers.size > 1) { down = { orbit: true, x: e.clientX, y: e.clientY }; this.fishing.state === 'charge' && this.fishing.cancel(); return; }
      if (e.button === 0 && this.bikes.riding) { this.bikes.ring(); down = { consumed: true }; return; }
      // Hook / reel / reel-in take any press
      if (this.fishing.press()) { down = { consumed: true }; return; }
      const hit = this.engine.pick(e.clientX, e.clientY);
      down = { x: e.clientX, y: e.clientY, t: performance.now(), hit, moved: false };
      // Left mouse is the fishing button: hold it to charge a cast (aimed at the water you pressed on,
      // or straight ahead when you pressed on land). A quick click on the ground still walks there.
      if (e.button === 0 && this.fishing.state === 'idle') {
        down.timer = setTimeout(() => {
          if (down && !down.moved) { down.charging = true; this.fishing.startCharge(hit?.kind === 'water' ? hit.point : null); this.player.target = null; }
        }, 180);
      }
    });
    // Tug & Turn: while a fish is on, the mouse's left/right position angles the rod.
    window.addEventListener('pointermove', (e) => {
      if (this.fishing.state !== 'reeling') return;
      const w = window.innerWidth || 1;
      this.rodAim = Math.max(-1, Math.min(1, (e.clientX - w / 2) / (w * 0.2)));
      this.aimByMouse = performance.now();
    });
    el.addEventListener('pointermove', (e) => {
      if (e.pointerType === 'mouse') syncWalk(e);
      const prev = pointers.get(e.pointerId);
      if (prev) pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (!down || down.consumed || down.charging) return;
      const dx = e.clientX - (prev?.x ?? e.clientX), dy = e.clientY - (prev?.y ?? e.clientY);
      if (down.orbit || Math.hypot(e.clientX - down.x, e.clientY - down.y) > 10) {
        down.moved = true; clearTimeout(down.timer);
        this.engine.cam.yaw -= dx * 0.008;
        this.camDragAt = performance.now();
        this.engine.cam.pitch = Math.min(1.25, Math.max(-1.25, this.engine.cam.pitch + dy * 0.004));
      }
    });
    const up = (e) => {
      pointers.delete(e.pointerId);
      if (e.pointerType === 'mouse') syncWalk(e);
      if (!down) return;
      if (down.walk) { if (!(e.buttons & 3)) down = null; return; }
      clearTimeout(down.timer);
      if (down.charging) this.fishing.releaseCharge();
      else if (down.consumed) this.fishing.releasePress();
      else if (!down.moved && !down.orbit && down.hit && !this.fishing.busy) {
        const p = down.hit.point;
        if (down.hit.kind === 'ground' && this.player.mode === 'shore') this.player.setTarget(p.x, p.z);
        else if (down.hit.kind === 'water' && this.player.mode === 'boat') this.player.setTarget(p.x, p.z);
        else if (down.hit.kind === 'water') this.player.faceToward(p.x, p.z);
        else if (down.hit.kind === 'ground' && this.player.mode === 'boat' && this.player.nearShore()) this.disembark();
      }
      this.fishing.releasePress();
      down = null;
    };
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', up);
    el.addEventListener('wheel', (e) => { e.preventDefault(); this.engine.cam.zoom = Math.min(2.2, Math.max(0.45, this.engine.cam.zoom * (1 + Math.sign(e.deltaY) * 0.1))); }, { passive: false });

    window.addEventListener('keydown', (e) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      const k = e.key.toLowerCase();
      this.audio.unlock();
      this.player.touch();
      if (this.rebinding) { e.preventDefault(); this.rebinding(k); return; }
      if (k === 'escape') {
        if (this.home.active) { this.home.close(); return; }
        if (this.fishing.state === 'charge') { this.fishing.cancel(); return; }
        if (this.menus.open) { this.menus.close(); return; }
        if (this.ui.modalOpen) { this.ui.closeAll(); return; }
        if (this.started && !document.querySelector('.title-screen')) this.menus.pause();
        return;
      }
      if ((k === 'enter' || k === '/') && !e.repeat && !document.querySelector('.splash, .creator')) { e.preventDefault(); this.chat.focus(k === '/' ? '/' : ''); return; }
      const act = this.keymap?.action(k);
      if (act === 'jump' && this.selfie.active) { e.preventDefault(); if (!e.repeat && !this.selfie.card) this.selfie.snap(); return; }
      if (this.home.active) { if (act === 'home' && !e.repeat) this.home.close(); return; }
      // panel hotkeys work while a panel is open: the same key closes it, another key switches to that panel
      const SHEET_KEYS = { map: 'map', creel: 'creel', tackle: 'tackle', pedia: 'fishpedia', board: 'board', journal: 'journal', social: 'social' };
      if (SHEET_KEYS[act] && this.ui.sheets.current && !e.repeat) { e.preventDefault(); this.ui.sheets.open(SHEET_KEYS[act]); return; }
      if (this.ui.modalOpen && act !== 'jump') return;
      if (act === 'jump') { e.preventDefault(); if (!e.repeat && !this.ui.modalOpen && !this.fishing.busy) this.player.jump(); return; }
      if (act === 'sprint') { this.player.sprint = true; return; }
      if (['up', 'down', 'left', 'right'].includes(act)) { this.player.keys.add(k); e.preventDefault(); return; }
      if (act === 'cast') { e.preventDefault(); if (!e.repeat) this.primaryDown(null); return; }
      if (e.repeat) return;
      switch (act) {
        case 'interact': this.interact(); break;
        case 'camLeft': this.engine.cam.yaw += 0.25; break;
        case 'camRight': this.engine.cam.yaw -= 0.25; break;
        case 'emotes': this.ui.toggleWheel(); break;
        case 'creel': this.ui.sheets.open('creel'); break;
        case 'social': this.ui.sheets.open('social'); break;
        case 'tackle': this.ui.sheets.open('tackle'); break;
        case 'pedia': this.ui.sheets.open('fishpedia'); break;
        case 'board': this.ui.sheets.open('board'); break;
        case 'journal': this.ui.sheets.open('journal'); break;
        case 'map': this.ui.sheets.open('map'); break;
        case 'home': this.home.open(); break;
        case 'rod': this.toggleRod(); break;
        case 'selfie': this.selfie.start(); break;
        case 'bait': this.tackle.cycle(); break;
        case 'bike': this.bikes.toggle(); break;
        default: break;
      }
    });
    window.addEventListener('keyup', (e) => {
      const k = e.key.toLowerCase();
      this.player.keys.delete(k);
      const act = this.keymap?.action(k);
      if (act === 'sprint') this.player.sprint = false;
      if (act === 'cast') this.primaryUp();
    });
    window.addEventListener('blur', () => { this.player.keys.clear(); this.player.sprint = false; });
  }

  /** v1.9.2: a one-time 1,000-coin gift for everyone who plays on Oct 14 2026, to try pets and bikes. */
  async testerGift() {
    const d = new Date(), today = d.getFullYear() === 2026 && d.getMonth() === 9 && d.getDate() === 14;
    if (!today || (this.ext.d.gifts || []).includes('tester-1014')) return;
    this.ext.change((x) => { x.gifts = [...(x.gifts || []), 'tester-1014']; });
    try {
      const r = await this.save.grant('gift', 'tester-1014', { coins: 1000 });
      if (!r?.ok) return;
      this.ui.refresh?.();
      this.audio.sfx('coin');
      setTimeout(() => this.ui.toast('A gift for testers: 1,000 coins! Try a pet from Gus or a bike from Rosie at Pinewood Lodge.', { icon: 'coin', ms: 7000 }), 2500);
    } catch { /* offline: try again next time */ this.ext.change((x) => { x.gifts = (x.gifts || []).filter((g) => g !== 'tester-1014'); }); }
  }

  // E: run the first context action (shop, notice board, launch boat, go ashore...).
  interact() {
    if (this.ui.modalOpen) return;
    const a = this.contextActions()[0];
    if (!a) return;
    if (this.bikes.riding && a.id !== 'bikes') this.bikes.dismount(); // hop off to use things
    this.audio.sfx('click');
    a.fn();
  }

  primaryDown(aim) {
    if (this.bikes?.riding) { this.bikes.ring(); return; } // on a bike the fishing button rings the bell
    if (this.fishing.press()) return;
    if (this.fishing.state === 'idle') { this.player.target = null; this.fishing.startCharge(aim); }
  }
  primaryUp() {
    if (this.fishing.state === 'charge') this.fishing.releaseCharge();
    this.fishing.releasePress();
  }

  // ---------------- per-frame ----------------
  update(dt, t) {
    dt = this.juice.scale(dt); // hit-stop
    const pl = this.player;
    const lock = this.fishing.busy || this.ui.modalOpen;
    // A/D (or arrows) angle the rod during a fight too
    if (this.fishing.state === 'reeling') {
      const steer = (pl.held('right') ? 1 : 0) - (pl.held('left') ? 1 : 0);
      if (steer) this.rodAim = Math.max(-1, Math.min(1, (this.rodAim || 0) + steer * dt * 2.6));
    }
    this.pads.update(dt);
    const seated = this.chairs.hold(dt);
    this.bikes.drive(dt);
    pl.update(dt, this.engine.cam.yaw, lock || this.home.active || seated || !!this.riding || !!this.treasure.dig || this.bikes.riding);
    this.updateRide();
    this.chairs.pin();
    if ((this.player.keys.size || this.player.stick) && this.fishing.state === 'waiting') this.fishing.reelIn();
    this.footsteps(dt);
    if (this.pendingAnswer != null && this.fishing.state === 'idle' && !this.ui.revealCard?.isConnected) { const sec = this.pendingAnswer; this.pendingAnswer = null; this.releaseAnswerFish(sec); }
    this.fishing.update(dt, t);
    if (!this.tutorial.active) this.ui.tips.update(dt);
    this.tutorial.update();
    this.gear.update(dt, t);
    this.holders.update(dt);
    this.treasure.update(dt);
    this.ui.setBuffLeft(this.buffLeft());
    this.community.update(dt, this.forceFireworks);
    this.lakeFlag.update(dt);
    this.cookout.update(dt);

    const now = performance.now();
    let pose = this.fishing.poseName();
    // emotes play for their full length in game time, even if a frame stalls
    if (this.myEmote) { this.myEmote.left -= dt; if (this.myEmote.left <= 0) this.myEmote = null; }
    if (this.myEmote && pose === 'idle' && !pl.moving) pose = this.myEmote.id === 'showoff' ? 'hold' : this.myEmote.id;
    if (pl.afk && pose === 'idle') pose = 'sleep';
    // An emote ends as soon as you walk or row off
    if (this.myEmote && pl.moving) this.myEmote = null;
    if (this.treasure.dig) pose = 'dig';
    if (this.selfie.active) pose = this.selfie.pose;
    if (this.cookout.active) pose = 'roast';
    if (this.cookout.eating) pose = 'eat';
    this.pose = pose;
    // The rod is in your hands while fishing, or walking about with it out; otherwise it rides on your back.
    const fishingNow = this.fishing.state !== 'idle';
    this.rodPlace = fishingNow || (!this.rodStowed && pl.mode === 'shore') ? 'hand' : 'back';
    this.actor.update(dt, t, { x: pl.pos.x, y: pl.pos.y, z: pl.pos.z, yaw: pl.yaw, mode: pl.mode, pose, moving: pl.moving, bobber: this.fishing.bobberState(), power: this.fishing.power, tension: this.tugTension(), lean: this.fishing.state === 'reeling' ? this.rodAim || 0 : 0, rod: this.rodPlace, seat: this.chairs.seat ? this.chairs.seat.h || SEAT_H : 0, seatYaw: this.chairs.seat?.yaw, running: pl.sprint && pl.moving && pl.mode === 'shore' && !this.bikes.riding, passenger: !!this.riding, bike: this.bikes.state() });
    this.cookout.afterActor(dt);

    this.places.update(dt);
    this.wpInfo = this.waypoint.update(dt, t);

    // Personal lights after dark: you first, then the anglers nearest the camera
    {
      const cam = this.engine.camera.position;
      const list = [{ actor: this.actor, d: -1 }];
      for (const r of this.remotes.list.values()) if (r.actor.root.visible) list.push({ actor: r.actor, d: r.pos.distanceToSquared(cam) });
      for (const n of this.npcs.list) if (n.actor.root.visible) list.push({ actor: n.actor, d: n.pos.distanceToSquared(cam) });
      list.sort((a, b) => a.d - b.d);
      this.nightLights.update(dt, t, this.engine.sky.night || 0, list);
    }

    // Boat wake + oar sounds
    if (pl.mode === 'boat' && pl.moving) {
      if (Math.random() < dt * 20) this.fx.wake(new THREE.Vector3(pl.pos.x, WATER_Y + 0.05, pl.pos.z), pl.dir);
      this.rowT = (this.rowT || 0) + dt;
      if (this.rowT > 1.05) { this.rowT = 0; this.audio.sfx('row', { pan: Math.random() < 0.5 ? -0.4 : 0.4 }); }
    }
    // Chimney smoke, campfire embers, falls mist
    this.smokeT += dt;
    if (this.smokeT > 0.25) {
      this.smokeT = 0;
      this.fx.smoke(this.engine.props.chimney);
      this.fx.ember(this.engine.props.campfire);
      if (this.engine.props.campfire2) this.fx.ember(this.engine.props.campfire2);
      if (this.engine.props.campfire3) this.fx.ember(this.engine.props.campfire3);
      // the waterfall: mist, spray and rings spreading out where it lands
      const fall = this.engine.props.falls.userData;
      this.fx.mist(fall.foam);
      if (pl.pos.distanceTo(fall.foam) < 60) {
        if (Math.random() < 0.6) this.fx.splash(fall.foam.clone().setY(WATER_Y).add(new THREE.Vector3((Math.random() - 0.5) * 2.4, 0, (Math.random() - 0.5) * 2.4)), 0.45);
        if (Math.random() < 0.35) this.engine.water.ripple(fall.foam.x + (Math.random() - 0.5) * 1.5, fall.foam.z + (Math.random() - 0.5) * 1.5, 0.9);
      }
    }
    // Gus: a gentle idle sway, a peck at the counter now and then, and he turns to face nearby anglers.
    const gus = this.engine.props.gus;
    if (gus) {
      const gt = performance.now() / 1000;
      const dx = pl.pos.x - gus.position.x, dz = pl.pos.z - gus.position.z;
      const near = dx * dx + dz * dz < 64;
      // He stays mostly side-on (a heron reads best in profile) and turns a little toward visitors.
      const base = -0.45;
      let toward = Math.atan2(-dz, dx) - base; toward = Math.atan2(Math.sin(toward), Math.cos(toward));
      const want = base + (near ? Math.max(-0.6, Math.min(0.6, toward * 0.5)) : Math.sin(gt * 0.2) * 0.3);
      let d = want - gus.rotation.y; d = Math.atan2(Math.sin(d), Math.cos(d));
      gus.rotation.y += d * Math.min(1, dt * 3);
      const peck = Math.max(0, Math.sin(gt * 0.9) - 0.94) * 6;
      gus.userData.body.rotation.x = peck * 0.45 + Math.sin(gt * 1.3) * 0.03; // lean forward to peck
    }
    // Feeding schools + ambient fish
    const L = this.engine.water.uniforms.uLight.value;
    this.swirls.update(t, (L.r + L.g + L.b) / 3, dt);
    const scare = [];
    const bs = this.fishing.bobber;
    if (bs && !bs.flying) scare.push({ x: bs.x, z: bs.z });
    if (pl.mode === 'boat') scare.push({ x: pl.pos.x, z: pl.pos.z });
    this.ambient.update(dt, t, pl.pos, scare);
    if (pl.mode === 'boat' && swirlAt(pl.pos.x, pl.pos.z)) {
      if (!this.inSwirl) {
        this.inSwirl = true;
        let seen = false; try { seen = localStorage.getItem('rt_swirl_tip') === '1'; localStorage.setItem('rt_swirl_tip', '1'); } catch { /* private mode */ }
        if (!seen || !this.swirlTipShown) this.ui.toast('A feeding school! Rare fish are in among them. Cast into it from your boat.', { icon: 'star', ms: 5000 });
        this.swirlTipShown = true;
      }
    } else this.inSwirl = false;
    // Lily pads bob
    for (const lp of this.engine.props.lilypads.children) lp.position.y = WATER_Y + 0.03 + Math.sin(t * 1.2 + lp.userData.phase) * 0.02;

    this.remotes.update(dt, t);
    this.npcs.update(dt, t);
    this.party.tick(dt); this.socialChecks(dt);
    this.ui.setPatient?.(this.patientAngler() ? this.claude.elapsed() : null); // v1.12.1
    this.fx.update(dt);
    const focus = new THREE.Vector3(pl.pos.x, pl.pos.y + 0.8, pl.pos.z);
    const sky = this.engine.sky.update(dt, t, focus, this.engine.water, this.engine.props);
    this.events.update(dt, t);
    this.living.update(dt, t);
    this.engine.props?.groundCover?.update(dt, this.player.pos);
    this.engine.props?.cave?.update(dt, t, this.player.pos, this.engine.sky);
    this.cullT = (this.cullT || 0) - dt;
    if (this.cullT <= 0) { this.cullT = 0.25; updateCulling(this.engine.camera.position, this.engine.quality, this.engine.scene); }
    { // v1.13.19: small things cast shadows only near you (your own angler always does)
      const mine = this._mine || (this._mine = new Set());
      updateShadowCasters(dt, this.engine.scene, pl.pos, (o) => { if (!mine.size || this._mineT !== this.actor.root.children.length) { mine.clear(); this.actor.root.traverse((m) => mine.add(m)); this._mineT = this.actor.root.children.length; } return mine.has(o); });
    }
    this.pet.update(dt, t);
    this.bikes.update(dt, t);
    this.buzz.update(dt, t);
    this.wildlife?.update(dt, t, pl.pos, pl.mode === 'boat', this.audio);
    this.fauna?.update(dt, t, pl.pos, this.engine.camera);
    this.skyNews(sky.wt);
    this.engine.cam.dist = (this.fishing.state === 'reeling' ? 9 : pl.mode === 'boat' ? 13 : 11.5);
    if (this.dialogue.active) this.dialogue.updateCamera(dt);
    else if (this.selfie.active) this.selfie.updateCamera(dt);
    else this.engine.updateCamera(dt, focus);
    this.audio.setScene({
      phase: sky.wt.phase, weather: sky.wt.weather,
      nearFire: Math.max(0, 1 - pl.pos.distanceTo(this.engine.props.campfire) / 9),
      nearFalls: Math.max(0, 1 - Math.hypot(pl.pos.x - FALLS_C.x, pl.pos.z - FALLS_C.z) / 18),
      region: this.lastRegion,
    });
    this.audio.setDuck(this.fishing.state === 'reeling' || this.ui.revealCard?.isConnected);
    this.ui.update();

    // Network state at 5 Hz (1 Hz when AFK)
    this.sendTimer -= dt;
    if (this.net?.connected && this.sendTimer <= 0) {
      this.sendTimer = pl.afk ? 1 : 0.2;
      this.net.sendState({ x: +pl.pos.x.toFixed(2), y: +pl.pos.y.toFixed(2), z: +pl.pos.z.toFixed(2), yaw: +pl.yaw.toFixed(2), mode: pl.mode, pose, rod: this.rodPlace, moving: pl.moving, bobber: this.fishing.bobberState(), tension: +this.tugTension().toFixed(2), lean: this.fishing.state === 'reeling' ? +(this.rodAim || 0).toFixed(2) : 0, afk: pl.afk, seat: this.chairs.seat ? +(this.chairs.seat.h || SEAT_H).toFixed(2) : 0, seatYaw: this.chairs.seat ? +this.chairs.seat.yaw.toFixed(3) : undefined, run: pl.sprint && pl.moving && pl.mode === 'shore' && !this.bikes.riding ? 1 : 0, ride: this.riding || undefined, bk: this.bikes.riding ? this.bikes.equipped : undefined, bs: this.bikes.riding ? +this.bikes.steer.toFixed(2) : undefined, bv: this.bikes.riding ? +this.bikes.v.toFixed(1) : undefined });
    }
  }

  skyNews(wt) {
    const k = `${wt.weather}|${wt.phase}|${wt.bloodMoon}`;
    if (!this.lastSky) { this.lastSky = { weather: wt.weather, phase: wt.phase, blood: wt.bloodMoon }; if (wt.bloodMoon) this.chat.system('A Blood Moon hangs over the valley. Piranhas and other hunters are biting: fast bites, fierce fights.', 'weather', { popup: true }); return; }
    if (k === `${this.lastSky.weather}|${this.lastSky.phase}|${this.lastSky.blood}`) return;
    const W = { clear: 'The skies cleared up.', overcast: 'Clouds rolled in. Grayling are rising, and fish fight a touch harder.', rain: 'Rain is falling. Fish fight harder, but rain fish like the Drizzle Dace are biting.', storm: 'A storm is brewing! The hardest fights, rare bites up, and Thunder Bass are out.' };
    const P = { dawn: 'Dawn breaks over the cove.', day: 'Good morning, anglers.', dusk: 'The sun is setting. Dusk fish are stirring.', night: wt.bloodMoon ? 'A Blood Moon rises! Piranhas and other hunters are biting: fast bites, fierce fights.' : wt.fullMoon ? 'Night falls under a full moon. Rare fish are bolder.' : 'Night falls. The lanterns are lit.' };
    if (wt.bloodMoon && wt.phase === this.lastSky.phase && !this.lastSky.blood) this.chat.system(P.night, 'weather', { popup: true });
    if (wt.weather !== this.lastSky.weather) this.chat.system(W[wt.weather] || 'The weather changed.', 'weather', { popup: true });
    if (wt.phase !== this.lastSky.phase) this.chat.system(P[wt.phase] || '', 'weather');
    this.lastSky = { weather: wt.weather, phase: wt.phase, blood: wt.bloodMoon };
  }

  socialChecks(dt) {
    this.socialT = (this.socialT || 0) - dt;
    if (this.socialT > 0) return;
    this.socialT = 2;
    this.trophies.tick();
    this.waystones.tick();
    this.quests.tick();
    this.derby.tick();
    this.living.tick();
    this.events.tick();
    this.gear.sync();
    if (Math.random() < 0.02) this.traits.prune();
    const reg = regionName(this.player.pos.x, this.player.pos.z);
    if (reg !== this.lastRegion) {
      if (this.lastRegion !== undefined && reg !== 'Five Lakes Valley' && reg !== 'Cozy Cove') this.ui.toast(reg, { title: 'Now entering', icon: 'star', ms: 2600 });
      this.lastRegion = reg;
    }
    if (this.remotes.within(this.player.pos, 4) >= 2 && !(this.profile.stats.goodCompany > 0)) { this.bumpStat('goodCompany'); }
    if (this.player.mode === 'boat') {
      for (const r of this.remotes.boatsNear(this.player.pos, 2.6)) {
        const last = this.raftCooldown.get(r.id) || 0;
        if (Date.now() - last > 60000) {
          this.raftCooldown.set(r.id, Date.now());
          this.bumpStat('raftUps');
          this.ui.toast(`Rafted up with ${r.peer.meta?.name || 'a friend'}. Good company: bites come a little faster.`);
        }
      }
    }
  }

  // ---------------- world helpers ----------------
  nearCabin() { return this.player.mode === 'shore' && Math.hypot(this.player.pos.x - CABIN.door.x, this.player.pos.z - CABIN.door.z) < 4.5; }
  nearBoard() { return this.player.mode === 'shore' && Math.hypot(this.player.pos.x - BOARD.x, this.player.pos.z - BOARD.z) < 3.5; }
  nearTrophy() { return this.player.mode === 'shore' && Math.hypot(this.player.pos.x - TROPHY.front.x, this.player.pos.z - TROPHY.front.z) < 3.4; }
  nearRack() { return false; } // the boat rack is gone: boats launch from any shore

  currentZoneLabel() {
    const b = this.fishing.bobber;
    if (b && !b.flying) {
      const z = zoneAt(b.x, b.z);
      const eff = R.effectiveZone(z, this.profile.level, this.engine.sky.state.phase, this.perks());
      if (!z) return '';
      const sp = spotAt(b.x, b.z);
      if (sp && sp.lake === z) return sp.tier === 'deep' ? `Deep end · ${ZONES[z]?.name || ''}` : `${sp.name.replace(/^the /, 'The ')} · ${ZONES[z]?.name || ''}`;
      if (eff !== z) return `${ZONES[z].name} (fishing like ${ZONES[eff].name} until level ${z === 'ruins' ? R.RUINS_LEVEL : R.DEEP_LEVEL})`;
      if (swirlAt(b.x, b.z)) return this.player.mode === 'boat' ? `${ZONES[z].name} · Feeding school! Rare odds up` : ZONES[z].name;
      return ZONES[z].name;
    }
    if (this.player.mode === 'boat') return `Rowing · ${ZONES[zoneAt(this.player.pos.x, this.player.pos.z)]?.name || ''}`;
    return regionName(this.player.pos.x, this.player.pos.z);
  }

  contextActions() {
    const acts = [];
    if (this.home.active) return acts;
    if (this.holders.canProp()) acts.push(...this.holders.contextActions().filter((a) => a.id === 'prop-rod'));
    if (this.fishing.busy) return acts;
    acts.push(...this.holders.contextActions().filter((a) => a.id !== 'prop-rod'));
    acts.push(...this.treasure.contextActions());
    acts.push(...this.chairs.contextActions());
    acts.push(...this.social.contextActions());
    acts.push(...this.quests.contextActions());
    acts.push(...this.lakeFlag.contextActions());
    acts.unshift(...this.living.contextActions()); // v1.9.10 the rainbow's pot of gold
    acts.unshift(...this.cookout.contextActions());
    const gearActs = this.gear.contextActions();
    acts.push(...gearActs.filter((a) => !a.id.startsWith('set-')));
    const ws = this.waystones.near();
    if (ws && this.player.mode === 'shore') acts.push({ id: `ws-${ws.id}`, label: 'Waystone: travel', color: 'blue', at: ws.at ? { x: ws.at.x, z: ws.at.z, y: heightAt(ws.at.x, ws.at.z), h: 2.6 } : null, fn: () => { this.ui.sheets.state.mapTab = 'travel'; this.ui.sheets.open('map'); } });
    if (this.player.mode === 'shore' && Math.hypot(this.player.pos.x - HOME_DOOR.x, this.player.pos.z - HOME_DOOR.z) < 2.2) acts.push({ id: 'home-door', label: 'Go inside', color: 'green', at: { x: HOME_DOOR.x, z: HOME_DOOR.z + 0.9, y: heightAt(HOME_DOOR.x, HOME_DOOR.z), h: 2.4 }, fn: () => this.home.enter() });
    if (this.nearCabin()) acts.push({ id: 'shop', label: "Gus's shop", color: 'gold', at: { x: CABIN.door.x, z: CABIN.door.z, y: heightAt(CABIN.door.x, CABIN.door.z), h: 2.6 }, fn: () => this.ui.sheets.open('shop') });
    acts.push(...this.bikes.contextActions());
    acts.push(...this.buzz.contextActions());
    if (this.nearTrophy()) acts.push({ id: 'legends', label: 'Lake Legends', color: 'gold', at: { x: TROPHY.x, z: TROPHY.z, y: heightAt(TROPHY.x, TROPHY.z), h: 3.2 }, fn: () => this.ui.sheets.open('legends') });
    if (this.nearBoard()) acts.push({ id: 'board', label: 'Notice board', at: { x: BOARD.x, z: BOARD.z, y: heightAt(BOARD.x, BOARD.z), h: 2.9 }, fn: () => this.ui.sheets.open('board') });
    if (this.launchSpot()) {
      if (this.profile.level >= R.BOAT_LEVEL) acts.push({ id: 'launch', label: 'Launch boat', color: 'blue', fn: () => this.launchBoat() });
      else acts.push({ id: 'launch-lock', label: `Boat at Lv ${R.BOAT_LEVEL}`, fn: () => this.ui.toast(`Rowboats unlock at level ${R.BOAT_LEVEL}. Keep fishing from the dock!`) });
    }
    if (this.riding) {
      const host = this.remotes.byMeta(this.riding);
      acts.push({ id: 'hopout', label: this.player.nearShore() ? 'Hop out' : 'Hop out into your own boat', color: 'green', fn: () => this.hopOut() });
      return acts.filter((a) => ['hopout'].includes(a.id) || !['launch', 'ashore'].includes(a.id));
    }
    // a friend's boat right beside you, with the front seat free
    // v1.11: only your party members' boats (strangers can't hop in)
    const hostBoat = this.remotes.boatsNear(this.player.pos, 3.4).find((r) => !this.remotes.hasPassenger(r.peer.meta?.id) && this.party.has(r.peer.meta?.id));
    if (hostBoat && !this.fishing.busy) acts.unshift({ id: `hopin-${hostBoat.id}`, label: `Hop in ${hostBoat.peer.meta?.name || 'their'}'s boat`, color: 'blue', fn: () => this.hopIn(hostBoat) });
    if (this.player.mode === 'boat' && this.player.nearShore()) acts.push({ id: 'ashore', label: 'Go ashore', color: 'green', fn: () => this.disembark() });
    acts.push(...gearActs.filter((a) => a.id.startsWith('set-')));
    if (this.nearRack() || this.nearBoard()) acts.push({ id: 'gearbox', label: 'Gear box', fn: () => { this.ui.sheets.state.shopTab = 'box'; this.ui.sheets.open('shop'); } });
    return acts.slice(0, 4);
  }

  // Where a boat would go in from here: off a dock or jetty, or straight off any stretch of shore with
  // rowable water a few steps out (the nearest such spot, favouring the way you're facing).
  launchSpot() {
    const pl = this.player;
    if (pl.mode !== 'shore') return null;
    const dock = launchPointNear(pl.pos.x, pl.pos.z, 1.5);
    if (dock) return dock;
    const now = performance.now();
    if (this._launchCache && now - this._launchCache.t < 250 && Math.hypot(this._launchCache.x - pl.pos.x, this._launchCache.z - pl.pos.z) < 0.3) return this._launchCache.spot;
    let best = null, bestScore = 1e9;
    const fx = Math.sin(pl.yaw), fz = Math.cos(pl.yaw);
    for (let r = 1.5; r <= 6; r += 0.75) {
      for (let a = 0; a < 24; a++) {
        const ang = (a / 24) * Math.PI * 2, dx = Math.sin(ang), dz = Math.cos(ang);
        const x = pl.pos.x + dx * r, z = pl.pos.z + dz * r;
        if (!boatable(x, z) || onDock(x, z) || blocked(x, z, 0.9, 'boat')) continue;
        const score = r - (dx * fx + dz * fz) * 1.2;
        if (score < bestScore) { bestScore = score; best = { x, z }; }
      }
      if (best && r >= 3) break;
    }
    this._launchCache = { t: now, x: pl.pos.x, z: pl.pos.z, spot: best };
    return best;
  }
  canLaunchHere() { return !!this.launchSpot(); }

  walkToCabin() { this.player.setTarget(CABIN.front.x, CABIN.front.z); this.ui.toast('Walking to the cabin…'); }

  launchBoat() {
    const at = this.launchSpot() || COVE_LAUNCH;
    this.fishing.cancel();
    const from = { x: this.player.pos.x, z: this.player.pos.z };
    this.player.launchBoat(at);
    this.player.yaw = Math.atan2(at.x - from.x, at.z - from.z); // nose out from the shore
    this.actor.setMode('boat');
    this.audio.sfx('row');
    this.fx.splash(new THREE.Vector3(this.player.pos.x, WATER_Y, this.player.pos.z), 1);
    this.bumpStat('boatLaunches');
    if (!this.profile.stats.boatLaunches || this.profile.stats.boatLaunches <= 1) this.ui.toast('Click the water to row there, WASD works too. Open Water and The Deep are boat-only.');
  }

  // ---- riding in a friend's boat: you sit on the front thwart, they row, you both fish
  hopIn(r) {
    if (!r?.peer?.meta?.id) return;
    this.fishing.cancel();
    this.holders?.clear();
    this.riding = r.peer.meta.id;
    this.player.mode = 'boat'; this.player.target = null;
    this.actor.setMode('boat');
    this.audio.sfx('flop');
    this.ui.toast(`You hopped into ${r.peer.meta.name || 'their'}'s boat. They row; you can fish. Press E to hop out.`, { icon: 'boat', ms: 4500 });
    this.chat.system(`You're riding with ${r.peer.meta.name || 'a friend'}.`, 'join');
  }
  hopOut(why = '') {
    if (!this.riding) return;
    this.riding = null;
    this.fishing.cancel();
    if (this.player.disembark()) { this.actor.setMode('shore'); this.audio.sfx('flop'); }
    else { this.player.mode = 'boat'; this.actor.setMode('boat'); this.ui.toast('Too far from shore to hop out, so you took out your own boat.', { icon: 'boat' }); }
    if (why) this.ui.toast(why, { icon: 'boat' });
  }
  /** Keep a passenger on the host's front seat (called every frame). */
  updateRide() {
    if (!this.riding) return;
    const r = this.remotes.byMeta(this.riding);
    const s = r?.peer?.state;
    if (!r || !s) { this.hopOut('Your ride left the lake.'); return; }
    if (!this.party.has(this.riding)) { this.hopOut('You are no longer in their party, so you hopped out.'); return; }
    if (s.mode !== 'boat') { this.hopOut(`${r.peer.meta?.name || 'Your friend'} went ashore, so you hopped out too.`); return; }
    const fx = Math.sin(r.yaw), fz = Math.cos(r.yaw);
    this.player.pos.set(r.pos.x + fx * 0.45, WATER_Y, r.pos.z + fz * 0.45);
    this.player.yaw = r.yaw; // face where the boat faces: sit still in the seat as it turns
    this.player.target = null;
    this.player.moving = false;
  }

  disembark() {
    if (this.riding) { this.hopOut(); return; }
    this.fishing.cancel();
    if (this.player.disembark()) { this.actor.setMode('shore'); this.audio.sfx('flop'); }
  }

  // ---------------- catches ----------------
  onBobberLanded(ctx) {
    // a cast into a feeding school from the boat: remember the school; only a fish landed from it counts
    // toward scattering it (v1.8.2)
    const sw = this.player.mode === 'boat' && this.fishing.bobber && swirlAt(this.fishing.bobber.x, this.fishing.bobber.z);
    this.castSwirl = sw || null;
    if (sw) this.quests.progress('swirlcast', {});
    if (ctx.rawZone === 'ruins' && ctx.zone !== 'ruins' && !this.gateToastShown) {
      this.gateToastShown = true;
      this.ui.toast('The Sunken Ruins only stir at night. By day they fish like The Deep.');
    }
  }

  /** A fish landed out of a feeding school: one of its catches is used (shared with everyone). */
  schoolCatch(sw) {
    noteSwirlCatch(sw.id);
    const mine = (this.swirlMine.get(sw.id) || 0) + 1;
    this.swirlMine.set(sw.id, mine);
    const uid = String(this.save.userId || 'me').replace(/[^A-Za-z0-9_-]/g, '').slice(0, 40);
    this.shared.set?.('swirls', `${sw.id.replace(/:/g, '-')}-${uid}`, { pool: sw.id, n: mine, at: Date.now() }).catch?.(() => {});
    const left = swirlCatchesLeft(sw);
    this.ui.toast(left > 0 ? `Feeding school: ${left} more fish before it scatters.` : 'That was the last fish in that school. It\'s scattering.', { icon: 'waves', ms: 2600 });
  }

  async onLanded(bite, ctx) {
    const wt = this.engine.sky.state;
    if (bite.kind === 'junk') {
      const out = await this.save.recordJunk(bite.junkId);
      if (bite.junkId === 'bottle' && Math.random() < 0.6) { const pb = this.bottles.find(); if (pb) { out.message = pb.text; out.playerBottle = pb; } }
      this.audio.sfx(bite.junkId === 'chest' ? 'coin' : 'plip');
      await this.ui.showJunk(out);
      if (out.levelUp) this.onLevelUp(out.levelUp);
      await this.autoClaim();
      return;
    }
    const c = {
      id: newId(), speciesId: bite.speciesId, variant: bite.variant, weight: bite.weight,
      zone: ctx.zone, phase: wt.phase, weather: wt.weather, fullMoon: wt.fullMoon, ts: Date.now(), waitCatch: this.fromClaude || this.claude.working || !!bite.answer, answer: !!bite.answer,
      bait: bite.bait || null,
    };
    let summary;
    try { summary = await this.save.recordCatch(c); }
    catch (e) { console.error(e); this.ui.toast(`Couldn't save that catch: ${e.message || 'network error'}. It's still yours to admire.`); return; }
    const sp = SPECIES_BY_ID[c.speciesId];
    c.id = summary.catchId || c.id;
    if (c.answer) { this.claude.consume(); this.bumpStat('answerCatches'); this.juice.pop("Claude's Catch!", { color: '#ffc850', size: 34 }); this.answerStreakUp(); }
    else if (this.claude.working) {
      this.claude.waitFish = (this.claude.waitFish || 0) + 1;
      this.ext.bump('waitFish');
      this.claude.reportLake(this.claude.waitFish, this.ext.d.stats.waitFish || 0);
    }
    this.lastCatch = c;
    if (this.castSwirl) { this.schoolCatch(this.castSwirl); this.castSwirl = null; }
    c.traits = this.traits.onCatch(c);
    if (c.bait) this.ext.bump('baitCatches');
    this.quests.progress('catch', { ...c, fromHolder: !!this.fishing.fromHolder });
    this.fishing.fromHolder = false;
    this.derby.onCatch(c);
    this.community.onCatch().catch(() => {});
    this.lakeFlag.onCatch(c);
    this.collections.check(c);
    this.social.onCatch(c);
    this.social.onLanded(c);
    this.actor.showHeld(c.speciesId, c.variant, c.weight, 30);
    this.myBubble = null;
    this.audio.sfx('reveal', { tier: sp.tier, variant: c.variant });
    if (c.variant !== 'normal' || ['legendary', 'mythic'].includes(sp.tier)) this.fx.sparkle(this.actor.headWorld(), c.variant === 'diamond' ? '#a0f0ff' : '#ffe080', 30);
    if (c.variant === 'diamond' || sp.tier === 'mythic') this.fx.column(new THREE.Vector3(this.player.pos.x, WATER_Y, this.player.pos.z), c.variant === 'diamond' ? '#a0f0ff' : '#ff9ae8');
    this.netEvent('catch', { speciesId: c.speciesId, variant: c.variant, weight: c.weight, tier: sp.tier, zone: c.zone });
    if (R.isGreatCatch(c)) {
      this.lastGreat = { id: c.id, at: Date.now(), label: `${c.variant === 'diamond' ? 'Diamond ' : c.variant === 'gold' ? 'Gold ' : ''}${sp.name}` };
      this.ext.change((d) => { d.stats.lastGreatLabel = this.lastGreat.label; });
    }
    this.trophies.onCatch(c).catch(() => {});
    const action = await this.ui.showReveal(summary, c);
    this.actor.clearHeld();
    if (action === 'release') { await this.save.release(c.id); this.quests.progress('release'); this.fx.splash(new THREE.Vector3(this.player.pos.x + Math.sin(this.player.yaw) * 1.5, WATER_Y, this.player.pos.z + Math.cos(this.player.yaw) * 1.5), 0.6); this.ui.toast('Released. Good karma +1'); }
    else if (action === 'sell') { const r = await this.save.sell([c.id]); this.audio.sfx('coin'); this.ui.toast(`Sold for ${r.coins} coins`, { icon: 'coin' }); }
    else if (action === 'selfie') this.selfie.start(c);
    else if (action === 'trade') { const r = await this.save.trade(c.id); if (r.ok) { this.audio.sfx('coin'); this.ui.toast(`Traded for ${r.pearls} pearls`, { icon: 'pearl' }); } }
    if (summary.levelUp) this.onLevelUp(summary.levelUp);
    if ((this.profile.catchCount || 0) === 3) this.ui.toast('Tip: sell fish and buy gear at the cabin. Diamond fish trade for Pearls!', { ms: 5000 });
    await this.autoClaim();
    this.pushMeta();
    this.treasure.onCatch(); // sometimes a map comes up with the fish
  }

  onLevelUp(level) {
    this.audio.sfx('levelup');
    // v1.12: everything that opened between your last level and this one
    const from = Math.min(level - 1, this.ext.d.levelSeen || level - 1);
    const opened = [];
    for (let L = from + 1; L <= level; L++) opened.push(...unlocksAt(L));
    this.ext.change((d) => { d.levelSeen = level; });
    const next = nextUnlock(level);
    this.chat.system(`You reached level ${level}!${opened.length ? ` New: ${opened.map((u) => u.what).join(', ')}.` : ''}`, 'level');
    this.ui.levelCard?.(level, opened, next);
    for (let L = from + 1; L <= level; L++) if (LEVEL_REWARDS[L]) this.claimLevelReward(L);
    this.pushMeta();
  }
  /** v1.12: the reward every 5 levels from 25 (claimed once; the Journal lists any you're owed). */
  async claimLevelReward(L) {
    const rw = LEVEL_REWARDS[L];
    if (!rw || this.profile.level < L || this.ext.d.levelRewards?.[L]) return;
    const r = await this.reward('level', `lv${L}`, rw, `Level ${L} reward`);
    if (r?.ok !== false) this.ext.change((d) => { d.levelRewards = { ...(d.levelRewards || {}), [L]: Date.now() }; });
  }
  /** v1.13: a cast into water above your level came back. The first time at each lake (until you've looked
   *  at the lake levels on the map or in the Journal), a card explains; after that a toast does. */
  lakeGateFailed(gate) {
    const d = this.ext.d, lake = gate.lake, nm = gate.name.replace(/^the /, 'The ');
    if (!d.lakeLevelsSeen && !d.gateCards?.[lake]) {
      this.ext.change((x) => { x.gateCards = { ...(x.gateCards || {}), [lake]: Date.now() }; });
      this.ui.gateCard(gate, LAKE_LEVELS[lake], LAKE_NAMES[lake]);
    } else {
      const now = Date.now();
      if (now - (this.lastGateToast || 0) > 2500) { this.lastGateToast = now; this.ui.toast(`${gate.tier === 'base' ? LAKE_NAMES[lake] : gate.tier === 'deep' ? `${LAKE_NAMES[lake]}'s deep end` : nm} needs fishing level ${gate.level}. You're level ${this.profile.level}.`, { icon: 'lock' }); }
    }
  }
  /** v1.13: the lake levels have been seen (the map or the Journal's Lakes section was opened). */
  sawLakeLevels() { if (!this.ext.d.lakeLevelsSeen) this.ext.change((x) => { x.lakeLevelsSeen = Date.now(); }); }

  /** v1.12: point your waypoint at a lake's deep end or landmark. */
  markSpot(id) {
    const s = SPOTS.find((x) => x.id === id);
    if (!s) return;
    const nm = s.tier === 'deep' ? `${LAKE_NAMES[s.lake]} deep end` : s.name.replace(/^the /, 'The ');
    this.ext.change((d) => { d.waypoint = { x: Math.round(s.x), z: Math.round(s.z), name: nm }; });
    this.waypoint?.sync?.();
    this.ui.toast(`Waypoint set: ${nm}.`, { icon: 'pin' });
  }

  async autoClaim() {
    for (const a of R.claimableAchievements(this.profile)) {
      const got = await this.save.claim(a.id);
      if (got) { this.audio.sfx('achievement'); this.ui.achievementToast(got); this.chat.system(`Achievement unlocked: ${got.name}`, 'achievement'); }
    }
    this.ui.sheets.refresh();
  }
  async claim(id) { const a = await this.save.claim(id); if (a) { this.audio.sfx('achievement'); this.ui.achievementToast(a); } this.pushMeta(); }
  async claimAll() { await this.autoClaim(); this.pushMeta(); }

  async bumpStat(key, n = 1) { await this.save.bumpStat(key, n); await this.autoClaim(); }

  // ---------------- actions used by UI ----------------
  async sell(ids) { const r = await this.save.sell(ids); if (r.coins) { this.audio.sfx('coin'); this.ui.toast(`Sold ${r.sold} for ${r.coins} coins`, { icon: 'coin' }); } return r; }
  async trade(id) { const r = await this.save.trade(id); if (r.ok) { this.audio.sfx('coin'); this.ui.toast(`+${r.pearls} pearls`, { icon: 'pearl' }); } else this.ui.toast(r.reason); return r; }
  async release(id) { const r = await this.save.release(id); this.quests.progress('release'); this.ui.toast('Released. +5 XP'); if (r.levelUp) this.onLevelUp(r.levelUp); await this.autoClaim(); return r; }
  async moveCatch(id, to) { const ok = await this.save.moveCatch(id, to); if (!ok) this.ui.toast(to === 'creel' ? 'Your backpack is full.' : 'Storage is full.'); return ok; }
  async buy(itemId) {
    if (!this.nearCabin()) { this.ui.toast('Visit Gus at the cabin to buy.'); return; }
    const r = await this.save.buy(itemId);
    if (r.ok) {
      this.audio.sfx('purchase');
      this.ui.toast(`Bought ${r.item.name}!`, { icon: 'shop' });
      if (['rod', 'lure', 'boat'].includes(r.item.kind)) await this.equip(r.item.kind, itemId);
      await this.autoClaim();
    } else this.ui.toast(r.reason);
    return r;
  }
  async equip(slot, itemId) { const ok = await this.save.equip(slot, itemId); if (ok) { this.audio.sfx('click'); this.pushMeta(); } return ok; }
  async setTitle(t) { await this.save.setTitle(t); this.pushMeta(); }
  async setName(n) { await this.save.setName(n); this.pushMeta(); }
  async saveSettings(s) { await this.save.saveSettings(s); this.applySettings(); }
  leaderboard(kind, period) { return this.save.leaderboard(kind, period); }
  records() { return this.save.records(); }
  async react(entry, emoji) { await this.save.react(entry.id, emoji); this.audio.sfx('click'); await this.autoClaim(); }

  applySettings() {
    const s = this.profile.settings;
    this.audio.setVolumes({ master: s.master, music: s.music, sfx: s.sfx, ambience: s.ambience, others: s.others });
    const q = new URLSearchParams(location.search).get('gfx') || s.graphics;
    if (this.engine.quality !== q) this.engine.setQuality(q);
    this.engine.autoRes = s.autoRes !== false; // v1.13.19
    document.body.classList.toggle('reduced', !!s.reducedMotion);
    document.body.classList.toggle('cb', !!s.colorBlind);
    this.uiRoot.style.setProperty('--ui-scale', String(Math.max(0.8, Math.min(1.4, s.uiScale || 1))));
    document.documentElement.style.setProperty('--text-scale', String(Math.max(0.9, Math.min(1.5, s.textScale || 1))));
    if (this.ui?.captions) this.ui.captions.on = !!s.captions;
  }

  emote(id) {
    this.audio.unlock();
    const now = performance.now();
    // Put the line away first (an emote while the bobber is out reels in); mid-catch, finish first.
    const st = this.fishing.state;
    if (['charge', 'flying', 'bite', 'reeling', 'landed'].includes(st)) { this.ui.toast('Finish this cast first, then celebrate!'); return; }
    if (st === 'waiting' || st === 'nibble') this.fishing.reelIn();
    this.player.target = null;
    this.player.touch();
    if (id === 'showoff') {
      if (!this.lastCatch) { this.ui.toast('Catch something first, then show it off!'); return; }
      this.actor.showHeld(this.lastCatch.speciesId, this.lastCatch.variant, this.lastCatch.weight, 5);
      this.netEvent('emote', { id, speciesId: this.lastCatch.speciesId, variant: this.lastCatch.variant });
    } else { this.actor.clearHeld(); this.netEvent('emote', { id }); }
    this.myEmote = { id, left: id === 'sleep' ? 6 : id === 'orange' || id === 'dance' ? 5 : 3.4 };
    this.audio.sfx({ wave: 'whistle', cheer: 'cheer', clap: 'clap', sleep: 'yawn', dance: 'cheer', orange: 'cheer' }[id] || 'click');
    this.npcs?.onEmote?.(id);
  }

  remotePlates() {
    // v1.13.11: inside a cabin (walking or in the editor) the outside world's names and bubbles stay outside
    if (this.home?.active) return [];
    // v1.11: everyone else's nameplate shows within NEAR_RANGE (about 40 yards); party members' show at any
    // distance, with a coloured marker, pinned to the screen edge when they're off screen
    const out = [], me = this.player.pos, cam = this.engine.camera;
    for (const r of this.remotes.list.values()) {
      const m = r.peer.meta || {};
      const party = this.party.has(m.id);
      const d = Math.hypot(r.pos.x - me.x, r.pos.z - me.z);
      if (!party && (!r.actor.root.visible || d > NEAR_RANGE)) continue;
      if (party && !r.peer.state) continue;
      const head = r.actor.root.visible ? r.actor.headWorld() : { x: r.pos.x, y: r.pos.y + 2.1, z: r.pos.z };
      let screen = this.engine.toScreen(head), edge = null;
      if (party && (!screen || screen.x < 24 || screen.y < 24 || screen.x > this.engine.width - 24 || screen.y > this.engine.height - 24)) {
        // off screen: point at them from the edge
        const v = new THREE.Vector3(head.x, head.y, head.z).applyMatrix4(cam.matrixWorldInverse);
        const ang = Math.atan2(-v.y, v.x) + (v.z > 0 ? Math.PI : 0);
        const W = this.engine.width, H = this.engine.height, cx = W / 2, cy = H / 2, ex = Math.cos(ang), ey = Math.sin(ang);
        const k = Math.min((cx - 40) / Math.max(1e-3, Math.abs(ex)), (cy - 60) / Math.max(1e-3, Math.abs(ey)));
        screen = { x: cx + ex * k, y: cy + ey * k }; edge = ang;
      }
      out.push({ id: r.id, name: m.name || 'Angler', title: m.title, level: m.lvl, crown: m.crown, screen, bubble: d <= NEAR_RANGE ? r.bubble : null, party: party ? { color: this.party.color(m.id), dist: Math.round(d), edge, leader: this.party.state?.ld === m.id } : null });
    }
    out.push(...this.npcs.plates((v) => this.engine.toScreen(v)));
    out.push(...this.living.plates((v) => this.engine.toScreen(v)));
    out.push(...this.bikes.plates((v) => this.engine.toScreen(v)));
    out.push(...this.buzz.plates((v) => this.engine.toScreen(v)));
    // my own bubbles (chat, zzz) are drawn too
    if (this.myChat && performance.now() < this.myChat.until && !this.player.afk) out.push({ id: 'me', isMe: true, name: '', screen: this.engine.toScreen(this.actor.headWorld()), bubble: { kind: 'chat', text: this.myChat.text, key: this.myChat.key } });
    else if (this.player.afk) out.push({ id: 'me', isMe: true, name: '', screen: this.engine.toScreen(this.actor.headWorld()), bubble: { kind: 'zzz', text: 'z z z', key: 'z' } });
    return out;
  }

  // Quest, derby, festival, collection and tutorial rewards all come through here.
  async reward(kind, key, reward, label = '') {
    let r;
    try { r = await this.save.grant(kind, key, reward); } catch (e) { this.ui.toast(`Couldn't claim that: ${e.message}`); return { ok: false }; }
    if (!r || r.ok === false) { this.ui.toast(r?.reason || 'Already claimed.'); return { ok: false }; }
    const bits = [r.coins ? `+${r.coins} coins` : '', r.pearls ? `+${r.pearls} pearls` : '', r.xp ? `+${r.xp} XP` : '', r.title ? `title “${r.title}”` : ''].filter(Boolean).join(' · ');
    this.audio.sfx('coin');
    this.ui.toast(bits, { icon: 'coin', title: label || 'Reward', ms: 4200 });
    if (r.levelUp) this.onLevelUp(r.levelUp);
    await this.autoClaim();
    this.pushMeta();
    this.ui.sheets.refresh();
    return r;
  }

  // Footstep sounds that match the ground: dock boards, sand, stone, snow or grass.
  footsteps(dt) {
    const pl = this.player;
    if (pl.mode !== 'shore' || !pl.moving || pl.airborne) { this.stepT = 0; return; }
    this.stepT = (this.stepT || 0) + dt * (pl.sprint ? 1.35 : 1);
    if (this.stepT < 0.36) return;
    this.stepT = 0;
    const x = pl.pos.x, z = pl.pos.z, h = heightAt(x, z);
    const reg = this.lastRegion || '';
    const surface = onDock(x, z) ? 'wood' : h <= 1 ? 'sand' : reg === 'Old Quarry' || reg === 'Quarry Shed' || h >= 4 ? 'stone' : reg === 'Frostpine Lake' ? 'snow' : 'grass';
    this.audio.sfx('step', { surface, vol: 0.8 });
  }

  toggleRod() {
    this.rodStowed = !this.rodStowed;
    this.audio.sfx('click');
    this.ui.toast(this.rodStowed ? 'Rod stowed on your back. Casting takes it out again.' : 'Rod in hand.', { ms: 1800 });
    this.ui.setRodButton?.(this.rodStowed);
  }

  // Claude finished: ring the dock bell and send the golden "answer fish" to your line.
  // PRIVATE by design: everything here is local to this player (sound, chat line, toast, splash). Nothing is
  // sent over the net; others only ever see an ordinary catch line (netEvent 'catch' carries no answer flag).
  // v1.13.6: the news (bell, chat line, popup) always lands the moment Claude finishes, whatever you're doing, so
  // you can tab back mid-fight. Only the golden fish itself waits for the current fight to end (releaseAnswerFish).
  answerReady(seconds = 0, steps = 0) {
    this.audio.sfx('bell');
    // v1.12.1: Claude's rewards are capped at 6 an hour (signals are self-reported); past that it's just the bell
    const now = Date.now();
    if (!canReward(this.ext.d.claudeRewards, now)) {
      this.chat.system("Claude's done! Your answer is ready. (That's 6 answer fish this hour, so this one is just the bell.)", 'claude', { popup: true, inline: true });
      return;
    }
    this.ext.change((d) => { d.claudeRewards = [...recentRewards(d.claudeRewards, now), now]; });
    const bonus = turnBonus(seconds, steps);
    if (bonus) this.reward('claude', `t${now}`, bonus, `Big turn: ${steps} steps`);
    const waited = this.claude.waitFish || 0;
    const took = seconds >= 60 ? `${Math.floor(seconds / 60)}m ${seconds % 60}s` : seconds ? `${seconds}s` : '';
    const tierWord = seconds >= 1800 ? 'A legendary golden fish' : seconds >= 600 ? 'A big golden fish' : 'A golden fish'; // v1.12.1 slower curve
    // mid-fight (or the catch card is still up)? the fish waits until this one is in; the news does not
    const busy = ['bite', 'reeling', 'landed'].includes(this.fishing.state) || !!this.ui.revealCard?.isConnected;
    const where = busy ? `will circle your line once this fish is in` : 'is circling your line';
    this.chat.system(`Claude's done${took ? ` (${took})` : ''}! Your answer is ready. ${tierWord} ${where}.${waited ? ` You caught ${waited} fish while you waited.` : ''}`, 'claude', { popup: true, inline: true });
    if (busy) { this.pendingAnswer = seconds; return; }
    this.releaseAnswerFish(seconds);
  }

  // Send the golden answer fish to your line (the news already went out in answerReady).
  releaseAnswerFish(seconds = 0) {
    this.answerSeconds = seconds;
    this.answerPending = true;
    clearTimeout(this.answerT);
    this.answerT = setTimeout(() => { if (this.answerPending) { this.answerPending = false; this.claude.consume(); this.answerLost('swam off'); } }, 90000);
    // a golden leap in the water nearby so you see it even if you're not fishing
    const p = this.player.pos;
    for (let r = 3; r < 14; r += 1) {
      for (let a = 0; a < 12; a++) {
        const ang = this.player.yaw + (a / 12) * Math.PI * 2;
        const x = p.x + Math.sin(ang) * r, z = p.z + Math.cos(ang) * r;
        if (zoneAt(x, z)) { const at = new THREE.Vector3(x, WATER_Y, z); this.fx.splash(at, 1); this.fx.sparkle(at.clone().setY(WATER_Y + 0.6), '#ffe080', 24); this.engine.water.ripple(x, z, 0.6); r = 99; break; }
      }
    }
    if (this.fishing.state === 'idle') this.ui.toast('Your answer is ready! Cast now to catch the golden fish.', { icon: 'bell', title: 'Claude', ms: 6000 });
  }

  // v1.12.1 answer streak: 3 answer fish landed in a row (none lost or left to expire) pays a pearl
  answerStreakUp() {
    const n = (this.ext.d.answerStreak || 0) + 1;
    if (n >= ANSWER_STREAK) {
      this.ext.change((d) => { d.answerStreak = 0; });
      this.juice.pop(`${ANSWER_STREAK} answers in a row!`, { color: '#ffe080', size: 30 });
      this.reward('answerstreak', `a${Date.now()}`, { pearls: 1, xp: 25 }, 'Answer streak');
    } else {
      this.ext.change((d) => { d.answerStreak = n; });
      this.chat.system(`Answer streak ${n}/${ANSWER_STREAK}: land ${ANSWER_STREAK - n} more answer fish in a row for a pearl.`, 'claude');
    }
  }
  answerLost(why = 'got away') {
    if (!(this.ext.d.answerStreak > 0)) return;
    this.ext.change((d) => { d.answerStreak = 0; });
    this.chat.system(`The answer fish ${why}, so your answer streak starts over.`, 'claude');
  }

  tugTension() { const r = this.fishing.reel; return this.fishing.state === 'reeling' && r && !r.junk ? r.tension : this.fishing.state === 'reeling' ? 0.5 : 0; }

  // ---------------- social ----------------
  bubblesOn() { return this.profile.settings.chatBubbles !== false; }
  showChatBubble(from, text, { force = false } = {}) {
    const r = this.remotes.list.get(from);
    if (!r || (!this.bubblesOn() && !force)) return;
    const now = performance.now();
    r.bubble = { kind: 'chat', text: text.length > 70 ? `${text.slice(0, 68)}…` : text, until: now + Math.min(9000, 3500 + text.length * 60), key: now };
  }
  onChatSaid(text, { force = false } = {}) {
    if (!this.bubblesOn() && !force) return;
    const now = performance.now();
    this.myChat = { text: text.length > 70 ? `${text.slice(0, 68)}…` : text, until: now + Math.min(9000, 3500 + text.length * 60), key: now };
  }
  logCatch(name, d, fromFeed = false) {
    const sp = SPECIES_BY_ID[d?.speciesId];
    if (!sp) return;
    const great = d.variant !== 'normal' || ['rare', 'epic', 'legendary', 'mythic'].includes(sp.tier);
    if (!great) return;
    const key = `${name}|${d.speciesId}|${d.weight}`;
    if (this.lastLogged === key) return; // feed + net can both report one catch
    this.lastLogged = key;
    const v = d.variant === 'diamond' ? 'Diamond ' : d.variant === 'gold' ? 'Gold ' : '';
    this.chat.system(`${name} landed a ${v}${sp.name} (${Number(d.weight).toFixed(2)} lb)!`, 'catch');
  }

  async openCreator(firstRun = false) {
    this.ui.closeAll();
    const wasVisible = !this.ui.hud.classList.contains('hidden');
    this.ui.setVisible(false);
    const cfg = await openCreator(this.uiRoot, { avatar: this.profile.avatar, owned: this.profile.owned, name: this.profile.name, firstRun, audio: this.audio });
    this.ui.setVisible(wasVisible);
    if (cfg) { await this.save.saveAvatar(cfg); this.pushMeta(); if (this.started) await this.autoClaim(); }
  }

  showSignIn() { this.auth.showSignIn?.(); }
  async signOut() { await this.save.signOut(); location.reload(); }
}
