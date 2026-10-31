import { Link } from 'react-router-dom';
import {
  ArrowRight,
  BadgeCheck,
  BrainCircuit,
  Building2,
  CheckCircle2,
  ClipboardList,
  CopyCheck,
  Eye,
  FileSearch,
  History,
  MapPin,
  Search,
  ShieldCheck,
  Sparkles,
  Users,
  XCircle,
} from 'lucide-react';
import { api } from '../api';
import { useAsync } from '../lib/hooks';
import { CATEGORY_LABELS, PRIORITY_LABELS, STATUS_LABELS, timeAgo } from '../lib/utils';
import { Badge, Button, Card, DemoBadge, LoadingBlock, StatCard, buttonStyles } from '../components/ui';
import { CategoryIcon, ProcessSteps, StatusBadge } from '../components/shared';
import { useDocumentTitle } from '../lib/hooks';

const FEATURES = [
  {
    icon: BrainCircuit,
    title: 'Explainable prioritization',
    body: 'Every issue receives a 0–100 score with visible factor contributions: safety, impact, location, waiting time and reports.',
    tag: 'Rule-based',
  },
  {
    icon: CopyCheck,
    title: 'Duplicate detection',
    body: 'Same-category reports are compared by distance and text similarity. Strong matches link; uncertain matches wait for an operator.',
    tag: 'No image AI',
  },
  {
    icon: History,
    title: 'Transparent tracking',
    body: 'Each status change stores the previous status, new status, actor, timestamp and note in an immutable timeline.',
    tag: 'Audit trail',
  },
  {
    icon: FileSearch,
    title: 'Repair evidence review',
    body: 'After-photo, location consistency and citizen confirmation are checked separately. Uncertainty triggers manual review.',
    tag: 'Human verified',
  },
];

export default function Landing() {
  useDocumentTitle('Report it. Prioritize it. Track it.');
  const { data: stats, loading, error } = useAsync(() => api.stats(), []);

  return (
    <div>
      <section className="relative overflow-hidden border-b border-slate-200 bg-white">
        <div
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(60%_60%_at_80%_10%,rgba(20,184,166,0.10),transparent_60%),radial-gradient(50%_50%_at_5%_90%,rgba(37,99,235,0.07),transparent_60%)]"
          aria-hidden="true"
        />
        <div className="relative mx-auto grid max-w-7xl items-center gap-10 px-4 py-14 sm:px-6 sm:py-20 lg:grid-cols-[1.08fr_0.92fr] lg:px-8 lg:py-24">
          <div className="min-w-0">
            <Badge tone="bg-teal-50 text-teal-800 ring-teal-200">
              <Sparkles className="h-3 w-3" /> GRAVITON 2026 · Civic technology prototype
            </Badge>
            <h1 className="mt-5 max-w-2xl text-4xl font-extrabold leading-[1.08] tracking-tight text-navy-900 sm:text-5xl lg:text-[56px]">
              Your City. Your Voice.{' '}
              <span className="text-teal-600">Visible Action.</span>
            </h1>
            <p className="mt-5 max-w-xl text-base leading-7 text-slate-600 sm:text-lg sm:leading-8">
              CivicEye AI helps citizens report public infrastructure problems and helps authorities
              group, prioritize, repair and verify them — with an audit trail anyone can follow.
            </p>
            <p className="mt-2 text-sm font-semibold text-navy-700">
              Report it. Prioritize it. Track it. Verify the evidence.
            </p>

            <div className="mt-7 flex flex-col gap-3 sm:flex-row">
              <Link to="/report" className={buttonStyles('primary', 'lg')}>
                <FileSearch className="h-4 w-4" /> Report an Issue
              </Link>
              <Link to="/track" className={buttonStyles('secondary', 'lg')}>
                <Search className="h-4 w-4" /> Track Complaint
              </Link>
            </div>

            <div className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-2 text-[11px] font-medium text-slate-500">
              <span className="inline-flex items-center gap-1.5">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" /> Persistent complaint IDs
              </span>
              <span className="inline-flex items-center gap-1.5">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" /> Evidence-aware workflow
              </span>
              <span className="inline-flex items-center gap-1.5">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" /> Demo data clearly labelled
              </span>
            </div>
          </div>

          <div className="relative min-w-0 sm:pb-14">
            <Card className="overflow-hidden shadow-lift">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 bg-navy-900 px-4 py-3">
                <div className="flex items-center gap-2 text-white">
                  <Building2 className="h-4 w-4 text-teal-400" />
                  <span className="text-xs font-bold uppercase tracking-wider">Ward priority queue</span>
                </div>
                <span className="rounded-full border border-dashed border-teal-400/50 bg-teal-400/10 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-teal-200">
                  Live demo preview
                </span>
              </div>
              <div className="bg-slate-50/60 p-4">
                {loading ? (
                  <LoadingBlock rows={3} />
                ) : error ? (
                  <div className="rounded-xl border border-dashed border-slate-300 bg-white p-5 text-center">
                    <p className="text-sm font-semibold text-navy-900">API preview unavailable</p>
                    <p className="mt-1 text-xs leading-5 text-slate-500">
                      Start the local server to load live demo complaints. The rest of the interface is
                      still available.
                    </p>
                    <Link to="/authority" className="mt-3 inline-block text-xs font-semibold text-teal-700">
                      Open authority view →
                    </Link>
                  </div>
                ) : (
                  <>
                    <div className="grid grid-cols-3 gap-2">
                      <div className="rounded-lg bg-white p-2.5 ring-1 ring-slate-200">
                        <p className="text-[9px] font-bold uppercase tracking-wide text-slate-400">Total</p>
                        <p className="text-lg font-bold text-navy-900">{stats?.total ?? 0}</p>
                      </div>
                      <div className="rounded-lg bg-white p-2.5 ring-1 ring-slate-200">
                        <p className="text-[9px] font-bold uppercase tracking-wide text-slate-400">Open</p>
                        <p className="text-lg font-bold text-navy-900">{stats?.open ?? 0}</p>
                      </div>
                      <div className="rounded-lg bg-white p-2.5 ring-1 ring-slate-200">
                        <p className="text-[9px] font-bold uppercase tracking-wide text-slate-400">
                          Verify
                        </p>
                        <p className="text-lg font-bold text-orange-600">{stats?.awaitingVerification ?? 0}</p>
                      </div>
                    </div>
                    <div className="mt-3 space-y-2">
                      {(stats?.queue || []).slice(0, 3).map((issue) => (
                        <Link
                          key={issue.issueId}
                          to={`/issues/${issue.issueId}`}
                          className="flex items-center gap-3 rounded-lg border border-slate-200 bg-white p-2.5 transition hover:border-teal-300"
                        >
                          <CategoryIcon category={issue.category} size="sm" />
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-xs font-semibold text-navy-900">{issue.title}</p>
                            <p className="mt-0.5 flex items-center gap-1 text-[10px] text-slate-400">
                              {issue.issueId} · {CATEGORY_LABELS[issue.category]} · {timeAgo(issue.createdAt)}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="text-sm font-bold text-navy-900">{issue.priorityScore}</p>
                            <p
                              className={`text-[9px] font-bold uppercase tracking-wide ${
                                issue.priorityBand === 'critical'
                                  ? 'text-rose-600'
                                  : issue.priorityBand === 'high'
                                    ? 'text-orange-600'
                                    : 'text-amber-600'
                              }`}
                            >
                              {PRIORITY_LABELS[issue.priorityBand]}
                            </p>
                          </div>
                        </Link>
                      ))}
                    </div>
                    <div className="mt-3 flex items-center justify-between rounded-lg border border-dashed border-amber-300 bg-amber-50 px-2.5 py-1.5">
                      <span className="text-[9px] font-bold uppercase tracking-wide text-amber-800">
                        Includes synthetic demo records
                      </span>
                      <DemoBadge />
                    </div>
                  </>
                )}
              </div>
            </Card>
            <div className="absolute -bottom-1 -left-4 hidden rounded-xl border border-slate-200 bg-white px-3 py-2 shadow-lift sm:block">
              <p className="text-[9px] font-bold uppercase tracking-wide text-slate-400">Evidence result</p>
              <p className="mt-0.5 flex items-center gap-1.5 text-xs font-bold text-orange-700">
                <Eye className="h-3.5 w-3.5" /> Needs verification
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="border-b border-slate-200 bg-[#f5f7fb]">
        <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
          <ProcessSteps />
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8 lg:py-20">
        <div className="max-w-2xl">
          <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-teal-700">Built for accountability</p>
          <h2 className="mt-2 text-2xl font-bold tracking-tight text-navy-900 sm:text-3xl">
            Assistive intelligence with guardrails
          </h2>
          <p className="mt-2 text-sm leading-7 text-slate-600">
            CivicEye suggests; people decide. Rankings are transparent rules, duplicate detection never
            merges on location alone, and a photo never proves repair quality.
          </p>
        </div>
        <div className="mt-7 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {FEATURES.map((feature) => {
            const Icon = feature.icon;
            return (
              <Card key={feature.title} className="group p-5 transition-shadow hover:shadow-lift">
                <div className="flex items-start justify-between">
                  <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-navy-900 text-teal-400">
                    <Icon className="h-5 w-5" />
                  </span>
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-slate-500">
                    {feature.tag}
                  </span>
                </div>
                <h3 className="mt-3 text-sm font-bold text-navy-900">{feature.title}</h3>
                <p className="mt-1.5 text-xs leading-5 text-slate-600">{feature.body}</p>
              </Card>
            );
          })}
        </div>
      </section>

      <section className="border-y border-slate-200 bg-white">
        <div className="mx-auto grid max-w-7xl grid-cols-1 gap-8 px-4 py-14 sm:px-6 lg:grid-cols-2 lg:items-center lg:px-8 lg:py-20">
          <div className="min-w-0">
            <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-teal-700">
              A dashboard, not a dead end
            </p>
            <h2 className="mt-2 text-2xl font-bold tracking-tight text-navy-900 sm:text-3xl">
              From a citizen photo to a reviewed resolution
            </h2>
            <p className="mt-3 text-sm leading-7 text-slate-600">
              Citizens see status, priority reasons and evidence. Operators see a prioritized queue,
              duplicate suggestions, assignment controls, resolution evidence and a complete audit trail.
            </p>
            <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="rounded-xl border border-emerald-200 bg-emerald-50/60 p-3">
                <p className="flex items-center gap-1.5 text-xs font-bold text-emerald-800">
                  <BadgeCheck className="h-4 w-4" /> What the system does
                </p>
                <ul className="mt-2 space-y-1.5 text-[11px] leading-5 text-emerald-900">
                  <li>• Explains every priority score</li>
                  <li>• Preserves every original report</li>
                  <li>• Records immutable status history</li>
                  <li>• Flags uncertain repair evidence</li>
                </ul>
              </div>
              <div className="rounded-xl border border-rose-200 bg-rose-50/60 p-3">
                <p className="flex items-center gap-1.5 text-xs font-bold text-rose-800">
                  <XCircle className="h-4 w-4" /> What it never claims
                </p>
                <ul className="mt-2 space-y-1.5 text-[11px] leading-5 text-rose-900">
                  <li>• A score is not proof of fraud</li>
                  <li>• A photo is not proof of quality</li>
                  <li>• Report count is not population</li>
                  <li>• One AI flag is not a verdict</li>
                </ul>
              </div>
            </div>
            <div className="mt-5 flex flex-wrap gap-3">
              <Link to="/dashboard" className={buttonStyles('secondary', 'md')}>
                <ClipboardList className="h-4 w-4" /> Explore citizen dashboard
              </Link>
              <Link to="/authority" className={buttonStyles('ghost', 'md')}>
                <ShieldCheck className="h-4 w-4" /> Open authority view
              </Link>
            </div>
          </div>

          <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2">
            <StatCard
              label="Reported issues"
              value={stats?.total ?? '—'}
              hint={stats ? `${stats.demoIssues} labelled demo records` : 'Connect local API for live data'}
              icon={ClipboardList}
              tone="blue"
            />
            <StatCard
              label="Open / in progress"
              value={stats?.open ?? '—'}
              hint="Not yet resolved"
              icon={Users}
              tone="teal"
            />
            <StatCard
              label="Awaiting verification"
              value={stats?.awaitingVerification ?? '—'}
              hint="Evidence needs human review"
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
            <Card className="sm:col-span-2 p-4">
              <div className="flex items-center justify-between">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                  Recent complaint preview
                </p>
                <Link to="/dashboard" className="text-[11px] font-semibold text-teal-700">
                  View all →
                </Link>
              </div>
              <div className="mt-2 divide-y divide-slate-100">
                {(stats?.recent || []).slice(0, 3).map((issue) => (
                  <div key={issue.issueId} className="flex items-center gap-2.5 py-2">
                    <CategoryIcon category={issue.category} size="sm" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-semibold text-navy-900">{issue.title}</p>
                      <p className="text-[10px] text-slate-400">
                        {issue.issueId} · {issue.locationLabel || 'Location not provided'}
                      </p>
                    </div>
                    <StatusBadge status={issue.status} />
                  </div>
                ))}
                {!stats && !loading && (
                  <p className="py-4 text-xs text-slate-500">Start the API to load complaint previews.</p>
                )}
              </div>
            </Card>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
        <Card className="overflow-hidden border-navy-800 bg-navy-900 p-6 sm:p-9">
          <div className="grid gap-6 lg:grid-cols-[1fr_auto] lg:items-center">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-teal-400">
                Your first step
              </p>
              <h2 className="mt-2 text-2xl font-bold tracking-tight text-white sm:text-3xl">
                See something broken? Put it on the record.
              </h2>
              <p className="mt-2 max-w-xl text-sm leading-6 text-slate-300">
                Submit a complaint with a photo and precise location. Get a stable complaint ID you can
                track through review, work and evidence verification.
              </p>
              <div className="mt-4 flex flex-wrap items-center gap-4 text-[11px] text-slate-400">
                <span className="inline-flex items-center gap-1.5">
                  <MapPin className="h-3.5 w-3.5 text-teal-400" /> No fake GPS confirmation
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <Search className="h-3.5 w-3.5 text-teal-400" /> Search by complaint ID
                </span>
              </div>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row lg:flex-col">
              <Link to="/report" className={buttonStyles('primary', 'lg')}>
                Report an Issue <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                to="/track"
                className="inline-flex items-center justify-center rounded-lg border border-white/20 px-5 text-sm font-semibold text-white transition hover:bg-white/10"
              >
                Track Complaint
              </Link>
            </div>
          </div>
        </Card>
      </section>
    </div>
  );
}
