import { render, screen, within } from '@testing-library/react';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { GroupPicks } from './';
import type { GameData, GroupMember, MemberPicks, PickData, TeamData } from '../../../lib/types';

// --- Team fixtures -----------------------------------------------------------

function makeTeam(id: string, name: string, abbreviation: string): TeamData {
  return { id, name, abbreviation, logo: `https://logos.test/${abbreviation}.png` };
}

const CHIEFS = makeTeam('1', 'Kansas City Chiefs', 'KC');
const BILLS = makeTeam('2', 'Buffalo Bills', 'BUF');
const EAGLES = makeTeam('3', 'Philadelphia Eagles', 'PHI');
const COWBOYS = makeTeam('4', 'Dallas Cowboys', 'DAL');
const NINERS = makeTeam('5', 'San Francisco 49ers', 'SF');
const RAVENS = makeTeam('6', 'Baltimore Ravens', 'BAL');

// --- Game fixtures: one per distinct status ---------------------------------

function makeGame(overrides: Partial<GameData> & Pick<GameData, 'id' | 'homeTeam' | 'awayTeam' | 'status'>): GameData {
  return {
    espnId: `espn-${overrides.id}`,
    homeScore: 0,
    awayScore: 0,
    gameDate: '2024-11-10T18:00:00Z',
    week: 10,
    season: 2024,
    seasonType: 2,
    ...overrides,
  };
}

// Picks are withheld behind a placeholder until kickoff.
const SCHEDULED_GAME = makeGame({
  id: 101,
  homeTeam: BILLS,
  awayTeam: CHIEFS,
  status: 'SCHEDULED',
});

// Started but not graded: revealed picks show team + confidence.
const IN_PROGRESS_GAME = makeGame({
  id: 102,
  homeTeam: COWBOYS,
  awayTeam: EAGLES,
  status: 'IN_PROGRESS',
  statusDetail: 'Q3 04:21',
  homeScore: 14,
  awayScore: 17,
});

// Graded: cells show points and the row shows a correctness aggregate.
const FINAL_GAME = makeGame({
  id: 103,
  homeTeam: RAVENS,
  awayTeam: NINERS,
  status: 'FINAL',
  homeScore: 20,
  awayScore: 24,
});

const GAMES: GameData[] = [SCHEDULED_GAME, IN_PROGRESS_GAME, FINAL_GAME];

// --- Member fixtures ---------------------------------------------------------

const ALICE: GroupMember = {
  id: 'm1',
  name: 'Alice Johnson',
  email: 'alice@example.com',
  isOwner: true,
  joinedAt: '2024-08-01T00:00:00Z',
  pictureUrl: 'https://pics.test/alice.png',
};

const BOB: GroupMember = {
  id: 'm2',
  name: 'Bob Smith',
  email: 'bob@example.com',
  isOwner: false,
  joinedAt: '2024-08-05T00:00:00Z',
  pictureUrl: 'https://pics.test/bob.png',
};

const CAROL: GroupMember = {
  id: 'm3',
  name: 'Carol Diaz',
  email: 'carol@example.com',
  isOwner: false,
  joinedAt: '2024-08-09T00:00:00Z',
  pictureUrl: 'https://pics.test/carol.png',
};

const MEMBERS: GroupMember[] = [ALICE, BOB, CAROL];

// --- Pick fixtures: member-keyed picks for the week -------------------------

function makePick(overrides: Partial<PickData> & Pick<PickData, 'gameId'>): PickData {
  return {
    pickedTeamId: null,
    confidence: null,
    won: null,
    points: null,
    ...overrides,
  };
}

const PICKS: MemberPicks[] = [
  {
    memberId: ALICE.id,
    picks: [
      makePick({ gameId: SCHEDULED_GAME.id, pickedTeamId: CHIEFS.id, confidence: 3 }),
      makePick({ gameId: IN_PROGRESS_GAME.id, pickedTeamId: EAGLES.id, confidence: 2 }),
      makePick({ gameId: FINAL_GAME.id, pickedTeamId: NINERS.id, confidence: 1, won: true, points: 1 }),
    ],
  },
  {
    memberId: BOB.id,
    picks: [
      makePick({ gameId: SCHEDULED_GAME.id, pickedTeamId: BILLS.id, confidence: 1 }),
      makePick({ gameId: IN_PROGRESS_GAME.id, pickedTeamId: COWBOYS.id, confidence: 3 }),
      makePick({ gameId: FINAL_GAME.id, pickedTeamId: RAVENS.id, confidence: 2, won: false, points: 0 }),
    ],
  },
  {
    memberId: CAROL.id,
    picks: [
      makePick({ gameId: SCHEDULED_GAME.id, pickedTeamId: CHIEFS.id, confidence: 2 }),
      makePick({ gameId: FINAL_GAME.id, pickedTeamId: NINERS.id, confidence: 3, won: true, points: 3 }),
    ],
  },
];

describe('GroupPicks', () => {
  describe('game rows', () => {
    it('renders one row per game', () => {
      render(<GroupPicks games={GAMES} picks={PICKS} members={MEMBERS} />);
      // Each game contributes exactly one row-header (th scope="row").
      expect(screen.getAllByRole('rowheader')).toHaveLength(GAMES.length);
    });

    it('labels each row with the away @ home abbreviation', () => {
      render(<GroupPicks games={GAMES} picks={PICKS} members={MEMBERS} />);
      expect(screen.getByText('KC @ BUF')).toBeInTheDocument();
      expect(screen.getByText('PHI @ DAL')).toBeInTheDocument();
      expect(screen.getByText('SF @ BAL')).toBeInTheDocument();
    });
  });

  describe('member columns', () => {
    it('renders one column header per member', () => {
      render(<GroupPicks games={GAMES} picks={PICKS} members={MEMBERS} />);
      MEMBERS.forEach(member => {
        expect(screen.getByText(member.name)).toBeInTheDocument();
      });
    });

    it('renders exactly members.length member name headers', () => {
      render(<GroupPicks games={GAMES} picks={PICKS} members={MEMBERS} />);
      const names = MEMBERS.map(member => screen.getByText(member.name));
      expect(names).toHaveLength(MEMBERS.length);
    });
  });

  describe('revealed picks', () => {
    // Member cells render in member order, after the row-header; the trailing
    // "Correct" column (present because GAMES contains a FINAL game) is last.
    function cellsForGameRow(label: string) {
      const row = screen.getByText(label).closest('tr');
      expect(row).not.toBeNull();
      return within(row as HTMLElement).getAllByRole('cell');
    }

    it('shows the picked team abbreviation and confidence in the picker cell', () => {
      render(<GroupPicks games={GAMES} picks={PICKS} members={MEMBERS} />);
      // IN_PROGRESS game has started, so Alice's pick (EAGLES @ confidence 2) is revealed.
      const [aliceCell] = cellsForGameRow('PHI @ DAL');
      expect(within(aliceCell).getByText('PHI')).toBeInTheDocument();
      expect(within(aliceCell).getByText('(2)')).toBeInTheDocument();
    });

    it("lands each member's differing pick in its own cell, not crossed", () => {
      render(<GroupPicks games={GAMES} picks={PICKS} members={MEMBERS} />);
      const [aliceCell, bobCell] = cellsForGameRow('PHI @ DAL');

      // Alice picked the Eagles; Bob picked the Cowboys for the same game.
      expect(within(aliceCell).getByText('PHI')).toBeInTheDocument();
      expect(within(aliceCell).queryByText('DAL')).not.toBeInTheDocument();

      expect(within(bobCell).getByText('DAL')).toBeInTheDocument();
      expect(within(bobCell).getByText('(3)')).toBeInTheDocument();
      expect(within(bobCell).queryByText('PHI')).not.toBeInTheDocument();
    });
  });

  describe('hidden and missing picks', () => {
    function cellsForGameRow(label: string) {
      const row = screen.getByText(label).closest('tr');
      expect(row).not.toBeNull();
      return within(row as HTMLElement).getAllByRole('cell');
    }

    it("renders the 'Hidden' placeholder for every member in a SCHEDULED game", () => {
      render(<GroupPicks games={GAMES} picks={PICKS} members={MEMBERS} />);
      // SCHEDULED game: picks are withheld until kickoff for all three members,
      // even though each of them has a complete pick in the fixtures.
      const cells = cellsForGameRow('KC @ BUF');
      const [aliceCell] = cells;
      expect(within(aliceCell).getByText('Hidden')).toBeInTheDocument();
      // Withheld regardless of the underlying data — Alice's KC pick is not shown.
      expect(within(aliceCell).queryByText('KC')).not.toBeInTheDocument();

      const hidden = MEMBERS.map((_, i) => within(cells[i]).getByText('Hidden'));
      expect(hidden).toHaveLength(MEMBERS.length);
    });

    it("renders 'No pick' for a started game where the member has no complete pick", () => {
      render(<GroupPicks games={GAMES} picks={PICKS} members={MEMBERS} />);
      // IN_PROGRESS game has started; Carol submitted no pick for it.
      const cells = cellsForGameRow('PHI @ DAL');
      const carolCell = cells[MEMBERS.indexOf(CAROL)];
      expect(within(carolCell).getByText('No pick')).toBeInTheDocument();
    });
  });

  describe('points and correctness (FINAL only)', () => {
    // Member cells come first (in member order), then the trailing "Correct"
    // aggregate cell — present here because GAMES includes a FINAL game.
    function cellsForGameRow(label: string) {
      const row = screen.getByText(label).closest('tr');
      expect(row).not.toBeNull();
      return within(row as HTMLElement).getAllByRole('cell');
    }

    it("shows the picked team's points in each cell of a FINAL game", () => {
      render(<GroupPicks games={GAMES} picks={PICKS} members={MEMBERS} />);
      // FINAL game is graded: each revealed cell shows the team plus its points.
      const [aliceCell, bobCell, carolCell] = cellsForGameRow('SF @ BAL');

      // Alice picked the 49ers and won 1 point.
      expect(within(aliceCell).getByText('SF')).toBeInTheDocument();
      expect(within(aliceCell).getByText('1')).toBeInTheDocument();
      // Bob picked the Ravens and lost (0 points).
      expect(within(bobCell).getByText('BAL')).toBeInTheDocument();
      expect(within(bobCell).getByText('0')).toBeInTheDocument();
      // Carol picked the 49ers and won 3 points.
      expect(within(carolCell).getByText('SF')).toBeInTheDocument();
      expect(within(carolCell).getByText('3')).toBeInTheDocument();
    });

    it("renders the per-game 'correct/graded' aggregate for a FINAL game", () => {
      render(<GroupPicks games={GAMES} picks={PICKS} members={MEMBERS} />);
      // Alice and Carol won, Bob lost → 2 of 3 graded picks correct.
      const cells = cellsForGameRow('SF @ BAL');
      const correctnessCell = cells[MEMBERS.length];
      expect(within(correctnessCell).getByText('2/3')).toBeInTheDocument();
    });

    it('shows confidence in parentheses but no points/result for an IN_PROGRESS game', () => {
      render(<GroupPicks games={GAMES} picks={PICKS} members={MEMBERS} />);
      // Started but ungraded: revealed cell shows team + confidence, never a result chip.
      const [aliceCell] = cellsForGameRow('PHI @ DAL');
      expect(within(aliceCell).getByText('PHI')).toBeInTheDocument();
      expect(within(aliceCell).getByText('(2)')).toBeInTheDocument();
      // The Won/Lost/Push result chip (with its points) only renders on FINAL cells.
      expect(within(aliceCell).queryByTitle(/Won|Lost|Push/)).not.toBeInTheDocument();
    });

    it("shows the '—' placeholder in the correctness column for non-FINAL rows", () => {
      render(<GroupPicks games={GAMES} picks={PICKS} members={MEMBERS} />);
      const scheduledCorrectness = cellsForGameRow('KC @ BUF')[MEMBERS.length];
      const inProgressCorrectness = cellsForGameRow('PHI @ DAL')[MEMBERS.length];

      expect(within(scheduledCorrectness).getByText('—')).toBeInTheDocument();
      expect(within(inProgressCorrectness).getByText('—')).toBeInTheDocument();
      // No correct/graded aggregate appears until the game is FINAL.
      expect(within(scheduledCorrectness).queryByText(/\d+\/\d+/)).not.toBeInTheDocument();
      expect(within(inProgressCorrectness).queryByText(/\d+\/\d+/)).not.toBeInTheDocument();
    });

    it("renders the 'Correct' header column only when at least one game is FINAL", () => {
      const { rerender } = render(<GroupPicks games={GAMES} picks={PICKS} members={MEMBERS} />);
      // GAMES includes a FINAL game → the Correct column header is present.
      expect(screen.getByRole('columnheader', { name: 'Correct' })).toBeInTheDocument();

      // With only SCHEDULED + IN_PROGRESS games, the column disappears entirely.
      rerender(<GroupPicks games={[SCHEDULED_GAME, IN_PROGRESS_GAME]} picks={PICKS} members={MEMBERS} />);
      expect(screen.queryByRole('columnheader', { name: 'Correct' })).not.toBeInTheDocument();
    });
  });

  // Below the `md` breakpoint, useMediaQuery('(max-width: 767px)') matches and
  // GroupPicks renders a card-per-game layout instead of the wide table.
  describe('mobile layout (below md)', () => {
    function mockViewport(matches: boolean) {
      window.matchMedia = ((query: string) => ({
        matches,
        media: query,
        onchange: null,
        addEventListener: () => {},
        removeEventListener: () => {},
        addListener: () => {},
        removeListener: () => {},
        dispatchEvent: () => false,
      })) as unknown as typeof window.matchMedia;
    }

    beforeEach(() => mockViewport(true)); // simulate a small viewport
    afterEach(() => mockViewport(false)); // restore the desktop default

    it('renders cards instead of the table', () => {
      render(<GroupPicks games={GAMES} picks={PICKS} members={MEMBERS} />);
      expect(screen.queryByRole('table')).not.toBeInTheDocument();
      // One matchup heading per game (unique), and every member is listed in
      // each game's card.
      expect(screen.getByText('KC @ BUF')).toBeInTheDocument();
      expect(screen.getByText('SF @ BAL')).toBeInTheDocument();
      expect(screen.getAllByText('Alice Johnson')).toHaveLength(GAMES.length);
    });

    it('withholds picks until kickoff in the card layout', () => {
      render(<GroupPicks games={[SCHEDULED_GAME]} picks={PICKS} members={MEMBERS} />);
      // One "Hidden" placeholder per member for the still-scheduled game.
      expect(screen.getAllByText('Hidden')).toHaveLength(MEMBERS.length);
    });

    it('shows graded results and the per-game correct/graded aggregate', () => {
      render(<GroupPicks games={[FINAL_GAME]} picks={PICKS} members={MEMBERS} />);
      // Alice + Carol correct, Bob wrong → 2/3.
      expect(screen.getByText('2/3 correct')).toBeInTheDocument();
    });
  });
});
