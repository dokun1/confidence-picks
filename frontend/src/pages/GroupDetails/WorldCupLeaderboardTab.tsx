import { useCallback, useEffect, useState } from 'react';
import TournamentLeaderboard from '../../designsystem/components/TournamentLeaderboard';
import type { TournamentLeaderboardRow } from '../../lib/types';
import { getWorldCupLeaderboard } from '../../lib/worldCupService.js';

export interface WorldCupLeaderboardTabProps {
  /** Group identifier; the leaderboard fetch keys off the same `?group=` value. */
  identifier: string;
}

// World Cup variant of the Leaderboard tab. Owns its own fetch (mirrors PicksTab)
// so the page shell stays agnostic to pool type. Renders the tournament-shaped
// TournamentLeaderboard with the four tiebreaker columns; rows arrive already
// ordered by the backend comparator and are never re-sorted here.
export default function WorldCupLeaderboardTab({ identifier }: WorldCupLeaderboardTabProps) {
  const [rows, setRows] = useState<TournamentLeaderboardRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const resp = await getWorldCupLeaderboard(identifier);
      setRows(Array.isArray(resp?.leaderboard) ? resp.leaderboard : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load leaderboard');
    } finally {
      setLoading(false);
    }
  }, [identifier]);

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
