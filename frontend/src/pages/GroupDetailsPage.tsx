import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { getGroup, getMembers, getMessages, getUnreadStatus, markMessagesRead } from '../lib/groupsService.js';
import type { GroupDetail, GroupMember, GroupMessage } from '../lib/groupsService';
import Button from '../designsystem/components/Button';
import PageContainer from '../designsystem/components/PageContainer';
import Spinner from '../designsystem/components/Spinner';
import LeaderboardTab from './GroupDetails/LeaderboardTab';
import PicksTab from './GroupDetails/PicksTab';
import ChatTab from './GroupDetails/ChatTab';
import SettingsTab from './GroupDetails/SettingsTab';
import WorldCupLeaderboardTab from './GroupDetails/WorldCupLeaderboardTab';
import WorldCupPicksTab from './GroupDetails/WorldCupPicksTab';

// Ported from GroupDetailsPage.svelte (commit d6b2566^). This is the page shell:
// it resolves the group identifier, runs the parallel mount fetch, and owns the
// header + tab navigation. The tab bodies (leaderboard/picks/chat/settings) are
// delegated to child components.
//
// World Cup pools (poolType === 'world_cup_2026') render the tournament-shaped
// variant of the same two tabs: the Leaderboard tab swaps the placeholder for
// the fetched TournamentLeaderboard, and the Picks tab embeds the full
// pick-making surface (WorldCupPicksTab: stage list + sticky submit bar) so
// members pick without leaving the group. NFL pools (poolType absent or
// 'nfl_weekly') are UNCHANGED.
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
      <div className="max-w-4xl mx-auto">
        <div className="text-center space-y-md">
          <h1 className="text-3xl font-heading font-bold text-content">
            Group Not Found
          </h1>
          <p className="text-content-muted">{message}</p>
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
  const { user } = useAuth();

  const [group, setGroup] = useState<GroupDetail | null>(null);
  const [members, setMembers] = useState<GroupMember[]>([]);
  const [messages, setMessages] = useState<GroupMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabKey>('leaderboard');
  // Drives the red dot on the Chat tab. Fetched independently of the mount fetch
  // (a failure here must not collapse the whole page into the Not Found UI), and
  // cleared the moment the user opens the chat.
  const [hasUnreadChat, setHasUnreadChat] = useState(false);

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

  // Resolve the Chat tab's unread state separately from the mount fetch. Kept off
  // the Promise.all so an older backend (or a transient failure) leaves the dot
  // off rather than failing the whole page. Everyone starts unread by default,
  // so a fresh group surfaces the dot until the chat is opened.
  useEffect(() => {
    if (!identifier) return;
    let cancelled = false;
    getUnreadStatus(identifier)
      .then((unread) => {
        if (!cancelled) setHasUnreadChat(unread);
      })
      .catch(() => {
        /* non-fatal: leave the indicator off */
      });
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
    return (
      <PageContainer width="wide">
        <div className="flex justify-center py-12">
          <Spinner size="md" label="Loading group..." />
        </div>
      </PageContainer>
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

  // Switch tabs; opening Chat clears the unread dot and marks the chat read
  // server-side (fire-and-forget — the local clear is what the user sees, and a
  // failed write just means the dot reappears on the next visit).
  function handleSelectTab(key: TabKey) {
    setActiveTab(key);
    if (key === 'chat' && hasUnreadChat && identifier) {
      setHasUnreadChat(false);
      markMessagesRead(identifier).catch(() => {});
    }
  }

  // getGroup returns userRole (NOT isOwner); admin is the owning role.
  const isOwner = group.userRole === 'admin';
  // World Cup pools render the tournament-shaped tab variants. Absent/NFL pools
  // keep the existing behavior untouched.
  const isWorldCup = group.poolType === 'world_cup_2026';

  return (
    <PageContainer width="wide" className="space-y-lg">
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
            <h1 className="text-3xl font-heading font-bold text-content">
              {group.name}
            </h1>
            {group.description && (
              <p className="text-content-muted">{group.description}</p>
            )}
            <div className="flex items-center gap-md text-sm text-content-muted">
              <span>
                <span className="font-medium">{group.memberCount}</span> members
              </span>
              {isOwner && (
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-accent-subtle text-accent-on-subtle">
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
                onClick={() => handleSelectTab(tab.key)}
                className={`relative pb-sm px-xs text-sm font-medium border-b-2 transition-colors ${
                  activeTab === tab.key
                    ? 'border-primary-500 text-primary-600 dark:text-primary-400'
                    : 'border-transparent text-secondary-600 dark:text-secondary-400 hover:text-secondary-900 dark:hover:text-secondary-100'
                }`}
              >
                {tab.label}
                {tab.key === 'chat' && hasUnreadChat && (
                  <span
                    data-testid="chat-unread-indicator"
                    aria-label="Unread messages"
                    className="absolute -top-0.5 -right-1.5 h-2 w-2 rounded-full bg-error-500"
                  />
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Tab Content */}
        {activeTab === 'leaderboard' &&
          (isWorldCup ? (
            <WorldCupLeaderboardTab identifier={identifier} />
          ) : (
            <LeaderboardTab identifier={identifier} />
          ))}
        {activeTab === 'picks' &&
          (isWorldCup ? (
            // Embedded pick-making surface. Rendered bare (no bordered card) so
            // its sticky submit bar can pin to the viewport bottom and span the
            // page gutters; the bar mounts with this tab and unmounts when the
            // user switches away. members + caller id + admin flag drive the
            // "Picking for" person selector (view teammates; admins edit them).
            <WorldCupPicksTab
              identifier={identifier}
              members={members}
              currentUserId={user?.id ?? null}
              isAdmin={isOwner}
            />
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
    </PageContainer>
  );
}
