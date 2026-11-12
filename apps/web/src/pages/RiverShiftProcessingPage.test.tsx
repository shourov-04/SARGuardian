import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { RiverShiftJobStatus, RiverShiftProcessingPage } from './RiverShiftProcessingPage';
import type { RiverShiftJob } from '../api/catalog';
import type { User } from 'firebase/auth';

const job = {
  id: '736bd4e6-8963-43be-a916-bc62336c8557', state: 'failed', stage: 'download_failed',
  start_date: '2026-08-01', end_date: '2026-09-20',
  created_at: '2026-09-20T00:00:00Z', updated_at: '2026-09-20T00:01:00Z',
  error_message: 'Download failed',
} as RiverShiftJob;

describe('River Shift retry controls', () => {
  const render = (state = job.state, retrying = false) => renderToStaticMarkup(
    <RiverShiftJobStatus job={{ ...job, state }} clock={0} onViewResults={vi.fn()} onRetry={vi.fn()} retrying={retrying} />,
  );

  it('offers Retry for failures and retains the error while submitting', () => {
    expect(render()).toContain('>Retry</button>');
    const pending = render('failed', true);
    expect(pending).toContain('disabled=""');
    expect(pending).toContain('Retrying…');
    expect(pending).toContain('Download failed');
    expect(pending).not.toContain('saved settings');
  });

  it('marks the server-reported failed stage in the stepper', () => {
    const html = render();
    expect(html).toContain('processing-stepper');
    expect(html).toContain('is-failed');
    expect(html).toContain('processing-page--failed');
  });

  it('renders completed processing as a successful state', () => {
    const html = renderToStaticMarkup(
      <RiverShiftJobStatus job={{ ...job, state: 'succeeded', stage: 'completed' }} clock={0} onViewResults={vi.fn()} onRetry={vi.fn()} retrying={false} />,
    );
    expect(html).toContain('processing-page--succeeded');
    expect(html).toContain('Complete');
    expect(html).not.toContain('is-failed');
  });

  it('does not render the removed footer tagline', () => {
    expect(renderToStaticMarkup(
      <RiverShiftProcessingPage user={null} authState="idle" onSignIn={vi.fn()} onSignOut={vi.fn()} />,
    )).not.toContain('Open science');
  });

  it.each(['queued', 'dispatching', 'running', 'succeeded', 'cancelled'] as const)(
    'does not offer Retry for %s jobs', (state) => expect(render(state)).not.toContain('>Retry</button>'),
  );
});

describe('RiverShiftProcessingPage initial load and configuration options', () => {
  const mockUser = {
    uid: 'test-user-123',
    getIdToken: vi.fn().mockResolvedValue('test-token'),
  } as unknown as User;

  it('renders skeleton during initial job loading and omits the advanced settings block', () => {
    const html = renderToStaticMarkup(
      <RiverShiftProcessingPage
        user={mockUser}
        authState="ready"
        onSignIn={vi.fn().mockResolvedValue(undefined)}
        onSignOut={vi.fn().mockResolvedValue(undefined)}
      />,
    );
    expect(html).toContain('processing-page-skeleton');
    expect(html).toContain('processing-skeleton-orbit');
    expect(html).not.toContain('rs-advanced-settings');
    expect(html).not.toContain('Run RiverShift');
  });
});
