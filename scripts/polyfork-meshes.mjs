// v1.17.1: every Polyfork model (art/polyfork/*.glb, downloaded from https://polyfork.dev/cdn/<id>.glb) into one
// module, src/data/polyforkMesh.js: one node per model, named after the model's root (log-cabin, stone-cairn, ...).
// (Models waiting for a spot sit in art/polyfork/later/, outside the pack.) Window glass colours are named "pane" so src/world/polyfork.js can light them at night. Run after adding a .glb:
//   node scripts/polyfork-meshes.mjs
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';

const DIR = 'art/polyfork';
const files = fs.readdirSync(DIR).filter((f) => f.endsWith('.glb')).sort().map((f) => `${DIR}/${f}`);
// each model's night "pane" albedo, for that model only (the kit reuses the colours elsewhere: the icefall's dark ice)
const PANES = ['log-cabin/3f4d55', 'mountain-refuge-hut/2b3a4a', 'a-frame-cabin/394c59', 'hip-roof-ranger-station/38617b'];
execFileSync(process.execPath, ['scripts/glb-to-js.mjs', files.join(','), 'src/data/polyforkMesh.js', 'POLYFORK', '--no-normals',
  `--names=${PANES.map((h) => `${h}:pane`).join(',')}`], { stdio: 'inherit' });
