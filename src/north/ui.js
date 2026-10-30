// Frostmere's pages in the sheets: the Fishpedia's Frostmere tab (the 14 fish), and the Journal's North tab (the five
// quest lines, the Field Guide's Frostmere chapter, the Valiant's log pages and the boards).
import { h } from '../ui/dom.js';
import { icon } from '../ui/icons.js';
import { TIER_INFO, tierOf } from '../data/species.js';
import { NORTH_SPECIES, NORTH_ZONES } from '../data/northSpecies.js';
import { fishThumb } from '../ui/thumbs.js';
import { LINES } from './quests.js';
import { NORTH_GUIDE, GUIDE_SETS_NORTH } from './fauna.js';
import { LOG_PAGES } from './wild.js';
import { derbyFish } from './boards.js';
import { HUTS, GALENA_LAMPS } from './sites.js';
import { LEDGER } from './expeditions.js';
import { ICE_FINDS } from './wilds.js';

const rewardTxt = (r) => [r.coins ? `${r.coins.toLocaleString()} coins` : '', r.pearls ? `${r.pearls} pearls` : '', r.xp ? `${r.xp} XP` : ''].filter(Boolean).join(', ');

/** The Fishpedia's Frostmere tab. */
export function renderNorthPedia(game, c) {
  const p = game.profile, have = NORTH_SPECIES.filter((s) => p.fishpedia[s.id]);
  c.body.append(h('div.pedia-head',
    h('div.pedia-ring', { style: { '--p': `${Math.round((have.length / NORTH_SPECIES.length) * 100)}%` } }, h('span.num', `${have.length}`)),
    h('div.grow', h('div.pedia-big', `${have.length} of ${NORTH_SPECIES.length} Frostmere fish`), h('div.muted', game.north?.d.flights ? `${game.north.d.flights} flight${game.north.d.flights > 1 ? 's' : ''} north with Skye. This week's Ice Derby fish: the ${derbyFish().name}.` : 'Skye Halloran flies you north from level 25.'),
      h('div.progress', h('i', { style: { width: `${(have.length / NORTH_SPECIES.length) * 100}%` } })))));
  const tile = (sp) => {
    const e = p.fishpedia[sp.id];
    return h(`div.tile.ow-tile${e ? '' : '.locked'}`, { title: e ? `${sp.name}: ${sp.desc}` : '???' },
      h('i.tier', { style: { background: TIER_INFO[tierOf(sp)].color }, title: TIER_INFO[tierOf(sp)].name }),
      h('img', { src: fishThumb(sp.id), alt: '', style: e ? {} : { filter: 'brightness(0) opacity(0.3)' } }),
      h('div.nm', e ? sp.name : '???'),
      h('div.meta', e ? `Best ${e.best.toFixed(1)} lb` : sp.zones.map((z) => NORTH_ZONES[z]?.name).slice(0, 2).join(', ')));
  };
  c.body.append(h('div.section-title', 'Through the ice'), h('div.grid.ow-grid', NORTH_SPECIES.filter((s) => !s.zones.every((z) => z === 'floe' || z === 'springs')).map(tile)));
  c.body.append(h('div.section-title', 'The Floe Edge and the springs'), h('div.grid.ow-grid', NORTH_SPECIES.filter((s) => s.zones.every((z) => z === 'floe' || z === 'springs')).map(tile)));
  const sel = NORTH_SPECIES.find((s) => p.fishpedia[s.id] && s.tier === 'legendary') || null;
  if (sel) c.body.append(h('div.muted', { style: { marginTop: '8px' } }, `${sel.name}: ${sel.desc}`));
}

/** The Journal's North tab. */
export function renderNorthJournal(sheets, c) {
  const g = sheets.game, N = g.north, B = c.body;
  if (!N) return;
  const d = N.d;
  if (!sheets.state.northSub) sheets.state.northSub = 'quests';
  B.append(sheets.chips('northSub', [['quests', 'Quests'], ['guide', 'Field Guide'], ['log', 'The Valiant\'s Log'], ['finds', 'Out There']]));
  const sub = sheets.state.northSub;
  if (sub === 'quests') {
    for (const L of LINES) {
      const st = N.quests.state(L.id);
      const step = st && !st.done ? L.steps[st.step] : null;
      const meta = !st ? `Ask ${{ astrid: 'Astrid at the Hearth Lodge', torvald: 'Old Torvald on the shanty ice', june: 'June at the kennels', ingrid: 'Dr. Vale at Skyward Station', elsi: 'Grandma Elsi at the smokehouse' }[L.giver]}. Reward: ${L.rewardText}.`
        : st.claimed ? 'Done!' : st.done ? `Complete! Reward: ${L.rewardText}.` : `${step.text}${step.n > 1 ? ` (${st.have || 0}/${step.n})` : ''} · step ${st.step + 1} of ${L.steps.length}`;
      B.append(h(`div.list-row${st?.done && !st.claimed ? '.me' : ''}`, icon(st?.claimed ? 'check' : st ? 'scroll' : 'lock'),
        h('div.grow', h('div.ttl', L.name), h('div.meta', meta)),
        st?.done && !st.claimed ? h('button.btn.gold.small', { on: { click: () => sheets.act(() => N.quests.claim(L.id)) } }, 'Claim') : null));
      if (st && !st.claimed) B.append(h('div.row-list', L.steps.map((s, i) => h(`div.story-done${i < st.step || st.done ? '' : '.todo'}`, `${i < st.step || st.done ? '✓' : i === st.step ? '›' : '·'} ${s.text}`))));
    }
    B.append(h('div.section-title', 'Boards'), h('div.list-row', icon('trophy'), h('div.grow', h('div.ttl', 'Hearthwick boards'), h('div.meta', 'The Ice Derby, the Sled Derby, the Long Glide and Above the Clouds')),
      h('div.btn-row', ['ice', 'derby', 'glide', 'flight', 'climb', 'toboggan', 'air'].map((k) => h('button.btn.ghost.small', { on: { click: () => { sheets.close(); N.boards.show(k); } } }, { ice: 'Ice', derby: 'Sled', glide: 'Glide', flight: 'Flight' }[k])))));
  }
  if (sub === 'guide') {
    const have = d.guide || {};
    B.append(h('div.muted', { style: { marginBottom: '8px' } }, `Photograph the north's animals (E when one's close and in view). The Tundra and the Coast: ${rewardTxt(GUIDE_SETS_NORTH.wild.reward)} each. Legends of the North: ${rewardTxt(GUIDE_SETS_NORTH.legend.reward)}.`));
    for (const [set, S] of Object.entries(GUIDE_SETS_NORTH)) {
      const list = NORTH_GUIDE.filter((x) => x.set === set);
      B.append(h('div.section-title', `${S.name} ${list.filter((x) => have[x.id]).length}/${list.length}${d.guideSets?.[set] ? ' ✓' : ''}`));
      B.append(h('div.guide-grid', list.map((e) => h(`div.guide-card${have[e.id] ? '.have' : ''}`, h('div.guide-ic', icon(have[e.id] ? 'camera' : 'help')), h('b', have[e.id] || set !== 'legend' ? e.name : '???'), h('small', e.desc)))));
    }
    const L = d.legends || {};
    B.append(h('div.muted', { style: { marginTop: '8px' } }, `Sightings: Old Whitepaw ×${L.whitepaw || 0}, the Frost Stag ×${L.stag || 0}, the Thing Under the Ice ×${L.thing || 0}. Northern lights seen on ${d.auroras || 0} night${d.auroras === 1 ? '' : 's'}.`));
  }
  if (sub === 'finds') {
    const f = d.finds || {}, huts = d.huts || {}, lamps = Object.keys(d.lamps || {}).length;
    B.append(h('div.section-title', `Trail huts ${Object.keys(huts).length}/${HUTS.length}`));
    for (const H of HUTS) B.append(h('div.list-row', icon(huts[H.id] ? 'check' : 'lock'), h('div.grow', h('div.ttl', huts[H.id] ? H.name : '???'), h('div.meta', huts[H.id] ? LEDGER[H.id] : 'Somewhere out on the snow. Look for a hut with a dark chimney.'))));
    B.append(h('div.section-title', 'Galena'), h('div.list-row', icon(d.shaft ? 'check' : 'scroll'), h('div.grow', h('div.ttl', d.shaft ? 'Shaft 2 is open' : `Street lamps lit: ${lamps}/${GALENA_LAMPS.length}`), h('div.meta', d.shaft ? 'The seam runs out under the lake, just as the letter said.' : 'An old silver town in the western foothills. Somebody left in a hurry.'))));
    B.append(h('div.section-title', `Found in the ice ${Object.keys(f).length}/${ICE_FINDS.length}`), h('div.muted', { style: { marginBottom: '6px' } }, 'Dark shapes glint under the lake ice, and they change each week. Stand over one and cut it out.'));
    for (const x of ICE_FINDS) B.append(h('div.list-row', icon(f[x.id] ? 'check' : 'help'), h('div.grow', h('div.ttl', f[x.id] ? x.name : '???'), h('div.meta', f[x.id] ? x.note : 'Still in the ice somewhere.'))));
    B.append(h('div.muted', { style: { marginTop: '8px' } }, `Storm crates dug out: ${d.crates || 0}. Aurora shards: ${d.shards || 0}.`));
  }
  if (sub === 'log') {
    const pages = d.pages || {};
    B.append(h('div.muted', { style: { marginBottom: '8px' } }, `Pages of Captain Hale's log from the schooner Valiant, scattered round the north's landmarks. ${Object.keys(pages).length}/${LOG_PAGES.length} found. Grandma Elsi wants them all.`));
    for (const P of LOG_PAGES) B.append(pages[P.id] ? h('div.vj-page.paper', h('h3', P.title), h('p', P.text), h('small', '— Capt. J. Hale')) : h('div.list-row.offline', icon('lock'), h('div.grow', h('div.ttl', '???'), h('div.meta', { wreck: 'Somewhere by the wreck', caves: 'Somewhere by the blue caves', aurorahill: 'Somewhere on a hilltop', trapper: 'Somewhere in the taiga', station: 'Somewhere by the research station' }[P.at]))));
  }
}
