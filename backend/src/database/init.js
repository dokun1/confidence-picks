import 'dotenv/config';  // Add this line
import pool from '../config/database.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export async function initDatabase() {
  try {
    // Add debug logging
    console.log('NODE_ENV:', process.env.NODE_ENV);
    console.log('DEV_DATABASE_URL exists:', !!process.env.DEV_DATABASE_URL);
    console.log('DATABASE_URL exists:', !!process.env.DATABASE_URL);
    
    const schemaSQL = fs.readFileSync(
      path.join(__dirname, 'schema.sql'), 
      'utf8'
    );
    
    await pool.query(schemaSQL);
    console.log('Database initialized successfully');
  } catch (error) {
    console.error('Failed to initialize database:', error);
    throw error;
  }
}

// Run this if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  await initDatabase();
  process.exit(0);
}