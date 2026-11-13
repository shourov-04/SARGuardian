import { useEffect, useRef, useState } from 'react';
import type { User } from 'firebase/auth';
import { cancelRiverShiftJob, createRiverShiftJob, getRiverShiftJob, listRiverShiftJobs, retryRiverShiftJob, type RiverShiftJob } from '../api/catalog';
import { Header } from '../components/Header';
import { RIVER_SHIFT_SETUP_STORAGE_KEY, type RiverShiftSetup } from './RiverShiftPage';
import './river-shift.css';
import '../../landslide/ui/displacementPreparation.css';
import { ELAPSED_TICK_MS, formatElapsed } from '../../landslide/ui/processingStatus';
import { ProcessingPageSkeleton } from '../../landslide/ui/DisplacementPreparation';

type Props = {
  user: User | null;
  authState: 'idle' | 'loading' | 'ready' | 'error';
  onSignIn: () => Promise<void>;
  onSignOut: () => Promise<void>;
  onBack?: () => void;
  onViewResults?: () => void;
};

function loadRiverShiftSetup(): RiverShiftSetup | null {
  try {
    const parsed = JSON.parse(window.sessionStorage.getItem(RIVER_SHIFT_SETUP_STORAGE_KEY) || 'null') as Partial<RiverShiftSetup> | null;
    return parsed && typeof parsed.aoiWkt === 'string' && typeof parsed.startDate === 'string' && typeof parsed.endDate === 'string'
      ? parsed as RiverShiftSetup
      : null;
  } catch {
    return null;
  }
}

function riverShiftSignature(aoiWkt: string, startDate: string, endDate: string): string {
  return `${aoiWkt.trim().replace(/\s+/g, ' ').replace(/\s*([(),])\s*/g, '$1').toUpperCase()}|${startDate}|${endDate}`;
}

function setupForJob(job: RiverShiftJob): RiverShiftSetup {
  return { aoiWkt: job.aoi_wkt, startDate: job.start_date, endDate: job.end_date };
}

function signaturesMatch(setup: RiverShiftSetup | null, job: RiverShiftJob | null): boolean {
  return Boolean(setup && job && riverShiftSignature(setup.aoiWkt, setup.startDate, setup.endDate) === riverShiftSignature(job.aoi_wkt, job.start_date, job.end_date));
}

const activeRiverShiftStates = new Set(['queued', 'dispatching', 'running']);

type RiverShiftSettings = {
  analysisMode: 'general_scan' | 'event_based';
  eventDate: string;
  maturity: 'BETA' | 'PROVISIONAL';
  polarization: '' | 'HH' | 'HH+HV' | 'HH+HV+VH+VV' | 'VV' | 'VV+VH' | 'LH+LV' | 'RH+RV';
  direction: '' | 'ASCENDING' | 'DESCENDING';
  frameCoverage: 'ALL' | 'FULL' | 'PARTIAL';
  scienceFrequency: 'frequencyA' | 'frequencyB';
  covarianceTerm: string;
  thresholdMethod: 'otsu' | 'manual';
  thresholdDb: string;
};

const defaultRiverShiftSettings: RiverShiftSettings = {
  analysisMode: 'general_scan',
  eventDate: '',
  maturity: 'PROVISIONAL',
  polarization: '',
  direction: '',
  frameCoverage: 'ALL',
  scienceFrequency: 'frequencyA',
  covarianceTerm: 'HHHH',
  thresholdMethod: 'otsu',
  thresholdDb: '',
};

function riverShiftStageName(stage: string, state: RiverShiftJob['state']): string {
  const normalized = stage.trim().toLowerCase();
  if (state === 'succeeded') return 'Complete';
  if (state === 'failed' || state === 'cancelled') return 'Needs attention';
  if (normalized.includes('screen') || normalized.includes('result') || normalized.includes('assemble') || normalized.includes('assembly')) return 'Screening';
  if (normalized.includes('product') || normalized.includes('process') || normalized.includes('download') || normalized.includes('granule') || normalized.includes('batch') || normalized.includes('hdf5') || normalized.includes('inspection')) return 'Processing';
  return state === 'queued' || state === 'dispatching' ? 'Preparing task' : 'Initializing';
}

function riverShiftStageIndex(job: RiverShiftJob): number {
  const stage = job.stage.trim().toLowerCase();
  if (job.state === 'succeeded') return 3;
  if (stage.includes('screen') || stage.includes('result') || stage.includes('assemble') || stage.includes('assembly')) return 2;
  if (stage.includes('product') || stage.includes('process') || stage.includes('download') || stage.includes('granule') || stage.includes('batch') || stage.includes('hdf5') || stage.includes('inspection')) return 1;
  return 0;
}

function riverShiftFailedStageIndex(job: RiverShiftJob): number {
  if (job.state !== 'failed') return -1;
  const stage = job.stage.trim().toLowerCase();
  if (stage.includes('screen') || stage.includes('result') || stage.includes('assemble') || stage.includes('assembly')) return 2;
  if (stage.includes('product') || stage.includes('process') || stage.includes('download') || stage.includes('granule') || stage.includes('batch') || stage.includes('hdf5') || stage.includes('inspection')) return 1;
  return 0;
}

export function RiverShiftJobStatus({ job, clock, onViewResults, onRetry, retrying, onCancel, cancelling, onBack }: {
  job: RiverShiftJob;
  clock: number;
  onViewResults: () => void;
  onRetry: () => void;
  retrying: boolean;
  onCancel?: () => void;
  cancelling?: boolean;
  onBack?: () => void;
}) {
  const active = activeRiverShiftStates.has(job.state);
  const stageIndex = riverShiftStageIndex(job);
  const failedStageIndex = riverShiftFailedStageIndex(job);
  const stageName = riverShiftStageName(job.stage, job.state);
  const elapsed = formatElapsed(job.created_at, job.updated_at, job.state, clock);
  const summary = job.result_summary && typeof job.result_summary === 'object' ? job.result_summary : {};
  const expectedProducts = typeof summary.expected_product_count === 'number' ? summary.expected_product_count : null;
  const verifiedProducts = typeof summary.verified_product_count === 'number' ? summary.verified_product_count : null;
  const shortJobId = job.id.length > 15 ? `${job.id.slice(0, 8)}…${job.id.slice(-4)}` : job.id;
  const retryWaveError = /delayed retry product\(s\) remained unverif/i.test(job.error_message || '');
  const [cancelConfirmationOpen, setCancelConfirmationOpen] = useState(false);

  useEffect(() => {
    if (!cancelConfirmationOpen) return undefined;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setCancelConfirmationOpen(false);
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [cancelConfirmationOpen]);

  const confirmCancel = () => {
    setCancelConfirmationOpen(false);
    onCancel?.();
  };

  return (
    <main className="displacement-preparation processing-page" aria-live="polite">
      <section className={`processing-card processing-hero processing-page--${job.state}`}>
        <span className={`processing-status-chip ${active ? 'is-running' : ''}`}>
          <i aria-hidden="true" />
          {job.state === 'succeeded' ? 'Complete' : job.state === 'failed' ? 'Needs attention' : job.state === 'cancelled' ? 'Cancelled' : 'Running'}
        </span>
        <div className={`processing-orbit ${active ? 'is-active' : ''}`} aria-label={`${stageName}, elapsed ${elapsed}`}>
          <div className="processing-orbit-inner">
            {job.state === 'succeeded' ? <span className="processing-orbit-symbol processing-orbit-label" aria-hidden="true">Success</span> : job.state === 'failed' ? <span className="processing-orbit-symbol processing-orbit-label" aria-hidden="true">Failed</span> : job.state === 'cancelled' ? <span className="processing-orbit-symbol" aria-hidden="true">!</span> : <><strong>{stageName}</strong><time>{elapsed}</time></>}
          </div>
        </div>
        <ol className="processing-stepper" aria-label="Processing stages">
          {['Initializing', 'Processing', 'Screening', 'Complete'].map((step, index) => <li key={step} className={index === failedStageIndex ? 'is-failed' : index < stageIndex ? 'is-complete' : index === stageIndex ? 'is-current' : ''}><i aria-hidden="true" /><span>{step}</span></li>)}
        </ol>
        <p className="processing-safe-note">{active ? 'Safe to close this page. Your task keeps running.' : job.state === 'succeeded' ? 'The processing job has ended. Review the River Shift outputs.' : 'The processing workflow stopped before successful completion.'}</p>
        <p className="processing-duration-note">It may take up to 5 to 20 minutes depending on AOI and time window.</p>
      </section>

      <section className="processing-card processing-products-card" aria-label="River Shift processing counters">
        <div><span>GCOV</span><strong className={expectedProducts === null ? 'processing-count-pending' : ''}>{expectedProducts ?? (active ? <span className="processing-searching-word">Searching…</span> : '—')}</strong></div>
        <div><span>Processed</span><strong className={verifiedProducts === null ? 'processing-count-pending' : ''}>{verifiedProducts ?? (active ? <span className="processing-searching-word">Searching…</span> : '—')}</strong></div>
      </section>

      <section className="processing-card processing-details-card" aria-label="River Shift task details">
        <dl>
          <div><dt>Area</dt><dd>Submitted AOI</dd></div>
          <div><dt>Job</dt><dd><code title={job.id}>{shortJobId}</code><button type="button" className="processing-copy-button" onClick={() => void navigator.clipboard?.writeText(job.id)}>Copy</button></dd></div>
        </dl>
      </section>

      <div className="processing-page-actions">
        {job.state === 'succeeded' && <button type="button" className="processing-primary-button" onClick={onViewResults}>Show result</button>}
        {active && onCancel && <button type="button" className="processing-cancel-button" disabled={cancelling} onClick={() => setCancelConfirmationOpen(true)}>{cancelling ? 'Cancelling...' : 'Cancel'}</button>}
        {onBack && <button type="button" className="processing-ghost-button" onClick={onBack}>Back</button>}
        {job.state === 'failed' && <button type="button" className="processing-retry-button" disabled={retrying} onClick={onRetry}>{retrying ? 'Retrying…' : 'Retry'}</button>}
      </div>
      {cancelConfirmationOpen && <div className="processing-confirmation-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setCancelConfirmationOpen(false); }}>
        <section className="processing-confirmation" role="dialog" aria-modal="true" aria-labelledby="river-shift-cancel-title">
          <h2 id="river-shift-cancel-title">Cancel this processing?</h2>
          <p>Processing will stop.</p>
          <button type="button" className="processing-primary-button" onClick={() => setCancelConfirmationOpen(false)}>Keep running</button>
          <button type="button" className="processing-dialog-cancel" onClick={confirmCancel}>Cancel</button>
        </section>
      </div>}
      {job.state === 'failed' && job.error_message && !retryWaveError && <p className="processing-error" role="alert">{job.error_message}</p>}
    </main>
  );
}

function RiverShiftSettingsPanel({
  settings,
  onChange,
  onRun,
  busy,
  onBack,
  error,
  startDate,
  endDate,
  runDisabled,
}: {
  settings: RiverShiftSettings;
  onChange: (next: Partial<RiverShiftSettings>) => void;
  onRun: () => void;
  busy: boolean;
  onBack: () => void;
  error: string;
  startDate: string;
  endDate: string;
  runDisabled?: boolean;
}) {
  return (
    <main className="displacement-preparation processing-page processing-config-page">
      <section className="processing-card processing-config-card" aria-label="River Shift processing settings">
        <details className="processing-additional-settings">
          <summary><span aria-hidden="true">›</span> Additional settings</summary>
          <div className="processing-settings-grid">
            <label><span>Analysis mode</span><select value={settings.analysisMode} onChange={(event) => onChange({ analysisMode: event.target.value as RiverShiftSettings['analysisMode'], eventDate: event.target.value === 'general_scan' ? '' : settings.eventDate })}><option value="general_scan">General River Change Scan</option><option value="event_based">Event-Based Analysis</option></select></label>
            {settings.analysisMode === 'event_based' && <label><span>Event date</span><input type="date" value={settings.eventDate} min={startDate} max={endDate} onChange={(event) => onChange({ eventDate: event.target.value })} /></label>}
            <label><span>Processing maturity</span><select value={settings.maturity} onChange={(event) => onChange({ maturity: event.target.value as RiverShiftSettings['maturity'] })}><option value="PROVISIONAL">PROVISIONAL</option><option value="BETA">BETA</option></select></label>
            <label><span>Main-band polarization</span><select value={settings.polarization} onChange={(event) => onChange({ polarization: event.target.value as RiverShiftSettings['polarization'] })}><option value="">Any</option><option value="VV">VV</option><option value="VV+VH">VV + VH</option><option value="HH">HH</option><option value="HH+HV">HH + HV</option><option value="HH+HV+VH+VV">Full quad-pol</option><option value="LH+LV">LH + LV</option><option value="RH+RV">RH + RV</option></select></label>
            <label><span>Orbit direction</span><select value={settings.direction} onChange={(event) => onChange({ direction: event.target.value as RiverShiftSettings['direction'] })}><option value="">Any direction</option><option value="ASCENDING">Ascending</option><option value="DESCENDING">Descending</option></select></label>
            <label><span>NISAR frame coverage</span><select value={settings.frameCoverage} onChange={(event) => onChange({ frameCoverage: event.target.value as RiverShiftSettings['frameCoverage'] })}><option value="ALL">All footprints</option><option value="FULL">Full frames only</option><option value="PARTIAL">Partial frames only</option></select></label>
            <label><span>Science frequency</span><select value={settings.scienceFrequency} onChange={(event) => onChange({ scienceFrequency: event.target.value as RiverShiftSettings['scienceFrequency'] })}><option value="frequencyA">Frequency A</option><option value="frequencyB">Frequency B</option></select></label>
            <label><span>Diagonal covariance term</span><select value={settings.covarianceTerm} onChange={(event) => onChange({ covarianceTerm: event.target.value })}><option>HHHH</option><option>HVHV</option><option>VVVV</option><option>VHVH</option><option>RHRH</option><option>RVRV</option></select></label>
            <label><span>Water threshold method</span><select value={settings.thresholdMethod} onChange={(event) => onChange({ thresholdMethod: event.target.value as RiverShiftSettings['thresholdMethod'], thresholdDb: event.target.value === 'otsu' ? '' : settings.thresholdDb })}><option value="otsu">Common Otsu</option><option value="manual">Manual dB threshold</option></select></label>
            {settings.thresholdMethod === 'manual' && <label><span>Common threshold (dB)</span><input type="number" min="-60" max="0" step="0.1" value={settings.thresholdDb} onChange={(event) => onChange({ thresholdDb: event.target.value })} /></label>}
          </div>
        </details>
        {error && <p className="processing-error" role="alert">{error}</p>}
        <div className="processing-page-actions processing-config-actions">
          <button type="button" className="processing-ghost-button" onClick={onBack}>Back</button>
          <button type="button" className="processing-primary-button" disabled={busy || runDisabled} onClick={onRun}>{busy ? 'Starting River Shift...' : 'Run River Shift'}</button>
        </div>
      </section>
    </main>
  );
}

function RiverShiftSignatureConflict({ onStartNew, onKeepCurrent, busy }: { onStartNew: () => void; onKeepCurrent: () => void; busy: boolean }) {
  return (
    <div className="processing-confirmation-backdrop" role="presentation">
      <section className="processing-confirmation processing-signature-dialog" role="dialog" aria-modal="true" aria-labelledby="river-shift-signature-title">
        <h2 id="river-shift-signature-title">Another River Shift is running</h2>
        <p>Starting a new River Shift will cancel the old processing run. Keep the current run to continue with its original polygon and dates.</p>
        <button type="button" className="processing-primary-button" disabled={busy} onClick={onStartNew}>{busy ? 'Cancelling old run...' : 'Start new River Shift'}</button>
        <button type="button" className="processing-dialog-cancel" disabled={busy} onClick={onKeepCurrent}>Keep current run</button>
      </section>
    </div>
  );
}

export function RiverShiftProcessingPage({ user, authState, onSignIn, onSignOut, onBack, onViewResults }: Props) {
  const [setup, setSetup] = useState(() => loadRiverShiftSetup());
  const [settings, setSettings] = useState<RiverShiftSettings>(defaultRiverShiftSettings);
  const [riverJob, setRiverJob] = useState<RiverShiftJob | null>(null);
  const [riverJobLoading, setRiverJobLoading] = useState(true);
  const [riverJobBusy, setRiverJobBusy] = useState(false);
  const [riverJobCancelling, setRiverJobCancelling] = useState(false);
  const [signatureConflict, setSignatureConflict] = useState(false);
  const [riverJobError, setRiverJobError] = useState('');
  const retryPending = useRef(false);
  const setupRef = useRef(setup);

  useEffect(() => {
    setupRef.current = setup;
  }, [setup]);
  const [clock, setClock] = useState(() => Date.now());

  useEffect(() => {
    if (!user) {
      setRiverJob(null);
      setRiverJobLoading(false);
      return undefined;
    }
    let cancelled = false;
    setRiverJobLoading(true);
    setRiverJobError('');

    async function initialize() {
      const pendingRun = window.sessionStorage.getItem('sarguardian.riverShiftPendingRun') === 'true'
        || window.sessionStorage.getItem('sarguardian.riverShiftPendingDispatch') === 'true';
      try {
        const storedActiveId = window.sessionStorage.getItem('sarguardian.riverShiftActiveJobId');
        let existing: RiverShiftJob | null = null;
        if (storedActiveId) {
          try {
            existing = await getRiverShiftJob(storedActiveId, user);
          } catch {
            // fallback to list
          }
        }
        if (!existing) {
          const jobs = await listRiverShiftJobs(user, 10);
          existing = jobs[0] || null;
          if (existing) window.sessionStorage.setItem('sarguardian.riverShiftActiveJobId', existing.id);
        }
        if (!cancelled) {
          const currentSetup = setupRef.current;
          if (pendingRun && currentSetup?.aoiWkt && currentSetup.startDate && currentSetup.endDate) {
            if (existing && activeRiverShiftStates.has(existing.state)) {
              setRiverJob(existing);
              if (signaturesMatch(currentSetup, existing)) {
                window.sessionStorage.removeItem('sarguardian.riverShiftPendingRun');
                window.sessionStorage.removeItem('sarguardian.riverShiftPendingDispatch');
              } else {
                setSignatureConflict(true);
              }
            } else {
              setRiverJob(null);
            }
          } else if (existing) {
            setRiverJob(existing);
            if (!currentSetup || activeRiverShiftStates.has(existing.state)) {
              const restoredSetup = setupForJob(existing);
              setSetup(restoredSetup);
              window.sessionStorage.setItem(RIVER_SHIFT_SETUP_STORAGE_KEY, JSON.stringify(restoredSetup));
            }
          }
          setRiverJobLoading(false);
        }
      } catch (error) {
        if (!cancelled) {
          setRiverJobError(error instanceof Error ? error.message : 'Could not restore the last River Shift job.');
          setRiverJobLoading(false);
        }
      }
    }

    void initialize();
    return () => { cancelled = true; };
  }, [user]);

  useEffect(() => {
    if (!user || !riverJob || !['queued', 'dispatching', 'running'].includes(riverJob.state)) return undefined;
    const timer = window.setInterval(() => {
      void getRiverShiftJob(riverJob.id, user).then(setRiverJob).catch((error: unknown) => {
        setRiverJobError(error instanceof Error ? error.message : 'Could not refresh processing status.');
      });
    }, 2000);
    return () => window.clearInterval(timer);
  }, [riverJob, user]);

  useEffect(() => {
    if (!riverJob || !activeRiverShiftStates.has(riverJob.state)) return undefined;
    setClock(Date.now());
    const timer = window.setInterval(() => setClock(Date.now()), ELAPSED_TICK_MS);
    return () => window.clearInterval(timer);
  }, [riverJob]);

  const startLiveProcessing = async (allowReplacingActive = false) => {
    if (!user || !setup) {
      setRiverJobError('Return to the AOI page and choose a valid study area first.');
      return;
    }
    if (!allowReplacingActive && riverJob && activeRiverShiftStates.has(riverJob.state)) {
      if (signaturesMatch(setup, riverJob)) return;
      setSignatureConflict(true);
      return;
    }
    if (settings.analysisMode === 'event_based' && (!settings.eventDate || settings.eventDate < setup.startDate || settings.eventDate > setup.endDate)) {
      setRiverJobError('Event-Based Analysis needs an event date inside the selected observation window.');
      return;
    }
    if (settings.thresholdMethod === 'manual') {
      const manualThreshold = Number(settings.thresholdDb);
      if (!settings.thresholdDb.trim() || !Number.isFinite(manualThreshold) || manualThreshold < -60 || manualThreshold > 0) {
        setRiverJobError('Enter a manual threshold between -60 and 0 dB, or choose Common Otsu.');
        return;
      }
    }
    setRiverJobBusy(true);
    setRiverJobError('');
    try {
      const job = await createRiverShiftJob({
        aoiWkt: setup.aoiWkt,
        startDate: setup.startDate,
        endDate: setup.endDate,
        analysisMode: settings.analysisMode,
        eventDate: settings.analysisMode === 'event_based' ? settings.eventDate : null,
        maturity: settings.maturity,
        mainBandPolarization: settings.polarization || null,
        flightDirection: settings.direction || null,
        frameCoverage: settings.frameCoverage,
        frequency: settings.scienceFrequency,
        covarianceTerm: settings.covarianceTerm,
        thresholdMethod: settings.thresholdMethod,
        ...(settings.thresholdMethod === 'manual' ? { thresholdDb: Number(settings.thresholdDb) } : {}),
        idempotencyKey: crypto.randomUUID().replace(/-/g, ''),
      }, user);
      window.sessionStorage.removeItem('sarguardian.riverShiftPendingRun');
      window.sessionStorage.removeItem('sarguardian.riverShiftPendingDispatch');
      window.sessionStorage.setItem('sarguardian.riverShiftActiveJobId', job.id);
      setRiverJob(job);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Could not start live River Shift processing.';
      setRiverJobError(/fewer than four acquisition dates|at least four comparable.*acquisition dates|needs at least four observations/i.test(message)
        ? 'The catalogue did not provide four distinct, comparable NISAR acquisition dates for this AOI and window. Widen the date range or adjust the study area, then retry.'
        : message);
    } finally {
      setRiverJobBusy(false);
    }
  };

  const retryRiverShift = async () => {
    if (!user || !riverJob || riverJob.state !== 'failed' || retryPending.current) return;
    retryPending.current = true;
    setRiverJobBusy(true);
    setRiverJobError('');
    try {
      const job = await retryRiverShiftJob(riverJob.id, user);
      setRiverJob(job);
      window.sessionStorage.setItem('sarguardian.riverShiftActiveJobId', job.id);
    } catch (error) {
      setRiverJobError(error instanceof Error ? error.message : 'Could not retry River Shift processing.');
    } finally {
      retryPending.current = false;
      setRiverJobBusy(false);
    }
  };

  const cancelRiverShift = async () => {
    if (!user || !riverJob || !activeRiverShiftStates.has(riverJob.state) || riverJobCancelling) return;
    setRiverJobCancelling(true);
    setRiverJobError('');
    try {
      const job = await cancelRiverShiftJob(riverJob.id, user);
      setRiverJob(job);
      window.sessionStorage.removeItem('sarguardian.riverShiftActiveJobId');
    } catch (error) {
      setRiverJobError(error instanceof Error ? error.message : 'Could not cancel River Shift processing.');
    } finally {
      setRiverJobCancelling(false);
    }
  };

  const startNewRiverShift = async () => {
    if (!user || !riverJob || !activeRiverShiftStates.has(riverJob.state) || riverJobCancelling) return;
    setRiverJobCancelling(true);
    setRiverJobError('');
    try {
      await cancelRiverShiftJob(riverJob.id, user);
      window.sessionStorage.removeItem('sarguardian.riverShiftActiveJobId');
      setRiverJob(null);
      setSignatureConflict(false);
      await startLiveProcessing(true);
    } catch (error) {
      setRiverJobError(error instanceof Error ? error.message : 'Could not cancel the previous River Shift processing.');
    } finally {
      setRiverJobCancelling(false);
    }
  };

  const keepCurrentRiverShift = () => {
    if (!riverJob) return;
    const oldSetup = setupForJob(riverJob);
    setSetup(oldSetup);
    window.sessionStorage.setItem(RIVER_SHIFT_SETUP_STORAGE_KEY, JSON.stringify(oldSetup));
    window.sessionStorage.removeItem('sarguardian.riverShiftPendingRun');
    window.sessionStorage.removeItem('sarguardian.riverShiftPendingDispatch');
    setSignatureConflict(false);
    setRiverJobError('');
  };

  const handleBackToMap = () => {
    window.sessionStorage.removeItem('sarguardian.riverShiftPendingRun');
    window.sessionStorage.removeItem('sarguardian.riverShiftPendingDispatch');
    if (onBack) {
      onBack();
    } else {
      window.location.assign('/river-shift');
    }
  };

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
        pageTitle="River Shift"
      />

      {riverJobLoading ? (
        <ProcessingPageSkeleton />
      ) : (
        <>
          {setup && <RiverShiftSettingsPanel
            settings={settings}
            onChange={(next) => setSettings((current) => ({ ...current, ...next }))}
            onRun={() => void startLiveProcessing()}
            busy={riverJobBusy}
            onBack={handleBackToMap}
            error={riverJobError}
            startDate={setup.startDate}
            endDate={setup.endDate}
            runDisabled={Boolean(riverJob && signaturesMatch(setup, riverJob) && activeRiverShiftStates.has(riverJob.state))}
          />}
          {riverJob && <RiverShiftJobStatus
            job={riverJob}
            clock={clock}
            retrying={riverJobBusy}
            cancelling={riverJobCancelling}
            onCancel={() => void cancelRiverShift()}
            onBack={handleBackToMap}
            onRetry={() => void retryRiverShift()}
            onViewResults={() => {
              window.sessionStorage.setItem('sarguardian.riverShiftActiveJobId', riverJob.id);
              onViewResults?.();
            }}
          />}
          {!setup && !riverJob && <main className="displacement-preparation" style={{ width: 'min(720px, calc(100% - 32px))', margin: '40px auto' }}>
            <section className="processing-card processing-load-error" role="alert">
              <p>{riverJobError || 'No River Shift AOI is ready. Return to the map to choose a study area.'}</p>
              <button type="button" className="processing-ghost-button" onClick={handleBackToMap}>Back</button>
            </section>
          </main>}
        </>
      )}

      {signatureConflict && riverJob && <RiverShiftSignatureConflict onStartNew={() => void startNewRiverShift()} onKeepCurrent={keepCurrentRiverShift} busy={riverJobCancelling} />}

      {riverJob && riverJobError && (
        <section className="rs-panel rs-job-feedback" aria-live="assertive" style={{ width: 'min(720px, calc(100% - 32px))', margin: '16px auto 0' }}>
          <p className="rs-error" role="alert">{riverJobError}</p>
        </section>
      )}

      <footer className="rs-footer">
        <span>SARGuardian · RiverShift</span>
      </footer>
    </div>
  );
}
