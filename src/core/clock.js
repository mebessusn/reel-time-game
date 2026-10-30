// Shared wall-clock world time: every player sees the same sky (design doc section 4).
import { mulberry32 } from './rng.js';

export const DAY_MS = 24 * 60 * 1000; // one in-game day = 24 real minutes

// Debug overrides from the URL: ?t=0.5 (fixed phase 0..1), ?weather=rain, ?moon=4
const params = typeof location !== 'undefined' ? new URLSearchParams(location.search) : new URLSearchParams();
let fixedPhase = params.has('t') ? parseFloat(params.get('t')) : null;
let forcedWeather = params.get('weather');
let forcedMoon = params.has('moon') ? parseInt(params.get('moon'), 10) : null;

export function setDebugTime(phase) { fixedPhase = phase; }
// v1.15.10 Open Waters: a charter keeps its own clock (a night charter, or sleeping till dawn on an island). The
// crew share the shift in the charter's state, so everyone aboard sees the same sky. 0 everywhere else.
let shiftMs = 0;
export function setTimeShift(ms) { shiftMs = Number.isFinite(ms) ? ms : 0; }
export function timeShift() { return shiftMs; }
/** Pure: the shift (ms, added to the last one) that brings the day fraction from `f` forward to `target`. */
export function shiftTo(f, target) { return ((((target - f) % 1) + 1) % 1) * DAY_MS; }
export function setDebugWeather(w) { forcedWeather = w; }

export function dayFraction(now = Date.now()) {
  if (fixedPhase != null && !Number.isNaN(fixedPhase)) return ((((fixedPhase + shiftMs / DAY_MS) % 1) + 1) % 1);
  return (((now + shiftMs) % DAY_MS) + DAY_MS) % DAY_MS / DAY_MS;
}

export function dayIndex(now = Date.now()) {
  return Math.floor(now / DAY_MS);
}

// 0 = midnight, 0.25 = sunrise, 0.5 = noon, 0.75 = sunset
export function phaseName(f = dayFraction()) {
  if (f >= 0.2 && f < 0.3) return 'dawn';
  if (f >= 0.3 && f < 0.7) return 'day';
  if (f >= 0.7 && f < 0.8) return 'dusk';
  return 'night';
}

export const WEATHER_TYPES = ['clear', 'overcast', 'rain', 'storm'];
export function weatherFor(day = dayIndex()) {
  if (forcedWeather && WEATHER_TYPES.includes(forcedWeather)) return forcedWeather;
  const r = mulberry32(day * 7919 + 13)();
  if (r < 0.55) return 'clear';
  if (r < 0.75) return 'overcast';
  if (r < 0.95) return 'rain';
  return 'storm';
}

export function moonPhase(day = dayIndex()) {
  if (forcedMoon != null) return forcedMoon;
  return ((day % 8) + 8) % 8; // 4 = full moon
}

// Blood Moon: about one night in seven the full red moon rises (never in a storm). ?weather=bloodmoon forces it.
export function bloodMoonDay(day = dayIndex()) {
  if (forcedWeather === 'bloodmoon') return true;
  if (forcedWeather) return false;
  return mulberry32(day * 104729 + 71)() < 0.14 && weatherFor(day) !== 'storm';
}

export function worldTime(now = Date.now()) {
  const f = dayFraction(now);
  const day = dayIndex(now);
  const phase = phaseName(f);
  const bloodMoon = phase === 'night' && bloodMoonDay(day);
  const moon = bloodMoon ? 4 : moonPhase(day);
  return { f, day, phase, weather: forcedWeather === 'bloodmoon' ? 'clear' : weatherFor(day), moon, fullMoon: moon === 4, bloodMoon };
}

export const PHASE_LABEL = { dawn: 'Dawn', day: 'Day', dusk: 'Dusk', night: 'Night' };
export const WEATHER_LABEL = { clear: 'Clear', overcast: 'Overcast', rain: 'Rain', storm: 'Storm', bloodmoon: 'Blood Moon' };
// How weather changes fishing: fish fight harder in rough weather (added to Tug & Turn difficulty),
// and each condition brings its own fish (species with a matching `weather`, or `bloodMoon`).
export const WEATHER_FISHING = {
  clear: { diff: 0, note: '' },
  overcast: { diff: 0.15, note: 'Overcast: grayling come up, and fish fight a touch harder.' },
  rain: { diff: 0.45, note: 'Rain: fish fight harder, but rain-loving fish are biting.' },
  storm: { diff: 0.9, note: 'Storm: the hardest fights of all, and storm fish are out.' },
  bloodmoon: { diff: 0.7, note: 'Blood Moon: piranhas and other hunters are biting. Fast bites, fierce fights.' },
};

// Week id for weekly boards (Monday 00:00 America/New_York approximated as UTC-5).
export function weekId(now = Date.now()) {
  const d = new Date(now - 5 * 3600 * 1000);
  const day = (d.getUTCDay() + 6) % 7; // Monday = 0
  const monday = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - day);
  return new Date(monday).toISOString().slice(0, 10);
}
