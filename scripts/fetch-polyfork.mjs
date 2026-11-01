// The Polyfork models (https://polyfork.dev, free low-poly assets) aren't kept in the public repo: their licence lets the
// game ship them inside it, but not hand the files out on their own. This fetches each one from Polyfork's own site and
// builds src/data/polyforkMesh.js and src/data/polyanimalMesh.js from them. Run it once after cloning, before building:
//   npm run polyfork
// By fetching them you get them from Polyfork, under its licence: https://polyfork.dev/licensing
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';

const MODELS = {
  "a-frame-cabin": "a-frame-cabin-6cb550",
  "bear-proof-food-locker": "bear-proof-food-locker-9144bb",
  "camp-canoe": "camp-canoe-c65d2a",
  "camp-cooler": "camp-cooler-8ba941",
  "camp-dutch-oven": "camp-dutch-oven-843dda",
  "camp-kitchen-table": "camp-kitchen-table-dfa2ab",
  "camp-notice-board": "camp-notice-board-c0be42",
  "camp-water-jug": "camp-water-jug-1aba54",
  "campfire-cooking-grate": "campfire-cooking-grate-884d56",
  "campground-rail-fence-run": "campground-rail-fence-run-524013",
  "camping-lantern": "camping-lantern-21d14b",
  "canoe-rack": "canoe-rack-c8126e",
  "canvas-ridge-tent": "canvas-ridge-tent-f0df0d",
  "canvas-wall-tent": "canvas-wall-tent-de8a04",
  "cordwood-pile": "cordwood-pile-b5229b",
  "dome-tent": "dome-tent-9ee59d",
  "folding-camp-chair": "folding-camp-chair-2fc7d1",
  "hammock-on-posts": "hammock-on-posts-7d5c47",
  "heavy-timber-picnic-table": "heavy-timber-picnic-table-1ac060",
  "hip-roof-ranger-station": "hip-roof-ranger-station-581dd5",
  "forest-outhouse": "forest-outhouse-e968d1",
  "open-woodshed": "open-woodshed-050a0a",
  "stone-well": "stone-well-2b4717",
  "birdhouse-post": "birdhouse-post-66d6c1",
  "wooden-rowboat": "wooden-rowboat-916981",
  "trail-map-kiosk": "trail-map-kiosk-be8618",
  "trail-signpost": "trail-signpost-bd29a7",
  "stone-fire-pit": "stone-fire-pit-4136b0",
  "log-cabin": "log-cabin-4fac3b",
  "cairn": "stone-cairn-a9bf48"
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
