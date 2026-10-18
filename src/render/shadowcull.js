// v1.13.19: small things cast shadows only near you. Critters, locals' bits, lanterns, chairs and other small props
// further than NEAR from the player stop casting (their shadows are a few pixels by then); big merged scenery (tree,
// bush and boulder tiles, buildings) always casts. Checked a couple of times a second; switching castShadow costs
// nothing (it only decides what goes into the shadow pass).
import * as THREE from 'three';

const NEAR = 18, SMALL = 1.6; // metres: distance, and the bounding radius under which a mesh counts as small
const was = new WeakMap(); // mesh -> did it cast before we touched it
const v = new THREE.Vector3();
let t = 0;

export function updateShadowCasters(dt, scene, focus, keep = null) {
  t -= dt;
  if (t > 0) return;
  t = 0.4;
  scene.traverse((o) => {
    if (!o.isMesh) return;
    let orig = was.get(o);
    if (orig === undefined) { orig = o.castShadow; was.set(o, orig); }
    if (!orig) return;
    if (keep && keep(o)) { o.castShadow = true; return; }
    const g = o.geometry;
    if (!g.boundingSphere) g.computeBoundingSphere();
    const s = o.matrixWorld.elements, scale = Math.hypot(s[0], s[1], s[2]);
    if (g.boundingSphere.radius * scale > SMALL) { o.castShadow = true; return; }
    v.copy(g.boundingSphere.center).applyMatrix4(o.matrixWorld);
    o.castShadow = Math.hypot(v.x - focus.x, v.z - focus.z) < NEAR;
  });
}
