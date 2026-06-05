import { render, screen, within } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import TournamentLeaderboard from './TournamentLeaderboard';
import type { TournamentLeaderboardRow } from '../../../lib/types';

// --- Row fixtures ------------------------------------------------------------
// Every numeric value across every row is globally distinct, so a value can be
// located unambiguously with a single getByText — no value collides with another
// column, another row, or the 1-based rank the component renders per row. Names
// are intentionally NOT alphabetical: the supplied order is the rendered order,
// and these fixtures prove the component never re-sorts.

function makeRow(overrides: Partial<TournamentLeaderboardRow> & Pick<TournamentLeaderboardRow, 'memberId' | 'name'>): TournamentLeaderboardRow {
  return {
    points: 0,
    wins_correct: 0,
    losses: 0,
    draws_correct: 0,
    draws_incorrect: 0,
    ...overrides,
  };
}

const ZARA = makeRow({
  memberId: 'm-zara',
  name: 'Zara',
  points: 40,
  wins_correct: 11,
  losses: 22,
  draws_correct: 33,
  draws_incorrect: 44,
});

const MILO = makeRow({
  memberId: 'm-milo',
  name: 'Milo',
  points: 50,
  wins_correct: 13,
  losses: 24,
  draws_correct: 35,
  draws_incorrect: 46,
});

const ADA = makeRow({
  memberId: 'm-ada',
  name: 'Ada',
  points: 60,
  wins_correct: 15,
  losses: 26,
  draws_correct: 37,
  draws_incorrect: 48,
});

// Supplied order: Zara, Milo, Ada (not sorted by name or points).
const ROWS: TournamentLeaderboardRow[] = [ZARA, MILO, ADA];

// The member's <tr>, located via its unique name (rendered in a th scope="row").
function rowFor(name: string): HTMLElement {
  const tr = screen.getByText(name).closest('tr');
  expect(tr).not.toBeNull();
  return tr as HTMLElement;
}

describe('TournamentLeaderboard', () => {
  describe('rows', () => {
    it('renders exactly one row per entry', () => {
      render(<TournamentLeaderboard rows={ROWS} />);
      // Each member contributes one row-header (th scope="row").
      expect(screen.getAllByRole('rowheader')).toHaveLength(ROWS.length);
      // Total table rows = one header row + one body row per member.
      expect(screen.getAllByRole('row')).toHaveLength(ROWS.length + 1);
    });

    it('renders members in the supplied order, not re-sorted', () => {
      render(<TournamentLeaderboard rows={ROWS} />);
      const headers = screen.getAllByRole('rowheader');
      // The i-th rendered row-header carries the i-th supplied member.
      ROWS.forEach((row, i) => {
        expect(within(headers[i]).getByText(row.name)).toBeInTheDocument();
      });
    });
  });

  describe('points and tiebreaker columns', () => {
    it('renders points plus all four tiebreaker values for each row', () => {
      render(<TournamentLeaderboard rows={ROWS} />);
      // Scope every assertion to the member's own row so a value can never
      // satisfy the lookup by matching a different member's cell.
      ROWS.forEach(row => {
        const tr = rowFor(row.name);
        expect(within(tr).getByText(String(row.points))).toBeInTheDocument();
        expect(within(tr).getByText(String(row.wins_correct))).toBeInTheDocument();
        expect(within(tr).getByText(String(row.losses))).toBeInTheDocument();
        expect(within(tr).getByText(String(row.draws_correct))).toBeInTheDocument();
        expect(within(tr).getByText(String(row.draws_incorrect))).toBeInTheDocument();
      });
    });

    it("keeps each member's values in that member's own row", () => {
      render(<TournamentLeaderboard rows={ROWS} />);
      // Milo's row holds Milo's numbers and none of Ada's — guards against a
      // column-misalignment regression that would cross values between rows.
      const miloRow = rowFor('Milo');
      expect(within(miloRow).getByText(String(MILO.points))).toBeInTheDocument();
      expect(within(miloRow).getByText(String(MILO.wins_correct))).toBeInTheDocument();
      expect(within(miloRow).queryByText(String(ADA.points))).not.toBeInTheDocument();
      expect(within(miloRow).queryByText(String(ADA.wins_correct))).not.toBeInTheDocument();
    });
  });

  describe('empty state', () => {
    it('renders the placeholder message and no data table when rows is empty', () => {
      render(<TournamentLeaderboard rows={[]} />);
      expect(screen.getByText(/no standings yet/i)).toBeInTheDocument();
      // The table and all its rows are absent in the empty state.
      expect(screen.queryByRole('table')).not.toBeInTheDocument();
      expect(screen.queryAllByRole('row')).toHaveLength(0);
      expect(screen.queryAllByRole('rowheader')).toHaveLength(0);
    });
  });
});
