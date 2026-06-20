import { useCallback, useEffect, useState } from 'react';
import TournamentLeaderboard from '../../designsystem/components/TournamentLeaderboard';
import type { TournamentLeaderboardRow } from '../../lib/types';
import { getWorldCupLeaderboard } from '../../lib/worldCupService.js';
import { peekCache, writeCache, wcCacheKeys } from '../../lib/worldCupCache';

export interface WorldCupLeaderboardTabProps {
  /** Group identifier; the leaderboard fetch keys off the same `?group=` value. */
  identifier: string;
}

// World Cup variant of the Leaderboard tab. Owns its own fetch (mirrors PicksTab)
// so the page shell stays agnostic to pool type. Renders the tournament-shaped
// TournamentLeaderboard with the four tiebreaker columns; rows arrive already
// ordered by the backend comparator and are never re-sorted here.
//
// Stale-while-revalidate: the tab unmounts on every tab switch, so the rows are
// cached per group and seeded synchronously on mount. A warm cache paints the
// last-known standings instantly and refreshes silently in the background; only
// a cold (first-ever) load shows the "Loading…" blank.
export default function WorldCupLeaderboardTab({ identifier }: WorldCupLeaderboardTabProps) {
  const cacheKey = wcCacheKeys.leaderboard(identifier);
  const cached = peekCache<TournamentLeaderboardRow[]>(cacheKey);
  const [rows, setRows] = useState<TournamentLeaderboardRow[]>(cached ?? []);
  const [loading, setLoading] = useState(cached === undefined);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    // Only block with the spinner on a cold load; a warm cache revalidates
    // silently so the standings never flash empty on a tab switch.
    const isCold = peekCache(cacheKey) === undefined;
    if (isCold) setLoading(true);
    setError(null);
    try {
      const resp = await getWorldCupLeaderboard(identifier);
      const next = Array.isArray(resp?.leaderboard) ? resp.leaderboard : [];
      writeCache(cacheKey, next);
      setRows(next);
    } catch (err) {
      // Keep showing the cached standings on a failed revalidate; only surface
      // the error when there was nothing to fall back to.
      if (peekCache(cacheKey) === undefined) {
        setError(err instanceof Error ? err.message : 'Failed to load leaderboard');
      }
    } finally {
      setLoading(false);
    }
  }, [identifier, cacheKey]);

  useEffect(() => {
    load();
  }, [load]);

  // Rendered bare (no card, no "Leaderboard" heading): the active tab already
  // names the section, and the table spans the page container's full width.
  return (
    <div>
      {loading ? (
        <p className="text-content-muted">Loading leaderboard…</p>
      ) : error ? (
        <p className="text-error-600 dark:text-error-400">{error}</p>
      ) : (
        <TournamentLeaderboard rows={rows} />
      )}
    </div>
  );
}
