// Frostmere's own sounds, made like the rest of the game's (Web Audio tones and filtered noise, src/audio/audio.js):
// the auger biting the ice, the ice creaking and booming, the tip-up flag, the flasher's tick, dogs, the sauna's hiss.
export function northSfx(audio, id, opts = {}) {
  if (!audio?.ctx) return;
  const out = audio.bus?.sfx, r = (a, b) => a + Math.random() * (b - a), v = opts.vol ?? 1;
  const T = (o) => audio.tone({ out, ...o, vol: (o.vol ?? 0.2) * v }), N = (o) => audio.noise({ out, ...o, vol: (o.vol ?? 0.2) * v });
  switch (id) {
    case 'drill': // one turn of the auger: a gritty scrape
      N({ dur: 0.18, vol: 0.16, type: 'bandpass', freq: r(1800, 2400), to: 900, q: 1.2, attack: 0.02 });
      N({ dur: 0.08, vol: 0.06, type: 'highpass', freq: 4500, when: 0.06 });
      break;
    case 'drillthrough': // the auger breaks through: a gulp of water and a slosh
      T({ freq: 420, to: 140, dur: 0.25, vol: 0.18 });
      N({ dur: 0.5, vol: 0.18, type: 'lowpass', freq: 1200, to: 300, when: 0.05 });
      break;
    case 'creak': // ice creaking underfoot
      T({ freq: r(90, 130), to: r(160, 220), type: 'sawtooth', dur: 0.7, vol: 0.03, attack: 0.1 });
      T({ freq: r(200, 260), to: r(120, 160), type: 'sawtooth', dur: 0.45, vol: 0.02, when: 0.35 });
      break;
    case 'crack': // a sharp crack: thin ice giving way
      N({ dur: 0.06, vol: 0.4, type: 'highpass', freq: 2500 });
      T({ freq: 1800, to: 300, dur: 0.12, vol: 0.08 });
      N({ dur: 0.3, vol: 0.15, type: 'bandpass', freq: 900, to: 300, when: 0.05 });
      break;
    case 'boom': { // the lake ice booming in the cold: a long, falling, laser-like "pew" and rumble
      T({ freq: r(900, 1200), to: 80, type: 'sine', dur: 1.4, vol: 0.05, attack: 0.01 });
      T({ freq: r(1800, 2200), to: 160, type: 'sine', dur: 1.0, vol: 0.02, when: 0.02 });
      N({ dur: 1.6, vol: 0.06, type: 'lowpass', freq: 220, attack: 0.05 });
      break;
    }
    case 'splash': // through the ice
      N({ dur: 0.8, vol: 0.35, type: 'lowpass', freq: 1600, to: 200 });
      T({ freq: 300, to: 90, dur: 0.4, vol: 0.2 });
      break;
    case 'flag': // the tip-up flag springs up: a bright spring twang and a ding
      T({ freq: 520, to: 880, type: 'triangle', dur: 0.12, vol: 0.12 });
      [1568, 2093].forEach((f, i) => T({ freq: f, type: 'triangle', dur: 0.45, vol: 0.08, when: 0.1 + i * 0.12 }));
      break;
    case 'tick': // the flasher's soft tick when a mark rises
      T({ freq: 2400, type: 'sine', dur: 0.03, vol: 0.03 });
      break;
    case 'jig': // the jig twitched: a small reel click
      N({ dur: 0.03, vol: 0.06, type: 'highpass', freq: 3500 });
      break;
    case 'spook': // marks dart away
      T({ freq: 900, to: 400, dur: 0.15, vol: 0.05 });
      break;
    case 'bark': { // a husky's yip-bark
      const f = r(380, 560);
      T({ freq: f, to: f * 1.4, type: 'sawtooth', dur: 0.09, vol: 0.06 });
      N({ dur: 0.1, vol: 0.06, type: 'bandpass', freq: 900, q: 2 });
      if (Math.random() < 0.5) T({ freq: f * 1.1, to: f * 1.5, type: 'sawtooth', dur: 0.08, vol: 0.05, when: 0.16 });
      break;
    }
    case 'howl': // a husky's howl (the aurora)
      T({ freq: r(420, 480), to: r(620, 700), type: 'triangle', dur: 1.6, vol: 0.04, attack: 0.3 });
      T({ freq: 660, to: 480, type: 'triangle', dur: 1.2, vol: 0.03, when: 1.4 });
      break;
    case 'hiss': // water on the sauna stones
      N({ dur: 1.4, vol: 0.12, type: 'highpass', freq: 3000, attack: 0.05 });
      break;
    case 'bell': // the Hearthwick bell
      [0, 1.4].forEach((w) => { T({ freq: 392, type: 'sine', dur: 2.6, vol: 0.08, when: w }); T({ freq: 784 * 1.01, type: 'sine', dur: 1.8, vol: 0.03, when: w }); T({ freq: 1176, type: 'sine', dur: 1.0, vol: 0.015, when: w }); });
      break;
    case 'snowball':
      N({ dur: 0.12, vol: 0.2, type: 'lowpass', freq: 1200, attack: 0.01 });
      break;
    case 'skate': // a blade carving the ice
      N({ dur: 0.35, vol: 0.06, type: 'bandpass', freq: r(3000, 4200), q: 3, attack: 0.04 });
      break;
    case 'hockeystop':
      N({ dur: 0.5, vol: 0.16, type: 'highpass', freq: 2500, to: 5000, attack: 0.01 });
      break;
    default: break;
  }
}
