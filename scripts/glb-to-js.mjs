// Turn a (flat, untextured) GLB into a plain JS module of arrays, so the artifact page embeds no binary
// files. Positions are kept to 1/1000 unit, normals are packed to 8-bit. Used for Gus (art/gus.blend):
//   node scripts/glb-to-js.mjs art/gus.glb src/data/gusMesh.js GUS
//   node scripts/glb-to-js.mjs art/nature.glb src/data/natureMesh.js NATURE --no-normals
//   node scripts/polyfork-meshes.mjs   (every art/polyfork/*.glb into src/data/polyforkMesh.js, see that script)
import fs from 'node:fs';

const [, , src, dst, prefix = 'MODEL', ...flags] = process.argv;
const NO_NORMALS = flags.includes('--no-normals'); // flat-shaded models: the game recomputes face normals (art/nature.glb)
// --names=3f4d55:pane,... names the material made for a vertex colour (sRGB hex), for Polyfork models; a key
// `model/hex` (the model's root name) applies to that model only
const NAMES = Object.fromEntries((flags.find((f) => f.startsWith('--names=')) || '--names=').slice(8).split(',').filter(Boolean).map((p) => p.split(':')));
// `src` may list several .glb files, comma-separated (Polyfork models, one per file): their roots go into one module
const SRCS = src.split(',');
let j, bin;
function load(file) {
  const glb = fs.readFileSync(file);
  const jsonLen = glb.readUInt32LE(12);
  j = JSON.parse(glb.subarray(20, 20 + jsonLen).toString('utf8'));
  const binStart = 20 + jsonLen + 8;
  bin = glb.subarray(binStart, binStart + glb.readUInt32LE(20 + jsonLen));
}
load(SRCS[0]);
const SIZE = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4 };
const GET = { 5120: 'getInt8', 5121: 'getUint8', 5122: 'getInt16', 5123: 'getUint16', 5125: 'getUint32', 5126: 'getFloat32' };
const BYTES = { 5120: 1, 5121: 1, 5122: 2, 5123: 2, 5125: 4, 5126: 4 };
function read(i) {
  const a = j.accessors[i], bv = j.bufferViews[a.bufferView], k = SIZE[a.type], el = BYTES[a.componentType];
  const off = bin.byteOffset + (bv.byteOffset || 0) + (a.byteOffset || 0), stride = bv.byteStride || el * k;
  const dv = new DataView(bin.buffer), fn = GET[a.componentType], out = new Array(a.count * k);
  for (let c = 0; c < a.count; c++) for (let q = 0; q < k; q++) out[c * k + q] = dv[fn](off + c * stride + q * el, true);
  return out;
}
const r3 = (v) => Math.round(v * 1000) / 1000;
const mats = j.materials.map((m) => {
  const p = m.pbrMetallicRoughness || {};
  return { name: m.name, color: (p.baseColorFactor || [1, 1, 1, 1]).slice(0, 3).map(r3), metal: r3(p.metallicFactor ?? 1), rough: r3(p.roughnessFactor ?? 1), emissive: (m.emissiveFactor || [0, 0, 0]).map(r3) };
});
const roots = j.scenes[j.scene || 0].nodes;
const nodes = SRCS.length === 1 && roots.every((ni) => j.nodes[ni].mesh != null) ? roots.map((ni) => {
  const n = j.nodes[ni];
  return {
    name: n.name, t: (n.translation || [0, 0, 0]).map(r3), r: (n.rotation || [0, 0, 0, 1]).map((v) => Math.round(v * 1e5) / 1e5), s: (n.scale || [1, 1, 1]).map(r3),
    prims: j.meshes[n.mesh].primitives.map((p) => ({
      m: p.material,
      pos: read(p.attributes.POSITION).map(r3),
      nrm: NO_NORMALS ? undefined : read(p.attributes.NORMAL).map((v) => Math.round(Math.max(-1, Math.min(1, v)) * 127)), // Int8, normalized
      idx: p.indices != null ? read(p.indices) : read(p.attributes.POSITION).filter((_, i) => i % 3 === 0).map((_, i) => i),
    })),
  };
}) : SRCS.flatMap((f) => { load(f); return j.scenes[j.scene || 0].nodes.map(flatten); });

// v1.17.1: Polyfork models (art/polyfork/) come as one root group with nested parts (a door on its hinge) and
// colour per vertex (COLOR_0) on a single material. Each root becomes one node: every mesh under it moved into the
// root's space, with its colours kept per vertex (`col`, sRGB 0..255) on one "vertex" material. A triangle whose
// colour is named in --names (e.g. the window glass "pane", so it can glow at night) goes in its own prim instead.
function trs(n) { // column-major 4x4 from a node's translation / rotation / scale (or its matrix)
  if (n.matrix) return n.matrix;
  const [x, y, z, w] = n.rotation || [0, 0, 0, 1], [sx, sy, sz] = n.scale || [1, 1, 1], [tx, ty, tz] = n.translation || [0, 0, 0];
  return [(1 - 2 * (y * y + z * z)) * sx, 2 * (x * y + z * w) * sx, 2 * (x * z - y * w) * sx, 0,
    2 * (x * y - z * w) * sy, (1 - 2 * (x * x + z * z)) * sy, 2 * (y * z + x * w) * sy, 0,
    2 * (x * z + y * w) * sz, 2 * (y * z - x * w) * sz, (1 - 2 * (x * x + y * y)) * sz, 0, tx, ty, tz, 1];
}
function mul(a, b) {
  const o = new Array(16).fill(0);
  for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) for (let k = 0; k < 4; k++) o[c * 4 + r] += a[k * 4 + r] * b[c * 4 + k];
  return o;
}
function flatten(ri) {
  const toSrgb = (u) => Math.round(255 * (u <= 0.0031308 ? u * 12.92 : 1.055 * u ** (1 / 2.4) - 0.055));
  const hexOf = (c) => c.map((u) => toSrgb(u).toString(16).padStart(2, '0')).join('');
  const groups = new Map(); // 'vertex' or a named colour -> { pos, nrm, col }
  const walk = (ni, m) => {
    const n = j.nodes[ni];
    if (n.mesh != null) for (const p of j.meshes[n.mesh].primitives) {
      const P = read(p.attributes.POSITION), N = read(p.attributes.NORMAL), C = p.attributes.COLOR_0 != null ? read(p.attributes.COLOR_0) : null;
      const I = p.indices != null ? read(p.indices) : P.filter((_, i) => i % 3 === 0).map((_, i) => i);
      const k = C ? j.accessors[p.attributes.COLOR_0].type === 'VEC4' ? 4 : 3 : 0;
      const base = (j.materials[p.material]?.pbrMetallicRoughness?.baseColorFactor || [1, 1, 1]).slice(0, 3);
      const colOf = (i) => (C ? [C[i * k], C[i * k + 1], C[i * k + 2]] : base);
      for (let t = 0; t < I.length; t += 3) {
        const hex = hexOf(colOf(I[t])), name = NAMES[`${j.nodes[ri].name}/${hex}`] ?? NAMES[hex], key = name || 'vertex';
        if (!groups.has(key)) groups.set(key, { name: key, col0: colOf(I[t]).map(r3), pos: [], nrm: [], col: [] });
        const g = groups.get(key);
        for (let v = 0; v < 3; v++) {
          const i = I[t + v], x = P[i * 3], y = P[i * 3 + 1], z = P[i * 3 + 2];
          g.pos.push(r3(m[0] * x + m[4] * y + m[8] * z + m[12]), r3(m[1] * x + m[5] * y + m[9] * z + m[13]), r3(m[2] * x + m[6] * y + m[10] * z + m[14]));
          const a = N[i * 3], b = N[i * 3 + 1], c = N[i * 3 + 2];
          const nx = m[0] * a + m[4] * b + m[8] * c, ny = m[1] * a + m[5] * b + m[9] * c, nz = m[2] * a + m[6] * b + m[10] * c, l = Math.hypot(nx, ny, nz) || 1;
          g.nrm.push(...[nx, ny, nz].map((u) => Math.round(Math.max(-1, Math.min(1, u / l)) * 127)));
          g.col.push(...colOf(i).map(toSrgb));
        }
      }
    }
    for (const c of n.children || []) walk(c, mul(m, trs(j.nodes[c])));
  };
  walk(ri, [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]); // the root's own transform is left to the game
  const prims = [];
  for (const g of groups.values()) {
    const vertex = g.name === 'vertex', color = vertex ? [1, 1, 1] : g.col0;
    let m = mats.findIndex((x) => x.name === g.name && x.color.join(',') === color.join(','));
    if (m < 0) { m = mats.length; mats.push({ name: g.name, color, metal: 0, rough: 0.85, emissive: [0, 0, 0] }); }
    // share vertices with the same position, colour (and normal, if kept): flat shading recomputes normals per face
    const seen = new Map(), out = { pos: [], nrm: [], col: [], idx: [] };
    for (let v = 0; v < g.pos.length / 3; v++) {
      const key = [g.pos.slice(v * 3, v * 3 + 3), vertex ? g.col.slice(v * 3, v * 3 + 3) : [], NO_NORMALS ? [] : g.nrm.slice(v * 3, v * 3 + 3)].join('|');
      let i = seen.get(key);
      if (i == null) {
        i = out.pos.length / 3; seen.set(key, i);
        out.pos.push(...g.pos.slice(v * 3, v * 3 + 3)); out.nrm.push(...g.nrm.slice(v * 3, v * 3 + 3)); if (vertex) out.col.push(...g.col.slice(v * 3, v * 3 + 3));
      }
      out.idx.push(i);
    }
    prims.push({ m, pos: out.pos, nrm: NO_NORMALS ? undefined : out.nrm, idx: out.idx, ...(vertex ? { col: out.col } : {}) });
  }
  return { name: j.nodes[ri].name, t: [0, 0, 0], r: [0, 0, 0, 1], s: [1, 1, 1], prims };
}
const out = `// Generated by scripts/glb-to-js.mjs from ${src}. Do not edit by hand.\n` +
  `export const ${prefix}_MATS = ${JSON.stringify(mats)};\nexport const ${prefix}_NODES = ${JSON.stringify(nodes)};\n`;
fs.writeFileSync(dst, out);
console.log(`${dst}: ${nodes.length} nodes, ${mats.length} materials, ${(out.length / 1024).toFixed(0)} KB`);
// v1.15.13: and pack it (src/core/meshpack.js): the same arrays as compact text, a third of the size.
await (await import('./pack-meshes.mjs')).packModule(dst);
