import express from 'express';
import cors from 'cors';
import multer from 'multer';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { z } from 'zod';
import { GoogleGenAI } from '@google/genai';
import {
  db,
  DB_PATH,
  UPLOAD_DIR,
  SERVER_ROOT,
  PROJECT_ROOT,
  getIssueDetail,
  listIssueRows,
  getStats,
  nowIso,
} from './db.js';
import {
  createIssue,
  addReportToIssue,
  updateStatus,
  assignIssue,
  submitResolution,
  verifyResolution,
  citizenFeedback,
  reviewDuplicate,
  overridePriority,
} from './service.js';
import { ensureDemoData, seedDemo, clearAllData } from './seed.js';
import { STATUS_LABELS } from './status.js';

const app = express();
const PORT = Number(process.env.PORT || 4000);
const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN || 'http://localhost:5173';
const AI_SERVICE_URL = process.env.AI_SERVICE_URL || 'http://localhost:8000';

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-3.8-flash';
const ROBOFLOW_API_KEY = process.env.ROBOFLOW_API_KEY;
const ROBOFLOW_MODEL_ID = process.env.ROBOFLOW_MODEL_ID;

const AI_ENABLED = process.env.AI_ENABLED !== 'false';

const CATEGORIES = ['pothole', 'garbage', 'streetlight', 'water_leakage', 'damaged_road', 'other'];
const STATUS_VALUES = [
  'reported', 'under_review', 'assigned', 'in_progress', 'resolution_submitted', 'needs_verification', 'resolved', 'reopened',
];

const optionalCoord = (min, max) =>
  z.preprocess(
    (value) => (value === '' || value === null || value === undefined ? undefined : value),
    z.coerce.number().min(min).max(max).optional(),
  );

const booleanish = z.preprocess(
  (value) => value === true || value === 'true' || value === '1' || value === 1,
  z.boolean(),
);

const actorSchema = z.string().trim().min(2).max(80);

const issueSchema = z
  .object({
    category: z.enum(CATEGORIES),
    title: z.string().trim().min(5, 'Title must be at least 5 characters').max(120),
    description: z.string().trim().min(20, 'Description must be at least 20 characters').max(2000),
    latitude: optionalCoord(-90, 90),
    longitude: optionalCoord(-180, 180),
    locationLabel: z.string().trim().max(200).optional().or(z.literal('')),
    locationConfirmed: z.boolean().optional().default(false),
    submitterId: z.string().trim().max(80).optional(),
  })
  .superRefine((value, ctx) => {
    if ((value.latitude === undefined) !== (value.longitude === undefined)) {
      ctx.addIssue({ code: 'custom', message: 'Provide both latitude and longitude, or neither.' });
    }
    if (value.locationConfirmed && (value.latitude === undefined || value.longitude === undefined)) {
      ctx.addIssue({
        code: 'custom',
        message: 'Location cannot be confirmed without valid coordinates.',
      });
    }
  });

const reportSchema = z.object({
  description: z.string().trim().min(10).max(2000),
  latitude: optionalCoord(-90, 90),
  longitude: optionalCoord(-180, 180),
  submitterId: z.string().trim().max(80).optional(),
});

const statusSchema = z.object({
  status: z.enum(STATUS_VALUES),
  actor: actorSchema.default('Authority'),
  note: z.string().trim().max(600).optional(),
});

const assignmentSchema = z.object({
  department: z.string().trim().min(2, 'Department is required').max(120),
  assignedBy: actorSchema.default('Authority'),
  note: z.string().trim().max(600).optional(),
});

const resolutionSchema = z.object({
  resolutionNote: z.string().trim().min(8, 'Resolution note must be at least 8 characters').max(2000),
  latitude: optionalCoord(-90, 90),
  longitude: optionalCoord(-180, 180),
  allowException: z.boolean().optional().default(false),
  visualChange: z.enum(['not_assessed', 'improved', 'no_clear_change', 'uncertain']).default('not_assessed'),
  actor: actorSchema.default('Authority'),
});

const verifySchema = z.object({
  decision: z.enum(['resolved', 'needs_verification']),
  actor: actorSchema.default('Authority reviewer'),
  note: z.string().trim().max(600).optional(),
});

const feedbackSchema = z.object({
  confirmation: z.enum(['confirmed', 'disputed']),
  actor: actorSchema.default('Citizen'),
  note: z.string().trim().max(600).optional(),
});

const duplicateReviewSchema = z.object({
  suggestionId: z.string().trim().min(3),
  action: z.enum(['confirm', 'reject']),
  actor: actorSchema.default('Authority'),
  note: z.string().trim().max(600).optional(),
});

const overrideSchema = z.object({
  score: z.coerce.number().int().min(0).max(100),
  reason: z.string().trim().min(10, 'Override reason must be at least 10 characters').max(600),
  actor: actorSchema.default('Authority'),
});

function validate(schema) {
  return (req, _res, next) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      const details = result.error.issues.map((issue) => ({
        field: issue.path.join('.') || 'body',
        message: issue.message,
      }));
      const error = new Error('Validation failed');
      error.statusCode = 422;
      error.details = details;
      next(error);
      return;
    }
    req.validated = result.data;
    next();
  };
}

function asyncHandler(fn) {
  return (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
}

// In‑memory cache for reverse‑geocode results (lat:lon → display_name) and rate‑limiting.
const geoCache = new Map(); // key: `lat,lon` → { display_name, ... }
const geoLastRequest = 0;
const GEO_MIN_INTERVAL = 1000; // 1 request per second (Nominatim policy)

function fetchReverseGeocode(lat, lon) {
  const key = `${lat},${lon}`;
  if (geoCache.has(key)) {
    return Promise.resolve(geoCache.get(key));
  }
  // Rate‑limit: wait if the last request was too recent.
  const now = Date.now();
  if (now - geoLastRequest < GEO_MIN_INTERVAL) {
    return new Promise((resolve) => {
      setTimeout(() => {
        geoLastRequest = Date.now();
        resolve(fetchReverseGeocode(lat, lon));
      }, GEO_MIN_INTERVAL - (now - geoLastRequest));
    });
  }
  geoLastRequest = now;
  return fetch(
    `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lon}`,
    { headers: { 'User-Agent': 'CivicEye/1.0' } }
  ).then((r) => {
    if (!r.ok) return null;
    return r.json().then((data) => {
      const result = { display_name: data?.display_name || null, ...data };
      geoCache.set(key, result);
      return result;
    });
  });
}

app.disable('x-powered-by');
app.use(cors({ origin: [CLIENT_ORIGIN, 'http://127.0.0.1:5173'], credentials: false }));
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));
app.use('/uploads', express.static(UPLOAD_DIR, { maxAge: '1h' }));

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/webp'];
    if (!allowed.includes(file.mimetype)) {
      cb(new Error('Only JPEG, PNG or WebP images up to 5 MB are allowed.'));
      return;
    }
    cb(null, true);
  },
});

app.post('/api/ai/detect', upload.single('image'), asyncHandler(async (req, res) => {
  if (!GEMINI_API_KEY) {
    res.status(503).json({
      error: 'gemini_not_configured',
      message: 'Gemini AI is not configured. Set GEMINI_API_KEY in the server environment to enable image analysis, or report the issue manually below.',
    });
    return;
  }
  if (!req.file) {
    res.status(400).json({ error: 'No image file provided.' });
    return;
  }

  try {
    const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });

    const result = await ai.models.generateContent({
      model: GEMINI_MODEL,
      contents: [
        {
          parts: [
            {
              text: 'You are a civic issue detector. Identify the problem in this image and return strict JSON with these keys: detected (boolean), category (string from [pothole, garbage, streetlight, water_leakage, damaged_road, other]), title (string), description (string), severity (string from {critical, high, medium, low}), observations (array of short strings), requiresHumanReview (boolean). Only output valid JSON, no prose.',
            },
            {
              inlineData: {
                mimeType: req.file.mimetype,
                data: req.file.buffer.toString('base64'),
              },
            },
          ],
        },
      ],
      config: {
        responseMimeType: 'application/json',
        temperature: 0.2,
      },
    });

    let geminiResult;
    try {
      geminiResult = JSON.parse(result.text);
    } catch {
      throw new Error('AI analysis failed: invalid response from Gemini service.');
    }

    // Validate the Gemini result.
    const validateGemini = (obj) => {
      if (typeof obj.detected !== 'boolean') throw new Error('Invalid detected field');
      if (obj.category && typeof obj.category !== 'string') throw new Error('Invalid category field');
      if (obj.title && typeof obj.title !== 'string') throw new Error('Invalid title field');
      if (obj.description && typeof obj.description !== 'string') throw new Error('Invalid description field');
      if (obj.severity && typeof obj.severity !== 'string') throw new Error('Invalid severity field');
      if (obj.observations && !Array.isArray(obj.observations)) throw new Error('Invalid observations field');
      if (obj.requiresHumanReview !== undefined && typeof obj.requiresHumanReview !== 'boolean') throw new Error('Invalid requiresHumanReview field');
    };
    validateGemini(geminiResult);

    const geminiDetected = geminiResult.detected;
    const geminiCategory = geminiResult.category || null;
    const geminiTitle = geminiResult.title || null;
    const geminiDescription = geminiResult.description || null;
    const geminiSeverity = geminiResult.severity || 'medium';
    const geminiObservations = geminiResult.observations || [];
    const geminiRequiresReview = geminiResult.requiresHumanReview ?? true;

    // If nothing detected, return clear result.
    if (!geminiDetected) {
      const response = {
        detected: false,
        category: null,
        title: null,
        description: null,
        confidence: 0,
        boundingBox: null,
        detections: [],
        message: 'Analysis complete.',
        severity: 'low',
        observations: [],
        requiresHumanReview: false,
        providers: 'gemini',
      };
      res.json(response);
      return;
    }

    // Build the response compatible with AIDetectionResult + new fields.
    const response = {
      detected: geminiDetected,
      category: geminiCategory,
      title: geminiTitle,
      description: geminiDescription,
      confidence: geminiResult.confidence || 0.8,
      boundingBox: null,
      detections: [],
      message: 'Analysis complete.',
      severity: geminiSeverity,
      observations: geminiObservations,
      requiresHumanReview: geminiRequiresReview,
      providers: 'gemini',
    };

    res.json(response);
  } catch (error) {
    if (error.message?.includes('timeout')) {
      res.status(504).json({
        error: 'ai_service_timeout',
        message: 'The AI service timed out. Please try again or report the issue manually below.',
      });
    } else {
      // Sanitize: never forward raw model errors or internal paths.
      const safeMessage = error.message || 'AI analysis failed. Please try again or report the issue manually below.';
      res.status(500).json({ error: 'ai_detection_failed', message: safeMessage });
    }
  }
}));

app.get('/api/health', async (_req, res) => {
  const counts = db.prepare('SELECT COUNT(*) AS issues FROM issues').get();
  const reports = db.prepare('SELECT COUNT(*) AS reports FROM reports').get();
  let aiStatus = { available: false, configured: false, serviceUrl: null, message: 'AI detection disabled' };
  if (AI_ENABLED) {
    try {
      const aiRes = await fetch(`${AI_SERVICE_URL}/health`, { signal: AbortSignal.timeout(4000) });
      const aiBody = await aiRes.json();
      const loaded = aiRes.ok && aiBody.model_loaded === true;
      aiStatus = {
        available: loaded,
        configured: loaded,
        serviceUrl: AI_SERVICE_URL,
        message: loaded
          ? 'AI detection service ready'
          : 'AI detection model is not configured. Manual reporting is available.',
      };
    } catch {
      aiStatus = {
        available: false,
        configured: false,
        serviceUrl: AI_SERVICE_URL,
        message: 'AI detection service unreachable',
      };
    }
  }
  const providerDetail = {};
  if (GEMINI_API_KEY) providerDetail.gemini = true;
  if (ROBOFLOW_API_KEY && ROBOFLOW_MODEL_ID) providerDetail.roboflow = true;
  res.json({
    status: 'ok',
    time: nowIso(),
    database: 'SQLite (node:sqlite)',
    databasePath: path.basename(DB_PATH),
    issues: counts.issues,
    reports: reports.reports,
    aiPhotoComparison: false,
    duplicateImageSimilarity: false,
    aiDetection: aiStatus,
    aiProviders: providerDetail,
    note: 'Priority scoring and duplicate matching are deterministic rules. Photo comparison is off and evidence review is manual.',
  });
});

app.get('/api/geo/reverse', async (req, res) => {
  const { lat, lon } = req.query;
  if (typeof lat !== 'string' || typeof lon !== 'string') {
    res.status(400).json({ error: 'Latitude and longitude query parameters are required.' });
    return;
  }
  const numberLat = Number(lat);
  const numberLon = Number(lon);
  if (!Number.isFinite(numberLat) || !Number.isFinite(numberLon)) {
    res.status(400).json({ error: 'Invalid latitude or longitude.' });
    return;
  }
  try {
    const result = await fetchReverseGeocode(numberLat, numberLon);
    if (!result) {
      res.json({
        display_name: null,
        lat: numberLat,
        lon: numberLon,
        address: {},
        note: 'Reverse geocoding best‑effort; no address found. Coordinates remain valid.',
      });
      return;
    }
    res.json(result);
  } catch (error) {
    console.error('Geocode proxy error:', error);
    res.status(502).json({ error: 'geocode_failed', message: 'Could not reverse‑geocode the location.' });
  }
});

app.get('/api/issues', (req, res, next) => {
  try {
    const querySchema = z.object({
      category: z.enum(CATEGORIES).optional(),
      status: z.string().optional(),
      q: z.string().trim().max(120).optional(),
      sort: z.enum(['priority', 'recent', 'waiting', 'score_asc']).optional(),
      band: z.enum(['critical', 'high', 'medium', 'low']).optional(),
    });
    const parsed = querySchema.safeParse(req.query);
    if (!parsed.success) {
      res.status(422).json({ error: 'Invalid query parameters', details: parsed.error.issues });
      return;
    }
    if (parsed.data.status) {
      const values = parsed.data.status.split(',');
      if (values.some((value) => !STATUS_VALUES.includes(value))) {
        res.status(422).json({ error: 'Invalid status filter' });
        return;
      }
    }
    res.json({ issues: listIssueRows(parsed.data) });
  } catch (error) {
    next(error);
  }
});

app.get('/api/issues/:issueId', (req, res) => {
  const issue = getIssueDetail(req.params.issueId.toUpperCase());
  if (!issue) {
    res.status(404).json({ error: `Complaint ${req.params.issueId} not found` });
    return;
  }
  res.json({ issue });
});

app.post('/api/issues', upload.single('photo'), validate(issueSchema), asyncHandler(async (req, res) => {
  const photoUrl = req.file ? `/uploads/${req.file.filename}` : null;
  const result = createIssue({
    data: req.validated,
    photoUrl,
    submitterId: req.validated.submitterId || `anon-${crypto.randomUUID().slice(0, 8)}`,
  });
  res.status(result.linkedToExisting ? 200 : 201).json({
    issueId: result.issueId,
    linkedToExisting: result.linkedToExisting,
    match: result.match,
    message: result.linkedToExisting
      ? `This report was linked to existing complaint ${result.issueId}; the original submission was preserved.`
      : `Complaint ${result.issueId} created.`,
    issue: result.issue,
  });
}));

app.post('/api/issues/:issueId/reports', upload.single('photo'), validate(reportSchema), (req, res) => {
  const photoUrl = req.file ? `/uploads/${req.file.filename}` : null;
  const issue = addReportToIssue(req.params.issueId.toUpperCase(), {
    data: req.validated,
    photoUrl,
    submitterId: req.validated.submitterId || `anon-${crypto.randomUUID().slice(0, 8)}`,
  });
  res.status(201).json({ message: 'Report linked to the issue.', issue });
});

app.patch('/api/issues/:issueId/status', validate(statusSchema), (req, res) => {
  const issue = updateStatus(req.params.issueId.toUpperCase(), req.validated);
  res.json({
    message: `Status updated to ${STATUS_LABELS[req.validated.status]}.`,
    issue,
  });
});

app.post('/api/issues/:issueId/assignment', validate(assignmentSchema), (req, res) => {
  const issue = assignIssue(req.params.issueId.toUpperCase(), req.validated);
  res.json({ message: `Assigned to ${req.validated.department}.`, issue });
});

app.post('/api/issues/:issueId/resolution', upload.single('afterPhoto'), validate(resolutionSchema), (req, res) => {
  const afterPhotoUrl = req.file ? `/uploads/${req.file.filename}` : null;
  const result = submitResolution(req.params.issueId.toUpperCase(), {
    ...req.validated,
    submissionLat: req.validated.latitude,
    submissionLng: req.validated.longitude,
    afterPhotoUrl,
  });
  res.status(201).json({
    message:
      result.review.reviewStatus === 'needs_verification'
        ? 'Resolution evidence saved. Automated checks require manual verification.'
        : 'Resolution evidence saved and is awaiting review.',
    ...result,
  });
});

app.post('/api/issues/:issueId/verify', validate(verifySchema), (req, res) => {
  const issue = verifyResolution(req.params.issueId.toUpperCase(), req.validated);
  res.json({
    message:
      req.validated.decision === 'resolved'
        ? 'Resolution accepted after human review. Issue marked resolved.'
        : 'Further verification requested. Issue remains open.',
    issue,
  });
});

app.post('/api/issues/:issueId/feedback', validate(feedbackSchema), (req, res) => {
  const issue = citizenFeedback(req.params.issueId.toUpperCase(), req.validated);
  res.json({
    message:
      req.validated.confirmation === 'confirmed'
        ? 'Citizen confirmation recorded. Human review is still required.'
        : 'Dispute recorded. The issue has been reopened.',
    issue,
  });
});

app.post('/api/issues/:issueId/duplicate-review', validate(duplicateReviewSchema), (req, res) => {
  const issue = reviewDuplicate(req.params.issueId.toUpperCase(), req.validated);
  res.json({
    message:
      req.validated.action === 'confirm'
        ? 'Duplicate confirmed. Original submission retained.'
        : 'Duplicate suggestion rejected.',
    issue,
  });
});

app.post('/api/issues/:issueId/priority-override', validate(overrideSchema), (req, res) => {
  const issue = overridePriority(req.params.issueId.toUpperCase(), req.validated);
  res.json({ message: 'Priority override recorded with reason.', issue });
});

app.get('/api/stats', (_req, res) => {
  res.json({ stats: getStats() });
});

app.get('/api/demo/status', (_req, res) => {
  const issues = db.prepare('SELECT COUNT(*) AS count FROM issues').get().count;
  const demo = db.prepare('SELECT COUNT(*) AS count FROM issues WHERE demo_data = 1').get().count;
  res.json({ issues, demoIssues: demo });
});

app.post('/api/demo/load', (req, res) => {
  if (req.body?.confirm !== 'LOAD') {
    res.status(400).json({ error: 'Send { "confirm": "LOAD" } to load demo data. Existing non-demo records are preserved if the database is not empty.' });
    return;
  }
  const result = seedDemo({ force: false });
  res.json(result);
});

app.post('/api/demo/reset', (req, res) => {
  if (req.body?.confirm !== 'RESET') {
    res.status(400).json({ error: 'Send { "confirm": "RESET" } to reset. This deletes all issues and rebuilds demo data.' });
    return;
  }
  clearAllData();
  const result = seedDemo({ force: false });
  res.json({ ...result, message: 'Database reset. Demo data reloaded.' });
});

app.use('/api', (_req, res) => {
  res.status(404).json({ error: 'API route not found' });
});



app.use('/api', (_req, res) => {
  res.status(404).json({ error: 'API route not found' });
});

app.use((error, req, res, _next) => {
  if (req.file?.path) {
    fs.promises.unlink(req.file.path).catch(() => {});
  }
  if (error instanceof multer.MulterError) {
    res.status(error.code === 'LIMIT_FILE_SIZE' ? 413 : 400).json({
      error: error.code === 'LIMIT_FILE_SIZE' ? 'Image is larger than 5 MB.' : error.message,
    });
    return;
  }
  if (error.message?.includes('Only JPEG')) {
    res.status(415).json({ error: error.message });
    return;
  }
  const statusCode = error.statusCode || 500;
  if (statusCode >= 500) console.error(error);
  res.status(statusCode).json({
    error: error.message || 'Unexpected server error',
    ...(error.details ? { details: error.details } : {}),
  });
});

ensureDemoData();

const server = app.listen(PORT, () => {
  console.log(`CivicEye AI API running at http://localhost:${PORT}`);
  console.log(`Health: http://localhost:${PORT}/api/health`);
  console.log('Rules-based scoring · duplicate text matching · manual photo review');
});

process.on('SIGTERM', () => server.close(() => process.exit(0)));
process.on('SIGINT', () => server.close(() => process.exit(0)));