// Voxel model builder: a sparse grid of colored cubes -> one merged, face-culled BufferGeometry.
import * as THREE from 'three';

const FACES = [
  { dir: [1, 0, 0], shade: 0.86, corners: [[1, 0, 0], [1, 1, 0], [1, 1, 1], [1, 0, 1]] },
  { dir: [-1, 0, 0], shade: 0.8, corners: [[0, 0, 1], [0, 1, 1], [0, 1, 0], [0, 0, 0]] },
  { dir: [0, 1, 0], shade: 1.0, corners: [[0, 1, 1], [1, 1, 1], [1, 1, 0], [0, 1, 0]] },
  { dir: [0, -1, 0], shade: 0.6, corners: [[0, 0, 0], [1, 0, 0], [1, 0, 1], [0, 0, 1]] },
  { dir: [0, 0, 1], shade: 0.92, corners: [[1, 0, 1], [1, 1, 1], [0, 1, 1], [0, 0, 1]] },
  { dir: [0, 0, -1], shade: 0.74, corners: [[0, 0, 0], [0, 1, 0], [1, 1, 0], [1, 0, 0]] },
];

const tmp = new THREE.Color();

export class VoxelGrid {
  constructor() { this.map = new Map(); }
  key(x, y, z) { return `${x},${y},${z}`; }
  set(x, y, z, color) {
    if (color == null) { this.map.delete(this.key(x, y, z)); return; }
    this.map.set(this.key(x, y, z), { x, y, z, color });
  }
  get(x, y, z) { return this.map.get(this.key(x, y, z)); }
  has(x, y, z) { return this.map.has(this.key(x, y, z)); }
  box(x0, y0, z0, x1, y1, z1, color) {
    for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) for (let z = z0; z <= z1; z++) this.set(x, y, z, typeof color === 'function' ? color(x, y, z) : color);
  }
  get size() { return this.map.size; }
}

// Deterministic per-voxel jitter so flat colors read as pixel texture.
function jitter(x, y, z) {
  let h = (x * 374761393 + y * 668265263 + z * 2147483647) >>> 0;
  h = (h ^ (h >>> 13)) * 1274126177 >>> 0;
  return ((h & 255) / 255 - 0.5);
}

/**
 * @param {VoxelGrid} grid
 * @param {object} opts scale (world units per voxel), center [cx,cy,cz] in voxel units, noise amount, shade (bake face shading)
 */
export function buildVoxelGeometry(grid, opts = {}) {
  const scale = opts.scale ?? 1;
  const noise = opts.noise ?? 0.06;
  const bake = opts.shade ?? true;
  const [cx, cy, cz] = opts.center ?? [0, 0, 0];
  const pos = [], nor = [], col = [], idx = [];
  let v = 0;
  for (const vox of grid.map.values()) {
    const { x, y, z } = vox;
    tmp.set(vox.color);
    const j = 1 + jitter(x, y, z) * noise * 2;
    for (const f of FACES) {
      if (grid.has(x + f.dir[0], y + f.dir[1], z + f.dir[2])) continue;
      const s = (bake ? f.shade : 1) * j;
      for (const c of f.corners) {
        pos.push((x + c[0] - cx) * scale, (y + c[1] - cy) * scale, (z + c[2] - cz) * scale);
        nor.push(f.dir[0], f.dir[1], f.dir[2]);
        col.push(Math.min(1, tmp.r * s), Math.min(1, tmp.g * s), Math.min(1, tmp.b * s));
      }
      idx.push(v, v + 1, v + 2, v, v + 2, v + 3);
      v += 4;
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setIndex(idx);
  g.computeBoundingSphere();
  return g;
}

export const voxelMaterial = new THREE.MeshLambertMaterial({ vertexColors: true });
export const voxelGlowMaterial = new THREE.MeshBasicMaterial({ vertexColors: true });

export function voxelMesh(grid, opts = {}) {
  const mesh = new THREE.Mesh(buildVoxelGeometry(grid, opts), opts.material || voxelMaterial);
  mesh.castShadow = opts.castShadow ?? true;
  mesh.receiveShadow = opts.receiveShadow ?? !opts.noReceive;
  return mesh;
}

// Lighten/darken a hex color.
export function shadeHex(hex, amt) {
  const c = new THREE.Color(hex);
  if (amt > 0) c.lerp(new THREE.Color('#ffffff'), amt);
  else c.lerp(new THREE.Color('#000000'), -amt);
  return '#' + c.getHexString();
}
