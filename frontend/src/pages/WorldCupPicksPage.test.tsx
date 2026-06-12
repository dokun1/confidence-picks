import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import WorldCupPicksPage from './WorldCupPicksPage';
import type { WorldCupMatch, WorldCupStage } from '../lib/types';

// The page is a thin shell around WorldCupPicksTab (which owns the stage list,
// draft state, and sticky submit bar — see WorldCupPicksTab.test.tsx for that
// coverage). These tests pin the shell behavior: the `group` query param gate
// and the heading + embedded surface when a group is present.

vi.mock('../lib/worldCupService.js', () => ({
  getStageMatches: vi.fn(),
  submitWorldCupPicks: vi.fn(),
  getMyWorldCupPicks: vi.fn(),
}));
vi.mock('../lib/groupsService.js', () => ({
  getMyGroups: vi.fn(),
}));

import { getStageMatches, getMyWorldCupPicks } from '../lib/worldCupService.js';
import { getMyGroups } from '../lib/groupsService.js';
const mockGetStageMatches = vi.mocked(getStageMatches);
const mockGetMyWorldCupPicks = vi.mocked(getMyWorldCupPicks);
const mockGetMyGroups = vi.mocked(getMyGroups);

const mex = { id: '1', name: 'Mexico', abbreviation: 'MEX', logo: '' };
const usa = { id: '2', name: 'United States', abbreviation: 'USA', logo: '' };

const groupMatch: WorldCupMatch = {
  id: 10,
  stage: 'group',
  homeTeam: mex,
  awayTeam: usa,
  homeScore: 0,
  awayScore: 0,
  status: 'SCHEDULED',
  isKnockout: false,
  // Tomorrow, so the match stays pre-kickoff and pickable whenever CI runs.
  gameDate: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
};

function renderPage(route = '/world-cup?group=la-crew') {
  return render(
    <MemoryRouter initialEntries={[route]}>
      <WorldCupPicksPage />
    </MemoryRouter>,
  );
}

describe('WorldCupPicksPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetStageMatches.mockImplementation((stage: WorldCupStage) => {
      const games = stage === 'group' ? [groupMatch] : [];
      return Promise.resolve({ games, count: games.length, cached: false });
    });
    mockGetMyGroups.mockResolvedValue([
      { id: 1, identifier: 'la-crew', name: 'LA Crew', poolType: 'world_cup_2026' },
    ] as any);
    mockGetMyWorldCupPicks.mockResolvedValue({ picks: [] });
  });

  it('shows the not-found UI when no group query param is present', () => {
    renderPage('/world-cup');
    expect(screen.getByText('Group Not Found')).toBeInTheDocument();
    expect(screen.queryByText('World Cup 2026 Picks')).not.toBeInTheDocument();
    // The picks surface never mounts, so no stage fetch fires.
    expect(mockGetStageMatches).not.toHaveBeenCalled();
  });

  it('renders the page heading with the embedded picks surface for a group', async () => {
    renderPage();

    expect(
      screen.getByRole('heading', { name: 'World Cup 2026 Picks' }),
    ).toBeInTheDocument();

    // The embedded WorldCupPicksTab fetches the stages and renders the flat
    // browse list (matchup subheader) plus the sticky submit bar.
    expect(
      await screen.findByText((_c, n) => n?.textContent?.startsWith('Mexico vs ') ?? false, {
        selector: 'span',
      }),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Submit Picks' })).toBeInTheDocument();
    expect(mockGetStageMatches).toHaveBeenCalledTimes(7);
  });
});
