import { renderHook, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('../../lib/picksService.js', () => ({ getPickSeasons: vi.fn() }));

import { getPickSeasons } from '../../lib/picksService.js';
import { useSeasonOptions } from './useSeasonOptions';

const mockGetPickSeasons = vi.mocked(getPickSeasons);

/** Freeze the clock so getCurrentNFLSeason/isNFLSeasonUnderway are deterministic. */
function freeze(iso: string) {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  vi.setSystemTime(new Date(iso));
}

describe('useSeasonOptions', () => {
  beforeEach(() => vi.clearAllMocks());
  afterEach(() => vi.useRealTimers());

  it('lands on the current season in week 1, before anyone has picked', async () => {
    freeze('2026-09-10T12:00:00Z'); // season under way, no 2026 picks yet
    mockGetPickSeasons.mockResolvedValue({ seasons: [2025] });

    const { result } = renderHook(() => useSeasonOptions('okun-family-picks'));

    await waitFor(() => expect(result.current.resolved).toBe(true));
    expect(result.current.season).toBe(2026);
    // last season stays reachable
    expect(result.current.options).toEqual([2026, 2025]);
  });

  it('keeps the current season once it has data', async () => {
    freeze('2026-11-02T12:00:00Z');
    mockGetPickSeasons.mockResolvedValue({ seasons: [2026, 2025] });

    const { result } = renderHook(() => useSeasonOptions('g'));

    await waitFor(() => expect(result.current.resolved).toBe(true));
    expect(result.current.season).toBe(2026);
  });

  it('falls back to the newest season with data during the offseason', async () => {
    // June: getCurrentNFLSeason() already says 2026, but no games have been played.
    // Defaulting to it here is what used to make old groups look wiped.
    freeze('2026-06-15T12:00:00Z');
    mockGetPickSeasons.mockResolvedValue({ seasons: [2025, 2024] });

    const { result } = renderHook(() => useSeasonOptions('g'));

    await waitFor(() => expect(result.current.resolved).toBe(true));
    expect(result.current.season).toBe(2025);
    expect(result.current.options).toEqual([2026, 2025, 2024]);
  });

  it('uses the current season for a brand new group with no picks at all', async () => {
    freeze('2026-06-15T12:00:00Z');
    mockGetPickSeasons.mockResolvedValue({ seasons: [] });

    const { result } = renderHook(() => useSeasonOptions('g'));

    await waitFor(() => expect(result.current.resolved).toBe(true));
    expect(result.current.season).toBe(2026);
  });

  it('falls back to the current season when the seasons fetch fails', async () => {
    freeze('2026-09-10T12:00:00Z');
    mockGetPickSeasons.mockRejectedValue(new Error('boom'));

    const { result } = renderHook(() => useSeasonOptions('g'));

    await waitFor(() => expect(result.current.resolved).toBe(true));
    expect(result.current.season).toBe(2026);
  });
});
