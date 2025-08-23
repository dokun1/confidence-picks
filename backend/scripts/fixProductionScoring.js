#!/usr/bin/env node
import 'dotenv/config';
import pool from '../src/config/database.js';

async function fixProductionScoring() {
  try {
    console.log('=== FIXING PRODUCTION SCORING ===\n');
    console.log('Environment:', process.env.NODE_ENV || 'development');
    
    // Get all final games
    console.log('🔍 Finding all final games...');
    const { rows: finalGames } = await pool.query(`
      SELECT id, home_team, away_team, home_score, away_score, status 
      FROM games 
      WHERE status = 'FINAL'
      ORDER BY id
    `);
    
    console.log(`📊 Found ${finalGames.length} final games to process\n`);
    
    let updatedGames = 0;
    let totalUpdatedPicks = 0;
    
    for (const game of finalGames) {
      // Determine winning team (FIXED: use .id property)
      let winningTeamId = null;
      if (game.home_score > game.away_score) {
        winningTeamId = parseInt(game.home_team.id);
      } else if (game.away_score > game.home_score) {
        winningTeamId = parseInt(game.away_team.id);
      }
      // If tie, winningTeamId remains null
      
      console.log(`Game ${game.id}: ${game.away_team.abbreviation} @ ${game.home_team.abbreviation} = ${game.away_score}-${game.home_score}`);
      console.log(`  Winner: ${winningTeamId ? (winningTeamId === parseInt(game.home_team.id) ? game.home_team.abbreviation : game.away_team.abbreviation) : 'TIE'} (ID: ${winningTeamId})`);
      
      // Update ALL user picks for this game with correct scoring
      const { rowCount } = await pool.query(`
        UPDATE user_picks
        SET 
          won = (picked_team_id = $2), 
          points = CASE 
            WHEN picked_team_id = $2 THEN confidence_level 
            ELSE -confidence_level 
          END, 
          updated_at = NOW()
        WHERE game_id = $1 AND picked_team_id IS NOT NULL
      `, [game.id, winningTeamId]);
      
      if (rowCount > 0) {
        console.log(`  ✅ Updated ${rowCount} picks for this game\n`);
        updatedGames++;
        totalUpdatedPicks += rowCount;
      } else {
        console.log(`  ⚪ No picks found for this game\n`);
      }
    }
    
    // Get summary of results
    console.log('📈 Getting final summary...');
    const { rows: summary } = await pool.query(`
      SELECT 
        COUNT(*) as total_picks,
        COUNT(CASE WHEN won = true THEN 1 END) as won_picks,
        COUNT(CASE WHEN won = false THEN 1 END) as lost_picks,
        SUM(points) as total_points,
        COUNT(DISTINCT user_id) as total_users,
        COUNT(DISTINCT game_id) as total_games
      FROM user_picks 
      WHERE points IS NOT NULL
    `);
    
    console.log('\n=== SCORING FIX COMPLETE ===');
    console.log(`✅ Updated ${updatedGames} games`);
    console.log(`✅ Updated ${totalUpdatedPicks} total picks`);
    console.log(`📊 Final stats:`, summary[0]);
    
  } catch (error) {
    console.error('❌ Error fixing scoring:', error);
  } finally {
    await pool.end();
  }
}

fixProductionScoring();
