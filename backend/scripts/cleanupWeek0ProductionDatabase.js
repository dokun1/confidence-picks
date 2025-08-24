import dotenv from 'dotenv';
import { Pool } from 'pg';

// Load environment variables
dotenv.config();

// Connect to PRODUCTION database
const prodPool = new Pool({
  connectionString: process.env.PROD_DATABASE_URL,
  ssl: { rejectUnauthorized: false } // Production database with SSL
});

/**
 * Clean up all Week 0 data from the PRODUCTION database
 * ⚠️  THIS WILL DELETE PRODUCTION DATA - USE WITH CAUTION
 */
async function cleanupWeek0ProductionDatabase() {
  try {
    console.log('🧹 Cleaning Up Week 0 Data from PRODUCTION Database');
    console.log('⚠️  WARNING: THIS WILL DELETE PRODUCTION DATA');
    console.log('='.repeat(60));

    // First, let's see what we're about to delete
    const picksResult = await prodPool.query(`
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

      console.log('\n📊 Picks by User:');
      Object.entries(userPicks).forEach(([email, picks]) => {
        const totalPoints = picks.reduce((sum, pick) => sum + (pick.points || 0), 0);
        console.log(`  - ${email}: ${picks.length} picks (${totalPoints} points)`);
      });
    }

    const gamesResult = await prodPool.query(`
      SELECT id, espn_id, home_team, away_team, status
      FROM games 
      WHERE week = 0 AND season = 2025 AND season_type = 2
      ORDER BY id
    `);

    console.log(`\n🏈 Week 0 Games to Delete: ${gamesResult.rows.length}`);
    if (gamesResult.rows.length > 0) {
      console.log('\n📋 Games to Delete:');
      gamesResult.rows.slice(0, 5).forEach(game => {
        const homeTeam = typeof game.home_team === 'string' ? JSON.parse(game.home_team) : game.home_team;
        const awayTeam = typeof game.away_team === 'string' ? JSON.parse(game.away_team) : game.away_team;
        console.log(`  - Game ${game.id}: ${awayTeam.abbreviation} @ ${homeTeam.abbreviation} (${game.status})`);
      });
      if (gamesResult.rows.length > 5) {
        console.log(`  ... and ${gamesResult.rows.length - 5} more games`);
      }
    }

    // Calculate total points impact
    const totalPointsToRemove = picksResult.rows.reduce((sum, pick) => sum + (pick.points || 0), 0);

    console.log(`\n⚠️  PRODUCTION IMPACT SUMMARY:`);
    console.log(`   - Users affected: ${Object.keys(userPicks || {}).length}`);
    console.log(`   - Total picks to delete: ${picksResult.rows.length}`);
    console.log(`   - Total games to delete: ${gamesResult.rows.length}`);
    console.log(`   - Total points to remove: ${totalPointsToRemove}`);

    console.log(`\n🚀 Proceeding with PRODUCTION cleanup...`);

    // Step 1: Delete user picks for Week 0 games
    const deletePicksResult = await prodPool.query(`
      DELETE FROM user_picks 
      WHERE game_id IN (
        SELECT id FROM games WHERE week = 0 AND season = 2025 AND season_type = 2
      )
    `);

    console.log(`✅ Deleted ${deletePicksResult.rowCount} user picks from PRODUCTION`);

    // Step 2: Delete Week 0 games
    const deleteGamesResult = await prodPool.query(`
      DELETE FROM games 
      WHERE week = 0 AND season = 2025 AND season_type = 2
    `);

    console.log(`✅ Deleted ${deleteGamesResult.rowCount} games from PRODUCTION`);

    // Step 3: Update any groups that might have week = 0 (only if the column exists)
    try {
      const updateGroupsResult = await prodPool.query(`
        UPDATE groups SET week = 1 WHERE week = 0
      `);

      if (updateGroupsResult.rowCount > 0) {
        console.log(`✅ Updated ${updateGroupsResult.rowCount} groups from week 0 to week 1`);
      }
    } catch (error) {
      if (error.code === '42703') {
        console.log(`ℹ️  Groups table doesn't have week column - skipping group updates`);
      } else {
        throw error;
      }
    }

    // Verify cleanup
    const remainingPicks = await prodPool.query(`
      SELECT COUNT(*) as count
      FROM user_picks up
      JOIN games g ON up.game_id = g.id
      WHERE g.week = 0
    `);

    const remainingGames = await prodPool.query(`
      SELECT COUNT(*) as count
      FROM games 
      WHERE week = 0 AND season = 2025 AND season_type = 2
    `);

    console.log(`\n📊 PRODUCTION Verification:`);
    console.log(`   - Remaining Week 0 picks: ${remainingPicks.rows[0].count}`);
    console.log(`   - Remaining Week 0 games: ${remainingGames.rows[0].count}`);

    if (remainingPicks.rows[0].count === '0' && remainingGames.rows[0].count === '0') {
      console.log(`\n🎉 PRODUCTION Week 0 cleanup completed successfully!`);
      console.log(`   - All Week 0 preseason data has been removed`);
      console.log(`   - User scores now reflect only regular season performance`);
      console.log(`   - Total points removed from system: ${totalPointsToRemove}`);
    } else {
      console.log(`\n⚠️  Some Week 0 data may still remain in PRODUCTION - please verify`);
    }

  } catch (error) {
    console.error('❌ Error cleaning up Week 0 data from PRODUCTION:', error);
  } finally {
    await prodPool.end();
  }
}

// Run the cleanup
cleanupWeek0ProductionDatabase();
