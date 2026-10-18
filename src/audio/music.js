// Reel Time music (v1.9): a cozy soundtrack composed and played live in the browser, with no audio files.
//
// Instruments are rendered once into small sampled buffers (additive piano with real string stretch and
// hammer, kalimba, felt marimba, music
// box, vibraphone, celesta) and pitched from the nearest sample, so they sound like instruments, not beeps.
// Tracks are written per place and time of day: a key, a mode, a chord progression in scale degrees,
// an accompaniment style and a lead. Each track is composed when it starts: an 8-bar melody built from a
// 2-bar motif (stated, answered, contrasted, resolved), an A A' B A form, voice-led chords, a bass line
// with approach notes, and brushed lo-fi percussion, all humanized. Tracks crossfade when you move to a
// new place or the time of day changes, with quiet gaps between songs so the ambience can breathe.
const NOTE = (n) => 440 * Math.pow(2, (n - 69) / 12);
const SR = 32000; // sample buffers are rendered at a modest rate: warm, small, plenty for cozy music

function mulberry(seed) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

// ---------------------------------------------------------------- instruments
// Each renders one note (frequency f) into a Float32Array. `len` in seconds. Normalized afterwards.
const TAU = Math.PI * 2;
const INSTR = {
  piano: { len: 3.6, bucket: 5, vol: 0.5, pan: 0, release: 0.35, render: (f, n) => renderPiano(f, n, 1) },
  felt: { len: 3.2, bucket: 5, vol: 0.5, pan: 0, release: 0.3, render: (f, n) => renderPiano(f, n, 0.45) },
  kalimba: { len: 2.0, bucket: 5, vol: 0.45, pan: 0.15, release: 0.2, render: renderKalimba },
  marimba: { len: 1.4, bucket: 5, vol: 0.5, pan: 0.1, release: 0.15, render: renderMarimba },
  musicbox: { len: 2.4, bucket: 6, vol: 0.32, pan: 0.2, release: 0.25, render: renderMusicBox },
  vibes: { len: 3.4, bucket: 6, vol: 0.38, pan: -0.15, release: 0.5, render: renderVibes },
  flute: { len: 3.4, bucket: 4, vol: 0.3, pan: 0.05, release: 0.28, render: renderFlute },
  glock: { len: 2.4, bucket: 6, vol: 0.22, pan: 0.25, release: 0.3, render: renderGlock },
  celesta: { len: 2.2, bucket: 6, vol: 0.32, pan: 0.2, release: 0.25, render: renderCelesta },
};

function renderPiano(f, n, bright) {
  const out = new Float32Array(n), B = 0.00035 + Math.max(0, (f - 500) / 4000) * 0.0008; // string stiffness
  const parts = Math.max(3, Math.min(12, Math.floor(5000 / f)));
  for (let k = 1; k <= parts; k++) {
    const fk = k * f * Math.sqrt(1 + B * k * k);
    if (fk > SR / 2.2) break;
    const amp = Math.pow(k, -1.35) * (k === 1 ? 1 : bright * (k < 4 ? 1 : 0.7));
    const tau1 = (2.6 / (1 + (k - 1) * 0.5)) * Math.min(1.6, 260 / f + 0.6), tau2 = tau1 * 0.22;
    const det = 1 + 0.0007 * (k % 2 ? 1 : -1); // a second string, a hair out: the gentle beating of a real piano
    const p0 = Math.random() * TAU;
    for (let i = 0; i < n; i++) {
      const t = i / SR, env = 0.6 * Math.exp(-t / tau1) + 0.4 * Math.exp(-t / tau2);
      out[i] += amp * env * (Math.sin(TAU * fk * t + p0) + 0.6 * Math.sin(TAU * fk * det * t + p0 * 1.3));
    }
  }
  // the felt hammer: a soft thump of filtered noise
  let lp = 0;
  const hn = Math.floor(SR * 0.025);
  for (let i = 0; i < hn; i++) { lp += ((Math.random() * 2 - 1) - lp) * (0.08 + bright * 0.12); out[i] += lp * 0.35 * bright * (1 - i / hn); }
  // a softer attack for the felt piano
  const att = Math.floor(SR * (bright < 0.6 ? 0.012 : 0.003));
  for (let i = 0; i < att; i++) out[i] *= i / att;
  return out;
}
// a soft wooden fantasy flute: a gentle breathy attack, warm low harmonics, a slow singer's vibrato
function renderFlute(f, n) {
  const out = new Float32Array(n);
  let ph = 0, lp = 0;
  for (let i = 0; i < n; i++) {
    const t = i / SR, att = Math.min(1, t / 0.07), vib = 1 + 0.0045 * Math.min(1, Math.max(0, (t - 0.25) / 0.4)) * Math.sin(TAU * 5.2 * t);
    ph += TAU * f * vib / SR;
    const env = att * (0.88 + 0.12 * Math.exp(-t / 0.3)) * Math.exp(-t / 6);
    lp += ((Math.random() * 2 - 1) - lp) * 0.12;
    out[i] = env * (Math.sin(ph) + 0.22 * Math.sin(2 * ph) + 0.07 * Math.sin(3 * ph)) + lp * 0.08 * (0.35 + 0.65 * Math.exp(-t / 0.08)) * att;
  }
  return out;
}
function renderGlock(f, n) {
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    out[i] = Math.exp(-t / 1.1) * Math.sin(TAU * f * t) + 0.25 * Math.exp(-t / 0.35) * Math.sin(TAU * f * 2.76 * t) + 0.12 * Math.exp(-t / 0.08) * Math.sin(TAU * f * 5.4 * t);
  }
  for (let i = 0; i < 10; i++) out[i] *= i / 10;
  return out;
}
function renderKalimba(f, n) {
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    out[i] = Math.exp(-t / 0.75) * Math.sin(TAU * f * t) + 0.35 * Math.exp(-t / 0.06) * Math.sin(TAU * f * 5.43 * t) + 0.12 * Math.exp(-t / 0.3) * Math.sin(TAU * f * 2.01 * t);
  }
  for (let i = 0; i < 40; i++) out[i] *= i / 40;
  return out;
}
function renderMarimba(f, n) {
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    out[i] = Math.exp(-t / (0.32 + 120 / f * 0.4)) * Math.sin(TAU * f * t) + 0.3 * Math.exp(-t / 0.05) * Math.sin(TAU * f * 3.93 * t) + 0.06 * Math.exp(-t / 0.015) * Math.sin(TAU * f * 9.2 * t);
  }
  for (let i = 0; i < 60; i++) out[i] *= i / 60; // a soft mallet
  return out;
}
function renderMusicBox(f, n) {
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    out[i] = Math.exp(-t / 0.9) * Math.sin(TAU * f * t) + 0.3 * Math.exp(-t / 0.4) * Math.sin(TAU * f * 2 * t) + 0.18 * Math.exp(-t / 0.12) * Math.sin(TAU * f * 5.2 * t) + 0.08 * Math.exp(-t / 0.05) * Math.sin(TAU * f * 8.9 * t);
  }
  for (let i = 0; i < 16; i++) out[i] *= i / 16;
  return out;
}
function renderVibes(f, n) {
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const t = i / SR, trem = 0.82 + 0.18 * Math.sin(TAU * 4.6 * t);
    out[i] = trem * (Math.exp(-t / 1.8) * Math.sin(TAU * f * t) + 0.22 * Math.exp(-t / 0.4) * Math.sin(TAU * f * 3.98 * t) + 0.06 * Math.exp(-t / 0.08) * Math.sin(TAU * f * 9.8 * t));
  }
  for (let i = 0; i < 50; i++) out[i] *= i / 50;
  return out;
}
function renderCelesta(f, n) {
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    out[i] = Math.exp(-t / 0.85) * Math.sin(TAU * f * t) + 0.4 * Math.exp(-t / 0.25) * Math.sin(TAU * f * 4 * t) + 0.12 * Math.exp(-t / 0.06) * Math.sin(TAU * f * 10.1 * t);
  }
  for (let i = 0; i < 24; i++) out[i] *= i / 24;
  return out;
}
// ---------------------------------------------------------------- the tracks
const MODES = {
  major: [0, 2, 4, 5, 7, 9, 11], lydian: [0, 2, 4, 6, 7, 9, 11], mixo: [0, 2, 4, 5, 7, 9, 10],
  dorian: [0, 2, 3, 5, 7, 9, 10], minor: [0, 2, 3, 5, 7, 8, 10],
};
// prog: scale degrees (0 = I) per bar, with optional 7ths; B is the bridge progression.
// where: region groups this can play in; when: moods ('day', 'dawn', 'dusk', 'night', 'rain').
export const TRACKS = [
  // Cozy Cove (v1.9.2): light only: kalimba, marimba and celesta tunes over soft felt piano, no bass and no low chords
  { name: 'Cove Morning', where: ['cove', 'pond'], when: ['day', 'dawn'], key: 67, mode: 'major', bpm: 86, meter: 4, prog: [0, 4, 5, 3], B: [3, 0, 4, 4], lead: 'kalimba', leadB: 'flute', comp: 'felt', style: 'arp', bass: false, drums: 'shaker', swing: 0.12 },
  { name: 'Little Dock Song', where: ['cove', 'river'], when: ['day'], key: 65, mode: 'major', bpm: 80, meter: 4, prog: [0, 3, 0, 4], B: [5, 3, 1, 4], lead: 'marimba', comp: 'felt', style: 'arp', bass: false, drums: 'shaker', swing: 0.14 },
  { name: 'Lazy Bobber', where: ['cove', 'river', 'pond'], when: ['day', 'dusk'], key: 64, mode: 'major', bpm: 74, meter: 3, prog: [0, 3, 4, 0], B: [5, 3, 4, 4], lead: 'celesta', leadB: 'flute', comp: 'felt', style: 'waltz', bass: false, drums: null, swing: 0 },
  { name: 'Mist on the Water', where: ['any'], when: ['dawn'], key: 67, mode: 'major', bpm: 68, meter: 4, prog: [0, 3, 5, 4], B: [3, 0, 1, 4], lead: 'flute', comp: 'felt', style: 'arp', bass: false, drums: null, swing: 0 },
  { name: 'Lantern Glow', where: ['any'], when: ['dusk'], key: 57, mode: 'dorian', bpm: 74, meter: 4, prog: [0, 3, 6, 4], B: [2, 3, 4, 0], lead: 'flute', comp: 'felt', style: 'strum', bass: true, drums: 'soft', swing: 0.14 },
  { name: 'Fireflies', where: ['any'], when: ['night'], key: 62, mode: 'major', bpm: 66, meter: 4, prog: [0, 5, 3, 4], B: [1, 4, 2, 5], lead: 'piano', leadB: 'flute', comp: 'felt', style: 'arp', bass: true, drums: null, swing: 0.06 },
  { name: 'Moonfin Waltz', where: ['any'], when: ['night'], key: 57, mode: 'minor', bpm: 92, meter: 3, prog: [0, 5, 2, 6], B: [3, 0, 4, 4], lead: 'musicbox', comp: 'felt', style: 'waltz', bass: true, drums: null, swing: 0 },
  { name: 'Felt Rain', where: ['any'], when: ['rain'], key: 64, mode: 'dorian', bpm: 64, meter: 4, prog: [0, 3, 0, 6], B: [2, 3, 4, 3], lead: 'flute', comp: 'felt', style: 'sparse', bass: true, drums: 'soft', swing: 0.08 },
  { name: 'Window Seat', where: ['any'], when: ['rain'], key: 60, mode: 'major', bpm: 70, meter: 4, prog: [3, 4, 2, 5], B: [3, 4, 0, 0], lead: 'piano', comp: 'felt', style: 'arp', bass: true, drums: 'brush', swing: 0.12 },
  { name: 'Frostpine Hymn', where: ['frost'], when: ['day', 'dawn', 'dusk'], key: 62, mode: 'major', bpm: 70, meter: 4, prog: [0, 4, 5, 3], B: [5, 3, 0, 4], lead: 'celesta', comp: 'felt', style: 'sparse', bass: true, drums: null, swing: 0 },
  { name: 'Snow on the Line', where: ['frost'], when: ['night', 'rain'], key: 64, mode: 'minor', bpm: 62, meter: 4, prog: [0, 5, 2, 6], B: [3, 4, 0, 0], lead: 'musicbox', comp: 'piano', style: 'arp', bass: false, drums: null, swing: 0 },
  { name: 'Lily Pad Shuffle', where: ['marsh'], when: ['day', 'dawn'], key: 67, mode: 'mixo', bpm: 96, meter: 4, prog: [0, 6, 3, 0], B: [3, 3, 0, 4], lead: 'marimba', comp: 'felt', style: 'strum', bass: true, drums: 'brush', swing: 0.2 },
  { name: 'Frog Chorus', where: ['marsh'], when: ['dusk', 'night'], key: 62, mode: 'dorian', bpm: 80, meter: 4, prog: [0, 3, 0, 4], B: [2, 3, 4, 3], lead: 'vibes', comp: 'felt', style: 'arp', bass: true, drums: 'soft', swing: 0.18 },
  { name: 'Quarry Echoes', where: ['quarry'], when: ['day', 'dawn', 'dusk'], key: 64, mode: 'dorian', bpm: 76, meter: 4, prog: [0, 3, 6, 3], B: [5, 6, 3, 4], lead: 'marimba', comp: 'felt', style: 'arp', bass: true, drums: 'soft', swing: 0.1 },
  { name: 'Lodge Fire Waltz', where: ['lodge'], when: ['day', 'dawn', 'dusk', 'night'], key: 65, mode: 'major', bpm: 108, meter: 3, prog: [0, 4, 4, 0], B: [3, 0, 4, 0], lead: 'piano', comp: 'piano', style: 'waltz', bass: true, drums: null, swing: 0 },
  { name: 'Spokes in the Pines', where: ['lodge', 'any'], when: ['day'], key: 62, mode: 'major', bpm: 100, meter: 4, prog: [0, 3, 0, 4], B: [5, 3, 1, 4], lead: 'kalimba', comp: 'felt', style: 'strum', bass: true, drums: 'brush', swing: 0.14 },
  { name: 'Echo Cavern', where: ['cave'], when: ['day', 'dawn', 'dusk', 'night', 'rain'], key: 57, mode: 'dorian', bpm: 58, meter: 4, prog: [0, 6, 3, 0], B: [5, 6, 0, 0], lead: 'vibes', comp: 'celesta', style: 'sparse', bass: false, drums: null, swing: 0, verb: 0.75 },
  { name: 'Glowworm Lullaby', where: ['cave'], when: ['day', 'dawn', 'dusk', 'night', 'rain'], key: 64, mode: 'minor', bpm: 62, meter: 3, prog: [0, 5, 3, 4], B: [5, 3, 6, 4], lead: 'musicbox', comp: 'vibes', style: 'waltz', bass: false, drums: null, swing: 0, verb: 0.7 },
];
const REGION_GROUP = {
  'Echo Cavern': 'cave', 'Frostpine Lake': 'frost', 'Frostrun Creek': 'frost', Lilymarsh: 'marsh', 'Bog Hut': 'marsh',
  'Old Quarry': 'quarry', 'Quarry Shed': 'quarry', 'Quarry Cut': 'quarry', 'Pinewood Lodge': 'lodge',
  'Fern Pond': 'pond', 'Fern Camp': 'pond', 'Fern Brook': 'pond', 'Willow River': 'river', 'Cozy Cove': 'cove',
};

// ---------------------------------------------------------------- composing
const RHYTHMS4 = [ // a bar in eighths: 1 = note starts, 0 = held or rest (a following -1 means rest)
  [2, 0, 1, 1, 2, 0, 0, 0], [1, 1, 2, 0, 1, 1, 2, 0], [2, 0, 0, 1, 1, 0, 2, 0], [1, 1, 1, 1, 2, 0, 0, 0],
  [2, 0, 1, 0, 1, 1, 1, 0], [0, 1, 1, 1, 2, 0, 1, 0], [3, 0, 0, 0, 1, 0, 1, 0], [1, 0, 1, 1, 0, 1, 2, 0],
];
const RHYTHMS3 = [[2, 0, 1, 1, 1, 0], [3, 0, 0, 0, 1, 0], [1, 1, 2, 0, 1, 0], [2, 0, 0, 1, 1, 1]];

function compose(tr, seed) {
  const r = mulberry(seed);
  const scale = MODES[tr.mode], beats = tr.meter, eighths = beats * 2;
  const deg = (d) => { const o = Math.floor(d / 7); const i = ((d % 7) + 7) % 7; return tr.key + scale[i] + o * 12; };
  const chordDeg = (root) => [root, root + 2, root + 4, root + 7 + 1]; // root, 3rd, 5th and the 9th: a dreamy, storybook colour
  const form = beats === 3 ? ['A', 'A2', 'B', 'A', 'B', 'A2'] : ['A', 'A2', 'B', 'A'];
  const ev = []; // { t: beats, inst, midi, vel, dur (beats), kind }
  const RH = beats === 3 ? RHYTHMS3 : RHYTHMS4;
  // two motifs: rhythm + contour (scale-degree steps)
  const motif = () => ({ rh: [RH[Math.floor(r() * RH.length)], RH[Math.floor(r() * RH.length)]], steps: Array.from({ length: 16 }, () => { const x = r(); return x < 0.32 ? 1 : x < 0.64 ? -1 : x < 0.76 ? 2 : x < 0.88 ? -2 : x < 0.94 ? 0 : (r() < 0.5 ? 3 : -3); }) });
  const mA = motif(), mB = motif();
  let voicing = null, mel = 4; // melody position in scale degrees above the key (starts on the 5th)
  const bars = 8;
  let t0 = 0;
  for (const sec of form) {
    const prog = sec === 'B' ? tr.B : tr.prog;
    if (sec !== 'A' || t0 > 0) for (let q = 0; q < 6; q++) ev.push({ t: t0 - 0.75 + q * 0.125, inst: 'glock', midi: deg(7 + q + (q > 3 ? 1 : 0)) + 12, vel: 0.22 + q * 0.04, dur: 0.6 });
    for (let b = 0; b < bars; b++) {
      const root = prog[b % prog.length] + (sec === 'B' && b >= 6 ? 0 : 0);
      const cd = chordDeg(root);
      const tones = cd.slice(0, 3).map((d) => ((d % 7) + 7) % 7);
      const bt = t0 + b * beats;
      const cad = b === bars - 1; // last bar of the phrase: land home
      // ---- accompaniment: voice-led chord (closest inversion to the last one, around middle C)
      const pcs = cd.map((d) => deg(d) % 12);
      let best = null, bd = 1e9;
      for (let base = 55; base <= 64; base++) {
        const v = (r() < 0.45 ? [pcs[1], pcs[2], pcs[3]] : pcs.slice(0, 3)).map((pc) => { let m = base + ((pc - base) % 12 + 12) % 12; return m; }).sort((a, c) => a - c);
        const cost = voicing ? v.reduce((s, m, i) => s + Math.abs(m - (voicing[i] ?? voicing[voicing.length - 1])), 0) : Math.abs(v[0] - 55);
        if (cost < bd) { bd = cost; best = v; }
      }
      voicing = best;
      const vel = sec === 'B' ? 0.36 : 0.3;
      if (tr.style === 'arp') {
        const pat = [0, 1, 2, 3, 2, 1, 0, 2].slice(0, eighths);
        pat.forEach((k, i) => ev.push({ t: bt + i / 2, inst: tr.comp, midi: voicing[k % voicing.length] + (k >= voicing.length ? 12 : 0), vel: vel * (i % 2 ? 0.75 : 1), dur: 1.2 }));
      } else if (tr.style === 'waltz') {
        ev.push({ t: bt + 1, inst: tr.comp, midi: voicing, vel: vel * 0.8, dur: 0.9 });
        ev.push({ t: bt + 2, inst: tr.comp, midi: voicing, vel: vel * 0.7, dur: 0.9 });
      } else if (tr.style === 'strum') {
        for (const [o, v] of beats === 3 ? [[0, 1], [1.5, 0.7]] : [[0, 1], [1.5, 0.65], [2.5, 0.8]]) ev.push({ t: bt + o, inst: tr.comp, midi: voicing, vel: vel * v, dur: 1.4, strum: 0.025 });
      } else { // sparse: one long chord, gently rolled
        ev.push({ t: bt, inst: tr.comp, midi: voicing, vel: vel * 0.85, dur: beats, strum: 0.07 });
      }
      // ---- bass: root on 1, fifth (or the root again) mid-bar, a step into the next chord on the last beat
      if (tr.bass) {
        const R = deg(root) % 12 + 43 - (deg(root) % 12 > 7 ? 12 : 0); // around G2..F3: light, never a boomy sub
        ev.push({ t: bt, inst: 'felt', midi: R, vel: 0.55, dur: beats === 3 ? 0.9 : 1.2 });
        if (beats === 4) {
          if (r() < 0.5) ev.push({ t: bt + 2, inst: 'felt', midi: r() < 0.6 ? R + 7 : R, vel: 0.4, dur: 1 });
          const nextRoot = deg(prog[(b + 1) % prog.length]) % 12 + 36;
          if (r() < 0.45 && nextRoot !== R) ev.push({ t: bt + 3.5, inst: 'felt', midi: nextRoot + (nextRoot > R ? -1 : 1), vel: 0.45, dur: 0.5 });
        }
      }
      // ---- melody: motif A for A sections, B for the bridge; bars 3-4 answer, 5-6 vary, 7-8 resolve
      if (!(sec === 'A2' && b % 4 === 3 && r() < 0.3)) {
        const m = sec === 'B' ? mB : mA;
        const rh = cad ? (beats === 3 ? [3, 0, 0, 0, 0, 0] : [3, 0, 0, 0, 0, 0, 0, 0]) : m.rh[b % 2];
        let si = (b % 2) * 8;
        if (b >= 4 && b < 6) si += 3; // a little variation in the second half
        for (let e = 0; e < eighths; e++) {
          const hit = rh[e];
          if (!hit) continue;
          // how long until the next note
          let len = 1; while (e + len < eighths && !rh[e + len]) len++;
          const strong = e % (beats === 3 ? 2 : 4) === 0;
          if (cad && e === 0) mel = 7 * Math.round(mel / 7); // the tonic
          else {
            mel += m.steps[si++ % m.steps.length];
            if (b === bars - 2 && e >= eighths - 2) mel += mel % 7 > 3 ? 1 : -1; // lead in to the cadence
          }
          mel = Math.max(0, Math.min(9, mel));
          if (strong) { // snap to the nearest chord tone on strong beats
            let bestD = mel, bdd = 9;
            for (let d = mel - 2; d <= mel + 2; d++) if (tones.includes(((d % 7) + 7) % 7) && Math.abs(d - mel) < bdd) { bdd = Math.abs(d - mel); bestD = d; }
            mel = Math.max(0, Math.min(9, bestD));
          }
          const lift = tr.key >= 62 ? 0 : 12; // keep the tune in a sweet, singable range
          const oct = 0;
          const lead = sec === 'B' && tr.leadB ? tr.leadB : tr.lead;
          ev.push({ t: bt + e / 2 + (e % 2 ? tr.swing : 0), inst: lead, midi: deg(mel) + lift + oct, vel: (strong ? 0.78 : 0.62) * (0.9 + r() * 0.15), dur: len / 2 + 0.1 });
          // the second time round, a counter-line answers a third below on the long notes
          if (sec === 'A2' && len >= 3) ev.push({ t: bt + e / 2 + 0.5, inst: tr.comp === 'felt' ? 'kalimba' : tr.comp, midi: deg(mel - 2) + lift, vel: 0.35, dur: len / 2 });
        }
      }
      // ---- percussion
      if (tr.drums) {
        for (let k = 0; k < beats; k++) {
          const tb = bt + k;
          if (tr.drums !== 'shaker' && (k === 0 || (k === 2 && beats === 4 && r() < 0.8))) ev.push({ t: tb, inst: 'kick', vel: tr.drums === 'soft' ? 0.4 : 0.5 });
          if ((k === 1 || k === 3) && beats === 4 && tr.drums !== 'shaker') ev.push({ t: tb, inst: 'brush', vel: 0.55 + r() * 0.15 });
          ev.push({ t: tb + 0.5 + tr.swing, inst: 'shaker', vel: 0.35 + r() * 0.15 });
          if (tr.drums === 'brush') ev.push({ t: tb, inst: 'shaker', vel: 0.22 });
        }
      }
    }
    t0 += bars * beats;
  }
  // a last held chord to finish
  ev.push({ t: t0, inst: tr.comp, midi: voicing, vel: 0.4, dur: beats * 2, strum: 0.06 });
  if (tr.bass) ev.push({ t: t0, inst: 'felt', midi: tr.key % 12 + 43 - (tr.key % 12 > 7 ? 12 : 0), vel: 0.4, dur: beats });
  ev.sort((a, c) => a.t - c.t);
  return { events: ev, lengthBeats: t0 + beats * 2 };
}

// ---------------------------------------------------------------- the player
export class Music {
  constructor(engine) {
    this.e = engine;
    const ctx = (this.ctx = engine.ctx);
    this.samples = new Map();
    // the music chain: a gentle tape wobble, a warm top end, and a soft room
    this.out = ctx.createGain(); this.out.gain.value = 1.35;
    const warm = ctx.createBiquadFilter(); warm.type = 'lowpass'; warm.frequency.value = 7200; warm.Q.value = 0.5;
    const wow = ctx.createDelay(0.05); wow.delayTime.value = 0.012;
    const lfo = ctx.createOscillator(), lfoG = ctx.createGain(); lfo.frequency.value = 0.33; lfoG.gain.value = 0.0011;
    lfo.connect(lfoG).connect(wow.delayTime); lfo.start();
    this.out.connect(warm).connect(wow).connect(engine.musicDuck);
    this.verb = ctx.createConvolver(); this.verb.buffer = this.room(3.2);
    this.verbIn = ctx.createGain(); this.verbIn.gain.value = 0.35;
    this.verbIn.connect(this.verb).connect(engine.musicDuck);
    this.track = null; this.restUntil = ctx.currentTime + 3; this.lastName = null;
    this.timer = setInterval(() => this.tick(), 100);
    // warm the most used instruments up in the background (a few buffers at a time)
    const warmList = ['piano', 'felt', 'kalimba', 'marimba', 'flute', 'glock'];
    const step = () => { const k = warmList.shift(); if (!k) return; for (let m = 48; m <= 84; m += INSTR[k].bucket) this.sample(k, m); setTimeout(step, 60); };
    setTimeout(step, 400);
  }
  get trackName() { return this.track?.def.name || null; }

  room(sec) {
    const ctx = this.ctx, len = Math.floor(ctx.sampleRate * sec), buf = ctx.createBuffer(2, len, ctx.sampleRate), pre = Math.floor(ctx.sampleRate * 0.018);
    for (let c = 0; c < 2; c++) {
      const d = buf.getChannelData(c); let lp = 0;
      for (let i = pre; i < len; i++) { const x = (i - pre) / (len - pre); const damp = 0.5 - x * 0.42; lp += ((Math.random() * 2 - 1) - lp) * damp; d[i] = lp * Math.pow(1 - x, 2.4) * 0.9; }
    }
    return buf;
  }

  /** The sampled buffer for an instrument near a MIDI note (rendered on first use). */
  sample(inst, midi) {
    const I = INSTR[inst];
    const base = Math.round((midi - 24) / I.bucket) * I.bucket + 24;
    const key = `${inst}:${base}`;
    let b = this.samples.get(key);
    if (!b) {
      const n = Math.floor(I.len * SR), data = I.render(NOTE(base), n);
      let peak = 0; for (let i = 0; i < n; i++) peak = Math.max(peak, Math.abs(data[i]));
      const k = peak > 0 ? 0.9 / peak : 1;
      const fade = Math.floor(SR * 0.08); // ends cleanly
      for (let i = 0; i < n; i++) data[i] *= k * (i > n - fade ? (n - i) / fade : 1);
      b = this.ctx.createBuffer(1, n, SR);
      b.getChannelData(0).set(data);
      this.samples.set(key, b);
    }
    return { buffer: b, rate: Math.pow(2, (midi - base) / 12) };
  }

  note(inst, midi, t, vel, durSec, out) {
    const I = INSTR[inst], ctx = this.ctx;
    const { buffer, rate } = this.sample(inst, midi);
    const src = ctx.createBufferSource(); src.buffer = buffer; src.playbackRate.value = rate;
    const g = ctx.createGain(), v = I.vol * Math.pow(vel, 1.5);
    g.gain.setValueAtTime(v, t);
    const off = t + Math.max(0.08, durSec);
    g.gain.setValueAtTime(v, off); g.gain.setTargetAtTime(0, off, I.release / 3);
    let node = src.connect(g);
    if (ctx.createStereoPanner) { const p = ctx.createStereoPanner(); p.pan.value = I.pan + (midi - 64) / 90; node = node.connect(p); }
    node.connect(out); node.connect(this.verbIn);
    src.start(t); src.stop(Math.min(t + buffer.duration / rate, off + I.release * 2 + 0.05));
  }

  drum(kind, t, vel, out) {
    const ctx = this.ctx, e = this.e;
    if (kind === 'kick') { // a soft, rounded felt kick
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.frequency.setValueAtTime(95, t); o.frequency.exponentialRampToValueAtTime(42, t + 0.18);
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.32 * vel, t + 0.006); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.32);
      o.connect(g).connect(out); o.start(t); o.stop(t + 0.35);
      return;
    }
    const src = ctx.createBufferSource(); src.buffer = e.pink || e.white; src.loop = true;
    const f = ctx.createBiquadFilter(), g = ctx.createGain();
    if (kind === 'brush') { // a brush swish on the snare: soft attack, a little sweep
      f.type = 'bandpass'; f.frequency.setValueAtTime(2600, t); f.frequency.exponentialRampToValueAtTime(1400, t + 0.22); f.Q.value = 0.7;
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.11 * vel, t + 0.03); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.28);
    } else { // shaker
      f.type = 'highpass'; f.frequency.value = 6500;
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.045 * vel, t + 0.012); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.09);
    }
    src.connect(f).connect(g).connect(out); g.connect(this.verbIn);
    src.start(t, Math.random()); src.stop(t + 0.35);
  }

  /** Mood from the game: the region you're in, the time of day, and the weather. */
  want() {
    const e = this.e;
    const group = REGION_GROUP[e.region] || 'cove';
    const mood = group === 'cave' ? 'cave' : e.weather === 'rain' || e.weather === 'storm' ? 'rain' : e.phase || 'day';
    return { group, mood, key: `${group}|${mood}` };
  }
  pick(w) {
    const fits = (t) => (t.where.includes(w.group) || (t.where.includes('any') && w.group !== 'cave')) && (w.mood === 'cave' || t.when.includes(w.mood));
    let list = TRACKS.filter((t) => fits(t) && t.where.includes(w.group));
    if (w.mood !== 'cave') list = list.concat(TRACKS.filter((t) => fits(t) && t.where.includes('any')));
    if (!list.length) list = TRACKS.filter((t) => t.when.includes(w.mood === 'cave' ? 'night' : w.mood));
    const fresh = list.filter((t) => t.name !== this.lastName);
    const pool = fresh.length ? fresh : list;
    return pool[Math.floor(Math.random() * pool.length)];
  }

  start(def, now) {
    const ctx = this.ctx;
    const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, now); g.gain.exponentialRampToValueAtTime(1, now + 4);
    g.connect(this.out);
    this.verbIn.gain.setTargetAtTime(def.verb ?? 0.35, now, 1);
    const song = compose(def, Math.floor(Math.random() * 1e9));
    this.track = { def, song, gain: g, t0: now + 0.3, spb: 60 / def.bpm, i: 0, key: this.want().key };
    this.lastName = def.name;
    this.e.trackName = def.name;
  }
  fadeOut(sec = 4) {
    const tr = this.track; if (!tr) return;
    const now = this.ctx.currentTime;
    tr.gain.gain.cancelScheduledValues(now); tr.gain.gain.setValueAtTime(tr.gain.gain.value, now); tr.gain.gain.linearRampToValueAtTime(0.0001, now + sec);
    setTimeout(() => tr.gain.disconnect(), sec * 1000 + 3000);
    tr.until = now + sec;
    (this.fading = this.fading || []).push(tr);
    this.track = null;
    this.restUntil = now;
  }

  tick() {
    const ctx = this.ctx, e = this.e;
    if (!ctx || ctx.state !== 'running') return;
    if (!e.musicOn) { if (this.track) this.fadeOut(1.5); return; }
    const now = ctx.currentTime, w = this.want();
    // somewhere new, or the evening drew in: let this song go and bring in one for here and now
    // a song keeps playing wherever it belongs; it only gives way when the time of day or the rain changes,
    // when you go in or out of the cave, or when you've been somewhere it doesn't suit for a little while
    const tr0 = this.track;
    if (tr0) {
      const def = tr0.def, suits = (def.where.includes(w.group) || (def.where.includes('any') && w.group !== 'cave')) && (w.mood === 'cave' ? def.where.includes('cave') : def.when.includes(w.mood));
      if (suits) this.offSince = null; else this.offSince ??= now;
      const caveFlip = (w.group === 'cave') !== def.where.includes('cave');
      if (!suits && (caveFlip || now - this.offSince > 12)) { this.offSince = null; this.fadeOut(6); this.restUntil = now; }
    }
    if (!this.track && now >= this.restUntil) this.start(this.pick(w), now);
    for (const f of this.fading || []) this.schedule(f, now); // the old song plays on under its fade
    this.fading = (this.fading || []).filter((f) => now < f.until);
    if (!this.track) return;
    const tr = this.track;
    this.schedule(tr, now);
    if (tr.i >= tr.song.events.length && now > tr.t0 + tr.song.lengthBeats * tr.spb + 2) {
      // the song is over: a short breath of birdsong and water, then the next
      this.track = null; this.restUntil = now + 6 + Math.random() * 6;
      setTimeout(() => tr.gain.disconnect(), 4000);
      e.trackName = null;
    }
  }

  /** Queue a song's notes a little ahead (generously, so a busy frame or a background tab never drops any). */
  schedule(tr, now) {
    const ev = tr.song.events;
    while (tr.i < ev.length) {
      const x = ev[tr.i];
      let t = tr.t0 + x.t * tr.spb + (Math.random() - 0.5) * 0.012; // a human touch
      if (t > now + 1.6) break;
      tr.i++;
      if (t < now - 0.35) continue; // only notes that are badly late are dropped
      t = Math.max(t, now + 0.01);
      if (x.inst === 'kick' || x.inst === 'brush' || x.inst === 'shaker') { this.drum(x.inst, t, x.vel, tr.gain); continue; }
      const notes = Array.isArray(x.midi) ? x.midi : [x.midi];
      notes.forEach((m, k) => this.note(x.inst, m, t + (x.strum || 0) * k, x.vel * (notes.length > 1 ? 0.62 : 1), x.dur * tr.spb, tr.gain));
    }
  }
}
