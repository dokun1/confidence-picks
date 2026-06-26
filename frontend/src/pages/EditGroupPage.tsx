import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import CreateGroupForm, {
  type CreateGroupFormValues,
} from '../designsystem/components/CreateGroupForm';
import { getGroup, updateGroup } from '../lib/groupsService.js';
import type { GroupDetail } from '../lib/groupsService';
import Spinner from '../designsystem/components/Spinner';

// Ported from EditGroupPage.svelte (commit d6b2566^). Loads the group named by
// the `/edit-group/:identifier` route param and renders the shared
// CreateGroupForm in edit mode. Navigation lives in Layout so it is not rendered
// here. The Svelte version's admin-auth gate and danger-zone delete are out of
// scope for this port — only the load + edit flow is mirrored.
//
// Supplying initialValues.identifier locks the Group ID field (the form handles
// disabling + the locked hint). updateGroup only accepts name/description here,
// so the immutable identifier is never sent. As in CreateGroupPage, onSubmit
// lets the rejection propagate (no try/catch) so the form's InlineToast surfaces
// the error; it only navigates after a successful resolve.

export default function EditGroupPage() {
  const navigate = useNavigate();
  const { identifier } = useParams<{ identifier: string }>();

  const [group, setGroup] = useState<GroupDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function fetchGroup() {
      if (!identifier) return;
      setLoading(true);
      setNotFound(false);
      try {
        const data = await getGroup(identifier);
        if (!cancelled) setGroup(data);
      } catch {
        // getGroup rejects with 'Group not found' on a 404; treat any load
        // failure as not-found so the form is never shown for a missing group.
        if (!cancelled) {
          setGroup(null);
          setNotFound(true);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchGroup();
    return () => {
      cancelled = true;
    };
  }, [identifier]);

  async function handleSubmit(values: CreateGroupFormValues) {
    if (!identifier) return;
    await updateGroup(identifier, {
      name: values.name,
      description: values.description,
      maxMembers: values.maxMembers,
    });
    navigate('/groups');
  }

  return (
    <div className="min-h-screen bg-neutral-0 dark:bg-secondary-900">
      <div className="max-w-2xl mx-auto space-y-lg">
        <header className="space-y-sm">
          <h1 className="text-3xl font-heading font-bold text-content">
            Edit Group
          </h1>
          <p className="text-content-muted">
            Update the name and description for your confidence picks group.
          </p>
        </header>

        {loading ? (
          <div className="flex justify-center py-12">
            <Spinner size="md" label="Loading group..." />
          </div>
        ) : notFound || !group ? (
          /* Not-found state — form is deliberately absent */
          <div className="text-center py-12 space-y-md">
            <p className="text-content-muted">
              Group not found. It may have been deleted or the link is incorrect.
            </p>
          </div>
        ) : (
          <CreateGroupForm
            initialValues={{
              name: group.name,
              identifier: group.identifier,
              description: group.description ?? '',
              maxMembers: group.maxMembers,
            }}
            onSubmit={handleSubmit}
            onCancel={() => navigate(-1)}
          />
        )}
      </div>
    </div>
  );
}
