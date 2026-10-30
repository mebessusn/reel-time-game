// Frostmere (v1.17.2): the new places, as data. Everything here is a Polyfork model (src/world/polyfork.js), merged into one
// mesh a place, so each costs a draw call or two however many pieces it has, and each piece is solid.
//   Galena: an abandoned silver town in the western foothills. Skyline: a little ski hill on the south range.
//   Ember Hollow: a valley of hot pools. The trail huts: six shelters spread round the map.
import { toWorld, P, HOLLOW } from './geo.js';
import { placeModels, polyforkFoot } from '../world/polyfork.js';
import { landAt } from './geo.js';

const Q = Math.PI / 2;
// [model, u, v, yaw, options] in local map coordinates
const GALENA_C = P.galena;
const at = (c, list) => list.map(([m, du, dv, ry = 0, o]) => [m, c.u + du, c.v + dv, ry, o]);
export const GALENA = at(GALENA_C, [
  // the street runs east to west, shopfronts facing it
  ['saloon', -14, -13, 0], ['hotel', 2, -14, 0], ['sheriff-s-office', 15, -13, 0], ['blacksmith-s-shop', -14, 13, Math.PI], ['undertakers-shop', 1, 13, Math.PI], ['miner-s-shack', 12, 11, Math.PI],
  ['water-tower-on-a-timber-trestle', 24, 0, 0.4], ['dead-cottonwood', -24, 8, 1.2], ['dead-cottonwood', 22, 20, 2.6],
  // the mine at the west end of town
  ['mine-headframe', -30, -6, Q], ['ore-chute-and-bin', -24, -18, 0.3], ['mine-cart', -26, 0.5, Q], ['ore-barrow', -21, 4, 0.8],
  ...[-22, -20, -18, -16, -14, -12].map((du) => ['mine-rail-run', du - 4, 0.5, 0, { solid: false }]),
]);
export const GALENA_LAMPS = at(GALENA_C, [[null, -8, -6], [null, 8, -6], [null, -8, 6], [null, 8, 6], [null, -20, -2]]).map(([, u, v]) => ({ u, v }));
export const GALENA_SHAFT = { u: GALENA_C.u - 30, v: GALENA_C.v - 6 };

const S = P.skyline, T = P.summit;
export const SKYLINE = [
  ...at(S, [['ski-lift-base-station', 0, 0, Math.PI], ['alpine-hay-barn', -13, -4, 0.2], ['timber-ski-rack', 9, -6, 0], ['race-start-hut', 9, 3, Math.PI], ['piste-marker-pole', 14, -8, 0, { solid: false }]]),
  ...at(T, [['lift-top-station', 0, -2, Math.PI], ['alpine-chalet', -14, -5, Q], ['summit-cross', 13, 6, 0.3], ['alpine-fingerpost', 7, -8, 0.2], ['weather-station-mast', 13, -6, 0]]),
  ...[1, 2, 3].map((k) => ['lift-pylon', S.u, S.v + (T.v - 2 - S.v) * k / 4, 0]),
  ...[[-30, 325], [-30, 345], [30, 330], [32, 350]].map(([du, v]) => ['piste-marker-pole', S.u + du, v, 0, { solid: false }]),
];
export const JUMP_PIECES = [['slalom-gate', 244, 336, 0, { solid: false }], ['slalom-gate', 256, 336, 0, { solid: false }], ['safety-net-run', 240, 300, Q], ['safety-net-run', 260, 300, Q], ['piste-marker-pole', 243, 322, 0, { solid: false }], ['piste-marker-pole', 257, 322, 0, { solid: false }]];

export const HOLLOW_PIECES = [
  ['canvas-wall-tent', 48, 276, -2.2], ['stone-fire-pit', 40, 279, 0], ['folding-camp-chair', 38, 277.5, 0.9], ['cordwood-pile', 50, 283, 1.2],
  ['frozen-water-trough', 4, 276, 0.6], ['boulder-field-cluster', -4, 290, 0.3], ['rock-outcrop', 32, 305, 1.1], ['rock-outcrop', 2, 308, 2.4], ['boulder-field-cluster', 46, 300, 1.9], ['bare-mountain-rowan', -6, 276, 0.5], ['windblown-larch', 52, 296, 2.1],
];
export const SOAK = HOLLOW.map((p) => ({ ...p }));

export const HUTS = [
  { id: 'taiga', name: 'Taiga Hut', model: 'log-cabin', u: -120, v: 196, ry: 0.5 },
  { id: 'shore', name: 'North Shore Hut', model: 'mountain-refuge-hut', u: -58, v: -160, ry: 2.9 },
  { id: 'tundra', name: 'Tundra Hut', model: 'piste-patrol-hut', u: 226, v: 30, ry: -1.2 },
  { id: 'point', name: 'Bear Point Hut', model: 'piste-patrol-hut', u: 236, v: -176, ry: 2.2 },
  { id: 'pass', name: 'Glacier Pass Hut', model: 'mountain-refuge-hut', u: -196, v: -96, ry: 1.3 },
  { id: 'south', name: 'Long Glide Hut', model: 'log-cabin', u: 316, v: 150, ry: -1.9 },
];

/** One place: pieces [model, u, v, ry, opts] stood on the ground (lowest corner, a little sunk) and merged. */
export function buildSite(group, name, pieces, ground) {
  const items = pieces.map(([m, u, v, ry = 0, o = {}]) => {
    const f = polyforkFoot(m), c = Math.cos(ry), s = Math.sin(ry);
    const w = toWorld(u, v);
    let y = Infinity;
    for (const [a, b] of [[f.x0, f.z0], [f.x1, f.z0], [f.x0, f.z1], [f.x1, f.z1], [0, 0]]) y = Math.min(y, ground(w.x + a * c + b * s, w.z - a * s + b * c));
    return { m, x: w.x, z: w.z, ry, y: y - 0.05, ...o };
  });
  const out = placeModels(name, items);
  group.add(out);
  return out;
}
export { landAt };
