// v1.14.9 The Wild Woods: its pages in the sheets (the Field Guide, the Valley Journal, Wren's Wagon, the Ridgeback
// Loop board) and the Woods tab in the Journal. Added onto Sheets so they open like any other sheet.
import { h } from './dom.js';
import { icon } from './icons.js';
import { Sheets } from './sheets.js';
import { GUIDE, GUIDE_SETS, PAGES, FORAGE, PANTRY, STEW, SECRET_WATERS, PAGES_ALL, GUIDE_ALL } from '../data/woodsdata.js';
import { POOLS } from '../world/terrain.js';
import { fmtTime } from '../game/wildwoods.js';

const priceTxt = (p) => (p.coins ? `${p.coins.toLocaleString()} coins` : `${p.pearls} pearls`);
const rewardTxt = (r) => [r.coins && `${r.coins} coins`, r.pearls && `${r.pearls} pearls`, r.xp && `${r.xp} XP`, r.title && `title “${r.title}”`].filter(Boolean).join(', ');

Sheets.prototype.render_woodsTab = function (c) {
  const g = this.game, W = g.woods, d = W?.d;
  const B = c.body;
  if (!W || !d) { B.append(h('div.empty', 'The woods are still waking up.')); return; }
  const found = g.ext.d.found || {};
  const pools = Object.entries(POOLS).map(([id, P]) => ({ id, name: P.name, have: !!found[`pool-${id}`] }));
  const row = (ic, ttl, meta, btn) => h('div.list-row', icon(ic), h('div.grow', h('div.ttl', ttl), h('div.meta', meta)), btn || null);
  B.append(h('div.section-title', 'The Wild Woods'));
  B.append(row('camera', `Field Guide: ${Object.keys(d.guide).length}/${GUIDE.length}`, 'Photograph the valley\'s wildlife (E when one is close and in view).', h('button.btn.small', { on: { click: () => this.open('fieldguide') } }, 'Open')));
  B.append(row('scroll', `Valley Journal: ${Object.keys(d.pages).length}/${PAGES.length} pages`, 'Elias Fenn\'s journal, blown all over the woods.', h('button.btn.small', { on: { click: () => this.open('valleyjournal') } }, 'Read')));
  B.append(row('waves', `Secret Waters: ${pools.filter((p) => p.have).length}/${pools.length}`, `${pools.map((p) => (p.have ? p.name : '???')).join(' · ')}. All four: ${rewardTxt(SECRET_WATERS)}.`));
  B.append(row('leaf', 'Pantry', `${PANTRY.map((k) => `${W.pantry(k)} ${FORAGE[k].name.toLowerCase()}`).join(' · ')}. A stew takes ${Object.entries(STEW.need).map(([k, n]) => `${n} ${FORAGE[k].name.toLowerCase()}`).join(', ')}; cook it at any campfire.`));
  B.append(row('bike', `Ridgeback Loop: ${d.loopBest ? `best ${fmtTime(d.loopBest)}` : 'no lap yet'}`, 'Ride a bike through the start gate, all six arches in order, and back through the gate.', h('button.btn.small', { on: { click: () => this.open('loop') } }, 'Times')));
  B.append(row('tent', d.camp ? 'Your camp is pitched' : 'No camp pitched', 'Press E in the woods (away from water, trails and towns) to pitch a tent and a fire. Friends can roast fish at it.'));
  const tasks = W.rangerTasks();
  B.append(h('div.section-title', 'Ranger Rhea\'s jobs today'));
  for (const T of tasks) B.append(row(T.done ? 'check' : 'target', T.text, `${T.have}/${T.n} · ${rewardTxt(T.reward)}`));
  B.append(h('div.muted', { style: { marginTop: '6px' } }, 'Ranger Rhea is at Ridge Lookout in the west hills; she also sells the Willowbend Fly Rod for the creeks.'));
};

Sheets.prototype.render_fieldguide = function (c) {
  const g = this.game, W = g.woods, have = W?.d.guide || {};
  c.title.textContent = 'Field Guide';
  c.body.append(h('div.muted', { style: { marginBottom: '8px' } }, `Get close to an animal with it in view and press E to photograph it. Each set of four: ${rewardTxt(GUIDE_SETS.woods.reward)}. All twelve: ${rewardTxt(GUIDE_ALL)}.`));
  for (const [set, S] of Object.entries(GUIDE_SETS)) {
    const list = GUIDE.filter((x) => x.set === set);
    c.body.append(h('div.section-title', `${S.name} ${list.filter((x) => have[x.id]).length}/${list.length}${W?.d.sets[set] ? ' ✓' : ''}`));
    const grid = h('div.guide-grid');
    for (const e of list) grid.append(h(`div.guide-card${have[e.id] ? '.have' : ''}`, h('div.guide-ic', icon(have[e.id] ? 'camera' : 'help')), h('b', have[e.id] ? e.name : '???'), h('small', e.desc)));
    c.body.append(grid);
  }
};

Sheets.prototype.render_valleyjournal = function (c) {
  const g = this.game, W = g.woods, have = W?.d.pages || {};
  c.title.textContent = 'The Valley Journal';
  const sel = this.state.journalPage && have[this.state.journalPage] ? this.state.journalPage : PAGES.find((p) => have[p.id])?.id;
  c.body.append(h('div.muted', { style: { marginBottom: '8px' } }, `Pages of Elias Fenn's journal, the trapper who first mapped the valley. ${Object.keys(have).length}/${PAGES.length} found. All eight: ${rewardTxt(PAGES_ALL)}. Old Hollis knows where some blew to.`));
  const list = h('div.vj-list');
  PAGES.forEach((p, i) => list.append(h(`button.vj-tab${p.id === sel ? '.on' : ''}${have[p.id] ? '' : '.missing'}`, { disabled: !have[p.id], on: { click: () => { this.state.journalPage = p.id; this.render(); } } }, have[p.id] ? `${i + 1}. ${p.title}` : `${i + 1}. ???`)));
  c.body.append(list);
  const P = PAGES.find((p) => p.id === sel);
  c.body.append(P ? h('div.vj-page.paper', h('h3', P.title), h('p', P.text), h('small', '— E. Fenn')) : h('div.empty', 'No pages yet. Look for loose paper fluttering round the woods\' landmarks.'));
};

Sheets.prototype.render_wagon = function (c) {
  const g = this.game, W = g.woods;
  c.title.textContent = "Wren's Wagon";
  if (!W) return;
  const stop = W.wagonStop(), mins = Math.max(1, Math.round((stop.leaves - Date.now()) / 60000));
  c.body.append(h('div.muted', { style: { marginBottom: '8px' } }, `A quarter off three things from Gus's shelves, different at every stop. Wren moves on in ${mins >= 60 ? `${Math.floor(mins / 60)} h ${mins % 60} min` : `${mins} min`}.`));
  c.body.append(h('div.section-title', 'For sale'));
  for (const e of W.wagonStock || []) {
    const own = g.profile.owned.includes(e.item.id), lvl = e.item.level && g.profile.level < e.item.level;
    c.body.append(h('div.list-row', icon(e.item.kind === 'rod' ? 'rod' : e.item.kind === 'lure' ? 'hook' : e.item.kind === 'hat' ? 'crown' : 'shirt'),
      h('div.grow', h('div.ttl', e.item.name), h('div.meta', `${priceTxt(e.price)} (Gus: ${priceTxt(e.item.price)})${lvl ? ` · level ${e.item.level}` : ''}`)),
      own ? h('span.ic-tag', 'Yours') : h('button.btn.gold.small', { disabled: !!lvl || (g.profile.coins || 0) < e.price.coins, on: { click: () => this.act(() => W.buyFromWagon(e)) } }, 'Buy')));
  }
  c.body.append(h('div.section-title', 'Wren buys'));
  for (const k of PANTRY) c.body.append(h('div.list-row', icon('leaf'), h('div.grow', h('div.ttl', FORAGE[k].name), h('div.meta', `${FORAGE[k].sell} coins each · you have ${W.pantry(k)}`))));
  c.body.append(h('button.btn.gold', { style: { marginTop: '8px' }, on: { click: () => this.act(() => W.sellPantry()) } }, icon('coin'), 'Sell my pantry (keeps enough for a stew)'));
};

Sheets.prototype.render_loop = function (c) {
  const g = this.game, W = g.woods;
  c.title.textContent = 'Ridgeback Loop';
  if (!W) return;
  c.body.append(h('div.muted', { style: { marginBottom: '8px' } }, 'Ride a bike through the start gate, all six flag arches in order, and back through the gate. Hit the dirt jumps fast to fly. The board resets every Monday.'));
  c.body.append(h('div.list-row.me', icon('bike'), h('div.grow', h('div.ttl', 'Your best'), h('div.meta', W.d.loopBest ? fmtTime(W.d.loopBest) : 'No lap yet'))));
  c.body.append(h('div.section-title', 'This week'));
  if (!W.board?.length) c.body.append(h('div.empty', 'No times yet this week. Be the first!'));
  (W.board || []).forEach((e, i) => c.body.append(h('div.list-row', h('span.num', `${i + 1}`), h('div.grow', h('div.ttl', e.name)), h('span.num', fmtTime(e.t)))));
};
