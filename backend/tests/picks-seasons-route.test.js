import { test, describe, before, after, beforeEach, afterEach, mock } from 'node:test';
import assert from 'node:assert';
import express from 'express';
import picksRouter from '../src/routes/picks.js';
import { AuthService } from '../src/services/AuthService.js';
import { User } from '../src/models/User.js';
import { Group } from '../src/models/Group.js';
import { GameService } from '../src/services/GameService.js';
import { UserPick } from '../src/models/UserPick.js';

// Mounts the NFL picks router on a throwaway app at /api/groups and stubs every
// collaborator (auth, group lookup, GameService, UserPick) so the route logic is
// exercised without a live Postgres or ESPN feed — same pattern as
// worldcup-picks-route.test.js. Covers the two endpoints that restore old
// groups' history: GET /:identifier/picks/seasons (season discovery for the
// frontend's default-season logic) and the group-wide `picks` payload on
// GET /:identifier/picks (the member matrix).

const AUTH_HEADER = { Authorization: 'Bearer test-token' };

const memberGroup = { id: 7, identifier: 'sunday-squad', userRole: 'member' };

function finalGame() {
  return {
    id: 101,
    espnId: 'e101',
    homeTeam: { id: '1', name: 'Patriots', abbreviation: 'NE' },
    awayTeam: { id: '2', name: 'Bills', abbreviation: 'BUF' },
    homeScore: 20,
    awayScore: 24,
    status: 'FINAL',
    gameDate: '2025-09-14T17:00:00.000Z',
    week: 2,
    season: 2025,
    seasonType: 2,
  };
}

function scheduledGame() {
  return {
    id: 102,
    espnId: 'e102',
    homeTeam: { id: '2', name: 'Bills', abbreviation: 'BUF' },
    awayTeam: { id: '1', name: 'Patriots', abbreviation: 'NE' },
    homeScore: 0,
    awayScore: 0,
    status: 'SCHEDULED',
    gameDate: '2025-09-21T17:00:00.000Z',
    week: 2,
    season: 2025,
    seasonType: 2,
  };
}

describe('NFL picks router — old-season history endpoints', () => {
  let server;
  let baseURL;

  before(async () => {
    const app = express();
    app.use(express.json());
    app.use('/api/groups', picksRouter);
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
    mock.method(UserPick, 'ensureConfidenceIndex', async () => {});
  });

  afterEach(() => {
    mock.restoreAll();
  });

  describe('GET /:identifier/picks/seasons', () => {
    test('rejects an unauthenticated request', async () => {
      const res = await fetch(`${baseURL}/api/groups/sunday-squad/picks/seasons`);
      assert.strictEqual(res.status, 401);
    });

    test('rejects a non-member with 403', async () => {
      mock.method(Group, 'findByIdentifier', async () => ({ ...memberGroup, userRole: null }));
      const res = await fetch(`${baseURL}/api/groups/sunday-squad/picks/seasons`, { headers: AUTH_HEADER });
      assert.strictEqual(res.status, 403);
    });

    test('404s for an unknown group', async () => {
      mock.method(Group, 'findByIdentifier', async () => null);
      const res = await fetch(`${baseURL}/api/groups/nope/picks/seasons`, { headers: AUTH_HEADER });
      assert.strictEqual(res.status, 404);
    });

    test('returns the seasons with pick data, newest first', async () => {
      mock.method(Group, 'findByIdentifier', async () => ({ ...memberGroup }));
      mock.method(UserPick, 'findSeasonsForGroup', async (groupId) => {
        assert.strictEqual(groupId, memberGroup.id);
        return [2025, 2024];
      });
      const res = await fetch(`${baseURL}/api/groups/sunday-squad/picks/seasons`, { headers: AUTH_HEADER });
      assert.strictEqual(res.status, 200);
      const body = await res.json();
      assert.deepStrictEqual(body, { seasons: [2025, 2024] });
    });

    test('returns an empty list for a group with no picks yet', async () => {
      mock.method(Group, 'findByIdentifier', async () => ({ ...memberGroup }));
      mock.method(UserPick, 'findSeasonsForGroup', async () => []);
      const res = await fetch(`${baseURL}/api/groups/sunday-squad/picks/seasons`, { headers: AUTH_HEADER });
      assert.strictEqual(res.status, 200);
      const body = await res.json();
      assert.deepStrictEqual(body, { seasons: [] });
    });
  });

  describe('GET /:identifier/picks — group-wide member picks payload', () => {
    test('includes every member\'s picks, withholding unstarted games from non-owners', async () => {
      mock.method(Group, 'findByIdentifier', async () => ({ ...memberGroup }));
      mock.method(GameService, 'getGamesForWeek', async () => [finalGame(), scheduledGame()]);
      // Requester (user 1) picks: already graded on the FINAL game, plus one on
      // the SCHEDULED game that must stay visible to its owner.
      mock.method(UserPick, 'findForUserWeek', async () => [
        { gameId: 101, pickedTeamId: '2', confidence: 5, won: true, points: 5 },
        { gameId: 102, pickedTeamId: '1', confidence: 3, won: null, points: null },
      ]);
      // Group-wide rows: user 2's FINAL-game pick is ungraded (points null) to
      // exercise the in-memory grading; their SCHEDULED-game pick must be
      // withheld from the requesting user.
      mock.method(UserPick, 'findForGroupWeek', async () => [
        { userId: 1, gameId: 101, pickedTeamId: '2', confidence: 5, won: true, points: 5 },
        { userId: 1, gameId: 102, pickedTeamId: '1', confidence: 3, won: null, points: null },
        { userId: 2, gameId: 101, pickedTeamId: '1', confidence: 7, won: null, points: null },
        { userId: 2, gameId: 102, pickedTeamId: '2', confidence: 1, won: null, points: null },
      ]);

      const res = await fetch(
        `${baseURL}/api/groups/sunday-squad/picks?season=2025&seasonType=2&week=2`,
        { headers: AUTH_HEADER },
      );
      assert.strictEqual(res.status, 200);
      const body = await res.json();

      assert.ok(Array.isArray(body.picks), 'response carries a member-keyed picks array');
      const byMember = new Map(body.picks.map((entry) => [entry.memberId, entry.picks]));

      // Requester sees both of their own picks, including the unstarted game.
      const mine = byMember.get('1');
      assert.strictEqual(mine.length, 2);

      // The other member's SCHEDULED pick is withheld; only the FINAL game shows.
      const theirs = byMember.get('2');
      assert.strictEqual(theirs.length, 1);
      assert.strictEqual(theirs[0].gameId, 101);

      // Their ungraded FINAL pick was graded in memory: BUF (team 2) won 24-20,
      // they picked NE (team 1) at confidence 7 -> lost 7 points.
      assert.strictEqual(theirs[0].won, false);
      assert.strictEqual(theirs[0].points, -7);
    });

    test('serves an old season when requested explicitly', async () => {
      const captured = {};
      mock.method(Group, 'findByIdentifier', async () => ({ ...memberGroup }));
      mock.method(GameService, 'getGamesForWeek', async (season, seasonType, week) => {
        Object.assign(captured, { season, seasonType, week });
        return [finalGame()];
      });
      mock.method(UserPick, 'findForUserWeek', async () => []);
      mock.method(UserPick, 'findForGroupWeek', async () => []);

      const res = await fetch(
        `${baseURL}/api/groups/sunday-squad/picks?season=2024&seasonType=2&week=18`,
        { headers: AUTH_HEADER },
      );
      assert.strictEqual(res.status, 200);
      // The query's season/week flow straight through — nothing pins the fetch
      // to the current calendar season.
      assert.deepStrictEqual(captured, { season: 2024, seasonType: 2, week: 18 });
      const body = await res.json();
      assert.deepStrictEqual(body.picks, []);
    });
  });
});
