// Hand-modelled voxel assets (Blender hero models, see scripts/gen-models.mjs) as VoxelGrids.
import { VoxelGrid } from '../render/voxel.js';
import { MODELS } from '../data/models.js';

const cache = new Map();

export function hasModel(name) { return !!MODELS[name]; }

/** @returns {{ grid: VoxelGrid, min: number[], max: number[], size: number[], s: number } | null} */
export function modelGrid(name) {
  if (cache.has(name)) return cache.get(name);
  const m = MODELS[name];
  if (!m) return null;
  const grid = new VoxelGrid();
  const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < m.v.length; i += 4) {
    const x = m.v[i], y = m.v[i + 1], z = m.v[i + 2];
    grid.set(x, y, z, m.pal[m.v[i + 3]]);
    if (x < min[0]) min[0] = x; if (y < min[1]) min[1] = y; if (z < min[2]) min[2] = z;
    if (x > max[0]) max[0] = x; if (y > max[1]) max[1] = y; if (z > max[2]) max[2] = z;
  }
  const out = { grid, min, max, size: [0, 1, 2].map((a) => max[a] - min[a] + 1), s: m.s };
  cache.set(name, out);
  return out;
}

// A fresh copy, for recolouring (Gold / Diamond) without touching the cached original.
export function cloneGrid(grid) {
  const g = new VoxelGrid();
  for (const v of grid.map.values()) g.set(v.x, v.y, v.z, v.color);
  return g;
}
