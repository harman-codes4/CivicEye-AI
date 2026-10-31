# CivicEye AI

**Report it. Prioritize it. Track it. Verify the evidence.**

CivicEye AI is a working civic-issue reporting and accountability prototype built for GRAVITON 2026. Citizens report public infrastructure problems; authorities group, prioritize, repair and verify them with a persisted audit trail.

> **Important note on AI in this build:** **Snap & Report** can optionally use a separately hosted YOLO/FastAPI service to detect a civic issue in the uploaded photo and pre-fill the complaint form. Detection is model-dependent: no weights are bundled, and if no trained model is configured the service returns a clear `model_not_configured` message while manual reporting continues to work. Photo **comparison**, duplicate matching and repair-evidence review remain deterministic/rule-based and manual — a detection is never treated as proof of severity, fraud, durability or repair quality.

---

## 1. What is implemented

- Responsive public landing page with live dashboard preview.
- **Snap & Report**: camera capture or gallery upload, optional YOLO detection, AI pre-fill of category/title/description/confidence, browser GPS + reverse geocoding, editable map pin, and an explicit review-and-confirm step before submission.
- Citizen dashboard with statistics, search, category/status filters, map, recent complaints and demo-data labels.
- Functional complaint form with validation, photo upload + preview, OSM map pin, geolocation, coordinate confirmation, stable complaint IDs and success state.
- Complaint tracking page with persisted status timeline, original report, linked reports, priority reasons, resolution evidence and citizen confirm/dispute actions.
- Separate authority dashboard with prioritized queue, search/filter/sort, duplicate review, assignment, status transitions, priority override with reason, resolution submission, evidence review, citizen confirmation state and full audit timeline.
- Analytics charts derived from the local database, with explicit demo-data disclosure.
- SQLite persistence via Node's built-in `node:sqlite`; images stored as files under `server/uploads` (not database blobs).
- Labelled synthetic demo records for the five required scenarios plus additional analytics records.
- Seeded synthetic evidence SVGs (self-authored, labelled "SYNTHETIC IMAGE — Demo data only").
- 36 automated tests + an end-to-end API smoke script.

### AI / "AI-assisted" status (transparent)

| Capability | Implementation | Not claimed |
|---|---|---|
| Snap & Report photo detection | Optional Ultralytics YOLO inference behind a FastAPI service, proxied by Express; returns category, confidence, title/description suggestions | Requires a trained model; not a severity or fraud verdict; cannot run without weights |
| Priority scoring | Deterministic weighted rules, 0–100, stored with factors and reasons | Not ML, not an official severity verdict |
| Duplicate detection | Same category + haversine distance + text Jaccard similarity | **No image similarity / photo AI**; not used to delete reports |
| Repair evidence | Rule checks (photo, location distance, human visual assessment, citizen confirmation) + human review | No AI image comparison; a photo does not prove repair quality or durability |
| Fraud detection | Not implemented and not claimed | No AI flag is treated as proof of fraud |

### Snap & Report workflow

1. Citizen taps **Capture photo** (browser camera) or **Upload from gallery** (JPEG/PNG/WebP, max 5 MB).
2. The photo is sent to `POST /api/ai/detect` → FastAPI `/detect` → YOLO.
3. If a model and detection are available, the form is pre-filled with the suggested category, title, description and a confidence score. Detections below 35% confidence only pre-fill text and ask the citizen to confirm the category.
4. Browser GPS is requested automatically (if no location is set); coordinates can be edited on the map or typed manually. Reverse geocoding (OpenStreetMap Nominatim) fills a readable address when available — it is never invented.
5. The citizen reviews a **final confirmation screen** and explicitly clicks **Confirm & submit complaint**. Nothing is submitted automatically.
6. Submission uses the existing `POST /api/issues` flow, so duplicate detection, priority scoring, status history, evidence tracking and stable IDs are unchanged.

Handled states: camera permission denied, geolocation denied/unavailable, invalid MIME, oversize image, AI service unreachable/disabled, no model configured, nothing detected, low confidence, and submission/network failure. When AI is unavailable the page says so and manual reporting stays fully usable.

---

## 2. Stack and architecture

**Frontend:** React 18, Vite 6, TypeScript, Tailwind CSS 3, Lucide React, Leaflet + OpenStreetMap, Recharts, React Router 7.

**Backend:** Node.js 22.5+ (tested on Node 24), Express 4, Zod validation, Multer uploads, `node:sqlite` (SQLite).

**AI detection (optional):** Python 3.9+, FastAPI, Ultralytics YOLO, Pillow. Runs as a separate inference-only service; the Express API proxies image uploads to it. No model weights are bundled.

**Storage:** SQLite at `server/data/civiceye.db`; uploaded images at `server/uploads/`. The SQLite fallback is used because no Supabase project is configured. `.env.example` contains placeholder variable names only.

```
.
├─ client/                  React + Vite app
│  ├─ src/components/       Reusable UI, map, logo, timeline, evidence panel
│  ├─ src/pages/            Landing, dashboards, report (Snap & Report), tracking, analytics
│  ├─ src/lib/              API hooks, labels, formatting
│  └─ dist/                 Production build (served by the API server)
├─ server/
│  ├─ ai-service/           Optional FastAPI + YOLO inference service
│  │  ├─ app.py             /health and /detect endpoints
│  │  ├─ requirements.txt
│  │  ├─ models/            Place trained best.pt here (not committed)
│  │  └─ README.md          Model setup + training instructions
│  ├─ src/db.js             Schema, queries, stats
│  ├─ src/service.js        Complaint/status/evidence/duplicate workflows
│  ├─ src/scoring.js        Deterministic priority scoring
│  ├─ src/duplicates.js     Baseline duplicate matching
│  ├─ src/evidence.js       Rule-based evidence review
│  ├─ src/status.js         Status transition guards
│  ├─ src/seed.js           Demo data + case scenarios
│  ├─ tests/                36 unit + workflow tests
│  └─ scripts/smoke.mjs     End-to-end API smoke checks
├─ .env.example
└─ README.md
```

---

## 3. Quick start

### Prerequisites

- Node.js **22.5 or newer** (required for `node:sqlite`; tested on Node 24.13)
- npm 10+
- Internet access for OpenStreetMap tiles (the app works without tiles, but the map background will not render)
- **Optional for AI detection:** Python 3.9+ and a trained YOLO weights file

### Install and run

```bash
# from the repository root
npm install
npm run install:all

# starts API on :4000 and Vite on :5173
npm run dev
```

Open **http://localhost:5173**.

The database is created automatically and seeded with labelled demo data on first server start.

### Optional: enable AI photo detection (Snap & Report)

Without this step, the app still works: the report page shows **"AI not configured"** and manual registration remains available.

```bash
# 1. Install Python dependencies
cd server/ai-service
pip install -r requirements.txt

# 2. Place a trained YOLO model at server/ai-service/models/best.pt
#    (or set YOLO_MODEL_PATH to an absolute path)

# 3. Start the inference service (from the same directory)
python app.py

# 4. In another terminal, start the app
cd ../..
npm run dev
```

The AI service listens on `http://localhost:8000`. The Express server proxies `POST /api/ai/detect` to it and never exposes internal file paths. See [`server/ai-service/README.md`](server/ai-service/README.md) for model training and class mapping.

### Production-style run

```bash
npm run build
npm start
```

The Express server serves the built client from `client/dist` and the API at `http://localhost:4000`.

### Useful commands

| Command | Purpose |
|---|---|
| `npm run dev` | Run API + Vite dev server together |
| `npm run dev:server` | API only (`http://localhost:4000`) |
| `npm run dev:client` | Vite only (`http://localhost:5173`) |
| `npm run build` | Type-check and build the client |
| `npm start` | Serve the built client + API |
| `npm run seed` | Seed demo data if the database is empty |
| `npm run reset` | **Destructive:** delete all records and rebuild demo data |
| `npm test` | Run all server tests |
| `npm run smoke` | Run API smoke checks (server must already be running) |
| `npm run ai:service` | Start the optional Python YOLO service (if dependencies installed) |

---

## 4. Environment configuration

Copy `.env.example` if you want to override defaults. Variables are optional for local use.

```env
PORT=4000
CLIENT_ORIGIN=http://localhost:5173
# CIVICEYE_DATA_DIR=./server/data
# CIVICEYE_UPLOAD_DIR=./server/uploads

# Optional AI detection proxy
AI_SERVICE_URL=http://localhost:8000
AI_ENABLED=true
```

AI service configuration (`server/ai-service/.env`, all optional):

```env
YOLO_MODEL_PATH=./models/best.pt
YOLO_CONF_THRESHOLD=0.25
YOLO_IOU_THRESHOLD=0.45
AI_SERVICE_HOST=0.0.0.0
AI_SERVICE_PORT=8000
```

Frontend optional override (create `client/.env`):

```env
VITE_API_BASE_URL=http://localhost:4000
```

The Vite dev server proxies `/api` and `/uploads` to port 4000 by default, so no frontend env is needed locally.

**Supabase is not wired in this prototype.** The brief allows a persistent local fallback, which this build uses. The Supabase variable names in `.env.example` are placeholders; never expose a service-role key in client code. See [Deployment and migration](#14-deployment).

---

## 5. Database

Schema is created automatically by `server/src/db.js`. Main tables:

- `issues` — issue_id, category, title, description, coordinates, location label/confirmed flag, before photo, status, priority score/factors/reasons, parent_issue_id, report_count, assignment, demo flag, timestamps.
- `reports` — every original citizen submission, linked or primary; never deleted when a duplicate is linked.
- `status_history` — immutable events with old_status, new_status, actor, note, timestamp.
- `resolution_reviews` — after-photo, note, location match, human visual assessment, citizen confirmation, confidence band, reasons/checks, review status, reviewer fields.
- `assignments` — department/operator, assigned_by, timestamp, status, note.
- `duplicate_suggestions` — candidate, score, band, reasons, review status.
- `priority_overrides` — previous/new score, mandatory reason, actor, timestamp.
- `citizen_feedback` — confirmations/disputes with actor, note, timestamp.

### Reset / seed

```bash
npm run reset   # deletes everything and rebuilds demo data
npm run seed    # seeds only when empty
```

The authority dashboard also has a **Reset demo data** button with a confirmation dialog.

### Demo scenarios (all labelled `Demo data`)

| ID | Scenario | Expected behaviour |
|---|---|---|
| `CIV-1024` | Case A: two reports of the same school-gate pothole | Linked report preserved; total reports shown; critical score |
| `CIV-1025` | Case B: different nearby pothole near SBI ATM | Remains separate; medium duplicate suggestion pending |
| `CIV-1026` | Case C: resolution claimed with no after-photo | `Needs verification`; after-photo check fails |
| `CIV-1027` | Case D: after-photo with inconsistent location and no clear visual change | `Needs verification`; reasons shown |
| `CIV-1028` | Case E: suitable evidence, reviewer approval, citizen confirmation | `Resolved (evidence reviewed)` with full history |
| `CIV-1029`–`CIV-1034` | Additional synthetic queue/analytics records | Charts and queue populated |

---

## 6. Status workflow

```
Reported → Under review → Assigned → In progress
In progress → Resolution submitted
Resolution submitted → Needs verification  (when rule checks fail)
Resolution submitted / Needs verification → Resolved (evidence reviewed)
Any active/resolved state → Reopened (citizen dispute or reviewer)
Needs verification → In progress (rework)
```

Rules enforced by the API:

- Direct `PATCH /status` to `resolved` is rejected — use evidence verification.
- Direct `PATCH /status` to `resolution_submitted` is rejected — use the resolution endpoint.
- Invalid transitions return HTTP 422 with a human-readable message.
- Every change writes a `status_history` event with previous status, new status, actor, note and timestamp.
- Timeline data is read from the database, so it survives refresh and restart.

---

## 7. Priority scoring

```
Priority = Safety (0–40)
         + Public Impact (0–20)
         + Location Sensitivity (0–15)
         + Waiting Time (0–15)
         + Independent Reports (0–10)
```

Bands: **Critical 80–100**, **High 60–79**, **Medium 35–59**, **Low 0–34**.

- Category baselines plus keyword boosts (accident, injury, child, exposed wire, main road, school, hospital, market, etc.).
- Waiting time: +3 per elapsed day, capped at 15. New same-day reports receive 0 from waiting time.
- Independent reports: distinct submitters, 2 points each, capped at 10. Raw complaint count is capped to reduce spam/coordination and is not treated as population.
- Every score stores five factor values and human-readable reasons.
- Authorized operators can override with a mandatory reason; the previous score and override are retained in `priority_overrides` and the audit timeline.

The calculation is deterministic and covered by tests.

---

## 8. Duplicate detection

Baseline, explainable and photo-free:

1. Category must match.
2. Distance is calculated with haversine; candidates beyond 1.5 km are ignored.
3. Text similarity uses token Jaccard over title + description.
4. Combined score (with coordinates) = `0.40 + 0.35 × distanceScore + 0.25 × textScore`.
5. **High confidence** requires combined ≥ 0.78, text similarity ≥ 0.30 and distance ≤ 600 m (or text-only match with no coordinates). The new report is appended to the parent issue; the original submission is preserved.
6. **Medium confidence** creates a separate issue plus a pending operator suggestion.
7. **Low confidence** stays separate.

Limitations: this is not a trained duplicate model, does not use image similarity, uses a simple English-oriented token baseline, and cannot understand paraphrases reliably. Operators make the final call; no complaint is ever deleted.

---

## 9. Repair evidence verification

Checks are independent:

1. After-photo present?
2. Location consistent / inconsistent / unknown (≤100 m consistent, 100–500 m unknown, >500 m inconsistent).
3. Visual change: `not_assessed` by default; `improved`, `no_clear_change`, `uncertain` can only be recorded by a human operator. **No AI image comparison is performed.**
4. Citizen confirmation: pending / confirmed / disputed.
5. Human review required?

Possible results:

- **Eligible for reviewed resolution** — photo, consistent location, human-recorded improvement and citizen confirmation.
- **Awaiting citizen confirmation** — checks pass but citizen feedback is pending.
- **Needs verification** — missing photo/exception, unknown/inconsistent location, no clear change, or no visual assessment.
- **Citizen disputed resolution** — citizen disputes; issue is reopened.

A missing after-photo can be submitted with a recorded exception, but it still needs manual verification. Resolving requires a human reviewer and all checks; the API blocks resolution otherwise. No result claims fraud or permanent repair quality.

---

## 10. API

Base URL: `http://localhost:4000`

| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/api/health` | Health + DB counts + AI disclosure (`aiDetection` status) |
| POST | `/api/ai/detect` | Proxy a photo to the YOLO service; returns suggestion (multipart `image`) |
| GET | `/api/issues` | List with `category`, `status`, `q`, `sort`, `band` filters |
| POST | `/api/issues` | Create complaint (multipart `photo` optional) |
| GET | `/api/issues/:issueId` | Full issue, reports, history, reviews, assignments, suggestions, overrides, feedback |
| POST | `/api/issues/:issueId/reports` | Add linked citizen report (multipart `photo` optional) |
| PATCH | `/api/issues/:issueId/status` | Validated status transition |
| POST | `/api/issues/:issueId/assignment` | Assign department/operator |
| POST | `/api/issues/:issueId/resolution` | Submit repair evidence (multipart `afterPhoto`) |
| POST | `/api/issues/:issueId/verify` | Human review: `resolved` or `needs_verification` |
| POST | `/api/issues/:issueId/feedback` | Citizen confirm/dispute |
| POST | `/api/issues/:issueId/duplicate-review` | Confirm/reject duplicate suggestion |
| POST | `/api/issues/:issueId/priority-override` | Override score with reason |
| GET | `/api/stats` | Database-derived dashboard/analytics statistics |
| GET | `/api/demo/status` | Demo record counts |
| POST | `/api/demo/load` | Seed if empty; requires `{ "confirm": "LOAD" }` |
| POST | `/api/demo/reset` | Destructive reset; requires `{ "confirm": "RESET" }` |

Validation errors return HTTP 422 with `{ error, details: [{ field, message }] }`. Uploads are limited to JPEG/PNG/WebP, 5 MB, one file, with random filenames.

### Example: submit a complaint

```bash
curl -X POST http://localhost:4000/api/issues \
  -F "category=pothole" \
  -F "title=Deep pothole at school gate" \
  -F "description=Large deep pothole used by children walking to school." \
  -F "latitude=23.2327" \
  -F "longitude=77.4340" \
  -F "locationLabel=Arera Colony, Bhopal" \
  -F "locationConfirmed=true" \
  -F "photo=@before.jpg"
```

---

## 11. Tests

```bash
npm test          # 36 tests: scoring, duplicates, transitions, evidence, end-to-end workflow
npm run smoke     # requires the API running on :4000
```

Latest verified result: **36/36 tests passing**, **client production build passing**, and the AI proxy verified for: health status reporting, missing-file `400`, unsupported MIME `415`, AI-service-down `502`, and missing-model `503` (`model_not_configured`).

The workflow test uses an isolated temporary SQLite database and verifies:

- persistence and stable IDs,
- high-confidence duplicate linking with preserved submissions,
- nearby different issues remaining separate,
- invalid transition rejection + audit events,
- weak evidence → needs verification → dispute → reopen,
- strong evidence → citizen confirmation → human approval → resolved,
- statistics and average resolution time.

---

## 12. Three-minute demo script

Start with `npm run dev`. Use the header **Demo role** switch to move between Citizen and Authority views.

**0:00–0:25 — Dashboard**
Open **Citizen**. Show totals, map markers, filters, demo labels, and the open/verify/resolved states. Mention the priority queue is rule-based.

**0:25–0:55 — Submit a complaint**
Go to **Report an Issue**. Choose Pothole. Title: “Deep pothole at New Market school gate”. Add a description mentioning children and an accident. Pick a point around `23.2450, 77.4450`, confirm the location, upload a photo, submit. Show the generated ID (e.g. `CIV-1035`) and success links.

**0:55–1:20 — Duplicate linking**
Submit a second complaint with the same category, near-identical description and coordinates 20–50 m away. Show that the system links it to the first issue, reports “original submission preserved”, and increments the report count. Open **Track** and use the first ID.

**1:20–1:45 — Priority queue**
Switch to **Authority**. Show the queue ordering and open `CIV-1024` (or the new issue). Explain the five factors, waiting-time contribution, report cap and the operator override reason field.

**1:45–2:20 — Weak evidence**
Open seeded `CIV-1026` (streetlight, no after-photo) and show **Needs verification** with exact failed checks. Alternatively, move a live issue to **In progress**, submit evidence without a photo or with distant/unknown coordinates and `Not assessed`, and show the same result.

**2:20–2:45 — Suitable evidence**
Open seeded `CIV-1027`. It is in **Needs verification**. Submit a resolution with an after-photo, coordinates equal to the issue, note, and human visual assessment **Visible improvement**. Then open the citizen tracking page, click **Confirm repair**. Return to Authority, review the evidence panel and click **Approve reviewed resolution**. Show the appended history events.

**2:45–3:00 — Tracking**
Open `CIV-1027` (or the new issue) in the Citizen view. Refresh the page and show the persisted status timeline, linked reports, evidence checks, citizen response and final review.

> If a live duplicate is not auto-linked, use seeded `CIV-1025` to explain medium-confidence operator review instead. Use `CIV-1028` as the pre-approved Case E if time is short.

---

## 13. Security and privacy notes

- No service-role keys, passwords, or private credentials are committed. `.env.example` contains names only.
- Demo role switching is **not authentication**. The authority page explicitly labels this and real deployments must add departmental sign-in and role-based permissions.
- Uploads: MIME allow-list (JPEG/PNG/WebP), 5 MB limit, single file, random filenames, served from a dedicated directory. SVG uploads from users are rejected.
- All form input is validated server-side with Zod; invalid status transitions and evidence states are rejected.
- SQL uses prepared statements.
- CORS is restricted to the configured dev client origin.
- Do not submit real personal information in a hackathon demo. The database and uploads are local.

---

## 14. Deployment

### Single-service deployment (simplest)

```bash
npm run install:all
npm run build
PORT=4000 npm start
```

Serve port 4000 behind HTTPS. Ensure the filesystem is persistent across restarts, or replace SQLite/local uploads with a managed database and object storage.

Checklist:

- Set `PORT` and `CLIENT_ORIGIN` appropriately.
- Persist `server/data/` and `server/uploads/`.
- Back up the SQLite file (`civiceye.db` plus WAL files) or migrate to PostgreSQL.
- If hosting the client separately, set `VITE_API_BASE_URL` at build time and allow the client origin in CORS.
- Do not run multiple app instances against the same SQLite file without a migration plan.
- Back up evidence files and verify upload permissions.

### Migrating to Supabase (optional, not implemented)

1. Create Postgres tables matching `server/src/db.js`.
2. Move uploads to Supabase Storage and store public/private object paths.
3. Keep the service-role key server-side only; use a restricted anon key for client reads if needed.
4. Add Row Level Security policies for citizen vs authority roles.
5. Replace the local data layer behind the same service functions.

---

## 15. Known limitations

- Snap & Report AI detection is **model-dependent**: no weights are bundled, so out of the box it reports "AI not configured" and manual reporting is used. A trained Ultralytics model is required for real detections.
- AI detection is used only to suggest form fields. It is **not** used for duplicate matching, severity decisions or repair-evidence verification.
- Demo role switch is not production authentication.
- Duplicate matching is a simple text/location baseline and will miss paraphrases.
- OpenStreetMap tiles require internet; markers remain functional in the data lists without tiles.
- Local filesystem persistence is suitable for a demo, not for ephemeral multi-instance production.
- Notifications/email/SMS are not implemented.
- Analytics are local database counts, not municipal statistics.
- The UI is in English; complaint text can be any language, but duplicate text matching is basic.

---

## 16. Acceptance checklist

- [x] Citizen can submit a valid complaint with validation and photo.
- [x] Complaint persists with stable ID across refresh/restart.
- [x] Duplicate reports link without deleting originals.
- [x] Different nearby issues remain separate with operator suggestions.
- [x] Priority score stays within 0–100 and reasons match the five factors.
- [x] Operator status updates append immutable history; invalid transitions rejected.
- [x] After-photo submission creates a resolution review record.
- [x] Missing/uncertain evidence triggers manual review.
- [x] Citizen tracking shows current status and full persisted timeline.
- [x] Upload/API errors return useful messages and UI notices.
- [x] Demo data and rule-based outputs are clearly labelled.
- [x] Project runs with documented commands.
- [x] Tests cover scoring, duplicates, status transitions, evidence and core workflow.
