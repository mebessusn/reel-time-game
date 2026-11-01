// Bicycles (v1.9, art/bikes.blend -> art/bikes.glb -> src/data/bikeMesh.js via scripts/glb-to-js.mjs).
// Four bikes, each made of nodes named <id>_<part>: frame, steer (fork, bars, bell, basket), wheelF, wheelR,
// crank, pedalL, pedalR. buildBike() puts them together so the parts move like a real bike:
//   steer.rotation.y            turns the bars and the front wheel (which hangs off the fork)
//   wheelF/wheelR.rotation.z    spins the wheels (negative = rolling forward)
//   crank.rotation.z            turns the cranks; the pedals counter-rotate so they stay level
// Built facing +X with the wheels on y = 0, at modelling scale (seat about 0.9 high); the caller scales it.
import * as THREE from 'three';
import { BIKE_MATS, BIKE_NODES } from '../data/bikeMesh.js';

export const BIKE_SCALE = 0.68; // the stout anglers ride smallish bikes
/** The saddle in the rider's frame (forward = +z), for the actor. */
export const BIKE_SEAT = { y: 0.92 * BIKE_SCALE, z: -0.2 * BIKE_SCALE };
const lin = (a) => new THREE.Color().setRGB(a[0], a[1], a[2], THREE.LinearSRGBColorSpace);
let mats = null;
const geos = new Map();
function materials() {
  if (mats) return mats;
  mats = BIKE_MATS.map((m) => {
    const color = lin(m.color);
    if (m.metal > 0.5) return new THREE.MeshPhongMaterial({ color, shininess: 90, specular: '#ffffff' });
    if (m.rough < 0.5) return new THREE.MeshPhongMaterial({ color, shininess: 55, specular: '#e8e8f0' });
    return new THREE.MeshLambertMaterial({ color });
  });
  return mats;
}
function meshes(n, shadows) {
  if (!geos.has(n.name)) {
    geos.set(n.name, n.prims.map((p) => {
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(p.pos), 3));
      geo.setAttribute('normal', new THREE.BufferAttribute(new Int8Array(p.nrm), 3, true));
      geo.setIndex(p.idx.length && Math.max(...p.idx) > 65535 ? new THREE.Uint32BufferAttribute(p.idx, 1) : new THREE.Uint16BufferAttribute(p.idx, 1));
      return [geo, p.m];
    }));
  }
  return geos.get(n.name).map(([geo, m]) => { const mesh = new THREE.Mesh(geo, materials()[m]); mesh.castShadow = shadows; return mesh; });
}
const node = (id, part) => BIKE_NODES.find((n) => n.name === `${id}_${part}`);

/** A bike group (facing +X); userData.parts = { steer, wheelF, wheelR, crank, pedalL, pedalR }. */
export function buildBike(id, { shadows = true } = {}) {
  const frame = node(id, 'frame');
  if (!frame) return null;
  const g = new THREE.Group();
  g.name = `bike-${id}`;
  const at = (n, parent) => { const o = new THREE.Group(); o.name = n.name; o.position.set(n.t[0] - parent.t[0], n.t[1] - parent.t[1], n.t[2] - parent.t[2]); for (const m of meshes(n, shadows)) o.add(m); return o; };
  const parts = {};
  const f = at(frame, frame);
  g.add(f);
  const S = node(id, 'steer'), WF = node(id, 'wheelF'), WR = node(id, 'wheelR'), C = node(id, 'crank');
  parts.steer = at(S, frame); g.add(parts.steer);
  parts.wheelF = at(WF, S); parts.steer.add(parts.wheelF); // the front wheel turns with the fork
  parts.wheelR = at(WR, frame); g.add(parts.wheelR);
  parts.crank = at(C, frame); g.add(parts.crank);
  for (const side of ['pedalL', 'pedalR']) { parts[side] = at(node(id, side), C); parts.crank.add(parts[side]); }
  g.userData.parts = parts;
  g.userData.wheelR = 0.34; // modelling units
  return g;
}

/**
 * Pose a bike: steer (radians, + = left), wheel (radians rolled), crank (radians). Pedals stay level.
 */
export function poseBike(bike, steer, wheel, crank) {
  const p = bike?.userData.parts;
  if (!p) return;
  p.steer.rotation.y = steer;
  p.wheelF.rotation.z = -wheel; p.wheelR.rotation.z = -wheel;
  p.crank.rotation.z = -crank;
  p.pedalL.rotation.z = crank; p.pedalR.rotation.z = crank;
}

/**
 * v1.13.11: where a pet can ride on this bike: inside the front wicker basket (it turns with the bars) or the crate on
 * the back. Returns { obj, pos } with pos in obj's own frame (bike modelling units, forward = +X), or null for a bike
 * with neither. Found from the basket's own mesh, so it follows the model if the basket moves.
 */
export function basketSpot(bike) {
  if (!bike) return null;
  if (bike.userData.basket !== undefined) return bike.userData.basket;
  const M = materials(), want = [BIKE_MATS.findIndex((m) => m.name === 'wicker'), BIKE_MATS.findIndex((m) => m.name === 'crate')].map((i) => M[i]).filter(Boolean);
  let spot = null;
  bike.traverse((o) => {
    if (spot || !o.isMesh || !want.includes(o.material)) return;
    if (!o.geometry.boundingBox) o.geometry.computeBoundingBox();
    const bb = o.geometry.boundingBox, c = bb.getCenter(new THREE.Vector3());
    // sit low in the basket: a little above its floor, so the pet's head and shoulders show over the rim
    spot = { obj: o.parent, pos: new THREE.Vector3(c.x, bb.min.y + (bb.max.y - bb.min.y) * 0.35, c.z), size: bb.getSize(new THREE.Vector3()) };
  });
  bike.userData.basket = spot;
  return spot;
}
