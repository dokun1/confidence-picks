// Type declarations for the untyped JS World Cup service (worldCupService.js).
// tsconfig has strict (noImplicitAny) but not allowJs, so every .ts/.tsx import
// of this module would otherwise resolve to `any` and fail. This .d.ts types the
// public API consumed by the World Cup pages; mirrors the picksService.d.ts /
// groupsService.d.ts pattern. The domain types live in ./types.

import type {
  WorldCupMatch,
  WorldCupStage,
  MatchPick,
  MatchPickResult,
  TournamentLeaderboardRow,
} from './types';
import type { EventDetail } from './wcMatchDetail';

/** Response shape of GET /api/games/world-cup-2026/stage/:stage. */
export interface StageMatchesResponse {
  games: WorldCupMatch[];
  count: number;
  cached: boolean;
}

/** Response shape of GET /api/picks/group/:groupId/world-cup/leaderboard. */
export interface LeaderboardResponse {
  leaderboard: TournamentLeaderboardRow[];
}

/** Fetch the matches for one tournament stage (group or a knockout round). */
export function getStageMatches(stage: WorldCupStage): Promise<StageMatchesResponse>;

/**
 * Persist a member's World Cup picks for a group. Each pick names a game and the
 * picked result (home/away/draw). Resolves to the parsed response body.
 */
export function submitWorldCupPicks(
  groupId: string,
  picks: MatchPick[],
): Promise<{ picks?: MatchPick[] } & Record<string, unknown>>;

/** Fetch the tournament-shaped leaderboard (with tiebreaker columns) for a group. */
export function getWorldCupLeaderboard(groupId: string): Promise<LeaderboardResponse>;

/** Response shape of GET /api/picks/group/:groupId/world-cup/me. */
export interface MyWorldCupPicksResponse {
  picks: MatchPick[];
}

/**
 * Fetch the authenticated user's own World Cup picks for a group, in the
 * same shape POST submitWorldCupPicks accepts. Used by WorldCupPicksPage to
 * hydrate the draft state on mount so a refresh doesn't blank out picks.
 */
export function getMyWorldCupPicks(groupId: string): Promise<MyWorldCupPicksResponse>;

/** Response shape of GET /api/picks/group/:groupId/world-cup/user/:userId. */
export interface MemberWorldCupPicksResponse {
  picks: MatchPick[];
  /** True only when the authenticated caller is an admin of the group. */
  canEdit: boolean;
}

/**
 * Fetch another member's World Cup picks for a group. Any member may read; the
 * `canEdit` flag in the response is true only for admins. Used by the picks
 * tab's person selector to load a teammate's picks (read-only) or, for admins,
 * to edit them.
 */
export function getUserWorldCupPicks(
  groupId: string,
  userId: string | number,
): Promise<MemberWorldCupPicksResponse>;

/**
 * Submit World Cup picks on behalf of another member. Admin-only (the backend
 * returns 403 otherwise) and scoped to the single group.
 */
export function submitUserWorldCupPicks(
  groupId: string,
  userId: string | number,
  picks: MatchPick[],
): Promise<{ picks?: MatchPick[]; targetUserId?: number; isAdminOverride?: boolean } & Record<string, unknown>>;

/**
 * Fetch on-demand match detail (venue + curated stats + per-side lineups) for the
 * detail panel, keyed by the real ESPN event id. The backend is resilient, so the
 * panel renders the game-side info even if this rejects.
 */
export function getMatchDetail(espnId: string): Promise<EventDetail>;

export type { MatchPickResult };
