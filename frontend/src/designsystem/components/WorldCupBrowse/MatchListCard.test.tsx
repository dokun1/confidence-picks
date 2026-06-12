import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
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
});
