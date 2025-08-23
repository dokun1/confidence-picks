#!/usr/bin/env node
import 'dotenv/config';
import pool from '../src/config/database.js';

async function investigateProductionScores() {
  try {
    console.log('=== STEP 1: CHECKING GAME STATUS IN PRODUCTION DB ===\n');
    
    // Check all games from week 0
    const { rows: games } = await pool.query(`
      SELECT id, espn_id, status, 
        (home_team->>'abbreviation') as home_abbr,
        (away_team->>'abbreviation') as away_abbr,
        home_score, away_score, game_date,
        season, season_type, week
      FROM games 
      WHERE season = 2025 AND season_type = 2 AND week = 0
      ORDER BY game_date
    `);

    console.log('All Week 0 games in production:');
    games.forEach(g => {
      console.log(`Game ${g.id}: ${g.away_abbr} @ ${g.home_abbr} = ${g.away_score}-${g.home_score} (${g.status}) - ${g.game_date}`);
    });

    console.log('\n=== STEP 2: CHECKING YOUR PICKS IN PRODUCTION DB ===\n');
    
    // Find your user ID first
    const { rows: users } = await pool.query(`
      SELECT id, email, name 
      FROM users 
      WHERE email = 'david.m.okun@gmail.com'
    `);
    
    if (users.length === 0) {
      console.log('❌ User not found with email david.m.okun@gmail.com');
      return;
    }
    
    const userId = users[0].id;
    console.log(`Found user: ID ${userId}, Email: ${users[0].email}, Name: ${users[0].name}`);
    
    // Find test-group-1
    const { rows: groups } = await pool.query(`
      SELECT g.id, g.name, g.identifier 
      FROM groups g
      JOIN group_memberships gm ON g.id = gm.group_id
      WHERE gm.user_id = $1 AND g.identifier = 'test-group-1'
    `, [userId]);
    
    if (groups.length === 0) {
      console.log('❌ test-group-1 not found or user not a member');
      return;
    }
    
    const groupId = groups[0].id;
    console.log(`Found group: ID ${groupId}, Name: ${groups[0].name}, Identifier: ${groups[0].identifier}`);
    
    // Get your picks
    const { rows: picks } = await pool.query(`
      SELECT 
        up.game_id,
        up.picked_team_id,
        up.confidence_level,
        up.won,
        up.points,
        up.created_at,
        up.updated_at,
        g.status as game_status,
        (g.home_team->>'abbreviation') as home_abbr,
        (g.away_team->>'abbreviation') as away_abbr,
        g.home_score,
        g.away_score
      FROM user_picks up
      JOIN games g ON up.game_id = g.id
      WHERE up.user_id = $1 
        AND up.group_id = $2 
        AND g.season = 2025 
        AND g.season_type = 2 
        AND g.week = 0
      ORDER BY g.game_date
    `, [userId, groupId]);
    
    console.log(`\nFound ${picks.length} picks for user ${userId} in group ${groupId}:`);
    picks.forEach(p => {
      const actualWinner = p.home_score > p.away_score ? 'HOME' : p.away_score > p.home_score ? 'AWAY' : 'TIE';
      const gameResult = `${p.away_abbr} ${p.away_score} - ${p.home_score} ${p.home_abbr}`;
      console.log(`Game ${p.game_id}: ${gameResult} (${p.game_status})`);
      console.log(`  Your pick: Team ${p.picked_team_id}, Confidence: ${p.confidence_level}`);
      console.log(`  Result: won=${p.won}, points=${p.points}`);
      console.log(`  Timestamps: created=${p.created_at}, updated=${p.updated_at}`);
      console.log('');
    });
    
    console.log('\n=== STEP 3: CHECKING TEAM IDs FOR PHI @ NYJ GAME ===\n');
    
    // Check game 449 specifically 
    const { rows: gameDetails } = await pool.query(`
      SELECT id, home_team, away_team, home_score, away_score
      FROM games 
      WHERE id = 449
    `);
    
    if (gameDetails.length > 0) {
      const game = gameDetails[0];
      console.log('Game 449 team details:');
      console.log('Home team (NYJ) ID:', game.home_team.id);
      console.log('Away team (PHI) ID:', game.away_team.id);
      console.log(`Score: PHI ${game.away_score} - NYJ ${game.home_score}`);
      
      const phillyWon = game.away_score > game.home_score;
      console.log('PHI won:', phillyWon);
      console.log('Your pick was team 21, PHI team ID is:', game.away_team.id);
      console.log('You should have', phillyWon ? 'WON +15 points' : 'LOST -15 points');
    }
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await pool.end();
  }
}

investigateProductionScores();
