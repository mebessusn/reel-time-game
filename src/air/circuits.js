// Skye's Air Races: the twelve circuits. Par (gold) and dev (platinum, Skye's own time) are set from autopilot
// runs of the Snow Goose in the Breeze class (tests/air.test.mjs keeps an eye on them); classes scale them by speed.
// Each is a closed loop (the track's centre line through control points,
// [x, z, y] in metres in the circuit's own space), flown in laps. Gates are placed along it automatically (about
// every `gateEvery` m); obstacles sit at a fraction `t` of the way round the loop, `lat` metres to the side (right is
// positive) and `up` above the line; shortcuts leave the line after one gate and rejoin it at a later one through
// their own hidden gates (`via`).
//
// kind 'sky': above the cloud sea. kind 'land': in a big flying region of its own (src/air/region.js), its `biome`
// themed after one of the game's places.
//
// Obstacle types (src/air/obstacles.js):
//   through:  bridge, rockarch, hangar, dam, drawbridge, lighthouse, falls, seacave, icearch, blimpdock, balloonring
//   slalom:   pylon, mast, hoodoo, seastack, spire, mesa, lookout, turbine, crane, tower, isle, column
//   moving:   blimp, train (on a trestle), balloons
//   hazards:  gust, storm, lightning, birds, geyser, updraft
export const CIRCUITS = [
  // ============================================================ sky circuits
  {
    id: 'firstflight', name: 'First Flight', kind: 'sky', laps: 3, par: 144, dev: 129, tier: 1, phase: 'day',
    desc: 'A gentle oval round a lighthouse island poking up through the clouds. Learn the gates, boost rings and tricks.',
    pts: [[0, 0, 70], [260, -40, 72], [520, 30, 80], [700, 220, 85], [640, 470, 78], [420, 600, 70], [150, 560, 66], [-80, 420, 68], [-160, 200, 70]],
    obstacles: [
      { type: 'isle', t: 0.36, lat: -95, up: -40, opts: { lighthouse: true } },
      { type: 'pylon', t: 0.18, lat: 30 }, { type: 'pylon', t: 0.22, lat: -30 },
      { type: 'updraft', t: 0.6, lat: 0, up: -25 },
      { type: 'balloons', t: 0.8, lat: 60 },
    ],
    boost: [0.1, 0.45, 0.72], shortcuts: [],
  },
  {
    id: 'cloudcanyon', name: 'Cloud Canyon', kind: 'sky', laps: 3, par: 225, dev: 198, tier: 1, phase: 'day',
    desc: 'A figure of eight through towering cumulus columns. Somewhere in the biggest tower there\'s a way through.',
    pts: [[0, 0, 90], [300, 120, 95], [560, 340, 105], [600, 620, 100], [380, 760, 92], [140, 600, 88], [-60, 380, 95], [-300, 160, 100], [-560, 120, 108], [-640, -160, 102], [-420, -360, 96], [-140, -260, 92]],
    obstacles: [
      { type: 'column', t: 0.12, lat: 70 }, { type: 'column', t: 0.2, lat: -80 }, { type: 'column', t: 0.33, lat: 60 },
      { type: 'column', t: 0.55, lat: -60 }, { type: 'column', t: 0.66, lat: 75 }, { type: 'column', t: 0.82, lat: -70 },
      { type: 'column', t: 0.42, lat: 120, opts: { big: true } },
      { type: 'birds', t: 0.27, lat: 0 }, { type: 'birds', t: 0.74, lat: 0 },
      { type: 'updraft', t: 0.9, lat: 0, up: -30 },
    ],
    boost: [0.05, 0.3, 0.6, 0.86],
    shortcuts: [{ id: 'towerheart', name: 'the heart of the cloud tower', from: 0.36, to: 0.47, via: [[560, 470, 102], [520, 560, 98]], fog: true }],
  },
  {
    id: 'thermal', name: 'Thermal Ladder', kind: 'sky', laps: 3, par: 177, dev: 152, tier: 2, phase: 'day',
    desc: 'Ride the updrafts up to a high hairpin, then a long dive home. Save your boost for the climb.',
    pts: [[0, 0, 60], [320, 60, 70], [600, 180, 95], [760, 420, 130], [700, 680, 165], [460, 820, 180], [200, 760, 165], [60, 560, 130], [-40, 320, 95], [-120, 140, 70]],
    obstacles: [
      { type: 'updraft', t: 0.18, lat: 0, up: -30 }, { type: 'updraft', t: 0.3, lat: 0, up: -30 }, { type: 'updraft', t: 0.42, lat: 0, up: -30 },
      { type: 'isle', t: 0.5, lat: 120, up: -50 }, { type: 'isle', t: 0.62, lat: -110, up: -60 },
      { type: 'gust', t: 0.55, lat: 0, opts: { push: [1, 0] } },
      { type: 'balloons', t: 0.75, lat: -40 }, { type: 'birds', t: 0.85, lat: 0 },
    ],
    boost: [0.08, 0.68, 0.9],
    shortcuts: [{ id: 'chimney', name: 'the chimney updraft', from: 0.12, to: 0.37, via: [[420, 120, 90], [560, 300, 125]], updraft: true }],
  },
  {
    id: 'stormfront', name: 'Stormfront', kind: 'sky', laps: 3, par: 200, dev: 178, tier: 3, phase: 'dusk', weather: 'storm',
    desc: 'Hard. Climb up the face of the storm and dive out of it again: steep, between lightning columns, with gusts that shove you sideways. The storm\'s eye is a shortcut, if you dare.',
    pts: [[0, 0, 80], [280, -120, 150], [580, -80, 190], [800, 140, 95], [820, 440, 60], [620, 660, 160], [320, 720, 200], [40, 600, 110], [-160, 380, 55], [-200, 140, 70]],
    obstacles: [
      { type: 'lightning', t: 0.14, lat: 22 }, { type: 'lightning', t: 0.31, lat: -24 }, { type: 'lightning', t: 0.5, lat: 20 }, { type: 'lightning', t: 0.7, lat: -22 }, { type: 'lightning', t: 0.42, lat: -20 }, { type: 'lightning', t: 0.62, lat: 22 },
      { type: 'column', t: 0.09, lat: -26 }, { type: 'column', t: 0.56, lat: 28 }, { type: 'column', t: 0.95, lat: -26 },
      { type: 'storm', t: 0.22, lat: -90 }, { type: 'storm', t: 0.6, lat: 100 }, { type: 'storm', t: 0.85, lat: -100 },
      { type: 'gust', t: 0.4, lat: 0, opts: { push: [1, 0] } }, { type: 'gust', t: 0.78, lat: 0, opts: { push: [-1, 0] } },
      { type: 'birds', t: 0.92, lat: 0 }, { type: 'birds', t: 0.47, lat: 0 }, { type: 'birds', t: 0.76, lat: 0 },
    ],
    boost: [0.06, 0.36, 0.64],
    shortcuts: [{ id: 'eye', name: 'the eye of the storm', from: 0.27, to: 0.56, via: [[560, 220, 110], [600, 420, 120]], storm: true }],
  },
  {
    id: 'aurora', name: 'Aurora Loop', kind: 'sky', laps: 3, par: 185, dev: 165, tier: 2, phase: 'night',
    desc: 'A night circuit under the northern lights, the gates drawn in green light. There\'s a gap in the curtains.',
    pts: [[0, 0, 100], [300, 80, 135], [580, 40, 160], [800, 220, 130], [760, 520, 95], [520, 700, 120], [220, 660, 150], [20, 480, 120], [-180, 300, 90], [-200, 80, 95]],
    obstacles: [
      { type: 'isle', t: 0.15, lat: 110, up: -55 }, { type: 'isle', t: 0.48, lat: -120, up: -60 },
      { type: 'column', t: 0.3, lat: -55 }, { type: 'column', t: 0.62, lat: 60 }, { type: 'column', t: 0.82, lat: -60 },
      { type: 'birds', t: 0.4, lat: 0 }, { type: 'updraft', t: 0.72, lat: 0, up: -30 },
    ],
    boost: [0.1, 0.38, 0.66, 0.9],
    shortcuts: [{ id: 'curtain', name: 'the gap in the aurora', from: 0.58, to: 0.78, via: [[600, 640, 130], [380, 720, 140]] }],
  },
  {
    id: 'skyharbour', name: 'Sky Harbour', kind: 'sky', laps: 3, par: 204, dev: 182, tier: 3, phase: 'day',
    desc: 'Hard. The harbour is stacked high: climb hard up to the top docks, dive down through the lower ones, cargo blimps on the move across your line. Fly through the hangar blimp\'s open bay.',
    pts: [[0, 0, 85], [300, 40, 150], [620, -40, 200], [880, 160, 165], [900, 460, 80], [700, 700, 100], [400, 780, 190], [120, 660, 110], [-80, 440, 50], [-160, 200, 70]],
    obstacles: [
      { type: 'blimpdock', t: 0.1, lat: 0, up: -8 }, { type: 'blimpdock', t: 0.44, lat: 0, up: -8 }, { type: 'blimpdock', t: 0.78, lat: 0, up: -8 },
      { type: 'blimp', t: 0.19, lat: 0, opts: { cross: 1 } }, { type: 'blimp', t: 0.6, lat: 0, opts: { cross: -1 } }, { type: 'blimp', t: 0.9, lat: 0, opts: { cross: 1, slow: true } },
      { type: 'hangar', t: 0.52, lat: 0, opts: { flying: true } },
      { type: 'birds', t: 0.35, lat: 0 }, { type: 'gust', t: 0.7, lat: 0, opts: { push: [1, 0] } }, { type: 'birds', t: 0.68, lat: 0 }, { type: 'gust', t: 0.25, lat: 0, opts: { push: [-1, 0] } },
      { type: 'balloons', t: 0.84, lat: 0, opts: { field: true } },
    ],
    boost: [0.05, 0.3, 0.66, 0.84],
    shortcuts: [{ id: 'bay', name: 'the cargo bay', from: 0.15, to: 0.3, via: [[460, -20, 172], [600, 60, 190]], hangar: true }],
  },
  // ============================================================ land circuits
  {
    id: 'flyway', name: 'Five Lakes Flyway', kind: 'land', biome: 'valley', laps: 3, par: 220, dev: 194, tier: 1, phase: 'day', water: 2, seed: 11,
    desc: 'Round the lakes, under the old stone viaduct, down the river gorge and past the lighthouse point. The mill race is a shortcut.',
    pts: [[0, 0, 22], [320, -80, 24], [640, -40, 26], [900, 160, 30], [960, 460, 34], [800, 720, 28], [520, 840, 24], [240, 780, 20], [0, 620, 18], [-200, 400, 22], [-260, 160, 24]],
    obstacles: [
      { type: 'bridge', t: 0.08, lat: 0 }, { type: 'lighthouse', t: 0.33, lat: 70 }, { type: 'turbine', t: 0.2, lat: -70 }, { type: 'turbine', t: 0.24, lat: 75 },
      { type: 'gorge', t: 0.5, lat: 0, opts: { len: 0.12 } }, { type: 'bridge', t: 0.48, lat: 0, opts: { small: true } },
      { type: 'pylon', t: 0.68, lat: 25 }, { type: 'pylon', t: 0.72, lat: -25 }, { type: 'pylon', t: 0.76, lat: 25 },
      { type: 'balloons', t: 0.88, lat: 40 }, { type: 'birds', t: 0.4, lat: 0 },
    ],
    boost: [0.04, 0.3, 0.62, 0.82],
    shortcuts: [{ id: 'millrace', name: 'the mill race', from: 0.6, to: 0.71, via: [[420, 760, 16], [300, 700, 15]], mill: true }],
  },
  {
    id: 'fjords', name: 'Glacier Fjords', kind: 'land', biome: 'fjord', laps: 3, par: 199, dev: 177, tier: 2, phase: 'day', water: 2, seed: 23, hug: true,
    desc: 'Icy fjords between sheer cliffs, ice spires, the great ice arch and the frozen falls. There\'s a tunnel behind the falls.',
    pts: [[0, 0, 30], [340, 40, 55], [640, 200, 80], [760, 500, 65], [640, 800, 40], [340, 920, 60], [60, 820, 80], [-140, 560, 55], [-180, 280, 35]],
    obstacles: [
      { type: 'icearch', t: 0.14, lat: 0 }, { type: 'spire', t: 0.26, lat: 35 }, { type: 'spire', t: 0.3, lat: -35 }, { type: 'spire', t: 0.34, lat: 30 },
      { type: 'falls', t: 0.47, lat: 140 }, { type: 'gorge', t: 0.62, lat: 0, opts: { len: 0.1, ice: true } },
      { type: 'birds', t: 0.74, lat: 0 }, { type: 'gust', t: 0.85, lat: 0, opts: { push: [1, 0] } }, { type: 'spire', t: 0.92, lat: -35 },
    ],
    boost: [0.06, 0.4, 0.7, 0.9],
    shortcuts: [{ id: 'fallstunnel', name: 'the tunnel behind the falls', from: 0.4, to: 0.56, via: [[700, 640, 55], [560, 790, 45]], tunnel: true }],
  },
  {
    id: 'taiga', name: 'Taiga Treetops', kind: 'land', biome: 'taiga', laps: 3, par: 198, dev: 177, tier: 2, phase: 'day', water: 1, seed: 37,
    desc: 'Hug the forest canopy. Power lines, the radio mast slalom, the fire lookout, and a log flume through the hills if you know it.',
    pts: [[0, 0, 26], [300, 60, 42], [600, 0, 30], [880, 160, 52], [920, 460, 34], [740, 700, 48], [440, 760, 30], [160, 640, 46], [-60, 420, 30], [-140, 180, 26]],
    obstacles: [
      { type: 'mast', t: 0.12, lat: 30 }, { type: 'mast', t: 0.16, lat: -30 }, { type: 'mast', t: 0.2, lat: 30 },
      { type: 'powerline', t: 0.24, lat: 0 }, { type: 'lookout', t: 0.42, lat: 45 }, { type: 'powerline', t: 0.55, lat: 0 },
      { type: 'crane', t: 0.66, lat: 30 }, { type: 'lookout', t: 0.78, lat: -45 }, { type: 'birds', t: 0.88, lat: 0 },
      { type: 'tower', t: 0.94, lat: 40 },
    ],
    boost: [0.05, 0.36, 0.6, 0.84],
    shortcuts: [{ id: 'flume', name: 'the logging flume', from: 0.7, to: 0.82, via: [[560, 740, 16], [400, 700, 15]], flume: true }],
  },
  {
    id: 'islands', name: 'Island Hopper', kind: 'land', biome: 'tropic', laps: 3, par: 207, dev: 183, tier: 1, phase: 'day', water: 2, seed: 51,
    desc: 'Low over a tropical sea between dozens of islands, sea stacks and the volcano\'s steam vents. A sea cave cuts the corner.',
    pts: [[0, 0, 14], [320, -60, 15], [660, 20, 16], [900, 240, 18], [880, 560, 18], [640, 780, 16], [320, 820, 14], [60, 680, 14], [-140, 440, 15], [-160, 180, 14]],
    obstacles: [
      { type: 'seastack', t: 0.1, lat: 30 }, { type: 'seastack', t: 0.14, lat: -32 }, { type: 'rockarch', t: 0.334, lat: 0 },
      { type: 'geyser', t: 0.42, lat: 10 }, { type: 'geyser', t: 0.45, lat: -12 }, { type: 'lighthouse', t: 0.55, lat: -60 },
      { type: 'seastack', t: 0.66, lat: 28 }, { type: 'birds', t: 0.75, lat: 0 }, { type: 'balloons', t: 0.88, lat: -40 }, { type: 'seastack', t: 0.94, lat: 30 },
    ],
    boost: [0.04, 0.34, 0.6, 0.82],
    shortcuts: [{ id: 'seacave', name: 'the sea cave', from: 0.16, to: 0.27, via: [[480, -50, 12], [600, -10, 12]], cave: true }],
  },
  {
    id: 'redrock', name: 'Red Rock Canyon', kind: 'land', biome: 'desert', laps: 3, par: 214, dev: 191, tier: 3, phase: 'day', water: -40, seed: 67, hug: true,
    desc: 'Hard. Up over the mesas and straight back down into the slot canyons, again and again: climb steep, dive steep, thread the hoodoos. Over the dam\'s spillway, under the train on the trestle. There\'s a crack through the big mesa.',
    pts: [[0, 0, 28], [320, 80, 34], [640, 40, 120], [900, 240, 150], [940, 560, 60], [720, 800, 30], [400, 860, 120], [120, 720, 150], [-80, 480, 45], [-160, 220, 28]],
    obstacles: [
      { type: 'hoodoo', t: 0.08, lat: 18 }, { type: 'hoodoo', t: 0.11, lat: -18 }, { type: 'hoodoo', t: 0.14, lat: 18 }, { type: 'hoodoo', t: 0.17, lat: -18 },
      { type: 'gorge', t: 0.52, lat: 0, opts: { len: 0.08, red: true } }, { type: 'hoodoo', t: 0.72, lat: 16 }, { type: 'hoodoo', t: 0.75, lat: -16 }, { type: 'birds', t: 0.46, lat: 0 },
      { type: 'dam', t: 0.3, lat: 0 }, { type: 'mesa', t: 0.42, lat: 110 }, { type: 'train', t: 0.6, lat: 0 },
      { type: 'gorge', t: 0.68, lat: 0, opts: { len: 0.1, red: true } }, { type: 'rockarch', t: 0.8, lat: 0 }, { type: 'birds', t: 0.9, lat: 0 },
    ],
    boost: [0.04, 0.36, 0.62, 0.86],
    shortcuts: [{ id: 'mesacrack', name: 'the crack in the big mesa', from: 0.36, to: 0.5, via: [[860, 420, 105], [880, 560, 75]], crack: true }],
  },
  {
    id: 'gauntlet', name: 'The Gauntlet', kind: 'land', biome: 'mixed', laps: 3, par: 252, dev: 225, tier: 3, phase: 'dusk', water: 2, seed: 83, locked: 'golds11', hug: true,
    desc: 'Hard, the hardest: everything at once, a moving obstacle on every stretch, and the whole course climbs over ridges and drops into valleys. Gold on the other eleven circuits opens it.',
    pts: [[0, 0, 26], [340, -60, 30], [700, 0, 95], [960, 240, 140], [1000, 580, 60], [800, 860, 32], [460, 960, 30], [140, 860, 100], [-100, 620, 130], [-200, 320, 50], [-180, 100, 28]],
    obstacles: [
      { type: 'drawbridge', t: 0.07, lat: 0 }, { type: 'turbine', t: 0.16, lat: -10, opts: { inPath: true } }, { type: 'crane', t: 0.285, lat: 19, opts: { sweep: true } },
      { type: 'train', t: 0.33, lat: 0 }, { type: 'hangar', t: 0.475, lat: 0 }, { type: 'blimp', t: 0.52, lat: 0, opts: { cross: 1, low: true } },
      { type: 'rockarch', t: 0.6, lat: 0 }, { type: 'geyser', t: 0.68, lat: 0 }, { type: 'mill', t: 0.76, lat: 60 },
      { type: 'balloons', t: 0.8, lat: 0, opts: { field: true } }, { type: 'bridge', t: 0.87, lat: 0 }, { type: 'birds', t: 0.97, lat: 0 },
    ],
    boost: [0.03, 0.28, 0.5, 0.72, 0.9],
    shortcuts: [{ id: 'gap', name: 'between the blimps', from: 0.47, to: 0.58, via: [[620, 940, 34], [420, 950, 40]] }, { id: 'underdeck', name: 'under the drawbridge\'s far span', from: 0.02, to: 0.12, via: [[140, -40, 14], [290, -70, 16]] }],
  },
];
export const CIRCUIT_BY_ID = Object.fromEntries(CIRCUITS.map((c) => [c.id, c]));

// the three classes: faster planes, sharper rivals, more hazards (and rivals only take shortcuts from Gale up)
export const CLASSES = {
  breeze: { id: 'breeze', name: 'Breeze', speed: 1.0, ai: 0.9, hazards: 0.7, shortcuts: false },
  gale: { id: 'gale', name: 'Gale', speed: 1.1, ai: 0.97, hazards: 1.0, shortcuts: true },
  hurricane: { id: 'hurricane', name: 'Hurricane', speed: 1.22, ai: 1.02, hazards: 1.3, shortcuts: true },
};
export const MEDALS = ['', 'Bronze', 'Silver', 'Gold', 'Platinum'];
/** Medal for a race time on a circuit (by class: the par scales with the class's speed). */
export function medalFor(c, cls, time, place = 1) {
  const k = 1 / (CLASSES[cls]?.speed || 1), par = c.par * k, dev = c.dev * k;
  if (time <= dev && place === 1) return 4;
  if (place === 1 && time <= par) return 3;
  if (place <= 2 && time <= par * 1.12) return 2;
  if (place <= 4 && time <= par * 1.3) return 1;
  return 0;
}
