import test from 'node:test';
import assert from 'node:assert/strict';
import { calculatePriority, priorityBand } from '../src/scoring.js';

const base = {
  category: 'pothole',
  title: 'Deep pothole near school gate',
  description: 'Deep pothole near the school gate. A child was injured in an accident on the main road.',
  locationLabel: 'Arera Colony, Bhopal',
  createdAt: new Date('2026-10-01T08:00:00.000Z'),
  now: new Date('2026-10-01T10:00:00.000Z'),
  independentReports: 2,
};

test('priority score is deterministic and equals the sum of factors', () => {
  const first = calculatePriority(base);
  const second = calculatePriority({ ...base });
  assert.deepEqual(first.factors, second.factors);
  assert.equal(first.score, second.score);
  assert.equal(
    first.score,
    first.factors.safety +
      first.factors.publicImpact +
      first.factors.locationSensitivity +
      first.factors.waitingTime +
      first.factors.independentReports,
  );
  assert.ok(first.score >= 0 && first.score <= 100);
  assert.equal(first.band, priorityBand(first.score));
});

test('score factors stay inside their documented maxima', () => {
  const result = calculatePriority({
    ...base,
    description:
      'Deep pothole with exposed wire, accident, injury, child, elderly, flood, hazard, night and blind spot near a busy main road market bus stop station hospital school.',
    independentReports: 100,
    now: new Date('2026-12-01T00:00:00.000Z'),
  });
  assert.ok(result.factors.safety <= 40);
  assert.ok(result.factors.publicImpact <= 20);
  assert.ok(result.factors.locationSensitivity <= 15);
  assert.ok(result.factors.waitingTime <= 15);
  assert.ok(result.factors.independentReports <= 10);
  assert.ok(result.score <= 100);
  assert.equal(result.factors.independentReports, 10);
});

test('report-count contribution is capped to reduce spam', () => {
  const two = calculatePriority({ ...base, independentReports: 2 });
  const five = calculatePriority({ ...base, independentReports: 5 });
  const hundred = calculatePriority({ ...base, independentReports: 100 });
  assert.equal(five.factors.independentReports, hundred.factors.independentReports);
  assert.equal(hundred.factors.independentReports, 10);
  assert.ok(two.score < five.score);
});

test('waiting time grows by three points per day and caps at 15', () => {
  const fresh = calculatePriority({ ...base, createdAt: base.now, independentReports: 1 });
  const threeDays = calculatePriority({ ...base, createdAt: new Date('2026-09-28T08:00:00.000Z'), independentReports: 1 });
  const twentyDays = calculatePriority({ ...base, createdAt: new Date('2026-09-10T08:00:00.000Z'), independentReports: 1 });
  assert.equal(fresh.factors.waitingTime, 0);
  assert.equal(threeDays.factors.waitingTime, 9);
  assert.equal(twentyDays.factors.waitingTime, 15);
});

test('bands follow the required thresholds', () => {
  assert.equal(priorityBand(100), 'critical');
  assert.equal(priorityBand(80), 'critical');
  assert.equal(priorityBand(79), 'high');
  assert.equal(priorityBand(60), 'high');
  assert.equal(priorityBand(59), 'medium');
  assert.equal(priorityBand(35), 'medium');
  assert.equal(priorityBand(34), 'low');
  assert.equal(priorityBand(0), 'low');
});

test('priority reasons are human-readable and explain the factors', () => {
  const result = calculatePriority(base);
  assert.ok(result.reasons.length >= 5);
  assert.ok(result.reasons.some((reason) => /safety/i.test(reason)));
  assert.ok(result.reasons.some((reason) => /public impact/i.test(reason)));
  assert.ok(result.reasons.some((reason) => /sensitive location/i.test(reason)));
  assert.ok(result.reasons.some((reason) => /multiple independent reports/i.test(reason)));
});
