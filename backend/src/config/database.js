import { Pool } from 'pg';

// Auto-select database URL based on environment
const getDatabaseURL = () => {
  if (process.env.NODE_ENV === 'production') {
    return process.env.PROD_DATABASE_URL || process.env.DATABASE_URL;
  }
  return process.env.DEV_DATABASE_URL || process.env.DATABASE_URL;
};

const pool = new Pool({
  connectionString: getDatabaseURL(),
  ssl: {
    rejectUnauthorized: false
  }
});

// Test the connection
pool.on('connect', () => {
  console.log(`Connected to ${process.env.NODE_ENV || 'development'} database`);
});

pool.on('error', (err) => {
  console.error('Database connection error:', err);
});

export default pool;