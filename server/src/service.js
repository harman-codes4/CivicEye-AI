import {
  db,
  nowIso,
  makeId,
  nextIssueId,
  getIssueRow,
  getIssueDetail,
  getReports,
  logHistory,
  mapReview,
  refreshReportCount,
} from './db.js';
import { calculatePriority } from './scoring.js';
import { findBestDuplicate } from './duplicates.js';
import { assertTransition, STATUS_LABELS } from './status.js';
import { evaluateResolutionEvidence, canMarkResolved } from './evidence.js';

function coordinate(value) {
  if (value === null || value === undefined || value === '') return null;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

function httpError(statusCode, message, details) {
  const error = new Error(message);
  error.statusCode = statusCode;
  if (details) error.details = details;
  return error;
}

export function recomputeIssueScore(issueId, now = new Date()) {
  const row = getIssueRow(issueId);
  if (!row) return null;
  if (row.priority_override) return null;
  const stats = db
    .prepare(
      `SELECT COUNT(DISTINCT r.submitter_id) AS submitters, COUNT(*) AS total
       FROM reports r
       JOIN issues i ON i.issue_id = r.issue_id
       WHERE i.issue_id = ? OR i.parent_issue_id = ?`,
    )
    .get(issueId, issueId);
  const result = calculatePriority({
    category: row.category,
    title: row.title,
    description: row.description,
    locationLabel: row.location_label || '',
    createdAt: row.created_at,
    now,
    independentReports: Math.max(1, stats?.submitters || 1),
  });
  db.prepare(
    `UPDATE issues SET priority_score = ?, priority_band = ?, priority_factors = ?,
       priority_reasons = ?, updated_at = ? WHERE issue_id = ?`,
  ).run(
    result.score,
    result.band,
    JSON.stringify(result.factors),
    JSON.stringify(result.reasons),
    nowIso(),
    issueId,
  );
  return result;
}

function insertReport({ issueId, description, photoUrl, latitude, longitude, submitterId, relationship, demoData, createdAt }) {
  const reportId = makeId('RPT');
  db.prepare(
    `INSERT INTO reports (report_id, issue_id, submitter_id, description, photo_url, latitude,
       longitude, relationship, demo_data, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    reportId,
    issueId,
    submitterId || `anon-${makeId('C')}`,
    description,
    photoUrl || null,
    coordinate(latitude),
    coordinate(longitude),
    relationship,
    demoData ? 1 : 0,
    createdAt,
  );
  return reportId;
}

function candidateIssues() {
  return db
    .prepare(
      `SELECT issue_id AS issueId, category, title, description, latitude, longitude, status
       FROM issues WHERE parent_issue_id IS NULL`,
    )
    .all();
}

export function createIssue({
  data,
  photoUrl = null,
  submitterId = null,
  demoData = false,
  checkDuplicates = true,
  now = new Date(),
}) {
  const createdAt = now.toISOString();
  const reportDescription = data.description;

  db.exec('BEGIN IMMEDIATE');
  try {
    const best = checkDuplicates
      ? findBestDuplicate(
          {
            category: data.category,
            title: data.title,
            description: reportDescription,
            latitude: data.latitude,
            longitude: data.longitude,
          },
          candidateIssues(),
        )
      : null;

    if (best && best.band === 'high') {
      const parent = getIssueRow(best.candidateIssueId);
      if (!parent) throw httpError(409, 'Duplicate candidate no longer exists');
      insertReport({
        issueId: parent.issue_id,
        description: reportDescription,
        photoUrl,
        latitude: data.latitude,
        longitude: data.longitude,
        submitterId,
        relationship: 'linked',
        demoData,
        createdAt,
      });
      refreshReportCount(parent.issue_id);
      recomputeIssueScore(parent.issue_id, now);
      logHistory(db, {
        issueId: parent.issue_id,
        oldStatus: parent.status,
        newStatus: parent.status,
        changedBy: 'System · duplicate linkage',
        note: `New report linked automatically. Candidate ${best.candidateIssueId}, match ${Math.round(best.score * 100)}% (${best.reasons.join('; ')}). Original submissions preserved.`,
        timestamp: createdAt,
        demoData,
      });
      db.exec('COMMIT');
      return {
        linkedToExisting: true,
        issueId: parent.issue_id,
        match: best,
        issue: getIssueDetail(parent.issue_id),
      };
    }

    const issueId = nextIssueId(db);
    const scoring = calculatePriority({
      category: data.category,
      title: data.title,
      description: reportDescription,
      locationLabel: data.locationLabel || '',
      createdAt,
      now,
      independentReports: 1,
    });

    db.prepare(
      `INSERT INTO issues (issue_id, category, title, description, latitude, longitude,
         location_label, location_confirmed, before_photo_url, status, priority_score,
         priority_band, priority_factors, priority_reasons, report_count, demo_data,
         created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'reported', ?, ?, ?, ?, 1, ?, ?, ?)`,
    ).run(
      issueId,
      data.category,
      data.title,
      reportDescription,
      coordinate(data.latitude),
      coordinate(data.longitude),
      data.locationLabel || null,
      data.locationConfirmed ? 1 : 0,
      photoUrl,
      scoring.score,
      scoring.band,
      JSON.stringify(scoring.factors),
      JSON.stringify(scoring.reasons),
      demoData ? 1 : 0,
      createdAt,
      createdAt,
    );

    insertReport({
      issueId,
      description: reportDescription,
      photoUrl,
      latitude: data.latitude,
      longitude: data.longitude,
      submitterId,
      relationship: 'primary',
      demoData,
      createdAt,
    });

    logHistory(db, {
      issueId,
      oldStatus: null,
      newStatus: 'reported',
      changedBy: 'Citizen',
      note: `Complaint created. Priority score ${scoring.score} (${scoring.band}).`,
      timestamp: createdAt,
      demoData,
    });

    if (best && best.band === 'medium') {
      db.prepare(
        `INSERT INTO duplicate_suggestions (suggestion_id, issue_id, candidate_issue_id, score,
           band, text_score, distance_m, reasons, status, created_at, demo_data)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?)`,
      ).run(
        makeId('DUP'),
        issueId,
        best.candidateIssueId,
        best.score,
        best.band,
        best.textScore,
        best.distanceM,
        JSON.stringify(best.reasons),
        createdAt,
        demoData ? 1 : 0,
      );
    }

    db.exec('COMMIT');
    return {
      linkedToExisting: false,
      issueId,
      match: best,
      issue: getIssueDetail(issueId),
    };
  } catch (error) {
    try {
      db.exec('ROLLBACK');
    } catch {
      /* already rolled back */
    }
    throw error;
  }
}

export function addReportToIssue(issueId, { data, photoUrl = null, submitterId, demoData = false, now = new Date() }) {
  const issue = getIssueRow(issueId);
  if (!issue) throw httpError(404, `Issue ${issueId} not found`);
  const createdAt = now.toISOString();
  insertReport({
    issueId,
    description: data.description,
    photoUrl,
    latitude: data.latitude,
    longitude: data.longitude,
    submitterId,
    relationship: 'linked',
    demoData,
    createdAt,
  });
  refreshReportCount(issueId);
  recomputeIssueScore(issueId, now);
  logHistory(db, {
    issueId,
    oldStatus: issue.status,
    newStatus: issue.status,
    changedBy: 'Citizen',
    note: 'Additional linked report added to this issue.',
    timestamp: createdAt,
    demoData,
  });
  return getIssueDetail(issueId);
}

export function updateStatus(issueId, { status, actor, note, now = new Date() }) {
  const issue = getIssueRow(issueId);
  if (!issue) throw httpError(404, `Issue ${issueId} not found`);
  if (status === 'resolved') {
    throw httpError(422, 'Use the evidence verification action to mark an issue resolved.');
  }
  if (status === 'resolution_submitted') {
    throw httpError(422, 'Use the resolution submission form to upload repair evidence.');
  }
  assertTransition(issue.status, status);
  const timestamp = now.toISOString();
  db.prepare('UPDATE issues SET status = ?, updated_at = ? WHERE issue_id = ?').run(
    status,
    timestamp,
    issueId,
  );
  logHistory(db, {
    issueId,
    oldStatus: issue.status,
    newStatus: status,
    changedBy: actor || 'Authority',
    note: note || `Status changed to ${STATUS_LABELS[status]}`,
    timestamp,
  });
  return getIssueDetail(issueId);
}

export function assignIssue(issueId, { department, assignedBy, note, now = new Date() }) {
  const issue = getIssueRow(issueId);
  if (!issue) throw httpError(404, `Issue ${issueId} not found`);
  const timestamp = now.toISOString();
  const assignmentId = makeId('ASG');
  db.prepare(
    `INSERT INTO assignments (assignment_id, issue_id, department_or_operator, assigned_by,
       assigned_at, assignment_status, note)
     VALUES (?, ?, ?, ?, ?, 'assigned', ?)`,
  ).run(assignmentId, issueId, department, assignedBy || 'Authority', timestamp, note || null);

  let newStatus = issue.status;
  if (['reported', 'under_review', 'reopened'].includes(issue.status)) {
    newStatus = 'assigned';
  }
  db.prepare(
    'UPDATE issues SET assigned_department = ?, status = ?, updated_at = ? WHERE issue_id = ?',
  ).run(department, newStatus, timestamp, issueId);
  logHistory(db, {
    issueId,
    oldStatus: issue.status,
    newStatus,
    changedBy: assignedBy || 'Authority',
    note: `Assigned to ${department}.${note ? ` Note: ${note}` : ''}`,
    timestamp,
  });
  return getIssueDetail(issueId);
}

export function submitResolution(
  issueId,
  {
    afterPhotoUrl = null,
    resolutionNote,
    submissionLat,
    submissionLng,
    allowException = false,
    visualChange = 'not_assessed',
    actor = 'Authority',
    demoData = false,
    now = new Date(),
  },
) {
  const issue = getIssueRow(issueId);
  if (!issue) throw httpError(404, `Issue ${issueId} not found`);
  if (!['in_progress', 'needs_verification'].includes(issue.status)) {
    throw httpError(
      422,
      `Resolution evidence cannot be submitted while the issue is "${STATUS_LABELS[issue.status] || issue.status}". Move it to In progress first.`,
    );
  }
  if (!resolutionNote || resolutionNote.trim().length < 8) {
    throw httpError(422, 'A resolution note of at least 8 characters is required.');
  }

  const evaluation = evaluateResolutionEvidence({
    hasAfterPhoto: Boolean(afterPhotoUrl),
    allowException,
    issueLat: issue.latitude,
    issueLng: issue.longitude,
    submissionLat,
    submissionLng,
    visualChange,
    citizenConfirmation: 'pending',
  });

  const timestamp = now.toISOString();
  const reviewId = makeId('REV');
  db.prepare(
    `INSERT INTO resolution_reviews (review_id, issue_id, after_photo_url, resolution_note,
       location_match, visual_change, citizen_confirmation, confidence_band, reasons, checks,
       review_status, submission_lat, submission_lng, allow_exception, submitted_at, demo_data)
     VALUES (?, ?, ?, ?, ?, ?, 'pending', ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    reviewId,
    issueId,
    afterPhotoUrl,
    resolutionNote.trim(),
    evaluation.locationMatch,
    evaluation.visualChange,
    evaluation.confidenceBand,
    JSON.stringify(evaluation.reasons),
    JSON.stringify(evaluation.checks),
    evaluation.reviewStatus,
    coordinate(submissionLat),
    coordinate(submissionLng),
    allowException ? 1 : 0,
    timestamp,
    demoData ? 1 : 0,
  );

  assertTransition(issue.status, 'resolution_submitted');
  db.prepare('UPDATE issues SET status = ?, updated_at = ? WHERE issue_id = ?').run(
    'resolution_submitted',
    timestamp,
    issueId,
  );
  logHistory(db, {
    issueId,
    oldStatus: issue.status,
    newStatus: 'resolution_submitted',
    changedBy: actor,
    note: `Resolution submitted (${reviewId}). ${evaluation.reasons[0]}`,
    timestamp,
    demoData,
  });

  if (evaluation.reviewStatus === 'needs_verification') {
    assertTransition('resolution_submitted', 'needs_verification');
    db.prepare('UPDATE issues SET status = ?, updated_at = ? WHERE issue_id = ?').run(
      'needs_verification',
      timestamp,
      issueId,
    );
    logHistory(db, {
      issueId,
      oldStatus: 'resolution_submitted',
      newStatus: 'needs_verification',
      changedBy: 'Evidence rules',
      note: `Manual verification required: ${evaluation.reasons.join(' ')}`,
      timestamp,
      demoData,
    });
  }

  const detail = getIssueDetail(issueId);
  return { issue: detail, review: detail.reviews[0] };
}

export function verifyResolution(issueId, { decision, actor, note, now = new Date() }) {
  const issue = getIssueRow(issueId);
  if (!issue) throw httpError(404, `Issue ${issueId} not found`);
  const reviewRow = db
    .prepare('SELECT * FROM resolution_reviews WHERE issue_id = ? ORDER BY submitted_at DESC LIMIT 1')
    .get(issueId);
  if (!reviewRow) throw httpError(409, 'No resolution evidence exists for this issue.');
  const review = mapReview(reviewRow);
  const timestamp = now.toISOString();

  if (decision === 'resolved') {
    if (!['resolution_submitted', 'needs_verification'].includes(issue.status)) {
      throw httpError(422, `Issue status "${issue.status}" cannot be resolved from this state.`);
    }
    const check = canMarkResolved(review);
    if (!check.ok) throw httpError(422, `Cannot mark resolved: ${check.reason}`);
    db.prepare(
      `UPDATE resolution_reviews SET review_status = 'reviewed_resolution', reviewed_at = ?,
         reviewed_by = ?, review_note = ? WHERE review_id = ?`,
    ).run(timestamp, actor || 'Authority reviewer', note || null, review.reviewId);
    db.prepare('UPDATE issues SET status = ?, updated_at = ? WHERE issue_id = ?').run(
      'resolved',
      timestamp,
      issueId,
    );
    logHistory(db, {
      issueId,
      oldStatus: issue.status,
      newStatus: 'resolved',
      changedBy: actor || 'Authority reviewer',
      note: note || 'Evidence reviewed and resolution accepted. Human review recorded.',
      timestamp,
    });
    return getIssueDetail(issueId);
  }

  if (decision === 'needs_verification') {
    db.prepare(
      `UPDATE resolution_reviews SET review_status = 'needs_verification', reviewed_at = ?,
         reviewed_by = ?, review_note = ? WHERE review_id = ?`,
    ).run(timestamp, actor || 'Authority reviewer', note || null, review.reviewId);
    let newStatus = issue.status;
    if (issue.status === 'resolution_submitted') {
      assertTransition(issue.status, 'needs_verification');
      newStatus = 'needs_verification';
    }
    db.prepare('UPDATE issues SET status = ?, updated_at = ? WHERE issue_id = ?').run(
      newStatus,
      timestamp,
      issueId,
    );
    logHistory(db, {
      issueId,
      oldStatus: issue.status,
      newStatus,
      changedBy: actor || 'Authority reviewer',
      note: note || 'Reviewer requested further verification.',
      timestamp,
    });
    return getIssueDetail(issueId);
  }

  throw httpError(422, 'decision must be "resolved" or "needs_verification".');
}

export function citizenFeedback(issueId, { confirmation, actor, note, now = new Date() }) {
  const issue = getIssueRow(issueId);
  if (!issue) throw httpError(404, `Issue ${issueId} not found`);
  const reviewRow = db
    .prepare('SELECT * FROM resolution_reviews WHERE issue_id = ? ORDER BY submitted_at DESC LIMIT 1')
    .get(issueId);
  if (!reviewRow) throw httpError(409, 'This issue has no submitted resolution to confirm yet.');
  if (!['confirmed', 'disputed'].includes(confirmation)) {
    throw httpError(422, 'confirmation must be "confirmed" or "disputed".');
  }
  const review = mapReview(reviewRow);
  const timestamp = now.toISOString();

  db.prepare(
    `INSERT INTO citizen_feedback (feedback_id, issue_id, confirmation, actor, note, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
  ).run(makeId('FB'), issueId, confirmation, actor || 'Citizen', note || null, timestamp);

  const evaluation = evaluateResolutionEvidence({
    hasAfterPhoto: Boolean(review.afterPhotoUrl),
    allowException: review.allowException,
    issueLat: issue.latitude,
    issueLng: issue.longitude,
    submissionLat: review.submissionLat,
    submissionLng: review.submissionLng,
    visualChange: review.visualChange,
    citizenConfirmation: confirmation,
  });

  let reviewStatus = evaluation.reviewStatus;
  if (review.reviewStatus === 'reviewed_resolution' && confirmation === 'confirmed') {
    reviewStatus = 'reviewed_resolution';
  }
  db.prepare(
    `UPDATE resolution_reviews SET citizen_confirmation = ?, reasons = ?, checks = ?,
       confidence_band = ?, review_status = ? WHERE review_id = ?`,
  ).run(
    confirmation,
    JSON.stringify(evaluation.reasons),
    JSON.stringify(evaluation.checks),
    evaluation.confidenceBand,
    reviewStatus,
    review.reviewId,
  );

  let newStatus = issue.status;
  if (confirmation === 'disputed' && ['resolution_submitted', 'needs_verification', 'resolved'].includes(issue.status)) {
    assertTransition(issue.status, 'reopened');
    newStatus = 'reopened';
    db.prepare('UPDATE issues SET status = ?, updated_at = ? WHERE issue_id = ?').run(
      'reopened',
      timestamp,
      issueId,
    );
  } else {
    db.prepare('UPDATE issues SET updated_at = ? WHERE issue_id = ?').run(timestamp, issueId);
  }

  logHistory(db, {
    issueId,
    oldStatus: issue.status,
    newStatus,
    changedBy: actor || 'Citizen',
    note:
      note ||
      (confirmation === 'confirmed'
        ? 'Citizen confirmed the submitted repair. Human review still required before resolution.'
        : 'Citizen disputed the submitted repair. Issue reopened for review.'),
    timestamp,
  });
  return getIssueDetail(issueId);
}

export function reviewDuplicate(issueId, { suggestionId, action, actor, note, now = new Date() }) {
  const suggestion = db
    .prepare('SELECT * FROM duplicate_suggestions WHERE suggestion_id = ? AND issue_id = ?')
    .get(suggestionId, issueId);
  if (!suggestion) throw httpError(404, 'Duplicate suggestion not found for this issue.');
  if (suggestion.status !== 'pending') {
    throw httpError(409, 'This duplicate suggestion has already been reviewed.');
  }
  if (!['confirm', 'reject'].includes(action)) {
    throw httpError(422, 'action must be "confirm" or "reject".');
  }
  const issue = getIssueRow(issueId);
  const timestamp = now.toISOString();
  db.prepare(
    'UPDATE duplicate_suggestions SET status = ?, reviewed_by = ?, reviewed_at = ? WHERE suggestion_id = ?',
  ).run(action === 'confirm' ? 'confirmed' : 'rejected', actor || 'Authority', timestamp, suggestionId);

  if (action === 'confirm') {
    if (suggestion.candidate_issue_id === issueId) {
      throw httpError(422, 'An issue cannot be linked to itself.');
    }
    const candidate = getIssueRow(suggestion.candidate_issue_id);
    if (!candidate) throw httpError(404, 'Candidate issue no longer exists.');
    db.prepare('UPDATE issues SET parent_issue_id = ?, updated_at = ? WHERE issue_id = ?').run(
      suggestion.candidate_issue_id,
      timestamp,
      issueId,
    );
    recomputeIssueScore(suggestion.candidate_issue_id, now);
    logHistory(db, {
      issueId,
      oldStatus: issue.status,
      newStatus: issue.status,
      changedBy: actor || 'Authority',
      note: `Linked to ${suggestion.candidate_issue_id} as a duplicate after operator review. Original report retained.`,
      timestamp,
    });
    logHistory(db, {
      issueId: suggestion.candidate_issue_id,
      oldStatus: candidate.status,
      newStatus: candidate.status,
      changedBy: actor || 'Authority',
      note: `Duplicate report ${issueId} confirmed and linked.${note ? ` Note: ${note}` : ''}`,
      timestamp,
    });
  } else {
    logHistory(db, {
      issueId,
      oldStatus: issue.status,
      newStatus: issue.status,
      changedBy: actor || 'Authority',
      note: `Duplicate suggestion ${suggestion.candidate_issue_id} rejected after operator review.${note ? ` Note: ${note}` : ''}`,
      timestamp,
    });
  }
  return getIssueDetail(issueId);
}

export function overridePriority(issueId, { score, reason, actor, now = new Date() }) {
  const issue = getIssueRow(issueId);
  if (!issue) throw httpError(404, `Issue ${issueId} not found`);
  const numeric = Number(score);
  if (!Number.isInteger(numeric) || numeric < 0 || numeric > 100) {
    throw httpError(422, 'Priority override must be an integer between 0 and 100.');
  }
  if (!reason || reason.trim().length < 10) {
    throw httpError(422, 'An override reason of at least 10 characters is required.');
  }
  const band = numeric >= 80 ? 'critical' : numeric >= 60 ? 'high' : numeric >= 35 ? 'medium' : 'low';
  const timestamp = now.toISOString();
  db.prepare(
    `INSERT INTO priority_overrides (override_id, issue_id, previous_score, new_score, reason, actor, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  ).run(makeId('OVR'), issueId, issue.priority_score, numeric, reason.trim(), actor || 'Authority', timestamp);
  db.prepare(
    `UPDATE issues SET priority_score = ?, priority_band = ?, priority_override = 1,
       priority_override_reason = ?, updated_at = ? WHERE issue_id = ?`,
  ).run(numeric, band, reason.trim(), timestamp, issueId);
  logHistory(db, {
    issueId,
    oldStatus: issue.status,
    newStatus: issue.status,
    changedBy: actor || 'Authority',
    note: `Priority overridden from ${issue.priority_score} to ${numeric}. Reason: ${reason.trim()}`,
    timestamp,
  });
  return getIssueDetail(issueId);
}

export function getReportsForIssue(issueId) {
  return getReports(issueId);
}
