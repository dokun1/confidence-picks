import Avatar from '../Avatar/Avatar';
import Button from '../Button/Button';

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
}: GroupCardProps) {
  return (
    <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm hover:shadow-md transition-shadow">
      {/* Header & Badges: stack on mobile, row on desktop */}
      <div className="flex flex-col mb-4">
        <h3
          className="text-lg font-semibold text-gray-900 mb-1 truncate sm:whitespace-normal leading-snug"
          style={{ wordBreak: 'keep-all', overflowWrap: 'break-word' }}
        >
          {group.name}
        </h3>
        <p
          className="text-sm text-gray-500 mb-2 break-all sm:break-normal"
          style={{ overflowWrap: 'anywhere' }}
        >
          ID: {group.identifier}
        </p>
        {group.description && (
          <p
            className="text-gray-600 text-sm mb-3 leading-snug line-clamp-3 sm:line-clamp-none"
            style={{ overflowWrap: 'break-word' }}
          >
            {group.description}
          </p>
        )}
        <div className="flex flex-row flex-wrap gap-2 mt-1">
          {group.isOwner ? (
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
              Owner
            </span>
          ) : (
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
              Member
            </span>
          )}
        </div>
      </div>

      {/* Meta row: stack items on mobile if needed */}
      <div className="flex flex-col xs:flex-row xs:justify-between xs:items-center mb-4 gap-1">
        <div className="text-sm text-gray-500 break-words">
          <span className="font-medium">{group.memberCount}</span> members
        </div>
        <div className="text-sm text-gray-500 break-words">
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
          <div className="text-xs text-gray-500">
            <span className="text-gray-600">Created by</span>{' '}
            <span className="font-medium text-gray-700">{group.createdByName}</span>
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
    </div>
  );
}
