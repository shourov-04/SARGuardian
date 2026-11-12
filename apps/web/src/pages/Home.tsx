import type { User } from 'firebase/auth';
import type { Engine } from '../data/engineData';
import { engines } from '../data/engineData';
import { BrandLogo } from '../components/BrandLogo';
import { Footer } from '../components/Footer';
import { Header } from '../components/Header';
import { Hero } from '../components/Hero';
import { HomeSections } from './HomeSections';
import { useGlassPointer } from '../useGlassPointer';

type HomeProps = {
  user: User | null;
  authState: 'idle' | 'loading' | 'ready' | 'error';
  authError: string | null;
  apiConnectionStatus: 'idle' | 'checking' | 'ready' | 'error';
  apiConnectionError: string | null;
  firebaseConfigured: boolean;
  missingFirebaseConfig: readonly string[];
  showAuthModal?: boolean;
  onCloseAuthModal?: () => void;
  onSignIn: () => void;
  onSignOut: () => void;
  onSelectEngine: (engine: Engine) => void;
  onOpenWorkspace: () => void;
  onOpenArchive: () => void;
  onOpenHowItWorks: () => void;
};

type WorkflowCardProps = {
  title: string;
  description: string;
  action?: string;
  image: string;
  onClick?: () => void;
  comingSoon?: boolean;
  wide?: boolean;
};

function WorkflowCard({ title, description, action, image, onClick, comingSoon = false, wide = false }: WorkflowCardProps) {
  const content = (
    <>
      <img src={image} alt="" aria-hidden="true" />
      <span className="claude-workflow-shade" aria-hidden="true" />
      <span className="claude-workflow-copy">
        <strong>{title}</strong>
        <span>{description}</span>
        {comingSoon ? <em>Coming soon</em> : <b>{action}</b>}
      </span>
    </>
  );

  if (comingSoon) {
    return <div className={`claude-workflow-card is-soon${wide ? ' is-wide' : ''}`} aria-disabled="true" data-glass-pointer>{content}</div>;
  }

  return <button className={`claude-workflow-card${wide ? ' is-wide' : ''}`} type="button" onClick={onClick} data-glass-pointer>{content}</button>;
}

export function Home({
  user,
  authState,
  authError,
  showAuthModal = false,
  onCloseAuthModal,
  onSignIn,
  onSignOut,
  onSelectEngine,
  onOpenWorkspace,
  onOpenArchive,
  onOpenHowItWorks,
}: HomeProps) {
  useGlassPointer();
  const displacement = engines.find((engine) => engine.id === 'landslide')!;
  const knownPlace = engines.find((engine) => engine.id === 'known-place')!;
  const riverShift = engines.find((engine) => engine.id === 'river-shift')!;

  return (
    <div className="home-page claude-home">
      <div className="claude-background" aria-hidden="true"><i /><i /><i /></div>
      <Header
        user={user}
        authState={authState}
        onSignIn={onSignIn}
        onSignOut={onSignOut}
        onOpenArchive={onOpenArchive}
        onOpenHowItWorks={onOpenHowItWorks}
        hideHowItWorks
      />

      <main>
        <Hero onStartExploring={onOpenWorkspace} onOpenHowItWorks={onOpenHowItWorks} />

        <section className="claude-workflows" id="workflows">
          <div className="claude-wrap">
            <h2>What do you want to investigate?</h2>
            <div className="claude-workflow-grid">
              <WorkflowCard
                title="Find displacement"
                description="Screen a whole area for surface change, then inspect what the data supports."
                action="Open area analysis"
                image="/scenery/mountain-forest.jpg"
                onClick={() => onSelectEngine(displacement)}
              />
              <WorkflowCard
                title="Flood analysis"
                description="Map where water has spread after heavy rain."
                image="/scenery/flood-valley.jpg"
                comingSoon
              />
              <WorkflowCard
                title="Known place analysis"
                description="Draw a measurement area and a reference area for focused analysis."
                action="Select an area"
                image="/scenery/night-ridge.jpg"
                onClick={() => onSelectEngine(knownPlace)}
              />
              <WorkflowCard
                title="River shift"
                description="Find where rivers and land are trading places."
                action="Open River Shift"
                image="/scenery/forest-river.jpg"
                onClick={() => onSelectEngine(riverShift)}
              />
            </div>
          </div>
        </section>

        <HomeSections />
      </main>

      {showAuthModal && !user && (
        <div className="auth-modal-backdrop claude-auth-backdrop" role="dialog" aria-modal="true" aria-labelledby="auth-modal-title">
          <div className="claude-auth-modal">
            <button className="claude-auth-close" type="button" onClick={onCloseAuthModal} aria-label="Close authentication prompt">&times;</button>
            <BrandLogo className="claude-auth-logo" />
            <h2 id="auth-modal-title">Continue to SARGuardian</h2>
            <p>Sign in with Google to open the analysis workspace.</p>
            {authError && <p className="claude-auth-error" role="alert">{authError}</p>}
            <button className="claude-button primary claude-sign-in" onClick={onSignIn} type="button" disabled={authState === 'loading'}>
              {authState === 'loading' ? 'Signing in…' : 'Sign in with Google'}
            </button>
          </div>
        </div>
      )}

      <Footer />
    </div>
  );
}
