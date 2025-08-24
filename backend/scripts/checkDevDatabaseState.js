import dotenv from 'dotenv';
import { Pool } from 'pg';

// Load environment variables
dotenv.config();

// Connect to development database
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: false // Development database
});

/**
 * Check current state of development database
 */
async function checkDevDatabaseState() {
  try {
    console.log('🔍 Checking Development Database State');
    console.log('='.repeat(50));

    // Check games table structure and data
    const gamesColumns = await pool.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'games' 
      ORDER BY ordinal_position
    `);

    console.log('\n📋 Games table structure:');
    gamesColumns.rows.forEach(col => {
      console.log(`  - ${col.column_name}: ${col.data_type}`);
    });

    // Check games data
    const gamesResult = await pool.query(`
      SELECT week, season, season_type, COUNT(*) as count
      FROM games 
      GROUP BY week, season, season_type
      ORDER BY season, season_type, week
    `);

    console.log('\n🏈 Games data by week:');
    if (gamesResult.rows.length > 0) {
      gamesResult.rows.forEach(row => {
        console.log(`  - Season ${row.season}, Type ${row.season_type}, Week ${row.week}: ${row.count} games`);
      });
    } else {
      console.log('  - No games found');
    }

    // Check user picks
    const picksResult = await pool.query(`
      SELECT COUNT(*) as total_picks
      FROM user_picks
    `);

    console.log(`\n🎯 Total user picks: ${picksResult.rows[0].total_picks}`);

    // Check groups table structure
    const groupsColumns = await pool.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'groups' 
      ORDER BY ordinal_position
    `);

    console.log('\n👥 Groups table structure:');
    groupsColumns.rows.forEach(col => {
      console.log(`  - ${col.column_name}: ${col.data_type}`);
    });

    // Check if there are any groups
    const groupsResult = await pool.query(`
      SELECT id, name, identifier
      FROM groups
      ORDER BY id
    `);

    console.log(`\n👥 Groups: ${groupsResult.rows.length} found`);
    if (groupsResult.rows.length > 0) {
      groupsResult.rows.forEach(group => {
        console.log(`  - ${group.id}: ${group.name} (${group.identifier})`);
      });
    }

    console.log('\n✅ Database state check complete');

  } catch (error) {
    console.error('❌ Error checking database state:', error);
  } finally {
    await pool.end();
  }
}

// Run the check
checkDevDatabaseState();
