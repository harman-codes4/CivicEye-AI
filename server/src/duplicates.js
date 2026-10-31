export const DUPLICATE_CONFIG = {
  maxSuggestDistanceM: 1500,
  maxAutoLinkDistanceM: 600,
  highThreshold: 0.78,
  mediumThreshold: 0.58,
  imageSimilarity: 'disabled',
};

export function haversineMeters(lat1, lng1, lat2, lng2) {
  const raw = [lat1, lng1, lat2, lng2];
  if (raw.some((value) => value === null || value === undefined || value === '')) return null;
  const values = raw.map(Number);
  if (values.some((value) => !Number.isFinite(value))) return null;
  const [aLat, aLng, bLat, bLng] = values;
  const R = 6_371_000;
  const toRad = (deg) => (deg * Math.PI) / 180;
  const dLat = toRad(bLat - aLat);
  const dLng = toRad(bLng - aLng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

function tokens(text) {
  return new Set(
    String(text || '')
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter((word) => word.length > 2),
  );
}

export function textSimilarity(a, b) {
  const setA = tokens(a);
  const setB = tokens(b);
  if (!setA.size || !setB.size) return { score: 0, shared: [] };
  let intersection = 0;
  const shared = [];
  for (const token of setA) {
    if (setB.has(token)) {
      intersection += 1;
      shared.push(token);
    }
  }
  const union = new Set([...setA, ...setB]).size;
  return { score: intersection / union, shared: shared.slice(0, 8) };
}

/**
 * Baseline, explainable duplicate matching.
 * Photo similarity is intentionally disabled in this build — no AI image
 * detection is used. Matching relies on category, distance and text only.
 */
export function compareReports(newReport, candidate) {
  if (!candidate || newReport.category !== candidate.category) return null;

  const distance = haversineMeters(
    newReport.latitude,
    newReport.longitude,
    candidate.latitude,
    candidate.longitude,
  );
  const hasDistance = distance !== null && distance <= DUPLICATE_CONFIG.maxSuggestDistanceM;
  if (distance !== null && distance > DUPLICATE_CONFIG.maxSuggestDistanceM) return null;

  const textResult = textSimilarity(
    `${newReport.title} ${newReport.description}`,
    `${candidate.title} ${candidate.description}`,
  );

  let combined;
  if (hasDistance) {
    const distanceScore = Math.max(0, 1 - distance / DUPLICATE_CONFIG.maxSuggestDistanceM);
    combined = 0.4 + 0.35 * distanceScore + 0.25 * textResult.score;
  } else {
    combined = 0.35 + 0.45 * textResult.score;
  }
  combined = Math.max(0, Math.min(1, combined));

  const reasons = ['Same issue category'];
  if (hasDistance) {
    reasons.push(`Approximately ${Math.round(distance)} m apart`);
  } else {
    reasons.push('Coordinates missing — matched on text only');
  }
  reasons.push(`Text similarity ${Math.round(textResult.score * 100)}%`);
  if (textResult.shared.length) {
    reasons.push(`Shared terms: ${textResult.shared.join(', ')}`);
  }

  const canAutoLink =
    combined >= DUPLICATE_CONFIG.highThreshold &&
    textResult.score >= 0.3 &&
    (distance === null || distance <= DUPLICATE_CONFIG.maxAutoLinkDistanceM);

  const band =
    canAutoLink ? 'high' : combined >= DUPLICATE_CONFIG.mediumThreshold ? 'medium' : 'low';

  return {
    candidateIssueId: candidate.issueId,
    score: Number(combined.toFixed(3)),
    distanceM: distance === null ? null : Math.round(distance),
    textScore: Number(textResult.score.toFixed(3)),
    sharedTerms: textResult.shared,
    band,
    reasons,
  };
}

export function findBestDuplicate(newReport, candidates) {
  const matches = candidates
    .map((candidate) => compareReports(newReport, candidate))
    .filter(Boolean)
    .filter((match) => match.band !== 'low')
    .sort((a, b) => b.score - a.score);
  return matches[0] || null;
}
