import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { getMyGroups, leaveGroup, deleteGroup } from '../lib/groupsService.js';
import GroupsList from '../designsystem/components/GroupsList';
import type { GroupData } from '../designsystem/components/GroupCard/GroupCard';
import Button from '../designsystem/components/Button';

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
    <div className="min-h-screen bg-neutral-0 dark:bg-secondary-900">
      <div className="max-w-6xl mx-auto px-sm py-lg sm:px-lg space-y-lg">
        <header className="space-y-sm">
          <h1 className="text-3xl font-heading font-bold text-[var(--color-text-primary)]">
            My Groups
          </h1>
          <p className="text-[var(--color-text-secondary)]">
            Manage your confidence picks groups and track your performance.
          </p>
        </header>

        {loading ? (
          /* Loading state */
          <div className="flex justify-center items-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
            <span className="ml-3 text-[var(--color-text-secondary)]">Loading groups...</span>
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
            <p className="text-[var(--color-text-secondary)]">
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
          /* Populated state */
          <GroupsList
            groups={groups}
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
    </div>
  );
}
