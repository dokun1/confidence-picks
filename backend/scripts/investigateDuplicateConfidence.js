import pool from '../src/config/database.js';

async function investigateDuplicateConfidenceError() {
  try {
    console.log('🔍 Investigating Duplicate Confidence Error for Group 6...\n');

    // Check existing picks for user 1 in week 0 of group 6
    const userPicksQuery = await pool.query(`
      SELECT 
        up.game_id,
        up.picked_team_id,
        up.confidence_level,
        up.points,
        up.won,
        g.home_team,
        g.away_team,
        g.status
      FROM user_picks up
      JOIN games g ON up.game_id = g.id
      WHERE up.user_id = 1 AND up.group_id = 6 AND up.season = 2025 AND up.season_type = 2 AND up.week = 0
      ORDER BY up.confidence_level
    `);

    console.log(`User 1's existing picks in week 0 of group 6:`);
    if (userPicksQuery.rows.length === 0) {
      console.log('   ❌ NO EXISTING PICKS FOUND');
    } else {
      userPicksQuery.rows.forEach(pick => {
        const homeTeam = pick.home_team;
        const awayTeam = pick.away_team;
        const pickedTeam = pick.picked_team_id === homeTeam.id ? homeTeam.name : awayTeam.name;
        console.log(`   Game ${pick.game_id}: ${pickedTeam} (+${pick.confidence_level || 'NULL'}) - Status: ${pick.status}`);
      });
    }

    // Check if other users have picks with confidence 8 in week 0
    const conflictQuery = await pool.query(`
      SELECT 
        up.user_id,
        u.email,
        up.game_id,
        up.confidence_level,
        g.home_team,
        g.away_team,
        g.status
      FROM user_picks up
      JOIN users u ON up.user_id = u.id
      JOIN games g ON up.game_id = g.id
      WHERE up.group_id = 6 AND up.season = 2025 AND up.season_type = 2 AND up.week = 0 AND up.confidence_level = 8
      ORDER BY up.user_id
    `);

    console.log(`\nOther users with confidence level 8 in week 0:`);
    if (conflictQuery.rows.length === 0) {
      console.log('   ✅ NO CONFLICTS FOUND');
    } else {
      conflictQuery.rows.forEach(pick => {
        const homeTeam = pick.home_team;
        const awayTeam = pick.away_team;
        const pickedTeam = pick.picked_team_id === homeTeam.id ? homeTeam.name : awayTeam.name;
        console.log(`   User ${pick.user_id} (${pick.email}): Game ${pick.game_id} ${pickedTeam} (+8) - Status: ${pick.status}`);
      });
    }

    // Check all picks for week 0 in this group to understand the validation context
    const allPicksQuery = await pool.query(`
      SELECT 
        up.user_id,
        u.email,
        up.game_id,
        up.confidence_level,
        g.home_team,
        g.away_team,
        g.status
      FROM user_picks up
      JOIN users u ON up.user_id = u.id
      JOIN games g ON up.game_id = g.id
      WHERE up.group_id = 6 AND up.season = 2025 AND up.season_type = 2 AND up.week = 0
      ORDER BY up.user_id, up.confidence_level
    `);

    console.log(`\nAll picks in group 6 for week 0:`);
    if (allPicksQuery.rows.length === 0) {
      console.log('   ❌ NO PICKS FOUND IN THIS GROUP/WEEK');
    } else {
      allPicksQuery.rows.forEach(pick => {
        const homeTeam = pick.home_team;
        const awayTeam = pick.away_team;
        const pickedTeam = pick.picked_team_id === homeTeam.id ? homeTeam.name : awayTeam.name;
        console.log(`   User ${pick.user_id} (${pick.email.substring(0,15)}...): Game ${pick.game_id} ${pickedTeam} (+${pick.confidence_level || 'NULL'}) - Status: ${pick.status}`);
      });
    }

    // Check what game 459 is (the one you're trying to pick)
    const gameQuery = await pool.query(`
      SELECT 
        id,
        home_team,
        away_team,
        status,
        game_date
      FROM games 
      WHERE id = 459
    `);

    console.log(`\nGame 459 details:`);
    if (gameQuery.rows.length === 0) {
      console.log('   ❌ GAME NOT FOUND');
    } else {
      const game = gameQuery.rows[0];
      console.log(`   Game ${game.id}: ${game.home_team.name} vs ${game.away_team.name} - Status: ${game.status} - Date: ${game.game_date}`);
    }

  } catch (error) {
    console.error('❌ Error investigating:', error);
  } finally {
    await pool.end();
  }
}

investigateDuplicateConfidenceError();
