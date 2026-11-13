import { useEffect, useState } from 'react';
import type { User } from 'firebase/auth';
import type { DisplacementJob } from '../../src/api/catalog';
import { downloadDisplacementArtifact, getDisplacementJob } from '../../src/api/catalog';
import { buildDashboardRouteUrl, type DashboardView } from '../../src/dashboardDocument';
import { BrandLogo } from '../../src/components/BrandLogo';

const dashboardViews: Array<{ id: DashboardView; title: string; audience: string; description: string }> = [
  {
    id: 'public',
    title: 'Public Discovery',
    audience: 'For everyone',
    description: 'A plain-language explanation of the observations, candidate evidence and limitations.',
  },
  {
    id: 'evidence',
    title: 'Explore the Evidence',
    audience: 'Students and analysts',
    description: 'Interactive map layers, real acquisition pairs and observation playback.',
  },
  {
    id: 'science',
    title: 'Scientific Evidence',
    audience: 'Researchers and reviewers',
    description: 'Measurement diagnostics, quality gates, acquisition networks and provenance.',
  },
];

function dashboardAvailable(job: DisplacementJob): boolean {
  if (job.state !== 'succeeded' || !job.result_summary) return false;
  const dashboard = job.result_summary.web_dashboard;
  if (!dashboard || typeof dashboard !== 'object' || Array.isArray(dashboard)) return false;
  const record = dashboard as Record<string, unknown>;
  if (record.status !== 'PASS') return false;
  const artifacts = job.result_summary.artifacts;
  return Array.isArray(artifacts) && artifacts.some((item) =>
    !!item && typeof item === 'object' && !Array.isArray(item)
      && (item as Record<string, unknown>).path === 'aoi-derived-results.zip',
  );
}

function resultBundleArtifactIndex(job: DisplacementJob): number | undefined {
  if (job.state !== 'succeeded' || !job.result_summary) return undefined;
  const storage = job.result_summary.storage_verification;
  if (!storage || typeof storage !== 'object' || Array.isArray(storage)
      || (storage as Record<string, unknown>).status !== 'PASS') return undefined;
  const artifacts = job.result_summary.artifacts;
  if (!Array.isArray(artifacts)) return undefined;
  const index = artifacts.findIndex((item) =>
    !!item && typeof item === 'object' && !Array.isArray(item)
      && (item as Record<string, unknown>).path === 'aoi-derived-results.zip',
  );
  return index >= 0 ? index : undefined;
}

export function ScientificResults({ job, user, showDownload = true }: { job: DisplacementJob; user?: Pick<User, 'getIdToken'>; showDownload?: boolean }) {
  const bundleArtifactIndex = resultBundleArtifactIndex(job);
  const canDownloadBundle = showDownload && bundleArtifactIndex !== undefined;
  const canOpenDashboard = dashboardAvailable(job);
  const [selectedView, setSelectedView] = useState<DashboardView>('public');
  const [dashboardError, setDashboardError] = useState('');
  const [downloadingBundle, setDownloadingBundle] = useState(false);
  const [bundleError, setBundleError] = useState('');
  const [bundleProgress, setBundleProgress] = useState('');

  function openDashboard(view: DashboardView) {
    setSelectedView(view);
    setDashboardError('');
    // Open a durable first-party route. The new tab restores Firebase auth,
    // retrieves the saved private bundle, and can recover after a refresh.
    const dashboardUrl = buildDashboardRouteUrl(window.location.origin, job.id, view);
    const dashboardTab = window.open(dashboardUrl, '_blank');
    if (!dashboardTab) {
      setDashboardError('The browser blocked the new tab. Allow pop-ups for SARGuardian and try again.');
      return;
    }
    try {
      dashboardTab.opener = null;
    } catch {
      // The route does not depend on its opener.
    }
  }

  async function downloadResultBundle() {
    if (bundleArtifactIndex === undefined || !user) return;
    setBundleError('');
    setDownloadingBundle(true);
    try {
      const blob = await downloadDisplacementArtifact(job.id, bundleArtifactIndex, user, setBundleProgress);
      const objectUrl = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = objectUrl;
      anchor.download = `SARGuardian-${job.id}-aoi-derived-results.zip`;
      anchor.hidden = true;
      document.body.append(anchor);
      anchor.click();
      anchor.remove();
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000);
    } catch (error: unknown) {
      setBundleError(error instanceof Error ? error.message : 'Could not download the archived result package.');
    } finally {
      setDownloadingBundle(false);
      setBundleProgress('');
    }
  }

  if (!canDownloadBundle && !canOpenDashboard) return <section className="scientific-results scientific-results-v2" aria-label="Scientific result outputs"><p className="scientific-results-error" role="status">Interactive result views are not available for this job yet.</p></section>;
  return (
    <section className="scientific-results scientific-results-v2" aria-label="Scientific result outputs">
      {canOpenDashboard && (
        <div className="dashboard-selection">
          <div className="dashboard-view-options" role="group" aria-label="Dashboard audience view">
            {dashboardViews.map((view) => (
              <button
                className={`dashboard-view-option ${selectedView === view.id ? 'is-selected' : ''}`}
                type="button"
                key={view.id}
                aria-label={`Open ${view.title}`}
                aria-pressed={selectedView === view.id}
                onClick={() => void openDashboard(view.id)}
              >
                <strong>{view.title}</strong>
                <small>{view.audience}</small>
              </button>
            ))}
          </div>
          <p className="dashboard-view-summary">{dashboardViews.find((view) => view.id === selectedView)?.description}</p>
        </div>
      )}
      {canDownloadBundle && <div className="scientific-results-actions">
        <button className="investigate-button validated-output-link" type="button" onClick={() => void downloadResultBundle()} disabled={downloadingBundle}>
          {downloadingBundle ? 'Preparing secure download…' : 'Download complete result package'}
        </button>
      </div>}
      {canDownloadBundle && <p className="scientific-results-note">
        Results are kept in private storage and downloaded through your signed-in SARGuardian account.
        {job.retention_mode === 'derived-only' ? ' This package contains the retained AOI-derived products, maps and provenance; original full-granule HDF5 files are not retained in derived-only mode.' : ''}
      </p>}
      {canDownloadBundle && !canOpenDashboard && <p className="scientific-results-note" role="status">
        This job&apos;s result package is still retained and checksum-verified, but its interactive dashboard did not pass viewer validation. The three audience views are therefore unavailable for this run; the verified result package can still be downloaded.
      </p>}
      {canOpenDashboard && <p className="scientific-results-note">A processing PASS confirms structural and provenance checks, not independent geophysical accuracy. Candidate patterns are not hazard confirmations; pairwise LOS is not automatically cumulative or 3-D movement.</p>}
      {dashboardError && <p className="scientific-results-error" role="alert">{dashboardError}</p>}
      {bundleProgress && <p className="scientific-results-note" role="status">{bundleProgress}</p>}
      {bundleError && <p className="scientific-results-error" role="alert">{bundleError}</p>}
    </section>
  );
}

export function ScientificResultsPage({ jobId, user, onBack }: { jobId: string | null; user: Pick<User, 'getIdToken'>; onBack: () => void }) {
  const [job, setJob] = useState<DisplacementJob | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    if (!jobId) {
      setLoading(false);
      setError('No displacement result was selected.');
      return () => { active = false; };
    }
    setLoading(true);
    setError('');
    void getDisplacementJob(jobId, user)
      .then((nextJob) => { if (active) setJob(nextJob); })
      .catch((reason: unknown) => { if (active) setError(reason instanceof Error ? reason.message : 'Could not load this displacement result.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [jobId, user]);

  return (
    <div className="home-page claude-home claude-processing-page displacement-results-view-page">
      <div className="claude-background" aria-hidden="true"><i /><i /><i /></div>
      <header className="claude-nav-shell is-archive">
        <div className="claude-nav-inner">
          <a className="claude-brand" href="/" aria-label="SARGuardian home"><span className="claude-brand-mark"><BrandLogo className="claude-brand-logo" /></span><span className="claude-brand-word"><b>SAR</b>Guardian</span></a>
          <nav className="claude-nav-links" aria-label="Results navigation"><a className="archive-home-link" href="/">Home</a></nav>
        </div>
      </header>
      <main className="displacement-results-view-main">
        {loading && <section className="processing-card scientific-results-loading" aria-busy="true"><span className="processing-skeleton-line" /><span className="processing-skeleton-line" /><span className="processing-skeleton-line" /></section>}
        {!loading && error && <section className="processing-card processing-load-error" role="alert"><p>{error}</p><button type="button" className="processing-ghost-button" onClick={onBack}>Back to processing</button></section>}
        {!loading && !error && job && <ScientificResults job={job} showDownload={false} />}
      </main>
    </div>
  );
}
