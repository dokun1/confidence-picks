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

    test('locks picks for matches past kickoff, persisting only the open ones', async () => {
      mock.method(Group, 'findByIdentifier', async () => ({ id: 9, userRole: 'member' }));
      mock.method(pool, 'query', async (sql) => {
        if (/FROM games/.test(sql)) {
          return { rows: [
            // Kickoff an hour ago -> locked, must never reach the upsert.
            { id: 101, season: 2026, season_type: 1, week: 1, game_date: new Date(Date.now() - 60 * 60 * 1000).toISOString() },
            // Kickoff tomorrow -> still open.
            { id: 102, season: 2026, season_type: 1, week: 1, game_date: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() },
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
          { gameId: 101, pickedResult: 'home' }, // started -> dropped
          { gameId: 102, pickedResult: 'draw' }, // open -> saved
        ] }),
      });

      assert.strictEqual(res.status, 200);
      const data = await res.json();
      assert.deepStrictEqual(data.lockedGameIds, [101], 'the started match is reported as locked');
      assert.deepStrictEqual(data.picks, [{ gameId: 102, pickedResult: 'draw' }], 'only the open pick saves');
      // The locked game id must never be handed to the persistence layer.
      const upsertedIds = upsert.mock.calls[0].arguments[0].picks.map((p) => p.gameId);
      assert.deepStrictEqual(upsertedIds, [102], 'upsert receives only the open game');
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

  // The cross-member view/edit routes. The contract under test: ANY member may
  // READ another member's picks (with a canEdit flag that is admin-only), but
  // only an ADMIN may WRITE them. Non-admin writes must be rejected before any
  // persistence so nobody can change another person's picks by guessing a userId.
  describe('GET /group/:groupId/world-cup/user/:userId', () => {
    test('lets a non-admin member view a teammate read-only (canEdit=false)', async () => {
      mock.method(Group, 'findByIdentifier', async () => ({ id: 9, userRole: 'member' }));
      mock.method(pool, 'query', async (sql) => {
        if (/FROM group_memberships/.test(sql)) return { rows: [{ '?column?': 1 }] };
        if (/FROM user_picks/.test(sql)) {
          return { rows: [{ game_id: 101, picked_result: 'home' }] };
        }
        throw new Error(`unexpected query: ${sql}`);
      });

      const res = await fetch(`${baseURL}/api/picks/group/wc-pool/world-cup/user/2`, {
        headers: { ...AUTH_HEADER },
      });
      assert.strictEqual(res.status, 200);
      const data = await res.json();
      assert.strictEqual(data.canEdit, false);
      assert.deepStrictEqual(data.picks, [{ gameId: 101, pickedResult: 'home' }]);
    });

    test('reports canEdit=true for an admin viewer', async () => {
      mock.method(Group, 'findByIdentifier', async () => ({ id: 9, userRole: 'admin' }));
      mock.method(pool, 'query', async (sql) => {
        if (/FROM group_memberships/.test(sql)) return { rows: [{ '?column?': 1 }] };
        if (/FROM user_picks/.test(sql)) return { rows: [] };
        throw new Error(`unexpected query: ${sql}`);
      });
      const res = await fetch(`${baseURL}/api/picks/group/wc-pool/world-cup/user/2`, {
        headers: { ...AUTH_HEADER },
      });
      assert.strictEqual(res.status, 200);
      const data = await res.json();
      assert.strictEqual(data.canEdit, true);
    });

    test('returns 404 when the target user is not a member of the group', async () => {
      mock.method(Group, 'findByIdentifier', async () => ({ id: 9, userRole: 'admin' }));
      mock.method(pool, 'query', async (sql) => {
        if (/FROM group_memberships/.test(sql)) return { rows: [] }; // not a member
        throw new Error(`unexpected query: ${sql}`);
      });
      const res = await fetch(`${baseURL}/api/picks/group/wc-pool/world-cup/user/999`, {
        headers: { ...AUTH_HEADER },
      });
      assert.strictEqual(res.status, 404);
    });

    test('returns 403 when the caller is not a group member', async () => {
      mock.method(Group, 'findByIdentifier', async () => ({ id: 9, userRole: null }));
      const res = await fetch(`${baseURL}/api/picks/group/wc-pool/world-cup/user/2`, {
        headers: { ...AUTH_HEADER },
      });
      assert.strictEqual(res.status, 403);
    });

    test('returns 400 for a non-numeric userId', async () => {
      mock.method(Group, 'findByIdentifier', async () => ({ id: 9, userRole: 'admin' }));
      const res = await fetch(`${baseURL}/api/picks/group/wc-pool/world-cup/user/abc`, {
        headers: { ...AUTH_HEADER },
      });
      assert.strictEqual(res.status, 400);
    });
  });

  describe('POST /group/:groupId/world-cup/user/:userId', () => {
    test('rejects an unauthenticated request', async () => {
      const res = await fetch(`${baseURL}/api/picks/group/wc-pool/world-cup/user/2`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ picks: [] }),
      });
      assert.strictEqual(res.status, 401);
    });

    test('FORBIDS a non-admin from writing a teammate (403, no persistence)', async () => {
      mock.method(Group, 'findByIdentifier', async () => ({ id: 9, userRole: 'member' }));
      const upsert = mock.method(UserPick, 'bulkUpsertWorldCupPicks', async () => []);
      // Membership check should never even be reached, but stub it defensively.
      mock.method(pool, 'query', async () => ({ rows: [{ '?column?': 1 }] }));

      const res = await fetch(`${baseURL}/api/picks/group/wc-pool/world-cup/user/2`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...AUTH_HEADER },
        body: JSON.stringify({ picks: [{ gameId: 101, pickedResult: 'home' }] }),
      });
      assert.strictEqual(res.status, 403);
      const data = await res.json();
      assert.match(data.error, /admins/i);
      assert.strictEqual(upsert.mock.callCount(), 0, 'a non-admin write must never persist');
    });

    test('rejects an invalid pickedResult with 400 before any auth/DB work', async () => {
      mock.method(Group, 'findByIdentifier', async () => ({ id: 9, userRole: 'admin' }));
      const upsert = mock.method(UserPick, 'bulkUpsertWorldCupPicks', async () => []);
      const res = await fetch(`${baseURL}/api/picks/group/wc-pool/world-cup/user/2`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...AUTH_HEADER },
        body: JSON.stringify({ picks: [{ gameId: 101, pickedResult: 'tie' }] }),
      });
      assert.strictEqual(res.status, 400);
      assert.strictEqual(upsert.mock.callCount(), 0);
    });

    test('returns 404 when the target user is not a member', async () => {
      mock.method(Group, 'findByIdentifier', async () => ({ id: 9, userRole: 'admin' }));
      mock.method(pool, 'query', async (sql) => {
        if (/FROM group_memberships/.test(sql)) return { rows: [] };
        throw new Error(`unexpected query: ${sql}`);
      });
      const res = await fetch(`${baseURL}/api/picks/group/wc-pool/world-cup/user/999`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...AUTH_HEADER },
        body: JSON.stringify({ picks: [{ gameId: 101, pickedResult: 'home' }] }),
      });
      assert.strictEqual(res.status, 404);
    });

    test('lets an admin persist picks for the TARGET user (keyed to targetUserId)', async () => {
      mock.method(Group, 'findByIdentifier', async () => ({ id: 9, userRole: 'admin' }));
      mock.method(pool, 'query', async (sql) => {
        if (/FROM group_memberships/.test(sql)) return { rows: [{ '?column?': 1 }] };
        if (/FROM games/.test(sql)) {
          return { rows: [{ id: 101, season: 2026, season_type: 1, week: 1 }] };
        }
        throw new Error(`unexpected query: ${sql}`);
      });
      let seenUserId = null;
      const upsert = mock.method(UserPick, 'bulkUpsertWorldCupPicks', async ({ userId, picks }) => {
        seenUserId = userId;
        return picks.map((p) => ({ gameId: p.gameId, pickedResult: p.pickedResult }));
      });

      const res = await fetch(`${baseURL}/api/picks/group/wc-pool/world-cup/user/2`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...AUTH_HEADER },
        body: JSON.stringify({ picks: [{ gameId: 101, pickedResult: 'home' }] }),
      });
      assert.strictEqual(res.status, 200);
      const data = await res.json();
      assert.strictEqual(upsert.mock.callCount(), 1);
      assert.strictEqual(seenUserId, 2, 'picks must be written under the TARGET user id, not the caller');
      assert.strictEqual(data.isAdminOverride, true);
      assert.strictEqual(data.targetUserId, 2);
      assert.deepStrictEqual(data.picks, [{ gameId: 101, pickedResult: 'home' }]);
    });

    test('rejects a gameId that is not a World Cup game', async () => {
      mock.method(Group, 'findByIdentifier', async () => ({ id: 9, userRole: 'admin' }));
      mock.method(pool, 'query', async (sql) => {
        if (/FROM group_memberships/.test(sql)) return { rows: [{ '?column?': 1 }] };
        if (/FROM games/.test(sql)) return { rows: [] }; // not a WC game
        throw new Error(`unexpected query: ${sql}`);
      });
      const res = await fetch(`${baseURL}/api/picks/group/wc-pool/world-cup/user/2`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...AUTH_HEADER },
        body: JSON.stringify({ picks: [{ gameId: 999, pickedResult: 'home' }] }),
      });
      assert.strictEqual(res.status, 400);
      const data = await res.json();
      assert.match(data.error, /Invalid gameId/);
    });
  });

  describe('leaderboard flag modes', () => {
    // These tests drive the WC_LEADERBOARD_CACHE flag (off / shadow / on) through
    // the leaderboard route. Because ES module named exports are non-configurable
    // live bindings, we cannot mock computeLive/getGroupLeaderboardCached directly.
    // Instead we stub at the dependency level — the same seam the existing
    // leaderboard tests use: mock GameService.getWorldCupStage (so computeLive's
    // getAllWorldCupStages fan-out returns controlled data) and pool.query (so
    // buildGroupLeaderboard, getLeaderboardVersion, readSnapshot, and writeSnapshot
    // all resolve without a live DB). This is exactly equivalent to mocking the
    // orchestrators because they have no logic of their own — they just delegate.
    const groupGame = (id) => ({
      id,
      stage: 'group',
      status: 'FINAL',
      completed: true,
      homeTeam: { id: 'MEX' },
      awayTeam: { id: 'USA' },
      homeScore: 2,
      awayScore: 1,
      winnerTeamId: null,
    });

    // Shared pool.query stub: handles every DB pattern these orchestrators issue.
    function makePoolStub() {
      return mock.method(pool, 'query', async (sql) => {
        // getLeaderboardVersion: game watermark, member signal, picks watermark
        if (/MAX\(last_updated\)/.test(sql)) return { rows: [{ watermark: null }] };
        if (/cnt.*maxid|maxid.*cnt/s.test(sql) || (/COUNT\(\*\)/.test(sql) && /group_memberships/.test(sql))) return { rows: [{ cnt: '1', maxid: '1' }] };
        if (/MAX\(updated_at\)/.test(sql) && /user_picks/.test(sql)) return { rows: [{ watermark: null }] };
        // readSnapshot — returns null (cache miss) so getGroupLeaderboardCached recomputes
        if (/wc_leaderboard_cache/.test(sql) && /SELECT/.test(sql)) return { rows: [] };
        // writeSnapshot
        if (/wc_leaderboard_cache/.test(sql) && /INSERT/.test(sql)) return { rows: [] };
        // buildGroupLeaderboard: members and picks
        if (/group_memberships/.test(sql) && /JOIN users/.test(sql)) {
          return { rows: [{ id: 1, name: 'Alice', picture_url: null }] };
        }
        if (/FROM user_picks/.test(sql)) return { rows: [] };
        // Fallback — fail loudly so a new query doesn't silently return empty.
        throw new Error(`[flag-modes] unexpected query: ${sql}`);
      });
    }

    afterEach(() => {
      // Restore the env var so it doesn't leak into other tests.
      delete process.env.WC_LEADERBOARD_CACHE;
    });

    for (const mode of ['off', 'shadow', 'on']) {
      test(`WC_LEADERBOARD_CACHE=${mode} returns a leaderboard`, async () => {
        process.env.WC_LEADERBOARD_CACHE = mode;
        mock.method(Group, 'findByIdentifier', async () => ({ id: 9, userRole: 'member' }));
        mock.method(GameService, 'getWorldCupStage', async (stage) =>
          stage === 'group' ? [groupGame(201)] : []
        );
        makePoolStub();

        const res = await fetch(`${baseURL}/api/picks/group/test-group/world-cup/leaderboard`, {
          headers: { Authorization: 'Bearer test' },
        });
        assert.equal(res.status, 200);
        const body = await res.json();
        assert.ok(Array.isArray(body.leaderboard));
      });
    }
  });
});
