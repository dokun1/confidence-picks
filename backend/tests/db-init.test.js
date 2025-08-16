import { test, describe, before, after } from 'node:test';
import assert from 'node:assert';
import { initDatabase } from '../src/database/init.js';
import pool from '../src/config/database.js';

describe('Database Initialization', () => {
  
  after(async () => {
    // Clean up database connection
    await pool.end();
  });

  test('should initialize database schema successfully', async () => {
    try {
      console.log('🧪 Testing database initialization...');
      
      await initDatabase();
      
      // Verify core tables exist
      const tables = ['users', 'games', 'user_sessions', 'user_picks', 'groups', 'group_memberships', 'group_invitations', 'group_messages'];
      
      for (const table of tables) {
        const result = await pool.query(
          `SELECT EXISTS (
            SELECT FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_name = $1
          )`,
          [table]
        );
        
        assert.strictEqual(result.rows[0].exists, true, `Table ${table} should exist`);
      }
      
      // Verify foreign key constraints exist
      const constraints = await pool.query(`
        SELECT constraint_name, table_name 
        FROM information_schema.table_constraints 
        WHERE constraint_type = 'FOREIGN KEY' 
        AND table_name IN ('group_memberships', 'group_invitations', 'group_messages', 'user_picks')
      `);
      
      assert.ok(constraints.rows.length > 0, 'Foreign key constraints should exist');
      
      // Verify group_id column exists in user_picks
      const groupIdColumn = await pool.query(`
        SELECT column_name, data_type 
        FROM information_schema.columns 
        WHERE table_name = 'user_picks' AND column_name = 'group_id'
      `);
      
      assert.strictEqual(groupIdColumn.rows.length, 1, 'group_id column should exist in user_picks');
      
      console.log('✅ Database initialization test passed');
    } catch (error) {
      console.error('❌ Database initialization failed:', error);
      throw error;
    }
  });

  test('should create indexes for performance', async () => {
    try {
      console.log('🧪 Testing database indexes...');
      
      // Check if key indexes exist
      const indexes = await pool.query(`
        SELECT indexname, tablename 
        FROM pg_indexes 
        WHERE schemaname = 'public' 
        AND indexname IN ('idx_groups_identifier', 'idx_group_memberships_user', 'idx_user_picks_group')
      `);
      
      assert.ok(indexes.rows.length >= 3, 'Key indexes should exist');
      
      console.log('✅ Database indexes test passed');
    } catch (error) {
      console.error('❌ Database indexes test failed:', error);
      throw error;
    }
  });
});
