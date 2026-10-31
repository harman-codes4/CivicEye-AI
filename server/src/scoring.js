export const CATEGORY_LABELS = {
  pothole: 'Pothole',
  garbage: 'Garbage Overflow',
  streetlight: 'Streetlight',
  water_leakage: 'Water Leakage',
  damaged_road: 'Damaged Road',
  other: 'Other',
};

const CATEGORY_BASE = {
  pothole: { safety: 26, impact: 13, sensitivity: 4 },
  garbage: { safety: 12, impact: 15, sensitivity: 5 },
  streetlight: { safety: 20, impact: 12, sensitivity: 6 },
  water_leakage: { safety: 22, impact: 14, sensitivity: 6 },
  damaged_road: { safety: 30, impact: 15, sensitivity: 5 },
  other: { safety: 10, impact: 8, sensitivity: 3 },
};

const SAFETY_KEYWORDS = [
  ['accident', 8, 'Accident risk mentioned'],
  ['injur', 10, 'Injury risk mentioned'],
  ['exposed wire', 9, 'Exposed electrical hazard'],
  ['electrocution', 10, 'Electrocution risk mentioned'],
  ['child', 6, 'Risk to children mentioned'],
  ['elderly', 4, 'Risk to elderly people mentioned'],
  ['deep', 5, 'Deep hazard mentioned'],
  ['hazard', 5, 'Hazard explicitly mentioned'],
  ['blind spot', 4, 'Blind-spot safety concern'],
  ['flood', 5, 'Flooding risk mentioned'],
  ['night', 3, 'Night-time safety concern'],
];

const IMPACT_KEYWORDS = [
  ['main road', 4, 'On a main road (high footfall)'],
  ['market', 3, 'Near a busy market'],
  ['bus stop', 3, 'Near a bus stop'],
  ['station', 4, 'Near a transit station'],
  ['hospital', 3, 'Near a hospital'],
  ['school', 3, 'Near a school'],
  ['traffic', 3, 'Affects traffic flow'],
  ['residential', 1, 'In a residential area'],
  ['thoroughfare', 3, 'Major thoroughfare'],
];

const SENSITIVE_LOCATIONS = [
  ['school', 15, 'Near a school'],
  ['hospital', 15, 'Near a hospital'],
  ['clinic', 13, 'Near a health clinic'],
  ['playground', 13, 'Near a playground'],
  ['market', 12, 'Near a busy market'],
  ['bus stop', 10, 'Near a bus stop'],
  ['station', 10, 'Near a transit station'],
];

const STOPWORDS = new Set([
  'the', 'a', 'an', 'and', 'or', 'of', 'on', 'in', 'at', 'to', 'for', 'is', 'are',
  'this', 'that', 'it', 'with', 'near', 'there', 'very', 'has', 'have', 'been',
]);

function textHash(text) {
  return String(text || '').toLowerCase();
}

function keywordScore(text, rules, cap) {
  let total = 0;
  const reasons = [];
  const matched = [];
  for (const [keyword, points, reason] of rules) {
    if (text.includes(keyword)) {
      total += points;
      reasons.push(reason);
      matched.push(keyword);
    }
  }
  return { points: Math.min(cap, total), reasons, matched };
}

export function priorityBand(score) {
  if (score >= 80) return 'critical';
  if (score >= 60) return 'high';
  if (score >= 35) return 'medium';
  return 'low';
}

/**
 * Deterministic, rule-based priority score (0-100).
 * This is NOT machine learning. Every factor is explainable.
 */
export function calculatePriority({
  category,
  title = '',
  description = '',
  locationLabel = '',
  createdAt,
  now = new Date(),
  independentReports = 1,
}) {
  const base = CATEGORY_BASE[category] || CATEGORY_BASE.other;
  const text = textHash(`${title} ${description} ${locationLabel}`);

  const safety = keywordScore(text, SAFETY_KEYWORDS, 40);
  const safetyScore = Math.min(40, base.safety + safety.points);

  const impact = keywordScore(text, IMPACT_KEYWORDS, 20);
  const impactScore = Math.min(20, base.impact + impact.points);

  let sensitivityScore = Math.min(15, base.sensitivity);
  let sensitivityReason = 'Standard location sensitivity';
  for (const [keyword, points, reason] of SENSITIVE_LOCATIONS) {
    if (text.includes(keyword)) {
      sensitivityScore = Math.max(sensitivityScore, points);
      sensitivityReason = reason;
      break;
    }
  }

  const createdMs = createdAt ? new Date(createdAt).getTime() : now.getTime();
  const hoursWaiting = Math.max(0, (now.getTime() - createdMs) / 3_600_000);
  const waitingDays = Math.floor(hoursWaiting / 24);
  const waitingScore = Math.min(15, waitingDays * 3);

  const reports = Math.max(1, Number(independentReports) || 1);
  const cappedReports = Math.min(reports, 5);
  const reportsScore = Math.min(10, cappedReports * 2);

  const score = Math.round(
    safetyScore + impactScore + sensitivityScore + waitingScore + reportsScore,
  );

  const reasons = [];
  if (safetyScore >= 32) reasons.push(`High safety risk (${safetyScore}/40)`);
  else if (safetyScore >= 20) reasons.push(`Moderate safety risk (${safetyScore}/40)`);
  else reasons.push(`Low safety risk (${safetyScore}/40)`);
  reasons.push(...safety.reasons.slice(0, 3));

  if (impactScore >= 16) reasons.push(`High public impact (${impactScore}/20)`);
  else if (impactScore >= 10) reasons.push(`Moderate public impact (${impactScore}/20)`);
  else reasons.push(`Limited public impact (${impactScore}/20)`);
  reasons.push(...impact.reasons.slice(0, 2));

  if (sensitivityScore >= 10) {
    reasons.push(`${sensitivityReason} (sensitive location ${sensitivityScore}/15)`);
  } else {
    reasons.push(`Standard location sensitivity (${sensitivityScore}/15)`);
  }

  if (waitingScore > 0) {
    reasons.push(`Waiting ${waitingDays} day${waitingDays === 1 ? '' : 's'} (${waitingScore}/15)`);
  } else {
    reasons.push('Reported today — no waiting-time contribution yet (0/15)');
  }

  if (reports > 1) {
    reasons.push(
      `Multiple independent reports: ${reports} (capped contribution ${reportsScore}/10)`,
    );
  } else {
    reasons.push(`Single independent report (${reportsScore}/10)`);
  }

  return {
    score,
    band: priorityBand(score),
    reasons: [...new Set(reasons)],
    factors: {
      safety: safetyScore,
      publicImpact: impactScore,
      locationSensitivity: sensitivityScore,
      waitingTime: waitingScore,
      independentReports: reportsScore,
    },
    meta: {
      waitingDays,
      reportCount: reports,
      cappedReportCount: cappedReports,
      category,
      calculatedAt: now.toISOString(),
      method: 'rule-based-v1',
    },
  };
}

export function buildDuplicateText(title, description) {
  return `${title} ${description}`
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((word) => word.length > 2 && !STOPWORDS.has(word));
}
