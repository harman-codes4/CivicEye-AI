import { haversineMeters } from './duplicates.js';

export const VISUAL_CHANGE_VALUES = ['not_assessed', 'improved', 'no_clear_change', 'uncertain'];
export const CITIZEN_VALUES = ['pending', 'confirmed', 'disputed'];
export const LOCATION_MATCH_VALUES = ['consistent', 'inconsistent', 'unknown'];

/**
 * Rule-based evidence review. Automated photo comparison is DISABLED in this
 * build (no AI image detection). "improved" / "no_clear_change" / "uncertain"
 * must be recorded by a human operator; "not_assessed" is the default.
 */
export function evaluateResolutionEvidence({
  hasAfterPhoto,
  allowException = false,
  issueLat,
  issueLng,
  submissionLat,
  submissionLng,
  visualChange = 'not_assessed',
  citizenConfirmation = 'pending',
}) {
  const reasons = [];
  const checks = [];

  checks.push({
    id: 'after_photo',
    label: 'After-photo present',
    passed: Boolean(hasAfterPhoto),
    detail: hasAfterPhoto
      ? 'An after-photo was uploaded.'
      : allowException
        ? 'No after-photo; an exception was recorded and needs human review.'
        : 'No after-photo was uploaded.',
  });
  if (!hasAfterPhoto) {
    reasons.push(
      allowException
        ? 'After-photo is missing despite a recorded exception — manual review required.'
        : 'After-photo is missing. Resolution cannot be reviewed automatically.',
    );
  }

  let locationMatch = 'unknown';
  let distance = null;
  const coordinatesPresent = [submissionLat, submissionLng, issueLat, issueLng].every(
    (value) =>
      value !== null &&
      value !== undefined &&
      value !== '' &&
      Number.isFinite(Number(value)),
  );
  if (coordinatesPresent) {
    distance = haversineMeters(issueLat, issueLng, submissionLat, submissionLng);
    if (distance !== null && distance <= 100) locationMatch = 'consistent';
    else if (distance !== null && distance <= 500) locationMatch = 'unknown';
    else locationMatch = 'inconsistent';
  }

  checks.push({
    id: 'location',
    label: 'Location consistency',
    passed: locationMatch === 'consistent',
    detail:
      locationMatch === 'consistent'
        ? `Evidence location is ${Math.round(distance)} m from the reported location.`
        : locationMatch === 'inconsistent'
          ? `Evidence location is ${Math.round(distance)} m away — outside the 500 m review radius.`
          : 'Location not confirmed. Submission or issue coordinates are missing, or distance is 100–500 m.',
  });
  if (locationMatch === 'unknown') {
    reasons.push('Location not confirmed — coordinates missing or too far for a confident match.');
  } else if (locationMatch === 'inconsistent') {
    reasons.push('Evidence location is inconsistent with the reported issue location.');
  }

  checks.push({
    id: 'visual',
    label: 'Visual comparison',
    passed: visualChange === 'improved',
    detail:
      visualChange === 'not_assessed'
        ? 'Automated photo comparison is disabled in this build. No visual assessment recorded.'
        : visualChange === 'improved'
          ? 'An operator recorded a visible improvement (human assessment, not AI).'
          : visualChange === 'no_clear_change'
            ? 'An operator recorded no clear visual change.'
            : 'An operator recorded an uncertain visual result.',
  });
  if (visualChange !== 'improved') {
    reasons.push(
      visualChange === 'not_assessed'
        ? 'Photo comparison was not performed (AI image detection disabled) — human review required.'
        : visualChange === 'no_clear_change'
          ? 'Visual comparison suggests no clear change.'
          : 'Visual comparison is uncertain.',
    );
  }

  checks.push({
    id: 'citizen',
    label: 'Citizen confirmation',
    passed: citizenConfirmation === 'confirmed',
    detail:
      citizenConfirmation === 'confirmed'
        ? 'Citizen confirmed the repair.'
        : citizenConfirmation === 'disputed'
          ? 'Citizen disputed the repair.'
          : 'Citizen confirmation is pending.',
  });
  if (citizenConfirmation === 'disputed') {
    reasons.push('Citizen disputed the submitted resolution.');
  } else if (citizenConfirmation === 'pending') {
    reasons.push('Citizen confirmation is still pending.');
  }

  let reviewStatus;
  let confidenceBand;
  if (citizenConfirmation === 'disputed') {
    reviewStatus = 'citizen_disputed';
    confidenceBand = 'low';
  } else if (
    hasAfterPhoto &&
    locationMatch === 'consistent' &&
    visualChange === 'improved' &&
    citizenConfirmation === 'confirmed'
  ) {
    reviewStatus = 'eligible_for_reviewed_resolution';
    confidenceBand = 'high';
    reasons.unshift(
      'All rule-based checks passed. Human review is still required before marking the issue resolved.',
    );
  } else if (hasAfterPhoto && locationMatch === 'consistent' && visualChange === 'improved') {
    reviewStatus = 'awaiting_citizen_confirmation';
    confidenceBand = 'medium';
    reasons.unshift('Evidence is consistent but citizen confirmation is pending.');
  } else {
    reviewStatus = 'needs_verification';
    confidenceBand =
      hasAfterPhoto && (locationMatch === 'consistent' || visualChange === 'improved') ? 'medium' : 'low';
    reasons.unshift('Manual verification is required.');
  }

  return {
    locationMatch,
    visualChange,
    citizenConfirmation,
    confidenceBand,
    reviewStatus,
    reasons,
    checks,
    distanceM: distance === null ? null : Math.round(distance),
    automatedPhotoComparison: false,
    limitation:
      'No AI/image-similarity model is used. Visual assessment is human-entered and does not prove repair durability or quality.',
  };
}

export function canMarkResolved(review) {
  if (!review) return { ok: false, reason: 'No resolution review exists.' };
  if (!review.afterPhotoUrl) return { ok: false, reason: 'After-photo is missing.' };
  if (review.locationMatch !== 'consistent') {
    return { ok: false, reason: 'Location is not confirmed as consistent.' };
  }
  if (review.visualChange !== 'improved') {
    return { ok: false, reason: 'Visual improvement was not recorded by a human reviewer.' };
  }
  if (review.citizenConfirmation === 'disputed') {
    return { ok: false, reason: 'Citizen disputed the resolution.' };
  }
  if (review.citizenConfirmation !== 'confirmed') {
    return { ok: false, reason: 'Citizen confirmation is still pending.' };
  }
  return { ok: true };
}
