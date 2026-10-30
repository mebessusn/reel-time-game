// Rewrite glb-to-js mesh modules in the packed form (src/core/meshpack.js). Lossless: the module exports the same
// NODES after unpacking (checked here before writing). glb-to-js.mjs runs this on everything it writes.
//   node scripts/pack-meshes.mjs src/data/islandMesh.js [more ...]
import fs from 'node:fs';
import { pathToFileURL } from 'node:url';
import { packNodes, unpackNodes } from '../src/core/meshpack.js';

export async function packModule(file) {
  const src = fs.readFileSync(file, 'utf8');
  if (src.includes('unpackNodes(')) return null; // already packed
  const m = await import(`${pathToFileURL(file).href}?t=${Date.now()}`);
  const matsKey = Object.keys(m).find((k) => k.endsWith('_MATS')), nodesKey = Object.keys(m).find((k) => k.endsWith('_NODES'));
  if (!matsKey || !nodesKey) throw new Error(`${file}: not a glb-to-js module`);
  const packed = packNodes(m[nodesKey]);
  if (JSON.stringify(unpackNodes(packed)) !== JSON.stringify(m[nodesKey])) throw new Error(`${file}: packing is not lossless`);
  const head = src.slice(0, src.indexOf('export const')).trimEnd();
  const out = `${head ? `${head}\n` : ''}// Packed by scripts/pack-meshes.mjs (src/core/meshpack.js): the same arrays, as compact text.\nimport { unpackNodes } from '../core/meshpack.js';\nexport const ${matsKey} = ${JSON.stringify(m[matsKey])};\nexport const ${nodesKey} = unpackNodes(${JSON.stringify(packed)});\n`;
  fs.writeFileSync(file, out);
  return { before: src.length, after: out.length };
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  let b = 0, a = 0;
  for (const f of process.argv.slice(2)) {
    const r = await packModule(f);
    if (!r) { console.log(`${f}: already packed`); continue; }
    b += r.before; a += r.after;
    console.log(`${f}: ${(r.before / 1024).toFixed(0)} KB -> ${(r.after / 1024).toFixed(0)} KB`);
  }
  if (b) console.log(`total ${(b / 1024).toFixed(0)} KB -> ${(a / 1024).toFixed(0)} KB`);
}
