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

    // Stub persistence: an empty stage cache (forces the ESPN refresh path),
    // no per-event cache hits, and a no-op save, so no DB connection is needed.
    mock.method(Game, 'findByLeagueStage', async () => []);
    mock.method(Game, 'findByESPNIds', async () => new Map());
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

describe('GameService.getWorldCupStage persistence resilience', () => {
  beforeEach(() => {
    process.env.USE_MOCK_ESPN = 'true';
    MockESPNService.configure();
    mock.method(Game, 'findByLeagueStage', async () => []);
    mock.method(Game, 'findByESPNIds', async () => new Map());
  });

  afterEach(() => {
    mock.restoreAll();
    MockESPNService.reset();
    delete process.env.USE_MOCK_ESPN;
  });

  // Regression for the prod incident where the games table was missing the
  // winner_team_id column: every Game.save() threw, and getWorldCupStage
  // propagated it as a 500 that blanked the stage list and the leaderboard
  // mid-match. A write failure must now degrade to serving the live ESPN data
  // (in-memory, uncached) rather than failing the read.
  test('a save failure serves live data instead of throwing', async () => {
    mock.method(Game.prototype, 'save', async () => {
      throw new Error('column "winner_team_id" of relation "games" does not exist');
    });

    const games = await GameService.getWorldCupStage('group');

    assert.ok(Array.isArray(games), 'should resolve to a slate, not reject');
    assert.ok(games.length > 0, 'live ESPN games should still be returned when persistence fails');
    // The returned objects carry the live scores parsed from ESPN even though
    // they were never persisted.
    const draw = games.find(g => g.homeTeam.abbreviation === 'MEX' && g.awayTeam.abbreviation === 'USA');
    assert.ok(draw, 'live slate should include the MEX vs USA fixture despite the failed save');
    assert.strictEqual(draw.status, 'FINAL', 'live status should be parsed from ESPN');
  });
});

describe('GameService.getWorldCupStage cache behavior', () => {
  // A persisted Game row as the finders would return it. Defaults to a fresh,
  // completed group-stage regulation result (home 2-1).
  const cachedGame = (overrides = {}) => new Game({
    id: 1,
    espnId: '760601',
    homeTeam: { id: WORLD_CUP_2026_TEAMS.MEX.id, abbreviation: 'MEX' },
    awayTeam: { id: WORLD_CUP_2026_TEAMS.USA.id, abbreviation: 'USA' },
    gameDate: new Date(Date.now() - 24 * 60 * 60 * 1000),
    status: 'FINAL',
    homeScore: 2,
    awayScore: 1,
    week: 1,
    season: 2026,
    seasonType: 1,
    league: 'world_cup',
    stage: 'group',
    lastUpdated: new Date(),
    ...overrides,
  });

  beforeEach(() => {
    process.env.USE_MOCK_ESPN = 'true';
    MockESPNService.configure();
    mock.method(Game, 'findByESPNIds', async () => new Map());
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

  test('serves a fresh cached slate without touching ESPN', async () => {
    const cached = cachedGame();
    mock.method(Game, 'findByLeagueStage', async () => [cached]);
    const espn = mock.method(MockESPNService, 'fetchSoccerWeek');

    const games = await GameService.getWorldCupStage('group');

    assert.strictEqual(espn.mock.callCount(), 0, 'fresh cache must not hit ESPN');
    assert.strictEqual(games.length, 1);
    assert.strictEqual(games[0], cached, 'the cached Game is returned as-is');
    // No stored winner (pre-migration row): a completed regulation result still
    // resolves from the persisted scores.
    assert.strictEqual(games[0].winnerTeamId, WORLD_CUP_2026_TEAMS.MEX.id);
  });

  test('prefers the persisted winner for a cached PK-shootout knockout', async () => {
    // Level 90' scoreline — only the stored winner_team_id knows who advanced.
    const cached = cachedGame({
      stage: 'r16',
      homeScore: 1,
      awayScore: 1,
      winnerTeamId: WORLD_CUP_2026_TEAMS.USA.id,
    });
    mock.method(Game, 'findByLeagueStage', async () => [cached]);
    const espn = mock.method(MockESPNService, 'fetchSoccerWeek');

    const games = await GameService.getWorldCupStage('r16');

    assert.strictEqual(espn.mock.callCount(), 0);
    assert.strictEqual(games[0].winnerTeamId, WORLD_CUP_2026_TEAMS.USA.id);
  });

  test('an in-progress slate older than 60s refreshes from ESPN', async () => {
    const cached = cachedGame({
      status: 'IN_PROGRESS',
      lastUpdated: new Date(Date.now() - 2 * 60 * 1000),
    });
    mock.method(Game, 'findByLeagueStage', async () => [cached]);
    const espn = mock.method(MockESPNService, 'fetchSoccerWeek');

    await GameService.getWorldCupStage('group');

    assert.strictEqual(espn.mock.callCount(), 1, 'stale live slate must refresh');
  });

  test('a SCHEDULED game at/past its start time forces a refresh', async () => {
    const cached = cachedGame({
      status: 'SCHEDULED',
      gameDate: new Date(Date.now() - 5 * 60 * 1000), // kicked off 5 minutes ago
      lastUpdated: new Date(Date.now() - 10 * 60 * 1000),
    });
    mock.method(Game, 'findByLeagueStage', async () => [cached]);
    const espn = mock.method(MockESPNService, 'fetchSoccerWeek');

    await GameService.getWorldCupStage('group');

    assert.strictEqual(espn.mock.callCount(), 1, 'an unstarted-but-due slate must refresh');
  });

  test('forceRefresh skips the cache entirely', async () => {
    const finder = mock.method(Game, 'findByLeagueStage', async () => [cachedGame()]);
    const espn = mock.method(MockESPNService, 'fetchSoccerWeek');

    await GameService.getWorldCupStage('group', true);

    assert.strictEqual(finder.mock.callCount(), 0, 'forceRefresh must not read the stage cache');
    assert.strictEqual(espn.mock.callCount(), 1);
  });

  test('the refresh path persists the resolved winner with the row', async () => {
    mock.method(Game, 'findByLeagueStage', async () => []);
    const savedWinners = new Map();
    mock.method(Game.prototype, 'save', async function save() {
      savedWinners.set(`${this.homeTeam.abbreviation}-${this.awayTeam.abbreviation}`, this.winnerTeamId);
      this.id = this.id || 1;
      return this;
    });

    await GameService.getWorldCupStage('r16');

    // Fixture: MEX 1-1 USA decided on penalties — the winner must already be on
    // the Game at save time, otherwise a cached read can never score the match.
    assert.strictEqual(savedWinners.get('MEX-USA'), WORLD_CUP_2026_TEAMS.USA.id);
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
