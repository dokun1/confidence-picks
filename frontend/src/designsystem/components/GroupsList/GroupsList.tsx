import GroupCard from '../GroupCard/GroupCard';
import type { GroupData } from '../GroupCard/GroupCard';
import Button from '../Button/Button';
import Spinner from '../Spinner/Spinner';
import EmptyState from '../EmptyState/EmptyState';

export interface GroupsListProps {
  /** Array of group objects to display. */
  groups?: GroupData[];
  /** Loading state while fetching groups. */
  isLoading?: boolean;
  /** Called when the user clicks "Create Group". */
  onCreateNew?: () => void;
  /** Called when the user clicks "Join Group". */
  onJoinExisting?: () => void;
  /** Called when a group's "View Group" action is triggered. */
  onViewGroup?: (group: GroupData) => void;
  /** Called when a group's "Edit" action is triggered. */
  onEditGroup?: (group: GroupData) => void;
  /** Called when a group's "Leave Group" action is triggered. */
  onLeaveGroup?: (group: GroupData) => void;
  /** Called when a group's "Delete" action is triggered. */
  onDeleteGroup?: (group: GroupData) => void;
  /** Called when the user clicks "Refresh". */
  onRefresh?: () => void;
  /** When false, hides the built-in header and subheader. */
  showHeader?: boolean;
}

/**
 * GroupsList renders the list of groups with header actions, loading spinner,
 * and empty state. Groups are displayed in a responsive 1–3 column grid using
 * GroupCard. Confirm logic for leaving a group lives here, matching the Svelte
 * source.
 */
export default function GroupsList({
  groups = [],
  isLoading = false,
  onCreateNew,
  onJoinExisting,
  onViewGroup,
  onEditGroup,
  onLeaveGroup,
  onDeleteGroup,
  onRefresh,
  showHeader = true,
}: GroupsListProps) {
  function handleViewGroup(group: GroupData) {
    onViewGroup?.(group);
  }

  function handleEditGroup(group: GroupData) {
    onEditGroup?.(group);
  }

  function handleLeaveGroup(group: GroupData) {
    if (confirm(`Are you sure you want to leave "${group.name}"?`)) {
      onLeaveGroup?.(group);
    }
  }

  function handleDeleteGroup(group: GroupData) {
    onDeleteGroup?.(group);
  }

  return (
    <div className="space-y-6">
      {/* Header / Actions */}
      {showHeader ? (
        <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-sm md:gap-0">
          <div className="order-1">
            <h1 className="text-2xl font-bold text-content">My Groups</h1>
            <p className="text-content-muted mt-1">Manage your confidence picks groups</p>
          </div>
          <div className="flex flex-col order-2 md:order-none md:flex-row md:space-x-3 gap-sm md:gap-0 w-full md:w-auto md:items-center mt-sm md:mt-0">
            <Button variant="primary" onClick={onCreateNew}>
              Create Group
            </Button>
            <Button variant="secondary" onClick={onJoinExisting}>
              Join Group
            </Button>
            <Button variant="secondary" size="sm" onClick={onRefresh} disabled={isLoading}>
              <svg
                className="w-4 h-4 mr-xs"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M16.023 9.348h4.992V4.356M2.985 14.652v4.992h4.992M19.207 15.6a8.25 8.25 0 01-14.64 2.474m-.774-9.574a8.25 8.25 0 0114.64-2.474"
                />
              </svg>
              Refresh
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex flex-col md:flex-row md:justify-end md:items-center gap-sm md:gap-3">
          <Button variant="primary" onClick={onCreateNew}>
            Create Group
          </Button>
          <Button variant="secondary" onClick={onJoinExisting}>
            Join Group
          </Button>
        </div>
      )}

      {/* Loading state */}
      {isLoading ? (
        <div className="flex justify-center py-12">
          <Spinner size="md" label="Loading groups..." />
        </div>
      ) : groups.length === 0 ? (
        /* Empty state */
        <EmptyState
          icon={
            <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
              />
            </svg>
          }
          title="No groups found"
          description="Get started by creating a new group or joining an existing one."
          action={
            <div className="flex flex-wrap justify-center gap-sm">
              <Button variant="primary" onClick={onCreateNew}>
                Create Your First Group
              </Button>
              <Button variant="secondary" onClick={onJoinExisting}>
                Join a Group
              </Button>
            </div>
          }
        />
      ) : (
        /* Groups list */
        <div className="groups-grid">
          {groups.map((group) => (
            <GroupCard
              key={group.id}
              group={group}
              onView={() => handleViewGroup(group)}
              onEdit={() => handleEditGroup(group)}
              onLeave={() => handleLeaveGroup(group)}
              onDelete={() => handleDeleteGroup(group)}
            />
          ))}
        </div>
      )}

      <style>{`
        .groups-grid { display: grid; gap: 1.5rem; grid-template-columns: 1fr; }
        @media (min-width: 860px) {
          .groups-grid { grid-template-columns: repeat(2, 1fr); }
        }
        @media (min-width: 1420px) {
          .groups-grid { grid-template-columns: repeat(3, 1fr); }
        }
      `}</style>
    </div>
  );
}
