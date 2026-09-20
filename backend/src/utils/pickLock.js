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

/**
 * The pick window for a game, as the API reports it to clients.
 *
 * Clients must not derive editability themselves. ESPN `status` lags the real
 * kickoff by minutes, and a client clock that runs fast would lock a game early
 * — the server owns time. Publishing `locksAt` (the same scheduled-kickoff
 * instant `isPickLocked` gates on) alongside a resolved `editable` lets a caller
 * show a countdown and stop submitting BEFORE it earns a 409, rather than
 * discovering the deadline by tripping over it.
 *
 * `locksAt` is null when the game has no usable kickoff. For a postponed game it
 * is the (already passed) original date while `editable` stays true — the mirror
 * of the postponed carve-out in isPickLocked.
 */
export function pickWindow(game, now = Date.now()) {
  const kickoff = game.gameDate == null ? null : new Date(game.gameDate);
  const valid = kickoff != null && Number.isFinite(kickoff.getTime());
  return {
    locksAt: valid ? kickoff.toISOString() : null,
    editable: !isPickLocked(game, now)
  };
}
