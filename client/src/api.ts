import type {
  AIDetectionResult,
  AIServiceStatus,
  ApiErrorBody,
  CreateIssueResult,
  Issue,
  IssueDetail,
  Stats,
} from './types';

const API_BASE = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(/\/$/, '') || '';

export class ApiError extends Error {
  status: number;
  details: { field: string; message: string }[];

  constructor(message: string, status: number, details: { field: string; message: string }[] = []) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.details = details;
  }
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${API_BASE}${path}`, options);
  } catch {
    throw new ApiError(
      'Could not reach the CivicEye API. Check that the server is running on port 4000.',
      0,
    );
  }

  const text = await response.text();
  let body: unknown = null;
  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
      body = { error: text };
    }
  }

  if (!response.ok) {
    const errorBody = (body || {}) as ApiErrorBody;
    throw new ApiError(
      errorBody.message || errorBody.error || `Request failed with status ${response.status}`,
      response.status,
      errorBody.details || [],
    );
  }
  return body as T;
}

export function assetUrl(path: string | null | undefined): string {
  if (!path) return '';
  if (/^https?:\/\//.test(path)) return path;
  return `${API_BASE}${path}`;
}

export const api = {
  health: () => request<{ status: string; issues: number; reports: number; note: string }>('/api/health'),

  stats: () => request<{ stats: Stats }>('/api/stats').then((r) => r.stats),

  listIssues: (params: {
    category?: string;
    status?: string;
    q?: string;
    sort?: string;
    band?: string;
  } = {}) => {
    const search = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value) search.set(key, value);
    });
    const query = search.toString();
    return request<{ issues: Issue[] }>(`/api/issues${query ? `?${query}` : ''}`).then((r) => r.issues);
  },

  getIssue: (issueId: string) =>
    request<{ issue: IssueDetail }>(`/api/issues/${encodeURIComponent(issueId)}`).then((r) => r.issue),

  createIssue: (form: FormData) =>
    request<CreateIssueResult>('/api/issues', { method: 'POST', body: form }),

  aiDetect: (form: FormData) =>
    request<AIDetectionResult>('/api/ai/detect', { method: 'POST', body: form }),

  aiHealth: () =>
    request<{ aiDetection: AIServiceStatus }>('/api/health').then((r) => r.aiDetection),

  addReport: (issueId: string, form: FormData) =>
    request<{ message: string; issue: IssueDetail }>(`/api/issues/${issueId}/reports`, {
      method: 'POST',
      body: form,
    }),

  updateStatus: (issueId: string, body: { status: string; actor: string; note?: string }) =>
    request<{ message: string; issue: IssueDetail }>(`/api/issues/${issueId}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),

  assign: (issueId: string, body: { department: string; assignedBy: string; note?: string }) =>
    request<{ message: string; issue: IssueDetail }>(`/api/issues/${issueId}/assignment`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),

  submitResolution: (issueId: string, form: FormData) =>
    request<{ message: string; issue: IssueDetail }>(`/api/issues/${issueId}/resolution`, {
      method: 'POST',
      body: form,
    }),

  verify: (issueId: string, body: { decision: 'resolved' | 'needs_verification'; actor: string; note?: string }) =>
    request<{ message: string; issue: IssueDetail }>(`/api/issues/${issueId}/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),

  feedback: (issueId: string, body: { confirmation: 'confirmed' | 'disputed'; actor: string; note?: string }) =>
    request<{ message: string; issue: IssueDetail }>(`/api/issues/${issueId}/feedback`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),

  reviewDuplicate: (
    issueId: string,
    body: { suggestionId: string; action: 'confirm' | 'reject'; actor: string; note?: string },
  ) =>
    request<{ message: string; issue: IssueDetail }>(`/api/issues/${issueId}/duplicate-review`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),

  overridePriority: (issueId: string, body: { score: number; reason: string; actor: string }) =>
    request<{ message: string; issue: IssueDetail }>(`/api/issues/${issueId}/priority-override`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),

  resetDemo: () =>
    request<{ message: string; count: number }>('/api/demo/reset', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ confirm: 'RESET' }),
    }),
};
