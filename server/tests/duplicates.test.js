import test from 'node:test';
import assert from 'node:assert/strict';
import { compareReports, findBestDuplicate, haversineMeters } from '../src/duplicates.js';

const candidate = {
  issueId: 'CIV-1024',
  category: 'pothole',
  title: 'Deep pothole at Vikas School gate',
  description:
    'Large deep pothole at the school gate on the main road. Children walk around it and an accident happened last week.',
  latitude: 23.2327,
  longitude: 77.434,
};

test('nearby, same-category, similar-text reports are high-confidence duplicates', () => {
  const incoming = {
    category: 'pothole',
    title: 'Deep pothole near Vikas School gate',
    description:
      'Large deep pothole at the school gate on the main road. Children walk around it and an accident happened last week. Please fix it.',
    latitude: 23.2328,
    longitude: 77.4341,
  };
  const match = compareReports(incoming, candidate);
  assert.ok(match);
  assert.equal(match.band, 'high');
  assert.ok(match.score >= 0.78);
  assert.ok(match.reasons.some((reason) => /approximately/i.test(reason)));
  assert.ok(match.reasons.some((reason) => /text similarity/i.test(reason)));
});

test('location alone cannot auto-link a different nearby issue', () => {
  const incoming = {
    category: 'pothole',
    title: 'Cracked patch beside SBI ATM',
    description: 'Broken road patch near the ATM service lane. Scooters slow down but no injury is reported.',
    latitude: 23.2331,
    longitude: 77.4349,
  };
  const match = compareReports(incoming, candidate);
  assert.ok(match);
  assert.equal(match.band, 'medium');
  assert.ok(match.score < 0.78);
  assert.ok(match.textScore < 0.3);
});

test('different categories never match', () => {
  const match = compareReports(
    {
      category: 'garbage',
      title: 'Deep pothole at Vikas School gate',
      description: candidate.description,
      latitude: candidate.latitude,
      longitude: candidate.longitude,
    },
    candidate,
  );
  assert.equal(match, null);
});

test('distant reports outside the suggestion radius are ignored', () => {
  const match = compareReports(
    {
      category: 'pothole',
      title: candidate.title,
      description: candidate.description,
      latitude: 23.4,
      longitude: 77.6,
    },
    candidate,
  );
  assert.equal(match, null);
});

test('text-only matching works when coordinates are missing', () => {
  const match = compareReports(
    {
      category: 'pothole',
      title: candidate.title,
      description: candidate.description,
      latitude: null,
      longitude: null,
    },
    candidate,
  );
  assert.ok(match);
  assert.equal(match.band, 'high');
  assert.equal(match.distanceM, null);
});

test('findBestDuplicate returns the strongest non-low candidate', () => {
  const match = findBestDuplicate(
    {
      category: 'pothole',
      title: 'Cracked patch beside SBI ATM',
      description: 'Broken road patch near the ATM service lane. Scooters slow down but no injury is reported.',
      latitude: 23.2331,
      longitude: 77.4349,
    },
    [candidate, { ...candidate, category: 'water_leakage' }],
  );
  assert.ok(match);
  assert.equal(match.candidateIssueId, 'CIV-1024');
  assert.equal(match.band, 'medium');
});

test('haversine distance is stable and symmetric', () => {
  const forward = haversineMeters(23.2327, 77.434, 23.2331, 77.4349);
  const reverse = haversineMeters(23.2331, 77.4349, 23.2327, 77.434);
  assert.ok(forward > 90 && forward < 120);
  assert.equal(Math.round(forward), Math.round(reverse));
});
