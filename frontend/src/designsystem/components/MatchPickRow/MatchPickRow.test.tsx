import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import MatchPickRow from './MatchPickRow';
import type { MatchEvent, TeamData, WorldCupMatch } from '../../../lib/types';

const mexico: TeamData = { id: '1', name: 'Mexico', abbreviation: 'MEX', logo: '' };
const usa: TeamData = { id: '2', name: 'United States', abbreviation: 'USA', logo: '' };

function groupMatch(overrides: Partial<WorldCupMatch> = {}): WorldCupMatch {
  return {
    id: 100,
    stage: 'group',
    homeTeam: mexico,
    awayTeam: usa,
    homeScore: 0,
    awayScore: 0,
    status: 'SCHEDULED',
    isKnockout: false,
    // Tomorrow so "scheduled, not yet kicked off" stays editable whenever the
    // suite runs. Past-kickoff locking is covered by its own test below.
    gameDate: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    ...overrides,
  };
}

function knockoutMatch(overrides: Partial<WorldCupMatch> = {}): WorldCupMatch {
  return groupMatch({ id: 200, stage: 'r16', isKnockout: true, ...overrides });
}

function baseProps() {
  return {
    match: groupMatch(),
    pickedResult: null,
    onPick: vi.fn(),
    disabled: false,
  };
}

describe('MatchPickRow', () => {
  beforeEach(() => vi.clearAllMocks());

  it('renders the three Home / Draw / Away buttons', () => {
    render(<MatchPickRow {...baseProps()} />);
    expect(screen.getByRole('button', { name: 'Pick Mexico to win' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Pick a draw' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Pick United States to win' })).toBeInTheDocument();
  });

  it('labels the team buttons with just the country code — no "(Home)"/"(Away)" suffix', () => {
    render(<MatchPickRow {...baseProps()} />);
    expect(screen.getByRole('button', { name: 'Pick Mexico to win' })).toHaveTextContent(/^MEX$/);
    expect(screen.getByRole('button', { name: 'Pick United States to win' })).toHaveTextContent(
      /^USA$/
    );
  });

  it('disables the Draw button for a knockout match', () => {
    render(<MatchPickRow {...baseProps()} match={knockoutMatch()} />);
    expect(screen.getByRole('button', { name: 'Pick a draw' })).toBeDisabled();
    // Home and Away remain pickable on knockouts.
    expect(screen.getByRole('button', { name: 'Pick Mexico to win' })).not.toBeDisabled();
    expect(screen.getByRole('button', { name: 'Pick United States to win' })).not.toBeDisabled();
  });

  it('does not render a confidence selector', () => {
    render(<MatchPickRow {...baseProps()} />);
    expect(screen.queryByRole('button', { name: /Confidence/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });

  it("fires onPick with 'home' when the home button is clicked", () => {
    const props = baseProps();
    render(<MatchPickRow {...props} />);
    fireEvent.click(screen.getByRole('button', { name: 'Pick Mexico to win' }));
    expect(props.onPick).toHaveBeenCalledWith('home');
  });

  it("fires onPick with 'draw' when the draw button is clicked on a group match", () => {
    const props = baseProps();
    render(<MatchPickRow {...props} />);
    fireEvent.click(screen.getByRole('button', { name: 'Pick a draw' }));
    expect(props.onPick).toHaveBeenCalledWith('draw');
  });

  it("fires onPick with 'away' when the away button is clicked", () => {
    const props = baseProps();
    render(<MatchPickRow {...props} />);
    fireEvent.click(screen.getByRole('button', { name: 'Pick United States to win' }));
    expect(props.onPick).toHaveBeenCalledWith('away');
  });

  it('does not fire onPick for a disabled draw on a knockout match', () => {
    const props = { ...baseProps(), match: knockoutMatch() };
    render(<MatchPickRow {...props} />);
    fireEvent.click(screen.getByRole('button', { name: 'Pick a draw' }));
    expect(props.onPick).not.toHaveBeenCalled();
  });

  it('visually marks the selected result via aria-pressed', () => {
    render(<MatchPickRow {...baseProps()} pickedResult="away" />);
    expect(screen.getByRole('button', { name: 'Pick United States to win' })).toHaveAttribute(
      'aria-pressed',
      'true'
    );
    expect(screen.getByRole('button', { name: 'Pick Mexico to win' })).toHaveAttribute(
      'aria-pressed',
      'false'
    );
    expect(screen.getByRole('button', { name: 'Pick a draw' })).toHaveAttribute(
      'aria-pressed',
      'false'
    );
  });

  it('does not fire onPick when the row is disabled', () => {
    const props = { ...baseProps(), disabled: true };
    render(<MatchPickRow {...props} />);
    fireEvent.click(screen.getByRole('button', { name: 'Pick Mexico to win' }));
    expect(props.onPick).not.toHaveBeenCalled();
  });

  it('disables every outcome while a team slot is an unassigned TBD placeholder', () => {
    const tbd: TeamData = { id: 'tbd-1', name: 'TBD', abbreviation: 'TBD', logo: '' };
    const props = { ...baseProps(), match: knockoutMatch({ awayTeam: tbd }) };
    render(<MatchPickRow {...props} />);

    expect(screen.getByRole('button', { name: 'Pick Mexico to win' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Pick a draw' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Pick TBD to win' })).toBeDisabled();

    fireEvent.click(screen.getByRole('button', { name: 'Pick Mexico to win' }));
    expect(props.onPick).not.toHaveBeenCalled();
  });

  it('keeps picks enabled once both knockout slots hold real teams', () => {
    render(<MatchPickRow {...baseProps()} match={knockoutMatch()} />);
    expect(screen.getByRole('button', { name: 'Pick Mexico to win' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Pick United States to win' })).toBeEnabled();
  });

  it('locks all picks once the match is final', () => {
    const props = {
      ...baseProps(),
      match: groupMatch({ status: 'FINAL', homeScore: 2, awayScore: 1 }),
      pickedResult: 'home' as const,
    };
    render(<MatchPickRow {...props} />);
    expect(screen.getByRole('button', { name: 'Pick Mexico to win' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Pick Mexico to win' }));
    expect(props.onPick).not.toHaveBeenCalled();
  });

  // Regression: ESPN can briefly flap an in-progress match's status back to
  // SCHEDULED mid-game. Locking must key off the kickoff time, not just status,
  // so a started match stays locked even when status reads 'SCHEDULED'.
  it('locks a SCHEDULED match whose kickoff time has already passed', () => {
    const props = {
      ...baseProps(),
      match: groupMatch({ status: 'SCHEDULED', gameDate: new Date(Date.now() - 60 * 60 * 1000).toISOString() }),
    };
    render(<MatchPickRow {...props} />);
    expect(screen.getByRole('button', { name: 'Pick Mexico to win' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Pick a draw' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Pick United States to win' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Pick Mexico to win' }));
    expect(props.onPick).not.toHaveBeenCalled();
  });

  describe('match timeline', () => {
    const EVENTS: MatchEvent[] = [
      { type: 'goal', minute: "9'", player: 'J. Quiñones', side: 'home', teamAbbr: 'MEX' },
      { type: 'red-card', minute: "49'", player: 'S. Sithole', side: 'away', teamAbbr: 'USA' },
    ];

    it('renders the goal/card timeline once a started match has events', () => {
      const match = groupMatch({ status: 'FINAL', events: EVENTS });
      render(<MatchPickRow {...baseProps()} match={match} />);
      expect(screen.getByText("9'")).toBeInTheDocument();
      expect(screen.getByText('J. Quiñones')).toBeInTheDocument();
      expect(screen.getByText('S. Sithole')).toBeInTheDocument();
    });

    it('hides the timeline before kickoff even when events are present', () => {
      // Default groupMatch is SCHEDULED with a future kickoff → not locked.
      const match = groupMatch({ events: EVENTS });
      render(<MatchPickRow {...baseProps()} match={match} />);
      expect(screen.queryByText("9'")).not.toBeInTheDocument();
      expect(screen.queryByText('J. Quiñones')).not.toBeInTheDocument();
    });

    it('renders no timeline when a started match has no events', () => {
      const match = groupMatch({ status: 'FINAL' });
      render(<MatchPickRow {...baseProps()} match={match} />);
      expect(screen.queryByText('J. Quiñones')).not.toBeInTheDocument();
    });
  });
});
