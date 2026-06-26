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
//
// The component now renders TWO layouts simultaneously (a mobile stacked list
// and a desktop table — CSS, not JS, decides which is visible), so every query
// is scoped to one layout root via `within(table())` / `within(mobileList())`.
// An unscoped getByText would match the same value in both layouts and throw.

function makeRow(overrides: Partial<TournamentLeaderboardRow> & Pick<TournamentLeaderboardRow, 'userId' | 'name'>): TournamentLeaderboardRow {
  return {
    pictureUrl: null,
    rank: 1,
    tied: false,
    points: 0,
    bonus_points: 0,
    wins_correct: 0,
    losses: 0,
    draws_correct: 0,
    draws_incorrect: 0,
    ...overrides,
  };
}

const ZARA = makeRow({
  userId: 101,
  name: 'Zara',
  points: 40,
  bonus_points: 5,
  wins_correct: 11,
  losses: 22,
  draws_correct: 33,
  draws_incorrect: 44,
});

const MILO = makeRow({
  userId: 102,
  name: 'Milo',
  points: 50,
  bonus_points: 8,
  wins_correct: 13,
  losses: 24,
  draws_correct: 35,
  draws_incorrect: 46,
});

const ADA = makeRow({
  userId: 103,
  name: 'Ada',
  points: 60,
  bonus_points: 12,
  wins_correct: 15,
  losses: 26,
  draws_correct: 37,
  draws_incorrect: 48,
});

// Supplied order: Zara, Milo, Ada (not sorted by name or points).
const ROWS: TournamentLeaderboardRow[] = [ZARA, MILO, ADA];

// Layout roots. The desktop table carries ARIA table semantics; the mobile
// stacked layout is a plain list.
const table = () => screen.getByRole('table');
const mobileList = () => screen.getByRole('list');

// The member's <tr> in the desktop table, located via its unique name (rendered
// in a th scope="row"). Scoped to the table so the mobile copy never matches.
function tableRowFor(name: string): HTMLElement {
  const tr = within(table()).getByText(name).closest('tr');
  expect(tr).not.toBeNull();
  return tr as HTMLElement;
}

// The member's <li> in the mobile list, located via its unique name.
function mobileItemFor(name: string): HTMLElement {
  const li = within(mobileList()).getByText(name).closest('li');
  expect(li).not.toBeNull();
  return li as HTMLElement;
}

describe('TournamentLeaderboard', () => {
  describe('desktop table — rows', () => {
    it('renders exactly one table row per entry', () => {
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

  describe('desktop table — points and tiebreaker columns', () => {
    it('renders points plus all four tiebreaker values for each row', () => {
      render(<TournamentLeaderboard rows={ROWS} />);
      // Scope every assertion to the member's own row so a value can never
      // satisfy the lookup by matching a different member's cell.
      ROWS.forEach(row => {
        const tr = tableRowFor(row.name);
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
      const miloRow = tableRowFor('Milo');
      expect(within(miloRow).getByText(String(MILO.points))).toBeInTheDocument();
      expect(within(miloRow).getByText(String(MILO.wins_correct))).toBeInTheDocument();
      expect(within(miloRow).queryByText(String(ADA.points))).not.toBeInTheDocument();
      expect(within(miloRow).queryByText(String(ADA.wins_correct))).not.toBeInTheDocument();
    });

    it('renders the four tiebreaker column headers', () => {
      render(<TournamentLeaderboard rows={ROWS} />);
      expect(screen.getByRole('columnheader', { name: 'Points' })).toBeInTheDocument();
      expect(screen.getByRole('columnheader', { name: 'Wins Correct' })).toBeInTheDocument();
      expect(screen.getByRole('columnheader', { name: 'Losses' })).toBeInTheDocument();
      expect(screen.getByRole('columnheader', { name: 'Draws Correct' })).toBeInTheDocument();
      expect(screen.getByRole('columnheader', { name: 'Draws Incorrect' })).toBeInTheDocument();
    });
  });

  describe('Bonus column', () => {
    it('renders the Bonus column header', () => {
      render(<TournamentLeaderboard rows={ROWS} />);
      expect(screen.getByRole('columnheader', { name: 'Bonus' })).toBeInTheDocument();
    });

    it('renders bonus_points for each row in the desktop table', () => {
      render(<TournamentLeaderboard rows={ROWS} />);
      ROWS.forEach(row => {
        const tr = tableRowFor(row.name);
        expect(within(tr).getByText(String(row.bonus_points))).toBeInTheDocument();
      });
    });

    it("keeps each member's bonus in their own row", () => {
      render(<TournamentLeaderboard rows={ROWS} />);
      const zaraRow = tableRowFor('Zara');
      expect(within(zaraRow).getByText(String(ZARA.bonus_points))).toBeInTheDocument();
      expect(within(zaraRow).queryByText(String(MILO.bonus_points))).not.toBeInTheDocument();
    });
  });

  describe('knockoutOnly prop — draw columns', () => {
    it('shows draw column headers when knockoutOnly is false (default)', () => {
      render(<TournamentLeaderboard rows={ROWS} />);
      expect(screen.getByRole('columnheader', { name: 'Draws Correct' })).toBeInTheDocument();
      expect(screen.getByRole('columnheader', { name: 'Draws Incorrect' })).toBeInTheDocument();
    });

    it('hides both draw column headers when knockoutOnly is true', () => {
      render(<TournamentLeaderboard rows={ROWS} knockoutOnly />);
      expect(screen.queryByRole('columnheader', { name: 'Draws Correct' })).not.toBeInTheDocument();
      expect(screen.queryByRole('columnheader', { name: 'Draws Incorrect' })).not.toBeInTheDocument();
    });

    it('still shows Wins Correct, Losses, Points, and Bonus when knockoutOnly is true', () => {
      render(<TournamentLeaderboard rows={ROWS} knockoutOnly />);
      expect(screen.getByRole('columnheader', { name: 'Points' })).toBeInTheDocument();
      expect(screen.getByRole('columnheader', { name: 'Wins Correct' })).toBeInTheDocument();
      expect(screen.getByRole('columnheader', { name: 'Losses' })).toBeInTheDocument();
      expect(screen.getByRole('columnheader', { name: 'Bonus' })).toBeInTheDocument();
    });

    it('still renders draw values in each row when knockoutOnly is false', () => {
      render(<TournamentLeaderboard rows={ROWS} />);
      ROWS.forEach(row => {
        const tr = tableRowFor(row.name);
        expect(within(tr).getByText(String(row.draws_correct))).toBeInTheDocument();
        expect(within(tr).getByText(String(row.draws_incorrect))).toBeInTheDocument();
      });
    });
  });

  describe('mobile list — card-free stacked layout', () => {
    it('renders one list item per entry, in the supplied order', () => {
      render(<TournamentLeaderboard rows={ROWS} />);
      const items = within(mobileList()).getAllByRole('listitem');
      expect(items).toHaveLength(ROWS.length);
      ROWS.forEach((row, i) => {
        expect(within(items[i]).getByText(row.name)).toBeInTheDocument();
      });
    });

    it('shows points and all four tiebreaker stats for each member', () => {
      render(<TournamentLeaderboard rows={ROWS} />);
      ROWS.forEach(row => {
        const li = mobileItemFor(row.name);
        expect(within(li).getByText(String(row.points))).toBeInTheDocument();
        expect(within(li).getByText(String(row.wins_correct))).toBeInTheDocument();
        expect(within(li).getByText(String(row.losses))).toBeInTheDocument();
        expect(within(li).getByText(String(row.draws_correct))).toBeInTheDocument();
        expect(within(li).getByText(String(row.draws_incorrect))).toBeInTheDocument();
      });
    });

    it('chip grid columns match the chip count — 5 in a regular pool, 3 when knockout-only', () => {
      const { rerender } = render(<TournamentLeaderboard rows={ROWS} />);
      // Regular: 4 tiebreaker chips + Bonus = 5 chips → an even single row.
      const grid = mobileItemFor(ROWS[0].name).querySelector('div.grid');
      expect(grid?.className).toMatch(/grid-cols-5/);
      expect(grid?.children).toHaveLength(5);

      rerender(<TournamentLeaderboard rows={ROWS} knockoutOnly />);
      // Knockout-only: 2 chips (draws hidden) + Bonus = 3 chips → grid-cols-3.
      const koGrid = mobileItemFor(ROWS[0].name).querySelector('div.grid');
      expect(koGrid?.className).toMatch(/grid-cols-3/);
      expect(koGrid?.children).toHaveLength(3);
    });

    it('is a card-free list (no bordered card wrapper)', () => {
      render(<TournamentLeaderboard rows={ROWS} />);
      // The mobile root is the <ul>; it carries no border utility classes.
      const list = mobileList();
      expect(list.className).not.toMatch(/\bborder\b/);
      expect(list.className).not.toMatch(/rounded-lg/);
    });
  });

  describe('avatars', () => {
    const WITH_PIC: TournamentLeaderboardRow[] = [
      makeRow({ userId: 200, name: 'Pic Person', pictureUrl: 'https://example.com/p.jpg?sz=100' }),
    ];

    it('renders the member picture in both layouts when pictureUrl is provided', () => {
      render(<TournamentLeaderboard rows={WITH_PIC} />);
      // One <img> in the mobile list, one in the desktop table.
      const imgs = screen.getAllByRole('img');
      expect(imgs).toHaveLength(2);
      imgs.forEach(img => {
        expect(img).toHaveAttribute('src', 'https://example.com/p.jpg?sz=100');
        expect(img).toHaveAttribute('alt', 'Pic Person');
      });
    });

    it('falls back to initials (no img) when pictureUrl is absent', () => {
      render(<TournamentLeaderboard rows={[ZARA]} />);
      expect(screen.queryByRole('img')).toBeNull();
      // Initials appear once per layout.
      expect(screen.getAllByText('Z')).toHaveLength(2);
    });
  });

  describe('empty state', () => {
    it('renders the placeholder message and neither layout when rows is empty', () => {
      render(<TournamentLeaderboard rows={[]} />);
      expect(screen.getByText(/no standings yet/i)).toBeInTheDocument();
      // Both layouts are absent in the empty state.
      expect(screen.queryByRole('table')).not.toBeInTheDocument();
      expect(screen.queryByRole('list')).not.toBeInTheDocument();
      expect(screen.queryAllByRole('row')).toHaveLength(0);
      expect(screen.queryAllByRole('rowheader')).toHaveLength(0);
    });
  });
});
