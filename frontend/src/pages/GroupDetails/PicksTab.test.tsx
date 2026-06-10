import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import PicksTab from './PicksTab';
import type { GroupMember } from '../../lib/groupsService';
import type { GetPicksResponse } from '../../lib/picksService';

// Mock the season helper so the derived season is deterministic, and the picks
// service so the test fully controls the fetched shape without touching network.
// The "current" season is 2026 (offseason) while the group's pick data lives in
// 2025 — the regression scenario: the tab must default to the season with data.
vi.mock('../../lib/nflSeasonUtils.js', () => ({ getCurrentNFLSeason: vi.fn(() => 2026) }));
vi.mock('../../lib/picksService.js', () => ({
  getClosestWeek: vi.fn(),
  getPicks: vi.fn(),
  getPickSeasons: vi.fn(),
}));

import { getClosestWeek, getPicks, getPickSeasons } from '../../lib/picksService.js';
const mockGetClosestWeek = vi.mocked(getClosestWeek);
const mockGetPicks = vi.mocked(getPicks);
const mockGetPickSeasons = vi.mocked(getPickSeasons);

const identifier = 'sunday-squad';

const members: GroupMember[] = [
  { id: 'm1', name: 'Alice', email: 'alice@example.com', isOwner: true, joinedAt: '2026-01-01', pictureUrl: null },
  { id: 'm2', name: 'Bob', email: 'bob@example.com', isOwner: false, joinedAt: '2026-01-02', pictureUrl: null },
];

const buf = { id: '1', name: 'Bills', abbreviation: 'BUF', logo: '' };
const ne = { id: '2', name: 'Patriots', abbreviation: 'NE', logo: '' };

// One FINAL game (away BUF beat home NE) and one SCHEDULED game.
const games: GetPicksResponse['games'] = [
  {
    id: 1, espnId: 'e1', homeTeam: ne, awayTeam: buf, homeScore: 20, awayScore: 24,
    status: 'FINAL', gameDate: '2025-09-14T17:00:00.000Z', week: 2, season: 2025, seasonType: 2,
  },
  {
    id: 2, espnId: 'e2', homeTeam: buf, awayTeam: ne, homeScore: 0, awayScore: 0,
    status: 'SCHEDULED', gameDate: '2025-09-21T17:00:00.000Z', week: 2, season: 2025, seasonType: 2,
  },
];

function arrayResponse(): GetPicksResponse {
  return {
    games,
    picks: [
      { memberId: 'm1', picks: [{ gameId: 1, pickedTeamId: '1', confidence: 5, won: true, points: 5 }] },
      { memberId: 'm2', picks: [{ gameId: 1, pickedTeamId: '2', confidence: 3, won: false, points: -3 }] },
    ],
  };
}

describe('PicksTab', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetPickSeasons.mockResolvedValue({ seasons: [2025] });
    mockGetClosestWeek.mockResolvedValue({ season: 2025, seasonType: 2, week: 2 });
    mockGetPicks.mockResolvedValue(arrayResponse());
  });

  it('shows a loading state before the fetch resolves', async () => {
    render(<PicksTab identifier={identifier} members={members} />);
    expect(screen.getByText('Loading picks…')).toBeInTheDocument();
    // Let the in-flight fetch settle so its state update happens inside act().
    await screen.findByText('BUF @ NE');
  });

  it('defaults to the latest season with pick data, not the empty current season', async () => {
    render(<PicksTab identifier={identifier} members={members} />);
    await screen.findByText('BUF @ NE');
    // Current NFL season is 2026 (offseason) but the group's data is in 2025:
    // the closest-week resolution and picks fetch must both target 2025.
    expect(mockGetClosestWeek).toHaveBeenCalledWith(identifier, 2025, 2);
    expect(mockGetPicks).toHaveBeenCalledWith(identifier, { season: 2025, seasonType: 2, week: 2 });
    // The season selector defaults to 2025 while still offering the current season.
    const seasonSelect = screen.getByLabelText('Select season') as HTMLSelectElement;
    expect(seasonSelect.value).toBe('2025');
    expect(Array.from(seasonSelect.options).map((o) => o.value)).toEqual(['2026', '2025']);
  });

  it('falls back to the current season when the group has no pick data', async () => {
    mockGetPickSeasons.mockResolvedValue({ seasons: [] });
    render(<PicksTab identifier={identifier} members={members} />);
    await screen.findByText('BUF @ NE');
    expect(mockGetClosestWeek).toHaveBeenCalledWith(identifier, 2026, 2);
    expect(mockGetPicks).toHaveBeenCalledWith(identifier, { season: 2026, seasonType: 2, week: 2 });
  });

  it('refetches picks when the week selector changes', async () => {
    render(<PicksTab identifier={identifier} members={members} />);
    await screen.findByText('BUF @ NE');
    expect(mockGetPicks).toHaveBeenCalledTimes(1);

    fireEvent.change(screen.getByLabelText('Select week'), { target: { value: '5' } });
    await waitFor(() =>
      expect(mockGetPicks).toHaveBeenCalledWith(identifier, { season: 2025, seasonType: 2, week: 5 }),
    );
  });

  it('re-resolves the closest week when the season selector changes', async () => {
    render(<PicksTab identifier={identifier} members={members} />);
    await screen.findByText('BUF @ NE');
    expect(mockGetClosestWeek).toHaveBeenCalledTimes(1);

    fireEvent.change(screen.getByLabelText('Select season'), { target: { value: '2026' } });
    await waitFor(() => expect(mockGetClosestWeek).toHaveBeenCalledWith(identifier, 2026, 2));
  });

  it('renders the GroupPicks matrix with member columns and adapted picks', async () => {
    render(<PicksTab identifier={identifier} members={members} />);
    // Member column headers.
    expect(await screen.findByText('Alice')).toBeInTheDocument();
    expect(screen.getByText('Bob')).toBeInTheDocument();
    // FINAL game row with a revealed, graded pick (BUF, 5 points for Alice).
    expect(screen.getByText('BUF @ NE')).toBeInTheDocument();
    expect(screen.getByText('5')).toBeInTheDocument();
    // SCHEDULED game withholds picks until kickoff.
    expect(screen.getByText('NE @ BUF')).toBeInTheDocument();
    expect(screen.getAllByText('Hidden').length).toBeGreaterThan(0);
  });

  it('re-runs the fetch when the GroupPicks Refresh action is invoked', async () => {
    render(<PicksTab identifier={identifier} members={members} />);
    await screen.findByText('BUF @ NE');
    expect(mockGetPicks).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole('button', { name: 'Refresh' }));
    await waitFor(() => expect(mockGetPicks).toHaveBeenCalledTimes(2));
  });

  it('adapts the map form of picks (memberId -> PickData[])', async () => {
    mockGetPicks.mockResolvedValue({
      games,
      picks: { m1: [{ gameId: 1, pickedTeamId: '1', confidence: 7, won: true, points: 7 }] },
    });
    render(<PicksTab identifier={identifier} members={members} />);
    expect(await screen.findByText('7')).toBeInTheDocument();
  });

  it('shows an error message and no GroupPicks when the fetch fails', async () => {
    mockGetPicks.mockRejectedValue(new Error('Failed to load picks'));
    render(<PicksTab identifier={identifier} members={members} />);
    expect(await screen.findByText('Failed to load picks')).toBeInTheDocument();
    // The error branch replaces the matrix entirely — GroupPicks' header/columns are absent.
    expect(screen.queryByText('Group Picks')).not.toBeInTheDocument();
    expect(screen.queryByText('Alice')).not.toBeInTheDocument();
    expect(screen.queryByText('BUF @ NE')).not.toBeInTheDocument();
  });

  it('renders gracefully when the response carries no picks', async () => {
    mockGetPicks.mockResolvedValue({ games });
    render(<PicksTab identifier={identifier} members={members} />);
    expect(await screen.findByText('BUF @ NE')).toBeInTheDocument();
  });
});
