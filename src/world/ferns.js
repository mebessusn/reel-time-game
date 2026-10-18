// A proper fern (v1.9.4): a clump of arching fronds, each a curved stem lined with tapering leaflets
// (pinnae) that shrink toward the tip, shaded dark at the heart to bright green at the tips. One geometry,
// drawn as an InstancedMesh wherever the dressing plants a fern. Gently swayed in the vertex shader.
import * as THREE from 'three';

/** Build the fern geometry (about 1.6 across at scale 1, 0.75 tall). */
export function fernGeometry({ fronds = 9, segs = 11, seed = 7 } = {}) {
  let s = seed;
  const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  const pos = [], col = [], idx = [];
  const dark = new THREE.Color('#2f5a22'), mid = new THREE.Color('#4f8f34'), tip = new THREE.Color('#8cc65a');
  const push = (p, c) => { pos.push(p.x, p.y, p.z); col.push(c.r, c.g, c.b); return pos.length / 3 - 1; };
  const c = new THREE.Color();
  for (let f = 0; f < fronds; f++) {
    const a = (f / fronds) * Math.PI * 2 + rnd() * 0.4;
    const len = 0.75 + rnd() * 0.3, rise = 0.42 + rnd() * 0.25, droop = 0.35 + rnd() * 0.15;
    const dir = new THREE.Vector3(Math.cos(a), 0, Math.sin(a)), side = new THREE.Vector3(-Math.sin(a), 0, Math.cos(a));
    // the stem: up and out, then arching over and down toward the tip
    const at = (t) => new THREE.Vector3(dir.x * len * t, rise * Math.sin(t * Math.PI * 0.62) - droop * t * t * t, dir.z * len * t);
    for (let i = 0; i < segs; i++) {
      const t0 = (i + 0.35) / segs, t1 = (i + 1) / segs;
      const p0 = at(t0), p1 = at(t1);
      const along = p1.clone().sub(p0).normalize();
      const w = 0.2 * (1 - t0) ** 0.8 + 0.035; // leaflets taper toward the tip
      c.copy(dark).lerp(mid, Math.min(1, t0 * 1.6)).lerp(tip, Math.max(0, t0 - 0.45));
      for (const sd of [1, -1]) {
        // a narrow leaflet: base on the stem, swept forward, its tip drooping a little
        const base0 = p0, base1 = p0.clone().addScaledVector(along, (p1.distanceTo(p0)) * 0.9);
        const out = side.clone().multiplyScalar(sd * w).addScaledVector(along, w * 0.35);
        out.y -= w * 0.28;
        const tipP = base0.clone().lerp(base1, 0.5).add(out);
        const a0 = push(base0, c), a1 = push(base1, c), a2 = push(tipP, c.clone().lerp(tip, 0.25));
        idx.push(a0, a1, a2);
      }
      // the stem itself, a thin ribbon
      const r0 = push(p0.clone().addScaledVector(side, 0.012), dark), r1 = push(p0.clone().addScaledVector(side, -0.012), dark);
      const r2 = push(p1.clone().addScaledVector(side, -0.01), mid), r3 = push(p1.clone().addScaledVector(side, 0.01), mid);
      idx.push(r0, r1, r2, r0, r2, r3);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  return geo;
}

/** An InstancedMesh of ferns at [{ x, y, z, ry, s }]. */
export function buildFerns(spots) {
  const mat = new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide });
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uT = { value: 0 };
    mat.userData.shader = sh;
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nuniform float uT;')
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        {
          vec3 wp0 = vec3(instanceMatrix[3][0], 0.0, instanceMatrix[3][2]);
          float k = clamp(length(position.xz) / 1.0, 0.0, 1.0);
          float ph = wp0.x * 0.41 + wp0.z * 0.27;
          transformed.x += sin(uT * 1.7 + ph) * 0.05 * k * k;
          transformed.z += cos(uT * 1.3 + ph * 1.3) * 0.04 * k * k;
          transformed.y += sin(uT * 2.1 + ph + position.x * 3.0) * 0.015 * k;
        }`);
  };
  const mesh = new THREE.InstancedMesh(fernGeometry(), mat, Math.max(1, spots.length));
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), v = new THREE.Vector3(), sc = new THREE.Vector3();
  spots.forEach((p, i) => { q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), p.ry); sc.setScalar(p.s); mesh.setMatrixAt(i, m.compose(v.set(p.x, p.y, p.z), q, sc)); });
  mesh.count = spots.length;
  mesh.castShadow = true; mesh.receiveShadow = true;
  mesh.name = 'ferns';
  mesh.onBeforeRender = () => { if (mat.userData.shader) mat.userData.shader.uniforms.uT.value = performance.now() / 1000; };
  return mesh;
}
