// Frostmere: Polyfork props (v1.17.1). Free low-poly models from polyfork.dev's Alpine and Snow kit, downloaded to
// art/polyfork/ and turned into src/data/polyforkMesh.js by scripts/polyfork-meshes.mjs (no binary files, nothing
// fetched at runtime). Each kind is merged or instanced through instancing.js like Frostmere's own props, its window
// glass lit like the village's. Everything solid gets a collider; low pieces carry `top` so you can step over them.
//   - a mountain refuge hut on the flat below the glacier, near the Blue Caves, with a woodpile and a toboggan
//   - stone cairns marking the high ground between the Frozen Falls and the caves
//   - an ice axe and crampons at the cave mouth
//   - two frozen icefalls on the falls basin's west wall
//   - a snow fence across the top of Aurora Hill
//   - in Hearthwick: a bench by the sauna, log piles by the smokehouse and the lodge, a toboggan by a cabin
import { POLYFORK_MATS, POLYFORK_NODES } from '../data/polyforkMesh.js';
import { addLibrary, mergedMesh, instanced } from './instancing.js';
import { addBox, addCircle, blocked } from '../world/colliders.js';
import { ICESHARD_MATS, ICESHARD_NODES } from '../data/iceshardMesh.js';
import { toWorld, landAt } from './geo.js';
import { BUILDINGS } from './hearthwick.js';

addLibrary(POLYFORK_MATS, POLYFORK_NODES);

// footprints (half sizes in the model's x / z, metres, from the models) and how the solid is made
const KIND = {
  'mountain-refuge-hut': { hw: 2.15, hd: 2.15 }, // (the drystone walls: the roof's overhang and the lee bench are open)
  'snow-capped-log-pile': { hw: 1.0, hd: 0.7, top: 1.15 },
  'stone-cairn': { r: 0.5 },
  'wooden-toboggan': { hw: 0.25, hd: 0.55, top: 0.33 },
  'ice-axe-and-crampon-set': null, // (lying flat in the snow: nothing to bump into)
  'frozen-waterfall': { hw: 2.2, hd: 0.7 },
  'snow-fence-run': { hw: 1.0, hd: 0.12 },
  'alpine-bench': { hw: 1.0, hd: 0.35, top: 0.5 },
};

const N = Math.PI, E = Math.PI / 2, W = -Math.PI / 2, S = 0;
const R = (u, v, ry, s) => ({ u, v, ry, s });
/** Placements out in the wild (local u, v; ry: which way the model's front faces, as in hearthwick.js). */
export const ALPINE = {
  'mountain-refuge-hut': [R(-293, -164, S)],
  'snow-capped-log-pile': [R(-289.6, -163.5, E)],
  'wooden-toboggan': [R(-295.4, -160.6, 0.35)],
  'stone-cairn': [R(-246, -66, 0.4), R(-272, -98, 1.9), R(-290, -136, 3.1)],
  'ice-axe-and-crampon-set': [R(-300, -149, 2.2)],
  'frozen-waterfall': [R(-256.6, -30, E, 1.4), R(-256.8, -44, E, 1.6)], // (set back into the bank, so only the curtain shows)
  // (below the hilltop on the seaward side, well outside the standing stones' 8 m ring round the inukshuk)
  'snow-fence-run': [-6, -4, -2, 0, 2, 4].map((du) => R(256 + du * 0.98, -100 + du * 0.2, 0.2)),
};
/** Placements in Hearthwick, beside a building (its id, then x / z in the building's own frame; ry relative to it). */
export const VILLAGE = {
  'alpine-bench': [['sauna', 3.7, 0.6, 0]],
  'snow-capped-log-pile': [['smokehouse', -3.9, 0.4, E], ['lodge', 9.6, -2.2, E]],
  'wooden-toboggan': [['cabin2', 1.7, 3.3, 0.3]],
};

addLibrary(ICESHARD_MATS, ICESHARD_NODES); // (v1.17.2: the shore ice, art/iceshards.blend; world.js scatters them)

export function buildAlpine(group, village) {
  const items = new Map(); // kind -> [{ x, y, z, ry, s }]
  const put = (kind, x, z, ry, s = 1, ground) => {
    const K = KIND[kind];
    // stand on the lowest ground under the footprint (a corner on a slope sinks in rather than floating)
    const hw = (K?.hw ?? K?.r ?? 0.5) * s, hd = (K?.hd ?? K?.r ?? 0.5) * s, c = Math.cos(ry), sn = Math.sin(ry);
    let y = ground(x, z);
    for (const [a, b] of [[-hw, -hd], [hw, -hd], [-hw, hd], [hw, hd]]) y = Math.min(y, ground(x + a * c + b * sn, z - a * sn + b * c));
    y -= 0.04;
    if (blocked(x, z, 0.3)) console.warn(`alpine: ${kind} at (${x.toFixed(1)}, ${z.toFixed(1)}) stands on something solid`); // (built after everything else, so this sees it)
    if (!items.has(kind)) items.set(kind, []);
    items.get(kind).push({ x, y, z, ry, s });
    if (!K) return;
    const opts = K.top != null ? { top: y + K.top * s } : {};
    if (K.r) { addCircle(x, z, K.r * s, opts); return; }
    // a box when it's square to the world; otherwise a row of circles along its long side
    const quarter = Math.abs(Math.sin(2 * ry)) < 1e-3;
    if (quarter) { const ex = Math.abs(c) * hw + Math.abs(sn) * hd, ez = Math.abs(sn) * hw + Math.abs(c) * hd; addBox(x - ex, z - ez, x + ex, z + ez, opts); return; }
    const long = hw >= hd, r = Math.min(hw, hd), L = Math.max(hw, hd) - r, n = Math.max(1, Math.ceil(L / r));
    for (let k = -n; k <= n; k++) {
      const t = (k / n) * L, a = long ? t : 0, b = long ? 0 : t;
      addCircle(x + a * c + b * sn, z - a * sn + b * c, r, opts);
    }
  };
  const wild = (u, v) => landAt(u, v);
  for (const [kind, list] of Object.entries(ALPINE)) for (const p of list) {
    const w = toWorld(p.u, p.v);
    put(kind, w.x, w.z, p.ry, p.s, (x, z) => wild(p.u + x - w.x, p.v + z - w.z));
  }
  const byId = Object.fromEntries(BUILDINGS.map((B) => [B.id, B]));
  for (const [kind, list] of Object.entries(VILLAGE)) for (const [id, lx, lz, dry] of list) {
    const B = byId[id], w = toWorld(B.u, B.v);
    const x = w.x + lx * Math.cos(B.ry) + lz * Math.sin(B.ry), z = w.z - lx * Math.sin(B.ry) + lz * Math.cos(B.ry);
    put(kind, x, z, B.ry + dry, 1, (gx, gz) => village.ground(B.u + gx - w.x, B.v + gz - w.z));
  }
  // one draw (or two, with lit windows) per kind: single pieces merged, repeats instanced
  for (const [kind, list] of items) {
    if (list.length === 1) {
      const it = list[0], m = mergedMesh(kind);
      m.position.set(it.x, it.y, it.z); m.rotation.y = it.ry; m.scale.setScalar(it.s || 1);
      group.add(m);
    } else instanced(group, kind, list, { shadow: true });
  }
  return items;
}
