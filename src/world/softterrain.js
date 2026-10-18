// Soft-block terrain: the same block heightmap, but every exposed edge is rounded (quarter-round lips on
// ledges, rounded vertical corners on cliffs) and every face wears a 16 px pixel-art tile (grass with
// blades and flowers, sand with ripples, cobbled stone, dirt with pebbles, lake-bed silt...).
// One BufferGeometry, one tile atlas, vertex colours for soft depth shading.
import * as THREE from 'three';
import { Atlas, Face, tone, hash, atlasTexture } from '../render/soft.js';

const TS = 16; // texels per block face
const R = 0.2; // edge rounding radius (blocks)
const VARIANTS = 4;

// ---------------------------------------------------------------- tiles
const TILE_PAINT = {
  grass: (c = '#7bb661') => (f, s) => f.fill((x, y) => {
    const n = hash(x, y, 101 + s);
    if (n > 0.985) return ['#f8f0a0', '#ffffff', '#f0a0c0'][s % 3]; // tiny flowers
    if ((x + y * 3 + s) % 7 === 0 && n > 0.4) return tone(c, -0.14); // blades
    if (n > 0.86) return tone(c, 0.1);
    return n < 0.12 ? tone(c, -0.07) : c;
  }),
  sand: (c = '#e2d3a0') => (f, s) => f.fill((x, y) => {
    if ((y + Math.floor(x / 4) + s) % 6 === 0 && hash(x, y, 111) > 0.35) return tone(c, -0.07); // ripples
    const n = hash(x, y, 112 + s);
    return n > 0.93 ? tone(c, -0.18) : n > 0.86 ? tone(c, 0.12) : c;
  }),
  stone: (c = '#8a8a86') => (f, s) => f.fill((x, y) => {
    const off = (Math.floor(y / 4) % 2) * 3;
    if (y % 4 === 3 || (x + off + s) % 6 === 5) return tone(c, -0.26);
    const n = hash(Math.floor((x + off) / 6), Math.floor(y / 4), 121 + s);
    return n > 0.7 ? tone(c, 0.08) : n < 0.25 ? tone(c, -0.08) : c;
  }),
  dirt: (c = '#8a5e3a') => (f, s) => f.fill((x, y) => {
    const n = hash(x, y, 131 + s);
    if (n > 0.95) return '#a8a29a'; // pebble
    return n > 0.82 ? tone(c, -0.12) : n < 0.1 ? tone(c, 0.1) : c;
  }),
  snow: (c = '#f0f4f4') => (f, s) => f.fill((x, y) => (hash(x, y, 141 + s) > 0.88 ? '#dce8f0' : c)),
  gravel: (c = '#7a7670') => (f, s) => f.fill((x, y) => { const n = hash(Math.floor(x / 2), Math.floor(y / 2), 151 + s); return n > 0.7 ? tone(c, 0.15) : n < 0.3 ? tone(c, -0.15) : c; }),
};
const TOPS = {
  grass: TILE_PAINT.grass('#7bb661'), grass2: TILE_PAINT.grass('#6aa452'), sand: TILE_PAINT.sand('#e2d3a0'), sand2: TILE_PAINT.sand('#d6c48c'),
  snow: TILE_PAINT.snow(), stone: TILE_PAINT.stone(), dirt: TILE_PAINT.dirt(), bed: TILE_PAINT.sand('#b8a878'), mud: TILE_PAINT.dirt('#6a5a40'),
  gravel: TILE_PAINT.gravel(), deep: TILE_PAINT.gravel('#4a5058'),
};
const lipped = (lip, lipRows, body) => (f, s) => {
  body(f, s);
  const lf = new Face(f.a, f.r); // paint the lip over the top rows with a dripping edge
  for (let x = 0; x < f.w; x++) {
    const rows = lipRows + (hash(x, 0, 161 + s) > 0.6 ? 1 : 0) + (hash(x, 1, 162 + s) > 0.85 ? 1 : 0);
    for (let y = 0; y < rows; y++) lf.px(x, y, y === rows - 1 ? tone(lip, -0.2) : hash(x, y, 163 + s) > 0.8 ? tone(lip, 0.1) : lip);
  }
};
const SIDES = {
  grassSide: lipped('#7bb661', 4, TILE_PAINT.dirt()),
  sandSide: lipped('#e2d3a0', 3, TILE_PAINT.sand('#d6c48c')),
  snowSide: lipped('#f0f4f4', 4, TILE_PAINT.stone()),
  dirt: TILE_PAINT.dirt(), stone: TILE_PAINT.stone(), sand2: TILE_PAINT.sand('#d6c48c'), bed: TILE_PAINT.sand('#b8a878'),
};

function buildTiles() {
  const atlas = new Atlas(256);
  const regions = {};
  for (const [name, paint] of Object.entries({ ...TOPS, ...SIDES })) {
    regions[name] = [];
    for (let v = 0; v < VARIANTS; v++) {
      const r = atlas.alloc(TS, TS);
      const f = new Face(atlas, r);
      paint(f, v);
      f.gutter();
      regions[name].push(r);
    }
  }
  return { atlas, regions };
}

// ---------------------------------------------------------------- mesher
/**
 * @param {{ HALF: number, heightAt: (x:number,z:number)=>number, topKind: (x,z,h)=>string, sideKind: (x,z,b,h)=>string }} T
 */
export function buildSoftTerrain(T) {
  const { atlas, regions } = buildTiles();
  const S = atlas.size;
  let pos = [], nor = [], uv = [], col = [];
  const tileUV = (region, u, v) => [(region.x + Math.min(0.999, Math.max(0.001, u)) * TS) / S, 1 - (region.y + (1 - Math.min(0.999, Math.max(0.001, v))) * TS) / S];
  const pick = (name, x, z, y = 0) => regions[name][Math.floor(hash(x, z, 171 + y) * VARIANTS)];
  const H = T.heightAt;
  const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
  const tmpQ = new THREE.Vector3(), tmpC = new THREE.Vector3();

  // rounded surface point of column (x,z) height h for the raw point q (column-local x,z in [0,1])
  // ex = { w, e, n, s } : heights of the neighbours (rounding applies where the neighbour is below y)
  // Rounding only happens inside the lip band (the top R of a column): ledges get soft lips and
  // convex top corners become spherical, while cliff faces below stay flat so neighbouring
  // columns always share their edges (no cracks).
  function round(qx, qy, qz, h, nb) {
    if (qy <= h - R + 1e-6) return [qx, qy, qz, 0, 1, 0];
    const loX = nb.w < qy ? R : -1e9, hiX = nb.e < qy ? 1 - R : 1e9;
    const loZ = nb.n < qy ? R : -1e9, hiZ = nb.s < qy ? 1 - R : 1e9;
    const cx = clamp(qx, loX, hiX), cz = clamp(qz, loZ, hiZ), cy = Math.min(qy, h - R);
    tmpQ.set(qx - cx, qy - cy, qz - cz);
    const len = tmpQ.length();
    if (len < 1e-6) return [qx, qy, qz, 0, 1, 0];
    tmpQ.divideScalar(len);
    return [cx + tmpQ.x * R, cy + tmpQ.y * R, cz + tmpQ.z * R, tmpQ.x, tmpQ.y, tmpQ.z];
  }
  function arcCoords(lo, hi) { // coordinates with extra samples inside rounded bands
    const out = [0];
    if (lo) out.push(R * 0.5, R);
    if (hi) out.push(1 - R, 1 - R * 0.5);
    out.push(1);
    return [...new Set(out)].sort((a, b) => a - b);
  }
  function pushQuad(a, b, c, d, region, uvs, shade) {
    // a,b,c,d: [x,y,z,nx,ny,nz] around the quad; uvs: [[u,v] x4]. Winding is fixed up to face outward.
    const e1x = c[0] - a[0], e1y = c[1] - a[1], e1z = c[2] - a[2], e2x = d[0] - b[0], e2y = d[1] - b[1], e2z = d[2] - b[2];
    const gx = e1y * e2z - e1z * e2y, gy = e1z * e2x - e1x * e2z, gz = e1x * e2y - e1y * e2x;
    const nx = a[3] + b[3] + c[3] + d[3], ny = a[4] + b[4] + c[4] + d[4], nz = a[5] + b[5] + c[5] + d[5];
    const order = gx * nx + gy * ny + gz * nz >= 0 ? [0, 1, 2, 0, 2, 3] : [0, 2, 1, 0, 3, 2];
    const P = [a, b, c, d];
    for (const o of order) {
      const p = P[o], t = uvs[o], k = shade[o];
      pos.push(p[0], p[1], p[2]); nor.push(p[3], p[4], p[5]);
      const [U, V] = tileUV(region, t[0], t[1]); uv.push(U, V);
      col.push(k, k, k);
    }
  }

  // Chunked so the renderer can frustum-cull the big valley (one shared material).
  const CHUNK = 32;
  const mat = new THREE.MeshLambertMaterial({ map: atlasTexture(atlas), vertexColors: true });
  const group = new THREE.Group();
  group.name = 'terrain';
  group.material = mat;
  for (let cx = -T.HALF; cx < T.HALF; cx += CHUNK) for (let cz = -T.HALF; cz < T.HALF; cz += CHUNK) {
  pos = []; nor = []; uv = []; col = [];
  for (let x = cx; x < Math.min(T.HALF, cx + CHUNK); x++) for (let z = cz; z < Math.min(T.HALF, cz + CHUNK); z++) {
    const h = H(x, z);
    const nb = { w: H(x - 1, z), e: H(x + 1, z), n: H(x, z - 1), s: H(x, z + 1) };
    // Tall rock (mountains, spires) keeps crisp block edges: far fewer vertices where nobody walks.
    const sharp = T.sharp ? T.sharp(x, z, h) : false;
    const rnb = sharp ? { w: h, e: h, n: h, s: h } : nb;
    const colTone = 0.94 + hash(x, z, 181) * 0.1;
    // ---- top cap
    const topName = T.topKind(x, z, h);
    const topReg = pick(topName, x, z);
    const xs = arcCoords(rnb.w < h, rnb.e < h), zs = arcCoords(rnb.n < h, rnb.s < h);
    for (let i = 0; i < xs.length - 1; i++) for (let j = 0; j < zs.length - 1; j++) {
      const P = (u, v) => { const r = round(u, h, v, h, rnb); return [x + r[0], r[1], z + r[2], r[3], r[4], r[5]]; };
      const a = P(xs[i], zs[j + 1]), b = P(xs[i + 1], zs[j + 1]), c = P(xs[i + 1], zs[j]), d = P(xs[i], zs[j]);
      const ab = (p) => [p[0] - x, p[2] - z];
      const k = colTone;
      pushQuad(a, b, c, d, topReg, [ab(a), ab(b), ab(c), ab(d)].map(([u, v]) => [u, 1 - v]), [k, k, k, k]);
    }
    // ---- sides: one face per exposed direction, split into 1-block tiles, rounded where the
    // perpendicular neighbour is lower than the current row
    // [dir, neighbour height, point at (t along face, y), neighbour heights at the t=0 / t=1 ends]
    // ... plus the outward normal, the along-face direction, and the diagonal neighbours past each end
    const sides = [
      ['e', nb.e, (t, y) => [1, y, t], nb.n, nb.s, [1, 0, 0], [0, 0, 1], H(x + 1, z - 1), H(x + 1, z + 1)],
      ['w', nb.w, (t, y) => [0, y, 1 - t], nb.s, nb.n, [-1, 0, 0], [0, 0, -1], H(x - 1, z + 1), H(x - 1, z - 1)],
      ['s', nb.s, (t, y) => [1 - t, y, 1], nb.e, nb.w, [0, 0, 1], [-1, 0, 0], H(x + 1, z + 1), H(x - 1, z + 1)],
      ['n', nb.n, (t, y) => [t, y, 0], nb.w, nb.e, [0, 0, -1], [1, 0, 0], H(x - 1, z - 1), H(x + 1, z - 1)],
    ];
    for (const [dir, nh, at, end0, end1, fn, along, diag0, diag1] of sides) {
      if (nh >= h) continue;
      const bottom = Math.max(nh, -14);
      // horizontal samples along the face; rounding bands only at ends whose neighbour is lower
      const ts = [0];
      if (end0 < h && !sharp) ts.push(R * 0.5, R);
      if (end1 < h && !sharp) ts.push(1 - R, 1 - R * 0.5);
      ts.push(1);
      for (let b = Math.floor(bottom); b < h; b++) {
        const y0 = Math.max(b, bottom), y1 = b + 1;
        if (y1 <= y0) continue;
        const ys = [y0];
        if (!sharp) for (const yy of [y1 - R, y1 - R * 0.5]) if (y1 === h && yy > y0) ys.push(yy);
        ys.push(y1);
        const sideName = T.sideKind(x, z, b, h);
        const reg = pick(sideName, x, z, b * 7 + dir.charCodeAt(0));
        for (let i = 0; i < ts.length - 1; i++) for (let j = 0; j < ys.length - 1; j++) {
          const V = (t, y) => {
            const q = at(t, y);
            const r = round(q[0], y, q[2], h, rnb);
            if (sharp || y <= h - R + 1e-6) { r[3] = fn[0]; r[4] = 0; r[5] = fn[2]; } // flat cliff face
            return [x + r[0], r[1], z + r[2], r[3], r[4], r[5]];
          };
          const a = V(ts[i], ys[j]), bq = V(ts[i + 1], ys[j]), c = V(ts[i + 1], ys[j + 1]), d = V(ts[i], ys[j + 1]);
          const depth = (y) => Math.max(0.62, 1 - (h - y) * 0.07) * colTone * 0.97;
          pushQuad(a, bq, c, d, reg, [[ts[i], ys[j] - b], [ts[i + 1], ys[j] - b], [ts[i + 1], Math.min(1, ys[j + 1] - b)], [ts[i], Math.min(1, ys[j + 1] - b)]], [depth(a[1]), depth(bq[1]), depth(c[1]), depth(d[1])]);
        }
      }
      // Plug the lip's open end when the next column along does not continue the same lip.
      if (sharp) continue;
      const lipReg = pick(T.sideKind(x, z, h - 1, h), x, z, (h - 1) * 7 + dir.charCodeAt(0));
      for (const [tEnd, en, dn, sign] of [[0, end0, diag0, 1], [1, end1, diag1, -1]]) {
        if (en < h || (en === h && dn < h)) continue;
        const corner = at(tEnd, h);
        const pn = [along[0] * sign * 0.45, 0.89, along[2] * sign * 0.45]; // mostly up so the plug shades like the lip
        const K = [x + corner[0], h, z + corner[2], ...pn];
        // the lip's cross-section at this end: side-face arc (up to 45 degrees) then the top-cap arc
        const arc = [h - R, h - R * 0.5, h].map((yy) => {
          const q = at(tEnd, yy); const r = round(q[0], yy, q[2], h, nb);
          return [x + r[0], r[1], z + r[2], ...pn];
        });
        for (const k of [R * 0.5, R]) {
          const q = at(tEnd, h); const qx = q[0] - fn[0] * k, qz = q[2] - fn[2] * k;
          const r = round(qx, h, qz, h, nb);
          arc.push([x + r[0], r[1], z + r[2], ...pn]);
        }
        for (let i = 0; i < arc.length - 1; i++) {
          const uvOf = (p) => [tEnd, 1 - (h - p[1])];
          pushQuad(K, arc[i], arc[i + 1], arc[i + 1], lipReg, [uvOf(K), uvOf(arc[i]), uvOf(arc[i + 1]), uvOf(arc[i + 1])], [0.95, 0.95, 0.95, 0.95]);
        }
      }
    }
  }

  if (!pos.length) continue;
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.computeBoundingSphere();
  const mesh = new THREE.Mesh(g, mat);
  mesh.receiveShadow = true;
  mesh.castShadow = false;
  mesh.name = 'terrain-chunk';
  group.add(mesh);
  }
  return group;
}
