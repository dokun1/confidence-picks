import express from 'express';
import pool from '../config/database.js';
import { GameService } from '../services/GameService.js';
import { ESPNService } from '../services/ESPNService.js';
import { SoccerSummaryService } from '../services/SoccerSummaryService.js';
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

const WORLD_CUP_2026_STAGES = new Set(['group', 'r32', 'r16', 'qf', 'sf', 'third', 'final']);

// Registered before /games/:year/:seasonType/:week: both are four-segment paths, so
// the literal world-cup-2026/stage prefix must match before the NFL param route
// claims it (year='world-cup-2026', seasonType='stage' → NaN → DB error).
router.get('/games/world-cup-2026/stage/:stage', async (req, res) => {
  try {
    const { stage } = req.params;

    if (!WORLD_CUP_2026_STAGES.has(stage)) {
      return res.status(400).json({
        error: `Invalid stage '${stage}'. Must be one of: ${[...WORLD_CUP_2026_STAGES].join(', ')}`
      });
    }

    const forceRefresh = (req.query.refresh === 'true') || (req.query.force === 'true') || (req.query.force === '1');

    const games = await GameService.getWorldCupStage(stage, forceRefresh);

    res.json({
      // Mirror the week handler's { games, count, cached } shape. winnerTeamId is
      // resolved onto each Game by GameService but isn't part of Game.toJSON(), so
      // graft it on here to preserve the knockout advancing-team signal in the payload.
      games: games.map(g => {
        const json = (typeof g.toJSON === 'function' ? g.toJSON() : { ...g });
        json.winnerTeamId = g.winnerTeamId ?? null;
        return json;
      }),
      count: games.length,
      cached: !forceRefresh
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Whole-tournament slate in ONE request. The Picks tab previously fanned out to
// seven /stage/:stage calls on every mount; this collapses them server-side so a
// cold Picks load is a single round-trip. Registered before /games/:year/... for
// the same reason as the stage route (literal world-cup-2026 prefix must win).
router.get('/games/world-cup-2026/stages', async (req, res) => {
  try {
    const forceRefresh = (req.query.refresh === 'true') || (req.query.force === 'true') || (req.query.force === '1');

    const games = await GameService.getAllWorldCupStages(forceRefresh);

    res.json({
      // Same per-game shape as the single-stage handler, including the grafted
      // winnerTeamId (not part of Game.toJSON()) so knockout advancing-team
      // signals survive in the flattened payload.
      games: games.map(g => {
        const json = (typeof g.toJSON === 'function' ? g.toJSON() : { ...g });
        json.winnerTeamId = g.winnerTeamId ?? null;
        return json;
      }),
      count: games.length,
      cached: !forceRefresh
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// On-demand, resilient, no-schema per-match detail for the World Cup detail panel.
// Registered before /games/:year/:seasonType/:week for the same reason as the stage
// route: world-cup-2026/event/:espnId is a literal-prefixed 4-segment path the NFL
// param route would otherwise claim. Fetches ESPN /summary live and returns parsed
// JSON — NO database, NO persistence. NEVER 500: on any failure we return HTTP 200
// with a sparse-but-valid body so a broken /summary only blanks the panel.
router.get('/games/world-cup-2026/event/:espnId', async (req, res) => {
  const { espnId } = req.params;
  try {
    const summary = await ESPNService.fetchSoccerSummary(espnId);
    res.json(SoccerSummaryService.parseSummary(summary));
  } catch (error) {
    console.error(`[event-detail] failed for espnId=${espnId}: ${error.message}`);
    res.json({ venue: null, stats: [], lineups: null }); // never 500 — blank detail, not an error
  }
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
