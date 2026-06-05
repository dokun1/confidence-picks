import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import PicksTab from './PicksTab';
import type { GroupMember } from '../../lib/groupsService';
import type { GetPicksResponse } from '../../lib/picksService';

// Mock the season helper so the derived season is deterministic, and the picks
// service so the test fully controls the fetched shape without touching network.
vi.mock('../../lib/nflSeasonUtils.js', () => ({ getCurrentNFLSeason: vi.fn(() => 2025) }));
vi.mock('../../lib/picksService.js', () => ({
  getClosestWeek: vi.fn(),
  getPicks: vi.fn(),
}));

import { getClosestWeek, getPicks } from '../../lib/picksService.js';
const mockGetClosestWeek = vi.mocked(getClosestWeek);
const mockGetPicks = vi.mocked(getPicks);

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
    mockGetClosestWeek.mockResolvedValue({ season: 2025, seasonType: 2, week: 2 });
    mockGetPicks.mockResolvedValue(arrayResponse());
  });

  it('shows a loading state before the fetch resolves', async () => {
    render(<PicksTab identifier={identifier} members={members} />);
    expect(screen.getByText('Loading picks…')).toBeInTheDocument();
    // Let the in-flight fetch settle so its state update happens inside act().
    await screen.findByText('BUF @ NE');
  });

  it('derives the season, resolves the closest week, then fetches picks for it', async () => {
    render(<PicksTab identifier={identifier} members={members} />);
    await screen.findByText('BUF @ NE');
    expect(mockGetClosestWeek).toHaveBeenCalledWith(identifier, 2025, 2);
    expect(mockGetPicks).toHaveBeenCalledWith(identifier, { season: 2025, seasonType: 2, week: 2 });
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
