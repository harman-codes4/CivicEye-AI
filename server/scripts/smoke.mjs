const BASE = process.env.SMOKE_BASE_URL || 'http://localhost:4000';
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
  'base64',
);

let failures = 0;
function check(condition, message) {
  if (condition) {
    console.log(`  ok  ${message}`);
  } else {
    failures += 1;
    console.error(`  FAIL ${message}`);
  }
}

async function json(path, options) {
  const response = await fetch(`${BASE}${path}`, options);
  const text = await response.text();
  let body = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }
  return { response, body };
}

const health = await json('/api/health');
check(health.response.ok && health.body.status === 'ok', 'GET /api/health returns ok');
check(health.body.aiPhotoComparison === false, 'photo AI is explicitly disabled');

const front = await fetch(`${BASE}/`);
const html = await front.text();
check(front.ok && /CivicEye AI/.test(html), 'production client shell is served by the API server');

const createForm = new FormData();
createForm.set('category', 'pothole');
createForm.set('title', 'Smoke test cracked culvert near water tank');
createForm.set('description', 'The culvert cover near the water tank has cracked and the edge is sinking. Cyclists swerve into the lane and the opening is a trip hazard at night.');
createForm.set('latitude', '23.29012');
createForm.set('longitude', '77.46021');
createForm.set('locationLabel', 'Smoke Test Nagar, Bhopal');
createForm.set('locationConfirmed', 'true');
createForm.set('submitterId', 'smoke-citizen-1');
createForm.set('photo', new Blob([PNG], { type: 'image/png' }), 'before.png');

const created = await json('/api/issues', { method: 'POST', body: createForm });
check(created.response.status === 201, 'POST /api/issues creates a complaint');
const issueId = created.body?.issueId;
check(/^CIV-\d+$/.test(issueId || ''), `stable complaint ID generated (${issueId})`);
check(created.body?.issue?.beforePhotoUrl?.startsWith('/uploads/'), 'before-photo stored on disk');
check(created.body?.issue?.priorityScore >= 0 && created.body?.issue?.priorityScore <= 100, 'priority score is in range');

const duplicateForm = new FormData();
duplicateForm.set('category', 'pothole');
duplicateForm.set('title', 'Smoke test cracked culvert near water tank');
duplicateForm.set('description', 'The culvert cover near the water tank has cracked and the edge is sinking. Cyclists swerve into the lane and the opening is a trip hazard at night.');
duplicateForm.set('latitude', '23.29015');
duplicateForm.set('longitude', '77.46024');
duplicateForm.set('locationConfirmed', 'true');
duplicateForm.set('submitterId', 'smoke-citizen-2');
const duplicate = await json('/api/issues', { method: 'POST', body: duplicateForm });
check(duplicate.body?.linkedToExisting === true && duplicate.body?.issueId === issueId, 'similar nearby report links to parent');
const detailAfterLink = await json(`/api/issues/${issueId}`);
check(detailAfterLink.body?.issue?.reports?.length >= 2, 'original submissions are preserved');

for (const status of ['under_review', 'assigned', 'in_progress']) {
  const response = await json(`/api/issues/${issueId}/status`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status, actor: 'Smoke authority', note: `Smoke transition to ${status}` }),
  });
  check(response.response.ok && response.body.issue.status === status, `PATCH status to ${status}`);
}

const invalid = await json(`/api/issues/${issueId}/status`, {
  method: 'PATCH',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ status: 'resolved', actor: 'Smoke authority' }),
});
check(invalid.response.status === 422, 'direct status jump to resolved is rejected');

const resolutionForm = new FormData();
resolutionForm.set('resolutionNote', 'Smoke test resolution: pothole filled with hot-mix asphalt and compacted.');
resolutionForm.set('latitude', '23.29012');
resolutionForm.set('longitude', '77.46021');
resolutionForm.set('visualChange', 'improved');
resolutionForm.set('actor', 'Smoke authority');
resolutionForm.set('afterPhoto', new Blob([PNG], { type: 'image/png' }), 'after.png');
const resolution = await json(`/api/issues/${issueId}/resolution`, { method: 'POST', body: resolutionForm });
check(resolution.response.status === 201, 'POST resolution creates review record');
check(resolution.body?.review?.afterPhotoUrl?.startsWith('/uploads/'), 'after-photo stored');

const pendingVerify = await json(`/api/issues/${issueId}/verify`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ decision: 'resolved', actor: 'Smoke reviewer' }),
});
check(pendingVerify.response.status === 422, 'resolved is blocked while citizen confirmation is pending');

const confirmed = await json(`/api/issues/${issueId}/feedback`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ confirmation: 'confirmed', actor: 'Smoke citizen', note: 'Looks fixed.' }),
});
check(confirmed.response.ok, 'POST feedback confirms citizen review');

const resolved = await json(`/api/issues/${issueId}/verify`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ decision: 'resolved', actor: 'Smoke reviewer', note: 'Smoke field check passed.' }),
});
check(resolved.response.ok && resolved.body.issue.status === 'resolved', 'human review marks issue resolved');
if (!resolved.body?.issue) console.error(resolved.body);
check(resolved.body?.issue?.history?.some((event) => event.newStatus === 'resolved'), 'timeline contains resolved event');

const badForm = new FormData();
badForm.set('category', 'pothole');
badForm.set('title', 'x');
badForm.set('description', 'too short');
badForm.set('latitude', '23.2');
badForm.set('longitude', '77.4');
badForm.set('locationConfirmed', 'true');
const invalidIssue = await json('/api/issues', { method: 'POST', body: badForm });
check(invalidIssue.response.status === 422 && Array.isArray(invalidIssue.body?.details), 'invalid complaint input returns 422 with field details');

const missing = await json('/api/issues/CIV-999999');
check(missing.response.status === 404, 'unknown complaint ID returns 404');

const stats = await json('/api/stats');
check(stats.response.ok && stats.body.stats.total > 0, 'GET /api/stats returns database-derived stats');

const reset = await json('/api/demo/reset', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ confirm: 'RESET' }),
});
check(reset.response.ok && reset.body.count >= 11, 'demo reset restores labelled seed scenarios');

if (failures) {
  console.error(`\n${failures} smoke check(s) failed.`);
  process.exit(1);
}
console.log('\nAll API smoke checks passed.');
