import { Pool } from 'pg';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Forward-only migration: add World Cup 2026 columns to the data model.
//
// Adds league awareness so the same tables can carry both NFL weekly pools and
// the new World Cup 2026 tournament pools:
//   - games.league          varchar default 'nfl'  (which league a game belongs to)
//   - games.stage           varchar nullable        (soccer stage: group/r32/r16/qf/sf/third/final; NFL ignores it)
//   - user_picks.picked_result varchar nullable + CHECK ('home'|'away'|'draw')  (3-way soccer pick)
//   - groups.pool_type      varchar default 'nfl_weekly' + CHECK ('nfl_weekly'|'world_cup_2026')
//
// All statements use ADD COLUMN IF NOT EXISTS so the migration is idempotent and
// safe to re-run. It does NOT touch user_picks.confidence_level or its constraint;
// NFL functionality is unchanged. Migration is forward-only (no down migration).
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function addWorldCupColumns() {
  try {
    console.log('🌎 Adding World Cup 2026 columns...\n');

    // Start transaction
    await pool.query('BEGIN');

    // 0. Capture pre-migration row counts BEFORE any ALTER. A forward-only migration
    //    must never drop or duplicate rows; these baselines are asserted against the
    //    post-backfill counts below. Captured inside the transaction so they reflect
    //    the exact rows the rest of the migration operates on.
    console.log('0. Capturing pre-migration row counts...');
    const preCounts = {};
    for (const table of ['games', 'user_picks', 'groups']) {
      const { rows } = await pool.query(`SELECT COUNT(*)::int AS count FROM ${table}`);
      preCounts[table] = rows[0].count;
      console.log(`   - ${table}: ${preCounts[table]} rows`);
    }

    // 1. games.league — which league a game belongs to. Default 'nfl' so existing
    //    NFL rows are correctly labeled the moment the column is added.
    console.log('1. Adding games.league (varchar default \'nfl\')...');
    await pool.query(`
      ALTER TABLE games
      ADD COLUMN IF NOT EXISTS league VARCHAR(50) DEFAULT 'nfl'
    `);
    console.log('   ✅ games.league ensured');

    // 2. games.stage — soccer tournament stage (group/r32/r16/qf/sf/third/final).
    //    Nullable; NFL games ignore it.
    console.log('\n2. Adding games.stage (varchar nullable)...');
    await pool.query(`
      ALTER TABLE games
      ADD COLUMN IF NOT EXISTS stage VARCHAR(50)
    `);
    console.log('   ✅ games.stage ensured');

    // 3. user_picks.picked_result — 3-way soccer pick. Nullable (NFL picks leave it
    //    NULL and continue to use confidence_level). CHECK is declared inline so it is
    //    created atomically with the column and skipped entirely on re-runs (IF NOT
    //    EXISTS). This does NOT touch confidence_level or its constraint.
    console.log('\n3. Adding user_picks.picked_result (varchar nullable, CHECK home|away|draw)...');
    await pool.query(`
      ALTER TABLE user_picks
      ADD COLUMN IF NOT EXISTS picked_result VARCHAR(10)
        CHECK (picked_result IN ('home', 'away', 'draw'))
    `);
    console.log('   ✅ user_picks.picked_result ensured');

    // 4. groups.pool_type — distinguishes NFL weekly pools from World Cup tournament
    //    pools. Default 'nfl_weekly' so existing groups stay NFL. CHECK declared inline.
    console.log('\n4. Adding groups.pool_type (varchar default \'nfl_weekly\', CHECK nfl_weekly|world_cup_2026)...');
    await pool.query(`
      ALTER TABLE groups
      ADD COLUMN IF NOT EXISTS pool_type VARCHAR(20) DEFAULT 'nfl_weekly'
        CHECK (pool_type IN ('nfl_weekly', 'world_cup_2026'))
    `);
    console.log('   ✅ groups.pool_type ensured');

    // 4c. groups.knockout_only — world_cup_2026 sub-setting. When true, members may
    //     only pick knockout-stage games; group-stage picks are rejected. Added as
    //     NOT NULL DEFAULT false: Postgres backfills every existing row with false
    //     atomically as part of the ADD, so the column is non-null from the start
    //     and every existing group (NFL and World Cup alike) is unaffected.
    console.log('\n4c. Adding groups.knockout_only (boolean NOT NULL default false)...');
    await pool.query(`
      ALTER TABLE groups
      ADD COLUMN IF NOT EXISTS knockout_only BOOLEAN NOT NULL DEFAULT false
    `);
    console.log('   ✅ groups.knockout_only ensured');

    // 4b. games.winner_team_id — the resolved advancing-team id for soccer
    //     knockout matches. Persisted because ESPN's competitor.winner flag (the
    //     only signal on a PK shootout) isn't recoverable from a cached row's
    //     scores alone. Nullable; NFL and group-stage rows leave it NULL. This
    //     ALTER was originally only in schema.sql, so DBs that never ran a full
    //     schema sync (e.g. production with INIT_DB unset) were missing it, which
    //     made every Game.save() — NFL and World Cup alike — fail with
    //     'column "winner_team_id" of relation "games" does not exist'.
    console.log('\n4b. Adding games.winner_team_id (varchar nullable)...');
    await pool.query(`
      ALTER TABLE games
      ADD COLUMN IF NOT EXISTS winner_team_id VARCHAR(50)
    `);
    console.log('   ✅ games.winner_team_id ensured');

    // 5. Verify the columns landed with the expected shape.
    console.log('\n5. Verifying added columns...');
    const verify = await pool.query(`
      SELECT table_name, column_name, data_type, is_nullable, column_default
      FROM information_schema.columns
      WHERE (table_name = 'games' AND column_name IN ('league', 'stage', 'winner_team_id'))
         OR (table_name = 'user_picks' AND column_name = 'picked_result')
         OR (table_name = 'groups' AND column_name IN ('pool_type', 'knockout_only'))
      ORDER BY table_name, column_name
    `);
    verify.rows.forEach(col => {
      console.log(
        `   - ${col.table_name}.${col.column_name}: ${col.data_type}` +
        ` (nullable=${col.is_nullable}, default=${col.column_default ?? 'none'})`
      );
    });

    // 6. Backfill existing rows defensively. Column defaults already cover new
    //    inserts; these UPDATEs guarantee pre-existing rows that predate the default
    //    (or were somehow added with NULL) are correct. user_picks.picked_result
    //    intentionally stays NULL for existing NFL picks — no backfill there.
    console.log('\n6. Backfilling existing rows...');

    const gamesBackfill = await pool.query(`
      UPDATE games SET league = 'nfl' WHERE league IS NULL
    `);
    console.log(`   ✅ games.league set to 'nfl' for ${gamesBackfill.rowCount} NULL row(s)`);

    const groupsBackfill = await pool.query(`
      UPDATE groups SET pool_type = 'nfl_weekly' WHERE pool_type IS NULL
    `);
    console.log(`   ✅ groups.pool_type set to 'nfl_weekly' for ${groupsBackfill.rowCount} NULL row(s)`);

    console.log('   ℹ️  user_picks.picked_result left NULL for existing NFL picks (no backfill)');

    // 7. Re-count and assert integrity. A forward-only migration must never drop or
    //    duplicate rows. ALTER ADD COLUMN and the UPDATEs above cannot change row
    //    counts, so any mismatch signals data corruption — throw to roll back rather
    //    than commit a migration that lost or duplicated rows.
    console.log('\n7. Verifying row counts unchanged...');
    let integrityOk = true;
    for (const table of ['games', 'user_picks', 'groups']) {
      const { rows } = await pool.query(`SELECT COUNT(*)::int AS count FROM ${table}`);
      const postCount = rows[0].count;
      const preCount = preCounts[table];
      if (postCount === preCount) {
        console.log(`   ✅ ${table}: ${postCount} rows (unchanged)`);
      } else {
        integrityOk = false;
        console.error(
          `   ❌ ${table}: row count changed from ${preCount} to ${postCount} ` +
          `(delta ${postCount - preCount}) — migration must not drop or duplicate rows`
        );
      }
    }

    if (!integrityOk) {
      throw new Error(
        'Row-count integrity check failed: one or more tables changed row count during migration. Rolling back.'
      );
    }

    // Commit the transaction
    await pool.query('COMMIT');
    console.log('\n✅ World Cup 2026 columns added successfully!');

  } catch (error) {
    console.error('❌ Error adding World Cup columns:', error);
    try {
      await pool.query('ROLLBACK');
      console.log('🔄 Transaction rolled back');
    } catch (rollbackError) {
      console.error('❌ Rollback failed:', rollbackError);
    }
    throw error;
  } finally {
    await pool.end();
  }
}

// Run the migration
addWorldCupColumns()
  .then(() => process.exit(0))
  .catch(() => process.exit(1));
