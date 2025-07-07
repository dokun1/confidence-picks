-- Create games table
CREATE TABLE IF NOT EXISTS games (
  id SERIAL PRIMARY KEY,
  espn_id VARCHAR(50) UNIQUE NOT NULL,
  home_team JSONB NOT NULL,
  away_team JSONB NOT NULL,
  game_date TIMESTAMP NOT NULL,
  status VARCHAR(50) NOT NULL,
  home_score INTEGER DEFAULT 0,
  away_score INTEGER DEFAULT 0,
  week INTEGER NOT NULL,
  season INTEGER NOT NULL,
  season_type INTEGER NOT NULL,
  last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_games_espn_id ON games(espn_id);
CREATE INDEX IF NOT EXISTS idx_games_week_season ON games(week, season, season_type);