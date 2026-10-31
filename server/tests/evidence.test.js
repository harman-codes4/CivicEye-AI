import test from 'node:test';
import assert from 'node:assert/strict';
import { canMarkResolved, evaluateResolutionEvidence } from '../src/evidence.js';

const location = { issueLat: 23.2327, issueLng: 77.434 };

function evaluate(overrides = {}) {
  return evaluateResolutionEvidence({
    hasAfterPhoto: true,
    allowException: false,
    ...location,
    submissionLat: 23.2327,
    submissionLng: 77.434,
    visualChange: 'improved',
    citizenConfirmation: 'pending',
    ...overrides,
  });
}

test('missing after-photo triggers manual verification', () => {
  const result = evaluate({ hasAfterPhoto: false });
  assert.equal(result.reviewStatus, 'needs_verification');
  assert.ok(result.reasons.some((reason) => /after-photo is missing/i.test(reason)));
  assert.equal(result.automatedPhotoComparison, false);
});

test('a recorded exception still requires manual review', () => {
  const result = evaluate({ hasAfterPhoto: false, allowException: true });
  assert.equal(result.reviewStatus, 'needs_verification');
  assert.ok(result.reasons.some((reason) => /exception/i.test(reason)));
});

test('inconsistent evidence location is never eligible', () => {
  const result = evaluate({ submissionLat: 23.251, submissionLng: 77.42 });
  assert.equal(result.locationMatch, 'inconsistent');
  assert.equal(result.reviewStatus, 'needs_verification');
  assert.ok(result.reasons.some((reason) => /inconsistent/i.test(reason)));
});

test('missing coordinates produce an unconfirmed location', () => {
  const result = evaluate({ submissionLat: null, submissionLng: null });
  assert.equal(result.locationMatch, 'unknown');
  assert.equal(result.reviewStatus, 'needs_verification');
  assert.ok(result.reasons.some((reason) => /Location not confirmed/i.test(reason)));
});

test('no clear visual change triggers verification instead of auto-resolution', () => {
  const result = evaluate({ visualChange: 'no_clear_change', citizenConfirmation: 'confirmed' });
  assert.equal(result.reviewStatus, 'needs_verification');
  assert.ok(result.reasons.some((reason) => /no clear change/i.test(reason)));
});

test('disabled photo AI means not_assessed always needs review', () => {
  const result = evaluate({ visualChange: 'not_assessed', citizenConfirmation: 'confirmed' });
  assert.equal(result.reviewStatus, 'needs_verification');
  assert.ok(result.reasons.some((reason) => /AI image detection disabled/i.test(reason)));
});

test('consistent evidence with pending citizen confirmation is not eligible yet', () => {
  const result = evaluate();
  assert.equal(result.reviewStatus, 'awaiting_citizen_confirmation');
  assert.equal(result.confidenceBand, 'medium');
});

test('consistent evidence plus citizen confirmation is eligible for reviewed resolution', () => {
  const result = evaluate({ citizenConfirmation: 'confirmed' });
  assert.equal(result.reviewStatus, 'eligible_for_reviewed_resolution');
  assert.equal(result.confidenceBand, 'high');
  assert.equal(canMarkResolved({
    afterPhotoUrl: '/uploads/test.jpg',
    locationMatch: result.locationMatch,
    visualChange: result.visualChange,
    citizenConfirmation: result.citizenConfirmation,
  }).ok, true);
});

test('a citizen dispute blocks resolution', () => {
  const result = evaluate({ citizenConfirmation: 'disputed' });
  assert.equal(result.reviewStatus, 'citizen_disputed');
  assert.equal(result.confidenceBand, 'low');
});

test('canMarkResolved blocks weaker evidence states', () => {
  assert.equal(canMarkResolved(null).ok, false);
  assert.equal(canMarkResolved({ afterPhotoUrl: null, locationMatch: 'consistent', visualChange: 'improved', citizenConfirmation: 'confirmed' }).ok, false);
  assert.equal(canMarkResolved({ afterPhotoUrl: '/x', locationMatch: 'unknown', visualChange: 'improved', citizenConfirmation: 'confirmed' }).ok, false);
  assert.equal(canMarkResolved({ afterPhotoUrl: '/x', locationMatch: 'consistent', visualChange: 'uncertain', citizenConfirmation: 'confirmed' }).ok, false);
  assert.equal(canMarkResolved({ afterPhotoUrl: '/x', locationMatch: 'consistent', visualChange: 'improved', citizenConfirmation: 'pending' }).ok, false);
  assert.equal(canMarkResolved({ afterPhotoUrl: '/x', locationMatch: 'consistent', visualChange: 'improved', citizenConfirmation: 'disputed' }).ok, false);
});

test('evidence output discloses its limitations', () => {
  const result = evaluate({ citizenConfirmation: 'confirmed' });
  assert.match(result.limitation, /does not prove repair durability or quality/i);
  assert.ok(result.checks.length >= 4);
  assert.ok(result.checks.some((check) => check.id === 'after_photo'));
  assert.ok(result.checks.some((check) => check.id === 'location'));
  assert.ok(result.checks.some((check) => check.id === 'visual'));
  assert.ok(result.checks.some((check) => check.id === 'citizen'));
});
