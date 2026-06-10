import { useCallback, useEffect, useState } from 'react';
import Avatar from '../../designsystem/components/Avatar';
import Button from '../../designsystem/components/Button';
import { getScoreboard } from '../../lib/picksService.js';
import type { ScoreboardUser } from '../../lib/picksService';
import { useSeasonOptions } from './useSeasonOptions';

// Regular season; mirrors PicksTab's constant.
const SEASON_TYPE = 2;

export interface LeaderboardTabProps {
  /** Group identifier, used to fetch the scoreboard for the selected season. */
  identifier: string;
}

/**
 * NFL leaderboard tab, ported from the Svelte GroupDetailsPage leaderboard card
 * (commit 98a5782^). Owns its own fetch like WorldCupLeaderboardTab: resolves
 * the group's seasons (defaulting to the newest one with pick data so old
 * groups keep their scores visible during the offseason), fetches the
 * scoreboard for the selected season, and renders the ranked standings plus a
 * per-week points breakdown.
 */
export default function LeaderboardTab({ identifier }: LeaderboardTabProps) {
  const { options, season, setSeason, resolved } = useSeasonOptions(identifier);
  const [users, setUsers] = useState<ScoreboardUser[]>([]);
  const [weeks, setWeeks] = useState<number[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (season == null) return;
    setLoading(true);
    setError(null);
    try {
      const data = await getScoreboard(identifier, { season, seasonType: SEASON_TYPE });
      const sorted = (Array.isArray(data?.users) ? data.users : [])
        .slice()
        .sort((a, b) => b.totalPoints - a.totalPoints);
      setUsers(sorted);
      setWeeks(Array.isArray(data?.weeks) ? data.weeks : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load leaderboard');
    } finally {
      setLoading(false);
    }
  }, [identifier, season]);

  useEffect(() => {
    load();
  }, [load]);

  if (!resolved || (loading && users.length === 0 && !error)) {
    return <p className="text-[var(--color-text-secondary)]">Loading leaderboard…</p>;
  }

  return (
    <div className="space-y-md">
      {/* Season selector + refresh */}
      <div className="flex flex-wrap items-center gap-sm">
        <select
          aria-label="Select season"
          value={season ?? ''}
          onChange={(e) => setSeason(Number(e.target.value))}
          className="px-sm py-xs border border-secondary-200 dark:border-secondary-700 rounded bg-neutral-0 dark:bg-secondary-800 text-[var(--color-text-primary)]"
        >
          {options.map((s) => (
            <option key={s} value={s}>
              {s} Season
            </option>
          ))}
        </select>
        <Button variant="tertiary" size="sm" onClick={load} disabled={loading}>
          {loading ? 'Loading…' : 'Refresh'}
        </Button>
      </div>

      {error ? (
        <p className="text-sm text-error-600 dark:text-error-400">{error}</p>
      ) : users.length === 0 || weeks.length === 0 ? (
        <p className="text-sm text-[var(--color-text-secondary)]">
          No points yet for the {season} season.
        </p>
      ) : (
        <>
          {/* Ranked standings, mirroring the Svelte leaderboard card. */}
          <ul className="divide-y divide-secondary-200 dark:divide-secondary-700 rounded-lg border border-secondary-200 dark:border-secondary-700 bg-neutral-0 dark:bg-secondary-800">
            {users.map((u, i) => (
              <li key={u.userId} className="flex items-center gap-sm px-md py-sm">
                <div className="w-6 text-right pr-1 text-sm font-medium tabular-nums text-[var(--color-text-primary)]">
                  {i + 1}
                </div>
                <Avatar name={u.name} pictureUrl={u.pictureUrl ?? ''} variant="md" />
                <div className="flex-1 truncate text-sm text-[var(--color-text-primary)]">{u.name}</div>
                <div className="text-sm font-semibold tabular-nums text-[var(--color-text-primary)]">
                  {u.totalPoints}
                </div>
              </li>
            ))}
          </ul>

          {/* Weekly breakdown, ported from the Svelte PicksPanel scoreboard table. */}
          <div className="overflow-x-auto rounded-lg border border-secondary-200 dark:border-secondary-700">
            <table className="min-w-full text-sm bg-neutral-0 dark:bg-secondary-900">
              <thead>
                <tr className="text-left bg-secondary-50 dark:bg-secondary-800">
                  <th scope="col" className="px-sm py-xs font-semibold text-secondary-500 dark:text-secondary-400">
                    Member
                  </th>
                  {weeks.map((w) => (
                    <th
                      key={w}
                      scope="col"
                      className="px-sm py-xs text-center font-semibold text-secondary-500 dark:text-secondary-400"
                    >
                      W{w}
                    </th>
                  ))}
                  <th scope="col" className="px-sm py-xs text-center font-semibold text-secondary-500 dark:text-secondary-400">
                    Total
                  </th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.userId} className="border-t border-secondary-200 dark:border-secondary-700">
                    <th scope="row" className="px-sm py-xs text-left font-medium whitespace-nowrap text-[var(--color-text-primary)]">
                      {u.name}
                    </th>
                    {weeks.map((w) => (
                      <td key={w} className="px-sm py-xs text-center tabular-nums text-[var(--color-text-primary)]">
                        {u.weekly.find((x) => x.week === w)?.points ?? 0}
                      </td>
                    ))}
                    <td className="px-sm py-xs text-center font-semibold tabular-nums text-[var(--color-text-primary)]">
                      {u.totalPoints}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
