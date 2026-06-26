import { test, describe, beforeEach, afterEach, mock } from 'node:test';
import assert from 'node:assert';
import { GameService } from '../src/services/GameService.js';
import { Game } from '../src/models/Game.js';
import { MockESPNService } from '../src/mocks/MockESPNService.js';
import { WORLD_CUP_2026_TEAMS, buildMockWorldCupEvent } from '../src/mocks/espnWorldCupData.js';

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
    // A row written by the current code has its events parsed (empty here). NULL
    // would mark a pre-events-column row and deliberately force a backfill refresh
    // — that path has its own tests below.
    events: [],
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

  test('a started cached game with un-parsed (NULL) events backfills from ESPN', async () => {
    // A FINAL row cached before the events column existed. The one-time backfill
    // must refresh it so its goal/card timeline populates, even though it is
    // otherwise fresh by every other rule (recently updated, completed).
    const cached = cachedGame({ events: null });
    mock.method(Game, 'findByLeagueStage', async () => [cached]);
    const espn = mock.method(MockESPNService, 'fetchSoccerWeek');

    await GameService.getWorldCupStage('group');

    assert.strictEqual(espn.mock.callCount(), 1, 'a started NULL-events row must refresh once');
  });

  test('a SCHEDULED game with NULL events does NOT force a backfill', async () => {
    // Unstarted matches legitimately have no events yet — they must not be pulled
    // into the backfill refresh (that is the "scheduled games keep a long TTL" rule).
    const cached = cachedGame({
      status: 'SCHEDULED',
      gameDate: new Date(Date.now() + 6 * 60 * 60 * 1000), // kicks off in 6h
      events: null,
    });
    mock.method(Game, 'findByLeagueStage', async () => [cached]);
    const espn = mock.method(MockESPNService, 'fetchSoccerWeek');

    const games = await GameService.getWorldCupStage('group');

    assert.strictEqual(espn.mock.callCount(), 0, 'a scheduled NULL-events row stays cached');
    assert.strictEqual(games[0], cached);
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

// Regression for the events-column sev: a deploy can be live before the
// games.events column is migrated in. The stage read must degrade gracefully —
// never re-fetch every request, and never return an id-less game (an id-less
// game silently drops every pick that references it from the leaderboard and the
// picks page, which read as "scores gone" / "picks gone").
describe('GameService.getWorldCupStage events-column resilience', () => {
  // A persisted, completed group game with a real id, as findByLeagueStage
  // returns it. events: null mimics a row from before the events column existed.
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
    events: null,
    lastUpdated: new Date(),
    ...overrides,
  });

  beforeEach(() => {
    process.env.USE_MOCK_ESPN = 'true';
    MockESPNService.configure();
  });

  afterEach(() => {
    mock.restoreAll();
    MockESPNService.reset();
    delete process.env.USE_MOCK_ESPN;
    Game.eventsColumnAvailable = true; // never leak the flag between tests
  });

  test('skips the events backfill when the column is unavailable (no ESPN re-fetch loop)', () => {
    Game.eventsColumnAvailable = false;
    assert.strictEqual(
      GameService.isStageCacheFresh([cachedGame()]),
      true,
      'a started NULL-events row stays fresh when there is no column to backfill into'
    );
    Game.eventsColumnAvailable = true;
    assert.strictEqual(
      GameService.isStageCacheFresh([cachedGame()]),
      false,
      'with the column present the one-time backfill still fires'
    );
  });

  test('serves cached group games WITH their ids when the column is missing', async () => {
    Game.eventsColumnAvailable = false;
    const cached = cachedGame();
    mock.method(Game, 'findByLeagueStage', async () => [cached]);
    const espn = mock.method(MockESPNService, 'fetchSoccerWeek');

    const games = await GameService.getWorldCupStage('group');

    assert.strictEqual(espn.mock.callCount(), 0, 'must not re-fetch from ESPN every request');
    assert.strictEqual(games.length, 1);
    assert.strictEqual(games[0].id, 1, 'the served game keeps its id so the pick join resolves');
  });

  test('a refresh whose persist fails still returns a game carrying the cached id', async () => {
    // Force the live refresh path (in-progress > 60s) and make every save throw,
    // simulating a persistence failure mid-match. The live score must still
    // surface, but the game MUST carry the cached id so picks remain joined.
    const cached = cachedGame({
      status: 'IN_PROGRESS',
      lastUpdated: new Date(Date.now() - 2 * 60 * 1000),
      events: [],
    });
    const espnEvent = buildMockWorldCupEvent({
      id: '760601',
      date: new Date(cached.gameDate),
      homeTeam: WORLD_CUP_2026_TEAMS.MEX,
      awayTeam: WORLD_CUP_2026_TEAMS.USA,
      homeScore: 1,
      awayScore: 0,
      status: 'inProgress',
      stage: 'group',
    });
    mock.method(Game, 'findByLeagueStage', async () => [cached]);
    mock.method(Game, 'findByESPNIds', async () => new Map([['760601', cached]]));
    mock.method(MockESPNService, 'fetchSoccerWeek', async () => [espnEvent]);
    mock.method(Game.prototype, 'save', async () => {
      throw new Error('persist boom');
    });

    const games = await GameService.getWorldCupStage('group');

    assert.strictEqual(games.length, 1);
    assert.ok(games[0].id != null, 'never return an id-less game when a cached id exists');
    assert.strictEqual(games[0].id, 1);
    assert.strictEqual(games[0].homeScore, 1, 'and it carries the live score, not the stale cached one');
  });
});

// Proactive matchup-resolution refresh: a knockout stage still holding bracket
// placeholders must re-check ESPN (throttled) so newly-decided matchups surface
// promptly, instead of being served stale until the 24h TTL. The placeholder
// detection mirrors the frontend's teamDecided rule.
describe('GameService proactive knockout-resolution refresh', () => {
  beforeEach(() => {
    process.env.USE_MOCK_ESPN = 'true';
    MockESPNService.configure();
    GameService._lastStageFetchAt.clear();
  });

  afterEach(() => {
    mock.restoreAll();
    MockESPNService.reset();
    delete process.env.USE_MOCK_ESPN;
    GameService._lastStageFetchAt.clear();
  });

  // A SCHEDULED knockout game two days out, with an unresolved away slot. Every
  // other freshness rule reads it as fresh (recently updated, not live, not near
  // kickoff), so the placeholder rule is the ONLY thing that can force a refresh.
  const koGame = (overrides = {}) => new Game({
    id: 1,
    espnId: '900',
    homeTeam: { id: '3', name: 'United States', abbreviation: 'USA', isActive: true },
    awayTeam: { id: 'tbd', name: 'Third Place Group B/E/F/I/J', abbreviation: '3RD', isActive: false },
    gameDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
    status: 'SCHEDULED',
    homeScore: 0,
    awayScore: 0,
    league: 'world_cup',
    stage: 'r32',
    events: [],
    lastUpdated: new Date(),
    ...overrides,
  });
  const resolvedAway = { id: '4', name: 'Bosnia', abbreviation: 'BIH', isActive: true };

  test('isPlaceholderTeam flags isActive:false, digit abbreviations, and qualification-path names', () => {
    assert.strictEqual(GameService.isPlaceholderTeam({ abbreviation: 'USA', name: 'United States', isActive: true }), false);
    assert.strictEqual(GameService.isPlaceholderTeam({ abbreviation: 'BIH', name: 'Bosnia', isActive: false }), true);
    assert.strictEqual(GameService.isPlaceholderTeam({ abbreviation: '3RD', name: 'x', isActive: true }), true);
    assert.strictEqual(GameService.isPlaceholderTeam({ abbreviation: 'XX', name: 'Group G Winner', isActive: true }), true);
  });

  test('hasUnresolvedKnockoutParticipants flags a placeholder knockout slate, never the group stage', () => {
    assert.strictEqual(GameService.hasUnresolvedKnockoutParticipants([koGame()], 'r32'), true);
    // The group stage always has two real teams, so it is never flagged.
    assert.strictEqual(GameService.hasUnresolvedKnockoutParticipants([koGame()], 'group'), false);
    // A fully-resolved knockout slate is clean.
    assert.strictEqual(GameService.hasUnresolvedKnockoutParticipants([koGame({ awayTeam: resolvedAway })], 'r32'), false);
  });

  test('a placeholder knockout stage forces a refresh, throttled to once per window', () => {
    const now = Date.now();
    // No prior fetch → throttle elapsed → not fresh (refresh to resolve teams).
    assert.strictEqual(GameService.isStageCacheFresh([koGame()], 'r32', now), false);
    // Fetched 1 minute ago → within the 5-min throttle → stays cached.
    GameService._lastStageFetchAt.set('r32', now - 60 * 1000);
    assert.strictEqual(GameService.isStageCacheFresh([koGame()], 'r32', now), true);
    // Fetched 6 minutes ago → throttle elapsed → refresh again.
    GameService._lastStageFetchAt.set('r32', now - 6 * 60 * 1000);
    assert.strictEqual(GameService.isStageCacheFresh([koGame()], 'r32', now), false);
  });

  test('a fully-resolved knockout stage is left cached by this rule', () => {
    assert.strictEqual(GameService.isStageCacheFresh([koGame({ awayTeam: resolvedAway })], 'r32', Date.now()), true);
  });

  test('getWorldCupStage re-checks ESPN for a placeholder knockout slate and records the fetch', async () => {
    mock.method(Game, 'findByLeagueStage', async () => [koGame()]);
    mock.method(Game, 'findByESPNIds', async () => new Map());
    const espn = mock.method(MockESPNService, 'fetchSoccerWeek', async () => []);

    await GameService.getWorldCupStage('r32');

    assert.strictEqual(espn.mock.callCount(), 1, 'placeholder knockout slate must re-check ESPN');
    assert.ok(GameService._lastStageFetchAt.get('r32') != null, 'records the fetch so the next request is throttled');
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
