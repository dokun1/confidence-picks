import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import TextField from '../designsystem/components/TextField';
import Button from '../designsystem/components/Button';
import { joinGroup } from '../lib/groupsService.js';

// Ported from JoinGroupPage.svelte (commit d6b2566^). Collects a group
// identifier and joins via joinGroup. Navigation lives in Layout so it is not
// rendered here. The Svelte version navigated to `/groups/${identifier}` after
// joining, but the React route table has no '/groups/:identifier' route — match
// CreateGroupPage/GroupsPage and navigate to the existing '/groups' list.
//
// Identifier validation mirrors CreateGroupForm.validateForm's identifier rule:
// non-empty and matching ^[a-zA-Z0-9-_]+$. A failed client-side check surfaces
// inline via the TextField and never reaches the service.

const IDENTIFIER_RE = /^[a-zA-Z0-9-_]+$/;

export default function JoinGroupPage() {
  const navigate = useNavigate();

  const [identifier, setIdentifier] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    const trimmed = identifier.trim();
    if (!trimmed) {
      setError('Group ID is required');
      return;
    }
    if (!IDENTIFIER_RE.test(trimmed)) {
      setError('Group ID can only contain letters, numbers, hyphens, and underscores');
      return;
    }

    // Guard any post-await state writes so an unmounted component is not updated
    // (same pattern as GroupsPage's load effect).
    let cancelled = false;
    setLoading(true);
    setError(null);
    try {
      await joinGroup(trimmed);
      if (!cancelled) navigate('/groups');
    } catch (err) {
      if (!cancelled) {
        setError(err instanceof Error ? err.message : 'Failed to join group');
      }
    } finally {
      if (!cancelled) setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-neutral-0 dark:bg-secondary-900">
      <div className="max-w-2xl mx-auto px-lg py-lg space-y-lg">
        <header className="space-y-sm">
          <h1 className="text-3xl font-heading font-bold text-[var(--color-text-primary)]">
            Join Group
          </h1>
          <p className="text-[var(--color-text-secondary)]">
            Enter the group identifier to join an existing confidence picks group.
          </p>
        </header>

        <form onSubmit={handleSubmit} className="space-y-md">
          <TextField
            label="Group ID"
            value={identifier}
            onChange={setIdentifier}
            placeholder="unique-group-id"
            validationMessage={error ?? ''}
            validationState={error ? 'error' : 'none'}
            required
            disabled={loading}
          />

          <Button type="submit" variant="primary" disabled={loading} loading={loading}>
            {loading ? 'Joining...' : 'Join Group'}
          </Button>
        </form>
      </div>
    </div>
  );
}
