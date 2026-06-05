import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ArrowPathIcon } from '@heroicons/react/24/outline';
import Button from '../designsystem/components/Button';
import InlineToast from '../designsystem/components/InlineToast';
import type { ToastVariant } from '../designsystem/components/InlineToast/InlineToast';
import GamePickRow, { type DraftPick, type PickGame } from '../components/GamePickRow';
import AuthService from '../lib/authService.js';
import { getCurrentNFLSeason } from '../lib/nflSeasonUtils.js';
import { savePicks } from '../lib/picksService.js';
import { getMyGroups } from '../lib/groupsService.js';

// Ported from GamesPage.svelte + GamePickRow.svelte (commit d6b2566^). The page
// owns the year/season-type/week selector, fetches the public games endpoint,
// renders one GamePickRow per game, and submits picks to a group.
//
// Group context: the Svelte source threaded the active group via App.svelte's
// currentGroupContext. The React port reads it from the `groupId` query param
// (?groupId=...) — see GroupDetailsPage's useSearchParams pattern. Without a
// groupId the games still render but picks cannot be saved (the submit control
// is disabled with an explanatory hint).

// ESPN numeric season types. 1 = Preseason, 2 = Regular season. Week count is
// derived per season type so the week selector never offers an invalid week.
const SEASON_TYPE_META: Record<number, { label: string; weeks: number }> = {
  1: { label: 'Preseason', weeks: 4 },
  2: { label: 'Regular Season', weeks: 18 },
};

type DraftMap = Record<number, DraftPick>;

interface PageState {
  loading: boolean;
  error: string;
  games: PickGame[];
}

interface ToastState {
  open: boolean;
  message: string;
  variant: ToastVariant;
}

/** Build the small year range offered by the selector around the current season. */
function yearOptions(currentSeason: number): number[] {
  return [currentSeason - 2, currentSeason - 1, currentSeason];
}

export default function GamesPage() {
  const [searchParams] = useSearchParams();
  const groupId = searchParams.get('groupId');

  const currentSeason = useMemo(() => getCurrentNFLSeason(), []);
  const [year, setYear] = useState(currentSeason);
  const [seasonType, setSeasonType] = useState(2);
  const [week, setWeek] = useState(1);

  const [pageState, setPageState] = useState<PageState>({ loading: false, error: '', games: [] });
  const [draft, setDraft] = useState<DraftMap>({});
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState<ToastState>({ open: false, message: '', variant: 'info' });

  const totalWeeks = SEASON_TYPE_META[seasonType]?.weeks ?? 18;

  // Switching from a longer season type to a shorter one can leave `week` out of
  // range; clamp it back to week 1 just as the Svelte reactive block did.
  useEffect(() => {
    if (week > totalWeeks) setWeek(1);
  }, [totalWeeks, week]);

  const fetchGames = useCallback(
    async (force = false) => {
      setPageState((s) => ({ ...s, loading: true, error: '' }));
      try {
        const base = AuthService.getApiBaseUrl();
        const res = await fetch(
          `${base}/api/games/${year}/${seasonType}/${week}?force=${force}`,
        );
        if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
        const data = await res.json();
        const games: PickGame[] = Array.isArray(data?.games) ? data.games : [];
        setPageState({ loading: false, error: '', games });
        // A fresh week starts with an empty draft — the public endpoint carries
        // no per-user pick to prefill.
        setDraft({});
      } catch (err) {
        setPageState((s) => ({
          ...s,
          loading: false,
          error: `Failed to fetch games: ${err instanceof Error ? err.message : 'unknown error'}`,
        }));
      }
    },
    [year, seasonType, week],
  );

  // Load on mount and whenever the selector changes.
  useEffect(() => {
    fetchGames();
  }, [fetchGames]);

  // N for the confidence range is the number of games in the loaded week.
  const totalGames = pageState.games.length;

  /** Confidence values taken by games OTHER than `gameId`. Drives duplicate prevention. */
  const usedConfidencesExcept = useCallback(
    (gameId: number): Set<number> => {
      const set = new Set<number>();
      for (const [gid, val] of Object.entries(draft)) {
        if (Number(gid) === gameId) continue;
        if (val.confidence != null) set.add(val.confidence);
      }
      return set;
    },
    [draft],
  );

  function toggleWinner(gameId: number, teamId: number) {
    setDraft((prev) => {
      const next = { ...prev };
      const cur = next[gameId] ?? { pickedTeamId: null, confidence: null };
      const teamNum = Number(teamId);
      if (cur.pickedTeamId === teamNum) {
        // Re-clicking the selected team deselects it; drop the row if nothing else is set.
        if (cur.confidence == null) delete next[gameId];
        else next[gameId] = { ...cur, pickedTeamId: null };
      } else {
        next[gameId] = { ...cur, pickedTeamId: teamNum };
      }
      return next;
    });
  }

  function assignConfidence(gameId: number, value: number | null) {
    setDraft((prev) => {
      const next: DraftMap = { ...prev };
      // Release this value from whatever other game currently holds it (override),
      // keeping that game's winner so the user can reassign it. This — together
      // with GamePickRow's allowedConfidences filter — keeps each value unique.
      if (value != null) {
        for (const [gid, val] of Object.entries(next)) {
          if (Number(gid) === gameId) continue;
          if (val.confidence === value) {
            if (val.pickedTeamId == null) delete next[Number(gid)];
            else next[Number(gid)] = { ...val, confidence: null };
          }
        }
      }
      const cur = next[gameId] ?? { pickedTeamId: null, confidence: null };
      const updated = { ...cur, confidence: value };
      if (value == null && updated.pickedTeamId == null) delete next[gameId];
      else next[gameId] = updated;
      return next;
    });
  }

  function clearPick(gameId: number) {
    setDraft((prev) => {
      const next = { ...prev };
      delete next[gameId];
      return next;
    });
  }

  const completePicks = useMemo(
    () =>
      Object.entries(draft)
        .filter(([, v]) => v.pickedTeamId != null && v.confidence != null)
        .map(([gameId, v]) => ({
          gameId: Number(gameId),
          pickedTeamId: v.pickedTeamId as number,
          confidence: v.confidence as number,
        })),
    [draft],
  );

  const hasIncomplete = useMemo(
    () =>
      Object.values(draft).some(
        (v) =>
          (v.pickedTeamId != null && v.confidence == null) ||
          (v.pickedTeamId == null && v.confidence != null),
      ),
    [draft],
  );

  const canSubmit = !!groupId && completePicks.length > 0 && !submitting && !pageState.loading;

  // Opt-in "save these picks to every NFL group I'm in" toggle. Restores the
  // heritage Svelte 'save for all groups' UX (PR #37, Aug 2025) that the React
  // rewrite dropped. NFL pools include groups with poolType 'nfl_weekly' AND
  // legacy groups created before #86 where poolType is null.
  const [applyToAll, setApplyToAll] = useState(false);

  async function submit() {
    if (!groupId) return;
    // Client-side guard: each confidence value must be used at most once. The UI
    // already prevents duplicates, so this is a defensive check (server enforces too).
    const seen = new Set<number>();
    for (const p of completePicks) {
      if (seen.has(p.confidence)) {
        setToast({
          open: true,
          message: `Confidence ${p.confidence} is used more than once.`,
          variant: 'error',
        });
        return;
      }
      seen.add(p.confidence);
    }

    const body = {
      season: year,
      seasonType,
      week,
      picks: completePicks,
      clearedGameIds: [],
    };

    setSubmitting(true);
    try {
      if (!applyToAll) {
        await savePicks(groupId, body);
        setToast({ open: true, message: 'Picks saved', variant: 'success' });
        return;
      }

      // Fan-out: every NFL group the user belongs to. Treat null poolType
      // (legacy groups predating the WC migration) as NFL.
      const groups = await getMyGroups();
      const targets = groups
        .filter((g) => g.poolType !== 'world_cup_2026')
        .map((g) => g.identifier);
      if (!targets.includes(groupId)) targets.push(groupId);

      const results = await Promise.allSettled(targets.map((id) => savePicks(id, body)));
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
    <div className="mx-auto max-w-4xl p-lg">
      <h1 className="text-2xl font-bold text-secondary-900 dark:text-neutral-0">NFL Games</h1>

      {/* Selector controls */}
      <div className="mt-md flex flex-wrap items-end gap-md rounded-md border border-border bg-surface p-md">
        <label className="flex flex-col gap-xxs text-sm">
          <span className="font-medium text-secondary">Year</span>
          <select
            aria-label="Year"
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
            className="rounded-base border border-border bg-neutral-0 px-sm py-xs dark:bg-secondary-800"
          >
            {yearOptions(currentSeason).map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-xxs text-sm">
          <span className="font-medium text-secondary">Season</span>
          <select
            aria-label="Season type"
            value={seasonType}
            onChange={(e) => setSeasonType(Number(e.target.value))}
            className="rounded-base border border-border bg-neutral-0 px-sm py-xs dark:bg-secondary-800"
          >
            {Object.entries(SEASON_TYPE_META).map(([value, meta]) => (
              <option key={value} value={value}>
                {meta.label}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-xxs text-sm">
          <span className="font-medium text-secondary">Week</span>
          <select
            aria-label="Week"
            value={week}
            onChange={(e) => setWeek(Number(e.target.value))}
            className="rounded-base border border-border bg-neutral-0 px-sm py-xs dark:bg-secondary-800"
          >
            {Array.from({ length: totalWeeks }, (_, i) => i + 1).map((w) => (
              <option key={w} value={w}>
                Week {w}
              </option>
            ))}
          </select>
        </label>

        <Button
          variant="primary"
          size="md"
          loading={pageState.loading}
          disabled={pageState.loading}
          onClick={() => fetchGames(false)}
        >
          {pageState.loading ? 'Loading…' : 'Load Games'}
        </Button>

        <Button
          variant="tertiary"
          size="md"
          aria-label="Refresh games"
          title="Refresh (bypass cache)"
          disabled={pageState.loading}
          onClick={() => fetchGames(true)}
        >
          <ArrowPathIcon className="h-5 w-5" />
        </Button>
      </div>

      {!groupId && (
        <p className="mt-md rounded-md border border-warning-500 bg-warning-50 p-sm text-sm text-warning-700 dark:bg-warning-900 dark:text-warning-200">
          No group selected — add <code>?groupId=&lt;identifier&gt;</code> to the URL to save picks.
          Games are shown for reference only.
        </p>
      )}

      {/* Games list */}
      <div className="mt-lg space-y-sm">
        {pageState.loading ? (
          <p className="py-lg text-center text-secondary">Loading games…</p>
        ) : pageState.error ? (
          <div className="flex flex-col items-center gap-sm py-lg text-center">
            <p className="text-sm text-error-600 dark:text-error-400">{pageState.error}</p>
            <Button variant="secondary" size="sm" onClick={() => fetchGames(false)}>
              Try Again
            </Button>
          </div>
        ) : pageState.games.length === 0 ? (
          <p className="py-lg text-center text-secondary">No games found for this week.</p>
        ) : (
          pageState.games.map((game) => (
            <GamePickRow
              key={game.id}
              game={game}
              pick={draft[game.id] ?? null}
              totalGames={totalGames}
              usedConfidences={usedConfidencesExcept(game.id)}
              disabled={submitting}
              onToggleWinner={(teamId) => toggleWinner(game.id, teamId)}
              onAssignConfidence={(value) => assignConfidence(game.id, value)}
              onClearPick={() => clearPick(game.id)}
            />
          ))
        )}
      </div>

      {/* Submit bar */}
      {pageState.games.length > 0 && (
        <div className="mt-lg flex flex-col gap-sm border-t border-border pt-md sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-col gap-xxs text-sm text-secondary sm:flex-row sm:items-center sm:gap-md">
            <span>
              {completePicks.length} of {totalGames} pick{totalGames === 1 ? '' : 's'} complete
              {hasIncomplete && (
                <span className="ml-sm text-warning-600 dark:text-warning-400">
                  Finish selecting a winner and confidence for highlighted games.
                </span>
              )}
            </span>
            <label className="flex items-center gap-xs">
              <input
                type="checkbox"
                checked={applyToAll}
                onChange={(e) => setApplyToAll(e.target.checked)}
                aria-label="Save to all my NFL groups"
                className="h-4 w-4"
              />
              Save to all my NFL groups
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
