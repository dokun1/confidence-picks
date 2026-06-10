import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Avatar from '../../designsystem/components/Avatar';
import Button from '../../designsystem/components/Button';
import { ConfirmDeleteModal } from '../../designsystem/components/Modal';
import { createLinkInvite } from '../../lib/invitesService.js';
import { deleteGroup, leaveGroup } from '../../lib/groupsService.js';
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
  const { members, identifier, isOwner } = props;
  const navigate = useNavigate();

  const [joinUrl, setJoinUrl] = useState<string | null>(null);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [creatingInvite, setCreatingInvite] = useState(false);

  // Discriminated modal state: which action the shared ConfirmDeleteModal confirms.
  const [confirmAction, setConfirmAction] = useState<'delete' | 'leave' | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

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

  function closeConfirm() {
    if (!actionLoading) {
      setConfirmAction(null);
    }
  }

  async function handleConfirmAction() {
    setActionLoading(true);
    try {
      if (confirmAction === 'delete') {
        await deleteGroup(identifier);
      } else {
        await leaveGroup(identifier);
      }
      navigate('/groups');
    } finally {
      setActionLoading(false);
    }
  }

  const confirmCopy =
    confirmAction === 'delete'
      ? {
          title: 'Delete Group?',
          body: 'This permanently deletes the group and all its picks, messages, and members. This cannot be undone.',
          confirmLabel: 'Delete Group',
        }
      : {
          title: 'Leave Group?',
          body: 'You will be removed from this group and lose access to its picks and messages. You can rejoin later with an invite.',
          confirmLabel: 'Leave Group',
        };

  return (
    <div className='space-y-lg'>
      {/* Member roster — rendered bare (no card) so the list flows with the
          page; the invite and manage sections below keep their cards. */}
      <section>
        <h2 className='text-lg font-semibold mb-lg'>Members</h2>
        {members.length === 0 ? (
          <p className='text-secondary'>No members yet.</p>
        ) : (
          <div className='space-y-md'>
            {members.map(member => (
              <div key={member.id} className='flex items-center gap-md'>
                <Avatar name={member.name} pictureUrl={member.pictureUrl} />
                <div className='min-w-0 flex-1 flex items-center gap-md'>
                  <span className='font-medium'>{member.name}</span>
                  {member.isOwner && (
                    <span className='inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800'>
                      Owner
                    </span>
                  )}
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

      {/* Owner/member actions: Edit + Delete (owner) or Leave (member), each
          confirmed through the shared ConfirmDeleteModal. */}
      <section className='rounded-md border border-border bg-surface p-lg'>
        <h2 className='text-lg font-semibold mb-lg'>{isOwner ? 'Manage Group' : 'Membership'}</h2>
        <div className='flex flex-wrap items-center gap-md'>
          {isOwner ? (
            <>
              <Button variant='secondary' onClick={() => navigate(`/edit-group/${identifier}`)}>
                Edit
              </Button>
              <Button variant='destructive' onClick={() => setConfirmAction('delete')}>
                Delete
              </Button>
            </>
          ) : (
            <Button variant='destructive' onClick={() => setConfirmAction('leave')}>
              Leave Group
            </Button>
          )}
        </div>
      </section>

      <ConfirmDeleteModal
        isOpen={confirmAction !== null}
        onClose={closeConfirm}
        onConfirm={handleConfirmAction}
        title={confirmCopy.title}
        body={confirmCopy.body}
        confirmLabel={confirmCopy.confirmLabel}
        loading={actionLoading}
      />
    </div>
  );
}
