#!/usr/bin/env node
import 'dotenv/config';
import pool from '../src/config/database.js';

async function validateUserIsolation() {
  try {
    console.log('=== VALIDATING USER ISOLATION FOR DATABASE PERSISTENCE ===\n');
    
    // Check all users who have picks for the newly persisted games
    const { rows: allUserPicks } = await pool.query(`
      SELECT 
        up.user_id,
        u.email,
        up.game_id,
        up.won,
        up.points,
        up.updated_at,
        (g.away_team->>'abbreviation') as away_abbr,
        (g.home_team->>'abbreviation') as home_abbr
      FROM user_picks up
      JOIN games g ON up.game_id = g.id
      JOIN users u ON up.user_id = u.id
      WHERE up.group_id = 1 
        AND g.id IN (449, 450, 451, 452)
        AND g.status = 'FINAL'
      ORDER BY up.user_id, g.game_date
    `);

    if (allUserPicks.length === 0) {
      console.log('No picks found for games 449, 450, 451, 452');
      return;
    }

    // Group by user
    const userGroups = {};
    allUserPicks.forEach(p => {
      if (!userGroups[p.user_id]) {
        userGroups[p.user_id] = {
          email: p.email,
          picks: []
        };
      }
      userGroups[p.user_id].picks.push(p);
    });

    Object.keys(userGroups).forEach(userId => {
      const userData = userGroups[userId];
      console.log(`\n--- User ${userId} (${userData.email}) ---`);
      
      userData.picks.forEach(p => {
        const scoreStr = `${p.away_abbr} @ ${p.home_abbr}`;
        const resultStr = p.won === null ? 'NULL' : (p.won ? 'WON' : 'LOST');
        const pointsStr = p.points === null ? 'NULL' : p.points;
        const wasUpdated = p.updated_at && new Date(p.updated_at).getTime() > new Date('2025-08-23T18:00:00Z').getTime();
        
        console.log(`  Game ${p.game_id} (${scoreStr}): ${resultStr} ${pointsStr} pts${wasUpdated ? ' [RECENTLY UPDATED]' : ''}`);
      });
    });

    console.log('\n=== ISOLATION VALIDATION ===');
    console.log('✅ Only user 1 (david.m.okun@gmail.com) should have [RECENTLY UPDATED] scores');
    console.log('✅ Other users should still have NULL scores or older timestamps');
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await pool.end();
  }
}

validateUserIsolation();
