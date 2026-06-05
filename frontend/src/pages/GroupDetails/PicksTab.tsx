import { useCallback, useEffect, useMemo, useState } from 'react';
import GroupPicks from '../../designsystem/components/GroupPicks';
import type { GroupMember } from '../../lib/groupsService';
import { getCurrentNFLSeason } from '../../lib/nflSeasonUtils.js';
import { getClosestWeek, getPicks } from '../../lib/picksService.js';
import type { GetPicksResponse } from '../../lib/picksService';
import type { GameData, GroupMember as PicksMember, MemberPicks, PickData } from '../../lib/types';

// Regular-season picks. seasonType 2 is the ESPN regular season (1 = preseason,
// 3 = postseason); GroupPicks only renders the regular-season matrix here.
const SEASON_TYPE = 2;

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
 * messages). On mount and on refresh it resolves the closest week, fetches the
 * week's games + picks, adapts them into GroupPicks' props, and renders the
 * read-only matrix. GroupPicks never fetches — PicksTab supplies the data.
 */
export default function PicksTab({ identifier, members }: PicksTabProps) {
  const [games, setGames] = useState<GameData[]>([]);
  const [picks, setPicks] = useState<MemberPicks[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // Bumping reloadKey re-runs the fetch effect with a fresh cancelled guard;
  // this is what onRefresh triggers.
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    (async () => {
      try {
        const season = getCurrentNFLSeason();
        const { week } = await getClosestWeek(identifier, season, SEASON_TYPE);
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
  }, [identifier, reloadKey]);

  const onRefresh = useCallback(() => setReloadKey((k) => k + 1), []);

  // GroupPicks' members prop wants types.GroupMember (pictureUrl: string); the
  // page supplies groupsService.GroupMember (pictureUrl: string | null). Coerce
  // the nullable field — Avatar already treats '' as "no picture" (initials).
  const groupMembers = useMemo<PicksMember[]>(
    () => members.map((m) => ({ ...m, pictureUrl: m.pictureUrl ?? '' })),
    [members],
  );

  if (loading) {
    return (
      <div className='rounded-md border border-border bg-surface p-lg'>
        <p className='text-secondary'>Loading picks…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className='rounded-md border border-border bg-surface p-lg'>
        <p className='text-sm text-error-600 dark:text-error-400'>{error}</p>
      </div>
    );
  }

  return (
    <div className='rounded-md border border-border bg-surface p-lg'>
      <GroupPicks games={games} picks={picks} members={groupMembers} onRefresh={onRefresh} />
    </div>
  );
}
