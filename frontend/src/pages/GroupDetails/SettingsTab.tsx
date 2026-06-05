import Avatar from '../../designsystem/components/Avatar';
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
 * SettingsTab renders the member roster plus (added by following sub-tasks)
 * invite-link creation, copy-link UI, and the owner/member leave-or-delete
 * action behind ConfirmDeleteModal. Sections are stacked vertically so later
 * sub-tasks can slot in without restructuring.
 */
export default function SettingsTab(props: SettingsTabProps) {
  const { members } = props;

  return (
    <div className='space-y-lg'>
      {/* Member roster */}
      <section className='rounded-md border border-border bg-surface p-lg'>
        <h2 className='text-lg font-semibold mb-lg'>Members</h2>
        {members.length === 0 ? (
          <p className='text-secondary'>No members yet.</p>
        ) : (
          <div className='space-y-md'>
            {members.map(member => (
              <div key={member.id} className='flex items-center gap-md'>
                <Avatar name={member.name} pictureUrl={member.pictureUrl} />
                <div className='min-w-0 flex-1'>
                  <div className='flex items-center gap-md'>
                    <span className='font-medium'>{member.name}</span>
                    {member.isOwner && (
                      <span className='inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800'>
                        Owner
                      </span>
                    )}
                  </div>
                  <p className='text-sm text-secondary truncate'>{member.email}</p>
                </div>
                <span className='text-xs text-secondary whitespace-nowrap'>
                  Joined {new Date(member.joinedAt).toLocaleDateString()}
                </span>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Invite link: createLinkInvite + copy-link UI — added by the next sub-task. */}

      {/* Owner/member actions: Edit + Delete (owner) or Leave (member) behind
          ConfirmDeleteModal, driven by isOwner — added by the actions sub-task. */}
    </div>
  );
}
