// Open Waters stage 5: what you've done at sea, and what it earns.
// - Achievements: the sea keeps its own counters (grand slams, billfish released, reef fish speared, beach games won,
//   breaches) and hands them to the profile's achievement stats (rules.setOceanStats).
// - The grand slam: a sailfish, a blue marlin and a swordfish on one charter.
// - Tag and release: land a sailfish or a marlin and you can let it go for bonus XP and a "Released" badge.
// - Cottage trophies: your first marlin, shark and giant squid send a mount home; the Open Waters collection (all 24
//   fish) earns the ship in a bottle.
import { h } from '../ui/dom.js';
import { icon } from '../ui/icons.js';
import { SPECIES_BY_ID, TIER_INFO, tierOf } from '../data/species.js';
import { OCEAN_SPECIES } from '../data/oceanSpecies.js';
import { fishThumb } from '../ui/thumbs.js';

import { BILLFISH, SLAM, SPEARABLE, MOUNTS, OW_SET, releaseXp, oceanStats, owSetProgress } from './progressData.js';
export { BILLFISH, SLAM, SPEARABLE, MOUNTS, OW_SET, releaseXp, oceanStats, owSetProgress };

export class OceanProgress {
  constructor(game, ow) { this.game = game; this.ow = ow; this.trip = new Set(); this.offers = []; }
  get o() { return this.game.ext.d.ocean || {}; }

  /** A new charter: the grand slam counts from here. */
  newTrip() { this.trip = new Set(); }

  async sync() {
    const g = this.game;
    try { await g.save.setOceanStats?.(oceanStats(this.o)); await g.autoClaim(); } catch (e) { console.warn('[open waters] stats', e); }
  }

  onCatch(c, sp) {
    const g = this.game;
    if (!sp?.ocean) return;
    this.trip.add(sp.id);
    if (SLAM.every((id) => this.trip.has(id)) && !this.trip.has('slam')) {
      this.trip.add('slam');
      g.ext.change((d) => { d.ocean.slams = (d.ocean.slams || 0) + 1; });
      g.chat.system('GRAND SLAM! A sailfish, a blue marlin and a swordfish on one trip. Marlowe is lost for words.', 'catch', { popup: true });
      g.audio.sfx('achievement');
      g.juice?.pop('GRAND SLAM!', { color: '#ffd060', size: 40 });
    }
    // a trophy for the cottage, the first time
    const mount = MOUNTS[sp.id];
    if (mount && !(this.o.mounts || []).includes(mount)) {
      g.ext.change((d) => {
        d.ocean.mounts = [...(d.ocean.mounts || []), mount];
        d.home.owned = [...new Set([...(d.home.owned || []), mount])];
        if (!d.home.decor.includes(mount)) d.home.decor.push(mount);
      });
      const what = { ow_bill: 'the marlin\'s bill', ow_jaw: 'a set of shark jaws', ow_squid: 'the squid, in a jar' }[mount];
      setTimeout(() => g.chat.system(`Marlowe says he'll have ${what} sent to your cottage. Find it on your wall (or your floor) next time you're home.`, 'info', { popup: true }), 2500);
      g.pushMeta?.();
    }
    if (BILLFISH.has(sp.id)) this.offers.push({ id: c.id, sp: sp.id, w: c.weight, at: Date.now() });
    this.sync();
  }

  onSpear(id) {
    if (!SPEARABLE.includes(id)) return;
    this.game.ext.change((d) => { d.ocean.speared = { ...(d.ocean.speared || {}), [id]: (d.ocean.speared?.[id] || 0) + 1 }; });
    this.sync();
  }

  /** After the catch card closes: offer to tag and release a billfish. */
  update() {
    const g = this.game, o = this.offers[0];
    if (!o || g.ui.modalOpen || g.ui.revealCard?.isConnected || this.ow.ui.modal) return;
    this.offers.shift();
    if (Date.now() - o.at > 120000 || !g.profile.creel.some((c) => c.id === o.id)) return;
    const sp = SPECIES_BY_ID[o.sp], xp = releaseXp(sp, o.w);
    this.ow.ui.openModal('ow-release', h('div.ow-head', h('span.ow-badge', icon('fish')), h('div', h('b', `Tag and release the ${sp.name}?`), h('span', `${Math.round(o.w)} lb`))),
      h('img', { src: fishThumb(o.sp), alt: '', style: { display: 'block', width: '160px', height: '80px', objectFit: 'contain', margin: '6px auto' } }),
      h('p.ow-note', `Marlowe can tag it and let it swim. You keep the Fishpedia entry and get +${xp} XP and a Released badge. Or keep it to sell or mount.`),
      h('div.ow-acts',
        h('button.btn.gold', { on: { click: () => this.release(o, xp) } }, icon('fish'), `Release it (+${xp} XP)`),
        h('button.btn.ghost.on-dark', { on: { click: () => this.ow.ui.closeModal() } }, 'Keep it')));
  }
  async release(o, xp) {
    const g = this.game;
    this.ow.ui.closeModal();
    if (!(await g.save.give(o.id))) { g.ui.toast('That fish isn\'t in your backpack any more.'); return; }
    g.ext.change((d) => { d.ocean.released = { ...(d.ocean.released || {}), [o.sp]: (d.ocean.released?.[o.sp] || 0) + 1 }; });
    g.fx?.splash?.(g.player.pos.clone().setY(0.9), 1.2);
    g.audio.sfx('splashRemote');
    g.chat.system(`Tagged and released. The ${SPECIES_BY_ID[o.sp].name} shook its head and was gone.`, 'catch');
    g.quests?.progress?.('release');
    this.ow.quests?.progress('release', { speciesId: o.sp });
    await g.reward('owrelease', `${o.id}`, { xp }, 'Catch and release');
    this.sync();
  }

  // ---------------------------------------------------------------- the Open Waters collection
  claimable() { return !this.o.setDone && owSetProgress(this.game.profile.fishpedia).done; }
  async claimSet() {
    const g = this.game;
    if (!this.claimable()) return;
    const r = await g.reward('collection', 'openwaters', { ...OW_SET.reward, title: OW_SET.title }, OW_SET.name);
    if (r?.ok === false) return;
    g.ext.change((d) => {
      d.ocean.setDone = Date.now();
      d.home.owned = [...new Set([...(d.home.owned || []), OW_SET.decor])];
      if (!d.home.decor.includes(OW_SET.decor)) d.home.decor.push(OW_SET.decor);
    });
    g.chat.system('Every fish in Open Waters! Marlowe sent you a ship in a bottle for the cottage wall.', 'quest', { popup: true });
    g.pushMeta?.();
  }

  /** The Fishpedia's Open Waters tab: the sea's 24 fish, your bests, the Released badges, and the collection. */
  renderPedia(c, sheet) {
    const g = this.game, p = g.profile, pr = owSetProgress(p.fishpedia), rel = this.o.released || {};
    c.body.append(h('div.pedia-head',
      h('div.pedia-ring', { style: { '--p': `${Math.round((pr.have.length / pr.total) * 100)}%` } }, h('span.num', `${pr.have.length}`)),
      h('div.grow', h('div.pedia-big', `${pr.have.length} of ${pr.total} sea fish`), h('div.muted', this.o.trips ? `${this.o.trips} charter${this.o.trips > 1 ? 's' : ''} with Captain Marlowe` : `Captain Marlowe's charters leave Cozy Cove from level 20.`),
        h('div.progress', h('i', { style: { width: `${(pr.have.length / pr.total) * 100}%` } })))));
    const tile = (sp) => {
      const e = p.fishpedia[sp.id];
      return h(`div.tile.ow-tile${e ? '' : '.locked'}`, { title: e ? sp.name : '???' },
        h('i.tier', { style: { background: TIER_INFO[tierOf(sp)].color }, title: TIER_INFO[tierOf(sp)].name }),
        h('img', { src: fishThumb(sp.id), alt: '', style: e ? {} : { filter: 'brightness(0) opacity(0.3)' } }),
        h('div.nm', e ? sp.name : '???'),
        h('div.meta', e ? `Best ${Math.round(e.best)} lb${this.o.catches?.[sp.id] ? ` · ×${this.o.catches[sp.id]}` : ''}` : sp.spear ? 'Spear only' : sp.big ? 'Big game' : 'Island shore'),
        rel[sp.id] ? h('span.ow-rel', `Released ×${rel[sp.id]}`) : null);
    };
    c.body.append(h('div.section-title', 'Big game'), h('div.grid.ow-grid', OCEAN_SPECIES.filter((s) => s.big).map(tile)));
    c.body.append(h('div.section-title', 'Reefs and islands'), h('div.grid.ow-grid', OCEAN_SPECIES.filter((s) => !s.big).map(tile)));
    const done = !!this.o.setDone;
    c.body.append(h(`div.list-row.set-row${!done && pr.done ? '.me' : ''}`, { style: { marginTop: '8px' } },
      h('div.grow', h('div.ttl', 'Collection: Open Waters', done ? h('span.pill', { style: { '--c': '#5eae3e', marginLeft: '6px' } }, OW_SET.title) : null),
        h('div.meta', `${pr.have.length}/${pr.total} · reward: ${OW_SET.reward.coins} coins + ${OW_SET.reward.pearls} pearls, title “${OW_SET.title}”, and a ship in a bottle for your cottage`)),
      done ? h('span.pill', { style: { '--c': '#5eae3e' } }, 'Done') : pr.done ? h('button.btn.gold.small', { on: { click: () => sheet.act(() => this.claimSet()) } }, 'Claim') : null));
  }
}
