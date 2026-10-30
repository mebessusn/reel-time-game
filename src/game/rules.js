// Pure game rules: bite rolls, rewards, progression, economy.
// Used directly by the save (src/save/local.js).
import { SPECIES, SPECIES_BY_ID, TIERS, TIER_INFO, VARIANTS, BASE_TIER_ODDS, DIAMOND_PEARLS, JUNK, BOTTLE_MESSAGES } from '../data/species.js';
import { ITEMS_BY_ID, STARTER_ITEMS } from '../data/items.js';
import { ACHIEVEMENTS, ACH_BY_ID } from '../data/achievements.js';
import { defaultAvatar } from '../data/avatarOptions.js';
import { weekId } from '../core/clock.js';
import { BAITS } from '../data/bait.js';
import { seasonBoost } from '../data/seasons.js';
import { OCEAN_SPECIES, OCEAN_ZONES } from '../data/oceanSpecies.js';
import { NORTH_SPECIES, NORTH_ZONES } from '../data/northSpecies.js';

export const CREEL_MAX = 20;
export const STORAGE_MAX = 200;
export const BOAT_LEVEL = 3;
export const DEEP_LEVEL = 10;
export const RUINS_LEVEL = 20;
export const MAX_LEVEL = 50;

// v1.13.9 balance: early levels stay quick, later ones take real time (about 80 hours of play to level 50).
export function xpForLevel(level) { return Math.round(50 * level * (level - 1) * (1 + 1.7 * Math.pow(level / 50, 1.5))); }
/** The pre-v1.13.9 curve, only to keep players at the level they had reached (see ensureProfileShape). */
export function oldXpForLevel(level) { return 50 * level * (level - 1); }
export function levelForXp(xp) {
  let L = 1;
  while (L < MAX_LEVEL && xp >= xpForLevel(L + 1)) L++;
  return L;
}

export function newProfile(name = 'Angler') {
  return {
    version: 1,
    name,
    avatar: null, // null until the creator is finished
    level: 1, xp: 0, title: '', titles: [],
    coins: 0, pearls: 0,
    owned: [...STARTER_ITEMS],
    equipped: { rod: 'rod_willow', lure: 'lure_classic', boat: 'boat_oak' },
    creel: [], storage: [],
    fishpedia: {},
    stats: {},
    achievements: {},
    bottles: [],
    records: {},
    catchCount: 0,
    createdAt: Date.now(),
    settings: defaultSettings(),
  };
}

export function defaultSettings() {
  return {
    master: 0.6, music: 0.5, sfx: 0.8, ambience: 0.3, others: 0.5, ambV2: true,
    muteUnfocused: true, relaxedReel: false, reducedMotion: false, colorBlind: false, autoRes: true,
    graphics: 'medium', showNames: true, showFeed: true, chatBubbles: true, chatFilter: true, tips: true,
    uiScale: 1, captions: false, realWeather: false,
  };
}

export function ensureProfileShape(p) {
  const base = newProfile(p?.name);
  const out = { ...base, ...p };
  out.equipped = { ...base.equipped, ...(p?.equipped || {}) };
  out.settings = { ...defaultSettings(), ...(p?.settings || {}) };
  // v1.8 halved the ambience default: players still on the old default move to the new one, once.
  if (!p?.settings?.ambV2) { if (out.settings.ambience === 0.6) out.settings.ambience = 0.3; out.settings.ambV2 = true; }
  for (const id of STARTER_ITEMS) if (!out.owned.includes(id)) out.owned.push(id);
  out.stats = out.stats || {};
  // v1.13.9: the steeper curve never takes a level away. Once per local save, lift XP to the new curve's floor
  // for the level the old curve gave (cloud saves are migrated on the server and arrive with xpCurve2 set).
  if (!out.xpCurve2) {
    let old = 1; while (old < MAX_LEVEL && (out.xp || 0) >= oldXpForLevel(old + 1)) old++;
    out.xp = Math.max(out.xp || 0, xpForLevel(old));
    out.xpCurve2 = true;
  }
  out.level = levelForXp(out.xp || 0);
  if (out.avatar) out.avatar = { ...defaultAvatar(out.avatar.gender), ...out.avatar };
  return out;
}

export function perksOf(profile) {
  const perks = {};
  for (const slot of ['rod', 'lure']) {
    const item = ITEMS_BY_ID[profile.equipped?.[slot]];
    if (item?.perk) for (const [k, v] of Object.entries(item.perk)) perks[k] = (perks[k] || 0) + v;
  }
  return perks;
}

// The zone a cast actually fishes, given level gates.
export function effectiveZone(zone, level, phase, perks = {}) {
  if (zone === 'ruins') {
    if (level < RUINS_LEVEL) return level >= DEEP_LEVEL ? 'deep' : 'open';
    if (phase !== 'night' && !perks.ruinsNight) return 'deep';
    return 'ruins';
  }
  if ((zone === 'deep' || zone === 'quarry') && level < DEEP_LEVEL) return 'open';
  return zone;
}

// Seconds until a bite.
export function biteDelay(ctx, r = Math.random) {
  const p = ctx.perks || {};
  let mult = 1;
  mult -= p.biteSpeed || 0;
  if (ctx.weather === 'overcast') mult -= 0.1;
  if (ctx.weather === 'rain' || ctx.weather === 'storm') mult -= 0.2;
  if (ctx.zone === 'deep' || ctx.zone === 'ruins') mult -= p.deepBite || 0;
  if (ctx.zone === 'shallows') mult -= p.shallowsBite || 0;
  if (ctx.zone === 'creek' || ctx.zone === 'river') mult -= p.flowBite || 0; // v1.14.9 the fly rod
  if (ctx.phase === 'night') mult -= p.nightBite || 0;
  if (ctx.perfectCast) mult -= 0.05;
  if (ctx.superCast) mult -= 0.25;
  if (ctx.bloodMoon) mult -= 0.3;
  if (ctx.goodCompany) mult -= 0.05;
  if (ctx.bait && BAITS[ctx.bait]?.biteSpeed) mult -= BAITS[ctx.bait].biteSpeed;
  if (ctx.event === 'migration') mult -= 0.25;
  mult = Math.max(0.4, mult);
  if (ctx.firstEver) return 2 + r() * 2; // first bite is quick
  return Math.max(2, (4 + r() * 16) * mult);
}

export function tierOdds(ctx) {
  const odds = { ...BASE_TIER_ODDS };
  let rareMult = 1;
  const deep = ctx.zone === 'deep' || ctx.zone === 'ruins';
  if (ctx.zone === 'dock') rareMult *= 0.5;
  if (ctx.fullMoon) rareMult *= 1.1;
  if (ctx.weather === 'rain') rareMult *= 1.05;
  if (ctx.weather === 'storm') rareMult *= 1.15;
  if (ctx.event === 'meteor') rareMult *= 1.3;
  if (ctx.superCast) rareMult *= 1.25;
  const bait = BAITS[ctx.bait];
  if (bait?.rare) rareMult *= bait.rare;
  for (const t of ['rare', 'epic', 'legendary', 'mythic']) odds[t] *= rareMult * (deep ? (t === 'rare' || t === 'epic' ? 2 : 1.5) : 1);
  // Feeding schools (boat only): rare fish run with the school
  if (ctx.swirl) { odds.rare *= 2.5; odds.epic *= 2.5; odds.legendary *= 2; odds.mythic *= 2; odds.common *= 0.6; }
  if (bait?.epic) { odds.epic *= bait.epic; odds.legendary *= bait.epic; }
  if (ctx.event === 'fog' && ctx.zone === 'ruins') odds.mythic *= 2;
  // v1.12: a lake's marked spots fish like the Deep, and a legend's home gives its legend a real chance
  if (ctx.spotKind) { odds.rare *= 1.6; odds.epic *= 1.8; }
  if (ctx.spotKind === 'legend') odds.legendary *= 4;
  if (ctx.spotKind === 'mythic') { odds.mythic *= 2; odds.legendary *= 2; }
  if (ctx.zone === 'abyss') { odds.common *= 0.3; odds.uncommon *= 0.5; odds.epic *= 2; odds.legendary *= 3; } // v1.15.12: the Abyss: few small fish, many monsters
  if (ctx.zone === 'ridge' && (ctx.weather === 'storm' || ctx.weather === 'rain')) odds.legendary *= 3; // Frostmere: the Glacier King comes up in a snowstorm
  if (ctx.zone === 'springs' && ctx.aurora) odds.mythic *= 6;
  else if (ctx.zone !== 'ruins' && ctx.spotKind !== 'mythic') odds.mythic = 0;
  return odds;
}

export function eligibleSpecies(tier, ctx) {
  return (OCEAN_ZONES[ctx.zone] ? OCEAN_SPECIES : NORTH_ZONES[ctx.zone] ? NORTH_SPECIES : SPECIES).filter((s) => { // v1.15: the sea has its own fish (and Frostmere its own)
    if (tier && s.tier !== tier) return false;
    if (s.shell) return false; // v1.12: shellfish only come up in traps
    if (s.spear && !ctx.spear) return false; // v1.15: some reef fish only come to a speargun
    if (s.spots) return !!ctx.spot && s.spots.includes(ctx.spot) && (s.times.includes('any') || s.times.includes(ctx.phase)) && (!s.weather || s.weather.includes(ctx.weather)); // lake exclusives live in their lake's deep end or landmark
    const zoneOk = s.zones.includes(ctx.zone) || (ctx.zone === 'ruins' && s.zones.includes('deep'));
    if (!zoneOk) return false;
    if (!s.times.includes('any') && !s.times.includes(ctx.phase) && !(s.deep && ctx.zone === 'abyss')) return false; // (v1.15.12: in the Abyss it's always night)
    if (s.weather && !s.weather.includes(ctx.weather)) return false;
    if (s.bloodMoon && !ctx.bloodMoon) return false;
    if (s.great && !ctx.great) return false; // (v1.17.2: the Spirit Whitefish rises only on a Great Aurora)
    if (s.aurora && !ctx.aurora) return false; // Frostmere: the Aurora Char rises only under the lights
    return true;
  });
}

function pickWeighted(list, weightFn, r) {
  const total = list.reduce((a, x) => a + weightFn(x), 0);
  let x = r() * total;
  for (const item of list) {
    x -= weightFn(item);
    if (x <= 0) return item;
  }
  return list[list.length - 1];
}

export function variantOdds(ctx) {
  const p = ctx.perks || {};
  let diamond = (1 / 250) * (1 + (p.diamondOdds || 0));
  if (ctx.fullMoon) diamond *= 1.1;
  if (ctx.weather === 'storm') diamond *= 1.15;
  diamond = Math.min(diamond, 1 / 100);
  let gold = (1 / 40) * (1 + (p.goldOdds || 0));
  if (ctx.swirl) { gold *= 1.5; diamond = Math.min(diamond * 1.5, 1 / 80); }
  return { diamond, gold };
}

export function rollWeight(species, r = Math.random) {
  const [min, max] = species.weight;
  const w = min + (max - min) * Math.pow(r(), 2.2);
  return Math.round(w * 100) / 100;
}

/** v1.9.3: in plain open water (not deep water, the ruins or a feeding school) this share of fish too heavy for
 * your line are swapped for one it can hold, so new anglers aren't snapping line on most casts. */
export const OPEN_WATER_EASE = 0.3;
export function easeOverweight(bite, ctx, rating, r = Math.random) {
  if (!bite || bite.kind !== 'fish' || bite.answer || ctx.swirl || ctx.zone === 'deep' || ctx.zone === 'ruins') return bite;
  if (!(bite.weight > rating) || r() >= OPEN_WATER_EASE) return bite;
  const sp = SPECIES_BY_ID[bite.speciesId];
  if (sp && sp.weight[0] <= rating) {
    const [min, max] = sp.weight, top = Math.min(max, rating);
    return { ...bite, weight: Math.round((min + (top - min) * Math.pow(r(), 2.2)) * 100) / 100, eased: true };
  }
  for (let i = 0; i < 8; i++) {
    const b = rollBite({ ...ctx, noJunk: true }, r);
    if (b.kind === 'fish' && b.weight <= rating) return { ...b, bait: bite.bait, eased: true };
  }
  return bite;
}

// Roll what bites. Returns { kind: 'fish', speciesId, variant, weight } or { kind: 'junk', junkId }
export function rollBite(ctx, r = Math.random) {
  if (!ctx.noJunk && !ctx.firstEver && r() < 0.08) {
    const j = pickWeighted(JUNK, (x) => x.odds, r);
    return { kind: 'junk', junkId: j.id };
  }
  const odds = tierOdds(ctx);
  // Only roll tiers that have something biting here right now.
  const live = TIERS.filter((t) => odds[t] > 0 && eligibleSpecies(t, ctx).length);
  // Bait pulls toward the fish it attracts, across tiers too (crickets bring the jumpers up).
  const bait = BAITS[ctx.bait];
  // The season does the same for its fish.
  const pull = (t) => {
    if (!bait && !ctx.season) return 1;
    const l = eligibleSpecies(t, ctx);
    return l.reduce((a, s) => a + (bait ? bait.likes(s) : 1) * (ctx.season ? seasonBoost(ctx.season, s.id) : 1), 0) / l.length;
  };
  let list = [];
  // v1.9.5 Well Fed: you smell of the fish you ate, and its relatives come looking (if they live here)
  if (ctx.craving && !ctx.firstEver && SPECIES_BY_ID[ctx.craving] && r() < 0.3 && eligibleSpecies(null, ctx).some((s) => s.id === ctx.craving)) list = [SPECIES_BY_ID[ctx.craving]];
  else if (live.length) list = eligibleSpecies(pickWeighted(live, (t) => odds[t] * pull(t), r), ctx);
  if (!list.length) list = eligibleSpecies(null, { ...ctx, phase: 'day', weather: 'clear' });
  if (!list.length) list = [SPECIES_BY_ID.bluegill];
  if (ctx.firstEver) list = [SPECIES_BY_ID.bluegill];
  const species = pickWeighted(list, (s) => {
    let w = 1;
    if (s.moonBoost && ctx.fullMoon) w *= 3;
    if (s.weatherBoost && s.weatherBoost.includes(ctx.weather)) w *= 2;
    if (s.weather) w *= 3; // weather fish are the point of fishing in that weather
    if (s.spots) w *= 4; // v1.12: a spot's own fish are why you came
    if (s.lakeFish) w *= 3; // v1.13: and a lake's own fish are why you rowed there
    if (ctx.perks?.flowBite && (ctx.zone === 'creek' || ctx.zone === 'river') && s.behaviour === 'jump') w *= 2.2; // v1.14.9: trout rise to a fly
    if (s.bloodMoon) w *= 4; // and under a blood moon, the hunters crowd everything else out
    if (ctx.bait && BAITS[ctx.bait]) w *= BAITS[ctx.bait].likes(s);
    if (ctx.season) w *= seasonBoost(ctx.season, s.id);
    if (ctx.boost?.[s.id]) w *= ctx.boost[s.id]; // v1.15.10: Open Waters' squid lights (and later, the sea's own events)
    return w;
  }, r);
  const vo = variantOdds(ctx);
  const vr = r();
  const variant = ctx.firstEver ? 'normal' : vr < vo.diamond ? 'diamond' : vr < vo.diamond + vo.gold ? 'gold' : 'normal';
  return { kind: 'fish', speciesId: species.id, variant, weight: rollWeight(species, r) };
}

export function catchValue(speciesId, variant, weight) {
  const s = SPECIES_BY_ID[speciesId];
  if (!s) return 0;
  // v1.15: big-game fish have their own price, scaled by weight (a big one pays for the charter)
  if (s.value) return Math.max(1, Math.round(s.value.coins * VARIANTS[variant].coinMult * ((weight / s.weight[1]) * 0.6 + 0.4)));
  const t = TIER_INFO[s.tier];
  return Math.max(1, Math.round(t.coins * VARIANTS[variant].coinMult * ((weight / s.weight[1]) * 0.5 + 0.75)));
}

export function catchXp(speciesId) {
  const s = SPECIES_BY_ID[speciesId];
  if (s?.value) return s.value.xp;
  return Math.round(TIER_INFO[s.tier].xp * (1 + 0.1 * s.difficulty));
}

export function catchPoints(speciesId, variant) {
  const s = SPECIES_BY_ID[speciesId];
  return TIER_INFO[s.tier].points * VARIANTS[variant].pointMult;
}

export function tradePearls(speciesId, variant) {
  const s = SPECIES_BY_ID[speciesId];
  if (variant === 'diamond') return DIAMOND_PEARLS[s.tier];
  return TIER_INFO[s.tier].pearlsTrade;
}

export function isGreatCatch(c) {
  const s = SPECIES_BY_ID[c.speciesId];
  return ['rare', 'epic', 'legendary', 'mythic'].includes(s.tier) || !!s.big || c.variant !== 'normal' || c.record;
}

const inc = (stats, k, n = 1) => { stats[k] = (stats[k] || 0) + n; };

function addXp(p, xp) {
  const before = p.level;
  p.xp += xp;
  p.level = levelForXp(p.xp);
  return p.level > before ? p.level : 0;
}

// Record a fish. Mutates profile. Returns a summary for the reveal card.
export function applyCatch(p, c, now = Date.now()) {
  const s = SPECIES_BY_ID[c.speciesId];
  const st = p.stats;
  p.catchCount = (p.catchCount || 0) + 1;
  inc(st, 'catches');
  inc(st, `sp_${s.id}`);
  if (c.variant === 'gold') inc(st, 'golds');
  if (c.variant === 'diamond') inc(st, 'diamonds');
  if (c.phase === 'dawn') inc(st, 'dawnCatches');
  if (c.phase === 'night') inc(st, 'nightCatches');
  if (c.weather === 'rain' || c.weather === 'storm') inc(st, 'rainCatches');
  if (c.waitCatch) inc(st, 'waitCatches');
  if (s.id === 'moonfin' && c.fullMoon) st.fullMoonMoonfin = 1;
  const [min, max] = s.weight;
  const bigOne = c.weight >= min + (max - min) * 0.95;
  if (bigOne) inc(st, 'bigOnes');

  const entry = p.fishpedia[s.id] || { normal: 0, gold: 0, diamond: 0, best: 0, firstAt: now, zone: c.zone };
  const newSpecies = !p.fishpedia[s.id];
  const newSlot = entry[c.variant] === 0;
  entry[c.variant] += 1;
  const personalBest = c.weight > entry.best;
  if (personalBest) entry.best = c.weight;
  p.fishpedia[s.id] = entry;

  // v1.15: the valley's Fishpedia goals count the valley's fish; the sea's are counted on their own
  const everything = Object.keys(p.fishpedia);
  const all = everything.filter((id) => !SPECIES_BY_ID[id]?.ocean && !SPECIES_BY_ID[id]?.north); // (Frostmere's are counted on their own too)
  st.oceanSpecies = everything.filter((id) => SPECIES_BY_ID[id]?.ocean).length;
  st.northSpecies = everything.filter((id) => SPECIES_BY_ID[id]?.north).length;
  st.northLegends = ['glacierking', 'oldsleeper', 'aurorachar'].filter((id) => p.fishpedia[id]).length;
  st.speciesCaught = all.length;
  for (const t of ['common', 'uncommon', 'rare', 'epic']) st[`species_${t}`] = all.filter((id) => SPECIES_BY_ID[id]?.tier === t).length;
  st.diamondSpecies = all.filter((id) => p.fishpedia[id].diamond > 0).length;

  // Scores for boards
  const pts = catchPoints(s.id, c.variant);
  const wk = weekId(now);
  if (st.week !== wk) { st.week = wk; st.weekScore = 0; st.weekDiamonds = 0; st.weekHeaviest = 0; }
  st.weekScore = (st.weekScore || 0) + pts;
  st.allScore = (st.allScore || 0) + pts;
  if (c.variant === 'diamond') st.weekDiamonds = (st.weekDiamonds || 0) + 1;
  if (s.ocean) st.oceanHeaviest = Math.max(st.oceanHeaviest || 0, c.weight); // a 300 lb tuna would bury every lake record
  if (s.ocean && s.big) inc(st, 'owTrophy'); // v1.15 Open Waters achievements
  else {
    st.weekHeaviest = Math.max(st.weekHeaviest || 0, c.weight);
    st.heaviest = Math.max(st.heaviest || 0, c.weight);
  }

  // Lake records are decided by the save layer (shared across players); see save/*.js
  const record = false;

  // Daily first-catch bonus (resets at 00:00 UTC; the server uses the same rule)
  let daily = null;
  const today = Math.floor(now / 86400000);
  if (st.lastDaily !== today) {
    st.lastDaily = today;
    p.coins += 25; p.pearls += 1;
    daily = { coins: 25, pearls: 1 };
  }

  const xp = catchXp(s.id);
  const levelUp = addXp(p, xp);
  const value = catchValue(s.id, c.variant, c.weight);
  return { species: s, variant: c.variant, weight: c.weight, xp, levelUp, value, newSpecies, newSlot, personalBest, bigOne, record, daily, points: pts };
}

// Creel size grows with boat hold upgrades (the profile carries the bonus).
export function creelMax(p) { return CREEL_MAX + Math.max(0, Math.min(30, p?.creelBonus || 0)); }

export function keepCatch(p, c) {
  if (p.creel.length < creelMax(p)) { p.creel.push(c); return 'creel'; }
  if (p.storage.length < STORAGE_MAX) { p.storage.push(c); return 'storage'; }
  return null;
}

function findCatch(p, id) {
  for (const where of ['creel', 'storage']) {
    const i = p[where].findIndex((x) => x.id === id);
    if (i >= 0) return { where, i, c: p[where][i] };
  }
  return null;
}

function removeCatch(p, id) {
  const f = findCatch(p, id);
  if (!f) return null;
  p[f.where].splice(f.i, 1);
  return f.c;
}

// Hand a fish to someone (a local's request): it leaves your creel without coins or XP.
export function giveCatch(p, id) { return removeCatch(p, id); }

export function sellCatches(p, ids) {
  let coins = 0, sold = 0;
  for (const id of ids) {
    const c = removeCatch(p, id);
    if (!c) continue;
    coins += catchValue(c.speciesId, c.variant, c.weight);
    sold++;
  }
  p.coins += coins;
  inc(p.stats, 'sold', sold);
  return { coins, sold };
}

export function sellNow(p, c) {
  const coins = catchValue(c.speciesId, c.variant, c.weight);
  p.coins += coins;
  inc(p.stats, 'sold');
  return { coins };
}

export function releaseCatch(p, cOrId) {
  if (typeof cOrId === 'string') removeCatch(p, cOrId);
  inc(p.stats, 'releases');
  const levelUp = addXp(p, 5);
  return { xp: 5, levelUp };
}

export function canTrade(c) {
  return tradePearls(c.speciesId, c.variant) > 0;
}

export function tradeCatch(p, id) {
  const f = findCatch(p, id);
  if (!f || !canTrade(f.c)) return { ok: false, reason: 'This fish cannot be traded for Pearls.' };
  removeCatch(p, id);
  const pearls = tradePearls(f.c.speciesId, f.c.variant);
  p.pearls += pearls;
  inc(p.stats, 'traded');
  return { ok: true, pearls };
}

export function moveCatch(p, id, to) {
  const f = findCatch(p, id);
  if (!f || f.where === to) return false;
  if (to === 'creel' && p.creel.length >= creelMax(p)) return false;
  if (to === 'storage' && p.storage.length >= STORAGE_MAX) return false;
  p[f.where].splice(f.i, 1);
  p[to].push(f.c);
  return true;
}

export function applyJunk(p, junkId, r = Math.random) {
  const st = p.stats;
  inc(st, 'junk');
  const out = { junkId };
  if (junkId === 'boot') inc(st, 'boots');
  if (junkId === 'chest') {
    inc(st, 'chests');
    out.coins = 50 + Math.floor(r() * 101);
    p.coins += out.coins;
    if (r() < 0.25) { out.pearls = 1 + Math.floor(r() * 3); p.pearls += out.pearls; }
  }
  if (junkId === 'bottle') {
    const unfound = BOTTLE_MESSAGES.map((_, i) => i).filter((i) => !p.bottles.includes(i));
    const idx = unfound.length ? unfound[Math.floor(r() * unfound.length)] : Math.floor(r() * BOTTLE_MESSAGES.length);
    if (!p.bottles.includes(idx)) p.bottles.push(idx);
    st.bottleMessages = p.bottles.length;
    out.message = BOTTLE_MESSAGES[idx];
  }
  out.levelUp = addXp(p, 2);
  return out;
}

export function buyItem(p, itemId) {
  const item = ITEMS_BY_ID[itemId];
  if (!item || item.source !== 'shop' || !item.price) return { ok: false, reason: 'Not for sale.' };
  if (p.owned.includes(itemId)) return { ok: false, reason: 'You already own this.' };
  if (item.kind === 'boat' && p.level < BOAT_LEVEL) return { ok: false, reason: `Boats unlock at level ${BOAT_LEVEL}.` };
  if (item.level && p.level < item.level) return { ok: false, reason: `Unlocks at level ${item.level}.` };
  if (item.price.coins && p.coins < item.price.coins) return { ok: false, reason: 'Not enough coins.' };
  if (item.price.pearls && p.pearls < item.price.pearls) return { ok: false, reason: 'Not enough Pearls.' };
  p.coins -= item.price.coins || 0;
  p.pearls -= item.price.pearls || 0;
  p.owned.push(itemId);
  inc(p.stats, 'purchases');
  return { ok: true, item };
}

export function equip(p, slot, itemId) {
  if (!p.owned.includes(itemId)) return false;
  const item = ITEMS_BY_ID[itemId];
  if (!item || item.kind !== slot) return false;
  p.equipped[slot] = itemId;
  return true;
}

export function bumpStat(p, key, n = 1) {
  const allowed = { perfectCasts: 1, cleanReels: 1, boatLaunches: 1, raftUps: 1, goodCompany: 1, reactions: 1, avatarSaves: 1, weeklyWins: 1, records: 1 };
  if (!allowed[key]) return;
  if (key === 'goodCompany' || key === 'avatarSaves') { p.stats[key] = Math.max(p.stats[key] || 0, 1); return; }
  inc(p.stats, key, Math.min(n, allowed[key]));
}

// v1.15 Open Waters: counters the sea keeps itself (a grand slam, billfish released, reef fish speared, beach games
// won, whale breaches). They only ever go up, and only these keys can be set.
export const OCEAN_STATS = { owGrandSlam: 5, owBillRelease: 1000, owReefSpeared: 8, owPartyWins: 5, owBreach: 1000,
  // Frostmere's counters (src/north/progress.js), set the same way
  fmHoles: 100000, fmFlags: 100000, fmTriple: 1000, fmThrough: 1000, fmSaunas: 100000, fmPlunge: 1000, fmGlide: 1000, fmDerby: 1000, fmTopDog: 1000, fmBearCubs: 1, fmAuroras: 10000, fmFlight3: 1000, fmGuide: 13, fmPages: 5,
  // v1.17 Skye's Air Races (src/air/airraces.js)
  arRaces: 100000, arWins: 100000, arGolds: 36, arGoldCircuits: 12, arPlat: 1000, arCuts: 12, arTricks: 1000000, arClean: 100000, arHurricane: 100000, arParty: 100000, arPerfect: 100000 };
export function setOceanStats(p, map = {}) {
  for (const [k, v] of Object.entries(map)) {
    if (!(k in OCEAN_STATS) || !Number.isFinite(+v)) continue;
    p.stats[k] = Math.max(p.stats[k] || 0, Math.min(OCEAN_STATS[k], Math.floor(+v)));
  }
}

export function claimableAchievements(p) {
  return ACHIEVEMENTS.filter((a) => !p.achievements[a.id] && (p.stats[a.stat] || 0) >= a.threshold);
}

export function claimAchievement(p, achId, now = Date.now()) {
  const a = ACH_BY_ID[achId];
  if (!a || p.achievements[achId]) return null;
  if ((p.stats[a.stat] || 0) < a.threshold) return null;
  p.achievements[achId] = now;
  const r = a.reward || {};
  if (r.coins) p.coins += r.coins;
  if (r.pearls) p.pearls += r.pearls;
  if (r.item && !p.owned.includes(r.item)) p.owned.push(r.item);
  if (r.title) {
    if (!p.titles.includes(r.title)) p.titles.push(r.title);
    if (!p.title) p.title = r.title;
  }
  return a;
}

export function achievementProgress(p, a) {
  return Math.min(1, (p.stats[a.stat] || 0) / a.threshold);
}

export function boardEntry(p) {
  const st = p.stats;
  const wk = weekId();
  const fresh = st.week === wk;
  return {
    name: p.name, level: p.level, title: p.title,
    top: { week: fresh ? st.weekScore || 0 : 0, all: st.allScore || 0 },
    diamonds: { week: fresh ? st.weekDiamonds || 0 : 0, all: st.diamonds || 0 },
    heaviest: { week: fresh ? st.weekHeaviest || 0 : 0, all: st.heaviest || 0 },
    pedia: { week: countSlots(p), all: countSlots(p) },
  };
}

export function countSlots(p) {
  let n = 0;
  for (const e of Object.values(p.fishpedia)) n += (e.normal > 0) + (e.gold > 0) + (e.diamond > 0);
  return n;
}

// Rewards from quests, derbies, festivals and away gear (guest saves apply them here; signed-in
// saves call the server's claim_reward, which keeps its own reward table).
export function grantReward(p, r = {}) {
  const coins = Math.max(0, Math.min(5000, Math.round(r.coins || 0)));
  const pearls = Math.max(0, Math.min(50, Math.round(r.pearls || 0)));
  const xp = Math.max(0, Math.min(5000, Math.round(r.xp || 0)));
  p.coins += coins; p.pearls += pearls;
  if (r.title && !p.titles.includes(r.title)) p.titles.push(String(r.title).slice(0, 24));
  if (r.item && ITEMS_BY_ID[r.item] && !p.owned.includes(r.item)) p.owned.push(r.item);
  const levelUp = xp ? addXp(p, xp) : 0;
  return { coins, pearls, xp, levelUp, title: r.title || null, item: r.item || null };
}

// Spend coins/pearls on consumables and upgrades. Returns false when you can't afford it.
export function spend(p, price = {}) {
  const c = Math.max(0, price.coins || 0), pe = Math.max(0, price.pearls || 0);
  if (p.coins < c || p.pearls < pe) return false;
  p.coins -= c; p.pearls -= pe;
  return true;
}
