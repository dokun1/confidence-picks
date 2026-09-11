// Pre-game statuses: games in these states are editable and other members'
// picks on them stay hidden (legacy/alternate spellings included, e.g. NOT_STARTED).
export const PRE_STATUSES = new Set(['SCHEDULED', 'NOT_STARTED', 'PRE', 'PREGAME']);

/**
 * Whether picks on a game are locked at `now` (epoch ms).
 *
 * Picks stay open until the scheduled kickoff instant. ESPN's status lags the
 * real kickoff by minutes, so the scheduled time is the authority; a started
 * status only ever locks earlier. A postponed game keeps a pre-game status with
 * a kickoff that has already passed, and stays open for its rescheduled date.
 */
export function isPickLocked(game, now = Date.now()) {
  if (!PRE_STATUSES.has(game.status)) return true;
  if (game.postponed) return false;
  const kickoff = game.gameDate == null ? NaN : new Date(game.gameDate).getTime();
  return Number.isFinite(kickoff) && now >= kickoff;
}
