// Pure, framework-free view logic for the World Cup games browse list. Kept
// React-free and `now`-injectable so every branch is unit-testable (mirrors
// pollIntervalFor). The host derives BrowseGame from API matches + draft via
// worldCupBrowseAdapter.

import type { MatchEvent, WorldCupStage } from './types';

export type MatchResult = 'home' | 'draw' | 'away';
export type GameStatus = 'SCHEDULED' | 'IN_PROGRESS' | 'FINAL';
export type SavedView = 'needs-pick' | 'today' | 'live' | 'all' | 'correct' | 'incorrect';

export interface BrowseTeam {
  abbr: string;
  name: string;
  /** Crest/flag image URL (TeamData.logo). */
  logo: string;
  /** W-D-L, e.g. "1-0-0". Optional: absent until P2 parses it. */
  record?: string;
  /** Moneyline for this team to win. Optional: absent until P2. */
  moneyline?: string;
  /** Recent W/D/L form sequence, e.g. "WWDWL". Optional. */
  form?: string;
}

export interface BrowseGame {
  id: number;
  espnId: string;
  stage: WorldCupStage;
  stageLabel: string;
  /** ISO kickoff timestamp. */
  kickoff: string;
  home: BrowseTeam;
  away: BrowseTeam;
  /** DraftKings moneyline for the draw, e.g. "+205". */
  drawOdds?: string;
  /** Over/under total goals, e.g. "2.5". */
  overUnder?: string;
  status: GameStatus;
  homeScore?: number;
  awayScore?: number;
  /** The viewer's current pick, if any. */
  picked?: MatchResult;
  /** Knockout matches can't end in a draw (PKs decide) — disables the Draw pick. */
  isKnockout: boolean;
  /** Goal/card timeline once the match has started. Absent before kickoff. */
  events?: MatchEvent[];
}

/** A game is locked once it has kicked off — by status OR by the clock passing kickoff. */
export function isLocked(g: BrowseGame, now: Date): boolean {
  if (g.status !== 'SCHEDULED') return true;
  return new Date(g.kickoff).getTime() <= now.getTime();
}

/**
 * Both participants are known. Knockout slots are seeded with ESPN's "TBD"
 * placeholder until the bracket decides them, and nothing is pickable until
 * then — mirrors the `teamsAssigned` guard in MatchListCard.
 */
export function teamsDecided(g: BrowseGame): boolean {
  return g.home.abbr !== 'TBD' && g.away.abbr !== 'TBD';
}

/**
 * Needs a pick = startable window still open, no pick recorded, and both teams
 * decided. The last guard matters in knockout rounds: a game whose participants
 * are still TBD can't be picked, so it must not appear in the "needs pick" view.
 */
export function needsPick(g: BrowseGame, now: Date): boolean {
  return !isLocked(g, now) && g.picked == null && teamsDecided(g);
}

function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

/** Restrict to one saved view. */
export function applyView(games: BrowseGame[], view: SavedView, now: Date): BrowseGame[] {
  switch (view) {
    case 'needs-pick':
      return games.filter((g) => needsPick(g, now));
    case 'today':
      return games.filter((g) => isSameDay(new Date(g.kickoff), now));
    case 'live':
      return games.filter((g) => g.status === 'IN_PROGRESS');
    case 'correct':
      return games.filter((g) => pickVerdict(g) === 'correct');
    case 'incorrect':
      return games.filter((g) => pickVerdict(g) === 'incorrect');
    case 'all':
    default:
      return games;
  }
}

export interface Filters {
  stage: WorldCupStage | null;
  status: GameStatus | null;
  /** true = only picked, false = only unpicked, null = either. */
  picked: boolean | null;
}

export const NO_FILTERS: Filters = { stage: null, status: null, picked: null };

/** AND-combine the explicit filters on top of whatever the view already narrowed. */
export function applyFilters(games: BrowseGame[], f: Filters): BrowseGame[] {
  return games.filter((g) => {
    if (f.stage && g.stage !== f.stage) return false;
    if (f.status && g.status !== f.status) return false;
    if (f.picked === true && g.picked == null) return false;
    if (f.picked === false && g.picked != null) return false;
    return true;
  });
}

/** Diacritic- and case-insensitive normalization for search. */
function norm(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim();
}

/** Match a query against either team's name or code. Empty query matches all. */
export function matchesSearch(g: BrowseGame, query: string): boolean {
  const q = norm(query);
  if (!q) return true;
  return [g.home.name, g.home.abbr, g.away.name, g.away.abbr].some((s) => norm(s).includes(q));
}

export type SortKey = 'kickoff' | 'stage';

const STAGE_ORDER: WorldCupStage[] = ['group', 'r32', 'r16', 'qf', 'sf', 'third', 'final'];

/** Stable sort by kickoff (default) or stage-then-kickoff. Never mutates input. */
export function sortGames(games: BrowseGame[], key: SortKey): BrowseGame[] {
  const byKickoff = (a: BrowseGame, b: BrowseGame) =>
    new Date(a.kickoff).getTime() - new Date(b.kickoff).getTime();
  const copy = [...games];
  if (key === 'stage') {
    copy.sort(
      (a, b) => STAGE_ORDER.indexOf(a.stage) - STAGE_ORDER.indexOf(b.stage) || byKickoff(a, b),
    );
  } else {
    copy.sort(byKickoff);
  }
  return copy;
}

/** The outcome of a played match from its scoreline, or null if not yet scored. */
export function outcomeOf(g: Pick<BrowseGame, 'homeScore' | 'awayScore'>): MatchResult | null {
  if (g.homeScore == null || g.awayScore == null) return null;
  if (g.homeScore > g.awayScore) return 'home';
  if (g.awayScore > g.homeScore) return 'away';
  return 'draw';
}

/**
 * Whether a finished pick matched the actual outcome. 'correct' = you picked the
 * exact result (a winning team, or Draw on a draw); 'incorrect' = you picked but
 * the result differed (incl. a team that only drew). null = not decidable yet
 * (not final, no score, or no pick made — a no-pick is neither "picked correctly"
 * nor "picked incorrectly"). Drives the Correct / Incorrect filter chips.
 */
export function pickVerdict(g: BrowseGame): 'correct' | 'incorrect' | null {
  if (g.status !== 'FINAL') return null;
  const outcome = outcomeOf(g);
  if (outcome == null || g.picked == null) return null;
  return g.picked === outcome ? 'correct' : 'incorrect';
}

export type ResultShade = 'win' | 'draw' | 'partial' | 'loss';

/**
 * How a pick fared against the outcome, as a color category (mirrors the WC
 * group scoring: 3 / 2 / 1 / 0 points). Returns null when the match isn't scored.
 * - `win`     — picked a team and it won (3)
 * - `draw`    — picked Draw and it drew (2)
 * - `partial` — picked a team that drew, or picked Draw and a team won (1)
 * - `loss`    — picked a team that lost, OR made no pick at all (0)
 */
export function resultShade(picked: MatchResult | undefined, outcome: MatchResult | null): ResultShade | null {
  if (outcome == null) return null;
  if (picked == null) return 'loss';
  if (picked === 'draw') return outcome === 'draw' ? 'draw' : 'partial';
  if (outcome === picked) return 'win';
  if (outcome === 'draw') return 'partial';
  return 'loss';
}

export interface DateGroup {
  /** Day key (YYYY-MM-DD) for React keys. */
  key: string;
  /** Display label, e.g. "Today · Thu Jun 11" or "Fri Jun 12". */
  label: string;
  /** Stage shared by the day's games (tournament advances by date), or '' if mixed. */
  stageLabel: string;
  games: BrowseGame[];
}

function dayKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

const WEEKDAY = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTH = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function dayLabel(d: Date, now: Date): string {
  const base = `${WEEKDAY[d.getDay()]} ${MONTH[d.getMonth()]} ${d.getDate()}`;
  const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  if (isSameDay(d, now)) return `Today · ${base}`;
  if (isSameDay(d, tomorrow)) return `Tomorrow · ${base}`;
  return base;
}

/**
 * Group an already-sorted list into date sections for the dividers. The divider
 * carries the stage when every game that day shares one (the common case during a
 * stage's window); otherwise the stage label is blank.
 */
export function groupByDate(sorted: BrowseGame[], now: Date): DateGroup[] {
  const groups: DateGroup[] = [];
  for (const g of sorted) {
    const d = new Date(g.kickoff);
    const key = dayKey(d);
    let group = groups[groups.length - 1];
    if (!group || group.key !== key) {
      group = { key, label: dayLabel(d, now), stageLabel: g.stageLabel, games: [] };
      groups.push(group);
    } else if (group.stageLabel && group.stageLabel !== g.stageLabel) {
      group.stageLabel = '';
    }
    group.games.push(g);
  }
  return groups;
}

/** The full pipeline: view → filters → search → sort → date groups. */
export function buildSections(
  games: BrowseGame[],
  opts: { view: SavedView; filters: Filters; query: string; sort: SortKey; now: Date },
): DateGroup[] {
  const narrowed = applyFilters(applyView(games, opts.view, opts.now), opts.filters).filter((g) =>
    matchesSearch(g, opts.query),
  );
  return groupByDate(sortGames(narrowed, opts.sort), opts.now);
}
