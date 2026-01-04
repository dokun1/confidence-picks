import { generateMockWeek, getProgressiveScore } from './espnGameData.js';

/**
 * MockESPNService - A drop-in replacement for ESPNService that returns mock data
 * 
 * This service simulates the ESPN API with configurable mock games that:
 * - Can be scheduled at specific times relative to "now"
 * - Progress through game states (scheduled -> in progress -> final)
 * - Update scores dynamically based on elapsed time
 * - Support all game states: scheduled, in-progress, halftime, final, OT, postponed
 * 
 * Usage:
 *   1. Configure mock games with MockESPNService.configure()
 *   2. Set USE_MOCK_ESPN=true in environment
 *   3. Games will progress in real-time based on their scheduled start times
 */
export class MockESPNService {
  static mockGames = null;
  static mockConfig = null;
  static enabled = false;

  /**
   * Configure the mock service with custom settings
   * @param {Object} config - Configuration object
   * @param {Date} config.baseDate - Base date for scheduling games (default: now)
   * @param {number} config.season - Season year (default: current year)
   * @param {number} config.seasonType - Season type (1=preseason, 2=regular, 3=postseason)
   * @param {number} config.week - Week number
   */
  static configure(config = {}) {
    this.mockConfig = {
      baseDate: config.baseDate || new Date(),
      season: config.season || new Date().getFullYear(),
      seasonType: config.seasonType || 2,
      week: config.week || 1
    };
    this.mockGames = generateMockWeek(this.mockConfig);
    this.enabled = true;
    console.log('[MockESPNService] Configured with:', this.mockConfig);
    console.log('[MockESPNService] Generated', this.mockGames.length, 'mock games');
  }

  /**
   * Enable or disable mock service
   * @param {boolean} enabled - Whether to use mock data
   */
  static setEnabled(enabled) {
    this.enabled = enabled;
    console.log('[MockESPNService] Mock service', enabled ? 'enabled' : 'disabled');
  }

  /**
   * Check if mock service is enabled
   * @returns {boolean}
   */
  static isEnabled() {
    return this.enabled;
  }

  /**
   * Fetch mock games for a specific week
   * Mimics ESPNService.fetchGames() interface
   * 
   * @param {number} year - Season year
   * @param {number} seasonType - Season type (1=preseason, 2=regular, 3=postseason)
   * @param {number} week - Week number
   * @returns {Promise<Array>} Array of game events in ESPN format
   */
  static async fetchGames(year, seasonType, week) {
    if (!this.enabled) {
      throw new Error('MockESPNService is not enabled. Call configure() first or set USE_MOCK_ESPN=true');
    }

    // Initialize mock games if not already done
    if (!this.mockGames) {
      this.configure({ season: year, seasonType, week });
    }

    // Verify requested week matches configured week
    if (this.mockConfig && 
        (year !== this.mockConfig.season || 
         seasonType !== this.mockConfig.seasonType || 
         week !== this.mockConfig.week)) {
      console.warn('[MockESPNService] Requested week does not match configured week. Returning empty array.');
      console.warn('[MockESPNService] Requested:', { year, seasonType, week });
      console.warn('[MockESPNService] Configured:', this.mockConfig);
      return [];
    }

    // Clone games and update with progressive scores based on current time
    const now = new Date();
    const updatedGames = this.mockGames.map(game => {
      const gameDate = new Date(game.date);
      const elapsedMinutes = Math.floor((now - gameDate) / (60 * 1000));
      
      // Only update in-progress games
      if (elapsedMinutes > 0 && elapsedMinutes < 180) { // Game lasts ~3 hours
        return getProgressiveScore(game, elapsedMinutes);
      }
      
      return game;
    });

    console.log('[MockESPNService] Returning', updatedGames.length, 'games for', year, 'week', week);
    return updatedGames;
  }

  /**
   * Fetch a single game by ID (not supported by real ESPN API)
   * This is a convenience method for testing
   * 
   * @param {string} gameId - ESPN game ID
   * @returns {Promise<Object|null>} Game event in ESPN format or null
   */
  static async fetchGameById(gameId) {
    if (!this.enabled || !this.mockGames) {
      throw new Error('MockESPNService is not enabled or configured');
    }

    const game = this.mockGames.find(g => g.id === gameId);
    if (!game) {
      return null;
    }

    // Update with progressive score
    const now = new Date();
    const gameDate = new Date(game.date);
    const elapsedMinutes = Math.floor((now - gameDate) / (60 * 1000));
    
    if (elapsedMinutes > 0 && elapsedMinutes < 180) {
      return getProgressiveScore(game, elapsedMinutes);
    }
    
    return game;
  }

  /**
   * Reset mock service to initial state
   */
  static reset() {
    this.mockGames = null;
    this.mockConfig = null;
    this.enabled = false;
    console.log('[MockESPNService] Reset to initial state');
  }

  /**
   * Get current mock configuration
   * @returns {Object|null} Current configuration or null
   */
  static getConfig() {
    return this.mockConfig;
  }

  /**
   * Get all mock games (for testing/debugging)
   * @returns {Array|null} Array of mock games or null
   */
  static getMockGames() {
    return this.mockGames;
  }

  /**
   * Manually set mock games (for advanced testing scenarios)
   * @param {Array} games - Array of ESPN-formatted game objects
   */
  static setMockGames(games) {
    this.mockGames = games;
    console.log('[MockESPNService] Set', games.length, 'custom mock games');
  }

  /**
   * Update a specific game's state (for testing game progression)
   * @param {string} gameId - ESPN game ID
   * @param {Object} updates - Partial game object with updates
   */
  static updateGame(gameId, updates) {
    if (!this.mockGames) {
      throw new Error('No mock games configured');
    }

    const index = this.mockGames.findIndex(g => g.id === gameId);
    if (index === -1) {
      throw new Error(`Game ${gameId} not found`);
    }

    // Deep merge updates
    this.mockGames[index] = {
      ...this.mockGames[index],
      ...updates,
      competitions: [{
        ...this.mockGames[index].competitions[0],
        ...(updates.competitions && updates.competitions[0])
      }]
    };

    console.log('[MockESPNService] Updated game', gameId);
  }
}

/**
 * Helper to get the appropriate ESPN service based on configuration
 * @returns {ESPNService|MockESPNService} The service to use
 */
export function getESPNService() {
  const useMock = process.env.USE_MOCK_ESPN === 'true' || MockESPNService.isEnabled();
  
  if (useMock) {
    // Ensure mock service is configured
    if (!MockESPNService.mockGames) {
      MockESPNService.configure();
    }
    return MockESPNService;
  }
  
  // Return real service (imported dynamically to avoid circular deps)
  const { ESPNService } = require('../services/ESPNService.js');
  return ESPNService;
}
