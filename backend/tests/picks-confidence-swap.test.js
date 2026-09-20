import { test, describe, before, after, beforeEach, afterEach, mock } from 'node:test';
import assert from 'node:assert';
import express from 'express';
import picksRouter from '../src/routes/picks.js';
import { AuthService } from '../src/services/AuthService.js';
import { User } from '../src/models/User.js';
import { Group } from '../src/models/Group.js';
import { UserPick } from '../src/models/UserPick.js';
import { GameService } from '../src/services/GameService.js';
import pool from '../src/config/database.js';

// Reordering a ladder is a PERMUTATION of confidences, and a permutation has no
// free slot to route through once every value 1..N is spoken for. Week 2 2026: a
// user trying to swap two games' confidences minutes before kickoff could not
// express it at all -- every ordering of the write tripped the partial unique
// index mid-statement and came back 400 Duplicate confidence (constraint).
//
// These cases pin the two halves of the fix: the route must not reject a valid
// permutation during validation, and the response must carry enough detail for a
// caller to act on a rejection it *does* deserve.

const AUTH = { Authorization: 'Bearer session', 'Content-Type': 'application/json' };
const USER = 83;
const MIN = 60 * 1000;
const at = (offsetMs) => new Date(Date.now() + offsetMs).toISOString();

function game(id, status, gameDate, extra = {}) {
  return {
    id, status, gameDate, espnId: `e${id}`,
    homeTeam: { id: '14', abbreviation: 'LAR' },
    awayTeam: { id: '25', abbreviation: 'SF' },
    homeScore: 0, awayScore: 0, week: 2, season: 2026, seasonType: 2,
    ...extra
  };
}

describe('POST picks: confidence permutations', () => {
  let server, baseURL, upserted;

  before(async () => {
    const app = express();
    app.use(express.json());
    app.use('/api/groups', picksRouter);
    await new Promise((r) => { server = app.listen(0, () => { baseURL = `http://localhost:${server.address().port}`; r(); }); });
  });
  after(async () => { await new Promise((r) => server.close(r)); });

  beforeEach(() => {
    upserted = null;
    mock.method(AuthService, 'verifyAccessToken', () => ({ userId: USER }));
    mock.method(User, 'findById', async () => ({ id: USER, name: 'David', email: 'd@x.io' }));
    mock.method(Group, 'findByIdentifier', async () => ({ id: 6, userRole: 'member' }));
    mock.method(UserPick, 'ensureConfidenceIndex', async () => {});
    mock.method(UserPick, 'bulkUpsert', async ({ picks }) => { upserted = picks; return []; });
    mock.method(UserPick, 'clearPending', async () => {});
    mock.method(pool, 'query', async () => ({ rows: [], rowCount: 0 }));
  });
  afterEach(() => mock.restoreAll());

  const submit = (picks) =>
    fetch(`${baseURL}/api/groups/okun-family-picks/picks`, {
      method: 'POST', headers: AUTH,
      body: JSON.stringify({ season: 2026, seasonType: 2, week: 2, picks, clearedGameIds: [] })
    }).then(async (r) => ({ status: r.status, body: await r.json() }));

  const games = (...list) => mock.method(GameService, 'getGamesForWeek', async () => list);
  const saved = (...picks) => mock.method(UserPick, 'findForUserWeek', async () =>
    picks.map((p) => ({ userId: USER, ...p })));

  test('swapping two games\' confidences is accepted', async () => {
    games(game(201, 'SCHEDULED', at(30 * MIN)), game(202, 'SCHEDULED', at(30 * MIN)));
    saved(
      { gameId: 201, pickedTeamId: '14', confidence: 1 },
      { gameId: 202, pickedTeamId: '25', confidence: 2 }
    );

    const { status, body } = await submit([
      { gameId: 201, pickedTeamId: 14, confidence: 2 },
      { gameId: 202, pickedTeamId: 25, confidence: 1 }
    ]);

    assert.strictEqual(status, 200, `a swap must not be rejected: ${JSON.stringify(body)}`);
    assert.deepStrictEqual(
      upserted.map((p) => [p.gameId, p.confidence]).sort(),
      [[201, 2], [202, 1]],
      'both halves of the swap reach the write'
    );
  });

  test('a three-way rotation is accepted', async () => {
    games(game(201, 'SCHEDULED', at(30 * MIN)), game(202, 'SCHEDULED', at(30 * MIN)), game(203, 'SCHEDULED', at(30 * MIN)));
    saved(
      { gameId: 201, pickedTeamId: '14', confidence: 1 },
      { gameId: 202, pickedTeamId: '14', confidence: 2 },
      { gameId: 203, pickedTeamId: '14', confidence: 3 }
    );

    const { status } = await submit([
      { gameId: 201, pickedTeamId: 14, confidence: 2 },
      { gameId: 202, pickedTeamId: 14, confidence: 3 },
      { gameId: 203, pickedTeamId: 14, confidence: 1 }
    ]);
    assert.strictEqual(status, 200);
  });

  test('a real duplicate inside one payload names both games', async () => {
    games(game(201, 'SCHEDULED', at(30 * MIN)), game(202, 'SCHEDULED', at(30 * MIN)));
    saved();
    const { status, body } = await submit([
      { gameId: 201, pickedTeamId: 14, confidence: 2 },
      { gameId: 202, pickedTeamId: 25, confidence: 2 }
    ]);
    assert.strictEqual(status, 400);
    assert.strictEqual(body.confidence, 2);
    assert.deepStrictEqual(body.gameIds, [201, 202], 'a caller must be told WHICH games collide');
  });

  test('an out-of-range confidence reports the bound it broke', async () => {
    games(game(201, 'SCHEDULED', at(30 * MIN)));
    saved();
    const { status, body } = await submit([{ gameId: 201, pickedTeamId: 14, confidence: 17 }]);
    assert.strictEqual(status, 400);
    assert.strictEqual(body.confidence, 17);
    assert.strictEqual(body.min, 1);
    assert.strictEqual(body.max, 1, 'max is the slate size, so the message is self-explaining');
  });

  test('the response reports games skipped because they had kicked off', async () => {
    games(game(201, 'FINAL', at(-60 * MIN)), game(202, 'SCHEDULED', at(30 * MIN)));
    saved({ gameId: 201, pickedTeamId: '14', confidence: 2 });
    const { status, body } = await submit([
      { gameId: 201, pickedTeamId: 14, confidence: 2 },
      { gameId: 202, pickedTeamId: 25, confidence: 1 }
    ]);
    assert.strictEqual(status, 200, JSON.stringify(body));
    assert.deepStrictEqual(body.skippedLocked, [201]);
  });

  test('every game carries a server-resolved pick window', async () => {
    const kickoff = at(30 * MIN);
    games(game(201, 'SCHEDULED', kickoff), game(202, 'FINAL', at(-60 * MIN)));
    saved();
    const { body } = await submit([{ gameId: 201, pickedTeamId: 14, confidence: 1 }]);
    const open = body.games.find((g) => g.id === 201);
    const shut = body.games.find((g) => g.id === 202);
    assert.strictEqual(open.editable, true);
    assert.strictEqual(open.locksAt, new Date(kickoff).toISOString());
    assert.strictEqual(shut.editable, false, 'a finished game must never read as editable');
  });
});

describe('POST picks: retry correlation', () => {
  // The write is a deterministic whole-week upsert and bulkUpsert serialises
  // concurrent writers, so replaying a submission is safe. Echoing the key back
  // is what lets a client that retried after a timeout tell which send it is
  // looking at instead of guessing.
  test('an Idempotency-Key is echoed back to the caller', async () => {
    const app = express();
    app.use(express.json());
    app.use('/api/groups', picksRouter);
    const srv = await new Promise((r) => { const s = app.listen(0, () => r(s)); });
    const url = `http://localhost:${srv.address().port}/api/groups/g/picks`;
    try {
      mock.method(AuthService, 'verifyAccessToken', () => ({ userId: 83 }));
      mock.method(User, 'findById', async () => ({ id: 83 }));
      mock.method(Group, 'findByIdentifier', async () => ({ id: 6, userRole: 'member' }));
      mock.method(UserPick, 'ensureConfidenceIndex', async () => {});
      mock.method(UserPick, 'findForUserWeek', async () => []);
      mock.method(UserPick, 'bulkUpsert', async () => []);
      mock.method(UserPick, 'clearPending', async () => {});
      mock.method(pool, 'query', async () => ({ rows: [], rowCount: 0 }));
      mock.method(GameService, 'getGamesForWeek', async () => [
        game(301, 'SCHEDULED', new Date(Date.now() + 600000).toISOString())
      ]);

      const res = await fetch(url, {
        method: 'POST',
        headers: { Authorization: 'Bearer s', 'Content-Type': 'application/json', 'Idempotency-Key': 'k-abc' },
        body: JSON.stringify({ season: 2026, seasonType: 2, week: 2, picks: [{ gameId: 301, pickedTeamId: 14, confidence: 1 }], clearedGameIds: [] })
      });
      const body = await res.json();
      assert.strictEqual(res.status, 200, JSON.stringify(body));
      assert.strictEqual(body.idempotencyKey, 'k-abc');
    } finally {
      mock.restoreAll();
      await new Promise((r) => srv.close(r));
    }
  });
});
