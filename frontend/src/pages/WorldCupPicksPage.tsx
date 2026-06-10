import { useNavigate, useSearchParams } from 'react-router-dom';
import Button from '../designsystem/components/Button';
import WorldCupPicksTab from './GroupDetails/WorldCupPicksTab';

// World Cup sibling of GamesPage. The pick-making surface itself (stage-grouped
// match list + sticky submit bar) lives in WorldCupPicksTab so a
// world_cup_2026 group's Picks tab embeds the same experience inline; this
// route is the standalone shell around it, kept so existing /world-cup deep
// links keep working. The group identifier comes from the `group` query param
// (mirrors GroupDetailsPage).

// Shared not-found UI, mirroring GroupDetailsPage: shown when the `group` query
// param is absent so the user always lands on a single recoverable error with a
// route back to the groups list.
function GroupNotFound({ message, onBack }: { message: string; onBack: () => void }) {
  return (
    <div className="min-h-screen bg-neutral-0 dark:bg-secondary-900">
      <div className="max-w-4xl mx-auto px-sm py-lg sm:px-lg">
        <div className="text-center space-y-md">
          <h1 className="text-3xl font-heading font-bold text-[var(--color-text-primary)]">
            Group Not Found
          </h1>
          <p className="text-[var(--color-text-secondary)]">{message}</p>
          <Button onClick={onBack}>Back to Groups</Button>
        </div>
      </div>
    </div>
  );
}

export default function WorldCupPicksPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const identifier = searchParams.get('group');

  // No identifier in the query string: nothing to load, show the error UI early.
  if (!identifier) {
    return (
      <GroupNotFound message="No group was specified." onBack={() => navigate('/groups')} />
    );
  }

  return (
    <div className="mx-auto max-w-4xl px-sm py-lg sm:p-lg">
      <h1 className="mb-lg text-2xl font-bold text-secondary-900 dark:text-neutral-0">
        World Cup 2026 Picks
      </h1>
      <WorldCupPicksTab identifier={identifier} />
    </div>
  );
}
