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
    // League/stage carry soccer awareness. NFL games leave these null/undefined.
    this.league = data.league;
    this.stage = data.stage;
    // Resolved match winner (soccer knockouts). Persisted because ESPN's
    // competitor.winner flag — the only signal on a PK shootout — is not
    // recoverable from a cached row's scores alone.
    this.winnerTeamId = data.winnerTeamId ?? null;
    // Goal/card timeline (soccer). An array of { type, minute, player, side,
    // teamAbbr } parsed from ESPN's competition.details. `null` is meaningful:
    // it marks a row cached before the events column existed (never parsed), which
    // GameService uses to force a one-time backfill. An ESPN-sourced Game always
    // carries a concrete array ([] when the match has no goals/cards yet).
    this.events = data.events ?? null;
    this.lastUpdated = data.lastUpdated;
    this.createdAt = data.createdAt;
  }

  // Create a Game from ESPN API data
// Create a Game from ESPN API data
static fromESPNData(espnGame, opts = {}) {
  // Soccer callers pass { league, stage } (e.g. league 'world_cup', stage from the
  // stage key). NFL callers pass nothing — default league to 'nfl' so the INSERT
  // stamps the column instead of bypassing the games.league NOT NULL DEFAULT 'nfl'
  // with an explicit NULL (which is what landed pre-fix and 500'd every NFL save).
  const { league = 'nfl', stage = null } = opts;

  const competition = espnGame.competitions[0];
  const competitors = competition.competitors;
  
  const homeTeam = competitors.find(c => c.homeAway === 'home');
  const awayTeam = competitors.find(c => c.homeAway === 'away');

  // Goal/card timeline. Always an array (possibly empty) for an ESPN-sourced game.
  const events = Game.parseMatchEvents(competition, homeTeam, awayTeam);

  const weekData = competition.week || espnGame.week || {};
  let week = weekData.number || 1;

    // Fix the season parsing - it's available in the competition
  const season = competition.season || espnGame.season || {};
  const seasonYear = season.year || getCurrentNFLSeason();
  let seasonType = season.type || 2;

  // Map ONLY the final preseason week to regular season week 0 for picks/testing.
  // NFL-only: soccer events carry season.type 1 too, so gate explicitly on the NFL
  // league tag (the prior `!league` check relied on the default being null, which
  // also made every NFL INSERT 500 — fixed by defaulting league to 'nfl' above).
  try {
    const PRE_FINAL = parseInt(process.env.PRESEASON_FINAL_WEEK || '4', 10); // default 4
    if (league === 'nfl' && seasonType === 1 && week === PRE_FINAL) {
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

  // Odds extraction. WC knockout fixtures with TBD matchups (R32 onwards
  // before group stage concludes) sometimes have `competition.odds = [null]`
  // — length>0 but the entry itself is null. Guarding it here so the whole
  // upsert path doesn't throw on those rows.
  let oddsObj = null;
  if (competition.odds && competition.odds.length > 0 && competition.odds[0]) {
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
    const ml = o.moneyline;
    // 3-way outcome moneylines; null once the game starts (ESPN nulls them)
    const threeWay = ml ? {
      home: ml.home?.close?.odds ?? null,
      draw: ml.draw?.close?.odds ?? null,
      away: ml.away?.close?.odds ?? null,
    } : null;
    oddsObj = {
      favoriteTeamId,
      favoriteAbbr,
      spread: o.spread,
      overUnder: o.overUnder,
      details: o.details,
      provider: o.provider ? o.provider.name : undefined,
      threeWay,
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
  altColor: homeTeam.team.alternateColor,
  record: homeTeam.records?.find(r => r.type === 'total')?.summary ?? null,
  form: homeTeam.form ?? null,
    },
    awayTeam: {
  id: awayTeam.id,
  name: awayTeam.team.displayName,
  abbreviation: awayTeam.team.abbreviation,
  logo: awayTeam.team.logo,
  color: awayTeam.team.color,
  altColor: awayTeam.team.alternateColor,
  record: awayTeam.records?.find(r => r.type === 'total')?.summary ?? null,
  form: awayTeam.form ?? null,
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
    league,
    stage,
    events,
    lastUpdated: new Date()
  });
}

// Flatten ESPN's `competition.details` into the timeline shape the World Cup pick
// card renders: { type, minute, player, side, teamAbbr }. ESPN lists every match
// detail — goals, cards, substitutions, VAR reviews — each tagged with the minute
// (clock.displayValue), the involved athlete, and the team. We keep only goals and
// bookings and resolve the team to a home/away side. A penalty goal carries
// scoringPlay; an own goal is flagged separately so the UI can mark it. Returns []
// when ESPN provides no details (a scheduled match, or a kickoff with nothing yet).
static parseMatchEvents(competition, homeComp, awayComp) {
  const details = competition && competition.details;
  if (!Array.isArray(details) || details.length === 0) return [];

  const homeId = homeComp && homeComp.id != null ? String(homeComp.id) : null;
  const awayId = awayComp && awayComp.id != null ? String(awayComp.id) : null;

  const sideFor = (teamId) => {
    const id = teamId != null ? String(teamId) : null;
    if (id && id === homeId) return { side: 'home', teamAbbr: homeComp.team?.abbreviation ?? null };
    if (id && id === awayId) return { side: 'away', teamAbbr: awayComp.team?.abbreviation ?? null };
    return null;
  };

  const classify = (d) => {
    if (d?.ownGoal === true) return 'own-goal';
    if (d?.scoringPlay === true || (d?.type?.text || '').toLowerCase().includes('goal')) return 'goal';
    if (d?.redCard === true) return 'red-card';
    if (d?.yellowCard === true) return 'yellow-card';
    return null; // substitution, VAR, etc. — not shown on the timeline
  };

  const events = [];
  for (const d of details) {
    const type = classify(d);
    if (!type) continue;
    const where = sideFor(d?.team?.id);
    if (!where) continue;
    const minute = d?.clock?.displayValue ?? null;
    const player = d?.athletesInvolved?.[0]?.displayName ?? null;
    if (!minute || !player) continue; // a malformed detail is dropped, not rendered blank
    events.push({ type, minute, player, side: where.side, teamAbbr: where.teamAbbr });
  }
  return events;
}

  // Check if this game data is different from another game
  isDifferentFrom(otherGame) {
    // Event-count fingerprint. Match feeds are append-only, so a new goal/card
    // grows the count. `null` (never-parsed cached row) maps to -1 so a first
    // parse — even to an empty [] — reads as a change and gets persisted, which
    // is what backfills the events column for pre-existing rows.
    const eventCount = (g) => (Array.isArray(g.events) ? g.events.length : -1);
    return (
      this.gameDate.getTime() !== otherGame.gameDate.getTime() ||
  this.status !== otherGame.status ||
      this.homeScore !== otherGame.homeScore ||
  this.awayScore !== otherGame.awayScore ||
  this.period !== otherGame.period ||
  this.displayClock !== otherGame.displayClock ||
  this.statusDetail !== otherGame.statusDetail ||
  eventCount(this) !== eventCount(otherGame)
    );
  }

  // Check if data is stale (older than 24 hours)
  isStale() {
    if (!this.lastUpdated) return true;
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    return new Date(this.lastUpdated) < twentyFourHoursAgo;
  }

// Whether the live database has the games.events column. It ships with the
// match-timeline feature and is added by the INIT_DB schema sync — which on
// production runs only when explicitly enabled, so a deploy can be live for a
// while before the column exists. A save() that blindly writes a missing column
// throws, returns no row, and leaves the Game without an id; an id-less Game then
// silently breaks the pick↔game join the leaderboard and picks page rely on
// (every pick referencing that game scores nothing and renders unselected). So we
// detect the column's absence once and stop emitting it until the process
// restarts against a migrated schema. See [[worldcup-backend-gaps]].
static eventsColumnAvailable = true;

// Postgres "undefined_column" (42703), scoped to the events column so a genuinely
// malformed query still surfaces instead of being silently swallowed + retried.
static isMissingEventsColumnError(err) {
  return !!err && err.code === '42703' && /\bevents\b/i.test(err.message || '');
}

// Save to database. Resilient to an un-migrated schema: if the events column is
// absent we persist every other field anyway (the id, scores, status, and winner
// MUST land) and drop only the timeline.
async save() {
  try {
    return await this.upsert(Game.eventsColumnAvailable);
  } catch (err) {
    if (Game.eventsColumnAvailable && Game.isMissingEventsColumnError(err)) {
      Game.eventsColumnAvailable = false;
      console.warn(
        '[Game.save] games.events column is missing — persisting without it. ' +
        'Run the INIT_DB schema sync to enable the match timeline.'
      );
      return await this.upsert(false);
    }
    throw err;
  }
}

// Build and run the upsert. `includeEvents` toggles the one column that may not
// exist yet; every other column is always written. ON CONFLICT updates every
// column except the espn_id conflict key (EXCLUDED.* = the values we just tried
// to insert), so adding/removing the trailing events column needs no re-numbering.
async upsert(includeEvents) {
  const columns = [
    'espn_id', 'home_team', 'away_team', 'game_date', 'status',
    'period', 'display_clock', 'status_detail',
    'home_score', 'away_score', 'week', 'season', 'season_type',
    'odds', 'probability', 'last_updated', 'league', 'stage', 'winner_team_id',
  ];
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
    this.lastUpdated,
    this.league || null,
    this.stage || null,
    this.winnerTeamId || null,
  ];
  if (includeEvents) {
    columns.push('events');
    // Persist [] (not NULL) once parsed, so a genuinely eventless match reads as
    // "parsed, none" rather than re-triggering the backfill refresh every request.
    values.push(JSON.stringify(this.events ?? []));
  }

  const placeholders = columns.map((_, i) => `$${i + 1}`).join(', ');
  const updates = columns.slice(1).map((c) => `${c} = EXCLUDED.${c}`).join(', ');
  const query = `
    INSERT INTO games (${columns.join(', ')})
    VALUES (${placeholders})
    ON CONFLICT (espn_id) DO UPDATE SET ${updates}
    RETURNING *
  `;

  const result = await pool.query(query, values);
  this.id = result.rows[0].id;
  return this;
}

// Build a Game from a raw games-table row, shared by every finder so they all
// parse JSONB columns and carry winner_team_id identically.
static fromDbRow(row) {
  return new Game({
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
    league: row.league,
    stage: row.stage,
    winnerTeamId: row.winner_team_id ?? null,
    // Preserve NULL as null (never-parsed) vs [] (parsed, empty) — the distinction
    // drives the one-time events backfill in GameService.isStageCacheFresh.
    events: row.events == null ? null : (typeof row.events === 'string' ? JSON.parse(row.events) : row.events),
    lastUpdated: new Date(row.last_updated),
    createdAt: new Date(row.created_at)
  });
}

// Find game by ESPN ID
static async findByESPNId(espnId) {
  const query = 'SELECT * FROM games WHERE espn_id = $1';
  const result = await pool.query(query, [espnId]);

  if (result.rows.length === 0) return null;

  return Game.fromDbRow(result.rows[0]);
}

// Batch variant of findByESPNId: one query for a whole slate of ESPN ids.
// Returns a Map keyed by espn_id (string). Replaces the per-event lookup loop
// in the World Cup refresh path, which issued one query per match.
static async findByESPNIds(espnIds) {
  const byId = new Map();
  if (!Array.isArray(espnIds) || espnIds.length === 0) return byId;
  const query = 'SELECT * FROM games WHERE espn_id = ANY($1::varchar[])';
  const result = await pool.query(query, [espnIds.map(String)]);
  for (const row of result.rows) {
    byId.set(String(row.espn_id), Game.fromDbRow(row));
  }
  return byId;
}

// Find all games for a given week/season/seasonType
static async findByWeekSeason(season, seasonType, week) {
  const query = `SELECT * FROM games WHERE season = $1 AND season_type = $2 AND week = $3`;
  const result = await pool.query(query, [season, seasonType, week]);
  return result.rows.map(row => Game.fromDbRow(row));
}

// Find the persisted slate for a tournament stage (cache-first stage reads).
static async findByLeagueStage(league, stage) {
  const query = `SELECT * FROM games WHERE league = $1 AND stage = $2 ORDER BY game_date ASC, id ASC`;
  const result = await pool.query(query, [league, stage]);
  return result.rows.map(row => Game.fromDbRow(row));
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
      league: this.league,
      stage: this.stage,
      winnerTeamId: this.winnerTeamId ?? null,
      // The client always wants a concrete array; a never-parsed null collapses to [].
      events: this.events ?? [],
      lastUpdated: this.lastUpdated,
      createdAt: this.createdAt
    };
  }
}