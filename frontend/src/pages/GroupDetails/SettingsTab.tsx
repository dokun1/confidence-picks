import { useState } from 'react';
import Avatar from '../../designsystem/components/Avatar';
import Button from '../../designsystem/components/Button';
import { createLinkInvite } from '../../lib/invitesService.js';
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
  const { members, identifier } = props;

  const [joinUrl, setJoinUrl] = useState<string | null>(null);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [creatingInvite, setCreatingInvite] = useState(false);

  async function handleCreateInvite() {
    setInviteError(null);
    setCreatingInvite(true);
    try {
      const invite = await createLinkInvite(identifier);
      setJoinUrl(invite.joinUrl);
    } catch (err) {
      setInviteError(err instanceof Error ? err.message : 'Failed to create invite');
    } finally {
      setCreatingInvite(false);
    }
  }

  function handleCopy() {
    if (joinUrl) {
      navigator.clipboard.writeText(joinUrl);
    }
  }

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

      {/* Invite link */}
      <section className='rounded-md border border-border bg-surface p-lg'>
        <h2 className='text-lg font-semibold mb-lg'>Invite Link</h2>
        <Button variant='secondary' onClick={handleCreateInvite} loading={creatingInvite} disabled={creatingInvite}>
          {creatingInvite ? 'Preparing…' : 'Create Invite Link'}
        </Button>
        {joinUrl && (
          <div className='mt-md flex items-center gap-md'>
            <input
              type='text'
              readOnly
              value={joinUrl}
              className='min-w-0 flex-1 rounded-base border border-border bg-surface px-md py-xs text-sm'
              onFocus={event => event.currentTarget.select()}
            />
            <Button variant='tertiary' onClick={handleCopy}>
              Copy
            </Button>
          </div>
        )}
        {inviteError && (
          <p className='mt-md text-sm text-error-600 dark:text-error-400'>{inviteError}</p>
        )}
      </section>

      {/* Owner/member actions: Edit + Delete (owner) or Leave (member) behind
          ConfirmDeleteModal, driven by isOwner — added by the actions sub-task. */}
    </div>
  );
}
