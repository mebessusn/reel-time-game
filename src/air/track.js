// Skye's Air Races: a circuit's track. The closed centre line (a centripetal Catmull-Rom loop through the control
// points), the gates along it in order, the three timing sectors, the boost rings, and each shortcut's path (a chord
// cutting the corner from one gate to a later one, through its own hidden gates). Pure geometry: no drawing here.
import * as THREE from 'three';

const V = (p) => new THREE.Vector3(p[0], p[2], p[1]); // [x, z, y] -> (x, y, z)

export class Track {
  constructor(c, { gateEvery = c.kind === 'sky' ? 190 : 165 } = {}) {
    this.c = c;
    // each shortcut gets a lobe to cut: the control point nearest its stretch is pushed out (away from the middle of
    // the circuit) so the line swings out round a hill, a mesa, a cloud tower, and the shortcut goes straight across
    const pts = c.pts.map(V), cuts = c.shortcuts || [];
    this.lobes = [];
    if (cuts.length) {
      const pre = new THREE.CatmullRomCurve3(pts.map((p) => p.clone()), true, 'centripetal', 0.5);
      const mid = pts.reduce((m, p) => m.add(p), new THREE.Vector3()).multiplyScalar(1 / pts.length);
      for (const s of cuts) {
        const q = pre.getPointAt((((s.from + s.to) / 2) % 1 + 1) % 1);
        let k = 0, bd = Infinity; pts.forEach((p, i) => { const d = p.distanceTo(q); if (d < bd && i >= 2 && i <= pts.length - 2) { bd = d; k = i; } });
        const out = pts[k].clone().sub(mid).setY(0).normalize(), D = s.lobe ?? (c.kind === 'sky' ? 230 : 250);
        pts[k].addScaledVector(out, D);
        this.lobes.push({ s: s.id, k, a: pts[k - 1].clone(), b: pts[k + 1].clone() });
      }
    }
    this.curve = new THREE.CatmullRomCurve3(pts, true, 'centripetal', 0.5);
    this.length = this.curve.getLength();
    const n = Math.max(10, Math.round(this.length / gateEvery));
    this.gateR = c.kind === 'sky' ? 17 : 14;
    // gates: evenly spaced along the loop; gate 0 is the start/finish line
    this.gates = [];
    for (let i = 0; i < n; i++) {
      const t = i / n, p = this.curve.getPointAt(t), d = this.curve.getTangentAt(t);
      this.gates.push({ i, t, p, d, r: this.gateR });
    }
    this.sectors = [Math.round(n / 3), Math.round((2 * n) / 3)];
    this.boost = (c.boost || []).map((t) => ({ t, p: this.curve.getPointAt(t), d: this.curve.getTangentAt(t), r: 6 }));
    // a fine table of points round the loop, for nearest-point lookups (racing order, wrong way, the mini map)
    this.N = 600; this.table = [];
    for (let k = 0; k < this.N; k++) { const t = k / this.N; this.table.push({ t, p: this.curve.getPointAt(t), d: this.curve.getTangentAt(t) }); }
    // shortcuts: leave after the gate at `from`, rejoin at the gate at `to`; the path is the chord between them (a
    // little lower, so it hides behind the scenery), through two hidden gates. The pair of gates is picked near the
    // circuit's from / to so the corner cut is worth having (the most saved), well clear of the rest of the line.
    this.shortcuts = (c.shortcuts || []).map((s) => {
      const [gi, gj] = this.pickCut(s, n);
      const a = this.gates[gi].p, b = this.gates[gj].p;
      const mid = a.clone().lerp(b, 0.5); mid.y -= s.cave || s.tunnel || s.crack ? 2 : 0;
      const pts = [a.clone().lerp(mid, 0.66), mid.clone().lerp(b, 0.34)].map((p) => ({ p, d: b.clone().sub(a).normalize(), r: s.crack || s.cave || s.tunnel || s.mill || s.flume ? 9 : 12 }));
      const arc = this.arcLength(this.gates[gi].t, this.gates[gj].t), chord = a.distanceTo(b);
      return { ...s, from: gi, to: gj, a, b, mid, gates: pts, saves: arc - chord };
    });
    const box = new THREE.Box3(); for (const q of this.table) box.expandByPoint(q.p); this.box = box;
  }
  /** The best pair of gates for a shortcut near its from / to: the most distance saved, the chord between them clear of
   *  the line (at least `clear` m away along its middle), 150 to 520 m long. */
  pickCut(s, n) {
    // (round the lobe's mouth: from the gate nearest the control point before it to the one nearest the point after)
    const L = this.lobes.find((x) => x.s === s.id), near = (p) => { let bi = 0, bd = Infinity; this.gates.forEach((G, i) => { const d = G.p.distanceTo(p); if (d < bd) { bd = d; bi = i; } }); return bi; };
    let gi0 = L ? near(L.a) : Math.round(s.from * n), gj0 = L ? near(L.b) : Math.round(s.to * n);
    if (gj0 <= gi0) gj0 += n;
    const clear = this.c.kind === 'sky' ? 45 : 55;
    let best = null;
    for (let gi = gi0 - 2; gi <= gi0 + 2; gi++) for (let gj = gj0 - 2; gj <= gj0 + 3; gj++) {
      const span = gj - gi; if (span < 2 || span > 8) continue;
      if (gi < 1 || gj > n) continue; // (never across the start line: a lap is a lap)
      const A = this.gates[((gi % n) + n) % n], B = this.gates[((gj % n) + n) % n], chord = A.p.distanceTo(B.p);
      if (chord < 140 || chord > 560) continue;
      let minD = Infinity;
      for (let k = 2; k <= 8; k++) { const p = A.p.clone().lerp(B.p, k / 10); for (const q of this.table) minD = Math.min(minD, q.p.distanceTo(p)); }
      const saves = this.arcLength(A.t, B.t) - chord;
      const score = saves - (minD < clear ? 1000 : 0);
      if (!best || score > best.score) best = { score, gi: ((gi % n) + n) % n, gj: ((gj % n) + n) % n };
    }
    return best ? [best.gi, best.gj] : [Math.round(s.from * n) % n, Math.round(s.to * n) % n];
  }
  arcLength(t0, t1) { const d = ((t1 - t0) % 1 + 1) % 1; return d * this.length; }
  pointAt(t) { return this.curve.getPointAt(((t % 1) + 1) % 1); }
  tangentAt(t) { return this.curve.getTangentAt(((t % 1) + 1) % 1); }
  /** The nearest point on the line to p, searching near a hint t if given: { t, p, d, dist }. */
  nearest(p, hint = null) {
    let best = null, bd = Infinity;
    const N = this.N, scan = (all) => { const n = all ? N : 81, k0 = all ? 0 : Math.round(hint * N) - 40; for (let k = 0; k < n; k++) { const q = this.table[((k0 + k) % N + N) % N], d = q.p.distanceToSquared(p); if (d < bd) { bd = d; best = q; } } };
    scan(hint == null);
    if (hint != null && bd > 60 * 60) scan(true); // (off the line, on a shortcut, after a respawn: look everywhere)
    return { ...best, dist: Math.sqrt(bd) };
  }
  /** A frame at t: the line's point, forward, right and up (for placing things beside the line). */
  frame(t) {
    const p = this.pointAt(t), f = this.tangentAt(t);
    const right = new THREE.Vector3().crossVectors(f, new THREE.Vector3(0, 1, 0)).normalize(), up = new THREE.Vector3().crossVectors(right, f).normalize();
    return { p, f, right, up };
  }
  /** Did the segment a->b pass through a ring at p facing d with radius r? */
  static crossed(a, b, ring, slack = 1.15) {
    const da = a.clone().sub(ring.p).dot(ring.d), db = b.clone().sub(ring.p).dot(ring.d);
    if (!(da < 0 && db >= 0)) return false;
    const k = da / (da - db), hit = a.clone().lerp(b, k);
    return hit.distanceTo(ring.p) < ring.r * slack;
  }
}
