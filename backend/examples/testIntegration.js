#!/usr/bin/env node

/**
 * Integration test for Mock ESPN Service with GameService
 * Tests that the mock data works correctly with the real game service layer
 */

import { MockESPNService } from '../src/mocks/MockESPNService.js';
import { GameService } from '../src/services/GameService.js';

console.log('🧪 Testing Mock ESPN Integration with GameService\n');

// Configure mock service
MockESPNService.configure({
  baseDate: new Date('2024-09-08T12:00:00Z'),
  season: 2024,
  seasonType: 2,
  week: 1
});

console.log('✅ Mock service configured\n');

// Test fetching games through GameService
console.log('Fetching games through GameService.getGamesForWeek()...');
try {
  const games = await GameService.getGamesForWeek(2024, 2, 1, true);
  console.log(`✅ Successfully fetched ${games.length} games\n`);
  
  // Show a few games
  games.slice(0, 3).forEach((game, i) => {
    console.log(`${i + 1}. ${game.awayTeam.abbreviation} @ ${game.homeTeam.abbreviation}`);
    console.log(`   Status: ${game.status}, Score: ${game.awayScore}-${game.homeScore}\n`);
  });
  
  console.log('✅ Integration test passed!');
} catch (error) {
  console.error('❌ Integration test failed:', error.message);
  console.error(error.stack);
  process.exit(1);
}
