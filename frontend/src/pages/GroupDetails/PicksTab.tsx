import type { GroupMember } from '../../lib/groupsService';

// When implemented, PicksTab consumes GroupPicks-related shapes (GameData,
// MemberPicks, etc.) from '../../lib/types' and renders the GroupPicks
// component. Those imports are deferred until the body is wired.

export interface PicksTabProps {
  /** Group identifier, used to fetch games + picks for the active week. */
  identifier: string;
  /** Current members, needed to render who picked what. */
  members: GroupMember[];
}

/**
 * PicksTab renders the GroupPicks component (from goal-3). The page fetches
 * games + picks via picksService and passes them in as props. Body is deferred
 * to the picks implementation task — this stub declares the final prop contract
 * so the page compiles.
 */
export default function PicksTab(props: PicksTabProps) {
  return (
    <div className='rounded-md border border-border bg-surface p-lg'>
      <h2 className='text-lg font-semibold'>Picks</h2>
      <p className='text-secondary'>Picks coming soon</p>
    </div>
  );
}
