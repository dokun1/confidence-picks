import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import WorldCupGamesList from './WorldCupGamesList';
import type { BrowseGame, BrowseTeam } from '../../../lib/wcGamesView';

const NOW = new Date('2026-06-12T16:00:00');

const team = (abbr: string, name: string): BrowseTeam => ({ abbr, name, logo: '' });

function game(over: Partial<BrowseGame> = {}): BrowseGame {
  return {
    id: 1, espnId: 'e1', stage: 'group', stageLabel: 'Group Stage',
    kickoff: '2026-06-12T20:00:00', // same day as NOW
    home: team('MEX', 'Mexico'), away: team('CAN', 'Canada'),
    status: 'SCHEDULED', isKnockout: false,
    ...over,
  };
}

describe('WorldCupGamesList', () => {
  it("defaults to the Today view — only today's games are listed", () => {
    const today = game({ id: 1, kickoff: '2026-06-12T20:00:00' });
    const tomorrow = game({
      id: 2, kickoff: '2026-06-13T20:00:00',
      home: team('BRA', 'Brazil'), away: team('ARG', 'Argentina'),
    });
    render(<WorldCupGamesList games={[today, tomorrow]} now={NOW} onPick={() => {}} />);
    expect(screen.getByRole('button', { name: 'Today' })).toBeInTheDocument();
    expect(screen.getByTestId('match-card-1')).toBeInTheDocument();
    // Tomorrow's game is filtered out by the default Today view.
    expect(screen.queryByTestId('match-card-2')).toBeNull();
  });
});
