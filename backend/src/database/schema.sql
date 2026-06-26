-- Create games table
CREATE TABLE IF NOT EXISTS games (
  id SERIAL PRIMARY KEY,
  espn_id VARCHAR(50) UNIQUE NOT NULL,
  home_team JSONB NOT NULL,
  away_team JSONB NOT NULL,
  game_date TIMESTAMP NOT NULL,
  status VARCHAR(50) NOT NULL,
  -- Live status metadata (added after initial creation; may be null for historical rows)
  period INTEGER NULL,
  display_clock VARCHAR(20) NULL,
  status_detail VARCHAR(80) NULL,
  home_score INTEGER DEFAULT 0,
  away_score INTEGER DEFAULT 0,
  week INTEGER NOT NULL,
  season INTEGER NOT NULL,
  season_type INTEGER NOT NULL,
  league VARCHAR(50) NOT NULL DEFAULT 'nfl', -- 'nfl' or a soccer league slug (e.g. 'world_cup_2026')
  stage VARCHAR(20) NULL CHECK (stage IN ('group','r32','r16','qf','sf','third','final')), -- soccer tournament stage; NFL leaves NULL
  last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_games_espn_id ON games(espn_id);
CREATE INDEX IF NOT EXISTS idx_games_week_season ON games(week, season, season_type);

-- Users table
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  google_id VARCHAR(255) UNIQUE,
  apple_id VARCHAR(255) UNIQUE,
  email VARCHAR(255) UNIQUE NOT NULL,
  name VARCHAR(255) NOT NULL,
  picture_url VARCHAR(500),
  provider VARCHAR(20) NOT NULL, -- 'google' or 'apple'
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  last_login TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- User sessions table (for JWT token management)
CREATE TABLE IF NOT EXISTS user_sessions (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  refresh_token VARCHAR(500) UNIQUE NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Groups table (moved before user_picks to satisfy FK dependency)
CREATE TABLE IF NOT EXISTS groups (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  identifier VARCHAR(100) UNIQUE NOT NULL, -- URL-friendly unique identifier
  description TEXT,
  is_public BOOLEAN DEFAULT true,
  max_members INTEGER DEFAULT 50 CONSTRAINT groups_max_members_range CHECK (max_members <= 500 AND max_members >= 2),
  pool_type VARCHAR(20) NOT NULL DEFAULT 'nfl_weekly' CHECK (pool_type IN ('nfl_weekly','world_cup_2026')), -- pick-pool variant
  knockout_only BOOLEAN NOT NULL DEFAULT false, -- world_cup_2026 sub-setting: members may only pick knockout-stage games (no group stage)
  avatar_url VARCHAR(500),
  created_by INTEGER REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Group memberships table
CREATE TABLE IF NOT EXISTS group_memberships (
  id SERIAL PRIMARY KEY,
  group_id INTEGER REFERENCES groups(id) ON DELETE CASCADE,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  role VARCHAR(20) DEFAULT 'member', -- 'admin', 'member'
  joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(group_id, user_id)
);

-- Group invitations table
CREATE TABLE IF NOT EXISTS group_invitations (
  id SERIAL PRIMARY KEY,
  group_id INTEGER REFERENCES groups(id) ON DELETE CASCADE,
  invited_by INTEGER REFERENCES users(id) ON DELETE CASCADE,
  invited_email VARCHAR(255) NOT NULL,
  token VARCHAR(255) UNIQUE NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  accepted_at TIMESTAMP NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(group_id, invited_email)
);

-- Shareable / link-style invitations enhancements (idempotent alterations)
DO $$
BEGIN
  -- Allow invited_email to be nullable for link invites (idempotent)
  ALTER TABLE group_invitations ALTER COLUMN invited_email DROP NOT NULL;

  -- Add invite_type column (email | link)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns WHERE table_name='group_invitations' AND column_name='invite_type'
  ) THEN
    ALTER TABLE group_invitations ADD COLUMN invite_type VARCHAR(20) DEFAULT 'email';
  END IF;

  -- Add max_uses column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns WHERE table_name='group_invitations' AND column_name='max_uses'
  ) THEN
    ALTER TABLE group_invitations ADD COLUMN max_uses INTEGER NULL;
  END IF;

  -- Add uses counter
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns WHERE table_name='group_invitations' AND column_name='uses'
  ) THEN
    ALTER TABLE group_invitations ADD COLUMN uses INTEGER NOT NULL DEFAULT 0;
  END IF;

  -- Add revoked_at timestamp
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns WHERE table_name='group_invitations' AND column_name='revoked_at'
  ) THEN
    ALTER TABLE group_invitations ADD COLUMN revoked_at TIMESTAMP NULL;
  END IF;
END $$;

-- Track individual uses (who consumed an invite; supports analytics and preventing duplicate counting)
CREATE TABLE IF NOT EXISTS group_invitation_uses (
  id SERIAL PRIMARY KEY,
  invitation_id INTEGER REFERENCES group_invitations(id) ON DELETE CASCADE,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  used_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(invitation_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_group_invitations_group_type ON group_invitations(group_id, invite_type);
CREATE INDEX IF NOT EXISTS idx_group_invitation_uses_invitation ON group_invitation_uses(invitation_id);
-- Cleanup performance index for expiration-based pruning
CREATE INDEX IF NOT EXISTS idx_group_invitations_expires_at ON group_invitations(expires_at);

-- Group message board
CREATE TABLE IF NOT EXISTS group_messages (
  id SERIAL PRIMARY KEY,
  group_id INTEGER REFERENCES groups(id) ON DELETE CASCADE,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  message TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Per-user chat read markers. One row per (group, user) recording the last time
-- that user visited the group chat. The absence of a row is meaningful: it means
-- the user has never read the chat, so every message reads as unread. This is the
-- intended initial state for everyone — no backfill is required to "put everyone
-- in the unread state". A message counts as unread for a user when it was authored
-- by someone else and created after that user's last_read_at (or no marker exists).
CREATE TABLE IF NOT EXISTS group_message_reads (
  id SERIAL PRIMARY KEY,
  group_id INTEGER REFERENCES groups(id) ON DELETE CASCADE,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  last_read_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(group_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_group_message_reads_group_user ON group_message_reads(group_id, user_id);

-- User picks table (for confidence picks) now that groups exists
CREATE TABLE IF NOT EXISTS user_picks (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  group_id INTEGER REFERENCES groups(id) ON DELETE CASCADE,
  game_id INTEGER REFERENCES games(id) ON DELETE CASCADE,
  picked_team_id VARCHAR(50) NULL, -- ESPN team ID (nullable until user selects)
  picked_result VARCHAR(10) NULL CHECK (picked_result IN ('home','away','draw')), -- soccer pick outcome; NFL leaves NULL
  confidence_level INTEGER NULL CHECK (confidence_level >= 1 AND confidence_level <= 30), -- upper bound generous; enforced per-week dynamically
  week INTEGER NOT NULL,
  season INTEGER NOT NULL,
  season_type INTEGER NOT NULL,
  won BOOLEAN NULL, -- populated when game final
  points INTEGER NULL, -- confidence if won else 0 when final
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, group_id, game_id), -- one pick record per game per user per group
  -- Enforce unique confidence per week only when confidence_level NOT NULL (partial unique requires separate index below)
  CONSTRAINT chk_pick_consistency CHECK (
    (confidence_level IS NULL AND picked_team_id IS NULL) OR
    (confidence_level IS NOT NULL AND picked_team_id IS NOT NULL)
  )
);

-- Partial unique index for confidence values (Postgres specific) ensures uniqueness only for chosen confidences
CREATE UNIQUE INDEX IF NOT EXISTS ux_user_picks_conf_per_week
  ON user_picks(user_id, group_id, week, season, season_type, confidence_level)
  WHERE confidence_level IS NOT NULL;

-- Migrate legacy unique constraint (user_id, game_id) to (user_id, group_id, game_id)
DO $$
BEGIN
  -- Drop old constraint if it exists
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conrelid='user_picks'::regclass AND conname='user_picks_user_id_game_id_key'
  ) THEN
    ALTER TABLE user_picks DROP CONSTRAINT user_picks_user_id_game_id_key;
  END IF;
  -- Add new composite unique if not already present (may already exist from table definition)
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conrelid='user_picks'::regclass AND conname='user_picks_user_group_game_key'
  ) THEN
    ALTER TABLE user_picks ADD CONSTRAINT user_picks_user_group_game_key UNIQUE (user_id, group_id, game_id);
  END IF;
END $$;

-- Add betting odds & probability JSON columns if they do not exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'games' AND column_name = 'odds'
  ) THEN
    ALTER TABLE games ADD COLUMN odds JSONB NULL;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'games' AND column_name = 'probability'
  ) THEN
    ALTER TABLE games ADD COLUMN probability JSONB NULL;
  END IF;
END $$;

-- World Cup 2026 / league-awareness columns. These were added to the CREATE TABLE
-- blocks above, but those are no-ops on a DB whose tables predate the change, so a
-- pre-existing games/groups/user_picks would never gain the columns. Add them here
-- as forward-only, idempotent ALTERs. The NOT NULL DEFAULTs backfill existing rows
-- (NFL games -> league='nfl'; existing groups -> pool_type='nfl_weekly'); the
-- nullable columns leave legacy rows untouched (stage NULL, picked_result NULL).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'games' AND column_name = 'league'
  ) THEN
    ALTER TABLE games ADD COLUMN league VARCHAR(50) NOT NULL DEFAULT 'nfl';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'games' AND column_name = 'stage'
  ) THEN
    ALTER TABLE games ADD COLUMN stage VARCHAR(20) NULL
      CHECK (stage IN ('group','r32','r16','qf','sf','third','final'));
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'groups' AND column_name = 'pool_type'
  ) THEN
    ALTER TABLE groups ADD COLUMN pool_type VARCHAR(20) NOT NULL DEFAULT 'nfl_weekly'
      CHECK (pool_type IN ('nfl_weekly','world_cup_2026'));
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'groups' AND column_name = 'knockout_only'
  ) THEN
    ALTER TABLE groups ADD COLUMN knockout_only BOOLEAN NOT NULL DEFAULT false;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_picks' AND column_name = 'picked_result'
  ) THEN
    ALTER TABLE user_picks ADD COLUMN picked_result VARCHAR(10) NULL
      CHECK (picked_result IN ('home','away','draw'));
  END IF;
END $$;

-- Add group_id column to user_picks if it doesn't exist
-- Backfill / migrate legacy user_picks schema (add columns if missing)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='user_picks' AND column_name='group_id') THEN
    ALTER TABLE user_picks ADD COLUMN group_id INTEGER REFERENCES groups(id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='user_picks' AND column_name='won') THEN
    ALTER TABLE user_picks ADD COLUMN won BOOLEAN NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='user_picks' AND column_name='points') THEN
    ALTER TABLE user_picks ADD COLUMN points INTEGER NULL;
  END IF;
  -- Relax NOT NULLs if old columns enforced
  BEGIN
    ALTER TABLE user_picks ALTER COLUMN picked_team_id DROP NOT NULL;
  EXCEPTION WHEN undefined_column THEN END; -- ignore if already nullable
  BEGIN
    ALTER TABLE user_picks ALTER COLUMN confidence_level DROP NOT NULL;
  EXCEPTION WHEN undefined_column THEN END;
END $$;


-- Add foreign key constraint for group_id in user_picks (if not exists)
DO $$ 
BEGIN 
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'fk_user_picks_group' 
        AND table_name = 'user_picks'
    ) THEN
        ALTER TABLE user_picks ADD CONSTRAINT fk_user_picks_group FOREIGN KEY (group_id) REFERENCES groups(id) ON DELETE CASCADE;
    END IF;
END $$;

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_users_google_id ON users(google_id);
CREATE INDEX IF NOT EXISTS idx_users_apple_id ON users(apple_id);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_user_sessions_user_id ON user_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_sessions_refresh_token ON user_sessions(refresh_token);
CREATE INDEX IF NOT EXISTS idx_user_picks_user_week ON user_picks(user_id, week, season, season_type);
CREATE INDEX IF NOT EXISTS idx_groups_identifier ON groups(identifier);
CREATE INDEX IF NOT EXISTS idx_groups_public ON groups(is_public);
CREATE INDEX IF NOT EXISTS idx_group_memberships_user ON group_memberships(user_id);
CREATE INDEX IF NOT EXISTS idx_group_memberships_group ON group_memberships(group_id);
CREATE INDEX IF NOT EXISTS idx_group_invitations_token ON group_invitations(token);
CREATE INDEX IF NOT EXISTS idx_group_messages_group ON group_messages(group_id);
CREATE INDEX IF NOT EXISTS idx_user_picks_group ON user_picks(group_id);

-- Add live fields to games table if they do not exist (for environments with older schema)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'games' AND column_name = 'period'
  ) THEN
    ALTER TABLE games ADD COLUMN period INTEGER NULL;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'games' AND column_name = 'display_clock'
  ) THEN
    ALTER TABLE games ADD COLUMN display_clock VARCHAR(20) NULL;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'games' AND column_name = 'status_detail'
  ) THEN
    ALTER TABLE games ADD COLUMN status_detail VARCHAR(80) NULL;
  END IF;
END $$;

-- Persisted match winner. ESPN's competitor.winner flag is the only signal of the
-- advancing side on a knockout PK shootout and was previously lost between fetches,
-- forcing every leaderboard read through the live ESPN API. Stored on refresh so
-- cached stage reads can score knockouts without a network call.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'games' AND column_name = 'winner_team_id'
  ) THEN
    ALTER TABLE games ADD COLUMN winner_team_id VARCHAR(50) NULL;
  END IF;
END $$;

-- Serves the cache-first stage reads in GameService.getWorldCupStage.
CREATE INDEX IF NOT EXISTS idx_games_league_stage ON games(league, stage);

-- Persisted goal/card timeline. ESPN exposes a per-match `competition.details`
-- array (each entry a goal/card with its minute, player, and side); we flatten it
-- to { type, minute, player, side, teamAbbr } and store it so the World Cup pick
-- card can render a match timeline from a cached read — no live ESPN call per view.
-- NULL means "not yet parsed" (a row cached before this column existed); [] means
-- "parsed, no events". GameService treats a started match still holding NULL as
-- stale so the next refresh backfills it.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'games' AND column_name = 'events'
  ) THEN
    ALTER TABLE games ADD COLUMN events JSONB NULL;
  END IF;
END $$;

-- Per-group cached World Cup leaderboard. payload is the full ranked board (JSONB);
-- source_version is the watermark it was computed against (see getLeaderboardVersion).
CREATE TABLE IF NOT EXISTS wc_leaderboard_cache (
  group_id INTEGER PRIMARY KEY REFERENCES groups(id) ON DELETE CASCADE,
  source_version TEXT NOT NULL,
  payload JSONB NOT NULL,
  computed_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Fix duplicate confidence constraint issue (remove incorrect constraint that lacks group_id)
DO $$
BEGIN
  -- Drop the incorrect constraint that was missing group_id in the unique key
  IF EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conrelid='user_picks'::regclass 
    AND conname='user_picks_user_id_week_season_season_type_confidence_level_key'
  ) THEN
    ALTER TABLE user_picks DROP CONSTRAINT user_picks_user_id_week_season_season_type_confidence_level_key;
    RAISE NOTICE 'Dropped incorrect confidence constraint that was missing group_id';
  END IF;
  
  -- Ensure the correct unique index exists (already defined above, but this is a safety check)
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes 
    WHERE tablename='user_picks' AND indexname='ux_user_picks_conf_per_week'
  ) THEN
    CREATE UNIQUE INDEX ux_user_picks_conf_per_week 
    ON user_picks(user_id, group_id, week, season, season_type, confidence_level) 
    WHERE confidence_level IS NOT NULL;
    RAISE NOTICE 'Created correct confidence unique index with group_id';
  END IF;
END $$;
-- Raise the group member ceiling from 40 to 500. The original cap was an inline
-- unnamed CHECK auto-named groups_max_members_check; existing databases still have
-- it, so drop it and install the named groups_max_members_range (<=500) constraint.
-- Fresh databases get groups_max_members_range directly from the CREATE TABLE above,
-- making this a no-op for them. Idempotent: safe to re-run.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'groups_max_members_check'
  ) THEN
    ALTER TABLE groups DROP CONSTRAINT groups_max_members_check;
    RAISE NOTICE 'Dropped legacy groups_max_members_check (<=40) constraint';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'groups_max_members_range'
  ) THEN
    ALTER TABLE groups ADD CONSTRAINT groups_max_members_range
      CHECK (max_members <= 500 AND max_members >= 2);
    RAISE NOTICE 'Added groups_max_members_range (<=500) constraint';
  END IF;
  -- Align the column default with the app default (50) on existing DBs. The inline
  -- DEFAULT above only applies to fresh CREATE TABLE; this catches legacy rows'
  -- table default. Idempotent.
  ALTER TABLE groups ALTER COLUMN max_members SET DEFAULT 50;
END $$;
