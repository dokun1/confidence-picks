#!/usr/bin/env node

/**
 * Example script demonstrating how to use the Mock ESPN API system
 * 
 * This script shows various ways to configure and use mock game data
 * for testing during the offseason.
 * 
 * Run with: node examples/useMockData.js
 */

import { MockESPNService } from '../src/mocks/MockESPNService.js';
import { enableMockData, getMockConfig, getScenarioConfig } from '../src/mocks/index.js';

console.log('🏈 Mock ESPN API Data - Usage Examples\n');

// ============================================================================
// Example 1: Basic Usage - Enable with defaults
// ============================================================================
console.log('📋 Example 1: Basic Usage\n');

// Enable mock data with default configuration
const mockService = enableMockData();

// Fetch games like you normally would
const games = await MockESPNService.fetchGames(
  new Date().getFullYear(),
  2, // Regular season
  1  // Week 1
);

console.log(`Found ${games.length} mock games\n`);

// Display game information
games.forEach((game, index) => {
  const competition = game.competitions[0];
  const homeTeam = competition.competitors.find(c => c.homeAway === 'home');
  const awayTeam = competition.competitors.find(c => c.homeAway === 'away');
  const status = competition.status.type;
  
  console.log(`${index + 1}. ${awayTeam.team.abbreviation} @ ${homeTeam.team.abbreviation}`);
  console.log(`   Status: ${status.description} (${status.detail})`);
  console.log(`   Score: ${awayTeam.score}-${homeTeam.score}`);
  console.log(`   Game ID: ${game.id}\n`);
});

// ============================================================================
// Example 2: Using Preset Scenarios
// ============================================================================
console.log('\n📋 Example 2: Using Preset Scenarios\n');

// Reset and configure with "all live" scenario
MockESPNService.reset();
enableMockData({ scenario: 'allLive' });

const liveGames = await MockESPNService.fetchGames(
  new Date().getFullYear(),
  2,
  1
);

console.log(`All Live Scenario: ${liveGames.length} games\n`);

const inProgressCount = liveGames.filter(
  g => g.competitions[0].status.type.state === 'in'
).length;

console.log(`In-progress games: ${inProgressCount}\n`);

// ============================================================================
// Example 3: Custom Configuration
// ============================================================================
console.log('\n📋 Example 3: Custom Configuration\n');

MockESPNService.reset();
MockESPNService.configure({
  baseDate: new Date('2024-09-15T18:00:00Z'),
  season: 2024,
  seasonType: 2,
  week: 2
});

const customGames = await MockESPNService.fetchGames(2024, 2, 2);
console.log(`Custom Week 2 Games: ${customGames.length}\n`);

// ============================================================================
// Example 4: Testing Different Game States
// ============================================================================
console.log('\n📋 Example 4: Testing Different Game States\n');

MockESPNService.reset();
MockESPNService.configure({
  baseDate: new Date(),
  season: 2024,
  seasonType: 2,
  week: 1
});

const testGames = await MockESPNService.fetchGames(2024, 2, 1);

// Categorize games by state
const scheduled = testGames.filter(g => g.competitions[0].status.type.state === 'pre');
const inProgress = testGames.filter(g => g.competitions[0].status.type.state === 'in');
const completed = testGames.filter(g => g.competitions[0].status.type.state === 'post');

console.log('Game States:');
console.log(`  Scheduled: ${scheduled.length}`);
console.log(`  In Progress: ${inProgress.length}`);
console.log(`  Completed: ${completed.length}\n`);

// Show details of each state
if (scheduled.length > 0) {
  const game = scheduled[0];
  console.log('📅 Scheduled Game Example:');
  console.log(`  Game ID: ${game.id}`);
  console.log(`  Date: ${new Date(game.date).toLocaleString()}`);
  console.log(`  Status: ${game.competitions[0].status.type.description}\n`);
}

if (inProgress.length > 0) {
  const game = inProgress[0];
  const comp = game.competitions[0];
  console.log('🏃 In-Progress Game Example:');
  console.log(`  Game ID: ${game.id}`);
  console.log(`  Period: Q${comp.status.period}`);
  console.log(`  Clock: ${comp.status.displayClock}`);
  console.log(`  Status: ${comp.status.type.description}\n`);
}

if (completed.length > 0) {
  const game = completed[0];
  const comp = game.competitions[0];
  const homeTeam = comp.competitors.find(c => c.homeAway === 'home');
  const awayTeam = comp.competitors.find(c => c.homeAway === 'away');
  console.log('✅ Completed Game Example:');
  console.log(`  Game ID: ${game.id}`);
  console.log(`  Final Score: ${awayTeam.team.abbreviation} ${awayTeam.score}, ${homeTeam.team.abbreviation} ${homeTeam.score}`);
  console.log(`  Status: ${comp.status.type.description}\n`);
}

// ============================================================================
// Example 5: Testing Score Progression
// ============================================================================
console.log('\n📋 Example 5: Testing Score Progression\n');

// Find an in-progress game
const progressGame = testGames.find(g => 
  g.competitions[0].status.type.state === 'in' && 
  g.id === '401671002'
);

if (progressGame) {
  console.log('Score progression for game 401671002 (SF vs DET):\n');
  
  const comp = progressGame.competitions[0];
  const homeTeam = comp.competitors.find(c => c.homeAway === 'home');
  const awayTeam = comp.competitors.find(c => c.homeAway === 'away');
  
  console.log(`Current: Q${comp.status.period} ${comp.status.displayClock}`);
  console.log(`Score: ${homeTeam.team.abbreviation} ${homeTeam.score}, ${awayTeam.team.abbreviation} ${awayTeam.score}`);
  console.log('\nNote: Scores progress automatically based on elapsed time from game start\n');
}

// ============================================================================
// Example 6: Special Game Scenarios
// ============================================================================
console.log('\n📋 Example 6: Special Game Scenarios\n');

// Find tie game
const tieGame = testGames.find(g => 
  g.competitions[0].status.type.description.includes('OT') ||
  g.id === '401671009'
);

if (tieGame) {
  const comp = tieGame.competitions[0];
  const homeTeam = comp.competitors.find(c => c.homeAway === 'home');
  const awayTeam = comp.competitors.find(c => c.homeAway === 'away');
  
  console.log('🤝 Tie Game Example:');
  console.log(`  Game ID: ${tieGame.id}`);
  console.log(`  Teams: ${awayTeam.team.abbreviation} @ ${homeTeam.team.abbreviation}`);
  console.log(`  Score: ${awayTeam.score}-${homeTeam.score}`);
  console.log(`  Status: ${comp.status.type.description}\n`);
}

// Find postponed game
const postponedGame = testGames.find(g => 
  g.competitions[0].status.type.name === 'STATUS_POSTPONED'
);

if (postponedGame) {
  const comp = postponedGame.competitions[0];
  const homeTeam = comp.competitors.find(c => c.homeAway === 'home');
  const awayTeam = comp.competitors.find(c => c.homeAway === 'away');
  
  console.log('⏸️  Postponed Game Example:');
  console.log(`  Game ID: ${postponedGame.id}`);
  console.log(`  Teams: ${awayTeam.team.abbreviation} @ ${homeTeam.team.abbreviation}`);
  console.log(`  Status: ${comp.status.type.description}\n`);
}

// ============================================================================
// Example 7: Environment Variable Configuration
// ============================================================================
console.log('\n📋 Example 7: Environment Variable Configuration\n');

console.log('To use mock data via environment variables, set:');
console.log('  USE_MOCK_ESPN=true');
console.log('  MOCK_SEASON=2024');
console.log('  MOCK_WEEK=1');
console.log('  MOCK_SEASON_TYPE=2\n');

console.log('Then your GameService will automatically use mock data!\n');

// ============================================================================
// Example 8: Integration with GameService
// ============================================================================
console.log('\n📋 Example 8: Integration Pattern\n');

console.log('In your code, the GameService will automatically detect mock mode:');
console.log(`
// In GameService.js
function getESPNService() {
  const useMock = process.env.USE_MOCK_ESPN === 'true' || MockESPNService.isEnabled();
  
  if (useMock) {
    console.log('[GameService] Using MockESPNService');
    return MockESPNService;
  }
  
  return ESPNService;
}

// Then in your route handler:
const games = await GameService.getGamesForWeek(2024, 2, 1);
// Will use mock data if USE_MOCK_ESPN=true
`);

// ============================================================================
// Summary
// ============================================================================
console.log('\n' + '='.repeat(60));
console.log('✅ Examples Complete!\n');
console.log('Mock ESPN API provides:');
console.log('  • 10 games with realistic data');
console.log('  • All game states (scheduled, live, final, postponed)');
console.log('  • Automatic score progression');
console.log('  • Easy configuration via code or env vars');
console.log('  • Drop-in replacement for real ESPN API\n');
console.log('Use this for offseason testing, development, and demos!');
console.log('='.repeat(60) + '\n');
