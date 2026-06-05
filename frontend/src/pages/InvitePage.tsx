import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { getInvite, acceptInvite } from '../lib/invitesService.js';
import type { InviteDetails } from '../lib/types';
import Avatar from '../designsystem/components/Avatar';
import Button from '../designsystem/components/Button';

// Ported from InvitePage.svelte (commit d6b2566^). Public invite-acceptance flow:
// reads :token from the URL, fetches InviteDetails, and renders one of several
// terminal states (loading / fetch-error / invalid / already-member / accept).
//
// Token preservation across sign-in: the signed-out CTA routes to
// `/login?next=/invite/:token`, carrying the token in the return URL so the
// user lands back here (now authenticated) to accept. NOTE (scope gap): the
// React LoginPage captures a `redirect` query param into sessionStorage but
// AuthCallback never reads it back — it always navigates to '/'. So `next` is
// not honored post-login today. Wiring that chain spans LoginPage +
// AuthCallback and is out of scope for this port (the constraint says extend
// LoginPage only if `next` handling already existed; it does not).
//
// Group navigation targets `/group-details?group=<identifier>` — the route the
// app actually exposes (see GroupsPage). The Svelte original's
// `/groups/:identifier` route does not exist in the React table; JoinGroupPage
// set the precedent of mapping to the real route.

// Friendly copy for the backend `reason` codes (GroupInvite.inviteValidity).
// Unknown codes fall back to a generic line so a new backend reason never
// renders blank.
const REASON_MESSAGES: Record<string, string> = {
  not_found: 'This invitation could not be found.',
  revoked: 'This invitation has been revoked.',
  expired: 'This invitation has expired.',
  exhausted: 'This invitation has reached its maximum number of uses.',
};

function reasonMessage(reason?: string): string {
  if (reason && REASON_MESSAGES[reason]) return REASON_MESSAGES[reason];
  return 'This invitation is no longer available.';
}

export default function InvitePage() {
  const navigate = useNavigate();
  const { token = '' } = useParams<{ token: string }>();
  const { isAuthenticated } = useAuth();

  const [loading, setLoading] = useState(true);
  const [invite, setInvite] = useState<InviteDetails | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [accepting, setAccepting] = useState(false);

  // Fetch the invite whenever the token changes. The cancelled flag guards
  // post-await state writes against an unmounted component (same pattern as
  // GroupsPage / JoinGroupPage).
  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const details = await getInvite(token);
        if (!cancelled) setInvite(details);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load invitation');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [token]);

  function goToGroup(identifier: string) {
    navigate(`/group-details?group=${identifier}`);
  }

  function handleSignIn() {
    navigate(`/login?next=${encodeURIComponent(`/invite/${token}`)}`);
  }

  async function handleAccept() {
    let cancelled = false;
    setAccepting(true);
    setError(null);
    try {
      const res = await acceptInvite(token);
      if (!cancelled) goToGroup(res.groupIdentifier);
    } catch (err) {
      if (!cancelled) {
        setError(err instanceof Error ? err.message : 'Failed to accept invite');
      }
    } finally {
      if (!cancelled) setAccepting(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-neutral-0 dark:bg-secondary-900 px-md py-xl">
      <div className="w-full max-w-md bg-neutral-0 dark:bg-secondary-800 border border-secondary-200 dark:border-secondary-700 rounded-lg p-xl space-y-lg">
        {loading ? (
          <div className="animate-pulse space-y-sm" data-testid="invite-loading">
            <div className="h-6 bg-secondary-200 dark:bg-secondary-700 rounded" />
            <div className="h-4 bg-secondary-200 dark:bg-secondary-700 rounded w-2/3" />
            <div className="h-32 bg-secondary-200 dark:bg-secondary-700 rounded" />
          </div>
        ) : error ? (
          <div className="space-y-md">
            <h1 className="text-xl font-heading font-semibold text-error-600 dark:text-error-400">
              Invitation Error
            </h1>
            <p className="text-sm text-[var(--color-text-secondary)]">{error}</p>
            <Button variant="secondary" size="sm" onClick={() => navigate('/groups')}>
              Go to Groups
            </Button>
          </div>
        ) : invite && !invite.valid ? (
          <div className="space-y-md">
            <h1 className="text-xl font-heading font-semibold text-[var(--color-text-primary)]">
              Invite Unavailable
            </h1>
            <p className="text-sm text-[var(--color-text-secondary)]">
              {reasonMessage(invite.reason)}
            </p>
            <Button variant="secondary" size="sm" onClick={() => navigate('/groups')}>
              Browse Groups
            </Button>
          </div>
        ) : invite ? (
          <div className="space-y-md">
            <div className="flex items-center gap-sm">
              <Avatar
                name={invite.group.ownerName}
                pictureUrl={invite.group.ownerPictureUrl}
                variant="md"
              />
              <div>
                <h1 className="text-xl font-heading font-semibold text-[var(--color-text-primary)]">
                  Join {invite.group.name}
                </h1>
                <p className="text-xs text-[var(--color-text-secondary)]">
                  Hosted by {invite.group.ownerName}
                </p>
              </div>
            </div>

            {invite.group.description && (
              <p className="text-sm text-[var(--color-text-secondary)] whitespace-pre-wrap">
                {invite.group.description}
              </p>
            )}

            <div className="flex items-center gap-sm text-xs text-[var(--color-text-secondary)]">
              <span>{invite.group.memberCount} members</span>
              <span>•</span>
              <span>Max {invite.group.maxMembers}</span>
              {invite.invite.remainingUses != null && (
                <span>• {invite.invite.remainingUses} uses left</span>
              )}
            </div>

            {invite.alreadyMember ? (
              <div className="space-y-sm">
                <p className="text-sm text-[var(--color-text-secondary)]">
                  You're already a member of {invite.group.name}.
                </p>
                <Button
                  variant="primary"
                  size="sm"
                  className="w-full"
                  onClick={() => goToGroup(invite.group.identifier)}
                >
                  Go to Group
                </Button>
              </div>
            ) : isAuthenticated ? (
              <Button
                variant="primary"
                size="sm"
                className="w-full"
                disabled={accepting}
                loading={accepting}
                onClick={handleAccept}
              >
                {accepting ? 'Joining…' : 'Accept Invite'}
              </Button>
            ) : (
              <Button variant="primary" size="sm" className="w-full" onClick={handleSignIn}>
                Sign in to join
              </Button>
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
}
