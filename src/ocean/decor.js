// Open Waters stage 5: the sea's trophies for the cottage (art/src/oceandecor.py): the marlin bill, the shark jaw, the
// ship in a bottle (the Open Waters collection) and the giant squid in a jar. Glass and jar water are see-through.
import * as THREE from 'three';
import { OCEAN_DECOR_MATS, OCEAN_DECOR_NODES } from '../data/oceanDecorMesh.js';
import { buildNode } from './meshes.js';

const OPTS = {
  ow_glass: (color) => new THREE.MeshPhongMaterial({ color, transparent: true, opacity: 0.26, shininess: 90, specular: '#ffffff', depthWrite: false }),
  ow_jar_water: (color) => new THREE.MeshPhongMaterial({ color, transparent: true, opacity: 0.32, shininess: 40, depthWrite: false }),
};
/** One of the cottage trophies by its DECOR id (ow_bill, ow_jaw, ow_bottle, ow_squid). */
export function buildOceanDecor(id) { return buildNode(OCEAN_DECOR_MATS, OCEAN_DECOR_NODES, `decor_${id}`, { opts: OPTS }); }
