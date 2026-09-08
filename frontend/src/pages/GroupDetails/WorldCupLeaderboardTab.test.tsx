import { render, screen, waitFor, within } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import WorldCupLeaderboardTab from './WorldCupLeaderboardTab';
import type { TournamentLeaderboardRow } from '../../lib/types';

// Mock the world cup service so the leaderboard fetch is controllable per test.
vi.mock('../../lib/worldCupService.js', () => ({
  getWorldCupLeaderboard: vi.fn(),
}));

import { getWorldCupLeaderboard } from '../../lib/worldCupService.js';
// Real (unmocked) cache module — the tab seeds initial state from it, so it must
// be cleared between cases or a prior render's rows leak into the next.
import { clearWorldCupCache } from '../../lib/worldCupCache';
const mockGetWorldCupLeaderboard = vi.mocked(getWorldCupLeaderboard);

const identifier = 'wc-group';

const rows: TournamentLeaderboardRow[] = [
  {
    userId: 1,
    name: 'Alice',
    pictureUrl: null,
    rank: 1,
    tied: false,
    points: 12,
    bonus_points: 3,
    wins_correct: 4,
    losses: 1,
    draws_correct: 2,
    draws_incorrect: 1,
  },
  {
    userId: 2,
    name: 'Bob',
    pictureUrl: null,
    rank: 2,
    tied: false,
    points: 7,
    bonus_points: 0,
    wins_correct: 2,
    losses: 2,
    draws_correct: 1,
    draws_incorrect: 2,
  },
];

describe('WorldCupLeaderboardTab', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearWorldCupCache();
  });

  it('fetches and renders the tournament leaderboard table', async () => {
    mockGetWorldCupLeaderboard.mockResolvedValue({ leaderboard: rows });

    render(<WorldCupLeaderboardTab identifier={identifier} />);

    expect(mockGetWorldCupLeaderboard).toHaveBeenCalledWith(identifier);
    // Names render in both the desktop table and the mobile list, so scope the
    // lookup to the table to keep the assertion unambiguous.
    const table = await screen.findByRole('table');
    expect(within(table).getByText('Alice')).toBeInTheDocument();
    expect(within(table).getByText('Bob')).toBeInTheDocument();
  });

  it('renders bare — no card wrapper and no duplicate "Leaderboard" heading', async () => {
    mockGetWorldCupLeaderboard.mockResolvedValue({ leaderboard: rows });

    const { container } = render(<WorldCupLeaderboardTab identifier={identifier} />);
    await screen.findByRole('table');

    // The tab label already says "Leaderboard"; the body must not repeat it.
    expect(screen.queryByRole('heading', { name: 'Leaderboard' })).not.toBeInTheDocument();

    // The tab root is an unstyled div, not a bordered/padded card, so the table
    // spans the page container's full width.
    const root = container.firstElementChild as HTMLElement;
    expect(root.className).toBe('');
  });

  it('shows the loading state while the fetch is pending', () => {
    mockGetWorldCupLeaderboard.mockReturnValue(new Promise(() => {}));

    render(<WorldCupLeaderboardTab identifier={identifier} />);

    expect(screen.getByText('Loading leaderboard…')).toBeInTheDocument();
  });

  it('surfaces a fetch error in place of the table', async () => {
    mockGetWorldCupLeaderboard.mockRejectedValue(new Error('Leaderboard unavailable'));

    render(<WorldCupLeaderboardTab identifier={identifier} />);

    expect(await screen.findByText('Leaderboard unavailable')).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.queryByRole('table')).not.toBeInTheDocument();
    });
  });

  // Stale-while-revalidate: a second mount (e.g. switching back to the tab) must
  // paint the cached standings synchronously — no "Loading…" blank — while a
  // background refresh runs.
  it('paints cached standings instantly on a re-mount without a loading flash', async () => {
    mockGetWorldCupLeaderboard.mockResolvedValue({ leaderboard: rows });

    // First mount warms the cache.
    const first = render(<WorldCupLeaderboardTab identifier={identifier} />);
    await screen.findByRole('table');
    first.unmount();

    // Second mount: rows are present immediately and the spinner never shows.
    render(<WorldCupLeaderboardTab identifier={identifier} />);
    expect(screen.queryByText('Loading leaderboard…')).not.toBeInTheDocument();
    const table = screen.getByRole('table');
    expect(within(table).getByText('Alice')).toBeInTheDocument();
  });

  it('keeps showing cached standings when a background revalidate fails', async () => {
    mockGetWorldCupLeaderboard.mockResolvedValueOnce({ leaderboard: rows });

    const first = render(<WorldCupLeaderboardTab identifier={identifier} />);
    await screen.findByRole('table');
    first.unmount();

    // The revalidate on re-mount rejects, but the cached table must stay put and
    // no error message replaces it.
    mockGetWorldCupLeaderboard.mockRejectedValueOnce(new Error('flaky network'));
    render(<WorldCupLeaderboardTab identifier={identifier} />);

    await waitFor(() => {
      expect(mockGetWorldCupLeaderboard).toHaveBeenCalledTimes(2);
    });
    expect(screen.queryByText('flaky network')).not.toBeInTheDocument();
    const table = screen.getByRole('table');
    expect(within(table).getByText('Alice')).toBeInTheDocument();
  });

  // knockoutOnly forwarding: the tab accepts the prop and passes it through to
  // TournamentLeaderboard. When true, draw column headers are absent.
  it('forwards knockoutOnly=true: draw columns are hidden in the rendered table', async () => {
    mockGetWorldCupLeaderboard.mockResolvedValue({ leaderboard: rows });

    render(<WorldCupLeaderboardTab identifier={identifier} knockoutOnly />);

    const table = await screen.findByRole('table');
    expect(within(table).queryByText('Draws Correct')).not.toBeInTheDocument();
    expect(within(table).queryByText('Draws Incorrect')).not.toBeInTheDocument();
    // Bonus column must still appear.
    expect(within(table).getByText('Bonus')).toBeInTheDocument();
  });

  it('forwards knockoutOnly=false (default): draw columns are present in the rendered table', async () => {
    mockGetWorldCupLeaderboard.mockResolvedValue({ leaderboard: rows });

    render(<WorldCupLeaderboardTab identifier={identifier} />);

    const table = await screen.findByRole('table');
    expect(within(table).getByText('Draws Correct')).toBeInTheDocument();
    expect(within(table).getByText('Draws Incorrect')).toBeInTheDocument();
  });
});
