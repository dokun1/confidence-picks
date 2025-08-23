import pool from '../src/config/database.js';

async function testGroupWideScoring() {
  try {
    console.log('🧪 Testing Group-Wide Scoring System...\n');
    
    // Get games that need scoring for Group 6
    const beforeQuery = await pool.query(`
      SELECT 
        up.game_id,
        up.user_id,
        u.email,
        up.points,
        up.won
      FROM user_picks up
      JOIN users u ON up.user_id = u.id
      JOIN games g ON up.game_id = g.id
      WHERE up.group_id = 6 
      AND g.status = 'FINAL' 
      AND up.picked_team_id IS NOT NULL 
      AND up.points IS NULL
      ORDER BY up.game_id, up.user_id
    `);
    
    console.log(`📊 Found ${beforeQuery.rows.length} picks with null scores in Group 6:`);
    beforeQuery.rows.forEach(row => {
      console.log(`   Game ${row.game_id}: ${row.email.substring(0, 20)}... → NULL`);
    });
    console.log('');
    
    // Now simulate the scoring calculation logic from picks.js
    console.log('🔄 Simulating group-wide scoring calculation...\n');
    
    // Get FINAL games with null scores in Group 6
    const gamesWithNullScores = await pool.query(`
      SELECT DISTINCT 
        g.id,
        g.home_team,
        g.away_team,
        g.home_score,
        g.away_score
      FROM games g
      JOIN user_picks up ON g.id = up.game_id
      WHERE up.group_id = 6 
      AND g.status = 'FINAL' 
      AND up.picked_team_id IS NOT NULL 
      AND up.points IS NULL
      ORDER BY g.id
    `);
    
    console.log(`🎮 Found ${gamesWithNullScores.rows.length} FINAL games needing calculation:`);
    
    for (const game of gamesWithNullScores.rows) {
      const homeTeam = game.home_team;
      const awayTeam = game.away_team;
      const winnerTeamId = (game.home_score > game.away_score) ? homeTeam.id : awayTeam.id;
      const winnerName = (game.home_score > game.away_score) ? homeTeam.name : awayTeam.name;
      
      console.log(`   🏈 Game ${game.id}: ${homeTeam.name} ${game.home_score} - ${game.away_score} ${awayTeam.name}`);
      console.log(`      Winner: ${winnerName} (ID: ${winnerTeamId})`);
      
      // Update ALL users' picks for this game in Group 6
      const { rowCount } = await pool.query(`
        UPDATE user_picks 
        SET won = (picked_team_id = $1), 
            points = CASE 
              WHEN picked_team_id = $1 THEN confidence_level 
              ELSE -confidence_level 
            END,
            updated_at = NOW()
        WHERE group_id = $2 AND game_id = $3 AND picked_team_id IS NOT NULL AND points IS NULL
      `, [winnerTeamId, 6, game.id]);
      
      console.log(`      ✅ Updated ${rowCount} user picks for game ${game.id}`);
    }
    
    console.log('\n🔍 Verifying results...\n');
    
    // Check the results
    const afterQuery = await pool.query(`
      SELECT 
        up.game_id,
        up.user_id,
        u.email,
        up.picked_team_id,
        up.confidence_level,
        up.points,
        up.won,
        g.home_team,
        g.away_team,
        g.home_score,
        g.away_score
      FROM user_picks up
      JOIN users u ON up.user_id = u.id
      JOIN games g ON up.game_id = g.id
      WHERE up.group_id = 6 
      AND g.status = 'FINAL' 
      AND up.picked_team_id IS NOT NULL 
      AND up.game_id IN (${gamesWithNullScores.rows.map(g => g.id).join(',')})
      ORDER BY up.game_id, up.user_id
    `);
    
    console.log('📈 Updated picks:');
    for (const pick of afterQuery.rows) {
      const homeTeam = pick.home_team;
      const awayTeam = pick.away_team;
      const winnerTeamId = (pick.home_score > pick.away_score) ? homeTeam.id : awayTeam.id;
      const pickedTeamName = (pick.picked_team_id === homeTeam.id) ? homeTeam.name : awayTeam.name;
      const result = pick.won ? 'WON' : 'LOST';
      
      console.log(`   Game ${pick.game_id}: ${pick.email.substring(0, 20)}... picked ${pickedTeamName} (+${pick.confidence_level}) → ${result} ${pick.points}`);
    }
    
    // Final health check
    const finalHealthQuery = await pool.query(`
      SELECT 
        COUNT(*) as total_picks,
        COUNT(CASE WHEN points IS NULL THEN 1 END) as null_scores,
        COUNT(CASE WHEN points IS NOT NULL THEN 1 END) as calculated_scores
      FROM user_picks up
      JOIN games g ON up.game_id = g.id
      WHERE g.status = 'FINAL' AND up.picked_team_id IS NOT NULL
    `);
    
    const health = finalHealthQuery.rows[0];
    console.log('\n🏥 FINAL SYSTEM HEALTH:');
    console.log(`   Total picks on FINAL games: ${health.total_picks}`);
    console.log(`   Picks with calculated scores: ${health.calculated_scores}`);
    console.log(`   Picks with null scores: ${health.null_scores}`);
    console.log(`   Score completion rate: ${((health.calculated_scores / health.total_picks) * 100).toFixed(1)}%`);
    
  } catch (error) {
    console.error('❌ Error testing group-wide scoring:', error);
  } finally {
    await pool.end();
  }
}

testGroupWideScoring();
