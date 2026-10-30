// Open Waters (v1.15.5): Smuggler's Rock's secrets. Behind the rock arch a channel runs into the cliff to a hidden
// lagoon and a pocket beach under a rock roof (geo.js GROTTO). The smugglers left more than crates: search the crates on
// the beach (once a trip) or fish round the rock, and now and then a smugglers' map turns up. It uses the valley's
// treasure system (game/treasure.js): the X is on the grotto's beach, and a shovel digs up a richer chest.
import { GROTTO, DOCKS, oceanSurfaceY, oceanRegionName } from './geo.js';

const MAP_ON_CATCH = 0.06, MAP_IN_CRATES = 0.6;

export class Smugglers {
  constructor(game, ow) {
    this.game = game; this.ow = ow;
    game.treasure.seaSketch = (c, cx, cz, span) => this.sketch(c, cx, cz, span);
    // the camera comes in close under the grotto's roof
    const valleyFit = game.engine.camFit;
    game.engine.camFit = (tx, ty, tz, x, y, z) => {
      if (tx > 1200) { const mid = this.mid(), d = Math.hypot(tx - mid.x, tz - mid.z); if (d < 8 && ty < 5) return Math.min(1, 3.4 / (Math.hypot(x - tx, y - ty, z - tz) || 1)); return 1; }
      return valleyFit ? valleyFit(tx, ty, tz, x, y, z) : 1;
    };
  }
  mid() { const L = GROTTO.lagoon, B = GROTTO.beach; return { x: (L.x + B.x) / 2, z: (L.z + B.z) / 2 }; }
  get crates() { const D = DOCKS.smuggler; return { x: D.x0 - D.ux * 2 + D.side.x * 3, z: D.z0 - D.uz * 2 + D.side.z * 3 }; }
  spot() { const B = GROTTO.beach, a = Math.random() * Math.PI * 2, r = Math.random() * 1.2; return { x: +(B.x + Math.cos(a) * r).toFixed(1), z: +(B.z + Math.sin(a) * r).toFixed(1) }; }
  give() { return this.game.treasure.grantAt(this.spot(), "Smuggler's Rock"); }

  /** A fish landed near the rock: maybe a map in its mouth. */
  onCatch() {
    const g = this.game, b = g.fishing.bobber || g.player.pos;
    if (g.treasure.map || oceanRegionName(b.x, b.z) !== "Smuggler's Rock") return;
    if (Math.random() < MAP_ON_CATCH * (g.forceTreasure ? 100 : 1)) this.give();
  }
  contextActions() {
    const g = this.game, p = g.player.pos, c = this.crates, ch = this.ow.charter;
    if (!ch || Math.hypot(p.x - c.x, p.z - c.z) > 3 || this.game.ext.d.ocean?.crates === ch.id) return [];
    return [{ id: 'crates', label: 'Search the crates', color: 'gold', fn: () => this.search() }];
  }
  search() {
    const g = this.game;
    g.ext.change((d) => { d.ocean.crates = this.ow.charter?.id || 1; });
    g.audio.sfx('dirt');
    if (!g.treasure.map && Math.random() < MAP_IN_CRATES) { this.give(); return; }
    g.ui.toast('Salt cod, a tangle of old rope and a broken lantern. Nothing worth keeping this time.', { icon: 'package', ms: 4500 });
  }
  /** First time in the grotto: a journal line. */
  update() {
    const g = this.game, p = g.player.pos, m = this.mid();
    if (this.game.ext.d.ocean?.grotto || Math.hypot(p.x - m.x, p.z - m.z) > 6) return;
    g.ext.change((d) => { d.ocean.grotto = Date.now(); });
    g.chat.system("Journal: through the arch on Smuggler's Rock, a hidden grotto: a lagoon, a pocket beach and two old lanterns still hanging. Someone used to land things here.", 'info', { popup: true });
    g.audio.sfx('achievement');
  }
  /** The map's sketch: the island drawn from its heights, in ink on old paper. */
  sketch(c, cx, cz, span) {
    const N = 120, px = 360 / N;
    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
      const x = cx - span / 2 + (i + 0.5) * span / N, z = cz - span / 2 + (j + 0.5) * span / N, y = oceanSurfaceY(x, z);
      const v = y > 6 ? 70 : y > 0.85 ? 150 : y > -3 ? 190 : 215;
      c.fillStyle = `rgb(${v},${v},${v})`;
      c.fillRect(i * px, j * px, px + 0.5, px + 0.5);
    }
  }
}
