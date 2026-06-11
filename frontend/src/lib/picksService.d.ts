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

/** Response shape of GET /:identifier/picks/me. */
export interface MyPicksResponse {
  picks: Array<{ gameId: number; pickedTeamId: number | null; confidence: number | null }>;
}

/**
 * Fetch the authenticated user's own picks for a week, in the same shape POST
 * /:identifier/picks accepts. Used by GamesPage to hydrate the draft on mount
 * + every selector change so a refresh doesn't blank out picks.
 */
export function getMyPicks(
  groupIdentifier: string,
  query: { season: number; seasonType: number; week: number },
): Promise<MyPicksResponse>;

/** One pick in a save payload: which team, with what confidence, for a game. */
export interface PickInput {
  gameId: number;
  pickedTeamId: number;
  confidence: number;
}

/** Body of POST /:id/picks. `clearedGameIds` removes prior picks for those games. */
export interface SavePicksBody {
  season: number;
  seasonType: number;
  week: number;
  picks: PickInput[];
  clearedGameIds: number[];
}

/**
 * Persist the week's picks for a group. Returns the refreshed picks payload
 * (same shape as getPicks plus availability metadata); GamesPage only needs the
 * resolved promise to confirm success.
 */
export function savePicks(
  groupIdentifier: string,
  body: SavePicksBody,
): Promise<GetPicksResponse>;

/** Response shape of GET /:identifier/picks/seasons — seasons with pick data, newest first. */
export interface PickSeasonsResponse {
  seasons: number[];
}

/**
 * Fetch the seasons that have stored pick data for the group. The group tabs
 * default their season selector to the latest entry so old groups keep their
 * history visible during the offseason.
 */
export function getPickSeasons(groupIdentifier: string): Promise<PickSeasonsResponse>;

/** One member's points for a single week in the scoreboard payload. */
export interface ScoreboardWeekly {
  week: number;
  points: number;
}

/** One member's scoreboard row: weekly points plus the season total. */
export interface ScoreboardUser {
  userId: number;
  name: string;
  pictureUrl: string | null;
  weekly: ScoreboardWeekly[];
  totalPoints: number;
}

/** Response shape of GET /:identifier/scoreboard. */
export interface ScoreboardResponse {
  season: number;
  seasonType: number;
  weeks: number[];
  users: ScoreboardUser[];
}

/** Fetch the per-member weekly/total points for a season. */
export function getScoreboard(
  groupIdentifier: string,
  query: { season: number; seasonType: number },
): Promise<ScoreboardResponse>;
