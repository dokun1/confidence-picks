import { Pool } from 'pg';
import dotenv from 'dotenv';

// Load environment-specific config
const envFile = process.env.NODE_ENV === 'test' ? '.env.test' : '.env';
dotenv.config({ path: envFile });

// Auto-select database URL based on environment
const getDatabaseURL = () => {
  if (process.env.NODE_ENV === 'production') {
    return process.env.PROD_DATABASE_URL || process.env.DATABASE_URL;
  }
  if (process.env.NODE_ENV === 'test') {
    return process.env.DATABASE_URL; // Use test database URL from .env.test
  }
  return process.env.DEV_DATABASE_URL || process.env.DATABASE_URL;
};

const isProd = process.env.NODE_ENV === 'production';
const pool = new Pool({
  connectionString: getDatabaseURL(),
  ssl: isProd ? { rejectUnauthorized: false } : false,
  // Keep pool small for serverless (avoid exhausting Postgres on cold starts)
  max: isProd ? parseInt(process.env.PG_POOL_MAX || '5', 10) : 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000
});

// Test the connection
pool.on('connect', () => {
  console.log(`Connected to ${process.env.NODE_ENV || 'development'} database (pool size: ${pool.options.max})`);
});

pool.on('error', (err) => {
  console.error('Database connection error:', err);
});

export default pool;