// One-of-a-kind fish: every catch can carry traits (a size class, a battle scar, an odd colour)
// rolled from its id, and you can give any fish you keep a nickname.
import { SPECIES_BY_ID } from '../data/species.js';
import { hashString, mulberry32 } from '../core/rng.js';

export const SIZE_NAMES = { tiny: 'Tiny', giant: 'Giant' };

/** Pure: the traits a catch gets (deterministic from its id and weight). */
export function rollTraits(c) {
  const sp = SPECIES_BY_ID[c.speciesId];
  if (!sp) return null;
  const r = mulberry32(hashString(`traits:${c.id}`));
  const [mn, mx] = sp.weight;
  const rel = (c.weight - mn) / Math.max(0.001, mx - mn);
  const t = {};
  if (rel >= 0.95) t.size = 'giant';
  else if (rel <= 0.04) t.size = 'tiny';
  if (r() < 0.07) t.scar = 1 + Math.floor(r() * 3); // 1..3: which scar
  if (r() < 0.045) t.hue = Math.round(40 + r() * 280); // hue-rotate degrees
  if (r() < 0.02) t.spots = 1; // an extra speckle
  return Object.keys(t).length ? t : null;
}

export function traitWords(t) {
  if (!t) return [];
  const w = [];
  if (t.size) w.push(SIZE_NAMES[t.size]);
  if (t.scar) w.push('Battle-scarred');
  if (t.hue) w.push('Odd-coloured');
  if (t.spots) w.push('Freckled');
  return w;
}

const clean = (s) => String(s || '').replace(/[\u0000-\u001f\u007f<>]/g, '').trim().slice(0, 20);

export class Traits {
  constructor(game) { this.game = game; }
  get d() { return this.game.ext.d; }

  of(c) { return c && (this.d.traits[c.id] || null); }
  name(c) { return c && (this.d.names[c.id] || ''); }

  /** Roll and remember traits for a fresh catch. Returns them (or null). */
  onCatch(c) {
    const t = rollTraits(c);
    if (t) this.game.ext.change((d) => { d.traits[c.id] = t; });
    if (t) this.game.ext.bump('uniqueFish');
    return t;
  }

  setName(c, nick) {
    const n = clean(nick);
    this.game.ext.change((d) => { if (n) d.names[c.id] = n; else delete d.names[c.id]; });
    return n;
  }

  /** "“Bubbles” · Giant Battle-scarred Bluegill" */
  label(c) {
    const sp = SPECIES_BY_ID[c.speciesId];
    const v = c.variant === 'diamond' ? 'Diamond ' : c.variant === 'gold' ? 'Gold ' : '';
    const words = traitWords(this.of(c)).join(' ');
    const base = `${words ? `${words} ` : ''}${v}${sp?.name || 'fish'}`;
    const nick = this.name(c);
    return nick ? `“${nick}” · ${base}` : base;
  }

  /** CSS filter for a thumbnail of this fish. */
  filter(c) { const t = this.of(c); return t?.hue ? `hue-rotate(${t.hue}deg) saturate(1.2)` : ''; }

  // Forget traits and names for fish you no longer have (keeps the save small).
  prune() {
    const p = this.game.profile;
    const keep = new Set([...p.creel, ...p.storage].map((c) => c.id));
    for (const f of this.d.home.tank || []) keep.add(f.id);
    const drop = [...Object.keys(this.d.traits), ...Object.keys(this.d.names)].filter((id) => !keep.has(id));
    if (drop.length > 20) this.game.ext.change((d) => { for (const id of drop) { delete d.traits[id]; delete d.names[id]; } });
  }
}
