import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import GamesPage from './GamesPage';

// Deterministic season so the mount fetch URL is predictable.
vi.mock('../lib/nflSeasonUtils.js', () => ({ getCurrentNFLSeason: vi.fn(() => 2025) }));
vi.mock('../lib/authService.js', () => ({
  default: { getApiBaseUrl: () => 'http://test' },
}));
vi.mock('../lib/picksService.js', () => ({ savePicks: vi.fn() }));
vi.mock('../lib/groupsService.js', () => ({ getMyGroups: vi.fn() }));

import { savePicks } from '../lib/picksService.js';
import { getMyGroups } from '../lib/groupsService.js';
const mockSavePicks = vi.mocked(savePicks);
const mockGetMyGroups = vi.mocked(getMyGroups);

const buf = { id: '1', name: 'Bills', abbreviation: 'BUF', logo: '' };
const ne = { id: '2', name: 'Patriots', abbreviation: 'NE', logo: '' };
const kc = { id: '3', name: 'Chiefs', abbreviation: 'KC', logo: '' };
const den = { id: '4', name: 'Broncos', abbreviation: 'DEN', logo: '' };

function gamesPayload() {
  return {
    games: [
      {
        id: 10, awayTeam: buf, homeTeam: ne, awayScore: 0, homeScore: 0,
        status: 'SCHEDULED', gameDate: '2025-09-21T17:00:00.000Z',
      },
      {
        id: 11, awayTeam: kc, homeTeam: den, awayScore: 0, homeScore: 0,
        status: 'SCHEDULED', gameDate: '2025-09-21T20:00:00.000Z',
      },
    ],
  };
}

function mockFetchOk(payload: unknown) {
  return vi.fn().mockResolvedValue({ ok: true, json: async () => payload });
}

function renderPage(route = '/games?groupId=sunday-squad') {
  return render(
    <MemoryRouter initialEntries={[route]}>
      <GamesPage />
    </MemoryRouter>,
  );
}

describe('GamesPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('fetch', mockFetchOk(gamesPayload()));
  });
  afterEach(() => vi.unstubAllGlobals());

  it('fetches the current-season week 1 regular-season games on mount', async () => {
    renderPage();
    await screen.findByText('Bills');
    expect(fetch).toHaveBeenCalledWith('http://test/api/games/2025/2/1?force=false');
  });

  it('renders one row per game', async () => {
    renderPage();
    expect(await screen.findByText('Bills')).toBeInTheDocument();
    expect(screen.getByText('Chiefs')).toBeInTheDocument();
    expect(screen.getByTestId('game-row-10')).toBeInTheDocument();
    expect(screen.getByTestId('game-row-11')).toBeInTheDocument();
  });

  it('refresh button refetches with force=true', async () => {
    renderPage();
    await screen.findByText('Bills');
    fireEvent.click(screen.getByRole('button', { name: 'Refresh games' }));
    await waitFor(() =>
      expect(fetch).toHaveBeenCalledWith('http://test/api/games/2025/2/1?force=true'),
    );
  });

  it('refetches when the week changes', async () => {
    renderPage();
    await screen.findByText('Bills');
    fireEvent.change(screen.getByLabelText('Week'), { target: { value: '3' } });
    await waitFor(() =>
      expect(fetch).toHaveBeenCalledWith('http://test/api/games/2025/2/3?force=false'),
    );
  });

  it('clamps the week back to 1 when switching to a shorter season type', async () => {
    renderPage();
    await screen.findByText('Bills');
    // Move to a high regular-season week, then switch to Preseason (only 4 weeks).
    fireEvent.change(screen.getByLabelText('Week'), { target: { value: '12' } });
    await waitFor(() =>
      expect(fetch).toHaveBeenCalledWith('http://test/api/games/2025/2/12?force=false'),
    );
    fireEvent.change(screen.getByLabelText('Season type'), { target: { value: '1' } });
    await waitFor(() =>
      expect(fetch).toHaveBeenCalledWith('http://test/api/games/2025/1/1?force=false'),
    );
  });

  it('shows an error state with a retry when the fetch fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 500 }));
    renderPage();
    expect(await screen.findByText(/Failed to fetch games/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Try Again' })).toBeInTheDocument();
  });

  it('prevents assigning a confidence value already used by another game', async () => {
    renderPage();
    await screen.findByText('Bills');

    // Game 10: pick BUF + confidence 1.
    const row10 = screen.getByTestId('game-row-10');
    fireEvent.click(within(row10).getByRole('radio', { name: 'Pick Bills to win' }));
    fireEvent.click(within(row10).getByRole('button', { name: /Confidence for BUF at NE/ }));
    fireEvent.click(within(row10).getByRole('option', { name: '1' }));

    // Game 11: opening its picker must not offer value 1 (still incomplete).
    const row11 = screen.getByTestId('game-row-11');
    fireEvent.click(within(row11).getByRole('button', { name: /Confidence for KC at DEN/ }));
    const options = within(row11).getAllByRole('option').map((o) => o.textContent);
    expect(options).not.toContain('1');
    expect(options).toContain('2');
  });

  it('disables submit without a groupId and shows a hint', async () => {
    renderPage('/games');
    await screen.findByText('Bills');
    expect(screen.getByText(/No group selected/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Submit Picks' })).toBeDisabled();
  });

  it('submits complete picks via savePicks and surfaces a success toast', async () => {
    mockSavePicks.mockResolvedValue({ games: [] });
    renderPage();
    await screen.findByText('Bills');

    const row10 = screen.getByTestId('game-row-10');
    fireEvent.click(within(row10).getByRole('radio', { name: 'Pick Bills to win' }));
    fireEvent.click(within(row10).getByRole('button', { name: /Confidence for BUF at NE/ }));
    fireEvent.click(within(row10).getByRole('option', { name: '2' }));

    const submit = screen.getByRole('button', { name: 'Submit Picks' });
    await waitFor(() => expect(submit).toBeEnabled());
    fireEvent.click(submit);

    await waitFor(() =>
      expect(mockSavePicks).toHaveBeenCalledWith('sunday-squad', {
        season: 2025,
        seasonType: 2,
        week: 1,
        picks: [{ gameId: 10, pickedTeamId: 1, confidence: 2 }],
        clearedGameIds: [],
      }),
    );
    expect(await screen.findByText('Picks saved')).toBeInTheDocument();
  });

  it('surfaces an error toast when the save fails', async () => {
    mockSavePicks.mockRejectedValue(new Error('Server said no'));
    renderPage();
    await screen.findByText('Bills');

    const row10 = screen.getByTestId('game-row-10');
    fireEvent.click(within(row10).getByRole('radio', { name: 'Pick Bills to win' }));
    fireEvent.click(within(row10).getByRole('button', { name: /Confidence for BUF at NE/ }));
    fireEvent.click(within(row10).getByRole('option', { name: '1' }));

    fireEvent.click(screen.getByRole('button', { name: 'Submit Picks' }));
    expect(await screen.findByText('Server said no')).toBeInTheDocument();
  });

  it('fans the same picks out to every NFL group when "Save to all" is checked', async () => {
    // Three groups: two NFL (one explicit poolType, one legacy null) + one WC.
    // Fan-out must call savePicks for both NFL identifiers and skip the WC one.
    mockGetMyGroups.mockResolvedValue([
      { id: 1, identifier: 'sunday-squad', poolType: 'nfl_weekly' },
      { id: 2, identifier: 'office-pool', poolType: null }, // legacy pre-#86
      { id: 3, identifier: 'wc-crew', poolType: 'world_cup_2026' },
    ] as any);
    mockSavePicks.mockResolvedValue({ games: [] });

    renderPage();
    await screen.findByText('Bills');

    const row10 = screen.getByTestId('game-row-10');
    fireEvent.click(within(row10).getByRole('radio', { name: 'Pick Bills to win' }));
    fireEvent.click(within(row10).getByRole('button', { name: /Confidence for BUF at NE/ }));
    fireEvent.click(within(row10).getByRole('option', { name: '1' }));

    fireEvent.click(screen.getByRole('checkbox', { name: 'Save to all my NFL groups' }));
    fireEvent.click(screen.getByRole('button', { name: 'Submit to All' }));

    await waitFor(() => expect(mockSavePicks).toHaveBeenCalledTimes(2));
    const calledIdentifiers = mockSavePicks.mock.calls.map((c) => c[0]).sort();
    expect(calledIdentifiers).toEqual(['office-pool', 'sunday-squad']);
    expect(await screen.findByText('Picks saved to 2 groups')).toBeInTheDocument();
  });
});
