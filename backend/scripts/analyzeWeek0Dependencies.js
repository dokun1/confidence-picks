#!/usr/bin/env node

import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

/**
 * Analyze all Week 0 dependencies in the development database
 * This will help us understand what needs to be removed
 */
async function analyzeWeek0Dependencies() {
  try {
    console.log('🔍 Analyzing Week 0 Dependencies in Development Database');
    console.log('================================================================');

    // Check games in Week 0
    const gamesResult = await pool.query(`
      SELECT id, espn_id, home_team, away_team, week, status, home_score, away_score
      FROM games 
      WHERE week = 0 
      ORDER BY id
    `);
    
    console.log(`\n📊 Week 0 Games Found: ${gamesResult.rows.length}`);
    if (gamesResult.rows.length > 0) {
      console.log('Game IDs:', gamesResult.rows.map(g => g.id).join(', '));
      gamesResult.rows.forEach(game => {
        const homeTeam = typeof game.home_team === 'string' ? JSON.parse(game.home_team) : game.home_team;
        const awayTeam = typeof game.away_team === 'string' ? JSON.parse(game.away_team) : game.away_team;
        console.log(`  - Game ${game.id} (ESPN: ${game.espn_id}): ${awayTeam.abbreviation} @ ${homeTeam.abbreviation} | Status: ${game.status}`);
      });
    }

    // Check user picks for Week 0 games
    const picksResult = await pool.query(`
      SELECT up.id, up.user_id, up.game_id, up.confidence_level, up.points, up.won, u.email, g.week
      FROM user_picks up
      JOIN games g ON up.game_id = g.id
      JOIN users u ON up.user_id = u.id
      WHERE g.week = 0
      ORDER BY up.user_id, up.confidence_level DESC
    `);

    console.log(`\n🎯 Week 0 User Picks Found: ${picksResult.rows.length}`);
    if (picksResult.rows.length > 0) {
      // Group by user
      const userPicks = {};
      picksResult.rows.forEach(pick => {
        if (!userPicks[pick.email]) {
          userPicks[pick.email] = [];
        }
        userPicks[pick.email].push(pick);
      });

      Object.entries(userPicks).forEach(([email, picks]) => {
        console.log(`  - ${email}: ${picks.length} picks`);
      });
    }

    // Check if any groups have Week 0 specific data
    const groupDataResult = await pool.query(`
      SELECT DISTINCT g.id, g.name, g.week, COUNT(up.id) as pick_count
      FROM groups g
      LEFT JOIN group_members gm ON g.id = gm.group_id
      LEFT JOIN user_picks up ON gm.user_id = up.user_id
      LEFT JOIN games ga ON up.game_id = ga.id AND ga.week = 0
      WHERE g.week = 0 OR ga.week = 0
      GROUP BY g.id, g.name, g.week
      ORDER BY g.id
    `);

    console.log(`\n👥 Groups with Week 0 Data: ${groupDataResult.rows.length}`);
    groupDataResult.rows.forEach(group => {
      console.log(`  - Group ${group.id} (${group.name}): Week ${group.week}, ${group.pick_count} picks`);
    });

    // Check any constraints or foreign keys that might reference Week 0
    const constraintsResult = await pool.query(`
      SELECT 
        tc.table_name,
        tc.constraint_name,
        tc.constraint_type,
        kcu.column_name,
        ccu.table_name AS foreign_table_name,
        ccu.column_name AS foreign_column_name
      FROM information_schema.table_constraints tc
      LEFT JOIN information_schema.key_column_usage kcu 
        ON tc.constraint_name = kcu.constraint_name
      LEFT JOIN information_schema.constraint_column_usage ccu 
        ON tc.constraint_name = ccu.constraint_name
      WHERE tc.table_name IN ('games', 'user_picks', 'groups', 'group_members')
        AND tc.constraint_type IN ('FOREIGN KEY', 'CHECK')
      ORDER BY tc.table_name, tc.constraint_name
    `);

    console.log(`\n🔗 Relevant Database Constraints:`);
    constraintsResult.rows.forEach(constraint => {
      if (constraint.foreign_table_name) {
        console.log(`  - ${constraint.table_name}.${constraint.column_name} → ${constraint.foreign_table_name}.${constraint.foreign_column_name} (${constraint.constraint_type})`);
      } else {
        console.log(`  - ${constraint.table_name}.${constraint.column_name} (${constraint.constraint_type})`);
      }
    });

    // Summary for removal plan
    console.log('\n📋 REMOVAL PLAN SUMMARY');
    console.log('================================================================');
    console.log(`1. Delete ${picksResult.rows.length} user picks for Week 0 games`);
    console.log(`2. Delete ${gamesResult.rows.length} Week 0 games`);
    console.log(`3. Update any groups that are set to Week 0`);
    console.log(`4. Remove Week 0 references from frontend code`);
    console.log(`5. Remove Week 0 references from backend code`);

  } catch (error) {
    console.error('❌ Error analyzing Week 0 dependencies:', error);
  } finally {
    await pool.end();
  }
}

// Run the analysis
analyzeWeek0Dependencies();
