import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  BadgeCheck,
  ClipboardList,
  Eye,
  FilePlus2,
  Filter,
  Inbox,
  MapPin,
  RefreshCw,
  Search,
  Users,
} from 'lucide-react';
import { api } from '../api';
import { useAsync, useDebouncedValue, useDocumentTitle } from '../lib/hooks';
import { CATEGORY_OPTIONS, STATUS_LABELS, cls, pct } from '../lib/utils';
import { Button, Card, DemoBadge, EmptyState, ErrorState, LoadingBlock, PageHeader, SelectInput, StatCard, TextInput, buttonStyles } from '../components/ui';
import { IssueCard } from '../components/shared';
import { IssueMap } from '../components/IssueMap';
import type { Status } from '../types';

const STATUS_FILTERS = [
  { value: '', label: 'All statuses' },
  { value: 'open', label: 'Open (not resolved)' },
  { value: 'reported', label: STATUS_LABELS.reported },
  { value: 'under_review', label: STATUS_LABELS.under_review },
  { value: 'assigned', label: STATUS_LABELS.assigned },
  { value: 'in_progress', label: STATUS_LABELS.in_progress },
  { value: 'resolution_submitted', label: STATUS_LABELS.resolution_submitted },
  { value: 'needs_verification', label: STATUS_LABELS.needs_verification },
  { value: 'resolved', label: STATUS_LABELS.resolved },
  { value: 'reopened', label: STATUS_LABELS.reopened },
];

function expandStatus(filter: string): string {
  if (filter === 'open') return 'reported,under_review,assigned,in_progress';
  return filter;
}

export default function CitizenDashboard() {
  useDocumentTitle('Citizen dashboard');
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [status, setStatus] = useState('');
  const [sort, setSort] = useState('recent');
  const debouncedSearch = useDebouncedValue(search, 350);

  const statsState = useAsync(() => api.stats(), []);
  const issuesState = useAsync(
    () =>
      api.listIssues({
        q: debouncedSearch || undefined,
        category: category || undefined,
        status: expandStatus(status) || undefined,
        sort,
      }),
    [debouncedSearch, category, status, sort],
  );

  const stats = statsState.data;
  const issues = issuesState.data || [];
  const hasFilters = Boolean(search || category || status);
  const demoShare = stats ? pct(stats.demoIssues, stats.total) : null;

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
      <PageHeader
        eyebrow="Citizen dashboard"
        title="What is happening in your city?"
        description={
          <>
            Browse complaints, filter by category or status, and open any issue to follow its full
            timeline. {stats ? `${stats.demoIssues} of ${stats.total} records are labelled demo data.` : ''}
          </>
        }
        actions={
          <>
            <Button variant="secondary" icon={RefreshCw} onClick={() => { statsState.reload(); issuesState.reload(); }}>
              Refresh
            </Button>
            <Link to="/report" className={buttonStyles('primary')}>
              <FilePlus2 className="h-4 w-4" /> Report an issue
            </Link>
          </>
        }
      />

      {statsState.error ? (
        <div className="mt-6">
          <ErrorState message={statsState.error} onRetry={statsState.reload} />
        </div>
      ) : (
        <div className="mt-6 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
          <StatCard
            label="Total reported"
            value={stats?.total ?? '—'}
            hint={
              <>
                {demoShare && <span className="inline-flex flex-wrap items-center gap-1">{demoShare} demo records <DemoBadge /></span>}
              </>
            }
            icon={ClipboardList}
            tone="blue"
          />
          <StatCard
            label="Open / in progress"
            value={stats?.open ?? '—'}
            hint={`${stats?.inProgress ?? 0} currently in progress`}
            icon={Users}
            tone="teal"
          />
          <StatCard
            label="Awaiting verification"
            value={stats?.awaitingVerification ?? '—'}
            hint="Resolution submitted or needs evidence review"
            icon={Eye}
            tone="amber"
          />
          <StatCard
            label="Reviewed resolutions"
            value={stats?.resolved ?? '—'}
            hint="Evidence-reviewed, not just claimed"
            icon={BadgeCheck}
            tone="emerald"
          />
        </div>
      )}

      <div className="mt-6 grid gap-5 lg:grid-cols-[1.15fr_0.85fr]">
        <div className="min-w-0">
          <Card className="p-4">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-sm font-bold text-navy-900">
                <Filter className="h-4 w-4 text-teal-600" /> Filter complaints
              </div>
              {hasFilters && (
                <button
                  type="button"
                  onClick={() => {
                    setSearch('');
                    setCategory('');
                    setStatus('');
                  }}
                  className="text-[11px] font-semibold text-teal-700 hover:underline"
                >
                  Clear filters
                </button>
              )}
            </div>
            <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-[1.4fr_1fr_1fr_auto]">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <TextInput
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search ID or keyword"
                  className="pl-9"
                  aria-label="Search complaints by ID or keyword"
                />
              </div>
              <SelectInput
                value={category}
                onChange={(event) => setCategory(event.target.value)}
                aria-label="Filter by category"
              >
                <option value="">All types</option>
                {CATEGORY_OPTIONS.map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </SelectInput>
              <SelectInput
                value={status}
                onChange={(event) => setStatus(event.target.value)}
                aria-label="Filter by status"
              >
                {STATUS_FILTERS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </SelectInput>
              <SelectInput
                value={sort}
                onChange={(event) => setSort(event.target.value)}
                aria-label="Sort complaints"
                className="lg:w-32"
              >
                <option value="recent">Newest</option>
                <option value="priority">Priority</option>
                <option value="waiting">Longest waiting</option>
                <option value="score_asc">Lowest score</option>
              </SelectInput>
            </div>
          </Card>

          <div className="mt-3 flex items-center justify-between px-1">
            <p className="text-xs font-semibold text-slate-500">
              {issuesState.loading ? 'Loading complaints…' : `${issues.length} complaint${issues.length === 1 ? '' : 's'}`}
              {hasFilters && !issuesState.loading ? ' matching filters' : ''}
            </p>
            {stats && stats.demoIssues > 0 && (
              <span className="inline-flex items-center gap-1.5 text-[10px] font-semibold text-amber-800">
                <DemoBadge /> Synthetic demo records included
              </span>
            )}
          </div>

          <div className="mt-2 space-y-2.5">
            {issuesState.loading ? (
              <LoadingBlock rows={5} />
            ) : issuesState.error ? (
              <ErrorState message={issuesState.error} onRetry={issuesState.reload} />
            ) : issues.length === 0 ? (
              <Card className="p-4">
                <EmptyState
                  icon={Inbox}
                  title="No complaints match these filters"
                  description={
                    hasFilters
                      ? 'Try clearing one or more filters, or search a different complaint ID.'
                      : 'No complaints have been submitted yet. Start by reporting an issue.'
                  }
                  action={
                    <Link to="/report" className={buttonStyles('primary', 'sm')}>
                      Report an issue
                    </Link>
                  }
                />
              </Card>
            ) : (
              issues.map((issue) => <IssueCard key={issue.issueId} issue={issue} showDescription />)
            )}
          </div>
        </div>

        <div className="min-w-0">
          <Card className="overflow-hidden">
            <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
              <div className="flex items-center gap-2 text-sm font-bold text-navy-900">
                <MapPin className="h-4 w-4 text-teal-600" /> Issue map
              </div>
              <span className="text-[10px] font-semibold text-slate-400">
                {issues.filter((issue) => issue.latitude !== null && issue.longitude !== null).length} located
              </span>
            </div>
            <div className="p-3">
              <IssueMap
                issues={issues}
                height={430}
                onSelect={(issue) => navigate(`/issues/${issue.issueId}`)}
              />
              <div className="mt-2 flex flex-wrap items-center gap-2 px-1 text-[10px] text-slate-500">
                <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-rose-600" /> Critical</span>
                <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-orange-500" /> High</span>
                <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-amber-600" /> Medium</span>
                <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-teal-700" /> Low</span>
              </div>
            </div>
          </Card>

          <Card className="mt-5 p-4 sm:p-5">
            <p className="text-sm font-bold text-navy-900">How to use this page</p>
            <ol className="mt-3 space-y-3 text-xs leading-5 text-slate-600">
              <li className="flex gap-2.5">
                <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-teal-50 text-[10px] font-bold text-teal-700">1</span>
                Use the search and filters to find a complaint or area.
              </li>
              <li className="flex gap-2.5">
                <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-teal-50 text-[10px] font-bold text-teal-700">2</span>
                Open a complaint to see its priority, evidence and status history.
              </li>
              <li className="flex gap-2.5">
                <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-teal-50 text-[10px] font-bold text-teal-700">3</span>
                Cannot find an issue? Report it with a photo and a confirmed location.
              </li>
            </ol>
            <div className="mt-4 flex flex-wrap gap-2">
              <Link to="/report" className={buttonStyles('primary', 'sm')}>
                <FilePlus2 className="h-3.5 w-3.5" /> Report an issue
              </Link>
              <Link to="/track" className={buttonStyles('secondary', 'sm')}>
                Track by ID
              </Link>
            </div>
          </Card>

          <div className="mt-5 rounded-xl border border-dashed border-amber-300 bg-amber-50/70 p-3 text-[11px] leading-5 text-amber-900">
            <span className="font-bold">Demo data notice:</span> Records marked “Demo data” are synthetic
            hackathon examples. Statistics are computed from this local database only and are not official
            municipal figures.
          </div>
        </div>
      </div>
    </div>
  );
}
