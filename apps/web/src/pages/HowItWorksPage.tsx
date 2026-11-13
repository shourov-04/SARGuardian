import { useEffect, useRef, type ReactNode } from 'react';
import { importLibrary } from '@googlemaps/js-api-loader';
import type { User } from 'firebase/auth';
import { Footer } from '../components/Footer';
import { Header } from '../components/Header';
import { configureGoogleMaps } from '../googleMapsLoader';
import { useGlassPointer } from '../useGlassPointer';

const GOOGLE_MAPS_KEY = (import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string | undefined)?.trim() ?? '';
const KHUMBU_LOCATION = { lat: 27.9881, lng: 86.9250 };
const KHUMBU_STUDY_POLYGON = [
  { lat: 28.092, lng: 86.76 },
  { lat: 28.118, lng: 87.02 },
  { lat: 28.012, lng: 87.17 },
  { lat: 27.858, lng: 87.06 },
  { lat: 27.816, lng: 86.86 },
  { lat: 27.894, lng: 86.72 },
];

type HowItWorksPageProps = {
  user: User | null;
  authState: 'idle' | 'loading' | 'ready' | 'error';
  onHome: () => void;
  onStart: () => void;
  onSignIn: () => void;
  onSignOut: () => void;
};

function DemoRow({
  number,
  title,
  description,
  reverse = false,
  children,
}: {
  number: number;
  title: string;
  description: string;
  reverse?: boolean;
  children: ReactNode;
}) {
  return (
    <article className={`claude-demo-row${reverse ? ' is-reverse' : ''}`}>
      <div className="claude-demo-copy">
        <span>{number}</span>
        <h2>{title}</h2>
        <p>{description}</p>
      </div>
      <div className="claude-demo-visual" data-glass-pointer>{children}</div>
    </article>
  );
}

function DemoLine({ label, value, tone }: { label: string; value: string; tone?: 'ok' | 'warn' | 'info' }) {
  return (
    <div className="claude-demo-line">
      <span>{label}</span>
      <strong className={tone ? `is-${tone}` : ''}>{value}</strong>
    </div>
  );
}

function HardcodedMapDemo() {
  const mapElement = useRef<HTMLDivElement>(null);
  const satellitePreviewUrl = GOOGLE_MAPS_KEY
    ? `https://maps.googleapis.com/maps/api/staticmap?center=${KHUMBU_LOCATION.lat},${KHUMBU_LOCATION.lng}&zoom=9&size=900x600&scale=2&maptype=satellite&key=${encodeURIComponent(GOOGLE_MAPS_KEY)}`
    : '';

  useEffect(() => {
    if (!GOOGLE_MAPS_KEY || !mapElement.current) return undefined;
    let cancelled = false;

    configureGoogleMaps(GOOGLE_MAPS_KEY);
    importLibrary('maps').then((library) => {
      if (cancelled || !mapElement.current) return;
      const maps = library as google.maps.MapsLibrary;
      const map = new maps.Map(mapElement.current, {
        center: KHUMBU_LOCATION,
        zoom: 9,
        mapTypeId: 'satellite',
        disableDefaultUI: true,
        gestureHandling: 'none',
        keyboardShortcuts: false,
        clickableIcons: false,
      });
      new google.maps.Polygon({
        map,
        paths: KHUMBU_STUDY_POLYGON,
        fillColor: '#2798ee',
        fillOpacity: 0.26,
        strokeColor: '#62c1ff',
        strokeOpacity: 0.98,
        strokeWeight: 3,
      });
      new google.maps.Marker({ map, position: KHUMBU_LOCATION, title: 'Khumbu study area' });
    }).catch(() => {
      // The styled fallback remains visible when the browser key is unavailable.
    });

    return () => { cancelled = true; };
  }, []);

  return (
    <div
      className="claude-demo-map"
      style={satellitePreviewUrl ? { backgroundImage: `url("${satellitePreviewUrl}")` } : undefined}
    >
      <div ref={mapElement} className="claude-demo-map-canvas" aria-hidden="true" />
      <span className="claude-demo-location">Khumbu, Nepal · Example study area</span>
    </div>
  );
}

export function HowItWorksPage({ user, authState, onStart, onSignIn, onSignOut }: HowItWorksPageProps) {
  useGlassPointer();
  return (
    <div className="home-page claude-home claude-how-page">
      <div className="claude-background" aria-hidden="true"><i /><i /><i /></div>
      <Header user={user} authState={authState} onSignIn={onSignIn} onSignOut={onSignOut} isArchivePage hideProfile />

      <main className="claude-how-main">
        <div className="claude-wrap">
          <header className="claude-how-hero">
            <h1>How it works.</h1>
            <p>From an area on the map to evidence you can inspect: select an AOI, discover compatible NISAR products, process the request, and review the result.</p>
            <p className="claude-how-note">The panels below are explanatory examples. Live maps, acquisition dates, source products, and processing states are generated from each submitted analysis.</p>
          </header>

          <DemoRow number={1} title="Choose an area." description="Search for a place or draw a polygon on the map. Then choose the observation dates.">
            <HardcodedMapDemo />
            <DemoLine label="Observation window" value="User-selected dates" tone="info" />
          </DemoRow>

          <DemoRow number={2} title="Discover compatible data." description="The catalogue preflight searches for NISAR products intersecting the selected AOI and observation window." reverse>
            <DemoLine label="Unwrapped interferograms" value="GUNW product family" tone="ok" />
            <DemoLine label="Pixel offsets" value="GOFF product family" tone="ok" />
            <DemoLine label="Processing" value="Next workflow stage" />
          </DemoRow>

          <DemoRow number={3} title="Process and screen." description="The selected workflow passes the request to its processing worker, which checks product compatibility, data support, and the relevant analysis contract.">
            <div className="claude-progress"><span><b>Product processing</b><em>Workflow stage</em></span><i><b style={{ width: '100%' }} /></i></div>
            <div className="claude-progress"><span><b>Quality and provenance</b><em>Workflow stage</em></span><i><b style={{ width: '100%' }} /></i></div>
            <div className="claude-progress"><span><b>Candidate screening</b><em>Workflow stage</em></span><i><b style={{ width: '64%' }} /></i></div>
          </DemoRow>

          <DemoRow number={4} title="Review the evidence." description="Explore spatial outputs together with the acquisition dates, product identifiers, measurements, and quality information that support interpretation." reverse>
            <DemoLine label="Spatial output" value="Candidate layers" tone="warn" />
            <DemoLine label="Measurement context" value="Product-specific" />
            <DemoLine label="Quality record" value="Available with result" tone="info" />
            <DemoLine label="Source" value="Linked to product record" />
          </DemoRow>

          <section className="claude-how-limits">
            <h2>Three NISAR evidence families.</h2>
            <div className="claude-limits-grid">
              <article data-glass-pointer><h3>GOFF · Pixel offsets</h3><p>Along-track and slant-range offset observations used for spatial displacement screening.</p></article>
              <article data-glass-pointer><h3>GUNW · Interferometric phase</h3><p>Pairwise phase and Line-of-Sight diagnostics, presented separately from GOFF offsets.</p></article>
              <article data-glass-pointer><h3>GCOV · Radar covariance</h3><p>Multi-date radar observations used by RiverShift to screen water and land–water transitions.</p></article>
            </div>
          </section>

          <section className="claude-how-cta">
            <h2>Ready to explore?</h2>
            <button className="claude-button primary" type="button" onClick={onStart}>Start exploring</button>
          </section>
        </div>
      </main>
      <Footer />
    </div>
  );
}
