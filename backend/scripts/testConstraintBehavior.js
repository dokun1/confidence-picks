import { Pool } from 'pg';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Connect specifically to production database
const prodPool = new Pool({
  connectionString: process.env.PROD_DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function testConstraintBehavior() {
  try {
    console.log('🔍 Testing what exactly triggers the constraint violation...\n');

    // Check if there's any existing pick for User 1 with confidence 8 in ANY group
    const userConflictQuery = await prodPool.query(`
      SELECT 
        up.group_id,
        g.name as group_name,
        up.week,
        up.season,
        up.season_type,
        up.confidence_level,
        up.game_id
      FROM user_picks up
      JOIN groups g ON up.group_id = g.id
      WHERE up.user_id = 1 
      AND up.confidence_level = 8
      AND up.week = 0
      AND up.season = 2025
      AND up.season_type = 2
    `);

    console.log('User 1 existing picks with confidence 8 in week 0:');
    if (userConflictQuery.rows.length === 0) {
      console.log('   ✅ NO EXISTING PICKS WITH CONFIDENCE 8 (should not conflict)');
    } else {
      userConflictQuery.rows.forEach(pick => {
        console.log(`   ⚠️  Group ${pick.group_id} (${pick.group_name}): Game ${pick.game_id} (+8)`);
      });
    }

    // Let's also check the exact constraint names and their definitions
    const allConstraints = await prodPool.query(`
      SELECT 
        conname, 
        pg_get_constraintdef(oid) as definition,
        contype
      FROM pg_constraint 
      WHERE conrelid = 'user_picks'::regclass
      ORDER BY contype, conname
    `);

    console.log('\nAll constraints on user_picks table:');
    allConstraints.rows.forEach(constraint => {
      const type = constraint.contype === 'u' ? 'UNIQUE' : 
                   constraint.contype === 'p' ? 'PRIMARY KEY' : 
                   constraint.contype === 'f' ? 'FOREIGN KEY' : 
                   constraint.contype === 'c' ? 'CHECK' : constraint.contype;
      console.log(`   [${type}] ${constraint.conname}: ${constraint.definition}`);
    });

    // Now let's simulate the exact INSERT that would happen
    console.log('\n🧪 Simulating the INSERT that should happen:');
    console.log('   INSERT would be: user_id=1, group_id=6, game_id=459, confidence_level=8, week=0, season=2025, season_type=2');
    
    // Check what conflicts with each constraint
    console.log('\nChecking each constraint for conflicts:');
    
    // Test constraint 1: user_id, week, season, season_type, confidence_level (missing group_id)
    const constraint1 = await prodPool.query(`
      SELECT COUNT(*) as count
      FROM user_picks 
      WHERE user_id = 1 
      AND week = 0 
      AND season = 2025 
      AND season_type = 2 
      AND confidence_level = 8
    `);
    console.log(`   Constraint without group_id: ${constraint1.rows[0].count} conflicts`);

    // Test constraint 2: user_id, group_id, week, season, season_type, confidence_level (correct)
    const constraint2 = await prodPool.query(`
      SELECT COUNT(*) as count
      FROM user_picks 
      WHERE user_id = 1 
      AND group_id = 6
      AND week = 0 
      AND season = 2025 
      AND season_type = 2 
      AND confidence_level = 8
    `);
    console.log(`   Constraint with group_id: ${constraint2.rows[0].count} conflicts`);

  } catch (error) {
    console.error('❌ Error testing constraints:', error);
  } finally {
    await prodPool.end();
  }
}

testConstraintBehavior();
