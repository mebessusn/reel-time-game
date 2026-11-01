// Lake flags (v1.9.3 Frostpine, v1.9.4 every lake): each lake has a stone cairn on its bank, and whoever
// holds that lake's record this week (heaviest single fish landed there) gets their country's flag on it.
// Until someone lands a fish at a lake this week, last week's holder keeps it. Each angler writes only their
// own doc per lake in the shared `lakeflag` collection ({ week, lake, w, sp, name, cc }), so nobody can knock
// anyone else's entry over; the holder is worked out from everyone's docs. (v1.9.3's Frostpine docs have no
// `lake` and count for Frostpine.) Docs come from other players: everything read is checked.
import * as THREE from 'three';
import { weekId } from '../core/clock.js';
import { CAIRNS } from '../world/dressing.js';
import { cleanCountry, drawFlag, COUNTRY_BY_CODE, flagHolder } from '../data/flags.js';
import { SPECIES_BY_ID } from '../data/species.js';
import { heightAt, zoneAt, LAKES } from '../world/terrain.js';

/** The lakes with a flag, and which fishing zones count for each. */
export const FLAG_LAKES = {
  cove: { name: 'Cozy Cove', zones: ['dock', 'shallows', 'open', 'deep', 'falls', 'ruins'] },
  frost: { name: 'Frostpine Lake', zones: ['frost'] },
  marsh: { name: 'Lilymarsh', zones: ['marsh'] },
  pond: { name: 'Fern Pond', zones: ['pond'] },
  quarry: { name: 'Old Quarry', zones: ['quarry'] },
};
export function lakeForZone(zone) { return Object.keys(FLAG_LAKES).find((k) => FLAG_LAKES[k].zones.includes(zone)) || null; }
const docLake = (d) => (typeof d?.lake === 'string' && FLAG_LAKES[d.lake] ? d.lake : d && d.lake == null ? 'frost' : null);
const FW = 0.74, FH = 0.49; // the pennant, in metres

export class LakeFlag {
  constructor(game) {
    this.game = game;
    this.flags = {}; // lake -> { mesh, canvas, tex, base, cc, holder, shown, last, myBest }
    this.ready = false; this.t = 0;
    for (const k of Object.keys(FLAG_LAKES)) this.flags[k] = { holder: null, shown: null, last: false, myBest: 0, cc: null };
  }

  init() {
    for (const k of Object.keys(FLAG_LAKES)) if (CAIRNS[k]) this.build(k);
    this.unsub = this.game.shared.watch('lakeflag', (docs) => this.onDocs(docs), { limit: 1000 });
  }

  build(lake) {
    const f = this.flags[lake], at = CAIRNS[lake];
    const cv = document.createElement('canvas');
    cv.width = 192; cv.height = 128;
    f.canvas = cv;
    f.tex = new THREE.CanvasTexture(cv);
    f.tex.colorSpace = THREE.SRGBColorSpace;
    f.tex.anisotropy = 4;
    const geo = new THREE.PlaneGeometry(FW, FH, 10, 2);
    geo.translate(FW / 2, 0, 0); // hangs off the pole at x = 0
    f.base = geo.attributes.position.array.slice();
    f.mesh = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ map: f.tex, side: THREE.DoubleSide }));
    f.mesh.name = `${lake}-flag`;
    f.mesh.castShadow = true;
    f.mesh.position.set(at.x + 0.03, at.y, at.z); // the pennant's centre, its top edge just under the finial
    this.game.engine.scene.add(f.mesh);
    // a brass ball on top of the pole, above the flag
    const ball = new THREE.Mesh(new THREE.SphereGeometry(0.075, 12, 8), new THREE.MeshPhongMaterial({ color: '#d8b04a', shininess: 80, specular: '#fff2c0' }));
    ball.position.set(at.x, (at.top ?? at.y + 0.45) + 0.05, at.z);
    ball.castShadow = true;
    this.game.engine.scene.add(ball);
    this.paint(lake, 'XX');
  }

  paint(lake, cc) {
    const f = this.flags[lake];
    if (!f.canvas || f.cc === cc) return;
    f.cc = cc;
    drawFlag(f.canvas.getContext('2d'), cc, f.canvas.width, f.canvas.height);
    f.tex.needsUpdate = true;
  }

  onDocs(docs) {
    this.docs = docs;
    const g = this.game, wk = weekId(), prev = weekId(Date.now() - 7 * 86400000);
    for (const lake of Object.keys(FLAG_LAKES)) {
      const f = this.flags[lake], L = FLAG_LAKES[lake];
      const mine = docs.filter((d) => docLake(d) === lake);
      const me = mine.find((d) => d.id === this.docId(lake, wk));
      f.myBest = Math.max(f.myBest, Number(me?.w) || 0);
      const before = f.holder;
      f.holder = flagHolder(mine, wk);
      f.last = !f.holder; // flying last week's flag
      f.shown = f.holder || flagHolder(mine, prev);
      this.paint(lake, f.shown?.cc || 'XX');
      if (this.ready && f.holder && (!before || before.id !== f.holder.id)) {
        const h = f.holder, isMe = h.id === this.docId(lake, wk);
        const sp = SPECIES_BY_ID[h.sp]?.name || 'fish';
        const land = COUNTRY_BY_CODE[h.cc]?.name;
        if (isMe) g.chat?.system(`Your flag flies over ${L.name}! Your ${h.w.toFixed(1)} lb ${sp} is the heaviest landed there this week.`, 'festival', { popup: true });
        else g.chat?.system(`${h.name}${land && h.cc !== 'XX' ? ` (${land})` : ''} took the ${L.name} record with a ${h.w.toFixed(1)} lb ${sp}. Their flag is on the cairn now.`, 'info');
      }
    }
    this.ready = true;
  }

  // (Frostpine keeps v1.9.3's doc ids, so this week's entries made before every lake had a flag still count)
  docId(lake, wk = weekId(), uid = this.game.save?.userId) { return (lake === 'frost' ? `${wk}_${uid}` : `${wk}_${lake}_${uid}`).replace(/[^\w-]/g, '_'); }

  /** v1.9.8: which flag lake a catch at (x, z) belongs to, when the catch didn't say (older clients). */
  lakeNear(x, z) {
    const z0 = zoneAt(x, z), byZone = z0 && lakeForZone(z0);
    if (byZone) return byZone;
    const spots = [['cove', 0, -2, 46], ...['frost', 'marsh', 'pond', 'quarry'].map((k) => [k, LAKES[k].cx, LAKES[k].cz, Math.max(LAKES[k].rx, LAKES[k].rz) + 14])];
    let best = null, bd = Infinity;
    for (const [k, cx, cz, r] of spots) { const d = Math.hypot(x - cx, z - cz); if (d < r && d < bd) { bd = d; best = k; } }
    return best;
  }

  /**
   * v1.9.8: someone else in the room landed a fish. Anglers whose own database writes are refused (shared to
   * them view-only) never reach the board, so everyone who can write records it for them too. Only a new best
   * for that angler at that lake this week is written; the holder is still worked out from the docs.
   */
  onRemoteCatch(meta, data, pos) {
    const uid = meta?.id, w = Number(data?.weight);
    if (!uid || !(w > 0 && w < 5000) || uid === this.game.save?.userId) return;
    const lake = (data.zone && lakeForZone(data.zone)) || (pos ? this.lakeNear(pos.x, pos.z) : null);
    if (!lake) return;
    const wk = weekId(), id = this.docId(lake, wk, uid);
    const have = (this.docs || []).find((d) => d.id === id);
    if (have && Number(have.w) >= w) return;
    this.game.shared.set('lakeflag', id, { week: wk, lake, w: Math.round(w * 100) / 100, sp: String(data.speciesId || ''), name: String(meta.name || 'An angler').slice(0, 20), cc: cleanCountry(meta.avatar?.country) || 'XX', at: Date.now() });
  }

  /** After a catch: a new personal best at that lake this week goes on the board. */
  onCatch(c) {
    const g = this.game, lake = lakeForZone(c.zone);
    if (!lake) return;
    const f = this.flags[lake];
    if (!(c.weight > f.myBest)) return;
    f.myBest = c.weight;
    const wk = weekId();
    Promise.resolve(g.shared.set('lakeflag', this.docId(lake, wk), { week: wk, lake, w: Math.round(c.weight * 100) / 100, sp: c.speciesId, name: g.profile.name, cc: cleanCountry(g.profile.avatar?.country) || 'XX', at: Date.now() })).then((ok) => {
      // v1.9.8: a view-only share can't write to the board; friends in the room record it for you instead
      if (ok === false && !this.warned) { this.warned = true; g.chat?.system('Your lake records can\'t be saved from this copy of the game (it was shared with you view-only). Anyone fishing with you who can save will record your flag for you, or ask whoever shared the game to give you "can use" access.', 'info'); }
    }).catch(() => {});
  }

  /** v1.10: a lake's board for the Notice board: who holds the flag and this week's top anglers there. */
  standings(lake, n = 3) {
    const wk = weekId(), f = this.flags[lake];
    const rows = (this.docs || []).filter((d) => docLake(d) === lake && d.week === wk)
      .map((d) => ({ id: String(d.id || ''), w: Number(d.w), sp: SPECIES_BY_ID[d.sp] ? d.sp : null, name: String(d.name || 'An angler').slice(0, 20), cc: cleanCountry(d.cc) || 'XX', at: Number(d.at) || 0 }))
      .filter((r) => r.w > 0 && r.w < 5000)
      .sort((a, b) => b.w - a.w || a.at - b.at)
      .slice(0, n)
      .map((r) => ({ ...r, me: r.id === this.docId(lake, wk) }));
    return { lake, name: FLAG_LAKES[lake].name, holder: f?.shown || null, last: !!f?.last, rows, loaded: !!this.docs };
  }

  near() {
    const p = this.game.player.pos;
    if (this.game.player.mode !== 'shore') return null;
    return Object.keys(CAIRNS).find((k) => Math.hypot(p.x - CAIRNS[k].x, p.z - CAIRNS[k].z) < 2.4) || null;
  }

  contextActions() {
    const lake = this.near();
    if (!lake) return [];
    const c = CAIRNS[lake];
    return [{ id: 'cairn', label: 'Read the cairn', at: { x: c.x, z: c.z, y: heightAt(c.x, c.z), h: 3 }, fn: () => this.read(lake) }];
  }

  read(lake) {
    const g = this.game, f = this.flags[lake], s = f.shown, L = FLAG_LAKES[lake];
    g.audio.sfx('page');
    if (!s) { g.ui.toast(`The flag on this cairn belongs to whoever lands the heaviest fish at ${L.name} this week. Nobody has claimed it yet!`, { icon: 'flag', ms: 6000 }); return; }
    const land = s.cc !== 'XX' ? COUNTRY_BY_CODE[s.cc]?.name : null;
    const sp = SPECIES_BY_ID[s.sp]?.name || 'fish';
    const mine = s.id === this.docId(lake);
    const who = mine ? 'Yours' : `${s.name}'s${land ? ` (${land})` : ''}`;
    g.ui.toast(f.last
      ? `${who} flag, from last week: a ${s.w.toFixed(1)} lb ${sp}. Land any fish at ${L.name} this week to plant yours.`
      : `${who} flag: a ${s.w.toFixed(1)} lb ${sp}, the heaviest at ${L.name} this week.${mine ? '' : ' Land a heavier one here to plant your own.'}`, { icon: 'flag', ms: 6500 });
  }

  update(dt) {
    this.t += dt;
    const cam = this.game.engine.camera.position;
    for (const f of Object.values(this.flags)) {
      if (!f.mesh) continue;
      const near = cam.distanceToSquared(f.mesh.position) < 90 * 90;
      f.mesh.visible = near;
      if (!near) continue;
      // a gentle flutter, stronger toward the free edge
      const pos = f.mesh.geometry.attributes.position, a = pos.array, b = f.base;
      for (let i = 0; i < a.length; i += 3) {
        const x = b[i], k = x / FW;
        a[i + 2] = Math.sin(this.t * 4.2 - x * 7) * 0.07 * k + Math.sin(this.t * 2.3 - x * 3) * 0.03 * k;
        a[i + 1] = b[i + 1] - k * k * 0.04;
      }
      pos.needsUpdate = true;
      f.mesh.geometry.computeVertexNormals();
    }
  }
}
