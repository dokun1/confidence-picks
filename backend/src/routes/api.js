import express from 'express';
import pool from '../config/database.js';

const router = express.Router();

// Simple timestamp route for testing
router.get('/timestamp', (req, res) => {
  const timestamp = new Date().toISOString();
  res.json({ timestamp });
});

router.get('/test-db', async (req, res) => {
  try {
    const result = await pool.query('SELECT NOW() AS current_time');
    res.json({ 
      message: 'Database connected!', 
      timestamp: result.rows[0].current_time 
    });
  } catch (error) {
    console.error('Database query error:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
