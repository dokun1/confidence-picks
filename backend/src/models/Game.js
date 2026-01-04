import pool from '../config/database.js';
import { getCurrentNFLSeason } from '../utils/nflSeasonUtils.js';

export class Game {
  constructor(data) {
    this.id = data.id;
    this.espnId = data.espnId;
    this.homeTeam = data.homeTeam;
    this.awayTeam = data.awayTeam;
    this.gameDate = data.gameDate;
  // Normalized status (one of: SCHEDULED | IN_PROGRESS | FINAL)
  this.status = data.status; 
  // Raw ESPN status name (e.g., STATUS_IN_PROGRESS) for debugging
  this.rawStatus = data.rawStatus;
  // High-level category (alias of status for clarity)
  this.statusCategory = data.statusCategory || data.status;
  // Additional live status metadata (not persisted yet)
  this.statusState = data.statusState; // 'pre' | 'in' | 'post'
  this.completed = data.completed; // boolean
  this.statusDescription = data.statusDescription; // e.g. 'Final' / 'Halftime'
  this.statusDetail = data.statusDetail; // e.g. 'Q3 05:32'
  this.clock = data.clock; // seconds remaining in current period (number)
  this.displayClock = data.displayClock; // formatted clock string
  this.period = data.period; // current period number
  // Odds & probability (not persisted yet)
  this.odds = data.odds; // { favoriteTeamId, favoriteAbbr, spread, overUnder, details, provider }
  this.probability = data.probability; // { homeWinPct, awayWinPct }
    this.homeScore = data.homeScore || 0;
    this.awayScore = data.awayScore || 0;
    this.week = data.week;
    this.season = data.season;
    this.seasonType = data.seasonType;
    this.lastUpdated = data.lastUpdated;
    this.createdAt = data.createdAt;
  }

  // Create a Game from ESPN API data
// Create a Game from ESPN API data
static fromESPNData(espnGame) {
  console.log('ESPN Game Data:', JSON.stringify(espnGame, null, 2));
  
  const competition = espnGame.competitions[0];
  console.log('Competition:', JSON.stringify(competition, null, 2));
  
  const competitors = competition.competitors;
  
  const homeTeam = competitors.find(c => c.homeAway === 'home');
  const awayTeam = competitors.find(c => c.homeAway === 'away');

  
  const weekData = competition.week || espnGame.week || {};
  let week = weekData.number || 1;

    // Fix the season parsing - it's available in the competition
  const season = competition.season || espnGame.season || {};
  const seasonYear = season.year || getCurrentNFLSeason();
  let seasonType = season.type || 2;

  // Map ONLY the final preseason week to regular season week 0 for picks/testing
  try {
    const PRE_FINAL = parseInt(process.env.PRESEASON_FINAL_WEEK || '4', 10); // default 4
    if (seasonType === 1 && week === PRE_FINAL) {
      console.log(`[week-map] Mapping preseason week ${PRE_FINAL} to regular season week 0`);
      week = 0; // represent as week 0
      seasonType = 2; // treat as regular season for picks/standings
    }
  } catch (_) { /* ignore env parse issues */ }

  const statusBlock = competition.status || {};
  const statusType = statusBlock.type || {};
  const period = statusBlock.period;
  const clock = statusBlock.clock;
  const displayClock = statusBlock.displayClock;

  // Normalize to one of three categories
  const statusState = statusType.state; // 'pre' | 'in' | 'post'
  let normalized;
  if (statusState === 'pre') normalized = 'SCHEDULED';
  else if (statusState === 'in') normalized = 'IN_PROGRESS';
  else if (statusState === 'post') normalized = statusType.completed ? 'FINAL' : 'IN_PROGRESS';
  else normalized = statusType.completed ? 'FINAL' : 'SCHEDULED';

  // Odds extraction
  let oddsObj = null;
  if (competition.odds && competition.odds.length > 0) {
    const o = competition.odds[0];
    let favoriteTeamId = null;
    let favoriteAbbr = null;
    if (o.awayTeamOdds && o.awayTeamOdds.favorite) {
      favoriteTeamId = awayTeam.id;
      favoriteAbbr = awayTeam.team.abbreviation;
    } else if (o.homeTeamOdds && o.homeTeamOdds.favorite) {
      favoriteTeamId = homeTeam.id;
      favoriteAbbr = homeTeam.team.abbreviation;
    }
    oddsObj = {
      favoriteTeamId,
      favoriteAbbr,
      spread: o.spread,
      overUnder: o.overUnder,
      details: o.details,
      provider: o.provider ? o.provider.name : undefined
    };
  }

  // Win probability (only available in situation.lastPlay.probability sometimes)
  let probability = null;
  const situation = competition.situation || {};
  const lastPlay = situation.lastPlay || {};
  if (lastPlay.probability) {
    probability = {
      homeWinPct: lastPlay.probability.homeWinPercentage,
      awayWinPct: lastPlay.probability.awayWinPercentage
    };
  }

  return new Game({
    espnId: espnGame.id,
    homeTeam: {
  id: homeTeam.id,
  name: homeTeam.team.displayName,
  abbreviation: homeTeam.team.abbreviation,
  logo: homeTeam.team.logo,
  color: homeTeam.team.color,
  altColor: homeTeam.team.alternateColor
    },
    awayTeam: {
  id: awayTeam.id,
  name: awayTeam.team.displayName,
  abbreviation: awayTeam.team.abbreviation,
  logo: awayTeam.team.logo,
  color: awayTeam.team.color,
  altColor: awayTeam.team.alternateColor
    },
    gameDate: new Date(espnGame.date),
    status: normalized,
    rawStatus: statusType.name,
    statusCategory: normalized,
    statusState: statusType.state, // 'pre' | 'in' | 'post'
    completed: statusType.completed,
    statusDescription: statusType.description,
    statusDetail: statusType.detail,
    clock,
    displayClock,
    period,
    odds: oddsObj,
    probability,
    homeScore: parseInt(homeTeam.score) || 0,
    awayScore: parseInt(awayTeam.score) || 0,
    week: week,
    season: seasonYear,
    seasonType: seasonType,
    lastUpdated: new Date()
  });
}

  // Check if this game data is different from another game
  isDifferentFrom(otherGame) {
    return (
      this.gameDate.getTime() !== otherGame.gameDate.getTime() ||
  this.status !== otherGame.status ||
      this.homeScore !== otherGame.homeScore ||
  this.awayScore !== otherGame.awayScore ||
  this.period !== otherGame.period ||
  this.displayClock !== otherGame.displayClock ||
  this.statusDetail !== otherGame.statusDetail
    );
  }

  // Check if data is stale (older than 24 hours)
  isStale() {
    if (!this.lastUpdated) return true;
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    return new Date(this.lastUpdated) < twentyFourHoursAgo;
  }

// Save to database
async save() {
  const query = `
    INSERT INTO games (
      espn_id, home_team, away_team, game_date, status, 
      period, display_clock, status_detail,
      home_score, away_score, week, season, season_type, odds, probability, last_updated
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
    ON CONFLICT (espn_id) 
    DO UPDATE SET
      home_team = $2,
      away_team = $3,
      game_date = $4,
  status = $5,
      period = $6,
      display_clock = $7,
      status_detail = $8,
      home_score = $9,
      away_score = $10,
      week = $11,
      season = $12,
      season_type = $13,
      odds = $14,
      probability = $15,
      last_updated = $16
    RETURNING *
  `;

  // Add debugging
  console.log('Saving game with values:');
  console.log('homeTeam:', this.homeTeam);
  console.log('awayTeam:', this.awayTeam);
  console.log('homeTeam JSON:', JSON.stringify(this.homeTeam));
  console.log('awayTeam JSON:', JSON.stringify(this.awayTeam));

  const values = [
    this.espnId,
    JSON.stringify(this.homeTeam),
    JSON.stringify(this.awayTeam),
    this.gameDate,
  this.status, // normalized (SCHEDULED | IN_PROGRESS | FINAL)
  this.period,
  this.displayClock,
  this.statusDetail,
    this.homeScore,
    this.awayScore,
    this.week,
    this.season,
    this.seasonType,
    JSON.stringify(this.odds || null),
    JSON.stringify(this.probability || null),
    this.lastUpdated
  ];

  const result = await pool.query(query, values);
  this.id = result.rows[0].id;
  return this;
}

// Find game by ESPN ID
static async findByESPNId(espnId) {
  const query = 'SELECT * FROM games WHERE espn_id = $1';
  const result = await pool.query(query, [espnId]);
  
  if (result.rows.length === 0) return null;
  
  const row = result.rows[0];
  
  // Add debugging to see what's in the database
  console.log('Raw database row:', row);
  console.log('home_team type:', typeof row.home_team);
  console.log('home_team value:', row.home_team);
  console.log('away_team type:', typeof row.away_team);
  console.log('away_team value:', row.away_team);
  
  // Safe JSON parsing
  let homeTeam, awayTeam;
  try {
    homeTeam = typeof row.home_team === 'string' ? JSON.parse(row.home_team) : row.home_team;
    awayTeam = typeof row.away_team === 'string' ? JSON.parse(row.away_team) : row.away_team;
  } catch (error) {
    console.error('JSON parsing error:', error);
    console.error('home_team:', row.home_team);
    console.error('away_team:', row.away_team);
    throw new Error('Failed to parse team data from database');
  }
  
  return new Game({
    id: row.id,
    espnId: row.espn_id,
    homeTeam: homeTeam,
    awayTeam: awayTeam,
    gameDate: new Date(row.game_date),
  status: row.status, // already normalized after migration; if legacy, frontend can still interpret
  rawStatus: row.status, // fallback
  period: row.period,
  displayClock: row.display_clock,
  statusDetail: row.status_detail,
    homeScore: row.home_score,
  odds: row.odds ? (typeof row.odds === 'string' ? JSON.parse(row.odds) : row.odds) : null,
  probability: row.probability ? (typeof row.probability === 'string' ? JSON.parse(row.probability) : row.probability) : null,
    awayScore: row.away_score,
    week: row.week,
    season: row.season,
    seasonType: row.season_type,
    lastUpdated: new Date(row.last_updated),
    createdAt: new Date(row.created_at)
  });
}

// Find all games for a given week/season/seasonType
static async findByWeekSeason(season, seasonType, week) {
  const query = `SELECT * FROM games WHERE season = $1 AND season_type = $2 AND week = $3`;
  const result = await pool.query(query, [season, seasonType, week]);
  if (result.rows.length === 0) return [];
  return result.rows.map(row => new Game({
    id: row.id,
    espnId: row.espn_id,
    homeTeam: typeof row.home_team === 'string' ? JSON.parse(row.home_team) : row.home_team,
    awayTeam: typeof row.away_team === 'string' ? JSON.parse(row.away_team) : row.away_team,
    gameDate: new Date(row.game_date),
    status: row.status,
    rawStatus: row.status,
  period: row.period,
  displayClock: row.display_clock,
  statusDetail: row.status_detail,
    homeScore: row.home_score,
  odds: row.odds ? (typeof row.odds === 'string' ? JSON.parse(row.odds) : row.odds) : null,
  probability: row.probability ? (typeof row.probability === 'string' ? JSON.parse(row.probability) : row.probability) : null,
    awayScore: row.away_score,
    week: row.week,
    season: row.season,
    seasonType: row.season_type,
    lastUpdated: new Date(row.last_updated),
    createdAt: new Date(row.created_at)
  }));
}

  toJSON() {
    return {
      id: this.id,
      espnId: this.espnId,
      homeTeam: this.homeTeam,
      awayTeam: this.awayTeam,
      gameDate: this.gameDate,
      status: this.status,
  statusCategory: this.statusCategory,
  rawStatus: this.rawStatus,
      statusState: this.statusState,
      completed: this.completed,
      statusDescription: this.statusDescription,
      statusDetail: this.statusDetail,
      clock: this.clock,
      displayClock: this.displayClock,
      period: this.period,
  odds: this.odds,
  probability: this.probability,
      homeScore: this.homeScore,
      awayScore: this.awayScore,
      week: this.week,
      season: this.season,
      seasonType: this.seasonType,
      lastUpdated: this.lastUpdated,
      createdAt: this.createdAt
    };
  }
}