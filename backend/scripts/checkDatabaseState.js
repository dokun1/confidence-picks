#!/usr/bin/env node
import 'dotenv/config';
import pool from '../src/config/database.js';

async function checkDatabaseState() {
  try {
    console.log('=== CHECKING DATABASE STATE FOR FINAL GAMES ===\n');
    
    const { rows: picks } = await pool.query(`
      SELECT 
        up.game_id,
        up.won,
        up.points,
        up.updated_at,
        (g.away_team->>'abbreviation') as away_abbr,
        (g.home_team->>'abbreviation') as home_abbr,
        g.away_score,
        g.home_score
      FROM user_picks up
      JOIN games g ON up.game_id = g.id
      WHERE up.user_id = 1 
        AND up.group_id = 1 
        AND g.status = 'FINAL'
        AND g.season = 2025 
        AND g.season_type = 2 
        AND g.week = 0
      ORDER BY g.game_date
    `);

    picks.forEach(p => {
      const scoreStr = `${p.away_abbr} ${p.away_score} - ${p.home_score} ${p.home_abbr}`;
      const resultStr = p.won === null ? 'NULL' : (p.won ? 'WON' : 'LOST');
      const pointsStr = p.points === null ? 'NULL' : p.points;
      console.log(`Game ${p.game_id} (${scoreStr}): ${resultStr} ${pointsStr} pts, updated: ${p.updated_at}`);
    });
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await pool.end();
  }
}

checkDatabaseState();
