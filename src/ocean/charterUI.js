// Open Waters: the charter's cards and HUD. The charter card (who's coming, the fee, Set sail), the invite a party
// member gets, Marlowe's chart (where we are, set a course, head home), the crew card (pick a role), the sea strip at
// the top of the screen, the crew's help bar, and the big-game extras on the reel HUD (your arms, runs, the gaff).
import { h } from '../ui/dom.js';
import { icon } from '../ui/icons.js';
import { SEA, SEA_STATES, waveHeight, seaName } from './waves.js';
import { OCEAN, ISLANDS, SPOTS, SPOT_BY_ID, spotAt } from './geo.js';
import { ROLES, BIG } from './bigfight.js';
import { TRUST } from './voyageData.js';
import { SPECIES_BY_ID } from '../data/species.js';
import { OCEAN_SPECIES } from '../data/oceanSpecies.js';

const knots = (w) => Math.round(4 + w * 18);
export const OPEN_STAGE = 2; // spots from later stages show on the chart as "soon"
const BITING = {
  clear: 'Mahi and sailfish like the sun.', overcast: 'Tuna and wahoo like low light.',
  rain: 'Wahoo and tuna feed in the rain; makos prowl.', storm: 'Makos and trevally love a storm. Hold on tight.',
};

export class CharterUI {
  constructor(game, ow) {
    this.game = game; this.ow = ow;
    this.modal = null;
    this.strip = null; this.help = null; this.big = null;
  }

  // ---------------------------------------------------------------- modals
  openModal(cls, ...kids) {
    this.closeModal();
    const el = h(`div.ow-modal.plank.${cls}`, { role: 'dialog' }, ...kids, h('button.btn.close-x.ghost.on-dark', { 'aria-label': 'Close', on: { click: () => this.closeModal() } }, icon('close')));
    el.addEventListener('close', () => this.closeModal());
    this.game.ui.root.append(el);
    this.modal = el;
    this.game.audio.sfx('open');
    el.querySelector('button.btn.gold, button.btn.blue')?.focus();
    return el;
  }
  closeModal() { if (!this.modal) return; this.modal.remove(); this.modal = null; this.game.audio.sfx('close'); }

  seaReport() {
    const w = this.game.engine.sky.state.weather || 'clear';
    const out = !this.ow.atSea, H = waveHeight(out ? w : null); // from the cove: the forecast for this weather
    const wind = out ? SEA_STATES[w].wind : SEA.wind;
    return h('div.ow-report', icon(w === 'clear' ? 'sun' : w === 'overcast' ? 'cloud' : w), h('span', `${out ? 'Out there: ' : ''}${seaName(H)}, waves about ${H.toFixed(1)} m · wind ${knots(wind)} kn. ${BITING[w] || ''}`));
  }

  charterCard() {
    const g = this.game, ow = this.ow, fee = ow.feeFor(), L = 20;
    const crew = ow.crewCandidates();
    const rows = crew.map((c) => {
      const ok = c.lvl >= L;
      const why = !ok ? `Level ${c.lvl || '?'}, needs ${L}` : c.me ? 'You' : c.here ? 'Gets an invite to board' : 'Not on the lake: invite waits';
      return h(`li.ow-crew${ok ? '' : '.off'}`, h('span.ow-lv', ok ? icon('check') : `Lv ${c.lvl || '?'}`), h('b', c.name), h('small', why));
    });
    const can = !fee || g.profile.coins >= fee;
    // v1.15.10: a night charter: out after dark (the trip keeps its own clock), for swordfish, squid and glowing seas
    const nightBox = h('input', { type: 'checkbox', checked: !!this.nightPick, on: { change: (e) => { this.nightPick = e.target.checked; } } });
    // v1.15.13: your own boat: free for you and your crew
    const owned = ow.own.owned; if (owned && this.ownPick == null) this.ownPick = true;
    const ownBox = owned ? h('input', { type: 'checkbox', checked: !!this.ownPick, on: { change: (e) => { this.ownPick = e.target.checked; this.charterCard(); } } }) : null;
    const free = owned && this.ownPick;
    this.openModal('ow-charter',
      h('div.ow-head', h('span.ow-badge', icon('anchor')), h('div', h('b', 'Charter with Captain Marlowe'), h('span', 'Out past the lighthouse to Open Waters'))),
      this.seaReport(),
      h('p.ow-note', `Rods and reels come with the charter (Marlowe's big-game tackle, a ${ow.tackle.fight().lineLb.toLocaleString()} lb line).`),
      h('ul.ow-list', rows),
      h('p.ow-fee', free ? 'Your own boat: no charge for anyone aboard.' : fee ? `${fee.toLocaleString()} coins each (you have ${g.profile.coins.toLocaleString()}). Everyone pays their own way.` : 'Your first trip is on the house!'),
      owned ? h('label.ow-night', ownBox, h('span', h('b', `Take my boat, the ${ow.own.look().name}`), h('small', 'Free for you and your crew. Marlowe takes the wheel.'))) : null,
      h('label.ow-night', nightBox, h('span', h('b', 'Night charter'), h('small', 'Set out after dark: squid lights, glowing plankton, swordfish under the stars.'))),
      crew.length < 2 ? h('p.ow-note', 'Fishing solo. Party up first (O) to bring up to three friends: they get an invite to board.') : h('p.ow-note', 'Party members at level 20 get an invite to board. Everyone aboard needs level 20.'),
      h('div.ow-acts',
        h('button.btn.gold', { disabled: !can && !free, on: { click: () => { this.closeModal(); ow.book({ night: !!this.nightPick, own: !!free }); } } }, icon('anchor'), fee && !free ? `Set sail (${fee.toLocaleString()})` : 'Set sail (free)'),
        h('button.btn.ghost.on-dark', { on: { click: () => this.closeModal() } }, 'Not now')));
  }

  /** v1.15.14: the Open Waters title card. It fades into the middle of the screen as you arrive at sea, in the Reel
   *  Time logo's font: a life ring rocks in place of the O (like the bobber on the i), and the letters ride a gentle
   *  swell over a rolling wave line. */
  titleCard(sub = '') {
    this.title?.remove();
    let k = 0;
    const word = (w) => h('span.brand-word', [...w].map((c) => h('span.ow-tl', { style: { '--i': k++ } }, c)));
    const logo = h('div.brand.ow-logo', { role: 'img', 'aria-label': 'Open Waters' },
      h('span.brand-word', h('span.ow-ring', h('i')), [...'pen'].map((c) => h('span.ow-tl', { style: { '--i': k++ } }, c))), ' ', word('Waters'));
    const el = h('div.ow-title', { 'aria-hidden': 'true' }, h('div.ow-title-in', logo, h('div.ow-wave'), sub ? h('div.ow-title-sub', sub) : null));
    this.game.ui.root.append(el);
    this.title = el;
    setTimeout(() => el.classList.add('out'), 3600);
    setTimeout(() => { el.remove(); if (this.title === el) this.title = null; }, 4800);
  }

  inviteCard(peer, c) {
    const g = this.game, ow = this.ow, fee = ow.feeFor();
    const who = String(peer?.meta?.name || 'Your party leader').slice(0, 20);
    const ok = g.profile.level >= 20;
    g.audio.sfx('horn');
    this.openModal('ow-invite',
      h('div.ow-head', h('span.ow-badge', icon('anchor')), h('div', h('b', `${who} chartered Marlowe's boat`), h('span', 'Big-game fishing out on Open Waters'))),
      h('p.ow-fee', !ok ? 'Charters need level 20.' : c.bt ? `On ${who}'s own boat, the ${String(c.bt.name || 'Sea Biscuit').slice(0, 18)}: free to board.` : fee ? `Board for ${fee.toLocaleString()} coins (you have ${g.profile.coins.toLocaleString()}).` : 'Your first trip is free!'),
      h('div.ow-acts',
        h('button.btn.gold', { disabled: !ok || (!c.bt && fee && g.profile.coins < fee), on: { click: () => { this.closeModal(); ow.accept(c); } } }, icon('anchor'), 'Board the charter'),
        h('button.btn.ghost.on-dark', { on: { click: () => this.closeModal() } }, 'Not now')));
  }

  /** Marlowe's chart: the ocean, the islands, the spots, where the boat is; set a course or head home. */
  /** v1.15.20: the chart is the big map panel now (seachart.js): drag, zoom, markers, set a course. */
  chart() {
    if (!this.ow.charter) return;
    this.closeModal?.();
    this.game.ui.sheets.open('map');
  }


  crewCard() {
    const g = this.game, ow = this.ow, F = ow.fight, mine = F.role;
    const crew = F.crew();
    const roleBtn = (id) => h(`button.ow-role${mine === id ? '.on' : ''}`, { on: { click: () => { F.setRole(id); this.crewCard(); } } }, h('b', ROLES[id].name), h('small', ROLES[id].what));
    this.openModal('ow-crewcard',
      h('div.ow-head', h('span.ow-badge', icon('users')), h('div', h('b', 'Crew & roles'), h('span', 'Everyone fishes. Roles are how you help when a crewmate has a big one on.'))),
      h('div.ow-roles', Object.keys(ROLES).map(roleBtn)),
      h('ul.ow-list', [h('li.ow-crew', h('span.ow-lv', icon('user')), h('b', `${g.profile.name} (you)`), h('small', ROLES[mine].name)), ...crew.map((m) => h('li.ow-crew', h('span.ow-lv', icon('user')), h('b', m.name), h('small', `${ROLES[m.role]?.name || 'Angler'}${m.state?.afk ? ' · away' : ''}`)))]),
      h('p.ow-note', crew.length ? 'No one in a role? Captain Marlowe covers it (a bit less well).' : 'Fishing solo: Captain Marlowe backs the boat down and gaffs your fish for you.'),
      h('p.ow-note', `Crew key: ${(g.keymap?.keyFor('crew') || 'y').toUpperCase()} (hold to back down as captain; press to gaff or call a jump).`),
      h('div.ow-acts', h('button.btn.ghost.on-dark', { on: { click: () => ow.tackle.card() } }, icon('rod'), 'Tackle locker')));
  }

  // ---------------------------------------------------------------- HUD
  update() {
    const g = this.game, ow = this.ow;
    const show = ow.atSea && !!ow.charter;
    // the sea strip
    if (show && !this.strip) { this.strip = h('div.ow-strip'); g.ui.root.append(this.strip); }
    if (!show && this.strip) { this.strip.remove(); this.strip = null; }
    if (this.strip) {
      const P = ow.boat.pose, here = spotAt(P.x, P.z);
      const txt = `${P.moving ? `Under way, ${Math.round(P.speed * 1.94)} kn · ` : ''}Waves ${waveHeight().toFixed(1)} m · wind ${knots(SEA.wind)} kn · ${ow.tides.name()} tide${ow.life.birdsUntil > Date.now() ? ' · birds working!' : ''}${ow.events.hornHint() ? ` · ${ow.events.hornHint()}` : ''}`;
      if (this.strip.textContent !== txt) this.strip.textContent = txt;
    }
    // helping a crewmate's fight
    const H = show ? ow.fight.helping : null;
    if (H && !this.help) { this.help = h('div.ow-help.plank'); g.ui.root.append(this.help); }
    if (!H && this.help) { this.help.remove(); this.help = null; }
    if (H) {
      const sp = SPECIES_BY_ID[H.f.sp], role = ow.fight.role, key = (g.keymap?.keyFor('crew') || 'y').toUpperCase();
      const call = role === 'captain' ? (H.f.r ? `It's running! Hold ${key} to back down on it` : `Captain: hold ${key} when it runs`)
        : role === 'gaffer' ? (H.f.g === 2 ? `NOW! Press ${key} to GAFF` : H.f.g ? 'Alongside! Wait for it…' : `Gaffer: press ${key} when it comes alongside`)
          : role === 'spotter' ? (H.f.w ? `It's about to jump! Press ${key} to call it` : `Spotter: watch for the jump (${key})`)
            : 'Pick a role on the crew card to help';
      const hot = (role === 'captain' && H.f.r) || (role === 'gaffer' && H.f.g === 2) || (role === 'spotter' && H.f.w);
      const html = `${H.name} is fighting a ${sp?.name || 'big fish'} · ${Math.round(H.f.p * 100)}%|${call}|${hot}`;
      if (this.help.dataset.k !== html) {
        this.help.dataset.k = html;
        this.help.replaceChildren(h('div.ow-help-top', icon('fish'), h('span', `${H.name} is fighting a ${sp?.name || 'big fish'}`), h('b', `${Math.round(H.f.p * 100)}%`)),
          h('div.ow-help-bar', h('i', { style: { width: `${Math.round(H.f.p * 100)}%` } })),
          h(`div.ow-help-call${hot ? '.hot' : ''}`, call));
      }
    }
    // my big fight: arms, runs and the gaff on the reel HUD
    const r = g.fishing.reel;
    const el = g.ui.reelEl;
    if (r?.big && el) {
      if (!this.big || !this.big.isConnected) {
        this.big = h('div.ow-big', h('div.ow-arms', h('span', 'Arms'), h('div.ow-meter', h('i'))), h('div.ow-gaff.hidden', h('span', 'Gaff'), h('div.ow-meter', h('em'), h('i'))), h('div.ow-tag'));
        el.append(this.big);
      }
      const B = r.big;
      this.big.querySelector('.ow-arms i').style.width = `${Math.round(B.arms * 100)}%`;
      this.big.querySelector('.ow-arms').classList.toggle('low', B.arms < 0.3);
      const gf = this.big.querySelector('.ow-gaff');
      gf.classList.toggle('hidden', !B.gaff);
      if (B.gaff) {
        const t = B.gaff.t / BIG.GAFF_CLOSE;
        gf.querySelector('i').style.left = `${Math.min(100, t * 100)}%`;
        gf.querySelector('em').style.left = `${(BIG.GAFF_OPEN / BIG.GAFF_CLOSE) * 100}%`;
      }
      const tag = B.afk ? `Marlowe has the rod (${Math.max(0, Math.round(BIG.AFK_HOLD - B.afkUsed))} s)` : B.gaff ? (B.gaffer === 'crew' ? 'Alongside! Your gaffer\'s up' : ow.fight.crew().length ? 'Alongside! Marlowe\'s gaffing it' : `Alongside! Press ${(g.keymap?.keyFor('crew') || 'y').toUpperCase()} in the green, or let Marlowe gaff it`) : B.run > 0 ? 'Running! Let it go' : B.arms < 0.3 ? 'Arms tired: ease off a moment' : B.chair ? 'In the fighting chair' : 'Fighting from the rail';
      const tg = this.big.querySelector('.ow-tag');
      if (tg.textContent !== tag) tg.textContent = tag;
      el.classList.toggle('ow-running', B.run > 0);
    } else if (this.big) { this.big.remove(); this.big = null; el?.classList.remove('ow-running'); }
  }
}
export { OCEAN_SPECIES };
