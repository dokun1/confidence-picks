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
 * Clean up all Week 0 data from the development database
 */
async function cleanupWeek0DevDatabase() {
  try {
    console.log('🧹 Cleaning Up Week 0 Data from Development Database');
    console.log('='.repeat(60));

    // First, let's see what we're about to delete
    const picksResult = await pool.query(`
      SELECT up.id, up.user_id, up.game_id, up.confidence_level, up.points, u.email
      FROM user_picks up
      JOIN games g ON up.game_id = g.id
      JOIN users u ON up.user_id = u.id
      WHERE g.week = 0 AND g.season = 2025 AND g.season_type = 2
      ORDER BY up.user_id, up.confidence_level DESC
    `);

    console.log(`\n🎯 Week 0 Picks to Delete: ${picksResult.rows.length}`);
    if (picksResult.rows.length > 0) {
      const userPicks = {};
      picksResult.rows.forEach(pick => {
        if (!userPicks[pick.email]) {
          userPicks[pick.email] = [];
        }
        userPicks[pick.email].push(pick);
      });

      Object.entries(userPicks).forEach(([email, picks]) => {
        const totalPoints = picks.reduce((sum, pick) => sum + (pick.points || 0), 0);
        console.log(`  - ${email}: ${picks.length} picks (${totalPoints} points)`);
      });
    }

    const gamesResult = await pool.query(`
      SELECT id, espn_id, home_team, away_team
      FROM games 
      WHERE week = 0 AND season = 2025 AND season_type = 2
      ORDER BY id
    `);

    console.log(`\n🏈 Week 0 Games to Delete: ${gamesResult.rows.length}`);

    // Confirm before proceeding
    console.log(`\n⚠️  About to delete:`);
    console.log(`   - ${picksResult.rows.length} user picks`);
    console.log(`   - ${gamesResult.rows.length} games`);
    console.log(`\n🚀 Proceeding with cleanup...`);

    // Step 1: Delete user picks for Week 0 games
    const deletePicksResult = await pool.query(`
      DELETE FROM user_picks 
      WHERE game_id IN (
        SELECT id FROM games WHERE week = 0 AND season = 2025 AND season_type = 2
      )
    `);

    console.log(`✅ Deleted ${deletePicksResult.rowCount} user picks`);

    // Step 2: Delete Week 0 games
    const deleteGamesResult = await pool.query(`
      DELETE FROM games 
      WHERE week = 0 AND season = 2025 AND season_type = 2
    `);

    console.log(`✅ Deleted ${deleteGamesResult.rowCount} games`);

    // Step 3: Update any groups that might have week = 0
    const updateGroupsResult = await pool.query(`
      UPDATE groups SET week = 1 WHERE week = 0
    `);

    if (updateGroupsResult.rowCount > 0) {
      console.log(`✅ Updated ${updateGroupsResult.rowCount} groups from week 0 to week 1`);
    }

    // Verify cleanup
    const remainingPicks = await pool.query(`
      SELECT COUNT(*) as count
      FROM user_picks up
      JOIN games g ON up.game_id = g.id
      WHERE g.week = 0
    `);

    const remainingGames = await pool.query(`
      SELECT COUNT(*) as count
      FROM games 
      WHERE week = 0 AND season = 2025 AND season_type = 2
    `);

    console.log(`\n📊 Verification:`);
    console.log(`   - Remaining Week 0 picks: ${remainingPicks.rows[0].count}`);
    console.log(`   - Remaining Week 0 games: ${remainingGames.rows[0].count}`);

    if (remainingPicks.rows[0].count === '0' && remainingGames.rows[0].count === '0') {
      console.log(`\n🎉 Week 0 cleanup completed successfully!`);
      console.log(`   - All Week 0 data has been removed from development database`);
      console.log(`   - User scores should now reflect only regular season performance`);
    } else {
      console.log(`\n⚠️  Some Week 0 data may still remain - please verify`);
    }

  } catch (error) {
    console.error('❌ Error cleaning up Week 0 data:', error);
  } finally {
    await pool.end();
  }
}

// Run the cleanup
cleanupWeek0DevDatabase();
