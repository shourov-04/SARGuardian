import type { User } from 'firebase/auth';
import { Footer } from '../components/Footer';
import { Header } from '../components/Header';

type ArchivePageProps = {
  user: User | null;
  authState: 'idle' | 'loading' | 'ready' | 'error';
  onSignIn: () => void;
  onSignOut: () => void;
};

export function ArchivePage({ user, authState, onSignIn, onSignOut }: ArchivePageProps) {
  return (
    <div className="home-page archive-page">
      <div className="environment-layer" aria-hidden="true" />
      <div className="ambient-vignette" aria-hidden="true" />
      <Header
        user={user}
        authState={authState}
        onSignIn={onSignIn}
        onSignOut={onSignOut}
        isArchivePage
        hideProfile
        hideSignIn
      />
      <main className="home-main archive-main">
        <section className="archive-coming-soon" aria-label="Archive">
          <h1>Coming Soon...</h1>
        </section>
      </main>
      <Footer />
    </div>
  );
}
