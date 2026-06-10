import { render, screen, waitFor, within } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import WorldCupLeaderboardTab from './WorldCupLeaderboardTab';
import type { TournamentLeaderboardRow } from '../../lib/types';

// Mock the world cup service so the leaderboard fetch is controllable per test.
vi.mock('../../lib/worldCupService.js', () => ({
  getWorldCupLeaderboard: vi.fn(),
}));

import { getWorldCupLeaderboard } from '../../lib/worldCupService.js';
const mockGetWorldCupLeaderboard = vi.mocked(getWorldCupLeaderboard);

const identifier = 'wc-group';

const rows: TournamentLeaderboardRow[] = [
  {
    memberId: 'm1',
    name: 'Alice',
    points: 12,
    wins_correct: 4,
    losses: 1,
    draws_correct: 2,
    draws_incorrect: 1,
  },
  {
    memberId: 'm2',
    name: 'Bob',
    points: 7,
    wins_correct: 2,
    losses: 2,
    draws_correct: 1,
    draws_incorrect: 2,
  },
];

describe('WorldCupLeaderboardTab', () => {
  beforeEach(() => vi.clearAllMocks());

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
});
