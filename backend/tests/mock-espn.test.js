import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import { MockESPNService } from '../src/mocks/MockESPNService.js';
import { generateMockWeek, getProgressiveScore, NFL_TEAMS } from '../src/mocks/espnGameData.js';
import { getMockConfig, validateMockConfig, getScenarioConfig } from '../src/mocks/mockConfig.js';

describe('Mock ESPN Data', () => {
  beforeEach(() => {
    // Reset mock service before each test
    MockESPNService.reset();
  });

  afterEach(() => {
    // Clean up after tests
    MockESPNService.reset();
  });

  describe('MockESPNService', () => {
    test('should configure mock service', () => {
      const config = {
        baseDate: new Date('2024-09-08T12:00:00Z'),
        season: 2024,
        seasonType: 2,
        week: 1
      };

      MockESPNService.configure(config);

      assert.strictEqual(MockESPNService.isEnabled(), true, 'Service should be enabled after configure');
      assert.ok(MockESPNService.getMockGames(), 'Should have mock games');
      assert.ok(MockESPNService.getMockGames().length > 0, 'Should have generated games');
    });

    test('should fetch mock games', async () => {
      MockESPNService.configure({
        baseDate: new Date('2024-09-08T12:00:00Z'),
        season: 2024,
        seasonType: 2,
        week: 1
      });

      const games = await MockESPNService.fetchGames(2024, 2, 1);

      assert.ok(Array.isArray(games), 'Should return an array');
      assert.strictEqual(games.length, 10, 'Should return 10 games');
    });

    test('should return empty array for non-matching week', async () => {
      MockESPNService.configure({
        baseDate: new Date('2024-09-08T12:00:00Z'),
        season: 2024,
        seasonType: 2,
        week: 1
      });

      const games = await MockESPNService.fetchGames(2024, 2, 5);

      assert.ok(Array.isArray(games), 'Should return an array');
      assert.strictEqual(games.length, 0, 'Should return empty array for different week');
    });

    test('should fetch game by ID', async () => {
      MockESPNService.configure({
        baseDate: new Date('2024-09-08T12:00:00Z'),
        season: 2024,
        seasonType: 2,
        week: 1
      });

      const game = await MockESPNService.fetchGameById('401671001');

      assert.ok(game, 'Should return a game');
      assert.strictEqual(game.id, '401671001', 'Should return correct game');
    });

    test('should return null for non-existent game ID', async () => {
      MockESPNService.configure({
        baseDate: new Date('2024-09-08T12:00:00Z'),
        season: 2024,
        seasonType: 2,
        week: 1
      });

      const game = await MockESPNService.fetchGameById('999999');

      assert.strictEqual(game, null, 'Should return null for non-existent game');
    });

    test('should enable and disable mock service', () => {
      assert.strictEqual(MockESPNService.isEnabled(), false, 'Should start disabled');

      MockESPNService.setEnabled(true);
      assert.strictEqual(MockESPNService.isEnabled(), true, 'Should be enabled');

      MockESPNService.setEnabled(false);
      assert.strictEqual(MockESPNService.isEnabled(), false, 'Should be disabled');
    });

    test('should reset mock service', () => {
      MockESPNService.configure({ season: 2024, week: 1 });
      assert.ok(MockESPNService.isEnabled(), 'Should be enabled after configure');

      MockESPNService.reset();
      assert.strictEqual(MockESPNService.isEnabled(), false, 'Should be disabled after reset');
      assert.strictEqual(MockESPNService.getMockGames(), null, 'Should have no games after reset');
    });
  });

  describe('generateMockWeek', () => {
    test('should generate default mock week', () => {
      const games = generateMockWeek();

      assert.ok(Array.isArray(games), 'Should return an array');
      assert.strictEqual(games.length, 10, 'Should generate 10 games');
    });

    test('should generate games with correct structure', () => {
      const games = generateMockWeek({
        baseDate: new Date('2024-09-08T12:00:00Z'),
        season: 2024,
        seasonType: 2,
        week: 1
      });

      const game = games[0];
      
      // Check top-level structure
      assert.ok(game.id, 'Game should have an id');
      assert.ok(game.date, 'Game should have a date');
      assert.ok(game.competitions, 'Game should have competitions');
      assert.ok(Array.isArray(game.competitions), 'Competitions should be an array');
      
      // Check competition structure
      const competition = game.competitions[0];
      assert.ok(competition.competitors, 'Competition should have competitors');
      assert.strictEqual(competition.competitors.length, 2, 'Should have 2 competitors');
      assert.ok(competition.status, 'Competition should have status');
      
      // Check competitors
      const homeTeam = competition.competitors.find(c => c.homeAway === 'home');
      const awayTeam = competition.competitors.find(c => c.homeAway === 'away');
      assert.ok(homeTeam, 'Should have home team');
      assert.ok(awayTeam, 'Should have away team');
      assert.ok(homeTeam.team, 'Home team should have team data');
      assert.ok(awayTeam.team, 'Away team should have team data');
    });

    test('should include all game states', () => {
      const games = generateMockWeek({
        baseDate: new Date('2024-09-08T12:00:00Z'),
        season: 2024,
        seasonType: 2,
        week: 1
      });

      const states = games.map(g => g.competitions[0].status.type.state);
      
      assert.ok(states.includes('pre'), 'Should include scheduled games (pre)');
      assert.ok(states.includes('in'), 'Should include in-progress games (in)');
      assert.ok(states.includes('post'), 'Should include completed games (post)');
    });

    test('should include various game statuses', () => {
      const games = generateMockWeek({
        baseDate: new Date('2024-09-08T12:00:00Z'),
        season: 2024,
        seasonType: 2,
        week: 1
      });

      const statuses = games.map(g => g.competitions[0].status.type.name);
      
      assert.ok(statuses.includes('STATUS_SCHEDULED'), 'Should include scheduled games');
      assert.ok(statuses.includes('STATUS_IN_PROGRESS'), 'Should include in-progress games');
      assert.ok(statuses.includes('STATUS_FINAL'), 'Should include final games');
      assert.ok(statuses.includes('STATUS_POSTPONED'), 'Should include postponed games');
    });

    test('should set correct season and week', () => {
      const games = generateMockWeek({
        baseDate: new Date('2024-09-08T12:00:00Z'),
        season: 2024,
        seasonType: 2,
        week: 5
      });

      games.forEach(game => {
        assert.strictEqual(game.season.year, 2024, 'Game should have correct season');
        assert.strictEqual(game.season.type, 2, 'Game should have correct season type');
        assert.strictEqual(game.week.number, 5, 'Game should have correct week');
      });
    });
  });

  describe('getProgressiveScore', () => {
    test('should not modify non-in-progress games', () => {
      const games = generateMockWeek({
        baseDate: new Date('2024-09-08T12:00:00Z'),
        season: 2024,
        seasonType: 2,
        week: 1
      });

      // Get a scheduled game
      const scheduledGame = games.find(g => g.competitions[0].status.type.state === 'pre');
      const originalScore = scheduledGame.competitions[0].competitors[0].score;

      const updated = getProgressiveScore(scheduledGame, 30);
      const newScore = updated.competitions[0].competitors[0].score;

      assert.strictEqual(originalScore, newScore, 'Scheduled game score should not change');
    });

    test('should update in-progress game scores', () => {
      const games = generateMockWeek({
        baseDate: new Date('2024-09-08T12:00:00Z'),
        season: 2024,
        seasonType: 2,
        week: 1
      });

      // Get an in-progress game
      const inProgressGame = games.find(g => g.id === '401671002'); // SF vs DET

      // At 0 minutes, scores should be 0-0
      const start = getProgressiveScore(inProgressGame, 0);
      assert.strictEqual(start.competitions[0].competitors[0].score, '0', 'Home score should start at 0');
      assert.strictEqual(start.competitions[0].competitors[1].score, '0', 'Away score should start at 0');

      // At 10 minutes, SF should have scored
      const midGame = getProgressiveScore(inProgressGame, 10);
      const homeScore = parseInt(midGame.competitions[0].competitors[0].score);
      assert.ok(homeScore > 0, 'Home team should have scored by minute 10');
    });
  });

  describe('Mock Configuration', () => {
    test('should get default mock config', () => {
      const config = getMockConfig();

      assert.ok(config, 'Should return a config');
      assert.ok(config.baseDate instanceof Date, 'Should have a Date object');
      assert.ok(typeof config.season === 'number', 'Should have a season number');
      assert.ok(typeof config.seasonType === 'number', 'Should have a season type');
      assert.ok(typeof config.week === 'number', 'Should have a week number');
    });

    test('should validate valid config', () => {
      const config = {
        baseDate: new Date(),
        season: 2024,
        seasonType: 2,
        week: 1
      };

      const result = validateMockConfig(config);

      assert.strictEqual(result.valid, true, 'Valid config should pass validation');
      assert.strictEqual(result.errors.length, 0, 'Should have no errors');
    });

    test('should reject invalid season', () => {
      const config = {
        baseDate: new Date(),
        season: 1999, // Too old
        seasonType: 2,
        week: 1
      };

      const result = validateMockConfig(config);

      assert.strictEqual(result.valid, false, 'Invalid season should fail validation');
      assert.ok(result.errors.length > 0, 'Should have errors');
    });

    test('should reject invalid season type', () => {
      const config = {
        baseDate: new Date(),
        season: 2024,
        seasonType: 5, // Invalid
        week: 1
      };

      const result = validateMockConfig(config);

      assert.strictEqual(result.valid, false, 'Invalid season type should fail validation');
      assert.ok(result.errors.some(e => e.includes('seasonType')), 'Should have season type error');
    });

    test('should get scenario configs', () => {
      const allUpcoming = getScenarioConfig('allUpcoming');
      const allCompleted = getScenarioConfig('allCompleted');
      const mixed = getScenarioConfig('mixed');
      const allLive = getScenarioConfig('allLive');

      assert.ok(allUpcoming, 'Should get allUpcoming scenario');
      assert.ok(allCompleted, 'Should get allCompleted scenario');
      assert.ok(mixed, 'Should get mixed scenario');
      assert.ok(allLive, 'Should get allLive scenario');
    });

    test('should throw for unknown scenario', () => {
      assert.throws(
        () => getScenarioConfig('nonexistent'),
        /Unknown scenario/,
        'Should throw for unknown scenario'
      );
    });
  });

  describe('NFL Teams Data', () => {
    test('should have team data', () => {
      assert.ok(NFL_TEAMS, 'Should have NFL_TEAMS object');
      assert.ok(Object.keys(NFL_TEAMS).length > 0, 'Should have teams');
    });

    test('should have complete team data', () => {
      const team = NFL_TEAMS.KC;
      
      assert.ok(team, 'KC should exist');
      assert.ok(team.id, 'Team should have id');
      assert.ok(team.name, 'Team should have name');
      assert.ok(team.abbreviation, 'Team should have abbreviation');
      assert.ok(team.logo, 'Team should have logo');
      assert.ok(team.color, 'Team should have color');
      assert.ok(team.alternateColor, 'Team should have alternate color');
    });

    test('should have multiple teams', () => {
      const teamCount = Object.keys(NFL_TEAMS).length;
      assert.ok(teamCount >= 10, 'Should have at least 10 teams');
    });
  });

  describe('Integration', () => {
    test('should work with GameService pattern', async () => {
      // Configure mock service
      MockESPNService.configure({
        baseDate: new Date('2024-09-08T12:00:00Z'),
        season: 2024,
        seasonType: 2,
        week: 1
      });

      // Fetch games like GameService would
      const games = await MockESPNService.fetchGames(2024, 2, 1);

      assert.ok(games.length > 0, 'Should return games');

      // Check that games can be processed like ESPN data
      games.forEach(game => {
        assert.ok(game.id, 'Each game should have an id');
        assert.ok(game.competitions, 'Each game should have competitions');
        
        const competition = game.competitions[0];
        assert.ok(competition.competitors, 'Each competition should have competitors');
        
        const homeTeam = competition.competitors.find(c => c.homeAway === 'home');
        const awayTeam = competition.competitors.find(c => c.homeAway === 'away');
        
        assert.ok(homeTeam, 'Should have home team');
        assert.ok(awayTeam, 'Should have away team');
      });
    });

    test('should maintain data structure consistency', async () => {
      MockESPNService.configure({
        baseDate: new Date('2024-09-08T12:00:00Z'),
        season: 2024,
        seasonType: 2,
        week: 1
      });

      const games1 = await MockESPNService.fetchGames(2024, 2, 1);
      const games2 = await MockESPNService.fetchGames(2024, 2, 1);

      // Game IDs should be consistent
      const ids1 = games1.map(g => g.id).sort();
      const ids2 = games2.map(g => g.id).sort();

      assert.deepStrictEqual(ids1, ids2, 'Game IDs should be consistent across fetches');
    });
  });
});
