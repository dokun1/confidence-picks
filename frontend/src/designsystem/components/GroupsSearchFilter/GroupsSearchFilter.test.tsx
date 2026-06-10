import { render, screen, fireEvent, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import GroupsSearchFilter, { SEARCH_DEBOUNCE_MS } from './GroupsSearchFilter';

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  // Flush the mount-scheduled debounce timer inside act() so its state update
  // doesn't trip React's "not wrapped in act(...)" warning.
  act(() => {
    vi.runOnlyPendingTimers();
  });
  vi.useRealTimers();
});

function setup() {
  const onChange = vi.fn();
  render(<GroupsSearchFilter onChange={onChange} />);
  return { onChange };
}

function typeSearch(value: string) {
  const input = screen.getByPlaceholderText(/search groups/i);
  fireEvent.change(input, { target: { value } });
}

function openFilters() {
  fireEvent.click(screen.getByRole('button', { name: /filters/i }));
}

function advance(ms: number) {
  act(() => {
    vi.advanceTimersByTime(ms);
  });
}

describe('GroupsSearchFilter', () => {
  it('emits the empty filter set on mount', () => {
    const { onChange } = setup();
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenLastCalledWith({ search: '', owned: false, poolType: null });
  });

  describe('search debounce', () => {
    it('does not emit the new search before the debounce elapses', () => {
      const { onChange } = setup();
      onChange.mockClear();

      typeSearch('squad');
      advance(SEARCH_DEBOUNCE_MS - 1);

      expect(onChange).not.toHaveBeenCalled();
    });

    it('emits the trimmed search once the debounce elapses', () => {
      const { onChange } = setup();
      onChange.mockClear();

      typeSearch('squad');
      advance(SEARCH_DEBOUNCE_MS);

      expect(onChange).toHaveBeenCalledTimes(1);
      expect(onChange).toHaveBeenLastCalledWith({ search: 'squad', owned: false, poolType: null });
    });

    it('resets the timer on each keystroke and only emits the final value', () => {
      const { onChange } = setup();
      onChange.mockClear();

      typeSearch('sun');
      advance(400);
      typeSearch('sunday'); // resets the 750ms window
      advance(400);
      expect(onChange).not.toHaveBeenCalled(); // 400ms < 750ms since last keystroke

      advance(SEARCH_DEBOUNCE_MS - 400);
      expect(onChange).toHaveBeenCalledTimes(1);
      expect(onChange).toHaveBeenLastCalledWith({ search: 'sunday', owned: false, poolType: null });
    });
  });

  describe('filter selections (immediate)', () => {
    it('emits immediately when "Groups I own" is toggled, without waiting for the debounce', () => {
      const { onChange } = setup();
      onChange.mockClear();

      openFilters();
      fireEvent.click(screen.getByRole('checkbox', { name: /groups i own/i }));

      expect(onChange).toHaveBeenCalledTimes(1);
      expect(onChange).toHaveBeenLastCalledWith({ search: '', owned: true, poolType: null });
    });

    it('emits immediately when a pick type is selected', () => {
      const { onChange } = setup();
      onChange.mockClear();

      openFilters();
      fireEvent.click(screen.getByRole('radio', { name: 'NFL Picks' }));

      expect(onChange).toHaveBeenLastCalledWith({
        search: '',
        owned: false,
        poolType: 'nfl_weekly',
      });
    });

    it('allows only one pick type at a time (single-select)', () => {
      const { onChange } = setup();
      openFilters();

      fireEvent.click(screen.getByRole('radio', { name: 'NFL Picks' }));
      expect(onChange).toHaveBeenLastCalledWith(
        expect.objectContaining({ poolType: 'nfl_weekly' })
      );

      fireEvent.click(screen.getByRole('radio', { name: 'World Cup 2026 Picks' }));
      expect(onChange).toHaveBeenLastCalledWith(
        expect.objectContaining({ poolType: 'world_cup_2026' })
      );

      // The two options are mutually exclusive in the DOM too.
      expect(screen.getByRole('radio', { name: 'NFL Picks' })).toHaveAttribute(
        'aria-checked',
        'false'
      );
      expect(screen.getByRole('radio', { name: 'World Cup 2026 Picks' })).toHaveAttribute(
        'aria-checked',
        'true'
      );
    });

    it('clears the pick type when the selected option is tapped again', () => {
      const { onChange } = setup();
      openFilters();

      fireEvent.click(screen.getByRole('radio', { name: 'NFL Picks' }));
      fireEvent.click(screen.getByRole('radio', { name: 'NFL Picks' }));

      expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ poolType: null }));
    });
  });

  describe('active-filter indicator', () => {
    it('shows no badge when no filters are active', () => {
      setup();
      expect(screen.queryByTestId('filter-badge')).toBeNull();
      expect(screen.getByRole('button', { name: 'Filters' })).toBeInTheDocument();
    });

    it('shows a badge with the active filter count', () => {
      setup();
      openFilters();

      fireEvent.click(screen.getByRole('checkbox', { name: /groups i own/i }));
      expect(screen.getByTestId('filter-badge')).toHaveTextContent('1');

      fireEvent.click(screen.getByRole('radio', { name: 'NFL Picks' }));
      expect(screen.getByTestId('filter-badge')).toHaveTextContent('2');
      expect(screen.getByRole('button', { name: 'Filters (2 active)' })).toBeInTheDocument();
    });

    it('does not count the free-text search toward the badge', () => {
      setup();
      typeSearch('squad');
      advance(SEARCH_DEBOUNCE_MS);
      expect(screen.queryByTestId('filter-badge')).toBeNull();
    });

    it('clears all filters via "Clear filters"', () => {
      const { onChange } = setup();
      openFilters();
      fireEvent.click(screen.getByRole('checkbox', { name: /groups i own/i }));
      fireEvent.click(screen.getByRole('radio', { name: 'NFL Picks' }));

      fireEvent.click(screen.getByRole('button', { name: /clear filters/i }));

      expect(onChange).toHaveBeenLastCalledWith({ search: '', owned: false, poolType: null });
      expect(screen.queryByTestId('filter-badge')).toBeNull();
    });
  });

  describe('popover open/close', () => {
    it('opens the filter popover when the icon button is clicked', () => {
      setup();
      expect(screen.queryByRole('dialog')).toBeNull();
      openFilters();
      expect(screen.getByRole('dialog', { name: /filter groups/i })).toBeInTheDocument();
    });

    it('closes the popover on Escape', () => {
      setup();
      openFilters();
      fireEvent.keyDown(document, { key: 'Escape' });
      expect(screen.queryByRole('dialog')).toBeNull();
    });
  });
});
