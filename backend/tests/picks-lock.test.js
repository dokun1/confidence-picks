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

// Picks lock per game at its scheduled kickoff. A member submitting late in the
// week re-sends the whole slate, so the payload always carries picks on games
// that already started. Those must not block saving picks on games that are
// still open -- that is how a member was locked out of an entire Thursday game
// by the finished Wednesday opener.

const AUTH = { Authorization: 'Bearer session', 'Content-Type': 'application/json' };
const USER = 83;
const MIN = 60 * 1000;
const at = (offsetMs) => new Date(Date.now() + offsetMs).toISOString();

function game(id, status, gameDate, extra = {}) {
  return {
    id, status, gameDate, espnId: `e${id}`,
    homeTeam: { id: '14', abbreviation: 'LAR' },
    awayTeam: { id: '25', abbreviation: 'SF' },
    homeScore: 0, awayScore: 0, week: 1, season: 2026, seasonType: 2,
    ...extra
  };
}

describe('POST picks: per-game kickoff lock', () => {
  let server, baseURL, upserted, clearedIds;

  before(async () => {
    const app = express();
    app.use(express.json());
    app.use('/api/groups', picksRouter);
    await new Promise((r) => { server = app.listen(0, () => { baseURL = `http://localhost:${server.address().port}`; r(); }); });
  });
  after(async () => { await new Promise((r) => server.close(r)); });

  beforeEach(() => {
    upserted = null;
    clearedIds = null;
    mock.method(AuthService, 'verifyAccessToken', () => ({ userId: USER }));
    mock.method(User, 'findById', async () => ({ id: USER, name: 'Leigh', email: 'l@x.io' }));
    mock.method(Group, 'findByIdentifier', async () => ({ id: 6, userRole: 'member' }));
    mock.method(UserPick, 'ensureConfidenceIndex', async () => {});
    mock.method(UserPick, 'findForUserWeek', async () => []);
    mock.method(UserPick, 'bulkUpsert', async ({ picks }) => { upserted = picks; return []; });
    mock.method(UserPick, 'clearPending', async ({ gameIds }) => { clearedIds = gameIds; });
    mock.method(pool, 'query', async () => ({ rows: [], rowCount: 0 }));
  });
  afterEach(() => mock.restoreAll());

  const post = (path, body) =>
    fetch(`${baseURL}/api/groups/okun-family-picks${path}`, {
      method: 'POST', headers: AUTH,
      body: JSON.stringify({ season: 2026, seasonType: 2, week: 1, ...body })
    }).then(async (r) => ({ status: r.status, body: await r.json() }));
  const submit = (picks, clearedGameIds = []) => post('/picks', { picks, clearedGameIds });

  const games = (...list) => mock.method(GameService, 'getGamesForWeek', async () => list);
  const saved = (...picks) => mock.method(UserPick, 'findForUserWeek', async () =>
    picks.map((p) => ({ userId: USER, ...p })));

  test('an unchanged pick on a finished game does not block a pick on an open game', async () => {
    games(game(101, 'FINAL', at(-24 * 60 * MIN)), game(102, 'SCHEDULED', at(6 * MIN)));
    saved({ gameId: 101, pickedTeamId: '25', confidence: 2 });

    const { status, body } = await submit([
      { gameId: 101, pickedTeamId: 25, confidence: 2 },
      { gameId: 102, pickedTeamId: 14, confidence: 1 }
    ]);

    assert.strictEqual(status, 200, `expected save to succeed, got ${status} ${JSON.stringify(body)}`);
    assert.deepStrictEqual(upserted.map((p) => p.gameId), [102], 'only the open game is written');
  });

  test('a game kicking off in one second still accepts a pick', async () => {
    games(game(102, 'SCHEDULED', at(1000)));
    const { status, body } = await submit([{ gameId: 102, pickedTeamId: 14, confidence: 1 }]);
    assert.strictEqual(status, 200, JSON.stringify(body));
    assert.deepStrictEqual(upserted.map((p) => p.gameId), [102]);
  });

  test('a game past its scheduled kickoff rejects a new pick even while ESPN still says SCHEDULED', async () => {
    games(game(102, 'SCHEDULED', at(-1000)));
    const { status, body } = await submit([{ gameId: 102, pickedTeamId: 14, confidence: 1 }]);
    assert.strictEqual(status, 409);
    assert.strictEqual(body.gameId, 102);
    assert.strictEqual(upserted, null);
  });

  test('changing the team on a started game is rejected', async () => {
    games(game(101, 'FINAL', at(-60 * MIN)));
    saved({ gameId: 101, pickedTeamId: '25', confidence: 16 });
    const { status, body } = await submit([{ gameId: 101, pickedTeamId: 14, confidence: 16 }]);
    assert.strictEqual(status, 409);
    assert.strictEqual(body.gameId, 101);
  });

  test('changing the confidence on a started game is rejected', async () => {
    games(game(101, 'FINAL', at(-60 * MIN)));
    saved({ gameId: 101, pickedTeamId: '25', confidence: 16 });
    const { status, body } = await submit([{ gameId: 101, pickedTeamId: 25, confidence: 15 }]);
    assert.strictEqual(status, 409);
    assert.strictEqual(body.gameId, 101);
  });

  test('an unchanged started pick still holds its confidence', async () => {
    games(game(101, 'FINAL', at(-60 * MIN)), game(102, 'SCHEDULED', at(60 * MIN)));
    saved({ gameId: 101, pickedTeamId: '25', confidence: 2 });
    const { status, body } = await submit([
      { gameId: 101, pickedTeamId: 25, confidence: 2 },
      { gameId: 102, pickedTeamId: 14, confidence: 2 }
    ]);
    assert.strictEqual(status, 400);
    assert.match(body.error, /Duplicate confidence/);
  });

  test('a postponed game stays open after its original kickoff', async () => {
    games(game(102, 'SCHEDULED', at(-60 * MIN), { postponed: true }));
    const { status, body } = await submit([{ gameId: 102, pickedTeamId: 14, confidence: 1 }]);
    assert.strictEqual(status, 200, JSON.stringify(body));
  });

  test('a confidence held by a game past kickoff cannot be reclaimed', async () => {
    games(game(101, 'SCHEDULED', at(-1000)), game(102, 'SCHEDULED', at(60 * MIN)));
    saved({ gameId: 101, pickedTeamId: '25', confidence: 1 });
    const { status, body } = await submit([{ gameId: 102, pickedTeamId: 14, confidence: 1 }]);
    assert.strictEqual(status, 409);
    assert.match(body.error, /Confidence locked/);
  });

  test('clearing a game past its scheduled kickoff is rejected', async () => {
    games(game(101, 'SCHEDULED', at(-1000)));
    saved({ gameId: 101, pickedTeamId: '25', confidence: 5 });
    const { status, body } = await submit([], [101]);
    assert.strictEqual(status, 409);
    assert.strictEqual(body.gameId, 101);
    assert.strictEqual(clearedIds, null);
  });

  test('clear-all only clears games that have not reached kickoff', async () => {
    games(
      game(101, 'SCHEDULED', at(-1000)),
      game(102, 'SCHEDULED', at(1000)),
      game(103, 'FINAL', at(-60 * MIN))
    );
    const { status } = await post('/picks/clear', {});
    assert.strictEqual(status, 200);
    assert.deepStrictEqual(clearedIds, [102]);
  });

  // Hand-crafted requests (curl) skip the UI entirely. The lock must hold on
  // what the server knows -- its own clock and the stored kickoff -- not on
  // anything the client sends.
  describe('hand-crafted requests', () => {
    test('a duplicate entry cannot smuggle a change past the unchanged-pick skip', async () => {
      games(game(101, 'FINAL', at(-60 * MIN)), game(102, 'SCHEDULED', at(60 * MIN)));
      saved({ gameId: 101, pickedTeamId: '25', confidence: 2 });
      const { status, body } = await submit([
        { gameId: 101, pickedTeamId: 25, confidence: 2 },
        { gameId: 101, pickedTeamId: 14, confidence: 2 }
      ]);
      assert.strictEqual(status, 409);
      assert.strictEqual(body.gameId, 101);
      assert.strictEqual(upserted, null);
    });

    test('a started game cannot be picked by claiming a different week', async () => {
      mock.method(GameService, 'getGamesForWeek', async (_y, _st, week) =>
        week === 2 ? [game(201, 'SCHEDULED', at(7 * 24 * 60 * MIN))] : [game(101, 'SCHEDULED', at(-1000))]);
      const { status } = await post('/picks', { week: 2, picks: [{ gameId: 101, pickedTeamId: 14, confidence: 1 }] });
      assert.strictEqual(status, 400);
      assert.strictEqual(upserted, null);
    });

    test('string-typed values do not slip a new pick past kickoff', async () => {
      games(game(101, 'SCHEDULED', at(-1000)));
      const { status } = await submit([{ gameId: 101, pickedTeamId: '14', confidence: '1' }]);
      assert.strictEqual(status, 409);
      assert.strictEqual(upserted, null);
    });
  });

  // The owner override exists to fix other members' picks, so it skips the lock.
  // Pointed at the owner's own id it would be a late-pick loophole: there the
  // owner is just another member and gets the member rules.
  describe('owner override', () => {
    const OTHER = 22;
    beforeEach(() => {
      mock.method(Group, 'findByIdentifier', async () => ({ id: 6, userRole: 'admin' }));
      mock.method(pool, 'query', async (sql) =>
        /group_memberships/.test(sql) ? { rows: [{ ok: 1 }], rowCount: 1 } : { rows: [], rowCount: 0 });
    });
    const submitFor = (userId, picks, clearedGameIds = []) => post(`/picks/user/${userId}`, { picks, clearedGameIds });

    test('an owner cannot make their own pick after kickoff', async () => {
      games(game(101, 'SCHEDULED', at(-1000)));
      const { status, body } = await submitFor(USER, [{ gameId: 101, pickedTeamId: 14, confidence: 1 }]);
      assert.strictEqual(status, 409);
      assert.strictEqual(body.gameId, 101);
      assert.strictEqual(upserted, null);
    });

    test('an owner can make their own pick until kickoff', async () => {
      games(game(101, 'SCHEDULED', at(1000)));
      const { status, body } = await submitFor(USER, [{ gameId: 101, pickedTeamId: 14, confidence: 1 }]);
      assert.strictEqual(status, 200, JSON.stringify(body));
      assert.deepStrictEqual(upserted.map((p) => p.gameId), [101]);
    });

    test('an owner re-sending their own unchanged started pick is not blocked', async () => {
      games(game(101, 'FINAL', at(-60 * MIN)), game(102, 'SCHEDULED', at(60 * MIN)));
      saved({ gameId: 101, pickedTeamId: '25', confidence: 2 });
      const { status, body } = await submitFor(USER, [
        { gameId: 101, pickedTeamId: 25, confidence: 2 },
        { gameId: 102, pickedTeamId: 14, confidence: 1 }
      ]);
      assert.strictEqual(status, 200, JSON.stringify(body));
      assert.deepStrictEqual(upserted.map((p) => p.gameId), [102]);
    });

    test('an owner cannot clear their own pick after kickoff', async () => {
      games(game(101, 'SCHEDULED', at(-1000)));
      saved({ gameId: 101, pickedTeamId: '25', confidence: 1 });
      const { status, body } = await submitFor(USER, [], [101]);
      assert.strictEqual(status, 409);
      assert.strictEqual(body.gameId, 101);
      assert.strictEqual(clearedIds, null);
    });

    test('an owner cannot reclaim a confidence from their own started game', async () => {
      games(game(101, 'SCHEDULED', at(-1000)), game(102, 'SCHEDULED', at(60 * MIN)));
      saved({ gameId: 101, pickedTeamId: '25', confidence: 1 });
      const { status, body } = await submitFor(USER, [{ gameId: 102, pickedTeamId: 14, confidence: 1 }]);
      assert.strictEqual(status, 409);
      assert.match(body.error, /Confidence locked/);
    });

    test("an owner can still fix another member's pick after kickoff", async () => {
      games(game(101, 'FINAL', at(-60 * MIN)));
      const { status, body } = await submitFor(OTHER, [{ gameId: 101, pickedTeamId: 25, confidence: 1 }]);
      assert.strictEqual(status, 200, JSON.stringify(body));
      assert.deepStrictEqual(upserted.map((p) => p.gameId), [101]);
    });
  });
});
