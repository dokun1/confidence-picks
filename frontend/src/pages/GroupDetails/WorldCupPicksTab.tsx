import { useCallback, useEffect, useMemo, useState } from 'react';
import Button from '../../designsystem/components/Button';
import InlineToast from '../../designsystem/components/InlineToast';
import type { ToastVariant } from '../../designsystem/components/InlineToast/InlineToast';
import MatchPickRow from '../../designsystem/components/MatchPickRow';
import {
  WORLD_CUP_STAGES,
  type MatchPick,
  type MatchPickResult,
  type WorldCupMatch,
  type WorldCupStage,
} from '../../lib/types';
import {
  getStageMatches,
  submitWorldCupPicks,
  getMyWorldCupPicks,
} from '../../lib/worldCupService.js';
import { getMyGroups } from '../../lib/groupsService.js';
import SaveTargetsDropdown, { type SaveTarget } from '../../components/SaveTargetsDropdown';

// The World Cup pick-making surface: the whole tournament as one stage-grouped
// match list with a sticky submit bar. Extracted from WorldCupPicksPage so a
// world_cup_2026 group's Picks tab embeds the SAME experience inline — the bar
// mounts with the tab and unmounts when the user switches away. The page route
// (/world-cup) renders this component too, so deep links keep working.
//
// A member's picks are flat (home/away/draw) with no confidence — World Cup
// scoring is flat-per-match (see world-cup-picks-rules.md). Every stage is
// fetched in parallel and the flattened matches are grouped back by stage for
// rendering, iterating WORLD_CUP_STAGES so sections appear in tournament order
// regardless of fetch resolution order.

// Section header labels per stage.
const STAGE_LABEL: Record<WorldCupStage, string> = {
  group: 'Group Stage',
  r32: 'Round of 32',
  r16: 'Round of 16',
  qf: 'Quarterfinals',
  sf: 'Semifinals',
  third: 'Third Place',
  final: 'Final',
};

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

export interface WorldCupPicksTabProps {
  /** Group identifier; doubles as the submit target for submitWorldCupPicks. */
  identifier: string;
}

export default function WorldCupPicksTab({ identifier }: WorldCupPicksTabProps) {
  const groupId = identifier;

  const [fetchState, setFetchState] = useState<FetchState>({
    loading: false,
    error: '',
    matches: [],
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
    setFetchState((s) => ({ ...s, loading: true, error: '' }));
    (async () => {
      try {
        // Fetch every stage in parallel; flatten into one list and group by stage
        // at render time so the sections follow WORLD_CUP_STAGES order.
        const responses = await Promise.all(WORLD_CUP_STAGES.map((stage) => getStageMatches(stage)));
        if (cancelled) return;
        const matches = responses.flatMap((r) => (Array.isArray(r?.games) ? r.games : []));
        setFetchState({ loading: false, error: '', matches });
      } catch (err) {
        if (cancelled) return;
        setFetchState((s) => ({
          ...s,
          loading: false,
          error: `Failed to fetch matches: ${err instanceof Error ? err.message : 'unknown error'}`,
        }));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [reloadKey]);

  const fetchMatches = useCallback(() => setReloadKey((k) => k + 1), []);

  // Hydrate the draft from the user's already-saved picks on this group so
  // a refresh doesn't blank them out. Runs independently of the stage fetch
  // so a transient picks-endpoint failure can't block the matches from
  // rendering — the draft just stays empty in that case.
  useEffect(() => {
    if (!groupId) {
      setDraft({});
      return;
    }
    let cancelled = false;
    getMyWorldCupPicks(groupId)
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
  }, [groupId]);

  function pickResult(matchId: number, result: MatchPickResult) {
    setDraft((prev) => {
      const next = { ...prev };
      // Re-picking the selected outcome clears it; otherwise set the new outcome.
      if (next[matchId] === result) delete next[matchId];
      else next[matchId] = result;
      return next;
    });
  }

  // Group the flattened matches by stage, preserving tournament order. Only
  // stages with at least one match produce a section.
  const stageGroups = useMemo(
    () =>
      WORLD_CUP_STAGES.map((stage) => ({
        stage,
        matches: fetchState.matches.filter((m) => m.stage === stage),
      })).filter((g) => g.matches.length > 0),
    [fetchState.matches],
  );

  const picks: MatchPick[] = useMemo(
    () =>
      Object.entries(draft).map(([gameId, pickedResult]) => ({
        gameId: Number(gameId),
        pickedResult,
      })),
    [draft],
  );

  const canSubmit = !!groupId && picks.length > 0 && !submitting;

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
      {/* How scoring works — World Cup pools are flat-per-match (no confidence)
          and the group and knockout stages score differently, so the rules
          aren't obvious from the Home/Draw/Away row alone. */}
      <div className="mb-lg rounded-md border border-border bg-surface p-sm text-sm text-secondary">
        <p>
          Pick an outcome for every match — there&apos;s no confidence ranking, and your score is
          the sum across every match you pick.
        </p>
        <ul className="mt-xs list-disc space-y-xxs pl-lg">
          <li>
            <span className="font-medium text-secondary-900 dark:text-neutral-0">Group stage:</span>{' '}
            winning team = 3 pts · a team that draws = 1 · pick &ldquo;Draw&rdquo; = 2 if it draws (1
            if a team wins) · losing team = 0.
          </li>
          <li>
            <span className="font-medium text-secondary-900 dark:text-neutral-0">Knockout:</span>{' '}
            the team that advances = 3 pts, everyone else = 0. Penalties still count as advancing, so
            &ldquo;Draw&rdquo; is disabled.
          </li>
        </ul>
      </div>

      {/* Match list, grouped by stage */}
      <div className="space-y-lg">
        {fetchState.loading ? (
          <p className="py-lg text-center text-secondary">Loading matches…</p>
        ) : fetchState.error ? (
          <div className="flex flex-col items-center gap-sm py-lg text-center">
            <p className="text-sm text-error-600 dark:text-error-400">{fetchState.error}</p>
            <Button variant="secondary" size="sm" onClick={() => fetchMatches()}>
              Try Again
            </Button>
          </div>
        ) : fetchState.matches.length === 0 ? (
          <p className="py-lg text-center text-secondary">No matches found for this tournament.</p>
        ) : (
          stageGroups.map((group) => (
            <section key={group.stage} className="space-y-sm">
              <h2 className="text-lg font-semibold text-secondary-900 dark:text-neutral-0">
                {STAGE_LABEL[group.stage]}
              </h2>
              {group.matches.map((match) => (
                <MatchPickRow
                  key={match.id}
                  match={match}
                  pickedResult={draft[match.id] ?? null}
                  disabled={submitting}
                  onPick={(result) => pickResult(match.id, result)}
                />
              ))}
            </section>
          ))
        )}
      </div>

      {/* Spacer so the sticky bar never covers the last match row. */}
      {fetchState.matches.length > 0 && <div className="h-20" aria-hidden="true" />}

      {/* Sticky submit bar — pinned to the bottom of the viewport so the user
          can submit from anywhere in the stage list without scrolling to the
          end. It lives inside this component, so it appears when the picks
          surface mounts (e.g. entering the group's Picks tab) and disappears
          when it unmounts. The negative margins cancel the px-sm/sm:px-lg
          gutters both host pages use, so the bar spans edge-to-edge. */}
      {fetchState.matches.length > 0 && (
        <div className="sticky bottom-0 -mx-sm sm:-mx-lg mt-lg border-t border-border bg-neutral-0/95 px-sm sm:px-lg py-sm shadow-[0_-2px_8px_-2px_rgba(0,0,0,0.06)] backdrop-blur dark:bg-secondary-900/95">
          <div className="mx-auto flex max-w-4xl flex-col gap-sm sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-col gap-xxs sm:flex-row sm:items-center sm:gap-md">
              <span className="text-sm text-secondary">
                {picks.length} pick{picks.length === 1 ? '' : 's'} selected
              </span>
              {groupId && (
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
            </div>
            <div className="relative inline-toast-anchor">
              <InlineToast
                open={toast.open}
                message={toast.message}
                variant={toast.variant}
                onClose={() => setToast((t) => ({ ...t, open: false }))}
              />
              <Button
                variant="primary"
                size="md"
                loading={submitting}
                disabled={!canSubmit}
                onClick={submit}
              >
                {submitting
                  ? 'Saving…'
                  : selectedTargets.size > 1
                    ? `Submit to ${selectedTargets.size}`
                    : 'Submit Picks'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
