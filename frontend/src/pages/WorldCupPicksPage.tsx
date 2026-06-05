import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import Button from '../designsystem/components/Button';
import InlineToast from '../designsystem/components/InlineToast';
import type { ToastVariant } from '../designsystem/components/InlineToast/InlineToast';
import MatchPickRow from '../designsystem/components/MatchPickRow';
import {
  WORLD_CUP_STAGES,
  type MatchPick,
  type MatchPickResult,
  type WorldCupMatch,
  type WorldCupStage,
} from '../lib/types';
import { getStageMatches, submitWorldCupPicks } from '../lib/worldCupService.js';
import { getMyGroups } from '../lib/groupsService.js';

// World Cup sibling of GamesPage. A world_cup_2026 pool renders the WHOLE
// tournament as one stage-grouped match list — there is NO week selector. The
// group identifier comes from the `group` query param (mirrors
// GroupDetailsPage), and a member's picks are flat (home/away/draw) with no
// confidence — World Cup scoring is flat-per-match (see
// world-cup-picks-rules.md).
//
// We fetch every stage in parallel and group the flattened matches back by
// stage for rendering, iterating WORLD_CUP_STAGES so sections appear in
// tournament order regardless of fetch resolution order.

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

interface PageState {
  loading: boolean;
  error: string;
  matches: WorldCupMatch[];
}

interface ToastState {
  open: boolean;
  message: string;
  variant: ToastVariant;
}

// Shared not-found UI, mirroring GroupDetailsPage: shown when the `group` query
// param is absent so the user always lands on a single recoverable error with a
// route back to the groups list.
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

export default function WorldCupPicksPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const identifier = searchParams.get('group');
  // The group identifier doubles as the submit target — submitWorldCupPicks
  // keys off the same value GroupDetailsPage resolves from `?group=`.
  const groupId = identifier;

  const [pageState, setPageState] = useState<PageState>({
    loading: false,
    error: '',
    matches: [],
  });
  const [draft, setDraft] = useState<DraftMap>({});
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState<ToastState>({ open: false, message: '', variant: 'info' });

  const fetchMatches = useCallback(async () => {
    setPageState((s) => ({ ...s, loading: true, error: '' }));
    try {
      // Fetch every stage in parallel; flatten into one list and group by stage
      // at render time so the sections follow WORLD_CUP_STAGES order.
      const responses = await Promise.all(WORLD_CUP_STAGES.map((stage) => getStageMatches(stage)));
      const matches = responses.flatMap((r) => (Array.isArray(r?.games) ? r.games : []));
      setPageState({ loading: false, error: '', matches });
      // A fresh load starts with an empty draft — the public stage endpoint
      // carries no per-user pick to prefill.
      setDraft({});
    } catch (err) {
      setPageState((s) => ({
        ...s,
        loading: false,
        error: `Failed to fetch matches: ${err instanceof Error ? err.message : 'unknown error'}`,
      }));
    }
  }, []);

  useEffect(() => {
    if (!identifier) return;
    fetchMatches();
  }, [identifier, fetchMatches]);

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
        matches: pageState.matches.filter((m) => m.stage === stage),
      })).filter((g) => g.matches.length > 0),
    [pageState.matches],
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

  // Opt-in "save these picks to every World Cup group I'm in" toggle. Mirrors
  // the heritage Svelte 'save for all groups' UX (PR #37, Aug 2025) that the
  // React rewrite dropped. Backend has no fan-out endpoint; we iterate the
  // user's groups client-side and submit per group.
  const [applyToAll, setApplyToAll] = useState(false);

  async function submit() {
    if (!groupId || picks.length === 0) return;
    setSubmitting(true);
    try {
      if (!applyToAll) {
        await submitWorldCupPicks(groupId, picks);
        setToast({ open: true, message: 'Picks saved', variant: 'success' });
        return;
      }

      // Fan-out: every World Cup group the user belongs to. Always include the
      // current `groupId` (the source group) — getMyGroups should list it, but
      // if for some reason it doesn't, we still want a single-group save to
      // succeed rather than silently no-op.
      const groups = await getMyGroups();
      const targets = groups
        .filter((g) => g.poolType === 'world_cup_2026')
        .map((g) => g.identifier);
      if (!targets.includes(groupId)) targets.push(groupId);

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

  // No identifier in the query string: nothing to load, show the error UI early.
  if (!identifier) {
    return (
      <GroupNotFound message="No group was specified." onBack={() => navigate('/groups')} />
    );
  }

  return (
    <div className="mx-auto max-w-4xl p-lg">
      <h1 className="text-2xl font-bold text-secondary-900 dark:text-neutral-0">
        World Cup 2026 Picks
      </h1>

      {/* Match list, grouped by stage */}
      <div className="mt-lg space-y-lg">
        {pageState.loading ? (
          <p className="py-lg text-center text-secondary">Loading matches…</p>
        ) : pageState.error ? (
          <div className="flex flex-col items-center gap-sm py-lg text-center">
            <p className="text-sm text-error-600 dark:text-error-400">{pageState.error}</p>
            <Button variant="secondary" size="sm" onClick={() => fetchMatches()}>
              Try Again
            </Button>
          </div>
        ) : pageState.matches.length === 0 ? (
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

      {/* Submit bar */}
      {pageState.matches.length > 0 && (
        <div className="mt-lg flex flex-col gap-sm border-t border-border pt-md sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-col gap-xxs sm:flex-row sm:items-center sm:gap-md">
            <span className="text-sm text-secondary">
              {picks.length} pick{picks.length === 1 ? '' : 's'} selected
            </span>
            <label className="flex items-center gap-xs text-sm text-secondary">
              <input
                type="checkbox"
                checked={applyToAll}
                onChange={(e) => setApplyToAll(e.target.checked)}
                aria-label="Save to all my World Cup groups"
                className="h-4 w-4"
              />
              Save to all my World Cup groups
            </label>
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
              {submitting ? 'Saving…' : applyToAll ? 'Submit to All' : 'Submit Picks'}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
