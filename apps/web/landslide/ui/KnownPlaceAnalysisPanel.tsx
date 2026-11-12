import { useEffect, useMemo, useState } from 'react';
import { validatePolygonPair } from './KnownPlacePolygonEditor';
import { parsePolygonWkt } from '../engine/investigation';
import type { User } from 'firebase/auth';
import {
  cancelKnownPlaceAnalysis,
  getKnownPlaceAnalysisStatus,
  getKnownPlaceAnalysisResults,
  startKnownPlaceAnalysis,
  type KnownPlaceAnalysisInput,
  type KnownPlaceAnalysisMode,
  type KnownPlaceAnalysisRun,
  type KnownPlaceHazardMode,
} from '../../src/api/knownPlace';
import {
  hasMatchingKnownPlaceCatalogPreflight,
  knownPlaceRequestFingerprint,
} from './knownPlacePreflight';

type StoredRun = KnownPlaceAnalysisRun & { execute_downloads: boolean; request_fingerprint?: string };
type VariantOption = { key: string; releaseId: string; processing: string; granules: string[]; latest?: boolean };
type CatalogSummary = { products: number; releases: number; series: number };

type StoredCatalogState = {
  requestFingerprint: string;
  preflightRun: StoredRun | null;
  releaseIds: string[];
  variantOptions: VariantOption[];
  summary: CatalogSummary | null;
  allowedReleaseIds: string;
  preferredGranules: string;
  selectedVariantKey: string;
};

type StoredAnalysisUiState = {
  schemaVersion: 1;
  hazardMode: KnownPlaceHazardMode;
  analysisMode: KnownPlaceAnalysisMode;
  polarization: 'HH' | 'HV' | 'VV' | 'VH';
  track: string;
  direction: 'ANY' | 'A' | 'D';
  coherenceNeighbours: '1' | '5' | '10' | '15' | '20' | '25';
  geometryHeight: string;
  analysisSelectionKey?: string;
  completedAnalysisRunIds?: Record<string, string>;
  catalog: StoredCatalogState | null;
};

type CandidateTransfer = {
  schemaVersion: 'sarguardian-known-place-candidate/1.0';
  measurementWkt: string;
  candidate: {
    candidateId: string; productType: 'GOFF'; metric: string; evidenceClass: string; status: string;
    supportPairs: number; pixelCount: number; approximateAreaM2: number; productIds: string[];
    pairIntervals: Array<Record<string, unknown>>; geometryOriginalVertices: number; geometrySuggestedVertices: number;
    geometrySimplified: boolean; interpretation: string;
  };
};

function consumeCandidateTransfer(): CandidateTransfer | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.sessionStorage.getItem('sarguardian.knownPlaceCandidate.v1');
    if (!raw) return null;
    const value = JSON.parse(raw) as Partial<CandidateTransfer>;
    if (value.schemaVersion !== 'sarguardian-known-place-candidate/1.0') return null;
    if (typeof value.measurementWkt !== 'string' || !value.measurementWkt.startsWith('POLYGON')) return null;
    if (!value.candidate || value.candidate.productType !== 'GOFF' || typeof value.candidate.candidateId !== 'string') return null;
    return value as CandidateTransfer;
  } catch { return null; }
}

type Props = {
  user: User;
  aoiWkt: string | null;
  startDate: string;
  endDate: string;
  placeName: string | null;
  aoiAreaKm2: number;
  onBack: () => void;
  onShowResults: () => void;
};

const hazardModes: { value: KnownPlaceHazardMode; label: string }[] = [
  { value: 'landslide', label: 'Landslide' },
  { value: 'glacier_collapse', label: 'Glacier collapse' },
  { value: 'ice_rock_avalanche', label: 'Ice–rock avalanche' },
  { value: 'mixed', label: 'Mixed / uncertain' },
];

const analysisModes: { value: KnownPlaceAnalysisMode; label: string }[] = [
  { value: 'exploratory', label: 'Exploratory measurement' },
  { value: 'retrospective_validation', label: 'Retrospective validation' },
];

function storageKey(uid: string): string {
  return `sarguardian.knownPlaceAnalysis.v1:${uid}`;
}

function uiStorageKey(uid: string): string {
  return `sarguardian.knownPlaceAnalysisUi.v1:${uid}`;
}

function resultRequestStorageKey(uid: string): string {
  return `sarguardian.knownPlaceResultRequest.v1:${uid}`;
}

function analysisSelectionKey(releaseId: string, preferredGranules: string, variantKey: string): string {
  return JSON.stringify([releaseId.trim(), preferredGranules.trim(), variantKey]);
}

function geometryDraftKey(uid: string): string {
  return `sarguardian.knownPlaceGeometry.v1:${uid}`;
}

type GeometryDraft = { measurementWkt: string; referenceWkt: string };

function loadGeometryDraft(uid: string): GeometryDraft {
  if (typeof window === 'undefined') return { measurementWkt: '', referenceWkt: '' };
  try {
    const raw = window.localStorage.getItem(geometryDraftKey(uid));
    if (!raw) return { measurementWkt: '', referenceWkt: '' };
    const parsed = JSON.parse(raw) as Partial<GeometryDraft>;
    return {
      measurementWkt: typeof parsed.measurementWkt === 'string' ? parsed.measurementWkt : '',
      referenceWkt: typeof parsed.referenceWkt === 'string' ? parsed.referenceWkt : '',
    };
  } catch {
    return { measurementWkt: '', referenceWkt: '' };
  }
}

function samePolygonGeometry(firstWkt: string, secondWkt: string): boolean {
  try {
    const first = parsePolygonWkt(firstWkt);
    const second = parsePolygonWkt(secondWkt);
    return first.length === second.length && first.every((point, index) =>
      Math.abs(point[0] - second[index][0]) <= 1e-9
      && Math.abs(point[1] - second[index][1]) <= 1e-9,
    );
  } catch {
    return false;
  }
}


// eslint-disable-next-line react-refresh/only-export-components
export function loadStoredRun(uid: string): StoredRun | null {
  if (typeof window === 'undefined') return null;
  try {
    const value = localStorage.getItem(storageKey(uid));
    if (!value) return null;
    const parsed = JSON.parse(value) as Partial<StoredRun>;
    if (typeof parsed.request_id !== 'string' || !/^[0-9a-f-]{36}$/i.test(parsed.request_id)) return null;
    if (typeof parsed.execute_downloads !== 'boolean') return null;
    if (!['dispatching', 'queued', 'in_progress', 'completed'].includes(String(parsed.status))) return null;
    return parsed as StoredRun;
  } catch {
    return null;
  }
}

// eslint-disable-next-line react-refresh/only-export-components
export function loadKnownPlaceRunRequestId(uid: string): string | null {
  try {
    const selected = localStorage.getItem(resultRequestStorageKey(uid));
    if (selected && /^[0-9a-f-]{36}$/i.test(selected)) return selected;
  } catch { /* local storage is optional */ }
  const run = loadStoredRun(uid);
  return run?.execute_downloads === true && run.conclusion === 'success' ? run.request_id : null;
}

// eslint-disable-next-line react-refresh/only-export-components
export function loadKnownPlaceAnalysisUiState(uid: string): StoredAnalysisUiState | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(uiStorageKey(uid));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<StoredAnalysisUiState>;
    if (parsed.schemaVersion !== 1) return null;
    return parsed as StoredAnalysisUiState;
  } catch {
    return null;
  }
}

function resultLabel(run: StoredRun): string {
  if (run.status !== 'completed') return run.status === 'dispatching' ? 'Processing' : 'Processing';
  if (run.conclusion === 'success') return 'Complete';
  if (run.conclusion === 'cancelled') return 'Cancelled';
  return 'Failed';
}

function formatElapsed(startedAt: number | null, finishedAt: number | null, now: number): string {
  if (!startedAt) return '00:00';
  const end = finishedAt ?? now;
  const totalSeconds = Math.max(0, Math.floor((end - startedAt) / 1000));
  const minutes = Math.floor(totalSeconds / 60).toString().padStart(2, '0');
  const seconds = (totalSeconds % 60).toString().padStart(2, '0');
  return `${minutes}:${seconds}`;
}

type ReleaseLookupProgress = {
  percent: number;
  stage: string;
  detail: string;
  tone: 'running' | 'complete' | 'failed';
};

type AnalysisProgress = ReleaseLookupProgress & { step: number };

function getReleaseLookupProgress(pendingAction: 'dry-run' | 'analysis' | 'cancel' | null, run: StoredRun | null): ReleaseLookupProgress | null {
  if (pendingAction === 'dry-run') {
    return { percent: 8, stage: 'Starting', detail: 'Sending the catalog request…', tone: 'running' };
  }
  if (!run) return null;
  if (run.status === 'dispatching') {
    return { percent: 20, stage: 'Starting', detail: '', tone: 'running' };
  }
  if (run.status === 'queued') {
    return { percent: 38, stage: 'Queued', detail: '', tone: 'running' };
  }
  if (run.status === 'in_progress') {
    return run.execute_downloads
      ? { percent: 72, stage: 'Processing', detail: '', tone: 'running' }
      : { percent: 72, stage: 'Searching catalog', detail: '', tone: 'running' };
  }
  if (run.conclusion === 'success') {
    return { percent: 100, stage: 'Complete', detail: '', tone: 'complete' };
  }
  if (run.conclusion === 'cancelled') return null;
  return { percent: 100, stage: 'Lookup failed', detail: 'Open the workflow details, then try again.', tone: 'failed' };
}

function getAnalysisProgress(pendingAction: 'dry-run' | 'analysis' | 'cancel' | null, run: StoredRun | null): AnalysisProgress | null {
  if (pendingAction === 'analysis') return { percent: 8, stage: 'Initializing', detail: '', tone: 'running', step: 0 };
  if (!run || run.execute_downloads !== true) return null;
  if (run.status === 'dispatching') return { percent: 20, stage: 'Initializing', detail: '', tone: 'running', step: 0 };
  if (run.status === 'queued') return { percent: 38, stage: 'Processing', detail: '', tone: 'running', step: 1 };
  if (run.status === 'in_progress') return { percent: 72, stage: 'Processing', detail: '', tone: 'running', step: 1 };
  if (run.conclusion === 'success') return { percent: 100, stage: 'Complete', detail: '', tone: 'complete', step: 3 };
  if (run.conclusion === 'cancelled') return { percent: 100, stage: 'Cancelled', detail: '', tone: 'failed', step: 3 };
  return { percent: 100, stage: 'Failed', detail: '', tone: 'failed', step: 3 };
}

export function KnownPlaceAnalysisPanel({ user, aoiWkt, startDate, endDate, onBack, onShowResults }: Props) {
  const [storedUiState] = useState<StoredAnalysisUiState | null>(() => loadKnownPlaceAnalysisUiState(user.uid));
  const [hazardMode, setHazardMode] = useState<KnownPlaceHazardMode>(storedUiState?.hazardMode ?? 'mixed');
  const [analysisMode, setAnalysisMode] = useState<KnownPlaceAnalysisMode>(storedUiState?.analysisMode ?? 'exploratory');
  const [polarization, setPolarization] = useState<'HH' | 'HV' | 'VV' | 'VH'>(storedUiState?.polarization ?? 'HH');
  const [track, setTrack] = useState(storedUiState?.track ?? 'ANY');
  const [direction, setDirection] = useState<'ANY' | 'A' | 'D'>(storedUiState?.direction ?? 'ANY');
  const [coherenceNeighbours, setCoherenceNeighbours] = useState<'1' | '5' | '10' | '15' | '20' | '25'>(storedUiState?.coherenceNeighbours ?? '1');
  const [allowedReleaseIds, setAllowedReleaseIds] = useState(storedUiState?.catalog?.allowedReleaseIds ?? '');
  const [preferredGranules, setPreferredGranules] = useState(storedUiState?.catalog?.preferredGranules ?? '');
  const [selectedVariantKey, setSelectedVariantKey] = useState(storedUiState?.catalog?.selectedVariantKey ?? '');
  const [candidateTransfer] = useState<CandidateTransfer | null>(() => consumeCandidateTransfer());
  const [geometryDraft] = useState<GeometryDraft>(() => loadGeometryDraft(user.uid));
  const measurementWkt = candidateTransfer?.measurementWkt || geometryDraft.measurementWkt || '';
  const referenceWkt = geometryDraft.referenceWkt;
  const [polygonValidation, setPolygonValidation] = useState({ valid: false, message: 'Draw and close the Measurement and Reference Polygons. The Reference may enclose the Measurement; partial overlap is invalid.' });
  const [geometryHeight, setGeometryHeight] = useState(storedUiState?.geometryHeight ?? '');
  const [completedAnalysisSelectionKey, setCompletedAnalysisSelectionKey] = useState(
    storedUiState?.analysisSelectionKey
      ?? analysisSelectionKey(storedUiState?.catalog?.allowedReleaseIds ?? '', storedUiState?.catalog?.preferredGranules ?? '', storedUiState?.catalog?.selectedVariantKey ?? ''),
  );
  const [completedAnalysisRunIds, setCompletedAnalysisRunIds] = useState<Record<string, string>>(storedUiState?.completedAnalysisRunIds ?? {});
  const [pendingAction, setPendingAction] = useState<'dry-run' | 'analysis' | 'cancel' | null>(null);
  const [run, setRun] = useState<StoredRun | null>(() => loadStoredRun(user.uid));
  const [catalogFingerprint, setCatalogFingerprint] = useState(storedUiState?.catalog?.requestFingerprint ?? '');
  const [catalogPreflightRun, setCatalogPreflightRun] = useState<StoredRun | null>(storedUiState?.catalog?.preflightRun ?? null);
  const [catalogReleaseIds, setCatalogReleaseIds] = useState<string[]>(storedUiState?.catalog?.releaseIds ?? []);
  const [catalogVariantOptions, setCatalogVariantOptions] = useState<VariantOption[]>(storedUiState?.catalog?.variantOptions ?? []);
  const [catalogSummary, setCatalogSummary] = useState<CatalogSummary | null>(storedUiState?.catalog?.summary ?? null);
  const [catalogReleaseError, setCatalogReleaseError] = useState('');
  const [error, setError] = useState('');
  const [pollError, setPollError] = useState('');
  const [lookupStartedAt, setLookupStartedAt] = useState<number | null>(null);
  const [clock, setClock] = useState(() => Date.now());
  const invalidateCatalogSelection = () => {
    setCatalogFingerprint('');
    setCatalogPreflightRun(null);
    setCompletedAnalysisSelectionKey('');
    setCompletedAnalysisRunIds({});
    setCatalogReleaseError('');
    setError('');
    setPollError('');
    setLookupStartedAt(null);
  };
  const createAnalysisInput = (executeDownloads: boolean): KnownPlaceAnalysisInput => ({
    aoi_wkt: measurementWkt,
    scope_aoi_wkt: aoiWkt || '',
    start_date: startDate,
    end_date: endDate,
    hazard_mode: hazardMode,
    analysis_mode: analysisMode,
    polarization,
    track: track.trim().toUpperCase(),
    direction,
    coherence_neighbours: coherenceNeighbours,
    allowed_release_ids: allowedReleaseIds.trim(),
    preferred_granules: preferredGranules.trim(),
    reference_wkt: referenceWkt,
    candidate_context: candidateTransfer ? {
      source: 'FIND_DISPLACEMENTS',
      candidate_id: candidateTransfer.candidate.candidateId,
      product_type: 'GOFF',
      metric: candidateTransfer.candidate.metric,
      evidence_class: candidateTransfer.candidate.evidenceClass,
      status: candidateTransfer.candidate.status,
      support_pairs: candidateTransfer.candidate.supportPairs,
      pixel_count: candidateTransfer.candidate.pixelCount,
      approx_area_m2: candidateTransfer.candidate.approximateAreaM2,
      product_ids: candidateTransfer.candidate.productIds,
      pair_intervals: candidateTransfer.candidate.pairIntervals,
      geometry_original_vertices: candidateTransfer.candidate.geometryOriginalVertices,
      geometry_suggested_vertices: candidateTransfer.candidate.geometrySuggestedVertices,
      geometry_simplified: candidateTransfer.candidate.geometrySimplified,
      geometry_edited: !samePolygonGeometry(measurementWkt, candidateTransfer.measurementWkt),
      interpretation: candidateTransfer.candidate.interpretation,
    } : null,
    geometry_height_m: geometryHeight.trim() ? Number(geometryHeight) : null,
    execute_downloads: executeDownloads,
    confirm_raw_downloads: executeDownloads,
  });
  const currentRequestFingerprint = knownPlaceRequestFingerprint(createAnalysisInput(false));
  // Persisted runs belong to the exact geometry/date/settings fingerprint that
  // created them. A changed setup must not resurrect an older completed run.
  const activeRun = run?.request_fingerprint === currentRequestFingerprint ? run : null;
  const catalogMatchesCurrentRequest = catalogFingerprint === currentRequestFingerprint;
  const currentDryRun = activeRun?.execute_downloads === false ? activeRun : null;
  const catalogEvidenceRun = currentDryRun ?? (catalogMatchesCurrentRequest ? catalogPreflightRun : null);
  const catalogPreflightReady = hasMatchingKnownPlaceCatalogPreflight(catalogEvidenceRun, currentRequestFingerprint);
  const canSubmitGeometry = Boolean(measurementWkt && referenceWkt && polygonValidation.valid);

  useEffect(() => {
    if (!measurementWkt || !referenceWkt) {
      setPolygonValidation({ valid: false, message: 'Return to the setup page and confirm all three polygons first.' });
      return;
    }
    try {
      setPolygonValidation(validatePolygonPair(null, parsePolygonWkt(measurementWkt), parsePolygonWkt(referenceWkt), true, true));
    } catch {
      setPolygonValidation({ valid: false, message: 'Saved polygon geometry is invalid. Return to the setup page and redraw the polygons.' });
    }
  }, [measurementWkt, referenceWkt]);

  useEffect(() => {
    try {
      if (!measurementWkt && !referenceWkt) {
        localStorage.removeItem(geometryDraftKey(user.uid));
      } else {
        localStorage.setItem(geometryDraftKey(user.uid), JSON.stringify({ measurementWkt, referenceWkt }));
      }
    } catch { /* local storage is optional; current component state remains authoritative */ }
  }, [measurementWkt, referenceWkt, user.uid]);

  useEffect(() => {
    if (!run) return;
    try { localStorage.setItem(storageKey(user.uid), JSON.stringify(run)); } catch { /* local storage is optional */ }
  }, [run, user.uid]);

  useEffect(() => {
    const hasCatalogState = Boolean(catalogFingerprint || catalogReleaseIds.length > 0 || catalogVariantOptions.length > 0 || catalogSummary || allowedReleaseIds || preferredGranules);
    const catalog: StoredCatalogState | null = hasCatalogState ? {
      requestFingerprint: catalogFingerprint,
      preflightRun: catalogPreflightRun,
      releaseIds: catalogReleaseIds,
      variantOptions: catalogVariantOptions,
      summary: catalogSummary,
      allowedReleaseIds,
      preferredGranules,
      selectedVariantKey,
    } : null;
    const uiState: StoredAnalysisUiState = {
      schemaVersion: 1,
      hazardMode,
      analysisMode,
      polarization,
      track,
      direction,
      coherenceNeighbours,
      geometryHeight,
      analysisSelectionKey: completedAnalysisSelectionKey,
      completedAnalysisRunIds,
      catalog,
    };
    try { localStorage.setItem(uiStorageKey(user.uid), JSON.stringify(uiState)); } catch { /* optional browser storage */ }
  }, [allowedReleaseIds, analysisMode, catalogFingerprint, catalogPreflightRun, catalogReleaseIds, catalogSummary, catalogVariantOptions, coherenceNeighbours, completedAnalysisRunIds, completedAnalysisSelectionKey, direction, geometryHeight, hazardMode, polarization, preferredGranules, selectedVariantKey, track, user.uid]);

  const runRequestId = activeRun?.request_id ?? null;
  const runStatus = activeRun?.status ?? null;

  useEffect(() => {
    const requestId = runRequestId;
    if (!requestId || runStatus === 'completed') return undefined;
    let active = true;
    let timeoutId: number | undefined;
    const poll = async () => {
      try {
        const next = await getKnownPlaceAnalysisStatus(requestId, user);
        if (!active) return;
        setPollError('');
        setRun((current) => current && current.request_id === next.request_id
          ? { ...current, ...next, execute_downloads: current.execute_downloads }
          : current);
        if (next.status !== 'completed' && active) timeoutId = window.setTimeout(poll, 3500);
      } catch (statusError) {
        if (!active) return;
        setPollError(statusError instanceof Error ? statusError.message : 'Could not refresh this run yet.');
        timeoutId = window.setTimeout(poll, 8000);
      }
    };
    timeoutId = window.setTimeout(poll, 1200);
    return () => {
      active = false;
      if (timeoutId !== undefined) window.clearTimeout(timeoutId);
    };
  }, [runRequestId, runStatus, user]);

  useEffect(() => {
    if (!activeRun) return undefined;
    // Keep the verified release options visible while the subsequent raw
    // analysis run is processing.
    if (activeRun.execute_downloads !== false) return undefined;
    if (activeRun.status !== 'completed' || activeRun.conclusion !== 'success') return undefined;
    let active = true;
    setCatalogFingerprint(currentRequestFingerprint);
    setCatalogPreflightRun(activeRun);
    setCatalogReleaseIds([]);
    setCatalogVariantOptions([]);
    setCatalogSummary(null);
    setCatalogReleaseError('');
    void getKnownPlaceAnalysisResults(activeRun.request_id, user)
      .then((payload) => {
        if (!active) return;
        const ids = Array.from(new Set(
          [
            ...(payload.result.pairwise_series_plan.candidate_release_ids || []),
            ...payload.result.pairwise_series_plan.chains.map((chain) => chain.release_id),
          ]
            .filter((releaseId): releaseId is string => Boolean(releaseId)),
        ));
        setCatalogReleaseIds(ids);
        const diagnostics = payload.result.pairwise_series_plan.selection_diagnostics;
        const granules = Array.from(new Set(
          (diagnostics?.ambiguous_pairs || []).flatMap((pair) => pair.candidate_granules || []),
        ));
        const variants = new Map<string, VariantOption>();
        for (const granule of granules) {
          const match = /^NISAR_L2_([A-Z]{2})_GOFF_/.exec(granule);
          if (!match) continue;
          const processing = match[1];
          // A diagnostics payload can contain multiple release IDs in the
          // same processing variant. Pin only granules belonging to the
          // release option the user selected, never the whole PR/UR set.
          const releaseMatches = Array.from(granule.matchAll(/_([A-Z]\d{5})_/g)).map((item) => item[1]);
          const releaseId = releaseMatches.length ? releaseMatches[releaseMatches.length - 1] : (ids[0] || '');
          const key = `${releaseId}::${processing}`;
          const current: VariantOption = variants.get(key) || { key, releaseId, processing, granules: [] };
          current.granules.push(granule);
          variants.set(key, current);
        }
        // Successful, unambiguous dry runs expose the selected processing
        // identity on their chains rather than in ambiguity diagnostics.
        for (const chain of payload.result.pairwise_series_plan.chains || []) {
          const processing = (chain.processing || '').toUpperCase();
          const releaseId = chain.release_id || '';
          if (!processing || !releaseId) continue;
          const key = `${releaseId}::${processing}`;
          const current: VariantOption = variants.get(key) || { key, releaseId, processing, granules: [] };
          for (const pair of chain.pairs || []) {
            if (pair.granule_name && !current.granules.includes(pair.granule_name)) current.granules.push(pair.granule_name);
          }
          variants.set(key, current);
        }
        const variantOptions = Array.from(variants.values()).sort((a, b) => a.processing.localeCompare(b.processing));
        const latestGranuleTimestamp = (granule: string): string => {
          const timestamps = Array.from(granule.matchAll(/_(\d{8}T\d{6})/g)).map((match) => match[1]);
          const sorted = timestamps.sort();
          return sorted[sorted.length - 1] || '';
        };
        const allTimestamps = variantOptions.flatMap((option) => option.granules.map(latestGranuleTimestamp)).sort();
        const latestTimestamp = allTimestamps[allTimestamps.length - 1] || '';
        for (const option of variantOptions) {
          option.latest = Boolean(latestTimestamp && option.granules.some((granule) => latestGranuleTimestamp(granule) === latestTimestamp));
        }
        const plannedGranules = new Set([
          ...granules,
          ...(payload.result.pairwise_series_plan.chains || []).flatMap((chain) =>
            (chain.pairs || []).map((pair) => pair.granule_name).filter((name): name is string => Boolean(name)),
          ),
        ]);
        setCatalogVariantOptions(variantOptions);
        setCatalogSummary({
          products: plannedGranules.size,
          releases: ids.length,
          series: payload.result.pairwise_series_plan.chain_count || 0,
        });
      })
      .catch((reason: unknown) => {
        if (active) setCatalogReleaseError(reason instanceof Error ? reason.message : 'Release IDs are available in the result bundle.');
      });
    return () => { active = false; };
  }, [activeRun, currentRequestFingerprint, user]);

  useEffect(() => {
    if (!activeRun || activeRun.execute_downloads !== true || activeRun.status !== 'completed' || activeRun.conclusion !== 'success' || !completedAnalysisSelectionKey) return;
    setCompletedAnalysisRunIds((current) => current[completedAnalysisSelectionKey] === activeRun.request_id
      ? current
      : { ...current, [completedAnalysisSelectionKey]: activeRun.request_id });
  }, [activeRun, completedAnalysisSelectionKey]);

  const submit = async (executeDownloads: boolean) => {
    if (!startDate || !endDate) {
      setError('Return to the setup page and choose a valid date window first.');
      return;
    }
    if (!measurementWkt || !referenceWkt || !polygonValidation.valid) {
      setError(polygonValidation.message || 'Draw and validate the Measurement and Reference polygons before submitting. The Reference may be a larger enclosing region; partial overlap is invalid.');
      return;
    }
    if (executeDownloads && !catalogPreflightReady) {
      setError('Run a successful catalog-only dry run for these exact polygons, dates and processing settings first, then select one of its release IDs.');
      return;
    }
    if (executeDownloads && catalogReleaseIds.length > 0 && !allowedReleaseIds.trim()) {
      setError('Select one release ID from the successful dry-run result before starting the raw GOFF measurement.');
      return;
    }
    if (executeDownloads && catalogVariantOptions.length > 0 && !catalogVariantOptions.some((option) => option.key === selectedVariantKey && option.releaseId === allowedReleaseIds.trim())) {
      setError('Select one release and processing variant from the successful dry-run result before starting the raw GOFF measurement.');
      return;
    }
    if (executeDownloads && catalogVariantOptions.some((option) => option.granules.length > 0) && !preferredGranules.trim()) {
      setError('Select one processing variant (PR or UR) from the successful dry-run result before starting the raw GOFF measurement.');
      return;
    }
    if (track.trim().toUpperCase() !== 'ANY' && !/^\d{3}$/.test(track.trim())) {
      setError('Track must be ANY or an exact three-digit value such as 098.');
      return;
    }
    const height = geometryHeight.trim() ? Number(geometryHeight) : null;
    if (height !== null && (!Number.isFinite(height) || height < -500 || height > 100000)) {
      setError('Enter a finite ellipsoidal height between −500 and 100,000 metres, or leave it blank.');
      return;
    }
    setPendingAction(executeDownloads ? 'analysis' : 'dry-run');
    setLookupStartedAt(Date.now());
    setError('');
    setPollError('');
    try {
      const analysisInput = {
        ...createAnalysisInput(executeDownloads),
        geometry_height_m: height,
        // A new catalog dry run must discover candidates for the current
        // polygons/date window; never carry an older pinned release/variant
        // into that discovery request.
        ...(executeDownloads ? {} : {
          allowed_release_ids: '',
          preferred_granules: '',
        }),
      };
      const requestFingerprint = knownPlaceRequestFingerprint(analysisInput);
      const submitted = await startKnownPlaceAnalysis(analysisInput, user);
      setRun({
        ...submitted,
        execute_downloads: executeDownloads,
        request_fingerprint: requestFingerprint,
      });
      setCompletedAnalysisSelectionKey(executeDownloads
        ? analysisSelectionKey(allowedReleaseIds, preferredGranules, selectedVariantKey)
        : '');
      if (!executeDownloads) setCompletedAnalysisRunIds({});
      if (!executeDownloads) {
        setCatalogFingerprint(requestFingerprint);
        setCatalogPreflightRun(null);
        setCatalogReleaseIds([]);
        setCatalogVariantOptions([]);
        setCatalogSummary(null);
        setAllowedReleaseIds('');
        setPreferredGranules('');
        setSelectedVariantKey('');
      }
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Could not submit Known Place Analysis.');
    } finally {
      setPendingAction(null);
    }
  };

  const cancelRun = async () => {
    if (!run || run.status === 'completed' || pendingAction !== null) return;
    setPendingAction('cancel');
    setError('');
    try {
      const cancelled = await cancelKnownPlaceAnalysis(run.request_id, user);
      setRun((current) => current ? { ...current, ...cancelled, execute_downloads: current.execute_downloads } : current);
    } catch (cancelError) {
      setError(cancelError instanceof Error ? cancelError.message : 'Could not cancel this analysis.');
    } finally {
      setPendingAction(null);
    }
  };

  const runTerminal = activeRun?.status === 'completed';
  const selectedAnalysisSelectionKey = analysisSelectionKey(allowedReleaseIds, preferredGranules, selectedVariantKey);
  const historicalAnalysisRequestId = catalogMatchesCurrentRequest ? completedAnalysisRunIds[selectedAnalysisSelectionKey] ?? null : null;
  const runSucceeded = (runTerminal
    && activeRun?.execute_downloads === true
    && activeRun.conclusion === 'success'
    && completedAnalysisSelectionKey === selectedAnalysisSelectionKey)
    || Boolean(historicalAnalysisRequestId);
  const selectedResultRequestId = historicalAnalysisRequestId ?? (runSucceeded && activeRun?.request_id ? activeRun.request_id : null);
  const runCancelled = runTerminal && activeRun?.conclusion === 'cancelled';
  const releaseLookupProgress = useMemo(() => getReleaseLookupProgress(pendingAction, activeRun), [pendingAction, activeRun]);
  const analysisProgress = useMemo(() => getAnalysisProgress(pendingAction, activeRun), [pendingAction, activeRun]);
  const catalogSelectionAvailable = Boolean(catalogSummary || catalogReleaseIds.length > 0);
  const releaseDisplayProgress = useMemo(() => analysisProgress
    ? (catalogSelectionAvailable ? { percent: 100, stage: 'Release ready', detail: '', tone: 'complete' as const } : null)
    : releaseLookupProgress, [analysisProgress, catalogSelectionAvailable, releaseLookupProgress]);
  const releasePanelProgress = releaseDisplayProgress ?? (catalogSelectionAvailable
    ? { percent: 100, stage: 'Release selected', detail: '', tone: 'complete' as const }
    : null);
  const lookupStarted = lookupStartedAt ?? (activeRun?.created_at ? Date.parse(activeRun.created_at) : null);
  const lookupFinished = runTerminal && activeRun?.updated_at ? Date.parse(activeRun.updated_at) : null;
  const elapsed = formatElapsed(lookupStarted, lookupFinished, clock);
  const analysisProcessingState = analysisProgress?.tone === 'complete'
    ? 'succeeded'
    : analysisProgress?.tone === 'failed'
      ? 'failed'
      : 'running';

  useEffect(() => {
    if (!releaseDisplayProgress && !analysisProgress) return undefined;
    const interval = window.setInterval(() => setClock(Date.now()), 1000);
    return () => window.clearInterval(interval);
  }, [releaseDisplayProgress, analysisProgress]);

  return (
    <main className="nisar-results-main displacement-preparation known-place-analysis">
        <section className="known-place-custom-measurement" aria-label="Known Place custom measurement">
        {candidateTransfer && <div className="catalog-notice known-place-candidate-handoff" role="status">
          <strong>Suggested Measurement Polygon imported from Find Displacements</strong>
          <span>{candidateTransfer.candidate.candidateId} · GOFF offset-anomaly candidate · {candidateTransfer.candidate.supportPairs} supporting pair(s) · {candidateTransfer.candidate.pixelCount} pixels</span>
          <span>{candidateTransfer.candidate.geometrySimplified ? `Boundary simplified from ${candidateTransfer.candidate.geometryOriginalVertices} to ${candidateTransfer.candidate.geometrySuggestedVertices} vertices; inspect and edit it before measurement.` : `${candidateTransfer.candidate.geometrySuggestedVertices} boundary vertices transferred; inspect and edit before measurement.`}</span>
          <span>Candidate evidence is not measured ground motion or a confirmed landslide. Draw a background polygon that is either disjoint from or fully encloses the proposed measurement area; partial overlap and boundary-touch are rejected.</span>
        </div>}
        <details className="known-place-additional-settings">
          <summary>Additional settings</summary>
          <div className="known-place-form-grid">
          <label className="aoi-job-label">
            <span>Hazard context</span>
            <select value={hazardMode} onChange={(event) => { setHazardMode(event.target.value as KnownPlaceHazardMode); invalidateCatalogSelection(); }}>
              {hazardModes.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
          </label>
          <label className="aoi-job-label">
            <span>Analysis mode</span>
            <select value={analysisMode} onChange={(event) => { setAnalysisMode(event.target.value as KnownPlaceAnalysisMode); invalidateCatalogSelection(); }}>
              {analysisModes.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
          </label>
          <label className="aoi-job-label">
            <span>Polarization</span>
            <select value={polarization} onChange={(event) => { setPolarization(event.target.value as 'HH' | 'HV' | 'VV' | 'VH'); invalidateCatalogSelection(); }}>
              {(['HH', 'HV', 'VV', 'VH'] as const).map((value) => <option key={value}>{value}</option>)}
            </select>
          </label>
          <label className="aoi-job-label">
            <span>Track</span>
            <input value={track} onChange={(event) => { setTrack(event.target.value); invalidateCatalogSelection(); }} maxLength={3} placeholder="ANY or 098" autoComplete="off" />
          </label>
          <label className="aoi-job-label">
            <span>Flight direction</span>
            <select value={direction} onChange={(event) => { setDirection(event.target.value as 'ANY' | 'A' | 'D'); invalidateCatalogSelection(); }}>
              <option value="ANY">Any — keep orbit chains separate</option>
              <option value="A">Ascending</option>
              <option value="D">Descending</option>
            </select>
          </label>
          <label className="aoi-job-label">
            <span>Minimum valid coherence neighbours</span>
            <select value={coherenceNeighbours} onChange={(event) => { setCoherenceNeighbours(event.target.value as typeof coherenceNeighbours); invalidateCatalogSelection(); }}>
              {(['1', '5', '10', '15', '20', '25'] as const).map((value) => <option key={value} value={value}>{value}</option>)}
            </select>
          </label>
          <label className="aoi-job-label known-place-setting-wide">
            <span>Constant ellipsoidal height in metres (optional sensitivity only)</span>
            <input type="number" value={geometryHeight} onChange={(event) => { setGeometryHeight(event.target.value); invalidateCatalogSelection(); }} min={-500} max={100000} step="any" placeholder="Blank = documented approximation" />
          </label>
          </div>
        </details>

        <section className="known-place-run-options" aria-label="Known Place run options">
          <div className="known-place-release-finder">
            <p className="known-place-choose-release" role="status">Choose a release ID before analysis.</p>
            <button type="button" className="demo-button known-place-find-release" disabled={!canSubmitGeometry || pendingAction !== null} onClick={() => void submit(false)}>
              {pendingAction === 'dry-run' ? 'Finding release ID…' : 'Find release ID'}
            </button>
          </div>
          {releasePanelProgress && <section className={`known-place-release-progress is-${releasePanelProgress.tone}`} aria-live="polite">
              <div className="known-place-status-heading">
                <h2>Run status</h2>
                <div className="known-place-status-actions">
                  {activeRun && activeRun.status !== 'completed' && <button type="button" className="known-place-cancel" disabled={pendingAction !== null} onClick={() => void cancelRun()}>{pendingAction === 'cancel' ? 'Cancelling…' : 'Cancel run'}</button>}
                  <span className={`known-place-status-chip is-${releasePanelProgress.tone}`}><i />{releasePanelProgress.tone === 'complete' ? 'Complete' : activeRun ? resultLabel(activeRun) : 'Processing'}</span>
                </div>
              </div>
              <div
                className="known-place-progress-track"
                role="progressbar"
                aria-label="Release ID lookup progress"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={releasePanelProgress.percent}
                aria-valuetext={releasePanelProgress.stage}
              >
                <i style={{ width: `${releasePanelProgress.percent}%` }} />
              </div>
              <div className="known-place-progress-meta">
                <span>{runCancelled && !analysisProgress ? 'Cancelled' : releasePanelProgress.tone === 'complete' ? 'Complete' : releasePanelProgress.tone === 'failed' ? 'Failed' : 'Processing'}</span>
                <b>{releasePanelProgress.percent}% · {elapsed}</b>
              </div>
              {runCancelled && !analysisProgress ? <p className="known-place-progress-message">Run cancelled.</p> : releasePanelProgress.tone === 'failed' ? <p className="known-place-progress-message">Release lookup failed. Try again.</p> : releasePanelProgress.detail ? <p className="known-place-progress-message">{releasePanelProgress.detail}</p> : null}
              {catalogSelectionAvailable && !catalogMatchesCurrentRequest && <p className="known-place-progress-message">Settings changed. Find release ID again to refresh this selection.</p>}
              {pollError && !runTerminal && <p className="action-hint" role="status">{pollError} Automatic status checks will retry.</p>}
              {catalogSummary && <div className="known-place-catalog-summary" aria-label="Catalog lookup summary">
                <div><span>Products found</span><strong>{catalogSummary.products}</strong></div>
                <div><span>Releases</span><strong>{catalogSummary.releases}</strong></div>
                <div><span>Series planned</span><strong>{catalogSummary.series}</strong></div>
              </div>}
              {catalogSelectionAvailable && <div className="known-place-release-results">
                <h3>Select a release</h3>
                {catalogReleaseIds.length > 0 ? <div className="catalog-release-options" role="radiogroup" aria-label="Release and processing variants found by the catalog dry run">
                  {catalogVariantOptions.length > 0 ? catalogVariantOptions.map((option) => <label key={option.key}>
                    <input type="radio" name="known-place-release" value={option.key} checked={selectedVariantKey === option.key} onChange={() => { setSelectedVariantKey(option.key); setAllowedReleaseIds(option.releaseId); setPreferredGranules(option.granules.join(',')); }} />
                    <span>{option.releaseId} — {option.processing}{option.latest ? ' · Latest' : ''}</span>
                    <small>{option.granules.length} product{option.granules.length === 1 ? '' : 's'}</small>
                  </label>) : catalogReleaseIds.map((releaseId) => <label key={releaseId}>
                    <input type="radio" name="known-place-release" value={releaseId} checked={allowedReleaseIds === releaseId} onChange={() => setAllowedReleaseIds(releaseId)} />
                    <span>{releaseId}</span>
                  </label>)}
                </div> : <p className="known-place-release-loading">{catalogReleaseError || 'Loading release IDs from the verified dry-run result…'}</p>}
              </div>}
          </section>}
          {error && <p className="catalog-error" role="alert">{error}</p>}
        </section>

        {analysisProgress && <section className={`processing-card processing-hero processing-page--${analysisProcessingState}`} aria-live="polite">
          <div className="processing-status-chip-wrap">
            <span className={`processing-status-chip ${analysisProcessingState === 'running' ? 'is-running' : ''}`}>
              <i aria-hidden="true" />
              {analysisProcessingState === 'succeeded' ? 'Complete' : analysisProcessingState === 'failed' ? (runCancelled ? 'Cancelled' : 'Failed') : 'Running'}
            </span>
            <div className="known-place-status-actions">
              {activeRun && !runTerminal && <button type="button" className="known-place-cancel" disabled={pendingAction !== null} onClick={() => void cancelRun()}>{pendingAction === 'cancel' ? 'Cancelling…' : 'Cancel run'}</button>}
              <span className={`known-place-status-chip is-${analysisProgress.tone}`}><i />{analysisProgress.tone === 'complete' ? 'Complete' : analysisProgress.tone === 'failed' ? (runCancelled ? 'Cancelled' : 'Failed') : 'Running'}</span>
            </div>
          </div>
          <div className={`processing-orbit ${analysisProcessingState === 'running' ? 'is-active' : ''}`} aria-label={`${analysisProgress.stage}, elapsed ${elapsed}`}>
            <div className="processing-orbit-inner">
              {analysisProcessingState === 'succeeded' ? <span className="processing-orbit-symbol processing-orbit-label" aria-hidden="true">Success</span> : analysisProcessingState === 'failed' ? <span className="processing-orbit-symbol processing-orbit-label" aria-hidden="true">Failed</span> : <><strong>{analysisProgress.stage}</strong><time>{elapsed}</time></>}
            </div>
          </div>
          <ol className="processing-stepper" aria-label="Known Place analysis stages">
            {['Initializing', 'Processing', 'Screening', 'Complete'].map((label, index) => <li key={label} className={analysisProcessingState === 'failed' && index === analysisProgress.step ? 'is-failed' : index < analysisProgress.step ? 'is-complete' : index === analysisProgress.step ? 'is-current' : ''}><i aria-hidden="true" /><span>{label}</span></li>)}
          </ol>
          <p className="processing-safe-note">{analysisProcessingState === 'running' ? 'Safe to close this page. Your task keeps running.' : analysisProcessingState === 'succeeded' ? 'The processing job has ended. Review the Known Place outputs.' : 'The processing workflow stopped before successful completion.'}</p>
          <p className="processing-duration-note">It may take up to 5 to 20 minutes depending on AOI and time window.</p>
          <div className="known-place-progress-meta"><span>{analysisProgress.stage}</span><b>{analysisProgress.percent}% · {elapsed}</b></div>
        </section>}

        {runSucceeded && selectedResultRequestId && (
          <button type="button" className="investigate-button known-place-show-results" onClick={() => {
            try { localStorage.setItem(resultRequestStorageKey(user.uid), selectedResultRequestId); } catch { /* optional local storage */ }
            onShowResults();
          }}>Show result</button>
        )}
        </section>
        {(!analysisProgress || (runTerminal && !runSucceeded)) && <div className="known-place-run-action">
          <button type="button" className="investigate-button" disabled={!canSubmitGeometry || !catalogPreflightReady || pendingAction !== null} onClick={() => void submit(true)}>
            {pendingAction === 'analysis' ? 'Starting GOFF analysis…' : runTerminal && !runSucceeded ? 'Run analysis' : 'Run Known Place Analysis'}
          </button>
        </div>}
        <button type="button" className="workspace-nav-link known-place-back" onClick={onBack}>← Back to AOI map</button>
    </main>
  );
}
