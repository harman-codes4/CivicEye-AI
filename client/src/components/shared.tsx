import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  CircleDot,
  Droplets,
  ImageOff,
  Lightbulb,
  MapPin,
  MessageSquare,
  Route,
  ShieldAlert,
  TrafficCone,
  Trash2,
  TriangleAlert,
  Users,
} from 'lucide-react';
import type {
  Category,
  EvidenceCheck,
  HistoryEvent,
  Issue,
  IssueDetail,
  PriorityBand,
  ResolutionReview,
  Status,
} from '../types';
import {
  CATEGORY_LABELS,
  PRIORITY_LABELS,
  STATUS_LABELS,
  cls,
  formatDateTime,
  locationText,
  priorityTone,
  statusTone,
  timeAgo,
} from '../lib/utils';
import { Badge, Card, DemoBadge, FactorBar } from './ui';
import { assetUrl } from '../api';

const CATEGORY_ICONS = {
  pothole: CircleDot,
  garbage: Trash2,
  streetlight: Lightbulb,
  water_leakage: Droplets,
  damaged_road: TrafficCone,
  other: TriangleAlert,
};

const CATEGORY_TONES: Record<Category, string> = {
  pothole: 'bg-slate-100 text-slate-700',
  garbage: 'bg-lime-50 text-lime-700',
  streetlight: 'bg-amber-50 text-amber-700',
  water_leakage: 'bg-sky-50 text-sky-700',
  damaged_road: 'bg-orange-50 text-orange-700',
  other: 'bg-violet-50 text-violet-700',
};

export function CategoryIcon({ category, size = 'md' }: { category: Category; size?: 'sm' | 'md' | 'lg' }) {
  const Icon = CATEGORY_ICONS[category] || TriangleAlert;
  const sizes = {
    sm: 'h-8 w-8 rounded-lg',
    md: 'h-10 w-10 rounded-xl',
    lg: 'h-12 w-12 rounded-xl',
  };
  const iconSizes = { sm: 'h-4 w-4', md: 'h-5 w-5', lg: 'h-6 w-6' };
  return (
    <span className={cls('inline-flex shrink-0 items-center justify-center', sizes[size], CATEGORY_TONES[category])}>
      <Icon className={iconSizes[size]} aria-hidden="true" />
    </span>
  );
}

export function StatusBadge({ status, className }: { status: Status; className?: string }) {
  return (
    <Badge tone={statusTone(status)} className={className}>
      {STATUS_LABELS[status] || status}
    </Badge>
  );
}

export function PriorityBadge({
  band,
  score,
  showScore = true,
}: {
  band: PriorityBand;
  score?: number;
  showScore?: boolean;
}) {
  return (
    <Badge tone={priorityTone(band)}>
      {band === 'critical' && <ShieldAlert className="h-3 w-3" />}
      {PRIORITY_LABELS[band]}
      {showScore && score !== undefined ? ` · ${score}` : ''}
    </Badge>
  );
}

export function Photo({
  src,
  alt,
  className,
  emptyLabel = 'No photo provided',
}: {
  src: string | null | undefined;
  alt: string;
  className?: string;
  emptyLabel?: string;
}) {
  if (!src) {
    return (
      <div
        className={cls(
          'flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-slate-300 bg-slate-50 text-center text-xs text-slate-500',
          className,
        )}
      >
        <ImageOff className="h-6 w-6 text-slate-400" />
        {emptyLabel}
      </div>
    );
  }
  return (
    <img
      src={assetUrl(src)}
      alt={alt}
      loading="lazy"
      className={cls('w-full rounded-xl border border-slate-200 bg-slate-100 object-cover', className)}
    />
  );
}

export function IssueCard({
  issue,
  active = false,
  showDescription = false,
  href,
}: {
  issue: Issue;
  active?: boolean;
  showDescription?: boolean;
  href?: string;
}) {
  return (
    <Link
      to={href || `/issues/${issue.issueId}`}
      className={cls(
        'block rounded-xl border bg-white p-4 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500',
        active
          ? 'border-teal-400 ring-1 ring-teal-300'
          : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50/50',
      )}
    >
      <div className="flex items-start gap-3">
        <CategoryIcon category={issue.category} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[11px] font-bold uppercase tracking-wide text-slate-500">
              {CATEGORY_LABELS[issue.category]}
            </span>
            <span className="text-[11px] font-semibold text-slate-400">· {issue.issueId}</span>
            {issue.demoData && <DemoBadge />}
          </div>
          <p className="mt-1 line-clamp-2 text-sm font-semibold leading-5 text-navy-900">{issue.title}</p>
          {showDescription && (
            <p className="mt-1 line-clamp-2 text-xs leading-5 text-slate-500">{issue.description}</p>
          )}
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <StatusBadge status={issue.status} />
            <PriorityBadge band={issue.priorityBand} score={issue.priorityScore} />
            {(issue.aggregateReportCount ?? issue.reportCount) > 1 && (
              <Badge tone="bg-slate-100 text-slate-600 ring-slate-200">
                <Users className="h-3 w-3" /> {issue.aggregateReportCount ?? issue.reportCount} reports
              </Badge>
            )}
            {issue.parentIssueId && (
              <Badge tone="bg-violet-50 text-violet-700 ring-violet-200">Linked to {issue.parentIssueId}</Badge>
            )}
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-500">
            <span className="inline-flex items-center gap-1">
              <MapPin className="h-3 w-3" />
              {issue.locationLabel || locationText(issue)}
            </span>
            <span>{timeAgo(issue.createdAt)}</span>
            {issue.assignedDepartment && <span>· {issue.assignedDepartment}</span>}
          </div>
        </div>
        <ArrowRight className="mt-1 h-4 w-4 shrink-0 text-slate-300" aria-hidden="true" />
      </div>
    </Link>
  );
}

export function PriorityBreakdown({
  issue,
  compact = false,
}: {
  issue: Pick<Issue, 'priorityScore' | 'priorityBand' | 'priorityFactors' | 'priorityReasons' | 'priorityOverride' | 'priorityOverrideReason'>;
  compact?: boolean;
}) {
  const factors = issue.priorityFactors || {};
  return (
    <div>
      <div className="flex items-end justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Priority score</p>
          <div className="mt-0.5 flex items-baseline gap-2">
            <span className="text-3xl font-bold tracking-tight text-navy-900">{issue.priorityScore}</span>
            <span className="text-xs text-slate-400">/ 100</span>
            <PriorityBadge band={issue.priorityBand} showScore={false} />
          </div>
        </div>
        <span className="rounded-md bg-slate-50 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-slate-500 ring-1 ring-slate-200">
          Rule-based
        </span>
      </div>

      {issue.priorityOverride && (
        <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] leading-5 text-amber-900">
          <span className="font-semibold">Operator override active.</span> {issue.priorityOverrideReason}
        </div>
      )}

      {!compact && (
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <FactorBar label="Safety severity" value={factors.safety || 0} max={40} />
          <FactorBar label="Public impact" value={factors.publicImpact || 0} max={20} />
          <FactorBar label="Location sensitivity" value={factors.locationSensitivity || 0} max={15} />
          <FactorBar label="Waiting time" value={factors.waitingTime || 0} max={15} />
          <FactorBar label="Independent reports" value={factors.independentReports || 0} max={10} />
        </div>
      )}

      <div className="mt-4">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Why this score</p>
        <ul className="mt-1.5 space-y-1">
          {issue.priorityReasons.map((reason, index) => (
            <li key={index} className="flex gap-2 text-xs leading-5 text-slate-600">
              <span className="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-teal-500" />
              {reason}
            </li>
          ))}
        </ul>
        <p className="mt-2 text-[10px] leading-4 text-slate-400">
          Scores are deterministic suggestions. Report counts are capped and are not an exact count of
          affected people.
        </p>
      </div>
    </div>
  );
}

export function Timeline({ history }: { history: HistoryEvent[] }) {
  if (!history.length) {
    return <p className="text-sm text-slate-500">No history recorded yet.</p>;
  }
  return (
    <ol className="relative space-y-0">
      {history.map((event, index) => {
        const isLast = index === history.length - 1;
        return (
          <li key={event.eventId} className="relative flex gap-3 pb-5">
            {!isLast && <span className="absolute left-[7px] top-4 h-full w-px bg-slate-200" aria-hidden="true" />}
            <span
              className={cls(
                'relative z-10 mt-1.5 h-[15px] w-[15px] shrink-0 rounded-full border-2 border-white ring-1',
                event.newStatus === 'resolved'
                  ? 'bg-emerald-500 ring-emerald-300'
                  : event.newStatus === 'reopened'
                    ? 'bg-rose-500 ring-rose-300'
                    : event.newStatus === 'needs_verification'
                      ? 'bg-orange-500 ring-orange-300'
                      : 'bg-teal-500 ring-teal-300',
              )}
              aria-hidden="true"
            />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <span className="text-[13px] font-semibold text-navy-900">
                  {event.oldStatus && event.oldStatus !== event.newStatus
                    ? `${STATUS_LABELS[event.oldStatus]} → ${STATUS_LABELS[event.newStatus]}`
                    : STATUS_LABELS[event.newStatus]}
                </span>
                {event.demoData && <DemoBadge />}
              </div>
              <p className="mt-0.5 text-[11px] text-slate-500">
                {formatDateTime(event.timestamp)} · {event.changedBy}
              </p>
              {event.note && <p className="mt-1 text-xs leading-5 text-slate-600">{event.note}</p>}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

const REVIEW_STATUS_LABELS: Record<string, string> = {
  needs_verification: 'Needs verification',
  awaiting_citizen_confirmation: 'Awaiting citizen confirmation',
  eligible_for_reviewed_resolution: 'Eligible for reviewed resolution',
  reviewed_resolution: 'Reviewed resolution',
  citizen_disputed: 'Citizen disputed resolution',
};

const REVIEW_TONES: Record<string, string> = {
  needs_verification: 'border-orange-200 bg-orange-50 text-orange-800',
  awaiting_citizen_confirmation: 'border-amber-200 bg-amber-50 text-amber-800',
  eligible_for_reviewed_resolution: 'border-teal-200 bg-teal-50 text-teal-800',
  reviewed_resolution: 'border-emerald-200 bg-emerald-50 text-emerald-800',
  citizen_disputed: 'border-rose-200 bg-rose-50 text-rose-800',
};

const VISUAL_LABELS: Record<string, string> = {
  not_assessed: 'Not assessed (photo AI disabled)',
  improved: 'Visible improvement (human-recorded)',
  no_clear_change: 'No clear visual change',
  uncertain: 'Uncertain visual result',
};

const LOCATION_LABELS: Record<string, string> = {
  consistent: 'Consistent',
  inconsistent: 'Inconsistent',
  unknown: 'Not confirmed',
};

const CITIZEN_LABELS: Record<string, string> = {
  pending: 'Pending',
  confirmed: 'Confirmed',
  disputed: 'Disputed',
};

export function EvidencePanel({
  review,
  beforePhotoUrl,
  actions,
}: {
  review: ResolutionReview;
  beforePhotoUrl?: string | null;
  actions?: ReactNode;
}) {
  const tone = REVIEW_TONES[review.reviewStatus] || REVIEW_TONES.needs_verification;
  return (
    <Card className="overflow-hidden">
      <div className={cls('border-b px-4 py-3', tone)}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.14em] opacity-70">Evidence review</p>
            <p className="text-sm font-bold">{REVIEW_STATUS_LABELS[review.reviewStatus] || review.reviewStatus}</p>
          </div>
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-white/70 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide">
              Confidence: {review.confidenceBand}
            </span>
            {review.demoData && <DemoBadge label="Demo review" />}
          </div>
        </div>
      </div>

      <div className="space-y-4 p-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <p className="mb-1 text-[10px] font-bold uppercase tracking-wide text-slate-500">Before</p>
            <Photo src={beforePhotoUrl} alt="Reported issue before repair" className="h-40" />
          </div>
          <div>
            <p className="mb-1 text-[10px] font-bold uppercase tracking-wide text-slate-500">After (submitted)</p>
            <Photo
              src={review.afterPhotoUrl}
              alt="Submitted repair evidence"
              className="h-40"
              emptyLabel="No after-photo submitted"
            />
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3">
          <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">Resolution note</p>
          <p className="mt-1 text-xs leading-5 text-slate-700">{review.resolutionNote}</p>
          <p className="mt-2 text-[10px] text-slate-400">Submitted {formatDateTime(review.submittedAt)}</p>
        </div>

        <div>
          <p className="mb-2 text-[10px] font-bold uppercase tracking-wide text-slate-500">Rule-based checks</p>
          <ul className="space-y-2">
            {(review.checks || []).map((check: EvidenceCheck) => (
              <li key={check.id} className="flex items-start gap-2.5 rounded-lg border border-slate-100 bg-white p-2.5">
                <span
                  className={cls(
                    'mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold',
                    check.passed ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700',
                  )}
                  aria-hidden="true"
                >
                  {check.passed ? '✓' : '!'}
                </span>
                <div>
                  <p className="text-xs font-semibold text-navy-900">{check.label}</p>
                  <p className="text-[11px] leading-5 text-slate-500">{check.detail}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>

        <div className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
          <div className="rounded-lg bg-slate-50 p-2">
            <p className="text-[10px] uppercase tracking-wide text-slate-400">Location</p>
            <p className="font-semibold text-navy-900">{LOCATION_LABELS[review.locationMatch]}</p>
          </div>
          <div className="rounded-lg bg-slate-50 p-2">
            <p className="text-[10px] uppercase tracking-wide text-slate-400">Visual</p>
            <p className="font-semibold leading-4 text-navy-900">{VISUAL_LABELS[review.visualChange]}</p>
          </div>
          <div className="rounded-lg bg-slate-50 p-2">
            <p className="text-[10px] uppercase tracking-wide text-slate-400">Citizen</p>
            <p className="font-semibold text-navy-900">{CITIZEN_LABELS[review.citizenConfirmation]}</p>
          </div>
          <div className="rounded-lg bg-slate-50 p-2">
            <p className="text-[10px] uppercase tracking-wide text-slate-400">Human review</p>
            <p className="font-semibold text-navy-900">{review.reviewedBy ? 'Recorded' : 'Required'}</p>
          </div>
        </div>

        <div>
          <p className="mb-1 text-[10px] font-bold uppercase tracking-wide text-slate-500">Reasons</p>
          <ul className="space-y-1">
            {review.reasons.map((reason, index) => (
              <li key={index} className="flex gap-2 text-[11px] leading-5 text-slate-600">
                <span className="mt-[6px] h-1 w-1 shrink-0 rounded-full bg-slate-400" />
                {reason}
              </li>
            ))}
          </ul>
        </div>

        {review.reviewedBy && (
          <div className="rounded-lg border border-emerald-100 bg-emerald-50/60 px-3 py-2 text-[11px] leading-5 text-emerald-900">
            <span className="font-semibold">Human review:</span> {review.reviewedBy} ·{' '}
            {formatDateTime(review.reviewedAt)}
            {review.reviewNote ? ` — ${review.reviewNote}` : ''}
          </div>
        )}

        {actions && <div className="border-t border-slate-100 pt-3">{actions}</div>}

        <p className="rounded-lg bg-slate-50 px-3 py-2 text-[10px] leading-4 text-slate-500">
          Automated photo comparison is disabled in this build. Visual results are human-entered and do
          not prove repair durability or technical quality. An AI flag is never evidence of fraud.
        </p>
      </div>
    </Card>
  );
}

export function LinkedReports({ issue }: { issue: IssueDetail }) {
  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
          Linked citizen submissions
        </p>
        <Badge tone="bg-slate-100 text-slate-600 ring-slate-200">
          <MessageSquare className="h-3 w-3" /> {issue.aggregateReportCount || issue.reports.length}
        </Badge>
      </div>
      <div className="space-y-2">
        {issue.reports.map((report) => (
          <div key={report.reportId} className="rounded-lg border border-slate-200 bg-white p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-[10px] font-bold uppercase tracking-wide text-slate-400">
                {report.relationship === 'primary' ? 'Primary report' : 'Linked report'} · {report.reportId}
              </span>
              <span className="text-[10px] text-slate-400">{formatDateTime(report.createdAt)}</span>
            </div>
            <p className="mt-1 text-xs leading-5 text-slate-600">{report.description}</p>
            {report.photoUrl && (
              <a
                href={assetUrl(report.photoUrl)}
                target="_blank"
                rel="noreferrer"
                className="mt-1 inline-block text-[11px] font-semibold text-teal-700 hover:underline"
              >
                View report photo
              </a>
            )}
          </div>
        ))}
        {issue.linkedIssues.length > 0 && (
          <div className="rounded-lg border border-violet-200 bg-violet-50/60 p-3">
            <p className="text-[10px] font-bold uppercase tracking-wide text-violet-700">
              Confirmed duplicate issues
            </p>
            <ul className="mt-1.5 space-y-1">
              {issue.linkedIssues.map((child) => (
                <li key={child.issueId} className="flex flex-wrap items-center justify-between gap-2 text-xs">
                  <Link to={`/issues/${child.issueId}`} className="font-semibold text-violet-800 hover:underline">
                    {child.issueId} — {child.title}
                  </Link>
                  <span className="text-[10px] text-slate-500">{child.reportCount} report(s)</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}

export function ProcessSteps() {
  const steps = [
    { icon: MessageSquare, title: 'Report', body: 'Citizens submit a complaint, photo and location.' },
    { icon: Users, title: 'Group', body: 'Similar reports are linked; originals are preserved.' },
    { icon: ShieldAlert, title: 'Prioritize', body: 'A transparent 0–100 score explains urgency.' },
    { icon: Route, title: 'Track', body: 'Status changes and notes are appended to a timeline.' },
    { icon: CircleDot, title: 'Verify', body: 'Repair evidence is checked and human-reviewed.' },
  ];
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
      {steps.map((step, index) => {
        const Icon = step.icon;
        return (
          <div key={step.title} className="relative rounded-xl border border-slate-200 bg-white p-4">
            <span className="text-[10px] font-bold uppercase tracking-widest text-teal-600">
              Step {index + 1}
            </span>
            <Icon className="mt-2 h-5 w-5 text-navy-800" />
            <p className="mt-2 text-sm font-bold text-navy-900">{step.title}</p>
            <p className="mt-1 text-[11px] leading-5 text-slate-500">{step.body}</p>
          </div>
        );
      })}
    </div>
  );
}
