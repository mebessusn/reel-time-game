// v1.17.1, the Polyfork campground batch (models from Polyfork's Campground & Lake and Nature & Forest kits; see
// src/world/polyfork.js). Two new places, each in its own clearing (CLEARINGS.ranger / CLEARINGS.aframe in terrain.js):
//   Ranger Station: below the Ridge Lookout fire tower, with a trail map, a signpost, a woodshed and an outhouse.
//   Frostpine A-Frame: an A-frame cabin up the bank from Frostpine Lake's north shore, with a well, a fire pit and
//   chairs looking out over the water, and a canoe and a rowboat pulled up on the beach.
// (The campground's tents, tables and camp kit are in campers.js, props.js and wildwoods.js.)
import { CLEARINGS } from './terrain.js';
import { placeModels, polyforkFoot } from './polyfork.js';

const W = Math.PI / 2;
// model, offset from the clearing's middle, yaw (0 = front toward +z; a chair's seat faces +z), and any options
const RANGER = [
  ['hip-roof-ranger-station', 0, 0, -W], // (front toward the tower, west)
  ['trail-map-kiosk', -6, 3.6, -W], ['trail-signpost', -6, -4.2, 0.4], ['birdhouse-post', -3.4, -6.6, 0.3],
  ['heavy-timber-picnic-table', -1.5, 7, 0.1], ['open-woodshed', 4.2, -5.6, Math.PI], ['cordwood-pile', 4.1, -5.6, Math.PI, { solid: false, sink: 0 }],
  ['forest-outhouse', 5, 5.6, Math.PI],
];
const AFRAME = [
  ['a-frame-cabin', 0, 0, Math.PI], // (its deck toward the lake, north)
  ['stone-well', 4.6, 2.5, 0.5], ['cordwood-pile', -2.9, 1.6, W], ['forest-outhouse', -4.6, 6, Math.PI], ['birdhouse-post', 4.8, -3.2, 0],
  ['stone-fire-pit', 0, -6.2, 0], ['folding-camp-chair', -1.5, -5.1, 2.2], ['folding-camp-chair', 1.5, -5.1, -2.2], ['folding-camp-chair', -0.1, -7.6, 0.07],
  ['camp-canoe', 4.5, -11, 2.8], ['wooden-rowboat', -4, -11.2, -2.9],
];

/** Inside one of these pieces (or `pad` from it): trees, ferns and grass keep off (campers.js camperAt asks this). */
let keep = null;
export function campgroundAt(x, z, pad = 0) {
  keep ??= [['ranger', RANGER], ['aframe', AFRAME]].flatMap(([name, list]) => list.map(([m, dx, dz]) => {
    const f = polyforkFoot(m);
    return { x: CLEARINGS[name].x + dx, z: CLEARINGS[name].z + dz, r: Math.hypot(f.x1 - f.x0, f.z1 - f.z0) / 2 + 0.3 };
  }));
  for (const c of keep) { const dx = x - c.x, dz = z - c.z, rr = c.r + pad; if (dx * dx + dz * dz < rr * rr) return true; }
  return false;
}

export function buildCampground(scene) {
  const out = {};
  for (const [name, list] of [['ranger', RANGER], ['aframe', AFRAME]]) {
    const C = CLEARINGS[name];
    out[name] = placeModels(`polyfork-${name}`, list.map(([m, dx, dz, ry, o]) => ({ m, x: C.x + dx, z: C.z + dz, ry, ...o })));
    scene.add(out[name]);
  }
  return out;
}
