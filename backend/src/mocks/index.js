/**
 * Mock ESPN Data Module
 * 
 * This module provides mock ESPN API data for testing during the offseason.
 * It includes realistic game data for all possible game states.
 * 
 * @module mocks
 */

import { MockESPNService } from './MockESPNService.js';
import { 
  NFL_TEAMS, 
  generateMockWeek, 
  getProgressiveScore 
} from './espnGameData.js';
import { 
  DEFAULT_MOCK_CONFIG,
  GAME_SCHEDULE,
  SCORE_PROGRESSION_CONFIG,
  ENVIRONMENT_CONFIGS,
  CUSTOM_SCENARIOS,
  getMockConfig,
  validateMockConfig,
  getScenarioConfig
} from './mockConfig.js';

export { 
  MockESPNService,
  NFL_TEAMS, 
  generateMockWeek, 
  getProgressiveScore,
  DEFAULT_MOCK_CONFIG,
  GAME_SCHEDULE,
  SCORE_PROGRESSION_CONFIG,
  ENVIRONMENT_CONFIGS,
  CUSTOM_SCENARIOS,
  getMockConfig,
  validateMockConfig,
  getScenarioConfig
};

/**
 * Quick setup function to enable mock data
 * 
 * @param {Object} options - Configuration options
 * @param {string} options.scenario - Preset scenario name (allUpcoming, allCompleted, mixed, allLive)
 * @param {Object} options.config - Custom configuration object
 * @returns {Object} Configured MockESPNService
 * 
 * @example
 * // Enable mock data with default settings
 * import { enableMockData } from './mocks/index.js';
 * enableMockData();
 * 
 * @example
 * // Enable with a preset scenario
 * enableMockData({ scenario: 'allLive' });
 * 
 * @example
 * // Enable with custom config
 * enableMockData({ 
 *   config: { 
 *     season: 2024, 
 *     week: 5,
 *     baseDate: new Date('2024-10-01T12:00:00Z')
 *   } 
 * });
 */
export function enableMockData(options = {}) {
  let config;
  
  if (options.scenario) {
    // Use preset scenario
    config = getScenarioConfig(options.scenario);
  } else if (options.config) {
    // Use custom config
    config = options.config;
  } else {
    // Use default config
    config = getMockConfig();
  }
  
  MockESPNService.configure(config);
  return MockESPNService;
}

/**
 * Disable mock data and revert to real ESPN API
 */
export function disableMockData() {
  MockESPNService.setEnabled(false);
}
