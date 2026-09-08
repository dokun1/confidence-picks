import { test, describe, before, after, beforeEach, afterEach, mock } from 'node:test';
import assert from 'node:assert';
import express from 'express';
import picksRouter from '../src/routes/picks.js';
import { AuthService } from '../src/services/AuthService.js';
import { User } from '../src/models/User.js';
import { Group } from '../src/models/Group.js';
import { UserPick } from '../src/models/UserPick.js';
import { GameService } from '../src/services/GameService.js';

// CONTRACT TESTS for the published MCP client.
//
// `confidence-picks-mcp` is on npm, so copies of it run on other people's
// machines against this production API, pinned to whatever version they
// installed. Unlike the frontend, those clients do not redeploy with the backend
// and cannot be fixed by shipping.
//
// These cases pin the request and response shapes that the published client
// depends on. They are not testing behaviour that other suites already cover --
// they exist so that CHANGING ONE OF THESE SHAPES FAILS LOUDLY HERE, as a
// deliberate decision to break installed clients, rather than silently in
// someone's terminal.
//
// The most dangerous of these is POST /picks. mergeWeek() in mcp/src/core.js
// encodes its semantics: confidence unique across the week, a used value being
// implicitly reclaimed, and a started game rejecting the write. If those change,
// published clients corrupt weeks.

const AUTH = { Authorization: 'Bearer session', 'Content-Type': 'application/json' };
const GROUP = { id: 9, identifier: 'squad', userRole: 'member' };

function game(id, status = 'SCHEDULED') {
  return { id, status, homeTeam: { id: `${id}h`, abbreviation: 'HOM' }, awayTeam: { id: `${id}a`, abbreviation: 'AWY' } };
}

describe('MCP API contract', () => {
  let server, baseURL;

  before(async () => {
    const app = express();
    app.use(express.json());
    app.use('/api/groups', picksRouter);
    await new Promise((r) => { server = app.listen(0, () => { baseURL = `http://localhost:${server.address().port}`; r(); }); });
  });
  after(async () => { await new Promise((r) => server.close(r)); });

  beforeEach(() => {
    mock.method(AuthService, 'verifyAccessToken', () => ({ userId: 1 }));
    mock.method(User, 'findById', async () => ({ id: 1, name: 'Tester', email: 't@x.io' }));
    mock.method(Group, 'findByIdentifier', async () => ({ ...GROUP }));
  });
  afterEach(() => mock.restoreAll());

  describe('GET /:group/picks/me', () => {
    // core.js getMyPicks() reads `.picks`, and mergeWeek() reads exactly
    // gameId / pickedTeamId / confidence off each entry.
    test('returns { picks: [{ gameId, pickedTeamId, confidence }] }', async () => {
      mock.method(UserPick, 'findForUserWeek', async () => ([
        { gameId: 11, pickedTeamId: '11h', confidence: 3, extraInternalField: 'ignored' }
      ]));
      const res = await fetch(`${baseURL}/api/groups/squad/picks/me?season=2026&seasonType=2&week=1`, { headers: AUTH });
      assert.strictEqual(res.status, 200);
      const body = await res.json();
      assert.ok(Array.isArray(body.picks), 'response must have a `picks` array');
      assert.deepStrictEqual(Object.keys(body.picks[0]).sort(), ['confidence', 'gameId', 'pickedTeamId']);
    });

    test('omits rows with neither a winner nor a confidence', async () => {
      // mergeWeek treats an entry as meaningful state; empty rows would make it
      // post entries the server then rejects.
      mock.method(UserPick, 'findForUserWeek', async () => ([
        { gameId: 11, pickedTeamId: null, confidence: null },
        { gameId: 12, pickedTeamId: '12h', confidence: 1 }
      ]));
      const res = await fetch(`${baseURL}/api/groups/squad/picks/me?season=2026&seasonType=2&week=1`, { headers: AUTH });
      const body = await res.json();
      assert.deepStrictEqual(body.picks.map((p) => p.gameId), [12]);
    });
  });

  describe('POST /:group/picks', () => {
    beforeEach(() => {
      mock.method(UserPick, 'ensureConfidenceIndex', async () => {});
      mock.method(UserPick, 'findForUserWeek', async () => []);
      mock.method(UserPick, 'bulkUpsert', async () => {});
      mock.method(UserPick, 'clearPending', async () => {});
    });

    // submit_week posts the WHOLE week. If the accepted body shape changes,
    // every installed client breaks at once.
    test('accepts { season, seasonType, week, picks[], clearedGameIds[] }', async () => {
      mock.method(GameService, 'getGamesForWeek', async () => [game(11), game(12)]);
      const res = await fetch(`${baseURL}/api/groups/squad/picks`, {
        method: 'POST', headers: AUTH,
        body: JSON.stringify({
          season: 2026, seasonType: 2, week: 1,
          picks: [{ gameId: 11, pickedTeamId: '11h', confidence: 2 }],
          clearedGameIds: []
        })
      });
      assert.ok(res.status < 400, `expected success, got ${res.status} ${await res.text()}`);
    });

    // mergeWeek resolves collisions client-side precisely because this is a 400.
    test('rejects a duplicate confidence with 400', async () => {
      mock.method(GameService, 'getGamesForWeek', async () => [game(11), game(12)]);
      const res = await fetch(`${baseURL}/api/groups/squad/picks`, {
        method: 'POST', headers: AUTH,
        body: JSON.stringify({
          season: 2026, seasonType: 2, week: 1,
          picks: [
            { gameId: 11, pickedTeamId: '11h', confidence: 2 },
            { gameId: 12, pickedTeamId: '12h', confidence: 2 }
          ]
        })
      });
      assert.strictEqual(res.status, 400);
      assert.match((await res.json()).error, /[Dd]uplicate confidence/);
    });

    // The client surfaces this as "a game has already kicked off". The status
    // code and the gameId field are both part of that message.
    test('rejects a started game with 409 and names the gameId', async () => {
      mock.method(GameService, 'getGamesForWeek', async () => [game(11, 'IN_PROGRESS')]);
      const res = await fetch(`${baseURL}/api/groups/squad/picks`, {
        method: 'POST', headers: AUTH,
        body: JSON.stringify({
          season: 2026, seasonType: 2, week: 1,
          picks: [{ gameId: 11, pickedTeamId: '11h', confidence: 1 }]
        })
      });
      assert.strictEqual(res.status, 409);
      const body = await res.json();
      assert.match(body.error, /locked/i);
      assert.strictEqual(body.gameId, 11);
    });

    test('requires a winner whenever a confidence is set', async () => {
      mock.method(GameService, 'getGamesForWeek', async () => [game(11)]);
      const res = await fetch(`${baseURL}/api/groups/squad/picks`, {
        method: 'POST', headers: AUTH,
        body: JSON.stringify({
          season: 2026, seasonType: 2, week: 1,
          picks: [{ gameId: 11, confidence: 1 }]
        })
      });
      assert.strictEqual(res.status, 400);
      assert.match((await res.json()).error, /Winner required/i);
    });
  });
});
