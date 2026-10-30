// Skye's Air Races: the obstacles, set pieces and hazards on a circuit, and the shortcuts' hidden set pieces.
// Each obstacle is placed in the track's frame at a fraction t round the loop (`lat` m to the right, `up` m above)
// and gives back { group, colliders, update(dt, t, race), effect(plane, dt, race) }.
//
// Colliders (world space): { k: 'sphere', c, r } | { k: 'cap', a, b, r } | { k: 'box', inv (Matrix4), h (half size) }
// | { k: 'tube', inv, R, len } (the inside of a hangar: you fly through it, the shell is solid).
import * as THREE from 'three';
import { mergedMesh, merged } from '../north/instancing.js';
import { updraftMesh, animateUpdraft, gullFlock, flap, puffMaterial } from '../north/flightfx.js';

const UP = new THREE.Vector3(0, 1, 0);
const yawOf = (f) => Math.atan2(f.x, f.z);

/** Distance-based collision of a sphere (p, r) against a collider. */
export function hitCollider(C, p, r) {
  if (C.off) return false;
  if (C.k === 'sphere') return p.distanceTo(C.c) < C.r + r;
  if (C.k === 'cap') { const ab = C.b.clone().sub(C.a), t = Math.max(0, Math.min(1, p.clone().sub(C.a).dot(ab) / ab.lengthSq())); return p.distanceTo(C.a.clone().addScaledVector(ab, t)) < C.r + r; }
  if (C.k === 'box') { const q = p.clone().applyMatrix4(C.inv); return Math.abs(q.x) < C.h.x + r && Math.abs(q.y) < C.h.y + r && Math.abs(q.z) < C.h.z + r; }
  if (C.k === 'tube') { // a half-cylinder shell along local z (radius R, from y 0), open at both ends
    const q = p.clone().applyMatrix4(C.inv);
    if (Math.abs(q.z) > C.len + r || q.y < -r) return false;
    const rad = Math.hypot(q.x, q.y); return rad > C.R - r && rad < C.R + 1.6 + r;
  }
  return false;
}
const boxCol = (obj, h) => { obj.updateMatrixWorld(true); return { k: 'box', inv: obj.matrixWorld.clone().invert(), h, obj }; };
const cap = (a, b, r) => ({ k: 'cap', a, b, r });

function place(mesh, p, yaw, s = 1) { mesh.position.copy(p); mesh.rotation.y = yaw; mesh.scale.setScalar(s); mesh.updateMatrixWorld(true); return mesh; }
const node = (n, shadow = true) => mergedMesh(n, { shadow });

/** A soft cloud column (sky circuits): stacked puffs you can fly into (the fog closes in). */
function cloudColumn(P, h = 120, r0 = 30) {
  const g = new THREE.Group(), geo = new THREE.IcosahedronGeometry(1, 3), mat = puffMaterial(P, new THREE.Vector3(0.4, 0.55, -0.7));
  const n = 22, im = new THREE.InstancedMesh(geo, mat, n), m4 = new THREE.Matrix4(), q = new THREE.Quaternion();
  for (let i = 0; i < n; i++) { const f = i / n, a = i * 2.4, r = r0 * (1 - f * 0.45) * (0.5 + (i % 3) * 0.25), s = r0 * (0.75 - f * 0.35) + (i % 4) * 3; m4.compose(new THREE.Vector3(Math.cos(a) * r * 0.5, -40 + f * h, Math.sin(a) * r * 0.5), q, new THREE.Vector3(s, s * 0.8, s)); im.setMatrixAt(i, m4); }
  im.frustumCulled = false; g.add(im); g.userData.mat = mat; return g;
}

export function buildObstacle(o, ctx) {
  const { track, region, P, cls } = ctx, F = track.frame(o.t), yaw = yawOf(F.f);
  const at = F.p.clone().addScaledVector(F.right, o.lat || 0).addScaledVector(UP, o.up || 0);
  const ground = (x, z) => (region ? region.height(x, z) : at.y - 60);
  const gy = ground(at.x, at.z), ty = F.p.y, water = region ? region.water : -999;
  const g = new THREE.Group(); g.name = `air-${o.type}`;
  const C = []; let update = null, effect = null;
  const sky = !region;
  const standing = (name, h, r, s = 1, y0 = gy) => { g.add(place(node(name), new THREE.Vector3(at.x, y0, at.z), yaw, s)); C.push(cap(new THREE.Vector3(at.x, y0, at.z), new THREE.Vector3(at.x, y0 + h * s, at.z), r * s)); };
  switch (o.type) {
    case 'pylon': if (sky) { buildBalloons(g, C, at, 1, ctx, o); break; } standing('ar_pylon', 18, 2.2, 1.2); break;
    case 'mast': {
      const s = Math.max(0.6, (ty + 35 - gy) / 90); standing('ar_mast', 90, 1.6, s);
      // guy wires out to anchors (seen, not solid: the mast is)
      const top = new THREE.Vector3(at.x, gy + 70 * s, at.z), pts = [];
      for (let k = 0; k < 3; k++) { const a = yaw + k * 2.09 + 0.5, an = new THREE.Vector3(at.x + Math.sin(a) * 40 * s, 0, at.z + Math.cos(a) * 40 * s); an.y = ground(an.x, an.z); pts.push(top, an); }
      g.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color: '#3a3c40' })));
      break;
    }
    case 'hoodoo': standing('ar_hoodoo', 31, 4.5, 1 + ((o.t * 97) % 1) * 0.3); break;
    case 'seastack': standing('ar_seastack', 46, 8, 1.0, Math.min(gy, water - 3)); break;
    case 'spire': { const s = 14 + ((o.t * 53) % 1) * 4; g.add(place(node('nf_ice_spire'), new THREE.Vector3(at.x, gy - 2, at.z), yaw, s)); C.push(cap(new THREE.Vector3(at.x, gy, at.z), new THREE.Vector3(at.x, gy + 3 * s, at.z), 0.55 * s)); break; }
    case 'mesa': standing('ar_mesa', 62, 40, 1.3); break;
    case 'lookout': standing('ar_lookout', 28, 3.5, Math.max(1, (ty + 6 - gy) / 28)); break;
    case 'tower': standing('ar_lookout', 28, 3.5, Math.max(1.2, (ty + 10 - gy) / 28)); break;
    case 'lighthouse': standing('ar_lighthouse', 48, 6, Math.max(1, (ty + 10 - Math.max(gy, water - 2)) / 48), Math.max(gy, water - 2)); break;
    case 'turbine': {
      const hub = o.opts?.inPath ? ty + 4 : ty + 26, s = Math.max(0.5, (hub - gy) / 62);
      g.add(place(node('ar_turbine'), new THREE.Vector3(at.x, gy, at.z), yaw + Math.PI, s));
      C.push(cap(new THREE.Vector3(at.x, gy, at.z), new THREE.Vector3(at.x, gy + 60 * s, at.z), 1.8 * s));
      const rotor = node('ar_turbine_rotor'); const hubP = new THREE.Vector3(at.x, gy + 62 * s, at.z).addScaledVector(F.f, -1.5 * s);
      rotor.position.copy(hubP); rotor.rotation.order = 'YXZ'; rotor.rotation.y = yaw + Math.PI; rotor.scale.setScalar(s); g.add(rotor);
      const blades = [0, 1, 2].map(() => cap(hubP.clone(), hubP.clone(), 1.0 * s)); C.push(...blades);
      let spin = (o.t * 10) % 6;
      update = (dt) => {
        spin += dt * 0.9; rotor.rotation.z = spin;
        blades.forEach((b, i) => { const a = spin + i * 2.094; const dir = new THREE.Vector3(Math.cos(a), Math.sin(a), 0).applyAxisAngle(UP, yaw + Math.PI); b.b.copy(hubP).addScaledVector(dir, 28 * s); });
      };
      break;
    }
    case 'crane': {
      const s = Math.max(0.5, (ty + 1 - gy) / 33.5); // (sized so the hook hangs down to the line's height)
      const base = new THREE.Vector3(at.x, gy, at.z);
      g.add(place(node('ar_crane'), base, yaw, s)); C.push(cap(base.clone(), base.clone().setY(gy + 55 * s), 2 * s));
      const jib = node('ar_crane_jib'); jib.position.set(at.x, gy + 55 * s, at.z); jib.scale.setScalar(s); g.add(jib);
      const hook = { k: 'sphere', c: new THREE.Vector3(), r: 2.5 * s }, cable = cap(new THREE.Vector3(), new THREE.Vector3(), 0.4); C.push(hook, cable);
      let a = yaw + Math.PI / 2;
      update = (dt, t) => {
        a = o.opts?.sweep ? yaw + Math.PI / 2 + Math.sin(t * 0.35) * 1.6 : a + dt * 0.12; jib.rotation.y = a;
        const out = new THREE.Vector3(Math.sin(a), 0, Math.cos(a)).multiplyScalar(38 * s);
        hook.c.copy(jib.position).add(out).setY(jib.position.y - 21.5 * s); cable.a.copy(jib.position).add(out); cable.b.copy(hook.c);
      };
      break;
    }
    case 'powerline': {
      const towers = [-1, 1].map((sd) => { const p = F.p.clone().addScaledVector(F.right, sd * 55); p.y = ground(p.x, p.z); return p; });
      const s = Math.max(0.4, (ty + 14 - Math.min(towers[0].y, towers[1].y)) / 90);
      for (const p of towers) { g.add(place(node('ar_mast'), p, yaw, s)); C.push(cap(p.clone(), p.clone().setY(p.y + 90 * s), 1.4 * s)); }
      const wireY = [ty + 11, ty + 14], pts = []; // (fly under: the lower wire sags to 8 m above the line)
      for (const wy of wireY) for (const off of [-1.5, 1.5]) {
        const a = towers[0].clone().setY(wy).addScaledVector(F.f, off), b = towers[1].clone().setY(wy).addScaledVector(F.f, off);
        const mid = a.clone().lerp(b, 0.5).setY(wy - 3); pts.push(a, mid, mid, b);
        C.push(cap(a, mid, 0.5), cap(mid, b, 0.5));
      }
      g.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color: '#2a2c30' })));
      break;
    }
    case 'bridge': {
      const s = o.opts?.small ? 0.75 : 1, base = new THREE.Vector3(at.x, ty - 16 * s, at.z);
      const br = place(node('ar_bridge_stone'), base, yaw, s); g.add(br); // (its length, local x, across the line)
      // piers reach down to the ground; the deck and piers are solid, the arches' openings aren't
      for (const x0 of [-60, -20, 20, 60]) {
        const p = base.clone().addScaledVector(F.right, x0 * s), gp = ground(p.x, p.z);
        if (gp < base.y) { const ext = new THREE.Mesh(new THREE.BoxGeometry(10 * s, base.y - gp + 4, 9 * s), new THREE.MeshLambertMaterial({ color: '#8c867a' })); ext.position.set(p.x, (base.y + gp) / 2 - 2, p.z); ext.rotation.y = yaw; g.add(ext); }
        C.push(cap(new THREE.Vector3(p.x, Math.min(gp, base.y), p.z), new THREE.Vector3(p.x, base.y + 34 * s, p.z), 5.5 * s));
      }
      const deck = new THREE.Object3D(); deck.position.copy(base).setY(base.y + 34 * s); deck.rotation.y = yaw; g.add(deck); C.push(boxCol(deck, new THREE.Vector3(5 * s, 4.6 * s, 66 * s).set(66 * s, 4.6 * s, 5 * s)));
      for (const x0 of [-40, 0, 40]) { const p = base.clone().addScaledVector(F.right, x0 * s); C.push({ k: 'sphere', c: p.clone().setY(base.y + 30 * s), r: 3 * s }); }
      break;
    }
    case 'rockarch': {
      const s = 1, base = new THREE.Vector3(at.x, ty - 24, at.z);
      g.add(place(node('ar_rock_arch'), base, yaw, s));
      for (let k = 0; k <= 20; k++) { const a = (k / 20) * Math.PI; const p = base.clone().addScaledVector(F.right, Math.cos(a) * 40 * s).setY(base.y + Math.sin(a) * 46 * s); C.push({ k: 'sphere', c: p, r: 7.5 * s }); }
      for (const sd of [-1, 1]) { const p = base.clone().addScaledVector(F.right, sd * 40 * s); const gp = ground(p.x, p.z); if (gp < base.y) { const ext = new THREE.Mesh(new THREE.CylinderGeometry(9, 12, base.y - gp + 6, 9), new THREE.MeshLambertMaterial({ color: '#a85434' })); ext.position.set(p.x, (base.y + gp) / 2, p.z); g.add(ext); } }
      break;
    }
    case 'icearch': {
      const s = 7.5, base = new THREE.Vector3(at.x, ty - 22, at.z);
      g.add(place(node('fp_icearch'), base, yaw, s));
      for (let k = 0; k <= 14; k++) { const a = (k / 14) * Math.PI; C.push({ k: 'sphere', c: base.clone().addScaledVector(F.right, Math.cos(a) * 5.4 * s).setY(base.y + Math.sin(a) * 5.6 * s), r: 0.8 * s }); }
      break;
    }
    case 'hangar': {
      // a big hangar (or, in the sky, a cargo blimp's hangar) to fly straight through: the line runs through the middle
      const S = 1.3, base = new THREE.Vector3(at.x, (o.opts?.flying || sky) ? ty - S - 3 : ty - 10, at.z), h = place(node('ar_hangar_big'), base, yaw, S); g.add(h);
      C.push({ k: 'tube', inv: new THREE.Matrix4().makeRotationY(yaw).setPosition(base.x, base.y + S, base.z).invert(), R: 17 * S, len: 35 * S });
      if (o.opts?.flying || sky) { const bl = node('ar_blimp'); bl.position.copy(base).setY(base.y + 50); bl.rotation.y = yaw; bl.scale.setScalar(1.5); g.add(bl); C.push(cap(base.clone().setY(base.y + 50).addScaledVector(F.f, -40), base.clone().setY(base.y + 50).addScaledVector(F.f, 40), 15)); }
      else { const gp = ground(base.x, base.z); if (gp < base.y) { const pad = new THREE.Mesh(new THREE.BoxGeometry(52, base.y - gp + 2, 98), new THREE.MeshLambertMaterial({ color: '#9a988e' })); pad.position.set(base.x, (base.y + gp) / 2, base.z); pad.rotation.y = yaw; g.add(pad); } }
      break;
    }
    case 'dam': {
      // you skim over the top (the line is 12 m above it), off the reservoir and out over the canyon it holds back
      const S = 1.4, H = 59 * S, top = ty - 12, base = new THREE.Vector3(at.x, top - H, at.z), d = place(node('ar_dam'), base, yaw + Math.PI, S); g.add(d);
      for (let k = 0; k < 16; k++) { const a = (k - 7.5) / 16 * 1.1, lx = Math.sin(a) * 140, lz = -Math.cos(a) * 140 + 140; const p = base.clone().addScaledVector(F.right, -lx).addScaledVector(F.f, -lz); const o2 = new THREE.Object3D(); o2.position.copy(p).setY(base.y + H / 2); o2.rotation.y = yaw + a; g.add(o2); C.push(boxCol(o2, new THREE.Vector3(5.5, H / 2, 2.6))); }
      const res = new THREE.Mesh(new THREE.PlaneGeometry(320, 280), new THREE.MeshPhongMaterial({ color: '#3a8aa8', shininess: 100, transparent: true, opacity: 0.88 }));
      res.rotation.order = 'YXZ'; res.rotation.set(-Math.PI / 2, yaw, 0); res.position.copy(at).addScaledVector(F.f, -146).setY(top - 3); g.add(res);
      // the spillway: a sheet of water pouring off the middle of the dam into the canyon
      const sheet = new THREE.Mesh(new THREE.PlaneGeometry(18, H, 1, 8), fallsMaterial()); sheet.position.copy(at).addScaledVector(F.f, 3).setY(top - H / 2); sheet.rotation.y = yaw; g.add(sheet);
      update = (dt, t) => { sheet.material.uniforms.uT.value = t; };
      break;
    }
    case 'drawbridge': {
      const base = new THREE.Vector3(at.x, ty - 20, at.z), d = place(node('ar_drawbridge'), base, yaw, 1.2); g.add(d);
      for (const sd of [-1, 1]) { const p = base.clone().addScaledVector(F.right, sd * 18 * 1.2); C.push(cap(p.clone().setY(ground(p.x, p.z)), p.clone().setY(base.y + 36 * 1.2), 6.5)); }
      const leaves = [-1, 1].map((sd) => { const l = node('ar_drawbridge_leaf'); const hinge = base.clone().addScaledVector(F.right, sd * 13 * 1.2).setY(base.y + 12 * 1.2); l.position.copy(hinge); l.rotation.order = 'YXZ'; l.rotation.y = yaw + (sd > 0 ? Math.PI / 2 : -Math.PI / 2); /* (each leaf reaches in toward the middle) */ l.scale.setScalar(1.2); g.add(l); const box = new THREE.Object3D(); g.add(box); const col = { k: 'box', inv: new THREE.Matrix4(), h: new THREE.Vector3(7.8, 0.8, 6.6) }; C.push(col); return { l, hinge, sd, box, col }; });
      update = (dt, t) => {
        const up = Math.max(0, Math.sin(t * 0.32)) ** 0.6 * 1.25; // up for a while, down for a while (rising and falling)
        for (const L of leaves) {
          L.l.rotation.x = -up;
          const c = L.hinge.clone().add(new THREE.Vector3(0, Math.sin(up) * 7.8, 0)).addScaledVector(F.right, -L.sd * Math.cos(up) * 7.8);
          L.box.position.copy(c); L.box.rotation.set(0, yaw, 0); L.box.rotateX(0); L.box.rotation.order = 'YXZ'; L.box.rotation.z = L.sd * up; L.box.updateMatrixWorld(true);
          L.col.inv.copy(L.box.matrixWorld).invert();
        }
      };
      break;
    }
    case 'falls': case 'tunnel': {
      const base = new THREE.Vector3(at.x, (o.type === 'tunnel' ? at.y : ty) - 20, at.z), cl = place(node('ar_waterfall_cliff'), base, yaw, 1.3); g.add(cl);
      // (the two rock buttresses either side, and the lintel over the gap: 46 m wide and 52 m tall under it)
      for (const sd of [-1, 1]) C.push({ k: 'sphere', c: base.clone().addScaledVector(F.right, sd * 54.6).setY(base.y + 32), r: 31 });
      for (const x0 of [-20, 0, 20]) C.push({ k: 'sphere', c: base.clone().addScaledVector(F.right, x0).setY(base.y + 66), r: 14 });
      const sheet = new THREE.Mesh(new THREE.PlaneGeometry(42, 52, 1, 8), fallsMaterial()); sheet.position.copy(base).setY(base.y + 26).addScaledVector(F.f, -12); sheet.rotation.y = yaw; g.add(sheet);
      update = (dt, t) => { sheet.material.uniforms.uT.value = t; };
      break;
    }
    case 'mill': {
      const base = new THREE.Vector3(at.x, ground(at.x, at.z), at.z), m = place(node('ar_mill'), base, yaw, 1.6); g.add(m);
      C.push(cap(base.clone(), base.clone().setY(base.y + 26), 13));
      const wheel = node('ar_millwheel_wheel'); const wp = base.clone().addScaledVector(F.right, -0).add(new THREE.Vector3(Math.cos(yaw) * 14.4, 14.4, -Math.sin(yaw) * 14.4)); wheel.position.copy(wp); wheel.rotation.order = 'YXZ'; wheel.rotation.y = yaw; wheel.scale.setScalar(1.6); g.add(wheel); // (spins about its own axle, after the yaw)
      C.push({ k: 'sphere', c: wp.clone(), r: 13 });
      update = (dt, t) => { wheel.rotation.x = t * 0.6; };
      break;
    }
    case 'blimp': {
      const b = node('ar_blimp'); g.add(b); const span = 260, period = o.opts?.slow ? 46 : 30, h0 = o.opts?.low ? ty : ty + 4;
      const col = cap(new THREE.Vector3(), new THREE.Vector3(), 11); C.push(col);
      update = (dt, t) => {
        const k = Math.sin((t / period) * Math.PI * 2 + o.t * 9) * (o.opts?.cross || 1);
        const p = F.p.clone().addScaledVector(F.right, k * span / 2).setY(h0 + Math.sin(t * 0.4) * 2);
        const dir = Math.cos((t / period) * Math.PI * 2 + o.t * 9) >= 0 ? 1 : -1;
        b.position.copy(p); b.rotation.y = yaw + Math.PI / 2 * dir * (o.opts?.cross || 1);
        const ax = new THREE.Vector3(Math.sin(b.rotation.y), 0, Math.cos(b.rotation.y));
        col.a.copy(p).addScaledVector(ax, -24); col.b.copy(p).addScaledVector(ax, 24);
      };
      update(0, 0);
      break;
    }
    case 'train': {
      // a trestle across the line with an open steel span over it, and a train running along it now and then
      const deckY = ty + 13, base = new THREE.Vector3(at.x, deckY - 30.5, at.z), hw = 180;
      for (let k = -hw; k <= hw; k += 40) {
        if (Math.abs(k) < 30) continue; // the steel span over the line
        const p = base.clone().addScaledVector(F.right, k), gp = ground(p.x, p.z);
        const t2 = place(node('ar_trestle'), p, yaw + Math.PI / 2, 1); t2.scale.y = Math.max(0.3, (deckY - gp + 1) / 30.8); t2.position.y = gp - 0.5; g.add(t2);
        const hh = (deckY - gp + 1) / 2, bx = new THREE.Object3D(); bx.position.set(p.x, gp + hh - 0.5, p.z); bx.rotation.y = yaw + Math.PI / 2; g.add(bx);
        C.push(boxCol(bx, new THREE.Vector3(4, hh, 20.4)));
      }
      const span = new THREE.Mesh(new THREE.BoxGeometry(6, 3.2, 62), new THREE.MeshLambertMaterial({ color: '#4a4e56' })); span.position.copy(base).setY(deckY - 1); span.rotation.y = yaw + Math.PI / 2; g.add(span); C.push(boxCol(span, new THREE.Vector3(3, 1.6, 31)));
      for (const sd of [-1, 1]) { const tr = new THREE.Mesh(new THREE.BoxGeometry(0.6, 6, 62), new THREE.MeshLambertMaterial({ color: '#c84a2a' })); tr.position.copy(base).setY(deckY + 2).addScaledVector(F.f, sd * 3); tr.rotation.y = yaw + Math.PI / 2; g.add(tr); }
      const train = node('ar_train'); g.add(train); const tcol = cap(new THREE.Vector3(), new THREE.Vector3(), 3); C.push(tcol);
      update = (dt, t) => {
        const k = ((t * 14 + o.t * 300) % (hw * 2 + 200)) - hw - 100;
        const p = base.clone().addScaledVector(F.right, k).setY(deckY); train.position.copy(p); train.rotation.y = yaw - Math.PI / 2; // (it runs toward +right, nose first)
        train.visible = Math.abs(k) < hw; tcol.off = !train.visible; tcol.a.copy(p).addScaledVector(F.right, -14).setY(deckY + 2.5); tcol.b.copy(p).addScaledVector(F.right, 12).setY(deckY + 2.5);
      };
      break;
    }
    case 'geyser': {
      const base = new THREE.Vector3(at.x, Math.max(gy, water + 0.5), at.z); g.add(place(node('ar_geyser'), base, yaw, 1.4));
      const jet = new THREE.Mesh(new THREE.CylinderGeometry(3, 7, 1, 16, 1, true), new THREE.MeshBasicMaterial({ color: '#f4fbff', transparent: true, opacity: 0.0, depthWrite: false, side: THREE.DoubleSide })); jet.position.copy(base); g.add(jet);
      const top = ty + 22, period = 9, ph = o.t * 31;
      update = (dt, t) => { const k = ((t + ph) % period) / period, on = k > 0.6, h = on ? (top - base.y) * Math.min(1, (k - 0.6) * 8) : 0; jet.visible = on; jet.scale.y = Math.max(0.01, h); jet.position.y = base.y + h / 2; jet.material.opacity = on ? 0.55 : 0; jet.userData.h = h; };
      effect = (pl, dt, race) => { if (!jet.visible) return; const d = Math.hypot(pl.pos.x - base.x, pl.pos.z - base.z); if (d < 9 && pl.pos.y < base.y + jet.userData.h) { pl.pos.y += dt * 30; race.shake(0.4); if (!pl.geyserT || race.t - pl.geyserT > 2) { pl.geyserT = race.t; race.pop('GEYSER!', '#dff4ff'); } } };
      break;
    }
    case 'gust': {
      const len = 90, push = o.opts?.push || [1, 0], strength = 14 * (cls?.hazards || 1);
      const n = 70, pos = new Float32Array(n * 6), lines = new THREE.LineSegments(new THREE.BufferGeometry(), new THREE.LineBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.55 }));
      lines.geometry.setAttribute('position', new THREE.BufferAttribute(pos, 3)); lines.frustumCulled = false; g.add(lines);
      const seeds = Array.from({ length: n }, (_, i) => [((i * 37) % 100) / 100, ((i * 61) % 100) / 100, ((i * 13) % 100) / 100]);
      const dir = F.right.clone().multiplyScalar(push[0]);
      update = (dt, t) => {
        seeds.forEach((sd, i) => {
          const along = (sd[0] - 0.5) * len, side = (((sd[1] + t * 0.6) % 1) - 0.5) * 120, h = (sd[2] - 0.5) * 50;
          const a = F.p.clone().addScaledVector(F.f, along).addScaledVector(dir, side).setY(ty + h), b = a.clone().addScaledVector(dir, 6);
          pos.set([a.x, a.y, a.z, b.x, b.y, b.z], i * 6);
        });
        lines.geometry.attributes.position.needsUpdate = true;
      };
      effect = (pl, dt) => { const q = pl.pos.clone().sub(F.p); if (Math.abs(q.dot(F.f)) < len / 2 && q.length() < 80) pl.pos.addScaledVector(dir, strength * dt * (0.7 + 0.3 * Math.sin(ctx.time() * 3))); };
      break;
    }
    case 'storm': {
      const S = new THREE.Group(), mat = new THREE.MeshLambertMaterial({ color: '#3a3f4c', emissive: '#121418' });
      for (let i = 0; i < 16; i++) { const m = new THREE.Mesh(new THREE.IcosahedronGeometry(1, 2), mat), s = 10 + (i % 5) * 3; m.scale.set(s, s * 0.7, s); m.position.set(Math.sin(i * 2.3) * 22, Math.cos(i * 1.7) * 8, Math.cos(i * 2.9) * 22); S.add(m); }
      S.position.copy(at); g.add(S); const flash = new THREE.PointLight('#cfe0ff', 0, 160, 1.4); S.add(flash);
      let ft = 2;
      update = (dt) => { ft -= dt; if (ft <= 0) { ft = 1.2 + Math.random() * 3; flash.intensity = 7; } else flash.intensity = Math.max(0, flash.intensity - dt * 40); };
      effect = (pl, dt, race) => { if (pl.pos.distanceTo(at) < 38) { race.shake(0.25); pl.speedMul = Math.min(pl.speedMul, 0.85); } };
      break;
    }
    case 'lightning': {
      const top = at.clone().setY(ty + 90), bot = at.clone().setY(region ? gy : ty - 70);
      const glow = new THREE.Mesh(new THREE.CylinderGeometry(8, 8, top.y - bot.y, 16, 1, true), new THREE.MeshBasicMaterial({ color: '#bcd4ff', transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending }));
      glow.position.copy(top).lerp(bot, 0.5); g.add(glow);
      const bolt = new THREE.Line(new THREE.BufferGeometry().setFromPoints(Array.from({ length: 12 }, (_, i) => top.clone().lerp(bot, i / 11).add(new THREE.Vector3((Math.random() - 0.5) * 8, 0, (Math.random() - 0.5) * 8)))), new THREE.LineBasicMaterial({ color: '#ffffff' }));
      bolt.visible = false; g.add(bolt);
      const period = 6, ph = o.t * 17;
      update = (dt, t) => { const k = ((t + ph) % period) / period; glow.material.opacity = k > 0.65 && k < 0.85 ? (k - 0.65) * 1.6 : 0; bolt.visible = k >= 0.85 && k < 0.92; g.userData.strike = bolt.visible; };
      effect = (pl, dt, race) => { if (g.userData.strike && Math.hypot(pl.pos.x - at.x, pl.pos.z - at.z) < 10) { if (!pl.zapT || race.t - pl.zapT > 1.5) { pl.zapT = race.t; race.crash('lightning'); } } };
      break;
    }
    case 'birds': {
      const f = gullFlock(8); g.add(f); const span = 220, period = 22;
      update = (dt, t) => { const k = Math.sin((t / period) * Math.PI * 2 + o.t * 7); f.position.copy(F.p).addScaledVector(F.right, k * span / 2).setY(ty + Math.sin(t * 0.7) * 3); f.rotation.y = yaw + Math.PI / 2 * Math.sign(Math.cos((t / period) * Math.PI * 2 + o.t * 7)); flap(f, t, 10); };
      effect = (pl, dt, race) => { if (pl.birdT && race.t - pl.birdT < 3) return; for (const b of f.children) { if (b.getWorldPosition(new THREE.Vector3()).distanceTo(pl.pos) < 5) { pl.birdT = race.t; race.birdStrike(); break; } } };
      update(0, 0);
      break;
    }
    case 'updraft': {
      const u = updraftMesh(); u.position.copy(at); u.scale.setScalar(1.2); g.add(u);
      update = (dt, t) => animateUpdraft(u, dt, t);
      effect = (pl, dt, race) => { if (Math.hypot(pl.pos.x - at.x, pl.pos.z - at.z) < 11 && pl.pos.y > at.y - 30 && pl.pos.y < at.y + 60) { pl.pos.y += dt * 16; pl.meter = Math.min(1, pl.meter + dt * 0.5); if (!pl.draftT || race.t - pl.draftT > 4) { pl.draftT = race.t; race.pop('UPDRAFT!', '#bff0ff'); } } };
      break;
    }
    case 'isle': {
      const base = at.clone(); g.add(place(node('ar_floating_isle'), base, yaw, 1.2));
      C.push({ k: 'sphere', c: base.clone().setY(base.y - 8), r: 22 }, { k: 'sphere', c: base.clone().setY(base.y - 26), r: 12 });
      if (o.opts?.lighthouse) { g.add(place(node('ar_lighthouse'), base.clone().setY(base.y + 1), yaw, 1)); C.push(cap(base.clone(), base.clone().setY(base.y + 48), 5.5)); }
      update = (dt, t) => { g.children[0].position.y = base.y + Math.sin(t * 0.3 + o.t * 9) * 1.5; };
      break;
    }
    case 'column': { const col = cloudColumn(P, o.opts?.big ? 220 : 140, o.opts?.big ? 60 : 32); col.position.copy(at).setY(ty - 20); g.add(col); g.userData.cloud = { c: at.clone(), r: o.opts?.big ? 55 : 30 }; update = (dt, t) => { col.userData.mat.uniforms.uT.value = t; }; break; }
    case 'balloons': buildBalloons(g, C, at, o.opts?.field ? 9 : 4, ctx, o); update = (dt, t) => g.children.forEach((b, i) => { b.position.y = b.userData.y + Math.sin(t * 0.5 + i) * 2; if (b.userData.col) b.userData.col.c.y = b.position.y + 16 * b.scale.x; }); break;
    case 'blimpdock': { const s = 1.2, p = at.clone().addScaledVector(F.right, (o.t * 1000) % 2 > 1 ? 60 : -60); g.add(place(node('ar_blimp_dock'), p, yaw, s)); C.push({ k: 'sphere', c: p.clone(), r: 17 }, cap(p.clone(), p.clone().setY(p.y + 30), 2)); const bl = node('ar_blimp'); bl.position.copy(p).setY(p.y + 46); bl.rotation.y = yaw; g.add(bl); C.push(cap(p.clone().setY(p.y + 46).addScaledVector(F.f, -26), p.clone().setY(p.y + 46).addScaledVector(F.f, 26), 11)); break; }
    case 'gorge': default: break; // (a gorge is the land itself: src/air/region.js narrows the corridor)
  }
  return { o, group: g, colliders: C, update, effect };
}

/** Hot-air balloons: a cluster beside the line (never on it), or (`field`) a slalom across it, alternating sides. */
function buildBalloons(g, C, at, n, ctx, o) {
  const field = !!o.opts?.field;
  for (let i = 0; i < n; i++) {
    const nm = ['ar_balloon_a', 'ar_balloon_b', 'ar_balloon_c'][i % 3], s = 1.0;
    let lat = (o.lat || 0) + (n === 1 ? 0 : ((i % 2) * 2 - 1) * (26 + Math.floor(i / 2) * 22));
    if (field) lat = (i % 2 ? 1 : -1) * 16; else if (n > 1 && Math.abs(lat) < 24) lat = Math.sign(lat || 1) * 24;
    const Fi = ctx.track.frame(o.t + ((i - n / 2) * (field ? 34 : 30)) / ctx.track.length);
    const p = Fi.p.clone().addScaledVector(Fi.right, lat).setY(at.y - 14 + (i % 3) * 6);
    const b = place(mergedMesh(nm), p, i, s); b.userData.y = p.y; g.add(b);
    const col = { k: 'sphere', c: p.clone().setY(p.y + 16 * s), r: 8.5 * s }; b.userData.col = col; C.push(col, cap(p.clone(), p.clone().setY(p.y + 6), 1.6));
  }
}

let FALLS = null;
function fallsMaterial() {
  if (FALLS) return FALLS;
  FALLS = new THREE.ShaderMaterial({ userData: { keep: true }, transparent: true, depthWrite: false, side: THREE.DoubleSide, uniforms: { uT: { value: 0 } },
    vertexShader: 'varying vec2 vU; void main(){ vU = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `uniform float uT; varying vec2 vU; float h(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
      void main(){ vec2 p = vec2(vU.x * 30.0, vU.y * 6.0 + uT * 3.0); float s = h(floor(p)) * 0.5 + h(floor(p * 0.5)) * 0.5;
        float edge = smoothstep(0.0, 0.12, vU.x) * smoothstep(1.0, 0.88, vU.x); gl_FragColor = vec4(mix(vec3(0.75, 0.88, 0.95), vec3(1.0), s), (0.55 + s * 0.35) * edge); }` });
  return FALLS;
}

/** The set piece hiding each shortcut (a cave arch, a cliff and falls, twin mesas, a hangar...). */
export function buildShortcutPiece(s, ctx) {
  const { track } = ctx, d = s.b.clone().sub(s.a).normalize(), yaw = yawOf(d), mid = s.mid.clone();
  const fake = { t: 0, lat: 0, up: 0 };
  const frameAt = { p: mid, f: d, right: new THREE.Vector3().crossVectors(d, UP).normalize(), up: UP.clone() };
  const ctx2 = { ...ctx, track: { ...track, frame: () => frameAt } };
  const kind = s.cave ? 'rockarch' : s.tunnel ? 'tunnel' : s.hangar ? 'hangar' : s.mill ? 'mill' : s.updraft ? 'updraft' : s.storm ? 'storm' : s.fog ? 'column' : s.crack || s.flume ? null : null;
  if (kind) {
    const o = { ...fake, type: kind, opts: kind === 'column' ? { big: true } : kind === 'hangar' ? { flying: !ctx.region } : {}, lat: kind === 'mill' ? 46 : 0 };
    const r = buildObstacle(o, ctx2);
    if (kind === 'storm' || kind === 'column') r.effect = null; // (the eye is calm)
    return r;
  }
  if (s.crack) { // the crack in the big mesa: two halves of a mesa with a narrow slot between them
    const g = new THREE.Group(), C = [], right = frameAt.right;
    for (const sd of [-1, 1]) {
      const p = mid.clone().addScaledVector(right, sd * 57).setY(mid.y - 34);
      g.add(place(node('ar_mesa'), p, yaw, 1.05));
      const box = new THREE.Object3D(); box.position.copy(p).setY(p.y + 33); box.rotation.y = yaw; g.add(box); C.push(boxCol(box, new THREE.Vector3(42, 33, 46)));
    }
    return { group: g, colliders: C, update: null, effect: null, o: { type: 'crack' } };
  }
  if (s.flume) { // a timber flume running down the cut, water sparkling in it
    const g = new THREE.Group(), L = s.a.distanceTo(s.b), m = new THREE.MeshLambertMaterial({ color: '#7a5434' });
    for (let k = 0; k < L / 6; k++) { const p = s.a.clone().lerp(s.b, k / (L / 6)); p.y -= 9; const seg = new THREE.Mesh(new THREE.BoxGeometry(3, 1.2, 6.2), m); seg.position.copy(p); seg.rotation.y = yaw; g.add(seg); const leg = new THREE.Mesh(new THREE.BoxGeometry(0.4, 9, 0.4), m); leg.position.copy(p).setY(p.y - 5); g.add(leg); }
    return { group: g, colliders: [], update: null, effect: null };
  }
  return { group: new THREE.Group(), colliders: [], update: null, effect: null };
}
export { yawOf, merged };
