import pool from '../config/database.js';

export class Game {
  constructor(data) {
    this.id = data.id;
    this.espnId = data.espnId;
    this.homeTeam = data.homeTeam;
    this.awayTeam = data.awayTeam;
    this.gameDate = data.gameDate;
    this.status = data.status;
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
  const week = weekData.number || 1;

    // Fix the season parsing - it's available in the competition
  const season = competition.season || espnGame.season || {};
  const seasonYear = season.year || new Date().getFullYear();
  const seasonType = season.type || 2;

  return new Game({
    espnId: espnGame.id,
    homeTeam: {
      id: homeTeam.id,
      name: homeTeam.team.displayName,
      abbreviation: homeTeam.team.abbreviation
    },
    awayTeam: {
      id: awayTeam.id,
      name: awayTeam.team.displayName,
      abbreviation: awayTeam.team.abbreviation
    },
    gameDate: new Date(espnGame.date),
    status: competition.status.type.name,
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
      this.awayScore !== otherGame.awayScore
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
      home_score, away_score, week, season, season_type, last_updated
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
    ON CONFLICT (espn_id) 
    DO UPDATE SET
      home_team = $2,
      away_team = $3,
      game_date = $4,
      status = $5,
      home_score = $6,
      away_score = $7,
      week = $8,
      season = $9,
      season_type = $10,
      last_updated = $11
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
    this.status,
    this.homeScore,
    this.awayScore,
    this.week,
    this.season,
    this.seasonType,
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
    status: row.status,
    homeScore: row.home_score,
    awayScore: row.away_score,
    week: row.week,
    season: row.season,
    seasonType: row.season_type,
    lastUpdated: new Date(row.last_updated),
    createdAt: new Date(row.created_at)
  });
}
}