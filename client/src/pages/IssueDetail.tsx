import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  Building2,
  CalendarClock,
  CheckCircle2,
  Clock,
  Copy,
  FileWarning,
  Link2,
  MapPin,
  MessageSquarePlus,
  Search,
  ShieldCheck,
  ThumbsDown,
  ThumbsUp,
  Users,
} from 'lucide-react';
import { api, ApiError } from '../api';
import { useAsync, useDocumentTitle } from '../lib/hooks';
import { useToast } from '../components/Toast';
import {
  Alert,
  Badge,
  Button,
  Card,
  DemoBadge,
  EmptyState,
  ErrorState,
  Field,
  LoadingBlock,
  SectionHeading,
  TextareaInput,
} from '../components/ui';
import {
  CategoryIcon,
  EvidencePanel,
  LinkedReports,
  Photo,
  PriorityBadge,
  PriorityBreakdown,
  StatusBadge,
  Timeline,
} from '../components/shared';
import { IssueMap } from '../components/IssueMap';
import {
  CATEGORY_LABELS,
  formatDateTime,
  getCitizenId,
  locationText,
  timeAgo,
} from '../lib/utils';
import type { IssueDetail as IssueDetailType } from '../types';

export default function IssueDetail() {
  const { issueId = '' } = useParams();
  const normalized = issueId.toUpperCase();
  const { toast } = useToast();
  const state = useAsync(() => api.getIssue(normalized), [normalized]);
  const [note, setNote] = useState('');
  const [acting, setActing] = useState<string | null>(null);
  const [reportText, setReportText] = useState('');
  const [reportPhoto, setReportPhoto] = useState<File | null>(null);
  const [reportError, setReportError] = useState<string | null>(null);
  const [addingReport, setAddingReport] = useState(false);

  const issue = state.data;
  useDocumentTitle(issue ? `${issue.issueId} · ${issue.title}` : 'Complaint tracking');

  const latestReview = useMemo(() => issue?.reviews?.[0] || null, [issue]);
  const canGiveFeedback =
    issue &&
    latestReview &&
    ['resolution_submitted', 'needs_verification', 'resolved'].includes(issue.status);

  const focus = issue?.latitude !== null && issue?.longitude !== null && issue
    ? ([issue.latitude, issue.longitude] as [number, number])
    : null;

  const copyId = async () => {
    if (!issue) return;
    try {
      await navigator.clipboard.writeText(issue.issueId);
      toast('Complaint ID copied.', 'success');
    } catch {
      toast(`Complaint ID: ${issue.issueId}`, 'info');
    }
  };

  const feedback = async (confirmation: 'confirmed' | 'disputed') => {
    if (!issue) return;
    setActing(confirmation);
    try {
      const response = await api.feedback(issue.issueId, {
        confirmation,
        actor: `Citizen (${getCitizenId()})`,
        note: note.trim() || undefined,
      });
      state.setData(response.issue);
      setNote('');
      toast(response.message, 'success');
    } catch (error) {
      toast((error as Error).message, 'error');
    } finally {
      setActing(null);
    }
  };

  const addReport = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!issue) return;
    setReportError(null);
    if (reportText.trim().length < 10) {
      setReportError('Add at least 10 characters describing how this issue affects you.');
      return;
    }
    setAddingReport(true);
    try {
      const form = new FormData();
      form.set('description', reportText.trim());
      form.set('submitterId', getCitizenId());
      if (issue.latitude !== null && issue.longitude !== null) {
        form.set('latitude', String(issue.latitude));
        form.set('longitude', String(issue.longitude));
      }
      if (reportPhoto) form.set('photo', reportPhoto);
      const response = await api.addReport(issue.issueId, form);
      state.setData(response.issue);
      setReportText('');
      setReportPhoto(null);
      toast('Linked report added. Original submissions are preserved.', 'success');
    } catch (error) {
      setReportError((error as Error).message);
      toast((error as Error).message, 'error');
    } finally {
      setAddingReport(false);
    }
  };

  if (state.loading) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
        <LoadingBlock rows={5} />
      </div>
    );
  }

  if (state.error || !issue) {
    const isNotFound = state.error?.includes('not found');
    return (
      <div className="mx-auto max-w-2xl px-4 py-14 sm:px-6">
        <EmptyState
          icon={isNotFound ? Search : FileWarning}
          title={isNotFound ? `Complaint ${normalized} was not found` : 'Could not load this complaint'}
          description={
            state.error ||
            'Check that the complaint ID is correct. This is a demo database, so only seeded and locally submitted IDs exist.'
          }
          action={
            <div className="flex gap-2">
              <Link to="/track" className="text-xs font-semibold text-teal-700">
                Try another ID →
              </Link>
            </div>
          }
        />
        {state.error && !isNotFound && (
          <div className="mt-4">
            <ErrorState message={state.error} onRetry={state.reload} />
          </div>
        )}
      </div>
    );
  }

  const pendingSuggestions = issue.duplicateSuggestions.filter((suggestion) => suggestion.status === 'pending');

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link to="/dashboard" className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-teal-700">
          <ArrowLeft className="h-3.5 w-3.5" /> Back to dashboard
        </Link>
        <div className="flex items-center gap-2">
          <Button variant="secondary" size="sm" icon={Copy} onClick={copyId}>
            Copy ID
          </Button>
          <Link to="/track" className="text-xs font-semibold text-teal-700 hover:underline">
            Track another complaint
          </Link>
        </div>
      </div>

      <Card className="mt-3 overflow-hidden">
        <div className="border-b border-slate-200 bg-slate-50/60 px-4 py-4 sm:px-6">
          <div className="flex flex-wrap items-start gap-3">
            <CategoryIcon category={issue.category} size="lg" />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[11px] font-bold uppercase tracking-wide text-slate-500">
                  {CATEGORY_LABELS[issue.category]}
                </span>
                <span className="text-[11px] font-semibold text-slate-400">·</span>
                <span className="font-mono text-[11px] font-semibold text-navy-700">{issue.issueId}</span>
                {issue.demoData && <DemoBadge />}
                {issue.parentIssueId && (
                  <Badge tone="bg-violet-50 text-violet-700 ring-violet-200">
                    <Link2 className="h-3 w-3" /> Linked to {issue.parentIssueId}
                  </Badge>
                )}
              </div>
              <h1 className="mt-1 text-xl font-bold tracking-tight text-navy-900 sm:text-2xl">{issue.title}</h1>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <StatusBadge status={issue.status} />
                <PriorityBadge band={issue.priorityBand} score={issue.priorityScore} />
                <Badge tone="bg-slate-100 text-slate-600 ring-slate-200">
                  <Users className="h-3 w-3" /> {issue.aggregateReportCount} report
                  {issue.aggregateReportCount === 1 ? '' : 's'}
                </Badge>
              </div>
            </div>
          </div>
        </div>
        <div className="grid gap-4 px-4 py-4 text-xs text-slate-600 sm:grid-cols-2 sm:px-6 lg:grid-cols-4">
          <div className="flex items-start gap-2">
            <CalendarClock className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
            <div>
              <p className="font-semibold text-navy-900">Reported</p>
              <p>{formatDateTime(issue.createdAt)}</p>
              <p className="text-[10px] text-slate-400">{timeAgo(issue.createdAt)}</p>
            </div>
          </div>
          <div className="flex items-start gap-2">
            <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
            <div>
              <p className="font-semibold text-navy-900">Location</p>
              <p>{issue.locationLabel || 'No address / landmark provided'}</p>
              <p className="text-[10px] text-slate-400">{locationText(issue)}</p>
            </div>
          </div>
          <div className="flex items-start gap-2">
            <Building2 className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
            <div>
              <p className="font-semibold text-navy-900">Assigned to</p>
              <p>{issue.assignedDepartment || 'Not assigned yet'}</p>
            </div>
          </div>
          <div className="flex items-start gap-2">
            <Clock className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
            <div>
              <p className="font-semibold text-navy-900">Last update</p>
              <p>{timeAgo(issue.updatedAt)}</p>
            </div>
          </div>
        </div>
      </Card>

      {pendingSuggestions.length > 0 && (
        <div className="mt-4">
          <Alert kind="warning" title="Possible duplicate suggested for authority review">
            {pendingSuggestions.map((suggestion) => (
              <p key={suggestion.suggestionId} className="text-xs">
                Candidate <strong>{suggestion.candidateIssueId}</strong> · {Math.round(suggestion.score * 100)}%
                match. This complaint remains separate until an operator reviews it.
              </p>
            ))}
          </Alert>
        </div>
      )}

      <div className="mt-5 grid gap-5 lg:grid-cols-[1.35fr_0.65fr]">
        <div className="space-y-5">
          <Card className="p-4 sm:p-5">
            <SectionHeading eyebrow="Complaint" title="What was reported" />
            <p className="mt-3 whitespace-pre-line text-sm leading-7 text-slate-700">{issue.description}</p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <div>
                <p className="mb-1 text-[10px] font-bold uppercase tracking-wide text-slate-500">Before-photo</p>
                <Photo
                  src={issue.beforePhotoUrl}
                  alt={`Before photo for ${issue.issueId}`}
                  className="h-48"
                  emptyLabel="No before-photo uploaded"
                />
              </div>
              <div>
                <p className="mb-1 text-[10px] font-bold uppercase tracking-wide text-slate-500">Reported location</p>
                <IssueMap issues={[issue]} focus={focus} height={192} />
                <p className="mt-1 flex items-center gap-1 text-[10px] text-slate-500">
                  <MapPin className="h-3 w-3" /> {issue.locationLabel || 'No label'} ·{' '}
                  {issue.locationConfirmed ? 'Location confirmed' : 'Location not confirmed'}
                </p>
              </div>
            </div>
          </Card>

          <Card className="p-4 sm:p-5">
            <LinkedReports issue={issue} />
          </Card>

          <Card className="p-4 sm:p-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <SectionHeading eyebrow="Audit trail" title="Status timeline" />
              <Badge tone="bg-slate-100 text-slate-600 ring-slate-200">{issue.history.length} events</Badge>
            </div>
            <p className="mt-1 text-xs leading-5 text-slate-500">
              Persisted history — loaded from the database, not temporary browser state.
            </p>
            <div className="mt-4">
              <Timeline history={issue.history} />
            </div>
          </Card>

          <Card className="p-4 sm:p-5">
            <SectionHeading
              eyebrow="Citizen action"
              title="This affects me too"
              description="Add your own report without deleting or replacing the original submission."
            />
            <form onSubmit={addReport} className="mt-3 space-y-3">
              <Field label="Your report" htmlFor="linked-report" required error={reportError || undefined}>
                <TextareaInput
                  id="linked-report"
                  value={reportText}
                  maxLength={2000}
                  onChange={(event) => {
                    setReportText(event.target.value);
                    setReportError(null);
                  }}
                  placeholder="Describe how this issue affects you. Include any new detail."
                  className="min-h-[90px]"
                />
              </Field>
              <div className="flex flex-wrap items-center gap-3">
                <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-navy-700 hover:bg-slate-50">
                  <MessageSquarePlus className="h-3.5 w-3.5 text-teal-600" />
                  {reportPhoto ? reportPhoto.name : 'Attach a photo (optional)'}
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    className="sr-only"
                    onChange={(event) => setReportPhoto(event.target.files?.[0] || null)}
                  />
                </label>
                <Button type="submit" size="sm" loading={addingReport}>
                  Add linked report
                </Button>
                <span className="text-[10px] text-slate-400">Original submission is preserved.</span>
              </div>
            </form>
          </Card>
        </div>

        <div className="space-y-5">
          <Card className="p-4 sm:p-5">
            <PriorityBreakdown issue={issue} />
          </Card>

          {latestReview ? (
            <>
              <EvidencePanel review={latestReview} beforePhotoUrl={issue.beforePhotoUrl} />
              {issue.reviews.length > 1 && (
                <p className="px-1 text-[10px] text-slate-500">
                  {issue.reviews.length - 1} earlier resolution review(s) exist. The latest is shown above.
                </p>
              )}
            </>
          ) : (
            <Card className="p-4">
              <div className="flex items-start gap-2.5">
                <ShieldCheck className="mt-0.5 h-5 w-5 text-slate-400" />
                <div>
                  <p className="text-sm font-bold text-navy-900">No resolution evidence yet</p>
                  <p className="mt-1 text-xs leading-5 text-slate-500">
                    When an authority submits an after-photo and repair note, the evidence review appears here.
                  </p>
                </div>
              </div>
            </Card>
          )}

          <Card className="p-4 sm:p-5">
            <SectionHeading eyebrow="Your voice" title="Confirm or dispute a repair" />
            {!latestReview ? (
              <p className="mt-2 text-xs leading-5 text-slate-500">
                Citizen confirmation becomes available after a resolution is submitted.
              </p>
            ) : (
              <div className="mt-3">
                <div className="mb-3 flex flex-wrap items-center gap-2 text-xs">
                  <span className="text-slate-500">Current response:</span>
                  {latestReview.citizenConfirmation === 'confirmed' ? (
                    <Badge tone="bg-emerald-50 text-emerald-700 ring-emerald-200">Confirmed</Badge>
                  ) : latestReview.citizenConfirmation === 'disputed' ? (
                    <Badge tone="bg-rose-50 text-rose-700 ring-rose-200">Disputed</Badge>
                  ) : (
                    <Badge tone="bg-amber-50 text-amber-800 ring-amber-200">Pending</Badge>
                  )}
                </div>
                {issue.status === 'resolved' && latestReview.citizenConfirmation === 'confirmed' ? (
                  <div className="rounded-lg border border-emerald-200 bg-emerald-50/70 p-3 text-xs leading-5 text-emerald-900">
                    <CheckCircle2 className="mb-1 h-4 w-4" />
                    This resolution passed human review. You can still dispute it if the problem has
                    returned — disputing reopens the issue.
                  </div>
                ) : null}
                {canGiveFeedback ? (
                  <>
                    <Field label="Optional note" htmlFor="feedback-note">
                      <TextareaInput
                        id="feedback-note"
                        value={note}
                        maxLength={600}
                        onChange={(event) => setNote(event.target.value)}
                        placeholder="Add context for the authority reviewer."
                        className="min-h-[75px]"
                      />
                    </Field>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <Button
                        size="sm"
                        icon={ThumbsUp}
                        loading={acting === 'confirmed'}
                        onClick={() => feedback('confirmed')}
                        disabled={latestReview.citizenConfirmation === 'confirmed'}
                      >
                        Confirm repair
                      </Button>
                      <Button
                        size="sm"
                        variant="secondary"
                        icon={ThumbsDown}
                        loading={acting === 'disputed'}
                        onClick={() => feedback('disputed')}
                        disabled={latestReview.citizenConfirmation === 'disputed'}
                      >
                        Dispute repair
                      </Button>
                    </div>
                    <p className="mt-2 text-[10px] leading-4 text-slate-400">
                      Confirmation is recorded as demo citizen feedback; it is not logged-in authentication.
                      Confirming does not automatically resolve the issue — human review is still required.
                    </p>
                  </>
                ) : (
                  <p className="text-xs leading-5 text-slate-500">
                    Feedback is available while the resolution is under review. Current issue status:{' '}
                    <strong>{issue.status.replaceAll('_', ' ')}</strong>.
                  </p>
                )}
              </div>
            )}
          </Card>

          <div className="rounded-xl border border-dashed border-slate-300 bg-white p-3 text-[10px] leading-4 text-slate-500">
            <ShieldCheck className="mb-1 h-4 w-4 text-teal-600" />
            CivicEye AI does not use photo AI to prove repair quality or fraud. Evidence results are
            rule-based checks plus human confirmation.
          </div>
        </div>
      </div>
    </div>
  );
}
