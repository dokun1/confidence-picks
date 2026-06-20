import { Game } from '../models/Game.js';
import { ESPNService } from './ESPNService.js';
import { MockESPNService } from '../mocks/MockESPNService.js';

/**
 * Get the appropriate ESPN service (real or mock)
 */
function getESPNService() {
  const useMock = process.env.USE_MOCK_ESPN === 'true' || MockESPNService.isEnabled();
  
  if (useMock) {
    // Ensure mock service is configured
    if (!MockESPNService.mockGames) {
      console.log('[GameService] Auto-configuring MockESPNService');
      MockESPNService.configure();
    }
    console.log('[GameService] Using MockESPNService');
    return MockESPNService;
  }
  
  console.log('[GameService] Using real ESPNService');
  return ESPNService;
}

export class GameService {
  // Get game with caching logic
  static async getGame(espnId, forceRefresh = false) {
    let cachedGame = await Game.findByESPNId(espnId);
    
    // If no cached game exists, we need to fetch from ESPN
    if (!cachedGame) {
      console.log(`No cached game found for ESPN ID: ${espnId}`);
      // Note: ESPN API doesn't have individual game endpoints
      // You'd need to fetch all games for a week and find the one you want
      throw new Error('Game not found and ESPN API does not support individual game fetching');
    }

    // If game is not stale and we're not forcing refresh, return cached
    if (!cachedGame.isStale() && !forceRefresh) {
      console.log(`Returning cached game for ESPN ID: ${espnId}`);
      return cachedGame;
    }

    // Game is stale or we're forcing refresh
    console.log(`Refreshing stale game data for ESPN ID: ${espnId}`);
    // Since ESPN doesn't support individual game fetching, 
    // we'd need to implement a different strategy here
    // For now, return the cached game
    return cachedGame;
  }

  // Get games for a specific week with caching
  static async getGamesForWeek(year, seasonType, week, forceRefresh = false) {
    // Handle 2025 exception: store preseason week 4 games as regular season week 0
    let dbSeasonType = seasonType;
    let dbWeek = week;
    let espnSeasonType = seasonType;
    let espnWeek = week;
    
    if (year === 2025 && seasonType === 2 && week === 0) {
      // For 2025 week 0, we actually fetch preseason week 4 from ESPN
      // but store/query in database as regular season week 0
      espnSeasonType = 1;
      espnWeek = 4;
      console.log('[GameService] 2025 exception: fetching preseason week 4 as regular season week 0');
    }
    
    const games = [];
    try {
      // If not forcing refresh, load cached set first to decide refresh strategy
      if (!forceRefresh) {
        const cachedSet = await Game.findByWeekSeason(year, dbSeasonType, dbWeek);
        if (cachedSet.length > 0) {
          const now = Date.now();
          const anyInProgress = cachedSet.some(g => g.status === 'IN_PROGRESS');

          // Detect games that are scheduled but should have started (or will start imminently)
          const startWindowMs = 2 * 60 * 1000; // 2 minutes look‑ahead
          const needStartRefresh = cachedSet.some(g => {
            try {
              const gameTime = new Date(g.gameDate).getTime();
              const lastUpdated = g.lastUpdated ? new Date(g.lastUpdated).getTime() : 0;
              const recentlyUpdated = now - lastUpdated < 60 * 1000; // we refreshed within last minute
              return g.status === 'SCHEDULED' && gameTime - now <= startWindowMs && gameTime <= now + startWindowMs && !recentlyUpdated;
            } catch (e) { return false; }
          });

          if (anyInProgress) {
            const oldestUpdated = Math.min(...cachedSet.map(g => g.lastUpdated ? new Date(g.lastUpdated).getTime() : 0));
            const ageMs = now - oldestUpdated;
            if (ageMs < 60 * 1000 && !needStartRefresh) {
              console.log('Returning cached in-progress games (<60s old).');
              return cachedSet;
            } else {
              console.log('In-progress games cache older than 60s or start refresh needed -> refreshing from ESPN');
            }
          } else if (needStartRefresh) {
            console.log('Detected games at/after start time still marked SCHEDULED -> refreshing');
          } else {
            // No in-progress games; if none are stale (24h rule) return cached directly
            const anyStale = cachedSet.some(g => g.isStale());
            if (!anyStale) {
              console.log('All games are non in-progress and cache valid (no imminent starts) -> returning cached set.');
              return cachedSet;
            }
            console.log('Some games stale by 24h rule -> refreshing');
          }
        }
      }

      // Fetch fresh data from ESPN (forceRefresh or refresh needed)
      const service = getESPNService();
      const espnGames = await service.fetchGames(year, espnSeasonType, espnWeek);
      for (const espnGame of espnGames) {
        const espnId = espnGame.id;
        let cachedGame = await Game.findByESPNId(espnId);
        const freshGame = Game.fromESPNData(espnGame);
        
        // For 2025 exception, override the stored season/week values
        if (year === 2025 && espnSeasonType === 1 && espnWeek === 4 && dbSeasonType === 2 && dbWeek === 0) {
          freshGame.season = year;
          freshGame.seasonType = dbSeasonType;
          freshGame.week = dbWeek;
        }
        
        if (!cachedGame) {
          console.log(`Creating new game: ${espnId}`);
          await freshGame.save();
          games.push(freshGame);
          continue;
        }
        // Update if force, stale, or data changed (scores/status)
        if (forceRefresh || cachedGame.isStale() || freshGame.isDifferentFrom(cachedGame)) {
          console.log(`Saving refresh for game: ${espnId}`);
          await freshGame.save();
          games.push(freshGame);
        } else {
          // For in-progress ensure lastUpdated bump every refresh attempt if older than 60s
            if (freshGame.status === 'IN_PROGRESS') {
              const ageMs = Date.now() - new Date(cachedGame.lastUpdated).getTime();
              if (ageMs >= 60 * 1000) {
                cachedGame.lastUpdated = new Date();
                await cachedGame.save();
              }
            }
          games.push(cachedGame);
        }
      }
      return games;
    } catch (error) {
      console.error('Failed to fetch games for week:', error);
      throw error;
    }
  }

  // Knockout stage codes. In these rounds a match always advances one team:
  // the 90' score may be level, but penalties/extra time resolve a winner. The
  // group stage is the only World Cup phase where a 'draw' is a terminal result.
  static KNOCKOUT_STAGES = new Set(['r32', 'r16', 'qf', 'sf', 'third', 'final']);

  // Decide whether a persisted World Cup stage slate can be served without an
  // ESPN refresh. Mirrors getGamesForWeek's freshness rules: in-progress games
  // tolerate a cache up to 60s old, SCHEDULED games at/past their start time
  // (with a 2-minute look-ahead) force a refresh unless we refreshed within the
  // last minute, and otherwise the 24h isStale() rule applies.
  static isStageCacheFresh(cachedSet, now = Date.now()) {
    if (cachedSet.length === 0) return false;

    // One-time events backfill: a started match (IN_PROGRESS or FINAL) whose
    // events column is still NULL was cached before goal/card parsing existed.
    // Force a refresh so its timeline populates. Once persisted as [] or a real
    // array it reads as fresh, so this fires at most once per such row. Scheduled
    // matches legitimately have no events yet, so they never trigger it.
    //
    // Gated on the column actually existing: if the events column is missing the
    // refresh can never persist events, so the NULL never clears and this would
    // re-fetch every stage from ESPN on every request — turning the leaderboard
    // and picks page slow. When the column is absent we leave the cached slate
    // fresh and skip the backfill entirely.
    const needsEventsBackfill =
      Game.eventsColumnAvailable && cachedSet.some(g => g.status !== 'SCHEDULED' && g.events == null);
    if (needsEventsBackfill) return false;

    const startWindowMs = 2 * 60 * 1000;
    const needStartRefresh = cachedSet.some(g => {
      try {
        const gameTime = new Date(g.gameDate).getTime();
        const lastUpdated = g.lastUpdated ? new Date(g.lastUpdated).getTime() : 0;
        const recentlyUpdated = now - lastUpdated < 60 * 1000;
        return g.status === 'SCHEDULED' && gameTime <= now + startWindowMs && !recentlyUpdated;
      } catch (e) { return false; }
    });
    if (needStartRefresh) return false;

    const anyInProgress = cachedSet.some(g => g.status === 'IN_PROGRESS');
    if (anyInProgress) {
      const oldestUpdated = Math.min(...cachedSet.map(g => g.lastUpdated ? new Date(g.lastUpdated).getTime() : 0));
      return now - oldestUpdated < 60 * 1000;
    }

    return !cachedSet.some(g => g.isStale());
  }

  // Get World Cup matches for a tournament stage. Cache-first, mirroring
  // getGamesForWeek: a fresh persisted slate is served straight from the DB
  // (one query, no ESPN call) — this is what keeps the leaderboard fast, since
  // it sweeps all seven stages per request. Only a stale/live/imminent slate
  // routes through fetchSoccerWeek('fifa.world', stage), and that refresh path
  // batches the cache lookup (one query per slate, not per event) and persists
  // the resolved `winnerTeamId` so cached reads can score knockout PK shootouts
  // (ESPN's competitor.winner flag is otherwise only visible on the live event).
  static async getWorldCupStage(stage, forceRefresh = false) {
    try {
      if (!forceRefresh) {
        const cachedSet = await Game.findByLeagueStage('world_cup', stage);
        if (GameService.isStageCacheFresh(cachedSet)) {
          for (const g of cachedSet) {
            // Persisted winner wins; recompute from scores for rows written
            // before winner_team_id existed (regulation results only — a PK
            // shootout stays unresolved until the next live refresh).
            g.winnerTeamId = g.winnerTeamId ?? GameService.resolveWinnerTeamId(g, stage, null);
          }
          return cachedSet;
        }
      }

      const service = getESPNService();
      const espnEvents = await service.fetchSoccerWeek('fifa.world', stage);
      const cachedById = await Game.findByESPNIds(espnEvents.map(e => e.id));

      const games = [];
      for (const espnEvent of espnEvents) {
        const espnId = espnEvent.id;
        const cachedGame = cachedById.get(String(espnId));
        const freshGame = Game.fromESPNData(espnEvent, { league: 'world_cup', stage });
        const winnerHomeAway = GameService.winnerHomeAwayFromESPN(espnEvent);
        // Resolve BEFORE save so the winner persists with the row.
        freshGame.winnerTeamId = GameService.resolveWinnerTeamId(freshGame, stage, winnerHomeAway);

        if (!cachedGame) {
          await GameService.persistOrServeLive(freshGame);
          games.push(freshGame);
          continue;
        }

        const winnerChanged = freshGame.winnerTeamId !== (cachedGame.winnerTeamId ?? null);
        if (forceRefresh || cachedGame.isStale() || freshGame.isDifferentFrom(cachedGame) || winnerChanged) {
          const persisted = await GameService.persistOrServeLive(freshGame);
          // If the row couldn't be persisted (e.g. an un-migrated schema), the
          // fresh Game has no id. Borrow the cached row's id so the live data is
          // still joinable — an id-less game silently drops every pick that
          // references it from the leaderboard and the picks page.
          if (!persisted && freshGame.id == null) freshGame.id = cachedGame.id;
          games.push(freshGame);
        } else {
          games.push(cachedGame);
        }
      }
      return games;
    } catch (error) {
      console.error('Failed to fetch World Cup stage:', error);
      throw error;
    }
  }

  // The seven World Cup stages, in calendar order. Kept here next to the fetch
  // so the single-request "all stages" endpoint and any future sweep share one
  // source of truth.
  static WORLD_CUP_STAGE_ORDER = ['group', 'r32', 'r16', 'qf', 'sf', 'third', 'final'];

  // One-shot fetch of every stage, flattened in calendar order. Lets the client
  // pull the whole tournament slate in a SINGLE round-trip instead of fanning out
  // to seven /stage/:stage requests on every Picks-tab mount. Each stage still
  // routes through getWorldCupStage, so the per-stage DB cache + live-refresh
  // rules are unchanged; this only collapses the fan-out to the network edge.
  static async getAllWorldCupStages(forceRefresh = false) {
    const perStage = await Promise.all(
      GameService.WORLD_CUP_STAGE_ORDER.map((stage) =>
        GameService.getWorldCupStage(stage, forceRefresh),
      ),
    );
    return perStage.flat();
  }

  // Read the homeAway side ESPN flags as the result. ESPN sets
  // competitors[].winner === true on the advancing team — notably on PK
  // shootouts, where the 90' scoreline is level and is the only signal of who
  // went through. Returns 'home' | 'away' | null.
  static winnerHomeAwayFromESPN(espnEvent) {
    const competitors = espnEvent?.competitions?.[0]?.competitors || [];
    const flagged = competitors.find(c => c.winner === true);
    return flagged ? flagged.homeAway : null;
  }

  // Persist a freshly-fetched stage game, but never let a write failure take down
  // a live read. The returned slate is built from these in-memory Game objects
  // (already carrying the live ESPN scores + resolved winnerTeamId), so on a
  // persistence error we log and serve the live data rather than throwing — a 500
  // here would blank the stage list and the leaderboard mid-match. The canonical
  // example is a schema drift (e.g. a missing games column): scores still surface
  // live every refresh; they just aren't cached until the DB is repaired.
  //
  // Returns true when the row was persisted (so it carries a real id), false when
  // it was served live-but-uncached — the caller uses that to keep the slate
  // joinable by falling back to a cached id.
  static async persistOrServeLive(game) {
    try {
      await game.save();
      return true;
    } catch (error) {
      console.error(`[getWorldCupStage] persist failed for espnId=${game.espnId}; serving live ESPN data uncached: ${error.message}`);
      return false;
    }
  }

  // Resolve the winning team's id for a World Cup match, or null when there is
  // no single winner. ESPN `status` is the completion truth source: a match
  // only counts once status.type.completed is true (normalized to 'FINAL').
  //
  // Group stage: the higher-scoring side wins; a level score is a draw (null).
  // Knockout stages: a team always advances even at a level 90' scoreline —
  // prefer the ESPN-flagged winner side (PK shootouts), falling back to the
  // higher regulation score. A 'draw' is never a valid knockout result.
  //
  // @param {Game} game - the match (reads status/completed, team ids, scores)
  // @param {string} [stage=game.stage] - tournament stage code
  // @param {('home'|'away'|null)} [winnerHomeAway=null] - ESPN's flagged side
  // @returns {string|null} the winning team's id, or null when undecided
  static resolveWinnerTeamId(game, stage = game.stage, winnerHomeAway = null) {
    const isFinal = game.completed === true || game.status === 'FINAL';
    if (!isFinal) return null;

    const homeId = game.homeTeam?.id ?? null;
    const awayId = game.awayTeam?.id ?? null;

    if (GameService.KNOCKOUT_STAGES.has(stage)) {
      if (winnerHomeAway === 'home') return homeId;
      if (winnerHomeAway === 'away') return awayId;
      if (game.homeScore > game.awayScore) return homeId;
      if (game.awayScore > game.homeScore) return awayId;
      // Level with no flagged advancer: unresolved. Never a draw for knockouts.
      return null;
    }

    // Group stage: higher score wins, level is a draw with no single winner.
    if (game.homeScore > game.awayScore) return homeId;
    if (game.awayScore > game.homeScore) return awayId;
    return null;
  }
}