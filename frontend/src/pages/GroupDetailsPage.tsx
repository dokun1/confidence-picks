import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { getGroup, getMembers, getMessages, getUnreadStatus, markMessagesRead } from '../lib/groupsService.js';
import type { GroupDetail, GroupMember, GroupMessage } from '../lib/groupsService';
import { getWorldCupLeaderboard, getAllWorldCupStages, getMyWorldCupPicks } from '../lib/worldCupService.js';
import { writeCache, wcCacheKeys } from '../lib/worldCupCache';
import { countNeedsPick } from '../lib/wcNeedsPick';
import type { SavedView } from '../lib/wcGamesView';
import type { WorldCupMatch } from '../lib/types';
import Banner from '../designsystem/components/Banner';
import Button from '../designsystem/components/Button';
import NotificationDot from '../designsystem/components/NotificationDot';
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
  const [searchParams, setSearchParams] = useSearchParams();
  const identifier = searchParams.get('group');
  const { user } = useAuth();

  // Deeplink seeds (read once on mount): ?tab= picks the initial tab and ?view=
  // pre-selects a saved view in the Picks tab — e.g. the leaderboard banner links
  // to ?tab=picks&view=needs-pick so the "Needs pick" chip opens already chosen.
  const tabParam = searchParams.get('tab');
  const initialTab: TabKey = TABS.some((t) => t.key === tabParam) ? (tabParam as TabKey) : 'leaderboard';
  const viewParam = searchParams.get('view');

  const [group, setGroup] = useState<GroupDetail | null>(null);
  const [members, setMembers] = useState<GroupMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabKey>(initialTab);
  // Which saved view the Picks tab opens on; set by the banner CTA / a deeplink.
  const [picksInitialView, setPicksInitialView] = useState<SavedView | undefined>(
    viewParam === 'needs-pick' ? 'needs-pick' : undefined,
  );
  // How many picks the viewer still owes in this (World Cup) pool. Drives the
  // leaderboard warning banner; 0 keeps it hidden.
  const [needsPickCount, setNeedsPickCount] = useState(0);
  // Drives the red dot on the Chat tab. Fetched independently of the mount fetch
  // (a failure here must not collapse the whole page into the Not Found UI), and
  // cleared the moment the user opens the chat.
  const [hasUnreadChat, setHasUnreadChat] = useState(false);
  // Chat messages are lazy-loaded the first time the Chat tab opens (see
  // ensureMessagesLoaded) rather than eagerly on mount — Chat isn't the default
  // tab, so fetching its history up front only delayed the leaderboard.
  const [messages, setMessages] = useState<GroupMessage[]>([]);
  const [messagesLoaded, setMessagesLoaded] = useState(false);
  const [messagesLoading, setMessagesLoading] = useState(false);

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
        const groupPromise = getGroup(id);

        // Break the waterfall: the moment we know this is a World Cup pool, warm
        // the leaderboard cache IN PARALLEL with the rest of the shell. The
        // default Leaderboard tab seeds from that cache, so it paints the instant
        // it mounts instead of starting its own fetch only after the shell
        // resolves. Best-effort — a failure just falls back to a cold tab fetch.
        groupPromise
          .then((g) => {
            if (g?.poolType === 'world_cup_2026') {
              getWorldCupLeaderboard(id)
                .then((resp) =>
                  writeCache(
                    wcCacheKeys.leaderboard(id),
                    Array.isArray(resp?.leaderboard) ? resp.leaderboard : [],
                  ),
                )
                .catch(() => {});
            }
          })
          .catch(() => {});

        // Promise.all so a failure in either branch surfaces ONE error UI, never
        // two. getMessages is no longer here — Chat loads on demand.
        const [groupResp, membersResp] = await Promise.all([groupPromise, getMembers(id)]);
        if (!cancelled) {
          setGroup(groupResp);
          setMembers(membersResp);
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

  // Compute the viewer's outstanding-pick count for the leaderboard banner.
  // World Cup pools only, and only while the Leaderboard tab is showing (that's
  // the only place the banner renders) — re-running when the user returns from
  // the Picks tab keeps the count fresh after they pick. Best-effort and off the
  // critical path: a failure just leaves the banner hidden. Reuses the SAME
  // matches + picks endpoints (and `wc:stages` cache) the Picks tab feeds on.
  useEffect(() => {
    if (!identifier || group?.poolType !== 'world_cup_2026' || activeTab !== 'leaderboard') return;
    let cancelled = false;
    (async () => {
      try {
        const [stagesResp, picksResp] = await Promise.all([
          getAllWorldCupStages(),
          getMyWorldCupPicks(identifier),
        ]);
        if (cancelled) return;
        const matches: WorldCupMatch[] = Array.isArray(stagesResp?.games) ? stagesResp.games : [];
        writeCache(wcCacheKeys.stages, matches);
        setNeedsPickCount(
          countNeedsPick(matches, picksResp?.picks, new Date(), group?.knockoutOnly ?? false),
        );
      } catch {
        /* non-fatal: leave the banner hidden */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [identifier, group?.poolType, activeTab]);

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

  // Lazy-load the chat history the first time Chat is opened. A failed fetch
  // soft-falls to an empty thread (the user can still post) rather than blocking
  // the tab — chat history is non-critical to the rest of the page.
  function ensureMessagesLoaded() {
    if (messagesLoaded || messagesLoading || !identifier) return;
    setMessagesLoading(true);
    getMessages(identifier)
      .then((msgs) => setMessages(msgs))
      .catch(() => setMessages([]))
      .finally(() => {
        setMessagesLoaded(true);
        setMessagesLoading(false);
      });
  }

  // Switch tabs; opening Chat lazy-loads its history, clears the unread dot, and
  // marks the chat read server-side (fire-and-forget — the local clear is what
  // the user sees, and a failed write just means the dot reappears next visit).
  function handleSelectTab(key: TabKey) {
    setActiveTab(key);
    if (key === 'chat') {
      ensureMessagesLoaded();
      if (hasUnreadChat && identifier) {
        setHasUnreadChat(false);
        markMessagesRead(identifier).catch(() => {});
      }
    }
  }

  // Banner CTA: jump to the Picks tab with the "Needs pick" chip pre-selected,
  // and reflect it in the URL so the destination is a real, refresh-safe deeplink.
  function goToNeedsPick() {
    setPicksInitialView('needs-pick');
    setActiveTab('picks');
    const next = new URLSearchParams(searchParams);
    next.set('tab', 'picks');
    next.set('view', 'needs-pick');
    setSearchParams(next, { replace: true });
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

        {/* Picks-available warning — spans between the member count and the tab
            bar, shown on the Leaderboard tab when the viewer still owes picks.
            Tapping the CTA deeplinks to the Picks tab on the "Needs pick" chip. */}
        {isWorldCup && activeTab === 'leaderboard' && needsPickCount > 0 && (
          <Banner variant="warning" action={{ label: 'Make your picks', onClick: goToNeedsPick }}>
            You have {needsPickCount} {needsPickCount === 1 ? 'pick' : 'picks'} available to make.
          </Banner>
        )}

        {/* Tab Navigation */}
        <div className="border-b border-secondary-200 dark:border-secondary-700">
          {/* pt-1 gives the Chat tab's unread dot room: overflow-x-auto forces
              overflow-y to clip at the row's top edge, which would otherwise
              shave the top off the dot's negative offset. */}
          <div className="flex gap-lg overflow-x-auto pt-1" role="tablist" aria-label="Group sections">
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
                  <NotificationDot
                    label="Unread messages"
                    data-testid="chat-unread-indicator"
                    className="absolute -top-0.5 -right-1.5"
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
              knockoutOnly={group?.knockoutOnly ?? false}
              initialView={picksInitialView}
            />
          ) : (
            <PicksTab identifier={identifier} members={members} />
          ))}
        {activeTab === 'chat' &&
          (messagesLoaded ? (
            <ChatTab identifier={identifier} initialMessages={messages} />
          ) : (
            <div className="flex justify-center py-12">
              <Spinner size="md" label="Loading chat..." />
            </div>
          ))}
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
