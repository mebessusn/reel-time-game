// Messages in bottles written by real players. One a day each, 120 characters, no links, numbers or
// strong language; anyone who finds one can report it, and two reports sink it for good. Bottles are
// anonymous: only the message travels.
import { STRONG } from '../ui/chat.js';
import { today } from './quests.js';

export const BOTTLE_MAX = 120;

/** Pure: why a message can't go in a bottle, or null when it's fine. Also returns the cleaned text. */
export function checkBottle(raw) {
  const text = String(raw || '').replace(/[\u0000-\u001f\u007f​-‏‪-‮⁠-⁯﻿]/g, '').replace(/\s+/g, ' ').trim();
  if (text.length < 4) return { error: 'Write a little more.' };
  if (text.length > BOTTLE_MAX) return { error: `Keep it under ${BOTTLE_MAX} characters.` };
  if (/(https?:|www\.|\.com|\.net|\.org|\.gg|discord|@[a-z0-9_]{2,})/i.test(text)) return { error: 'No links or handles in bottles.' };
  if (/\d[\d\s().-]{6,}\d/.test(text) || /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i.test(text)) return { error: 'No phone numbers or emails in bottles.' };
  const flat = text.toLowerCase().replace(/[^a-z]/g, '');
  if (STRONG.some((w) => flat.includes(w))) return { error: 'Let’s keep the lake friendly.' };
  if (/(.)\1{6,}/.test(text)) return { error: 'That looks like keyboard mashing.' };
  return { text };
}

/** Pure: keep only bottles fit to show. */
export function readableBottles(docs, myIds = new Set(), hidden = new Set()) {
  return docs.filter((d) => d && typeof d.text === 'string' && !checkBottle(d.text).error && (Number(d.reports) || 0) < 2 && !myIds.has(d.id) && !hidden.has(d.id));
}

export class Bottles {
  constructor(game) { this.game = game; this.docs = []; }
  init() { this.unsub = this.game.shared.watch('bottles', (docs) => { this.docs = docs; }, { limit: 300 }); }

  get d() { return this.game.ext.d.bottle; }
  canWrite() { return this.d.lastDay !== today(); }
  mine() { return new Set(Object.keys(this.game.ext.d.bottle.mine || {})); }

  async write(raw) {
    const g = this.game;
    if (!this.canWrite()) return { error: 'You already sent a bottle today. The tide comes back tomorrow.' };
    const c = checkBottle(raw);
    if (c.error) return c;
    const id = `${g.save.userId}_${today()}`.replace(/[^\w-]/g, '_');
    const ok = await g.shared.set('bottles', id, { text: c.text, at: Date.now(), day: today(), reports: 0 });
    if (!ok) return { error: "Couldn't send it out (this view can't write to the lake)." };
    g.ext.change((d) => { d.bottle.lastDay = today(); d.bottle.mine = { ...(d.bottle.mine || {}), [id]: 1 }; });
    g.ext.bump('bottlesSent');
    return { ok: true };
  }

  /** A random player bottle to find, or null. */
  find() {
    const hidden = new Set(this.d.hidden || []);
    const list = readableBottles(this.docs, this.mine(), hidden);
    if (!list.length) return null;
    const b = list[Math.floor(Math.random() * list.length)];
    return { id: b.id, text: b.text, at: b.at };
  }

  async report(b) {
    const g = this.game;
    g.ext.change((d) => { d.bottle.hidden = [...(d.bottle.hidden || []), b.id].slice(-200); });
    const doc = this.docs.find((x) => x.id === b.id);
    await g.shared.update('bottles', b.id, { reports: (Number(doc?.reports) || 0) + 1 });
  }
}
