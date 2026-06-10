import { useEffect, useRef, useState } from 'react';
import { FunnelIcon } from '@heroicons/react/24/outline';
import { CheckIcon } from '@heroicons/react/24/solid';
import TextField from '../TextField';
import {
  EMPTY_FILTERS,
  activeFilterCount,
  type GroupFilters,
  type PoolTypeFilter,
} from './filterGroups';

/** Default debounce, in ms, applied to the free-text search before it is
 * surfaced to `onChange`. Exported so tests can advance timers precisely. */
export const SEARCH_DEBOUNCE_MS = 750;

export interface GroupsSearchFilterProps {
  /** Called with the effective filters whenever they change. Search changes
   * are debounced (see `debounceMs`); filter selections fire immediately. */
  onChange: (filters: GroupFilters) => void;
  /** Initial filter state. Defaults to "no filters". */
  initialFilters?: GroupFilters;
  /** Debounce window for the search field. Defaults to 750ms. */
  debounceMs?: number;
}

const POOL_OPTIONS: { value: PoolTypeFilter; label: string }[] = [
  { value: 'nfl_weekly', label: 'NFL Picks' },
  { value: 'world_cup_2026', label: 'World Cup 2026 Picks' },
];

/**
 * Search + filter bar for the groups list.
 *
 * Layout (horizontal): a search text field followed by a small square icon
 * button that opens a filter popover. The popover offers a "Groups I own"
 * toggle and a single-select "Pick type" section (NFL / World Cup). When any
 * filter is active the icon button shows a count badge.
 *
 * Free-text search is debounced (`debounceMs`, default 750ms) so typing only
 * filters once the user pauses; tapping a filter option applies immediately.
 */
export default function GroupsSearchFilter({
  onChange,
  initialFilters = EMPTY_FILTERS,
  debounceMs = SEARCH_DEBOUNCE_MS,
}: GroupsSearchFilterProps) {
  // Live text bound to the input (updates every keystroke).
  const [searchInput, setSearchInput] = useState(initialFilters.search);
  // Filter selections are applied immediately, no debounce.
  const [owned, setOwned] = useState(initialFilters.owned);
  const [poolType, setPoolType] = useState<PoolTypeFilter | null>(initialFilters.poolType);
  const [open, setOpen] = useState(false);

  const rootRef = useRef<HTMLDivElement>(null);

  // Keep the latest onChange without making it an effect dependency, so a
  // parent passing an inline callback doesn't re-fire the debounce on render.
  const onChangeRef = useRef(onChange);
  useEffect(() => {
    onChangeRef.current = onChange;
  });

  // Debounce the search term. The timer resets on every keystroke; the
  // committed value only lands once typing pauses for `debounceMs`.
  const [debouncedSearch, setDebouncedSearch] = useState(initialFilters.search);
  useEffect(() => {
    const id = setTimeout(() => setDebouncedSearch(searchInput), debounceMs);
    return () => clearTimeout(id);
  }, [searchInput, debounceMs]);

  // Emit whenever the committed (debounced) search or a filter selection
  // changes. Filter toggles bypass the debounce because they are not in the
  // debounce timer's path.
  useEffect(() => {
    onChangeRef.current({ search: debouncedSearch.trim(), owned, poolType });
  }, [debouncedSearch, owned, poolType]);

  // Close the popover on outside click or Escape.
  useEffect(() => {
    if (!open) return;
    function handleDown(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    }
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', handleDown);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handleDown);
      document.removeEventListener('keydown', handleKey);
    };
  }, [open]);

  function selectPool(value: PoolTypeFilter) {
    // Re-tapping the active option clears it (returns to "any pool").
    setPoolType((current) => (current === value ? null : value));
  }

  function clearAll() {
    setOwned(false);
    setPoolType(null);
  }

  const count = activeFilterCount({ search: debouncedSearch, owned, poolType });
  const hasActive = count > 0;

  const filterButtonClasses = [
    'relative inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-base border',
    'transition-all duration-normal ease-smooth focus:outline-none focus:ring-2 focus:ring-offset-2',
    hasActive
      ? 'bg-primary-50 border-primary-500 text-primary-600 focus:ring-primary-500 dark:bg-primary-900/30 dark:border-primary-400 dark:text-primary-300'
      : 'bg-secondary-100 border-secondary-300 text-secondary-700 hover:bg-secondary-200 focus:ring-secondary-500 dark:bg-secondary-800 dark:border-secondary-600 dark:text-secondary-200 dark:hover:bg-secondary-700',
  ].join(' ');

  return (
    <div ref={rootRef} className="relative flex items-center gap-sm">
      <div className="flex-1">
        <TextField
          value={searchInput}
          onChange={setSearchInput}
          placeholder="Search groups…"
        />
      </div>

      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={filterButtonClasses}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={hasActive ? `Filters (${count} active)` : 'Filters'}
      >
        <FunnelIcon className="h-5 w-5" aria-hidden="true" />
        {hasActive && (
          <span
            data-testid="filter-badge"
            className="absolute -right-1.5 -top-1.5 flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-primary-600 px-1 text-xs font-semibold leading-none text-neutral-0"
          >
            {count}
          </span>
        )}
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="Filter groups"
          className="absolute right-0 top-full z-20 mt-xs w-64 rounded-md border border-secondary-200 bg-neutral-0 p-sm shadow-md dark:border-secondary-700 dark:bg-secondary-800"
        >
          {/* Ownership */}
          <label className="flex cursor-pointer items-center gap-xs rounded-base px-xs py-xs text-sm hover:bg-secondary-50 dark:hover:bg-secondary-700">
            <input
              type="checkbox"
              checked={owned}
              onChange={(e) => setOwned(e.target.checked)}
              className="h-4 w-4"
            />
            <span className="text-[var(--color-text-primary)]">Groups I own</span>
          </label>

          {/* Pick type — single select */}
          <div className="mt-xs border-t border-secondary-200 pt-xs dark:border-secondary-700">
            <p className="px-xs pb-xxs text-xs font-semibold uppercase tracking-wide text-[var(--color-text-secondary)]">
              Pick type
            </p>
            <ul role="radiogroup" aria-label="Pick type" className="space-y-xxs">
              {POOL_OPTIONS.map((option) => {
                const selected = poolType === option.value;
                return (
                  <li key={option.value}>
                    <button
                      type="button"
                      role="radio"
                      aria-checked={selected}
                      onClick={() => selectPool(option.value)}
                      className={`flex w-full items-center justify-between rounded-base px-xs py-xs text-left text-sm transition-colors ${
                        selected
                          ? 'bg-primary-50 text-primary-700 dark:bg-primary-900/30 dark:text-primary-200'
                          : 'text-[var(--color-text-primary)] hover:bg-secondary-50 dark:hover:bg-secondary-700'
                      }`}
                    >
                      <span>{option.label}</span>
                      {selected && <CheckIcon className="h-4 w-4 text-primary-600 dark:text-primary-300" aria-hidden="true" />}
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>

          {hasActive && (
            <div className="mt-xs border-t border-secondary-200 pt-xs text-right dark:border-secondary-700">
              <button
                type="button"
                onClick={clearAll}
                className="text-xs font-medium text-primary-600 hover:underline dark:text-primary-400"
              >
                Clear filters
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
