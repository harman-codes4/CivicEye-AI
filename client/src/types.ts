export type Category =
  | 'pothole'
  | 'garbage'
  | 'streetlight'
  | 'water_leakage'
  | 'damaged_road'
  | 'other';

export type Status =
  | 'reported'
  | 'under_review'
  | 'assigned'
  | 'in_progress'
  | 'resolution_submitted'
  | 'needs_verification'
  | 'resolved'
  | 'reopened';

export type PriorityBand = 'critical' | 'high' | 'medium' | 'low';

export interface PriorityFactors {
  safety?: number;
  publicImpact?: number;
  locationSensitivity?: number;
  waitingTime?: number;
  independentReports?: number;
}

export interface Issue {
  id: number;
  issueId: string;
  category: Category;
  title: string;
  description: string;
  latitude: number | null;
  longitude: number | null;
  locationLabel: string | null;
  locationConfirmed: boolean;
  beforePhotoUrl: string | null;
  status: Status;
  priorityScore: number;
  priorityBand: PriorityBand;
  priorityFactors: PriorityFactors;
  priorityReasons: string[];
  priorityOverride: boolean;
  priorityOverrideReason: string | null;
  parentIssueId: string | null;
  reportCount: number;
  aggregateReportCount?: number;
  assignedDepartment: string | null;
  demoData: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Report {
  reportId: string;
  issueId: string;
  submitterId: string;
  description: string;
  photoUrl: string | null;
  latitude: number | null;
  longitude: number | null;
  relationship: 'primary' | 'linked';
  demoData: boolean;
  createdAt: string;
}

export interface HistoryEvent {
  eventId: number;
  issueId: string;
  oldStatus: Status | null;
  newStatus: Status;
  changedBy: string;
  note: string | null;
  timestamp: string;
  demoData: boolean;
}

export interface EvidenceCheck {
  id: string;
  label: string;
  passed: boolean;
  detail: string;
}

export interface ResolutionReview {
  reviewId: string;
  issueId: string;
  afterPhotoUrl: string | null;
  resolutionNote: string;
  locationMatch: 'consistent' | 'inconsistent' | 'unknown';
  visualChange: 'not_assessed' | 'improved' | 'no_clear_change' | 'uncertain';
  citizenConfirmation: 'pending' | 'confirmed' | 'disputed';
  confidenceBand: string;
  reasons: string[];
  checks: EvidenceCheck[];
  reviewStatus: string;
  submissionLat: number | null;
  submissionLng: number | null;
  allowException: boolean;
  reviewNote: string | null;
  submittedAt: string;
  reviewedAt: string | null;
  reviewedBy: string | null;
  demoData: boolean;
}

export interface Assignment {
  assignmentId: string;
  issueId: string;
  departmentOrOperator: string;
  assignedBy: string;
  assignedAt: string;
  assignmentStatus: string;
  note: string | null;
}

export interface DuplicateSuggestion {
  suggestionId: string;
  issueId: string;
  candidateIssueId: string;
  candidateTitle?: string;
  candidateCategory?: Category;
  candidateStatus?: Status;
  score: number;
  band: string;
  textScore: number | null;
  distanceM: number | null;
  reasons: string[];
  status: 'pending' | 'confirmed' | 'rejected';
  reviewedBy: string | null;
  reviewedAt: string | null;
  createdAt: string;
}

export interface Override {
  overrideId: string;
  previousScore: number;
  newScore: number;
  reason: string;
  actor: string;
  createdAt: string;
}

export interface Feedback {
  feedbackId: string;
  confirmation: 'confirmed' | 'disputed';
  actor: string;
  note: string | null;
  createdAt: string;
}

export interface LinkedIssue {
  issueId: string;
  title: string;
  status: Status;
  reportCount: number;
  priorityScore: number;
  demoData: boolean;
  createdAt: string;
}

export interface IssueDetail extends Issue {
  reports: Report[];
  linkedIssues: LinkedIssue[];
  aggregateReportCount: number;
  history: HistoryEvent[];
  reviews: ResolutionReview[];
  assignments: Assignment[];
  duplicateSuggestions: DuplicateSuggestion[];
  overrides: Override[];
  feedback: Feedback[];
}

export interface Stats {
  total: number;
  demoIssues: number;
  resolved: number;
  reopened: number;
  open: number;
  inProgress: number;
  awaitingVerification: number;
  critical: number;
  pendingDuplicateSuggestions?: number;
  byStatus: { status: Status; count: number }[];
  byCategory: { category: Category; count: number }[];
  byPriority: { band: PriorityBand; count: number }[];
  avgResolutionHours: number | null;
  resolvedSampleSize: number;
  areas: { area: string; count: number }[];
  recent: Issue[];
  queue: Issue[];
  generatedAt: string;
}

export interface CreateIssueResult {
  issueId: string;
  linkedToExisting: boolean;
  match: {
    candidateIssueId: string;
    score: number;
    band: string;
    textScore: number;
    distanceM: number | null;
    reasons: string[];
  } | null;
  message: string;
  issue: IssueDetail;
}

export interface ApiErrorBody {
  error?: string;
  message?: string;
  details?: { field: string; message: string }[];
}

export interface AIDetectionResult {
  detected: boolean;
  category: Category | null;
  title: string | null;
  description: string | null;
  confidence: number;
  boundingBox: { x1: number; y1: number; x2: number; y2: number } | null;
  detections: AIDetection[];
  message: string;
  severity?: string;
  observations?: string[];
  requiresHumanReview?: boolean;
  providers?: 'gemini' | 'roboflow' | 'both';
}

export interface AIDetection {
  category: string;
  class: string;
  confidence: number;
  bounding_box: {
    x1: number;
    y1: number;
    x2: number;
    y2: number;
  };
}

export interface AIServiceStatus {
  available: boolean;
  configured: boolean;
  serviceUrl: string | null;
  message: string;
  providers?: { gemini?: boolean; roboflow?: boolean };
}
