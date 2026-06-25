import { test, describe } from 'node:test';
import assert from 'node:assert';
import { buildGroupLeaderboard, buildVersionString, getLeaderboardVersion, getGroupLeaderboardCached } from '../src/services/WorldCupLeaderboardService.js';

// Minimal fake pool: returns canned rows per call, in order.
function fakePool(resultsInOrder) {
  let i = 0;
  return { query: async () => ({ rows: resultsInOrder[i++] ?? [] }) };
}

describe('buildGroupLeaderboard', () => {
  test('scores members against finalized games and ranks them', async () => {
    const group = { id: 7 };
    const games = [
      { id: 100, status: 'FINAL', homeScore: 2, awayScore: 0, stage: 'group',
        winnerTeamId: 'H', homeTeam: { id: 'H' }, awayTeam: { id: 'A' } },
    ];
    // 1st query => members, 2nd query => picks
    const pool = fakePool([
      [{ id: 1, name: 'Ann', picture_url: null }, { id: 2, name: 'Bob', picture_url: null }],
      [{ user_id: 1, game_id: 100, picked_result: 'home' },
       { user_id: 2, game_id: 100, picked_result: 'away' }],
    ]);

    const board = await buildGroupLeaderboard(pool, group, games);

    assert.equal(board.length, 2);
    assert.equal(board[0].userId, 1);          // Ann picked correctly -> top
    assert.equal(board[0].rank, 1);
    assert.ok(board[0].points > board[1].points);
    assert.equal(board[1].userId, 2);
  });

  test('members with no picks still appear with a zero row', async () => {
    const group = { id: 7 };
    const games = [{ id: 100, status: 'FINAL', homeScore: 1, awayScore: 1, stage: 'group',
      winnerTeamId: null, homeTeam: { id: 'H' }, awayTeam: { id: 'A' } }];
    const pool = fakePool([
      [{ id: 9, name: 'Cy', picture_url: null }],
      [], // no picks
    ]);
    const board = await buildGroupLeaderboard(pool, group, games);
    assert.equal(board.length, 1);
    assert.equal(board[0].userId, 9);
    assert.equal(board[0].points, 0);
  });
});

describe('version watermark', () => {
  test('buildVersionString is stable for equal inputs and changes on any field', () => {
    const base = { gameWatermark: '2026-06-20T18:00:00.000Z', memberCount: 3, memberMaxId: 42, picksWatermark: '2026-06-20T17:00:00.000Z' };
    const v0 = buildVersionString(base);
    assert.equal(v0, buildVersionString({ ...base }));                       // stable
    assert.notEqual(v0, buildVersionString({ ...base, memberCount: 4 }));    // member joined
    assert.notEqual(v0, buildVersionString({ ...base, memberMaxId: 43 }));   // member churn
    assert.notEqual(v0, buildVersionString({ ...base, gameWatermark: '2026-06-21T00:00:00.000Z' })); // game finalized
    assert.notEqual(v0, buildVersionString({ ...base, picksWatermark: '2026-06-20T19:00:00.000Z' })); // pick edited
  });

  test('getLeaderboardVersion assembles from three queries', async () => {
    let i = 0;
    const pool = { query: async () => {
      const results = [
        [{ watermark: '2026-06-20T18:00:00.000Z' }],   // games
        [{ cnt: '3', maxid: '42' }],                    // members
        [{ watermark: '2026-06-20T17:00:00.000Z' }],   // picks
      ];
      return { rows: results[i++] };
    }};
    const v = await getLeaderboardVersion(pool, { id: 7 });
    assert.equal(typeof v, 'string');
    assert.ok(v.includes('42'));
  });
});

describe('getGroupLeaderboardCached', () => {
  const group = { id: 7 };
  const board = [{ userId: 1, rank: 1, points: 5 }];

  function deps(overrides = {}) {
    return {
      gameService: { getAllWorldCupStages: async () => [{ id: 1 }] },
      getLeaderboardVersion: async () => 'v1',
      buildGroupLeaderboard: async () => board,
      readSnapshot: async () => null,
      writeSnapshot: async () => {},
      ...overrides,
    };
  }

  test('cold miss computes and stores', async () => {
    let wrote = null;
    const d = deps({ writeSnapshot: async (_p, _g, v, p) => { wrote = { v, p }; } });
    const res = await getGroupLeaderboardCached({}, group, d);
    assert.equal(res.source, 'miss');
    assert.deepEqual(res.leaderboard, board);
    assert.equal(wrote.v, 'v1');
    assert.deepEqual(wrote.p, board);
  });

  test('warm hit serves snapshot WITHOUT recomputing', async () => {
    let built = 0;
    const d = deps({
      readSnapshot: async () => ({ version: 'v1', payload: board, computedAt: 'x' }),
      buildGroupLeaderboard: async () => { built++; return board; },
    });
    const res = await getGroupLeaderboardCached({}, group, d);
    assert.equal(res.source, 'hit');
    assert.equal(built, 0);            // the whole point: no O(members*games) work on a hit
    assert.deepEqual(res.leaderboard, board);
  });

  test('stale snapshot (version moved) recomputes', async () => {
    const d = deps({ readSnapshot: async () => ({ version: 'OLD', payload: [], computedAt: 'x' }) });
    const res = await getGroupLeaderboardCached({}, group, d);
    assert.equal(res.source, 'miss');
    assert.deepEqual(res.leaderboard, board);
  });

  test('any error falls back to live compute', async () => {
    // getVersion throws -> catch runs computeLive, which uses the injected fake
    // gameService.getAllWorldCupStages() ([{id:1}]) and the default buildGroupLeaderboard
    // against a pool that returns no members/picks -> empty board, source 'fallback'.
    const emptyPool = { query: async () => ({ rows: [] }) };
    const d = deps({ getLeaderboardVersion: async () => { throw new Error('boom'); } });
    const res = await getGroupLeaderboardCached(emptyPool, group, d);
    assert.equal(res.source, 'fallback');
    assert.ok(Array.isArray(res.leaderboard));
  });
});
