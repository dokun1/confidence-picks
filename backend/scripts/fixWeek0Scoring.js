import pool from '../src/config/database.js';

/**
 * Fix Week 0 Scoring Issues
 * This script corrects the scoring problems found in the verification
 */

async function fixWeek0Scoring() {
  try {
    console.log('🔧 Fixing Week 0 Scoring Issues');
    console.log('=' .repeat(60));
    console.log();

    // Start transaction
    await pool.query('BEGIN');

    // 1. Fix negative points (should be 0 for incorrect picks)
    console.log('1. Fixing negative points for incorrect picks...');
    const negativePointsResult = await pool.query(`
      UPDATE user_picks 
      SET points = 0 
      WHERE week = 0 AND season = 2025 AND season_type = 2 
      AND points < 0
      RETURNING id, user_id, game_id, confidence_level, points
    `);
    
    console.log(`   ✅ Fixed ${negativePointsResult.rows.length} picks with negative points`);

    // 2. Fix null won values for incorrect picks (should be false)
    console.log('2. Setting won=false for null incorrect picks...');
    
    // First, get all games and their winners
    const gamesQuery = await pool.query(`
      SELECT id, home_team, away_team, home_score, away_score
      FROM games 
      WHERE week = 0 AND season = 2025 AND season_type = 2 AND status = 'FINAL'
    `);

    let fixedNullWon = 0;
    for (const game of gamesQuery.rows) {
      const winningTeamId = game.home_score > game.away_score ? game.home_team.id :
                           game.away_score > game.home_score ? game.away_team.id : null;
      
      if (winningTeamId !== null) {
        // Update incorrect picks (where picked_team_id != winning team) to won=false
        const incorrectResult = await pool.query(`
          UPDATE user_picks 
          SET won = false 
          WHERE week = 0 AND season = 2025 AND season_type = 2 
          AND game_id = $1 
          AND picked_team_id != $2 
          AND won IS NULL
          RETURNING id
        `, [game.id, winningTeamId]);
        
        fixedNullWon += incorrectResult.rows.length;

        // Update correct picks to won=true if not already set
        const correctResult = await pool.query(`
          UPDATE user_picks 
          SET won = true 
          WHERE week = 0 AND season = 2025 AND season_type = 2 
          AND game_id = $1 
          AND picked_team_id = $2 
          AND won IS NULL
          RETURNING id
        `, [game.id, winningTeamId]);
        
        fixedNullWon += correctResult.rows.length;
      }
    }
    
    console.log(`   ✅ Fixed ${fixedNullWon} picks with null won status`);

    // 3. Fix null points for correct picks (should equal confidence)
    console.log('3. Setting correct points for winning picks...');
    const nullPointsResult = await pool.query(`
      UPDATE user_picks 
      SET points = confidence_level 
      WHERE week = 0 AND season = 2025 AND season_type = 2 
      AND won = true 
      AND (points IS NULL OR points = 0)
      AND confidence_level IS NOT NULL
      RETURNING id, confidence_level
    `);
    
    console.log(`   ✅ Fixed ${nullPointsResult.rows.length} picks with missing points`);

    // 4. Ensure all incorrect picks have 0 points
    console.log('4. Ensuring incorrect picks have 0 points...');
    const incorrectPointsResult = await pool.query(`
      UPDATE user_picks 
      SET points = 0 
      WHERE week = 0 AND season = 2025 AND season_type = 2 
      AND won = false 
      AND points != 0
      RETURNING id
    `);
    
    console.log(`   ✅ Fixed ${incorrectPointsResult.rows.length} incorrect picks with wrong points`);

    // Commit the transaction
    await pool.query('COMMIT');
    console.log();
    console.log('✅ All Week 0 scoring issues have been fixed!');
    
    // Now run a verification to show the corrected results
    console.log();
    console.log('🔍 Post-Fix Verification:');
    console.log('-'.repeat(60));
    
    const verificationQuery = await pool.query(`
      SELECT 
        COUNT(*) as total_picks,
        COUNT(CASE WHEN won = true THEN 1 END) as correct_picks,
        COUNT(CASE WHEN won = false THEN 1 END) as incorrect_picks,
        COUNT(CASE WHEN won IS NULL THEN 1 END) as null_won,
        COUNT(CASE WHEN points IS NULL THEN 1 END) as null_points,
        COUNT(CASE WHEN points < 0 THEN 1 END) as negative_points,
        SUM(points) as total_points
      FROM user_picks 
      WHERE week = 0 AND season = 2025 AND season_type = 2
    `);
    
    const stats = verificationQuery.rows[0];
    console.log(`Total picks: ${stats.total_picks}`);
    console.log(`Correct picks: ${stats.correct_picks}`);
    console.log(`Incorrect picks: ${stats.incorrect_picks}`);
    console.log(`Null won status: ${stats.null_won}`);
    console.log(`Null points: ${stats.null_points}`);
    console.log(`Negative points: ${stats.negative_points}`);
    console.log(`Total points awarded: ${stats.total_points}`);
    
    if (stats.null_won == 0 && stats.null_points == 0 && stats.negative_points == 0) {
      console.log();
      console.log('🎉 All scoring issues resolved!');
    }

  } catch (error) {
    console.error('❌ Error fixing scoring:', error);
    try {
      await pool.query('ROLLBACK');
      console.log('🔄 Transaction rolled back');
    } catch (rollbackError) {
      console.error('❌ Rollback failed:', rollbackError);
    }
  } finally {
    await pool.end();
  }
}

// Run the fix
fixWeek0Scoring();
