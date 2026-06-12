// Real types for the World Cup match detail panel's N+1 fetch. The panel is fed
// by two sources: the game itself (a BrowseGame — teams/scores/status/events/odds)
// and this EventDetail, returned by GET /api/games/world-cup-2026/event/:espnId
// (venue + curated match stats + per-side lineups). Head-to-head and standings
// are deferred and intentionally absent from this shape.

/** Coarse pitch line for grouping a starter. Subs carry no line. */
export type LineupLine = 'GK' | 'DEF' | 'MID' | 'FWD';

/** A per-player marker in the lineup (goal/card/sub on-off) with its minute. */
export interface PlayerMark {
  kind: 'goal' | 'own-goal' | 'yellow' | 'red' | 'on' | 'off';
  /** ESPN display clock, e.g. "9'" or "90'+2'". */
  min: string;
}

export interface LineupPlayer {
  num: string;
  name: string;
  /** Present for starters (GK/DEF/MID/FWD); absent for substitutes. */
  line?: LineupLine;
  marks: PlayerMark[];
}

export interface TeamLineup {
  abbr: string;
  name: string;
  formation: string;
  starters: LineupPlayer[];
  subs: LineupPlayer[];
}

/** One curated match-stat row: a label with each side's display value. */
export interface MatchStat {
  label: string;
  home: string;
  away: string;
}

/** The /event/:espnId payload. Every field is best-effort: venue may be null,
 *  stats may be empty, and lineups may be null when ESPN hasn't posted them. */
export interface EventDetail {
  venue: string | null;
  stats: MatchStat[];
  lineups: { home: TeamLineup; away: TeamLineup } | null;
}
