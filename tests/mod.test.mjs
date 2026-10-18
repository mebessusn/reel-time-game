// v1.10 moderation: ban maths and cleaning (pure parts of src/game/mod.js).
import assert from 'node:assert/strict';
import { banActive, banText, cleanBan } from '../src/game/mod.js';

let passed = 0;
const t = (name, fn) => { fn(); passed++; console.log(`  ok ${name}`); };
const now = Date.UTC(2026, 9, 15, 12);
t('bans and suspensions', () => {
  assert.equal(banActive({ kind: 'ban', until: 0 }, now), true);
  assert.equal(banActive({ kind: 'suspend', until: now + 1000 }, now), true);
  assert.equal(banActive({ kind: 'suspend', until: now - 1 }, now), false);
  assert.equal(banActive({ kind: 'suspend', until: 0 }, now), false, 'a suspension needs an end');
  assert.equal(banActive({ kind: 'none' }, now), false);
  assert.equal(banActive(null, now), false);
  assert.equal(banText({ kind: 'ban', until: 0 }, now), 'Banned');
  assert.equal(banText({ kind: 'suspend', until: now + 3 * 3600000 }, now), 'Suspended for 3h');
  assert.equal(banText({ kind: 'suspend', until: now + 26 * 3600000 }, now), 'Suspended for 1d 2h');
  assert.equal(banText({ kind: 'suspend', until: now + 5 * 60000 }, now), 'Suspended for 5m');
});
t('ban docs from other people are cleaned', () => {
  assert.equal(cleanBan({ kind: 'nuke' }), null);
  const b = cleanBan({ kind: 'ban', until: '-5', reason: 'x'.repeat(500), name: '<b>Bob</b>\u0000' });
  assert.equal(b.until, 0); assert.equal(b.reason.length, 200); assert.ok(!b.name.includes('\u0000'));
});


const { reportText, BUG_KINDS } = await import('../src/game/reports.js');
t('reports read well as email text', () => {
  const bug = reportText('bug', { cat: 'ui', kindLabel: BUG_KINDS[2][1], from: 'Mara', title: 'Map button', text: 'It does nothing when I click it.', steps: '1. Press M', diag: { version: 'v1.10.1', browser: 'Chrome 140', os: 'Windows', screen: '1280x800@1', where: 'Cozy Cove (1.0, 2.0)', mode: 'shore / fishing idle', gfx: 'high', net: 'room, 2 others', errors: ['boom'] } });
  assert.match(bug, /Title: Map button/); assert.match(bug, /Steps to reproduce/); assert.match(bug, /Chrome 140 on Windows/); assert.match(bug, /- boom/);
  assert.match(reportText('bug', { cat: 'other', title: 'x', text: 'y', diag: null }), /No game details attached/);
  const pr = reportText('player', { name: 'Bob', target: 'u1', reason: 'cheat', reasonLabel: 'Cheating or exploiting bugs', from: 'Mara', text: 'Speed hacking' });
  assert.match(pr, /Cheating or exploiting/); assert.match(pr, /Reported angler: Bob \(id u1\)/);
});
console.log(`mod: ${passed} passed`);
