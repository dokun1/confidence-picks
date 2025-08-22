import pool from '../config/database.js';

/**
 * UserPick model handles persistence of picks (winner + confidence) per user/game/group.
 */
export class UserPick {
  constructor(row) {
    this.id = row.id;
    this.userId = row.user_id;
    this.groupId = row.group_id;
    this.gameId = row.game_id;
    this.pickedTeamId = row.picked_team_id;
    this.confidence = row.confidence_level;
    this.week = row.week;
    this.season = row.season;
    this.seasonType = row.season_type;
    this.won = row.won;
    this.points = row.points;
    this.createdAt = row.created_at ? new Date(row.created_at) : null;
    this.updatedAt = row.updated_at ? new Date(row.updated_at) : null;
  }

  static async findForUserWeek({ userId, groupId, season, seasonType, week }) {
    const q = `SELECT * FROM user_picks WHERE user_id=$1 AND group_id=$2 AND season=$3 AND season_type=$4 AND week=$5`;
    const { rows } = await pool.query(q, [userId, groupId, season, seasonType, week]);
    return rows.map(r => new UserPick(r));
  }

  static async bulkUpsert({ userId, groupId, season, seasonType, week, picks }) {
    if (!picks || picks.length === 0) return [];
    const values = [];
    const placeholders = picks.map((p, i) => {
      // 8 columns per row; base offset must reflect that to keep parameter numbers contiguous
      const base = i * 8;
      values.push(userId, groupId, p.gameId, p.pickedTeamId || null, p.confidence ?? null, week, season, seasonType);
      return `($${base+1},$${base+2},$${base+3},$${base+4},$${base+5},$${base+6},$${base+7},$${base+8})`;
    }).join(',');
  const sql = `INSERT INTO user_picks (user_id, group_id, game_id, picked_team_id, confidence_level, week, season, season_type)
         VALUES ${placeholders}
         ON CONFLICT (user_id, group_id, game_id) DO UPDATE SET
                   picked_team_id = EXCLUDED.picked_team_id,
                   confidence_level = EXCLUDED.confidence_level,
                   week = EXCLUDED.week,
                   season = EXCLUDED.season,
                   season_type = EXCLUDED.season_type,
                   updated_at = NOW()
                 RETURNING *`;
    const { rows } = await pool.query(sql, values);
    return rows.map(r => new UserPick(r));
  }

  // Ensure the partial unique index for confidence includes user_id (production resilience)
  static async ensureConfidenceIndex() {
    try {
      const { rows } = await pool.query(`SELECT indexdef FROM pg_indexes WHERE tablename='user_picks' AND indexname='ux_user_picks_conf_per_week'`);
      if (rows.length === 0) return; // will be created by schema init path
      const def = rows[0].indexdef;
      // If user_id missing from index definition, recreate with correct column list
      // Expected order: (user_id, group_id, week, season, season_type, confidence_level)
      if (!/\(user_id, group_id, week, season, season_type, confidence_level\)/.test(def)) {
        console.log('[user_picks] Recreating malformed confidence unique index to include user_id');
        await pool.query('BEGIN');
        await pool.query('DROP INDEX IF EXISTS ux_user_picks_conf_per_week');
        await pool.query(`CREATE UNIQUE INDEX ux_user_picks_conf_per_week ON user_picks(user_id, group_id, week, season, season_type, confidence_level) WHERE confidence_level IS NOT NULL`);
        await pool.query('COMMIT');
      }
    } catch (e) {
      console.warn('[user_picks] ensureConfidenceIndex failed:', e.message);
      try { await pool.query('ROLLBACK'); } catch(_) {}
    }
  }

  static async clearPending({ userId, groupId, season, seasonType, week, gameIds }) {
    if (!gameIds || gameIds.length === 0) return;
    const params = [userId, groupId, season, seasonType, week];
    const inClause = gameIds.map((_, i) => `$${i+6}`).join(',');
    params.push(...gameIds);
    await pool.query(`UPDATE user_picks
      SET picked_team_id=NULL, confidence_level=NULL, updated_at=NOW()
      WHERE user_id=$1 AND group_id=$2 AND season=$3 AND season_type=$4 AND week=$5 AND game_id IN (${inClause})`, params);
  }

  static async updateResults({ gameId, winningTeamId }) {
    // Set won/points for all picks for a final game
    await pool.query(`UPDATE user_picks
      SET won = (picked_team_id = $2), points = CASE WHEN picked_team_id = $2 THEN confidence_level ELSE 0 END, updated_at=NOW()
      WHERE game_id = $1`, [gameId, winningTeamId]);
  }
}
