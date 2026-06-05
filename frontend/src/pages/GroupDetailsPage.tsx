import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { getGroup, getMembers, getMessages } from '../lib/groupsService.js';
import type { GroupDetail, GroupMember, GroupMessage } from '../lib/groupsService';
import Button from '../designsystem/components/Button';
import PicksTab from './GroupDetails/PicksTab';
import ChatTab from './GroupDetails/ChatTab';
import SettingsTab from './GroupDetails/SettingsTab';
import WorldCupLeaderboardTab from './GroupDetails/WorldCupLeaderboardTab';

// Ported from GroupDetailsPage.svelte (commit d6b2566^). This is the page shell:
// it resolves the group identifier, runs the parallel mount fetch, and owns the
// header + tab navigation. The tab bodies (picks/chat/settings) are delegated to
// child components; the leaderboard tab is a deferred placeholder (no
// getScoreboard wiring per the task scope).
//
// World Cup pools (poolType === 'world_cup_2026') render the tournament-shaped
// variant of the same two tabs: the Leaderboard tab swaps the placeholder for
// the fetched TournamentLeaderboard, and the Picks tab links out to the
// WorldCupPicksPage route instead of embedding the NFL week matrix. NFL pools
// (poolType absent or 'nfl_weekly') are UNCHANGED.
//
// The route is param-less ('/group-details'); the identifier comes from the
// `group` query param, NOT a route param — App.tsx is intentionally untouched.
// Promise.all (not allSettled) is deliberate: a failure in any branch collapses
// to ONE 'Group Not Found' error UI rather than three independent ones.

type TabKey = 'leaderboard' | 'picks' | 'chat' | 'settings';

const TABS: { key: TabKey; label: string }[] = [
  { key: 'leaderboard', label: 'Leaderboard' },
  { key: 'picks', label: 'Picks' },
  { key: 'chat', label: 'Chat' },
  { key: 'settings', label: 'Settings' },
];

// Shared not-found UI. Rendered both when the `group` query param is absent and
// when the mount fetch rejects, so the user always sees a single recoverable
// error with a route back to the groups list.
function GroupNotFound({ message, onBack }: { message: string; onBack: () => void }) {
  return (
    <div className="min-h-screen bg-neutral-0 dark:bg-secondary-900">
      <div className="max-w-4xl mx-auto px-lg py-lg">
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

export default function GroupDetailsPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const identifier = searchParams.get('group');

  const [group, setGroup] = useState<GroupDetail | null>(null);
  const [members, setMembers] = useState<GroupMember[]>([]);
  const [messages, setMessages] = useState<GroupMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabKey>('leaderboard');

  useEffect(() => {
    if (!identifier) return;
    // Capture the narrowed identifier; TS drops the non-null narrowing inside
    // the nested async closure, so re-bind it as a non-nullable local.
    const id = identifier;
    let cancelled = false;

    async function loadGroupData() {
      setLoading(true);
      setError(null);
      try {
        // Promise.all so a failure in ANY branch surfaces ONE error UI, never
        // three. Mirrors the GroupsPage/EditGroupPage cancelled-guard pattern.
        const [groupResp, membersResp, messagesResp] = await Promise.all([
          getGroup(id),
          getMembers(id),
          getMessages(id),
        ]);
        if (!cancelled) {
          setGroup(groupResp);
          setMembers(membersResp);
          setMessages(messagesResp);
        }
      } catch (err) {
        if (!cancelled) {
          setGroup(null);
          setError(err instanceof Error ? err.message : 'Failed to load group');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadGroupData();
    return () => {
      cancelled = true;
    };
  }, [identifier]);

  // No identifier in the query string: nothing to load, show the error UI early.
  if (!identifier) {
    return (
      <GroupNotFound
        message="No group was specified."
        onBack={() => navigate('/groups')}
      />
    );
  }

  if (loading) {
    // Spinner markup mirrors GroupsPage's loading state.
    return (
      <div className="min-h-screen bg-neutral-0 dark:bg-secondary-900">
        <div className="max-w-6xl mx-auto px-lg py-lg">
          <div className="flex justify-center items-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
            <span className="ml-3 text-[var(--color-text-secondary)]">Loading group...</span>
          </div>
        </div>
      </div>
    );
  }

  if (error || !group) {
    return (
      <GroupNotFound
        message={error ?? 'Group not found.'}
        onBack={() => navigate('/groups')}
      />
    );
  }

  // getGroup returns userRole (NOT isOwner); admin is the owning role.
  const isOwner = group.userRole === 'admin';
  // World Cup pools render the tournament-shaped tab variants. Absent/NFL pools
  // keep the existing behavior untouched.
  const isWorldCup = group.poolType === 'world_cup_2026';

  return (
    <div className="min-h-screen bg-neutral-0 dark:bg-secondary-900">
      <div className="max-w-6xl mx-auto px-lg py-lg space-y-lg">
        {/* Header */}
        <div className="space-y-md">
          <button
            type="button"
            className="flex items-center text-secondary-600 dark:text-secondary-400 hover:text-secondary-900 dark:hover:text-secondary-100 transition-colors"
            onClick={() => navigate('/groups')}
          >
            <svg
              className="w-4 h-4 mr-xs"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M15 19l-7-7 7-7"
              />
            </svg>
            Back to Groups
          </button>

          <div className="space-y-sm">
            <h1 className="text-3xl font-heading font-bold text-[var(--color-text-primary)]">
              {group.name}
            </h1>
            {group.description && (
              <p className="text-[var(--color-text-secondary)]">{group.description}</p>
            )}
            <div className="flex items-center gap-md text-sm text-[var(--color-text-secondary)]">
              <span>
                <span className="font-medium">{group.memberCount}</span> members
              </span>
              {isOwner && (
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                  Owner
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="border-b border-secondary-200 dark:border-secondary-700">
          <div className="flex gap-lg overflow-x-auto" role="tablist" aria-label="Group sections">
            {TABS.map((tab) => (
              <button
                key={tab.key}
                type="button"
                role="tab"
                aria-selected={activeTab === tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`pb-sm px-xs text-sm font-medium border-b-2 transition-colors ${
                  activeTab === tab.key
                    ? 'border-primary-500 text-primary-600 dark:text-primary-400'
                    : 'border-transparent text-secondary-600 dark:text-secondary-400 hover:text-secondary-900 dark:hover:text-secondary-100'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Tab Content */}
        {activeTab === 'leaderboard' &&
          (isWorldCup ? (
            <WorldCupLeaderboardTab identifier={identifier} />
          ) : (
            <div className="bg-neutral-0 dark:bg-secondary-800 border border-secondary-200 dark:border-secondary-700 rounded-lg p-lg">
              <h2 className="text-xl font-heading font-semibold text-[var(--color-text-primary)] mb-sm">
                Leaderboard
              </h2>
              <p className="text-[var(--color-text-secondary)]">Leaderboard coming soon</p>
            </div>
          ))}
        {activeTab === 'picks' &&
          (isWorldCup ? (
            <div className="bg-neutral-0 dark:bg-secondary-800 border border-secondary-200 dark:border-secondary-700 rounded-lg p-lg space-y-md">
              <h2 className="text-xl font-heading font-semibold text-[var(--color-text-primary)]">
                Picks
              </h2>
              <p className="text-[var(--color-text-secondary)]">
                World Cup picks are made on the tournament stage list — Home / Draw / Away for
                every match, no confidence.
              </p>
              <Button
                onClick={() => navigate(`/world-cup?group=${encodeURIComponent(identifier)}`)}
              >
                Make World Cup Picks
              </Button>
            </div>
          ) : (
            <PicksTab identifier={identifier} members={members} />
          ))}
        {activeTab === 'chat' && (
          <ChatTab identifier={identifier} initialMessages={messages} />
        )}
        {activeTab === 'settings' && (
          <SettingsTab
            group={group}
            isOwner={isOwner}
            identifier={identifier}
            members={members}
          />
        )}
      </div>
    </div>
  );
}
