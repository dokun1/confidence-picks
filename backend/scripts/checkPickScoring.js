#!/usr/bin/env node
import 'dotenv/config';
import pool from '../src/config/database.js';

async function checkProductionScoring() {
  try {
    console.log('=== CHECKING PRODUCTION PICK SCORING ===\n');
    console.log('Environment:', process.env.NODE_ENV || 'development');
    console.log('Database URL:', process.env.DATABASE_URL ? 'Set' : 'Not set');

    console.log('\nSTEP 1: Final Games in Week 0');
    const { rows: finalGames } = await pool.query(`
      SELECT id, espn_id, 
        (home_team->>'id')::int as home_team_id,
        (away_team->>'id')::int as away_team_id,
        home_score, away_score, status, game_date
      FROM games 
      WHERE status = 'FINAL' AND season = 2025 AND season_type = 2 AND week = 0
      ORDER BY id
    `);

    console.log(`Found ${finalGames.length} final games:`);
    finalGames.forEach(g => {
      const winner = g.home_score > g.away_score ? 'HOME' : g.away_score > g.home_score ? 'AWAY' : 'TIE';
      const winnerTeamId = g.home_score > g.away_score ? g.home_team_id : g.away_score > g.home_score ? g.away_team_id : null;
      console.log(`Game ${g.id}: Away(${g.away_team_id}) @ Home(${g.home_team_id}) = ${g.away_score}-${g.home_score} (${winner} wins, winner ID: ${winnerTeamId})`);
    });

    console.log('\nSTEP 2: All Users');
    const { rows: users } = await pool.query(`
      SELECT id, email, name
      FROM users 
      ORDER BY id
    `);

    console.log('All users:');
    users.forEach(u => {
      console.log(`User ${u.id}: ${u.email} (${u.name || 'No name'})`);
    });

    console.log('\nSTEP 3: All User Picks for Final Games');
    const { rows: picks } = await pool.query(`
      SELECT 
        up.user_id,
        up.game_id,
        up.picked_team_id,
        up.confidence_level,
        up.won,
        up.points,
        g.home_score,
        g.away_score,
        (g.home_team->>'id')::int as home_team_id,
        (g.away_team->>'id')::int as away_team_id,
        u.email
      FROM user_picks up
      JOIN games g ON up.game_id = g.id
      JOIN users u ON up.user_id = u.id
      WHERE g.status = 'FINAL' 
        AND g.season = 2025 
        AND g.season_type = 2 
        AND g.week = 0
        AND up.picked_team_id IS NOT NULL
      ORDER BY up.user_id, up.game_id
    `);

    console.log(`Found ${picks.length} picks for final games:`);
    const userGroups = {};
    picks.forEach(p => {
      if (!userGroups[p.user_id]) userGroups[p.user_id] = [];
      userGroups[p.user_id].push(p);
    });

    Object.keys(userGroups).forEach(userId => {
      console.log(`\n--- User ${userId} (${userGroups[userId][0].email}) ---`);
      let totalPoints = 0;
      userGroups[userId].forEach(p => {
        const winnerTeamId = p.home_score > p.away_score ? p.home_team_id : p.away_score > p.home_score ? p.away_team_id : null;
        const shouldWin = p.picked_team_id == winnerTeamId;
        const correctPoints = shouldWin ? p.confidence_level : -p.confidence_level;
        const status = p.won === true ? 'WON' : p.won === false ? 'LOST' : 'NULL';
        console.log(`  Game ${p.game_id}: picked team ${p.picked_team_id}, conf ${p.confidence_level}, actual winner ${winnerTeamId}, should ${shouldWin ? 'WIN' : 'LOSE'}, DB: ${status} ${p.points}pts, correct: ${correctPoints}pts`);
        totalPoints += (p.points || 0);
      });
      console.log(`  TOTAL: ${totalPoints} points`);
    });

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await pool.end();
  }
}

checkProductionScoring();
