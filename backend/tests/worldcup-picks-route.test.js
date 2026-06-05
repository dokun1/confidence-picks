import { test, describe, before, after, beforeEach, afterEach, mock } from 'node:test';
import assert from 'node:assert';
import express from 'express';
import worldCupPicksRouter from '../src/routes/worldCupPicks.js';
import { AuthService } from '../src/services/AuthService.js';
import { User } from '../src/models/User.js';
import { Group } from '../src/models/Group.js';
import { GameService } from '../src/services/GameService.js';
import { UserPick } from '../src/models/UserPick.js';
import pool from '../src/config/database.js';

// Mounts the World Cup picks router on a throwaway app at /api/picks and stubs
// every collaborator (auth, group lookup, GameService, UserPick, pool) so the
// route logic is exercised without a live Postgres or ESPN feed. Auth is faked by
// stubbing AuthService.verifyAccessToken + User.findById, the same seam the real
// authenticateToken middleware reads.

const AUTH_HEADER = { Authorization: 'Bearer test-token' };

describe('World Cup picks router', () => {
  let server;
  let baseURL;

  before(async () => {
    const app = express();
    app.use(express.json());
    app.use('/api/picks', worldCupPicksRouter);
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
    mock.method(AuthService, 'verifyAccessToken', () => ({ userId: 1 }));
    mock.method(User, 'findById', async () => ({ id: 1, name: 'Tester', email: 't@x.io' }));
  });

  afterEach(() => {
    mock.restoreAll();
  });

  describe('POST /group/:groupId/world-cup', () => {
    test('rejects an unauthenticated request', async () => {
      const res = await fetch(`${baseURL}/api/picks/group/wc-pool/world-cup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ picks: [] }),
      });
      assert.strictEqual(res.status, 401);
    });

    test('rejects an invalid pickedResult with 400 before any DB write', async () => {
      mock.method(Group, 'findByIdentifier', async () => ({ id: 9, userRole: 'member' }));
      const upsert = mock.method(UserPick, 'bulkUpsertWorldCupPicks', async () => []);

      const res = await fetch(`${baseURL}/api/picks/group/wc-pool/world-cup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...AUTH_HEADER },
        body: JSON.stringify({ picks: [{ gameId: 101, pickedResult: 'tie' }] }),
      });
      assert.strictEqual(res.status, 400);
      const data = await res.json();
      assert.match(data.error, /Invalid pickedResult/);
      assert.strictEqual(upsert.mock.callCount(), 0, 'must not persist an invalid pick');
    });

    test('returns 403 when the caller is not a group member', async () => {
      mock.method(Group, 'findByIdentifier', async () => ({ id: 9, userRole: null }));
      const res = await fetch(`${baseURL}/api/picks/group/wc-pool/world-cup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...AUTH_HEADER },
        body: JSON.stringify({ picks: [{ gameId: 101, pickedResult: 'home' }] }),
      });
      assert.strictEqual(res.status, 403);
    });

    test('persists valid picks via the World Cup upsert path', async () => {
      mock.method(Group, 'findByIdentifier', async () => ({ id: 9, userRole: 'member' }));
      mock.method(pool, 'query', async (sql) => {
        if (/FROM games/.test(sql)) {
          return { rows: [
            { id: 101, season: 2026, season_type: 1, week: 1 },
            { id: 102, season: 2026, season_type: 1, week: 1 },
          ] };
        }
        throw new Error(`unexpected query: ${sql}`);
      });
      const upsert = mock.method(UserPick, 'bulkUpsertWorldCupPicks', async ({ picks }) =>
        picks.map((p) => ({ gameId: p.gameId, pickedResult: p.pickedResult }))
      );

      const res = await fetch(`${baseURL}/api/picks/group/wc-pool/world-cup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...AUTH_HEADER },
        body: JSON.stringify({ picks: [
          { gameId: 101, pickedResult: 'home' },
          { gameId: 102, pickedResult: 'draw' },
        ] }),
      });
      assert.strictEqual(res.status, 200);
      const data = await res.json();
      assert.strictEqual(upsert.mock.callCount(), 1, 'one upsert call per slot');
      assert.deepStrictEqual(data.picks, [
        { gameId: 101, pickedResult: 'home' },
        { gameId: 102, pickedResult: 'draw' },
      ]);
    });

    test('rejects a gameId that is not a World Cup game', async () => {
      mock.method(Group, 'findByIdentifier', async () => ({ id: 9, userRole: 'member' }));
      mock.method(pool, 'query', async () => ({ rows: [] })); // no matching WC games
      const res = await fetch(`${baseURL}/api/picks/group/wc-pool/world-cup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...AUTH_HEADER },
        body: JSON.stringify({ picks: [{ gameId: 999, pickedResult: 'home' }] }),
      });
      assert.strictEqual(res.status, 400);
      const data = await res.json();
      assert.match(data.error, /Invalid gameId/);
    });
  });

  describe('GET /group/:groupId/world-cup/leaderboard', () => {
    const groupGame = (id, homeScore, awayScore) => ({
      id,
      stage: 'group',
      status: 'FINAL',
      completed: true,
      homeTeam: { id: 'MEX' },
      awayTeam: { id: 'USA' },
      homeScore,
      awayScore,
      winnerTeamId: null,
    });

    test('orders members by score with the four tiebreaker counts and rank', async () => {
      mock.method(Group, 'findByIdentifier', async () => ({ id: 9, userRole: 'member' }));
      mock.method(GameService, 'getWorldCupStage', async (stage) => {
        if (stage === 'group') {
          return [groupGame(101, 2, 1), groupGame(102, 1, 1)]; // home win, draw
        }
        return [];
      });
      mock.method(pool, 'query', async (sql) => {
        if (/group_memberships/.test(sql) && /JOIN users/.test(sql)) {
          return { rows: [
            { id: 1, name: 'Alice', picture_url: 'a.png' },
            { id: 2, name: 'Bob', picture_url: 'b.png' },
          ] };
        }
        if (/FROM user_picks/.test(sql)) {
          return { rows: [
            { user_id: 1, game_id: 101, picked_result: 'home' }, // correct win -> 3
            { user_id: 1, game_id: 102, picked_result: 'draw' }, // correct draw -> 2
            { user_id: 2, game_id: 101, picked_result: 'away' }, // wrong -> 0 (loss)
          ] };
        }
        throw new Error(`unexpected query: ${sql}`);
      });

      const res = await fetch(`${baseURL}/api/picks/group/wc-pool/world-cup/leaderboard`, {
        headers: { ...AUTH_HEADER },
      });
      assert.strictEqual(res.status, 200);
      const { leaderboard } = await res.json();

      assert.strictEqual(leaderboard.length, 2);
      const [first, second] = leaderboard;

      assert.strictEqual(first.userId, 1);
      assert.strictEqual(first.name, 'Alice');
      assert.strictEqual(first.rank, 1);
      assert.strictEqual(first.points, 5);
      assert.strictEqual(first.wins_correct, 1);
      assert.strictEqual(first.draws_correct, 1);
      assert.strictEqual(first.losses, 0);
      assert.strictEqual(first.draws_incorrect, 0);

      assert.strictEqual(second.userId, 2);
      assert.strictEqual(second.rank, 2);
      assert.strictEqual(second.points, 0);
      assert.strictEqual(second.losses, 1);
    });

    test('includes members with no picks as zero rows', async () => {
      mock.method(Group, 'findByIdentifier', async () => ({ id: 9, userRole: 'admin' }));
      mock.method(GameService, 'getWorldCupStage', async (stage) =>
        stage === 'group' ? [groupGame(101, 2, 1)] : []
      );
      mock.method(pool, 'query', async (sql) => {
        if (/group_memberships/.test(sql) && /JOIN users/.test(sql)) {
          return { rows: [{ id: 5, name: 'Solo', picture_url: null }] };
        }
        if (/FROM user_picks/.test(sql)) return { rows: [] };
        throw new Error(`unexpected query: ${sql}`);
      });

      const res = await fetch(`${baseURL}/api/picks/group/wc-pool/world-cup/leaderboard`, {
        headers: { ...AUTH_HEADER },
      });
      assert.strictEqual(res.status, 200);
      const { leaderboard } = await res.json();
      assert.strictEqual(leaderboard.length, 1);
      assert.strictEqual(leaderboard[0].userId, 5);
      assert.strictEqual(leaderboard[0].points, 0);
      assert.strictEqual(leaderboard[0].rank, 1);
    });

    test('returns 404 for an unknown group', async () => {
      mock.method(Group, 'findByIdentifier', async () => null);
      const res = await fetch(`${baseURL}/api/picks/group/nope/world-cup/leaderboard`, {
        headers: { ...AUTH_HEADER },
      });
      assert.strictEqual(res.status, 404);
    });
  });
});
