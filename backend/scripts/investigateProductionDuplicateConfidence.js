import { Pool } from 'pg';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Connect specifically to production database
const prodPool = new Pool({
  connectionString: process.env.PROD_DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function investigateProductionDuplicateConfidence() {
  try {
    console.log('🔍 Investigating Duplicate Confidence Error in PRODUCTION...\n');

    // First, let's find the correct group ID for "okun-family-picks"
    const groupQuery = await prodPool.query(`
      SELECT id, name, identifier 
      FROM groups 
      WHERE name ILIKE '%okun%' OR identifier = 'okun-family-picks'
    `);

    console.log('Groups matching "okun":');
    if (groupQuery.rows.length === 0) {
      console.log('   ❌ NO GROUPS FOUND');
      
      // Let's see all groups
      const allGroups = await prodPool.query('SELECT id, name, identifier FROM groups ORDER BY id');
      console.log('\nAll groups in production:');
      allGroups.rows.forEach(group => {
        console.log(`   ID: ${group.id}, Name: ${group.name}, Identifier: ${group.identifier}`);
      });
      return;
    }

    groupQuery.rows.forEach(group => {
      console.log(`   ID: ${group.id}, Name: ${group.name}, Identifier: ${group.identifier}`);
    });

    const groupId = groupQuery.rows[0].id;
    console.log(`\nUsing group ID: ${groupId}\n`);

    // Find the current user (you) in the users table
    const userQuery = await prodPool.query(`
      SELECT id, email, name 
      FROM users 
      WHERE email ILIKE '%okun%' OR email ILIKE '%david%'
      ORDER BY id
    `);

    console.log('Users matching your profile:');
    if (userQuery.rows.length === 0) {
      console.log('   ❌ NO USERS FOUND');
      return;
    }

    userQuery.rows.forEach(user => {
      console.log(`   ID: ${user.id}, Email: ${user.email}, Name: ${user.name}`);
    });

    const userId = userQuery.rows[0].id;
    console.log(`\nUsing user ID: ${userId}\n`);

    // Check existing picks for this user in week 0
    const userPicksQuery = await prodPool.query(`
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
      WHERE up.user_id = $1 AND up.group_id = $2 AND up.season = 2025 AND up.season_type = 2 AND up.week = 0
      ORDER BY up.confidence_level
    `, [userId, groupId]);

    console.log(`Your existing picks in week 0 of group ${groupId}:`);
    if (userPicksQuery.rows.length === 0) {
      console.log('   ✅ NO EXISTING PICKS FOUND (this is expected)');
    } else {
      userPicksQuery.rows.forEach(pick => {
        const homeTeam = pick.home_team;
        const awayTeam = pick.away_team;
        const pickedTeam = pick.picked_team_id === homeTeam.id ? homeTeam.name : awayTeam.name;
        console.log(`   Game ${pick.game_id}: ${pickedTeam} (+${pick.confidence_level || 'NULL'}) - Status: ${pick.status}`);
      });
    }

    // Check if other users have picks with confidence 8 in week 0
    const conflictQuery = await prodPool.query(`
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
      WHERE up.group_id = $1 AND up.season = 2025 AND up.season_type = 2 AND up.week = 0 AND up.confidence_level = 8
      ORDER BY up.user_id
    `, [groupId]);

    console.log(`\nOther users with confidence level 8 in week 0:`);
    if (conflictQuery.rows.length === 0) {
      console.log('   ✅ NO CONFLICTS FOUND (this should mean no duplicate error)');
    } else {
      conflictQuery.rows.forEach(pick => {
        const homeTeam = pick.home_team;
        const awayTeam = pick.away_team;
        const pickedTeam = pick.picked_team_id === homeTeam.id ? homeTeam.name : awayTeam.name;
        console.log(`   ⚠️  User ${pick.user_id} (${pick.email}): Game ${pick.game_id} ${pickedTeam} (+8) - Status: ${pick.status}`);
      });
    }

    // Check all picks for week 0 in this group to understand the validation context
    const allPicksQuery = await prodPool.query(`
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
      WHERE up.group_id = $1 AND up.season = 2025 AND up.season_type = 2 AND up.week = 0
      ORDER BY up.user_id, up.confidence_level
    `, [groupId]);

    console.log(`\nAll picks in group ${groupId} for week 0:`);
    if (allPicksQuery.rows.length === 0) {
      console.log('   ✅ NO PICKS FOUND IN THIS GROUP/WEEK (expected for fresh week)');
    } else {
      allPicksQuery.rows.forEach(pick => {
        const homeTeam = pick.home_team;
        const awayTeam = pick.away_team;
        const pickedTeam = pick.picked_team_id === homeTeam.id ? homeTeam.name : awayTeam.name;
        console.log(`   User ${pick.user_id} (${pick.email.substring(0,15)}...): Game ${pick.game_id} ${pickedTeam} (+${pick.confidence_level || 'NULL'}) - Status: ${pick.status}`);
      });
    }

    // Check what game 459 is (the one you're trying to pick)
    const gameQuery = await prodPool.query(`
      SELECT 
        id,
        home_team,
        away_team,
        status,
        game_date,
        week,
        season,
        season_type
      FROM games 
      WHERE id = 459
    `);

    console.log(`\nGame 459 details:`);
    if (gameQuery.rows.length === 0) {
      console.log('   ❌ GAME NOT FOUND');
      
      // Let's look for games around that ID
      const nearbyGames = await prodPool.query(`
        SELECT id, home_team, away_team, status, week, season, season_type
        FROM games 
        WHERE id BETWEEN 450 AND 470
        ORDER BY id
      `);
      
      console.log('\nGames with IDs near 459:');
      nearbyGames.rows.forEach(game => {
        console.log(`   Game ${game.id}: ${game.home_team.name} vs ${game.away_team.name} - Week ${game.week}, Season ${game.season}, Type ${game.season_type} - Status: ${game.status}`);
      });
    } else {
      const game = gameQuery.rows[0];
      console.log(`   Game ${game.id}: ${game.home_team.name} vs ${game.away_team.name} - Week ${game.week}, Season ${game.season}, Type ${game.season_type} - Status: ${game.status} - Date: ${game.game_date}`);
    }

  } catch (error) {
    console.error('❌ Error investigating:', error);
  } finally {
    await prodPool.end();
  }
}

investigateProductionDuplicateConfidence();
