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

    // 5. Verify the columns landed with the expected shape.
    console.log('\n5. Verifying added columns...');
    const verify = await pool.query(`
      SELECT table_name, column_name, data_type, is_nullable, column_default
      FROM information_schema.columns
      WHERE (table_name = 'games' AND column_name IN ('league', 'stage'))
         OR (table_name = 'user_picks' AND column_name = 'picked_result')
         OR (table_name = 'groups' AND column_name = 'pool_type')
      ORDER BY table_name, column_name
    `);
    verify.rows.forEach(col => {
      console.log(
        `   - ${col.table_name}.${col.column_name}: ${col.data_type}` +
        ` (nullable=${col.is_nullable}, default=${col.column_default ?? 'none'})`
      );
    });

    // ────────────────────────────────────────────────────────────────────────
    // PLACEHOLDER: BACKFILL + ROW-COUNT VERIFICATION (next task)
    //
    // The next task inserts here, BEFORE COMMIT:
    //   - Backfill existing NFL data: games.league='nfl', groups.pool_type='nfl_weekly'
    //     (defaults already cover new/existing rows, but the backfill makes intent
    //     explicit and covers any rows added with NULL); user_picks.picked_result
    //     stays NULL for NFL picks.
    //   - Capture pre-migration row counts (games, user_picks, groups) and assert
    //     they match post-backfill counts so no rows were lost or duplicated.
    //   - Throw on any mismatch so the catch below rolls the whole transaction back.
    // ────────────────────────────────────────────────────────────────────────

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
