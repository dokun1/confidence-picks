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
      // Fetch fresh data from ESPN
      const espnGames = await ESPNService.fetchGames(year, seasonType, week);
      
      for (const espnGame of espnGames) {
        const espnId = espnGame.id;
        let cachedGame = await Game.findByESPNId(espnId);
        
        // Create new game from ESPN data
        const freshGame = Game.fromESPNData(espnGame);
        
        if (!cachedGame) {
          // No cached game, save the fresh one
          console.log(`Creating new game: ${espnId}`);
          await freshGame.save();
          games.push(freshGame);
        } else if (cachedGame.isStale() || forceRefresh) {
          // Cached game is stale, check if data has changed
          if (freshGame.isDifferentFrom(cachedGame)) {
            console.log(`Updating changed game: ${espnId}`);
            await freshGame.save();
            games.push(freshGame);
          } else {
            console.log(`No changes detected for game: ${espnId}, updating timestamp only`);
            cachedGame.lastUpdated = new Date();
            await cachedGame.save();
            games.push(cachedGame);
          }
        } else {
          // Use cached game
          console.log(`Using cached game: ${espnId}`);
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