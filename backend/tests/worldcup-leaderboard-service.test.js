import { test, describe } from 'node:test';
import assert from 'node:assert';
import { buildGroupLeaderboard, buildVersionString, getLeaderboardVersion, getGroupLeaderboardCached, leaderboardsMatch } from '../src/services/WorldCupLeaderboardService.js';
import { SCORING_VERSION } from '../src/services/SoccerScoringService.js';
import { UserPick } from '../src/models/UserPick.js';

// buildGroupLeaderboard self-heals the score-prediction columns via UserPick (which
// uses the model's real pool, not the fake passed in) before its SELECT. Replace it
// with a counting no-op so these unit tests never touch a real DB; its real behavior
// is covered in userpick-score-prediction.test.js.
let ensureCalls = 0;
UserPick.ensureScorePredictionColumns = async () => { ensureCalls += 1; };

// Minimal fake pool: returns canned rows per call, in order.
function fakePool(resultsInOrder) {
  let i = 0;
  return { query: async () => ({ rows: resultsInOrder[i++] ?? [] }) };
}

describe('buildGroupLeaderboard', () => {
  test('self-heals the score-prediction columns before reading them', async () => {
    ensureCalls = 0;
    await buildGroupLeaderboard(fakePool([[], []]), { id: 1 }, []);
    assert.equal(ensureCalls, 1, 'must run the read-path column self-heal before the picks SELECT');
  });

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

  test('output rows include bonus_points and it is non-zero on an exact knockout score prediction', async () => {
    // Knockout game: home wins 2-1, user correctly picks 'home' AND predicts exactly 2-1.
    // Expected: 3 points (win) + 2 bonus (exact score) = 5 total; bonus_points = 2.
    const group = { id: 7 };
    const games = [
      {
        id: 200, status: 'FINAL', homeScore: 2, awayScore: 1, stage: 'r16',
        winnerTeamId: 'H', homeTeam: { id: 'H' }, awayTeam: { id: 'A' },
      },
    ];
    const pool = fakePool([
      [{ id: 1, name: 'Ann', picture_url: null }],
      [{ user_id: 1, game_id: 200, picked_result: 'home', predicted_home_score: 2, predicted_away_score: 1 }],
    ]);

    const board = await buildGroupLeaderboard(pool, group, games);

    assert.equal(board.length, 1);
    assert.equal(board[0].userId, 1);
    assert.equal(board[0].points, 5, 'points = 3 (win) + 2 (exact bonus)');
    assert.equal(board[0].bonus_points, 2, 'bonus_points is present and correct');
  });

  test('output rows include bonus_points = 0 when no score prediction is given', async () => {
    const group = { id: 7 };
    const games = [
      {
        id: 201, status: 'FINAL', homeScore: 1, awayScore: 0, stage: 'qf',
        winnerTeamId: 'H', homeTeam: { id: 'H' }, awayTeam: { id: 'A' },
      },
    ];
    const pool = fakePool([
      [{ id: 1, name: 'Ann', picture_url: null }],
      [{ user_id: 1, game_id: 201, picked_result: 'home', predicted_home_score: null, predicted_away_score: null }],
    ]);

    const board = await buildGroupLeaderboard(pool, group, games);

    assert.equal(board.length, 1);
    assert.equal(board[0].points, 3, 'only 3 points for correct pick, no bonus');
    assert.equal(board[0].bonus_points, 0, 'bonus_points is 0 when no prediction');
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

  test('buildVersionString changes when scoringVersion changes (cache invalidation on scoring bump)', () => {
    const base = { gameWatermark: '2026-06-20T18:00:00.000Z', memberCount: 3, memberMaxId: 42, picksWatermark: '2026-06-20T17:00:00.000Z', scoringVersion: '1' };
    const v1 = buildVersionString(base);
    const v2 = buildVersionString({ ...base, scoringVersion: '2' });
    assert.notEqual(v1, v2, 'bumping scoringVersion must produce a different version string');
    // Also confirm the current SCORING_VERSION is embedded when not provided explicitly.
    // It is the last '|'-delimited component, so check it exactly (a substring check
    // would spuriously pass on digits inside watermarks/ids).
    const vDefault = buildVersionString({ gameWatermark: null, memberCount: 0, memberMaxId: 0, picksWatermark: null });
    assert.equal(vDefault.split('|').pop(), SCORING_VERSION, 'default scoringVersion (SCORING_VERSION) should be the trailing component');
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

  test('getLeaderboardVersion includes SCORING_VERSION so a scoring bump invalidates the cache', async () => {
    let i = 0;
    const pool = { query: async () => {
      const results = [
        [{ watermark: '2026-06-20T18:00:00.000Z' }],
        [{ cnt: '3', maxid: '42' }],
        [{ watermark: '2026-06-20T17:00:00.000Z' }],
      ];
      return { rows: results[i++] };
    }};
    const v = await getLeaderboardVersion(pool, { id: 7 });
    // The version string must embed the current SCORING_VERSION as its trailing
    // component so a scoring bump invalidates the cache.
    assert.equal(v.split('|').pop(), SCORING_VERSION, 'SCORING_VERSION must be the trailing component of the version string');
  });

  test('picks watermark is scoped to FINAL games (no churn on pre-kickoff edits)', async () => {
    // Capture each query's SQL. The picks signal must be scoped to picks on FINAL
    // games so that pre-kickoff pick edits — which cannot change the leaderboard,
    // since WC picks lock at kickoff — do not needlessly invalidate the cache.
    const sqls = [];
    const pool = { query: async (sql) => {
      sqls.push(sql);
      const results = [
        [{ watermark: '2026-06-20T18:00:00.000Z' }],   // games
        [{ cnt: '3', maxid: '42' }],                    // members
        [{ watermark: '2026-06-20T17:00:00.000Z' }],   // picks
      ];
      return { rows: results[sqls.length - 1] };
    }};
    await getLeaderboardVersion(pool, { id: 7 });

    assert.equal(sqls.length, 3, 'should issue exactly three queries');
    const picksSql = sqls[2];
    assert.match(picksSql, /from\s+user_picks/i);
    assert.match(picksSql, /join\s+games/i, 'picks query must join games to read status');
    assert.match(picksSql, /status\s*=\s*'FINAL'/i, "picks query must be scoped to FINAL games");
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

describe('leaderboardsMatch', () => {
  // Canonical row as built by buildGroupLeaderboard (JS insertion order).
  const rowA = {
    userId: 1, name: 'Ann', pictureUrl: null,
    rank: 1, tied: false, points: 3,
    wins_correct: 1, losses: 0, draws_correct: 0, draws_incorrect: 0,
  };
  // Same logical row but with JSONB-style key order (alphabetical / arbitrary).
  const rowA_jsonbOrder = {
    draws_correct: 0, draws_incorrect: 0, losses: 0,
    name: 'Ann', pictureUrl: null,
    points: 3, rank: 1, tied: false,
    userId: 1, wins_correct: 1,
  };

  const rowB = {
    userId: 2, name: 'Bob', pictureUrl: null,
    rank: 2, tied: false, points: 0,
    wins_correct: 0, losses: 1, draws_correct: 0, draws_incorrect: 0,
  };

  test('(a) same rows in different key order are equal — the JSONB regression', () => {
    // JSON.stringify would produce different strings here; leaderboardsMatch must not.
    assert.notEqual(JSON.stringify(rowA), JSON.stringify(rowA_jsonbOrder));   // confirm they differ
    assert.equal(leaderboardsMatch([rowA], [rowA_jsonbOrder]), true);
    assert.equal(leaderboardsMatch([rowA, rowB], [rowA_jsonbOrder, rowB]), true);
  });

  test('(b) a difference in points returns false', () => {
    const rowA_mutated = { ...rowA, points: 99 };
    assert.equal(leaderboardsMatch([rowA], [rowA_mutated]), false);
  });

  test('(b) a difference in rank returns false', () => {
    const rowA_mutated = { ...rowA, rank: 2 };
    assert.equal(leaderboardsMatch([rowA], [rowA_mutated]), false);
  });

  test('(c) different lengths return false', () => {
    assert.equal(leaderboardsMatch([rowA], [rowA, rowB]), false);
    assert.equal(leaderboardsMatch([rowA, rowB], [rowA]), false);
    assert.equal(leaderboardsMatch([], [rowA]), false);
  });

  test('two empty arrays are equal', () => {
    assert.equal(leaderboardsMatch([], []), true);
  });

  test('non-array inputs return false', () => {
    assert.equal(leaderboardsMatch(null, []), false);
    assert.equal(leaderboardsMatch([], null), false);
    assert.equal(leaderboardsMatch('x', 'x'), false);
  });
});
