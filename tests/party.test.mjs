// v1.11 parties: the roster protocol (pure parts of src/game/party.js).
import assert from 'node:assert/strict';
import { resolveParty, readParty, PARTY_MAX } from '../src/game/party.js';

let passed = 0;
const t = (name, fn) => { fn(); passed++; console.log(`  ok ${name}`); };
const now = 1_000_000;
const INVITE = 120000;
const P = (id, meta) => ({ id, meta });

t('a leader adds only the anglers it invited who accepted', () => {
  const mine = { id: 'pA', ld: 'A', m: ['A'], solo: true };
  const peers = [P('B', { acc: { pid: 'pA', at: now } }), P('C', { acc: { pid: 'pA', at: now } })];
  const r = resolveParty('A', mine, peers, { now, invited: ['B'] });
  assert.deepEqual(r.m, ['A', 'B']);
});
t('parties stop at the cap', () => {
  const mine = { id: 'pA', ld: 'A', m: ['A', 'B', 'C', 'D'] };
  const peers = ['B', 'C', 'D'].map((x) => P(x, { pty: { id: 'pA', ld: 'A', m: mine.m } })).concat(P('E', { acc: { pid: 'pA', at: now } }));
  assert.equal(resolveParty('A', mine, peers, { now, invited: ['E'] }).m.length, PARTY_MAX);
});
t('a member follows the leader, waits after accepting, and is out when kicked', () => {
  const mine = { id: 'pA', ld: 'A', m: ['A', 'B'] };
  assert.deepEqual(resolveParty('B', mine, [P('A', { pty: { id: 'pA', ld: 'A', m: ['A', 'B', 'C'] } })], { now }).m, ['A', 'B', 'C']);
  assert.equal(resolveParty('B', mine, [P('A', { pty: { id: 'pA', ld: 'A', m: ['A'] } })], { now, acc: { pid: 'pA', at: now - 1000 } }), mine, 'just accepted');
  assert.equal(resolveParty('B', mine, [P('A', { pty: { id: 'pA', ld: 'A', m: ['A', 'C'] } })], { now, acc: { pid: 'pA', at: now - INVITE } }), null, 'kicked');
});
t('when the leader leaves, the next member leads', () => {
  const mine = { id: 'pA', ld: 'A', m: ['A', 'B', 'C'] };
  const r = resolveParty('B', mine, [P('C', { pty: mine })], { now });
  assert.deepEqual(r, { id: 'pA', ld: 'B', m: ['B', 'C'] });
  const c = resolveParty('C', mine, [P('B', { pty: { id: 'pA', ld: 'B', m: ['B', 'C'] } })], { now });
  assert.equal(c.ld, 'B');
  assert.equal(resolveParty('B', { id: 'pA', ld: 'A', m: ['A', 'B'] }, [], { now }), null, 'a party of one breaks up');
});
t('rosters from other people are checked', () => {
  assert.equal(readParty({ pty: { id: 'x', ld: 'Z', m: ['A', 'B'] } }), null, 'leader must be on the roster');
  assert.equal(readParty({ pty: { id: 'x', ld: 'A', m: ['A', 'B', 'C', 'D', 'E', 'F'] } }).m.length, PARTY_MAX);
  assert.equal(readParty({ pty: 'nope' }), null);
});
console.log(`party: ${passed} passed`);
