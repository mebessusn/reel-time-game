// Open Waters v1.15.9: the pure parts of voyage.js (the lesson's steps, the trip report's numbers), for the tests.

export const LESSON = [
  { id: 'chart', say: 'First, the chart: press M (or tap Chart) to see where we can go. Pick a spot and I\'ll run us there, or stay put.', hint: 'Open the chart (M)' },
  { id: 'cast', say: 'Now cast off the stern, out past the wake. Big fish come up for a lure out here.', hint: 'Cast from the cockpit' },
  { id: 'chair', say: 'Fish on! You\'re in the fighting chair. Reel when it tires, and ease off (let go) when it runs, or it\'ll part the line.', hint: 'Fight it from the chair' },
  { id: 'gaff', say: 'Bring it alongside and we gaff it aboard. Watch for the green window.', hint: 'Land it: bring it alongside' },
  { id: 'dive', say: 'Lovely fish! Now cool off: walk to the stern and Dive in. Kai sells masks, tanks and spearguns on Palm Key.', hint: 'Dive in off the stern' },
  { id: 'aboard', say: 'Swim back to the boat and climb aboard when you\'re done.', hint: 'Climb back aboard' },
];
export const LESSON_IDX = Object.fromEntries(LESSON.map((s, i) => [s.id, i]));
export const STARTER = 'mahi';

/** Pure: the report's numbers from a trip log. */
export function tripSummary(log) {
  const fish = log?.fish || [];
  const worth = fish.reduce((s, f) => s + (f.val || 0), 0);
  const prizes = (log?.games || []).reduce((s, x) => s + (x.coins || 0), 0);
  const trophies = fish.filter((f) => f.big).length;
  const heaviest = fish.reduce((b, f) => (!b || f.w > b.w ? f : b), null);
  const fee = log?.fee || 0;
  return { n: fish.length, worth, prizes, trophies, heaviest, fee, net: worth + prizes - fee, best: log?.best || null, speared: log?.speared || 0, games: log?.games || [], whales: log?.whales || 0, dolphins: log?.dolphins || 0, mins: Math.max(1, Math.round(((log?.end ?? Date.now()) - (log?.start ?? Date.now())) / 60000)) };
}


// ---------------------------------------------------------------- v1.15.11: the Billfish Derby
export const WEEK_MS = 7 * 86400000;
const MONDAY0 = 4 * 86400000; // 1970-01-05, a Monday (UTC)
export const BILLFISH_IDS = ['sailfish', 'marlin', 'swordfish'];
/** The derby week (Monday to Sunday, UTC) a moment falls in. */
export function weekIndex(now = Date.now()) { return Math.floor((now - MONDAY0) / WEEK_MS); }
export function weekId(now = Date.now()) { return `wk${weekIndex(now)}`; }
export function weekEnds(now = Date.now()) { return MONDAY0 + (weekIndex(now) + 1) * WEEK_MS; }
/** Pure: rank untrusted entries for one week. Each: { id, wk, sp, w, n }. One per angler (their best), heaviest first. */
export function billfishBoard(entries, wk, maxOf = () => 2000) {
  const best = new Map();
  for (const e of entries || []) {
    if (!e || e.wk !== wk || !BILLFISH_IDS.includes(e.sp)) continue;
    const w = Number(e.w);
    if (!Number.isFinite(w) || w <= 0 || w > maxOf(e.sp)) continue;
    const who = String(e.u || e.id || '').slice(0, 60);
    if (!who) continue;
    if (!best.has(who) || best.get(who).w < w) best.set(who, { u: who, sp: e.sp, w: Math.round(w * 10) / 10, n: String(e.n || 'Angler').slice(0, 20) });
  }
  return [...best.values()].sort((a, b) => b.w - a.w);
}
/** The week's prize for a place in a field. */
export function derbyPrize(place, field) {
  if (place === 1) return { coins: field > 1 ? 1500 : 600, pearls: field > 1 ? 3 : 1, xp: 400, cup: true };
  if (place <= 3) return { coins: 600, xp: 200 };
  return { coins: 150, xp: 80 };
}

// ---------------------------------------------------------------- v1.15.11: tides
/** The tide from the day's fraction (two tides a day, high at midnight and noon, low at dawn and dusk): -1 low .. 1 high. */
export function tideLevel(f) { return Math.cos(f * Math.PI * 4); }
export function tideName(level) { return level < -0.5 ? 'low' : level > 0.5 ? 'high' : level < 0 ? 'falling' : 'rising'; }
/** Which low tide this is (for once-per-low-tide foraging): `${day}-${half}`. */
export function lowTideId(day, f) { return `${day}-${f < 0.5 ? 0 : 1}`; }
export const SHELLS = [
  { id: 'cowrie', name: 'Cowrie', w: 22 }, { id: 'scallop', name: 'Scallop', w: 22 }, { id: 'cone', name: 'Cone shell', w: 18 },
  { id: 'sanddollar', name: 'Sand dollar', w: 16 }, { id: 'conch', name: 'Queen conch', w: 10 }, { id: 'nautilus', name: 'Nautilus', w: 3 },
];
export const SEAGLASS = [
  { id: 'white', name: 'white', w: 30 }, { id: 'green', name: 'green', w: 28 }, { id: 'brown', name: 'brown', w: 24 }, { id: 'blue', name: 'blue', w: 12 }, { id: 'red', name: 'red', w: 3 },
];
const pickW = (list, r) => { let t = list.reduce((s, x) => s + x.w, 0) * r; for (const x of list) { t -= x.w; if (t <= 0) return x; } return list[list.length - 1]; };
/** Pure: what a tide pool gives: a pearl (rare), a piece of sea glass, or a shell. r1, r2 in [0, 1). */
export function forageRoll(r1, r2) {
  if (r1 < 0.06) return { kind: 'pearl' };
  if (r1 < 0.4) return { kind: 'glass', ...pickW(SEAGLASS, r2) };
  return { kind: 'shell', ...pickW(SHELLS, r2) };
}

// ---------------------------------------------------------------- v1.15.12: Marlowe's trust
export const TRUST = [
  { id: 'deckhand', name: 'Deckhand', at: 0 },
  { id: 'mate', name: 'Mate', at: 3 },
  { id: 'firstmate', name: 'First Mate', at: 6 },
  { id: 'oldsalt', name: 'Old Salt', at: 10 },
];
export const ABYSS_RANK = 2; // First Mate: Marlowe will take you out to the Abyss
/** Pure: the rank for some trust points: { i, ...rank, next, toNext }. */
export function trustRank(points) {
  const p = Math.max(0, Number(points) || 0);
  let i = 0;
  for (let k = 0; k < TRUST.length; k++) if (p >= TRUST[k].at) i = k;
  const next = TRUST[i + 1] || null;
  return { i, ...TRUST[i], next, toNext: next ? next.at - p : 0 };
}
/** Points a finished trip earns: one for going out, one more for landing a trophy fish. */
export function tripTrust(summary) { return summary && (summary.n > 0 || summary.games?.length || summary.speared) ? 1 + (summary.trophies > 0 ? 1 : 0) : 0; }

// ---------------------------------------------------------------- v1.15.12: sea events
export const EVENT_SLOT = 60000;
const h2 = (a, b) => { let h = (a * 374761393 + b * 668265263) | 0; h = (h ^ (h >>> 13)) * 1274126177; return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
/** Pure: the sea event (if any) starting in a minute slot, for a charter seed and the weather. Everyone aboard rolls
 *  the same one: { kind, slot, start, end, a (bearing), d (distance from the boat) } or null. */
export function seaEventAt(seed, slot, weather) {
  const r = h2(seed, slot), r2 = h2(seed + 17, slot), r3 = h2(seed + 31, slot);
  const start = slot * EVENT_SLOT, a = r2 * Math.PI * 2;
  const odds = { baitball: { clear: 0.09, overcast: 0.09, rain: 0.06, storm: 0.03 }, spout: { clear: 0, overcast: 0.02, rain: 0.07, storm: 0.12 }, fog: { clear: 0.03, overcast: 0.06, rain: 0.04, storm: 0 } };
  let acc = 0;
  for (const kind of ['baitball', 'spout', 'fog']) {
    acc += odds[kind][weather] ?? 0;
    if (r < acc) {
      const len = kind === 'baitball' ? 150000 : kind === 'spout' ? 120000 : 180000;
      const d = kind === 'baitball' ? 22 + r3 * 14 : kind === 'spout' ? 150 + r3 * 70 : 0;
      return { kind, slot, start, end: start + len, a, d };
    }
  }
  return null;
}

// ---------------------------------------------------------------- v1.15.13: your own boat
export const OWN_BOAT = { price: 40000, trips: 3, rank: 1, speed: 16, liveWell: 0.15, outriggers: 0.87 };
export const UPGRADES = [
  { id: 'outriggers', name: 'Outriggers', price: 8000, what: 'Long poles that spread your lines wide: bites come about 15% quicker at anchor.' },
  { id: 'livewell', name: 'Live well', price: 6000, what: 'Keeps your catch fresh: at the end of each trip you get 15% of your fish\'s worth on top, paid as you dock.' },
  { id: 'engine', name: 'Twin engines', price: 12000, what: 'Faster between spots: she cruises at 31 knots instead of 21.' },
];
/** Pure: can this angler buy a boat? { ok, why } */
export function canBuyBoat({ trips = 0, rank = 0, coins = 0, owned = false }) {
  if (owned) return { ok: false, why: 'You already own a boat.' };
  if (trips < OWN_BOAT.trips) return { ok: false, why: `Charter with Marlowe ${OWN_BOAT.trips - trips} more time${OWN_BOAT.trips - trips > 1 ? 's' : ''} first.` };
  if (rank < OWN_BOAT.rank) return { ok: false, why: 'Marlowe sells to his Mates and up.' };
  if (coins < OWN_BOAT.price) return { ok: false, why: `A boat is ${OWN_BOAT.price.toLocaleString()} coins.` };
  return { ok: true, why: '' };
}
/** Pure: a boat's name, made safe to paint on a transom (letters, numbers, spaces and a little punctuation). */
/** A boat's name: trimmed to 18 characters. It's only ever painted on a canvas or set as text, never parsed as HTML.
 *  (v1.15.13: an earlier character filter here made the artifact host refuse the build as a "review page"; whatever
 *  version of it was in the page, regex or not, the publish failed. See the build notes.) */
export function boatName(s) { return String(s || '').trim().slice(0, 18); }
/** Pure: the look a boat sends to the crew (sanitized on the way in, too). */
export function boatLook(b) {
  if (!b || !b.owned) return null;
  const i = (v, n) => (Number.isInteger(v) && v >= 0 && v < n ? v : 0);
  return { hull: i(b.hull, 8), stripe: i(b.stripe, 8), trim: i(b.trim, 6), name: boatName(b.name) || 'Sea Biscuit', up: { outriggers: !!b.up?.outriggers, livewell: !!b.up?.livewell, engine: !!b.up?.engine } };
}
