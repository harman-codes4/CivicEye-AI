import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { MapContainer, Marker, Popup, TileLayer, useMap } from 'react-leaflet';
import L from 'leaflet';
import { MapPinOff } from 'lucide-react';
import type { Issue, PriorityBand } from '../types';
import { CATEGORY_LABELS, priorityTone, STATUS_LABELS, statusTone, timeAgo } from '../lib/utils';
import { Badge, EmptyState } from './ui';

const COLORS: Record<PriorityBand, string> = {
  critical: '#e11d48',
  high: '#ea580c',
  medium: '#d97706',
  low: '#0f766e',
};

function markerIcon(issue: Issue, selected: boolean) {
  const color = COLORS[issue.priorityBand] || COLORS.low;
  const size = selected ? 26 : 18;
  return L.divIcon({
    className: 'civiceye-marker',
    html: `<span class="civiceye-marker-dot${selected ? ' is-selected' : ''}" style="--marker-color:${color};width:${size}px;height:${size}px"></span>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    popupAnchor: [0, -size / 2],
  });
}

function FitBounds({ issues, focus }: { issues: Issue[]; focus?: [number, number] | null }) {
  const map = useMap();
  useEffect(() => {
    if (focus) {
      map.setView(focus, 15);
      return;
    }
    const points = issues
      .filter((issue) => issue.latitude !== null && issue.longitude !== null)
      .map((issue) => [issue.latitude as number, issue.longitude as number] as [number, number]);
    if (points.length === 1) {
      map.setView(points[0], 14);
    } else if (points.length > 1) {
      map.fitBounds(L.latLngBounds(points), { padding: [28, 28], maxZoom: 14 });
    }
  }, [map, issues, focus]);
  return null;
}

export function IssueMap({
  issues,
  height = 380,
  focus,
  selectedId,
  onSelect,
}: {
  issues: Issue[];
  height?: number;
  focus?: [number, number] | null;
  selectedId?: string | null;
  onSelect?: (issue: Issue) => void;
}) {
  const mapped = issues.filter(
    (issue) =>
      issue.latitude !== null &&
      issue.longitude !== null &&
      Number.isFinite(issue.latitude) &&
      Number.isFinite(issue.longitude),
  );

  if (!mapped.length) {
    return (
      <EmptyState
        icon={MapPinOff}
        title="No mapped locations"
        description="None of the selected complaints have valid coordinates. Location is never invented."
      />
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200" style={{ height }}>
      <MapContainer
        center={focus || [23.233, 77.43]}
        zoom={12}
        style={{ height: '100%', width: '100%' }}
        scrollWheelZoom={false}
        attributionControl
      >
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        />
        <FitBounds issues={mapped} focus={focus} />
        {mapped.map((issue) => (
          <Marker
            key={issue.issueId}
            position={[issue.latitude as number, issue.longitude as number]}
            icon={markerIcon(issue, selectedId === issue.issueId)}
            eventHandlers={{
              click: () => onSelect?.(issue),
            }}
          >
            <Popup>
              <div className="min-w-[190px] space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[10px] font-bold uppercase tracking-wide text-slate-500">
                    {CATEGORY_LABELS[issue.category]}
                  </span>
                  <span className="text-[10px] font-semibold text-slate-400">{issue.issueId}</span>
                </div>
                <p className="text-sm font-semibold leading-5 text-navy-900">{issue.title}</p>
                <div className="flex flex-wrap gap-1">
                  <Badge tone={statusTone(issue.status)}>{STATUS_LABELS[issue.status]}</Badge>
                  <Badge tone={priorityTone(issue.priorityBand)}>Score {issue.priorityScore}</Badge>
                </div>
                <p className="text-[11px] text-slate-500">
                  {issue.locationLabel || 'Location label unavailable'} · {timeAgo(issue.createdAt)}
                </p>
                <Link
                  to={`/issues/${issue.issueId}`}
                  className="inline-block text-xs font-semibold text-teal-700 hover:text-teal-800"
                >
                  Open complaint →
                </Link>
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
}
