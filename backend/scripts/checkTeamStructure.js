#!/usr/bin/env node
import 'dotenv/config';
import pool from '../src/config/database.js';

async function checkTeamStructure() {
  try {
    console.log('=== CHECKING TEAM DATA STRUCTURE ===\n');
    
    const { rows } = await pool.query(`
      SELECT id, home_team, away_team, home_score, away_score 
      FROM games 
      WHERE id = 447 
      LIMIT 1
    `);
    
    if (rows.length > 0) {
      console.log('Game 447 structure:');
      console.log('ID:', rows[0].id);
      console.log('home_team:', typeof rows[0].home_team, rows[0].home_team);
      console.log('away_team:', typeof rows[0].away_team, rows[0].away_team);
      console.log('home_score:', rows[0].home_score);
      console.log('away_score:', rows[0].away_score);
      
      if (typeof rows[0].home_team === 'object') {
        console.log('\nhome_team.id:', rows[0].home_team.id);
        console.log('away_team.id:', rows[0].away_team.id);
      }
    }
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await pool.end();
  }
}

checkTeamStructure();
