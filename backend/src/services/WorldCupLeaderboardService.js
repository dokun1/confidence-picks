import { buildLeaderboard } from './SoccerScoringService.js';
import { GameService } from './GameService.js';
import { readSnapshot as readSnap, writeSnapshot as writeSnap } from '../models/WorldCupLeaderboardSnapshot.js';

export function buildVersionString({ gameWatermark, memberCount, memberMaxId, picksWatermark }) {
  return [gameWatermark ?? 'none', memberCount ?? 0, memberMaxId ?? 0, picksWatermark ?? 'none'].join('|');
}

export async function getLeaderboardVersion(pool, group) {
  // Finalized-game watermark: the latest change-time among FINAL World Cup games.
  const { rows: gw } = await pool.query(
    `SELECT MAX(last_updated) AS watermark
       FROM games WHERE league = 'world_cup' AND status = 'FINAL'`
  );
  // Member-set signal: count + highest membership id (catches joins AND leaves/rejoins).
  const { rows: mr } = await pool.query(
    `SELECT COUNT(*) AS cnt, MAX(id) AS maxid
       FROM group_memberships WHERE group_id = $1`,
    [group.id]
  );
  // Picks signal: latest pick edit in this group (picks are NOT server-locked).
  const { rows: pw } = await pool.query(
    `SELECT MAX(updated_at) AS watermark
       FROM user_picks WHERE group_id = $1 AND picked_result IS NOT NULL`,
    [group.id]
  );
  return buildVersionString({
    gameWatermark: gw[0]?.watermark ? new Date(gw[0].watermark).toISOString() : null,
    memberCount: Number(mr[0]?.cnt ?? 0),
    memberMaxId: Number(mr[0]?.maxid ?? 0),
    picksWatermark: pw[0]?.watermark ? new Date(pw[0].watermark).toISOString() : null,
  });
}

/**
 * Given an already-fetched set of World Cup games, build the ranked leaderboard
 * for one group. DB reads (members + picks) happen here; game fetching does NOT —
 * games are passed in so callers control freshness (live ESPN vs DB snapshot).
 * Output shape is identical to the legacy inline route logic.
 */
export async function buildGroupLeaderboard(pool, group, games) {
  const gameById = new Map(games.map(g => [g.id, g]));
  const wcGameIds = [...gameById.keys()];

  const { rows: members } = await pool.query(
    `SELECT u.id, u.name, u.picture_url
       FROM group_memberships gm
       JOIN users u ON u.id = gm.user_id
      WHERE gm.group_id = $1`,
    [group.id]
  );

  let pickRows = [];
  if (wcGameIds.length > 0) {
    const result = await pool.query(
      `SELECT user_id, game_id, picked_result
         FROM user_picks
        WHERE group_id = $1 AND picked_result IS NOT NULL AND game_id = ANY($2::int[])`,
      [group.id, wcGameIds]
    );
    pickRows = result.rows;
  }

  const scoringRows = [];
  const usersWithPicks = new Set();
  for (const pr of pickRows) {
    const game = gameById.get(pr.game_id);
    if (!game) continue;
    scoringRows.push({ userId: pr.user_id, pick: { picked_result: pr.picked_result }, game });
    usersWithPicks.add(pr.user_id);
  }
  for (const m of members) {
    if (!usersWithPicks.has(m.id)) {
      scoringRows.push({ userId: m.id, pick: null, game: null });
    }
  }

  const memberById = new Map(members.map(m => [m.id, m]));
  return buildLeaderboard(scoringRows).map(row => {
    const u = memberById.get(row.userId) || {};
    return {
      userId: row.userId,
      name: u.name ?? null,
      pictureUrl: u.picture_url ?? null,
      rank: row.rank,
      tied: row.tied,
      points: row.points,
      wins_correct: row.wins_correct,
      losses: row.losses,
      draws_correct: row.draws_correct,
      draws_incorrect: row.draws_incorrect,
    };
  });
}

/**
 * Order-insensitive (per row-key) equality for two leaderboard arrays. Rows are
 * already in deterministic rank order from buildLeaderboard, so this compares
 * row-by-row on the known fields — avoiding false mismatches from JSONB key-order
 * normalization when one side was round-tripped through a jsonb column.
 */
export function leaderboardsMatch(a, b) {
  if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return false;
  const key = (r) => [
    r.userId, r.rank, r.tied, r.points,
    r.wins_correct, r.losses, r.draws_correct, r.draws_incorrect,
    r.name ?? null, r.pictureUrl ?? null,
  ];
  for (let i = 0; i < a.length; i++) {
    if (JSON.stringify(key(a[i])) !== JSON.stringify(key(b[i]))) return false;
  }
  return true;
}

/**
 * Legacy compute: fetch the whole World Cup slate via the existing cache-first
 * getAllWorldCupStages() and score it. This is the fallback path and the shadow
 * baseline; its output matches today's leaderboard endpoint exactly. gameService
 * and build are injectable for hermetic tests.
 */
export async function computeLive(pool, group, { gameService = GameService, build = buildGroupLeaderboard } = {}) {
  const games = await gameService.getAllWorldCupStages();
  return build(pool, group, games);
}

/**
 * Cached read: refresh games (cache-first), compute the cheap version watermark,
 * serve the stored snapshot on a hit, recompute + store on a miss. On ANY thrown
 * error, fall back to live computation so the endpoint never errors or goes stale
 * due to a cache bug. deps allows injecting collaborators for tests.
 */
export async function getGroupLeaderboardCached(pool, group, deps = {}) {
  const {
    gameService = GameService,
    getLeaderboardVersion: getVersion = getLeaderboardVersion,
    buildGroupLeaderboard: build = buildGroupLeaderboard,
    readSnapshot: read = readSnap,
    writeSnapshot: write = writeSnap,
  } = deps;
  try {
    const games = await gameService.getAllWorldCupStages();
    const version = await getVersion(pool, group);
    const snap = await read(pool, group.id);
    if (snap && snap.version === version) {
      return { leaderboard: snap.payload, source: 'hit' };
    }
    const leaderboard = await build(pool, group, games);
    await write(pool, group.id, version, leaderboard);
    return { leaderboard, source: 'miss' };
  } catch (err) {
    console.error('[wc-leaderboard-cache] falling back to live compute:', err);
    const leaderboard = await computeLive(pool, group, { gameService, build });
    return { leaderboard, source: 'fallback' };
  }
}
