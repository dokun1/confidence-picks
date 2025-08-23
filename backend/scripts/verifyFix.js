import { Pool } from 'pg';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Connect specifically to production database
const prodPool = new Pool({
  connectionString: process.env.PROD_DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function verifyFixWorked() {
  try {
    console.log('✅ Verifying that your pick should work now...\n');

    // Test if the pick would work now
    const testQuery = await prodPool.query(`
      SELECT COUNT(*) as conflicts
      FROM user_picks 
      WHERE user_id = 1 
      AND group_id = 6
      AND week = 0 
      AND season = 2025 
      AND season_type = 2 
      AND confidence_level = 8
    `);

    console.log(`Checking for conflicts with your pick (User 1, Group 6, Confidence 8, Week 0):`);
    console.log(`   Conflicts found: ${testQuery.rows[0].conflicts}`);

    if (testQuery.rows[0].conflicts === 0) {
      console.log('   ✅ NO CONFLICTS! Your pick should work now.');
    } else {
      console.log('   ❌ Still conflicts. Something else might be wrong.');
    }

    // Show current state for peace of mind
    console.log('\nCurrent constraints on user_picks:');
    const constraints = await prodPool.query(`
      SELECT conname, pg_get_constraintdef(oid) as definition
      FROM pg_constraint 
      WHERE conrelid = 'user_picks'::regclass AND contype = 'u'
      ORDER BY conname
    `);

    constraints.rows.forEach(constraint => {
      console.log(`   - ${constraint.conname}: ${constraint.definition}`);
    });

    console.log('\nCurrent confidence-related indexes:');
    const indexes = await prodPool.query(`
      SELECT indexname, indexdef FROM pg_indexes 
      WHERE tablename='user_picks' AND indexname LIKE '%conf%'
    `);

    indexes.rows.forEach(index => {
      console.log(`   - ${index.indexname}`);
      console.log(`     ${index.indexdef}`);
    });

    console.log('\n🎯 You can now try making your pick: MIA with confidence 8 in okun-family-picks group!');

  } catch (error) {
    console.error('❌ Error verifying fix:', error);
  } finally {
    await prodPool.end();
  }
}

verifyFixWorked();
