import { useNavigate } from 'react-router-dom';
import CreateGroupForm, {
  type CreateGroupFormValues,
} from '../designsystem/components/CreateGroupForm';
import { createGroup } from '../lib/groupsService.js';

// Ported from CreateGroupPage.svelte (commit d6b2566^). Renders the page <h1>
// and the shared CreateGroupForm; Navigation lives in Layout so it is not
// rendered here. The Svelte version navigated to `/groups/${identifier}`, but
// the React route table has no '/groups/:identifier' route — navigate to the
// existing '/groups' list instead to keep routing coherent.
//
// CreateGroupForm owns its own loading state and surfaces submission errors via
// an internal InlineToast, so onSubmit deliberately lets createGroup's rejection
// propagate (no try/catch) and only navigates after a successful resolve.

export default function CreateGroupPage() {
  const navigate = useNavigate();

  async function handleSubmit(values: CreateGroupFormValues) {
    await createGroup(values);
    navigate('/groups');
  }

  return (
    <div className="min-h-screen bg-neutral-0 dark:bg-secondary-900">
      <div className="max-w-2xl mx-auto space-y-lg">
        <header className="space-y-sm">
          <h1 className="text-3xl font-heading font-bold text-content">
            Create Group
          </h1>
          <p className="text-content-muted">
            Start a new confidence picks group and invite your friends to compete.
          </p>
        </header>

        <CreateGroupForm onSubmit={handleSubmit} onCancel={() => navigate('/groups')} />
      </div>
    </div>
  );
}
