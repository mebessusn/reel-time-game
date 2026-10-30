// Open Waters (v1.15.5): the charter's fish finder. A little sonar screen in the corner while you're aboard: the sea
// floor scrolling under the hull, the depth, and marks for what's down there (from the fish that live here right now).
// Big-game fish show as big arches; a hammerhead hunting near the islands at dusk shows as a big dark shadow.
import { h } from '../ui/dom.js';
import { oceanSurfaceY } from './geo.js';
import { eligibleSpecies } from '../game/rules.js';

const W = 168, H = 86, WATER_Y = 0.85, MAXD = 40;

export class FishFinder {
  constructor(game, ow) {
    this.game = game; this.ow = ow;
    this.cv = h('canvas', { width: W, height: H });
    this.label = h('span.ow-sonar-d', '');
    this.alert = h('span.ow-sonar-a', '');
    this.el = h('div.ow-sonar', { 'aria-label': 'Fish finder' }, this.cv, this.label, this.alert);
    this.t = 0; this.shadowT = 0;
  }
  pool() {
    const g = this.game, ow = this.ow, P = ow.boat.pose, wt = g.engine.sky.state;
    const zone = ow.zoneHere({ x: P.x, z: P.z });
    return eligibleSpecies(null, { zone, phase: wt.phase, weather: wt.weather, ocean: true });
  }
  update(dt) {
    const g = this.game, ow = this.ow;
    const show = ow.atSea && !!ow.charter && !ow.dive.on && ow.boat.deckY(g.player.pos.x, g.player.pos.z) != null && !g.ui.modalOpen;
    if (show && !this.el.isConnected) g.ui.root.append(this.el);
    if (!show) { if (this.el.isConnected) this.el.remove(); return; }
    this.t -= dt; this.shadowT = Math.max(0, this.shadowT - dt);
    if (this.t > 0) return;
    this.t = 1 / 6;
    const c = this.cv.getContext('2d'), P = ow.boat.pose;
    // scroll left and draw the new column
    c.drawImage(this.cv, -2, 0);
    const depth = Math.max(1, WATER_Y - oceanSurfaceY(P.x, P.z)), yOf = (d) => Math.min(H - 1, (d / MAXD) * H);
    const sea = c.createLinearGradient(0, 0, 0, H); sea.addColorStop(0, '#0d3a4a'); sea.addColorStop(1, '#06202a');
    c.fillStyle = sea; c.fillRect(W - 2, 0, 2, H);
    c.fillStyle = '#c89a3a'; c.fillRect(W - 2, yOf(depth), 2, H - yOf(depth));
    c.fillStyle = '#e8d070'; c.fillRect(W - 2, yOf(depth), 2, 1.5);
    const pool = this.pool(), big = pool.filter((s) => s.big);
    const hammer = pool.some((s) => s.id === 'hammerhead');
    const fishDepth = () => 2 + Math.random() * Math.max(1, Math.min(depth - 2, MAXD - 4));
    if (Math.random() < 0.08 + pool.length * 0.02) { c.fillStyle = '#7fe0a0'; c.fillRect(W - 2, yOf(fishDepth()), 2, 2); } // small fish
    if (big.length && Math.random() < 0.05) this.arch(c, yOf(fishDepth()), '#ffd060'); // something big
    if (hammer && Math.random() < 0.04) { this.blob(c, yOf(Math.min(depth - 3, 8 + Math.random() * 10))); this.shadowT = 4; }
    this.label.textContent = `${depth.toFixed(0)} m`;
    this.alert.textContent = this.shadowT > 0 ? 'Big shadow below!' : big.length ? '' : '';
  }
  arch(c, y, col) { c.strokeStyle = col; c.lineWidth = 2; c.beginPath(); c.arc(W - 9, y + 4, 7, Math.PI * 1.1, Math.PI * 1.9); c.stroke(); }
  blob(c, y) { c.fillStyle = 'rgba(10, 10, 14, .9)'; c.beginPath(); c.ellipse(W - 16, y, 15, 5, 0, 0, Math.PI * 2); c.fill(); c.strokeStyle = '#ff8a6a'; c.lineWidth = 1; c.stroke(); }
}
