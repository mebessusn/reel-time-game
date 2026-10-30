// Compact mesh data (v1.15.13). The Blender meshes ship as JS modules (scripts/glb-to-js.mjs, no binary files), and as
// plain decimal arrays they made up most of the artifact page. Packed, each prim's numbers are text: positions in
// 1/1000 units as deltas from the vertex before, normals as 8-bit values, indices as deltas, every number a
// zigzag varint in a 64-letter alphabet (5 bits a letter, the 6th says "more follows"). Unpacking at load gives back
// exactly the arrays the module used to hold, so nothing that reads the meshes changes.
const A = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
const V = new Int16Array(128).fill(-1);
for (let i = 0; i < 64; i++) V[A.charCodeAt(i)] = i;

function put(out, n) { // n: a non-negative integer
  do { let d = n & 31; n = Math.floor(n / 32); if (n > 0) d |= 32; out.push(A[d]); } while (n > 0);
}
const zz = (v) => (v < 0 ? -2 * v - 1 : 2 * v);
const unzz = (u) => (u & 1 ? -(u + 1) / 2 : u / 2);

/** Pure: encode a list of integers. `stride` > 0: each number is stored as the difference from the one `stride` back. */
export function packInts(list, stride = 0) {
  const out = [];
  for (let k = 0; k < list.length; k++) put(out, zz(list[k] - (stride && k >= stride ? list[k - stride] : 0)));
  return out.join('');
}
/** Pure: decode packInts' text back to the integers. */
export function unpackInts(str, stride = 0) {
  const out = [];
  let n = 0, mul = 1;
  for (let i = 0; i < str.length; i++) {
    const d = V[str.charCodeAt(i)];
    n += (d & 31) * mul;
    if (d & 32) { mul *= 32; continue; }
    const k = out.length;
    out.push(unzz(n) + (stride && k >= stride ? out[k - stride] : 0));
    n = 0; mul = 1;
  }
  return out;
}

/** Pure: a glb-to-js NODES list, packed: prims become { m, P, N?, I, C? } (positions, normals, indices, vertex colours as text). */
export function packNodes(nodes) {
  return nodes.map((n) => ({ ...n, prims: n.prims.map((p) => {
    const q = { m: p.m, P: packInts(p.pos.map((v) => Math.round(v * 1000)), 3), I: packInts(p.idx, 1) };
    if (p.nrm) q.N = packInts(p.nrm);
    if (p.col) q.C = packInts(p.col, 3); // v1.17.1: per-vertex colour (sRGB 0..255), Polyfork models
    return q;
  }) }));
}
/** Pure: packNodes' output back to the plain NODES list. */
export function unpackNodes(nodes) {
  return nodes.map((n) => ({ ...n, prims: n.prims.map((q) => {
    const p = { m: q.m, pos: unpackInts(q.P, 3).map((v) => v / 1000) };
    if (q.N) p.nrm = unpackInts(q.N);
    p.idx = unpackInts(q.I, 1);
    if (q.C) p.col = unpackInts(q.C, 3);
    return p;
  }) }));
}
