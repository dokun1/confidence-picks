import { describe, it, expect } from 'vitest';
import type { GroupData } from '../GroupCard/GroupCard';
import {
  filterGroups,
  activeFilterCount,
  hasActiveFilters,
  EMPTY_FILTERS,
  type GroupFilters,
} from './filterGroups';

function makeGroup(overrides: Partial<GroupData> = {}): GroupData {
  return {
    id: '1',
    name: 'Sunday Squad',
    identifier: 'sunday-squad',
    memberCount: 4,
    isOwner: false,
    createdAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

const OWNED_NFL = makeGroup({
  id: '1',
  name: 'Sunday Squad',
  identifier: 'sunday-squad',
  isOwner: true,
  poolType: 'nfl_weekly',
});
const MEMBER_NFL = makeGroup({
  id: '2',
  name: 'Monday Misfits',
  identifier: 'monday-misfits',
  isOwner: false,
  poolType: 'nfl_weekly',
});
const OWNED_WC = makeGroup({
  id: '3',
  name: 'World Cup Wizards',
  identifier: 'wc-wizards',
  isOwner: true,
  poolType: 'world_cup_2026',
});
const MEMBER_LEGACY = makeGroup({
  id: '4',
  name: 'Legacy Legends',
  identifier: 'legacy-legends',
  isOwner: false,
  poolType: null,
  description: 'An old NFL pool from before pool types existed.',
});

const ALL = [OWNED_NFL, MEMBER_NFL, OWNED_WC, MEMBER_LEGACY];

function withFilters(overrides: Partial<GroupFilters>): GroupFilters {
  return { ...EMPTY_FILTERS, ...overrides };
}

describe('filterGroups', () => {
  it('returns all groups when no filters are active', () => {
    expect(filterGroups(ALL, EMPTY_FILTERS)).toEqual(ALL);
  });

  it('returns only owned groups when owned is set', () => {
    const result = filterGroups(ALL, withFilters({ owned: true }));
    expect(result).toEqual([OWNED_NFL, OWNED_WC]);
  });

  it('returns only NFL groups when poolType is nfl_weekly', () => {
    const result = filterGroups(ALL, withFilters({ poolType: 'nfl_weekly' }));
    expect(result).toEqual([OWNED_NFL, MEMBER_NFL]);
  });

  it('returns only World Cup groups when poolType is world_cup_2026', () => {
    const result = filterGroups(ALL, withFilters({ poolType: 'world_cup_2026' }));
    expect(result).toEqual([OWNED_WC]);
  });

  it('combines owned and poolType with AND', () => {
    const result = filterGroups(ALL, withFilters({ owned: true, poolType: 'nfl_weekly' }));
    expect(result).toEqual([OWNED_NFL]);
  });

  it('matches search against the group name (case-insensitive)', () => {
    const result = filterGroups(ALL, withFilters({ search: 'monday' }));
    expect(result).toEqual([MEMBER_NFL]);
  });

  it('matches search against the identifier', () => {
    const result = filterGroups(ALL, withFilters({ search: 'wc-wiz' }));
    expect(result).toEqual([OWNED_WC]);
  });

  it('matches search against the description', () => {
    const result = filterGroups(ALL, withFilters({ search: 'before pool types' }));
    expect(result).toEqual([MEMBER_LEGACY]);
  });

  it('trims surrounding whitespace from the search term', () => {
    const result = filterGroups(ALL, withFilters({ search: '   wizards   ' }));
    expect(result).toEqual([OWNED_WC]);
  });

  it('returns an empty array when nothing matches the search', () => {
    expect(filterGroups(ALL, withFilters({ search: 'no-such-group' }))).toEqual([]);
  });

  it('combines search with filter selections', () => {
    // "s" matches Sunday Squad and World Cup Wizards by name/identifier, but
    // owned + nfl narrows it to Sunday Squad only.
    const result = filterGroups(
      ALL,
      withFilters({ search: 's', owned: true, poolType: 'nfl_weekly' })
    );
    expect(result).toEqual([OWNED_NFL]);
  });

  it('does not mutate the input array', () => {
    const input = [...ALL];
    filterGroups(input, withFilters({ owned: true }));
    expect(input).toEqual(ALL);
  });
});

describe('activeFilterCount', () => {
  it('is 0 for empty filters', () => {
    expect(activeFilterCount(EMPTY_FILTERS)).toBe(0);
  });

  it('counts owned', () => {
    expect(activeFilterCount(withFilters({ owned: true }))).toBe(1);
  });

  it('counts poolType', () => {
    expect(activeFilterCount(withFilters({ poolType: 'nfl_weekly' }))).toBe(1);
  });

  it('counts both owned and poolType', () => {
    expect(activeFilterCount(withFilters({ owned: true, poolType: 'world_cup_2026' }))).toBe(2);
  });

  it('ignores the free-text search', () => {
    expect(activeFilterCount(withFilters({ search: 'anything' }))).toBe(0);
  });
});

describe('hasActiveFilters', () => {
  it('is false for empty filters', () => {
    expect(hasActiveFilters(EMPTY_FILTERS)).toBe(false);
  });

  it('is false when only a search term is present', () => {
    expect(hasActiveFilters(withFilters({ search: 'foo' }))).toBe(false);
  });

  it('is true when owned is set', () => {
    expect(hasActiveFilters(withFilters({ owned: true }))).toBe(true);
  });

  it('is true when poolType is set', () => {
    expect(hasActiveFilters(withFilters({ poolType: 'nfl_weekly' }))).toBe(true);
  });
});
