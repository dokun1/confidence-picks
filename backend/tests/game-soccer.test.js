import { test, describe } from 'node:test';
import assert from 'node:assert';
import { Game } from '../src/models/Game.js';
import { generateMockWeek } from '../src/mocks/espnGameData.js';
import { generateMockWorldCupStage } from '../src/mocks/espnWorldCupData.js';

// These tests focus on the pure fromESPNData / toJSON behavior — the league/stage
// stamping and the shared competitor parsing — without touching the database. The
// save()/find* persistence paths require a live Postgres pool, so they are exercised
// only indirectly here (column wiring is verified by reading the SQL, not by a DB hit).

describe('Game.fromESPNData league/stage stamping', () => {
  test('stamps league and stage from opts for a soccer event', () => {
    const [drawMatch] = generateMockWorldCupStage({ stage: 'group' });
    const game = Game.fromESPNData(drawMatch, { league: 'world_cup', stage: 'group' });

    assert.strictEqual(game.league, 'world_cup');
    assert.strictEqual(game.stage, 'group');
  });

  test('carries a knockout stage key through from opts', () => {
    const [r16Match] = generateMockWorldCupStage({ stage: 'knockout' });
    const game = Game.fromESPNData(r16Match, { league: 'world_cup', stage: 'r16' });

    assert.strictEqual(game.league, 'world_cup');
    assert.strictEqual(game.stage, 'r16');
  });

  test('leaves league and stage null for an NFL event (no opts)', () => {
    const [nflGame] = generateMockWeek();
    const game = Game.fromESPNData(nflGame);

    assert.strictEqual(game.league, null);
    assert.strictEqual(game.stage, null);
  });

  test('does not apply the preseason week-0 remap to soccer events', () => {
    // Soccer events carry season.type 1, the same value NFL preseason uses. With
    // PRESEASON_FINAL_WEEK matching the soccer week, the NFL-only remap must not fire.
    const prev = process.env.PRESEASON_FINAL_WEEK;
    process.env.PRESEASON_FINAL_WEEK = '1'; // soccer events default to week 1
    try {
      const [drawMatch] = generateMockWorldCupStage({ stage: 'group' });
      const game = Game.fromESPNData(drawMatch, { league: 'world_cup', stage: 'group' });
      // Untouched: still season.type 1, week 1 — not remapped to regular-season week 0.
      assert.strictEqual(game.seasonType, 1);
      assert.strictEqual(game.week, 1);
    } finally {
      if (prev === undefined) delete process.env.PRESEASON_FINAL_WEEK;
      else process.env.PRESEASON_FINAL_WEEK = prev;
    }
  });
});

describe('Game.fromESPNData soccer competitor parsing', () => {
  test('parses home/away competitors via the shared homeAway field', () => {
    // Match 1 from the group stage is MEX (home) 1-1 USA (away).
    const [drawMatch] = generateMockWorldCupStage({ stage: 'group' });
    const game = Game.fromESPNData(drawMatch, { league: 'world_cup', stage: 'group' });

    assert.strictEqual(game.homeTeam.abbreviation, 'MEX');
    assert.strictEqual(game.awayTeam.abbreviation, 'USA');
    assert.strictEqual(game.homeScore, 1);
    assert.strictEqual(game.awayScore, 1);
  });

  test('parses a knockout winner-decided match correctly', () => {
    // Knockout slate: ENG 2-0 GER (home advances).
    const [r16Match] = generateMockWorldCupStage({ stage: 'knockout' });
    const game = Game.fromESPNData(r16Match, { league: 'world_cup', stage: 'r16' });

    assert.strictEqual(game.homeTeam.abbreviation, 'ENG');
    assert.strictEqual(game.awayTeam.abbreviation, 'GER');
    assert.strictEqual(game.homeScore, 2);
    assert.strictEqual(game.awayScore, 0);
    assert.strictEqual(game.status, 'FINAL');
  });
});

describe('Game.toJSON surfaces league and stage', () => {
  test('includes league and stage for a soccer game', () => {
    const [drawMatch] = generateMockWorldCupStage({ stage: 'group' });
    const json = Game.fromESPNData(drawMatch, { league: 'world_cup', stage: 'group' }).toJSON();

    assert.ok('league' in json, 'toJSON should include a league field');
    assert.ok('stage' in json, 'toJSON should include a stage field');
    assert.strictEqual(json.league, 'world_cup');
    assert.strictEqual(json.stage, 'group');
  });

  test('includes the fields as null for an NFL game', () => {
    const [nflGame] = generateMockWeek();
    const json = Game.fromESPNData(nflGame).toJSON();

    assert.ok('league' in json, 'toJSON should always include the league field');
    assert.ok('stage' in json, 'toJSON should always include the stage field');
    assert.strictEqual(json.league, null);
    assert.strictEqual(json.stage, null);
  });
});
