import { useCallback, useEffect, useRef, useState } from 'react';
import type { Engine } from './data/engineData';
import { onAuthStateChanged, signInWithPopup, signOut, type User } from 'firebase/auth';
import { listDisplacementJobs } from './api/catalog';
import { Home } from './pages/Home';
import { HowItWorksPage } from './pages/HowItWorksPage';
import { ArchivePage } from './pages/ArchivePage';
import { DashboardPage } from './pages/DashboardPage';
import { parseDashboardView } from './dashboardDocument';
import { LandslidePage } from '../landslide/ui/LandslidePage';
import { KnownPlaceResultsPage } from '../landslide/ui/KnownPlaceResultsPage';
import { RIVER_SHIFT_SETUP_STORAGE_KEY, RiverShiftPage, type RiverShiftSetup } from './pages/RiverShiftPage';
import { RiverShiftProcessingPage } from './pages/RiverShiftProcessingPage';
import { RiverShiftResultsPage } from './pages/RiverShiftResultsPage';
import { auth, firebaseConfigured, googleProvider, missingFirebaseConfig } from './firebase';
import { isArchiveRoute, isDashboardRoute, isHowItWorksRoute, isRiverShiftProcessingRoute, isRiverShiftResultsRoute, isRiverShiftRoute, RIVER_SHIFT_PATH, RIVER_SHIFT_PROCESSING_PATH, RIVER_SHIFT_RESULTS_PATH, FIND_DISPLACEMENT_PATH, FIND_DISPLACEMENT_DISPLACEMENT_PATH, FIND_DISPLACEMENT_OUTPUTS_PATH, FIND_DISPLACEMENT_RESULTS_PATH, KNOWN_PLACE_ANALYSIS_PATH, KNOWN_PLACE_RESULTS_PATH, KNOWN_PLACE_SETUP_PATH, isKnownPlaceResultsRoute, isLandslideDisplacementRoute, isLandslideKnownPlaceAnalysisRoute, isLandslideKnownPlaceSetupAnalysisRoute, isLandslideKnownPlaceSetupRoute, isLandslideResultViewsRoute, isLandslideResultsRoute, isLandslideRoute, navigatePath, normalizePathname } from './routing';

function App() {
  const [pathname, setPathname] = useState(() => normalizePathname(window.location.pathname));
  const pathnameRef = useRef(pathname);
  const [user, setUser] = useState<User | null>(null);
  const [authState, setAuthState] = useState<'idle' | 'loading' | 'ready' | 'error'>('loading');
  const [authError, setAuthError] = useState<string | null>(null);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [pendingRoute, setPendingRoute] = useState<string | null>(null);
  const [hasActiveDisplacementTask, setHasActiveDisplacementTask] = useState(false);
  const [apiConnectionStatus, setApiConnectionStatus] = useState<'idle' | 'checking' | 'ready' | 'error'>('idle');
  const [apiConnectionError, setApiConnectionError] = useState<string | null>(null);

  const navigateTo = useCallback((nextPath: string) => {
    const normalizedPath = navigatePath(nextPath, window.location.pathname, window.history.pushState.bind(window.history));
    pathnameRef.current = normalizedPath;
    setPathname(normalizedPath);
  }, []);

  const handleStartRiverShift = useCallback((setup: RiverShiftSetup) => {
    window.sessionStorage.setItem(RIVER_SHIFT_SETUP_STORAGE_KEY, JSON.stringify(setup));
    window.sessionStorage.setItem('sarguardian.riverShiftPendingRun', 'true');
    navigateTo(RIVER_SHIFT_PROCESSING_PATH);
  }, [navigateTo]);

  useEffect(() => {
    const handlePopState = () => {
      const nextPath = normalizePathname(window.location.pathname);
      pathnameRef.current = nextPath;
      setPathname(nextPath);
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const refreshDisplacementTaskState = useCallback(async (currentUser: User) => {
    try {
      const jobs = await listDisplacementJobs(currentUser);
      setHasActiveDisplacementTask(jobs.some((job) => ['queued', 'dispatching', 'running'].includes(job.state)));
      setApiConnectionStatus('ready');
      setApiConnectionError(null);
    } catch (error: unknown) {
      // Do not block navigation on an API outage, but never hide a failed
      // Firebase-token/Supabase-readiness check from the signed-in user.
      setApiConnectionStatus('error');
      setApiConnectionError(error instanceof Error ? error.message : 'The signed-in API check failed.');
    }
  }, []);

  useEffect(() => {
    if (!user) {
      setHasActiveDisplacementTask(false);
      setApiConnectionStatus('idle');
      setApiConnectionError(null);
      return undefined;
    }
    setApiConnectionStatus((current) => current === 'ready' ? current : 'checking');
    void refreshDisplacementTaskState(user);
    const timer = window.setInterval(() => { void refreshDisplacementTaskState(user); }, 5000);
    return () => window.clearInterval(timer);
  }, [refreshDisplacementTaskState, user]);

  useEffect(() => {
    // The account task may continue while the user visits Home. Only the map
    // workspace is locked because changing its AOI during an active task would
    // be misleading; the durable status route stays available.
    if (hasActiveDisplacementTask && pathname === FIND_DISPLACEMENT_PATH) {
      navigateTo(FIND_DISPLACEMENT_DISPLACEMENT_PATH);
    }
  }, [hasActiveDisplacementTask, navigateTo, pathname]);

  useEffect(() => {
    if (!auth) {
      setAuthState('idle');
      return undefined;
    }

    return onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setAuthState(currentUser ? 'ready' : 'idle');
      setAuthError(null);
      const currentPath = pathnameRef.current;
      if (!currentUser && (isLandslideRoute(currentPath) || isRiverShiftRoute(currentPath))) {
        setPendingRoute(currentPath);
        setAuthModalOpen(true);
        navigateTo('/');
      }
    }, (error) => {
      setAuthError(error.message);
      setAuthState('error');
    });
  }, [navigateTo]);

  const handleSignIn = async () => {
    if (!auth || !googleProvider) {
      setAuthError('Firebase is not configured for this local environment.');
      setAuthState('error');
      return;
    }

    setAuthState('loading');
    try {
      await signInWithPopup(auth, googleProvider);
      setAuthState('ready');
      setAuthError(null);
      setAuthModalOpen(false);
      if (pendingRoute) {
        navigateTo(pendingRoute);
        setPendingRoute(null);
      }
    } catch (error: unknown) {
      setAuthError(error instanceof Error ? error.message : 'Authentication failed');
      setAuthState('error');
    }
  };

  const handleSignOut = async () => {
    if (!auth) return;
    try {
      await signOut(auth);
      setPendingRoute(null);
      setAuthModalOpen(false);
      if (isLandslideRoute(pathname) || isRiverShiftRoute(pathname)) {
        navigateTo('/');
      }
    } catch (error: unknown) {
      setAuthError(error instanceof Error ? error.message : 'Sign out failed');
    }
  };

  const handleSelectEngine = (engine: Engine) => {
    // Known Place starts in its own AOI/date-window setup, then proceeds to
    // the existing two-polygon analysis page. Landslide and Glacier retain
    // the target-free AOI workspace.
    const targetRoute = engine.id === 'known-place'
      ? KNOWN_PLACE_SETUP_PATH
      : engine.id === 'river-shift' ? RIVER_SHIFT_PATH : FIND_DISPLACEMENT_PATH;
    if (!user) {
      setPendingRoute(targetRoute);
      setAuthModalOpen(true);
      return;
    }

    setAuthModalOpen(false);
    navigateTo(targetRoute);
  };

  const handleOpenWorkspace = useCallback(() => {
    document.getElementById('workflows')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, []);

  const handleOpenArchive = useCallback(() => {
    navigateTo('/archive');
  }, [navigateTo]);

  const handleOpenHowItWorks = useCallback(() => {
    navigateTo('/how-it-works');
  }, [navigateTo]);

  const handleStartFromHowItWorks = useCallback(() => {
    navigateTo('/');
  }, [navigateTo]);

  if (isDashboardRoute(pathname)) {
    const searchParams = new URLSearchParams(window.location.search);
    return (
      <DashboardPage
        jobId={searchParams.get('jobId') || ''}
        view={parseDashboardView(searchParams.get('view'))}
        user={user}
        authState={authState}
        authError={authError}
        onSignIn={handleSignIn}
      />
    );
  }

  if (isArchiveRoute(pathname)) {
    return (
      <ArchivePage
        user={user}
        authState={authState}
        onSignIn={handleSignIn}
        onSignOut={handleSignOut}
      />
    );
  }

  if (isHowItWorksRoute(pathname)) {
    return (
      <HowItWorksPage
        user={user}
        authState={authState}
        onHome={() => navigateTo('/')}
        onStart={handleStartFromHowItWorks}
        onSignIn={handleSignIn}
        onSignOut={handleSignOut}
      />
    );
  }

  if (isKnownPlaceResultsRoute(pathname)) {
    if (!user) {
      return (
        <Home
          user={user}
          authState={authState}
          authError={authError}
          apiConnectionStatus={apiConnectionStatus}
          apiConnectionError={apiConnectionError}
          firebaseConfigured={firebaseConfigured}
          missingFirebaseConfig={missingFirebaseConfig}
          showAuthModal={true}
          onCloseAuthModal={() => { setAuthModalOpen(false); setPendingRoute(null); }}
          onSignIn={handleSignIn}
          onSignOut={handleSignOut}
          onSelectEngine={handleSelectEngine}
          onOpenWorkspace={handleOpenWorkspace}
          onOpenArchive={handleOpenArchive}
          onOpenHowItWorks={handleOpenHowItWorks}
        />
      );
    }
    return (
      <KnownPlaceResultsPage
        user={user}
        authState={authState}
        onSignIn={handleSignIn}
        onSignOut={handleSignOut}
        onBack={() => navigateTo(KNOWN_PLACE_ANALYSIS_PATH)}
      />
    );
  }

  if (isRiverShiftRoute(pathname)) {
    if (!user) {
      return (
        <Home
          user={user}
          authState={authState}
          authError={authError}
          apiConnectionStatus={apiConnectionStatus}
          apiConnectionError={apiConnectionError}
          firebaseConfigured={firebaseConfigured}
          missingFirebaseConfig={missingFirebaseConfig}
          showAuthModal={true}
          onCloseAuthModal={() => { setAuthModalOpen(false); setPendingRoute(null); }}
          onSignIn={handleSignIn}
          onSignOut={handleSignOut}
          onSelectEngine={handleSelectEngine}
          onOpenWorkspace={handleOpenWorkspace}
          onOpenArchive={handleOpenArchive}
          onOpenHowItWorks={handleOpenHowItWorks}
        />
      );
    }

    if (isRiverShiftResultsRoute(pathname)) {
      return (
        <RiverShiftResultsPage
          key={user.uid}
          user={user}
          authState={authState}
          onSignIn={handleSignIn}
          onSignOut={handleSignOut}
          onBack={() => navigateTo(RIVER_SHIFT_PROCESSING_PATH)}
        />
      );
    }

    if (isRiverShiftProcessingRoute(pathname)) {
      return (
        <RiverShiftProcessingPage
          key={user.uid}
          user={user}
          authState={authState}
          onSignIn={handleSignIn}
          onSignOut={handleSignOut}
          onBack={() => navigateTo('/river-shift')}
          onViewResults={() => navigateTo(RIVER_SHIFT_RESULTS_PATH)}
        />
      );
    }

    return (
      <RiverShiftPage
        user={user}
        authState={authState}
        onSignIn={handleSignIn}
        onSignOut={handleSignOut}
        onStart={handleStartRiverShift}
      />
    );
  }

  if (isLandslideRoute(pathname)) {
    if (!user) {
      return (
        <Home
          user={user}
          authState={authState}
          authError={authError}
          apiConnectionStatus={apiConnectionStatus}
          apiConnectionError={apiConnectionError}
          firebaseConfigured={firebaseConfigured}
          missingFirebaseConfig={missingFirebaseConfig}
          showAuthModal={true}
          onCloseAuthModal={() => { setAuthModalOpen(false); setPendingRoute(null); }}
          onSignIn={handleSignIn}
          onSignOut={handleSignOut}
          onSelectEngine={handleSelectEngine}
          onOpenWorkspace={handleOpenWorkspace}
          onOpenArchive={handleOpenArchive}
          onOpenHowItWorks={handleOpenHowItWorks}
        />
      );
    }

    const landslideSessionMode = isLandslideKnownPlaceAnalysisRoute(pathname) || isLandslideKnownPlaceSetupRoute(pathname)
      ? 'known-place'
      : 'find-displacement';

    return (
      <LandslidePage
        key={`${user.uid}:${landslideSessionMode}`}
        user={user}
        authState={authState}
        onSignIn={handleSignIn}
        onHome={() => navigateTo('/')}
        isResultsPage={isLandslideResultsRoute(pathname)}
        isDisplacementPage={isLandslideDisplacementRoute(pathname)}
        isResultViewsPage={isLandslideResultViewsRoute(pathname)}
        resultJobId={isLandslideResultViewsRoute(pathname) ? decodeURIComponent(pathname.slice(FIND_DISPLACEMENT_OUTPUTS_PATH.length + 1)) : null}
        isKnownPlaceAnalysisPage={isLandslideKnownPlaceAnalysisRoute(pathname)}
          isKnownPlaceSetupPage={isLandslideKnownPlaceSetupRoute(pathname)}
        onDisplacements={() => navigateTo(FIND_DISPLACEMENT_DISPLACEMENT_PATH)}
        onViewResults={(jobId) => navigateTo(`${FIND_DISPLACEMENT_OUTPUTS_PATH}/${encodeURIComponent(jobId)}`)}
        onKnownPlaceAnalysis={() => navigateTo(KNOWN_PLACE_ANALYSIS_PATH)}
        onShowKnownPlaceResults={() => navigateTo(KNOWN_PLACE_RESULTS_PATH)}
        onResults={() => navigateTo(FIND_DISPLACEMENT_RESULTS_PATH)}
        onBackToMap={() => navigateTo(
          isLandslideKnownPlaceSetupAnalysisRoute(pathname)
            ? KNOWN_PLACE_SETUP_PATH
            : FIND_DISPLACEMENT_PATH
        )}
        onDisplacementTaskActivityChange={setHasActiveDisplacementTask}
        onSignOut={handleSignOut}
      />
    );
  }

  return (
    <Home
      user={user}
      authState={authState}
      authError={authError}
      apiConnectionStatus={apiConnectionStatus}
      apiConnectionError={apiConnectionError}
      firebaseConfigured={firebaseConfigured}
      missingFirebaseConfig={missingFirebaseConfig}
      showAuthModal={authModalOpen}
      onCloseAuthModal={() => { setAuthModalOpen(false); setPendingRoute(null); }}
      onSignIn={handleSignIn}
      onSignOut={handleSignOut}
      onSelectEngine={handleSelectEngine}
      onOpenWorkspace={handleOpenWorkspace}
      onOpenArchive={handleOpenArchive}
      onOpenHowItWorks={handleOpenHowItWorks}
    />
  );
}

export default App;
