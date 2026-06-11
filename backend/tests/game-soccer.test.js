import { test, describe } from 'node:test';
import assert from 'node:assert';
import { Game } from '../src/models/Game.js';
import { generateMockWeek } from '../src/mocks/espnGameData.js';
import {
  generateMockWorldCupStage,
  buildMockWorldCupEvent,
  WORLD_CUP_2026_TEAMS,
} from '../src/mocks/espnWorldCupData.js';

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

  // League defaults to 'nfl' (not null) so the games.league NOT NULL DEFAULT
  // isn't bypassed with an explicit NULL on save — see fromESPNData.
  test("defaults league to 'nfl' and stage to null for an NFL event (no opts)", () => {
    const [nflGame] = generateMockWeek();
    const game = Game.fromESPNData(nflGame);

    assert.strictEqual(game.league, 'nfl');
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

  test("includes league 'nfl' and a null stage for an NFL game", () => {
    const [nflGame] = generateMockWeek();
    const json = Game.fromESPNData(nflGame).toJSON();

    assert.ok('league' in json, 'toJSON should always include the league field');
    assert.ok('stage' in json, 'toJSON should always include the stage field');
    assert.strictEqual(json.league, 'nfl');
    assert.strictEqual(json.stage, null);
  });
});

describe('Game.fromESPNData match events (goals/cards)', () => {
  const { MEX, USA } = WORLD_CUP_2026_TEAMS;

  function eventMatch(events, overrides = {}) {
    return buildMockWorldCupEvent({
      id: '900',
      date: new Date('2026-06-11T18:00:00Z'),
      homeTeam: MEX,
      awayTeam: USA,
      homeScore: 2,
      awayScore: 1,
      status: 'final',
      stage: 'group',
      events,
      ...overrides,
    });
  }

  test('flattens ESPN details into { type, minute, player, side, teamAbbr }', () => {
    const game = Game.fromESPNData(
      eventMatch([
        { type: 'goal', minute: "9'", player: 'J. Quiñones', side: 'home' },
        { type: 'yellow-card', minute: "17'", player: 'T. Mokoena', side: 'away' },
        { type: 'red-card', minute: "49'", player: 'S. Sithole', side: 'away' },
      ]),
      { league: 'world_cup', stage: 'group' },
    );

    assert.strictEqual(game.events.length, 3);
    assert.deepStrictEqual(game.events[0], {
      type: 'goal',
      minute: "9'",
      player: 'J. Quiñones',
      side: 'home',
      teamAbbr: MEX.abbreviation,
    });
    assert.strictEqual(game.events[1].type, 'yellow-card');
    assert.strictEqual(game.events[1].side, 'away');
    assert.strictEqual(game.events[1].teamAbbr, USA.abbreviation);
    assert.strictEqual(game.events[2].type, 'red-card');
  });

  test('classifies an own goal distinctly from a regular goal', () => {
    const game = Game.fromESPNData(
      eventMatch([{ type: 'own-goal', minute: "30'", player: 'A. Defender', side: 'home' }]),
      { league: 'world_cup', stage: 'group' },
    );
    assert.strictEqual(game.events[0].type, 'own-goal');
  });

  test('returns [] for a scheduled match with no details, and toJSON exposes an array', () => {
    const game = Game.fromESPNData(
      buildMockWorldCupEvent({
        id: '901',
        date: new Date('2026-07-01T18:00:00Z'),
        homeTeam: MEX,
        awayTeam: USA,
        homeScore: 0,
        awayScore: 0,
        status: 'scheduled',
        stage: 'group',
      }),
      { league: 'world_cup', stage: 'group' },
    );
    assert.deepStrictEqual(game.events, []);
    assert.ok(Array.isArray(game.toJSON().events));
  });

  test('drops a detail whose team matches neither competitor', () => {
    const ev = eventMatch([{ type: 'goal', minute: "9'", player: 'Ghost', side: 'home' }]);
    // Re-point the lone detail at an unknown team id; the parser can't resolve a side.
    ev.competitions[0].details[0].team = { id: '99999' };
    const game = Game.fromESPNData(ev, { league: 'world_cup', stage: 'group' });
    assert.deepStrictEqual(game.events, []);
  });
});
