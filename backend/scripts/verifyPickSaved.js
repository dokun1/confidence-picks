import { Pool } from 'pg';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Connect specifically to production database
const prodPool = new Pool({
  connectionString: process.env.PROD_DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function verifyPickWasSaved() {
  try {
    console.log('🔍 Verifying your pick was successfully saved...\n');

    // Check if your pick was saved
    const yourPickQuery = await prodPool.query(`
      SELECT 
        up.game_id,
        up.picked_team_id,
        up.confidence_level,
        g.home_team,
        g.away_team,
        g.status,
        up.created_at,
        up.updated_at
      FROM user_picks up
      JOIN games g ON up.game_id = g.id
      WHERE up.user_id = 1 
      AND up.group_id = 6 
      AND up.season = 2025 
      AND up.season_type = 2 
      AND up.week = 0
      AND up.confidence_level = 8
    `);

    console.log('Your pick with confidence level 8:');
    if (yourPickQuery.rows.length === 0) {
      console.log('   ❌ Pick not found! Something might be wrong.');
    } else {
      const pick = yourPickQuery.rows[0];
      const homeTeam = pick.home_team.name;
      const awayTeam = pick.away_team.name;
      const pickedTeam = pick.picked_team_id === pick.home_team.id ? homeTeam : awayTeam;
      
      console.log(`   ✅ Game ${pick.game_id}: ${homeTeam} vs ${awayTeam}`);
      console.log(`   ✅ Your pick: ${pickedTeam} (+8 confidence)`);
      console.log(`   ✅ Status: ${pick.status}`);
      console.log(`   ✅ Created: ${pick.created_at}`);
      console.log(`   ✅ Updated: ${pick.updated_at}`);
    }

    // Check all your picks in this group for week 0
    const allYourPicksQuery = await prodPool.query(`
      SELECT 
        up.game_id,
        up.picked_team_id,
        up.confidence_level,
        g.home_team,
        g.away_team,
        g.status
      FROM user_picks up
      JOIN games g ON up.game_id = g.id
      WHERE up.user_id = 1 
      AND up.group_id = 6 
      AND up.season = 2025 
      AND up.season_type = 2 
      AND up.week = 0
      ORDER BY up.confidence_level
    `);

    console.log(`\nAll your picks in okun-family-picks for week 0:`);
    if (allYourPicksQuery.rows.length === 0) {
      console.log('   ❌ No picks found');
    } else {
      allYourPicksQuery.rows.forEach(pick => {
        const homeTeam = pick.home_team.name;
        const awayTeam = pick.away_team.name;
        const pickedTeam = pick.picked_team_id === pick.home_team.id ? homeTeam : awayTeam;
        console.log(`   Game ${pick.game_id}: ${pickedTeam} (+${pick.confidence_level || 'NULL'}) - ${homeTeam} vs ${awayTeam} - ${pick.status}`);
      });
    }

    // Verify constraints are still correct
    console.log('\n🔧 Verifying database constraints are correct...');
    
    const constraints = await prodPool.query(`
      SELECT conname, pg_get_constraintdef(oid) as definition
      FROM pg_constraint 
      WHERE conrelid = 'user_picks'::regclass AND contype = 'u'
      ORDER BY conname
    `);

    console.log('\nUnique constraints:');
    let hasCorrectConstraints = true;
    constraints.rows.forEach(constraint => {
      console.log(`   - ${constraint.conname}: ${constraint.definition}`);
      // Check for the bad constraint
      if (constraint.conname === 'user_picks_user_id_week_season_season_type_confidence_level_key') {
        console.log('     ❌ BAD CONSTRAINT STILL EXISTS!');
        hasCorrectConstraints = false;
      }
    });

    const indexes = await prodPool.query(`
      SELECT indexname, indexdef FROM pg_indexes 
      WHERE tablename='user_picks' AND indexname LIKE '%conf%'
    `);

    console.log('\nConfidence indexes:');
    let hasCorrectIndex = false;
    indexes.rows.forEach(index => {
      console.log(`   - ${index.indexname}`);
      if (index.indexname === 'ux_user_picks_conf_per_week') {
        if (index.indexdef.includes('user_id, group_id, week, season, season_type, confidence_level')) {
          console.log('     ✅ CORRECT INDEX (includes group_id)');
          hasCorrectIndex = true;
        } else {
          console.log('     ❌ INDEX MISSING group_id');
        }
      }
    });

    // Final assessment
    console.log('\n📊 Final Assessment:');
    console.log(`   Pick saved successfully: ${yourPickQuery.rows.length > 0 ? '✅' : '❌'}`);
    console.log(`   Correct constraints: ${hasCorrectConstraints ? '✅' : '❌'}`);
    console.log(`   Correct index: ${hasCorrectIndex ? '✅' : '❌'}`);
    
    if (yourPickQuery.rows.length > 0 && hasCorrectConstraints && hasCorrectIndex) {
      console.log('\n🎉 Everything looks perfect! The fix worked completely.');
    } else {
      console.log('\n⚠️  There might still be some issues to address.');
    }

  } catch (error) {
    console.error('❌ Error verifying pick:', error);
  } finally {
    await prodPool.end();
  }
}

verifyPickWasSaved();
