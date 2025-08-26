import { Pool } from 'pg';
import dotenv from 'dotenv';
dotenv.config();

async function addAppleAuthSupport() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
  });

  try {
    console.log('🍎 Adding Apple Sign In support to database...');
    
    // Check if apple_id column already exists
    const checkColumn = await pool.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'users' AND column_name = 'apple_id'
    `);

    if (checkColumn.rows.length > 0) {
      console.log('✅ apple_id column already exists');
      return;
    }

    // Add apple_id column
    await pool.query(`
      ALTER TABLE users 
      ADD COLUMN apple_id VARCHAR(255) UNIQUE
    `);

    console.log('✅ Added apple_id column to users table');

    // Create index for faster lookups
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_users_apple_id ON users(apple_id)
    `);

    console.log('✅ Created index on apple_id column');

    // Verify the changes
    const result = await pool.query(`
      SELECT column_name, data_type, is_nullable 
      FROM information_schema.columns 
      WHERE table_name = 'users' AND column_name = 'apple_id'
    `);

    console.log('📊 Column details:', result.rows[0]);
    console.log('🎉 Apple Sign In database migration completed successfully!');

  } catch (error) {
    console.error('❌ Error adding Apple Sign In support:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

// Run the migration
addAppleAuthSupport()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });
