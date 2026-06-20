import { test, describe, before, after, beforeEach, afterEach, mock } from 'node:test';
import assert from 'node:assert';
import express from 'express';
import apiRouter from '../src/routes/api.js';
import { Game } from '../src/models/Game.js';
import { MockESPNService } from '../src/mocks/MockESPNService.js';
import { WORLD_CUP_2026_TEAMS } from '../src/mocks/espnWorldCupData.js';
import { ESPNService } from '../src/services/ESPNService.js';

// Exercises GET /api/games/world-cup-2026/stage/:stage in isolation: the router is
// mounted on a throwaway Express app, ESPN is the mock service, and the DB layer is
// stubbed (no live Postgres). This asserts stage validation plus that each returned
// game carries the GameService-resolved winnerTeamId in the JSON payload.

describe('GET /api/games/world-cup-2026/stage/:stage', () => {
  let server;
  let baseURL;

  before(async () => {
    const app = express();
    app.use('/api', apiRouter);
    await new Promise((resolve) => {
      server = app.listen(0, () => {
        baseURL = `http://localhost:${server.address().port}`;
        resolve();
      });
    });
  });

  after(async () => {
    await new Promise((resolve) => server.close(resolve));
  });

  beforeEach(() => {
    process.env.USE_MOCK_ESPN = 'true';
    MockESPNService.configure();
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

  test('rejects an unknown stage with 400', async () => {
    const response = await fetch(`${baseURL}/api/games/world-cup-2026/stage/quarterfinals`);
    assert.strictEqual(response.status, 400, 'unknown stage should be a client error');
    const data = await response.json();
    assert.ok(data.error, 'should return an error message');
    assert.ok(/quarterfinals/.test(data.error), 'error should name the offending stage');
  });

  test('accepts each valid stage key', async () => {
    for (const stage of ['group', 'r32', 'r16', 'qf', 'sf', 'third', 'final']) {
      const response = await fetch(`${baseURL}/api/games/world-cup-2026/stage/${stage}`);
      assert.strictEqual(response.status, 200, `${stage} should be accepted`);
    }
  });

  test('returns the { games, count, cached } shape with league/stage carried', async () => {
    const response = await fetch(`${baseURL}/api/games/world-cup-2026/stage/group`);
    assert.strictEqual(response.status, 200);
    const data = await response.json();

    assert.ok(Array.isArray(data.games), 'games should be an array');
    assert.strictEqual(data.count, data.games.length, 'count should match games length');
    assert.strictEqual(data.cached, true, 'no refresh requested means cached');

    const game = data.games[0];
    assert.ok(game, 'group slate should be non-empty');
    assert.strictEqual(game.league, 'world_cup', 'each game carries its league');
    assert.strictEqual(game.stage, 'group', 'each game carries its stage');
    assert.ok('winnerTeamId' in game, 'winnerTeamId must be present in the payload');
  });

  test('carries the resolved knockout winnerTeamId through the route', async () => {
    const response = await fetch(`${baseURL}/api/games/world-cup-2026/stage/r16`);
    assert.strictEqual(response.status, 200);
    const data = await response.json();

    // Fixture: ENG 2-0 GER regulation knockout — the higher-scoring side advances.
    const reg = data.games.find(
      (g) => g.homeTeam.abbreviation === 'ENG' && g.awayTeam.abbreviation === 'GER'
    );
    assert.ok(reg, 'knockout slate should include ENG vs GER');
    assert.strictEqual(reg.winnerTeamId, WORLD_CUP_2026_TEAMS.ENG.id, 'advancing team surfaces in JSON');
  });
});

describe('GET /api/games/world-cup-2026/stages', () => {
  let server;
  let baseURL;

  before(async () => {
    const app = express();
    app.use('/api', apiRouter);
    await new Promise((resolve) => {
      server = app.listen(0, () => {
        baseURL = `http://localhost:${server.address().port}`;
        resolve();
      });
    });
  });

  after(async () => {
    await new Promise((resolve) => server.close(resolve));
  });

  beforeEach(() => {
    process.env.USE_MOCK_ESPN = 'true';
    MockESPNService.configure();
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

  test('returns every stage flattened into one { games, count, cached } payload', async () => {
    const response = await fetch(`${baseURL}/api/games/world-cup-2026/stages`);
    assert.strictEqual(response.status, 200);
    const data = await response.json();

    assert.ok(Array.isArray(data.games), 'games should be an array');
    assert.strictEqual(data.count, data.games.length, 'count should match games length');
    assert.strictEqual(data.cached, true, 'no refresh requested means cached');

    // The flattened slate spans multiple stages — not just the group round — so a
    // single request stands in for the old seven-call fan-out.
    const stages = new Set(data.games.map((g) => g.stage));
    assert.ok(stages.has('group'), 'flattened slate includes the group stage');
    assert.ok(stages.size > 1, 'flattened slate spans more than one stage');
    assert.ok('winnerTeamId' in data.games[0], 'winnerTeamId must be present in the payload');
  });

  test('carries the resolved knockout winnerTeamId through the combined route', async () => {
    const response = await fetch(`${baseURL}/api/games/world-cup-2026/stages`);
    assert.strictEqual(response.status, 200);
    const data = await response.json();

    const reg = data.games.find(
      (g) => g.homeTeam?.abbreviation === 'ENG' && g.awayTeam?.abbreviation === 'GER'
    );
    assert.ok(reg, 'flattened slate should include the ENG vs GER knockout fixture');
    assert.strictEqual(reg.winnerTeamId, WORLD_CUP_2026_TEAMS.ENG.id, 'advancing team surfaces in JSON');
  });
});

describe('GET /api/games/world-cup-2026/event/:espnId', () => {
  let server;
  let baseURL;

  before(async () => {
    const app = express();
    app.use('/api', apiRouter);
    await new Promise((resolve) => {
      server = app.listen(0, () => {
        baseURL = `http://localhost:${server.address().port}`;
        resolve();
      });
    });
  });

  after(async () => {
    await new Promise((resolve) => server.close(resolve));
  });

  afterEach(() => {
    mock.restoreAll();
  });

  test('never-500 on fetch failure — returns 200 with sparse body', async () => {
    mock.method(ESPNService, 'fetchSoccerSummary', async () => { throw new Error('boom'); });

    const res = await fetch(`${baseURL}/api/games/world-cup-2026/event/760415`);
    assert.strictEqual(res.status, 200, 'should never 500 on upstream failure');
    const body = await res.json();
    assert.deepStrictEqual(body, { venue: null, stats: [], lineups: null });
  });

  test('happy path — returns 200 with parsed venue', async () => {
    const fixture = {
      header: {
        competitions: [{
          competitors: [
            { homeAway: 'home', team: { id: '1', abbreviation: 'USA', displayName: 'United States' } },
            { homeAway: 'away', team: { id: '2', abbreviation: 'MEX', displayName: 'Mexico' } },
          ],
        }],
      },
      gameInfo: {
        venue: { fullName: 'SoFi Stadium', address: { city: 'Inglewood' } },
      },
    };
    mock.method(ESPNService, 'fetchSoccerSummary', async () => fixture);

    const res = await fetch(`${baseURL}/api/games/world-cup-2026/event/760415`);
    assert.strictEqual(res.status, 200, 'should return 200 on success');
    const body = await res.json();
    assert.strictEqual(body.venue, 'SoFi Stadium · Inglewood', 'venue should be formatted');
  });
});
