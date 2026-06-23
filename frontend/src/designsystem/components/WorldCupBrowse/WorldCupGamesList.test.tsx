import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, afterEach } from 'vitest';
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

  it('opens on the initialView when given one (deeplink to "Needs pick")', () => {
    // A tomorrow game would be hidden by the default Today view; opening on
    // needs-pick (open + unpicked) surfaces it, proving initialView is honored.
    const tomorrow = game({ id: 2, kickoff: '2026-06-13T20:00:00' });
    render(
      <WorldCupGamesList games={[tomorrow]} now={NOW} onPick={() => {}} initialView="needs-pick" />,
    );
    expect(screen.getByRole('button', { name: /Needs pick/i })).toHaveClass('bg-accent');
    expect(screen.getByTestId('match-card-2')).toBeInTheDocument();
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

  describe('sticky controls + scroll re-anchoring on filter change', () => {
    afterEach(() => {
      vi.restoreAllMocks();
    });

    it('keeps the search box and view chips in a sticky, pinned container', () => {
      const today = game({ id: 1 });
      const { container } = render(
        <WorldCupGamesList games={[today]} now={NOW} onPick={() => {}} />,
      );
      // The search input and the view chips share one sticky, top-pinned wrapper
      // so they stay visible as the match list scrolls beneath them.
      const sticky = container.querySelector('.sticky');
      expect(sticky).not.toBeNull();
      expect(sticky?.className).toContain('top-0');
      expect(sticky).toContainElement(screen.getByPlaceholderText('Search teams…'));
      expect(sticky).toContainElement(screen.getByRole('button', { name: 'All' }));
    });

    it('re-anchors to the list when a filter changes after scrolling past it', () => {
      const today = game({ id: 1 });
      const tomorrow = game({
        id: 2, kickoff: '2026-06-13T20:00:00',
        home: team('BRA', 'Brazil'), away: team('ARG', 'Argentina'),
      });
      render(<WorldCupGamesList games={[today, tomorrow]} now={NOW} onPick={() => {}} />);

      const region = screen.getByTestId('games-list-region');
      // Simulate the list having scrolled up behind the sticky header.
      vi.spyOn(region, 'getBoundingClientRect').mockReturnValue({ top: -400 } as DOMRect);
      const scrollIntoView = vi.spyOn(region, 'scrollIntoView');

      // Switch the view — content changes, and since we're scrolled past the
      // list top, the scroll is re-anchored to the start of the new results.
      fireEvent.click(screen.getByRole('button', { name: 'All' }));
      expect(scrollIntoView).toHaveBeenCalledWith({ block: 'start' });
    });

    it('leaves the scroll alone when the list top is already on screen', () => {
      const today = game({ id: 1 });
      const tomorrow = game({
        id: 2, kickoff: '2026-06-13T20:00:00',
        home: team('BRA', 'Brazil'), away: team('ARG', 'Argentina'),
      });
      render(<WorldCupGamesList games={[today, tomorrow]} now={NOW} onPick={() => {}} />);

      const region = screen.getByTestId('games-list-region');
      // List top is still below the (zero-height in jsdom) sticky header.
      vi.spyOn(region, 'getBoundingClientRect').mockReturnValue({ top: 120 } as DOMRect);
      const scrollIntoView = vi.spyOn(region, 'scrollIntoView');

      fireEvent.click(screen.getByRole('button', { name: 'All' }));
      expect(scrollIntoView).not.toHaveBeenCalled();
    });
  });
});
