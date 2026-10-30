// The Polyfork models (https://polyfork.dev, free low-poly assets) aren't kept in the public repo: their licence lets the
// game ship them inside it, but not hand the files out on their own. This fetches each one from Polyfork's own site and
// builds src/data/polyforkMesh.js and src/data/polyanimalMesh.js from them. Run it once after cloning, before building:
//   npm run polyfork
// By fetching them you get them from Polyfork, under its licence: https://polyfork.dev/licensing
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';

const MODELS = {
  'a-frame-cabin': 'a-frame-cabin-6cb550', 'bear-proof-food-locker': 'bear-proof-food-locker-9144bb', 'camp-canoe': 'camp-canoe-c65d2a', 'camp-cooler': 'camp-cooler-8ba941',
  'camp-dutch-oven': 'camp-dutch-oven-843dda', 'camp-kitchen-table': 'camp-kitchen-table-dfa2ab', 'camp-notice-board': 'camp-notice-board-c0be42', 'camp-water-jug': 'camp-water-jug-1aba54',
  'campfire-cooking-grate': 'campfire-cooking-grate-884d56', 'campground-rail-fence-run': 'campground-rail-fence-run-524013', 'camping-lantern': 'camping-lantern-21d14b', 'canoe-rack': 'canoe-rack-c8126e',
  'canvas-ridge-tent': 'canvas-ridge-tent-f0df0d', 'canvas-wall-tent': 'canvas-wall-tent-de8a04', 'cordwood-pile': 'cordwood-pile-b5229b', 'dome-tent': 'dome-tent-9ee59d',
  'folding-camp-chair': 'folding-camp-chair-2fc7d1', 'hammock-on-posts': 'hammock-on-posts-7d5c47', 'heavy-timber-picnic-table': 'heavy-timber-picnic-table-1ac060', 'hip-roof-ranger-station': 'hip-roof-ranger-station-581dd5',
  'forest-outhouse': 'forest-outhouse-e968d1', 'open-woodshed': 'open-woodshed-050a0a', 'stone-well': 'stone-well-2b4717', 'birdhouse-post': 'birdhouse-post-66d6c1',
  'wooden-rowboat': 'wooden-rowboat-916981', 'trail-map-kiosk': 'trail-map-kiosk-be8618', 'trail-signpost': 'trail-signpost-bd29a7', 'stone-fire-pit': 'stone-fire-pit-4136b0',
  'log-cabin': 'log-cabin-4fac3b', 'log-pile': 'snow-capped-log-pile-8719e7', cairn: 'stone-cairn-a9bf48', 'refuge-hut': 'mountain-refuge-hut-32ab1e', 'frozen-waterfall': 'frozen-waterfall-5d1fc6',
  toboggan: 'wooden-toboggan-940bbc', 'ice-axe': 'ice-axe-and-crampon-e4c7c1', 'snow-fence': 'snow-fence-run-55a09a', 'alpine-bench': 'alpine-bench-32fa62',
  'alpine-chalet': 'alpine-chalet-47d59e', 'alpine-hay-barn': 'alpine-hay-barn-3965e5', 'piste-patrol-hut': 'piste-patrol-hut-17a90a', 'akja-rescue-sledge': 'akja-rescue-sledge-a3727f',
  'frozen-water-trough': 'frozen-water-trough-61c835', 'avalanche-barrier-run': 'avalanche-barrier-run-02a615', 'alpine-fingerpost': 'alpine-fingerpost-d47349', 'weather-station-mast': 'weather-station-mast-f84278',
  'summit-cross': 'summit-cross-181eba', 'probe-and-shovel-set': 'probe-and-shovel-set-06d115', 'rope-coil-and-harness': 'rope-coil-and-harness-5b51d5', 'windblown-larch': 'windblown-larch-abb99c',
  'bare-mountain-rowan': 'bare-mountain-rowan-10e72e', 'ski-lift-base-station': 'ski-lift-base-station-924491', 'lift-top-station': 'lift-top-station-46d313', 'lift-pylon': 'lift-pylon-4e4385',
  'chairlift-chair': 'chairlift-chair-2beb2b', 'race-start-hut': 'race-start-hut-c6d405', 'slalom-gate': 'slalom-gate-7f4875', 'piste-marker-pole': 'piste-marker-pole-7480c3',
  'safety-net-run': 'safety-net-run-ecf381', 'timber-ski-rack': 'timber-ski-rack-8239d1', 'miner-s-shack': 'miner-s-shack-68b196', 'mine-headframe': 'mine-headframe-735cf4',
  saloon: 'saloon-6dda1c', hotel: 'hotel-b43f66', 'sheriff-s-office-and': 'sheriff-s-office-and-294314', 'blacksmith-s-shop': 'blacksmith-s-shop-9c5f43', 'undertaker-s': 'undertaker-s-3e1285',
  'ore-chute-and-bin': 'ore-chute-and-bin-8375ac', 'ore-barrow': 'ore-barrow-3e2464', 'mine-cart': 'mine-cart-21d7f0', 'mine-rail-run': 'mine-rail-run-d4404c', 'street-oil-lamp': 'street-oil-lamp-d246ea',
  'water-tower-on-a': 'water-tower-on-a-dbc730', 'dead-cottonwood': 'dead-cottonwood-edbde8', 'treasure-chest': 'treasure-chest-c2ac4f', 'cargo-crate': 'cargo-crate-9afc44',
  'encrusted-cargo-crate': 'encrusted-cargo-crate-ce0760', 'boulder-field-cluster': 'boulder-field-cluster-08e364', 'rock-outcrop': 'rock-outcrop-158ac3', snowmobile: 'snowmobile-e0fef3',
  'north/dog': 'dog-base', 'north/alpine-ibex': 'alpine-ibex-2a288a', 'north/mountain-hare': 'mountain-hare-d9c64c',
};

fs.mkdirSync('art/polyfork/north', { recursive: true });
let n = 0;
for (const [name, id] of Object.entries(MODELS)) {
  const file = `art/polyfork/${name}.glb`;
  if (fs.existsSync(file)) continue;
  const res = await fetch(`https://polyfork.dev/cdn/${id}.glb`, { headers: { 'User-Agent': 'ReelTime-build (github.com/mebessusn/reel-time-game)' } });
  if (res.status === 429) { console.log('Polyfork asked us to slow down: waiting a minute'); await new Promise((r) => setTimeout(r, 60000)); }
  if (!res.ok && res.status !== 429) throw new Error(`${id}: HTTP ${res.status}`);
  fs.writeFileSync(file, Buffer.from(await (res.status === 429 ? await fetch(res.url) : res).arrayBuffer()));
  n++;
  await new Promise((r) => setTimeout(r, 150)); // (one at a time, gently)
}
console.log(`${n} models fetched`);
execFileSync(process.execPath, ['scripts/polyfork-meshes.mjs'], { stdio: 'inherit' });
execFileSync(process.execPath, ['scripts/animal-split.mjs'], { stdio: 'inherit' });
