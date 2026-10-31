// Open Waters test kit: only in the private test build (npm run build:test-artifact, RT_TESTKIT=1) or with ?testkit
// on the dev server. A brass button with shortcuts for playtesting: level 20 and coins, the free trip again, straight
// to sea, the weather, a quick bite. Never in a public build.
import { h } from '../ui/dom.js';
import { icon } from '../ui/icons.js';
import { xpForLevel, levelForXp } from '../game/rules.js';
import { setDebugWeather, setDebugTime } from '../core/clock.js';

export function installTestKit(game) {
  const g = game;
  let panel = null;
  const close = () => { panel?.remove(); panel = null; };
  const act = (label, fn) => h('button.btn.small.blue', { on: { click: async () => { await fn(); g.ui.refresh?.(); } } }, label);
  const open = () => {
    if (panel) { close(); return; }
    const w = (x) => act(x[0].toUpperCase() + x.slice(1), () => { setDebugWeather(x); g.ui.toast(`Weather: ${x}`, { icon: x === 'clear' ? 'sun' : x === 'overcast' ? 'cloud' : x }); });
    panel = h('div.ow-modal.plank.ow-testkit', { style: { top: '70px', transform: 'translateX(-50%)' } },
      h('div.ow-head', h('span.ow-badge', icon('wrench')), h('div', h('b', 'Test kit'), h('span', 'Private test build only'))),
      h('div.ow-acts',
        act('Level 25 + 20,000 coins', async () => {
          const p = g.profile;
          if (p.level < 25) { p.xp = Math.max(p.xp || 0, xpForLevel(25)); p.level = levelForXp(p.xp); }
          p.coins += 20000;
          g.save.persist?.();
          g.pushMeta(); g.ocean.checkUnlock(); g.north?.checkUnlock?.();
          g.ui.toast(`Level ${p.level}, ${p.coins.toLocaleString()} coins.`, { icon: 'coin' });
        }),
        act('Free trip again', () => { g.ext.change((d) => { d.ocean.freeUsed = false; }); g.ui.toast('Your next charter is free.'); }),
        act('Sail now', () => { close(); if (g.ocean.charter) g.ui.toast('Already at sea.'); else if (g.profile.level < 20) g.ui.toast('Level 20 first (button above).'); else g.ocean.ui.charterCard(); }),
        act('Quick bite', () => { const f = g.fishing; if (f.state === 'waiting') { f.timer = 1.7; g.ui.toast('Something\'s circling...'); } else g.ui.toast('Cast first, then press this.'); }),
        act('Whale now', () => { if (!g.ocean.life.summon('whale')) g.ui.toast('Go to sea first (and away from the islands).'); }),
        act('Dolphins now', () => { if (!g.ocean.life.summon('dolphins')) g.ui.toast('Go to sea first.'); }),
        act('Birds now', () => { if (!g.ocean.life.summon('birds')) g.ui.toast('Go to sea first.'); }),
        // Frostmere (v1.16)
        act('Fly north now', () => { close(); if (g.north?.here) g.ui.toast('Already up north.'); else if (g.profile.level < 25) g.ui.toast('Level 25 first (button above).'); else if (g.ocean?.charter) g.ui.toast('Come home from sea first.'); else g.north.board('north'); }),
        act('Teleport to Hearthwick', () => { close(); if (g.north?.here) g.ui.toast('Already up north.'); else if (g.ocean?.charter) g.ui.toast('Come home from sea first.'); else g.north.teleportTown(); }),
        // Skye's Air Races (v1.17)
        act('Air races', () => { close(); if (g.profile.level < 25) { g.ui.toast('Level 25 first (button above).'); return; } g.ext.change((d) => { d.north.flights = Math.max(1, d.north.flights || 0); }); g.north?.air?.open(); }),
        act('Unlock all air races', () => { g.ext.change((d) => { d.north.flights = Math.max(1, d.north.flights || 0); d.air.testAll = !d.air.testAll; }); g.ui.toast(g.ext.d.air.testAll ? 'Every circuit, class, plane and paint is open (test kit).' : 'Air races back to normal unlocks.'); }),
        act('Northern lights', () => { const S = g.north?.sky; if (!S) return; S.force = !S.force; g.ui.toast(S.force ? 'The aurora comes out on any clear night (go to night with the weather clear).' : 'The aurora follows its own nights again.'); }),
        act('Night', () => { setDebugTime(0.02); g.ui.toast('Midnight (Clear the clock to go back).', { icon: 'moon' }); }),
        act('Day', () => { setDebugTime(0.45); g.ui.toast('Midday.', { icon: 'sun' }); }),
        act('Clear the clock', () => { setDebugWeather(null); setDebugTime(null); g.ui.toast('Weather follows the clock again.'); })),
      h('p.ow-note', 'Weather (affects the sea, bites and the fight):'),
      h('div.ow-acts', ['clear', 'overcast', 'rain', 'storm'].map(w)),
      h('button.btn.close-x.ghost.on-dark', { 'aria-label': 'Close', on: { click: close } }, icon('close')));
    g.ui.root.append(panel);
  };
  const btn = h('button.btn.gold.small.ow-testkit-btn', { title: 'Test kit', on: { click: open } }, icon('wrench'), 'Test kit');
  Object.assign(btn.style, { position: 'absolute', right: '12px', top: '96px', zIndex: 25, pointerEvents: 'auto' });
  g.ui.root.append(btn);
}
