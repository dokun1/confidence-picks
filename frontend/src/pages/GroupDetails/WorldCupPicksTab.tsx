import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Button from '../../designsystem/components/Button';
import EmptyState from '../../designsystem/components/EmptyState';
import InlineToast from '../../designsystem/components/InlineToast';
import type { ToastVariant } from '../../designsystem/components/InlineToast/InlineToast';
import {
  type MatchPick,
  type MatchPickResult,
  type WorldCupMatch,
} from '../../lib/types';
import {
  getAllWorldCupStages,
  submitWorldCupPicks,
  getMyWorldCupPicks,
  getUserWorldCupPicks,
  submitUserWorldCupPicks,
} from '../../lib/worldCupService.js';
import { getMyGroups } from '../../lib/groupsService.js';
import { peekCache, writeCache, wcCacheKeys } from '../../lib/worldCupCache';
import { pollIntervalFor } from '../../lib/matchPolling';
import SaveTargetsDropdown, { type SaveTarget } from '../../components/SaveTargetsDropdown';
import PickPersonSelector, { type PickPersonOption } from '../../components/PickPersonSelector';
import WorldCupGamesList from '../../designsystem/components/WorldCupBrowse/WorldCupGamesList';
import type { SavedView } from '../../lib/wcGamesView';
import { toBrowseGames } from '../../lib/worldCupBrowseAdapter';

// The World Cup pick-making surface: the whole tournament as one stage-grouped
// match list with a sticky submit bar. Extracted from WorldCupPicksPage so a
// world_cup_2026 group's Picks tab embeds the SAME experience inline — the bar
// mounts with the tab and unmounts when the user switches away. The page route
// (/world-cup) renders this component too, so deep links keep working.
//
// A member's picks are flat (home/away/draw) with no confidence — World Cup
// scoring is flat-per-match (see world-cup-picks-rules.md). Every stage is
// fetched in parallel and the flattened matches are passed to `WorldCupGamesList`
// via the `toBrowseGames` adapter; the list owns all view/filter/sort/search state.

type DraftMap = Record<number, MatchPickResult>;

interface FetchState {
  loading: boolean;
  error: string;
  matches: WorldCupMatch[];
}

interface ToastState {
  open: boolean;
  message: string;
  variant: ToastVariant;
}

/** Minimal member shape the person selector needs. Matches groupsService.GroupMember. */
export interface PicksTabMember {
  id: string | number;
  name: string;
  email?: string;
  pictureUrl?: string | null;
}

export interface WorldCupPicksTabProps {
  /** Group identifier; doubles as the submit target for submitWorldCupPicks. */
  identifier: string;
  /**
   * Group roster. When two or more members are known AND the caller's id is
   * supplied, the "Picking for" selector appears so members can view (and
   * admins can edit) another member's picks. Omitted/short rosters keep the
   * original self-only experience — the standalone /world-cup page passes none.
   */
  members?: PicksTabMember[];
  /** The authenticated caller's id. Without it the selector stays hidden. */
  currentUserId?: string | number | null;
  /** Whether the caller is a group admin. Gates editing OTHER members' picks. */
  isAdmin?: boolean;
  /**
   * Knockout-only group: hide group-stage games entirely so members can only pick
   * knockout matches. Passed by GroupDetailsPage (which has the loaded group) for
   * instant correctness on first paint; the standalone /world-cup page omits it,
   * so the tab also derives it from its own getMyGroups fetch as a fallback.
   */
  knockoutOnly?: boolean;
  /** Saved view the embedded games list opens on (e.g. 'needs-pick' from a deeplink). */
  initialView?: SavedView;
}

export default function WorldCupPicksTab({
  identifier,
  members = [],
  currentUserId = null,
  isAdmin = false,
  knockoutOnly,
  initialView,
}: WorldCupPicksTabProps) {
  const groupId = identifier;

  // Normalize ids to strings up front so every comparison below (auth user vs
  // member vs selected) is string-to-string — the members API types id as a
  // string but yields a number at runtime, and the auth user id is a number.
  const selfId = currentUserId != null ? String(currentUserId) : null;
  const personOptions: PickPersonOption[] = useMemo(
    () =>
      members.map((m) => ({
        id: String(m.id),
        name: m.name,
        email: m.email,
        pictureUrl: m.pictureUrl ?? null,
      })),
    [members],
  );
  // The selector only makes sense with a known caller and at least one teammate.
  const showPersonSelector = selfId != null && personOptions.length > 1;

  // Who the draft below belongs to. Defaults to the caller and is reset to the
  // caller whenever the group or caller changes — the default never silently
  // lands on a teammate.
  const [selectedUserId, setSelectedUserId] = useState<string | null>(selfId);
  useEffect(() => {
    setSelectedUserId(selfId);
  }, [groupId, selfId]);

  // Self vs other, and whether the current selection is editable. A non-admin
  // viewing a teammate is strictly read-only; an admin may edit anyone.
  const viewingSelf = selectedUserId == null || selectedUserId === selfId;
  const readOnly = !viewingSelf && !isAdmin;
  const adminEditingOther = !viewingSelf && isAdmin;
  const selectedName = viewingSelf
    ? 'You'
    : personOptions.find((m) => m.id === selectedUserId)?.name ?? 'this member';
  const selectedFirstName = selectedName.split(' ')[0];

  // Seed the match slate from cache so re-entering the Picks tab (or revisiting
  // the group) paints the tournament instantly instead of blanking behind the
  // seven-stage fetch. The stage schedule is tournament-global, so the cache key
  // isn't group-scoped; live scores/statuses are reconciled by the fetch below
  // and the background poll.
  const cachedStages = peekCache<WorldCupMatch[]>(wcCacheKeys.stages);
  const [fetchState, setFetchState] = useState<FetchState>({
    loading: false,
    error: '',
    matches: cachedStages ?? [],
  });
  const [draft, setDraft] = useState<DraftMap>({});
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState<ToastState>({ open: false, message: '', variant: 'info' });

  // Bumping reloadKey re-runs the fetch effect with a fresh cancelled guard
  // (mirrors PicksTab); this is what the Try Again button triggers. The guard
  // matters here because this component unmounts on every tab switch — a
  // mid-flight stage fetch must not set state after the user leaves the tab.
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    // Only show the blocking "Loading matches…" state on a cold load. With a warm
    // cache the slate is already on screen, so this fetch just revalidates it.
    const isCold = peekCache(wcCacheKeys.stages) === undefined;
    if (isCold) setFetchState((s) => ({ ...s, loading: true, error: '' }));
    (async () => {
      try {
        // One request for the whole tournament; the browse list handles ordering/grouping.
        const resp = await getAllWorldCupStages();
        if (cancelled) return;
        const matches = Array.isArray(resp?.games) ? resp.games : [];
        writeCache(wcCacheKeys.stages, matches);
        setFetchState({ loading: false, error: '', matches });
      } catch (err) {
        if (cancelled) return;
        // Keep the cached slate on a failed revalidate; only surface the error
        // when there was nothing to show.
        setFetchState((s) => ({
          ...s,
          loading: false,
          error:
            peekCache(wcCacheKeys.stages) === undefined
              ? `Failed to fetch matches: ${err instanceof Error ? err.message : 'unknown error'}`
              : s.error,
        }));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [reloadKey]);

  const fetchMatches = useCallback(() => setReloadKey((k) => k + 1), []);

  // Live updates: re-pull every stage in the background and swap in the fresh
  // matches WITHOUT toggling the loading flag (which would blank the list) and
  // WITHOUT touching the draft. A transient failure is swallowed so the last-good
  // slate stays on screen. This is what feeds new scores, statuses, and goal/card
  // events into the rows (and their timelines) while a match is live.
  const refreshMatchesSilently = useCallback(async () => {
    try {
      const resp = await getAllWorldCupStages();
      const matches = Array.isArray(resp?.games) ? resp.games : [];
      // Keep the cache current so a tab switch mid-tournament re-seeds from the
      // latest scores/statuses, not a stale pre-kickoff slate.
      writeCache(wcCacheKeys.stages, matches);
      setFetchState((s) => ({ ...s, matches }));
    } catch {
      // Keep the existing slate; the next tick retries.
    }
  }, []);

  // Status-aware cadence: fast while any match is live, slow while matches are
  // only upcoming (to catch kickoff), and stopped once everything is final. The
  // effect keys off the interval NUMBER, so it only re-subscribes when the tier
  // actually changes — a same-tier data refresh doesn't reset the timer.
  const pollInterval = useMemo(
    () => pollIntervalFor(fetchState.matches),
    [fetchState.matches],
  );
  useEffect(() => {
    if (pollInterval == null) return;
    const id = setInterval(() => {
      // Don't poll a backgrounded tab — resume on the next tick once it's visible.
      if (typeof document !== 'undefined' && document.hidden) return;
      refreshMatchesSilently();
    }, pollInterval);
    return () => clearInterval(id);
  }, [pollInterval, refreshMatchesSilently]);

  // Clear the draft SYNCHRONOUSLY the instant the selected person changes, so
  // one member's in-progress picks can never linger on screen — and be
  // submitted — as another's. This is the airtight core of the person switch:
  // the async hydrate below repopulates from the newly-selected person, but the
  // wipe happens first, in the same commit as the selection change. Scoped to
  // selectedUserId alone (not groupId) so it never fires on the initial mount
  // or a same-person group change, preserving the existing hydrate timing.
  const prevPersonRef = useRef(selectedUserId);
  if (prevPersonRef.current !== selectedUserId) {
    prevPersonRef.current = selectedUserId;
    // Setting state during render is the documented React pattern for adjusting
    // state when a prop/derived value changes; it bails out the in-progress
    // render and re-runs before paint, so no stale draft is ever shown.
    setDraft({});
  }

  // Hydrate the draft from the SELECTED person's already-saved picks so a
  // refresh (or a person switch) doesn't blank them out. Self loads via the
  // "me" endpoint; a teammate loads via the per-user endpoint. Runs
  // independently of the stage fetch so a transient picks-endpoint failure
  // can't block the matches from rendering — the draft just stays empty.
  useEffect(() => {
    if (!groupId) {
      setDraft({});
      return;
    }
    let cancelled = false;
    const loader =
      selectedUserId == null || selectedUserId === selfId
        ? getMyWorldCupPicks(groupId)
        : getUserWorldCupPicks(groupId, selectedUserId);
    loader
      .then((resp) => {
        if (cancelled) return;
        const next: DraftMap = {};
        for (const p of resp.picks ?? []) {
          if (p && p.gameId != null && p.pickedResult) next[p.gameId] = p.pickedResult;
        }
        setDraft(next);
      })
      .catch(() => {
        // Best-effort — don't surface a toast for the silent hydrate; the user
        // can still re-pick and submit. Leaving draft as whatever it currently is.
      });
    return () => {
      cancelled = true;
    };
  }, [groupId, selectedUserId, selfId]);

  function pickResult(matchId: number, result: MatchPickResult) {
    // Airtight guard: a read-only viewer (non-admin looking at a teammate) can
    // never mutate the draft, even if a disabled control were somehow clicked.
    if (readOnly) return;
    setDraft((prev) => {
      const next = { ...prev };
      // Re-picking the selected outcome clears it; otherwise set the new outcome.
      if (next[matchId] === result) delete next[matchId];
      else next[matchId] = result;
      return next;
    });
  }

  // Derive the flat browse-list games from the fetched matches + the current
  // draft. The list itself owns view/filter/sort state; we just feed it data and
  // route picks back through pickResult.
  // Fallback knockout-only flag derived from the getMyGroups fetch (below), for
  // the standalone /world-cup page where no group object — and thus no prop — is
  // passed. The explicit prop (from GroupDetailsPage) always wins so first paint
  // is correct.
  const [derivedKnockoutOnly, setDerivedKnockoutOnly] = useState(false);
  const effectiveKnockoutOnly = knockoutOnly ?? derivedKnockoutOnly;

  // In a knockout-only group the group stage is off-limits, so drop those matches
  // before anything renders or counts them. Everything downstream (browse list,
  // empty state, submit bar) keys off this filtered view.
  const visibleMatches = useMemo(
    () =>
      effectiveKnockoutOnly
        ? fetchState.matches.filter((m) => m.stage !== 'group')
        : fetchState.matches,
    [fetchState.matches, effectiveKnockoutOnly],
  );
  const browseGames = useMemo(
    () => toBrowseGames(visibleMatches, draft),
    [visibleMatches, draft],
  );
  const now = useMemo(() => new Date(), []); // one stable "now" per mount for the list's date logic
  // "today" filtering can drift on a session left open past midnight; acceptable (server enforces locks).

  // Submittable picks come from the VISIBLE matches only. In a knockout-only group
  // this excludes any group-stage draft entry — guarding the window on the
  // standalone page where `derivedKnockoutOnly` resolves a tick after mount and a
  // group-stage game could be briefly pickable. Hidden games can't be submitted or
  // counted, so the server's group-stage rejection is never even reached.
  const visibleIds = useMemo(
    () => new Set(visibleMatches.map((m) => m.id)),
    [visibleMatches],
  );
  const picks: MatchPick[] = useMemo(
    () =>
      Object.entries(draft)
        .filter(([gameId]) => visibleIds.has(Number(gameId)))
        .map(([gameId, pickedResult]) => ({
          gameId: Number(gameId),
          pickedResult,
        })),
    [draft, visibleIds],
  );

  // Read-only viewers can never submit; everyone else needs a group + ≥1 pick.
  const canSubmit = !!groupId && picks.length > 0 && !submitting && !readOnly;

  // Multi-select "save to which World Cup groups?" — restores the heritage
  // Svelte PR #37 dropdown UX. We eagerly load the user's groups on mount so
  // the dropdown shows a real count without waiting for the first click.
  const [myGroups, setMyGroups] = useState<SaveTarget[]>([]);
  const [groupsLoading, setGroupsLoading] = useState(false);
  const [selectedTargets, setSelectedTargets] = useState<Set<string>>(
    () => new Set(groupId ? [groupId] : []),
  );

  // Re-seed the fan-out targets whenever the group changes. Without this, a
  // deep-link navigation between /world-cup?group=… URLs (same mounted
  // component, new identifier) would keep the previous group(s) selected and
  // submit picks to the wrong group.
  useEffect(() => {
    setSelectedTargets(new Set(groupId ? [groupId] : []));
  }, [groupId]);

  useEffect(() => {
    let cancelled = false;
    if (!groupId) return;
    setGroupsLoading(true);
    getMyGroups()
      .then((groups) => {
        if (cancelled) return;
        // Derive this group's knockout-only flag from the roster fetch (used only
        // when no explicit prop is supplied — e.g. the standalone /world-cup page).
        const self = groups.find((g) => g.identifier === groupId);
        if (self) setDerivedKnockoutOnly(Boolean(self.knockoutOnly));
        const wc: SaveTarget[] = groups
          .filter((g) => g.poolType === 'world_cup_2026')
          .map((g) => ({ identifier: g.identifier, name: g.name }));
        // Ensure source group is in the list even if the backend didn't return
        // it (offline-cached state, race with create-group, etc.).
        if (!wc.some((g) => g.identifier === groupId)) {
          wc.unshift({ identifier: groupId, name: groupId });
        }
        setMyGroups(wc);
      })
      .catch(() => {
        // Fall back to a single-group dropdown — the source group always works.
        if (!cancelled) setMyGroups([{ identifier: groupId, name: groupId }]);
      })
      .finally(() => {
        if (!cancelled) setGroupsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [groupId]);

  async function submit() {
    if (!groupId || picks.length === 0) return;

    // Editing a teammate is a separate, deliberately narrow path: admins only,
    // this group only, no multi-group fan-out. The two guards here are belt-and
    // suspenders — the submit button is already disabled for read-only viewers
    // and the server independently rejects non-admin cross-member writes.
    if (!viewingSelf) {
      if (readOnly || !isAdmin || !selectedUserId) {
        setToast({
          open: true,
          message: 'You can only submit your own picks.',
          variant: 'error',
        });
        return;
      }
      setSubmitting(true);
      try {
        await submitUserWorldCupPicks(groupId, selectedUserId, picks);
        setToast({
          open: true,
          message: `Saved ${selectedFirstName}'s picks`,
          variant: 'success',
        });
      } catch (err) {
        setToast({
          open: true,
          message: err instanceof Error ? err.message : 'Failed to save picks',
          variant: 'error',
        });
      } finally {
        setSubmitting(false);
      }
      return;
    }

    setSubmitting(true);
    try {
      const targets = Array.from(selectedTargets);
      if (!targets.includes(groupId)) targets.push(groupId);
      if (targets.length === 1) {
        await submitWorldCupPicks(targets[0], picks);
        setToast({ open: true, message: 'Picks saved', variant: 'success' });
        return;
      }
      const results = await Promise.allSettled(
        targets.map((id) => submitWorldCupPicks(id, picks)),
      );
      const ok = results.filter((r) => r.status === 'fulfilled').length;
      const fail = results.length - ok;
      if (fail === 0) {
        setToast({
          open: true,
          message: `Picks saved to ${ok} group${ok === 1 ? '' : 's'}`,
          variant: 'success',
        });
      } else if (ok === 0) {
        setToast({
          open: true,
          message: `Failed to save picks (0/${results.length})`,
          variant: 'error',
        });
      } else {
        setToast({
          open: true,
          message: `Saved to ${ok}/${results.length} groups (${fail} failed)`,
          variant: 'error',
        });
      }
    } catch (err) {
      setToast({
        open: true,
        message: err instanceof Error ? err.message : 'Failed to save picks',
        variant: 'error',
      });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div>
      {/* Top toolbar — the "Picking for" person selector lives here, alongside
          where context selectors belong (the NFL picker keeps its season/week
          selectors up top too). We trialled docking it in the bottom submit bar
          next to the multi-group fan-out, but placing a "whose picks" control
          right beside a "which groups" control invited exactly the accidental
          cross-writes this feature must prevent — so the person context sits at
          the top and the submit bar merely REFLECTS it. Only renders when the
          roster + caller are known (≥2 members), so the standalone /world-cup
          page and solo groups are unchanged. */}
      {showPersonSelector && selfId && selectedUserId && (
        <div className="mb-md flex flex-wrap items-center gap-sm rounded-md border border-border bg-surface p-sm">
          <span className="text-sm font-medium text-content-muted">Whose picks:</span>
          <PickPersonSelector
            members={personOptions}
            selectedId={selectedUserId}
            currentUserId={selfId}
            isAdmin={isAdmin}
            onChange={setSelectedUserId}
            disabled={submitting}
          />
        </div>
      )}

      {/* Context banner — makes the active person impossible to miss before any
          pick is touched. Three states: editing yourself (no banner), an admin
          editing a teammate (warning), or anyone viewing a teammate read-only. */}
      {adminEditingOther && (
        <div
          role="status"
          className="mb-md rounded-md border border-warning-500 bg-warning-50 p-sm text-sm text-warning-800 dark:bg-warning-900 dark:text-warning-100"
        >
          <span className="font-semibold">Admin override.</span> You are editing{' '}
          <span className="font-semibold">{selectedName}</span>&apos;s picks. Anything you submit
          replaces their saved picks for this group only.
        </div>
      )}
      {readOnly && (
        <div
          role="status"
          className="mb-md rounded-md border border-border bg-secondary-50 p-sm text-sm text-content-muted dark:bg-secondary-800"
        >
          You are viewing <span className="font-semibold">{selectedName}</span>&apos;s picks.
          They&apos;re read-only — you can only change your own.
        </div>
      )}

      {/* How scoring works — World Cup pools are flat-per-match (no confidence)
          and the group and knockout stages score differently, so the rules
          aren't obvious from the Home/Draw/Away row alone. */}
      <div className="mb-lg rounded-md border border-border bg-surface p-sm text-sm text-content-muted">
        <p>
          Pick an outcome for every match — there&apos;s no confidence ranking, and your score is
          the sum across every match you pick.
        </p>
        <ul className="mt-xs list-disc space-y-xxs pl-lg">
          {/* This is a knockout-only group, so the group-stage scoring line is
              omitted — those games can't be picked here. */}
          {!effectiveKnockoutOnly && (
            <li>
              <span className="font-medium text-secondary-900 dark:text-neutral-0">Group stage:</span>{' '}
              winning team = 3 pts · a team that draws = 1 · pick &ldquo;Draw&rdquo; = 2 if it draws (1
              if a team wins) · losing team = 0.
            </li>
          )}
          <li>
            <span className="font-medium text-secondary-900 dark:text-neutral-0">Knockout:</span>{' '}
            the team that advances = 3 pts, everyone else = 0. Penalties still count as advancing, so
            there&apos;s no &ldquo;Draw&rdquo; option — just the two teams.
          </li>
        </ul>
      </div>

      {/* Flat browse list */}
      <div className="space-y-lg">
        {fetchState.loading ? (
          <p className="py-lg text-center text-content-muted">Loading matches…</p>
        ) : fetchState.error ? (
          <div className="flex flex-col items-center gap-sm py-lg text-center">
            <p className="text-sm text-error-600 dark:text-error-400">{fetchState.error}</p>
            <Button variant="secondary" size="sm" onClick={() => fetchMatches()}>
              Try Again
            </Button>
          </div>
        ) : visibleMatches.length === 0 ? (
          <EmptyState
            title="No matches yet"
            description={
              effectiveKnockoutOnly
                ? 'No knockout matches are available yet. They appear once the bracket is set.'
                : 'No matches found for this tournament.'
            }
          />
        ) : (
          <WorldCupGamesList
            games={browseGames}
            now={now}
            onPick={pickResult}
            disabled={submitting || readOnly}
            initialView={initialView}
          />
        )}
      </div>

      {/* Spacer so the sticky bar never covers the last match row. */}
      {visibleMatches.length > 0 && <div className="h-20" aria-hidden="true" />}

      {/* Sticky submit bar — pinned to the bottom of the viewport so the user
          can submit from anywhere in the stage list without scrolling to the
          end. It lives inside this component, so it appears when the picks
          surface mounts (e.g. entering the group's Picks tab) and disappears
          when it unmounts. The negative margins cancel the px-sm/sm:px-lg
          gutters both host pages use, so the bar spans edge-to-edge. z-20
          keeps it above the list's sticky search/filter controls (z-10) as the
          two bars cross while scrolling, but below the match detail panel
          (z-40) — so the filter bar reads as tethered to the content sliding
          under it while this bar floats cleanly on top. */}
      {visibleMatches.length > 0 && (
        <div className="sticky bottom-0 z-20 -mx-sm sm:-mx-lg mt-lg border-t border-border bg-neutral-0/95 px-sm sm:px-lg py-sm shadow-[0_-2px_8px_-2px_rgba(0,0,0,0.06)] backdrop-blur dark:bg-secondary-900/95">
          <div className="mx-auto flex max-w-4xl flex-col gap-sm sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-col gap-xxs sm:flex-row sm:items-center sm:gap-md">
              <span className="text-sm text-content-muted">
                {/* When editing/viewing a teammate, name them so the count is
                    never mistaken for the caller's own picks. */}
                {!viewingSelf && (
                  <span className="mr-xs font-semibold text-secondary-900 dark:text-neutral-0">
                    {selectedFirstName}:
                  </span>
                )}
                {picks.length} pick{picks.length === 1 ? '' : 's'} selected
              </span>
              {/* The multi-group fan-out is ONLY offered when picking for
                  yourself. An admin override targets one member in one group —
                  fanning another person's picks across groups they may not even
                  belong to is never what's intended, so the dropdown is replaced
                  with a scoped note. */}
              {groupId && viewingSelf && (
                <SaveTargetsDropdown
                  groups={myGroups}
                  sourceIdentifier={groupId}
                  selected={selectedTargets}
                  onChange={setSelectedTargets}
                  label="World Cup"
                  loading={groupsLoading}
                  disabled={submitting}
                />
              )}
              {adminEditingOther && (
                <span className="text-xs text-content-muted">Saved to this group only</span>
              )}
            </div>
            <div className="relative inline-toast-anchor">
              <InlineToast
                open={toast.open}
                message={toast.message}
                variant={toast.variant}
                onClose={() => setToast((t) => ({ ...t, open: false }))}
              />
              {readOnly ? (
                // No write affordance at all for a read-only viewer — there is
                // simply no submit button to click.
                <span className="text-sm italic text-content-muted">View only</span>
              ) : (
                <Button
                  variant="primary"
                  size="md"
                  loading={submitting}
                  disabled={!canSubmit}
                  onClick={submit}
                >
                  {submitting
                    ? 'Saving…'
                    : adminEditingOther
                      ? `Save ${selectedFirstName}'s Picks`
                      : selectedTargets.size > 1
                        ? `Submit to ${selectedTargets.size}`
                        : 'Submit Picks'}
                </Button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
