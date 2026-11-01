// Social extras: the Lake Gazette and Fish of the Week, the mailbox (gifts of bait, or a fish for a
// friend's aquarium), and tandem catches (help a neighbour reel in a big one).
import { SPECIES, SPECIES_BY_ID, TIER_INFO } from '../data/species.js';
import { BAITS } from '../data/bait.js';
import { weekId } from '../core/clock.js';
import { hashString, mulberry32 } from '../core/rng.js';

/** Pure: the Fish of the Week (the same for everyone). */
export function fishOfWeek(week = weekId()) {
  const pool = SPECIES.filter((s) => ['common', 'uncommon', 'rare'].includes(s.tier) && !s.shell && !s.spots && !s.lakeFish);
  return pool[Math.floor(mulberry32(hashString(`fotw:${week}`))() * pool.length)];
}

const MAIL_MAX = 140;

export class Social {
  constructor(game) { this.game = game; this.mail = []; this.tandem = null; this.helpOffer = null; }

  init() {
    const g = this.game;
    this.unsub = g.shared.watch('mail', (docs) => {
      const me = g.save.userId;
      const before = this.inbox().length;
      this.mail = docs.filter((d) => d && d.to === me && !d.claimed && (d.kind === 'bait' || d.kind === 'fish')).slice(0, 30);
      const n = this.inbox().length;
      if (n > before && this.ready) { g.ui.toast(`You've got mail! ${n} gift${n > 1 ? 's' : ''} at the notice board (B).`, { icon: 'chat', ms: 5000 }); g.audio.sfx('bell'); }
      this.ready = true;
      if (g.ui.sheets.current?.name === 'board') g.ui.sheets.refresh();
    }, { limit: 300 });
    // tandem catches over the network
    const net = g.net;
    if (!net) return;
    // a friend nearby is taking a group selfie: smile (well, wave) for the camera
    net.on('ev:groupSelfie', ({ from, data, peer }) => {
      const r = g.remotes.list.get(from);
      if (!r || r.pos.distanceTo(g.player.pos) > 10 || g.selfie?.active) return;
      const name = String(peer?.meta?.name || 'A friend').slice(0, 20);
      if (data?.snap) { g.ui.toast(`Snap! ${name} took a group selfie with you.`, { icon: 'camera' }); return; }
      g.ui.toast(`${name} is taking a group selfie. Smile!`, { icon: 'camera', ms: 4000 });
      if (!g.fishing.busy) g.emote(Math.random() < 0.5 ? 'wave' : 'cheer');
    });
    net.on('ev:tandem', ({ from, data, peer }) => {
      if (!data || g.fishing.busy) return;
      const r = g.remotes.list.get(from);
      if (!r || r.pos.distanceTo(g.player.pos) > 14) return;
      this.helpOffer = { from, name: String(peer?.meta?.name || 'A friend').slice(0, 20), until: performance.now() + 8000, fish: SPECIES_BY_ID[data.speciesId]?.name || 'a big one' };
      g.ui.toast(`${this.helpOffer.name} hooked ${this.helpOffer.fish}! Press E to help reel.`, { icon: 'fish', title: 'Tandem catch', ms: 6000 });
    });
    net.on('ev:tandemJoin', ({ data, peer }) => {
      if (!data || data.to !== g.save.userId || g.fishing.state !== 'reeling' || !g.fishing.reel || g.fishing.reel.junk) return;
      const r = g.fishing.reel;
      if (r.helped) return;
      r.helped = String(data.from || '');
      r.perk += 0.35; r.stamina = Math.max(0.12, r.stamina - 0.25);
      this.tandem = { helper: r.helped, name: String(peer?.meta?.name || 'A friend').slice(0, 20) };
      g.juice?.pop('Tandem!', { color: '#8ae0ff', size: 32 });
      g.ui.toast(`${this.tandem.name} grabbed your line! Reeling together.`, { icon: 'smile' });
    });
    net.on('ev:tandemDone', ({ data }) => {
      if (!data || data.to !== g.save.userId) return;
      const sp = SPECIES_BY_ID[data.speciesId];
      g.chat?.system(`You helped land a ${sp?.name || 'big fish'}! Teamwork bonus.`, 'catch', { popup: true });
      g.reward('tandem', `t${data.key}`, { coins: 40, xp: 30 }, 'Tandem catch');
      g.ext.bump('tandems');
    });
  }

  // ---- tandem: called when you hook something big, and when you land it
  onHook(bite) {
    const g = this.game;
    const sp = SPECIES_BY_ID[bite.speciesId];
    if (!sp) return;
    const big = ['epic', 'legendary', 'mythic'].includes(sp.tier) || bite.variant !== 'normal' || bite.weight >= sp.weight[0] + (sp.weight[1] - sp.weight[0]) * 0.7;
    if (big && g.remotes.within(g.player.pos, 14) > 0) g.netEvent('tandem', { speciesId: sp.id });
    this.tandem = null;
  }
  onLanded(c) {
    const g = this.game;
    if (!this.tandem?.helper) return;
    g.netEvent('tandemDone', { to: this.tandem.helper, speciesId: c.speciesId, key: c.id });
    g.reward('tandem', `h${c.id}`, { coins: 25, xp: 20 }, `Landed with ${this.tandem.name}`);
    g.ext.bump('tandems');
    this.tandem = null;
  }
  contextActions() {
    const o = this.helpOffer;
    if (!o || performance.now() > o.until) { this.helpOffer = null; return []; }
    return [{ id: `help-${o.from}`, label: `Help ${o.name} reel!`, color: 'gold', fn: () => this.help() }];
  }
  help() {
    const g = this.game, o = this.helpOffer;
    if (!o) return;
    g.netEvent('tandemJoin', { to: o.from, from: g.save.userId });
    g.emote('cheer');
    this.helpOffer = null;
  }

  // ---- the mailbox
  inbox() { return this.mail.filter((m) => !(this.game.ext.d.mailTaken || []).includes(m.id)); }

  async send(to, toName, gift) {
    const g = this.game;
    if (!to || to === g.save.userId) return { error: 'Pick someone else on the lake.' };
    const note = String(gift.note || '').replace(/[\u0000-\u001f<>]/g, '').slice(0, MAIL_MAX);
    if (gift.kind === 'bait') {
      const b = BAITS[gift.id];
      const n = Math.max(1, Math.min(20, Math.floor(gift.n || 5)));
      if (!b || g.tackle.count(gift.id) < n) return { error: `You need ${n} ${b?.name || 'bait'}.` };
      g.ext.change((d) => { d.bait[gift.id] -= n; });
      gift = { kind: 'bait', bait: gift.id, n };
    } else if (gift.kind === 'fish') {
      const c = [...g.profile.creel, ...g.profile.storage].find((x) => x.id === gift.catchId);
      if (!c) return { error: 'That fish is gone.' };
      if (g.ext.d.locked.includes(c.id)) return { error: 'Unlock that fish first.' };
      const ok = await g.save.give(c.id);
      if (!ok) return { error: "Couldn't wrap that one up." };
      gift = { kind: 'fish', speciesId: c.speciesId, variant: c.variant, weight: c.weight };
    } else return { error: 'Nothing to send.' };
    const id = `${to}_${Date.now().toString(36)}`;
    const ok = await g.shared.set('mail', id, { to, from: g.save.userId, fromName: g.profile.name.slice(0, 20), toName: String(toName || '').slice(0, 20), at: Date.now(), note, claimed: false, ...gift });
    if (!ok) return { error: "The mailbox is jammed (this view can't send mail)." };
    g.ext.bump('giftsSent');
    g.audio.sfx('page');
    return { ok: true };
  }

  async open(m) {
    const g = this.game;
    if ((g.ext.d.mailTaken || []).includes(m.id)) return;
    g.ext.change((d) => { d.mailTaken = [...(d.mailTaken || []), m.id].slice(-200); });
    await g.shared.update('mail', m.id, { claimed: true });
    if (m.kind === 'bait' && BAITS[m.bait]) {
      const n = Math.max(1, Math.min(20, Math.floor(Number(m.n) || 1)));
      g.ext.change((d) => { d.bait[m.bait] = (d.bait[m.bait] || 0) + n; });
      g.ui.toast(`${m.fromName || 'A friend'} sent you ${n} ${BAITS[m.bait].name}!`, { icon: 'worm' });
    } else if (m.kind === 'fish' && SPECIES_BY_ID[m.speciesId]) {
      // gifted fish go to your aquarium (a guest of honour, not a sale)
      const sp = SPECIES_BY_ID[m.speciesId];
      const variant = ['normal', 'gold', 'diamond'].includes(m.variant) ? m.variant : 'normal';
      const weight = Math.min(sp.weight[1], Math.max(sp.weight[0], Number(m.weight) || sp.weight[0]));
      g.ext.change((d) => {
        const cap = d.home.decor.includes('tank2') ? 8 : 4;
        const tank = d.home.tank.length >= cap ? d.home.tank.slice(1) : d.home.tank;
        d.home.tank = [...tank, { id: `gift-${m.id}`, speciesId: sp.id, variant, weight, from: String(m.fromName || '').slice(0, 20) }];
      });
      g.ui.toast(`${m.fromName || 'A friend'} sent you a ${variant !== 'normal' ? `${variant} ` : ''}${sp.name}! It's swimming in your cabin's aquarium.`, { icon: 'home', ms: 5000 });
      g.pushMeta();
    }
    g.ext.bump('giftsReceived');
  }

  // ---- the Lake Gazette
  gazette() {
    const g = this.game;
    const fotw = fishOfWeek();
    const lines = [];
    const legends = g.trophies?.list || [];
    if (legends[0]) lines.push(`LEGEND: ${legends[0].name}'s ${legends[0].variant !== 'normal' ? `${legends[0].variant} ` : ''}${SPECIES_BY_ID[legends[0].speciesId]?.name} (${legends[0].weight} lb) still tops the Lake Legends board.`);
    const cm = g.community;
    if (cm) lines.push(cm.festival ? `FESTIVAL: Lanterns are up! The lake filled the meter with ${cm.total} catches this week.` : `METER WATCH: ${cm.total} of 300 catches toward this week's Lantern Festival.`);
    const ev = g.events?.current;
    if (ev) lines.push(`SKY: ${ev === 'meteor' ? 'Shooting stars tonight, anglers report bolder rare fish.' : ev === 'fog' ? 'Fog over the cove and a glow over the old ruins.' : 'Fish are pouring through the cove this morning.'}`);
    const wins = g.ext.d.derby.wins || 0;
    lines.push(wins ? `DERBIES: You have won ${wins} derb${wins > 1 ? 'ies' : 'y'}. The next one starts on the hour.` : 'DERBIES: A 10-minute derby starts every hour on the hour. Heaviest fish wins.');
    if (g.living) lines.push(`SEASON: ${g.living.season[0].toUpperCase()}${g.living.season.slice(1)} on the lake.`);
    lines.push(`GUS SAYS: "${['Bait changes what bites. Crickets for jumpers!', 'Set a crab pot before you head off.', 'Lock your favourite fish so you never sell it by mistake.', 'Fish jumping? Cast right where it splashed.'][Math.floor(Date.now() / 3600000) % 4]}"`);
    return { fotw, tier: TIER_INFO[fotw.tier], lines, caught: !!g.ext.d.fotw?.[weekId()] };
  }

  /** First Fish of the Week catch pays a bonus. */
  onCatch(c) {
    const g = this.game, wk = weekId(), f = fishOfWeek(wk);
    if (c.speciesId !== f.id || g.ext.d.fotw?.[wk]) return;
    g.ext.change((d) => { d.fotw = { [wk]: Date.now() }; });
    g.juice?.pop('Fish of the Week!', { color: '#ffd060', size: 30 });
    g.reward('fotw', wk, { coins: 120, xp: 60 }, `Fish of the Week: ${f.name}`);
  }
}
