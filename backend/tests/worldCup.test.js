import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import { MockESPNService } from '../src/mocks/MockESPNService.js';
import { generateMockWorldCupStage, WORLD_CUP_2026_TEAMS } from '../src/mocks/espnWorldCupData.js';
import { Game } from '../src/models/Game.js';

// World Cup 2026 backend suite. This file is the shared home for every World Cup
// test (ingestion, scoring, leaderboard, ...). The scaffolding below — the mock
// imports and the reset hooks — is reused by each later describe block.
//
// Coverage in this file stays on the pure, in-memory parsing path
// (Game.fromESPNData / mock generators). The save()/find* persistence paths need
// a live Postgres pool, so they are out of scope here and exercised elsewhere.

// MockESPNService holds module-level state (config + generated games). Resetting
// before and after every test keeps suites independent and leaves no mock state
// behind once the run finishes — there are no spawned processes to reap.
beforeEach(() => {
  MockESPNService.reset();
});

afterEach(() => {
  MockESPNService.reset();
});

describe('soccer game ingestion', () => {
  describe('group-stage fixtures', () => {
    test('parses the MEX 1-1 USA draw into a world_cup group Game', () => {
      // Match 1 of the group slate: MEX (home) 1-1 USA (away), a regulation draw.
      const [drawMatch] = generateMockWorldCupStage({ stage: 'group' });
      const game = Game.fromESPNData(drawMatch, { league: 'world_cup', stage: 'group' });

      assert.strictEqual(game.league, 'world_cup', 'league should be stamped world_cup');
      assert.strictEqual(game.stage, 'group', 'stage should be stamped group');
      assert.strictEqual(game.homeTeam.abbreviation, 'MEX', 'home should be MEX via homeAway');
      assert.strictEqual(game.awayTeam.abbreviation, 'USA', 'away should be USA via homeAway');
      assert.strictEqual(game.homeScore, 1, 'home score should parse to 1');
      assert.strictEqual(game.awayScore, 1, 'away score should parse to 1');
    });

    test('parses the BRA 2-0 CAN regulation win into a completed Game', () => {
      // Match 2 of the group slate: BRA (home) 2-0 CAN (away), a final win.
      const [, winnerMatch] = generateMockWorldCupStage({ stage: 'group' });
      const game = Game.fromESPNData(winnerMatch, { league: 'world_cup', stage: 'group' });

      assert.strictEqual(game.league, 'world_cup');
      assert.strictEqual(game.stage, 'group');
      assert.strictEqual(game.homeTeam.abbreviation, 'BRA');
      assert.strictEqual(game.awayTeam.abbreviation, 'CAN');
      assert.strictEqual(game.homeScore, 2);
      assert.strictEqual(game.awayScore, 0);
      assert.strictEqual(game.status, 'FINAL', 'completed group win should normalize to FINAL');
    });

    test('stamps league/stage on every group fixture and keeps a valid World Cup team pair', () => {
      const validAbbrs = new Set(Object.values(WORLD_CUP_2026_TEAMS).map(t => t.abbreviation));
      const games = generateMockWorldCupStage({ stage: 'group' })
        .map(event => Game.fromESPNData(event, { league: 'world_cup', stage: 'group' }));

      assert.strictEqual(games.length, 3, 'group stage should ingest 3 fixtures');
      games.forEach(game => {
        assert.strictEqual(game.league, 'world_cup');
        assert.strictEqual(game.stage, 'group');
        assert.ok(validAbbrs.has(game.homeTeam.abbreviation), `${game.homeTeam.abbreviation} should be a World Cup team`);
        assert.ok(validAbbrs.has(game.awayTeam.abbreviation), `${game.awayTeam.abbreviation} should be a World Cup team`);
      });
    });
  });

  describe('knockout fixtures', () => {
    test('parses the ENG 2-0 GER round-of-16 win into a world_cup r16 Game', () => {
      // Match 1 of the knockout slate: ENG (home) 2-0 GER (away), R16, home advances.
      const [r16Match] = generateMockWorldCupStage({ stage: 'knockout' });
      const game = Game.fromESPNData(r16Match, { league: 'world_cup', stage: 'r16' });

      assert.strictEqual(game.league, 'world_cup', 'league should be stamped world_cup');
      assert.strictEqual(game.stage, 'r16', 'stage should carry the knockout code from opts');
      assert.strictEqual(game.homeTeam.abbreviation, 'ENG', 'home should be ENG via homeAway');
      assert.strictEqual(game.awayTeam.abbreviation, 'GER', 'away should be GER via homeAway');
      assert.strictEqual(game.homeScore, 2, 'home score should parse to 2');
      assert.strictEqual(game.awayScore, 0, 'away score should parse to 0');
      assert.strictEqual(game.status, 'FINAL', 'completed knockout should normalize to FINAL');
    });

    test('parses the MEX 1-1 USA penalty-shootout quarter-final at a level scoreline', () => {
      // Match 2 of the knockout slate: MEX (home) 1-1 USA (away), QF decided on PKs.
      // The 90' scoreline is level; Game ingestion keeps the level score, with the
      // advancing-winner resolution left to downstream soccer scoring.
      const [, pkMatch] = generateMockWorldCupStage({ stage: 'knockout' });
      const game = Game.fromESPNData(pkMatch, { league: 'world_cup', stage: 'qf' });

      assert.strictEqual(game.league, 'world_cup');
      assert.strictEqual(game.stage, 'qf');
      assert.strictEqual(game.homeTeam.abbreviation, 'MEX');
      assert.strictEqual(game.awayTeam.abbreviation, 'USA');
      assert.strictEqual(game.homeScore, 1, 'home score should be level at 1');
      assert.strictEqual(game.awayScore, 1, 'away score should be level at 1');
    });

    test('stamps league and the per-match knockout code across the knockout slate', () => {
      const validAbbrs = new Set(Object.values(WORLD_CUP_2026_TEAMS).map(t => t.abbreviation));
      const events = generateMockWorldCupStage({ stage: 'knockout' });
      // The mock tags each competition with its real knockout code; the ingestion
      // caller mirrors that into opts.stage. Pair them up to assert the wiring.
      const stages = events.map(e => e.competitions[0].stage);
      const games = events.map((event, i) => Game.fromESPNData(event, { league: 'world_cup', stage: stages[i] }));

      assert.strictEqual(games.length, 3, 'knockout slate should ingest 3 fixtures');
      games.forEach((game, i) => {
        assert.strictEqual(game.league, 'world_cup');
        assert.strictEqual(game.stage, stages[i], 'stage should match the competition knockout code');
        assert.ok(validAbbrs.has(game.homeTeam.abbreviation), `${game.homeTeam.abbreviation} should be a World Cup team`);
        assert.ok(validAbbrs.has(game.awayTeam.abbreviation), `${game.awayTeam.abbreviation} should be a World Cup team`);
      });
    });
  });
});
