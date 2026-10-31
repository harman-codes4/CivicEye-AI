export const STATUSES = [
  'reported',
  'under_review',
  'assigned',
  'in_progress',
  'resolution_submitted',
  'needs_verification',
  'resolved',
  'reopened',
];

export const STATUS_LABELS = {
  reported: 'Reported',
  under_review: 'Under review',
  assigned: 'Assigned',
  in_progress: 'In progress',
  resolution_submitted: 'Resolution submitted',
  needs_verification: 'Needs verification',
  resolved: 'Resolved (evidence reviewed)',
  reopened: 'Reopened',
};

export const TRANSITIONS = {
  reported: ['under_review', 'assigned', 'reopened'],
  under_review: ['assigned', 'in_progress', 'reopened'],
  assigned: ['in_progress', 'reopened'],
  in_progress: ['resolution_submitted', 'reopened'],
  resolution_submitted: ['needs_verification', 'reopened'],
  needs_verification: ['in_progress', 'resolution_submitted', 'reopened'],
  resolved: ['reopened'],
  reopened: ['under_review', 'assigned', 'in_progress'],
};

export function canTransition(from, to) {
  return Boolean(TRANSITIONS[from]?.includes(to));
}

export function assertTransition(from, to) {
  if (!STATUSES.includes(to)) {
    const error = new Error(`Unknown status "${to}"`);
    error.statusCode = 422;
    throw error;
  }
  if (!canTransition(from, to)) {
    const error = new Error(
      `Invalid status transition: ${STATUS_LABELS[from] || from} → ${STATUS_LABELS[to] || to}`,
    );
    error.statusCode = 422;
    throw error;
  }
}

export function isResolvableReviewStatus(status) {
  return ['resolution_submitted', 'needs_verification'].includes(status);
}
