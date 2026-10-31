import test from 'node:test';
import assert from 'node:assert/strict';
import { canTransition, assertTransition, STATUSES, TRANSITIONS } from '../src/status.js';

test('required valid transitions are allowed', () => {
  assert.equal(canTransition('reported', 'under_review'), true);
  assert.equal(canTransition('under_review', 'assigned'), true);
  assert.equal(canTransition('assigned', 'in_progress'), true);
  assert.equal(canTransition('in_progress', 'resolution_submitted'), true);
  assert.equal(canTransition('resolution_submitted', 'needs_verification'), true);
  assert.equal(canTransition('needs_verification', 'resolution_submitted'), true);
  assert.equal(canTransition('resolved', 'reopened'), true);
  assert.equal(canTransition('reopened', 'in_progress'), true);
});

test('invalid transitions are rejected with a clear message', () => {
  assert.equal(canTransition('reported', 'resolved'), false);
  assert.equal(canTransition('reported', 'in_progress'), false);
  assert.equal(canTransition('resolution_submitted', 'resolved'), false);
  assert.equal(canTransition('resolved', 'in_progress'), false);
  assert.equal(canTransition('assigned', 'resolution_submitted'), false);
  assert.throws(
    () => assertTransition('reported', 'resolved'),
    /Invalid status transition: Reported → Resolved/,
  );
});

test('unknown target statuses are rejected', () => {
  assert.throws(() => assertTransition('reported', 'closed'), /Unknown status/);
});

test('every status has a transition definition and no self-transitions', () => {
  for (const status of STATUSES) {
    assert.ok(Array.isArray(TRANSITIONS[status]), `missing transitions for ${status}`);
    assert.ok(!TRANSITIONS[status].includes(status), `self-transition found for ${status}`);
  }
});
