import pool from '../src/config/database.js';

async function validateGroupWideScoring() {
  try {
    console.log('🔍 Validating Group-Wide Scoring System...\n');
    
    // Get all groups with multiple users
    const groupsQuery = await pool.query(`
      SELECT 
        g.id,
        g.name,
        COUNT(DISTINCT gm.user_id) as user_count
      FROM groups g
      JOIN group_memberships gm ON g.id = gm.group_id
      GROUP BY g.id, g.name
      HAVING COUNT(DISTINCT gm.user_id) > 1
      ORDER BY g.id
    `);
    
    console.log(`📊 Found ${groupsQuery.rows.length} groups with multiple users:\n`);
    
    for (const group of groupsQuery.rows) {
      console.log(`🏠 Group ${group.id}: "${group.name}" (${group.user_count} users)`);
      
      // Get all FINAL games with picks in this group
      const gamesQuery = await pool.query(`
        SELECT DISTINCT 
          g.id,
          g.espn_id,
          g.home_team,
          g.away_team,
          g.status,
          g.home_score,
          g.away_score
        FROM games g
        JOIN user_picks up ON g.id = up.game_id
        WHERE up.group_id = $1 
        AND g.status = 'FINAL'
        AND up.picked_team_id IS NOT NULL
        ORDER BY g.id
        LIMIT 5
      `, [group.id]);
      
      if (gamesQuery.rows.length === 0) {
        console.log('   ⚠️  No FINAL games with picks found\n');
        continue;
      }
      
      console.log(`   🎮 Found ${gamesQuery.rows.length} FINAL games with picks:\n`);
      
      for (const game of gamesQuery.rows) {
        const homeTeam = game.home_team;
        const awayTeam = game.away_team;
        const winnerTeamId = (game.home_score > game.away_score) ? homeTeam.id : awayTeam.id;
        const winnerName = (game.home_score > game.away_score) ? homeTeam.name : awayTeam.name;
        
        console.log(`   🏈 Game ${game.id}: ${homeTeam.name} ${game.home_score} - ${game.away_score} ${awayTeam.name}`);
        console.log(`      Winner: ${winnerName} (ID: ${winnerTeamId})`);
        
        // Get all picks for this game in this group
        const picksQuery = await pool.query(`
          SELECT 
            up.user_id,
            u.email,
            up.picked_team_id,
            up.confidence_level,
            up.points,
            up.won,
            up.updated_at
          FROM user_picks up
          JOIN users u ON up.user_id = u.id
          WHERE up.group_id = $1 AND up.game_id = $2 AND up.picked_team_id IS NOT NULL
          ORDER BY up.user_id
        `, [group.id, game.id]);
        
        let nullScoreCount = 0;
        let correctScoreCount = 0;
        let incorrectScoreCount = 0;
        
        for (const pick of picksQuery.rows) {
          const expectedWon = pick.picked_team_id === winnerTeamId;
          const expectedPoints = expectedWon ? pick.confidence_level : -pick.confidence_level;
          
          // Determine picked team name
          const pickedTeamName = (pick.picked_team_id === homeTeam.id) ? homeTeam.name : 
                               (pick.picked_team_id === awayTeam.id) ? awayTeam.name : 
                               `Unknown(${pick.picked_team_id})`;
          
          let status = '';
          if (pick.points === null) {
            status = '❌ NULL SCORE';
            nullScoreCount++;
          } else if (pick.won === expectedWon && pick.points === expectedPoints) {
            status = '✅ CORRECT';
            correctScoreCount++;
          } else {
            status = `❌ INCORRECT (got: ${pick.won ? 'WON' : 'LOST'} ${pick.points}, expected: ${expectedWon ? 'WON' : 'LOST'} ${expectedPoints})`;
            incorrectScoreCount++;
          }
          
          console.log(`      👤 ${pick.email.substring(0, 20)}... picked ${pickedTeamName} (+${pick.confidence_level}) → ${status}`);
        }
        
        console.log(`      📈 Summary: ${correctScoreCount} correct, ${incorrectScoreCount} incorrect, ${nullScoreCount} null\n`);
      }
      
      console.log('');
    }
    
    // Overall system health check
    const systemHealthQuery = await pool.query(`
      SELECT 
        COUNT(*) as total_picks,
        COUNT(CASE WHEN points IS NULL THEN 1 END) as null_scores,
        COUNT(CASE WHEN points IS NOT NULL THEN 1 END) as calculated_scores
      FROM user_picks up
      JOIN games g ON up.game_id = g.id
      WHERE g.status = 'FINAL' AND up.picked_team_id IS NOT NULL
    `);
    
    const health = systemHealthQuery.rows[0];
    console.log('🏥 SYSTEM HEALTH CHECK:');
    console.log(`   Total picks on FINAL games: ${health.total_picks}`);
    console.log(`   Picks with calculated scores: ${health.calculated_scores}`);
    console.log(`   Picks with null scores: ${health.null_scores}`);
    console.log(`   Score completion rate: ${((health.calculated_scores / health.total_picks) * 100).toFixed(1)}%`);
    
  } catch (error) {
    console.error('❌ Error validating group-wide scoring:', error);
  } finally {
    await pool.end();
  }
}

validateGroupWideScoring();
