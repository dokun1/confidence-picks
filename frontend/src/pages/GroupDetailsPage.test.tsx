import { render, screen, waitFor, fireEvent, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import GroupDetailsPage from './GroupDetailsPage';
import type {
  GroupDetail,
  GroupMember,
  GroupMessage,
} from '../lib/groupsService';
import type { WorldCupMatch, WorldCupStage } from '../lib/types';

// Mock the groups service so the three mount fetches are controllable per test
// without touching the network or auth tokens.
vi.mock('../lib/groupsService.js', () => ({
  getGroup: vi.fn(),
  getMembers: vi.fn(),
  getMessages: vi.fn(),
  getMyGroups: vi.fn(),
}));

// PicksTab and LeaderboardTab own their own fetches (seasons -> closest week ->
// picks / scoreboard). Mock those so the tabs render deterministically;
// getClosestWeek is left pending in the tab-switching test so the picks tab
// sits in its loading state.
vi.mock('../lib/nflSeasonUtils.js', () => ({ getCurrentNFLSeason: vi.fn(() => 2025) }));
vi.mock('../lib/picksService.js', () => ({
  getClosestWeek: vi.fn(),
  getPicks: vi.fn(),
  getPickSeasons: vi.fn(),
  getScoreboard: vi.fn(),
}));

// World Cup pools fetch a tournament-shaped leaderboard, and their Picks tab
// embeds WorldCupPicksTab (stage fetches + saved-picks hydrate + the groups
// fan-out dropdown). Mock the whole service surface so the WC-branch tests
// control every fetch without a network call; the real components render.
vi.mock('../lib/worldCupService.js', () => ({
  getWorldCupLeaderboard: vi.fn(),
  getStageMatches: vi.fn(),
  submitWorldCupPicks: vi.fn(),
  getMyWorldCupPicks: vi.fn(),
}));

// GroupDetailsPage reads the authenticated caller (useAuth) to thread the
// current user id into the World Cup picks tab's person selector. Stub it so the
// page never needs a real AuthProvider; id 1 is an arbitrary signed-in user.
vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 1, email: 'tester@example.com', name: 'Tester', provider: 'google' },
    isAuthenticated: true,
    isRestoring: false,
    setAuthUser: vi.fn(),
    clearAuth: vi.fn(),
  }),
}));

// Keep the real react-router exports (MemoryRouter, useSearchParams), stub only
// useNavigate so navigation targets are assertable.
const mockNavigate = vi.fn();
vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>();
  return { ...actual, useNavigate: () => mockNavigate };
});

import { getGroup, getMembers, getMessages, getMyGroups } from '../lib/groupsService.js';
import { getClosestWeek, getPickSeasons, getScoreboard } from '../lib/picksService.js';
import {
  getWorldCupLeaderboard,
  getStageMatches,
  getMyWorldCupPicks,
} from '../lib/worldCupService.js';
const mockGetGroup = vi.mocked(getGroup);
const mockGetMembers = vi.mocked(getMembers);
const mockGetMessages = vi.mocked(getMessages);
const mockGetMyGroups = vi.mocked(getMyGroups);
const mockGetClosestWeek = vi.mocked(getClosestWeek);
const mockGetPickSeasons = vi.mocked(getPickSeasons);
const mockGetScoreboard = vi.mocked(getScoreboard);
const mockGetWorldCupLeaderboard = vi.mocked(getWorldCupLeaderboard);
const mockGetStageMatches = vi.mocked(getStageMatches);
const mockGetMyWorldCupPicks = vi.mocked(getMyWorldCupPicks);

const ownerGroup: GroupDetail = {
  id: '1',
  name: 'Sunday Squad',
  identifier: 'sunday-squad',
  description: 'A friendly competition',
  memberCount: 4,
  userRole: 'admin',
};

const memberGroup: GroupDetail = {
  ...ownerGroup,
  userRole: 'member',
};

const worldCupGroup: GroupDetail = {
  ...memberGroup,
  name: 'World Cup Squad',
  poolType: 'world_cup_2026',
};

const members: GroupMember[] = [
  {
    id: 'm1',
    name: 'Alice',
    email: 'alice@example.com',
    isOwner: true,
    joinedAt: '2026-01-01T00:00:00.000Z',
    pictureUrl: null,
  },
];

const messages: GroupMessage[] = [
  {
    id: 'msg1',
    authorId: 'm1',
    authorName: 'Alice',
    authorPictureUrl: null,
    content: 'Welcome!',
    createdAt: '2026-01-02T00:00:00.000Z',
  },
];

function renderPage(query = '?group=sunday-squad') {
  return render(
    <MemoryRouter initialEntries={[`/group-details${query}`]}>
      <GroupDetailsPage />
    </MemoryRouter>
  );
}

describe('GroupDetailsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Hold the picks fetch open so the picks tab stays in its loading state for
    // the tab-switching assertions (this suite covers navigation, not picks data).
    mockGetClosestWeek.mockReturnValue(new Promise(() => {}));
    // The NFL leaderboard/picks tabs resolve the group's seasons on mount; an
    // empty list defaults them to the (mocked) current season.
    mockGetPickSeasons.mockResolvedValue({ seasons: [] });
    mockGetScoreboard.mockResolvedValue({ season: 2025, seasonType: 2, weeks: [], users: [] });
  });

  it('renders the group name as the heading once the parallel fetch resolves', async () => {
    mockGetGroup.mockResolvedValue(ownerGroup);
    mockGetMembers.mockResolvedValue(members);
    mockGetMessages.mockResolvedValue(messages);

    renderPage();

    expect(
      await screen.findByRole('heading', { name: ownerGroup.name })
    ).toBeInTheDocument();
    // All three mount fetches run with the query-string identifier.
    expect(mockGetGroup).toHaveBeenCalledWith('sunday-squad');
    expect(mockGetMembers).toHaveBeenCalledWith('sunday-squad');
    expect(mockGetMessages).toHaveBeenCalledWith('sunday-squad');
  });

  it('shows the Owner badge for an admin and switches between tab bodies', async () => {
    mockGetGroup.mockResolvedValue(ownerGroup);
    mockGetMembers.mockResolvedValue(members);
    mockGetMessages.mockResolvedValue(messages);

    renderPage();
    await screen.findByRole('heading', { name: ownerGroup.name });

    expect(screen.getByText('Owner')).toBeInTheDocument();
    // Default tab is leaderboard: the NFL LeaderboardTab fetches the scoreboard
    // (empty here) and renders its empty state.
    expect(await screen.findByText(/No points yet/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('tab', { name: /picks/i }));
    // PicksTab owns its fetch; with getClosestWeek pending it shows the loader.
    expect(screen.getByText('Loading picks…')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('tab', { name: /chat/i }));
    // ChatTab renders the seeded messages passed from the page mount.
    expect(screen.getByText('Welcome!')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('tab', { name: /settings/i }));
    // SettingsTab leads with the Members roster section.
    expect(screen.getByRole('heading', { name: 'Members' })).toBeInTheDocument();
  });

  it('renders the NFL leaderboard for the season that has pick data (old group)', async () => {
    mockGetGroup.mockResolvedValue(memberGroup);
    mockGetMembers.mockResolvedValue(members);
    mockGetMessages.mockResolvedValue(messages);
    // Old group: pick data only exists for 2024 while the (mocked) current
    // season is 2025. The leaderboard must request the season that actually
    // has data, not the empty current one — this is the regression that hid
    // old groups' scores after the season rolled over.
    mockGetPickSeasons.mockResolvedValue({ seasons: [2024] });
    mockGetScoreboard.mockResolvedValue({
      season: 2024,
      seasonType: 2,
      weeks: [1, 2],
      users: [
        { userId: 1, name: 'Alice', pictureUrl: null, weekly: [{ week: 1, points: 10 }, { week: 2, points: 5 }], totalPoints: 15 },
        { userId: 2, name: 'Bob', pictureUrl: null, weekly: [{ week: 1, points: 3 }, { week: 2, points: 4 }], totalPoints: 7 },
      ],
    });

    renderPage();
    await screen.findByRole('heading', { name: memberGroup.name });

    // Standings render with season totals (Alice leads).
    expect(await screen.findAllByText('15')).not.toHaveLength(0);
    expect(screen.getAllByText('Alice').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Bob').length).toBeGreaterThan(0);
    // Weekly breakdown columns for the weeks with data.
    expect(screen.getByRole('columnheader', { name: 'W1' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'W2' })).toBeInTheDocument();
    // The scoreboard was fetched for the old season with data, not the current one.
    expect(mockGetScoreboard).toHaveBeenCalledWith('sunday-squad', { season: 2024, seasonType: 2 });
  });

  it('hides the Owner badge for a non-admin member', async () => {
    mockGetGroup.mockResolvedValue(memberGroup);
    mockGetMembers.mockResolvedValue(members);
    mockGetMessages.mockResolvedValue(messages);

    renderPage();
    await screen.findByRole('heading', { name: memberGroup.name });

    expect(screen.queryByText('Owner')).not.toBeInTheDocument();
  });

  it('consolidates a rejected fetch into exactly one Group Not Found UI, not three', async () => {
    // Only getGroup rejects; members/messages resolve. Promise.all collapses the
    // single rejection into ONE error UI rather than one-per-failed-branch.
    mockGetGroup.mockRejectedValue(new Error('Group not found'));
    mockGetMembers.mockResolvedValue(members);
    mockGetMessages.mockResolvedValue(messages);

    renderPage();

    // Wait for the error state, then assert there is exactly one heading and one
    // rejection-message node — guarding against the three-error regression.
    const headings = await screen.findAllByRole('heading', { name: /Group Not Found/i });
    expect(headings).toHaveLength(1);
    expect(screen.getAllByText('Group not found')).toHaveLength(1);

    fireEvent.click(screen.getByRole('button', { name: /back to groups/i }));
    expect(mockNavigate).toHaveBeenCalledWith('/groups');
  });

  it('shows exactly one Group Not Found UI without fetching when the query param is absent', () => {
    renderPage('');

    // Param-less route short-circuits before the mount effect: a single error UI
    // and zero fetches.
    expect(screen.getAllByRole('heading', { name: /Group Not Found/i })).toHaveLength(1);
    expect(mockGetGroup).not.toHaveBeenCalled();
    expect(mockGetMembers).not.toHaveBeenCalled();
    expect(mockGetMessages).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: /back to groups/i }));
    expect(mockNavigate).toHaveBeenCalledWith('/groups');
  });

  it('shows a loading indicator before the fetch resolves', async () => {
    mockGetGroup.mockReturnValue(new Promise<GroupDetail>(() => {}));
    mockGetMembers.mockReturnValue(new Promise<GroupMember[]>(() => {}));
    mockGetMessages.mockReturnValue(new Promise<GroupMessage[]>(() => {}));

    renderPage();

    expect(await screen.findByText(/Loading group/i)).toBeInTheDocument();
  });

  describe('World Cup pool', () => {
    // One group-stage match for the embedded WorldCupPicksTab; every other
    // stage resolves empty so the match renders exactly once.
    const wcMatch: WorldCupMatch = {
      id: 10,
      stage: 'group',
      homeTeam: { id: '1', name: 'Mexico', abbreviation: 'MEX', logo: '' },
      awayTeam: { id: '2', name: 'United States', abbreviation: 'USA', logo: '' },
      homeScore: 0,
      awayScore: 0,
      status: 'SCHEDULED',
      isKnockout: false,
      // Tomorrow, so the match stays pre-kickoff and pickable whenever CI runs.
      gameDate: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    };
    const stageResponder = (stage: WorldCupStage) => {
      const games = stage === 'group' ? [wcMatch] : [];
      return Promise.resolve({ games, count: games.length, cached: false });
    };

    beforeEach(() => {
      mockGetGroup.mockResolvedValue(worldCupGroup);
      mockGetMembers.mockResolvedValue(members);
      mockGetMessages.mockResolvedValue(messages);
    });

    it('renders the TournamentLeaderboard on the Leaderboard tab for a world_cup_2026 pool', async () => {
      mockGetWorldCupLeaderboard.mockResolvedValue({
        leaderboard: [
          {
            userId: 1,
            name: 'Alice',
            pictureUrl: null,
            rank: 1,
            tied: false,
            points: 12,
            wins_correct: 4,
            losses: 1,
            draws_correct: 2,
            draws_incorrect: 1,
          },
        ],
      });

      renderPage();
      await screen.findByRole('heading', { name: worldCupGroup.name });

      // Leaderboard is the default tab; the WC branch fetches and renders the
      // tournament table instead of the NFL "coming soon" placeholder.
      expect(mockGetWorldCupLeaderboard).toHaveBeenCalledWith('sunday-squad');
      expect(screen.queryByText(/Leaderboard coming soon/i)).not.toBeInTheDocument();
      // The tournament table surfaces the tiebreaker columns and the member row.
      // (The member name renders in both the desktop table and the mobile list,
      // so scope the name lookup to the table.)
      expect(await screen.findByText('Wins Correct')).toBeInTheDocument();
      expect(screen.getByText('Draws Incorrect')).toBeInTheDocument();
      expect(within(screen.getByRole('table')).getByText('Alice')).toBeInTheDocument();
    });

    it('embeds the World Cup pick-making surface on the Picks tab', async () => {
      mockGetWorldCupLeaderboard.mockResolvedValue({ leaderboard: [] });
      mockGetStageMatches.mockImplementation(stageResponder);
      mockGetMyWorldCupPicks.mockResolvedValue({ picks: [] });
      mockGetMyGroups.mockResolvedValue([
        { id: 1, identifier: 'sunday-squad', name: 'World Cup Squad', poolType: 'world_cup_2026' },
      ] as any);

      renderPage();
      await screen.findByRole('heading', { name: worldCupGroup.name });

      fireEvent.click(screen.getByRole('tab', { name: /picks/i }));

      // The match list and its outcome buttons render inline — no link-out to
      // a separate page, and no NFL picks loader.
      expect(await screen.findByTestId('match-row-10')).toBeInTheDocument();
      expect(screen.getByRole('heading', { name: 'Group Stage' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Pick Mexico to win' })).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /make world cup picks/i })).not.toBeInTheDocument();
      expect(screen.queryByText('Loading picks…')).not.toBeInTheDocument();
      expect(mockNavigate).not.toHaveBeenCalled();

      // The picks are submitted against the SAME group the page resolved.
      expect(mockGetMyWorldCupPicks).toHaveBeenCalledWith('sunday-squad');
    });

    it('shows the save bar on the Picks tab and removes it when switching away', async () => {
      mockGetWorldCupLeaderboard.mockResolvedValue({ leaderboard: [] });
      mockGetStageMatches.mockImplementation(stageResponder);
      mockGetMyWorldCupPicks.mockResolvedValue({ picks: [] });
      mockGetMyGroups.mockResolvedValue([
        { id: 1, identifier: 'sunday-squad', name: 'World Cup Squad', poolType: 'world_cup_2026' },
      ] as any);

      renderPage();
      await screen.findByRole('heading', { name: worldCupGroup.name });

      // Leaderboard (default tab): no save bar anywhere.
      expect(screen.queryByRole('button', { name: 'Submit Picks' })).not.toBeInTheDocument();

      // Entering the Picks tab mounts the surface and its sticky save bar.
      fireEvent.click(screen.getByRole('tab', { name: /picks/i }));
      await screen.findByTestId('match-row-10');
      expect(screen.getByRole('button', { name: 'Submit Picks' })).toBeInTheDocument();
      expect(screen.getByText('0 picks selected')).toBeInTheDocument();

      // Leaving the tab unmounts the surface — the save bar disappears.
      fireEvent.click(screen.getByRole('tab', { name: /chat/i }));
      expect(screen.queryByRole('button', { name: 'Submit Picks' })).not.toBeInTheDocument();
      expect(screen.queryByText('0 picks selected')).not.toBeInTheDocument();
    });
  });
});
