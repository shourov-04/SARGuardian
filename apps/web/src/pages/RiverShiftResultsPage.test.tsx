import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import type { User } from 'firebase/auth';
import { RiverShiftResultsPage, GranuleProvenancePanel } from './RiverShiftResultsPage';

describe('RiverShiftResultsPage', () => {
  const mockUser = {
    uid: 'test-user-123',
    getIdToken: vi.fn().mockResolvedValue('test-token'),
  } as unknown as User;

  it('renders the results header and back navigation button', () => {
    const html = renderToStaticMarkup(
      <RiverShiftResultsPage
        user={mockUser}
        authState="ready"
        onSignIn={vi.fn().mockResolvedValue(undefined)}
        onSignOut={vi.fn().mockResolvedValue(undefined)}
        onBack={vi.fn()}
      />,
    );
    expect(html).toContain('River Shift Results');
    expect(html).toContain('Back to processing');
    expect(html).toContain('03 · RESULTS EXPLORER');
  });

  it('renders granule provenance with toggle details, sha-256 and size data matching Known Place style', () => {
    const mockSource = {
      granule_names: [
        'NISAR_L2_PR_GCOV_023_069_A_014_4005_DHDH_A_20260618T232135_20260618T232210_P05023_N_F_J_001',
        'NISAR_L2_PR_GCOV_024_069_A_014_4005_DHDH_A_20260630T232134_20260630T232209_P05023_N_F_J_001',
      ],
      maturity: 'PROVISIONAL',
      cache_status: 'DOWNLOADED_AND_HASHED',
    };
    const html = renderToStaticMarkup(<GranuleProvenancePanel source={mockSource} />);
    expect(html).toContain('known-place-provenance');
    expect(html).toContain('SOURCE PROVENANCE');
    expect(html).toContain('Granules and integrity hashes');
    expect(html).toContain('2 source granules');
    expect(html).toContain('NISAR_L2_PR_GCOV_023_069_A_014_4005_DHDH_A_20260618T232135_20260618T232210_P05023_N_F_J_001.h5');
    expect(html).toContain('P05023 · PROVISIONAL · DOWNLOADED_AND_HASHED');
    expect(html).toContain('SHA-256:');
    expect(html).toContain('GiB source granule');
    expect(html).toContain('<details');
    expect(html).toContain('<summary');
  });
});


