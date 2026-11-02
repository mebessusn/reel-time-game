// The primary quest lines: long stories that walk you round a whole map, one step at a time (the engine is src/game/saga.js).
// A step is one of:
//   talk   go to someone and hear them out (`say` lines can be { who, text } when several people speak)
//   go     reach a place (`when` can ask for a time: 'night')
//   item   a thing that only exists for you while you're on this step: find it and pick it up (`ats`: one place each, n times)
//   catch  land n fish that fit `match`
//   check  done when something else in the game has happened (`done(game)`)
//   carry  pick something up at `at`, get it to `to` inside `secs` (help someone out); miss it and you can try again
//   hold   do something by hand, n times over, at `at`
//   rocks  the engine repair: a little game against the rocks, in a storm
// `unlock` opens something in the shops; `prop` stands a scene object at the step's place (it tows behind you on a carry);
// `who`/`walker` is someone who walks with you on a carry; `storm` brings the weather in round the step. Another map's lines can
// add their own step fields, which its rules (addSagaMap) understand.
// Places are { map, x, z } in world coordinates; people are named in PEOPLE or found live.
// This file holds the valley's lines; another map adds its own (and its people) with addSaga, and its rules with addSagaMap.
import { defaultAvatar } from './avatarOptions.js';
import { CLEARINGS } from '../world/terrain.js';

export const v = (x, z, r = 3.5) => ({ map: 'valley', x, z, r });
export const look = (gender, o) => ({ ...defaultAvatar(gender), ...o });

/** People the stories add. `from` is the line that brings them out (none: always there); `step` is the one step they're around for;
 *  `meet` is where they stand while `meetStep` ([line, step]) is on; `lookOf` borrows the look of someone who lives elsewhere. */
export const PEOPLE = {
  hattie: { name: 'Hattie', title: 'Lodge cook', at: v(CLEARINGS.lodge.x + 4, CLEARINGS.lodge.z + 5), look: look('female', { skin: 3, frame: 'broad', hair: 'buns', hairColor: 2, shirt: 'cardigan', shirtColor: 2, pants: 'jeans' }) },
};

export const SAGA = [
  { id: 'survey', name: 'The Lost Survey', map: 'valley', giver: { name: 'Gus', title: 'The bait shop', npc: 'Gus', at: v(6, 45) }, level: 3,
    intro: 'My grandfather walked every shore of these lakes with a compass and a notebook. Finest map anyone ever made, and it got torn up and handed round the valley. I would dearly love to see it whole.',
    reward: { coins: 5000, pearls: 25, xp: 2500, title: 'The Surveyor' }, items: ['rod_surveyor'], rewardText: 'the Surveyor\'s Rod, plans for the Lodge, 5,000 coins, 25 pearls and the title The Surveyor', unlock: 'lodge', unlockText: 'The builders will take on your biggest home now: the Lodge.',
    steps: [
      { t: 'talk', text: 'Ask Ranger Rhea at the Ridge Lookout about the map', npc: 'Rhea', at: v(CLEARINGS.tower.x, CLEARINGS.tower.z, 5), say: ['A corner of it, yes. It has been pinned up in the tower since before my time. Take it. Hattie at Pinewood Lodge has another piece, but she will want feeding first.'] },
      { t: 'catch', text: 'Catch 3 fish at Fern Pond for Hattie\'s supper', n: 3, match: (c) => c.zone === 'pond', pin: v(-76, 74) },
      { t: 'talk', text: 'Take the fish to Hattie at Pinewood Lodge', who: 'hattie', say: ['Lovely, these will do nicely. The map? It was lining my recipe drawer. Here. Before you go, there\'s a camper at Fernview in a state about a canoe.'] },
      { t: 'carry', text: 'A camper\'s canoe has drifted off at Fernview: tow it back to Fern Camp', label: 'Tie on the canoe', prop: 'canoe', at: v(CLEARINGS.fernview.x + 6, CLEARINGS.fernview.z + 12), to: v(CLEARINGS.camp.x, CLEARINGS.camp.z, 6), secs: 60, unlock: 'cottage', unlockText: 'Gus says the builders are free now. You can make your cabin bigger.' },
      { t: 'item', text: 'Find the surveyor\'s brass compass in the Quarry Shed', label: 'Take the brass compass', at: v(CLEARINGS.shed.x + 2, CLEARINGS.shed.z + 1) },
      { t: 'go', text: 'Take a bearing from the Lighthouse', label: 'Take a bearing', place: 'lighthouse', r: 9 },
      { t: 'go', text: 'Take a bearing at the Frozen Leviathan', label: 'Take a bearing', at: v(-143, -140, 16) },
      { t: 'go', text: 'Take a bearing at the Bog Hut', label: 'Take a bearing', at: v(CLEARINGS.bog.x, CLEARINGS.bog.z, 7) },
      { t: 'talk', text: 'Ask Old Hollis about the surveyor', npc: 'Hollis', at: v(CLEARINGS.hollis.x, CLEARINGS.hollis.z, 5), say: ['Knew him when I was a boy. Left his notebook with a trader. If anyone has it now it\'s that Wren, and her wagon never stops long in one place.'] },
      { t: 'talk', text: 'Find Wren\'s wagon, wherever it has stopped, and ask for the notebook', npc: 'Wren', at: v(CLEARINGS.wagon1.x, CLEARINGS.wagon1.z, 5), say: ['This old thing? It came with the wagon. It says the last piece went down with the wreck. Take it, I can\'t read his writing anyway.'] },
      { t: 'item', text: 'Search the Old Wreck for the last piece', label: 'Take the last piece', at: v(131.2, 159.6, 6) },
      { t: 'go', text: 'Follow the finished map to Echo Cavern and dig', label: 'Dig here', place: 'cave', r: 12, say: 'A tin box, and in it his last bearing, and a note: "For whoever finishes it." The map is whole.' },
      { t: 'talk', text: 'Bring the map home to Gus', npc: 'Gus', at: v(6, 45), say: ['Well, I never. He\'d have liked you. His old rod has been behind my counter for fifty years, and it\'s yours now. Go see what else is out there.'] },
    ] },
];
export const SAGA_BY_ID = Object.fromEntries(SAGA.map((L) => [L.id, L]));
export function addSaga(lines, people = {}) { for (const l of lines) { SAGA.push(l); SAGA_BY_ID[l.id] = l; } Object.assign(PEOPLE, people); }

/** Each other map's rules for the engine (src/game/saga.js): see the Saga class for the hooks. */
export const SAGA_MAPS = {};
export function addSagaMap(id, M) { SAGA_MAPS[id] = M; }
