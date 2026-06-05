import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import GamePickRow, { type PickGame } from './GamePickRow';

const buf = { id: '1', name: 'Bills', abbreviation: 'BUF', logo: '' };
const ne = { id: '2', name: 'Patriots', abbreviation: 'NE', logo: '' };

function scheduledGame(overrides: Partial<PickGame> = {}): PickGame {
  return {
    id: 10,
    awayTeam: buf,
    homeTeam: ne,
    awayScore: 0,
    homeScore: 0,
    status: 'SCHEDULED',
    gameDate: '2025-09-21T17:00:00.000Z',
    ...overrides,
  };
}

const noop = () => {};

function baseProps() {
  return {
    game: scheduledGame(),
    pick: null,
    totalGames: 3,
    usedConfidences: new Set<number>(),
    onToggleWinner: vi.fn(),
    onAssignConfidence: vi.fn(),
    onClearPick: vi.fn(),
  };
}

describe('GamePickRow', () => {
  beforeEach(() => vi.clearAllMocks());

  it('renders both teams as radios and the formatted date', () => {
    render(<GamePickRow {...baseProps()} />);
    expect(screen.getByRole('radio', { name: 'Pick Bills to win' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'Pick Patriots to win' })).toBeInTheDocument();
    expect(screen.getAllByText('BUF').length).toBeGreaterThan(0);
  });

  it('calls onToggleWinner with the team id when a team is clicked', () => {
    const props = baseProps();
    render(<GamePickRow {...props} />);
    fireEvent.click(screen.getByRole('radio', { name: 'Pick Bills to win' }));
    expect(props.onToggleWinner).toHaveBeenCalledWith(1);
  });

  it('offers only unused confidence values for an incomplete pick', () => {
    const props = { ...baseProps(), usedConfidences: new Set<number>([2]) };
    render(<GamePickRow {...props} />);
    fireEvent.click(screen.getByRole('button', { name: /Confidence for BUF at NE/ }));
    const options = screen.getAllByRole('option').map((o) => o.textContent);
    // totalGames=3, value 2 taken by another game -> only 1 and 3 selectable.
    expect(options).toEqual(['1', '3']);
  });

  it('offers the full range for a complete pick so it can be reassigned', () => {
    const props = {
      ...baseProps(),
      pick: { pickedTeamId: 1, confidence: 1 },
      usedConfidences: new Set<number>([2, 3]),
    };
    render(<GamePickRow {...props} />);
    fireEvent.click(screen.getByRole('button', { name: /Confidence for BUF at NE/ }));
    const options = screen.getAllByRole('option').map((o) => o.textContent);
    expect(options).toEqual(['1', '2', '3']);
  });

  it('calls onAssignConfidence when a value is chosen', () => {
    const props = baseProps();
    render(<GamePickRow {...props} />);
    fireEvent.click(screen.getByRole('button', { name: /Confidence for BUF at NE/ }));
    fireEvent.click(screen.getByRole('option', { name: '3' }));
    expect(props.onAssignConfidence).toHaveBeenCalledWith(3);
  });

  it('shows a Clear button and fires onClearPick when a pick is set', () => {
    const props = { ...baseProps(), pick: { pickedTeamId: 1, confidence: null } };
    render(<GamePickRow {...props} />);
    fireEvent.click(screen.getByRole('button', { name: 'Clear' }));
    expect(props.onClearPick).toHaveBeenCalled();
  });

  it('renders a read-only confidence (no picker) for a final game', () => {
    const props = {
      ...baseProps(),
      game: scheduledGame({ status: 'FINAL', awayScore: 24, homeScore: 20 }),
      pick: { pickedTeamId: 1, confidence: 5 },
    };
    render(<GamePickRow {...props} />);
    expect(screen.queryByRole('button', { name: /Confidence for/ })).not.toBeInTheDocument();
    expect(screen.getByText('5')).toBeInTheDocument();
    // Final games are not editable, so no Clear affordance.
    expect(screen.queryByRole('button', { name: 'Clear' })).not.toBeInTheDocument();
  });

  it('does not allow picking when disabled', () => {
    const props = { ...baseProps(), disabled: true, onToggleWinner: vi.fn() };
    render(<GamePickRow {...props} />);
    fireEvent.click(screen.getByRole('radio', { name: 'Pick Bills to win' }));
    expect(props.onToggleWinner).not.toHaveBeenCalled();
  });

  it('selects a team via Enter and toggles via arrow keys', () => {
    const props = baseProps();
    render(<GamePickRow {...props} />);
    const away = screen.getByRole('radio', { name: 'Pick Bills to win' });
    fireEvent.keyDown(away, { key: 'Enter' });
    expect(props.onToggleWinner).toHaveBeenCalledWith(1);
    // Arrow from the away team moves selection to the home team.
    fireEvent.keyDown(away, { key: 'ArrowRight' });
    expect(props.onToggleWinner).toHaveBeenLastCalledWith(2);
  });

  it('renders the odds line for a scheduled game', () => {
    const props = {
      ...baseProps(),
      game: scheduledGame({
        odds: { favoriteAbbr: 'NE', spread: -3, overUnder: 44, provider: 'ESPN BET' },
      }),
    };
    render(<GamePickRow {...props} />);
    expect(screen.getByText('Odds:')).toBeInTheDocument();
    expect(screen.getByText('NE -3')).toBeInTheDocument();
    expect(screen.getByText('O/U 44')).toBeInTheDocument();
    expect(screen.getByText('(ESPN BET)')).toBeInTheDocument();
  });

  it('shows the live clock and quarter for an in-progress game and locks the confidence', () => {
    const props = {
      ...baseProps(),
      game: scheduledGame({ status: 'IN_PROGRESS', displayClock: '2:00', period: 3 }),
      pick: { pickedTeamId: 1, confidence: 4 },
    };
    render(<GamePickRow {...props} />);
    expect(screen.getByText('2:00 · Q3')).toBeInTheDocument();
    // In-progress is locked (not final): read-only confidence, no picker, no clear.
    expect(screen.queryByRole('button', { name: /Confidence for/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Clear' })).not.toBeInTheDocument();
    expect(screen.getByText('4')).toBeInTheDocument();
  });

  it('honors an explicit meta.locked flag over the derived status', () => {
    const props = {
      ...baseProps(),
      game: scheduledGame({ meta: { locked: true, final: false } }),
    };
    render(<GamePickRow {...props} />);
    // Locked despite SCHEDULED status — no picker button is rendered.
    expect(screen.queryByRole('button', { name: /Confidence for/ })).not.toBeInTheDocument();
  });
});
