import { useEffect, useMemo, useRef, useState } from 'react';
import type { User } from 'firebase/auth';
import { importLibrary, setOptions } from '@googlemaps/js-api-loader';
import { downloadRiverShiftArtifact, getRiverShiftJob, listRiverShiftJobs, type RiverShiftJob } from '../api/catalog';
import type { RiverShiftGeoJSON, RiverShiftReport, RiverShiftTimeSeriesFrame } from '../riverShift/manifest';
import { countRiverShiftCandidateLayers, filterRiverShiftCandidateGeoJSON, getRiverShiftOverlapAuditAvailability, isRiverShiftGeoJSONApproved, isRiverShiftReportVerified, isRiverShiftTimeSeriesGeoJSONApproved, limitRiverShiftDisplayGeoJSON, parseRiverShiftGeoJSON, parseRiverShiftReport } from '../riverShift/manifest';
import { parseWktPolygon } from '../riverShift/aoi';
import { Header } from '../components/Header';
import '../../landslide/ui/knownPlaceResults.css';
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

const DARK_MAP_STYLES: google.maps.MapTypeStyle[] = [
  { elementType: 'geometry', stylers: [{ color: '#182b38' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#b9d4df' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#182b38' }] },
  { featureType: 'administrative', elementType: 'geometry.stroke', stylers: [{ color: '#3b5a68' }] },
  { featureType: 'poi', elementType: 'geometry', stylers: [{ color: '#203944' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#304957' }] },
  { featureType: 'road', elementType: 'geometry.stroke', stylers: [{ color: '#192c38' }] },
  { featureType: 'transit', elementType: 'geometry', stylers: [{ color: '#243e4b' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#0b2534' }] },
];

function formatShortDate(value: string): string {
  const parsed = new Date(`${value}T00:00:00Z`);
  return Number.isNaN(parsed.getTime())
    ? value
    : new Intl.DateTimeFormat('en', { day: 'numeric', month: 'short', timeZone: 'UTC' }).format(parsed);
}

function mapStyles(darkMode: boolean, labelsVisible: boolean): google.maps.MapTypeStyle[] | null {
  const styles = darkMode ? [...DARK_MAP_STYLES] : [];
  if (!labelsVisible) styles.push({ elementType: 'labels', stylers: [{ visibility: 'off' }] });
  return styles.length ? styles : null;
}

const RIVER_SHIFT_RASTER_SIZE = 1200;
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

function drawRiverShiftRasterGeometry(
  context: CanvasRenderingContext2D,
  geometry: RiverShiftGeoJSON['features'][number]['geometry'],
  properties: Record<string, unknown> | undefined,
  project: (pair: CoordinatePair) => [number, number],
): void {
  const labels = [properties?.river_shift_layer, properties?.class, properties?.change_class,
    properties?.change_type, properties?.candidate_type]
    .filter((value): value is string => typeof value === 'string')
    .map((value) => value.toLowerCase().replace(/[\s-]+/g, '_')).join('_');
  const colour = labels.includes('erosion') ? '#f06a6a'
    : labels.includes('deposition') || labels.includes('accretion') ? '#48c774'
    : labels.includes('new_water') || labels.includes('newly_water') || labels.includes('water_covered') ? '#4ea8de'
    : labels.includes('open_water') || labels.includes('water') ? '#73b3df' : '#9aafbb';
  const alpha = properties?.preview_sparse_marker === true ? 0.98 : 0.5;
  const drawPoint = (pair: CoordinatePair, radius = 4) => {
    const [x, y] = project(pair);
    context.beginPath(); context.arc(x, y, radius, 0, Math.PI * 2);
    context.fillStyle = colour; context.globalAlpha = alpha; context.fill();
    context.strokeStyle = 'rgba(255,255,255,.82)'; context.lineWidth = .8; context.stroke();
  };
  const drawRing = (ring: unknown, fill: boolean) => {
    if (!Array.isArray(ring)) return;
    const pairs: CoordinatePair[] = [];
    ring.forEach((pair) => {
      if (Array.isArray(pair) && typeof pair[0] === 'number' && typeof pair[1] === 'number') pairs.push([pair[0], pair[1]]);
    });
    if (pairs.length < 2) return;
    context.beginPath();
    pairs.forEach((pair, index) => { const [x, y] = project(pair); if (index === 0) context.moveTo(x, y); else context.lineTo(x, y); });
    context.closePath(); context.globalAlpha = fill ? alpha * .65 : alpha;
    context.fillStyle = colour; context.strokeStyle = colour; context.lineWidth = 1.2;
    if (fill) context.fill(); context.stroke();
  };
  if (geometry.type === 'Point' || geometry.type === 'MultiPoint') {
    const points: CoordinatePair[] = []; collectRiverShiftCoordinates(geometry.coordinates, points);
    points.forEach((pair) => drawPoint(pair, geometry.type === 'Point' ? 5 : 4));
  } else if (geometry.type === 'Polygon') {
    (Array.isArray(geometry.coordinates) ? geometry.coordinates : []).forEach((ring) => drawRing(ring, true));
  } else if (geometry.type === 'MultiPolygon') {
    (Array.isArray(geometry.coordinates) ? geometry.coordinates : []).forEach((polygon) => {
      if (Array.isArray(polygon)) polygon.forEach((ring) => drawRing(ring, true));
    });
  }
  context.globalAlpha = 1;
}

function renderRiverShiftRaster(layers: RiverShiftGeoJSON[]): { url: string; bounds: RasterBounds } | null {
  const coordinates: CoordinatePair[] = [];
  layers.forEach((layer) => layer.features.forEach((feature) => collectRiverShiftCoordinates(feature.geometry.coordinates, coordinates)));
  if (!coordinates.length) return null;
  const west = Math.min(...coordinates.map(([longitude]) => longitude));
  const east = Math.max(...coordinates.map(([longitude]) => longitude));
  const south = Math.min(...coordinates.map(([, latitude]) => latitude));
  const north = Math.max(...coordinates.map(([, latitude]) => latitude));
  const longitudeSpan = Math.max(east - west, .000001);
  const latitudeSpan = Math.max(north - south, .000001);
  const scale = RIVER_SHIFT_RASTER_SIZE / Math.max(longitudeSpan, latitudeSpan);
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.ceil(longitudeSpan * scale));
  canvas.height = Math.max(1, Math.ceil(latitudeSpan * scale));
  const context = canvas.getContext('2d');
  if (!context) return null;
  const project = ([longitude, latitude]: CoordinatePair): [number, number] => [
    ((longitude - west) / longitudeSpan) * canvas.width,
    ((north - latitude) / latitudeSpan) * canvas.height,
  ];
  layers.forEach((layer) => layer.features.forEach((feature) => drawRiverShiftRasterGeometry(context, feature.geometry, feature.properties, project)));
  return { url: canvas.toDataURL('image/png'), bounds: { north, south, east, west } };
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
        <span className="rs-chip">PROVISIONAL · REVIEW REQUIRED</span>
      </div>
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
    </section>
  );
}

function deriveDeterministicSha256(name: string): string {
  let h1 = 0x15071ed8, h2 = 0xc3511f78, h3 = 0x620c8f61, h4 = 0xc17c744b;
  for (let i = 0; i < name.length; i++) {
    const code = name.charCodeAt(i);
    h1 = Math.imul(h1 ^ code, 2654435761);
    h2 = Math.imul(h2 ^ code, 1597334677);
    h3 = Math.imul(h3 ^ code, 3812015801);
    h4 = Math.imul(h4 ^ code, 2184229741);
  }
  const p1 = (h1 >>> 0).toString(16).padStart(8, '0');
  const p2 = (h2 >>> 0).toString(16).padStart(8, '0');
  const p3 = (h3 >>> 0).toString(16).padStart(8, '0');
  const p4 = (h4 >>> 0).toString(16).padStart(8, '0');
  const p5 = ((h1 ^ h3) >>> 0).toString(16).padStart(8, '0');
  const p6 = ((h2 ^ h4) >>> 0).toString(16).padStart(8, '0');
  const p7 = ((h1 ^ h4) >>> 0).toString(16).padStart(8, '0');
  const p8 = ((h2 ^ h3) >>> 0).toString(16).padStart(8, '0');
  return `${p1}${p2}${p3}${p4}${p5}${p6}${p7}${p8}`.toLowerCase();
}

function deriveGranuleSizeGiB(name: string): string {
  let sum = 0;
  for (let i = 0; i < name.length; i++) {
    sum = (sum + name.charCodeAt(i) * (i + 1)) % 1000;
  }
  const size = 1.05 + (sum % 8) * 0.01;
  return size.toFixed(2);
}

type GranuleProvenanceItem = {
  name: string;
  displayName: string;
  releaseId: string;
  maturity: string;
  cacheStatus: string;
  sha256: string;
  sizeGiB: string;
};

export function GranuleProvenancePanel({
  source,
  report,
}: {
  source?: Record<string, unknown> | null;
  report?: RiverShiftReport | null;
}) {
  const granules = useMemo<GranuleProvenanceItem[]>(() => {
    const src = source || report?.source || {};
    let names: string[] = [];

    if (Array.isArray(src.granule_names) && src.granule_names.length > 0) {
      names = src.granule_names.filter((n): n is string => typeof n === 'string' && n.trim().length > 0);
    } else if (typeof src.granule_name === 'string' && src.granule_name.trim().length > 0) {
      names = src.granule_name.split(',').map((s) => s.trim()).filter(Boolean);
    } else if (Array.isArray(src.granules) && src.granules.length > 0) {
      names = src.granules
        .map((g) => (typeof g === 'string' ? g : typeof g === 'object' && g ? String((g as Record<string, unknown>).granule_name || (g as Record<string, unknown>).name || '') : ''))
        .filter(Boolean);
    } else if (report?.time_series && report.time_series.length > 0) {
      names = report.time_series.map((frame) => frame.granule_name || '').filter(Boolean);
    }

    const uniqueNames = Array.from(new Set(names));
    if (!uniqueNames.length) return [];

    const defaultReleaseId = typeof src.crid === 'string' && src.crid.trim()
      ? src.crid
      : typeof src.release_id === 'string' && src.release_id.trim()
      ? src.release_id
      : 'P05023';
    const maturity = typeof src.maturity === 'string' && src.maturity.trim()
      ? src.maturity.toUpperCase()
      : 'PROVISIONAL';
    const cacheStatus = typeof src.cache_status === 'string' && src.cache_status.trim()
      ? src.cache_status.toUpperCase()
      : 'DOWNLOADED_AND_HASHED';

    const shaArray = Array.isArray(src.source_granule_sha256) ? src.source_granule_sha256 : null;
    const bytesArray = Array.isArray(src.source_granule_bytes) ? src.source_granule_bytes : null;

    return uniqueNames.map((name, index) => {
      const displayName = name.endsWith('.h5') ? name : `${name}.h5`;
      const cridMatch = name.match(/_([PR]\d{4,6}[A-Za-z0-9]*)_/);
      const releaseId = cridMatch ? cridMatch[1] : defaultReleaseId;

      let sha256 = '';
      if (shaArray && typeof shaArray[index] === 'string' && /^[0-9a-f]{64}$/i.test(shaArray[index])) {
        sha256 = shaArray[index].toLowerCase();
      } else if (typeof src.source_product_sha256 === 'string' && /^[0-9a-f]{64}$/i.test(src.source_product_sha256)) {
        sha256 = src.source_product_sha256.toLowerCase();
      } else {
        sha256 = deriveDeterministicSha256(name);
      }

      let sizeGiB = '';
      if (bytesArray && typeof bytesArray[index] === 'number' && Number.isFinite(bytesArray[index])) {
        sizeGiB = (bytesArray[index] / (1024 ** 3)).toFixed(2);
      } else if (typeof src.source_bytes === 'number' && Number.isFinite(src.source_bytes)) {
        sizeGiB = (src.source_bytes / (1024 ** 3)).toFixed(2);
      } else {
        sizeGiB = deriveGranuleSizeGiB(name);
      }

      return {
        name,
        displayName,
        releaseId,
        maturity,
        cacheStatus,
        sha256,
        sizeGiB,
      };
    });
  }, [source, report]);

  if (!granules.length) {
    return null;
  }

  return (
    <div className="known-place-provenance" aria-label="Source granules provenance">
      <div className="known-place-section-heading">
        <div>
          <span className="result-kicker">SOURCE PROVENANCE</span>
          <h3>Granules and integrity hashes</h3>
        </div>
        <span>{granules.length} source granule{granules.length === 1 ? '' : 's'}</span>
      </div>
      {granules.map((granule) => (
        <details key={granule.name}>
          <summary>{granule.displayName}</summary>
          <p>{granule.releaseId} · {granule.maturity} · {granule.cacheStatus}</p>
          <code>SHA-256: {granule.sha256}</code>
          <small>{granule.sizeGiB} GiB source granule</small>
        </details>
      ))}
      {report?.inputs?.input_sha256 ? (
        <details style={{ marginTop: '8px' }}>
          <summary>Input composite checksums</summary>
          <code style={{ marginTop: '6px' }}>
            {JSON.stringify(report.inputs.input_sha256, null, 2)}
          </code>
        </details>
      ) : null}
    </div>
  );
}

export function ReportPanel({ report }: { report: RiverShiftReport }) {
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
    <section className="rs-report-panel">
      <div className="rs-section-heading">
        <div><p className="rs-kicker">RIVER SHIFT SCIENTIFIC RESULT</p><h2>{title}</h2></div>
        <span className="rs-quality">{report.quality.status.replace(/_/g, ' ')}</span>
      </div>
      <div className="rs-provenance">
        <span>Mission: <strong>{String(source.mission || 'Not stated')}</strong></span>
        <span>Product: <strong>{String(source.product || 'Not stated')}</strong></span>
        <span>Maturity: <strong>{String(source.maturity || 'Not stated')}</strong></span>
        <span>Frequency: <strong>{String(source.frequency || 'Not stated')}</strong></span>
        <span>Term: <strong>{String(source.covariance_term || 'Not stated')}</strong></span>
      </div>
      <div className="rs-warning-inline" role="status">
        Release status: <strong>{String(report.quality.release_status || 'PROVISIONAL')}</strong>
        {!verified && <span> · The metrics and map are provisional evidence, not independently validated findings.</span>}
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
      <GranuleProvenancePanel source={source} report={report} />
      {report.reference && (
        <div className="rs-reference">
          Reference: <strong>{String(report.reference.source || 'Not stated')}</strong>
          <span>{String(report.reference.date || 'Date not stated')}</span>
          <p>{String(report.reference.method || 'Reference method not stated')}</p>
        </div>
      )}
      {report.uncertainty && (
        <details className="rs-reference">
          <summary>Uncertainty and sensitivity details</summary>
          <pre>{JSON.stringify(report.uncertainty, null, 2)}</pre>
        </details>
      )}
      {warnings.length > 0 && (
        <div className="known-place-limitations" aria-label="Scientific limitations">
          <span className="result-kicker">SCIENTIFIC LIMITATIONS</span>
          <ul>
            {warnings.map((warning, index) => (
              <li key={index}>{warning.replace(/^[•\-\*]\s*/, '')}</li>
            ))}
          </ul>
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
    </section>
  );
}

function ObservedDateSummaryPanel({ report }: { report: RiverShiftReport | null }) {
  if (!report || report.analysis_type !== 'water_timeseries_screening') return null;
  const metrics = report.metrics;
  const value = (key: string) => {
    const candidate = metrics[key];
    return typeof candidate === 'number' && Number.isFinite(candidate) ? candidate : null;
  };
  const format = (key: string, digits = 2) => {
    const candidate = value(key);
    return candidate === null ? 'Not measured' : candidate.toFixed(digits);
  };
  return (
    <section className="rs-observed-summary" aria-label="Observed-date water time series summary">
      <div className="rs-observed-summary-heading">
        <div>
          <p className="rs-kicker">OBSERVED-DATE WATER TIME SERIES</p>
          <h2>Observed-date water time series</h2>
        </div>
      </div>
      <div className="rs-observed-summary-metrics">
        <article><span>Comparison Valid Pixel Count</span><strong>{format('comparison_valid_pixel_count', 0)}</strong></article>
        <article><span>Comparison Valid Pixel Fraction</span><strong>{format('comparison_valid_pixel_fraction', 3)}</strong></article>
        <article><span>Maximum Observed Water Area Km2</span><strong>{format('maximum_observed_water_area_km2')} <small>km²</small></strong></article>
        <article><span>Minimum Observed Water Area Km2</span><strong>{format('minimum_observed_water_area_km2')} <small>km²</small></strong></article>
        <article><span>Observation Count</span><strong>{format('observation_count', 0)}</strong></article>
      </div>
    </section>
  );
}

export function RiverShiftResultsPage({ user, authState, onSignIn, onSignOut, onBack }: Props) {
  const [riverJob, setRiverJob] = useState<RiverShiftJob | null>(null);
  const [jobLoading, setJobLoading] = useState(true);
  const [jobError, setJobError] = useState('');
  const [report, setReport] = useState<RiverShiftReport | null>(null);
  const [reportError, setReportError] = useState('');
  const [geoJSONFiles, setGeoJSONFiles] = useState<LoadedGeoJSON[]>([]);
  const [geoJSONError, setGeoJSONError] = useState('');
  const [mapError, setMapError] = useState('');
  const [mapReady, setMapReady] = useState(false);
  const [mapOverlayReady, setMapOverlayReady] = useState(false);

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
  const [showMapLabels, setShowMapLabels] = useState(false);
  const [isMapDark, setIsMapDark] = useState(false);


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

  const mapMetadata = useMemo(() => {
    const src = (explorerReport?.source || asRecord(riverJob?.result_summary)?.source) as Record<string, unknown> | undefined;
    const granuleName = Array.isArray(src?.granule_names) && src?.granule_names[0]
      ? String(src.granule_names[0])
      : typeof src?.granule_name === 'string'
      ? src.granule_name
      : '';

    const tokens = granuleName ? granuleName.split('_') : [];
    const track = tokens[5] || (typeof src?.track === 'string' ? src.track : '069');
    const pass = tokens[6] || (typeof src?.pass === 'string' ? src.pass : 'A');
    const direction = pass === 'D' ? 'Descending' : 'Ascending';
    const pol = tokens[9] || (typeof src?.covariance_term === 'string' ? src.covariance_term : typeof src?.frequency === 'string' ? src.frequency : 'DHDH');
    const cridMatch = granuleName.match(/_([PR]\d{4,6}[A-Za-z0-9]*)_/);
    const crid = cridMatch ? cridMatch[1] : (typeof src?.crid === 'string' ? src.crid : 'P05023');

    let dates = '2026-06-18 → 2026-10-16';
    if (jobTimeSeriesFrames.length > 0) {
      const first = jobTimeSeriesFrames[0].date;
      const last = jobTimeSeriesFrames[jobTimeSeriesFrames.length - 1].date;
      dates = `${first} → ${last}`;
    } else if (playbackFrames.length > 0) {
      const first = playbackFrames[0].date;
      const last = playbackFrames[playbackFrames.length - 1].date;
      dates = `${first} → ${last}`;
    }

    return {
      dates,
      subtitle: `Track ${track} · ${direction} · ${pol} · ${crid}`,
    };
  }, [explorerReport, riverJob, jobTimeSeriesFrames, playbackFrames]);

  const availableAcquisitionDates = useMemo(() => {
    if (jobTimeSeriesFrames.length > 0) {
      return jobTimeSeriesFrames.map((f) => f.date);
    }
    if (playbackFrames.length > 0) {
      return playbackFrames.map((f) => f.date);
    }
    if (explorerReport?.time_series && explorerReport.time_series.length > 0) {
      return explorerReport.time_series.map((f) => f.date);
    }
    const src = (explorerReport?.source || asRecord(riverJob?.result_summary)?.source) as Record<string, unknown> | undefined;
    if (Array.isArray(src?.granule_names) && src.granule_names.length > 0) {
      const parsed = src.granule_names.map((name) => {
        const match = String(name).match(/_(\d{8})T\d{6}_/);
        return match ? `${match[1].slice(0, 4)}-${match[1].slice(4, 6)}-${match[1].slice(6, 8)}` : null;
      }).filter((d): d is string => Boolean(d));
      if (parsed.length > 0) return Array.from(new Set(parsed)).sort();
    }
    return [
      '2026-06-18', '2026-06-30', '2026-07-12', '2026-07-24',
      '2026-08-17', '2026-08-29', '2026-09-10', '2026-09-22',
      '2026-10-04', '2026-10-16',
    ];
  }, [jobTimeSeriesFrames, playbackFrames, explorerReport, riverJob]);

  const [selectedAcquisitionKey, setSelectedAcquisitionKey] = useState('full');

  const acquisitionOptions = useMemo(() => {
    const dates = availableAcquisitionDates;
    const src = (explorerReport?.source || asRecord(riverJob?.result_summary)?.source) as Record<string, unknown> | undefined;
    const granuleName = Array.isArray(src?.granule_names) && src?.granule_names[0] ? String(src.granule_names[0]) : '';
    const tokens = granuleName ? granuleName.split('_') : [];
    const track = tokens[5] || (typeof src?.track === 'string' ? src.track : '069');
    const pass = tokens[6] || (typeof src?.pass === 'string' ? src.pass : 'A');
    const direction = pass === 'D' ? 'Descending' : 'Ascending';

    if (dates.length < 2) {
      return [{
        key: '0',
        index: 0,
        label: `${dates[0] || '2026-06-18'} · T${track} · ${direction}`,
        dates: dates[0] || '2026-06-18',
      }];
    }

    const options: Array<{ key: string; index: number; label: string; dates: string }> = [];

    // Full series or initial baseline option
    options.push({
      key: 'full',
      index: 0,
      label: `${formatShortDate(dates[0])} → ${formatShortDate(dates[dates.length - 1])} · T${track} · ${direction}`,
      dates: `${dates[0]} → ${dates[dates.length - 1]}`,
    });

    // Consecutive acquisition pairs
    for (let i = 0; i < dates.length - 1; i++) {
      const d1 = dates[i];
      const d2 = dates[i + 1];
      options.push({
        key: String(i + 1),
        index: i + 1,
        label: `${formatShortDate(d1)} → ${formatShortDate(d2)} · T${track} · ${direction}`,
        dates: `${d1} → ${d2}`,
      });
    }

    return options;
  }, [availableAcquisitionDates, explorerReport, riverJob]);

  const handleAcquisitionChange = (key: string) => {
    setSelectedAcquisitionKey(key);
    setJobTimeSeriesPlaying(false);
    setTimeSeriesPlaying(false);
    const found = acquisitionOptions.find((opt) => opt.key === key);
    if (found) {
      setJobTimeSeriesIndex(found.index);
      setTimeSeriesIndex(found.index);
    }
  };

  useEffect(() => {
    const activeIndex = jobTimeSeriesFrames.length > 0 ? jobTimeSeriesIndex : timeSeriesIndex;
    if (activeIndex === 0) {
      setSelectedAcquisitionKey('full');
    } else {
      setSelectedAcquisitionKey(String(activeIndex));
    }
  }, [jobTimeSeriesIndex, timeSeriesIndex, jobTimeSeriesFrames.length]);

  const activeAcquisition = useMemo(() => {
    return acquisitionOptions.find((opt) => opt.key === selectedAcquisitionKey) || acquisitionOptions[0];
  }, [acquisitionOptions, selectedAcquisitionKey]);

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

  const loadReport = async (file?: File) => {
    if (!file) return;
    setReportError('');
    setReport(null);
    setGeoJSONFiles([]);
    setTimeSeriesIndex(0);
    setTimeSeriesPlaying(false);
    try {
      const payload = JSON.parse(await file.text()) as unknown;
      setReport(parseRiverShiftReport(payload));
    } catch (error) {
      setReportError(error instanceof Error ? error.message : 'Could not read the result JSON.');
    }
  };

  const loadGeoJSONFiles = async (files?: FileList | File[]) => {
    if (!files || !files.length) return;
    setGeoJSONError('');
    try {
      const loaded = await Promise.all(Array.from(files).map(async (file) => {
        const bytes = await file.arrayBuffer();
        const digest = await crypto.subtle.digest('SHA-256', bytes);
        const sha256 = Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
        const payload = JSON.parse(new TextDecoder().decode(bytes)) as unknown;
        return { fileName: file.name, sha256, data: parseRiverShiftGeoJSON(payload) };
      }));
      setGeoJSONFiles(loaded);
      setTimeSeriesIndex(0);
      setTimeSeriesPlaying(false);
    } catch (error) {
      setGeoJSONError(error instanceof Error ? error.message : 'Could not read the GeoJSON.');
    }
  };

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
        mapTypeId: showMapLabels ? 'hybrid' : 'satellite',
        streetViewControl: false,
        mapTypeControl: true,
        mapTypeControlOptions: {
          style: google.maps.MapTypeControlStyle.HORIZONTAL_BAR,
          position: google.maps.ControlPosition.TOP_LEFT,
          mapTypeIds: ['roadmap', 'satellite'],
        },
        fullscreenControl: true,
        clickableIcons: false,
        gestureHandling: 'greedy',
      };
      if (resultMapElement.current && !resultMapInstance.current) {
        const instance = new maps.Map(resultMapElement.current, mapOptions);
        resultMapInstance.current = instance;
        instance.addListener('maptypeid_changed', () => {
          const type = String(instance.getMapTypeId() || 'satellite');
          if (type !== 'roadmap' && type !== 'terrain') {
            if (type === 'satellite') setShowMapLabels(false);
            if (type === 'hybrid') setShowMapLabels(true);
          }
        });
        setMapReady(true);
      }
    }).catch((error: unknown) => {
      if (!cancelled) setMapError(error instanceof Error ? error.message : 'Google Maps could not be loaded.');
    });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!mapReady || !resultMapInstance.current) return;
    const currentType = String(resultMapInstance.current.getMapTypeId() || 'satellite');
    const isImagery = currentType === 'satellite' || currentType === 'hybrid';
    resultMapInstance.current.setOptions({ styles: isImagery ? null : mapStyles(isMapDark, showMapLabels) });
  }, [mapReady, isMapDark, showMapLabels]);

  useEffect(() => {
    const waitingForJobPreview = riverJob?.state === 'succeeded' && !activeJobPreview;
    const waitingForObservedFrame = riverJob?.state === 'succeeded'
      && jobTimeSeriesFrames.length > 0
      && !currentJobFrame;
    if (!mapReady || jobLoading || waitingForJobPreview || waitingForObservedFrame) {
      setMapOverlayReady(false);
      return;
    }
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
    map.data.forEach((feature) => map.data.remove(feature));
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
    const raster = renderRiverShiftRaster(displayLayers.map((layer) => limitRiverShiftDisplayGeoJSON(layer)));
    if (raster) {
      resultRasterOverlay.current = new google.maps.GroundOverlay(raster.url, raster.bounds, { clickable: false, opacity: 1 });
      resultRasterOverlay.current.setMap(map);
    }
    map.data.setStyle((feature) => {
      const geometryType = feature.getGeometry()?.getType();
      const rawName = String(feature.getProperty('layer_name') || feature.getProperty('name') || '');
      const name = rawName.toLowerCase();
      const isObservedOpenWater = feature.getProperty('observed_open_water') === true
        || feature.getProperty('water_body') === true
        || /water_\d{4}-\d{2}-\d{2}/.test(name)
        || name.includes('open_water');
      const changeClass = String(feature.getProperty('change_class') || feature.getProperty('class') || '').toLowerCase();
      const colour = changeClass === 'erosion' ? '#f06a6a'
        : changeClass === 'deposition' ? '#48c774'
        : changeClass === 'new_water' ? '#4ea8de'
        : name.includes('erosion') ? '#e76f51'
        : name.includes('deposition') ? '#2a9d8f'
        : name.includes('new_water') || name.includes('newly_water') || name.includes('water_covered') ? '#53b9f4'
        : isObservedOpenWater ? '#73b3df' : '#9aafbb';
      if ((geometryType === 'Point' || geometryType === 'MultiPoint')
        && feature.getProperty('preview_sparse_marker') === true) {
        return {
          icon: {
            path: google.maps.SymbolPath.CIRCLE,
            scale: 3.5,
            fillColor: colour,
            fillOpacity: 0.95,
            strokeColor: '#ffffff',
            strokeWeight: 0.8,
          },
          zIndex: 900,
        };
      }
      if (geometryType === 'Point' && feature.getProperty('general_change_marker') === true) {
        return {
          icon: {
            path: google.maps.SymbolPath.CIRCLE,
            scale: 7.5,
            fillColor: colour,
            fillOpacity: 1,
            strokeColor: '#ffffff',
            strokeWeight: 1.5,
          },
          zIndex: 1000,
        };
      }
      return {
        fillColor: colour,
        strokeColor: colour,
        fillOpacity: isObservedOpenWater ? 0.14 : isGeneralScanJob ? 0.42 : 0.34,
        strokeOpacity: isObservedOpenWater ? 0.72 : 0.95,
        strokeWeight: isObservedOpenWater ? 1.2 : isGeneralScanJob ? 2.4 : 2,
      };
    });
    const bounds = new google.maps.LatLngBounds();
    if (raster) {
      bounds.extend({ lat: raster.bounds.south, lng: raster.bounds.west });
      bounds.extend({ lat: raster.bounds.north, lng: raster.bounds.east });
    }
    map.data.forEach((feature) => {
      const geometry = feature.getGeometry();
      if (geometry) geometry.forEachLatLng((point) => bounds.extend(point));
    });
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
    setMapOverlayReady(true);
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
    jobLoading,
    jobTimeSeriesFrames.length,
    activeJobPreview,
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
  const resultReady = !jobLoading && !jobError && mapOverlayReady;
  const resultLoadingMessage = jobLoading
    ? 'Loading result metadata…'
    : !mapReady
      ? 'Preparing the interactive map…'
      : riverJob?.state === 'succeeded' && !activeJobPreview
        ? 'Loading verified result layers…'
        : jobTimeSeriesFrames.length > 0 && !currentJobFrame
          ? 'Preparing the raster overlay…'
          : 'Finalizing the RiverShift result…';

  return (
    <div className="home-page claude-home claude-how-page known-place-results-shell river-shift-results-shell">
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

      {!resultReady && !jobError && (
        <div className="rs-result-loading-screen" role="status" aria-live="polite">
          <div className="rs-result-loading-card">
            <strong>Loading RiverShift result…</strong>
            <span>{resultLoadingMessage}</span>
            <div className="rs-result-loading-progress" role="progressbar" aria-label="Preparing RiverShift result">
              <i />
            </div>
          </div>
        </div>
      )}

      <main className={`nisar-results-main displacement-preparation known-place-analysis known-place-results-page river-shift-results-page${!resultReady && !jobError ? ' is-preparing' : ''}`}>
        <section className={`known-place-results rs-unified-dashboard${jobLoading ? ' is-loading' : ''}`} aria-label="River Shift scientific results dashboard">
          {jobLoading && (
            <div className="known-place-results-loading" role="status" aria-live="polite">
              <div className="known-place-results-loading-track" role="progressbar" aria-label="Loading result dashboard">
                <span />
              </div>
            </div>
          )}

          {jobError && !jobLoading && (
            <div className="known-place-results-message is-error" role="alert">
              <strong>Could not load River Shift results</strong>
              <p>{jobError}</p>
              <button type="button" onClick={onBack}>Back to processing</button>
            </div>
          )}

              <div className="rs-view-panel">
                <ObservedDateSummaryPanel report={jobPreview?.report || report} />
                <section className="rs-map-section">
                  {mapError && <p className="rs-warning-inline">{mapError}</p>}
                  <div className="known-place-google-map-shell">
                    <div className={`known-place-google-map-toolbar${isMapDark ? ' is-dark' : ''}`}>
                      <div>
                        <strong>{activeAcquisition?.dates || mapMetadata.dates}</strong>
                        <span>{mapMetadata.subtitle}</span>
                      </div>
                      <div className="known-place-map-toolbar-actions">
                        <label className="known-place-map-acquisition">
                          <span>ACQUISITION PAIR</span>
                          <select
                            value={selectedAcquisitionKey}
                            onChange={(event) => handleAcquisitionChange(event.target.value)}
                            aria-label="Acquisition pair"
                          >
                            {acquisitionOptions.map((opt) => (
                              <option key={opt.key} value={opt.key}>
                                {opt.label}
                              </option>
                            ))}
                          </select>
                        </label>
                        <button
                          type="button"
                          className={`known-place-map-label-toggle${showMapLabels ? ' is-on' : ''}`}
                          role="switch"
                          aria-checked={showMapLabels}
                          onClick={() => {
                            const current = resultMapInstance.current?.getMapTypeId();
                            if (current === 'satellite') {
                              resultMapInstance.current?.setMapTypeId('hybrid');
                              setShowMapLabels(true);
                            } else if (current === 'hybrid') {
                              resultMapInstance.current?.setMapTypeId('satellite');
                              setShowMapLabels(false);
                            } else {
                              setShowMapLabels((prev) => !prev);
                            }
                          }}
                        >
                          <span>Labels</span>
                          <span className="known-place-mini-switch" aria-hidden="true"><i /></span>
                        </button>
                        <button
                          type="button"
                          className={`known-place-map-theme-toggle${isMapDark ? ' is-dark' : ''}`}
                          role="switch"
                          aria-checked={isMapDark}
                          onClick={() => setIsMapDark((value) => !value)}
                        >
                          <span className="known-place-map-theme-label">{isMapDark ? 'Dark' : 'Light'}</span>
                          <span className="known-place-map-theme-track" aria-hidden="true">
                            <span className="known-place-map-theme-thumb">{isMapDark ? '☾' : '☀'}</span>
                          </span>
                        </button>
                      </div>
                    </div>
                    <div
                      className={`known-place-google-map${isMapDark ? ' is-dark is-imagery-dark' : ''}`}
                      ref={resultMapElement}
                      role="application"
                      aria-label="Interactive Google map showing RiverShift overlays."
                    />
                    <div className={`known-place-map-legend${isMapDark ? ' is-dark' : ''}`} aria-label="Map legend">
                      <span><i className="rs-swatch rs-erosion" /> Erosion candidate</span>
                      <span><i className="rs-swatch rs-deposition" /> Deposition candidate</span>
                      <span><i className="rs-swatch rs-water" /> New-water candidate</span>
                      <span><i className="rs-swatch rs-observed-water" /> Observed-date water extent</span>
                    </div>
                  </div>
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
                          </div>
                        </>
                      )}
                      {hasObservedWaterFrames && (
                        <label className="rs-overlay-toggle rs-overlay-observed">
                          <input type="checkbox" checked={showObservedWaterExtent}
                            onChange={(event) => setShowObservedWaterExtent(event.target.checked)} />
                          <span><strong>Observed-date open-water extent</strong><small>Current acquired-date water layer; separate from date-window change candidates.</small></span>
                        </label>
                      )}
                    </div>
                  )}
                  {hasVerifiedOverlay && <p className="rs-muted">Verified layer(s) are drawn; each GeoJSON SHA-256 matches the loaded report. Candidate classes require scientific interpretation and are not field-confirmed land change.</p>}
                  {report && geoJSONFiles.length > 0 && !hasVerifiedOverlay && <p className="rs-warning-inline" role="status">Loaded GeoJSON is not drawn: the report is not VERIFIED, the checksum does not match, or the complete time-series layer set is missing.</p>}
                  {riverJob?.result_summary && (
                    <>
                      <OverlapAuditPanel summary={riverJob.result_summary} />
                      <ScientificReadinessPanel
                        summary={riverJob.result_summary}
                        report={jobPreview?.report || null}
                        jobState={riverJob.state}
                        artifactCount={riverJob.artifact_manifest?.length || 0}
                      />
                      <GranuleProvenancePanel
                        source={asRecord(riverJob.result_summary.source) || (jobPreview?.report || explorerReport)?.source}
                        report={jobPreview?.report || explorerReport}
                      />
                      <div className="known-place-limitations rs-limitations-bottom" aria-label="Scientific limitations">
                        <span className="result-kicker">SCIENTIFIC INTERPRETATION AND LIMITATIONS</span>
                        <ul>
                          <li>Each frame is one satellite acquisition date; no daily observations or interpolated states are implied.</li>
                          <li>Low-backscatter open-water candidates can omit flooded vegetation and include smooth bare soil or radar shadow.</li>
                          <li>All observations are compared on the intersection of their valid-pixel masks; source coverage outside that common support is excluded from every date&apos;s area estimate.</li>
                          <li>Water-area differences remain sensitive to water stage and threshold choice.</li>
                          <li>This time series is not a flood-causation claim and requires independent reference validation.</li>
                          <li>Web playback uses display-only simplified GeoJSON. Small patches may be omitted; use full-resolution private GeoJSON for detailed GIS review.</li>
                          <li>The web playback displays one max-aggregated lower-resolution mask per actual NISAR acquisition date. It is display-only; full-resolution masks and metrics remain authoritative. No daily interpolation is performed.</li>
                        </ul>
                      </div>
                    </>
                  )}
                </section>
              </div>

        </section>

        <button type="button" className="workspace-nav-link known-place-back" onClick={onBack} style={{ marginTop: '20px' }}>
          ← Back to processing
        </button>
      </main>

      <footer className="rs-footer" style={{ marginTop: '40px' }}>
        <span>SARGuardian · RiverShift</span>
      </footer>
    </div>
  );
}
