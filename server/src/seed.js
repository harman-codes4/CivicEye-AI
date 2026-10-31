import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { db, UPLOAD_DIR, makeId, logHistory } from './db.js';
import { DEMO_CITIZEN_ID } from './auth.js';
import { calculatePriority } from './scoring.js';
import { evaluateResolutionEvidence } from './evidence.js';
import { compareReports } from './duplicates.js';

const DAY = 86_400_000;

function svgImage(filename, kind, stage) {
  const themes = {
    pothole: { bg: '#4b5563', accent: '#1f2937', label: 'Pothole' },
    streetlight: { bg: '#1e293b', accent: '#0f172a', label: 'Streetlight' },
    water: { bg: '#475569', accent: '#0ea5e9', label: 'Water leak' },
    garbage: { bg: '#3f6212', accent: '#365314', label: 'Garbage overflow' },
    road: { bg: '#52525b', accent: '#27272a', label: 'Damaged road' },
    dumping: { bg: '#57534e', accent: '#292524', label: 'Illegal dumping' },
  };
  const theme = themes[kind] || themes.pothole;
  const isAfter = stage === 'after';
  const isUncertain = stage === 'uncertain';

  let scene = '';
  if (kind === 'pothole') {
    scene = isAfter
      ? `<ellipse cx="400" cy="350" rx="180" ry="80" fill="#111827" opacity="0.85"/>
         <ellipse cx="400" cy="348" rx="160" ry="65" fill="#1f2937"/>
         <path d="M250 345 L550 345" stroke="#374151" stroke-width="3" opacity="0.6"/>
         <text x="400" y="360" text-anchor="middle" fill="#9ca3af" font-family="Arial" font-size="20">Fresh patch</text>`
      : `<ellipse cx="410" cy="360" rx="190" ry="90" fill="#0b0f14"/>
         <ellipse cx="410" cy="352" rx="165" ry="70" fill="#111827"/>
         <path d="M240 300 L330 330 M560 300 L500 335 M280 410 L360 380 M520 405 L470 380" stroke="#111827" stroke-width="8" stroke-linecap="round"/>
         <rect x="300" y="300" width="14" height="120" fill="#374151" transform="rotate(18 300 300)"/>
         <rect x="490" y="300" width="14" height="120" fill="#374151" transform="rotate(-18 490 300)"/>`;
  } else if (kind === 'streetlight') {
    scene = `<rect x="390" y="130" width="20" height="340" fill="#64748b"/>
      <path d="M400 140 Q400 80 480 80" stroke="#64748b" stroke-width="18" fill="none"/>
      <rect x="462" y="70" width="80" height="24" rx="8" fill="#475569"/>
      <circle cx="502" cy="104" r="18" fill="${isAfter ? '#fde68a' : '#0b1220'}" opacity="${isAfter ? '0.95' : '0.9'}"/>
      ${isAfter ? '<path d="M502 104 L330 520 L674 520 Z" fill="#fde68a" opacity="0.12"/>' : '<text x="400" y="500" text-anchor="middle" fill="#94a3b8" font-family="Arial" font-size="18">Bulb not working</text>'}`;
  } else if (kind === 'water') {
    scene = `<rect x="0" y="300" width="800" height="120" fill="#64748b"/>
      <path d="M0 380 Q150 350 300 380 T600 380 T800 370" stroke="#0ea5e9" stroke-width="26" fill="none" opacity="${isAfter ? '0.85' : '0.95'}"/>
      <ellipse cx="350" cy="390" rx="210" ry="46" fill="#0284c7" opacity="${isUncertain ? '0.85' : '0.75'}"/>
      <rect x="170" y="250" width="460" height="18" rx="6" fill="#334155"/>
      <text x="400" y="430" text-anchor="middle" fill="#e2e8f0" font-family="Arial" font-size="18">${isUncertain ? 'Water still pooling on road' : 'Pipeline leaking'}</text>`;
  } else if (kind === 'garbage') {
    scene = `<rect x="270" y="220" width="260" height="260" rx="20" fill="#166534"/>
      <rect x="250" y="200" width="300" height="34" rx="10" fill="#14532d"/>
      ${[0, 1, 2, 3, 4, 5, 6, 7].map((i) => `<circle cx="${260 + i * 40}" cy="${300 + (i % 3) * 45}" r="${16 + (i % 3) * 5}" fill="${['#f59e0b', '#dc2626', '#e5e7eb', '#84cc16'][i % 4]}"/>`).join('')}
      <text x="400" y="530" text-anchor="middle" fill="#e5e7eb" font-family="Arial" font-size="18">Bins overflowing</text>`;
  } else if (kind === 'road') {
    scene = `<rect x="80" y="220" width="640" height="220" fill="#3f3f46"/>
      <path d="M200 200 L280 460 M360 200 L420 460 M540 200 L600 460" stroke="#18181b" stroke-width="18"/>
      <path d="M90 380 L250 340 L420 390 L600 330 L740 370" stroke="#18181b" stroke-width="26" fill="none"/>
      <ellipse cx="400" cy="360" rx="120" ry="50" fill="#09090b"/>
      <text x="400" y="520" text-anchor="middle" fill="#e4e4e7" font-family="Arial" font-size="18">Road surface collapsed</text>`;
  } else {
    scene = `<path d="M180 500 L300 260 L430 470 L560 300 L700 500 Z" fill="#44403c"/>
      <path d="M250 500 L340 330 L470 500 Z" fill="#78716c"/>
      <path d="M420 500 L520 360 L640 500 Z" fill="#57534e"/>
      <rect x="150" y="500" width="560" height="18" fill="#292524"/>
      <text x="400" y="560" text-anchor="middle" fill="#e7e5e4" font-family="Arial" font-size="18">Debris blocking access</text>`;
  }

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600" viewBox="0 0 800 600" role="img" aria-label="Demo ${theme.label} ${stage} photo">
  <rect width="800" height="600" fill="${theme.bg}"/>
  <rect x="0" y="0" width="800" height="72" fill="${theme.accent}"/>
  <text x="28" y="45" fill="#f8fafc" font-family="Arial" font-size="24" font-weight="bold">CivicEye AI · Demo evidence</text>
  <text x="772" y="45" text-anchor="end" fill="#cbd5e1" font-family="Arial" font-size="18">${stage.toUpperCase()}</text>
  <rect x="40" y="100" width="720" height="420" rx="16" fill="${theme.accent}" opacity="0.35"/>
  ${scene}
  <text x="400" y="580" text-anchor="middle" fill="#f8fafc" font-family="Arial" font-size="16" opacity="0.85">SYNTHETIC IMAGE — not a real photograph. Demo data only.</text>
</svg>`;
  fs.writeFileSync(path.join(UPLOAD_DIR, filename), svg, 'utf8');
  return `/uploads/${filename}`;
}

function ensureDemoImages() {
  return {
    potholeBefore: svgImage('demo-pothole-before.svg', 'pothole', 'before'),
    potholeAfter: svgImage('demo-pothole-after.svg', 'pothole', 'after'),
    potholeBefore2: svgImage('demo-pothole-before-2.svg', 'pothole', 'before'),
    streetlight: svgImage('demo-streetlight-before.svg', 'streetlight', 'before'),
    waterBefore: svgImage('demo-water-before.svg', 'water', 'before'),
    waterUncertain: svgImage('demo-water-after-uncertain.svg', 'water', 'uncertain'),
    garbage: svgImage('demo-garbage-before.svg', 'garbage', 'before'),
    road: svgImage('demo-road-before.svg', 'road', 'before'),
    dumping: svgImage('demo-dumping-before.svg', 'dumping', 'before'),
  };
}

function daysAgo(days, hours = 0) {
  return new Date(Date.now() - days * DAY + hours * 3_600_000).toISOString();
}

function insertDemoIssue({
  issueId,
  category,
  title,
  description,
  latitude,
  longitude,
  locationLabel,
  locationConfirmed = true,
  beforePhotoUrl,
  status,
  createdAt,
  updatedAt,
  reports,
  history,
  assignedDepartment = null,
  assignment = null,
  review = null,
  feedback = null,
  suggestion = null,
}) {
  const scoring = calculatePriority({
    category,
    title,
    description,
    locationLabel,
    createdAt,
    now: new Date(),
    independentReports: reports.length,
  });

  db.prepare(
    `INSERT INTO issues (issue_id, category, title, description, latitude, longitude,
       location_label, location_confirmed, before_photo_url, status, priority_score,
       priority_band, priority_factors, priority_reasons, report_count, demo_data,
       assigned_department, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?)`,
  ).run(
    issueId,
    category,
    title,
    description,
    latitude,
    longitude,
    locationLabel,
    locationConfirmed ? 1 : 0,
    beforePhotoUrl,
    status,
    scoring.score,
    scoring.band,
    JSON.stringify(scoring.factors),
    JSON.stringify(scoring.reasons),
    reports.length,
    assignedDepartment,
    createdAt,
    updatedAt,
  );

  for (const report of reports) {
    db.prepare(
      `INSERT INTO reports (report_id, issue_id, submitter_id, description, photo_url, latitude,
         longitude, relationship, demo_data, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?)`,
    ).run(
      makeId('RPT'),
      issueId,
      report.submitterId,
      report.description,
      report.photoUrl || null,
      report.latitude ?? latitude,
      report.longitude ?? longitude,
      report.relationship || 'primary',
      report.createdAt || createdAt,
    );
  }

  for (const event of history) {
    logHistory(db, {
      issueId,
      oldStatus: event.oldStatus,
      newStatus: event.newStatus,
      changedBy: event.changedBy,
      note: event.note,
      timestamp: event.timestamp,
      demoData: true,
    });
  }

  if (assignment) {
    db.prepare(
      `INSERT INTO assignments (assignment_id, issue_id, department_or_operator, assigned_by,
         assigned_at, assignment_status, note, demo_data)
       VALUES (?, ?, ?, ?, ?, 'assigned', ?, 1)`,
    ).run(
      makeId('ASG'),
      issueId,
      assignment.department,
      assignment.assignedBy,
      assignment.assignedAt,
      assignment.note || null,
    );
  }

  if (review) {
    const evaluation = evaluateResolutionEvidence({
      hasAfterPhoto: Boolean(review.afterPhotoUrl),
      allowException: Boolean(review.allowException),
      issueLat: latitude,
      issueLng: longitude,
      submissionLat: review.submissionLat,
      submissionLng: review.submissionLng,
      visualChange: review.visualChange,
      citizenConfirmation: review.citizenConfirmation,
    });
    db.prepare(
      `INSERT INTO resolution_reviews (review_id, issue_id, after_photo_url, resolution_note,
         location_match, visual_change, citizen_confirmation, confidence_band, reasons, checks,
         review_status, submission_lat, submission_lng, allow_exception, review_note,
         submitted_at, reviewed_at, reviewed_by, demo_data)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`,
    ).run(
      makeId('REV'),
      issueId,
      review.afterPhotoUrl || null,
      review.resolutionNote,
      evaluation.locationMatch,
      evaluation.visualChange,
      review.citizenConfirmation,
      review.reviewStatus === 'reviewed_resolution' ? 'high' : evaluation.confidenceBand,
      JSON.stringify(evaluation.reasons),
      JSON.stringify(evaluation.checks),
      review.reviewStatus || evaluation.reviewStatus,
      review.submissionLat ?? null,
      review.submissionLng ?? null,
      review.allowException ? 1 : 0,
      review.reviewNote || null,
      review.submittedAt,
      review.reviewedAt || null,
      review.reviewedBy || null,
    );
  }

  if (feedback) {
    db.prepare(
      `INSERT INTO citizen_feedback (feedback_id, issue_id, confirmation, actor, note, created_at)
       VALUES (?, ?, ?, 'Demo citizen', ?, ?)`,
    ).run(makeId('FB'), issueId, feedback.confirmation, feedback.note, feedback.createdAt);
  }

  if (suggestion) {
    db.prepare(
      `INSERT INTO duplicate_suggestions (suggestion_id, issue_id, candidate_issue_id, score,
         band, text_score, distance_m, reasons, status, created_at, demo_data)
       VALUES (?, ?, ?, ?, 'medium', ?, ?, ?, 'pending', ?, 1)`,
    ).run(
      makeId('DUP'),
      issueId,
      suggestion.candidateIssueId,
      suggestion.score,
      suggestion.textScore,
      suggestion.distanceM,
      JSON.stringify(suggestion.reasons),
      createdAt,
    );
  }

  return scoring;
}

export function clearAllData() {
  const tables = [
    'citizen_feedback',
    'priority_overrides',
    'duplicate_suggestions',
    'assignments',
    'resolution_reviews',
    'status_history',
    'reports',
    'issues',
  ];
  db.exec('BEGIN IMMEDIATE');
  try {
    for (const table of tables) db.exec(`DELETE FROM ${table};`);
    db.exec("DELETE FROM sqlite_sequence WHERE name IN ('issues', 'status_history');");
    db.exec('COMMIT');
  } catch (error) {
    try {
      db.exec('ROLLBACK');
    } catch {
      /* ignore */
    }
    throw error;
  }
}

export function seedDemo({ force = false } = {}) {
  const existing = db.prepare('SELECT COUNT(*) AS count FROM issues').get().count;
  if (existing > 0 && !force) {
    return { seeded: false, count: existing, message: 'Database already has issues; seed skipped.' };
  }
  if (force) clearAllData();

  const images = ensureDemoImages();

  insertDemoIssue({
    issueId: 'CIV-1024',
    category: 'pothole',
    title: 'Deep pothole at Vikas School gate',
    description:
      'Large, deep pothole at the school gate on the main road. Children walking to school and two-wheelers swerve into traffic; an accident happened last week. Risk of injury to children during morning assembly.',
    latitude: 23.2327,
    longitude: 77.434,
    locationLabel: 'Arera Colony, Bhopal',
    beforePhotoUrl: images.potholeBefore,
    status: 'in_progress',
    createdAt: daysAgo(6),
    updatedAt: daysAgo(3),
    reports: [
      {
        submitterId: 'demo-citizen-1',
        description:
          'Deep pothole near the school gate. Two-wheelers swerve into the main road to avoid it. Please fix before an accident.',
        createdAt: daysAgo(6),
        relationship: 'primary',
      },
      {
        submitterId: 'demo-citizen-2',
        description:
          'Same deep pothole at Vikas School gate. My scooter tyre got damaged this morning; children are walking around it.',
        photoUrl: images.potholeBefore2,
        createdAt: daysAgo(6, 5),
        relationship: 'linked',
      },
    ],
    history: [
      { oldStatus: null, newStatus: 'reported', changedBy: 'Citizen', note: 'Complaint created from citizen report.', timestamp: daysAgo(6) },
      { oldStatus: 'reported', newStatus: 'under_review', changedBy: 'Demo authority', note: 'Ward engineer reviewing safety risk.', timestamp: daysAgo(5.8) },
      { oldStatus: 'under_review', newStatus: 'assigned', changedBy: 'Demo authority', note: 'Assigned to PWD Bhopal for inspection.', timestamp: daysAgo(5) },
      { oldStatus: 'assigned', newStatus: 'in_progress', changedBy: 'Demo authority', note: 'Repair crew scheduled; traffic diversion requested.', timestamp: daysAgo(3) },
      { oldStatus: 'in_progress', newStatus: 'in_progress', changedBy: 'System · duplicate linkage', note: 'Linked report from citizen-2 preserved as evidence. Match 96%.', timestamp: daysAgo(6, 5) },
    ],
    assignedDepartment: 'PWD Bhopal',
    assignment: { department: 'PWD Bhopal', assignedBy: 'Demo authority', assignedAt: daysAgo(5), note: 'Inspect school-zone pothole.' },
  });

  insertDemoIssue({
    issueId: 'CIV-1025',
    category: 'pothole',
    title: 'Cracked patch beside SBI ATM',
    description:
      'Broken road patch near the ATM service lane in Arera Colony. Scooters slow down but no injury reported yet. Several loose stones are scattered on the lane.',
    latitude: 23.2331,
    longitude: 77.4349,
    locationLabel: 'Arera Colony service lane, Bhopal',
    beforePhotoUrl: images.potholeBefore2,
    status: 'reported',
    createdAt: daysAgo(2),
    updatedAt: daysAgo(2),
    reports: [
      {
        submitterId: 'demo-citizen-3',
        description:
          'Broken road patch near the SBI ATM service lane. Scooters slow down but no injury yet. Loose stones scattered.',
        createdAt: daysAgo(2),
      },
    ],
    history: [
      { oldStatus: null, newStatus: 'reported', changedBy: 'Citizen', note: 'Complaint created. Priority score stored.', timestamp: daysAgo(2) },
    ],
    suggestion: (() => {
      const match = compareReports(
        {
          category: 'pothole',
          title: 'Cracked patch beside SBI ATM',
          description:
            'Broken road patch near the ATM service lane in Arera Colony. Scooters slow down but no injury reported yet. Several loose stones are scattered on the lane.',
          latitude: 23.2331,
          longitude: 77.4349,
        },
        {
          issueId: 'CIV-1024',
          category: 'pothole',
          title: 'Deep pothole at Vikas School gate',
          description:
            'Large, deep pothole at the school gate on the main road. Children walking to school and two-wheelers swerve into traffic; an accident happened last week. Risk of injury to children during morning assembly.',
          latitude: 23.2327,
          longitude: 77.434,
        },
      );
      return match
        ? {
            candidateIssueId: 'CIV-1024',
            score: match.score,
            textScore: match.textScore,
            distanceM: match.distanceM,
            reasons: match.reasons,
          }
        : null;
    })(),
  });

  insertDemoIssue({
    issueId: 'CIV-1026',
    category: 'streetlight',
    title: 'Streetlight out near Sultania Hospital',
    description:
      'The streetlight on the hospital approach road has been dark for four nights. Staff and patients walk in the dark; exposed wire visible at the base of the pole.',
    latitude: 23.2595,
    longitude: 77.4078,
    locationLabel: 'Sultania Hospital approach road, Bhopal',
    beforePhotoUrl: images.streetlight,
    status: 'needs_verification',
    createdAt: daysAgo(3),
    updatedAt: daysAgo(1),
    reports: [
      {
        submitterId: 'demo-citizen-4',
        description:
          'Streetlight outside the hospital is dark for four nights. Exposed wire at the base; patients walk in the dark.',
        createdAt: daysAgo(3),
      },
    ],
    history: [
      { oldStatus: null, newStatus: 'reported', changedBy: 'Citizen', note: 'Complaint created.', timestamp: daysAgo(3) },
      { oldStatus: 'reported', newStatus: 'under_review', changedBy: 'Demo authority', note: 'Electrical safety check requested.', timestamp: daysAgo(3, 4) },
      { oldStatus: 'under_review', newStatus: 'assigned', changedBy: 'Demo authority', note: 'Assigned to municipal electrical wing.', timestamp: daysAgo(2, 20) },
      { oldStatus: 'assigned', newStatus: 'in_progress', changedBy: 'Demo authority', note: 'Lineman dispatched.', timestamp: daysAgo(2) },
      { oldStatus: 'in_progress', newStatus: 'resolution_submitted', changedBy: 'Demo authority', note: 'Resolution claimed without after-photo.', timestamp: daysAgo(1, 6) },
      { oldStatus: 'resolution_submitted', newStatus: 'needs_verification', changedBy: 'Evidence rules', note: 'Manual verification required: after-photo missing and location not confirmed.', timestamp: daysAgo(1, 6) },
    ],
    assignedDepartment: 'Municipal Electrical Wing',
    review: {
      afterPhotoUrl: null,
      resolutionNote:
        'Replaced the lamp unit and taped the exposed base. After-photo could not be uploaded because the field phone storage was full.',
      allowException: true,
      submissionLat: null,
      submissionLng: null,
      visualChange: 'not_assessed',
      citizenConfirmation: 'pending',
      reviewStatus: 'needs_verification',
      submittedAt: daysAgo(1, 6),
    },
  });

  insertDemoIssue({
    issueId: 'CIV-1027',
    category: 'water_leakage',
    title: 'Water pipeline leaking on New Market main road',
    description:
      'Continuous water leak from a broken pipeline outside the market. The road surface is eroding and pedestrians slip on the wet stretch. Traffic is slowing near the entrance.',
    latitude: 23.2337,
    longitude: 77.401,
    locationLabel: 'New Market, Bhopal',
    beforePhotoUrl: images.waterBefore,
    status: 'needs_verification',
    createdAt: daysAgo(4),
    updatedAt: daysAgo(1),
    reports: [
      {
        submitterId: 'demo-citizen-5',
        description:
          'Continuous water leak outside New Market. Road surface eroding and pedestrians slipping. Traffic slowing near the entrance.',
        createdAt: daysAgo(4),
      },
    ],
    history: [
      { oldStatus: null, newStatus: 'reported', changedBy: 'Citizen', note: 'Complaint created.', timestamp: daysAgo(4) },
      { oldStatus: 'reported', newStatus: 'under_review', changedBy: 'Demo authority', note: 'Water board notified.', timestamp: daysAgo(3, 18) },
      { oldStatus: 'under_review', newStatus: 'assigned', changedBy: 'Demo authority', note: 'Assigned to water maintenance team.', timestamp: daysAgo(3) },
      { oldStatus: 'assigned', newStatus: 'in_progress', changedBy: 'Demo authority', note: 'Excavation started.', timestamp: daysAgo(2) },
      { oldStatus: 'in_progress', newStatus: 'resolution_submitted', changedBy: 'Demo authority', note: 'Repair claimed with an after-photo.', timestamp: daysAgo(1, 4) },
      { oldStatus: 'resolution_submitted', newStatus: 'needs_verification', changedBy: 'Evidence rules', note: 'Manual verification required: evidence location inconsistent and no clear visual change recorded.', timestamp: daysAgo(1, 4) },
    ],
    assignedDepartment: 'Water Works',
    review: {
      afterPhotoUrl: images.waterUncertain,
      resolutionNote:
        'Leak was patched and the valve tightened. Water should stop pooling after the line settles.',
      submissionLat: 23.251,
      submissionLng: 77.42,
      visualChange: 'no_clear_change',
      citizenConfirmation: 'pending',
      reviewStatus: 'needs_verification',
      submittedAt: daysAgo(1, 4),
    },
  });

  insertDemoIssue({
    issueId: 'CIV-1028',
    category: 'pothole',
    title: 'Pothole on Char Imli cycle crossing',
    description:
      'Pothole at the cycle track crossing near the school bus stop. Cyclists fall during morning rush hour and parents have complained about the unsafe crossing.',
    latitude: 23.2255,
    longitude: 77.4285,
    locationLabel: 'Char Imli, Bhopal',
    beforePhotoUrl: images.potholeBefore,
    status: 'resolved',
    createdAt: daysAgo(8),
    updatedAt: daysAgo(3),
    reports: [
      {
        submitterId: 'demo-citizen-6',
        description:
          'Pothole at the cycle track crossing near the school bus stop. Cyclists fall during morning rush hour.',
        createdAt: daysAgo(8),
      },
      {
        submitterId: 'demo-citizen-7',
        description:
          'Same pothole on the cycle crossing near the bus stop. My daughter fell from her cycle yesterday.',
        createdAt: daysAgo(7, 20),
        relationship: 'linked',
      },
    ],
    history: [
      { oldStatus: null, newStatus: 'reported', changedBy: 'Citizen', note: 'Complaint created.', timestamp: daysAgo(8) },
      { oldStatus: 'reported', newStatus: 'under_review', changedBy: 'Demo authority', note: 'Site inspected.', timestamp: daysAgo(7, 12) },
      { oldStatus: 'under_review', newStatus: 'assigned', changedBy: 'Demo authority', note: 'Assigned to ward road maintenance.', timestamp: daysAgo(7) },
      { oldStatus: 'assigned', newStatus: 'in_progress', changedBy: 'Demo authority', note: 'Patch work started.', timestamp: daysAgo(5) },
      { oldStatus: 'in_progress', newStatus: 'resolution_submitted', changedBy: 'Demo authority', note: 'After-photo and repair note submitted.', timestamp: daysAgo(4) },
      { oldStatus: 'resolution_submitted', newStatus: 'resolved', changedBy: 'Demo reviewer', note: 'Location consistent, human-recorded improvement, citizen confirmed. Reviewed resolution accepted.', timestamp: daysAgo(3) },
    ],
    assignedDepartment: 'Ward Road Maintenance',
    review: {
      afterPhotoUrl: images.potholeAfter,
      resolutionNote:
        'Pothole filled with hot-mix asphalt and compacted. Crossing cleared and inspected the same evening.',
      submissionLat: 23.2255,
      submissionLng: 77.4285,
      visualChange: 'improved',
      citizenConfirmation: 'confirmed',
      reviewStatus: 'reviewed_resolution',
      submittedAt: daysAgo(4),
      reviewedAt: daysAgo(3),
      reviewedBy: 'Demo reviewer',
      reviewNote: 'Field visit confirmed the patch; citizen confirmed by tracking page.',
    },
    feedback: {
      confirmation: 'confirmed',
      note: 'Patch is visible and the crossing is usable again.',
      createdAt: daysAgo(3, 2),
    },
  });

  insertDemoIssue({
    issueId: 'CIV-1029',
    category: 'garbage',
    title: 'Overflowing bins behind Bittan Market',
    description:
      'Overflowing bins behind the vegetable market. Waste is spilling onto the footpath and attracting stray animals. Vendors say collection has been irregular for a week.',
    latitude: 23.2312,
    longitude: 77.4312,
    locationLabel: 'Bittan Market, Bhopal',
    beforePhotoUrl: images.garbage,
    status: 'in_progress',
    createdAt: daysAgo(5),
    updatedAt: daysAgo(2),
    reports: [
      { submitterId: 'demo-citizen-8', description: 'Bins overflowing behind Bittan Market; waste on footpath.', createdAt: daysAgo(5) },
      { submitterId: 'demo-citizen-9', description: 'Same garbage pile behind the vegetable market. Stray dogs tearing bags.', createdAt: daysAgo(4, 18), relationship: 'linked' },
      { submitterId: 'demo-citizen-10', description: 'Market waste not collected for a week. Strong smell near the food stalls.', createdAt: daysAgo(4), relationship: 'linked' },
    ],
    history: [
      { oldStatus: null, newStatus: 'reported', changedBy: 'Citizen', note: 'Complaint created.', timestamp: daysAgo(5) },
      { oldStatus: 'reported', newStatus: 'under_review', changedBy: 'Demo authority', note: 'Sanitation supervisor notified.', timestamp: daysAgo(4, 20) },
      { oldStatus: 'under_review', newStatus: 'assigned', changedBy: 'Demo authority', note: 'Assigned to sanitation team.', timestamp: daysAgo(4) },
      { oldStatus: 'assigned', newStatus: 'in_progress', changedBy: 'Demo authority', note: 'Extra collection round added.', timestamp: daysAgo(2) },
    ],
    assignedDepartment: 'Sanitation Department',
  });

  insertDemoIssue({
    issueId: 'CIV-1030',
    category: 'damaged_road',
    title: 'Road surface collapsed near Habibganj bus stop',
    description:
      'Road surface collapsed near the bus stop after heavy rain. Bus tyres are sinking into the edge and traffic is slowed. The exposed edge is a hazard for pedestrians.',
    latitude: 23.2294,
    longitude: 77.4325,
    locationLabel: 'Habibganj bus stop, Bhopal',
    beforePhotoUrl: images.road,
    status: 'under_review',
    createdAt: daysAgo(2),
    updatedAt: daysAgo(1),
    reports: [
      {
        submitterId: 'demo-citizen-11',
        description: 'Road collapsed near Habibganj bus stop after rain. Bus tyres sinking into the edge.',
        createdAt: daysAgo(2),
      },
      {
        submitterId: 'demo-citizen-12',
        description: 'Same collapsed road near the bus stop. Traffic backed up and pedestrians walking on the road.',
        createdAt: daysAgo(1, 20),
        relationship: 'linked',
      },
    ],
    history: [
      { oldStatus: null, newStatus: 'reported', changedBy: 'Citizen', note: 'Complaint created.', timestamp: daysAgo(2) },
      { oldStatus: 'reported', newStatus: 'under_review', changedBy: 'Demo authority', note: 'Site inspection scheduled; barricade requested.', timestamp: daysAgo(1) },
    ],
    assignedDepartment: 'PWD Bhopal',
  });

  insertDemoIssue({
    issueId: 'CIV-1031',
    category: 'streetlight',
    title: 'Two park lights out near walking track',
    description:
      'Two streetlights are out along the walking track in the park. Elderly residents avoid evening walks and the path is completely dark after 7 pm.',
    latitude: 23.236,
    longitude: 77.4295,
    locationLabel: 'Shivaji Nagar park, Bhopal',
    beforePhotoUrl: images.streetlight,
    status: 'assigned',
    createdAt: daysAgo(4),
    updatedAt: daysAgo(2),
    reports: [
      {
        submitterId: 'demo-citizen-13',
        description: 'Two park lights out along the walking track. Elderly residents avoid evening walks.',
        createdAt: daysAgo(4),
      },
    ],
    history: [
      { oldStatus: null, newStatus: 'reported', changedBy: 'Citizen', note: 'Complaint created.', timestamp: daysAgo(4) },
      { oldStatus: 'reported', newStatus: 'under_review', changedBy: 'Demo authority', note: 'Ward office reviewing.', timestamp: daysAgo(3) },
      { oldStatus: 'under_review', newStatus: 'assigned', changedBy: 'Demo authority', note: 'Assigned to electrical contractor.', timestamp: daysAgo(2) },
    ],
    assignedDepartment: 'Municipal Electrical Wing',
  });

  insertDemoIssue({
    issueId: 'CIV-1032',
    category: 'water_leakage',
    title: 'Pipeline leak flooding main road near station',
    description:
      'Water is gushing across the main road near Bhopal Junction station. Buses are splashing pedestrians and traffic is backed up. The leak appears to come from a broken distribution line.',
    latitude: 23.2685,
    longitude: 77.4015,
    locationLabel: 'Bhopal Junction station area, Bhopal',
    beforePhotoUrl: images.waterBefore,
    status: 'reported',
    createdAt: daysAgo(1),
    updatedAt: daysAgo(1),
    reports: [
      {
        submitterId: 'demo-citizen-14',
        description: 'Pipeline leak flooding the main road near Bhopal Junction. Buses splashing pedestrians.',
        createdAt: daysAgo(1),
      },
    ],
    history: [
      { oldStatus: null, newStatus: 'reported', changedBy: 'Citizen', note: 'Complaint created from station-area report.', timestamp: daysAgo(1) },
    ],
  });

  insertDemoIssue({
    issueId: 'CIV-1033',
    category: 'pothole',
    title: 'Pothole on 10 No. Market service road',
    description:
      'Medium pothole near the market entrance. Autos avoid it and suddenly change lanes, creating a risk for two-wheelers.',
    latitude: 23.2394,
    longitude: 77.4302,
    locationLabel: '10 No. Market, Bhopal',
    beforePhotoUrl: images.potholeBefore,
    status: 'resolved',
    createdAt: daysAgo(12),
    updatedAt: daysAgo(5),
    reports: [
      {
        submitterId: 'demo-citizen-15',
        description: 'Medium pothole near 10 No. Market entrance; autos suddenly change lanes.',
        createdAt: daysAgo(12),
      },
    ],
    history: [
      { oldStatus: null, newStatus: 'reported', changedBy: 'Citizen', note: 'Complaint created.', timestamp: daysAgo(12) },
      { oldStatus: 'reported', newStatus: 'under_review', changedBy: 'Demo authority', note: 'Inspected.', timestamp: daysAgo(11) },
      { oldStatus: 'under_review', newStatus: 'assigned', changedBy: 'Demo authority', note: 'Assigned to ward road team.', timestamp: daysAgo(10) },
      { oldStatus: 'assigned', newStatus: 'in_progress', changedBy: 'Demo authority', note: 'Repair started.', timestamp: daysAgo(8) },
      { oldStatus: 'in_progress', newStatus: 'resolution_submitted', changedBy: 'Demo authority', note: 'Resolution evidence uploaded.', timestamp: daysAgo(7) },
      { oldStatus: 'resolution_submitted', newStatus: 'resolved', changedBy: 'Demo reviewer', note: 'Reviewed resolution accepted after citizen confirmation.', timestamp: daysAgo(5) },
    ],
    assignedDepartment: 'Ward Road Maintenance',
    review: {
      afterPhotoUrl: images.potholeAfter,
      resolutionNote: 'Pothole cleaned, filled and compacted. Surface levelled with the service road.',
      submissionLat: 23.2394,
      submissionLng: 77.4302,
      visualChange: 'improved',
      citizenConfirmation: 'confirmed',
      reviewStatus: 'reviewed_resolution',
      submittedAt: daysAgo(7),
      reviewedAt: daysAgo(5),
      reviewedBy: 'Demo reviewer',
      reviewNote: 'Approved after field check.',
    },
    feedback: {
      confirmation: 'confirmed',
      note: 'Road is smooth now.',
      createdAt: daysAgo(5, 1),
    },
  });

  insertDemoIssue({
    issueId: 'CIV-1034',
    category: 'other',
    title: 'Construction debris dumped near playground',
    description:
      'A truckload of construction debris has been dumped near the Shivaji Nagar playground entrance. Children are climbing over the broken concrete and the footpath is blocked.',
    latitude: 23.2362,
    longitude: 77.4288,
    locationLabel: 'Shivaji Nagar playground, Bhopal',
    beforePhotoUrl: images.dumping,
    status: 'reported',
    createdAt: daysAgo(1),
    updatedAt: daysAgo(1),
    reports: [
      {
        submitterId: 'demo-citizen-16',
        description: 'Construction debris dumped near the playground entrance. Children climbing on broken concrete.',
        createdAt: daysAgo(1),
      },
    ],
    history: [
      { oldStatus: null, newStatus: 'reported', changedBy: 'Citizen', note: 'Complaint created in the Other category.', timestamp: daysAgo(1) },
    ],
  });

  const count = db.prepare('SELECT COUNT(*) AS count FROM issues').get().count;
  return {
    seeded: true,
    count,
    message: `Seeded ${count} clearly-labelled demo issues across 5 evidence scenarios.`,
  };
}

export function ensureDemoData() {
  const count = db.prepare('SELECT COUNT(*) AS count FROM issues').get().count;
  if (count === 0) return seedDemo();
  return { seeded: false, count, message: 'Existing data preserved.' };
}

const isMain =
  process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));
if (isMain) {
  const force = process.argv.includes('--force');
  const result = seedDemo({ force });
  console.log(result.message);
}
