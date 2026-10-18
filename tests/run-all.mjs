// Runs every test that does not need a browser.
import { spawnSync } from 'node:child_process';
const files = ['tests/rules.test.mjs', 'tests/reel.test.mjs', 'tests/features.test.mjs', 'tests/sql.test.mjs', 'tests/cloud.test.mjs', 'tests/mod.test.mjs', 'tests/party.test.mjs'];
let failed = 0;
for (const f of files) {
  console.log(`\n> ${f}`);
  const r = spawnSync(process.execPath, [f], { stdio: 'inherit' });
  if (r.status !== 0) failed++;
}
console.log(failed ? `\n${failed} test file(s) failed` : '\nall tests passed');
process.exit(failed ? 1 : 0);
