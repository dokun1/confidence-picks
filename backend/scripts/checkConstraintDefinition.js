import { Pool } from 'pg';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Connect specifically to production database
const prodPool = new Pool({
  connectionString: process.env.PROD_DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function checkConstraintDefinition() {
  try {
    console.log('🔍 Checking confidence constraint definition in PRODUCTION...\n');

    // Check the current index definition
    const indexQuery = await prodPool.query(`
      SELECT indexdef 
      FROM pg_indexes 
      WHERE tablename='user_picks' AND indexname='ux_user_picks_conf_per_week'
    `);

    console.log('Current confidence unique index definition:');
    if (indexQuery.rows.length === 0) {
      console.log('   ❌ INDEX NOT FOUND');
    } else {
      console.log(`   ${indexQuery.rows[0].indexdef}`);
    }

    // Also check constraints
    const constraintQuery = await prodPool.query(`
      SELECT conname, pg_get_constraintdef(oid) as definition
      FROM pg_constraint 
      WHERE conrelid = 'user_picks'::regclass
      AND contype = 'u'
    `);

    console.log('\nUnique constraints on user_picks:');
    if (constraintQuery.rows.length === 0) {
      console.log('   ❌ NO UNIQUE CONSTRAINTS FOUND');
    } else {
      constraintQuery.rows.forEach(constraint => {
        console.log(`   ${constraint.conname}: ${constraint.definition}`);
      });
    }

    // Test the constraint by seeing what would happen with your pick
    const testQuery = await prodPool.query(`
      SELECT COUNT(*) as conflict_count
      FROM user_picks 
      WHERE group_id = 6 
      AND season = 2025 
      AND season_type = 2 
      AND week = 0 
      AND confidence_level = 8
    `);

    console.log('\nExisting picks with confidence level 8 in group 6, week 0:');
    console.log(`   Count: ${testQuery.rows[0].conflict_count}`);

  } catch (error) {
    console.error('❌ Error checking constraint:', error);
  } finally {
    await prodPool.end();
  }
}

checkConstraintDefinition();
