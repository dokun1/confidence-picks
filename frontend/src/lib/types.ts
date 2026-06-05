export interface User {
  id: string;
  email: string;
  name: string;
  pictureUrl: string;
  provider: string;
}

export interface Group {
  id: string;
  name: string;
  identifier: string;
  description?: string;
  memberCount: number;
  isOwner: boolean;
  userRole?: string;
  createdAt: string;
  createdByName?: string | null;
  createdByPictureUrl?: string | null;
}

export interface GroupMember {
  id: string;
  name: string;
  email: string;
  isOwner: boolean;
  joinedAt: string;
  pictureUrl: string;
}

export interface GroupMessage {
  id: string;
  authorId: string;
  authorName: string;
  authorPictureUrl: string;
  content: string;
  createdAt: string;
}

export interface TeamData {
  id: string;
  name: string;
  abbreviation: string;
  logo: string;
  color?: string;
  altColor?: string;
}

export interface GameData {
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

export interface PickData {
  gameId: number;
  pickedTeamId: string | null;
  confidence: number | null;
  won: boolean | null;
  points: number | null;
}

export interface InviteGroup {
  identifier: string;
  name: string;
  description: string;
  memberCount: number;
  maxMembers: number;
  ownerName: string;
  ownerPictureUrl: string;
}

export interface InviteDetails {
  valid: boolean;
  reason?: string;
  alreadyMember: boolean;
  group: InviteGroup;
  invite: {
    token: string;
    expiresAt: string;
    maxUses: number | null;
    uses: number;
    remainingUses: number | null;
  };
}

// Associates a GroupMember (by id) with their PickData for a week.
// PickData carries no member association on its own, so GroupPicks needs
// this to render who picked what.
export interface MemberPicks {
  memberId: string;
  picks: PickData[];
}

// --- World Cup 2026 ---

// Distinguishes the two pool flavors. Mirrors the backend `pool_type` enum on
// groups; world_cup_2026 pools render the whole tournament as one entity.
export type PoolType = 'nfl_weekly' | 'world_cup_2026';

// A soccer pick is one of three outcomes — no team-confidence, just the result.
// Mirrors the backend `picked_result` enum on user_picks.
export type MatchPickResult = 'home' | 'away' | 'draw';

// FIFA World Cup rounds. Group stage plus the knockout bracket.
export type WorldCupStage = 'group' | 'r32' | 'r16' | 'qf' | 'sf' | 'third' | 'final';

// Tournament order for iteration / stage-grouped rendering. Matches the backend
// `stage` values on games.
export const WORLD_CUP_STAGES: readonly WorldCupStage[] = [
  'group',
  'r32',
  'r16',
  'qf',
  'sf',
  'third',
  'final',
] as const;

// Shaped like the backend world_cup Game JSON. `isKnockout` is a derived flag
// (stage !== 'group') the route emits so the UI can disable draw picks without
// re-deriving stage membership.
export interface WorldCupMatch {
  id: number;
  stage: WorldCupStage;
  homeTeam: TeamData;
  awayTeam: TeamData;
  homeScore: number;
  awayScore: number;
  status: string;
  isKnockout: boolean;
  gameDate?: string;
  winnerTeamId?: string | null;
}

// Mirrors the backend pick route body, which keys off `pickedResult`.
export interface MatchPick {
  gameId: number;
  pickedResult: MatchPickResult;
}

// One row of the tournament leaderboard. Count fields are snake_case to match
// the backend leaderboard payload (see worldcup-picks-route.test.js); these are
// the four tiebreaker columns rendered after points.
export interface TournamentLeaderboardRow {
  memberId: string;
  name: string;
  points: number;
  wins_correct: number;
  losses: number;
  draws_correct: number;
  draws_incorrect: number;
}
