import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertTriangle,
  Camera,
  CameraOff,
  Check,
  CheckCircle2,
  ChevronRight,
  Crosshair,
  FilePlus2,
  ImagePlus,
  Info,
  LocateFixed,
  MapPin,
  RefreshCw,
  ScanLine,
  ShieldCheck,
  Sparkles,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import { ApiError, api } from '../api';
import { getCitizenId } from '../lib/utils';
import { useDocumentTitle } from '../lib/hooks';
import { useToast } from '../components/Toast';
import {
  Alert,
  Button,
  Card,
  DemoBadge,
  Field,
  Modal,
  PageHeader,
  SectionHeading,
  TextInput,
  TextareaInput,
  buttonStyles,
} from '../components/ui';
import { CategoryIcon, PriorityBadge, StatusBadge } from '../components/shared';
import { LocationPicker } from '../components/LocationPicker';
import { CATEGORY_LABELS, CATEGORY_OPTIONS, cls, formatDateTime } from '../lib/utils';
import type {
  AIDetectionResult,
  AIServiceStatus,
  Category,
  CreateIssueResult,
} from '../types';

interface FormState {
  category: Category;
  title: string;
  description: string;
  locationLabel: string;
  latitude: number | null;
  longitude: number | null;
  locationConfirmed: boolean;
}

const INITIAL_FORM: FormState = {
  category: 'pothole',
  title: '',
  description: '',
  locationLabel: '',
  latitude: null,
  longitude: null,
  locationConfirmed: false,
};

interface ReportIssueState {
  aiDetected: {
    detected: boolean;
    category: Category | null;
    title: string | null;
    description: string | null;
    confidence: number;
    observations: string[];
    requiresHumanReview: boolean;
  } | null;
  aiError: string | null;
  detecting: boolean;
  addressLoading: boolean;
  showSummary: boolean;
  form: FormState;
  errors: Record<string, string>;
  submitting: boolean;
  formError: string | null;
}

const INITIAL_STATE: ReportIssueState = {
  aiDetected: null,
  aiError: null,
  detecting: false,
  addressLoading: false,
  showSummary: false,
  form: { ...INITIAL_FORM },
  errors: {},
  submitting: false,
  formError: null,
}

function useReportIssue(
  state: ReportIssueState,
  setState: React.Dispatch<React.SetStateAction<ReportIssueState>>,
  toast: any
) {
  const {
    aiDetected,
    aiError,
    detecting,
    addressLoading,
    showSummary,
    form,
    errors,
    submitting,
    formError,
  } = state;

  const fileRef = useRef<HTMLInputElement>(null);
  const selectedFileRef = useRef<File | null>(null);

  const choosePhoto = (file: File | null) => {
  selectedFileRef.current = file;

  setState((s) => ({
    ...s,
    aiDetected: null,
    aiError: null,
    detecting: false,
    showSummary: false,
    form: { ...INITIAL_FORM },
    errors: {},
  }));

  if (!file) return;
    const allowed = ['image/jpeg', 'image/png', 'image/webp'];
    if (!allowed.includes(file.type)) {
      setState((s) => ({ ...s, aiError: 'Only JPEG, PNG or WebP are accepted.' }));
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setState((s) => ({ ...s, aiError: 'Image must be 5 MB or smaller.' }));
      return;
    }
    setState((s) => ({ ...s, detecting: true }));
    useMyLocation();
  };

  const openCamera = async () => {
    setState((s) => ({ ...s, detecting: false }));
    if (!navigator.mediaDevices?.getUserMedia) {
      setState((s) => ({ ...s, aiError: 'Camera not supported.' }));
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
    } catch (error) {
      setState((s) => ({ ...s, aiError: 'Camera unavailable.' }));
    }
  };
  const capturePhoto = () => choosePhoto(null);

  const analysePhoto = async () => {
    setState((s) => ({ ...s, detecting: true, aiError: null }));
    try {
      const form = new FormData();
      const file = selectedFileRef.current;

if (!file) {
  throw new Error('Please select an image first.');
}

form.append('image', file, file.name);
      const result = await api.aiDetect(form);
      // result is AIDetectionResult from the backend
      setState((s) => ({
        ...s,
        aiDetected: {
          detected: result.detected,
          category: result.category ?? null,
          title: result.title ?? null,
          description: result.description ?? null,
          confidence: result.confidence,
          observations: result.observations ?? [],
          requiresHumanReview: result.requiresHumanReview ?? true,
        },
        detecting: false,
        showSummary: true,
      }));
    } catch (error) {
      if (error instanceof ApiError) {
        setState((s) => ({ ...s, detecting: false, aiError: error.message }));
      } else {
        setState((s) => ({ ...s, detecting: false, aiError: 'AI analysis failed.' }));
      }
    }
  };

  const useMyLocation = () => {
    if (!navigator.geolocation) {
      setState((s) => ({ ...s, aiError: 'Geolocation not available.' }));
      setState((s) => ({ ...s, detecting: false }));
      return;
    }
    setState((s) => ({ ...s, addressLoading: true, detecting: false }));
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const lat = Number(position.coords.latitude.toFixed(6));
        const lng = Number(position.coords.longitude.toFixed(6));
        setState((s) => ({ ...s, addressLoading: false }));
        // Removed: setState((s) => ({ ...s, detecting: true }));
        // // toast handled in component
      },
      (error) => {
        setState((s) => ({ ...s, addressLoading: false }));
        setState((s) => ({ ...s, detecting: false }));
        // toast handled in component
      },
      { enableHighAccuracy: true, timeout: 8000 },
    );
  };

  const reverseGeocode = async (lat: number, lng: number) => {
    try {
      const resp = await fetch(`/api/geo/reverse?lat=${lat}&lon=${lng}`, { credentials: 'omit' });
      if (!resp.ok) return;
      const data = await resp.json();
      if (data?.display_name) {
        setState((s) => ({
          ...s,
          form: { ...s.form, locationLabel: data.display_name },
        }));
      }
    } catch {
      // best-effort
    }
  };

  const validateManual = (): boolean => {
    const next: Record<string, string> = {};
    if (!form.title.trim() || form.title.trim().length < 5) next.title = 'Enter a title of at least 5 characters.';
    if (!form.description.trim() || form.description.trim().length < 20) next.description = 'Describe the issue in at least 20 characters.';
    const hasLat = form.latitude !== null && Number.isFinite(form.latitude);
    const hasLng = form.longitude !== null && Number.isFinite(form.longitude);
    if (hasLat !== hasLng) next.latitude = 'Provide both latitude and longitude, or neither.';
    if (hasLat && Math.abs(form.latitude as number) > 90) next.latitude = 'Latitude must be between -90 and 90.';
    if (hasLng && Math.abs(form.longitude as number) > 180) next.longitude = 'Longitude must be between -180 and 180.';
    if (form.locationConfirmed && (!hasLat || !hasLng)) next.locationConfirmed = 'A location cannot be confirmed without valid coordinates.';
    setState((s) => ({ ...s, errors: next }));
    return Object.keys(next).length === 0;
  };

  const performManualSubmit = async () => {
    if (!validateManual()) return;
    setState((s) => ({ ...s, submitting: true, formError: null }));
    const data = new FormData();
    data.set('category', form.category);
    data.set('title', form.title.trim());
    data.set('description', form.description.trim());
    data.set('locationLabel', form.locationLabel.trim());
    data.set('locationConfirmed', String(form.locationConfirmed));
    data.set('submitterId', getCitizenId());
    if (form.latitude !== null) data.set('latitude', String(form.latitude));
    if (form.longitude !== null) data.set('longitude', String(form.longitude));
    try {
      const response = await api.createIssue(data);
      setState((s) => ({ ...s, submitting: false, formError: null }));
      setState((s) => ({ ...s, form: { ...INITIAL_FORM }, errors: {} }));
      toast('Complaint ' + response.issueId + ' created successfully.', 'success');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (error) {
      setState((s) => ({ ...s, submitting: false }));
      if (error instanceof ApiError) {
        setState((s) => ({ ...s, formError: error.message }));
        toast(error.message, 'error');
      } else {
        setState((s) => ({ ...s, formError: (error as Error).message }));
        toast((error as Error).message || 'Could not submit complaint.', 'error');
      }
    }
  };

  const resetForm = () => setState(INITIAL_STATE);

  return {
    choosePhoto,
    analysePhoto,
    useMyLocation,
    reverseGeocode,
    validateManual,
    performManualSubmit,
    resetForm,
    aiDetected,
    aiError,
    detecting,
    addressLoading,
    showSummary,
    form,
    errors,
    submitting,
    formError,
  };
}

/* ──────────────────────────────────────────────────────────────────────
   MAIN COMPONENT
   ────────────────────────────────────────────────────────────────────── */

export default function ReportIssue() {
  const { toast } = useToast();
  const [state, setState] = useState<ReportIssueState>(INITIAL_STATE);
  const {
    choosePhoto,
    analysePhoto,
    useMyLocation,
    reverseGeocode,
    aiDetected,
    aiError,
    detecting,
    addressLoading,
    showSummary,
    form,
    errors,
    submitting,
    formError,
    performManualSubmit,
  } = useReportIssue(state, setState, toast);

  const fileRef = useRef<HTMLInputElement>(null);
  const selectedFileRef = useRef<File | null>(null);

  const updateForm = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setState((s) => ({
      ...s,
      form: { ...s.form, [key]: value },
      errors: { ...s.errors, [key]: '' },
    }));
  };
  const setLocation = (lat: number, lng: number) => {
    setState((s) => ({
      ...s,
      form: { ...s.form, latitude: lat, longitude: lng },
      errors: { ...s.errors, latitude: '', longitude: '' },
    }));
  };
  const clearLocation = () => {
    setState((s) => ({
      ...s,
      form: { ...s.form, latitude: null, longitude: null, locationConfirmed: false },
    }));
  };

  const handleAiSubmit = async () => {
    if (!aiDetected?.detected || !aiDetected?.category) {
      toast('No issue detected by AI. Use manual registration instead.', 'error');
      return;
    }
    const data = new FormData();
    data.set('category', aiDetected.category);
    data.set('title', aiDetected.title || form.title.trim());
    data.set('description', aiDetected.description || form.description.trim());
    data.set('locationLabel', form.locationLabel.trim());
    data.set('locationConfirmed', String(form.locationConfirmed));
    data.set('submitterId', getCitizenId());
    data.set('latitude', String(form.latitude ?? ''));
    data.set('longitude', String(form.longitude ?? ''));
    setState((s) => ({ ...s, submitting: true, formError: null }));
    try {
      const response = await api.createIssue(data);
      setState((s) => ({ ...s, submitting: false }));
      toast('Complaint ' + response.issueId + ' created successfully.', 'success');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (error) {
      setState((s) => ({ ...s, submitting: false }));
      if (error instanceof ApiError) {
        setState((s) => ({ ...s, formError: error.message }));
        toast(error.message, 'error');
      } else {
        setState((s) => ({ ...s, formError: (error as Error).message }));
        toast((error as Error).message || 'Could not submit complaint.', 'error');
      }
    }
  };

  const aiPhotoPreview = selectedFileRef.current
    ? URL.createObjectURL(selectedFileRef.current)
    : undefined;
  useEffect(() => {
    return () => {
      if (aiPhotoPreview) URL.revokeObjectURL(aiPhotoPreview);
    };
  }, [aiPhotoPreview]);

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8 lg:px-8 lg:py-8">
        <PageHeader
        eyebrow="Report an issue"
        title="Put a civic problem on the record"
        description="Choose how you'd like to report: upload a photo for AI analysis, or fill out the form manually."
      />

      {/* ============================================================
         SECTION 1: AI SNAP & REPORT (TOP)
         ============================================================ */}
      <Card className="mt-6 overflow-hidden">
        <div className="border-b border-slate-200 bg-gradient-to-r from-teal-50 via-white to-navy-50 px-4 py-4 sm:px-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0 max-w-2xl">
              <p className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.16em] text-teal-700">
                <Sparkles className="h-3.5 w-3.5" /> Snap & Report
              </p>
              <h2 className="mt-1 text-lg font-bold tracking-tight text-navy-900 sm:text-xl">
                Capture a photo. Detect the problem. Report it instantly.
              </h2>
              <p className="mt-1 text-xs leading-5 text-slate-600">
                The AI analyses your photo and pre-fills the complaint. The photo is stored as normal evidence and all existing checks (duplicates, priority) still run.
              </p>
            </div>
          </div>
        </div>

        <div className="grid gap-4 p-4 sm:p-5 lg:grid-cols-2">
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <Button type="button" icon={Camera} onClick={() => choosePhoto(null)} loading={detecting} disabled={!fileRef.current?.files?.length}>
                Capture photo
              </Button>
              <Button type="button" variant="secondary" icon={Upload} onClick={() => fileRef.current?.click()} disabled={detecting}>
                Upload from gallery
              </Button>
            </div>
            <input
              ref={fileRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="sr-only"
              id="photo"
              onChange={(event) => {
                const file = event.target.files?.[0] || null;
                const allowed = ['image/jpeg', 'image/png', 'image/webp'];
                if (file && !allowed.includes(file.type)) {
                  setState((s) => ({ ...s, aiError: 'Only JPEG, PNG or WebP are accepted.' }));
                  return;
                }
                if (!file || file.size > 5 * 1024 * 1024) {
                  setState((s) => ({ ...s, aiError: 'Image must be 5 MB or smaller.' }));
                  return;
                }
                selectedFileRef.current = file;
                choosePhoto(file);
                toast('Photo selected. Running AI analysis…', 'info');
                window.setTimeout(() => void analysePhoto(), 150);
              }}
            />

            <div
              className={cls(
                'rounded-xl border-2 border-dashed p-3 transition',
                aiError ? 'border-rose-300 bg-rose-50/40' : 'border-slate-300 bg-slate-50/60',
              )}
            >
              {fileRef.current?.files?.[0] ? (
                <div>
                  <img
                    src={aiPhotoPreview}
                    alt="Selected issue preview"
                    className="h-56 w-full rounded-lg object-cover"
                  />
                  <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                    <p className="min-w-0 truncate text-[11px] text-slate-500">
                      {fileRef.current?.files?.[0]?.name} · {Math.round(((fileRef.current?.files?.[0]?.size || 0) / 1024))} KB
                    </p>
                    <div className="flex items-center gap-1">
                      <Button type="button" variant="ghost" size="sm" icon={RefreshCw} disabled={detecting}>
                        Retake
                      </Button>
                      <Button type="button" variant="ghost" size="sm" icon={Trash2} onClick={() => choosePhoto(null)} disabled={detecting}>
                        Remove
                      </Button>
                    </div>
                  </div>
                </div>
              ) : (
                <label
                  htmlFor="photo"
                  className="flex cursor-pointer flex-col items-center justify-center gap-2 py-8 text-center focus-within:ring-2 focus-within:ring-teal-500"
                >
                  <span className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-white shadow-sm ring-1 ring-slate-200">
                    <ImagePlus className="h-5 w-5 text-teal-600" />
                  </span>
                  <span className="text-xs font-semibold text-navy-900">Capture or upload a photo</span>
                  <span className="text-[10px] text-slate-500">JPEG, PNG or WebP · max 5 MB</span>
                </label>
              )}
            </div>
            {aiError && <p className="text-xs text-rose-600">{aiError}</p>}
          </div>

          <div className="space-y-3">
            {detecting && (
              <div className="flex items-center gap-3 rounded-xl border border-teal-200 bg-teal-50/70 px-3 py-3">
                <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-white text-teal-600 shadow-sm">
                  <ScanLine className="h-4 w-4 animate-pulse" />
                </span>
                <div>
                  <p className="text-xs font-semibold text-teal-900">AI is analysing your photo…</p>
                  <p className="text-[10px] text-teal-700">Detecting the civic issue and confidence score.</p>
                </div>
              </div>
            )}

            {aiError && !detecting && (
              <Alert kind="danger" title="AI analysis failed">
                {aiError}
              </Alert>
            )}

            {aiDetected && !detecting && (
              <Card className="p-3">
                <div className="flex items-center justify-between rounded-lg border border-teal-200 bg-teal-50/60 px-2.5 py-2 text-[10px]">
                  <span className="inline-flex items-center gap-1 font-semibold text-teal-900">
                    <Sparkles className="h-3.5 w-3.5" /> AI confidence
                  </span>
                  <span className="font-bold text-teal-900">{Math.round(aiDetected.confidence * 100)}%</span>
                </div>
                <p className="text-[10px] leading-4 text-slate-600">
                  {aiDetected.detected ? 'Detected: ' + (aiDetected.category ? CATEGORY_LABELS[aiDetected.category] : 'Unknown') : 'No issue detected'}
                </p>
                {aiDetected.detected && aiDetected.category && (
                  <div className="mt-2">
                    <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">Pre-filled details</p>
                    <CategoryIcon category={aiDetected.category} size="sm" />
                    <p className="mt-1 truncate text-sm text-navy-900">{aiDetected.title || ''}</p>
                    <p className="mt-1 text-[10px] text-slate-500">
                      {aiDetected.description ? aiDetected.description.slice(0, 200) + (aiDetected.description.length > 200 ? '…' : '') : 'No description'}
                    </p>
                  </div>
                )}
              </Card>
            )}

            {showSummary && !detecting && (
              <Card className="p-3">
                <div className="flex items-center justify-between rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-[10px] font-bold text-emerald-700">
                  <span>Complaint ready for submission</span>
                  <Button variant="secondary" size="sm" onClick={() => setState((s) => ({ ...s, showSummary: false }))}>
                    Edit
                  </Button>
                </div>
                <div className="mt-3 space-y-3">
                  <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">Category</p>
                  <p className="text-sm text-slate-600">{aiDetected?.category ? CATEGORY_LABELS[aiDetected.category] : ''}</p>
                  <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">Title</p>
                  <p className="text-sm text-slate-600">{aiDetected?.title?.trim() || ''}</p>
                  <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">Description</p>
                  <p className="text-sm text-slate-600">{aiDetected?.description?.trim() ? aiDetected.description.trim().slice(0, 200) + (aiDetected.description.length > 200 ? '…' : '') : '—'}</p>
                  <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">Location</p>
                  <p className="text-sm text-slate-600">{form.locationLabel.trim() || 'Not set — pick a point on the map'}</p>
                  <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">Coordinates</p>
                  <p className="text-sm text-slate-600">
                    {form.latitude !== null && form.longitude !== null && Number.isFinite(form.latitude) && Number.isFinite(form.longitude) ? form.latitude.toFixed(5) + ', ' + form.longitude.toFixed(5) : 'Not set'}
                  </p>
                  <div className="mt-4">
                    <Button variant="primary" size="lg" icon={ChevronRight} onClick={handleAiSubmit} disabled={submitting}>
                      SUBMIT COMPLAINT
                    </Button>
                  </div>
                </div>
              </Card>
            )}
          </div>
        </div>
      </Card>

      {/* ============================================================
         SECTION 2: MANUAL COMPLAINT REGISTRATION (BELOW)
         ============================================================ */}
      <div className="mt-8 border-t border-slate-200 pt-8">
        <div className="flex items-center gap-2 mb-6">
          <div className="w-1 h-6 rounded-full bg-teal-500"></div>
          <span className="text-[10px] font-bold uppercase tracking-wide text-teal-600">OR REGISTER MANUALLY</span>
        </div>
        <p className="text-sm text-slate-500 mb-4">
          Prefer to describe the problem yourself? Fill in the complaint details below.
        </p>

        <form onSubmit={performManualSubmit} className="grid gap-5 lg:grid-cols-[1.3fr_0.7fr]" noValidate>
          <div className="space-y-4">
            <Card className="p-4 sm:p-5">
              <SectionHeading eyebrow="1 · Category" title="What kind of issue is it?" />
              <p className="mt-1.5 text-xs leading-5 text-slate-500">
                AI may pre-select a category. You can always correct it below.
              </p>
              <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3" role="radiogroup" aria-label="Issue category">
                {CATEGORY_OPTIONS.map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    role="radio"
                    aria-checked={form.category === value}
                    onClick={() => updateForm('category', value)}
                    className={cls(
                      'flex items-center gap-2.5 rounded-xl border p-2.5 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500',
                      form.category === value
                        ? 'border-teal-500 bg-teal-50/70 ring-1 ring-teal-300'
                        : 'border-slate-200 bg-white hover:border-slate-300',
                    )}
                  >
                    <CategoryIcon category={value} size="sm" />
                    <span className="text-xs font-semibold text-navy-900">{label}</span>
                  </button>
                ))}
              </div>
            </Card>

            <Card className="p-4 sm:p-5">
              <SectionHeading eyebrow="2 · Details" title="Describe the problem" />
              <div className="mt-4 space-y-4">
                <Field label="Issue title" htmlFor="title" required error={errors.title}>
                  <TextInput
                    id="title"
                    value={form.title}
                    maxLength={120}
                    onChange={(event) => updateForm('title', event.target.value)}
                    placeholder="e.g. Deep pothole near the school gate"
                    aria-invalid={Boolean(errors.title)}
                  />
                </Field>
                <Field
                  label="Description"
                  htmlFor="description"
                  required
                  error={errors.description}
                  hint={`${form.description.length}/2000 characters · Include what is affected and any safety risk.`}
                >
                  <TextareaInput
                    id="description"
                    value={form.description}
                    maxLength={2000}
                    onChange={(event) => updateForm('description', event.target.value)}
                    placeholder="What is wrong, how long has it been there, and who is affected?"
                    aria-invalid={Boolean(errors.description)}
                  />
                </Field>
                <Field
                  label="Address or landmark"
                  htmlFor="locationLabel"
                  hint="Auto-filled from reverse geocoding when available. Edit freely."
                >
                  <TextInput
                    id="locationLabel"
                    value={form.locationLabel}
                    maxLength={200}
                    onChange={(event) => updateForm('locationLabel', event.target.value)}
                    placeholder="e.g. Arera Colony, near Vikas School gate, Bhopal"
                  />
                </Field>
              </div>
            </Card>

            <Card className="p-4 sm:p-5">
              <SectionHeading eyebrow="3 · Location" title="Confirm where it is" />
              <p className="mt-1.5 text-xs leading-5 text-slate-500">
                Click the map or use your browser location, then confirm. If coordinates are missing, the
                complaint says "Location not confirmed" — the system never invents GPS.
              </p>
              <div className="mt-3">
                <LocationPicker lat={form.latitude} lng={form.longitude} onChange={setLocation} height={300} />
              </div>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                <Field label="Latitude" htmlFor="lat" error={errors.latitude}>
                  <TextInput
                    id="lat"
                    type="number"
                    step="0.000001"
                    min={-90}
                    max={90}
                    value={form.latitude ?? ''}
                    onChange={(event) =>
                      updateForm('latitude', event.target.value === '' ? null : Number(event.target.value))
                    }
                    placeholder="23.232700"
                  />
                </Field>
                <Field label="Longitude" htmlFor="lng" error={errors.longitude}>
                  <TextInput
                    id="lng"
                    type="number"
                    step="0.000001"
                    min={-180}
                    max={180}
                    value={form.longitude ?? ''}
                    onChange={(event) =>
                      updateForm('longitude', event.target.value === '' ? null : Number(event.target.value))
                    }
                    placeholder="77.434000"
                  />
                </Field>
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  icon={Crosshair}
                  onClick={useMyLocation}
                  loading={detecting}
                >
                  Use my location
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  icon={MapPin}
                  onClick={() => {
                    if (form.latitude !== null && form.longitude !== null) {
                      reverseGeocode(form.latitude, form.longitude);
                    } else {
                      toast('Set a location first.', 'error');
                    }
                  }}
                  loading={addressLoading}
                  disabled={form.latitude === null || form.longitude === null}
                >
                  Look up address
                </Button>
                {(form.latitude !== null || form.longitude !== null) && (
                  <Button type="button" variant="ghost" size="sm" icon={X} onClick={clearLocation}>
                    Clear pin
                  </Button>
                )}
                <span
                  className={cls(
                    'ml-auto inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide',
                    form.latitude !== null && form.longitude !== null && form.locationConfirmed
                      ? 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200'
                      : form.latitude !== null && form.longitude !== null
                        ? 'bg-amber-50 text-amber-800 ring-1 ring-amber-200'
                        : 'bg-slate-100 text-slate-500 ring-1 ring-slate-200',
                  )}
                >
                  <LocateFixed className="h-3 w-3" />
                  {form.latitude !== null && form.longitude !== null && form.locationConfirmed
                    ? 'Location confirmed'
                    : form.latitude !== null && form.longitude !== null
                      ? 'Pin selected — confirm below'
                      : 'Location not confirmed'}
                </span>
              </div>
              {errors.locationConfirmed && <p className="mt-1 text-xs text-rose-600">{errors.locationConfirmed}</p>}
            </Card>

            {formError && (
              <Alert kind="danger" title="Submission failed">
                {formError}
              </Alert>
            )}

            <div className="flex flex-wrap items-center gap-3">
              <Button type="submit" size="lg" icon={ChevronRight}>
                Review & confirm
              </Button>
              <Link to="/dashboard" className={buttonStyles('ghost', 'lg')}>
                Cancel
              </Link>
              <p className="text-[10px] leading-4 text-slate-400">
                Nothing is submitted until you confirm on the next screen.
              </p>
            </div>
          </div>

          <div className="space-y-4">
            <Card className="p-4 sm:p-5">
              <SectionHeading eyebrow="Summary" title="Complaint preview" size="sm" />
              <div className="mt-3 space-y-3">
                <div className="flex h-36 items-center justify-center rounded-lg border border-dashed border-slate-300 bg-slate-50 text-[11px] text-slate-500">
                  No photo yet
                </div>
                <div className="flex items-center gap-2">
                  <CategoryIcon category={form.category} size="sm" />
                  <div className="min-w-0">
                    <p className="truncate text-xs font-semibold text-navy-900">
                      {form.title.trim() || 'Complaint title'}
                    </p>
                    <p className="text-[11px] text-slate-500">{CATEGORY_LABELS[form.category]}</p>
                  </div>
                </div>
                <div className="rounded-lg bg-slate-50 p-2.5 text-[11px] leading-5 text-slate-600">
                  <p className="flex items-center gap-1 font-semibold text-navy-800">
                    <MapPin className="h-3.5 w-3.5 text-teal-600" /> Location
                  </p>
                  <p className="mt-0.5">
                    {form.locationLabel.trim() ||
                      (form.latitude !== null && form.longitude !== null && Number.isFinite(form.latitude) && Number.isFinite(form.longitude) ? form.latitude.toFixed(5) + ', ' + form.longitude.toFixed(5) : 'Not set — pick a point on the map')}
                  </p>
                  {form.latitude !== null && form.longitude !== null && form.locationLabel.trim() && (
                    <p className="mt-0.5 text-[10px] text-slate-400">
                      {Number.isFinite(form.latitude) && Number.isFinite(form.longitude) ? form.latitude.toFixed(5) + ', ' + form.longitude.toFixed(5) : ''}
                    </p>
                  )}
                </div>
                <p className="text-[10px] leading-4 text-slate-400">
                  Severity is calculated by CivicEye's rule-based priority scoring (safety, impact,
                  location, waiting time) at submission.
                </p>
              </div>
            </Card>

            <Card className="p-4">
              <p className="flex items-center gap-1.5 text-xs font-bold text-navy-900">
                <Info className="h-4 w-4 text-teal-600" /> What happens next?
              </p>
              <ol className="mt-2 space-y-2 text-[11px] leading-5 text-slate-600">
                <li>1. You review and confirm the complaint.</li>
                <li>2. A stable complaint ID is generated.</li>
                <li>3. Similar reports are checked using rules (no photo similarity).</li>
                <li>4. A priority score with reasons is stored.</li>
                <li>5. Authority review starts; every change is logged.</li>
              </ol>
              <div className="mt-3 rounded-lg bg-navy-50 p-2.5">
                <p className="text-[10px] font-bold uppercase tracking-wide text-navy-700">Submission time</p>
                <p className="mt-0.5 text-xs font-semibold text-navy-900">{formatDateTime(new Date().toISOString())}</p>
                <p className="mt-0.5 text-[9px] text-navy-500">Server timestamp is recorded at save.</p>
              </div>
            </Card>

            </div>

            <div className="rounded-xl border border-dashed border-slate-300 bg-white p-3 text-[10px] leading-4 text-slate-500">
              <ShieldCheck className="mb-1 h-4 w-4 text-teal-600" />
              Manual submissions are processed through the existing CivicEye API. Duplicate detection
              and priority scoring run server-side after submission.
            </div>
        </form>
      </div>
    </div>
  );
}