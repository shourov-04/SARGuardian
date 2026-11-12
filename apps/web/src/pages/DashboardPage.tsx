import { useEffect, useState, type ReactNode } from 'react';
import type { User } from 'firebase/auth';
import { getInteractiveDashboardHtml } from '../api/catalog';
import { withDashboardPreferredView, writeDashboardDocument, type DashboardView } from '../dashboardDocument';
import { Header } from '../components/Header';

type AuthState = 'idle' | 'loading' | 'ready' | 'error';

type DashboardPageProps = {
  jobId: string;
  view: DashboardView;
  user: User | null;
  authState: AuthState;
  authError: string | null;
  onSignIn: () => void;
  onSignOut?: () => void;
};

const JOB_ID_PATTERN = /^[0-9a-f-]{36}$/i;

function DashboardRouteShell({ children, user, authState, onSignIn, onSignOut }: { children: ReactNode; user: User | null; authState: AuthState; onSignIn: () => void; onSignOut?: () => void }) {
  return (
    <div className="home-page claude-home claude-how-page">
      <div className="claude-background" aria-hidden="true"><i /><i /><i /></div>
      <Header user={user} authState={authState} onSignIn={onSignIn} onSignOut={onSignOut ?? (() => {})} isArchivePage hideProfile />
      <main className="claude-how-main">
        <section className="dashboard-route-status">
          {children}
        </section>
      </main>
    </div>
  );
}

export function DashboardPage({ jobId, view, user, authState, authError, onSignIn, onSignOut }: DashboardPageProps) {
  const [progress, setProgress] = useState('Connecting to your saved result…');
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!user || !JOB_ID_PATTERN.test(jobId)) return undefined;
    let active = true;
    setError('');
    setProgress('Restoring your SARGuardian account session…');

    void getInteractiveDashboardHtml(jobId, user, (message) => {
      if (active) setProgress(message);
    }).then((html) => {
      if (!active) return;
      const preparedHtml = withDashboardPreferredView(html, view, window.location.origin);
      writeDashboardDocument(document, preparedHtml);
    }).catch((requestError: unknown) => {
      if (!active) return;
      setError(requestError instanceof Error ? requestError.message : 'Could not open the saved interactive dashboard.');
    });

    return () => {
      active = false;
    };
  }, [attempt, jobId, user, view]);

  if (!JOB_ID_PATTERN.test(jobId)) {
    return (
      <DashboardRouteShell user={user} authState={authState} onSignIn={onSignIn} onSignOut={onSignOut}>
        <p className="section-eyebrow">SAVED RESULT</p>
        <h1>Dashboard link is incomplete</h1>
        <p>This link does not contain a valid analysis job ID.</p>
        <a className="section-action secondary" href="/archive">Back to Archive</a>
      </DashboardRouteShell>
    );
  }

  if (!user) {
    if (authState === 'loading') {
      return (
        <DashboardRouteShell user={user} authState={authState} onSignIn={onSignIn} onSignOut={onSignOut}>
          <p className="section-eyebrow">SAVED RESULT</p>
          <h1>Restoring your account session</h1>
          <p role="status">Checking your existing SARGuardian sign-in before opening this private result…</p>
        </DashboardRouteShell>
      );
    }
    return (
      <DashboardRouteShell user={user} authState={authState} onSignIn={onSignIn} onSignOut={onSignOut}>
        <p className="section-eyebrow">PRIVATE SAVED RESULT</p>
        <h1>Sign in to open this dashboard</h1>
        <p>{authError || 'This dashboard is available only to the account that owns the saved analysis.'}</p>
        <button className="section-action" type="button" onClick={onSignIn}>Sign in with Google</button>
        <a className="section-action secondary" href="/archive">Back to Archive</a>
      </DashboardRouteShell>
    );
  }

  if (error) {
    return (
      <DashboardRouteShell user={user} authState={authState} onSignIn={onSignIn} onSignOut={onSignOut}>
        <p className="section-eyebrow">SAVED RESULT</p>
        <h1>Dashboard could not be opened</h1>
        <p role="alert">{error}</p>
        <p>Your saved analysis is unchanged. Retrying this viewer does not start another GitHub Actions run or repeat scientific processing.</p>
        <button className="section-action" type="button" onClick={() => setAttempt((current) => current + 1)}>Retry dashboard retrieval</button>
        <a className="section-action secondary" href="/archive">Back to Archive</a>
      </DashboardRouteShell>
    );
  }

  return (
    <DashboardRouteShell user={user} authState={authState} onSignIn={onSignIn} onSignOut={onSignOut}>
      <div className="dashboard-result-loader" role="status" aria-live="polite" aria-label="Loading result">
        <strong>Loading result…</strong>
      </div>
      <div className="dashboard-loading-progress" role="progressbar" aria-label="Loading saved result dashboard" aria-valuetext={progress}>
        <span />
      </div>
    </DashboardRouteShell>
  );
}
