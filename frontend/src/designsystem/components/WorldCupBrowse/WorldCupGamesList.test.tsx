import { render, screen, fireEvent } from '@testing-library/react';
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

  it('filters games by World Cup group via the group dropdown', () => {
    const groupD = game({
      id: 1,
      home: team('USA', 'United States'), away: team('PAR', 'Paraguay'),
      wcGroup: 'D',
    });
    const groupA = game({
      id: 2,
      home: team('MEX', 'Mexico'), away: team('ECU', 'Ecuador'),
      wcGroup: 'A',
    });
    render(
      <WorldCupGamesList
        games={[groupD, groupA]}
        now={NOW}
        onPick={() => {}}
      />,
    );

    // Open the filters panel.
    fireEvent.click(screen.getByRole('button', { name: 'Filters' }));

    // Find the group dropdown by locating the combobox whose options include group letters.
    const selects = screen.getAllByRole('combobox');
    const groupDropdown = selects.find((s) =>
      Array.from((s as HTMLSelectElement).options).some((o) => o.value === 'D'),
    )!;
    fireEvent.change(groupDropdown, { target: { value: 'D' } });

    // Only the Group D game (USA vs PAR) should be visible.
    expect(screen.getByTestId('match-card-1')).toBeInTheDocument();
    expect(screen.queryByTestId('match-card-2')).toBeNull();

    // Resetting to "Any group" restores both.
    fireEvent.change(groupDropdown, { target: { value: '' } });
    expect(screen.getByTestId('match-card-1')).toBeInTheDocument();
    expect(screen.getByTestId('match-card-2')).toBeInTheDocument();
  });

  it('clears the search via the clear button, restoring the unfiltered list', () => {
    const mex = game({ id: 1, home: team('MEX', 'Mexico'), away: team('CAN', 'Canada') });
    const bra = game({ id: 2, home: team('BRA', 'Brazil'), away: team('ARG', 'Argentina') });
    render(<WorldCupGamesList games={[mex, bra]} now={NOW} onPick={() => {}} />);

    // No clear button until there's a query.
    expect(screen.queryByRole('button', { name: 'Clear search' })).toBeNull();

    const search = screen.getByPlaceholderText('Search teams…');
    fireEvent.change(search, { target: { value: 'BRA' } });
    expect(screen.getByTestId('match-card-2')).toBeInTheDocument();
    expect(screen.queryByTestId('match-card-1')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Clear search' }));
    expect(search).toHaveValue('');
    expect(screen.getByTestId('match-card-1')).toBeInTheDocument();
    expect(screen.getByTestId('match-card-2')).toBeInTheDocument();
  });
});
