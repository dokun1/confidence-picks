/**
 * SoccerScoringService — pure, DB-free scoring for the World Cup 2026 pool.
 *
 * Source of truth: frontend/docs/world-cup-picks-rules.md (snapshotted from the
 * WC2022 spreadsheet). Scoring is flat-per-match — there is NO confidence
 * multiplier, which is the defining difference from the NFL confidence pools.
 *
 * Everything here is a pure function of its inputs so the leaderboard route can
 * feed it rows (picks joined to games) and unit tests can exercise it without a
 * database. Persistence, fetching, and winner resolution live elsewhere
 * (GameService owns `winnerTeamId`; the route owns the join).
 *
 * Contract of the inputs:
 *   pick.picked_result : 'home' | 'away' | 'draw'   (side-relative; null/absent = unscored)
 *   game.stage         : 'group' | 'r32' | 'r16' | 'qf' | 'sf' | 'third' | 'final'
 *   game.homeTeam.id / game.awayTeam.id              (team ids, for knockout winner mapping)
 *   game.homeScore / game.awayScore                  (regulation/FT goals)
 *   game.status === 'FINAL' || game.completed === true   (completion truth source)
 *   game.winnerTeamId  : advancing team's id on knockout matches (GameService-resolved)
 */

// Knockout stage codes. A match in any of these always advances exactly one
// team — a level 90'/120' score is resolved by extra time or penalties, so a
// 'draw' is never a terminal result. The group stage is the only phase where a
// draw scores.
//
// NOTE: this mirrors GameService.KNOCKOUT_STAGES. It is duplicated here on
// purpose: importing GameService would drag in the DB pool and break this
// module's purity. The set is six fixed FIFA round codes; if it ever changes,
// update both. NFL games (stage null/undefined) fall through to group handling
// but never reach this service.
export const KNOCKOUT_STAGES = new Set(['r32', 'r16', 'qf', 'sf', 'third', 'final']);

// The four tiebreaker buckets every scored pick lands in exactly once. Used as
// the `bucket` field on a scored result and as the per-user count keys.
export const BUCKETS = ['wins_correct', 'losses', 'draws_correct', 'draws_incorrect'];

export function isKnockoutStage(stage) {
  return KNOCKOUT_STAGES.has(stage);
}

function homeTeamId(game) {
  return game?.homeTeam?.id ?? game?.homeTeamId ?? null;
}

function awayTeamId(game) {
  return game?.awayTeam?.id ?? game?.awayTeamId ?? null;
}

function isFinal(game) {
  return game?.completed === true || game?.status === 'FINAL';
}

/**
 * Resolve the actual match result from the game shape.
 *
 * Group stage: compare the final scoreline → 'home' | 'away' | 'draw'.
 * Knockout stage: the advancing team is the result, never a draw. Prefer the
 *   GameService-resolved `winnerTeamId` (the only signal on a PK shootout where
 *   the 90'/120' score was level); fall back to the scoreline when one side led
 *   in regulation. A level knockout with no resolved advancer is undecided.
 *
 * @returns {{ outcome: 'home'|'away'|'draw'|null, decided: boolean }}
 *   outcome is the winning side ('home'/'away'), 'draw' (group only), or null
 *   when the match is not yet scoreable; decided is false in that null case.
 */
export function deriveActualResult(game) {
  if (!isFinal(game)) return { outcome: null, decided: false };

  const home = Number(game?.homeScore ?? 0);
  const away = Number(game?.awayScore ?? 0);

  if (isKnockoutStage(game?.stage)) {
    const winnerId = game?.winnerTeamId ?? null;
    if (winnerId != null) {
      if (winnerId === homeTeamId(game)) return { outcome: 'home', decided: true };
      if (winnerId === awayTeamId(game)) return { outcome: 'away', decided: true };
      // winnerTeamId set but matches neither side — unusable, treat as undecided.
      return { outcome: null, decided: false };
    }
    // No resolved advancer: a clear regulation winner still decides it; a level
    // score does not (PKs are the only signal and they were not resolved).
    if (home > away) return { outcome: 'home', decided: true };
    if (away > home) return { outcome: 'away', decided: true };
    return { outcome: null, decided: false };
  }

  // Group stage: higher score wins; a level score is a genuine draw.
  if (home > away) return { outcome: 'home', decided: true };
  if (away > home) return { outcome: 'away', decided: true };
  return { outcome: 'draw', decided: true };
}

/**
 * Score a single World Cup pick against its match.
 *
 * Flat-per-match rules (see world-cup-picks-rules.md):
 *   Group stage
 *     picked team that won            → 3   (wins_correct)
 *     picked team that lost           → 0   (losses)
 *     picked team, match drew         → 1   (draws_incorrect)
 *     picked 'draw', match drew       → 2   (draws_correct)
 *     picked 'draw', a team won       → 1   (draws_incorrect)
 *   Knockout stage (advancing team is the result; no draw scoring)
 *     picked advancing team           → 3   (wins_correct)
 *     picked eliminated team          → 0   (losses)
 *     picked 'draw' (special case)    → 0   (draws_incorrect)
 *
 * @param {{ picked_result?: 'home'|'away'|'draw' }} pick
 * @param {object} game - Game-shaped object (see module contract)
 * @returns {{ points: number, bucket: string|null, scored: boolean }}
 *   scored is false (points 0, bucket null) when the match is undecided or the
 *   pick is missing/invalid; such picks contribute nothing to the aggregate.
 */
export function scoreSoccerPick(pick, game) {
  const picked = pick?.picked_result;
  const unscored = { points: 0, bucket: null, scored: false };

  if (picked !== 'home' && picked !== 'away' && picked !== 'draw') return unscored;

  const { outcome, decided } = deriveActualResult(game);
  if (!decided) return unscored;

  if (isKnockoutStage(game?.stage)) {
    // Knockout: a 'draw' pick can never score — there is always an advancing team.
    if (picked === 'draw') return { points: 0, bucket: 'draws_incorrect', scored: true };
    // outcome is 'home' | 'away' (the advancing side).
    if (picked === outcome) return { points: 3, bucket: 'wins_correct', scored: true };
    return { points: 0, bucket: 'losses', scored: true };
  }

  // Group stage. outcome is 'home' | 'away' | 'draw'.
  if (picked === 'draw') {
    return outcome === 'draw'
      ? { points: 2, bucket: 'draws_correct', scored: true }
      : { points: 1, bucket: 'draws_incorrect', scored: true };
  }

  // Picked a team.
  if (outcome === 'draw') return { points: 1, bucket: 'draws_incorrect', scored: true };
  if (picked === outcome) return { points: 3, bucket: 'wins_correct', scored: true };
  return { points: 0, bucket: 'losses', scored: true };
}

/**
 * Aggregate one user's scored picks into a leaderboard row.
 *
 * @param {Array<{ pick: object, game: object }>} entries - this user's picks
 *   joined to their games. Undecided matches and missing picks are ignored.
 * @returns {{ points: number, wins_correct: number, losses: number,
 *             draws_correct: number, draws_incorrect: number }}
 *   The four counts partition the user's scored picks: their sum equals the
 *   number of decided matches the user picked.
 */
export function aggregateUserScore(entries = []) {
  const row = { points: 0, wins_correct: 0, losses: 0, draws_correct: 0, draws_incorrect: 0 };

  for (const { pick, game } of entries) {
    const { points, bucket, scored } = scoreSoccerPick(pick, game);
    if (!scored) continue;
    row.points += points;
    row[bucket] += 1;
  }

  return row;
}

/**
 * Stable tiebreaker comparator over leaderboard rows.
 *
 * Order (each consulted only when all earlier criteria tie):
 *   1. points          desc
 *   2. wins_correct    desc
 *   3. losses          asc
 *   4. draws_correct   desc
 *   5. draws_incorrect asc
 *   6. equal (0) — the users are tied and split the pot.
 *
 * Returns <0 if a ranks ahead of b, >0 if b ranks ahead of a, 0 if tied.
 * Returning 0 on a full tie keeps the sort stable: genuinely-tied users retain
 * their input order, so a deterministically-ordered input yields a repeatable
 * response. Use `buildLeaderboard` to get that determinism for free.
 */
export function tiebreakerComparator(a, b) {
  if (b.points !== a.points) return b.points - a.points;                 // points desc
  if (b.wins_correct !== a.wins_correct) return b.wins_correct - a.wins_correct;     // wins desc
  if (a.losses !== b.losses) return a.losses - b.losses;                 // losses asc
  if (b.draws_correct !== a.draws_correct) return b.draws_correct - a.draws_correct; // draws_correct desc
  if (a.draws_incorrect !== b.draws_incorrect) return a.draws_incorrect - b.draws_incorrect; // draws_incorrect asc
  return 0; // fully tied — split pot
}

/**
 * Build an ordered, ranked leaderboard from raw (userId, pick, game) rows.
 *
 * Groups rows by userId, aggregates each user's score, and orders them with
 * `tiebreakerComparator`. Users who tie on all four criteria share a rank
 * (standard competition ranking: 1, 2, 2, 4) and are flagged `tied` so the
 * route can render a split pot. Input is pre-sorted by userId before the stable
 * sort so the output order is fully deterministic regardless of feed order.
 *
 * @param {Array<{ userId: any, pick: object, game: object }>} rows
 * @returns {Array<{ userId: any, points: number, wins_correct: number,
 *   losses: number, draws_correct: number, draws_incorrect: number,
 *   rank: number, tied: boolean }>}
 */
export function buildLeaderboard(rows = []) {
  const byUser = new Map();
  for (const row of rows) {
    if (!byUser.has(row.userId)) byUser.set(row.userId, []);
    byUser.get(row.userId).push({ pick: row.pick, game: row.game });
  }

  const users = [...byUser.entries()].map(([userId, entries]) => ({
    userId,
    ...aggregateUserScore(entries),
  }));

  // Deterministic base order so equal-under-comparator users rank repeatably.
  users.sort((a, b) => (a.userId > b.userId ? 1 : a.userId < b.userId ? -1 : 0));
  users.sort(tiebreakerComparator);

  let lastRank = 0;
  return users.map((u, i) => {
    const prev = users[i - 1];
    const tiedWithPrev = prev && tiebreakerComparator(prev, u) === 0;
    const rank = tiedWithPrev ? lastRank : i + 1; // competition ranking (skips after ties)
    lastRank = rank;
    return { ...u, rank };
  }).map((u, i, ranked) => ({
    ...u,
    tied: ranked.some((o, j) => j !== i && o.rank === u.rank),
  }));
}
