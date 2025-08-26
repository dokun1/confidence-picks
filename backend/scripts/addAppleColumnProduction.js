#!/usr/bin/env node

import pkg from 'pg';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const { Pool } = pkg;

// Connect to production database
const pool = new Pool({
  connectionString: process.env.PROD_DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

async function addAppleColumn() {
  try {
    console.log('🔍 Checking if apple_id column exists in production...');
    
    // Check if column exists
    const checkQuery = `
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'users' AND column_name = 'apple_id';
    `;
    
    const checkResult = await pool.query(checkQuery);
    
    if (checkResult.rows.length > 0) {
      console.log('✅ apple_id column already exists in production database');
      return;
    }
    
    console.log('⚠️ apple_id column missing. Adding it now...');
    
    // Add the column
    const addColumnQuery = `
      ALTER TABLE users 
      ADD COLUMN apple_id VARCHAR(255) UNIQUE;
    `;
    
    await pool.query(addColumnQuery);
    
    console.log('✅ Successfully added apple_id column to production database');
    console.log('🎉 Apple Sign In should now work properly!');
    
  } catch (error) {
    console.error('❌ Error updating production database:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

addAppleColumn();
