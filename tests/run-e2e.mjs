// Runs every browser test suite in one go: starts the Vite dev server on :5173 (unless one is already running),
// runs each suite in turn with a time limit (a stuck suite is stopped and counted as failed instead of hanging
// forever), stops the server, and writes a summary to test-results/last-run.txt.
//   node tests/run-e2e.mjs                 all suites
//   RT_SUITES=valley,party node tests/run-e2e.mjs   just those
//   RT_GPU=1 node tests/run-e2e.mjs        use the graphics card (see browser-opts.mjs)
// Exit code 0 only when every suite passed. Used by .github/workflows/e2e.yml and by hand on any machine.
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const OUT = path.join(ROOT, 'test-results');
fs.mkdirSync(OUT, { recursive: true });
const BASE = 'http://localhost:5173/';
const SUITES = [
  ['e2e', 'tests/e2e.test.mjs'],
  ['controls', 'tests/controls.test.mjs'],
  ['social', 'tests/social.test.mjs'],
  ['valley', 'tests/valley.test.mjs'],
  ['features', 'tests/features.e2e.mjs'],
  ['sprint', 'tests/sprint.e2e.mjs'],
  ['party', 'tests/party.e2e.mjs'],
  ['woods', 'tests/woods.e2e.mjs'], // v1.14.9 The Wild Woods
];
const pick = (process.env.RT_SUITES || '').split(',').map((s) => s.trim()).filter(Boolean);
const suites = pick.length ? SUITES.filter(([n]) => pick.includes(n)) : SUITES;
// per-suite limit: generous on a software renderer, short with a graphics card
const LIMIT_MIN = Number(process.env.RT_SUITE_MINUTES || (process.env.RT_GPU ? 15 : 45));
const win = process.platform === 'win32';

const up = async () => { try { return (await fetch(BASE)).ok; } catch { return false; } };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
function kill(child) {
  if (!child || child.exitCode !== null) return;
  if (win) spawn('taskkill', ['/pid', String(child.pid), '/t', '/f'], { stdio: 'ignore' });
  else try { process.kill(-child.pid, 'SIGKILL'); } catch { try { child.kill('SIGKILL'); } catch { /* gone */ } }
}

let vite = null;
if (!(await up())) {
  vite = spawn(win ? 'npx.cmd' : 'npx', ['vite', '--port', '5173', '--strictPort'], { cwd: ROOT, stdio: 'ignore', detached: !win, shell: win });
  for (let i = 0; i < 120 && !(await up()); i++) await sleep(1000);
  if (!(await up())) { console.error('Vite did not start on :5173'); kill(vite); process.exit(1); }
}

const results = [];
const t0 = Date.now();
for (const [name, file] of suites) {
  const start = Date.now();
  const logFile = path.join(OUT, `${name}.log`);
  const log = fs.createWriteStream(logFile);
  console.log(`> ${name}`);
  const child = spawn(process.execPath, [file], { cwd: ROOT, env: process.env, detached: !win });
  child.stdout.on('data', (d) => { process.stdout.write(d); log.write(d); });
  child.stderr.on('data', (d) => { process.stderr.write(d); log.write(d); });
  let timedOut = false;
  const timer = setTimeout(() => { timedOut = true; kill(child); }, LIMIT_MIN * 60000);
  const code = await new Promise((r) => child.on('close', (c) => r(c)));
  clearTimeout(timer); log.end();
  const secs = Math.round((Date.now() - start) / 1000);
  const status = timedOut ? `TIMED OUT after ${LIMIT_MIN} min` : code === 0 ? 'passed' : `FAILED (exit ${code})`;
  results.push({ name, status, secs, ok: !timedOut && code === 0 });
  console.log(`< ${name}: ${status} in ${secs}s`);
}
kill(vite);

const ok = results.every((r) => r.ok);
const summary = [
  `Reel Time browser tests: ${ok ? 'ALL PASSED' : 'SOME FAILED'}`,
  `${new Date().toISOString()} · ${process.env.RT_GPU ? 'graphics card' : 'software rendering'} · ${process.platform} · ${Math.round((Date.now() - t0) / 60000)} min total`,
  '',
  ...results.map((r) => `${r.ok ? 'ok  ' : 'FAIL'} ${r.name.padEnd(9)} ${r.status} (${r.secs}s)`),
  '',
  'Each suite\'s full output is in test-results/<suite>.log',
].join('\n');
fs.writeFileSync(path.join(OUT, 'last-run.txt'), summary + '\n');
console.log('\n' + summary);
// On GitHub Actions, each failed suite also becomes an error annotation (with its FAIL lines and the tail of its log),
// readable through the API even where the log files themselves can't be downloaded.
if (process.env.GITHUB_ACTIONS) for (const r of results.filter((x) => !x.ok)) {
  const text = fs.readFileSync(path.join(OUT, `${r.name}.log`), 'utf8');
  const fails = text.split('\n').filter((l) => /FAIL|Error|Timeout/.test(l)).slice(0, 8);
  const tail = text.trim().split('\n').slice(-6);
  const msg = [`${r.name}: ${r.status}`, ...fails, '--- last lines ---', ...tail].join('%0A').replace(/\r/g, '');
  console.log(`::error title=browser tests: ${r.name}::${msg}`);
}
process.exit(ok ? 0 : 1);
