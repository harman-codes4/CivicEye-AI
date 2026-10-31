import { Link } from 'react-router-dom';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  BarChart3,
  Clock,
  MapPin,
  PieChart as PieIcon,
  RefreshCw,
  RotateCcw,
  Target,
  TrendingUp,
} from 'lucide-react';
import { api } from '../api';
import { useAsync, useDocumentTitle } from '../lib/hooks';
import {
  Button,
  Card,
  DemoBadge,
  EmptyState,
  ErrorState,
  LoadingBlock,
  PageHeader,
  SectionHeading,
  StatCard,
  buttonStyles,
} from '../components/ui';
import { CATEGORY_LABELS, PRIORITY_LABELS, formatDateTime, hoursLabel } from '../lib/utils';

const COLORS = ['#0d8a7a', '#0ea5e9', '#f59e0b', '#e11d48', '#8b5cf6', '#64748b'];
const PRIORITY_COLORS: Record<string, string> = {
  critical: '#e11d48',
  high: '#ea580c',
  medium: '#d97706',
  low: '#0f766e',
};

const tooltipStyle = {
  borderRadius: 12,
  border: '1px solid #e2e8f0',
  fontSize: 12,
  boxShadow: '0 8px 24px -12px rgba(11,31,58,0.2)',
};

export default function Analytics() {
  useDocumentTitle('Analytics');
  const state = useAsync(() => api.stats(), []);
  const stats = state.data;

  const statusData = stats
    ? [
        { name: 'Open / in progress', value: stats.open },
        { name: 'Awaiting verification', value: stats.awaitingVerification },
        { name: 'Resolved', value: stats.resolved },
        { name: 'Reopened', value: stats.reopened },
      ]
    : [];

  const categoryData = (stats?.byCategory || []).map((row) => ({
    name: CATEGORY_LABELS[row.category] || row.category,
    value: row.count,
  }));

  const priorityData = (stats?.byPriority || []).map((row) => ({
    name: PRIORITY_LABELS[row.band] || row.band,
    band: row.band,
    value: row.count,
  }));

  const areaData = (stats?.areas || []).map((row) => ({
    name: row.area.length > 26 ? `${row.area.slice(0, 26)}…` : row.area,
    full: row.area,
    value: row.count,
  }));

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
      <PageHeader
        eyebrow="Analytics"
        title="What the local complaint data shows"
        description="All charts are derived from this application's database. Seeded hackathon records are labelled demo data and are not official municipal statistics."
        actions={
          <>
            <Button variant="secondary" icon={RefreshCw} onClick={state.reload}>
              Refresh
            </Button>
            <Link to="/authority" className={buttonStyles('primary')}>
              <Target className="h-4 w-4" /> Authority queue
            </Link>
          </>
        }
      />

      {state.loading ? (
        <div className="mt-6">
          <LoadingBlock rows={5} />
        </div>
      ) : state.error ? (
        <div className="mt-6">
          <ErrorState message={state.error} onRetry={state.reload} />
        </div>
      ) : !stats || stats.total === 0 ? (
        <div className="mt-6">
          <Card className="p-6">
            <EmptyState
              icon={BarChart3}
              title="No data to chart yet"
              description="Report complaints or load the demo data from the authority dashboard to see analytics."
              action={
                <Link to="/report" className={buttonStyles('primary', 'sm')}>
                  Report an issue
                </Link>
              }
            />
          </Card>
        </div>
      ) : (
        <>
          <div className="mt-6 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
            <StatCard
              label="Total records"
              value={stats.total}
              hint={
                <span className="inline-flex flex-wrap items-center gap-1">
                  <DemoBadge /> {stats.demoIssues} demo records
                </span>
              }
              icon={BarChart3}
              tone="blue"
            />
            <StatCard
              label="Reviewed resolutions"
              value={stats.resolved}
              hint="Evidence-reviewed issues"
              icon={TrendingUp}
              tone="emerald"
            />
            <StatCard
              label="Avg. resolution time"
              value={hoursLabel(stats.avgResolutionHours)}
              hint={
                stats.avgResolutionHours === null
                  ? 'No resolved timestamps yet'
                  : `From ${stats.resolvedSampleSize} resolved record(s)`
              }
              icon={Clock}
              tone="amber"
            />
            <StatCard
              label="Reopened"
              value={stats.reopened}
              hint="Citizen or reviewer disputes"
              icon={RotateCcw}
              tone="rose"
            />
          </div>

          <div className="mt-5 grid gap-4 lg:grid-cols-2">
            <Card className="p-4 sm:p-5">
              <SectionHeading
                eyebrow="Lifecycle"
                title="Complaint status distribution"
                description="Current persisted status for every complaint in the local database."
              />
              <div className="mt-4 h-[280px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={statusData} margin={{ top: 8, right: 8, bottom: 8, left: -18 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#eef2f7" vertical={false} />
                    <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#64748b' }} interval={0} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 10, fill: '#94a3b8' }} />
                    <Tooltip contentStyle={tooltipStyle} />
                    <Bar dataKey="value" radius={[6, 6, 0, 0]} isAnimationActive={false}>
                      {statusData.map((_, index) => (
                        <Cell key={index} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card>

            <Card className="p-4 sm:p-5">
              <SectionHeading
                eyebrow="Categories"
                title="Complaints by category"
                description="Counts include every complaint in this local database."
              />
              <div className="mt-4 h-[280px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={categoryData}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      innerRadius={52}
                      outerRadius={92}
                      paddingAngle={2}
                      isAnimationActive={false}
                    >
                      {categoryData.map((_, index) => (
                        <Cell key={index} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={tooltipStyle} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1">
                {categoryData.map((item, index) => (
                  <span key={item.name} className="inline-flex items-center gap-1.5 text-[10px] text-slate-600">
                    <span className="h-2 w-2 rounded-full" style={{ background: COLORS[index % COLORS.length] }} />
                    {item.name} ({item.value})
                  </span>
                ))}
              </div>
            </Card>

            <Card className="p-4 sm:p-5">
              <SectionHeading
                eyebrow="Priority"
                title="Priority distribution"
                description="Bands from the transparent 0–100 rule-based score."
              />
              <div className="mt-4 h-[260px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={priorityData} layout="vertical" margin={{ top: 4, right: 16, bottom: 4, left: 10 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#eef2f7" horizontal={false} />
                    <XAxis type="number" allowDecimals={false} tick={{ fontSize: 10, fill: '#94a3b8' }} />
                    <YAxis
                      type="category"
                      dataKey="name"
                      width={58}
                      tick={{ fontSize: 10, fill: '#64748b' }}
                    />
                    <Tooltip contentStyle={tooltipStyle} />
                    <Bar dataKey="value" radius={[0, 6, 6, 0]} isAnimationActive={false}>
                      {priorityData.map((item) => (
                        <Cell key={item.band} fill={PRIORITY_COLORS[item.band]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <p className="mt-1 text-[10px] leading-4 text-slate-400">
                Scores are suggestions. An operator override is stored with a reason and does not hide the
                computed factors.
              </p>
            </Card>

            <Card className="p-4 sm:p-5">
              <SectionHeading
                eyebrow="Locations"
                title="Area-wise hotspots"
                description="Grouped by recorded location label — not an official ward boundary."
              />
              <div className="mt-4 h-[260px]">
                {areaData.length ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={areaData} layout="vertical" margin={{ top: 4, right: 16, bottom: 4, left: 10 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#eef2f7" horizontal={false} />
                      <XAxis type="number" allowDecimals={false} tick={{ fontSize: 10, fill: '#94a3b8' }} />
                      <YAxis
                        type="category"
                        dataKey="name"
                        width={130}
                        tick={{ fontSize: 9, fill: '#64748b' }}
                      />
                      <Tooltip contentStyle={tooltipStyle} />
                      <Bar dataKey="value" fill="#0d8a7a" radius={[0, 6, 6, 0]} isAnimationActive={false} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <EmptyState icon={MapPin} title="No location labels" description="Complaints need location labels for area grouping." />
                )}
              </div>
            </Card>
          </div>

          <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-dashed border-amber-300 bg-amber-50/70 px-3 py-2.5 text-[10px] leading-4 text-amber-900">
            <span className="inline-flex items-center gap-1.5">
              <DemoBadge /> {stats.demoIssues} of {stats.total} records are synthetic demo data.
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5" /> Generated {formatDateTime(stats.generatedAt)}. Average
              resolution time is shown only when resolved timestamps exist.
            </span>
            <span className="inline-flex items-center gap-1.5">
              <PieIcon className="h-3.5 w-3.5" /> These are not municipal statistics.
            </span>
          </div>
        </>
      )}
    </div>
  );
}
