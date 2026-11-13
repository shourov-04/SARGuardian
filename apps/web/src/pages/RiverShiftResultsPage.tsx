import { useEffect, useMemo, useRef, useState } from 'react';
import type { User } from 'firebase/auth';
import { importLibrary, setOptions } from '@googlemaps/js-api-loader';
import { downloadRiverShiftArtifact, getRiverShiftJob, listRiverShiftJobs, type RiverShiftJob } from '../api/catalog';
import type { RiverShiftGeoJSON, RiverShiftReport, RiverShiftTimeSeriesFrame } from '../riverShift/manifest';
import { countRiverShiftCandidateLayers, filterRiverShiftCandidateGeoJSON, getRiverShiftOverlapAuditAvailability, isRiverShiftGeoJSONApproved, isRiverShiftReportVerified, isRiverShiftTimeSeriesGeoJSONApproved, limitRiverShiftDisplayGeoJSON, parseRiverShiftGeoJSON, parseRiverShiftReport } from '../riverShift/manifest';
import { parseWktPolygon } from '../riverShift/aoi';
import { Header } from '../components/Header';
import './river-shift.css';

type Props = {
  user: User;
  authState: 'idle' | 'loading' | 'ready' | 'error';
  onSignIn: () => Promise<void>;
  onSignOut: () => Promise<void>;
  onBack: () => void;
};

type LoadedGeoJSON = { fileName: string; sha256: string; data: RiverShiftGeoJSON };
type LoadedJobPreview = { jobId: string; changeLayer: LoadedGeoJSON | null; report: RiverShiftReport | null; error: string };
type LoadedJobFrame = { jobId: string; date: string; data: RiverShiftGeoJSON };

const GOOGLE_MAPS_KEY = (import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string | undefined) || '';
let mapsConfigured = false;

const RIVER_SHIFT_RASTER_SIZE = 1200;

const RIVER_SHIFT_DARK_MAP_STYLES: google.maps.MapTypeStyle[] = [
  { elementType: 'geometry', stylers: [{ color: '#182b38' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#b9d4df' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#182b38' }] },
  { featureType: 'administrative', elementType: 'geometry.stroke', stylers: [{ color: '#3b5a68' }] },
  { featureType: 'poi', elementType: 'geometry', stylers: [{ color: '#203944' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#304957' }] },
  { featureType: 'road', elementType: 'geometry.stroke', stylers: [{ color: '#192c38' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#0b2534' }] },
];

type CoordinatePair = [number, number];
type RasterBounds = { north: number; south: number; east: number; west: number };

function collectRiverShiftCoordinates(value: unknown, output: CoordinatePair[]): void {
  if (!Array.isArray(value)) return;
  if (value.length >= 2 && typeof value[0] === 'number' && typeof value[1] === 'number') {
    if (Number.isFinite(value[0]) && Number.isFinite(value[1])) output.push([value[0], value[1]]);
    return;
  }
  value.forEach((child) => collectRiverShiftCoordinates(child, output));
}

function riverShiftRasterColour(properties?: Record<string, unknown>): string {
  const labels = [properties?.river_shift_layer, properties?.class, properties?.change_class,
    properties?.change_type, properties?.candidate_type]
    .filter((value): value is string => typeof value === 'string')
    .map((value) => value.toLowerCase().replace(/[\s-]+/g, '_')).join('_');
  if (labels.includes('erosion')) return '#f06a6a';
  if (labels.includes('deposition') || labels.includes('accretion')) return '#48c774';
  if (labels.includes('new_water') || labels.includes('newly_water') || labels.includes('water_covered')) return '#4ea8de';
  if (labels.includes('open_water') || labels.includes('water')) return '#73b3df';
  return '#9aafbb';
}

function riverShiftRasterAlpha(properties?: Record<string, unknown>): number {
  return properties?.preview_sparse_marker === true ? 0.98 : 0.5;
}

function drawRiverShiftRasterGeometry(
  context: CanvasRenderingContext2D,
  geometry: RiverShiftGeoJSON['features'][number]['geometry'],
  properties: Record<string, unknown> | undefined,
  project: (pair: CoordinatePair) => [number, number],
): void {
  const colour = riverShiftRasterColour(properties);
  const alpha = riverShiftRasterAlpha(properties);
  const drawPoint = (pair: CoordinatePair, radius = 4) => {
    const [x, y] = project(pair);
    context.beginPath();
    context.arc(x, y, radius, 0, Math.PI * 2);
    context.fillStyle = colour;
    context.globalAlpha = alpha;
    context.fill();
    context.strokeStyle = 'rgba(255, 255, 255, 0.82)';
    context.lineWidth = 0.8;
    context.stroke();
  };
  const drawRing = (ring: unknown, fill: boolean) => {
    if (!Array.isArray(ring)) return;
    const pairs: CoordinatePair[] = [];
    ring.forEach((pair) => {
      if (Array.isArray(pair) && typeof pair[0] === 'number' && typeof pair[1] === 'number') {
        pairs.push([pair[0], pair[1]]);
      }
    });
    if (pairs.length < 2) return;
    context.beginPath();
    pairs.forEach((pair, index) => {
      const [x, y] = project(pair);
      if (index === 0) context.moveTo(x, y); else context.lineTo(x, y);
    });
    context.closePath();
    context.globalAlpha = fill ? alpha * 0.65 : alpha;
    context.fillStyle = colour;
    context.strokeStyle = colour;
    context.lineWidth = 1.2;
    if (fill) context.fill();
    context.stroke();
  };

  context.globalAlpha = 1;
  if (geometry.type === 'Point') {
    const points: CoordinatePair[] = [];
    collectRiverShiftCoordinates(geometry.coordinates, points);
    points.forEach((pair) => drawPoint(pair, 5));
  } else if (geometry.type === 'MultiPoint') {
    const points: CoordinatePair[] = [];
    collectRiverShiftCoordinates(geometry.coordinates, points);
    points.forEach((pair) => drawPoint(pair));
  } else if (geometry.type === 'Polygon') {
    (Array.isArray(geometry.coordinates) ? geometry.coordinates : []).forEach((ring) => drawRing(ring, true));
  } else if (geometry.type === 'MultiPolygon') {
    (Array.isArray(geometry.coordinates) ? geometry.coordinates : []).forEach((polygon) => {
      if (Array.isArray(polygon)) polygon.forEach((ring) => drawRing(ring, true));
    });
  } else if (geometry.type === 'LineString' || geometry.type === 'MultiLineString') {
    const lines = geometry.type === 'LineString' ? [geometry.coordinates] : geometry.coordinates;
    (Array.isArray(lines) ? lines : []).forEach((line) => drawRing(line, false));
  }
  context.globalAlpha = 1;
}

function renderRiverShiftRaster(layers: RiverShiftGeoJSON[]): {
  url: string;
  bounds: RasterBounds;
} | null {
  const coordinates: CoordinatePair[] = [];
  layers.forEach((layer) => layer.features.forEach((feature) => collectRiverShiftCoordinates(feature.geometry.coordinates, coordinates)));
  if (!coordinates.length) return null;
  const west = Math.min(...coordinates.map(([longitude]) => longitude));
  const east = Math.max(...coordinates.map(([longitude]) => longitude));
  const south = Math.min(...coordinates.map(([, latitude]) => latitude));
  const north = Math.max(...coordinates.map(([, latitude]) => latitude));
  const longitudeSpan = Math.max(east - west, 0.000001);
  const latitudeSpan = Math.max(north - south, 0.000001);
  const rasterScale = RIVER_SHIFT_RASTER_SIZE / Math.max(longitudeSpan, latitudeSpan);
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.ceil(longitudeSpan * rasterScale));
  canvas.height = Math.max(1, Math.ceil(latitudeSpan * rasterScale));
  const context = canvas.getContext('2d');
  if (!context) return null;
  const project = ([longitude, latitude]: CoordinatePair): [number, number] => [
    ((longitude - west) / longitudeSpan) * canvas.width,
    ((north - latitude) / latitudeSpan) * canvas.height,
  ];
  layers.forEach((layer) => layer.features.forEach((feature) => {
    drawRiverShiftRasterGeometry(context, feature.geometry, feature.properties, project);
  }));
  return {
    url: canvas.toDataURL('image/png'),
    bounds: { north, south, east, west },
  };
}

function metricLabel(key: string): string {
  const names: Record<string, string> = {
    baseline_water_area_km2: 'Baseline water area',
    event_proximal_water_area_km2: 'Event-proximal observed water area',
    comparison_one_water_area_km2: 'Comparison one water area',
    comparison_two_water_area_km2: 'Comparison two water area',
    peak_water_area_km2: 'Legacy peak-water field (not confirmed peak stage)',
    f1_score: 'F1 score vs independent reference',
    intersection_over_union: 'IoU vs independent reference',
    reference_comparison_water_area_km2: 'Water area on common validation footprint',
    independent_reference_water_area_km2: 'Independent reference water area',
    true_positive_area_km2: 'True positive water area',
    false_positive_area_km2: 'False positive water area',
    false_negative_area_km2: 'False negative water area',
    water_area_km2: 'Observed water area',
    valid_pixel_fraction: 'Valid pixel fraction',
    candidate_erosion_area_km2: 'Erosion candidate area',
    candidate_deposition_area_km2: 'Deposition candidate area',
    candidate_new_water_area_km2: 'New-water candidate area',
    erosion_area_km2: 'Erosion candidate area',
    deposition_area_km2: 'Deposition candidate area',
    new_water_area_km2: 'New-water candidate area',
    candidate_water_area_km2: 'Observed candidate water area',
    observation_count: 'Observation count',
    distinct_acquisition_dates_count: 'Acquisition date count',
    candidate_polygon_count: 'Candidate polygon count',
    sparse_candidate_marker_count: 'Sparse candidate marker count',
    transect_count: 'Transect count',
    mean_raw_movement_m: 'Mean raw movement (unverified)',
  };
  return names[key] || key.replace(/_/g, ' ');
}

function metricUnit(key: string): string {
  if (key.includes('fraction') || key.includes('score') || key.includes('ratio') || key.includes('intersection_over_union')) return '';
  if (key.includes('area_km2')) return 'km²';
  if (key.includes('count')) return '';
  if (key.includes('_m')) return 'm';
  return '';
}

function metricText(key: string, value: unknown): string {
  if (typeof value !== 'number' || !Number.isFinite(value)) return 'Not measured';
  if (key.includes('fraction') || key.includes('score') || key.includes('intersection_over_union')) return value.toFixed(3);
  if (key.includes('area_km2')) return value.toFixed(2);
  if (key.includes('count')) return String(Math.round(value));
  return value.toFixed(2);
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function overlapNumber(record: Record<string, unknown> | null, key: string): number | null {
  const value = record?.[key];
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function overlapText(value: number | null, digits = 3): string {
  return value === null ? 'Not available' : value.toFixed(digits);
}

function OverlapAuditPanel({ summary }: { summary: Record<string, unknown> }) {
  const sourceAudit = asRecord(summary.candidate_overlap_audit);
  const sourcePairs = asRecord(sourceAudit?.pairwise);
  const previewAudit = asRecord(summary.preview_geometry_overlap);
  const previewPairs = asRecord(previewAudit?.pairwise);
  const availability = getRiverShiftOverlapAuditAvailability(summary);
  if (!availability.sourceMask || !availability.previewGeometry || !sourcePairs || !previewPairs) {
    return (
      <section className="rs-overlap-audit" aria-label="RiverShift candidate overlap audit">
        <div className="rs-section-heading">
          <div><p className="rs-kicker">SPATIAL QA</p><h3>Overlap audit not fully recorded</h3></div>
          <span className="rs-chip">NOT MEASURED · NOT ZERO</span>
        </div>
        <p className="rs-muted">
          Full-resolution source-mask diagnostic: {availability.sourceMask ? 'available' : 'not recorded'}.
          {' '}Display-preview diagnostic: {availability.previewGeometry ? 'available' : 'not recorded'}.
          {' '}Missing diagnostics are not zero-overlap results. Run a new RiverShift job on the current worker to produce both reports.
        </p>
      </section>
    );
  }

  const rows = [
    { key: 'erosion__deposition', label: 'Erosion ↔ Deposition' },
    { key: 'erosion__new_water', label: 'Erosion ↔ New water' },
    { key: 'deposition__new_water', label: 'Deposition ↔ New water' },
  ];

  return (
    <section className="rs-overlap-audit" aria-label="RiverShift candidate overlap audit">
      <div className="rs-section-heading">
        <div><p className="rs-kicker">SPATIAL QA</p><h3>Candidate overlap audit</h3></div>
        <span className="rs-chip">DIAGNOSTIC · NOT ACCURACY</span>
      </div>
      <p className="rs-muted">
        Full-resolution source masks are compared separately from majority-occupancy preview polygons.
        Sparse sub-cell candidates are rendered as small MultiPoint markers and excluded from preview area/Jaccard.
        Neither preview geometry type is a measurement; source masks remain authoritative.
      </p>
      <div className="rs-overlap-table-wrap">
        <table className="rs-table rs-overlap-table">
          <thead>
            <tr>
              <th>Class pair</th>
              <th>Source-mask intersection</th>
              <th>Preview polygon intersection</th>
              <th>Source Jaccard</th>
              <th>Preview polygon Jaccard</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const source = asRecord(sourcePairs[row.key]);
              const preview = asRecord(previewPairs[row.key]);
              return (
                <tr key={row.key}>
                  <td>{row.label}</td>
                  <td>{overlapNumber(source, 'intersection_pixels')?.toLocaleString() ?? 'Not available'} px</td>
                  <td>{overlapText(overlapNumber(preview, 'intersection_area_km2'))} km²</td>
                  <td>{overlapText(overlapNumber(source, 'jaccard'))}</td>
                  <td>{overlapText(overlapNumber(preview, 'jaccard'))}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="rs-overlay-note">
        Erosion and deposition source masks must be disjoint on common valid pixels. New-water may legitimately
        intersect a morphology class because it is derived from a different date comparison. Review the selected
        dates before interpreting any intersection as a physical contradiction.
      </p>
    </section>
  );
}

function ReportPanel({ report }: { report: RiverShiftReport }) {
  const verified = isRiverShiftReportVerified(report);
  const verification = report.quality.verification;
  const verificationRecord = verification && typeof verification === 'object'
    ? verification as Record<string, unknown>
    : null;
  const warnings = report.quality.warnings || [];
  const title = report.analysis_type === 'river_change_scan'
    ? 'General river change scan'
    : report.analysis_type === 'flood_inundation_screening'
    ? 'Flood inundation screening'
    : report.analysis_type === 'river_morphology_screening'
      ? 'River morphology screening'
      : report.analysis_type === 'water_timeseries_screening'
        ? 'Observed-date water time series'
      : report.analysis_type === 'classification_validation'
        ? 'Classification validation'
        : 'Bankline migration measurement';
  const source = report.source;
  return (
    <section className="rs-panel">
      <div className="rs-section-heading">
        <div><p className="rs-kicker">RIVER SHIFT SCIENTIFIC RESULT</p><h2>{title}</h2></div>
      </div>
      <div className="rs-metric-grid">
        {Object.entries(report.metrics).map(([key, value]) => (
          <article className="rs-metric" key={key}>
            <span>{metricLabel(key)}</span>
            <strong>{metricText(key, value)} <small>{metricUnit(key)}</small></strong>
          </article>
        ))}
      </div>
      {verified && verificationRecord && (
        <div className="rs-reference">
          Review record: <strong>{String(verificationRecord.reviewer_id)}</strong>
          <span>{String(verificationRecord.reviewed_at_utc)}</span>
          <p>Evidence: {String(verificationRecord.evidence_reference)}</p>
        </div>
      )}
      {report.reference && (
        <div className="rs-reference">
          Reference: <strong>{String(report.reference.source || 'Not stated')}</strong>
          <span>{String(report.reference.date || 'Date not stated')}</span>
          <p>{String(report.reference.method || 'Reference method not stated')}</p>
        </div>
      )}
      {warnings.length > 0 && (
        <div className="rs-warning-list">
          <strong>Scientific interpretation and limitations</strong>
          {warnings.map((warning, index) => <p key={index}>• {warning}</p>)}
        </div>
      )}
    </section>
  );
}

function ScientificReadinessPanel({
  summary,
  report,
  jobState,
  artifactCount,
}: {
  summary: Record<string, unknown>;
  report: RiverShiftReport | null;
  jobState: string;
  artifactCount: number;
}) {
  const sourceAudit = asRecord(summary.candidate_overlap_audit);
  const previewAudit = asRecord(summary.preview_geometry_overlap);
  const sourceRecorded = Boolean(sourceAudit && asRecord(sourceAudit.pairwise));
  const previewRecorded = Boolean(previewAudit && asRecord(previewAudit.pairwise));
  const metrics = report?.metrics || {};
  const hasIndependentWaterMetrics = report?.analysis_type === 'classification_validation'
    && typeof metrics.f1_score === 'number'
    && typeof metrics.intersection_over_union === 'number';
  const verified = Boolean(report && isRiverShiftReportVerified(report));
  const releaseStatus = verified ? 'VERIFIED · REVIEW RECORD PRESENT' : 'PROVISIONAL · REVIEW REQUIRED';
  const rows = [
    {
      label: 'Processing and retained result receipts',
      status: jobState === 'succeeded' && artifactCount > 0 ? 'PASS' : 'PENDING',
      detail: artifactCount.toLocaleString() + ' retained artifact receipt(s)',
    },
    {
      label: 'Full-resolution source-mask overlap',
      status: sourceRecorded ? String(sourceAudit?.status || 'RECORDED') : 'NOT MEASURED',
      detail: 'Spatial consistency diagnostic; not accuracy validation.',
    },
    {
      label: 'Preview geometry overlap',
      status: previewRecorded ? 'DISPLAY QA RECORDED' : 'NOT MEASURED',
      detail: 'Display-only polygons; never use for area or accuracy.',
    },
    {
      label: 'Independent water-reference agreement',
      status: hasIndependentWaterMetrics ? 'METRICS AVAILABLE · REVIEW REQUIRED' : 'NO_SCORE',
      detail: hasIndependentWaterMetrics
        ? 'F1 and IoU are present; the reference source and interpretation still require review.'
        : 'No eligible reference metrics are attached to this result.',
    },
    {
      label: 'Signed bankline migration',
      status: report?.analysis_type === 'bankline_migration' ? 'SEPARATE REPORT ONLY' : 'NOT MEASURED',
      detail: 'Requires independently digitised dated banklines and oriented transects.',
    },
  ];
  return (
    <section className="rs-readiness-panel" aria-label="Scientific validation readiness">
      <div className="rs-section-heading">
        <div><p className="rs-kicker">VALIDATION READINESS</p><h3>What has passed — and what has not</h3></div>
        <span className="rs-chip">{releaseStatus}</span>
      </div>
      <div className="rs-readiness-list">
        {rows.map((row) => (
          <div className="rs-readiness-row" key={row.label}>
            <div><strong>{row.label}</strong><small>{row.detail}</small></div>
            <span className={row.status === 'PASS' || row.status === 'DISPLAY QA RECORDED' || row.status === 'METRICS AVAILABLE · REVIEW REQUIRED' ? 'rs-readiness-status rs-status-recorded' : 'rs-readiness-status rs-status-pending'}>{row.status}</span>
          </div>
        ))}
      </div>
      <p className="rs-overlay-note">A processing PASS and an overlap-audit PASS do not establish physical change or model accuracy. VERIFIED requires an eligible independent reference, complete provenance and a signed review record.</p>
    </section>
  );
}

export function RiverShiftResultsPage({ user, authState, onSignIn, onSignOut, onBack }: Props) {
  const [riverJob, setRiverJob] = useState<RiverShiftJob | null>(null);
  const [jobLoading, setJobLoading] = useState(true);
  const [jobError, setJobError] = useState('');
  const [report, setReport] = useState<RiverShiftReport | null>(null);
  const [geoJSONFiles, setGeoJSONFiles] = useState<LoadedGeoJSON[]>([]);
  const [mapError, setMapError] = useState('');
  const [mapReady, setMapReady] = useState(false);

  const [timeSeriesIndex, setTimeSeriesIndex] = useState(0);
  const [timeSeriesPlaying, setTimeSeriesPlaying] = useState(false);
  const [jobPreview, setJobPreview] = useState<LoadedJobPreview | null>(null);
  const [jobFrame, setJobFrame] = useState<LoadedJobFrame | null>(null);
  const [jobTimeSeriesIndex, setJobTimeSeriesIndex] = useState(0);
  const [jobTimeSeriesPlaying, setJobTimeSeriesPlaying] = useState(false);
  const [showErosionOverlay, setShowErosionOverlay] = useState(true);
  const [showDepositionOverlay, setShowDepositionOverlay] = useState(true);
  const [showNewWaterOverlay, setShowNewWaterOverlay] = useState(true);
  const [showObservedWaterExtent, setShowObservedWaterExtent] = useState(true);
  const [mapDarkMode, setMapDarkMode] = useState(false);
  const [mapLabelsVisible, setMapLabelsVisible] = useState(false);
  const [mapType, setMapType] = useState('satellite');


  const resultMapElement = useRef<HTMLDivElement>(null);
  const resultMapInstance = useRef<google.maps.Map | null>(null);
  const resultMapFitKey = useRef('');
  const resultAoiPolygon = useRef<google.maps.Polygon | null>(null);
  const resultRasterOverlay = useRef<google.maps.GroundOverlay | null>(null);

  // Restore or load the latest job
  useEffect(() => {
    let cancelled = false;
    const fetchJob = async () => {
      setJobLoading(true);
      setJobError('');
      try {
        const savedJobId = window.sessionStorage.getItem('sarguardian.riverShiftActiveJobId');
        if (savedJobId) {
          try {
            const job = await getRiverShiftJob(savedJobId, user);
            if (!cancelled) {
              setRiverJob(job);
              setJobLoading(false);
              return;
            }
          } catch {
            // fallback to list
          }
        }
        const jobs = await listRiverShiftJobs(user, 10);
        if (!cancelled) {
          const succeeded = jobs.find((j) => j.state === 'succeeded');
          setRiverJob(succeeded || jobs[0] || null);
          setJobLoading(false);
        }
      } catch (err) {
        if (!cancelled) {
          setJobError(err instanceof Error ? err.message : 'Failed to load River Shift job.');
          setJobLoading(false);
        }
      }
    };
    void fetchJob();
    return () => { cancelled = true; };
  }, [user]);

  const timeSeriesFrames = useMemo(() => (report?.time_series || []).flatMap((frame: RiverShiftTimeSeriesFrame) => {
    const loaded = geoJSONFiles.find((file) => file.fileName === frame.water_geojson
      && file.sha256.toLowerCase() === frame.water_geojson_sha256.toLowerCase());
    return loaded && isRiverShiftTimeSeriesGeoJSONApproved(report!, frame.date, loaded.sha256)
      ? [{ ...frame, data: loaded.data }]
      : [];
  }), [report, geoJSONFiles]);

  const playbackFrames = report?.analysis_type === 'water_timeseries_screening'
    && report.time_series?.length === timeSeriesFrames.length ? timeSeriesFrames : [];
  const currentTimeSeriesFrame = playbackFrames[timeSeriesIndex];

  const jobTimeSeriesFrames: RiverShiftTimeSeriesFrame[] = jobPreview && riverJob && jobPreview.jobId === riverJob.id
    && jobPreview.report?.analysis_type === 'water_timeseries_screening'
    ? jobPreview.report.time_series || [] : [];
  const currentJobFrameMetadata = jobTimeSeriesFrames[jobTimeSeriesIndex];
  const riverJobId = riverJob?.id;
  const riverJobArtifactManifest = riverJob?.artifact_manifest;
  const currentJobFrameDate = currentJobFrameMetadata?.date;
  const currentJobFrameGeoJSON = currentJobFrameMetadata?.water_geojson;
  const currentJobFrameSHA256 = currentJobFrameMetadata?.water_geojson_sha256;
  const jobFrameJobId = jobFrame?.jobId;
  const jobFrameDate = jobFrame?.date;
  const currentJobFrame = currentJobFrameMetadata && riverJobId && jobFrame && jobFrame.jobId === riverJobId
    && jobFrame.date === currentJobFrameMetadata.date ? jobFrame.data : null;
  const hasJobPreviewOverlay = Boolean(jobPreview && riverJobId && jobPreview.jobId === riverJobId
    && (jobPreview.changeLayer || currentJobFrame));
  const activeJobPreview = jobPreview && riverJobId && jobPreview.jobId === riverJobId ? jobPreview : null;
  const isGeneralScanJob = Boolean(riverJob?.state === 'succeeded' && riverJob.analysis_mode === 'general_scan');

  const hasLiveJobResult = Boolean(riverJob?.state === 'succeeded' && activeJobPreview
    && (activeJobPreview.report || activeJobPreview.changeLayer));
  const hasLiveJobResultPending = Boolean(riverJob?.state === 'succeeded' && riverJobArtifactManifest?.length
    && !hasLiveJobResult);
  const explorerReport = report ?? activeJobPreview?.report ?? null;

  const verifiedGeoJSONFiles = useMemo(() => {
    if (!report || report.analysis_type === 'water_timeseries_screening') return [];
    return geoJSONFiles.filter((file) => isRiverShiftGeoJSONApproved(report, file.sha256));
  }, [report, geoJSONFiles]);

  const candidateOverlayVisibility = useMemo(() => ({
    erosion: showErosionOverlay,
    deposition: showDepositionOverlay,
    newWater: showNewWaterOverlay,
    observedWater: showObservedWaterExtent,
  }), [showErosionOverlay, showDepositionOverlay, showNewWaterOverlay, showObservedWaterExtent]);

  const candidateOverlayCounts = useMemo(() => {
    const sources = activeJobPreview?.changeLayer
      ? [activeJobPreview.changeLayer.data]
      : verifiedGeoJSONFiles.map((file) => file.data);
    return sources.reduce((total, source) => {
      const counts = countRiverShiftCandidateLayers(source);
      return {
        erosion: total.erosion + counts.erosion,
        deposition: total.deposition + counts.deposition,
        newWater: total.newWater + counts.newWater,
        observedWater: total.observedWater + counts.observedWater,
        unclassified: total.unclassified + counts.unclassified,
      };
    }, { erosion: 0, deposition: 0, newWater: 0, observedWater: 0, unclassified: 0 });
  }, [activeJobPreview?.changeLayer, verifiedGeoJSONFiles]);

  const hasCandidateOverlaySource = Boolean(activeJobPreview?.changeLayer || verifiedGeoJSONFiles.length);
  const allCandidateLayersVisible = showErosionOverlay && showDepositionOverlay && showNewWaterOverlay;
  const hasObservedWaterFrames = Boolean(
    (report?.analysis_type === 'water_timeseries_screening' && playbackFrames.length > 0)
    || (jobPreview?.report?.analysis_type === 'water_timeseries_screening' && jobTimeSeriesFrames.length > 0),
  );
  const hasVerifiedOverlay = verifiedGeoJSONFiles.length > 0;

  useEffect(() => {
    if (!user || riverJob?.state !== 'succeeded' || !riverJob.artifact_manifest?.length) {
      setJobPreview(null);
      setJobFrame(null);
      setJobTimeSeriesIndex(0);
      setJobTimeSeriesPlaying(false);
      return undefined;
    }
    let cancelled = false;
    const loadPreview = async () => {
      const artifacts = riverJob.artifact_manifest || [];
      let changeLayer: LoadedGeoJSON | null = null;
      let timeseriesReport: RiverShiftReport | null = null;
      let failure = '';
      const changeIndex = artifacts.findIndex((item) => item.name === 'river_change_candidates_preview.geojson' && item.bytes <= 4_000_000);
      const reportIndex = artifacts.findIndex((item) => item.name === 'river_shift_timeseries_preview.json' && item.bytes <= 4_000_000);
      if (changeIndex >= 0) {
        try {
          const artifact = artifacts[changeIndex];
          const blob = await downloadRiverShiftArtifact(riverJob.id, changeIndex, user);
          const bytes = await blob.arrayBuffer();
          const digest = await crypto.subtle.digest('SHA-256', bytes);
          const sha256 = Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
          if (sha256.toLowerCase() !== artifact.sha256.toLowerCase()) throw new Error('Map preview checksum did not match its private result receipt.');
          changeLayer = {
            fileName: artifact.name,
            sha256,
            data: parseRiverShiftGeoJSON(JSON.parse(new TextDecoder().decode(bytes)) as unknown),
          };
        } catch (error) {
          failure = error instanceof Error ? error.message : 'Could not load the provisional map preview.';
        }
      }
      if (reportIndex >= 0) {
        try {
          const artifact = artifacts[reportIndex];
          const blob = await downloadRiverShiftArtifact(riverJob.id, reportIndex, user);
          const bytes = await blob.arrayBuffer();
          const digest = await crypto.subtle.digest('SHA-256', bytes);
          const sha256 = Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
          if (sha256.toLowerCase() !== artifact.sha256.toLowerCase()) throw new Error('Preview report checksum did not match its private result receipt.');
          timeseriesReport = parseRiverShiftReport(JSON.parse(new TextDecoder().decode(bytes)) as unknown);
        } catch (error) {
          if (!failure) failure = error instanceof Error ? error.message : 'Could not load the preview timeseries report.';
        }
      }
      if (!cancelled) {
        setJobPreview({
          jobId: riverJob.id,
          changeLayer,
          report: timeseriesReport,
          error: failure,
        });
      }
    };
    void loadPreview();
    return () => { cancelled = true; };
  }, [riverJob, user]);

  useEffect(() => {
    if (!riverJobId || !riverJobArtifactManifest?.length || !user || !currentJobFrameDate) {
      setJobFrame(null);
      return undefined;
    }
    if (jobFrameJobId === riverJobId && jobFrameDate === currentJobFrameDate) return undefined;
    let cancelled = false;
    const loadFrame = async () => {
      const artifacts = riverJobArtifactManifest || [];
      const frameName = currentJobFrameGeoJSON || `water_${currentJobFrameDate}_preview.geojson`;
      const frameIndex = artifacts.findIndex((item) => item.name === frameName && item.bytes <= 4_000_000);
      if (frameIndex < 0) return;
      try {
        const artifact = artifacts[frameIndex];
        const blob = await downloadRiverShiftArtifact(riverJobId, frameIndex, user);
        const bytes = await blob.arrayBuffer();
        const digest = await crypto.subtle.digest('SHA-256', bytes);
        const sha256 = Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
        if (currentJobFrameSHA256 && sha256.toLowerCase() !== currentJobFrameSHA256.toLowerCase()) {
          throw new Error('Observed-date preview checksum mismatch.');
        }
        const data = parseRiverShiftGeoJSON(JSON.parse(new TextDecoder().decode(bytes)) as unknown);
        if (!cancelled) setJobFrame({ jobId: riverJobId, date: currentJobFrameDate, data });
      } catch (error) {
        if (!cancelled) {
          setJobTimeSeriesPlaying(false);
          setJobPreview((current) => current?.jobId === riverJobId
            ? { ...current, error: error instanceof Error ? error.message : 'Could not load this observed-date preview.' }
            : current);
        }
      }
    };
    void loadFrame();
    return () => { cancelled = true; };
  }, [riverJobId, riverJobArtifactManifest, user, currentJobFrameDate, currentJobFrameGeoJSON, currentJobFrameSHA256, jobFrameJobId, jobFrameDate]);

  /*
  const fetchOpenStreetMapImpactContext = async () => {
    setImpactFetchError('');
    setImpactFetchNotice('');
    const studyArea = riverJob?.aoi_wkt;
    if (!studyArea?.trim() || !impactCandidateLayers.length) {
      setImpactFetchError('A completed result and its study-area polygon are required before exposure screening.');
      return;
    }
    let coordinates: Wgs84Point[];
    try {
      coordinates = parseWktPolygon(studyArea);
    } catch (error) {
      setImpactFetchError(error instanceof Error ? error.message : 'The stored AOI could not be read.');
      return;
    }
    if (coordinates.length > 121) {
      setImpactFetchError('This one-off OpenStreetMap query is limited to AOIs with 120 or fewer boundary vertices. Use a simplified study-area polygon.');
      return;
    }
    const polygon = coordinates.slice(0, -1)
      .map(([longitude, latitude]) => latitude + ' ' + longitude)
      .join(' ');
    const query = '[out:json][timeout:25];(nwr["building"](poly:"' + polygon + '");'
      + 'nwr["amenity"~"school|hospital|clinic|university|college|fire_station|police|shelter|place_of_worship"](poly:"'
      + polygon + '"););out center tags 5000;';
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), 35000);
    setImpactFetchBusy(true);
    try {
      const response = await fetch('https://overpass-api.de/api/interpreter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' },
        body: new URLSearchParams({ data: query }),
        signal: controller.signal,
      });
      if (!response.ok) {
        throw new Error(response.status === 429 || response.status === 504
          ? 'The shared OpenStreetMap query service is busy or rate-limited. Wait before trying again, or import an attributed GeoJSON instead.'
          : 'OpenStreetMap query failed (' + response.status + ').');
      }
      const result = parseOpenStreetMapImpactResponse(await response.json() as unknown);
      setImpactExposure({ fileName: 'OpenStreetMap · ' + result.data.features.length + ' features', data: result.data });
      setImpactSourceName('OpenStreetMap buildings and public facilities · Overpass API');
      setImpactSourceUrl('https://www.openstreetmap.org/copyright');
      setImpactSourceVintage(result.snapshotTimestamp
        ? 'OSM snapshot ' + result.snapshotTimestamp
        : 'retrieved ' + new Date().toISOString());
      setImpactValueField('');
      setImpactFetchNotice(result.cappedAtFeatureLimit
        ? 'The query reached its 5,000-element cap. This is a partial OSM context screen and may omit additional mapped features.'
        : 'One AOI-bounded read-only query completed. OpenStreetMap coverage varies; unmapped buildings and facilities are not counted.');
    } catch (error) {
      setImpactFetchError(error instanceof Error
        ? error.name === 'AbortError'
          ? 'OpenStreetMap did not respond within 35 seconds. No exposure count was generated.'
          : error.message
        : 'Could not retrieve OpenStreetMap impact context.');
    } finally {
      window.clearTimeout(timeoutId);
      setImpactFetchBusy(false);
    }
  };
  */

  useEffect(() => {
    if (!GOOGLE_MAPS_KEY) {
      setMapError('Google Maps API key is not configured.');
      return;
    }
    let cancelled = false;
    if (!mapsConfigured) {
      setOptions({ key: GOOGLE_MAPS_KEY, v: 'weekly' });
      mapsConfigured = true;
    }
    importLibrary('maps').then((mapsLibrary) => {
      if (cancelled) return;
      const maps = mapsLibrary as google.maps.MapsLibrary;
      const mapOptions: google.maps.MapOptions = {
        center: { lat: 15, lng: 0 },
        zoom: 2,
        mapTypeId: 'satellite',
        streetViewControl: false,
        mapTypeControl: true,
        mapTypeControlOptions: {
          style: google.maps.MapTypeControlStyle.HORIZONTAL_BAR,
          mapTypeIds: ['roadmap', 'terrain', 'satellite'],
        },
        fullscreenControl: true,
        gestureHandling: 'greedy',
      };
      if (resultMapElement.current && !resultMapInstance.current) {
        resultMapInstance.current = new maps.Map(resultMapElement.current, mapOptions);
        setMapReady(true);
      }
    }).catch((error: unknown) => {
      if (!cancelled) setMapError(error instanceof Error ? error.message : 'Google Maps could not be loaded.');
    });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!mapReady) return;
    const map = resultMapInstance.current;
    if (!map) return;
    const syncMapType = () => {
      const nextType = String(map.getMapTypeId() || 'satellite');
      setMapType(nextType);
      if (nextType === 'satellite') setMapLabelsVisible(false);
      if (nextType === 'hybrid') setMapLabelsVisible(true);
    };
    syncMapType();
    const listener = map.addListener('maptypeid_changed', syncMapType);
    return () => listener.remove();
  }, [mapReady]);

  useEffect(() => {
    if (!mapReady) return;
    const map = resultMapInstance.current;
    if (!map) return;
    const isImagery = mapType === 'satellite' || mapType === 'hybrid';
    const styles = mapDarkMode ? [...RIVER_SHIFT_DARK_MAP_STYLES] : [];
    if (!mapLabelsVisible) styles.push({ elementType: 'labels', stylers: [{ visibility: 'off' }] });
    map.setOptions({ styles: isImagery ? null : styles });
  }, [mapReady, mapDarkMode, mapLabelsVisible, mapType]);

  useEffect(() => {
    if (!mapReady) return;
    const map = resultMapInstance.current;
    if (!map) return;
    if (resultAoiPolygon.current) resultAoiPolygon.current.setMap(null);
    resultAoiPolygon.current = null;
    if (isGeneralScanJob && riverJob?.aoi_wkt) {
      try {
        const aoiPoints = parseWktPolygon(riverJob.aoi_wkt).slice(0, -1);
        resultAoiPolygon.current = new google.maps.Polygon({
          paths: aoiPoints.map(([lng, lat]) => ({ lng, lat })),
          strokeColor: '#70eee0',
          strokeOpacity: 0.98,
          strokeWeight: 3,
          fillOpacity: 0,
          clickable: false,
          zIndex: 1000,
        });
        resultAoiPolygon.current.setMap(map);
      } catch {
        resultAoiPolygon.current = null;
      }
    }
  }, [mapReady, isGeneralScanJob, riverJob?.id, riverJob?.aoi_wkt]);

  useEffect(() => {
    if (!mapReady) return;
    const map = resultMapInstance.current;
    if (!map) return;
    resultRasterOverlay.current?.setMap(null);
    resultRasterOverlay.current = null;
    const displayLayers = hasJobPreviewOverlay && jobPreview && riverJobId && jobPreview.jobId === riverJobId
      ? [
        jobPreview.changeLayer
          ? filterRiverShiftCandidateGeoJSON(jobPreview.changeLayer.data, candidateOverlayVisibility)
          : null,
        showObservedWaterExtent ? currentJobFrame : null,
      ].filter((layer): layer is RiverShiftGeoJSON => Boolean(layer && layer.features.length))
      : currentTimeSeriesFrame
        ? (showObservedWaterExtent ? [currentTimeSeriesFrame.data] : [])
        : verifiedGeoJSONFiles.map((file) => filterRiverShiftCandidateGeoJSON(file.data, candidateOverlayVisibility));
    const rasterLayers = displayLayers.map((layer) => limitRiverShiftDisplayGeoJSON(layer));
    const raster = renderRiverShiftRaster(rasterLayers);
    const bounds = new google.maps.LatLngBounds();
    if (raster) {
      resultRasterOverlay.current = new google.maps.GroundOverlay(raster.url, raster.bounds, {
        clickable: false,
        opacity: 1,
      });
      resultRasterOverlay.current.setMap(map);
      bounds.extend({ lat: raster.bounds.south, lng: raster.bounds.west });
      bounds.extend({ lat: raster.bounds.north, lng: raster.bounds.east });
    }
    if (isGeneralScanJob && riverJob?.aoi_wkt) {
      try {
        parseWktPolygon(riverJob.aoi_wkt).slice(0, -1)
          .forEach(([longitude, latitude]) => bounds.extend({ lng: longitude, lat: latitude }));
      } catch {
        // ignore
      }
    }
    const overlayFitKey = hasJobPreviewOverlay && riverJobId
      ? `job:${riverJobId}`
      : `report:${report?.analysis_type || 'none'}:${verifiedGeoJSONFiles.map((file) => file.sha256).join(',')}`;
    if (!bounds.isEmpty() && resultMapFitKey.current !== overlayFitKey) {
      map.fitBounds(bounds);
      resultMapFitKey.current = overlayFitKey;
    }
    return () => {
      resultRasterOverlay.current?.setMap(null);
      resultRasterOverlay.current = null;
    };
  }, [
    mapReady,
    hasJobPreviewOverlay,
    jobPreview,
    riverJobId,
    candidateOverlayVisibility,
    showObservedWaterExtent,
    currentJobFrame,
    currentTimeSeriesFrame,
    verifiedGeoJSONFiles,
    isGeneralScanJob,
    riverJob?.aoi_wkt,
    report?.analysis_type,
  ]);

  useEffect(() => {
    if (!timeSeriesPlaying || playbackFrames.length < 2) return undefined;
    const timer = window.setInterval(() => {
      setTimeSeriesIndex((index) => (index + 1) % playbackFrames.length);
    }, 1800);
    return () => window.clearInterval(timer);
  }, [timeSeriesPlaying, playbackFrames.length]);

  useEffect(() => {
    if (!jobTimeSeriesPlaying || jobTimeSeriesFrames.length < 2) return;
    if (
      !currentJobFrameMetadata
      || !currentJobFrame
      || jobFrameJobId !== riverJobId
      || jobFrameDate !== currentJobFrameMetadata.date
    ) return;
    const timer = window.setTimeout(() => {
      setJobTimeSeriesIndex((index) => (index + 1) % jobTimeSeriesFrames.length);
    }, 1800);
    return () => window.clearTimeout(timer);
  }, [
    jobTimeSeriesPlaying,
    jobTimeSeriesFrames.length,
    riverJobId,
    currentJobFrameMetadata,
    currentJobFrame,
    jobFrameJobId,
    jobFrameDate,
  ]);

  const resultType = explorerReport ? explorerReport.analysis_type.replace(/_/g, ' ') : 'No result loaded';

  return (
    <div className="home-page claude-home river-shift-page">
      <div className="claude-background" aria-hidden="true"><i /><i /><i /></div>
      <Header
        user={user}
        authState={authState}
        onSignIn={onSignIn}
        onSignOut={onSignOut}
        isArchivePage
        hideProfile
        showPageTitle
        pageTitle="River Shift Results"
      />

      <main className="rs-workspace-grid" style={{ marginTop: '16px' }}>
        {jobLoading && (
          <section className="rs-panel" role="status">
            <p className="rs-muted">Loading River Shift results…</p>
          </section>
        )}

        {jobError && (
          <section className="rs-panel" role="alert">
            <p className="rs-error">{jobError}</p>
          </section>
        )}

        {explorerReport && (
          <section className="rs-panel rs-results-panel rs-report-summary-top">
            <ReportPanel report={explorerReport} />
          </section>
        )}

        {riverJob?.state === 'succeeded' && (
          <section className="rs-panel rs-job-panel" aria-live="polite">
            {riverJob.result_summary && (
              <>
                <OverlapAuditPanel summary={riverJob.result_summary} />
                <ScientificReadinessPanel
                  summary={riverJob.result_summary}
                  report={jobPreview?.report || null}
                  jobState={riverJob.state}
                  artifactCount={riverJob.artifact_manifest?.length || 0}
                />
              </>
            )}

            {jobPreview?.jobId === riverJob.id && jobPreview.report && jobTimeSeriesFrames.length > 0 && (
              <section className="rs-timeseries" aria-label="Provisional observed acquisition playback">
                <div className="rs-section-heading">
                  <div><p className="rs-kicker">OBSERVED ACQUISITIONS</p><h3>River change playback</h3></div>
                  <span className="rs-chip">PROVISIONAL · NO DAILY INTERPOLATION</span>
                </div>
                <p className="rs-warning-inline">Each step is an actual NISAR acquisition date. The blue layer shows open-water candidates; the red and green layers show persistent erosion and deposition candidates. These are radar screening results, not field-confirmed change.</p>
                <div className="rs-playback-controls">
                  <button className="rs-secondary-button" type="button" onClick={() => setJobTimeSeriesIndex((index) => (index - 1 + jobTimeSeriesFrames.length) % jobTimeSeriesFrames.length)}>Previous</button>
                  <button className="rs-primary-button" type="button" disabled={jobTimeSeriesFrames.length < 2} onClick={() => setJobTimeSeriesPlaying((value) => !value)}>{jobTimeSeriesPlaying ? 'Pause' : 'Play'}</button>
                  <button className="rs-secondary-button" type="button" onClick={() => setJobTimeSeriesIndex((index) => (index + 1) % jobTimeSeriesFrames.length)}>Next</button>
                  <label className="rs-date-slider"><span>Observed date</span>
                    <input type="range" min={0} max={jobTimeSeriesFrames.length - 1} value={jobTimeSeriesIndex}
                      onChange={(event) => { setJobTimeSeriesPlaying(false); setJobTimeSeriesIndex(Number(event.target.value)); }} />
                  </label>
                </div>
              </section>
            )}

            {jobPreview?.jobId === riverJob.id && jobPreview.error && <p className="rs-warning-inline" role="status">{jobPreview.error}</p>}

            {/*
              <div className="rs-artifact-list">
                <strong>Private result files · upload checksum verified</strong>
                <p className="rs-muted">Upload receipts preserve the original size and checksum. In-app downloads and previews are checked again before use.</p>
                {riverJob?.artifact_manifest?.map((artifact, index) => artifact.bytes <= 4_000_000
                  ? <button className="rs-secondary-button" key={`${artifact.path}-${index}`} type="button" onClick={() => void saveRiverArtifact(index, artifact.name)}>{artifact.name} · {(artifact.bytes / 1_000_000).toFixed(2)} MB</button>
                  : <span className="rs-muted" key={`${artifact.path}-${index}`}>{artifact.name} · {(artifact.bytes / 1_000_000).toFixed(2)} MB · stored privately; too large for in-app download</span>)}
              </div>
            */}
          </section>
        )}

        <section className="rs-panel rs-results-panel">
          {report?.analysis_type === 'water_timeseries_screening' && (
            <section className="rs-timeseries" aria-label="Observed acquisition playback">
              <div className="rs-section-heading"><div><p className="rs-kicker">OBSERVED ACQUISITIONS</p><h3>Water change playback</h3></div>
                <span className="rs-chip">NO DAILY INTERPOLATION</span></div>
              {report.quality.release_status !== 'VERIFIED'
                ? <p className="rs-warning-inline">Playback and map layers stay hidden until the report is independently reviewed and marked VERIFIED.</p>
                : playbackFrames.length !== (report.time_series || []).length
                  ? <p className="rs-warning-inline">Import every report-listed GeoJSON file in one selection. Each filename and SHA-256 must match before playback starts.</p>
                  : playbackFrames.length < 2
                    ? <p className="rs-warning-inline">At least two verified observation frames are required to play this time series.</p>
                    : <>
                      <div className="rs-playback-controls">
                        <button className="rs-secondary-button" type="button" onClick={() => setTimeSeriesIndex((index) => (index - 1 + playbackFrames.length) % playbackFrames.length)}>Previous</button>
                        <button className="rs-primary-button" type="button" onClick={() => setTimeSeriesPlaying((value) => !value)}>{timeSeriesPlaying ? 'Pause' : 'Play'}</button>
                        <button className="rs-secondary-button" type="button" onClick={() => setTimeSeriesIndex((index) => (index + 1) % playbackFrames.length)}>Next</button>
                        <label className="rs-date-slider"><span>Acquisition date</span>
                          <input type="range" min={0} max={playbackFrames.length - 1} value={timeSeriesIndex}
                            onChange={(event) => { setTimeSeriesPlaying(false); setTimeSeriesIndex(Number(event.target.value)); }} />
                        </label>
                      </div>
                      {currentTimeSeriesFrame && <p className="rs-info-banner">Observed {currentTimeSeriesFrame.date} · candidate open-water area {currentTimeSeriesFrame.water_area_km2.toFixed(3)} km² · valid samples {(currentTimeSeriesFrame.valid_pixel_fraction * 100).toFixed(1)}%</p>}
                    </>}
            </section>
          )}

          <section className="rs-map-section">
            {mapError && <p className="rs-warning-inline">{mapError}</p>}
            <div className={`rs-map-shell${mapDarkMode ? ' is-dark' : ''}`}>
              <div className={`rs-map-toolbar${mapDarkMode ? ' is-dark' : ''}`}>
                <div>
                  <strong>River Shift spatial output</strong>
                  <span>Satellite context · display-only preview overlays</span>
                </div>
                <div className="rs-map-toolbar-actions">
                  <button
                    type="button"
                    className={`rs-map-label-toggle${mapLabelsVisible ? ' is-on' : ''}`}
                    role="switch"
                    aria-checked={mapLabelsVisible}
                    onClick={() => {
                      if (mapType === 'satellite') resultMapInstance.current?.setMapTypeId('hybrid');
                      else if (mapType === 'hybrid') resultMapInstance.current?.setMapTypeId('satellite');
                      else setMapLabelsVisible((value) => !value);
                    }}
                  >
                    <span>Labels</span><span className="rs-map-mini-switch" aria-hidden="true"><i /></span>
                  </button>
                  <button
                    type="button"
                    className={`rs-map-theme-toggle${mapDarkMode ? ' is-dark' : ''}`}
                    role="switch"
                    aria-checked={mapDarkMode}
                    onClick={() => setMapDarkMode((value) => !value)}
                  >
                    <span>{mapDarkMode ? 'Dark' : 'Light'}</span>
                    <span className="rs-map-theme-track" aria-hidden="true"><i>☼</i></span>
                  </button>
                </div>
              </div>
              <div className={`rs-map${mapDarkMode ? ' is-imagery-dark' : ''}`} ref={resultMapElement} role="application" aria-label="Interactive Google satellite map. Use the candidate layer controls below to show or hide each RiverShift overlay." />
            </div>
            <div className="rs-legend"><span><i className="rs-swatch rs-erosion" />Erosion candidate</span><span><i className="rs-swatch rs-deposition" />Deposition candidate</span><span><i className="rs-swatch rs-water" />New-water candidate</span><span><i className="rs-swatch rs-observed-water" />Observed-date water extent</span></div>
            {(hasCandidateOverlaySource || hasObservedWaterFrames) && (
              <div className="rs-overlay-controls" aria-label="RiverShift map overlay visibility">
                {hasCandidateOverlaySource && (
                  <>
                    <label className="rs-overlay-toggle rs-overlay-toggle-all">
                      <input
                        type="checkbox"
                        checked={allCandidateLayersVisible}
                        onChange={(event) => {
                          setShowErosionOverlay(event.target.checked);
                          setShowDepositionOverlay(event.target.checked);
                          setShowNewWaterOverlay(event.target.checked);
                        }}
                      />
                      <span><strong>All candidate overlays</strong><small>Show or hide all implemented change classes.</small></span>
                    </label>
                    <div className="rs-overlay-class-grid">
                      <label className="rs-overlay-toggle">
                        <input type="checkbox" checked={showErosionOverlay} disabled={candidateOverlayCounts.erosion === 0}
                          onChange={(event) => setShowErosionOverlay(event.target.checked)} />
                        <span><strong>Erosion</strong><small>{candidateOverlayCounts.erosion} feature(s)</small></span>
                      </label>
                      <label className="rs-overlay-toggle">
                        <input type="checkbox" checked={showDepositionOverlay} disabled={candidateOverlayCounts.deposition === 0}
                          onChange={(event) => setShowDepositionOverlay(event.target.checked)} />
                        <span><strong>Deposition</strong><small>{candidateOverlayCounts.deposition} feature(s)</small></span>
                      </label>
                      <label className="rs-overlay-toggle">
                        <input type="checkbox" checked={showNewWaterOverlay} disabled={candidateOverlayCounts.newWater === 0}
                          onChange={(event) => setShowNewWaterOverlay(event.target.checked)} />
                        <span><strong>New water</strong><small>{candidateOverlayCounts.newWater} feature(s)</small></span>
                      </label>
                      <label className="rs-overlay-toggle rs-overlay-unavailable">
                        <input type="checkbox" disabled />
                        <span><strong>Exposed bar / char</strong><small>Unavailable — detection method not yet validated or implemented.</small></span>
                      </label>
                    </div>
                  </>
                )}
                {hasObservedWaterFrames && (
                  <label className="rs-overlay-toggle rs-overlay-observed">
                    <input type="checkbox" checked={showObservedWaterExtent}
                      onChange={(event) => setShowObservedWaterExtent(event.target.checked)} />
                    <span><strong>Observed-date open-water extent</strong><small>{candidateOverlayCounts.observedWater > 0 ? `${candidateOverlayCounts.observedWater} feature(s) in the result layer; ` : ''}Current acquired-date water layer; separate from date-window change candidates.</small></span>
                  </label>
                )}
              </div>
            )}
            {/*
              <div><strong>NASA measurement data</strong><span>NASA–ISRO NISAR Level-2 GCOV radar observations drive the water and land-transition screening.</span></div>
              <div><strong>NASA data access</strong><span>NASA Earthdata and ASF DAAC provide the exact NISAR granules; product identities and checksums are retained with the result.</span></div>
              <div><strong>Third-party map context only</strong><span>Google Maps Satellite imagery helps orient the result geographically. Basemap imagery is not used by the analysis and is not an independent validation layer.</span></div>
              <div><strong>Optional independent agency comparison</strong><span>Copernicus Sentinel-2 L2A can be compared with a supplied NISAR water mask using clear-sky SCL and B03/B11 MNDWI. This optional screen is not run for this result unless a comparison report is attached, and it is not ground truth.</span></div>
            */}
            {hasVerifiedOverlay && <p className="rs-muted">Verified layer(s) are drawn; each GeoJSON SHA-256 matches the loaded report. Candidate classes require scientific interpretation and are not field-confirmed land change.</p>}
            {report && geoJSONFiles.length > 0 && !hasVerifiedOverlay && <p className="rs-warning-inline" role="status">Loaded GeoJSON is not drawn: the report is not VERIFIED, the checksum does not match, or the complete time-series layer set is missing.</p>}
          </section>

          {explorerReport && (
            <div className="rs-warning-list">
              <strong>Input provenance</strong>
              <p>Granules: {Array.isArray(explorerReport.source.granule_names) && explorerReport.source.granule_names.length ? explorerReport.source.granule_names.join(', ') : 'No NISAR granule IDs recorded'}</p>
              <p>Source checksums: {Array.isArray(explorerReport.source.source_granule_sha256) && explorerReport.source.source_granule_sha256.length ? explorerReport.source.source_granule_sha256.join(', ') : 'No source product checksums recorded'}</p>
              {explorerReport.inputs && <p>Input checksums: {JSON.stringify(explorerReport.inputs.input_sha256 || 'Not recorded')}</p>}
            </div>
          )}

          {/*
            <div className="rs-section-heading">
              <div><p className="rs-kicker">04 · LOCAL EXPOSURE CONTEXT</p><h3>Put candidate zones in context</h3></div>
              <span className="rs-chip">OPTIONAL · SOURCE-ATTRIBUTED</span>
            </div>
            <p className="rs-muted">Import a point/centroid GeoJSON layer for buildings, settlements, public facilities or population-grid cells. RiverShift will count representative points inside the retained candidate preview polygons and can sum one numeric attribute such as population. The file is analysed locally in this browser and is not uploaded.</p>
            <div className="rs-impact-osm-action">
              <button className="rs-secondary-button" type="button" disabled={impactFetchBusy || !impactCandidateLayers.length || !riverJob?.aoi_wkt} onClick={() => void fetchOpenStreetMapImpactContext()}>
                {impactFetchBusy ? 'Querying one AOI-bounded OSM extract…' : 'Fetch OSM buildings & public facilities for this AOI'}
              </button>
              <small>One read-only query against the completed result AOI for mapped buildings and selected public facilities. The shared service may be busy; an attributed GeoJSON import remains available.</small>
            </div>
            <div className="rs-impact-upload-grid">
              <label className="rs-upload"><span>Exposure points GeoJSON</span><small>Point or MultiPoint features · maximum 20 MB</small>
                <input type="file" accept=".geojson,.json,application/geo+json,application/json" onChange={(event) => void loadImpactExposure(event.target.files?.[0])} />
              </label>
              <label className="rs-field"><span>Dataset / layer name</span><input value={impactSourceName} onChange={(event) => setImpactSourceName(event.target.value)} placeholder="e.g. OSM building centroids" /></label>
              <label className="rs-field"><span>Public source URL (required)</span><input type="url" value={impactSourceUrl} onChange={(event) => setImpactSourceUrl(event.target.value)} placeholder="https://…" /></label>
              <label className="rs-field"><span>Dataset vintage / date</span><input value={impactSourceVintage} onChange={(event) => setImpactSourceVintage(event.target.value)} placeholder="e.g. downloaded 2026-11-05" /></label>
              <label className="rs-field"><span>Optional numeric property to sum</span><input value={impactValueField} onChange={(event) => setImpactValueField(event.target.value)} placeholder="e.g. population" /></label>
            </div>
            {impactExposure && impactMapPoints.length > 0 && safeImpactSourceUrl && (
              <label className="rs-impact-map-toggle">
                <input type="checkbox" checked={showImpactMapMarkers} onChange={(event) => setShowImpactMapMarkers(event.target.checked)} />
                <span><strong>Show mapped exposure points on the map</strong><small>{impactMapPoints.length.toLocaleString()} representative point(s) shown in gold; {impactMapOmittedPoints.toLocaleString()} additional point(s) omitted from map rendering when above the 2,000-point display cap. The screening count still uses the full imported layer.</small></span>
              </label>
            )}
            {impactExposure && <p className="rs-info-banner">Loaded {impactExposure.fileName} · {impactExposure.data.features.length.toLocaleString()} point feature(s). The source attribution fields must contain a dataset name and HTTPS URL before results are calculated.</p>}
            {impactFetchError && <p className="rs-error" role="alert">{impactFetchError}</p>}
            {impactFetchNotice && <p className="rs-info-banner" role="status">{impactFetchNotice}</p>}
            {impactExposureError && <p className="rs-error" role="alert">{impactExposureError}</p>}
            {impactExposure && (!impactSourceName.trim() || !safeImpactSourceUrl) && <p className="rs-warning-inline">Add a dataset name and a valid HTTPS source URL to make this exposure context attributable.</p>}
            {impactSummary && (
              <>
                {impactSummary.candidatePolygonCount === 0
                  ? <p className="rs-warning-inline">No candidate preview polygons are available to compare. Sparse marker points are deliberately excluded from this area-intersection screen.</p>
                  : <div className="rs-impact-results">
                    <article className="rs-impact-total"><span>Unique points inside any candidate preview polygon</span><strong>{impactSummary.uniqueFeaturesInsideAnyCandidate.toLocaleString()}</strong><small>of {impactSummary.exposureFeatureCount.toLocaleString()} uploaded point feature(s)</small></article>
                    {impactSummary.populationField && <article className="rs-impact-total"><span>Sum of “{impactSummary.populationField}” inside candidate preview polygons</span><strong>{impactSummary.populationValueSum?.toLocaleString(undefined, { maximumFractionDigits: 2 }) ?? 'Not available'}</strong><small>{impactSummary.featuresMissingPopulationValue.toLocaleString()} matched feature(s) had no valid non-negative numeric value</small></article>}
                    {(['erosion', 'deposition', 'newWater'] as const).map((category) => (
                      <article className="rs-impact-class" key={category}>
                        <span>{category === 'newWater' ? 'New-water candidate' : category[0].toUpperCase() + category.slice(1) + ' candidate'}</span>
                        <strong>{impactSummary.byClass[category].featureCount.toLocaleString()} point feature(s)</strong>
                        {impactSummary.populationField && <small>Attribute sum: {impactSummary.byClass[category].populationValueSum?.toLocaleString(undefined, { maximumFractionDigits: 2 }) ?? 'Not available'}</small>}
                      </article>
                    ))}
                    <div className="rs-impact-source">Source: <strong>{impactSourceName.trim()}</strong>{impactSourceVintage.trim() ? ' · ' + impactSourceVintage.trim() : ''} · <a href={safeImpactSourceUrl || undefined} target="_blank" rel="noreferrer">Open dataset source ↗</a></div>
                  </div>}
                <p className="rs-impact-caveat">Interpretation boundary: these are potential exposure-context counts, not damaged or confirmed affected assets. Counts use point locations inside coarse display-preview polygons only; sparse candidate markers, building footprints, road lengths and points outside the visible polygons are not measured. Do not add class counts together when one point lies in more than one class.</p>
              </>
            )}
            {!impactExposure && <p className="rs-impact-help">Useful inputs: building or facility centroids, settlement points, or population-grid centroids with a numeric population property. Record the provider and data vintage. No source data is bundled or assumed.</p>}
            {impactSourceName.startsWith('OpenStreetMap') && <p className="rs-impact-caveat">Open data attribution: © OpenStreetMap contributors · ODbL. This is a mapped-feature inventory, not an authoritative building census or damage assessment.</p>}
            {impactExposure && impactSummary && <p className="rs-impact-caveat">{impactSummary.sparseMarkerFeaturesExcluded.toLocaleString()} sparse marker feature(s) excluded from the polygon intersection. Multi-class matches: {impactSummary.featuresMatchingMultipleClasses.toLocaleString()} point feature(s).</p>}
          */}

          {!report && !hasLiveJobResult && (
            <div className="rs-empty-state">
              <strong>{hasLiveJobResultPending ? 'Live processing finished · preview not loaded' : resultType}</strong>
              <p>{hasLiveJobResultPending
                ? 'A successful live job and its private result files are on record, but the automatic preview has not loaded. See the storage message above; manual import is not required for a live job.'
                : 'No live result or external report is loaded yet. Start the live processing workflow above; manual JSON and GeoJSON import is optional.'}</p>
            </div>
          )}
          {hasLiveJobResult && !report && (
            <p className="rs-info-banner" role="status">
            </p>
          )}
        </section>
      </main>

      <footer className="rs-footer" style={{ marginTop: '40px' }}>
        <span>SARGuardian · RiverShift</span>
      </footer>
    </div>
  );
}
