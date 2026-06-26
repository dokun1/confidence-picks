import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { getMyGroups, leaveGroup, deleteGroup } from '../lib/groupsService.js';
import { getAllWorldCupStages, getMyWorldCupPicks } from '../lib/worldCupService.js';
import { peekCache, writeCache, wcCacheKeys } from '../lib/worldCupCache';
import { countNeedsPick } from '../lib/wcNeedsPick';
import type { WorldCupMatch } from '../lib/types';
import GroupsList from '../designsystem/components/GroupsList';
import type { GroupData } from '../designsystem/components/GroupCard/GroupCard';
import Button from '../designsystem/components/Button';
import PageContainer from '../designsystem/components/PageContainer';
import PageHeader from '../designsystem/components/PageHeader';
import Spinner from '../designsystem/components/Spinner';
import GroupsSearchFilter, {
  filterGroups,
  EMPTY_FILTERS,
  type GroupFilters,
} from '../designsystem/components/GroupsSearchFilter';

// Ported from GroupsPage.svelte (commit d6b2566^). Lists the signed-in user's
// groups via getMyGroups. Navigation lives in Layout, so this page never renders
// the nav itself and owns the single page <h1>. The four data states (loading,
// error, empty, populated) are handled here; GroupsList is rendered only once
// there are groups to show.

export default function GroupsPage() {
  const navigate = useNavigate();

  const [groups, setGroups] = useState<GroupData[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Per-group "you have picks to make" flags (World Cup pools), keyed by
  // identifier. Drives the notification dot on each card.
  const [needsPickByGroup, setNeedsPickByGroup] = useState<Record<string, boolean>>({});

  // Search + filter selections from the GroupsSearchFilter bar. Applied to the
  // loaded groups to produce the visible subset; an empty filter set shows all.
  const [filters, setFilters] = useState<GroupFilters>(EMPTY_FILTERS);
  const visibleGroups = useMemo(() => filterGroups(groups, filters), [groups, filters]);

  // Bumping refreshKey re-runs the load effect. reload() is a stable callback so
  // it can be handed to Retry / onRefresh without re-creating on every render.
  const [refreshKey, setRefreshKey] = useState(0);
  const reload = useCallback(() => setRefreshKey((k) => k + 1), []);

  useEffect(() => {
    let cancelled = false;

    async function fetchGroups() {
      setLoading(true);
      setError(null);
      try {
        const data = await getMyGroups();
        if (!cancelled) setGroups(data);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load groups');
          setGroups([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchGroups();
    return () => {
      cancelled = true;
    };
  }, [refreshKey]);

  // Compute the notification dot per World Cup group: reuse the SAME open/unpicked
  // rule the picks-tab "Needs pick" chip uses (countNeedsPick). The tournament
  // slate is fetched once and shared via the wc:stages cache; each group only
  // needs its own lightweight my-picks read. Best-effort — failures leave a card
  // without a dot rather than erroring the page.
  useEffect(() => {
    const wcGroups = groups.filter((g) => g.poolType === 'world_cup_2026');
    if (wcGroups.length === 0) {
      setNeedsPickByGroup({});
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        let matches = peekCache<WorldCupMatch[]>(wcCacheKeys.stages);
        if (matches === undefined) {
          const resp = await getAllWorldCupStages();
          matches = Array.isArray(resp?.games) ? resp.games : [];
          writeCache(wcCacheKeys.stages, matches);
        }
        const now = new Date();
        const entries = await Promise.all(
          wcGroups.map(async (g) => {
            try {
              const picksResp = await getMyWorldCupPicks(g.identifier);
              return [
                g.identifier,
                countNeedsPick(matches as WorldCupMatch[], picksResp?.picks, now, g.knockoutOnly ?? false) > 0,
              ] as const;
            } catch {
              return [g.identifier, false] as const;
            }
          }),
        );
        if (!cancelled) setNeedsPickByGroup(Object.fromEntries(entries));
      } catch {
        if (!cancelled) setNeedsPickByGroup({});
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [groups]);

  async function handleLeaveGroup(group: GroupData) {
    try {
      await leaveGroup(group.identifier);
      reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to leave group');
    }
  }

  async function handleDeleteGroup(group: GroupData) {
    if (!group.isOwner) return;
    try {
      await deleteGroup(group.identifier);
      reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete group');
    }
  }

  return (
    <PageContainer width="wide" className="space-y-lg">
        <PageHeader
          title="My Groups"
          description="Manage your confidence picks groups and track your performance."
        />

        {loading ? (
          /* Loading state */
          <div className="flex justify-center py-12">
            <Spinner size="md" label="Loading groups..." />
          </div>
        ) : error ? (
          /* Error state */
          <div className="p-md bg-error-50 dark:bg-error-900/20 border border-error-200 dark:border-error-800 rounded-base">
            <div className="flex items-center">
              <svg
                className="w-5 h-5 text-error-500 mr-sm"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              <div>
                <h3 className="font-semibold text-error-700 dark:text-error-400">
                  Error Loading Groups
                </h3>
                <p className="text-error-600 dark:text-error-300">{error}</p>
              </div>
            </div>
            <div className="mt-sm">
              <Button variant="secondary" size="sm" onClick={reload}>
                Retry
              </Button>
            </div>
          </div>
        ) : groups.length === 0 ? (
          /* Empty state */
          <div className="text-center py-12 space-y-md">
            <p className="text-content-muted">
              No groups yet — Create or Join one
            </p>
            <div className="flex flex-col sm:flex-row gap-sm justify-center">
              <Button variant="primary" onClick={() => navigate('/create-group')}>
                Create Group
              </Button>
              <Button variant="secondary" onClick={() => navigate('/join-group')}>
                Join Group
              </Button>
            </div>
          </div>
        ) : (
          /* Populated state: search/filter bar, then the (filtered) list. The
             Create/Join actions are rendered by GroupsList directly below the
             bar, matching the layout: my groups → search → create → join. */
          <div className="space-y-lg">
            {/* Sticky search + filter bar — pinned to the top of the viewport
                while the groups list scrolls beneath it, mirroring the World Cup
                picks page (see WorldCupGamesList). The negative margins bleed the
                backdrop out to the page gutters (Layout's px-sm/sm:px-lg) so cards
                never show through the gap as they scroll under it; the matching
                px re-pads the bar back to the column. z-10 keeps it above the
                cards; the filter popover (z-20, anchored inside the bar) still
                layers above it. */}
            <div className="sticky top-0 z-10 -mx-sm bg-neutral-0/95 px-sm py-xs backdrop-blur dark:bg-secondary-900/95 sm:-mx-lg sm:px-lg">
              <GroupsSearchFilter onChange={setFilters} />
            </div>

            {visibleGroups.length === 0 ? (
              <>
                <div className="flex flex-col sm:flex-row sm:justify-end gap-sm">
                  <Button variant="primary" onClick={() => navigate('/create-group')}>
                    Create Group
                  </Button>
                  <Button variant="secondary" onClick={() => navigate('/join-group')}>
                    Join Group
                  </Button>
                </div>
                <div className="text-center py-12">
                  <p className="text-content-muted">
                    No groups match your search or filters.
                  </p>
                </div>
              </>
            ) : (
              <GroupsList
                groups={visibleGroups}
                needsPickByGroup={needsPickByGroup}
                showHeader={false}
                onCreateNew={() => navigate('/create-group')}
                onJoinExisting={() => navigate('/join-group')}
                onViewGroup={(group) => navigate(`/group-details?group=${group.identifier}`)}
                onEditGroup={(group) => navigate(`/edit-group/${group.identifier}`)}
                onLeaveGroup={handleLeaveGroup}
                onDeleteGroup={handleDeleteGroup}
                onRefresh={reload}
              />
            )}
          </div>
        )}
    </PageContainer>
  );
}
