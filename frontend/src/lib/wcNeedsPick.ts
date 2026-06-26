// Shared "how many picks does this viewer still owe?" count for World Cup pools.
//
// Funnels through the EXACT same pipeline the "Needs pick" filter chip uses —
// toBrowseGames(matches, draft) + the pure needsPick(game, now) rule from
// wcGamesView — so the leaderboard banner, the group-card dot, and the picks-tab
// chip can never disagree about what counts. A pick is "needed" only when the
// match is still open (pre-kickoff), unpicked by this viewer, and both teams are
// decided (knockout placeholders aren't pickable). See wcGamesView.needsPick.

import type { MatchPick, WorldCupMatch } from './types';
import { toBrowseGames } from './worldCupBrowseAdapter';
import { needsPick } from './wcGamesView';

/** Build the gameId→result draft map the adapter expects from a picks payload. */
function toDraft(picks: MatchPick[] | undefined): Record<number, MatchPick['pickedResult']> {
  const draft: Record<number, MatchPick['pickedResult']> = {};
  for (const p of picks ?? []) {
    if (p && p.gameId != null && p.pickedResult) draft[p.gameId] = p.pickedResult;
  }
  return draft;
}

/**
 * Count the matches this viewer still needs to pick, given the tournament's
 * matches and the viewer's saved picks. `now` is injected so the open/locked
 * window is testable.
 *
 * `knockoutOnly` mirrors the group setting: when true, group-stage matches are
 * dropped before counting so a knockout-only group's banner/dot only counts the
 * games that group can actually pick. This keeps the leaderboard banner and the
 * groups-list dot in lockstep with the Picks tab, which already hides the group
 * stage for these pools. Defaults false, so ongoing (full-tournament) pools are
 * counted exactly as before.
 */
export function countNeedsPick(
  matches: WorldCupMatch[],
  picks: MatchPick[] | undefined,
  now: Date,
  knockoutOnly: boolean = false,
): number {
  const draft = toDraft(picks);
  const visible = knockoutOnly ? matches.filter((m) => m.stage !== 'group') : matches;
  return toBrowseGames(visible, draft).filter((g) => needsPick(g, now)).length;
}
