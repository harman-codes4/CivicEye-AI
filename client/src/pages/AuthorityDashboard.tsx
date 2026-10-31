import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowUpRight,
  BadgeCheck,
  Building2,
  CheckCircle2,
  ClipboardList,
  Clock,
  CopyCheck,
  Filter,
  Gauge,
  ImagePlus,
  LockKeyhole,
  MapPin,
  RadioTower,
  RefreshCw,
  RotateCcw,
  Search,
  ShieldAlert,
  ShieldCheck,
  SlidersHorizontal,
  Trash2,
  TriangleAlert,
  Users,
  X,
} from 'lucide-react';
import { api } from '../api';
import { useAsync, useDebouncedValue, useDocumentTitle } from '../lib/hooks';
import { useRole } from '../context/RoleContext';
import { useToast } from '../components/Toast';
import {
  Alert,
  Badge,
  Button,
  Card,
  CheckLine,
  ConfirmDialog,
  DemoBadge,
  EmptyState,
  ErrorState,
  Field,
  LoadingBlock,
  Modal,
  PageHeader,
  SectionHeading,
  SelectInput,
  StatCard,
  TextInput,
  TextareaInput,
  buttonStyles,
} from '../components/ui';
import {
  CategoryIcon,
  EvidencePanel,
  PriorityBadge,
  PriorityBreakdown,
  StatusBadge,
  Timeline,
} from '../components/shared';
import {
  CATEGORY_LABELS,
  CATEGORY_OPTIONS,
  NEXT_STATUSES,
  PRIORITY_LABELS,
  STATUS_LABELS,
  cls,
  formatDateTime,
  hoursLabel,
  locationText,
  timeAgo,
} from '../lib/utils';
import type { IssueDetail, ResolutionReview, Status } from '../types';

const STATUS_FILTERS = [
  { value: '', label: 'All statuses' },
  { value: 'open', label: 'All active' },
  { value: 'needs_verification', label: 'Needs verification' },
  { value: 'in_progress', label: 'In progress' },
  { value: 'reported', label: 'Reported' },
  { value: 'under_review', label: 'Under review' },
  { value: 'assigned', label: 'Assigned' },
  { value: 'resolved', label: 'Resolved' },
  { value: 'reopened', label: 'Reopened' },
];

const DEPARTMENTS = [
  'PWD Bhopal',
  'Ward Road Maintenance',
  'Sanitation Department',
  'Municipal Electrical Wing',
  'Water Works',
  'Traffic Police Liaison',
];

function expandStatus(filter: string): string {
  if (filter === 'open') return 'reported,under_review,assigned,in_progress,resolution_submitted,needs_verification,reopened';
  return filter;
}

export default function AuthorityDashboard() {
  useDocumentTitle('Authority dashboard');
  const { role, setRole } = useRole();
  const { toast } = useToast();

  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [statusFilter, setStatusFilter] = useState('open');
  const [sort, setSort] = useState('priority');
  const [band, setBand] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [resetOpen, setResetOpen] = useState(false);
  const [discardOpen, setDiscardOpen] = useState(false);
  const debouncedSearch = useDebouncedValue(search, 350);

  const [statusNote, setStatusNote] = useState('');
  const [department, setDepartment] = useState(DEPARTMENTS[0]);
  const [assignNote, setAssignNote] = useState('');
  const [overrideScore, setOverrideScore] = useState('');
  const [overrideReason, setOverrideReason] = useState('');
  const [resolutionNote, setResolutionNote] = useState('');
  const [visualChange, setVisualChange] = useState('not_assessed');
  const [allowException, setAllowException] = useState(false);
  const [evidenceLat, setEvidenceLat] = useState('');
  const [evidenceLng, setEvidenceLng] = useState('');
  const [afterPhoto, setAfterPhoto] = useState<File | null>(null);
  const [reviewNote, setReviewNote] = useState('');

  const statsState = useAsync(() => api.stats(), []);
  const issuesState = useAsync(
    () =>
      api.listIssues({
        q: debouncedSearch || undefined,
        category: category || undefined,
        status: expandStatus(statusFilter) || undefined,
        sort,
        band: band || undefined,
      }),
    [debouncedSearch, category, statusFilter, sort, band],
  );
  const detailState = useAsync(
    () => (selectedId ? api.getIssue(selectedId) : Promise.resolve(null)),
    [selectedId],
  );

  const issue = detailState.data?.issueId === selectedId ? detailState.data : null;
  const issues = issuesState.data || [];
  const stats = statsState.data;

  useEffect(() => {
    if (!issue) return;
    setOverrideScore(String(issue.priorityScore));
    setOverrideReason('');
    setEvidenceLat(issue.latitude !== null ? String(issue.latitude) : '');
    setEvidenceLng(issue.longitude !== null ? String(issue.longitude) : '');
    setResolutionNote('');
    setVisualChange('not_assessed');
    setAllowException(false);
    setAfterPhoto(null);
    setStatusNote('');
    setAssignNote('');
    setReviewNote('');
    setDepartment(issue.assignedDepartment || DEPARTMENTS[0]);
  }, [issue?.issueId]);

  const photoPreview = useMemo(
    () => (afterPhoto ? URL.createObjectURL(afterPhoto) : null),
    [afterPhoto],
  );

  useEffect(() => {
    return () => {
      if (photoPreview) URL.revokeObjectURL(photoPreview);
    };
  }, [photoPreview]);

  const latestReview = issue?.reviews?.[0] || null;
  const hasUnsavedChanges = Boolean(
    issue &&
      (overrideScore !== String(issue.priorityScore) ||
        overrideReason.trim() !== '' ||
        statusNote.trim() !== '' ||
        department !== (issue.assignedDepartment || DEPARTMENTS[0]) ||
        assignNote.trim() !== '' ||
        evidenceLat !== (issue.latitude !== null ? String(issue.latitude) : '') ||
        evidenceLng !== (issue.longitude !== null ? String(issue.longitude) : '') ||
        resolutionNote.trim() !== '' ||
        visualChange !== 'not_assessed' ||
        allowException ||
        afterPhoto !== null ||
        reviewNote.trim() !== ''),
  );

  const applyUpdated = (updated: IssueDetail) => {
    detailState.setData(updated);
    issuesState.reload();
    statsState.reload();
  };

  const closeDetails = () => {
    setSelectedId(null);
    setDiscardOpen(false);
  };

  const requestCloseDetails = () => {
    if (busy) return;
    if (hasUnsavedChanges) {
      setDiscardOpen(true);
      return;
    }
    closeDetails();
  };

  const runAction = async (key: string, fn: () => Promise<void>) => {
    setBusy(key);
    try {
      await fn();
    } catch (error) {
      toast((error as Error).message, 'error');
    } finally {
      setBusy(null);
    }
  };

  const updateStatus = (status: Status) =>
    runAction(`status-${status}`, async () => {
      if (!issue) return;
      const response = await api.updateStatus(issue.issueId, {
        status,
        actor: 'Demo authority operator',
        note: statusNote.trim() || undefined,
      });
      applyUpdated(response.issue);
      setStatusNote('');
      toast(response.message, 'success');
    });

  const assign = () =>
    runAction('assign', async () => {
      if (!issue) return;
      const response = await api.assign(issue.issueId, {
        department,
        assignedBy: 'Demo authority operator',
        note: assignNote.trim() || undefined,
      });
      applyUpdated(response.issue);
      setAssignNote('');
      toast(response.message, 'success');
    });

  const override = () =>
    runAction('override', async () => {
      if (!issue) return;
      const score = Number(overrideScore);
      if (!Number.isInteger(score) || score < 0 || score > 100) {
        toast('Enter a whole-number score between 0 and 100.', 'error');
        return;
      }
      if (overrideReason.trim().length < 10) {
        toast('An override reason of at least 10 characters is required.', 'error');
        return;
      }
      const response = await api.overridePriority(issue.issueId, {
        score,
        reason: overrideReason.trim(),
        actor: 'Demo authority operator',
      });
      applyUpdated(response.issue);
      setOverrideReason('');
      toast(response.message, 'success');
    });

  const reviewDuplicate = (suggestionId: string, action: 'confirm' | 'reject') =>
    runAction(`dup-${suggestionId}-${action}`, async () => {
      if (!issue) return;
      const response = await api.reviewDuplicate(issue.issueId, {
        suggestionId,
        action,
        actor: 'Demo authority operator',
      });
      applyUpdated(response.issue);
      toast(response.message, action === 'confirm' ? 'success' : 'info');
    });

  const submitResolution = (event: React.FormEvent) => {
    event.preventDefault();
    runAction('resolution', async () => {
      if (!issue) return;
      if (resolutionNote.trim().length < 8) {
        toast('Add a resolution note of at least 8 characters.', 'error');
        return;
      }
      const form = new FormData();
      form.set('resolutionNote', resolutionNote.trim());
      form.set('visualChange', visualChange);
      form.set('allowException', String(allowException));
      form.set('actor', 'Demo authority operator');
      if (evidenceLat !== '') form.set('latitude', evidenceLat);
      if (evidenceLng !== '') form.set('longitude', evidenceLng);
      if (afterPhoto) form.set('afterPhoto', afterPhoto);
      const response = await api.submitResolution(issue.issueId, form);
      applyUpdated(response.issue);
      setResolutionNote('');
      setAfterPhoto(null);
      setVisualChange('not_assessed');
      setAllowException(false);
      toast(response.message, 'success');
    });
  };

  const verify = (decision: 'resolved' | 'needs_verification') =>
    runAction(`verify-${decision}`, async () => {
      if (!issue) return;
      const response = await api.verify(issue.issueId, {
        decision,
        actor: 'Demo authority reviewer',
        note: reviewNote.trim() || undefined,
      });
      applyUpdated(response.issue);
      setReviewNote('');
      toast(response.message, decision === 'resolved' ? 'success' : 'info');
    });

  const resetDemo = () =>
    runAction('reset', async () => {
      const response = await api.resetDemo();
      setResetOpen(false);
      setSelectedId(null);
      issuesState.reload();
      statsState.reload();
      detailState.reload();
      setDiscardOpen(false);
      toast(response.message, 'success');
    });

  if (role !== 'authority') {
    return (
      <div className="mx-auto flex min-h-[60vh] max-w-2xl flex-col justify-center px-4 py-10 sm:px-6">
        <Card className="p-6 text-center sm:p-8">
          <span className="mx-auto inline-flex h-12 w-12 items-center justify-center rounded-full bg-navy-900 text-teal-400">
            <LockKeyhole className="h-6 w-6" />
          </span>
          <h1 className="mt-4 text-2xl font-bold tracking-tight text-navy-900">Authority interface</h1>
          <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-600">
            This is a clearly labelled demo role switch, not production authentication. The real
            application would require departmental sign-in and role-based permissions.
          </p>
          <div className="mt-5 flex flex-wrap justify-center gap-2">
            <Button onClick={() => setRole('authority')} icon={ShieldCheck}>
              Continue as demo authority
            </Button>
            <Link to="/dashboard" className={buttonStyles('secondary')}>
              Return to citizen view
            </Link>
          </div>
          <p className="mt-4 text-[10px] text-slate-400">
            No real municipality account, password, or private credential is used in this prototype.
          </p>
        </Card>
      </div>
    );
  }

  const statusTargets = issue
    ? NEXT_STATUSES[issue.status].filter((status) => status !== 'resolution_submitted' && status !== 'resolved')
    : [];

  const hasFilters = Boolean(
    search || category || statusFilter !== 'open' || band || sort !== 'priority',
  );

  const clearFilters = () => {
    setSearch('');
    setCategory('');
    setStatusFilter('open');
    setBand('');
    setSort('priority');
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
      <PageHeader
        eyebrow="Authority workspace"
        title="Complaint operations queue"
        description="Start with the highest-priority active complaints. Select any row to review the full complaint, location, evidence and available actions in a focused dialog."
        actions={
          <>
            <Button
              variant="secondary"
              icon={RefreshCw}
              onClick={() => {
                statsState.reload();
                issuesState.reload();
                if (selectedId) detailState.reload();
              }}
            >
              Refresh
            </Button>
            <Button variant="secondary" icon={RotateCcw} onClick={() => setResetOpen(true)}>
              Reset demo data
            </Button>
          </>
        }
      />

      {statsState.error ? (
        <div className="mt-6">
          <ErrorState message={statsState.error} onRetry={statsState.reload} />
        </div>
      ) : (
        <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
          <StatCard label="Critical issues" value={stats?.critical ?? '—'} icon={ShieldAlert} tone="rose" />
          <StatCard label="Active queue" value={stats?.open ?? '—'} hint="Reported through in progress" icon={ClipboardList} tone="blue" />
          <StatCard
            label="Awaiting verification"
            value={stats?.awaitingVerification ?? '—'}
            hint="Evidence review pending"
            icon={ShieldCheck}
            tone="amber"
          />
          <StatCard
            label="Duplicate suggestions"
            value={stats?.pendingDuplicateSuggestions ?? '—'}
            hint="Operator review pending"
            icon={CopyCheck}
            tone="slate"
          />
          <StatCard
            label="Avg. resolution"
            value={hoursLabel(stats?.avgResolutionHours ?? null)}
            hint={`${stats?.resolvedSampleSize ?? 0} resolved record(s)`}
            icon={Clock}
            tone="emerald"
            className="col-span-2 md:col-span-1"
          />
        </div>
      )}

      <section className="mt-6 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-card">
        <div className="border-b border-slate-200 px-4 py-4 sm:px-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-base font-bold text-navy-900">Priority queue</h2>
              <p className="mt-1 text-xs leading-5 text-slate-500">
                Search or filter the queue, then open a complaint to take action.
              </p>
            </div>
            <div className="flex items-center gap-2">
              {hasFilters && (
                <button
                  type="button"
                  onClick={clearFilters}
                  className="text-[11px] font-semibold text-teal-700 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500"
                >
                  Reset filters
                </button>
              )}
              <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                {issues.length} result{issues.length === 1 ? '' : 's'}
              </span>
            </div>
          </div>

          <div className="mt-4 grid gap-3">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <TextInput
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search complaint ID, title, description or area"
                className="pl-9"
                aria-label="Search authority queue"
              />
            </div>
            <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
              <SelectInput value={category} onChange={(event) => setCategory(event.target.value)} aria-label="Category filter">
                <option value="">All types</option>
                {CATEGORY_OPTIONS.map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </SelectInput>
              <SelectInput
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value)}
                aria-label="Status filter"
              >
                {STATUS_FILTERS.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </SelectInput>
              <SelectInput value={band} onChange={(event) => setBand(event.target.value)} aria-label="Priority band filter">
                <option value="">All bands</option>
                <option value="critical">Critical</option>
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
              </SelectInput>
              <SelectInput value={sort} onChange={(event) => setSort(event.target.value)} aria-label="Sort queue">
                <option value="priority">Score: high to low</option>
                <option value="recent">Newest first</option>
                <option value="waiting">Longest waiting</option>
                <option value="score_asc">Score: low to high</option>
              </SelectInput>
            </div>
          </div>
        </div>

        {issuesState.loading ? (
          <div className="p-4 sm:p-5">
            <LoadingBlock rows={5} />
          </div>
        ) : issuesState.error ? (
          <div className="p-4 sm:p-5">
            <ErrorState message={issuesState.error} onRetry={issuesState.reload} />
          </div>
        ) : issues.length === 0 ? (
          <div className="p-4 sm:p-5">
            <EmptyState
              icon={Filter}
              title="No complaints match these filters"
              description="Adjust the search or filters, or reset the filters to see the full active queue."
              action={
                <Button size="sm" variant="secondary" onClick={clearFilters}>
                  Reset filters
                </Button>
              }
            />
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {issues.map((item) => (
              <button
                key={item.issueId}
                type="button"
                onClick={() => {
                  detailState.setData(null);
                  setSelectedId(item.issueId);
                }}
                className="group flex w-full items-start gap-3 px-4 py-4 text-left transition hover:bg-slate-50/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-teal-500 sm:px-5"
                aria-label={`Open details for complaint ${item.issueId}: ${item.title}`}
              >
                <CategoryIcon category={item.category} size="sm" />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                    <span className="font-mono text-[10px] font-bold uppercase tracking-wide text-slate-400">
                      {item.issueId}
                    </span>
                    <span className="min-w-0 text-sm font-semibold leading-5 text-navy-900">{item.title}</span>
                  </div>
                  <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                    <StatusBadge status={item.status} />
                    <PriorityBadge band={item.priorityBand} score={item.priorityScore} />
                    <span className="text-[10px] text-slate-400">
                      {item.aggregateReportCount ?? item.reportCount} report
                      {(item.aggregateReportCount ?? item.reportCount) === 1 ? '' : 's'}
                    </span>
                  </div>
                  <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-500">
                    <span className="inline-flex min-w-0 items-center gap-1">
                      <MapPin className="h-3 w-3 shrink-0" />
                      <span className="truncate">{item.locationLabel || locationText(item)}</span>
                    </span>
                    <span>{timeAgo(item.createdAt)}</span>
                    {item.assignedDepartment && <span>{item.assignedDepartment}</span>}
                  </div>
                </div>
                <span className="mt-0.5 inline-flex shrink-0 items-center gap-1 text-[11px] font-semibold text-teal-700 opacity-100 sm:opacity-0 sm:transition-opacity sm:group-hover:opacity-100 sm:group-focus-visible:opacity-100">
                  Open <ArrowUpRight className="h-3.5 w-3.5" />
                </span>
              </button>
            ))}
          </div>
        )}
      </section>

      <div className="mt-5 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-dashed border-amber-300 bg-amber-50/70 px-3 py-2.5 text-[10px] leading-4 text-amber-900">
        <span className="inline-flex items-center gap-1.5">
          <TriangleAlert className="h-3.5 w-3.5" />
          Demo environment: role switching is not authentication and the database is local.
        </span>
        <span className="inline-flex items-center gap-1.5">
          <RadioTower className="h-3.5 w-3.5" /> No live external AI API is required.
        </span>
      </div>

      <Modal
        open={Boolean(selectedId)}
        onClose={requestCloseDetails}
        eyebrow={issue ? `Complaint ${issue.issueId}` : selectedId ? `Complaint ${selectedId}` : undefined}
        title={issue?.title || (detailState.loading ? 'Loading complaint details…' : 'Complaint details')}
        description={
          issue ? (
            <span className="inline-flex flex-wrap items-center gap-x-2 gap-y-1">
              <span>{CATEGORY_LABELS[issue.category]}</span>
              <span aria-hidden="true">·</span>
              <span>{issue.locationLabel || locationText(issue)}</span>
              <span aria-hidden="true">·</span>
              <span>Reported {timeAgo(issue.createdAt)}</span>
            </span>
          ) : undefined
        }
        size="xl"
        footer={
          <>
            <p className="text-[11px] leading-4 text-slate-500">
              Each action is saved immediately and recorded in the audit trail.
            </p>
            <div className="flex flex-wrap gap-2">
              {issue && (
                <Link to={`/issues/${issue.issueId}`} className={buttonStyles('secondary', 'sm')}>
                  Open citizen view
                </Link>
              )}
              <Button size="sm" variant="secondary" onClick={requestCloseDetails}>
                Close
              </Button>
            </div>
          </>
        }
      >
        {detailState.loading ? (
          <LoadingBlock rows={6} />
        ) : detailState.error ? (
          <ErrorState message={detailState.error} onRetry={detailState.reload} />
        ) : !issue ? (
          <EmptyState
            icon={ClipboardList}
            title="Complaint details are unavailable"
            description="Close this dialog and select another complaint from the queue."
          />
        ) : (
          <div className="space-y-6">
            <section>
              <div className="flex flex-wrap items-center gap-2">
                <StatusBadge status={issue.status} />
                <PriorityBadge band={issue.priorityBand} score={issue.priorityScore} />
                <Badge tone="bg-slate-100 text-slate-600 ring-slate-200">
                  <Users className="h-3 w-3" /> {issue.aggregateReportCount} report
                  {issue.aggregateReportCount === 1 ? '' : 's'}
                </Badge>
                {issue.demoData && <DemoBadge />}
                {issue.parentIssueId && (
                  <Badge tone="bg-violet-50 text-violet-700 ring-violet-200">
                    Duplicate of {issue.parentIssueId}
                  </Badge>
                )}
              </div>
              <p className="mt-4 whitespace-pre-line text-sm leading-7 text-slate-700">{issue.description}</p>
              <dl className="mt-4 grid gap-x-6 gap-y-4 rounded-xl border border-slate-200 bg-slate-50/70 p-4 sm:grid-cols-2">
                <div>
                  <dt className="text-[10px] font-bold uppercase tracking-wide text-slate-500">Location</dt>
                  <dd className="mt-1 text-xs leading-5 text-navy-900">{issue.locationLabel || 'No label provided'}</dd>
                  <dd className="text-[10px] text-slate-500">{locationText(issue)} · {issue.locationConfirmed ? 'Confirmed' : 'Not confirmed'}</dd>
                </div>
                <div>
                  <dt className="text-[10px] font-bold uppercase tracking-wide text-slate-500">Reported</dt>
                  <dd className="mt-1 text-xs leading-5 text-navy-900">{formatDateTime(issue.createdAt)}</dd>
                  <dd className="text-[10px] text-slate-500">Last updated {timeAgo(issue.updatedAt)}</dd>
                </div>
                <div>
                  <dt className="text-[10px] font-bold uppercase tracking-wide text-slate-500">Assigned to</dt>
                  <dd className="mt-1 text-xs leading-5 text-navy-900">{issue.assignedDepartment || 'Not assigned yet'}</dd>
                </div>
                <div>
                  <dt className="text-[10px] font-bold uppercase tracking-wide text-slate-500">Citizen submissions</dt>
                  <dd className="mt-1 text-xs leading-5 text-navy-900">{issue.aggregateReportCount} linked report(s)</dd>
                  <dd className="text-[10px] text-slate-500">Original reports are preserved.</dd>
                </div>
              </dl>
            </section>

            <DetailSection
              eyebrow="Priority"
              title="Why this complaint ranks here"
              description="The score is a deterministic suggestion. An operator override is recorded with its reason."
            >
              <div className="mt-4 grid gap-4 lg:grid-cols-[1.05fr_0.95fr]">
                <PriorityBreakdown issue={issue} />
                <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4">
                  <p className="text-xs font-bold text-navy-900">Operator priority override</p>
                  <p className="mt-1 text-[11px] leading-5 text-slate-500">
                    Change the ranking only with a short explanation. The calculated score remains in history.
                  </p>
                  <div className="mt-3 grid gap-2 sm:grid-cols-[96px_1fr]">
                    <TextInput
                      type="number"
                      min={0}
                      max={100}
                      value={overrideScore}
                      onChange={(event) => setOverrideScore(event.target.value)}
                      aria-label="Override score"
                    />
                    <TextInput
                      value={overrideReason}
                      onChange={(event) => setOverrideReason(event.target.value)}
                      placeholder="Reason (required, 10+ characters)"
                      aria-label="Override reason"
                    />
                  </div>
                  <Button
                    size="sm"
                    variant="secondary"
                    className="mt-3"
                    loading={busy === 'override'}
                    onClick={override}
                  >
                    Record override
                  </Button>
                  {issue.overrides.length > 0 && (
                    <div className="mt-3 space-y-1 border-t border-slate-200 pt-3">
                      <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">Recent overrides</p>
                      {issue.overrides.slice(0, 3).map((overrideItem) => (
                        <p key={overrideItem.overrideId} className="text-[10px] leading-4 text-slate-500">
                          {overrideItem.previousScore} → {overrideItem.newScore} · {overrideItem.reason}
                        </p>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </DetailSection>

            <DetailSection
              eyebrow="Duplicate review"
              title="Likely duplicate suggestions"
              description="Matches use category, distance and text only. Photo similarity is disabled."
            >
              {issue.duplicateSuggestions.length === 0 ? (
                <p className="mt-3 rounded-xl border border-slate-200 bg-slate-50/70 p-4 text-xs leading-5 text-slate-500">
                  No duplicate suggestions for this complaint.
                </p>
              ) : (
                <div className="mt-4 space-y-2">
                  {issue.duplicateSuggestions.map((suggestion) => (
                    <div
                      key={suggestion.suggestionId}
                      className={cls(
                        'rounded-xl border p-3.5',
                        suggestion.status === 'pending'
                          ? 'border-amber-200 bg-amber-50/50'
                          : suggestion.status === 'confirmed'
                            ? 'border-violet-200 bg-violet-50/50'
                            : 'border-slate-200 bg-slate-50',
                      )}
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <Link
                          to={`/issues/${suggestion.candidateIssueId}`}
                          className="text-xs font-bold text-navy-900 hover:underline"
                        >
                          {suggestion.candidateIssueId} · {suggestion.candidateTitle || 'Candidate issue'}
                        </Link>
                        <Badge
                          tone={
                            suggestion.status === 'pending'
                              ? 'bg-amber-100 text-amber-800 ring-amber-200'
                              : suggestion.status === 'confirmed'
                                ? 'bg-violet-100 text-violet-800 ring-violet-200'
                                : 'bg-slate-100 text-slate-500 ring-slate-200'
                          }
                        >
                          {suggestion.status} · {Math.round(suggestion.score * 100)}% match
                        </Badge>
                      </div>
                      <p className="mt-1 text-[10px] text-slate-500">
                        {suggestion.distanceM !== null ? `${suggestion.distanceM} m apart · ` : 'No distance · '}
                        text similarity {Math.round((suggestion.textScore || 0) * 100)}%
                      </p>
                      <ul className="mt-1.5 space-y-0.5">
                        {suggestion.reasons.map((reason) => (
                          <li key={reason} className="text-[10px] leading-4 text-slate-500">• {reason}</li>
                        ))}
                      </ul>
                      {suggestion.status === 'pending' && (
                        <div className="mt-3 flex flex-wrap gap-2">
                          <Button
                            size="sm"
                            loading={busy === `dup-${suggestion.suggestionId}-confirm`}
                            onClick={() => reviewDuplicate(suggestion.suggestionId, 'confirm')}
                          >
                            Confirm duplicate
                          </Button>
                          <Button
                            size="sm"
                            variant="secondary"
                            loading={busy === `dup-${suggestion.suggestionId}-reject`}
                            onClick={() => reviewDuplicate(suggestion.suggestionId, 'reject')}
                          >
                            Keep separate
                          </Button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </DetailSection>

            <DetailSection
              eyebrow="Workflow"
              title="Route and update this complaint"
              description="Actions are applied immediately. Status changes cannot skip the evidence review step."
            >
              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <div className="rounded-xl border border-slate-200 p-4">
                  <div className="flex items-center gap-2 text-sm font-bold text-navy-900">
                    <Building2 className="h-4 w-4 text-teal-600" /> Assignment
                  </div>
                  <div className="mt-3 space-y-3">
                    <Field label="Department or operator" htmlFor="department">
                      <SelectInput id="department" value={department} onChange={(event) => setDepartment(event.target.value)}>
                        {DEPARTMENTS.map((name) => (
                          <option key={name} value={name}>{name}</option>
                        ))}
                      </SelectInput>
                    </Field>
                    <Field label="Assignment note" htmlFor="assign-note" hint="Optional instruction for the assigned team.">
                      <TextInput
                        id="assign-note"
                        value={assignNote}
                        onChange={(event) => setAssignNote(event.target.value)}
                        placeholder="e.g. Inspect before Friday"
                      />
                    </Field>
                    <Button size="sm" icon={Building2} loading={busy === 'assign'} onClick={assign}>
                      Assign complaint
                    </Button>
                    {issue.assignments.length > 0 && (
                      <p className="rounded-lg bg-slate-50 p-2.5 text-[10px] leading-4 text-slate-500">
                        Latest: {issue.assignments[0].departmentOrOperator} · {formatDateTime(issue.assignments[0].assignedAt)} by {issue.assignments[0].assignedBy}
                      </p>
                    )}
                  </div>
                </div>

                <div className="rounded-xl border border-slate-200 p-4">
                  <div className="flex items-center gap-2 text-sm font-bold text-navy-900">
                    <Gauge className="h-4 w-4 text-teal-600" /> Status
                  </div>
                  <div className="mt-3 space-y-3">
                    <Field label="Status note" htmlFor="status-note" hint="Stored with actor and timestamp in the audit trail.">
                      <TextInput
                        id="status-note"
                        value={statusNote}
                        onChange={(event) => setStatusNote(event.target.value)}
                        placeholder="Optional note shown to citizens"
                      />
                    </Field>
                    <div>
                      <p className="mb-1.5 text-xs font-semibold text-navy-800">Change status to</p>
                      <div className="flex flex-wrap gap-2">
                        {statusTargets.length ? (
                          statusTargets.map((status) => (
                            <Button
                              key={status}
                              size="sm"
                              variant="secondary"
                              loading={busy === `status-${status}`}
                              onClick={() => updateStatus(status)}
                            >
                              {STATUS_LABELS[status]}
                            </Button>
                          ))
                        ) : (
                          <p className="text-[11px] leading-5 text-slate-500">
                            No direct status changes from "{STATUS_LABELS[issue.status]}". Use the resolution or evidence review sections below.
                          </p>
                        )}
                      </div>
                    </div>
                    <p className="text-[10px] leading-4 text-slate-400">
                      "Resolved (evidence reviewed)" can only be reached through the evidence workflow below.
                    </p>
                  </div>
                </div>
              </div>
            </DetailSection>

            <DetailSection
              eyebrow="Repair evidence"
              title="Submit resolution evidence"
              description="The after-photo and human visual assessment are checked separately. Automated photo comparison is disabled."
            >
              {['in_progress', 'needs_verification'].includes(issue.status) ? (
                <form onSubmit={submitResolution} className="mt-4 grid gap-4 md:grid-cols-2">
                  <div className="space-y-3">
                    <Field label="After-photo" htmlFor="after-photo">
                      <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-dashed border-slate-300 bg-slate-50 px-3 py-3 text-xs font-semibold text-navy-700 hover:bg-slate-100">
                        <ImagePlus className="h-4 w-4 shrink-0 text-teal-600" />
                        <span className="min-w-0 truncate">{afterPhoto ? afterPhoto.name : 'Choose after-photo (JPEG, PNG or WebP, max 5 MB)'}</span>
                        <input
                          id="after-photo"
                          type="file"
                          accept="image/jpeg,image/png,image/webp"
                          className="sr-only"
                          onChange={(event) => setAfterPhoto(event.target.files?.[0] || null)}
                        />
                      </label>
                    </Field>
                    {photoPreview && (
                      <div className="relative">
                        <img src={photoPreview} alt="After-photo preview" className="h-36 w-full rounded-lg border border-slate-200 object-cover" />
                        <button
                          type="button"
                          onClick={() => setAfterPhoto(null)}
                          className="absolute right-2 top-2 rounded-full bg-white/90 p-1 text-slate-600 shadow hover:text-rose-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500"
                          aria-label="Remove after-photo"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    )}
                    <label className="flex cursor-pointer items-start gap-2 text-[10px] leading-4 text-slate-600">
                      <input
                        type="checkbox"
                        checked={allowException}
                        onChange={(event) => setAllowException(event.target.checked)}
                        className="mt-0.5 h-3.5 w-3.5 rounded border-slate-300 text-teal-600 focus:ring-teal-500"
                      />
                      Record a documented exception if an after-photo is genuinely unavailable. It will still require manual verification.
                    </label>
                  </div>
                  <div className="space-y-3">
                    <Field label="Resolution note" htmlFor="resolution-note" required>
                      <TextareaInput
                        id="resolution-note"
                        value={resolutionNote}
                        onChange={(event) => setResolutionNote(event.target.value)}
                        placeholder="What was repaired, when, and by whom?"
                        className="min-h-[92px]"
                      />
                    </Field>
                    <div className="grid grid-cols-2 gap-2">
                      <Field label="Evidence latitude" htmlFor="evidence-lat">
                        <TextInput
                          id="evidence-lat"
                          type="number"
                          step="0.000001"
                          value={evidenceLat}
                          onChange={(event) => setEvidenceLat(event.target.value)}
                        />
                      </Field>
                      <Field label="Evidence longitude" htmlFor="evidence-lng">
                        <TextInput
                          id="evidence-lng"
                          type="number"
                          step="0.000001"
                          value={evidenceLng}
                          onChange={(event) => setEvidenceLng(event.target.value)}
                        />
                      </Field>
                    </div>
                    <Field
                      label="Visual assessment (human)"
                      htmlFor="visual-change"
                      hint="No AI image detection is used. An operator records this assessment."
                    >
                      <SelectInput
                        id="visual-change"
                        value={visualChange}
                        onChange={(event) => setVisualChange(event.target.value)}
                      >
                        <option value="not_assessed">Not assessed</option>
                        <option value="improved">Visible improvement</option>
                        <option value="no_clear_change">No clear change</option>
                        <option value="uncertain">Uncertain</option>
                      </SelectInput>
                    </Field>
                    <Button type="submit" loading={busy === 'resolution'}>
                      Submit resolution evidence
                    </Button>
                  </div>
                </form>
              ) : (
                <div className="mt-4">
                  <Alert kind="info">
                    Evidence can be submitted when the complaint is <strong>In progress</strong> or{' '}
                    <strong>Needs verification</strong>. Current status:{' '}
                    <strong>{STATUS_LABELS[issue.status]}</strong>.
                  </Alert>
                </div>
              )}
            </DetailSection>

            {latestReview && (
              <DetailSection
                eyebrow="Evidence review"
                title="Latest submitted evidence"
                description="A human reviewer must approve a consistent, citizen-confirmed repair."
              >
                <div className="mt-4">
                  <EvidencePanel
                    review={latestReview}
                    beforePhotoUrl={issue.beforePhotoUrl}
                    actions={
                      <div className="space-y-3">
                        <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">Human review decision</p>
                        <EvidenceApproval review={latestReview} />
                        {latestReview.reviewStatus !== 'reviewed_resolution' && (
                          <>
                            <TextInput
                              value={reviewNote}
                              onChange={(event) => setReviewNote(event.target.value)}
                              placeholder="Reviewer note (optional)"
                              aria-label="Reviewer note"
                            />
                            <div className="flex flex-wrap gap-2">
                              <VerifyButtons
                                review={latestReview}
                                busy={busy}
                                onResolve={() => verify('resolved')}
                                onNeedsVerification={() => verify('needs_verification')}
                              />
                            </div>
                            <p className="text-[10px] leading-4 text-slate-400">
                              Approval requires an after-photo, consistent location, human-recorded improvement and citizen confirmation. Pending citizen feedback blocks approval.
                            </p>
                          </>
                        )}
                      </div>
                    }
                  />
                </div>
              </DetailSection>
            )}

            <DetailSection
              eyebrow="Audit"
              title="Complaint history"
              description="Every status change stores the previous status, new status, actor, timestamp and note."
            >
              <div className="mt-4">
                <Timeline history={issue.history} />
              </div>
            </DetailSection>
          </div>
        )}
      </Modal>

      <ConfirmDialog
        open={discardOpen}
        title="Discard unsaved changes?"
        description={
          <>
            You have entered information that has not been saved. Closing the details dialog will
            discard those changes. Saved actions and the complaint record are not affected.
          </>
        }
        confirmLabel="Discard changes"
        onConfirm={closeDetails}
        onCancel={() => setDiscardOpen(false)}
      />

      <ConfirmDialog
        open={resetOpen}
        title="Reset all demo data?"
        description={
          <>
            This deletes <strong>all</strong> issues, reports, reviews, assignments and history in the local
            database, then reloads the labelled demo scenarios. Any complaints you submitted will be lost.
            This action cannot be undone.
          </>
        }
        confirmLabel="Reset and reload demo data"
        loading={busy === 'reset'}
        onConfirm={resetDemo}
        onCancel={() => setResetOpen(false)}
      />
    </div>
  );
}

function DetailSection({
  eyebrow,
  title,
  description,
  children,
}: {
  eyebrow: string;
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <section className="border-t border-slate-200 pt-6">
      <SectionHeading eyebrow={eyebrow} title={title} description={description} size="sm" />
      {children}
    </section>
  );
}

function EvidenceApproval({ review }: { review: ResolutionReview }) {
  const items = [
    { label: 'After-photo present', ok: Boolean(review.afterPhotoUrl) },
    { label: 'Location consistent', ok: review.locationMatch === 'consistent' },
    { label: 'Visual improvement recorded', ok: review.visualChange === 'improved' },
    {
      label: 'Citizen confirmed',
      ok: review.citizenConfirmation === 'confirmed',
      unknown: review.citizenConfirmation === 'pending',
    },
  ];
  return (
    <div className="flex flex-wrap gap-1.5">
      {items.map((item) => (
        <CheckLine
          key={item.label}
          passed={item.ok ? true : item.unknown ? 'unknown' : false}
          label={item.label}
        />
      ))}
    </div>
  );
}

function VerifyButtons({
  review,
  busy,
  onResolve,
  onNeedsVerification,
}: {
  review: ResolutionReview;
  busy: string | null;
  onResolve: () => void;
  onNeedsVerification: () => void;
}) {
  const canResolve =
    Boolean(review.afterPhotoUrl) &&
    review.locationMatch === 'consistent' &&
    review.visualChange === 'improved' &&
    review.citizenConfirmation === 'confirmed' &&
    review.reviewStatus !== 'citizen_disputed';
  return (
    <>
      <Button size="sm" icon={BadgeCheck} loading={busy === 'verify-resolved'} disabled={!canResolve} onClick={onResolve}>
        Approve reviewed resolution
      </Button>
      <Button
        size="sm"
        variant="secondary"
        icon={ShieldAlert}
        loading={busy === 'verify-needs_verification'}
        onClick={onNeedsVerification}
      >
        Keep needs verification
      </Button>
    </>
  );
}
