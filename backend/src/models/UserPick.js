import pool from '../config/database.js';

// Valid World Cup pick outcomes (side-relative). Mirrors the games/user_picks
// CHECK constraint and SoccerScoringService's `picked_result` contract.
export const WORLD_CUP_RESULTS = ['home', 'away', 'draw'];

/**
 * Build the parameterized bulk-upsert for World Cup picks.
 *
 * Pure (no DB) so it can be unit-tested offline. World Cup picks store
 * `picked_result` and carry NO confidence/picked_team_id — the inverse of an
 * NFL pick. Keyed by (user_id, group_id, game_id) like the NFL upsert; on
 * conflict the team/confidence columns are forced NULL so a row can never carry
 * both an NFL and a World Cup shape (keeps the chk_pick_consistency CHECK happy).
 *
 * @returns {{ sql: string, values: any[] }}
 * @throws {Error} on a missing gameId or a picked_result outside WORLD_CUP_RESULTS.
 */
export function buildWorldCupUpsert({ userId, groupId, season, seasonType, week, picks }) {
  const values = [];
  const placeholders = picks.map((p, i) => {
    if (p.gameId == null) throw new Error('World Cup pick missing gameId');
    if (!WORLD_CUP_RESULTS.includes(p.pickedResult)) {
      throw new Error(`Invalid picked_result: ${p.pickedResult}`);
    }
    // 7 columns per row; base offset keeps parameter numbers contiguous.
    const base = i * 7;
    values.push(userId, groupId, p.gameId, p.pickedResult, week, season, seasonType);
    return `($${base+1},$${base+2},$${base+3},$${base+4},$${base+5},$${base+6},$${base+7})`;
  }).join(',');

  const sql = `INSERT INTO user_picks (user_id, group_id, game_id, picked_result, week, season, season_type)
         VALUES ${placeholders}
         ON CONFLICT (user_id, group_id, game_id) DO UPDATE SET
                   picked_result = EXCLUDED.picked_result,
                   picked_team_id = NULL,
                   confidence_level = NULL,
                   week = EXCLUDED.week,
                   season = EXCLUDED.season,
                   season_type = EXCLUDED.season_type,
                   updated_at = NOW()
                 RETURNING *`;
  return { sql, values };
}

/**
 * UserPick model handles persistence of picks per user/game/group.
 *
 * Two pick shapes share the table:
 *   NFL        — picked_team_id + confidence_level set, picked_result NULL.
 *   World Cup  — picked_result ('home'|'away'|'draw') set, the other two NULL.
 */
export class UserPick {
  constructor(row) {
    this.id = row.id;
    this.userId = row.user_id;
    this.groupId = row.group_id;
    this.gameId = row.game_id;
    this.pickedTeamId = row.picked_team_id;
    this.confidence = row.confidence_level;
    // World Cup pick outcome ('home'|'away'|'draw'); NULL for NFL picks. Surfaced
    // so the picks router and tournament leaderboard can read it back.
    this.pickedResult = row.picked_result ?? null;
    this.week = row.week;
    this.season = row.season;
    this.seasonType = row.season_type;
    this.won = row.won;
    this.points = row.points;
    this.createdAt = row.created_at ? new Date(row.created_at) : null;
    this.updatedAt = row.updated_at ? new Date(row.updated_at) : null;
  }

  static async findForUserWeek({ userId, groupId, season, seasonType, week }) {
  console.log('[user_picks] findForUserWeek start', { userId, groupId, season, seasonType, week });
    const q = `SELECT * FROM user_picks WHERE user_id=$1 AND group_id=$2 AND season=$3 AND season_type=$4 AND week=$5`;
    const { rows } = await pool.query(q, [userId, groupId, season, seasonType, week]);
  console.log('[user_picks] findForUserWeek rows', rows.length, rows.map(r => ({ g:r.game_id, conf:r.confidence_level, team:r.picked_team_id })));
    return rows.map(r => new UserPick(r));
  }

  static async findForGroupWeek({ groupId, season, seasonType, week }) {
    const q = `SELECT * FROM user_picks WHERE group_id=$1 AND season=$2 AND season_type=$3 AND week=$4`;
    const { rows } = await pool.query(q, [groupId, season, seasonType, week]);
    return rows.map(r => new UserPick(r));
  }

  // Seasons that have any stored pick data for a group, newest first. Lets the
  // frontend default its season selector to the latest season with history so
  // old groups stay readable after the calendar rolls into a new season.
  static async findSeasonsForGroup(groupId) {
    const q = `SELECT DISTINCT season FROM user_picks WHERE group_id=$1 ORDER BY season DESC`;
    const { rows } = await pool.query(q, [groupId]);
    return rows.map(r => r.season);
  }

  static async bulkUpsert({ userId, groupId, season, seasonType, week, picks }) {
    if (!picks || picks.length === 0) return [];
  console.log('[user_picks] bulkUpsert incoming', { userId, groupId, season, seasonType, week, picks });
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
  console.log('[user_picks] bulkUpsert result', rows.map(r => ({ id:r.id, game:r.game_id, conf:r.confidence_level, team:r.picked_team_id })));
    return rows.map(r => new UserPick(r));
  }

  /**
   * Bulk upsert World Cup picks. Additive sibling to bulkUpsert: persists
   * `picked_result` rows (no confidence, no picked_team_id) keyed by
   * (user_id, group_id, game_id). NFL pick read/write is untouched.
   *
   * @param {{ picks: Array<{ gameId: number, pickedResult: 'home'|'away'|'draw' }> }} args
   * @returns {Promise<UserPick[]>}
   */
  static async bulkUpsertWorldCupPicks({ userId, groupId, season, seasonType, week, picks }) {
    if (!picks || picks.length === 0) return [];
  console.log('[user_picks] bulkUpsertWorldCupPicks incoming', { userId, groupId, season, seasonType, week, picks });
    const { sql, values } = buildWorldCupUpsert({ userId, groupId, season, seasonType, week, picks });
    const { rows } = await pool.query(sql, values);
  console.log('[user_picks] bulkUpsertWorldCupPicks result', rows.map(r => ({ id:r.id, game:r.game_id, result:r.picked_result })));
    return rows.map(r => new UserPick(r));
  }

  // Ensure the partial unique index for confidence includes user_id (production resilience)
  static async ensureConfidenceIndex() {
    try {
      const { rows } = await pool.query(`SELECT indexdef FROM pg_indexes WHERE tablename='user_picks' AND indexname='ux_user_picks_conf_per_week'`);
      if (rows.length === 0) return; // will be created by schema init path
      const def = rows[0].indexdef;
      console.log('[user_picks] ensureConfidenceIndex current def', def);
      // If user_id missing from index definition, recreate with correct column list
      // Expected order: (user_id, group_id, week, season, season_type, confidence_level)
      if (!/\(user_id, group_id, week, season, season_type, confidence_level\)/.test(def)) {
        console.log('[user_picks] Recreating malformed confidence unique index to include user_id');
        await pool.query('BEGIN');
        await pool.query('DROP INDEX IF EXISTS ux_user_picks_conf_per_week');
        await pool.query(`CREATE UNIQUE INDEX ux_user_picks_conf_per_week ON user_picks(user_id, group_id, week, season, season_type, confidence_level) WHERE confidence_level IS NOT NULL`);
        await pool.query('COMMIT');
      } else {
        console.log('[user_picks] ensureConfidenceIndex OK');
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
    // Correct picks get +confidence points, incorrect picks get -confidence points
    await pool.query(`UPDATE user_picks
      SET won = (picked_team_id = $2), points = CASE WHEN picked_team_id = $2 THEN confidence_level ELSE -confidence_level END, updated_at=NOW()
      WHERE game_id = $1`, [gameId, winningTeamId]);
  }
}
