// Tips: a little speech bubble from Gus on the right side of the screen, now and then.
// Closable with its X; "No more tips" turns them off (Settings can turn them back on).
import { h } from './dom.js';
import { icon } from './icons.js';

export const TIPS = [
  'Press Enter to chat. /say talks out loud to anglers near you, with a bubble over your head.',
  'Whisper a friend with /w and their name. Tab finishes names for you.',
  'Press M for the valley map. Feeding schools show up there too.',
  'Each lake has its own fish. Frostpine Lake is cold and deep, Lilymarsh is warm and shallow.',
  'Willow River links Cozy Cove and Lilymarsh. Row under the footbridge to get there.',
  'Every lake has a jetty where you can launch your boat (level 3 and up).',
  'Gus buys fish at the cabin. Diamond fish trade for pearls: pearls are only ever earned by playing, never sold.',
  'Press T to stow your rod on your back while you explore.',
  'Press P for the selfie camera. Snap a polaroid with your latest catch!',
  'The Lake Legends board by the dock shows the three best fish ever caught. Press E there to see who caught them.',
  'Rain and storms make rare fish bolder. So does a full moon.',
  'Fish at dawn and dusk for species that only come out then. Check the Fishpedia (F) for times.',
  'Press R for emotes. Show Off holds up your last catch for everyone to see.',
  'Fishing near friends makes bites come a little faster.',
  'Scroll to zoom, and right-drag (or Q/X) to turn the camera.',
  'Hold both mouse buttons to walk forward, and move the mouse to steer.',
  'Shift sprints, Space hops.',
  'Climb the plateaus for a view over the whole valley.',
  'Press H to visit your cabin. Put your favourite fish in the aquarium and decorate with things from Gus.',
  'Bait changes what bites: crickets for jumpers, minnows for predators, corn dough for bottom feeders. V switches bait.',
  'Crab pots and set lines keep fishing while you are in another window. Buy them from Gus, then face water and press E.',
  'The notice board (B) has three new requests every day, and a local somewhere wants a particular fish.',
  'Light a waystone by walking past it, then travel there from the map (M).',
  'Every hour on the hour there is a 10-minute derby. Heaviest fish wins!',
  'Every catch on the lake fills the Lantern Festival meter. Fill it together for fireworks all week.',
  'Lock your favourite fish in your backpack so Sell all never sells them. You can name them too.',
  'Write a message in a bottle from your Journal. Another angler might fish it up.',
  'Plug in a controller: A casts and reels, X uses things nearby, B backs out.',
  'Catch every fish on a lake’s list (Fishpedia > Collections) for a title and a statue.',
];
// Tips about other anglers, left out in single player: chat, whispers, and fishing near friends.
const SOCIAL_TIPS = new Set([TIPS[0], TIPS[1], 'Fishing near friends makes bites come a little faster.', 'Every hour on the hour there is a 10-minute derby. Heaviest fish wins!']); // (no derbies in single player)

const safe = {
  get(k, d) { try { const v = JSON.parse(localStorage.getItem(k)); return v ?? d; } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* ignore */ } },
};

export class Tips {
  constructor(game, root) {
    this.game = game;
    this.root = root;
    this.el = null;
    this.seen = new Set(safe.get('rt_tips_seen', []));
    this.next = 45; // seconds until the first random tip
  }
  get enabled() { return this.game.profile?.settings?.tips !== false; }

  show(text) {
    this.hide();
    const close = () => this.hide(true);
    this.el = h('div.tip-bubble.paper', { role: 'status' },
      h('div.tip-head', icon('bell'), h('b', 'Tip'), h('button.tip-x', { type: 'button', title: 'Close', 'aria-label': 'Close tip', on: { click: close } }, '×')),
      h('div.tip-text', text),
      h('button.tip-off', { type: 'button', on: { click: () => { this.game.saveSettings({ tips: false }); this.hide(true); this.game.ui.toast('Tips off. Turn them back on in Settings.'); } } }, 'No more tips'));
    this.root.append(this.el);
    this.timer = setTimeout(() => this.hide(), 20000);
  }
  hide(byUser = false) {
    clearTimeout(this.timer);
    if (!this.el) return;
    const el = this.el;
    this.el = null;
    el.classList.add('out');
    setTimeout(() => el.remove(), 250);
    if (byUser) this.next = Math.max(this.next, 240);
  }

  // A fresh tip you haven't seen yet (cycles once all are seen).
  pick() {
    const all = this.game.solo ? TIPS.filter((t) => !SOCIAL_TIPS.has(t)) : TIPS;
    let pool = all.filter((t) => !this.seen.has(t));
    if (!pool.length) { this.seen.clear(); pool = all; }
    const t = pool[Math.floor(Math.random() * pool.length)];
    this.seen.add(t);
    safe.set('rt_tips_seen', [...this.seen]);
    return t;
  }

  update(dt) {
    if (!this.enabled) { if (this.el) this.hide(); return; }
    const g = this.game;
    if (g.fishing?.state === 'reeling' || g.ui?.modalOpen) return; // never during a fight or a menu
    this.next -= dt;
    if (this.next <= 0) { this.show(this.pick()); this.next = 180 + Math.random() * 120; }
  }

  // First visit: the casting tip right away.
  welcome(isNew) {
    if (!this.enabled) return;
    if (isNew && !this.game.solo) { this.seen.add(TIPS[0]); this.show(TIPS[0]); this.next = 90; } // (the chat tip: nothing to say it to in single player)
  }
}
