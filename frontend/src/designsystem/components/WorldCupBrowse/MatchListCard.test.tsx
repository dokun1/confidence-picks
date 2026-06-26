import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import MatchListCard from './MatchListCard';
import type { BrowseGame, BrowseTeam } from '../../../lib/wcGamesView';

const NOW = new Date('2026-06-12T16:00:00');

const team = (abbr: string, name: string): BrowseTeam => ({ abbr, name, logo: '' });

function game(over: Partial<BrowseGame> = {}): BrowseGame {
  return {
    id: 101, espnId: 'e101', stage: 'group', stageLabel: 'Group Stage',
    kickoff: '2026-06-12T20:00:00', // after NOW → pickable
    home: team('MEX', 'Mexico'), away: team('CAN', 'Canada'),
    status: 'SCHEDULED', isKnockout: false,
    ...over,
  };
}

const noop = () => {};

describe('MatchListCard', () => {
  it('a group game with real teams enables all three pick buttons (incl. Draw)', () => {
    render(<MatchListCard game={game()} now={NOW} onPick={noop} />);
    expect(screen.getByRole('button', { name: 'MEX' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Draw' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'CAN' })).toBeEnabled();
  });

  it('a knockout game offers only the two teams — no Draw button at all', () => {
    render(<MatchListCard game={game({ isKnockout: true, stage: 'r16' })} now={NOW} onPick={noop} />);
    expect(screen.getByRole('button', { name: 'MEX' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'CAN' })).toBeEnabled();
    expect(screen.queryByRole('button', { name: 'Draw' })).toBeNull();
  });

  it('a knockout game with a TBD team disables both team buttons and still shows no Draw', () => {
    render(
      <MatchListCard
        game={game({ isKnockout: true, stage: 'r32', away: team('TBD', 'TBD') })}
        now={NOW}
        onPick={noop}
      />,
    );
    expect(screen.getByRole('button', { name: 'MEX' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'TBD' })).toBeDisabled();
    expect(screen.queryByRole('button', { name: 'Draw' })).toBeNull();
  });

  it('exposes a match-card testid on the root element', () => {
    render(<MatchListCard game={game({ id: 42 })} now={NOW} onPick={noop} />);
    expect(screen.getByTestId('match-card-42')).toBeInTheDocument();
  });

  it('calls onOpenDetail with the game id when "More ›" is clicked', () => {
    const onOpenDetail = vi.fn();
    render(<MatchListCard game={game({ id: 42 })} now={NOW} onPick={noop} onOpenDetail={onOpenDetail} />);
    fireEvent.click(screen.getByRole('button', { name: /more/i }));
    expect(onOpenDetail).toHaveBeenCalledWith(42);
  });

  it('omits the "More ›" button when no onOpenDetail handler is given', () => {
    render(<MatchListCard game={game()} now={NOW} onPick={noop} />);
    expect(screen.queryByRole('button', { name: /more/i })).toBeNull();
  });

  it('shows the live minute mark next to the LIVE badge for an in-progress game', () => {
    render(
      <MatchListCard
        game={game({ id: 77, status: 'IN_PROGRESS', displayClock: "63'", homeScore: 1, awayScore: 0 })}
        now={NOW}
        onPick={noop}
      />,
    );
    expect(screen.getByText('LIVE')).toBeInTheDocument();
    expect(screen.getByTestId('match-clock-77')).toHaveTextContent("63'");
  });

  it('collapses a halftime break to HT on the card', () => {
    render(
      <MatchListCard
        game={game({ id: 78, status: 'IN_PROGRESS', displayClock: "45'", statusDetail: 'Halftime' })}
        now={NOW}
        onPick={noop}
      />,
    );
    expect(screen.getByTestId('match-clock-78')).toHaveTextContent('HT');
  });

  it('renders no clock chip for a scheduled or final game', () => {
    const { rerender } = render(<MatchListCard game={game({ id: 79 })} now={NOW} onPick={noop} />);
    expect(screen.queryByTestId('match-clock-79')).toBeNull();
    rerender(<MatchListCard game={game({ id: 79, status: 'FINAL', homeScore: 2, awayScore: 1 })} now={NOW} onPick={noop} />);
    expect(screen.queryByTestId('match-clock-79')).toBeNull();
  });

  describe('score prediction (knockout matches)', () => {
    it('the score inputs are disabled until a team is picked (score is an optional add-on)', () => {
      render(<MatchListCard game={game({ isKnockout: true, stage: 'r16' })} now={NOW} onPick={noop} onScoreChange={vi.fn()} />);
      // No pick yet -> both score fields are disabled.
      expect(screen.getByRole('textbox', { name: 'Predicted score for Mexico' })).toBeDisabled();
      expect(screen.getByRole('textbox', { name: 'Predicted score for Canada' })).toBeDisabled();
    });

    it('once a team is picked the score inputs enable, default empty, and accept only positive integers (no steppers)', () => {
      const onScoreChange = vi.fn();
      render(<MatchListCard game={game({ isKnockout: true, stage: 'r16', picked: 'home' })} now={NOW} onPick={noop} onScoreChange={onScoreChange} />);
      const home = screen.getByRole('textbox', { name: 'Predicted score for Mexico' });
      const away = screen.getByRole('textbox', { name: 'Predicted score for Canada' });
      expect(home).toBeEnabled();
      // Default is empty — no pre-filled 0 — and they're textboxes (no number steppers).
      expect(home).toHaveValue('');
      expect(away).toHaveValue('');
      // Letters and decimal points are stripped; only the integer digits survive.
      fireEvent.change(home, { target: { value: 'a3.b' } });
      expect(onScoreChange).toHaveBeenLastCalledWith(101, 'home', 3);
      fireEvent.change(away, { target: { value: '0' } });
      expect(onScoreChange).toHaveBeenLastCalledWith(101, 'away', 0);
    });

    it('disables the score inputs when the card is disabled (e.g. a submit in flight), even if picked', () => {
      render(<MatchListCard game={game({ isKnockout: true, stage: 'r16', picked: 'home' })} now={NOW} onPick={noop} onScoreChange={vi.fn()} disabled />);
      expect(screen.getByRole('textbox', { name: 'Predicted score for Mexico' })).toBeDisabled();
      expect(screen.getByRole('textbox', { name: 'Predicted score for Canada' })).toBeDisabled();
    });

    // A locked knockout match: kickoff in the past and status FINAL.
    function lockedKnockout(over: Partial<BrowseGame> = {}): BrowseGame {
      return game({
        id: 200, stage: 'r16', isKnockout: true,
        kickoff: '2026-06-01T14:00:00', // before NOW → locked
        status: 'FINAL', homeScore: 2, awayScore: 1,
        ...over,
      });
    }

    it('shows "Your prediction: X–Y" in the locked branch when both scores were saved', () => {
      render(
        <MatchListCard
          game={lockedKnockout({ predictedHomeScore: 2, predictedAwayScore: 1 })}
          now={NOW}
          onPick={noop}
        />,
      );
      expect(screen.getByTestId('prediction-200')).toBeInTheDocument();
      expect(screen.getByText('Your prediction:')).toBeInTheDocument();
      // Scores should appear in the prediction line.
      expect(screen.getByTestId('prediction-200').textContent).toMatch(/2/);
      expect(screen.getByTestId('prediction-200').textContent).toMatch(/1/);
    });

    it('omits the prediction line in the locked branch when no scores were saved', () => {
      render(<MatchListCard game={lockedKnockout()} now={NOW} onPick={noop} />);
      expect(screen.queryByTestId('prediction-200')).toBeNull();
      expect(screen.queryByText('Your prediction:')).toBeNull();
    });

    it('shows the one-sided hint when exactly one score input is filled', () => {
      const onScoreChange = vi.fn();
      render(
        <MatchListCard
          game={game({ id: 300, isKnockout: true, stage: 'r16', picked: 'home', predictedHomeScore: 2, predictedAwayScore: null })}
          now={NOW}
          onPick={noop}
          onScoreChange={onScoreChange}
        />,
      );
      expect(screen.getByTestId('score-hint-300')).toBeInTheDocument();
      expect(screen.getByText('Enter both scores to earn the bonus')).toBeInTheDocument();
    });

    it('hides the one-sided hint when both scores are filled', () => {
      const onScoreChange = vi.fn();
      render(
        <MatchListCard
          game={game({ id: 301, isKnockout: true, stage: 'r16', picked: 'home', predictedHomeScore: 2, predictedAwayScore: 1 })}
          now={NOW}
          onPick={noop}
          onScoreChange={onScoreChange}
        />,
      );
      expect(screen.queryByTestId('score-hint-301')).toBeNull();
      expect(screen.queryByText('Enter both scores to earn the bonus')).toBeNull();
    });

    it('hides the one-sided hint when neither score is filled', () => {
      const onScoreChange = vi.fn();
      render(
        <MatchListCard
          game={game({ id: 302, isKnockout: true, stage: 'r16' })}
          now={NOW}
          onPick={noop}
          onScoreChange={onScoreChange}
        />,
      );
      expect(screen.queryByTestId('score-hint-302')).toBeNull();
      expect(screen.queryByText('Enter both scores to earn the bonus')).toBeNull();
    });
  });
});
