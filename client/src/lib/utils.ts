import type { Category, PriorityBand, Status } from '../types';

export const CATEGORY_LABELS: Record<Category, string> = {
  pothole: 'Pothole',
  garbage: 'Garbage overflow',
  streetlight: 'Streetlight',
  water_leakage: 'Water leakage',
  damaged_road: 'Damaged road',
  other: 'Other',
};

export const CATEGORY_OPTIONS = Object.entries(CATEGORY_LABELS) as [Category, string][];

export const STATUS_LABELS: Record<Status, string> = {
  reported: 'Reported',
  under_review: 'Under review',
  assigned: 'Assigned',
  in_progress: 'In progress',
  resolution_submitted: 'Resolution submitted',
  needs_verification: 'Needs verification',
  resolved: 'Resolved (evidence reviewed)',
  reopened: 'Reopened',
};

export const STATUS_OPTIONS = Object.entries(STATUS_LABELS) as [Status, string][];

export const PRIORITY_LABELS: Record<PriorityBand, string> = {
  critical: 'Critical',
  high: 'High',
  medium: 'Medium',
  low: 'Low',
};

export const NEXT_STATUSES: Record<Status, Status[]> = {
  reported: ['under_review', 'assigned', 'reopened'],
  under_review: ['assigned', 'in_progress', 'reopened'],
  assigned: ['in_progress', 'reopened'],
  in_progress: ['resolution_submitted', 'reopened'],
  resolution_submitted: ['needs_verification', 'reopened'],
  needs_verification: ['in_progress', 'resolution_submitted', 'reopened'],
  resolved: ['reopened'],
  reopened: ['under_review', 'assigned', 'in_progress'],
};

const STATUS_TONES: Record<Status, string> = {
  reported: 'bg-slate-100 text-slate-700 ring-slate-200',
  under_review: 'bg-amber-50 text-amber-800 ring-amber-200',
  assigned: 'bg-blue-50 text-blue-700 ring-blue-200',
  in_progress: 'bg-indigo-50 text-indigo-700 ring-indigo-200',
  resolution_submitted: 'bg-cyan-50 text-cyan-800 ring-cyan-200',
  needs_verification: 'bg-orange-50 text-orange-800 ring-orange-200',
  resolved: 'bg-emerald-50 text-emerald-800 ring-emerald-200',
  reopened: 'bg-rose-50 text-rose-700 ring-rose-200',
};

const PRIORITY_TONES: Record<PriorityBand, string> = {
  critical: 'bg-rose-600 text-white ring-rose-600',
  high: 'bg-orange-50 text-orange-800 ring-orange-200',
  medium: 'bg-amber-50 text-amber-800 ring-amber-200',
  low: 'bg-slate-100 text-slate-700 ring-slate-200',
};

export function statusTone(status: Status): string {
  return STATUS_TONES[status] || STATUS_TONES.reported;
}

export function priorityTone(band: PriorityBand): string {
  return PRIORITY_TONES[band] || PRIORITY_TONES.low;
}

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function timeAgo(iso: string | null | undefined): string {
  if (!iso) return '—';
  const diff = Date.now() - new Date(iso).getTime();
  if (!Number.isFinite(diff)) return '—';
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hr${hours === 1 ? '' : 's'} ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days} day${days === 1 ? '' : 's'} ago`;
  return formatDate(iso);
}

export function hoursLabel(hours: number | null): string {
  if (hours === null || hours === undefined || !Number.isFinite(hours)) return 'No data';
  if (hours < 24) return `${hours.toFixed(1)} hrs`;
  const days = hours / 24;
  return `${days.toFixed(1)} days`;
}

export function pct(value: number, total: number): string {
  if (!total) return '0%';
  return `${Math.round((value / total) * 100)}%`;
}

export function getCitizenId(): string {
  const key = 'civiceye_citizen_id';
  let id = localStorage.getItem(key);
  if (!id) {
    id = `citizen-${Math.random().toString(36).slice(2, 10)}`;
    localStorage.setItem(key, id);
  }
  return id;
}

export function getActor(): string {
  const role = localStorage.getItem('civiceye_role');
  return role === 'authority' ? 'Demo authority operator' : 'Citizen';
}

export function cls(...values: (string | false | null | undefined)[]): string {
  return values.filter(Boolean).join(' ');
}

export function locationText(issue: { latitude: number | null; longitude: number | null }): string {
  if (issue.latitude === null || issue.longitude === null) return 'Coordinates not provided';
  return `${issue.latitude.toFixed(5)}, ${issue.longitude.toFixed(5)}`;
}
