/**
 * Mock Games Configuration
 * 
 * This file provides easy configuration for the mock ESPN game data.
 * Use this to set up a custom week of games for testing during the offseason.
 * 
 * To enable mock games:
 * 1. Set USE_MOCK_ESPN=true in your .env file
 * 2. Optionally customize the settings below
 * 3. Start your server - it will use mock data instead of the real ESPN API
 */

/**
 * Default mock configuration
 * All times are relative to the baseDate (default: current date/time)
 */
export const DEFAULT_MOCK_CONFIG = {
  // Base date for scheduling games - all game times are calculated from this
  // Default: current date/time
  // Example: new Date('2024-09-08T12:00:00Z') for a specific date
  baseDate: new Date(),

  // Season year (e.g., 2024, 2025)
  season: new Date().getFullYear(),

  // Season type: 1 = Preseason, 2 = Regular Season, 3 = Postseason
  seasonType: 2,

  // Week number (1-18 for regular season)
  week: 1
};

/**
 * Game schedule configuration
 * Define when games should be scheduled relative to baseDate
 * Negative values = past, positive values = future
 */
export const GAME_SCHEDULE = {
  // Game states and their timing (in minutes from baseDate)
  scheduled: {
    // Thursday Night Football - 2 days in future
    thursdayNight: 2 * 24 * 60,
  },
  
  inProgress: {
    // Various stages of in-progress games
    earlyQ1: -15,      // Just started (Q1, 15 min ago)
    midQ2: -45,        // Second quarter (45 min ago)
    halftime: -70,     // At halftime (70 min ago)
    midQ3: -90,        // Third quarter (90 min ago)
    lateQ4: -150,      // Close game in Q4 (2.5 hours ago)
  },
  
  final: {
    // Completed games
    recentlyCompleted: -4 * 60,   // Completed 4 hours ago
    earlierToday: -5 * 60,        // Completed 5 hours ago
    overtime: -6 * 60,            // OT game completed 6 hours ago
  },
  
  postponed: {
    // Game that was postponed
    yesterday: -24 * 60,          // Was scheduled yesterday
  }
};

/**
 * Score progression settings
 * Control how scores update during in-progress games
 */
export const SCORE_PROGRESSION_CONFIG = {
  // Update interval (how often scores change) in seconds
  updateInterval: 60, // Update every minute
  
  // Whether to randomize score changes slightly
  randomizeScores: false,
  
  // Maximum score variance per update (if randomization enabled)
  maxScoreVariance: 3
};

/**
 * Environment-specific overrides
 * Use these to customize behavior for different environments
 */
export const ENVIRONMENT_CONFIGS = {
  development: {
    ...DEFAULT_MOCK_CONFIG,
    // In dev, you might want games starting now for immediate testing
    baseDate: new Date(),
  },
  
  test: {
    ...DEFAULT_MOCK_CONFIG,
    // In tests, use a fixed date for reproducibility
    baseDate: new Date('2024-09-08T12:00:00Z'),
    season: 2024,
    week: 1,
  },
  
  staging: {
    ...DEFAULT_MOCK_CONFIG,
    // In staging, you might want to test a specific week
    season: 2024,
    week: 5,
  }
};

/**
 * Get configuration for current environment
 * @returns {Object} Mock configuration
 */
export function getMockConfig() {
  const env = process.env.NODE_ENV || 'development';
  const config = ENVIRONMENT_CONFIGS[env] || DEFAULT_MOCK_CONFIG;
  
  // Allow environment variable overrides
  if (process.env.MOCK_SEASON) {
    config.season = parseInt(process.env.MOCK_SEASON);
  }
  if (process.env.MOCK_WEEK) {
    config.week = parseInt(process.env.MOCK_WEEK);
  }
  if (process.env.MOCK_SEASON_TYPE) {
    config.seasonType = parseInt(process.env.MOCK_SEASON_TYPE);
  }
  
  return config;
}

/**
 * Validate mock configuration
 * @param {Object} config - Configuration to validate
 * @returns {Object} Validation result { valid: boolean, errors: string[] }
 */
export function validateMockConfig(config) {
  const errors = [];
  
  if (!config.baseDate || !(config.baseDate instanceof Date)) {
    errors.push('baseDate must be a valid Date object');
  }
  
  if (!config.season || config.season < 2000 || config.season > 2100) {
    errors.push('season must be a valid year between 2000 and 2100');
  }
  
  if (![1, 2, 3].includes(config.seasonType)) {
    errors.push('seasonType must be 1 (preseason), 2 (regular), or 3 (postseason)');
  }
  
  if (!config.week || config.week < 0 || config.week > 22) {
    errors.push('week must be between 0 and 22');
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Custom game configurations for specific test scenarios
 */
export const CUSTOM_SCENARIOS = {
  // All games scheduled in the future
  allUpcoming: {
    ...DEFAULT_MOCK_CONFIG,
    // Adjust baseDate to be 3 days before all games
    get baseDate() {
      const date = new Date();
      date.setDate(date.getDate() - 3);
      return date;
    }
  },
  
  // All games completed
  allCompleted: {
    ...DEFAULT_MOCK_CONFIG,
    // Adjust baseDate to be 1 week after all games
    get baseDate() {
      const date = new Date();
      date.setDate(date.getDate() + 7);
      return date;
    }
  },
  
  // Mix of games at different times (default)
  mixed: DEFAULT_MOCK_CONFIG,
  
  // All games in progress (useful for testing live updates)
  allLive: {
    ...DEFAULT_MOCK_CONFIG,
    // Adjust baseDate so all games are currently in progress
    get baseDate() {
      const date = new Date();
      date.setHours(date.getHours() - 1);
      return date;
    }
  }
};

/**
 * Get configuration for a specific scenario
 * @param {string} scenarioName - Name of the scenario
 * @returns {Object} Scenario configuration
 */
export function getScenarioConfig(scenarioName) {
  const scenario = CUSTOM_SCENARIOS[scenarioName];
  if (!scenario) {
    throw new Error(`Unknown scenario: ${scenarioName}. Available: ${Object.keys(CUSTOM_SCENARIOS).join(', ')}`);
  }
  return scenario;
}
