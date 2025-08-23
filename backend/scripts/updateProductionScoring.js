#!/usr/bin/env node
import 'dotenv/config';
import pool from '../src/config/database.js';

/**
 * Script to update production database with correct scoring logic.
 * This recalculates points for all final games to use the new scoring system:
 * - Correct picks: +confidence points
 * - Incorrect picks: -confidence points
 */

async function updateProductionScoring() {
  try {
    console.log('🔄 Starting production scoring update...');
    
    // Get all final games
    const { rows: finalGames } = await pool.query(`
      SELECT id, home_team, away_team, home_score, away_score, status 
      FROM games 
      WHERE status = 'FINAL'
      ORDER BY id
    `);
    
    console.log(`📊 Found ${finalGames.length} final games to process`);
    
    let updatedGames = 0;
    
    for (const game of finalGames) {
      // Determine winning team
      let winningTeamId = null;
      if (game.home_score > game.away_score) {
        winningTeamId = game.home_team;
      } else if (game.away_score > game.home_score) {
        winningTeamId = game.away_team;
      }
      // If tie, winningTeamId remains null
      
      // Update all picks for this game with correct scoring
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
        console.log(`✅ Game ${game.id}: Updated ${rowCount} picks (winner: team ${winningTeamId})`);
        updatedGames++;
      }
    }
    
    // Get summary of results
    const { rows: summary } = await pool.query(`
      SELECT 
        COUNT(*) as total_picks,
        COUNT(CASE WHEN won = true THEN 1 END) as won_picks,
        COUNT(CASE WHEN won = false THEN 1 END) as lost_picks,
        SUM(points) as total_points,
        AVG(points) as avg_points
      FROM user_picks 
      WHERE points IS NOT NULL
    `);
    
    console.log('\n📈 Production scoring update complete!');
    console.log(`🎯 Updated ${updatedGames} games`);
    console.log(`📊 Summary:`, summary[0]);
    
  } catch (error) {
    console.error('❌ Error updating production scoring:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

// Run the script
updateProductionScoring().catch(console.error);
