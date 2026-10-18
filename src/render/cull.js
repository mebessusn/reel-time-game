// Distance culling for the big merged props (v1.8: the valley is 4x the area). A merged mesh (all the
// trees, all the bushes...) is split into map tiles by triangle centre; each tile is its own mesh sharing
// the material, so the GPU skips tiles outside the view (frustum culling) and the culler hides tiles past
// the fog. How far you see follows the graphics quality.
import * as THREE from 'three';

const tiles = [];
const RANGE = { low: 105, medium: 150, high: 215 };

/** Split `mesh` into tiles of `size` world units. Returns a Group (same name) holding the tile meshes. */
export function splitByTiles(mesh, size = 48, { range = null } = {}) { // range: drawn only this close (small dressing, v1.13.19)
  const src = mesh.geometry.index ? mesh.geometry.toNonIndexed() : mesh.geometry;
  mesh.updateMatrixWorld(true);
  const pos = src.attributes.position, nTri = pos.count / 3;
  const buckets = new Map();
  const v = new THREE.Vector3();
  for (let t = 0; t < nTri; t++) {
    let cx = 0, cz = 0;
    for (let k = 0; k < 3; k++) { v.fromBufferAttribute(pos, t * 3 + k).applyMatrix4(mesh.matrixWorld); cx += v.x; cz += v.z; }
    const key = `${Math.floor(cx / 3 / size)},${Math.floor(cz / 3 / size)}`;
    let b = buckets.get(key);
    if (!b) buckets.set(key, (b = []));
    b.push(t);
  }
  const group = new THREE.Group();
  group.name = mesh.name;
  group.position.copy(mesh.position); group.quaternion.copy(mesh.quaternion); group.scale.copy(mesh.scale);
  for (const list of buckets.values()) {
    const g = new THREE.BufferGeometry();
    for (const [name, attr] of Object.entries(src.attributes)) {
      const k = attr.itemSize, arr = new attr.array.constructor(list.length * 3 * k);
      let o = 0;
      for (const t of list) for (let j = 0; j < 3; j++) { const i = (t * 3 + j) * k; for (let q = 0; q < k; q++) arr[o++] = attr.array[i + q]; }
      g.setAttribute(name, new THREE.BufferAttribute(arr, k, attr.normalized));
    }
    g.computeBoundingSphere();
    const m = new THREE.Mesh(g, mesh.material);
    if (range) m.userData.range = range;
    m.name = mesh.name; m.castShadow = mesh.castShadow; m.receiveShadow = mesh.receiveShadow; m.renderOrder = mesh.renderOrder;
    group.add(m);
    tiles.push(m);
  }
  if (src !== mesh.geometry) src.dispose();
  mesh.geometry.dispose();
  return group;
}

// v1.13.21: far culling for the valley's separate set pieces. Lily pads, campers, the drowned mill, fire pits, waystones,
// the shipwreck and Gus were drawn from anywhere on the map, long past the fog (a view across the valley drew 800 things).
// They're static, so each one's bounds are measured once; past the view range (plus their own size) they're moved to a
// layer the camera doesn't draw. Layers, not .visible, so the systems that show and hide them (night fires, events)
// are untouched; lights inside are left alone (a light hidden by layer would change the shaders' light count).
const FAR_NAMES = new Set(['fire', 'drowned-mill', 'bog-crown', 'drowned-digger', 'shipwreck', 'gus']);
const isFar = (n) => FAR_NAMES.has(n) || n.startsWith('waystone-');
const FAR_EACH = new Set(['lilypads', 'fern-campers']); // groups whose children are spread out: each child on its own
const FAR_LAYER = 31;
const far = new Map(); // object -> { c: centre, r: radius, hidden }
let farScanT = 0;
const box = new THREE.Box3(), sph = new THREE.Sphere();

function scanFar(scene) {
  const add = (o) => { if (!far.has(o)) far.set(o, null); };
  for (const top of scene.children) {
    if (isFar(top.name)) add(top);
    else if (FAR_EACH.has(top.name)) top.children.forEach(add);
  }
  for (const o of far.keys()) if (!o.parent) far.delete(o); // removed from the world
}

function setFarHidden(o, hide) {
  o.traverse((m) => { if (m.isLight) return; if (hide) m.layers.set(FAR_LAYER); else m.layers.set(0); });
}

/** Hide tiles beyond the view range (call a few times a second). scene (optional) enables far culling of set pieces. */
export function updateCulling(cam, quality = 'medium', scene = null) {
  const R = RANGE[quality] || RANGE.medium;
  if (scene) {
    if ((farScanT -= 1) <= 0) { farScanT = 8; scanFar(scene); } // about every 2 s at the usual 4 calls a second
    for (const [o, b] of far) {
      let info = b;
      if (!info) { o.updateWorldMatrix(true, true); box.setFromObject(o); if (box.isEmpty()) continue; box.getBoundingSphere(sph); info = { c: sph.center.clone(), r: sph.radius, hidden: false }; far.set(o, info); }
      const hide = info.c.distanceTo(cam) - info.r > R;
      if (hide !== info.hidden) { info.hidden = hide; setFarHidden(o, hide); }
    }
  }
  const c = new THREE.Vector3();
  for (const m of tiles) {
    if (!m.geometry.boundingSphere) continue;
    c.copy(m.geometry.boundingSphere.center).applyMatrix4(m.matrixWorld);
    const lim = m.userData.range ? Math.min(R, m.userData.range) : R;
    m.visible = c.distanceTo(cam) - m.geometry.boundingSphere.radius < lim;
  }
}
