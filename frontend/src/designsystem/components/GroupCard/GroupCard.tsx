import Avatar from '../Avatar/Avatar';
import Button from '../Button/Button';
import Card from '../Card/Card';
import NotificationDot from '../NotificationDot/NotificationDot';

export interface GroupData {
  id: string;
  name: string;
  identifier: string;
  description?: string;
  memberCount: number;
  isOwner: boolean;
  createdAt: string;
  createdByName?: string;
  createdByPictureUrl?: string | null;
  // Pool flavor — 'nfl_weekly' | 'world_cup_2026' | null for legacy groups
  // predating #86. Forwarded by groupsService.getMyGroups so callers can
  // partition by pool type.
  poolType?: 'nfl_weekly' | 'world_cup_2026' | null;
}

export interface GroupCardProps {
  /** Group data to display. */
  group: GroupData;
  /** Called when the user clicks "View Group". */
  onView?: () => void;
  /** Called when the owner clicks "Edit". */
  onEdit?: () => void;
  /** Called when a member clicks "Leave Group". */
  onLeave?: () => void;
  /** Called when the owner clicks "Delete". */
  onDelete?: () => void;
  /**
   * When true, shows a red notification dot (same affordance as the Chat tab's
   * unread indicator) signalling the viewer has picks waiting to be made in this
   * group. Computed by the groups list from the pool's open/unpicked matches.
   */
  hasPicksToMake?: boolean;
}

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString();
}

/**
 * GroupCard displays a group's summary information with contextual actions.
 *
 * Owners see Edit and Delete actions; members see a Leave action.
 * When the group was created by someone other than the current user,
 * the creator's avatar and name are shown.
 */
export default function GroupCard({
  group,
  onView,
  onEdit,
  onLeave,
  onDelete,
  hasPicksToMake = false,
}: GroupCardProps) {
  return (
    <Card padding="lg" className="relative hover:shadow-md transition-shadow">
      {hasPicksToMake && (
        <NotificationDot
          size="md"
          label="Picks available to make"
          className="absolute right-3 top-3 ring-2 ring-neutral-0 dark:ring-secondary-800"
        />
      )}
      {/* Header & Badges: stack on mobile, row on desktop */}
      <div className="flex flex-col mb-4">
        <h3
          className="text-lg font-semibold text-secondary-900 dark:text-secondary-50 mb-1 truncate sm:whitespace-normal leading-snug"
          style={{ wordBreak: 'keep-all', overflowWrap: 'break-word' }}
        >
          {group.name}
        </h3>
        <p
          className="text-sm text-secondary-500 dark:text-secondary-400 mb-2 break-all sm:break-normal"
          style={{ overflowWrap: 'anywhere' }}
        >
          ID: {group.identifier}
        </p>
        {group.description && (
          <p
            className="text-secondary-600 dark:text-secondary-300 text-sm mb-3 leading-snug line-clamp-3 sm:line-clamp-none"
            style={{ overflowWrap: 'break-word' }}
          >
            {group.description}
          </p>
        )}
        <div className="flex flex-row flex-wrap gap-2 mt-1">
          {group.isOwner ? (
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-accent-subtle text-accent-on-subtle">
              Owner
            </span>
          ) : (
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-success-100 text-success-800 dark:bg-success-900 dark:text-success-300">
              Member
            </span>
          )}
        </div>
      </div>

      {/* Meta row: stack items on mobile if needed */}
      <div className="flex flex-col xs:flex-row xs:justify-between xs:items-center mb-4 gap-1">
        <div className="text-sm text-secondary-500 dark:text-secondary-400 break-words">
          <span className="font-medium">{group.memberCount}</span> members
        </div>
        <div className="text-sm text-secondary-500 dark:text-secondary-400 break-words">
          Created {formatDate(group.createdAt)}
        </div>
      </div>

      {group.createdByName && !group.isOwner && (
        <div className="flex items-center gap-2 mb-4">
          <Avatar
            name={group.createdByName}
            pictureUrl={group.createdByPictureUrl}
            variant="sm"
          />
          <div className="text-xs text-secondary-500 dark:text-secondary-400">
            <span className="text-secondary-600 dark:text-secondary-300">Created by</span>{' '}
            <span className="font-medium text-secondary-700 dark:text-secondary-200">{group.createdByName}</span>
          </div>
        </div>
      )}

      {/* Actions: vertical stack mobile, horizontal desktop */}
      <div className="flex flex-col gap-2">
        <Button variant="primary" size="sm" className="w-full" onClick={onView}>
          View Group
        </Button>
        {group.isOwner ? (
          <>
            <Button variant="secondary" size="sm" className="w-full" onClick={onEdit}>
              Edit
            </Button>
            <Button variant="destructive" size="sm" className="w-full" onClick={onDelete}>
              Delete
            </Button>
          </>
        ) : (
          <Button variant="tertiary" size="sm" className="w-full" onClick={onLeave}>
            Leave Group
          </Button>
        )}
      </div>
    </Card>
  );
}
