import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import WorldCupPicksPage from './WorldCupPicksPage';
import type { WorldCupMatch, WorldCupStage } from '../lib/types';

vi.mock('../lib/worldCupService.js', () => ({
  getStageMatches: vi.fn(),
  submitWorldCupPicks: vi.fn(),
}));
vi.mock('../lib/groupsService.js', () => ({
  getMyGroups: vi.fn(),
}));

import { getStageMatches, submitWorldCupPicks } from '../lib/worldCupService.js';
import { getMyGroups } from '../lib/groupsService.js';
const mockGetStageMatches = vi.mocked(getStageMatches);
const mockSubmitPicks = vi.mocked(submitWorldCupPicks);
const mockGetMyGroups = vi.mocked(getMyGroups);

const mex = { id: '1', name: 'Mexico', abbreviation: 'MEX', logo: '' };
const usa = { id: '2', name: 'United States', abbreviation: 'USA', logo: '' };
const can = { id: '3', name: 'Canada', abbreviation: 'CAN', logo: '' };
const arg = { id: '4', name: 'Argentina', abbreviation: 'ARG', logo: '' };

function match(overrides: Partial<WorldCupMatch>): WorldCupMatch {
  return {
    id: 0,
    stage: 'group',
    homeTeam: mex,
    awayTeam: usa,
    homeScore: 0,
    awayScore: 0,
    status: 'SCHEDULED',
    isKnockout: false,
    gameDate: '2026-06-11T20:00:00.000Z',
    ...overrides,
  };
}

const groupMatch = match({ id: 10, stage: 'group', homeTeam: mex, awayTeam: usa });
const r16Match = match({ id: 20, stage: 'r16', isKnockout: true, homeTeam: can, awayTeam: arg });

// Route every stage fetch to its matching subset so the page flattens a known
// two-match tournament (one group, one knockout).
function stageResponder(matches: WorldCupMatch[]) {
  return (stage: WorldCupStage) => {
    const games = matches.filter((m) => m.stage === stage);
    return Promise.resolve({ games, count: games.length, cached: false });
  };
}

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
    mockGetStageMatches.mockImplementation(stageResponder([groupMatch, r16Match]));
    // Default: source group is the user's only WC group. Tests exercising the
    // dropdown re-mock with multiple groups.
    mockGetMyGroups.mockResolvedValue([
      { id: 1, identifier: 'la-crew', name: 'LA Crew', poolType: 'world_cup_2026' },
    ] as any);
  });

  it('shows the not-found UI when no group query param is present', () => {
    renderPage('/world-cup');
    expect(screen.getByText('Group Not Found')).toBeInTheDocument();
    expect(screen.queryByText('World Cup 2026 Picks')).not.toBeInTheDocument();
  });

  it('shows the loading indicator while a stage fetch is in flight', async () => {
    // A never-resolving promise pins the page in its loading state.
    mockGetStageMatches.mockReturnValue(new Promise<never>(() => {}));
    renderPage();
    expect(await screen.findByText('Loading matches…')).toBeInTheDocument();
    expect(screen.queryByText('No matches found for this tournament.')).not.toBeInTheDocument();
  });

  it('fetches every tournament stage and groups matches by stage', async () => {
    renderPage();
    await screen.findByTestId('match-row-10');
    expect(mockGetStageMatches).toHaveBeenCalledTimes(7);
    // Section headings (h2) — distinct from the per-row stage badges.
    expect(screen.getByRole('heading', { name: 'Group Stage' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Round of 16' })).toBeInTheDocument();
    expect(screen.getByTestId('match-row-20')).toBeInTheDocument();

    // The populated state renders the MatchPickRow's three outcome buttons.
    const groupRow = screen.getByTestId('match-row-10');
    expect(within(groupRow).getByRole('button', { name: 'Pick Mexico to win' })).toBeInTheDocument();
    expect(within(groupRow).getByRole('button', { name: 'Pick a draw' })).toBeInTheDocument();
    expect(
      within(groupRow).getByRole('button', { name: 'Pick United States to win' }),
    ).toBeInTheDocument();
  });

  it('shows an error state with a retry when a stage fetch fails', async () => {
    mockGetStageMatches.mockRejectedValue(new Error('boom'));
    renderPage();
    expect(await screen.findByText(/Failed to fetch matches/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Try Again' })).toBeInTheDocument();
  });

  it('shows the empty state when no stage returns matches', async () => {
    mockGetStageMatches.mockResolvedValue({ games: [], count: 0, cached: false });
    renderPage();
    expect(await screen.findByText('No matches found for this tournament.')).toBeInTheDocument();
  });

  it('keeps submit disabled until a pick is made', async () => {
    renderPage();
    await screen.findByTestId('match-row-10');
    const submit = screen.getByRole('button', { name: 'Submit Picks' });
    expect(submit).toBeDisabled();

    const row = screen.getByTestId('match-row-10');
    fireEvent.click(within(row).getByRole('button', { name: 'Pick Mexico to win' }));
    expect(submit).toBeEnabled();
  });

  it('submits selected picks and surfaces a success toast', async () => {
    mockSubmitPicks.mockResolvedValue({});
    renderPage();
    await screen.findByTestId('match-row-10');

    fireEvent.click(
      within(screen.getByTestId('match-row-10')).getByRole('button', { name: 'Pick Mexico to win' }),
    );
    fireEvent.click(
      within(screen.getByTestId('match-row-20')).getByRole('button', { name: 'Pick Canada to win' }),
    );

    fireEvent.click(screen.getByRole('button', { name: 'Submit Picks' }));

    await waitFor(() =>
      expect(mockSubmitPicks).toHaveBeenCalledWith('la-crew', [
        { gameId: 10, pickedResult: 'home' },
        { gameId: 20, pickedResult: 'home' },
      ]),
    );
    expect(await screen.findByText('Picks saved')).toBeInTheDocument();
  });

  it('surfaces an error toast when the submit fails', async () => {
    mockSubmitPicks.mockRejectedValue(new Error('Server said no'));
    renderPage();
    await screen.findByTestId('match-row-10');

    fireEvent.click(
      within(screen.getByTestId('match-row-10')).getByRole('button', { name: 'Pick Mexico to win' }),
    );
    fireEvent.click(screen.getByRole('button', { name: 'Submit Picks' }));
    expect(await screen.findByText('Server said no')).toBeInTheDocument();
  });

  it('fans the same picks out to every selected World Cup group via the dropdown', async () => {
    // Three groups: two WC (source + another) + one NFL. The dropdown only
    // surfaces the two WC groups; ticking the non-source one fans-out to both.
    mockGetMyGroups.mockResolvedValue([
      { id: 1, identifier: 'la-crew', name: 'LA Crew', poolType: 'world_cup_2026' },
      { id: 2, identifier: 'work-pool', name: 'Work Pool', poolType: 'world_cup_2026' },
      { id: 3, identifier: 'family-nfl', name: 'Family NFL', poolType: 'nfl_weekly' },
    ] as any);
    mockSubmitPicks.mockResolvedValue({});

    renderPage();
    await screen.findByTestId('match-row-10');

    fireEvent.click(
      within(screen.getByTestId('match-row-10')).getByRole('button', { name: 'Pick Mexico to win' }),
    );

    // Open dropdown, tick the second WC group. The source 'la-crew' is
    // disabled-and-checked by SaveTargetsDropdown so we don't touch it.
    fireEvent.click(screen.getByRole('button', { name: 'Choose groups to save picks to' }));
    fireEvent.click(await screen.findByRole('checkbox', { name: 'Work Pool' }));

    fireEvent.click(screen.getByRole('button', { name: 'Submit to 2' }));

    await waitFor(() => expect(mockSubmitPicks).toHaveBeenCalledTimes(2));
    const calledIdentifiers = mockSubmitPicks.mock.calls.map((c) => c[0]).sort();
    expect(calledIdentifiers).toEqual(['la-crew', 'work-pool']);
    expect(await screen.findByText('Picks saved to 2 groups')).toBeInTheDocument();
  });

  it('reports partial failure when some fan-out submits reject', async () => {
    mockGetMyGroups.mockResolvedValue([
      { id: 1, identifier: 'la-crew', name: 'LA Crew', poolType: 'world_cup_2026' },
      { id: 2, identifier: 'work-pool', name: 'Work Pool', poolType: 'world_cup_2026' },
    ] as any);
    mockSubmitPicks.mockImplementation(async (groupId: string) => {
      if (groupId === 'work-pool') throw new Error('boom');
      return {};
    });

    renderPage();
    await screen.findByTestId('match-row-10');

    fireEvent.click(
      within(screen.getByTestId('match-row-10')).getByRole('button', { name: 'Pick Mexico to win' }),
    );
    fireEvent.click(screen.getByRole('button', { name: 'Choose groups to save picks to' }));
    fireEvent.click(await screen.findByRole('checkbox', { name: 'Work Pool' }));
    fireEvent.click(screen.getByRole('button', { name: 'Submit to 2' }));

    expect(await screen.findByText('Saved to 1/2 groups (1 failed)')).toBeInTheDocument();
  });

  it('toggles a pick off when the selected result is clicked again', async () => {
    renderPage();
    await screen.findByTestId('match-row-10');
    const row = screen.getByTestId('match-row-10');
    const homeBtn = within(row).getByRole('button', { name: 'Pick Mexico to win' });

    fireEvent.click(homeBtn);
    expect(screen.getByText('1 pick selected')).toBeInTheDocument();
    fireEvent.click(homeBtn);
    expect(screen.getByText('0 picks selected')).toBeInTheDocument();
  });
});
