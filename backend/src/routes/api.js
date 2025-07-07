import express from 'express';
import pool from '../config/database.js';
import { GameService } from '../services/GameService.js';

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

router.get('/')

router.get('/games/:year/:seasonType/:week', async (req, res) => {
  try {
    const { year, seasonType, week } = req.params;
    const forceRefresh = req.query.refresh === 'true';
    
    const games = await GameService.getGamesForWeek(
      parseInt(year),
      parseInt(seasonType),
      parseInt(week),
      forceRefresh
    );
    
    res.json({
      games,
      count: games.length,
      cached: !forceRefresh
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/games/:espnId', async (req, res) => {
  try {
    const { espnId } = req.params;
    const forceRefresh = req.query.refresh === 'true';
    
    const game = await GameService.getGame(espnId, forceRefresh);
    
    if (!game) {
      return res.status(404).json({ error: 'Game not found' });
    }
    
    res.json(game);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/debug/espn/:year/:seasonType/:week', async (req, res) => {
  try {
    const { year, seasonType, week } = req.params;
    const url = `https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard?dates=${year}&seasontype=${seasonType}&week=${week}`;
    
    const response = await fetch(url);
    const data = await response.json();
    
    res.json({
      url,
      eventsCount: data.events?.length || 0,
      firstEvent: data.events?.[0] || null,
      season: data.season || null,
      week: data.week || null
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
