// Quests: three daily requests on the notice board, one local who wants a particular fish each day,
// and the story of the Sunken Ruins and the Lanternfish.
import { SPECIES, SPECIES_BY_ID, ZONES } from '../data/species.js';
import { BAITS } from '../data/bait.js';
import { mulberry32 } from '../core/rng.js';
import { DEEP_C, zoneAt } from '../world/terrain.js';
import { DEEP_LEVEL, RUINS_LEVEL, BOAT_LEVEL } from './rules.js';

export const DAILY_BONUS = { coins: 100, xp: 80 };
export const today = (now = Date.now()) => Math.floor(now / 86400000);

const LAKE_ZONES = {
  cove: { name: 'Cozy Cove', zones: ['dock', 'shallows', 'open', 'deep', 'falls', 'ruins'] },
  frost: { name: 'Frostpine Lake', zones: ['frost'] },
  marsh: { name: 'Lilymarsh', zones: ['marsh'] },
  pond: { name: 'Fern Pond', zones: ['pond'] },
  river: { name: 'the waterways', zones: ['river'] },
  quarry: { name: 'Old Quarry', zones: ['quarry'] },
  cave: { name: 'Echo Cavern', zones: ['cave'] },
};

/** Pure: the three board requests for a day. Same for everyone. */
export function dailyQuests(day, level = 1) {
  const r = mulberry32(day * 9973 + 5);
  const pick = (a) => a[Math.floor(r() * a.length)];
  const easy = SPECIES.filter((s) => ['common', 'uncommon'].includes(s.tier) && s.times.length >= 1 && !s.shell && !s.spots && !s.lakeFish);
  const out = [];
  const lakes = Object.entries(LAKE_ZONES).filter(([k]) => (k !== 'cave' || level >= BOAT_LEVEL));
  const makers = [
    () => { const [id, L] = pick(lakes); const n = 3 + Math.floor(r() * 3); return { kind: 'catchAt', lake: id, n, text: `Catch ${n} fish at ${L.name}`, reward: { coins: 30 + n * 10, xp: 30 + n * 10 } }; },
    () => { const s = pick(easy); return { kind: 'species', speciesId: s.id, n: 1, text: `Catch a ${s.name}`, reward: { coins: s.tier === 'uncommon' ? 80 : 50, xp: 60 } }; },
    () => { const s = pick(easy.filter((x) => x.weight[1] >= 2)); const w = Math.round((s.weight[0] + (s.weight[1] - s.weight[0]) * 0.55) * 10) / 10; return { kind: 'weight', speciesId: s.id, min: w, n: 1, text: `Land a ${s.name} over ${w} lb`, reward: { coins: 90, xp: 70 } }; },
    () => { const ph = pick(['dawn', 'dusk', 'night']); return { kind: 'phase', phase: ph, n: 2, text: `Catch 2 fish at ${ph}`, reward: { coins: 70, xp: 60 } }; },
    () => ({ kind: 'release', n: 3, text: 'Release 3 fish back into the water', reward: { coins: 40, xp: 50 } }),
    () => { const b = pick(Object.keys(BAITS).filter((k) => k !== 'glowgrub')); return { kind: 'bait', bait: b, n: 2, text: `Catch 2 fish using ${BAITS[b].name}`, reward: { coins: 60, xp: 50 } }; },
    () => ({ kind: 'gear', n: 1, text: 'Set a crab pot or set line', reward: { coins: 50, xp: 40 } }),
    () => ({ kind: 'visit', n: 1, text: "Visit your cabin or a friend's", reward: { coins: 40, xp: 30 } }),
    // v1.8
    () => ({ kind: 'supercast', n: 3, text: 'Make 3 Super Casts (let go in the gold at the top of the bar)', reward: { coins: 80, xp: 70 } }),
    () => (level >= BOAT_LEVEL ? { kind: 'swirlcast', n: 2, text: 'Cast into a feeding school twice from your boat', reward: { coins: 90, xp: 80 } } : { kind: 'release', n: 3, text: 'Release 3 fish back into the water', reward: { coins: 40, xp: 50 } }),
    () => ({ kind: 'holder', n: 1, text: 'Land a fish from a propped-up rod (Rod holders upgrade)', reward: { coins: 80, xp: 70 } }),
    () => { const n = 2; return { kind: 'catchAt', lake: 'river', n, text: 'Catch 2 fish in the waterways (any creek or river)', reward: { coins: 70, xp: 60 } }; },
    () => ({ kind: 'tier', tier: 'rare', n: 1, text: 'Land any rare fish (or better)', reward: { coins: 100, xp: 90 } }),
  ];
  const used = new Set();
  while (out.length < 3) {
    const i = Math.floor(r() * makers.length);
    if (used.has(i)) continue;
    used.add(i);
    out.push({ id: `d${day}-${out.length}`, have: 0, done: false, claimed: false, ...makers[i]() });
  }
  return out;
}

/** Pure: does this event move this quest along? Returns how much. */
export function questStep(q, type, data = {}) {
  switch (q.kind) {
    case 'catchAt': return type === 'catch' && LAKE_ZONES[q.lake]?.zones.includes(data.zone) ? 1 : 0;
    case 'species': return type === 'catch' && data.speciesId === q.speciesId ? 1 : 0;
    case 'weight': return type === 'catch' && data.speciesId === q.speciesId && data.weight >= q.min ? 1 : 0;
    case 'phase': return type === 'catch' && data.phase === q.phase ? 1 : 0;
    case 'release': return type === 'release' ? 1 : 0;
    case 'bait': return type === 'catch' && data.bait === q.bait ? 1 : 0;
    case 'gear': return type === 'gear' ? 1 : 0;
    case 'visit': return type === 'visit' ? 1 : 0;
    case 'supercast': return type === 'supercast' ? 1 : 0;
    case 'swirlcast': return type === 'swirlcast' ? 1 : 0;
    case 'holder': return type === 'catch' && data.fromHolder ? 1 : 0;
    case 'tier': return type === 'catch' && ['rare', 'epic', 'legendary', 'mythic'].includes(SPECIES_BY_ID[data.speciesId]?.tier) ? 1 : 0;
    default: return 0;
  }
}

// ---- the weekly quest (v1.10): one bigger job a week, worth 5 pearls. Weeks start Monday 00:00 UTC.
export const WEEKLY_PEARLS = 5;
export const thisWeek = (now = Date.now()) => Math.floor((today(now) + 3) / 7);
export const weekEnds = (week) => (week * 7 + 4) * 86400000; // the next Monday, 00:00 UTC
/** Pure: the week's quest. Same for everyone. */
export function weeklyQuest(week) {
  const r = mulberry32(week * 7919 + 13);
  const opts = [
    { kind: 'catchAny', n: 30, text: 'Catch 30 fish this week' },
    { kind: 'kinds', n: 10, text: 'Catch 10 different kinds of fish this week' },
    { kind: 'lakes', n: 4, text: 'Catch a fish at 4 different lakes this week' },
    { kind: 'tier', tier: 'rare', n: 4, text: 'Land 4 rare fish (or better) this week' },
    { kind: 'supercast', n: 15, text: 'Make 15 Super Casts this week' },
    { kind: 'release', n: 15, text: 'Release 15 fish back into the water this week' },
  ];
  const q = opts[Math.floor(r() * opts.length)];
  return { id: `w${week}`, week, have: 0, seen: [], done: false, claimed: false, ...q, reward: { coins: 150, pearls: WEEKLY_PEARLS, xp: 200 } };
}
const FIVE = ['cove', 'frost', 'marsh', 'pond', 'quarry'];
const LAKE_OF = (zone) => FIVE.find((k) => LAKE_ZONES[k].zones.includes(zone)) || null;
/** Pure: moves the weekly quest along; returns the updated quest (or the same one). */
export function weeklyStep(q, type, data = {}) {
  if (!q || q.done) return q;
  let key = null, k = 0;
  switch (q.kind) {
    case 'catchAny': k = type === 'catch' ? 1 : 0; break;
    case 'kinds': if (type === 'catch' && data.speciesId) key = data.speciesId; break;
    case 'lakes': if (type === 'catch') key = LAKE_OF(data.zone); break;
    default: k = questStep(q, type, data);
  }
  if (key) { if (q.seen.includes(key)) return q; q = { ...q, seen: [...q.seen, key] }; k = 1; }
  if (!k) return q;
  const have = Math.min(q.n, q.have + k);
  return { ...q, have, done: have >= q.n };
}

// ---- the story: the Sunken Ruins and the Lanternfish
export const STORY = [
  { title: 'Lights under the cove', text: 'Gus leans on the counter. "Folks say there are lights under the deep water at night. Old stories. Catch a few fish around the cove and I\'ll tell you the rest."', goal: 'Catch 5 fish in Cozy Cove', n: 5, test: (t, d) => t === 'catch' && LAKE_ZONES.cove.zones.includes(d.zone), reward: { coins: 60, xp: 40 } },
  { title: 'The keeper\'s note', text: '"The lighthouse keeper wrote it all down before she left for the city. She said the falls carry things down from the old town. Try the Waterfall Pool."', goal: 'Catch a fish at the Waterfall Pool', n: 1, test: (t, d) => t === 'catch' && d.zone === 'falls', reward: { coins: 80, xp: 60 } },
  { title: 'Stones that were a town', text: '"There are stones under the deep water that were once a town," the note says. Row out over the middle of the cove at night and look down.', goal: `Row over the ruins at night (boat, level ${BOAT_LEVEL}+)`, n: 1, test: (t, d) => t === 'reach' && d.place === 'ruins' && d.phase === 'night', reward: { coins: 100, xp: 80 } },
  { title: 'Deep water', text: 'Something glints far below. You\'ll need a longer line to reach it.', goal: `Catch something in The Deep (level ${DEEP_LEVEL}+)`, n: 1, test: (t, d) => t === 'catch' && (d.zone === 'deep' || d.zone === 'ruins'), reward: { coins: 150, xp: 120 } },
  { title: 'The light-eaters', text: '"Glowing fish follow the lanternfish," the note ends. "Where they feed, it surfaces." Catch a fish that glows.', goal: 'Catch a Glow Eel, Moonfin or Ghost Koi', n: 1, test: (t, d) => t === 'catch' && ['gloweel', 'moonfin', 'ghostkoi'].includes(d.speciesId), reward: { coins: 200, pearls: 3, xp: 150 } },
  { title: 'The Lanternfish', text: 'Under the full dark, the ruins answer. The Lanternfish of the Ruins is waiting for someone patient.', goal: `Catch the Lanternfish of the Ruins (level ${RUINS_LEVEL}+, at night)`, n: 1, test: (t, d) => t === 'catch' && d.speciesId === 'lanternfish', reward: { coins: 500, pearls: 25, xp: 300, title: 'Lantern Keeper', item: 'lure_lantern' } },
];

// ---- the second quest line (v1.8): The Valley Expedition, a tour of the new waterways and what lives there
export const STORY2 = [
  { title: 'Beyond the cove', text: 'Gus taps a new chart pinned behind the counter. "They dug the old canals out again. Every lake in the valley joins up now. Row out and see one for yourself."', goal: `Row a waterway to another lake (boat, level ${BOAT_LEVEL}+)`, n: 1, test: (t, d) => t === 'reach' && ['frost', 'marsh', 'pond', 'quarry'].includes(d.place), reward: { coins: 120, xp: 80 } },
  { title: 'Cold water', text: '"Frostpine runs cold and clear. The trout up there fight like they mean it."', goal: 'Catch 3 fish at Frostpine Lake', n: 3, test: (t, d) => t === 'catch' && d.zone === 'frost', reward: { coins: 150, xp: 100 } },
  { title: 'Weather watcher', text: '"Some fish only come up in their weather. Grayling under grey skies, dace in the rain, the Thunder Bass in a storm."', goal: 'Catch a Grayling, Drizzle Dace, Rainspotted Trout or Thunder Bass', n: 1, test: (t, d) => t === 'catch' && ['greyling', 'drizzledace', 'rainspot', 'thunderbass'].includes(d.speciesId), reward: { coins: 200, pearls: 2, xp: 120 } },
  { title: 'X marks the spot', text: '"Anglers used to bury what they found. Maps still turn up on hooks now and then. If you find one, follow it."', goal: 'Dig up a buried treasure chest', n: 1, test: (t) => t === 'treasure', reward: { coins: 200, xp: 120 } },
  { title: 'Into the dark', text: '"There\'s a spur off the Quarry Cut that runs right into Cavern Hill. Folks say it hums in there."', goal: 'Row into Echo Cavern', n: 1, test: (t, d) => t === 'reach' && d.place === 'cave', reward: { coins: 150, xp: 100 } },
  { title: 'Echoes', text: 'Your voice comes back to you three times. Pale fish drift under the boat, and the walls glow.', goal: 'Catch 3 fish in Echo Cavern', n: 3, test: (t, d) => t === 'catch' && d.zone === 'cave', reward: { coins: 250, pearls: 3, xp: 150 } },
  { title: 'Red night', text: '"Once in a while the moon comes up red. Hunters bite then. Keep your fingers out of the water."', goal: 'Catch a fish under the Blood Moon', n: 1, test: (t, d) => t === 'catch' && SPECIES_BY_ID[d.speciesId]?.bloodMoon, reward: { coins: 300, pearls: 4, xp: 180 } },
  { title: 'The Echo Eel', text: 'Deep in the cavern something answers every sound you make. The Echo Eel. Bring a strong line.', goal: 'Catch the Echo Eel in Echo Cavern', n: 1, test: (t, d) => t === 'catch' && d.speciesId === 'echoeel', reward: { coins: 800, pearls: 30, xp: 400, title: 'Valley Legend' } },
];

// ---- collection quests (v1.8): Fishpedia milestones
export const MILESTONES = [
  { id: 'kinds10', text: 'Catch 10 different kinds of fish', n: 10, reward: { coins: 200, xp: 100 } },
  { id: 'kinds20', text: 'Catch 20 different kinds of fish', n: 20, reward: { coins: 400, pearls: 3, xp: 200 } },
  { id: 'kinds30', text: 'Catch 30 different kinds of fish', n: 30, reward: { coins: 700, pearls: 6, xp: 350 } },
  { id: 'kinds40', text: 'Catch 40 different kinds of fish', n: 40, reward: { coins: 1000, pearls: 10, xp: 500 } },
  { id: 'kindsAll', text: 'Catch every kind of fish in the valley', n: SPECIES.length, reward: { coins: 3000, pearls: 40, xp: 1500, title: 'Master Angler' } },
  { id: 'epic1', text: 'Land your first epic fish', n: 1, tier: 'epic', reward: { coins: 300, pearls: 2, xp: 150 } },
  { id: 'legend1', text: 'Land your first legendary fish', n: 1, tier: 'legendary', reward: { coins: 600, pearls: 5, xp: 300 } },
  { id: 'gold5', text: 'Catch 5 gold fish', n: 5, variant: 'gold', reward: { coins: 400, pearls: 3, xp: 200 } },
];
/** Pure: progress on a milestone from the Fishpedia (species id -> { normal, gold, diamond, best }). */
const TIER_RANK = { common: 0, uncommon: 1, rare: 2, epic: 3, legendary: 4, mythic: 5 };
export function milestoneProgress(m, pedia = {}) {
  const ids = Object.keys(pedia).filter((k) => SPECIES_BY_ID[k]);
  if (m.tier) return ids.filter((k) => TIER_RANK[SPECIES_BY_ID[k].tier] >= TIER_RANK[m.tier]).length;
  if (m.variant) return ids.reduce((a, k) => a + (pedia[k]?.[m.variant] || 0), 0);
  return ids.length;
}

// ---- locals' requests
const ASKS = ['I\'ve been craving a {fish} all week. Could you bring me one?', 'My grandkid has never seen a {fish}. Would you catch one for us?', 'I bet you can\'t catch me a {fish}! I\'ll make it worth your while.', 'Gus said you\'re good. Bring me a {fish}?'];

export class Quests {
  constructor(game) { this.game = game; }
  get d() { return this.game.ext.d; }

  init() { this.refresh(); this.weekly(); }

  /** This week's quest, rolled over on Monday. */
  weekly() {
    const wk = thisWeek();
    if (this.d.weekly?.week !== wk) this.game.ext.change((d) => { d.weekly = weeklyQuest(wk); });
    return this.d.weekly;
  }
  async claimWeekly() {
    const q = this.weekly();
    if (!q.done || q.claimed) return;
    const r = await this.game.reward('weekly', q.id, q.reward, `Weekly quest: ${q.text}`);
    if (r?.ok !== false) this.game.ext.change((d) => { d.weekly.claimed = true; d.stats.questsDone = (d.stats.questsDone || 0) + 1; });
  }

  refresh() {
    const day = today();
    const same = this.d.quests.day === day;
    if (same && (this.d.quests.npc || !this.game.npcs?.list?.length)) return;
    const lvl = this.game.profile.level;
    const list = same ? this.d.quests.list : dailyQuests(day, lvl);
    // the local with a request today
    const r = mulberry32(day * 31 + 7);
    const npcs = (this.game.npcs?.list || []).filter((n) => n.kind === 'roamer' && ['cove', 'pond', 'marsh', 'frost', 'lodge'].includes(n.area));
    const fish = SPECIES.filter((s) => (s.tier === 'common' || (s.tier === 'uncommon' && lvl >= 3)) && !s.shell && !s.spots && !s.lakeFish);
    const npc = npcs.length ? npcs[Math.floor(r() * npcs.length)] : null;
    const want = fish[Math.floor(r() * fish.length)];
    this.game.ext.change((d) => {
      d.quests = { ...(same ? d.quests : {}), day, list, npc: npc ? { id: npc.id, name: npc.name, speciesId: want.id, ask: ASKS[Math.floor(r() * ASKS.length)].replace('{fish}', want.name), done: false, reward: { coins: want.tier === 'uncommon' ? 160 : 90, xp: 60 } } : null };
    });
  }

  /** Feed game events in: 'catch' (catch), 'release', 'gear', 'visit', 'reach'. */
  progress(type, data = {}) {
    this.refresh();
    const g = this.game;
    let changed = false;
    const done = [];
    const wq = this.weekly(), wn = weeklyStep(wq, type, data);
    g.ext.change((d) => {
      if (wn !== wq) { d.weekly = wn; changed = true; }
      for (const q of d.quests.list) {
        if (q.done) continue;
        const k = questStep(q, type, data);
        if (k) { q.have = Math.min(q.n, q.have + k); changed = true; if (q.have >= q.n) { q.done = true; done.push(q); } }
      }
      const st = STORY[d.story.step];
      if (st && st.test(type, data)) {
        d.story.have = (d.story.have || 0) + 1;
        if (d.story.have >= st.n) { d.story.ready = true; }
        changed = true;
      }
      const s2 = STORY2[d.story2.step];
      if (s2 && !d.story2.ready && s2.test(type, data)) {
        d.story2.have = (d.story2.have || 0) + 1;
        if (d.story2.have >= s2.n) d.story2.ready = true;
        changed = true;
      }
    });
    const s2 = STORY2[this.d.story2.step];
    if (s2 && this.d.story2.ready && !this.announced2) {
      this.announced2 = true;
      g.chat?.system(`Valley Expedition: "${s2.title}" complete! Claim it in the Journal (J).`, 'quest', { popup: true });
    }
    if (wn !== wq && wn.done) { g.chat?.system(`Weekly quest done: ${wn.text}. Claim ${WEEKLY_PEARLS} pearls at the notice board (B).`, 'quest', { popup: true }); g.audio.sfx('achievement'); }
    for (const q of done) {
      g.chat?.system(`Request done: ${q.text}. Claim your reward at the notice board (B).`, 'quest', { popup: true });
      g.audio.sfx('achievement');
    }
    const st = STORY[this.d.story.step];
    if (st && this.d.story.ready && !this.announced) {
      this.announced = true;
      g.chat?.system(`Story: "${st.title}" complete! Open the Journal (J) to read on.`, 'quest', { popup: true });
    }
    return changed;
  }

  async claim(id) {
    const q = this.d.quests.list.find((x) => x.id === id);
    if (!q || !q.done || q.claimed) return;
    const r = await this.game.reward('quest', q.id, q.reward, q.text);
    if (r?.ok !== false) this.game.ext.change((d) => { const x = d.quests.list.find((y) => y.id === id); if (x) x.claimed = true; d.stats.questsDone = (d.stats.questsDone || 0) + 1; });
  }

  async claimStory() {
    const d = this.d, st = STORY[d.story.step];
    if (!st || !d.story.ready) return;
    const r = await this.game.reward('story', `story${d.story.step}`, st.reward, st.title);
    if (r?.ok === false) return;
    this.announced = false;
    this.game.ext.change((x) => { x.story.log.push({ step: x.story.step, at: Date.now() }); x.story.step++; x.story.have = 0; x.story.ready = false; });
    const next = STORY[this.d.story.step];
    if (next) this.game.chat?.system(`New chapter: "${next.title}". ${next.goal}.`, 'quest', { popup: true });
  }

  async claimStory2() {
    const d = this.d, st = STORY2[d.story2.step];
    if (!st || !d.story2.ready) return;
    const r = await this.game.reward('story2', `exp${d.story2.step}`, st.reward, st.title);
    if (r?.ok === false) return;
    this.announced2 = false;
    this.game.ext.change((x) => { x.story2.log.push({ step: x.story2.step, at: Date.now() }); x.story2.step++; x.story2.have = 0; x.story2.ready = false; });
    const next = STORY2[this.d.story2.step];
    if (next) this.game.chat?.system(`Valley Expedition, next: "${next.title}". ${next.goal}.`, 'quest', { popup: true });
  }

  /** All three of today's requests claimed: a bonus on top. */
  dailyBonusReady() { const q = this.d.quests; return q.list.length > 0 && q.list.every((x) => x.claimed) && !q.bonus; }
  async claimDailyBonus() {
    if (!this.dailyBonusReady()) return;
    const r = await this.game.reward('quest', `bonus${this.d.quests.day}`, DAILY_BONUS, 'Daily bonus: all three requests done');
    if (r?.ok !== false) this.game.ext.change((d) => { d.quests.bonus = true; });
  }

  milestones() { const pedia = this.game.profile.fishpedia || {}; return MILESTONES.map((m) => ({ ...m, have: Math.min(m.n, milestoneProgress(m, pedia)), claimed: !!this.d.milestones?.[m.id] })); }
  async claimMilestone(id) {
    const m = this.milestones().find((x) => x.id === id);
    if (!m || m.claimed || m.have < m.n) return;
    const r = await this.game.reward('milestone', id, m.reward, m.text);
    if (r?.ok !== false) this.game.ext.change((d) => { d.milestones = { ...(d.milestones || {}), [id]: Date.now() }; });
  }

  // The local with a request: a context action when you're next to them.
  npcRequest() {
    if (!this.d.quests.npc && this.game.npcs?.list?.length) this.refresh(); // the locals arrived after today's quests were set
    const q = this.d.quests.npc;
    if (!q || q.done) return null;
    const npc = this.game.npcs?.list.find((n) => n.id === q.id);
    return npc ? { q, npc } : null;
  }

  contextActions() {
    const r = this.npcRequest();
    if (!r) return [];
    const p = this.game.player.pos;
    if (Math.hypot(r.npc.pos.x - p.x, r.npc.pos.z - p.z) > 3.2) return [];
    const have = [...this.game.profile.creel, ...this.game.profile.storage].filter((c) => c.speciesId === r.q.speciesId && c.variant === 'normal' && !this.d.locked.includes(c.id));
    const sp = SPECIES_BY_ID[r.q.speciesId];
    // v1.9.3: every local's request goes through a short conversation (Dialogue), where you accept it or not
    return [{ id: `talk-${r.q.id}`, label: `Talk to ${r.q.name}`, color: have.length && r.q.accepted ? 'gold' : 'green', fn: () => this.talk(r, sp, have) }];
  }

  async talk(r, sp, have) {
    const g = this.game, q = r.q, D = g.dialogue;
    const where = (sp.zones || []).map((z) => ZONES[z]?.name).filter(Boolean).slice(0, 3).join(', ');
    if (!q.accepted) {
      await D.open({ npc: r.npc, title: 'Has a request', text: `${q.ask} I'll give you ${q.reward.coins} coins for it.`, choices: [
        { label: 'Sure, I\'ll find one!', primary: true, fn: () => {
          g.ext.change((d) => { d.quests.npc.accepted = true; });
          g.audio.sfx('page');
          g.npcs.say(r.npc, 'Thank you!', performance.now());
          g.ui.toast(`Request accepted: bring a ${sp.name} to ${q.name}.${where ? ` Try ${where}.` : ''} It's on your Notice board (B).`, { icon: 'scroll', ms: 5500 });
        } },
        { label: 'Not right now' },
      ] });
      return;
    }
    if (have.length) {
      await D.open({ npc: r.npc, title: 'Your request', text: `Is that a ${sp.name} in your backpack? Oh, may I have it?`, choices: [
        { label: `Give the ${sp.name}`, primary: true, fn: () => this.give(have.sort((a, b) => a.weight - b.weight)[0]) },
        { label: 'Not yet' },
      ] });
      return;
    }
    await D.open({ npc: r.npc, title: 'Your request', text: `Any luck finding a ${sp.name}?${where ? ` They say they bite around ${where}.` : ''} No rush!`, choices: [{ label: 'I\'m on it!', primary: true }] });
  }

  async give(c) {
    const g = this.game, q = this.d.quests.npc;
    const ok = await g.save.give(c.id);
    if (!ok) { g.ui.toast("Couldn't hand that one over."); return; }
    const npc = g.npcs.list.find((n) => n.id === q.id);
    if (npc) { npc.emote = { id: 'cheer', until: performance.now() + 2800 }; g.npcs.say(npc, `A ${SPECIES_BY_ID[c.speciesId].name}! Thank you, ${g.profile.name}!`, performance.now()); }
    await g.reward('npc', `npc${this.d.quests.day}`, q.reward, `${q.name}'s request`);
    g.ext.change((d) => { d.quests.npc.done = true; });
    g.ext.bump('requests');
  }

  // Marks the requesting local on their nameplate.
  isAsking(npcId) { const q = this.d.quests.npc; return !!q && !q.done && q.id === npcId; }

  // Story trigger for "row over the ruins at night"
  tick() {
    const g = this.game;
    if (g.player.mode !== 'boat') return;
    if (Math.hypot(g.player.pos.x - DEEP_C.x, g.player.pos.z - DEEP_C.z) < 5) this.progress('reach', { place: 'ruins', phase: g.engine.sky.state.phase });
    const z = zoneAt(g.player.pos.x, g.player.pos.z);
    if (z && z !== this.lastReach && ['frost', 'marsh', 'pond', 'quarry', 'cave'].includes(z)) { this.lastReach = z; this.progress('reach', { place: z }); }
  }

  zoneName(z) { return ZONES[z]?.name || z; }
}
