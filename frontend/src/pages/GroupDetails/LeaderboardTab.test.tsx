import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import LeaderboardTab from './LeaderboardTab';
import type { ScoreboardResponse } from '../../lib/picksService';

// The "current" season is 2026 (offseason) while the group's pick data lives in
// 2025 — the regression scenario: the leaderboard must default to the season
// with data so old groups keep their scores visible.
vi.mock('../../lib/nflSeasonUtils.js', () => ({ getCurrentNFLSeason: vi.fn(() => 2026) }));
vi.mock('../../lib/picksService.js', () => ({
  getPickSeasons: vi.fn(),
  getScoreboard: vi.fn(),
}));

import { getPickSeasons, getScoreboard } from '../../lib/picksService.js';
const mockGetPickSeasons = vi.mocked(getPickSeasons);
const mockGetScoreboard = vi.mocked(getScoreboard);

const identifier = 'sunday-squad';

function scoreboard(): ScoreboardResponse {
  return {
    season: 2025,
    seasonType: 2,
    weeks: [1, 2],
    users: [
      // Out of order on purpose: the tab sorts by totalPoints descending.
      { userId: 2, name: 'Bob', pictureUrl: null, weekly: [{ week: 1, points: 3 }, { week: 2, points: 4 }], totalPoints: 7 },
      { userId: 1, name: 'Alice', pictureUrl: null, weekly: [{ week: 1, points: 10 }, { week: 2, points: 5 }], totalPoints: 15 },
    ],
  };
}

describe('LeaderboardTab', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetPickSeasons.mockResolvedValue({ seasons: [2025] });
    mockGetScoreboard.mockResolvedValue(scoreboard());
  });

  it('shows a loading state before the fetch resolves', async () => {
    render(<LeaderboardTab identifier={identifier} />);
    expect(screen.getByText('Loading leaderboard…')).toBeInTheDocument();
    await screen.findAllByText('Alice');
  });

  it('defaults to the latest season with pick data and fetches its scoreboard', async () => {
    render(<LeaderboardTab identifier={identifier} />);
    await screen.findAllByText('Alice');
    expect(mockGetScoreboard).toHaveBeenCalledWith(identifier, { season: 2025, seasonType: 2 });
    const seasonSelect = screen.getByLabelText('Select season') as HTMLSelectElement;
    expect(seasonSelect.value).toBe('2025');
    expect(Array.from(seasonSelect.options).map((o) => o.value)).toEqual(['2026', '2025']);
  });

  it('renders standings sorted by total points with a weekly breakdown', async () => {
    render(<LeaderboardTab identifier={identifier} />);
    await screen.findAllByText('Alice');

    // Ranked list: Alice (15) above Bob (7). Names render in both the list and
    // the weekly table, so compare positions within the list only.
    const list = screen.getByRole('list');
    const items = Array.from(list.querySelectorAll('li')).map((li) => li.textContent ?? '');
    expect(items[0]).toContain('Alice');
    expect(items[0]).toContain('15');
    expect(items[1]).toContain('Bob');
    expect(items[1]).toContain('7');

    // Weekly breakdown table: one column per week with data plus the total.
    expect(screen.getByRole('columnheader', { name: 'W1' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'W2' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Total' })).toBeInTheDocument();
  });

  it('refetches the scoreboard when the season selector changes', async () => {
    render(<LeaderboardTab identifier={identifier} />);
    await screen.findAllByText('Alice');
    expect(mockGetScoreboard).toHaveBeenCalledTimes(1);

    fireEvent.change(screen.getByLabelText('Select season'), { target: { value: '2026' } });
    await waitFor(() =>
      expect(mockGetScoreboard).toHaveBeenCalledWith(identifier, { season: 2026, seasonType: 2 }),
    );
  });

  it('refetches when Refresh is clicked', async () => {
    render(<LeaderboardTab identifier={identifier} />);
    await screen.findAllByText('Alice');
    expect(mockGetScoreboard).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole('button', { name: 'Refresh' }));
    await waitFor(() => expect(mockGetScoreboard).toHaveBeenCalledTimes(2));
  });

  it('shows an empty state when the season has no scored weeks', async () => {
    mockGetPickSeasons.mockResolvedValue({ seasons: [] });
    mockGetScoreboard.mockResolvedValue({ season: 2026, seasonType: 2, weeks: [], users: [] });
    render(<LeaderboardTab identifier={identifier} />);
    expect(await screen.findByText(/No points yet for the 2026 season/i)).toBeInTheDocument();
  });

  it('shows the error message when the scoreboard fetch fails', async () => {
    mockGetScoreboard.mockRejectedValue(new Error('Failed to load scoreboard'));
    render(<LeaderboardTab identifier={identifier} />);
    expect(await screen.findByText('Failed to load scoreboard')).toBeInTheDocument();
  });
});
