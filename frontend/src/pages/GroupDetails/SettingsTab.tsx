import type { GroupDetail, GroupMember } from '../../lib/groupsService';

export interface SettingsTabProps {
  /** The group whose settings are shown; drives name/description fields. */
  group: GroupDetail;
  /** Owner sees Edit + Delete; member sees Leave. Drive UI from this. */
  isOwner: boolean;
  /** Group identifier, used for invite-link creation and leave/delete actions. */
  identifier: string;
  /** Current members, shown in the settings roster. */
  members: GroupMember[];
}

/**
 * SettingsTab renders invite-link creation, copy-link UI, and the owner/member
 * leave-or-delete action behind ConfirmDeleteModal. Body is deferred to the
 * settings implementation task — this stub declares the final prop contract so
 * the page compiles.
 */
export default function SettingsTab(props: SettingsTabProps) {
  return (
    <div className='rounded-md border border-border bg-surface p-lg'>
      <h2 className='text-lg font-semibold'>Settings</h2>
      <p className='text-secondary'>Settings coming soon</p>
    </div>
  );
}
