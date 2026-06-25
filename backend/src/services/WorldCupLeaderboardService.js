import { buildLeaderboard } from './SoccerScoringService.js';

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
