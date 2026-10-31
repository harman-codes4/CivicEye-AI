import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, ClipboardList, Search, ShieldCheck } from 'lucide-react';
import { api } from '../api';
import { useAsync, useDocumentTitle } from '../lib/hooks';
import { Button, Card, DemoBadge, EmptyState, ErrorState, LoadingBlock, SectionHeading, buttonStyles } from '../components/ui';
import { IssueCard } from '../components/shared';
import { timeAgo } from '../lib/utils';

const DEMO_IDS = ['CIV-1024', 'CIV-1026', 'CIV-1027', 'CIV-1028'];

export default function TrackComplaint() {
  useDocumentTitle('Track a complaint');
  const navigate = useNavigate();
  const [complaintId, setComplaintId] = useState('');
  const [error, setError] = useState<string | null>(null);
  const recent = useAsync(() => api.listIssues({ sort: 'recent' }), []);

  const openComplaint = (id: string) => {
    const normalized = id.trim().toUpperCase();
    if (!normalized) {
      setError('Enter a complaint ID, for example CIV-1024.');
      return;
    }
    if (!/^CIV-\d+$/.test(normalized)) {
      setError('Complaint IDs look like CIV-1024. Check the format and try again.');
      return;
    }
    navigate(`/issues/${normalized}`);
  };

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="text-center">
        <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-teal-700">Track complaint</p>
        <h1 className="mt-1.5 text-2xl font-bold tracking-tight text-navy-900 sm:text-3xl">
          Follow a complaint from report to evidence review
        </h1>
        <p className="mx-auto mt-2 max-w-2xl text-sm leading-6 text-slate-600">
          Enter the complaint ID you received after submitting. The timeline is loaded from the database,
          so it survives refresh and restart.
        </p>
      </div>

      <Card className="mx-auto mt-6 max-w-2xl p-4 sm:p-5">
        <form
          onSubmit={(event) => {
            event.preventDefault();
            openComplaint(complaintId);
          }}
        >
          <label htmlFor="complaint-id" className="mb-1.5 block text-xs font-semibold text-navy-800">
            Complaint ID
          </label>
          <div className="flex flex-col gap-2 sm:flex-row">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                id="complaint-id"
                value={complaintId}
                onChange={(event) => {
                  setComplaintId(event.target.value);
                  setError(null);
                }}
                placeholder="CIV-1024"
                className="h-11 w-full rounded-lg border border-slate-300 bg-white pl-9 pr-3 text-sm font-semibold uppercase tracking-wide text-navy-900 placeholder:font-normal placeholder:normal-case placeholder:tracking-normal placeholder:text-slate-400 focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/30"
                aria-invalid={Boolean(error)}
                aria-describedby={error ? 'complaint-error' : undefined}
              />
            </div>
            <Button type="submit" size="lg" icon={ArrowRight}>
              Track complaint
            </Button>
          </div>
          {error && (
            <p id="complaint-error" className="mt-2 text-xs font-medium text-rose-600" role="alert">
              {error}
            </p>
          )}
        </form>
        <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3">
          <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Demo IDs</span>
          {DEMO_IDS.map((id) => (
            <button
              key={id}
              type="button"
              onClick={() => openComplaint(id)}
              className="rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-[11px] font-semibold text-navy-700 hover:border-teal-300 hover:bg-teal-50"
            >
              {id}
            </button>
          ))}
          <DemoBadge />
        </div>
      </Card>

      <div className="mt-8 grid gap-4 sm:grid-cols-3">
        <div className="flex items-start gap-2.5 rounded-xl border border-slate-200 bg-white p-3">
          <ClipboardList className="mt-0.5 h-5 w-5 text-teal-600" />
          <div>
            <p className="text-xs font-bold text-navy-900">Full status history</p>
            <p className="mt-0.5 text-[11px] leading-5 text-slate-500">
              Every change stores actor, timestamp and note.
            </p>
          </div>
        </div>
        <div className="flex items-start gap-2.5 rounded-xl border border-slate-200 bg-white p-3">
          <Search className="mt-0.5 h-5 w-5 text-teal-600" />
          <div>
            <p className="text-xs font-bold text-navy-900">Evidence review</p>
            <p className="mt-0.5 text-[11px] leading-5 text-slate-500">
              See exactly which checks passed and which need a human.
            </p>
          </div>
        </div>
        <div className="flex items-start gap-2.5 rounded-xl border border-slate-200 bg-white p-3">
          <ShieldCheck className="mt-0.5 h-5 w-5 text-teal-600" />
          <div>
            <p className="text-xs font-bold text-navy-900">Your confirmation</p>
            <p className="mt-0.5 text-[11px] leading-5 text-slate-500">
              Confirm or dispute a submitted repair on the issue page.
            </p>
          </div>
        </div>
      </div>

      <div className="mt-8">
        <SectionHeading
          eyebrow="Recent complaints"
          title="Open another issue"
          description="A quick shortcut to recently reported issues."
          action={<Link to="/dashboard" className="text-xs font-semibold text-teal-700">Citizen dashboard →</Link>}
        />
        <div className="mt-3 grid gap-2.5 sm:grid-cols-2">
          {recent.loading ? (
            <div className="sm:col-span-2">
              <LoadingBlock rows={3} />
            </div>
          ) : recent.error ? (
            <div className="sm:col-span-2">
              <ErrorState message={recent.error} onRetry={recent.reload} />
            </div>
          ) : recent.data?.length ? (
            recent.data.slice(0, 6).map((issue) => <IssueCard key={issue.issueId} issue={issue} />)
          ) : (
            <div className="sm:col-span-2">
              <EmptyState title="No complaints yet" description="Be the first to report an issue." />
            </div>
          )}
        </div>
      </div>

      <div className="mt-6 text-center">
        <p className="text-[11px] text-slate-500">
          Lost your ID? Search the citizen dashboard by keyword or location.{' '}
          <Link to="/report" className="font-semibold text-teal-700">
            Report a new issue
          </Link>
        </p>
      </div>
    </div>
  );
}
