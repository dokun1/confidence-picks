import { test, describe, beforeEach, afterEach, mock } from 'node:test';
import assert from 'node:assert';
import { GameService } from '../src/services/GameService.js';
import { Game } from '../src/models/Game.js';
import { MockESPNService } from '../src/mocks/MockESPNService.js';
import { WORLD_CUP_2026_TEAMS } from '../src/mocks/espnWorldCupData.js';

// These tests exercise GameService.getWorldCupStage and resolveWinnerTeamId
// against the MockESPNService + generateMockWorldCupStage fixtures. The DB layer
// (Game.findByESPNId / Game.save) is mocked so the winner-resolution logic is
// asserted without a live Postgres pool. getWorldCupStage attaches winnerTeamId
// onto each returned Game — that is the field the World Cup games route consumes.

describe('GameService.getWorldCupStage winner resolution', () => {
  beforeEach(() => {
    process.env.USE_MOCK_ESPN = 'true';
    MockESPNService.configure(); // enables the mock + seeds mockGames

    // Stub persistence: treat every event as new (no cache) and make save a no-op
    // that returns the Game unchanged, so no DB connection is needed.
    mock.method(Game, 'findByESPNId', async () => null);
    mock.method(Game.prototype, 'save', async function save() {
      this.id = this.id || 1;
      return this;
    });
  });

  afterEach(() => {
    mock.restoreAll();
    MockESPNService.reset();
    delete process.env.USE_MOCK_ESPN;
  });

  test('group-stage draws yield no winner', async () => {
    const games = await GameService.getWorldCupStage('group');

    // Fixture match 1: MEX 1-1 USA, completed regulation draw.
    const draw = games.find(g => g.homeTeam.abbreviation === 'MEX' && g.awayTeam.abbreviation === 'USA');
    assert.ok(draw, 'group slate should include the MEX vs USA draw');
    assert.strictEqual(draw.status, 'FINAL', 'draw match should be completed');
    assert.strictEqual(draw.homeScore, draw.awayScore, 'draw match should be level');
    assert.strictEqual(draw.winnerTeamId, null, 'a group-stage draw has no winner');
  });

  test('regulation knockouts resolve to the higher score', async () => {
    // Knockout stage key routes the mock to the knockout slate; every returned
    // Game is stamped with this knockout stage so KNOCKOUT_STAGES detection fires.
    const games = await GameService.getWorldCupStage('r16');

    // Fixture: ENG 2-0 GER, regulation win — home is the higher-scoring side.
    const reg = games.find(g => g.homeTeam.abbreviation === 'ENG' && g.awayTeam.abbreviation === 'GER');
    assert.ok(reg, 'knockout slate should include ENG vs GER');
    assert.ok(reg.homeScore > reg.awayScore, 'home should be the higher-scoring side');
    assert.strictEqual(reg.winnerTeamId, WORLD_CUP_2026_TEAMS.ENG.id, 'higher-scoring team advances');
  });

  test('PK-shootout knockout resolves via the winner flag at a level 90 scoreline', async () => {
    const games = await GameService.getWorldCupStage('r16');

    // Fixture: MEX 1-1 USA, level at 90', USA (away) advances on penalties.
    const pk = games.find(g => g.homeTeam.abbreviation === 'MEX' && g.awayTeam.abbreviation === 'USA');
    assert.ok(pk, 'knockout slate should include the MEX vs USA shootout');
    assert.strictEqual(pk.homeScore, pk.awayScore, 'PK match should be level after regulation');
    assert.strictEqual(pk.winnerTeamId, WORLD_CUP_2026_TEAMS.USA.id, 'away advances on the ESPN winner flag');
  });
});

describe('GameService.resolveWinnerTeamId (pure)', () => {
  test('knockout falls back to the higher regulation score when no winner flag is set', () => {
    const game = {
      status: 'FINAL',
      completed: true,
      homeTeam: { id: '481' }, // GER
      awayTeam: { id: '448' }, // ENG
      homeScore: 3,
      awayScore: 1
    };
    assert.strictEqual(GameService.resolveWinnerTeamId(game, 'qf', null), '481');
  });

  test('a level knockout with no flag stays unresolved (never a draw)', () => {
    const game = {
      status: 'FINAL',
      completed: true,
      homeTeam: { id: '481' },
      awayTeam: { id: '448' },
      homeScore: 1,
      awayScore: 1
    };
    assert.strictEqual(GameService.resolveWinnerTeamId(game, 'final', null), null);
  });

  test('a non-final match yields no winner regardless of stage', () => {
    const game = {
      status: 'IN_PROGRESS',
      completed: false,
      homeTeam: { id: '1' },
      awayTeam: { id: '2' },
      homeScore: 1,
      awayScore: 0
    };
    assert.strictEqual(GameService.resolveWinnerTeamId(game, 'group', null), null);
    assert.strictEqual(GameService.resolveWinnerTeamId(game, 'qf', 'home'), null);
  });
});
