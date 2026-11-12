import { useCallback, useEffect, useRef, useState } from 'react';
import type { User } from 'firebase/auth';
import type { PreparedInvestigation } from '../engine/investigation';
import {
  cancelDisplacementJob,
  getDisplacementJob,
  listDisplacementJobs,
  resubmitDisplacementJob,
  DEFAULT_DISPLACEMENT_OPTIONS,
  type DisplacementProcessingOptions,
  type DisplacementJob,
} from '../../src/api/catalog';
import { chooseAccountJob } from '../engine/displacementJobSelection';
import { ELAPSED_TICK_MS, formatElapsed, type GranuleCounts } from './processingStatus';
import './displacementPreparation.css';

const activeStates = new Set(['queued', 'dispatching', 'running']);
const noopTaskActivityChange = () => {};
export const JOB_STATUS_POLL_MS = 2000;

function resultGranuleCounts(job: DisplacementJob): GranuleCounts | null {
  const products = job.result_summary?.products;
  const selected = job.result_summary?.selected_granule_counts;
  const selectedCounts = selected && typeof selected === 'object' ? selected as Record<string, unknown> : null;
  const hasSelectedCounts = selectedCounts
    && Number.isInteger(selectedCounts.GUNW)
    && Number.isInteger(selectedCounts.GOFF);

  if (job.state !== 'succeeded' && hasSelectedCounts) {
    return {
      GUNW: selectedCounts.GUNW as number,
      GOFF: selectedCounts.GOFF as number,
      source: 'worker-discovery',
    };
  }
  if (Array.isArray(products) && products.length > 0) return {
      GUNW: products.filter((product) => product && typeof product === 'object' && (product as Record<string, unknown>).product_type === 'GUNW').length,
      GOFF: products.filter((product) => product && typeof product === 'object' && (product as Record<string, unknown>).product_type === 'GOFF').length,
      source: 'processed-results',
    };
  if (hasSelectedCounts) {
    return {
      GUNW: selectedCounts.GUNW as number,
      GOFF: selectedCounts.GOFF as number,
      source: 'worker-discovery',
    };
  }
  return null;
}

type PendingAction = 'cancel' | 'retry' | null;

function jobStateDescription(state: DisplacementJob['state']): string {
  switch (state) {
    case 'queued': return 'The job is queued and waiting for a worker.';
    case 'dispatching': return 'The job is being handed to the processing workflow.';
    case 'running': return 'The processing workflow is running. Status is refreshed from the server.';
    case 'succeeded': return 'The processing job has ended. Review only the outputs that passed their validation checks.';
    case 'failed': return 'The processing workflow stopped before successful completion.';
    case 'cancelled': return 'The processing job was cancelled.';
  }
}

function isScreeningStage(stage: string): boolean {
  return ['screen', 'dashboard', 'validation', 'terminal', 'assemble', 'export', 'result', 'map']
    .some((marker) => stage.includes(marker));
}

function displayStageName(stage: string | null | undefined, state: DisplacementJob['state']): string {
  const normalized = stage?.trim().toLowerCase() ?? '';
  if (normalized.includes('complete') || state === 'succeeded') return 'Complete';
  if (isScreeningStage(normalized)) return 'Screening';
  if (normalized.includes('product') || normalized.includes('granule') || normalized.includes('process')) return 'Processing';
  if (normalized.includes('initial') || state === 'running') return 'Initializing';
  if (state === 'queued' || state === 'dispatching') return 'Preparing task';
  if (state === 'failed' || state === 'cancelled') return 'Needs attention';
  return stage ? `${stage.charAt(0).toUpperCase()}${stage.slice(1)}` : 'Processing';
}

export function ProcessingPageSkeleton() {
  return (
    <main className="displacement-preparation processing-page-skeleton" aria-busy="true" aria-label="Loading processing status">
      <section className="processing-card processing-hero">
        <span className="processing-skeleton-line processing-skeleton-chip" />
        <div className="processing-skeleton-orbit"><div /></div>
        <div className="processing-skeleton-stepper">
          <span /><span /><span /><span />
        </div>
        <span className="processing-skeleton-line processing-skeleton-note" />
        <span className="processing-skeleton-line processing-skeleton-duration" />
      </section>
      <section className="processing-card processing-products-card processing-skeleton-products">
        <div><span className="processing-skeleton-line" /><strong className="processing-skeleton-line" /></div>
        <div><span className="processing-skeleton-line" /><strong className="processing-skeleton-line" /></div>
        <div><span className="processing-skeleton-line" /><strong className="processing-skeleton-line" /></div>
      </section>
      <section className="processing-card processing-details-card">
        <dl className="processing-skeleton-details">
          <div><dt><span className="processing-skeleton-line" /></dt><dd><span className="processing-skeleton-line" /></dd></div>
          <div><dt><span className="processing-skeleton-line" /></dt><dd><span className="processing-skeleton-line" /></dd></div>
          <div><dt><span className="processing-skeleton-line" /></dt><dd><span className="processing-skeleton-line" /></dd></div>
          <div><dt><span className="processing-skeleton-line" /></dt><dd><span className="processing-skeleton-line" /></dd></div>
        </dl>
      </section>
    </main>
  );
}

export function DisplacementJobStatus({ job, pendingAction, clock, granuleCounts, onCancel, onRetry, onViewResults, onBack }: {
  job: DisplacementJob;
  pendingAction: PendingAction;
  clock: number;
  granuleCounts: GranuleCounts | null;
  onCancel: () => void;
  onRetry: () => void;
  onViewResults: (jobId: string) => void;
  onBack: () => void;
}) {
  const hasActiveJob = activeStates.has(job.state);
  const counts = resultGranuleCounts(job);
  // ASF preflight counts describe discovered candidates, not processed products.
  // Keep the prop for route compatibility, but never render it as processing output.
  void granuleCounts;
  const busy = pendingAction !== null;
  const dateWindow = `${new Date(job.start_date + 'T00:00:00').toLocaleDateString()} – ${new Date(job.end_date + 'T00:00:00').toLocaleDateString()}`;
  const [cancelConfirmationOpen, setCancelConfirmationOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const stageName = displayStageName(job.stage, job.state);
  const normalizedStage = job.stage?.trim().toLowerCase() ?? '';
  const stageIndex = job.state === 'succeeded' || normalizedStage.includes('complete')
    ? 3
    : isScreeningStage(normalizedStage)
      ? 2
      : normalizedStage.includes('product') || normalizedStage.includes('granule') || normalizedStage.includes('process')
        ? 1
        : 0;
  const failedStageIndex = job.state === 'failed'
    ? (isScreeningStage(normalizedStage)
      ? 2
      : normalizedStage.includes('process') || normalizedStage.includes('granule') || normalizedStage.includes('download')
        ? 1
        : 0)
    : -1;
  const elapsed = formatElapsed(job.created_at, job.updated_at, job.state, clock);
  const processingCountPending = counts === null && hasActiveJob;
  const pendingCountLabel = processingCountPending ? 'Searching…' : '—';
  const total = counts ? counts.GUNW + counts.GOFF : null;
  const shortJobId = job.id.length > 15 ? `${job.id.slice(0, 8)}…${job.id.slice(-4)}` : job.id;

  useEffect(() => {
    if (!cancelConfirmationOpen) return undefined;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setCancelConfirmationOpen(false);
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [cancelConfirmationOpen]);

  const copyJobId = async () => {
    try {
      await navigator.clipboard.writeText(job.id);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  };

  const confirmCancel = () => {
    setCancelConfirmationOpen(false);
    onCancel();
  };

  return (
    <section className={`displacement-job-status processing-page processing-page--${job.state}`} aria-live="polite">
      <section className="processing-card processing-hero">
        <span className={`processing-status-chip ${hasActiveJob ? 'is-running' : ''}`}>
          <i aria-hidden="true" />
          {job.state === 'succeeded' ? 'Complete' : job.state === 'failed' ? 'Needs attention' : job.state === 'cancelled' ? 'Cancelled' : 'Running'}
        </span>
        <div className={`processing-orbit ${hasActiveJob ? 'is-active' : ''}`} aria-label={`${stageName}, elapsed ${elapsed}`}>
          <div className="processing-orbit-inner">
            {job.state === 'succeeded' ? <span className="processing-orbit-symbol processing-orbit-label" aria-hidden="true">Success</span> : job.state === 'failed' ? <span className="processing-orbit-symbol processing-orbit-label" aria-hidden="true">Failed</span> : job.state === 'cancelled' ? <span className="processing-orbit-symbol" aria-hidden="true">!</span> : <>
              <strong>{stageName}</strong>
              <time data-testid="job-age">{elapsed}</time>
            </>}
          </div>
        </div>
        <ol className="processing-stepper" aria-label="Processing stages">
          {['Initializing', 'Processing', 'Screening', 'Complete'].map((step, index) => <li key={step} className={index === failedStageIndex ? 'is-failed' : index < stageIndex ? 'is-complete' : index === stageIndex ? 'is-current' : ''}><i aria-hidden="true" /><span>{step}</span></li>)}
        </ol>
        <p className="processing-safe-note">{hasActiveJob ? 'Safe to close this page. Your task keeps running.' : jobStateDescription(job.state)}</p>
        <p className="processing-duration-note">It may take up to 5 to 20 minutes depending on AOI and time window.</p>
      </section>

      <section className="processing-card processing-products-card" aria-label="Product inventory">
        <div><span>GUNW</span><strong className={counts ? '' : 'processing-count-pending'}>{counts?.GUNW ?? pendingCountLabel}</strong></div>
        <div><span>GOFF</span><strong className={counts ? '' : 'processing-count-pending'}>{counts?.GOFF ?? pendingCountLabel}</strong></div>
        <div><span>Total</span><strong className={counts ? '' : 'processing-count-pending'}>{total ?? pendingCountLabel}</strong></div>
      </section>

      <section className="processing-card processing-details-card" aria-label="Task details">
        <dl>
          <div><dt>Area</dt><dd>{job.place_name || 'Submitted AOI'}</dd></div>
          <div><dt>Dates</dt><dd>{dateWindow}</dd></div>
          <div><dt>Scope</dt><dd>AOI-wide screening</dd></div>
          <div><dt>Job</dt><dd><code title={job.id}>{shortJobId}</code><button type="button" className="processing-copy-button" onClick={() => void copyJobId()} aria-label="Copy job ID">{copied ? 'Copied' : 'Copy'}</button></dd></div>
        </dl>
      </section>

      <div className="processing-page-actions">
        {hasActiveJob && <>
          <button type="button" className="processing-ghost-button processing-cancel-button" disabled={busy} onClick={() => setCancelConfirmationOpen(true)}>Cancel task</button>
        </>}
        {job.state === 'succeeded' && <button type="button" className="processing-primary-button" onClick={() => onViewResults(job.id)}>Show result</button>}
        {job.state === 'failed' && <><button type="button" className="processing-primary-button" disabled={busy} onClick={onRetry}>{pendingAction === 'retry' ? 'Retrying…' : 'Try again'}</button><button type="button" className="processing-ghost-button" onClick={onBack}>Back to map</button></>}
        {job.state === 'cancelled' && <button type="button" className="processing-primary-button" onClick={onBack}>Back to map</button>}
      </div>

      {cancelConfirmationOpen && <div className="processing-confirmation-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setCancelConfirmationOpen(false); }}>
        <section className="processing-confirmation" role="dialog" aria-modal="true" aria-labelledby="cancel-task-title">
          <h2 id="cancel-task-title">Cancel this task?</h2>
          <p>Processing will stop.</p>
          <button type="button" className="processing-primary-button" onClick={() => setCancelConfirmationOpen(false)}>Keep running</button>
          <button type="button" className="processing-dialog-cancel" onClick={confirmCancel}>Cancel task</button>
        </section>
      </div>}

    </section>
  );
}

export function DisplacementPreparation({ preparation, options = DEFAULT_DISPLACEMENT_OPTIONS, granuleCounts = null, onBack, onViewResults = () => {}, onTaskActivityChange = noopTaskActivityChange, user }: { preparation: PreparedInvestigation; options?: DisplacementProcessingOptions; granuleCounts?: GranuleCounts | null; onBack: () => void; onViewResults?: (jobId: string) => void; onTaskActivityChange?: (active: boolean) => void; user: User }) {
  const [pendingAction, setPendingAction] = useState<PendingAction>(null);
  const [job, setJob] = useState<DisplacementJob | null>(null);
  const [jobError, setJobError] = useState('');
  const [accountLoaded, setAccountLoaded] = useState(false);
  const [clock, setClock] = useState(() => Date.now());
  const statusRequestSequence = useRef(0);
  const userActionActive = useRef(false);
  const jobId = job?.id;
  const hasActiveJob = Boolean(job && activeStates.has(job.state));

  // This route performs one account-job lookup when it mounts. The parent
  // workspace can rerender when its global active-task flag changes; its
  // preparation object is reconstructed on each render. Closing over that
  // object here would restart the account lookup just as a job completes.
  // In deployments whose list endpoint omits completed jobs, that second
  // lookup could clear the successful job and trigger the empty-route redirect.
  // Keep the latest inputs in a ref, but keep the loader identity stable.
  const accountLookupContext = useRef({ preparation, options, user });
  accountLookupContext.current = { preparation, options, user };

  const loadAccountJob = useCallback(async () => {
    setJobError('');
    const lookup = accountLookupContext.current;
    try {
      const jobs = await listDisplacementJobs(lookup.user);
      setJob((current) => current && activeStates.has(current.state)
        ? current
        : chooseAccountJob(jobs, lookup.preparation, lookup.options));
    } catch (error) {
      setJobError(error instanceof Error ? error.message : 'Could not load your displacement jobs.');
    } finally {
      setAccountLoaded(true);
    }
  }, []);

  // Browser refresh and reopening this route read durable account state once;
  // status polling below then follows the selected job by its stable ID.
  useEffect(() => { void loadAccountJob(); }, [loadAccountJob]);

  useEffect(() => {
    if (!jobId || !hasActiveJob) return undefined;
    let stopped = false;
    let requestInFlight = false;
    const refresh = () => {
      if (stopped || requestInFlight || userActionActive.current) return;
      requestInFlight = true;
      const requestSequence = ++statusRequestSequence.current;
      void getDisplacementJob(jobId, user)
        .then((nextJob) => {
          if (stopped || requestSequence !== statusRequestSequence.current) return;
          setJob(nextJob);
          setJobError('');
        })
        .catch((error: unknown) => {
          if (!stopped && requestSequence === statusRequestSequence.current) {
            setJobError(error instanceof Error ? error.message : 'Could not refresh the displacement job.');
          }
        })
        .finally(() => { requestInFlight = false; });
    };
    refresh();
    const timer = window.setInterval(() => {
      refresh();
    }, JOB_STATUS_POLL_MS);
    return () => {
      stopped = true;
      statusRequestSequence.current += 1;
      window.clearInterval(timer);
    };
  }, [hasActiveJob, jobId, user]);

  // The displayed elapsed time is local UI state, not a server poll. Keep it
  // smooth without turning the account-status API into a once-per-second poll.
  useEffect(() => {
    if (!hasActiveJob) return undefined;
    setClock(Date.now());
    const timer = window.setInterval(() => setClock(Date.now()), ELAPSED_TICK_MS);
    return () => window.clearInterval(timer);
  }, [hasActiveJob]);

  useEffect(() => {
    if (job) onTaskActivityChange(activeStates.has(job.state));
  }, [job, onTaskActivityChange]);

  // This route is only for an account task already created on the map. It is
  // never a second submission screen, and a direct/expired route returns to
  // the map once the account lookup has completed.
  useEffect(() => {
    if (accountLoaded && !job && !jobError) onBack();
  }, [accountLoaded, job, jobError, onBack]);

  const cancel = useCallback(async () => {
    if (!job || !activeStates.has(job.state) || pendingAction || userActionActive.current) return;
    userActionActive.current = true;
    statusRequestSequence.current += 1;
    setPendingAction('cancel');
    setJobError('');
    try {
      const cancelled = await cancelDisplacementJob(job.id, user);
      setJob(cancelled);
      if (cancelled.state === 'cancelled' && cancelled.stage === 'cancelled_by_user') {
        onTaskActivityChange(false);
        onBack();
      }
    } catch (error) {
      setJobError(error instanceof Error ? error.message : 'Could not cancel the displacement job.');
    } finally {
      userActionActive.current = false;
      setPendingAction(null);
    }
  }, [job, onBack, onTaskActivityChange, pendingAction, user]);

  const retryFailed = useCallback(async () => {
    if (!job || job.state !== 'failed' || pendingAction || userActionActive.current) return;
    userActionActive.current = true;
    statusRequestSequence.current += 1;
    setPendingAction('retry');
    setJobError('');
    try {
      const replacement = await resubmitDisplacementJob(job.id, crypto.randomUUID(), user);
      setJob(replacement);
      onTaskActivityChange(true);
    } catch (error) {
      setJobError(error instanceof Error ? error.message : 'Could not retry the displacement job.');
    } finally {
      userActionActive.current = false;
      setPendingAction(null);
    }
  }, [job, onTaskActivityChange, pendingAction, user]);

  if (!job && !jobError) return <ProcessingPageSkeleton />;

  return <main className="displacement-preparation">
      {job && <DisplacementJobStatus job={job} pendingAction={pendingAction} clock={clock} granuleCounts={granuleCounts}
        onCancel={() => void cancel()}
        onRetry={() => void retryFailed()} onViewResults={onViewResults} onBack={onBack} />}
      {jobError && <section className="processing-card processing-load-error" role="alert"><p>{jobError}</p>{!job && <button type="button" className="processing-ghost-button" onClick={onBack}>Back to map</button>}</section>}
  </main>;
}
