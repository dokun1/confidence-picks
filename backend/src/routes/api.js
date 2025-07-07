import express from 'express';
import pool from '../config/database.js';

const router = express.Router();

// Force deployment - updated routes
router.get('/debug', (req, res) => {
  res.json({
    message: 'Debug route working',
    hasDbUrl: !!process.env.DATABASE_URL,
    nodeEnv: process.env.NODE_ENV,
    timestamp: new Date().toISOString(),
    version: '1.1' // Add this to confirm new deployment
  });
});

// Simple timestamp route for testing
router.get('/timestamp', (req, res) => {
  const timestamp = new Date().toISOString();
  res.json({ 
    "timestamp": timestamp,
    "message": "Timestamp route working"
  });
});

router.get('/test-db', async (req, res) => {
  console.log('Database test route called');
  console.log('DATABASE_URL exists:', !!process.env.DATABASE_URL);
  
  try {
    const result = await pool.query('SELECT NOW() AS current_time');
    res.json({ 
      message: 'Database connected!', 
      timestamp: result.rows[0].current_time 
    });
  } catch (error) {
    console.error('Database query error:', error);
    res.status(500).json({ 
      error: error.message,
      code: error.code,
      hasDbUrl: !!process.env.DATABASE_URL
    });
  }
});

export default router;
