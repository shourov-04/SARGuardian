import { describe, expect, it, vi } from 'vitest';
import { ARCHIVE_PATH, FIND_DISPLACEMENT_DISPLACEMENT_PATH, FIND_DISPLACEMENT_PATH, FIND_DISPLACEMENT_PROCESSING_RESULT_PATH, FIND_DISPLACEMENT_RESULTS_PATH, HOW_IT_WORKS_PATH, KNOWN_PLACE_ANALYSIS_PATH, KNOWN_PLACE_RESULTS_PATH, KNOWN_PLACE_SETUP_PATH, RIVER_SHIFT_PATH, RIVER_SHIFT_PROCESSING_PATH, RIVER_SHIFT_RESULTS_PATH, isArchiveRoute, isDashboardRoute, isHowItWorksRoute, isKnownPlaceResultsRoute, isLandslideDisplacementRoute, isLandslideKnownPlaceAnalysisRoute, isLandslideKnownPlaceSetupAnalysisRoute, isLandslideKnownPlaceSetupRoute, isLandslideResultsRoute, isLandslideRoute, isRiverShiftProcessingRoute, isRiverShiftResultsRoute, isRiverShiftRoute, navigatePath, normalizePathname } from './routing';

describe('client-side route recognition', () => {
  it('recognizes Archive as its own page route, not a Home anchor', () => {
    expect(ARCHIVE_PATH).toBe('/archive');
    expect(isArchiveRoute('/archive')).toBe(true);
    expect(isArchiveRoute('/archive?state=ready')).toBe(true);
    expect(isArchiveRoute('/')).toBe(false);
    expect(isLandslideRoute('/archive')).toBe(false);
  });

  it('recognizes How it works as a dedicated page route', () => {
    expect(HOW_IT_WORKS_PATH).toBe('/how-it-works');
    expect(isHowItWorksRoute('/how-it-works')).toBe(true);
    expect(isHowItWorksRoute('/how-it-works?from=home')).toBe(true);
    expect(isHowItWorksRoute('/')).toBe(false);
    expect(isLandslideRoute('/how-it-works')).toBe(false);
  });

  it('recognizes the River Shift launch, processing and results routes', () => {
    expect(RIVER_SHIFT_PATH).toBe('/river-shift');
    expect(RIVER_SHIFT_PROCESSING_PATH).toBe('/river-shift/processing');
    expect(RIVER_SHIFT_RESULTS_PATH).toBe('/river-shift/results');
    expect(isRiverShiftRoute(RIVER_SHIFT_PATH)).toBe(true);
    expect(isRiverShiftRoute(RIVER_SHIFT_PROCESSING_PATH)).toBe(true);
    expect(isRiverShiftRoute(RIVER_SHIFT_RESULTS_PATH)).toBe(true);
    expect(isRiverShiftProcessingRoute(RIVER_SHIFT_PROCESSING_PATH)).toBe(true);
    expect(isRiverShiftProcessingRoute(RIVER_SHIFT_PATH)).toBe(false);
    expect(isRiverShiftResultsRoute(RIVER_SHIFT_RESULTS_PATH)).toBe(true);
    expect(isRiverShiftResultsRoute(RIVER_SHIFT_PROCESSING_PATH)).toBe(false);
  });

  it('recognizes the refresh-safe Find Displacements result route', () => {
    expect(FIND_DISPLACEMENT_PROCESSING_RESULT_PATH).toBe('/find-displacement/processing/result');
    expect(isDashboardRoute(FIND_DISPLACEMENT_PROCESSING_RESULT_PATH)).toBe(true);
  });

  it('normalizes query strings and hashes without changing the route', () => {
    expect(normalizePathname('/landslide/results?from=map#summary')).toBe('/landslide/results');
    expect(normalizePathname('')).toBe('/');
  });

  it('recognizes the dedicated home-launched Known Place setup and two-polygon analysis routes', () => {
    expect(KNOWN_PLACE_SETUP_PATH).toBe('/known-place-analysis');
    expect(KNOWN_PLACE_ANALYSIS_PATH).toBe('/known-place-analysis/analysis');
    expect(KNOWN_PLACE_RESULTS_PATH).toBe('/known-place-analysis/analysis/result');
    expect(isLandslideKnownPlaceSetupRoute(KNOWN_PLACE_SETUP_PATH)).toBe(true);
    expect(isLandslideRoute(KNOWN_PLACE_SETUP_PATH)).toBe(true);
    expect(isLandslideKnownPlaceSetupAnalysisRoute(KNOWN_PLACE_ANALYSIS_PATH)).toBe(true);
    expect(isLandslideKnownPlaceAnalysisRoute(KNOWN_PLACE_ANALYSIS_PATH)).toBe(true);
    expect(isKnownPlaceResultsRoute(KNOWN_PLACE_RESULTS_PATH)).toBe(true);
    expect(isLandslideRoute(KNOWN_PLACE_RESULTS_PATH)).toBe(true);
    expect(isLandslideKnownPlaceSetupRoute('/landslide/known-place-setup')).toBe(false);
    expect(isLandslideKnownPlaceAnalysisRoute('/landslide/known-place-setup/analysis')).toBe(false);
  });

  it('recognizes the map and results routes', () => {
    expect(isLandslideRoute('/landslide')).toBe(false);
    expect(isLandslideRoute('/landslide/results')).toBe(false);
    expect(isLandslideResultsRoute('/landslide/results')).toBe(false);
    expect(isLandslideRoute('/')).toBe(false);
  });

  it('pushes a route once and returns the normalized route for React state', () => {
    const pushState = vi.fn();
    expect(navigatePath('/landslide/results?from=map', '/landslide', pushState)).toBe('/landslide/results');
    expect(pushState).toHaveBeenCalledOnce();
    expect(pushState).toHaveBeenCalledWith({}, '', '/landslide/results');

    expect(navigatePath('/landslide/results', '/landslide/results', pushState)).toBe('/landslide/results');
    expect(pushState).toHaveBeenCalledOnce();
  });

  it('uses Find Displacement as the canonical public route while accepting legacy aliases', () => {
    expect(FIND_DISPLACEMENT_PATH).toBe('/find-displacement');
    expect(FIND_DISPLACEMENT_DISPLACEMENT_PATH).toBe('/find-displacement/displacements');
    expect(FIND_DISPLACEMENT_RESULTS_PATH).toBe('/find-displacement/results');
    expect(isLandslideRoute('/find-displacement/displacements')).toBe(true);
    expect(isLandslideDisplacementRoute('/find-displacement/displacements')).toBe(true);
    expect(isLandslideResultsRoute('/find-displacement/results')).toBe(true);
    expect(isLandslideDisplacementRoute('/landslide/displacements')).toBe(false);
  });
});
