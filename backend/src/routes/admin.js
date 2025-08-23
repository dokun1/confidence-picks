import express from 'express';
import { authenticateToken } from '../middleware/auth.js';
import pool from '../config/database.js';

const router = express.Router();

// Endpoint to recalculate scoring for ALL users on completed games (temp no auth)
router.post('/admin/recalculate-scoring-temp', async (req, res) => {
  try {
    console.log('Scoring recalculation request from temporary endpoint');
    
    // This endpoint recalculates scoring for ALL users, not just the requester
    console.log('🔄 Starting scoring recalculation for ALL users...');
    
    // Get all final games
    const { rows: finalGames } = await pool.query(`
      SELECT id, home_team, away_team, home_score, away_score, status 
      FROM games 
      WHERE status = 'FINAL'
      ORDER BY id
    `);
    
    console.log(`📊 Found ${finalGames.length} final games to process`);
    
    let updatedGames = 0;
    let totalUpdatedPicks = 0;
    
    for (const game of finalGames) {
      // Determine winning team
      let winningTeamId = null;
      if (game.home_score > game.away_score) {
        winningTeamId = parseInt(game.home_team.id);
      } else if (game.away_score > game.home_score) {
        winningTeamId = parseInt(game.away_team.id);
      }
      // If tie, winningTeamId remains null
      
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
        console.log(`✅ Game ${game.id}: Updated ${rowCount} picks for ALL users (winner: team ${winningTeamId})`);
        updatedGames++;
        totalUpdatedPicks += rowCount;
      }
    }
    
    // Get summary of results across ALL users
    const { rows: summary } = await pool.query(`
      SELECT 
        COUNT(*) as total_picks,
        COUNT(CASE WHEN won = true THEN 1 END) as won_picks,
        COUNT(CASE WHEN won = false THEN 1 END) as lost_picks,
        SUM(points) as total_points,
        AVG(points) as avg_points,
        COUNT(DISTINCT user_id) as total_users,
        COUNT(DISTINCT game_id) as total_games
      FROM user_picks 
      WHERE points IS NOT NULL
    `);
    
    console.log('📈 Scoring recalculation complete for ALL users!');
    
    res.json({
      success: true,
      message: 'Recalculated scoring for all users on completed games',
      updatedGames,
      totalUpdatedPicks,
      summary: summary[0]
    });
    
  } catch (error) {
    console.error('❌ Error recalculating scoring:', error);
    res.status(500).json({ error: 'Failed to recalculate scoring', details: error.message });
  }
});

export default router;
