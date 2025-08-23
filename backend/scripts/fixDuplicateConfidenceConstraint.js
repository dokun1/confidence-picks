import { Pool } from 'pg';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Connect specifically to production database
const prodPool = new Pool({
  connectionString: process.env.PROD_DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function fixDuplicateConfidenceConstraint() {
  try {
    console.log('🔧 Fixing Duplicate Confidence Constraint in PRODUCTION...\n');

    // Start transaction
    await prodPool.query('BEGIN');

    // 1. Check current state
    console.log('1. Checking current constraints...');
    const beforeConstraints = await prodPool.query(`
      SELECT conname, pg_get_constraintdef(oid) as definition
      FROM pg_constraint 
      WHERE conrelid = 'user_picks'::regclass AND contype = 'u'
      ORDER BY conname
    `);

    console.log('   Current unique constraints:');
    beforeConstraints.rows.forEach(constraint => {
      console.log(`   - ${constraint.conname}: ${constraint.definition}`);
    });

    // 2. Drop the incorrect constraint
    console.log('\n2. Dropping incorrect constraint...');
    const incorrectConstraintName = 'user_picks_user_id_week_season_season_type_confidence_level_key';
    
    const constraintExists = await prodPool.query(`
      SELECT 1 FROM pg_constraint 
      WHERE conrelid = 'user_picks'::regclass 
      AND conname = $1
    `, [incorrectConstraintName]);

    if (constraintExists.rows.length > 0) {
      await prodPool.query(`ALTER TABLE user_picks DROP CONSTRAINT ${incorrectConstraintName}`);
      console.log(`   ✅ Dropped constraint: ${incorrectConstraintName}`);
    } else {
      console.log(`   ⚠️  Constraint ${incorrectConstraintName} not found`);
    }

    // 3. Verify the correct index exists
    console.log('\n3. Verifying correct index exists...');
    const correctIndex = await prodPool.query(`
      SELECT indexdef FROM pg_indexes 
      WHERE tablename='user_picks' AND indexname='ux_user_picks_conf_per_week'
    `);

    if (correctIndex.rows.length === 0) {
      console.log('   Creating correct unique index...');
      await prodPool.query(`
        CREATE UNIQUE INDEX ux_user_picks_conf_per_week 
        ON user_picks(user_id, group_id, week, season, season_type, confidence_level) 
        WHERE confidence_level IS NOT NULL
      `);
      console.log('   ✅ Created correct unique index');
    } else {
      console.log('   ✅ Correct unique index already exists');
      console.log(`   Definition: ${correctIndex.rows[0].indexdef}`);
    }

    // 4. Test the fix by checking if your pick would work now
    console.log('\n4. Testing the fix...');
    const testConflict = await prodPool.query(`
      SELECT COUNT(*) as count
      FROM user_picks 
      WHERE user_id = 1 
      AND group_id = 6
      AND week = 0 
      AND season = 2025 
      AND season_type = 2 
      AND confidence_level = 8
    `);

    console.log(`   Conflicts for your pick (user_id=1, group_id=6, confidence=8): ${testConflict.rows[0].count}`);
    
    if (testConflict.rows[0].count === 0) {
      console.log('   ✅ Your pick should work now!');
    } else {
      console.log('   ⚠️  There may still be a conflict');
    }

    // 5. Show final state
    console.log('\n5. Final constraint state...');
    const afterConstraints = await prodPool.query(`
      SELECT conname, pg_get_constraintdef(oid) as definition
      FROM pg_constraint 
      WHERE conrelid = 'user_picks'::regclass AND contype = 'u'
      ORDER BY conname
    `);

    console.log('   Final unique constraints:');
    afterConstraints.rows.forEach(constraint => {
      console.log(`   - ${constraint.conname}: ${constraint.definition}`);
    });

    const finalIndexes = await prodPool.query(`
      SELECT indexname, indexdef FROM pg_indexes 
      WHERE tablename='user_picks' AND indexname LIKE '%conf%'
    `);

    console.log('   Final confidence-related indexes:');
    finalIndexes.rows.forEach(index => {
      console.log(`   - ${index.indexname}: ${index.indexdef}`);
    });

    // Commit the transaction
    await prodPool.query('COMMIT');
    console.log('\n✅ Fix applied successfully!');
    
    console.log('\n🎯 You should now be able to make your pick: MIA with confidence 8 in okun-family-picks group');

  } catch (error) {
    console.error('❌ Error applying fix:', error);
    try {
      await prodPool.query('ROLLBACK');
      console.log('🔄 Transaction rolled back');
    } catch (rollbackError) {
      console.error('❌ Rollback failed:', rollbackError);
    }
  } finally {
    await prodPool.end();
  }
}

fixDuplicateConfidenceConstraint();
