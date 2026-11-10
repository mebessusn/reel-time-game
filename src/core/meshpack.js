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
/** How many numbers packInts' text holds (each ends on a letter without the "more follows" bit). */
function countInts(str) { let n = 0; for (let i = 0; i < str.length; i++) if (!(V[str.charCodeAt(i)] & 32)) n++; return n; }
/** Pure: unpackInts straight into a typed array (`out`, sized by countInts), each number times `scale`. */
function unpackInto(str, stride, out, scale = 1) {
  let n = 0, mul = 1, k = 0;
  for (let i = 0; i < str.length; i++) {
    const d = V[str.charCodeAt(i)];
    n += (d & 31) * mul;
    if (d & 32) { mul *= 32; continue; }
    out[k] = unzz(n) * scale + (stride && k >= stride ? out[k - stride] : 0);
    k++; n = 0; mul = 1;
  }
  return out;
}
/** One packed prim as typed arrays: pos Float32, nrm Int8, idx Uint16 (or Uint32 past 65535), col Uint8. */
function unpackPrimTyped(q) {
  // positions: integer millimetres (deltas summed exactly in a Float64 scratch), then metres in Float32
  const mm = unpackInto(q.P, 3, new Float64Array(countInts(q.P))), pos = new Float32Array(mm.length);
  for (let i = 0; i < mm.length; i++) pos[i] = mm[i] / 1000;
  const p = { m: q.m, pos };
  if (q.N) p.nrm = unpackInto(q.N, 0, new Int8Array(countInts(q.N)));
  const ix = unpackInto(q.I, 1, new Uint32Array(countInts(q.I)));
  let max = 0; for (let i = 0; i < ix.length; i++) if (ix[i] > max) max = ix[i];
  p.idx = max > 65535 ? ix : Uint16Array.from(ix);
  if (q.C) p.col = unpackInto(q.C, 3, new Uint8Array(countInts(q.C)));
  return p;
}
const unpackPrimPlain = (q) => {
  const p = { m: q.m, pos: unpackInts(q.P, 3).map((v) => v / 1000) };
  if (q.N) p.nrm = unpackInts(q.N);
  p.idx = unpackInts(q.I, 1);
  if (q.C) p.col = unpackInts(q.C, 3);
  return p;
};
/**
 * packNodes' output back to the NODES list. Mobile branch (Nov 7 2026): a node's prims are decoded the first time
 * something reads them, into typed arrays, so a model that's never built (a map you haven't visited) costs nothing
 * but its text, and one that is costs a quarter of what plain number arrays did (the phone heap was ~700 MB).
 * Everything that builds meshes copies these into BufferAttributes, so typed arrays read the same; setIndex wants a
 * BufferAttribute for a typed array (indexAttr below). `{ plain: true }` gives the old eager plain arrays (the tools in
 * scripts/ and the round-trip test).
 */
export function unpackNodes(nodes, { plain = false } = {}) {
  if (plain) return nodes.map((n) => ({ ...n, prims: n.prims.map(unpackPrimPlain) }));
  return nodes.map((n) => {
    const packed = n.prims, out = { ...n };
    let prims = null;
    Object.defineProperty(out, 'prims', { enumerable: true, configurable: true,
      get: () => (prims ||= packed.map(unpackPrimTyped)), set: (v) => { prims = v; } });
    return out;
  });
}
/** An index array (plain or typed) as the BufferAttribute geometry.setIndex() wants. */
export function indexAttr(idx, BA) {
  if (idx instanceof Uint32Array || idx instanceof Uint16Array) return new BA(idx, 1);
  let max = 0; for (let i = 0; i < idx.length; i++) if (idx[i] > max) max = idx[i];
  return new BA(max > 65535 ? Uint32Array.from(idx) : Uint16Array.from(idx), 1);
}
/** Nodes (typed or plain) as plain number arrays, positions to the millimetre: for comparing in tools and tests. */
export function plainNodes(nodes) {
  return nodes.map((n) => ({ ...n, prims: n.prims.map((p) => Object.fromEntries(Object.entries(p).map(([k, v]) => [k, k === 'm' || v == null ? v : Array.from(v, (x) => (k === 'pos' ? Math.round(x * 1000) / 1000 : x))]))) }));
}
