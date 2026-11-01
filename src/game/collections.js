// Lake collections: catch every fish on a lake's list to earn its title, a reward, and a statue on
// that lake's shore with your name on it.
import * as THREE from 'three';
import { JETTIES, heightAt, COVE_LAUNCH } from '../world/terrain.js';
import { addCircle } from '../world/colliders.js';
import { SPECIES_BY_ID } from '../data/species.js';

export const SETS = {
  cove: { name: 'Cozy Cove Classics', title: 'Cove Regular', species: ['bluegill', 'perch', 'pumpkinseed', 'crappie', 'largemouth', 'carp', 'pike', 'koi'], reward: { coins: 300, xp: 150 }, statue: { x: 9, z: 48.5 } },
  frost: { name: 'Frostpine Finds', title: 'Frostpine Regular', species: ['perch', 'minnow', 'rainbowtrout', 'browntrout', 'walleye', 'salmon', 'char', 'moonfin'], reward: { coins: 450, pearls: 3, xp: 200 }, lake: 'frost' },
  marsh: { name: 'Lilymarsh Lot', title: 'Marsh Wader', species: ['pumpkinseed', 'crappie', 'bullhead', 'carp', 'pike', 'catfish', 'puffer', 'gar'], reward: { coins: 450, pearls: 3, xp: 200 }, lake: 'marsh' },
  pond: { name: 'Fern Pond Friends', title: 'Pond Pal', species: ['bluegill', 'perch', 'pumpkinseed', 'crappie', 'shiner', 'largemouth', 'koi'], reward: { coins: 350, xp: 170 }, lake: 'pond' },
  river: { name: 'Willow River Run', title: 'River Runner', species: ['minnow', 'shiner', 'rockbass', 'smallmouth', 'rainbowtrout', 'largemouth', 'pike', 'salmon'], reward: { coins: 400, pearls: 2, xp: 180 }, statue: { x: 47.5, z: 21.5 } },
  quarry: { name: 'Quarry Deep Cuts', title: 'Quarry Diver', species: ['rockbass', 'cod', 'smallmouth', 'walleye', 'catfish', 'muskie', 'sturgeon', 'paddlefish', 'gloweel'], reward: { coins: 600, pearls: 5, xp: 260 }, lake: 'quarry' },
  cave: { name: 'Echoes in the Dark', title: 'Cave Diver', species: ['cavefish', 'glowloach', 'albinocat', 'geodecarp', 'echoeel'], reward: { coins: 900, pearls: 10, xp: 450 }, near: { x: 22, z: 40 } },
  weather: { name: 'Fair Weather Friends', title: 'Storm Chaser', species: ['greyling', 'drizzledace', 'rainspot', 'thunderbass'], reward: { coins: 700, pearls: 6, xp: 350 }, near: { x: -24, z: 46 } },
  blood: { name: 'Blood Moon Bestiary', title: 'Moon Hunter', species: ['piranha', 'blackpiranha', 'snakehead', 'vampirefish', 'crimsonwolf'], reward: { coins: 1200, pearls: 15, xp: 600 }, near: { x: 24, z: 52 } },
  deep: { name: 'Legends of the Deep', title: 'Deep Legend', species: ['oldwhiskers', 'crystalpike', 'stormsturgeon', 'lanternfish'], reward: { coins: 1500, pearls: 20, xp: 800 }, statue: { x: 12.5, z: 46 } },
};

/** Pure: which species of a set you have and whether it's complete. */
export function setProgress(set, fishpedia) {
  const have = set.species.filter((id) => fishpedia?.[id]);
  return { have, total: set.species.length, done: have.length === set.species.length };
}

function statueSpot(id) {
  const s = SETS[id];
  if (s.statue) return s.statue;
  if (s.near) { // the nearest level, dry spot to a hint near the cove
    for (let r = 0; r < 12; r += 0.5) for (let a = 0; a < 16; a++) {
      const x = s.near.x + Math.cos(a / 16 * Math.PI * 2) * r, z = s.near.z + Math.sin(a / 16 * Math.PI * 2) * r, h = heightAt(x, z);
      if (h > 0 && h <= 4) return { x, z };
    }
  }
  const j = JETTIES.find((x) => x.lake === s.lake);
  if (!j) return COVE_LAUNCH;
  // on the shore beside the land end of the jetty
  let x = j.end.x, z = j.end.z;
  for (let k = 0; k < 30 && heightAt(x, z) <= 0; k++) { x -= j.dir[0]; z -= j.dir[1]; }
  x -= j.dir[0] * 2; z -= j.dir[1] * 2;
  for (const side of [2.5, -2.5, 3.5, -3.5]) {
    const sx = x + j.dir[1] * side, sz = z - j.dir[0] * side;
    const h = heightAt(sx, sz);
    if (h > 0 && h <= 5) return { x: sx, z: sz };
  }
  return { x, z };
}

function buildStatue(speciesId) {
  const g = new THREE.Group();
  const stone = new THREE.MeshLambertMaterial({ color: '#b8b0a0' });
  const gold = new THREE.MeshLambertMaterial({ color: '#f2c040', emissive: '#6a4a10', emissiveIntensity: 0.4 });
  const base = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.8, 1.2), stone);
  base.position.y = 0.4;
  const top = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.3, 0.8), stone);
  top.position.y = 0.95;
  g.add(base, top);
  // a leaping golden fish: body + tail
  const body = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.45, 0.3), gold);
  body.position.set(0, 1.55, 0); body.rotation.z = 0.6;
  const tail = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.5, 0.12), gold);
  tail.position.set(-0.45, 1.2, 0); tail.rotation.z = 0.2;
  g.add(body, tail);
  g.userData.species = speciesId;
  return g;
}

export class Collections {
  constructor(game) { this.game = game; this.statues = new Map(); }
  get d() { return this.game.ext.d; }

  progress(id) { return setProgress(SETS[id], this.game.profile.fishpedia); }
  claimable() { return Object.keys(SETS).filter((id) => !this.d.collections[id] && this.progress(id).done); }

  /** After a catch: announce a completed set. */
  check(c) {
    for (const [id, s] of Object.entries(SETS)) {
      if (!s.species.includes(c.speciesId) || this.d.collections[id]) continue;
      const p = this.progress(id);
      if (p.done) this.game.chat?.system(`Collection complete: ${s.name}! Claim it in the Fishpedia (F) for the title "${s.title}".`, 'quest', { popup: true });
      else if (p.have.length === p.total - 1) this.game.ui.toast(`${s.name}: one fish to go!`, { icon: 'book' });
    }
  }

  async claim(id) {
    const s = SETS[id];
    if (!s || this.d.collections[id] || !this.progress(id).done) return;
    const r = await this.game.reward('collection', id, { ...s.reward, title: s.title }, s.name);
    if (r?.ok === false) return;
    this.game.ext.change((d) => {
      d.collections[id] = Date.now();
      // a plaque for your cabin wall
      const pl = `plaque_${id}`;
      d.home.owned = [...new Set([...(d.home.owned || []), pl])];
      if (!d.home.decor.includes(pl)) d.home.decor.push(pl);
    });
    this.game.pushMeta();
    this.placeStatues();
    this.game.chat?.system(`A statue in your honour now stands by ${id === 'cove' || id === 'deep' ? 'the cove' : id === 'river' ? 'the footbridge' : s.name.split(' ')[0]}.`, 'quest');
  }

  placeStatues() {
    const scene = this.game.engine.scene;
    for (const id of Object.keys(this.d.collections)) {
      if (this.statues.has(id) || !SETS[id]) continue;
      const at = statueSpot(id);
      const st = buildStatue(SETS[id].species[0]);
      st.position.set(at.x, heightAt(at.x, at.z) > 0 ? heightAt(at.x, at.z) : 1, at.z);
      st.name = `statue-${id}`;
      addCircle(at.x, at.z, 0.7);
      scene.add(st);
      this.statues.set(id, st);
    }
  }

  names(id) { return SETS[id].species.map((s) => SPECIES_BY_ID[s]?.name); }
}
