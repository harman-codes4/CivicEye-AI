import { lazy, Suspense } from 'react';
import { Route, Routes } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { Layout } from './components/Layout';

const Landing = lazy(() => import('./pages/Landing'));
const CitizenDashboard = lazy(() => import('./pages/CitizenDashboard'));
const ReportIssue = lazy(() => import('./pages/ReportIssue'));
const TrackComplaint = lazy(() => import('./pages/TrackComplaint'));
const IssueDetail = lazy(() => import('./pages/IssueDetail'));
const AuthorityDashboard = lazy(() => import('./pages/AuthorityDashboard'));
const Analytics = lazy(() => import('./pages/Analytics'));
const NotFound = lazy(() => import('./pages/NotFound'));

function PageFallback() {
  return (
    <div className="flex min-h-[55vh] flex-col items-center justify-center gap-3" role="status">
      <Loader2 className="h-6 w-6 animate-spin text-teal-600" />
      <p className="text-xs font-semibold text-slate-500">Loading CivicEye AI…</p>
    </div>
  );
}

export default function App() {
  return (
    <Suspense fallback={<PageFallback />}>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<Landing />} />
          <Route path="/dashboard" element={<CitizenDashboard />} />
          <Route path="/report" element={<ReportIssue />} />
          <Route path="/track" element={<TrackComplaint />} />
          <Route path="/issues/:issueId" element={<IssueDetail />} />
          <Route path="/authority" element={<AuthorityDashboard />} />
          <Route path="/analytics" element={<Analytics />} />
          <Route path="*" element={<NotFound />} />
        </Route>
      </Routes>
    </Suspense>
  );
}
