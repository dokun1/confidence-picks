import { useCallback, useEffect, useMemo, useState } from 'react';
import GroupPicks from '../../designsystem/components/GroupPicks';
import type { GroupMember } from '../../lib/groupsService';
import { getClosestWeek, getPicks } from '../../lib/picksService.js';
import type { GetPicksResponse } from '../../lib/picksService';
import type { GameData, GroupMember as PicksMember, MemberPicks, PickData } from '../../lib/types';
import { useSeasonOptions } from './useSeasonOptions';

// Regular-season picks. seasonType 2 is the ESPN regular season (1 = preseason,
// 3 = postseason); GroupPicks only renders the regular-season matrix here.
const SEASON_TYPE = 2;

// Regular season weeks offered by the week selector, mirroring the Svelte
// PicksPanel's TOTAL_WEEKS.
const TOTAL_WEEKS = 18;

export interface PicksTabProps {
  /** Group identifier, used to fetch games + picks for the active week. */
  identifier: string;
  /** Current members, needed to render who picked what. */
  members: GroupMember[];
}

/** Map one response game to GameData, keeping only the fields GroupPicks reads. */
function toGameData(g: GetPicksResponse['games'][number]): GameData {
  return {
    id: g.id,
    espnId: g.espnId,
    homeTeam: g.homeTeam,
    awayTeam: g.awayTeam,
    homeScore: g.homeScore,
    awayScore: g.awayScore,
    status: g.status,
    statusDetail: g.statusDetail,
    gameDate: g.gameDate,
    week: g.week,
    season: g.season,
    seasonType: g.seasonType,
    period: g.period,
    displayClock: g.displayClock,
  };
}

/** Normalize one pick entry defensively — guards against a partial mock shape. */
function toPickData(p: PickData): PickData {
  return {
    gameId: p.gameId,
    pickedTeamId: p.pickedTeamId ?? null,
    confidence: p.confidence ?? null,
    won: p.won ?? null,
    points: p.points ?? null,
  };
}

/** Pull the games array out of the response, tolerating a missing/odd shape. */
function adaptGames(response: GetPicksResponse): GameData[] {
  return Array.isArray(response?.games) ? response.games.map(toGameData) : [];
}

/**
 * Adapt the response's member-keyed picks into MemberPicks[]. Accepts both the
 * array form (MemberPicks[]) and the map form (memberId -> PickData[]); returns
 * [] when picks are absent so GroupPicks renders placeholders rather than crashing.
 */
function adaptPicks(response: GetPicksResponse): MemberPicks[] {
  const raw = response?.picks;
  if (Array.isArray(raw)) {
    return raw
      .filter((entry) => entry != null && entry.memberId != null)
      .map((entry) => ({
        memberId: String(entry.memberId),
        picks: Array.isArray(entry.picks) ? entry.picks.map(toPickData) : [],
      }));
  }
  if (raw != null && typeof raw === 'object') {
    return Object.entries(raw).map(([memberId, picks]) => ({
      memberId: String(memberId),
      picks: Array.isArray(picks) ? picks.map(toPickData) : [],
    }));
  }
  return [];
}

/**
 * PicksTab owns its own data fetch (the page mount only loads group/members/
 * messages). It resolves the group's seasons (defaulting to the newest one with
 * pick data so old groups keep their picks visible during the offseason), the
 * closest week within the selected season, then fetches that week's games +
 * picks and renders the read-only matrix. Season and week selectors let members
 * navigate back through history; GroupPicks never fetches — PicksTab supplies
 * the data.
 */
export default function PicksTab({ identifier, members }: PicksTabProps) {
  const { options: seasonOptions, season, setSeason } = useSeasonOptions(identifier);
  const [week, setWeek] = useState<number | null>(null);
  const [games, setGames] = useState<GameData[]>([]);
  const [picks, setPicks] = useState<MemberPicks[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // Bumping reloadKey re-runs the fetch effect with a fresh cancelled guard;
  // this is what onRefresh triggers.
  const [reloadKey, setReloadKey] = useState(0);

  // Resolve the closest week whenever the season (or group) changes. Week is
  // nulled first so the picks fetch below waits for the new season's week.
  useEffect(() => {
    if (season == null) return;
    let cancelled = false;
    setWeek(null);
    setLoading(true);
    setError(null);
    (async () => {
      try {
        const { week: closest } = await getClosestWeek(identifier, season, SEASON_TYPE);
        if (!cancelled) setWeek(typeof closest === 'number' ? closest : 1);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load picks');
          setLoading(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [identifier, season]);

  // Fetch the week's games + picks once season and week are both resolved.
  useEffect(() => {
    if (season == null || week == null) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    (async () => {
      try {
        const response = await getPicks(identifier, { season, seasonType: SEASON_TYPE, week });
        if (cancelled) return;
        setGames(adaptGames(response));
        setPicks(adaptPicks(response));
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : 'Failed to load picks');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [identifier, season, week, reloadKey]);

  const onRefresh = useCallback(() => setReloadKey((k) => k + 1), []);

  // GroupPicks' members prop wants types.GroupMember (pictureUrl: string); the
  // page supplies groupsService.GroupMember (pictureUrl: string | null). Coerce
  // the nullable field — Avatar already treats '' as "no picture" (initials).
  // The id is coerced to string to match the backend's stringified memberId
  // keys (the matrix looks picks up by member id).
  const groupMembers = useMemo<PicksMember[]>(
    () => members.map((m) => ({ ...m, id: String(m.id), pictureUrl: m.pictureUrl ?? '' })),
    [members],
  );

  // Weeks 1..18; week 0 (preseason finale slot) is only offered when the
  // backend's closest-week resolution landed there.
  const weekOptions = useMemo(() => {
    const base = Array.from({ length: TOTAL_WEEKS }, (_, i) => i + 1);
    return week === 0 ? [0, ...base] : base;
  }, [week]);

  // Until the seasons fetch resolves there is no selector state to render at
  // all; afterwards the selectors stay mounted through week/season changes and
  // only the matrix area swaps to its loading text.
  if (season == null) {
    return (
      <div className='rounded-md border border-border bg-surface p-lg'>
        <p className='text-secondary'>Loading picks…</p>
      </div>
    );
  }

  return (
    <div className='rounded-md border border-border bg-surface p-lg space-y-md'>
      {/* Season + week navigation. Defaults to the latest season with data and
          its closest week, so old groups land on their most recent picks. */}
      <div className='flex flex-wrap items-center gap-sm'>
        <select
          aria-label='Select season'
          value={season ?? ''}
          onChange={(e) => setSeason(Number(e.target.value))}
          className='px-sm py-xs border border-secondary-200 dark:border-secondary-700 rounded bg-neutral-0 dark:bg-secondary-800 text-[var(--color-text-primary)]'
        >
          {seasonOptions.map((s) => (
            <option key={s} value={s}>
              {s} Season
            </option>
          ))}
        </select>
        <select
          aria-label='Select week'
          value={week ?? ''}
          onChange={(e) => setWeek(Number(e.target.value))}
          disabled={week == null}
          className='px-sm py-xs border border-secondary-200 dark:border-secondary-700 rounded bg-neutral-0 dark:bg-secondary-800 text-[var(--color-text-primary)]'
        >
          {week == null ? (
            <option value=''>Loading…</option>
          ) : (
            weekOptions.map((w) => (
              <option key={w} value={w}>
                Week {w}
              </option>
            ))
          )}
        </select>
      </div>

      {loading ? (
        <p className='text-secondary'>Loading picks…</p>
      ) : error ? (
        <p className='text-sm text-error-600 dark:text-error-400'>{error}</p>
      ) : (
        <GroupPicks games={games} picks={picks} members={groupMembers} onRefresh={onRefresh} />
      )}
    </div>
  );
}
