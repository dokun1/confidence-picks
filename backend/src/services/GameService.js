import { Game } from '../models/Game.js';
import { ESPNService } from './ESPNService.js';

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
    const games = [];
    try {
      // If not forcing refresh, load cached set first to decide refresh strategy
      if (!forceRefresh) {
        const cachedSet = await Game.findByWeekSeason(year, seasonType, week);
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
      const espnGames = await ESPNService.fetchGames(year, seasonType, week);
      for (const espnGame of espnGames) {
        const espnId = espnGame.id;
        let cachedGame = await Game.findByESPNId(espnId);
        const freshGame = Game.fromESPNData(espnGame);
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
}