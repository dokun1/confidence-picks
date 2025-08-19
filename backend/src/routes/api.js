import express from 'express';
import pool from '../config/database.js';
import { GameService } from '../services/GameService.js';
import { authenticateToken, optionalAuth } from '../middleware/auth.js';

const router = express.Router();

router.get('/', (req, res) => {
  res.json({ 
    message: 'Confidence Picks API',
    version: '1.0.0',
    endpoints: [
      'GET /api/games/:year/:seasonType/:week',
      'GET /api/games/:espnId',
      'GET /api/debug/espn/:year/:seasonType/:week'
    ]
  });
});

router.get('/games/:year/:seasonType/:week', async (req, res) => {
  try {
    const { year, seasonType, week } = req.params;
  const forceRefresh = (req.query.refresh === 'true') || (req.query.force === 'true') || (req.query.force === '1');
    
    const games = await GameService.getGamesForWeek(
      parseInt(year),
      parseInt(seasonType),
      parseInt(week),
      forceRefresh
    );
    
    res.json({
      games: games.map(g => (typeof g.toJSON === 'function' ? g.toJSON() : g)),
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
