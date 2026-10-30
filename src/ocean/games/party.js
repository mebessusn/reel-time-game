// Open Waters stage 4: Beach Games on Palm Key. A lobby board by the jetty lists five party games (volleyball, crab
// races, coconut toss, sandcastles and the cannonball contest); anyone on the crew can host one, the others join, and
// islanders (Lani, Keo and Pua) fill the empty places, so a round works alone too. Rounds are short, for up to four,
// and pay coins and XP by place, with a title and a hat the first time you win each game.
//
// Everything a round needs travels in each player's own network state (state.bg), never in one-off events, so a
// missed packet or a late joiner can't break it:
//   host:   bg.L = the open lobby { id, g, ps, until }   then  bg.R = the round { id, g, seed, ps, t0, w, res? }
//   guest:  bg.J = the lobby I asked to join              then  bg.r = the round I'm playing
//   both:   the game's own fields (scores, castles, the volleyball's latest arc...) beside them.
// Each game is a module (volleyball.js, crabs.js, ...) with the same small interface; see make() in any of them.
import * as THREE from 'three';
import { BEACH_MATS, BEACH_NODES } from '../../data/beachMesh.js';
import { buildNode } from '../meshes.js';
import { PAD_BY_ID, DOCKS, ISLAND_BY_ID, oceanSurfaceY, islandAt } from '../geo.js';
import { SEA, COMPONENTS } from '../waves.js';
import { addCircle } from '../../world/colliders.js';
import { walkY } from '../../world/terrain.js';
import { Actor } from '../../game/actor.js';
import { defaultAvatar } from '../../data/avatarOptions.js';
import { h } from '../../ui/dom.js';
import { icon } from '../../ui/icons.js';
import { rank, prizeFor } from './common.js';
import { FIRST_WIN } from './prizes.js';
import { VOLLEY } from './volleyball.js';
import { CRABS } from './crabs.js';
import { COCONUT } from './coconut.js';
import { CASTLES } from './sandcastle.js';
import { CANNON } from './cannonball.js';

const WATER_Y = 0.85;
export const GAMES = [VOLLEY, CRABS, COCONUT, CASTLES, CANNON];
export const GAME_BY_ID = Object.fromEntries(GAMES.map((x) => [x.id, x]));
export const BG = { LOBBY: 30000, MAX: 4, STALE: 8000, HOST_GONE: 12000, SOLO: 0.6, FULL_DAY: 8, TIRED: 0.25 }; // prizes: 60% against islanders only; a quarter after 8 rounds a day
const ISLANDERS = [
  { name: 'Lani', look: { ...defaultAvatar('female'), skin: 5, hair: 'shoulder', hairColor: 1, mouth: 'grin', eyes: 'happy', hat: 'visor', shirt: 'tank', shirtColor: 9, pants: 'shorts', pantsColor: 7, shoes: 'sandals', accessory: 'shells' } },
  { name: 'Keo', look: { ...defaultAvatar('male'), skin: 6, hair: 'crop', hairColor: 0, facialHair: 'none', mouth: 'smile', eyes: 'content', hat: 'bandana', shirt: 'stripes', shirtColor: 2, pants: 'shorts', pantsColor: 2, shoes: 'sandals' } },
  { name: 'Pua', look: { ...defaultAvatar('female'), skin: 3, hair: 'messy', hairColor: 3, mouth: 'grin', eyes: 'happy', hat: 'sunhat', shirt: 'hawaiian', shirtColor: 8, pants: 'shorts', pantsColor: 9, shoes: 'sandals', accessory: 'lei' } },
];
const GEAR = { rod: 'rod_bamboo', lure: 'lure_classic', boat: 'boat_oak' };
const str = (s, n = 20) => String(s ?? '').slice(0, n);

/** The wind out here as a push on anything thrown (m/s², along the wind sea). */
export function windPush() { const c = COMPONENTS[3], k = (SEA.wind || 0) * 2.2; return { x: c.dx * k, z: c.dz * k, kn: Math.round(4 + (SEA.wind || 0) * 18) }; }

export class BeachGames {
  constructor(game, ow) {
    this.game = game; this.ow = ow;
    this.built = false;
    this.lobby = null; // my lobby (hosting or joined): { id, g, host, hn, ps, until, mine }
    this.round = null; // the round I'm in: { id, g, G, seed, ps, t0, w, host, inst, done }
    this.npcs = [];
    this.gone = new Set(); // rounds and lobbies already finished or turned down
  }
  get d() { return this.game.ext.d.ocean?.games || {}; }
  get me() { return this.game.save.userId; }
  get myName() { return str(this.game.profile.name || 'Angler'); }
  get weather() { return this.game.engine.sky.state.weather || 'clear'; }
  get closed() { return this.weather === 'storm'; }

  // ---------------------------------------------------------------- the beach: board, court, track, buckets, plots, tower, hammock
  build() {
    if (this.built) return;
    this.built = true;
    const scene = this.game.engine.scene;
    const root = new THREE.Group();
    root.name = 'beach-games';
    scene.add(root);
    this.root = root;
    const D = DOCKS.palm, back = { x: -D.ux, z: -D.uz }, side = D.side, yawOut = Math.atan2(D.ux, D.uz);
    this.put = (name, x, z, yaw = 0, y = null, s = 1) => {
      const m = buildNode(BEACH_MATS, BEACH_NODES, name);
      m.position.set(x, y ?? oceanSurfaceY(x, z), z); m.rotation.y = yaw; m.scale.setScalar(s);
      root.add(m);
      return m;
    };
    // the lobby board, facing the jetty
    const bx = D.x0 + back.x * 5 - side.x * 2.6, bz = D.z0 + back.z * 5 - side.z * 2.6;
    this.put('bg_board', bx, bz, yawOut);
    this.board = { x: bx, z: bz, y: oceanSurfaceY(bx, bz) };
    for (const s of [-1, 1]) addCircle(bx + Math.cos(yawOut) * s * 1.1, bz - Math.sin(yawOut) * s * 1.1, 0.25);
    // the volleyball court (net across the middle, the court's long side along x)
    const C = PAD_BY_ID.court;
    this.put('bg_vb_lines', C.x, C.z, 0, C.y);
    const net = this.put('bg_vb_net', C.x, C.z, 0, C.y);
    net.traverse((o) => { if (o.isMesh && o.material.color && o.material.color.r < 0.06) { o.material = o.material.clone(); o.material.transparent = true; o.material.opacity = 0.42; o.material.depthWrite = false; o.castShadow = false; } }); // see through the net
    for (const s of [-1, 1]) addCircle(C.x, C.z + s * 3.9, 0.15);
    // the crab race track (runs along +x)
    const T = PAD_BY_ID.crabs;
    this.put('bg_track', T.x, T.z, Math.PI / 2, T.y);
    // coconut toss: the spares and the throwing line; buckets move each round
    const K = PAD_BY_ID.coconut;
    this.put('bg_coco_pile', K.x - 5.4, K.z, Math.PI / 2, K.y);
    // sandcastle plots, two by two
    const P = PAD_BY_ID.castles;
    this.plots = [[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([a, b], i) => {
      const x = P.x + a * 1.95, z = P.z + b * 1.95;
      this.put('bg_plot', x, z, 0, P.y);
      this.put('bg_pail', x + a * 1.9, z + b * 1.2, i, P.y);
      return { x, z, y: P.y + 0.04 };
    });
    // the diving tower off the end of the jetty (the side away from the boat)
    const tx = D.x0 + D.ux * 15.2 - side.x * 3.3, tz = D.z0 + D.uz * 15.2 - side.z * 3.3;
    this.put('bg_dive_tower', tx, tz, yawOut, WATER_Y - 0.45);
    this.tower = { x: tx, z: tz, yaw: yawOut, top: WATER_Y - 0.45 + 3.97, ux: D.ux, uz: D.uz, foot: { x: D.x0 + D.ux * 15.2 - side.x * 0.7, z: D.z0 + D.uz * 15.2 - side.z * 0.7 } };
    // a hammock up the beach past the loungers
    const hx = D.x0 + back.x * 8 - side.x * 15, hz = D.z0 + back.z * 8 - side.z * 15;
    const hy = oceanSurfaceY(hx, hz), hyaw = yawOut + Math.PI / 2;
    this.put('bg_hammock', hx, hz, hyaw, hy);
    for (const s of [-1, 1]) addCircle(hx + Math.cos(hyaw) * s * 1.5, hz - Math.sin(hyaw) * s * 1.5, 0.2);
    this.hammock = { x: hx, z: hz, y: hy, yaw: hyaw + Math.PI / 2 };
    // the islanders who fill empty places
    this.npcs = ISLANDERS.map((I) => { const a = new Actor(scene); a.setLook(I.look, GEAR); a.root.visible = false; return { ...I, actor: a }; });
  }

  /** Am I on Palm Key (ashore, in the water round it, or aboard the boat at its jetty)? */
  onKey() {
    const ow = this.ow, p = this.game.player.pos;
    if (!ow.charter || !ow.atSea) return false;
    if (islandAt(p.x, p.z, 1.6)?.id === 'palm') return true;
    return ow.moored()?.island === 'palm';
  }
  ashore() { const p = this.game.player.pos; return this.onKey() && this.ow.boat.deckY(p.x, p.z) == null; }

  // ---------------------------------------------------------------- the crew's lobbies and rounds (from their states)
  crew() {
    const out = [], c = this.ow.charter;
    for (const p of this.game.net?.peers?.values?.() || []) {
      if (!p.meta?.id || (c && p.meta?.chtr?.id !== c.id)) continue;
      out.push({ id: p.meta.id, name: str(p.meta.name || 'Crewmate'), bg: p.state?.bg || null, peer: p, fresh: Date.now() - (p.last || 0) < BG.STALE });
    }
    return out;
  }
  peerBg(id) { if (id === this.me) return this.stateExtra()?.bg || null; return this.crew().find((m) => m.id === id)?.bg || null; }
  /** Lobbies the crew have open that I could join. */
  offers() {
    const now = Date.now();
    return this.crew().filter((m) => m.fresh && m.bg?.L && m.bg.L.until > now && !this.gone.has(m.bg.L.id) && GAME_BY_ID[m.bg.L.g]).map((m) => ({ ...m.bg.L, host: m.id, hn: m.name }));
  }

  host(gid) {
    const G = GAME_BY_ID[gid], g = this.game;
    if (!G || this.round) return;
    if (this.closed) { g.ui.toast('Kai packed the games away for the storm. Come back when it blows over!', { icon: 'storm' }); return; }
    this.lobby = { id: `b${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`, g: gid, host: this.me, hn: this.myName, ps: [[this.me, this.myName]], until: Date.now() + BG.LOBBY, mine: true };
    g.audio.sfx('bell');
    this.lobbyCard();
  }
  join(o) {
    if (this.round || !o) return;
    this.lobby = { id: o.id, g: o.g, host: o.host, hn: o.hn, ps: o.ps, until: o.until, mine: false };
    this.game.audio.sfx('click');
    this.lobbyCard();
  }
  leaveLobby() {
    if (!this.lobby) return;
    this.gone.add(this.lobby.id);
    this.lobby = null;
    if (this.ow.ui.modal?.classList.contains('bg-lobby')) this.ow.ui.closeModal();
  }
  /** Host: start now (islanders fill the empty places). */
  start() {
    const L = this.lobby, G = L && GAME_BY_ID[L.g];
    if (!L?.mine || !G || this.round) return;
    const ps = L.ps.slice(0, G.max).map(([id, n]) => [id, n, 0]);
    let k = 0;
    while (ps.length < G.want(ps.length)) { const I = ISLANDERS[k++]; ps.push([`ai${k}`, I.name, 1]); }
    const R = { id: L.id, g: L.g, seed: (Math.random() * 2 ** 31) >>> 0, ps, t0: Date.now() + 4500, w: this.weather, host: this.me };
    this.lobby = null;
    this.begin(R);
  }

  begin(R) {
    const g = this.game, G = GAME_BY_ID[R.g];
    if (!G || this.round) return;
    this.gone.add(R.id);
    this.lobby = null;
    if (this.ow.ui.modal) this.ow.ui.closeModal();
    if (g.fishing.busy) g.fishing.cancel();
    if (g.chairs.seat) g.chairs.stand();
    const round = { ...R, G, done: false, host: R.host, wind: windPush(), quit: new Set() };
    this.round = round;
    this.hud?.remove();
    this.hud = new Hud(g, G, () => this.quit());
    const ctx = this.makeCtx(round);
    round.ctx = ctx;
    round.inst = G.make(ctx);
    const i = R.ps.findIndex((p) => p[0] === this.me);
    const sp = round.inst.spawn?.(i);
    if (sp) this.ow.fade(() => { this.place(sp.x, sp.z, sp.yaw, sp.y); if (sp.pitch) g.engine.cam.pitch = sp.pitch; if (sp.dist) g.engine.cam.dist = sp.dist; });
    g.chat.system(`${G.name}: ${R.ps.map((p) => p[1]).join(', ')}. ${G.how}`, 'info');
    g.audio.sfx('horn');
    g.pushMeta?.();
  }
  /** Put me somewhere on the beach (out of the water if I was swimming). */
  place(x, z, yaw = 0, y = null) {
    const g = this.game, pl = g.player, yy = y ?? walkY(x, z) ?? oceanSurfaceY(x, z);
    if (this.ow.dive.on) this.ow.dive.exit(x, yy, z);
    pl.pos.set(x, yy, z); pl.baseY = yy; pl.air = 0; pl.vy = 0; pl.target = null; pl.yaw = yaw;
    g.engine.cam.target.set(x, yy + 0.8, z);
    g.engine.cam.yaw = yaw + Math.PI;
  }

  makeCtx(round) {
    const g = this.game, bg = this;
    const ctx = {
      game: g, ow: this.ow, bg, round,
      seed: round.seed, ps: round.ps, me: this.me, host: round.host === this.me, t0: round.t0,
      weather: round.w, rain: round.w === 'rain', wind: round.wind,
      index: round.ps.findIndex((p) => p[0] === this.me),
      /** Seconds since the start whistle (negative during the countdown). */
      time: () => (Date.now() - round.t0) / 1000,
      isAI: (id) => { const p = round.ps.find((x) => x[0] === id); if (!p) return true; if (p[2]) return true; if (id === bg.me) return false; return round.quit.has(id) || !bg.crew().some((m) => m.id === id && m.fresh); },
      /** A player's game state from the network (mine from my own module). */
      state: (id) => { if (id === bg.me) return round.inst?.state?.() || null; const b = bg.peerBg(id); return b && (b.r === round.id || b.R?.id === round.id) ? b : null; },
      /** The host has left (a guest then settles the round itself). Otherwise guests wait for the host's table. */
      hostGone: () => round.host !== bg.me && !bg.crew().some((m) => m.id === round.host && Date.now() - (m.peer.last || 0) < BG.STALE * 2),
      hostState: () => { if (round.host === bg.me) return round.inst?.state?.() || null; const b = bg.peerBg(round.host); return b?.R?.id === round.id ? b : null; },
      npc: (i) => bg.npcs[i % bg.npcs.length],
      say: (big, small) => bg.hud?.say(big, small),
      put: (name, x, z, yaw, y) => { const m = bg.put(name, x, z, yaw, y); (round.meshes ||= []).push(m); return m; },
      finish: (rows) => bg.finish(rows),
    };
    return ctx;
  }
  /** I step out of the round (my place stays on the board with what I scored). */
  quit() {
    const r = this.round;
    if (!r) return;
    this.game.chat.system(`You left ${r.G.name}.`, 'info');
    this.endRound();
  }
  endRound() {
    const r = this.round;
    if (!r) return;
    try { r.inst?.end?.(); } catch (e) { console.warn('[beach games]', e); }
    for (const m of r.meshes || []) m.removeFromParent();
    for (const n of this.npcs) n.actor.root.visible = false;
    this.hud?.remove(); this.hud = null;
    this.round = null;
    this.lastRound = { id: r.id, R: { id: r.id, g: r.g, seed: r.seed, ps: r.ps, t0: r.t0, w: r.w, res: r.res }, until: Date.now() + 15000, host: r.host === this.me };
  }
  /** The boat is leaving (or the trip is over): stop any round, no prizes. */
  cancel(why = '') {
    if (this.lobby) this.leaveLobby();
    if (!this.round) return;
    if (why) this.game.chat.system(why, 'info');
    this.endRound();
  }

  /** Rows: [{ id, s, txt? }]. Each player's own client pays its own prize. The host's table wins if they differ. */
  async finish(rows) {
    const r = this.round, g = this.game;
    if (!r || r.done) return;
    r.done = true;
    const ranked = rank(rows.map((x) => ({ ...x, n: r.ps.find((p) => p[0] === x.id)?.[1] || '?' })));
    r.res = ranked.map((x) => [x.id, x.s]);
    this.last = { id: r.id, g: r.g, res: r.res, via: r.host === this.me ? 'host' : rows.viaHost ? 'host table' : 'local' }; // (the last table, for the journal and tests)
    const mine = ranked.find((x) => x.id === this.me);
    this.endRound();
    const G = r.G, n = r.ps.length;
    const place = mine?.place || n;
    const won = place === 1 && n > 1;
    const st = this.d[G.id] || {};
    g.ext.change((d) => {
      d.ocean.games = d.ocean.games || {};
      const s = d.ocean.games[G.id] || { played: 0, wins: 0, best: 0 };
      s.played++; if (won) s.wins++; s.best = Math.max(s.best || 0, mine?.s || 0);
      d.ocean.games[G.id] = s;
    });
    g.ext.bump('beachGames');
    this.ow.progress?.sync();
    this.ow.quests?.progress('beach', { g: G.id, won });
    // balance: islanders are easier to beat than friends, and the beach pays less after a long day of it
    const today = Math.floor(Date.now() / 86400000), humans = r.ps.filter((q) => !q[2]).length;
    const dayN = (g.ext.d.ocean.gamesDay?.day === today ? g.ext.d.ocean.gamesDay.n : 0) + 1;
    g.ext.change((d) => { d.ocean.gamesDay = { day: today, n: dayN }; });
    const k = (humans <= 1 ? BG.SOLO : 1) * (dayN > BG.FULL_DAY ? BG.TIRED : 1);
    const base = prizeFor(place, n), prize = { coins: Math.round(base.coins * k), xp: Math.round(base.xp * k) };
    if (dayN === BG.FULL_DAY + 1) g.chat.system('Kai: "You\'ve played a lot of games today! Prizes are smaller until tomorrow, but have fun."', 'info');
    const first = won && !st.wins ? FIRST_WIN[G.id] : null;
    this.resultsCard(G, ranked, place, prize, first);
    this.ow.voyage?.onGame(G.name, won, prize.coins + (first?.coins || 0));
    await g.reward('beach', `${r.id}`, { ...prize, ...(first || {}) }, won ? `${G.name}: you won!` : `${G.name}: ${ordinal(place)} place`);
    if (won) g.audio.sfx('achievement');
  }
  resultsCard(G, ranked, place, prize, first) {
    const rows = ranked.map((x) => h(`div.bg-row${x.id === this.me ? '.me' : ''}`, h('b', ordinal(x.place)), h('span', x.n), h('em', x.txt ?? String(x.s))));
    this.ow.ui.openModal('bg-results', h('div.ow-head', h('span.ow-badge', icon(place === 1 ? 'trophy' : 'star')), h('div', h('b', place === 1 ? 'You won!' : `${ordinal(place)} place`), h('span', G.name))),
      h('div.bg-rows', rows),
      h('p.ow-note', `+${prize.coins} coins · +${prize.xp} XP${first ? ` · new title “${first.title}” and a prize hat (in the avatar creator)` : ''}`),
      h('div.ow-acts', h('button.btn.gold', { on: { click: () => { this.ow.ui.closeModal(); this.boardCard(); } } }, 'Play again'), h('button.btn.ghost.on-dark', { on: { click: () => this.ow.ui.closeModal() } }, 'Done')));
  }

  // ---------------------------------------------------------------- cards
  boardCard() {
    const g = this.game, ui = this.ow.ui;
    if (this.closed) {
      ui.openModal('bg-board', h('div.ow-head', h('span.ow-badge', icon('storm')), h('div', h('b', 'Beach Games'), h('span', 'Closed for the storm'))),
        h('p.ow-note', 'Kai packed everything away when the storm rolled in: lightning and a volleyball net don\'t mix. Come back when it blows over.'));
      return;
    }
    const offers = this.offers();
    const w = this.weather, wind = windPush();
    const note = { clear: 'Sunny and calm: perfect beach weather.', overcast: `A breeze off the sea (${wind.kn} kn): it pushes balls and coconuts a little.`, rain: `Rain! The crabs love it (they run faster), wet sand stacks a level higher, and the wind (${wind.kn} kn) pushes throws about.` }[w] || '';
    const rows = GAMES.map((G) => {
      const s = this.d[G.id];
      return h('button.ow-role', { on: { click: () => { ui.closeModal(); this.host(G.id); } } }, h('b', G.name), h('small', G.blurb), h('small', s?.played ? `Played ${s.played} · won ${s.wins}` : 'Not played yet'));
    });
    const join = offers.map((o) => h('button.ow-role.on', { on: { click: () => { ui.closeModal(); this.join(o); } } }, h('b', `Join ${o.hn}: ${GAME_BY_ID[o.g].name}`), h('small', `${o.ps.length} in so far`)));
    ui.openModal('bg-board', h('div.ow-head', h('span.ow-badge', icon('trophy')), h('div', h('b', 'Beach Games'), h('span', 'Up to 4 players. Islanders fill the empty places.'))),
      h('p.ow-note', note), join.length ? h('div.ow-roles.bg-join', join) : null, h('div.ow-roles', rows));
    g.audio.sfx('open');
  }
  lobbyCard() {
    const L = this.lobby, ui = this.ow.ui, G = L && GAME_BY_ID[L.g];
    if (!L || !G) return;
    const secs = Math.max(0, Math.ceil((L.until - Date.now()) / 1000));
    const list = h('div.bg-rows', L.ps.map(([id, n]) => h(`div.bg-row${id === this.me ? '.me' : ''}`, h('b', id === L.host ? 'Host' : ''), h('span', n), h('em', ''))),
      ...Array.from({ length: Math.max(0, G.want(L.ps.length) - L.ps.length) }, (_, i) => h('div.bg-row.ai', h('b', ''), h('span', `${ISLANDERS[i].name} (islander)`), h('em', ''))));
    const el = ui.openModal('bg-lobby', h('div.ow-head', h('span.ow-badge', icon('flag')), h('div', h('b', G.name), h('span', L.mine ? `Your game. The crew can join from the board for ${secs} s.` : `${L.hn}'s game. Waiting for them to start.`))),
      h('p.ow-note', G.blurb), list,
      h('div.ow-acts', L.mine ? h('button.btn.gold', { on: { click: () => this.start() } }, 'Start') : null, h('button.btn.ghost.on-dark', { on: { click: () => this.leaveLobby() } }, L.mine ? 'Cancel' : 'Leave')));
    el.addEventListener('close', () => {});
    this.lobbyKey = JSON.stringify([L.ps, secs > 0]);
  }
  /** A crewmate opened a game while I'm on Palm Key: a gentle invite. */
  inviteCard(o) {
    const ui = this.ow.ui, G = GAME_BY_ID[o.g];
    this.gone.add(o.id);
    ui.openModal('bg-invite', h('div.ow-head', h('span.ow-badge', icon('flag')), h('div', h('b', `${o.hn} is starting ${G.name}`), h('span', G.blurb))),
      h('div.ow-acts', h('button.btn.gold', { on: { click: () => { ui.closeModal(); this.gone.delete(o.id); this.join(o); } } }, 'Join'), h('button.btn.ghost.on-dark', { on: { click: () => ui.closeModal() } }, 'Not now')));
  }

  // ---------------------------------------------------------------- per frame
  update(dt, t) {
    if (!this.built) return;
    const g = this.game, near = this.ow.atSea && g.engine.camera.position.distanceTo(new THREE.Vector3(ISLAND_BY_ID.palm.x, 0, ISLAND_BY_ID.palm.z)) < 260;
    this.root.visible = near;
    const now = Date.now();
    // the lobby I'm in
    const L = this.lobby;
    if (L) {
      if (L.mine) {
        // crewmates asking to join (their state says bg.J = my lobby)
        const G = GAME_BY_ID[L.g];
        for (const m of this.crew()) if (m.fresh && m.bg?.J === L.id && !L.ps.some((p) => p[0] === m.id) && L.ps.length < G.max) { L.ps.push([m.id, m.name]); g.audio.sfx('bell'); }
        L.ps = L.ps.filter(([id]) => id === this.me || this.crew().some((m) => m.id === id && m.fresh && m.bg?.J === L.id));
        if (now > L.until || L.ps.length >= G.max) this.start();
      } else {
        // the host's lobby, then their round
        const hb = this.peerBg(L.host);
        if (hb?.R?.id === L.id) { if (hb.R.ps.some((p) => p[0] === this.me)) this.begin({ ...hb.R, host: L.host }); else { g.ui.toast('That game filled up before you got in.', { icon: 'flag' }); this.leaveLobby(); } }
        else if (hb?.L?.id === L.id) { L.ps = hb.L.ps; L.until = hb.L.until; }
        else if (now > L.until + 6000) { g.ui.toast('That game was called off.', { icon: 'flag' }); this.leaveLobby(); }
      }
      if (this.lobby && this.ow.ui.modal?.classList.contains('bg-lobby')) {
        const key = JSON.stringify([this.lobby.ps, this.lobby.until > now]);
        this.lobbyT = (this.lobbyT || 0) - dt;
        if (key !== this.lobbyKey || this.lobbyT <= 0) { this.lobbyT = 1; this.lobbyCard(); }
      }
    } else if (!this.round && this.onKey() && !g.ui.modalOpen && !this.ow.ui.modal) {
      // someone opened a game: ask once
      const o = this.offers()[0];
      if (o && !this.gone.has(o.id)) this.inviteCard(o);
    }
    // the round
    const r = this.round;
    if (r) {
      try { r.inst.update(dt, t); } catch (e) { console.error('[beach games]', e); this.cancel('Something went wrong with the game, sorry!'); return; }
      if (this.round && !r.done) {
        // a guest takes the host's final table when it arrives, so everyone sees the same podium
        const hs = r.host !== this.me ? this.peerBg(r.host) : null;
        if (hs?.R?.id === r.id && Array.isArray(hs.R.res) && hs.R.res.length) { const rows = hs.R.res.map(([id, s]) => ({ id, s, txt: r.inst.label?.(id, s) })); rows.viaHost = true; this.finish(rows); }
        else if (r.host !== this.me) {
          // the host left: I run it (only once they've been gone a good while; a peer can blink out for a moment)
          if (hs || this.crew().some((m) => m.id === r.host && m.fresh)) r.hostSeen = now;
          else if (now - r.t0 > 15000 && now - (r.hostSeen || r.t0) > BG.HOST_GONE) r.host = this.me;
        }
        if (r.ctx.time() > (r.G.limit || 240)) this.finish(r.inst.scores());
      }
      if (this.round) {
        const tl = (r.t0 - now) / 1000;
        if (tl > 0) this.hud?.say(`${Math.ceil(tl)}`, r.G.how);
      }
    }
    if (this.lastRound && now > this.lastRound.until) this.lastRound = null;
    // settled it myself (the host went quiet)? take the host's table if it turns up after all
    if (this.last?.via === 'local') {
      const hb = this.crew().map((m) => m.bg?.R).find((R) => R?.id === this.last.id && Array.isArray(R.res) && R.res.length);
      if (hb) this.last = { ...this.last, res: hb.res, via: 'host table (late)' };
    }
  }

  /** My part of the network state. */
  stateExtra() {
    const r = this.round, L = this.lobby;
    if (r) {
      const s = { ...(r.inst?.state?.() || {}) };
      if (r.host === this.me) s.R = { id: r.id, g: r.g, seed: r.seed, ps: r.ps, t0: r.t0, w: r.w, ...(r.res ? { res: r.res } : {}) };
      else s.r = r.id;
      return { bg: s };
    }
    if (L) return { bg: L.mine ? { L: { id: L.id, g: L.g, ps: L.ps, until: L.until } } : { J: L.id } };
    // a finished round's table, a little while, for guests who were a beat behind
    if (this.lastRound?.host) return { bg: { R: this.lastRound.R } };
    return null;
  }

  // ---------------------------------------------------------------- input and the rest of the game's hooks
  get busy() { return !!this.round && !this.round.done; }
  primary(down) { const r = this.round; if (!r || r.done || !r.inst.primary) return false; return r.inst.primary(down) !== false; }
  jump() { const r = this.round; if (!r || r.done || !r.inst.jump) return false; return r.inst.jump() !== false; }
  /** A game that drives the player itself (the cannonball's tower and flight). True if it did this frame. */
  control(dt) { const r = this.round; return !!(r && !r.done && r.inst.ctl && r.inst.ctl(dt)); }
  /** Is a game holding the player out of the water (so the sea doesn't pull them in)? */
  get holding() { const r = this.round; return !!(r && !r.done && r.inst.holding); }
  pose() { const r = this.round; return r && !r.done ? r.inst.pose?.() || null : null; }
  contextActions() {
    const g = this.game, pl = g.player, out = [];
    if (!this.built || !this.ow.atSea) return out;
    const r = this.round;
    if (r && !r.done) { out.push(...(r.inst.actions?.() || [])); return out; }
    if (!this.onKey()) return out;
    const p = pl.pos;
    if (Math.hypot(p.x - this.board.x, p.z - this.board.z) < 3.2) out.push({ id: 'bgboard', label: this.closed ? 'Beach games (closed)' : 'Beach games', color: 'gold', at: { x: this.board.x, z: this.board.z, y: this.board.y, h: 2.8 }, fn: () => this.boardCard() });
    if (!g.chairs.seat && Math.hypot(p.x - this.hammock.x, p.z - this.hammock.z) < 2.2) out.push({ id: 'hammock', label: 'Hammock', color: 'green', fn: () => { g.chairs.sit({ id: 'hammock', kind: 'hammock', x: this.hammock.x, y: this.hammock.y, z: this.hammock.z, yaw: this.hammock.yaw, h: 0.62 }); g.ext.bump('hammock'); } });
    return out;
  }
}

function ordinal(n) { return n === 1 ? '1st' : n === 2 ? '2nd' : n === 3 ? '3rd' : `${n}th`; }

/** The round's strip at the top of the screen: the game, a big line (time, score), a small line (what to do). */
class Hud {
  constructor(game, G, onLeave) {
    this.el = h('div.bg-hud', h('b.bg-title', G.name), this.big = h('div.bg-big', ''), this.small = h('div.bg-small', ''),
      h('button.btn.ghost.on-dark.bg-leave', { on: { click: onLeave } }, 'Leave'));
    game.ui.root.append(this.el);
  }
  say(big, small) {
    if (big != null && this.big.textContent !== String(big)) this.big.textContent = big;
    if (small != null && this.small.textContent !== String(small)) this.small.textContent = small;
  }
  /** A word that pops up under the strip for a moment ("On the beat!", "Perfect!"). */
  flash(text) {
    this.pop?.remove();
    this.pop = h('div.bg-pop', text);
    this.el.append(this.pop);
    const p = this.pop;
    setTimeout(() => p.remove(), 900);
  }
  remove() { this.el.remove(); }
}
