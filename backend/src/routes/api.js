import express from 'express';
import pool from '../config/database.js';
import { GameService } from '../services/GameService.js';

const router = express.Router();

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
