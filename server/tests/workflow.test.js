import { mkdtempSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import assert from 'node:assert/strict';

const temp = mkdtempSync(path.join(os.tmpdir(), 'civiceye-test-'));
process.env.CIVICEYE_DATA_DIR = path.join(temp, 'data');
process.env.CIVICEYE_UPLOAD_DIR = path.join(temp, 'uploads');

const { getIssueDetail, getStats } = await import('../src/db.js');
const { seedDemo } = await import('../src/seed.js');
const {
  createIssue,
  updateStatus,
  submitResolution,
  citizenFeedback,
  verifyResolution,
  assignIssue,
  reviewDuplicate,
} = await import('../src/service.js');

const citizen = (overrides = {}) => ({
  category: 'pothole',
  title: 'Deep pothole at Vikas School gate',
  description:
    'Large deep pothole at the school gate on the main road. Children walking to school are at risk and an accident happened last week.',
  latitude: 23.23275,
  longitude: 77.43405,
  locationLabel: 'Arera Colony, Bhopal',
  locationConfirmed: true,
  ...overrides,
});

test('demo seed creates all required scenarios', () => {
  const result = seedDemo({ force: true });
  assert.equal(result.seeded, true);
  assert.ok(result.count >= 11);
  const stats = getStats();
  assert.ok(stats.demoIssues === stats.total);
  assert.ok(stats.awaitingVerification >= 2);
  assert.ok(stats.resolved >= 2);
  assert.ok(stats.open >= 1);
  assert.ok(stats.pendingDuplicateSuggestions >= 1);
  const needsVerification = getIssueDetail('CIV-1026');
  assert.equal(needsVerification.status, 'needs_verification');
  assert.equal(needsVerification.reviews[0].afterPhotoUrl, null);
  const reviewed = getIssueDetail('CIV-1028');
  assert.equal(reviewed.status, 'resolved');
  assert.equal(reviewed.reviews[0].reviewStatus, 'reviewed_resolution');
});

test('a similar nearby report links to the parent without deleting submissions', () => {
  const before = getIssueDetail('CIV-1024');
  const result = createIssue({
    data: citizen({ submitterId: 'integration-citizen-1' }),
    submitterId: 'integration-citizen-1',
  });
  assert.equal(result.linkedToExisting, true);
  assert.equal(result.issueId, 'CIV-1024');
  const after = getIssueDetail('CIV-1024');
  assert.equal(after.reports.length, before.reports.length + 1);
  assert.equal(after.reports[0].submitterId, 'demo-citizen-1');
  assert.ok(after.history.some((event) => /linked automatically/i.test(event.note || '')));
  assert.ok(after.priorityScore >= 0 && after.priorityScore <= 100);
});

test('a different nearby pothole remains separate with an operator suggestion', () => {
  const result = createIssue({
    data: citizen({
      title: 'Loose paver blocks outside a clinic',
      description:
        'Loose paver blocks outside the clinic entrance. Pedestrians trip on the uneven edge, but this is a different location from the school gate.',
      latitude: 23.234,
      longitude: 77.436,
    }),
    submitterId: 'integration-citizen-2',
  });
  assert.equal(result.linkedToExisting, false);
  assert.notEqual(result.issueId, 'CIV-1024');
  const detail = getIssueDetail(result.issueId);
  assert.equal(detail.status, 'reported');
  assert.ok(detail.duplicateSuggestions.length >= 1);
  assert.equal(detail.duplicateSuggestions[0].status, 'pending');
  assert.ok(detail.duplicateSuggestions[0].score < 1);
  assert.ok(detail.reports.length === 1);
});

test('invalid status transitions are rejected and valid ones are persisted', () => {
  const newIssue = createIssue({
    data: citizen({
      title: 'Whole lane sinking near clinic',
      description:
        'The whole lane is sinking near the clinic after rain. Buses are avoiding the road and pedestrians are walking through traffic.',
      latitude: 23.2351,
      longitude: 77.4371,
    }),
    submitterId: 'integration-citizen-3',
  });
  const issueId = newIssue.issueId;

  assert.throws(() => updateStatus(issueId, { status: 'resolved', actor: 'tester' }), /evidence verification/i);
  assert.throws(() => updateStatus(issueId, { status: 'in_progress', actor: 'tester' }), /Invalid status transition/i);

  updateStatus(issueId, { status: 'under_review', actor: 'tester', note: 'Reviewing' });
  assignIssue(issueId, { department: 'PWD Bhopal', assignedBy: 'tester' });
  updateStatus(issueId, { status: 'in_progress', actor: 'tester', note: 'Crew started' });

  const detail = getIssueDetail(issueId);
  assert.equal(detail.status, 'in_progress');
  assert.ok(detail.history.some((event) => event.oldStatus === 'reported' && event.newStatus === 'under_review'));
  assert.ok(detail.history.some((event) => event.oldStatus === 'assigned' && event.newStatus === 'in_progress'));
  assert.ok(detail.history.every((event) => event.changedBy && event.timestamp));
  assert.equal(detail.assignments[0].departmentOrOperator, 'PWD Bhopal');
});

test('weak repair evidence creates a needs-verification review and can be disputed', () => {
  const issue = getIssueDetail('CIV-1029');
  assert.equal(issue.status, 'in_progress');

  const { review } = submitResolution('CIV-1029', {
    afterPhotoUrl: null,
    resolutionNote: 'Bins were cleared and the area washed. Photo unavailable.',
    submissionLat: null,
    submissionLng: null,
    visualChange: 'not_assessed',
    actor: 'integration-authority',
  });
  assert.equal(review.reviewStatus, 'needs_verification');
  assert.equal(review.afterPhotoUrl, null);

  const afterSubmit = getIssueDetail('CIV-1029');
  assert.equal(afterSubmit.status, 'needs_verification');
  assert.equal(afterSubmit.reviews.length, 1);
  assert.ok(afterSubmit.reviews[0].reasons.some((reason) => /missing/i.test(reason)));

  const disputed = citizenFeedback('CIV-1029', {
    confirmation: 'disputed',
    actor: 'integration-citizen',
    note: 'The bins are still overflowing.',
  });
  assert.equal(disputed.status, 'reopened');
  assert.equal(disputed.feedback[0].confirmation, 'disputed');
  assert.ok(disputed.history.some((event) => event.newStatus === 'reopened'));
});

test('strong evidence needs citizen confirmation and human approval before resolved', () => {
  const issue = getIssueDetail('CIV-1027');
  assert.equal(issue.status, 'needs_verification');

  updateStatus('CIV-1027', { status: 'in_progress', actor: 'integration-authority' });
  const { review } = submitResolution('CIV-1027', {
    afterPhotoUrl: '/uploads/integration-after.jpg',
    resolutionNote: 'Pipeline joint replaced and road surface restored and compacted.',
    submissionLat: issue.latitude,
    submissionLng: issue.longitude,
    visualChange: 'improved',
    actor: 'integration-authority',
  });
  assert.ok(['awaiting_citizen_confirmation', 'eligible_for_reviewed_resolution'].includes(review.reviewStatus));

  const pending = getIssueDetail('CIV-1027');
  assert.equal(pending.status, 'resolution_submitted');
  assert.throws(
    () => verifyResolution('CIV-1027', { decision: 'resolved', actor: 'integration-reviewer' }),
    /Citizen confirmation is still pending/i,
  );

  const confirmed = citizenFeedback('CIV-1027', {
    confirmation: 'confirmed',
    actor: 'integration-citizen',
    note: 'Water has stopped and the patch looks level.',
  });
  assert.equal(confirmed.reviews[0].citizenConfirmation, 'confirmed');
  assert.equal(confirmed.reviews[0].reviewStatus, 'eligible_for_reviewed_resolution');

  const resolved = verifyResolution('CIV-1027', {
    decision: 'resolved',
    actor: 'integration-reviewer',
    note: 'Field check matched the evidence.',
  });
  assert.equal(resolved.status, 'resolved');
  assert.equal(resolved.reviews[0].reviewStatus, 'reviewed_resolution');
  assert.equal(resolved.reviews[0].reviewedBy, 'integration-reviewer');
  assert.ok(resolved.history.some((event) => event.newStatus === 'resolved' && event.changedBy === 'integration-reviewer'));

  const stats = getStats();
  assert.ok(stats.resolved >= 3);
  assert.ok(stats.avgResolutionHours !== null);
});

test('unconfirmed and inconsistent evidence cannot be resolved', () => {
  assert.throws(
    () => verifyResolution('CIV-1026', { decision: 'resolved', actor: 'integration-reviewer' }),
    /After-photo is missing|Location is not confirmed|Citizen confirmation/i,
  );
  assert.throws(
    () => verifyResolution('CIV-9999', { decision: 'resolved', actor: 'integration-reviewer' }),
    /not found/i,
  );
});

test('operator-confirmed duplicates link while preserving reports and refreshing the parent score', () => {
  const beforeParent = getIssueDetail('CIV-1024');
  const child = getIssueDetail('CIV-1025');
  const suggestion = child.duplicateSuggestions.find((item) => item.status === 'pending');
  assert.ok(suggestion, 'seed should include a pending duplicate suggestion');

  const linkedChild = reviewDuplicate('CIV-1025', {
    suggestionId: suggestion.suggestionId,
    action: 'confirm',
    actor: 'integration-operator',
    note: 'Field visit confirmed the same road defect.',
  });
  assert.equal(linkedChild.parentIssueId, 'CIV-1024');

  const afterParent = getIssueDetail('CIV-1024');
  assert.equal(afterParent.aggregateReportCount, beforeParent.aggregateReportCount + child.aggregateReportCount);
  assert.ok(afterParent.priorityScore >= beforeParent.priorityScore);
  assert.ok(afterParent.history.some((event) => /Duplicate report CIV-1025 confirmed/i.test(event.note || '')));

  assert.throws(
    () => reviewDuplicate('CIV-1025', { suggestionId: suggestion.suggestionId, action: 'confirm', actor: 'integration-operator' }),
    /already been reviewed/i,
  );
});
