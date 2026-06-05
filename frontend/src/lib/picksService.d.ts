// Type declarations for the untyped JS picks service (picksService.js).
// tsconfig has strict (noImplicitAny) but not allowJs, so every .ts/.tsx import
// of this module would otherwise resolve to `any` and fail. This .d.ts types the
// public API consumed by PicksTab; mirrors the groupsService.d.ts pattern.

import type { MemberPicks, PickData, TeamData } from './types';

/** Resolved week descriptor returned by GET /:id/picks/closest. */
export interface ClosestWeek {
  season: number;
  seasonType: number;
  week: number;
}

/**
 * A game as returned inside the getPicks payload. This is the backend's
 * normalized game shape (a superset of GameData); PicksTab adapts the fields it
 * needs and ignores the rest.
 */
export interface PicksGame {
  id: number;
  espnId: string;
  homeTeam: TeamData;
  awayTeam: TeamData;
  homeScore: number;
  awayScore: number;
  status: string;
  statusDetail?: string;
  gameDate: string;
  week: number;
  season: number;
  seasonType: number;
  period?: number;
  displayClock?: string;
}

/**
 * Response shape of GET /:id/picks. `picks` carries the week's picks keyed by
 * member — either as MemberPicks[] or a memberId -> PickData[] map. PicksTab's
 * adapter accepts whichever form is present (and tolerates its absence).
 */
export interface GetPicksResponse {
  games: PicksGame[];
  picks?: MemberPicks[] | Record<string, PickData[]>;
}

export function getClosestWeek(
  groupIdentifier: string,
  season: number,
  seasonType: number,
): Promise<ClosestWeek>;

export function getPicks(
  groupIdentifier: string,
  query: { season: number; seasonType: number; week: number },
): Promise<GetPicksResponse>;
