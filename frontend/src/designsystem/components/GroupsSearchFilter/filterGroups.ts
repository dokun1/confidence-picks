import type { GroupData } from '../GroupCard/GroupCard';

// Pool flavors a group can be filtered by. Mirrors GroupData['poolType']
// minus the legacy `null`, since "no pool type" is never something a user
// explicitly filters *for* — it just means "show everything".
export type PoolTypeFilter = 'nfl_weekly' | 'world_cup_2026';

/**
 * The full set of filters the GroupsSearchFilter bar can produce.
 *
 * - `search`  free-text query matched against a group's name, identifier and
 *             description (case-insensitive, substring).
 * - `owned`   when true, restrict to groups the user owns (isOwner).
 * - `poolType`single-select pool flavor; `null` means "any pool".
 *
 * When `owned` is false, `poolType` is null and `search` is empty the filters
 * are a no-op and every group passes — matching the "if none are selected,
 * show all" requirement.
 */
export interface GroupFilters {
  search: string;
  owned: boolean;
  poolType: PoolTypeFilter | null;
}

export const EMPTY_FILTERS: GroupFilters = {
  search: '',
  owned: false,
  poolType: null,
};

/**
 * Number of *filter* selections currently active. Deliberately excludes the
 * free-text search — the filter button's badge reflects the choices made in
 * the filter popover, while the search term lives in (and is cleared from)
 * the text field itself.
 */
export function activeFilterCount(filters: GroupFilters): number {
  let count = 0;
  if (filters.owned) count += 1;
  if (filters.poolType) count += 1;
  return count;
}

/** True when any filter selection is active (ignoring free-text search). */
export function hasActiveFilters(filters: GroupFilters): boolean {
  return activeFilterCount(filters) > 0;
}

/**
 * Apply the search + filter selections to a list of groups, returning a new
 * array of the matches. Pure and side-effect free so it can be unit tested in
 * isolation and reused anywhere groups are displayed.
 *
 * All active criteria are combined with AND. The search term matches as a
 * case-insensitive substring of the group's name, identifier, or description.
 */
export function filterGroups(groups: GroupData[], filters: GroupFilters): GroupData[] {
  const query = filters.search.trim().toLowerCase();

  return groups.filter((group) => {
    if (filters.owned && !group.isOwner) return false;
    if (filters.poolType && group.poolType !== filters.poolType) return false;

    if (query) {
      const haystack = [group.name, group.identifier, group.description ?? '']
        .join(' ')
        .toLowerCase();
      if (!haystack.includes(query)) return false;
    }

    return true;
  });
}
