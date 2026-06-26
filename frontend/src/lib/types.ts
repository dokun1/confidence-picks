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
  poolType?: PoolType | null;
  /**
   * World Cup 2026 sub-setting: when true the group only allows picks on
   * knockout-stage games (group-stage games are hidden and rejected server-side).
   * Always false/absent for NFL pools.
   */
  knockoutOnly?: boolean;
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
  record?: string;
  form?: string;
  /**
   * False when this slot is an undecided knockout placeholder (ESPN's
   * "Winner Group A" etc.) rather than a real qualified team. Absent on older
   * cached games and on group-stage teams, where it should be treated as true.
   */
  isActive?: boolean;
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

// Normalized in-match event (goal or card), derived from ESPN's
// `competitions[0].details`. Presentational only — minute is ESPN's display
// clock string ("9'", "90'+2'") so the UI never re-formats stoppage time.
export type MatchEventType = 'goal' | 'own-goal' | 'yellow-card' | 'red-card';

export interface MatchEvent {
  type: MatchEventType;
  /** ESPN display clock, e.g. "9'" or "90'+2'". */
  minute: string;
  /** Player short name, e.g. "J. Quiñones". */
  player: string;
  /** Which side the event is credited to. */
  side: 'home' | 'away';
  /** Team abbreviation for display, e.g. "MEX". */
  teamAbbr: string;
}

// Shaped like the backend world_cup Game JSON. `isKnockout` is a derived flag
// (stage !== 'group') the route emits so the UI can disable draw picks without
// re-deriving stage membership.
export interface WorldCupMatch {
  id: number;
  /** Real ESPN event id (used for P3 detail panel deep-links). */
  espnId?: string;
  stage: WorldCupStage;
  homeTeam: TeamData;
  awayTeam: TeamData;
  homeScore: number;
  awayScore: number;
  status: string;
  isKnockout: boolean;
  gameDate?: string;
  winnerTeamId?: string | null;
  /**
   * Live match progress, parsed by the backend from ESPN's `status` block and
   * persisted (display_clock / period / status_detail columns), so they survive
   * the stage cache. `displayClock` is ESPN's minute mark for a soccer match in
   * progress, e.g. "63'" or "90'+2'"; `statusDetail` carries the descriptive
   * state, e.g. "Halftime" or "1st Half"; `period` is 1 = first half, 2 = second
   * half, 3+ = extra time. All absent before kickoff.
   */
  displayClock?: string;
  statusDetail?: string;
  period?: number;
  /** Goal/card timeline once the match has started. Absent before kickoff. */
  events?: MatchEvent[];
  /** Pre-match odds from the odds JSONB column. */
  odds?: {
    threeWay?: { home?: string | null; draw?: string | null; away?: string | null };
    overUnder?: number;
  };
}

// Mirrors the backend pick route body, which keys off `pickedResult`.
export interface MatchPick {
  gameId: number;
  pickedResult: MatchPickResult;
}

// One row of the tournament leaderboard. The shape mirrors the backend
// leaderboard payload exactly (see worldCupPicks.js GET .../world-cup/leaderboard
// and worldcup-picks-route.test.js): the member is keyed by `userId` (not a
// separate memberId), `rank`/`tied` carry the backend's authoritative tiebreaker
// resolution, and the count fields stay snake_case to match the wire format.
// Keeping the type faithful to the payload lets TypeScript catch real contract
// drift instead of hiding it.
export interface TournamentLeaderboardRow {
  /** Backend user id; used as the row key. Mapped from users.id. */
  userId: number;
  name: string;
  /**
   * Member's profile picture URL. Always present in the payload (mapped from
   * users.picture_url); null when the member has no picture, in which case
   * Avatar falls back to initials.
   */
  pictureUrl: string | null;
  /** 1-based standing from the backend comparator. */
  rank: number;
  /** True when this member shares its rank with an adjacent member. */
  tied: boolean;
  points: number;
  wins_correct: number;
  losses: number;
  draws_correct: number;
  draws_incorrect: number;
}
