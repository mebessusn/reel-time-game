// Frostmere: the landmarks out in the wild (models: art/src/frostwild.py).
//   The Wreck of the Valiant (iced into the coast), Aurora Hill (a ring of standing stones round an inukshuk),
//   Skyward Station (Dr. Vale's hut, radar dome and weather mast), the Trapper's Cabin (Old Ansel's, with his cache,
//   fur rack and woodpile), Bear Point's dens, the Blue Caves (an ice arch in the glacier, a mammoth frozen in the wall),
//   the Frozen Falls (columns of blue ice), Steamhole Springs' steam, and signposts.
//   Plus the Valiant's Log: five loose pages of Captain Hale's log, one at each far landmark (Grandma Elsi's quest).
import * as THREE from 'three';
import { mergedMesh, instanced } from './instancing.js';
import { BlueCaves } from './bluecaves.js';
import { signBoard } from './plane.js';
import { addBox, addCircle } from '../world/colliders.js';
import { toWorld, P, ICE_Y, WATER_Y, SPRINGS, FALLS, FALLS_POOL } from './geo.js';

export const LOG_PAGES = [
  { id: 'p1', at: 'wreck', du: 8, dv: 6, title: 'The ice closes', text: 'Sept. 3rd. The pack came down on us in the night. By morning the Valiant was locked fast, a mile from open water. The men are calm. There is a lake beyond the shore, frozen, and smoke from no chimney at all: we are alone.' },
  { id: 'p2', at: 'caves', du: -10, dv: 10.5, inCave: true, title: 'The blue caves', text: 'Oct. 1st. Mr. Lund found caves in the glacier, blue as a church window. In the wall, a beast with tusks longer than a man, sleeping in the ice. The cook will not go in again. I confess I went in twice.' },
  { id: 'p3', at: 'aurorahill', du: 4, dv: 9, title: 'Lights', text: 'Nov. 12th. The sky caught fire tonight, green and violet, rippling like a sail. We climbed the eastern hill to see it better and found stones standing in a ring, and a stone man with his arms out. Someone was here before us.' },
  { id: 'p4', at: 'trapper', du: 6, dv: -8, title: 'The white stag', text: 'Dec. 20th. Hunting in the trees at dusk, in the snow, young Halloran saw a stag, white all over, its antlers glowing like the lights. He swears it vanished in a puff of snow. We have had too little to eat, I think.' },
  { id: 'p5', at: 'station', du: -10, dv: 6, title: 'Hearthwick', text: 'Mar. 30th. We will not leave. The lake is full of fish, the men have built cabins on the south shore, and Mrs. Okafor says the dogs have never been happier. We are calling it Hearthwick. Let the Valiant keep the ice: we have a home.' },
];

export class Wild {
  constructor(north) { this.north = north; this.game = north.game; this.pages = []; this.spin = []; }
  ground(x, z) { return this.north.groundAt(x, z) ?? ICE_Y; }
  put(name, u, v, { ry = 0, s = 1, dy = 0, col = null, shadow = true } = {}) {
    const w = toWorld(u, v), m = mergedMesh(name, { shadow });
    m.position.set(w.x, this.ground(w.x, w.z) + dy, w.z); m.rotation.y = ry; m.scale.setScalar(s);
    this.group.add(m);
    if (col) { if (col.r) addCircle(w.x, w.z, col.r); else addBox(w.x - col.w, w.z - col.d, w.x + col.w, w.z + col.d); }
    return m;
  }
  build(group) {
    const G = this.group = new THREE.Group(); G.name = 'north-wild'; group.add(G);
    // ---- the Wreck of the Valiant, heeled over in the sea ice, with its name on the stern
    const V = P.wreck, valiant = this.put('fp_valiant', V.u, V.v, { ry: 0.7, dy: -0.9 });
    valiant.rotation.z = 0.13; valiant.rotation.x = -0.04;
    const w = toWorld(V.u, V.v);
    const name = signBoard('VALIANT', 2.2, 0.4, { bg: '#2e2018', fg: '#e8d8a8', edge: '#7a2a24' });
    name.position.set(w.x - Math.sin(0.7) * 6.45, ICE_Y + 0.6, w.z - Math.cos(0.7) * 6.45); name.rotation.y = 0.7 + Math.PI; G.add(name);
    for (let k = -5; k <= 6; k += 1.5) addCircle(w.x + Math.sin(0.7) * k, w.z + Math.cos(0.7) * k, 1.9);
    // ---- Aurora Hill: a ring of standing stones round an inukshuk
    const A = P.aurorahill;
    for (let k = 0; k < 9; k++) { const a = k / 9 * Math.PI * 2; this.put(`fp_stone${k % 3}`, A.u + Math.sin(a) * 8, A.v + Math.cos(a) * 8, { ry: a, s: 0.9 + (k % 4) * 0.1, col: { r: 0.6 } }); }
    this.put('fp_inukshuk', A.u, A.v, { ry: Math.PI * 0.75, col: { r: 0.8 } });
    // ---- Skyward Station
    const S = P.station;
    this.put('fp_station_hut', S.u, S.v, { ry: Math.PI, col: { w: 3.1, d: 2.2 } });
    this.put('fp_station_dome', S.u + 9, S.v + 2, { col: { r: 1.9 } });
    const mast = this.put('fp_mast', S.u - 7, S.v - 4, { col: { r: 0.5 } });
    const an = mergedMesh('fp_anemometer'); an.position.set(mast.position.x, mast.position.y + 9.3, mast.position.z); G.add(an); this.spin.push(an);
    const sw = toWorld(S.u, S.v), sign = signBoard('SKYWARD STATION', 3.2, 0.45, { bg: '#2c4060', fg: '#f4f0e8', edge: '#e8641e' });
    sign.position.set(sw.x, this.ground(sw.x, sw.z) + 3.4, sw.z - 2.1); sign.rotation.y = Math.PI; G.add(sign);
    this.put('fp_signpost', S.u - 4, S.v + 8, { ry: 0.4, col: { r: 0.2 } });
    // ---- the Trapper's Cabin (Old Ansel's)
    const T = P.trapper;
    this.put('hw_cabin_green', T.u, T.v, { ry: Math.PI * 0.75, col: { w: 3.0, d: 3.0 } });
    this.put('hw_cache', T.u - 8, T.v + 5, { ry: 0.3, col: { r: 1.0 } });
    this.put('fp_furrack', T.u + 5, T.v - 6, { ry: 0.9, col: { r: 0.4 } });
    this.put('fp_woodpile', T.u + 5.5, T.v + 2, { ry: -0.8, col: { r: 0.9 } });
    this.put('fp_snowshoes', T.u + 2.6, T.v - 3.2, { ry: Math.PI * 0.75 });
    const tw = toWorld(T.u, T.v); this.chimney = new THREE.Vector3(tw.x + 1.1, this.ground(tw.x, tw.z) + 6.8, tw.z - 1.1);
    // ---- Bear Point: dens on the rocks
    const B = P.bearpoint;
    this.put('fp_den', B.u + 6, B.v + 6, { ry: 2.4, col: { r: 2.3 } });
    this.put('fp_den', B.u - 10, B.v - 4, { ry: -0.6, s: 0.8, col: { r: 1.8 } });
    // ---- the Blue Caves (v1.17.1): a walk-in ice cave cut into the glacier's flank (see bluecaves.js)
    this.caves = new BlueCaves(this); this.caves.build(G);
    // ---- the Frozen Falls: a cliff of ice columns over the plunge pool
    for (let k = 0; k < 6; k++) { const a = -0.9 + k * 0.36; this.put('fp_icecolumn', FALLS.u + Math.sin(a) * 4, FALLS.v + Math.cos(a) * 4 - 1, { ry: k, s: 0.8 + (k % 3) * 0.15, dy: -1.5, col: { r: 0.7 } }); }
    this.springs = toWorld(SPRINGS.u, SPRINGS.v); this.fallsPool = toWorld(FALLS_POOL.u, FALLS_POOL.v);
    // ---- signposts at Hearthwick's edges
    this.put('fp_signpost', 128, 150, { ry: -0.6, col: { r: 0.2 } });
    this.put('fp_signpost', 8, 138, { ry: 0.9, col: { r: 0.2 } });
    // ---- the Valiant's Log: loose pages fluttering by the landmarks
    const paper = (() => { const cv = document.createElement('canvas'); cv.width = 64; cv.height = 80; const c = cv.getContext('2d'); c.fillStyle = '#efe4c8'; c.fillRect(0, 0, 64, 80); c.fillStyle = '#6a5440'; for (let k = 0; k < 9; k++) c.fillRect(8, 10 + k * 7, 40 + (k % 3) * 6, 2); const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; return t; })();
    const pmat = new THREE.MeshBasicMaterial({ map: paper, side: THREE.DoubleSide });
    for (const pg of LOG_PAGES) {
      const at = P[pg.at], pw = toWorld(at.u + pg.du, at.v + pg.dv);
      const m = new THREE.Mesh(new THREE.PlaneGeometry(0.32, 0.4), pmat);
      const gy = pg.inCave ? this.caves.floorY(pw.x, pw.z) : this.ground(pw.x, pw.z);
      m.position.set(pw.x, gy + 0.5, pw.z); G.add(m);
      const glint = new THREE.Mesh(new THREE.RingGeometry(0.5, 0.62, 20).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: '#ffe8a0', transparent: true, opacity: 0.6, depthWrite: false }));
      glint.position.set(pw.x, gy + 0.05, pw.z); G.add(glint);
      this.pages.push({ ...pg, m, glint, x: pw.x, z: pw.z, y: m.position.y });
    }
  }
  update(dt, t) {
    this.caves?.update(dt, t);
    const g = this.game, me = g.player.pos, have = this.north.d.pages || {};
    for (const a of this.spin) a.rotation.y += dt * (4 + Math.sin(t * 0.3) * 2);
    for (const p of this.pages) {
      const got = !!have[p.id];
      p.m.visible = !got; p.glint.visible = !got;
      if (got) continue;
      p.m.position.y = p.y + Math.sin(t * 2 + p.x) * 0.08; p.m.rotation.set(Math.sin(t * 3 + p.z) * 0.4, t * 0.8, Math.sin(t * 2.3) * 0.3);
      p.glint.material.opacity = 0.35 + Math.sin(t * 3) * 0.25;
    }
    this.mistT = (this.mistT || 0) - dt;
    if (this.mistT <= 0) {
      this.mistT = 0.15;
      const near = (q, r) => Math.abs(q.x - me.x) < r && Math.abs(q.z - me.z) < r;
      if (near(this.springs, 120)) for (let k = 0; k < 2; k++) g.fx.mist(new THREE.Vector3(this.springs.x + (Math.random() - 0.5) * SPRINGS.r * 1.6, WATER_Y + 0.2, this.springs.z + (Math.random() - 0.5) * SPRINGS.r * 1.6));
      if (near(this.fallsPool, 90)) g.fx.mist(new THREE.Vector3(this.fallsPool.x, WATER_Y + 0.3, this.fallsPool.z));
      if (this.chimney && near(this.chimney, 120) && Math.random() < 0.6) g.fx.smoke(this.chimney);
    }
  }
  /** E near a loose log page. */
  contextActions() {
    const me = this.game.player.pos, have = this.north.d.pages || {};
    const p = this.pages.find((q) => !have[q.id] && Math.hypot(q.x - me.x, q.z - me.z) < 2.2);
    return p ? [{ id: 'logpage', label: 'Pick up the loose page', color: 'gold', at: { x: p.x, z: p.z, y: p.y, h: 0.6 }, fn: () => this.north.takePage(p) }] : [];
  }
}
export { instanced };
