import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const SERVER_ROOT = path.resolve(__dirname, '..');
export const PROJECT_ROOT = path.resolve(SERVER_ROOT, '..');

for (const envFile of [path.join(SERVER_ROOT, '.env'), path.join(PROJECT_ROOT, '.env')]) {
  if (fs.existsSync(envFile)) {
    try {
      process.loadEnvFile(envFile);
      break;
    } catch {
      // Ignore unreadable optional env files; explicit process env still wins.
    }
  }
}

export const DATA_DIR = process.env.CIVICEYE_DATA_DIR
  ? path.resolve(PROJECT_ROOT, process.env.CIVICEYE_DATA_DIR)
  : path.join(SERVER_ROOT, 'data');
export const UPLOAD_DIR = process.env.CIVICEYE_UPLOAD_DIR
  ? path.resolve(PROJECT_ROOT, process.env.CIVICEYE_UPLOAD_DIR)
  : path.join(SERVER_ROOT, 'uploads');
export const DB_PATH = path.join(DATA_DIR, 'civiceye.db');

for (const dir of [DATA_DIR, UPLOAD_DIR]) {
  fs.mkdirSync(dir, { recursive: true });
}

const schema = `
PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS users (
  user_id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('citizen', 'authority')),
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS sessions (
  token_hash TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_expiry ON sessions(expires_at);

CREATE TABLE IF NOT EXISTS issues (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  issue_id TEXT UNIQUE NOT NULL,
  category TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  latitude REAL,
  longitude REAL,
  location_label TEXT,
  location_confirmed INTEGER NOT NULL DEFAULT 0,
  before_photo_url TEXT,
  status TEXT NOT NULL DEFAULT 'reported',
  priority_score INTEGER NOT NULL DEFAULT 0,
  priority_band TEXT NOT NULL DEFAULT 'low',
  priority_factors TEXT NOT NULL DEFAULT '{}',
  priority_reasons TEXT NOT NULL DEFAULT '[]',
  priority_override INTEGER NOT NULL DEFAULT 0,
  priority_override_reason TEXT,
  parent_issue_id TEXT,
  report_count INTEGER NOT NULL DEFAULT 1,
  assigned_department TEXT,
  demo_data INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS reports (
  report_id TEXT PRIMARY KEY,
  issue_id TEXT NOT NULL REFERENCES issues(issue_id) ON DELETE CASCADE,
  submitter_id TEXT NOT NULL,
  description TEXT NOT NULL,
  photo_url TEXT,
  latitude REAL,
  longitude REAL,
  relationship TEXT NOT NULL DEFAULT 'primary',
  demo_data INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_reports_issue ON reports(issue_id);

CREATE TABLE IF NOT EXISTS status_history (
  event_id INTEGER PRIMARY KEY AUTOINCREMENT,
  issue_id TEXT NOT NULL REFERENCES issues(issue_id) ON DELETE CASCADE,
  old_status TEXT,
  new_status TEXT NOT NULL,
  changed_by TEXT NOT NULL,
  note TEXT,
  timestamp TEXT NOT NULL,
  demo_data INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_history_issue ON status_history(issue_id);

CREATE TABLE IF NOT EXISTS resolution_reviews (
  review_id TEXT PRIMARY KEY,
  issue_id TEXT NOT NULL REFERENCES issues(issue_id) ON DELETE CASCADE,
  after_photo_url TEXT,
  resolution_note TEXT NOT NULL,
  location_match TEXT NOT NULL DEFAULT 'unknown',
  visual_change TEXT NOT NULL DEFAULT 'not_assessed',
  citizen_confirmation TEXT NOT NULL DEFAULT 'pending',
  confidence_band TEXT NOT NULL DEFAULT 'low',
  reasons TEXT NOT NULL DEFAULT '[]',
  checks TEXT NOT NULL DEFAULT '[]',
  review_status TEXT NOT NULL DEFAULT 'needs_verification',
  submission_lat REAL,
  submission_lng REAL,
  allow_exception INTEGER NOT NULL DEFAULT 0,
  review_note TEXT,
  submitted_at TEXT NOT NULL,
  reviewed_at TEXT,
  reviewed_by TEXT,
  demo_data INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_reviews_issue ON resolution_reviews(issue_id);

CREATE TABLE IF NOT EXISTS assignments (
  assignment_id TEXT PRIMARY KEY,
  issue_id TEXT NOT NULL REFERENCES issues(issue_id) ON DELETE CASCADE,
  department_or_operator TEXT NOT NULL,
  assigned_by TEXT NOT NULL,
  assigned_at TEXT NOT NULL,
  assignment_status TEXT NOT NULL DEFAULT 'assigned',
  note TEXT,
  demo_data INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS duplicate_suggestions (
  suggestion_id TEXT PRIMARY KEY,
  issue_id TEXT NOT NULL REFERENCES issues(issue_id) ON DELETE CASCADE,
  candidate_issue_id TEXT NOT NULL,
  score REAL NOT NULL,
  band TEXT NOT NULL,
  text_score REAL,
  distance_m REAL,
  reasons TEXT NOT NULL DEFAULT '[]',
  status TEXT NOT NULL DEFAULT 'pending',
  reviewed_by TEXT,
  reviewed_at TEXT,
  created_at TEXT NOT NULL,
  demo_data INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS priority_overrides (
  override_id TEXT PRIMARY KEY,
  issue_id TEXT NOT NULL REFERENCES issues(issue_id) ON DELETE CASCADE,
  previous_score INTEGER NOT NULL,
  new_score INTEGER NOT NULL,
  reason TEXT NOT NULL,
  actor TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS citizen_feedback (
  feedback_id TEXT PRIMARY KEY,
  issue_id TEXT NOT NULL REFERENCES issues(issue_id) ON DELETE CASCADE,
  confirmation TEXT NOT NULL,
  actor TEXT NOT NULL,
  note TEXT,
  created_at TEXT NOT NULL
);
`;

export function openDatabase() {
  const db = new DatabaseSync(DB_PATH);
  db.exec(schema);
  return db;
}

export const db = openDatabase();

export function nowIso() {
  return new Date().toISOString();
}

export function makeId(prefix) {
  return `${prefix}-${Date.now().toString(36).toUpperCase()}${Math.floor(Math.random() * 1e6)
    .toString(36)
    .toUpperCase()
    .padStart(4, '0')}`;
}

export function parseJson(value, fallback) {
  try {
    return value ? JSON.parse(value) : fallback;
  } catch {
    return fallback;
  }
}

export function mapIssue(row) {
  if (!row) return null;
  return {
    id: row.id,
    issueId: row.issue_id,
    category: row.category,
    title: row.title,
    description: row.description,
    latitude: row.latitude,
    longitude: row.longitude,
    locationLabel: row.location_label,
    locationConfirmed: Boolean(row.location_confirmed),
    beforePhotoUrl: row.before_photo_url,
    status: row.status,
    priorityScore: row.priority_score,
    priorityBand: row.priority_band,
    priorityFactors: parseJson(row.priority_factors, {}),
    priorityReasons: parseJson(row.priority_reasons, []),
    priorityOverride: Boolean(row.priority_override),
    priorityOverrideReason: row.priority_override_reason,
    parentIssueId: row.parent_issue_id,
    reportCount: row.report_count,
    aggregateReportCount:
      row.aggregate_report_count === undefined || row.aggregate_report_count === null
        ? row.report_count
        : row.aggregate_report_count,
    assignedDepartment: row.assigned_department,
    demoData: Boolean(row.demo_data),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function nextIssueId(database = db) {
  const row = database
    .prepare("SELECT MAX(CAST(substr(issue_id, 5) AS INTEGER)) AS max_id FROM issues WHERE issue_id LIKE 'CIV-%'")
    .get();
  const next = row?.max_id ? Number(row.max_id) + 1 : 1024;
  return `CIV-${next}`;
}

export function logHistory(database, { issueId, oldStatus, newStatus, changedBy, note, timestamp, demoData = false }) {
  database
    .prepare(
      `INSERT INTO status_history (issue_id, old_status, new_status, changed_by, note, timestamp, demo_data)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(issueId, oldStatus, newStatus, changedBy, note || null, timestamp || nowIso(), demoData ? 1 : 0);
}

export function getIssueRow(issueId) {
  return db.prepare('SELECT * FROM issues WHERE issue_id = ?').get(issueId);
}

export function getReports(issueId) {
  return db
    .prepare('SELECT * FROM reports WHERE issue_id = ? ORDER BY created_at ASC')
    .all(issueId)
    .map((r) => ({
      reportId: r.report_id,
      issueId: r.issue_id,
      submitterId: r.submitter_id,
      description: r.description,
      photoUrl: r.photo_url,
      latitude: r.latitude,
      longitude: r.longitude,
      relationship: r.relationship,
      demoData: Boolean(r.demo_data),
      createdAt: r.created_at,
    }));
}

export function getHistory(issueId) {
  return db
    .prepare('SELECT * FROM status_history WHERE issue_id = ? ORDER BY timestamp ASC, event_id ASC')
    .all(issueId)
    .map((row) => ({
      eventId: row.event_id,
      issueId: row.issue_id,
      oldStatus: row.old_status,
      newStatus: row.new_status,
      changedBy: row.changed_by,
      note: row.note,
      timestamp: row.timestamp,
      demoData: Boolean(row.demo_data),
    }));
}

export function getReviews(issueId) {
  return db
    .prepare('SELECT * FROM resolution_reviews WHERE issue_id = ? ORDER BY submitted_at DESC')
    .all(issueId)
    .map(mapReview);
}

export function mapReview(row) {
  if (!row) return null;
  return {
    reviewId: row.review_id,
    issueId: row.issue_id,
    afterPhotoUrl: row.after_photo_url,
    resolutionNote: row.resolution_note,
    locationMatch: row.location_match,
    visualChange: row.visual_change,
    citizenConfirmation: row.citizen_confirmation,
    confidenceBand: row.confidence_band,
    reasons: parseJson(row.reasons, []),
    checks: parseJson(row.checks, []),
    reviewStatus: row.review_status,
    submissionLat: row.submission_lat,
    submissionLng: row.submission_lng,
    allowException: Boolean(row.allow_exception),
    reviewNote: row.review_note,
    submittedAt: row.submitted_at,
    reviewedAt: row.reviewed_at,
    reviewedBy: row.reviewed_by,
    demoData: Boolean(row.demo_data),
  };
}

export function getAssignments(issueId) {
  return db
    .prepare('SELECT * FROM assignments WHERE issue_id = ? ORDER BY assigned_at DESC')
    .all(issueId)
    .map((row) => ({
      assignmentId: row.assignment_id,
      issueId: row.issue_id,
      departmentOrOperator: row.department_or_operator,
      assignedBy: row.assigned_by,
      assignedAt: row.assigned_at,
      assignmentStatus: row.assignment_status,
      note: row.note,
    }));
}

export function getDuplicateSuggestions(issueId) {
  return db
    .prepare(
      `SELECT ds.*, i.title AS candidate_title, i.category AS candidate_category,
              i.status AS candidate_status, i.priority_score AS candidate_priority
       FROM duplicate_suggestions ds
       LEFT JOIN issues i ON i.issue_id = ds.candidate_issue_id
       WHERE ds.issue_id = ?
       ORDER BY ds.score DESC`,
    )
    .all(issueId)
    .map((row) => ({
      suggestionId: row.suggestion_id,
      issueId: row.issue_id,
      candidateIssueId: row.candidate_issue_id,
      candidateTitle: row.candidate_title,
      candidateCategory: row.candidate_category,
      candidateStatus: row.candidate_status,
      score: row.score,
      band: row.band,
      textScore: row.text_score,
      distanceM: row.distance_m,
      reasons: parseJson(row.reasons, []),
      status: row.status,
      reviewedBy: row.reviewed_by,
      reviewedAt: row.reviewed_at,
      createdAt: row.created_at,
    }));
}

export function getIssueDetail(issueId) {
  const row = getIssueRow(issueId);
  if (!row) return null;
  const issue = mapIssue(row);
  const children = db
    .prepare(
      `SELECT issue_id, title, status, report_count, priority_score, demo_data, created_at
       FROM issues WHERE parent_issue_id = ? ORDER BY created_at ASC`,
    )
    .all(issueId)
    .map((child) => ({
      issueId: child.issue_id,
      title: child.title,
      status: child.status,
      reportCount: child.report_count,
      priorityScore: child.priority_score,
      demoData: Boolean(child.demo_data),
      createdAt: child.created_at,
    }));

  return {
    ...issue,
    reports: getReports(issueId),
    linkedIssues: children,
    aggregateReportCount:
      issue.reportCount + children.reduce((sum, child) => sum + child.reportCount, 0),
    history: getHistory(issueId),
    reviews: getReviews(issueId),
    assignments: getAssignments(issueId),
    duplicateSuggestions: getDuplicateSuggestions(issueId),
    overrides: db
      .prepare('SELECT * FROM priority_overrides WHERE issue_id = ? ORDER BY created_at DESC')
      .all(issueId)
      .map((o) => ({
        overrideId: o.override_id,
        previousScore: o.previous_score,
        newScore: o.new_score,
        reason: o.reason,
        actor: o.actor,
        createdAt: o.created_at,
      })),
    feedback: db
      .prepare('SELECT * FROM citizen_feedback WHERE issue_id = ? ORDER BY created_at DESC')
      .all(issueId)
      .map((f) => ({
        feedbackId: f.feedback_id,
        confirmation: f.confirmation,
        actor: f.actor,
        note: f.note,
        createdAt: f.created_at,
      })),
  };
}

export function refreshReportCount(issueId) {
  const row = db.prepare('SELECT COUNT(*) AS count FROM reports WHERE issue_id = ?').get(issueId);
  db.prepare('UPDATE issues SET report_count = ?, updated_at = ? WHERE issue_id = ?').run(
    row.count,
    nowIso(),
    issueId,
  );
  return row.count;
}

export function recomputePriority(issueId, now = new Date()) {
  const row = getIssueRow(issueId);
  if (!row) return null;
  const reportRow = db
    .prepare('SELECT COUNT(DISTINCT submitter_id) AS submitters, COUNT(*) AS total FROM reports WHERE issue_id = ?')
    .get(issueId);
  const independentReports = Math.max(reportRow?.submitters || 1, 1);
  return { row, independentReports };
}

export function listIssueRows({ category, status, q, sort = 'priority', band } = {}) {
  const clauses = [];
  const params = [];
  if (category) {
    clauses.push('category = ?');
    params.push(category);
  }
  if (status) {
    const statuses = String(status).split(',').filter(Boolean);
    clauses.push(`status IN (${statuses.map(() => '?').join(',')})`);
    params.push(...statuses);
  }
  if (q) {
    clauses.push('(issue_id LIKE ? OR title LIKE ? OR description LIKE ? OR location_label LIKE ?)');
    const term = `%${q}%`;
    params.push(term, term, term, term);
  }
  if (band) {
    clauses.push('priority_band = ?');
    params.push(band);
  }
  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
  const order =
    sort === 'recent'
      ? 'created_at DESC'
      : sort === 'waiting'
        ? 'created_at ASC'
        : sort === 'score_asc'
          ? 'priority_score ASC'
          : 'priority_score DESC, created_at ASC';
  const rows = db
    .prepare(
      `SELECT issues.*,
         (SELECT COUNT(*) FROM reports r
          WHERE r.issue_id = issues.issue_id
             OR r.issue_id IN (SELECT c.issue_id FROM issues c WHERE c.parent_issue_id = issues.issue_id)
         ) AS aggregate_report_count
       FROM issues ${where} ORDER BY ${order} LIMIT 300`,
    )
    .all(...params);
  return rows.map(mapIssue);
}

export function getStats() {
  const counts = db.prepare('SELECT status, COUNT(*) AS count FROM issues GROUP BY status').all();
  const byStatus = Object.fromEntries(counts.map((row) => [row.status, row.count]));
  const total = db.prepare('SELECT COUNT(*) AS count FROM issues').get().count;
  const demo = db.prepare('SELECT COUNT(*) AS count FROM issues WHERE demo_data = 1').get().count;
  const openStatuses = ['reported', 'under_review', 'assigned', 'in_progress'];
  const open = openStatuses.reduce((sum, status) => sum + (byStatus[status] || 0), 0);
  const byCategory = db
    .prepare('SELECT category, COUNT(*) AS count FROM issues GROUP BY category ORDER BY count DESC')
    .all();
  const priority = db
    .prepare('SELECT priority_band AS band, COUNT(*) AS count FROM issues GROUP BY priority_band')
    .all();
  const resolvedRows = db
    .prepare(
      `SELECT i.created_at, MIN(h.timestamp) AS resolved_at
       FROM issues i JOIN status_history h ON h.issue_id = i.issue_id
       WHERE h.new_status = 'resolved'
       GROUP BY i.issue_id`,
    )
    .all();
  const durations = resolvedRows
    .map((row) => (new Date(row.resolved_at) - new Date(row.created_at)) / 3_600_000)
    .filter((hours) => Number.isFinite(hours) && hours >= 0);
  const avgResolutionHours = durations.length
    ? Number((durations.reduce((a, b) => a + b, 0) / durations.length).toFixed(1))
    : null;

  const areas = db
    .prepare(
      `SELECT COALESCE(NULLIF(TRIM(location_label), ''), 'Unspecified') AS area, COUNT(*) AS count
       FROM issues GROUP BY area ORDER BY count DESC LIMIT 8`,
    )
    .all()
    .map((row) => ({ area: row.area, count: row.count }));

  const pendingDuplicateSuggestions = db
    .prepare("SELECT COUNT(*) AS count FROM duplicate_suggestions WHERE status = 'pending'")
    .get().count;

  const recent = db
    .prepare('SELECT * FROM issues ORDER BY created_at DESC LIMIT 8')
    .all()
    .map(mapIssue);

  const queue = db
    .prepare("SELECT * FROM issues WHERE status NOT IN ('resolved') ORDER BY priority_score DESC LIMIT 8")
    .all()
    .map(mapIssue);

  return {
    total,
    demoIssues: demo,
    resolved: byStatus.resolved || 0,
    reopened: byStatus.reopened || 0,
    open,
    inProgress: byStatus.in_progress || 0,
    awaitingVerification: (byStatus.resolution_submitted || 0) + (byStatus.needs_verification || 0),
    critical: db.prepare("SELECT COUNT(*) AS count FROM issues WHERE priority_band = 'critical'").get().count,
    pendingDuplicateSuggestions,
    byStatus: Object.entries(byStatus).map(([status, count]) => ({ status, count })),
    byCategory: byCategory.map((row) => ({ category: row.category, count: row.count })),
    byPriority: ['critical', 'high', 'medium', 'low'].map((band) => ({
      band,
      count: priority.find((row) => row.band === band)?.count || 0,
    })),
    avgResolutionHours,
    resolvedSampleSize: durations.length,
    areas,
    recent,
    queue,
    generatedAt: nowIso(),
  };
}
