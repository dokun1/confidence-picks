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

export type { MatchPickResult };
